/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

/* eslint-disable no-console */

const fs = require('fs');
const ts = require('typescript');
const {LH_ROOT} = require('../root.js');

const outDir = `${LH_ROOT}/core/lib/cdt/generated`;
const files = {
  'node_modules/chrome-devtools-frontend/front_end/sdk/SourceMap.js': 'SourceMap.js',
};

console.log('making modifications ...');

for (const [inFilename, outFilename] of Object.entries(files)) {
  const code = fs.readFileSync(inFilename, 'utf-8');
  const codeWithoutLegacyExports = code.substr(0, code.indexOf('/* Legacy exported object'));
  const codeTranspiledToCommonJS = ts.transpileModule(codeWithoutLegacyExports, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019},
  }).outputText;

  const sourceFile = ts.createSourceFile('', codeTranspiledToCommonJS,
    ts.ScriptTarget.ES2019, true, ts.ScriptKind.JS);
  const simplePrinter = ts.createPrinter({newLine: ts.NewLineKind.LineFeed});

  const classesToRemove = [
    // Not needed.
    'EditResult',
    // Not needed.
    'WasmSourceMap',
  ];
  const methodsToRemove = [
    // Not needed.
    'load',
    // Not needed.
    'sourceContentProvider',
  ];
  const expressionsToRemove = [
    /* Original:

    let url = Common.ParsedURL.completeURL(this._baseURL, href) || href;
    const source = sourceMap.sourcesContent && sourceMap.sourcesContent[i];
    if (url === this._compiledURL && source) {
      url += Common.UIString('? [sm]')
    }
    this._sourceInfos.set(url, new TextSourceMap.SourceInfo(source, null));
    sourcesList.push(url);
    ----
    If a source file is the same as the compiled url and there is a sourcesContent,
    then `entry.sourceURL` (what is returned from .mappings) will have `? [sm]` appended.
    This is useful in DevTools - to show that a sources panel tab not a real network resource -
    but for us it is not wanted. The sizing function uses `entry.sourceURL` to index the byte
    counts, and is further used in the details to specify a file within a source map.
    */
    `url += Common.UIString('? [sm]')`,
    // Delete all the export statements.
    'exports.',
  ];
  // Complicated expressions are hard detect with the TS lib, so instead work with the raw code.
  const rawCodeToReplace = {
    // Similar to the reason for removing `url += Common.UIString('? [sm]')`.
    // The entries in `.mappings` should not have their url property modified.
    'Common.ParsedURL.completeURL(this._baseURL, href)': `''`,
  };

  // Verify that all the above code is present.
  const codeFragments = [
    ...classesToRemove,
    ...methodsToRemove,
    ...expressionsToRemove,
    ...Object.values(rawCodeToReplace),
  ];
  for (const codeFragment of codeFragments) {
    if (!codeTranspiledToCommonJS.includes(codeFragment)) {
      throw new Error(`did not find expected code fragment: ${codeFragment}`);
    }
  }

  const printer = ts.createPrinter({newLine: ts.NewLineKind.LineFeed}, {
    substituteNode(hint, node) {
      let removeNode = false;

      if (ts.isMethodDeclaration(node) &&
          // Make typescript happy.
          !ts.isComputedPropertyName(node.name) &&
          methodsToRemove.includes(node.name.text)) {
        removeNode = true;
      }

      if (ts.isClassDeclaration(node) && node.name && classesToRemove.includes(node.name.text)) {
        removeNode = true;
      }

      if (ts.isExpressionStatement(node)) {
        const asString = simplePrinter.printNode(ts.EmitHint.Unspecified, node, sourceFile);
        if (classesToRemove.some(className => asString.includes(className))) {
          removeNode = true;
        }
        if (expressionsToRemove.some(className => asString.includes(className))) {
          removeNode = true;
        }
      }

      if (removeNode) {
        return ts.createNode(ts.SyntaxKind.Unknown);
      }

      return node;
    },
  });

  let sourceFilePrinted = '';
  sourceFile.forEachChild(node => {
    sourceFilePrinted += printer.printNode(ts.EmitHint.Unspecified, node, sourceFile) + '\n';
  });

  for (const [code, replacement] of Object.entries(rawCodeToReplace)) {
    sourceFilePrinted = sourceFilePrinted.replace(code, replacement);
    if (sourceFilePrinted.includes(code)) {
      throw new Error(`expected only one occurrence for: ${code}`);
    }
  }

  const modifiedFile = [
    '// @ts-nocheck\n',
    '// generated by yarn build-cdt-lib\n',
    'const Common = require(\'../Common.js\')\n',
    sourceFilePrinted,
    'module.exports = TextSourceMap',
  ].join('');
  fs.writeFileSync(`${outDir}/${outFilename}`, modifiedFile);
}
