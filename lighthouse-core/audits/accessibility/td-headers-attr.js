/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

/**
 * @fileoverview Ensure that each cell in a table using the headers refers to another cell in
 * that table
 * See base class in axe-audit.js for audit() implementation.
 */

const AxeAudit = require('./axe-audit');

class TDHeadersAttr extends AxeAudit {
  /**
   * @return {LH.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'td-headers-attr',
      title: 'Cells in a `<table>` element that use the `[headers]` attribute only refer ' +
          'to other cells of that same table.',
      failureTitle: 'Cells in a `<table>` element that use the `[headers]` ' +
          'attribute refers to other cells of that same table.',
      description: 'Screen readers have features to make navigating tables easier. Ensuring ' +
          '`<td>` cells using the `[headers]` attribute only refer to other cells in the same ' +
          'table may improve the experience for screen reader users. ' +
          '[Learn more](https://dequeuniversity.com/rules/axe/2.2/td-headers-attr?application=lighthouse).',
      requiredArtifacts: ['Accessibility'],
    };
  }
}

module.exports = TDHeadersAttr;
