/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

/** @type {LH.Config.Json} */
const fullConfig = {
  extends: 'lighthouse:default',
  settings: {},
  passes: [
    {
      passName: 'extraPass',
      gatherers: [
        'js-usage',
      ],
    },
  ],
  audits: [
    'byte-efficiency/unused-javascript',
  ],
  // @ts-ignore TODO(bckenny): type extended Config where e.g. category.title isn't required
  categories: {
    'performance': {
      auditRefs: [
        {id: 'unused-javascript', weight: 0, group: 'load-opportunities'},
      ],
    },
  },
};

module.exports = fullConfig;
