/**
 * @license Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPORT_TEMPLATE = fs.readFileSync(__dirname + '/report-template.html', 'utf8');
const REPORT_JAVASCRIPT = [
  fs.readFileSync(__dirname + '/renderer/util.js', 'utf8'),
  fs.readFileSync(__dirname + '/renderer/dom.js', 'utf8'),
  // COMPAT: Remove when Microsoft Edge supports <details>/<summary>
  // https://developer.microsoft.com/en-us/microsoft-edge/platform/status/detailssummary/?q=details
  fs.readFileSync(require.resolve('details-element-polyfill'), 'utf8'),
  fs.readFileSync(__dirname + '/renderer/details-renderer.js', 'utf8'),
  fs.readFileSync(__dirname + '/renderer/crc-details-renderer.js', 'utf8'),
  fs.readFileSync(__dirname + '/renderer/snippet-renderer.js', 'utf8'),
  fs.readFileSync(__dirname + '/../../lib/file-namer.js', 'utf8'),
  fs.readFileSync(__dirname + '/renderer/logger.js', 'utf8'),
  fs.readFileSync(__dirname + '/renderer/report-ui-features.js', 'utf8'),
  fs.readFileSync(__dirname + '/renderer/category-renderer.js', 'utf8'),
  fs.readFileSync(__dirname + '/renderer/performance-category-renderer.js', 'utf8'),
  fs.readFileSync(__dirname + '/renderer/pwa-category-renderer.js', 'utf8'),
  fs.readFileSync(__dirname + '/renderer/report-renderer.js', 'utf8'),
].join(';\n');

const REPORT_CSS = [
  fs.readFileSync(__dirname + '/report-styles.css', 'utf8'),
  makeSvgVarsStylesheet(),
].join('\n');
const REPORT_TEMPLATES = fs.readFileSync(__dirname + '/templates.html', 'utf8');

/**
 * @param {string} pathToSvg
 */
function loadSvgAsDataUrl(pathToSvg) {
  const svgContents = fs.readFileSync(pathToSvg).toString('utf-8')
    .replace(/\n/g, '')
    .replace(/#/g, '%23');
  return `data:image/svg+xml;utf8,${svgContents}`;
}

/**
 * @param {string} varName
 * @param {string} dataUrl
 */
function makeSvgVar(varName, dataUrl) {
  return `--${varName}: url('${dataUrl}');`;
}

function makeSvgVarsStylesheet() {
  const dirNameRelRoot = path.relative(__dirname + '/../../../', __dirname);
  const vars = fs.readdirSync(__dirname + '/svg')
    .filter(fileName => fileName.endsWith('.svg'))
    .map(fileName => {
      const varName = fileName.replace('.svg', '');
      const dataUrl = loadSvgAsDataUrl(__dirname + '/svg/' + fileName);
      const commentBlock = `/* ./${dirNameRelRoot}/${fileName} */`;
      const varDeclaration = makeSvgVar(varName, dataUrl);
      return `${commentBlock}\n${varDeclaration}`;
    });
  return `.lh-vars {\n${vars.join('\n')}\n}`;
}

// Changes to this export interface should be reflected in build/dt-report-generator-bundle.js
// and clients/devtools-report-assets.js
module.exports = {
  REPORT_TEMPLATE,
  REPORT_TEMPLATES,
  REPORT_JAVASCRIPT,
  REPORT_CSS,
};
