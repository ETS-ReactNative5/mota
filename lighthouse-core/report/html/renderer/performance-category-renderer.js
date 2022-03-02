/**
 * @license
 * Copyright 2018 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

/* globals self, Util, CategoryRenderer */

/** @typedef {import('./dom.js')} DOM */

class PerformanceCategoryRenderer extends CategoryRenderer {
  /**
   * @param {LH.ReportResult.AuditRef[]} audits
   * @return {Element}
   */
  _renderMetric(audits) {
    const baseAudit = audits[0];

    const tmpl = this.dom.cloneTemplate('#tmpl-lh-metric', this.templateContext);
    const element = this.dom.find('.lh-metric', tmpl);
    // TODO(hoten) - report diff - this rating class should be applied to each audit score icon.
    // But the score icons in the metrics table use a ::before selector, unlike the other score icons.
    // Need to change that.
    const rating = Util.calculateRating(baseAudit.result.score, baseAudit.result.scoreDisplayMode);
    element.classList.add(`lh-metric--${rating}`);
    element.id = baseAudit.result.id;

    const titleEl = this.dom.find('.lh-metric__title', tmpl);
    titleEl.textContent = baseAudit.result.title;

    const descriptionEl = this.dom.find('.lh-metric__description', tmpl);
    descriptionEl.appendChild(this.dom.convertMarkdownLinkSnippets(baseAudit.result.description));

    const valuesEl = this.dom.find('.lh-metric__values', tmpl);
    for (const audit of audits) {
      const valueEl = this.dom.createChildOf(valuesEl, 'div', 'lh-metric__value');
      valueEl.textContent = audit.result.displayValue || '';

      const rating = Util.calculateRating(audit.result.score, audit.result.scoreDisplayMode);
      valueEl.classList.add(`lh-metric--${rating}`);

      if (audit.result.scoreDisplayMode === 'error') {
        descriptionEl.textContent = '';
        valueEl.textContent = 'Error!';
        const tooltip = this.dom.createChildOf(descriptionEl, 'span');
        tooltip.textContent = audit.result.errorMessage || 'Report error: no metric information';
      }
    }

    return element;
  }

  /**
   * @param {LH.ReportResult.AuditRef} audit
   * @param {number} scale
   * @return {Element}
   */
  _renderOpportunity(audit, scale) {
    const oppTmpl = this.dom.cloneTemplate('#tmpl-lh-opportunity', this.templateContext);
    const element = this.populateAuditValues(audit, oppTmpl);
    element.id = audit.result.id;

    if (!audit.result.details || audit.result.scoreDisplayMode === 'error') {
      return element;
    }
    const details = audit.result.details;
    if (details.type !== 'opportunity') {
      return element;
    }

    // Overwrite the displayValue with opportunity's wastedMs
    const displayEl = this.dom.find('.lh-audit__display-text', element);
    const sparklineWidthPct = `${details.overallSavingsMs / scale * 100}%`;
    this.dom.find('.lh-sparkline__bar', element).style.width = sparklineWidthPct;
    displayEl.textContent = Util.formatSeconds(details.overallSavingsMs, 0.01);

    // Set [title] tooltips
    if (audit.result.displayValue) {
      const displayValue = audit.result.displayValue;
      this.dom.find('.lh-load-opportunity__sparkline', element).title = displayValue;
      displayEl.title = displayValue;
    }

    return element;
  }

  /**
   * @param {LH.ReportResult.AuditRef[]} audits
   * @return {Element}
   */
  _renderOpportunityDiff(audits) {
    const baseAudit = audits[0];

    const oppTmpl = this.dom.cloneTemplate('#tmpl-lh-opportunity', this.templateContext);
    const element = this.populateAuditValues(audits, oppTmpl);
    element.id = baseAudit.result.id;

    const displayTexts = this.dom.find('.lh-audit__display-texts', element);
    displayTexts.children[0].remove();

    for (const audit of audits) {
      const displayEl = this.dom.createChildOf(displayTexts, 'div', 'lh-audit__display-text');

      if (!audit.result.details || audit.result.scoreDisplayMode === 'error') {
        continue;
      }
      const details = audit.result.details;
      if (details.type !== 'opportunity') {
        continue;
      }

      // Overwrite the displayValue with opportunity's wastedMs
      // const sparklineWidthPct = `${details.overallSavingsMs / scale * 100}%`;
      // this.dom.find('.lh-sparkline__bar', element).style.width = sparklineWidthPct;
      displayEl.textContent = Util.formatSeconds(details.overallSavingsMs, 0.01);

      // Set [title] tooltips
      if (audit.result.displayValue) {
        const displayValue = audit.result.displayValue;
        this.dom.find('.lh-load-opportunity__sparkline', element).title = displayValue;
        displayEl.title = displayValue;
      }
    }

    return element;
  }

  /**
   * Get an audit's wastedMs to sort the opportunity by, and scale the sparkline width
   * Opportunities with an error won't have a details object, so MIN_VALUE is returned to keep any
   * erroring opportunities last in sort order.
   * @param {LH.ReportResult.AuditRef} audit
   * @return {number}
   */
  _getWastedMs(audit) {
    if (audit.result.details && audit.result.details.type === 'opportunity') {
      const details = audit.result.details;
      if (typeof details.overallSavingsMs !== 'number') {
        throw new Error('non-opportunity details passed to _getWastedMs');
      }
      return details.overallSavingsMs;
    } else {
      return Number.MIN_VALUE;
    }
  }

  /**
   * @param {LH.ReportResult.Category} category
   * @param {Object<string, LH.Result.ReportGroup>} groups
   * @param {'PSI'=} environment 'PSI' and undefined are the only valid values
   * @return {Element}
   * @override
   */
  render(category, groups, environment) {
    const element = this.dom.createElement('div', 'lh-category');
    if (environment === 'PSI') {
      const gaugeEl = this.dom.createElement('div', 'lh-score__gauge');
      gaugeEl.appendChild(this.renderScoreGauge(category, groups));
      element.appendChild(gaugeEl);
    } else {
      this.createPermalinkSpan(element, category.id);
      element.appendChild(this.renderCategoryHeader(category, groups));
    }

    // Metrics.
    const metricAudits = category.auditRefs.filter(audit => audit.group === 'metrics');
    const metricAuditsEl = this.renderAuditGroup(groups.metrics);

    // Metric descriptions toggle.
    const toggleTmpl = this.dom.cloneTemplate('#tmpl-lh-metrics-toggle', this.templateContext);
    const toggleEl = this.dom.find('.lh-metrics-toggle', toggleTmpl);
    metricAuditsEl.prepend(...toggleEl.childNodes);

    const keyMetrics = metricAudits.filter(a => a.weight >= 3);
    const otherMetrics = metricAudits.filter(a => a.weight < 3);

    const metricsBoxesEl = this.dom.createChildOf(metricAuditsEl, 'div', 'lh-columns');
    const metricsColumn1El = this.dom.createChildOf(metricsBoxesEl, 'div', 'lh-column');
    const metricsColumn2El = this.dom.createChildOf(metricsBoxesEl, 'div', 'lh-column');

    keyMetrics.forEach(item => {
      metricsColumn1El.appendChild(this._renderMetric([item]));
    });
    otherMetrics.forEach(item => {
      metricsColumn2El.appendChild(this._renderMetric([item]));
    });

    // 'Values are estimated and may vary' is used as the category description for PSI
    if (environment !== 'PSI') {
      const estValuesEl = this.dom.createChildOf(metricsColumn1El, 'div', 'lh-metrics__disclaimer');
      estValuesEl.textContent = Util.UIStrings.varianceDisclaimer;
    }

    metricAuditsEl.classList.add('lh-audit-group--metrics');
    element.appendChild(metricAuditsEl);

    // Filmstrip
    const timelineEl = this.dom.createChildOf(element, 'div', 'lh-filmstrip-container');
    const thumbnailAudit = category.auditRefs.find(audit => audit.id === 'screenshot-thumbnails');
    const thumbnailResult = thumbnailAudit && thumbnailAudit.result;
    if (thumbnailResult && thumbnailResult.details) {
      timelineEl.id = thumbnailResult.id;
      const filmstripEl = this.detailsRenderer.render(thumbnailResult.details);
      filmstripEl && timelineEl.appendChild(filmstripEl);
    }

    // Budgets
    const budgetAudit = category.auditRefs.find(audit => audit.id === 'performance-budget');
    if (budgetAudit && budgetAudit.result.details) {
      const table = this.detailsRenderer.render(budgetAudit.result.details);
      if (table) {
        table.id = budgetAudit.id;
        table.classList.add('lh-audit');
        const budgetsGroupEl = this.renderAuditGroup(groups.budgets);
        budgetsGroupEl.appendChild(table);
        budgetsGroupEl.classList.add('lh-audit-group--budgets');
        element.appendChild(budgetsGroupEl);
      }
    }

    // Opportunities
    const opportunityAudits = category.auditRefs
        .filter(audit => audit.group === 'load-opportunities' && !Util.showAsPassed(audit.result))
        .sort((auditA, auditB) => this._getWastedMs(auditB) - this._getWastedMs(auditA));

    if (opportunityAudits.length) {
      // Scale the sparklines relative to savings, minimum 2s to not overstate small savings
      const minimumScale = 2000;
      const wastedMsValues = opportunityAudits.map(audit => this._getWastedMs(audit));
      const maxWaste = Math.max(...wastedMsValues);
      const scale = Math.max(Math.ceil(maxWaste / 1000) * 1000, minimumScale);
      const groupEl = this.renderAuditGroup(groups['load-opportunities']);
      const tmpl = this.dom.cloneTemplate('#tmpl-lh-opportunity-header', this.templateContext);

      this.dom.find('.lh-load-opportunity__col--one', tmpl).textContent =
        Util.UIStrings.opportunityResourceColumnLabel;
      this.dom.find('.lh-load-opportunity__col--two', tmpl).textContent =
        Util.UIStrings.opportunitySavingsColumnLabel;

      const headerEl = this.dom.find('.lh-load-opportunity__header', tmpl);
      groupEl.appendChild(headerEl);
      opportunityAudits.forEach(item => groupEl.appendChild(this._renderOpportunity(item, scale)));
      groupEl.classList.add('lh-audit-group--load-opportunities');
      element.appendChild(groupEl);
    }

    // Diagnostics
    const diagnosticAudits = category.auditRefs
        .filter(audit => audit.group === 'diagnostics' && !Util.showAsPassed(audit.result))
        .sort((a, b) => {
          const scoreA = a.result.scoreDisplayMode === 'informative' ? 100 : Number(a.result.score);
          const scoreB = b.result.scoreDisplayMode === 'informative' ? 100 : Number(b.result.score);
          return scoreA - scoreB;
        });

    if (diagnosticAudits.length) {
      const groupEl = this.renderAuditGroup(groups['diagnostics']);
      diagnosticAudits.forEach(item => groupEl.appendChild(this.renderAudit(item)));
      groupEl.classList.add('lh-audit-group--diagnostics');
      element.appendChild(groupEl);
    }

    // Passed audits
    const passedAudits = category.auditRefs
        .filter(audit => (audit.group === 'load-opportunities' || audit.group === 'diagnostics') &&
            Util.showAsPassed(audit.result));

    if (!passedAudits.length) return element;

    const clumpOpts = {
      auditRefs: passedAudits,
      groupDefinitions: groups,
    };
    const passedElem = this.renderClump('passed', clumpOpts);
    element.appendChild(passedElem);
    return element;
  }

  /**
   * @param {Array<LH.ReportResult.Category>} allCategory
   * @param {Array<Object<string, LH.Result.ReportGroup>>} allGroups
   * @param {'PSI'=} environment 'PSI' and undefined are the only valid values
   * @return {Element}
   * @override
   */
  renderDiff(allCategory, allGroups, environment) {
    const baseCategory = allCategory[0];
    const baseGroups = allGroups[0];

    const element = this.dom.createElement('div', 'lh-category');
    if (environment === 'PSI') {
      const gaugeEl = this.dom.createElement('div', 'lh-score__gauge');
      gaugeEl.appendChild(this.renderScoreGauge(baseCategory, baseGroups));
      element.appendChild(gaugeEl);
    } else {
      this.createPermalinkSpan(element, baseCategory.id);
      element.appendChild(this.renderCategoryHeader(baseCategory, baseGroups));
    }

    // Metrics
    const metricAuditsEl = this.renderAuditGroup(baseGroups.metrics);

    const letterRows = this.dom.createElement('div', 'lh-metric__letters');
    for (const category of allCategory) {
      const letterNode = this._createLetterNode(allCategory.indexOf(category));
      letterNode.classList.add('lh-metric__value');
      letterRows.appendChild(letterNode);
    }
    metricAuditsEl.appendChild(letterRows);

    const metricsIds = baseCategory.auditRefs.filter(audit => audit.group === 'metrics').map(m => m.id);
    for (const id of metricsIds) {
      metricAuditsEl.appendChild(this._renderMetric(
        allCategory.map(category => {
          const audit = category.auditRefs.find(a => a.id === id);
          if (!audit) {
            // this should never happen right?
            throw new Error('missing a metric ...');
          }
          return audit;
        })
      ));
    }

    metricAuditsEl.classList.add('lh-audit-group--metrics');
    element.appendChild(metricAuditsEl);

    // Filmstrip
    for (const category of allCategory) {
      const timelineEl = this.dom.createChildOf(element, 'div', 'lh-filmstrip-container');

      const thumbnailAudit = category.auditRefs.find(audit => audit.id === 'screenshot-thumbnails');
      const thumbnailResult = thumbnailAudit && thumbnailAudit.result;
      if (thumbnailResult && thumbnailResult.details) {
        timelineEl.id = thumbnailResult.id;
        const filmstripEl = this.detailsRenderer.render(thumbnailResult.details);
        if (filmstripEl) {
          timelineEl.appendChild(filmstripEl);

          filmstripEl.prepend(this._createLetterNode(allCategory.indexOf(category)));
        }
      }
    }

    // Opportunities
    const groupEl = this.renderAuditGroup(baseGroups['load-opportunities']);

    // Group opportunity audits by id. Each entry in an array of length [allCategory.length]. If a category
    // is missing an audit, a fake audit is made for it.
    /** @type {Map<string, Array<LH.ReportResult.AuditRef>>} */
    const opportunityAuditsGroupedById = new Map();
    for (const category of allCategory) {
      const index = allCategory.indexOf(category);

      const opportunityAudits = category.auditRefs
          .filter(audit => audit.group === 'load-opportunities' && !Util.showAsPassed(audit.result));
      for (const auditRef of opportunityAudits) {
        const auditRefs = opportunityAuditsGroupedById.get(auditRef.id) || new Array(allCategory.length);
        auditRefs[index] = auditRef;
        opportunityAuditsGroupedById.set(auditRef.id, auditRefs);
      }
    }
    // fake audits.
    for (const auditRefs of opportunityAuditsGroupedById.values()) {
      const nonNullAudit = auditRefs.find(Boolean);
      if (!nonNullAudit) continue; // never happens.

      for (let i = 0; i < allCategory.length; i++) {
        if (!auditRefs[i]) {
          auditRefs[i] = {
            ...nonNullAudit,
            result: {
              ...nonNullAudit.result,
              displayValue: '-',
              details: undefined,
            },
          };
        }
      }
    }

    const baseOpportunityAuditsSortedBySavings = baseCategory.auditRefs
          .filter(audit => audit.group === 'load-opportunities' && !Util.showAsPassed(audit.result))
          .sort((auditA, auditB) => this._getWastedMs(auditB) - this._getWastedMs(auditA));

    // Sorts ids by savings potential of base report. If audits exists in other LHRs but not in the base LHR,
    // this extra logic will place those audits at the end.
    const allOpportunityAuditsIdsSortedByBaseSavings = Array.from(opportunityAuditsGroupedById.keys()).sort(
      (auditIdA, auditIdB) => {
        const auditIdAIndex = baseOpportunityAuditsSortedBySavings.findIndex(audit => audit.id === auditIdA);
        const auditIdBIndex = baseOpportunityAuditsSortedBySavings.findIndex(audit => audit.id === auditIdB);
        if (auditIdAIndex >= 0 && auditIdBIndex === -1) return -1;
        if (auditIdBIndex >= 0 && auditIdAIndex === -1) return 1;
        return auditIdAIndex - auditIdBIndex;
      }
    );

    const tmpl = this.dom.cloneTemplate('#tmpl-lh-opportunity-header', this.templateContext);
    this.dom.find('.lh-load-opportunity__col--one', tmpl).textContent =
          Util.UIStrings.opportunityResourceColumnLabel;
    this.dom.find('.lh-load-opportunity__col--two', tmpl).textContent =
        Util.UIStrings.opportunitySavingsColumnLabel;
    const headerEl = this.dom.find('.lh-load-opportunity__header', tmpl);
    groupEl.appendChild(headerEl);
    groupEl.appendChild(letterRows.cloneNode(true));

    for (const id of allOpportunityAuditsIdsSortedByBaseSavings) {
      const auditRefs = opportunityAuditsGroupedById.get(id);
      if (!auditRefs) continue; // it always exists.

      groupEl.appendChild(this._renderOpportunityDiff(auditRefs));
      groupEl.classList.add('lh-audit-group--load-opportunities');
      element.appendChild(groupEl);
    }

    // Diagnostics
    {
      const groupEl = this.renderAuditGroup(baseGroups['diagnostics']);
      for (const category of allCategory) {
        const diagnosticAudits = category.auditRefs
          .filter(audit => audit.group === 'diagnostics' && !Util.showAsPassed(audit.result))
          .sort((a, b) => {
            const scoreA = a.result.scoreDisplayMode === 'informative' ? 100 : Number(a.result.score);
            const scoreB = b.result.scoreDisplayMode === 'informative' ? 100 : Number(b.result.score);
            return scoreA - scoreB;
          });

        if (diagnosticAudits.length) {
          groupEl.appendChild(this._createLetterNode(allCategory.indexOf(category)));
          diagnosticAudits.forEach((item) => groupEl.appendChild(this.renderAudit(item)));
          groupEl.classList.add('lh-audit-group--diagnostics');
          element.appendChild(groupEl);
        }
      }
    }

    // Passed audits
    // /** @type {LH.ReportResult.AuditRef[]} */
    // const allPassedAudits = [];
    // for (const category of allCategory) {
    //   const passedAudits = category.auditRefs
    //       .filter(audit => (audit.group === 'load-opportunities' || audit.group === 'diagnostics') &&
    //           Util.showAsPassed(audit.result));
    //           allPassedAudits.push(...passedAudits);
    // }

    // if (!allPassedAudits.length) return element;

    // const clumpOpts = {
    //   auditRefs: allPassedAudits,
    //   groupDefinitions: baseGroups,
    // };
    // const passedElem = this.renderClump('passed', clumpOpts);
    // element.appendChild(passedElem);
    return element;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PerformanceCategoryRenderer;
} else {
  self.PerformanceCategoryRenderer = PerformanceCategoryRenderer;
}
