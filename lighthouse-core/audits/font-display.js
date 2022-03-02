/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const Audit = require('./audit');
const NetworkRequest = require('../lib/network-request');
const allowedFontFaceDisplays = ['block', 'fallback', 'optional', 'swap'];

class FontDisplay extends Audit {
  /**
   * @return {LH.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'font-display',
      title: 'All text remains visible during webfont loads',
      failureTitle: 'Text is invisible while webfonts are loading',
      description: 'Leverage the font-display CSS feature to ensure text is user-visible while ' +
        'webfonts are loading. ' +
        '[Learn more](https://developers.google.com/web/updates/2016/02/font-display).',
      requiredArtifacts: ['devtoolsLogs', 'Fonts'],
    };
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @return {Promise<LH.Audit.Product>}
   */
  static audit(artifacts) {
    const devtoolsLogs = artifacts.devtoolsLogs[this.DEFAULT_PASS];
    const fontFaces = artifacts.Fonts;

    // Filter font-faces that do not have a display tag with optional or swap
    const fontsWithoutProperDisplay = fontFaces.filter(fontFace =>
      !fontFace.display || !allowedFontFaceDisplays.includes(fontFace.display)
    );

    return artifacts.requestNetworkRecords(devtoolsLogs).then((networkRecords) => {
      const results = networkRecords.filter(record => {
        const isFont = record.resourceType === NetworkRequest.TYPES.Font;

        return isFont;
      })
        .filter(fontRecord => {
          // find the fontRecord of a font
          return !!fontsWithoutProperDisplay.find(fontFace => {
            return !!fontFace.src && !!fontFace.src.find(src => fontRecord.url === src);
          });
        })
        // calculate wasted time
        .map(record => {
          // In reality the end time should be calculated with paint time included
          // all browsers wait 3000ms to block text so we make sure 3000 is our max wasted time
          const wastedTime = Math.min((record.endTime - record.startTime) * 1000, 3000);

          return {
            url: record.url,
            wastedTime,
          };
        });

      const headings = [
        {key: 'url', itemType: 'url', text: 'Font URL'},
        {key: 'wastedTime', itemType: 'ms', granularity: 1, text: 'Font download time'},
      ];
      const details = Audit.makeTableDetails(headings, results);

      return {
        score: Number(results.length === 0),
        rawValue: results.length === 0,
        details,
      };
    });
  }
}

module.exports = FontDisplay;
