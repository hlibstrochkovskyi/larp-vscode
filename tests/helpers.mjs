import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import textmate from 'vscode-textmate';
import oniguruma from 'vscode-oniguruma';

const { Registry, parseRawGrammar } = textmate;
const { loadWASM, OnigScanner, OnigString } = oniguruma;

const require = createRequire(import.meta.url);
const wasm = await readFile(require.resolve('vscode-oniguruma/release/onig.wasm'));
await loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
const raw = await readFile(new URL('../syntaxes/larp.tmLanguage.json', import.meta.url), 'utf8');
export const registry = new Registry({
  onigLib: Promise.resolve({
    createOnigScanner: patterns => new OnigScanner(patterns),
    createOnigString: text => new OnigString(text),
  }),
  loadGrammar: async scope => scope === 'source.larp'
    ? parseRawGrammar(raw, 'larp.tmLanguage.json') : null,
});
export const grammar = await registry.loadGrammar('source.larp');

export function tokenize(source) {
  let stack = null;
  return source.split(/\r?\n/).map((line, lineIndex) => {
    const result = grammar.tokenizeLine(line, stack, 1000);
    if (result.stoppedEarly) throw new Error(`Tokenization timed out at line ${lineIndex + 1}`);
    stack = result.ruleStack;
    return result.tokens.map(token => ({
      text: line.slice(token.startIndex, token.endIndex),
      start: token.startIndex, end: token.endIndex,
      scopes: token.scopes, line: lineIndex + 1,
    }));
  });
}

export function at(source, needle, occurrence = 0) {
  let start = -1;
  for (let n = 0; n <= occurrence; n++) {
    start = source.indexOf(needle, start + 1);
    if (start < 0) throw new Error(`Missing test token ${needle}`);
  }
  const prefix = source.slice(0, start).split(/\r?\n/);
  const column = prefix.at(-1).length;
  const token = tokenize(source)[prefix.length - 1].find(t => t.start <= column && t.end > column);
  if (!token) throw new Error(`No token at ${needle}`);
  return token.scopes;
}
