import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

const json = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const manifest = await json('package.json');
const config = await json('language-configuration.json');
const snippets = await json('snippets/larp.code-snippets');

test('declarative manifest contributes real files and no runtime extension', async () => {
  assert.equal(manifest.main, undefined);
  assert.equal(manifest.browser, undefined);
  assert.equal(manifest.activationEvents, undefined);
  assert.equal(manifest.dependencies, undefined);
  const language = manifest.contributes.languages[0];
  assert.equal(language.id, 'larp');
  assert.deepEqual(language.extensions, ['.larp']);
  for (const entry of [...manifest.contributes.grammars, ...manifest.contributes.snippets]) {
    assert.equal(entry.language, language.id);
    await json(entry.path);
  }
  assert.equal((await json(manifest.contributes.grammars[0].path)).scopeName, 'source.larp');
});

test('brackets, comments, surrounding pairs and ASCII words match LARP', () => {
  assert.deepEqual(config.comments, { lineComment: '//', blockComment: ['/*', '*/'] });
  assert.deepEqual(config.brackets, [['{','}'], ['[',']'], ['(',')']]);
  assert.ok(!config.autoClosingPairs.some(p => p.open === '<' || p.open === "'"));
  assert.ok(config.autoClosingPairs.every(p => p.notIn.includes('comment') && p.notIn.includes('string')));
  const words = new RegExp(config.wordPattern, 'g');
  assert.deepEqual('main_character _value Value2'.match(words), ['main_character','_value','Value2']);
});

test('indent open blocks, calls and arrays, allowing comments and quoted strings', () => {
  const increase = new RegExp(config.indentationRules.increaseIndentPattern);
  const decrease = new RegExp(config.indentationRules.decreaseIndentPattern);
  for (const line of ['main_character {','if (fr) { // note','npc loop (mf i in 0..10) {','    yap(', 'mfs<mf> values = [', 'call("(",']) {
    assert.ok(increase.test(line), line);
  }
  for (const line of ['// {','/* { */','yap("{");','if (fr) {}','text url = "https://host/{";','yap(49);']) {
    assert.ok(!increase.test(line), line);
  }
  for (const line of ['}', '    } else {', '    );', '    ];']) assert.ok(decrease.test(line), line);
});

test('snippets have unique prefixes, descriptions and valid tabstops', () => {
  const prefixes = new Set();
  for (const [name, snippet] of Object.entries(snippets)) {
    assert.ok(snippet.description, name);
    assert.ok(!prefixes.has(snippet.prefix), `duplicate prefix ${snippet.prefix}`);
    prefixes.add(snippet.prefix);
    const body = Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body;
    assert.ok(body.includes('$0') || body.includes('${0:'), `${name}: final cursor`);
    assert.ok(!body.includes('undefined'), name);
  }
});
