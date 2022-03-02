/**
 * @license Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const makeComputedArtifact = require('../computed-artifact.js');
const LanternMetric = require('./lantern-metric.js');
const BaseNode = require('../../lib/dependency-graph/base-node.js');
const LHError = require('../../lib/lh-error.js');
const LanternFirstContentfulPaint = require('./lantern-first-contentful-paint.js');

/** @typedef {BaseNode.Node} Node */

class LanternFirstMeaningfulPaint extends LanternMetric {
  /**
   * @return {LH.Gatherer.Simulation.MetricCoefficients}
   */
  static get COEFFICIENTS() {
    return {
      intercept: 0,
      optimistic: 0.5,
      pessimistic: 0.5,
    };
  }

  /**
   * @param {Node} dependencyGraph
   * @param {LH.Artifacts.TraceOfTab} traceOfTab
   * @return {Node}
   */
  static getOptimisticGraph(dependencyGraph, traceOfTab) {
    const fmp = traceOfTab.timestamps.firstMeaningfulPaint;
    if (!fmp) {
      throw new LHError(LHError.errors.NO_FMP);
    }

    const blockingScriptUrls = LanternMetric.getScriptUrls(dependencyGraph, node => {
      return (
        node.endTime <= fmp && node.hasRenderBlockingPriority() && node.initiatorType !== 'script'
      );
    });

    return dependencyGraph.cloneWithRelationships(node => {
      if (node.endTime > fmp && !node.isMainDocument()) return false;
      // Include EvaluateScript tasks for blocking scripts
      if (node.type === BaseNode.TYPES.CPU) {
        return node.isEvaluateScriptFor(blockingScriptUrls);
      }

      // Include non-script-initiated network requests with a render-blocking priority
      return node.hasRenderBlockingPriority() && node.initiatorType !== 'script';
    });
  }

  /**
   * @param {Node} dependencyGraph
   * @param {LH.Artifacts.TraceOfTab} traceOfTab
   * @return {Node}
   */
  static getPessimisticGraph(dependencyGraph, traceOfTab) {
    const fmp = traceOfTab.timestamps.firstMeaningfulPaint;
    if (!fmp) {
      throw new LHError(LHError.errors.NO_FMP);
    }

    const requiredScriptUrls = LanternMetric.getScriptUrls(dependencyGraph, node => {
      return node.endTime <= fmp && node.hasRenderBlockingPriority();
    });

    return dependencyGraph.cloneWithRelationships(node => {
      if (node.endTime > fmp && !node.isMainDocument()) return false;

      // Include CPU tasks that performed a layout or were evaluations of required scripts
      if (node.type === BaseNode.TYPES.CPU) {
        return node.didPerformLayout() || node.isEvaluateScriptFor(requiredScriptUrls);
      }

      // Include all network requests that had render-blocking priority (even script-initiated)
      return node.hasRenderBlockingPriority();
    });
  }

  /**
   * @param {LH.Artifacts.MetricComputationDataInput} data
   * @param {LH.Audit.Context} context
   * @return {Promise<LH.Artifacts.LanternMetric>}
   */
  static async compute_(data, context) {
    const fcpResult = await LanternFirstContentfulPaint.request(data, context);
    const metricResult = await this.computeMetricWithGraphs(data, context);
    metricResult.timing = Math.max(metricResult.timing, fcpResult.timing);
    return metricResult;
  }
}

module.exports = makeComputedArtifact(LanternFirstMeaningfulPaint);
