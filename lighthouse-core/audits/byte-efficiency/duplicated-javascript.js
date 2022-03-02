/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

/** @typedef {import('./byte-efficiency-audit.js').ByteEfficiencyProduct} ByteEfficiencyProduct */
/** @typedef {LH.Audit.ByteEfficiencyItem & {source: string, subItems: {type: 'subitems', items: SubItem[]}}} Item */
/** @typedef {{url: string, sourceTransferBytes?: number}} SubItem */

const ByteEfficiencyAudit = require('./byte-efficiency-audit.js');
const ModuleDuplication = require('../../computed/module-duplication.js');
const NetworkAnalyzer = require('../../lib/dependency-graph/simulator/network-analyzer.js');
const i18n = require('../../lib/i18n/i18n.js');

const UIStrings = {
  /** Imperative title of a Lighthouse audit that tells the user to remove duplicate JavaScript from their code. This is displayed in a list of audit titles that Lighthouse generates. */
  title: 'Remove duplicate modules in JavaScript bundles',
  /** Description of a Lighthouse audit that tells the user *why* they should remove duplicate JavaScript from their scripts. This is displayed after a user expands the section to see more. No word length limits. 'Learn More' becomes link text to additional documentation. */
  description: 'Remove large, duplicate JavaScript modules from bundles ' +
    'to reduce unnecessary bytes consumed by network activity. ', // +
  // TODO: we need docs.
  // '[Learn more](https://web.dev/duplicated-javascript/).',
};

const str_ = i18n.createMessageInstanceIdFn(__filename, UIStrings);

const IGNORE_THRESHOLD_IN_BYTES = 1024;

/**
 * @param {string} haystack
 * @param {string} needle
 * @param {number} startPosition
 */
function indexOfOrEnd(haystack, needle, startPosition = 0) {
  const index = haystack.indexOf(needle, startPosition);
  return index === -1 ? haystack.length : index;
}

class DuplicatedJavascript extends ByteEfficiencyAudit {
  /**
   * @return {LH.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'duplicated-javascript',
      title: str_(UIStrings.title),
      description: str_(UIStrings.description),
      scoreDisplayMode: ByteEfficiencyAudit.SCORING_MODES.NUMERIC,
      requiredArtifacts: ['devtoolsLogs', 'traces', 'SourceMaps', 'ScriptElements', 'URL'],
    };
  }

  /**
   * @param {string} source
   */
  static _getNodeModuleName(source) {
    const sourceSplit = source.split('node_modules/');
    source = sourceSplit[sourceSplit.length - 1];

    const indexFirstSlash = indexOfOrEnd(source, '/');
    if (source[0] === '@') {
      return source.slice(0, indexOfOrEnd(source, '/', indexFirstSlash + 1));
    }

    return source.slice(0, indexFirstSlash);
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @param {LH.Audit.Context} context
   */
  static async _getDuplicationGroupedByNodeModules(artifacts, context) {
    const duplication = await ModuleDuplication.request(artifacts, context);

    /** @type {typeof duplication} */
    const groupedDuplication = new Map();
    for (const [source, sourceDatas] of duplication.entries()) {
      if (!source.includes('node_modules')) {
        groupedDuplication.set(source, sourceDatas);
        continue;
      }

      const normalizedSource = 'node_modules/' + DuplicatedJavascript._getNodeModuleName(source);
      const aggregatedSourceDatas = groupedDuplication.get(normalizedSource) || [];
      for (const {scriptUrl, resourceSize} of sourceDatas) {
        let sourceData = aggregatedSourceDatas.find(d => d.scriptUrl === scriptUrl);
        if (!sourceData) {
          sourceData = {scriptUrl, resourceSize: 0};
          aggregatedSourceDatas.push(sourceData);
        }
        sourceData.resourceSize += resourceSize;
      }
      groupedDuplication.set(normalizedSource, aggregatedSourceDatas);
    }

    for (const sourceDatas of duplication.values()) {
      sourceDatas.sort((a, b) => b.resourceSize - a.resourceSize);
    }

    return groupedDuplication;
  }

  /**
   *
   * @param {LH.Artifacts.NetworkRequest|undefined} networkRecord
   * @param {number} contentLength
   */
  static _estimateTransferRatio(networkRecord, contentLength) {
    const transferSize =
      ByteEfficiencyAudit.estimateTransferSize(networkRecord, contentLength, 'Script');
    return transferSize / contentLength;
  }

  /**
   * This audit highlights JavaScript modules that appear to be duplicated across all resources,
   * either within the same bundle or between different bundles. Each details item returned is
   * a module with subItems for each resource that includes it. The wastedBytes for the details
   * item is the number of bytes occupied by the sum of all but the largest copy of the module.
   * wastedBytesByUrl attributes the cost of the bytes to a specific resource, for use by lantern.
   * @param {LH.Artifacts} artifacts
   * @param {Array<LH.Artifacts.NetworkRequest>} networkRecords
   * @param {LH.Audit.Context} context
   * @return {Promise<ByteEfficiencyAudit.ByteEfficiencyProduct>}
   */
  static async audit_(artifacts, networkRecords, context) {
    const ignoreThresholdInBytes =
      context.options && context.options.ignoreThresholdInBytes || IGNORE_THRESHOLD_IN_BYTES;
    const duplication =
      await DuplicatedJavascript._getDuplicationGroupedByNodeModules(artifacts, context);
    const mainDocumentRecord = await NetworkAnalyzer.findMainDocument(networkRecords);

    /** @type {Map<string, number>} */
    const transferRatioByUrl = new Map();

    /** @type {Item[]} */
    const items = [];

    let overflowWastedBytes = 0;
    const overflowUrls = new Set();

    /** @type {Map<string, number>} */
    const wastedBytesByUrl = new Map();
    for (const [source, sourceDatas] of duplication.entries()) {
      // One copy of this module is treated as the canonical version - the rest will have
      // non-zero `wastedBytes`. In the case of all copies being the same version, all sizes are
      // equal and the selection doesn't matter. When the copies are different versions, it does
      // matter. Ideally the newest version would be the canonical copy, but version information
      // is not present. Instead, size is used as a heuristic for latest version. This makes the
      // audit conserative in its estimation.

      /** @type {SubItem[]} */
      const subItems = [];

      let wastedBytesTotal = 0;
      for (let i = 0; i < sourceDatas.length; i++) {
        const sourceData = sourceDatas[i];
        const url = sourceData.scriptUrl;

        /** @type {number|undefined} */
        let transferRatio = transferRatioByUrl.get(url);
        if (transferRatio === undefined) {
          const networkRecord = url === artifacts.URL.finalUrl ?
            mainDocumentRecord :
            networkRecords.find(n => n.url === url);

          const script = artifacts.ScriptElements.find(script => script.src === url);
          if (!script || script.content === null) {
            // This should never happen because we found the wasted bytes from bundles, which required contents in a ScriptElement.
            continue;
          }

          const contentLength = script.content.length;
          transferRatio = DuplicatedJavascript._estimateTransferRatio(networkRecord, contentLength);
          transferRatioByUrl.set(url, transferRatio);
        }

        if (transferRatio === undefined) {
          // Shouldn't happen for above reasons.
          continue;
        }

        const transferSize = Math.round(sourceData.resourceSize * transferRatio);

        subItems.push({
          url,
          sourceTransferBytes: transferSize,
        });

        if (i === 0) continue;
        wastedBytesTotal += transferSize;
        wastedBytesByUrl.set(url, (wastedBytesByUrl.get(url) || 0) + transferSize);
      }

      if (wastedBytesTotal <= ignoreThresholdInBytes) {
        overflowWastedBytes += wastedBytesTotal;
        for (const subItem of subItems) {
          overflowUrls.add(subItem.url);
        }
        continue;
      }

      items.push({
        source,
        wastedBytes: wastedBytesTotal,
        // Not needed, but keeps typescript happy.
        url: '',
        // Not needed, but keeps typescript happy.
        totalBytes: 0,
        subItems: {
          type: 'subitems',
          items: subItems,
        },
      });
    }

    if (overflowWastedBytes > ignoreThresholdInBytes) {
      items.push({
        source: 'Other',
        wastedBytes: overflowWastedBytes,
        url: '',
        totalBytes: 0,
        subItems: {
          type: 'subitems',
          items: Array.from(overflowUrls).map(url => ({url})),
        },
      });
    }

    /** @type {LH.Audit.Details.OpportunityColumnHeading[]} */
    const headings = [
      /* eslint-disable max-len */
      {key: 'source', valueType: 'code', subItemsHeading: {key: 'url', valueType: 'url'}, label: str_(i18n.UIStrings.columnSource)},
      {key: null, valueType: 'bytes', subItemsHeading: {key: 'sourceTransferBytes'}, granularity: 0.05, label: str_(i18n.UIStrings.columnTransferSize)},
      {key: 'wastedBytes', valueType: 'bytes', granularity: 0.05, label: str_(i18n.UIStrings.columnWastedBytes)},
      /* eslint-enable max-len */
    ];

    // TODO: show warning somewhere if no source maps.
    return {
      items,
      headings,
      wastedBytesByUrl,
    };
  }
}

module.exports = DuplicatedJavascript;
module.exports.UIStrings = UIStrings;
