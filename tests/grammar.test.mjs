import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { at, tokenize, registry } from './helpers.mjs';

after(() => registry.dispose());
const has = (source, text, scope, occurrence = 0) =>
  assert.ok(at(source, text, occurrence).some(s => s.startsWith(scope)),
    `${JSON.stringify(text)} should have ${scope}: ${at(source, text, occurrence)}`);
const lacks = (source, text, scope, occurrence = 0) =>
  assert.ok(!at(source, text, occurrence).some(s => s.startsWith(scope)),
    `${JSON.stringify(text)} should not have ${scope}: ${at(source, text, occurrence)}`);

test('all reserved words have language scopes, with exact ASCII boundaries', () => {
  const groups = {
    'storage.type.function': ['sidequest', 'fn'],
    'entity.name.function.entry': ['main_character'],
    'storage.type.inferred': ['let'],
    'keyword.control': ['if','else','return','npc','loop','in','locked_in','while','goon','touch_grass','larp','as','flex','canon','sybau'],
    'storage.type.declaration': ['archetype','role'],
    'storage.modifier': ['highkey','lowkey','nonchalant','uses'],
    'entity.name.function.constructor': ['init'],
    'variable.language': ['self'],
    'keyword.operator': ['new','mogg'],
    'constant.language': ['fr','cap','no_bitches'],
  };
  for (const [scope, words] of Object.entries(groups)) for (const word of words) {
    has(word, word, scope);
    for (const longer of [`_${word}`, `${word}_suffix`, `${word}2`]) {
      const scopes = at(longer, longer);
      assert.equal(scopes.at(-1), 'variable.other.larp', longer);
    }
    if (word.toUpperCase() !== word) lacks(word.toUpperCase(), word.toUpperCase(), scope);
  }
});

test('paired control words survive comments, newlines and CRLF', () => {
  const source = 'npc /* pair */\r\nloop (mf i in 0..10) {}\r\nlocked_in // pair\r\nwhile (fr) {}';
  for (const word of ['npc', 'loop', 'locked_in', 'while']) has(source, word, 'keyword.control');
  has(source, 'pair', 'comment.block');
  has(source, 'pair', 'comment.line', 1);
  has(source, '..', 'keyword.operator.range');
});

test('comments are non-nesting and isolate quotes, braces, keywords and numbers', () => {
  const source = '/* outer /* inner */ main_character { // " fr 49 {\n yap("/* text */ // 🦀"); }';
  has(source, 'inner', 'comment.block');
  lacks(source, 'main_character', 'comment');
  has(source, 'main_character', 'entity.name.function.entry');
  has(source, '49', 'comment.line');
  has(source, '/* text', 'string.quoted.double');
  lacks(source, '/* text', 'comment');
  has('/* unterminated\nfr', 'fr', 'comment.block');
});

test('only specified escapes are accepted; strings have no interpolation', () => {
  const source = String.raw`"🦀 \n \r \t \\ \" \q \u0041 \x41 \0 ` + '${value} {fr}"';
  for (const escape of [String.raw`\n`, String.raw`\r`, String.raw`\t`, String.raw`\\`, String.raw`\"`]) {
    has(source, escape, 'constant.character.escape');
  }
  for (const escape of [String.raw`\q`, String.raw`\u`, String.raw`\x`, String.raw`\0`]) {
    has(source, escape, 'invalid.illegal.escape');
  }
  has(source, '${value}', 'string.quoted.double');
  has(source, 'fr', 'string.quoted.double');
});

test('an unfinished string recovers at LF or CRLF', () => {
  for (const newline of ['\n', '\r\n']) {
    const source = `text broken = "unfinished${newline}main_character { yap(fr); }`;
    has(source, 'unfinished', 'string');
    has(source, 'main_character', 'entity.name.function.entry');
    lacks(source, 'main_character', 'string');
  }
});

test('decimal numbers, separators, exponents, unary signs and range boundaries', () => {
  for (const value of ['0','007','49','1_000','9_223_372_036_854_775_808']) has(value, value, 'constant.numeric.integer');
  for (const value of ['0.5','49.0','1e2','1E+2','1.0e-2','1_000.2_5e1_0']) has(value, value, 'constant.numeric.float');
  for (const value of ['1__0','1_','1e+','12abc','1_.0','0xff','0b10','1.0f']) {
    has(value, value, 'invalid.illegal.numeric');
    lacks(value, value, 'constant.numeric');
  }
  const source = '-49 + 0..10 + 1.0..2.0';
  has(source, '-', 'keyword.operator.arithmetic');
  has(source, '49', 'constant.numeric.integer');
  has(source, '..', 'keyword.operator.range');
  has(source, '10', 'constant.numeric.integer');
  has(source, '1.0', 'constant.numeric.float');
  has(source, '..', 'keyword.operator.range', 1);
});

test('all operators use their complete token, including lambdas and arrows', () => {
  const operators = ['->','=>','..','==','!=','<=','>=','&&','||','+=','-=','*=','/=','%=','+','-','*','/','%','!','=','<','>'];
  for (const op of operators) {
    const tokens = tokenize(`a ${op} b`)[0].filter(t => t.text.trim());
    assert.ok(tokens.some(t => t.text === op && t.scopes.at(-1).match(/^(keyword\.operator|storage\.type\.function\.arrow)/)), op);
  }
});

test('types, function declarations, extensions, constructors and generic arguments', () => {
  const source = `role Scored { sidequest score() -> mf uses(read); }
archetype Founder : Scored {
  highkey mf aura;
  init(mf aura) { self.aura = aura; }
  highkey sidequest score() -> mf uses(read) { return self.aura; }
}
sidequest Scored.doubled() -> mf uses(read, abort) { return self.score() * 2; }
sidequest /* split */
  quest /* split */ (mf value) -> mf { return value; }
main_character {
  Founder bro = new /* split */ Founder(49);
  result<hediJeans<baddie<mf>,2>,ConversionError> nested;
  fn(mf) -> mf uses(abort) callback = (mf value) => value + 1;
  let converted = ascend<unc>(49);
}`;
  has(source, 'Scored', 'entity.name.type');
  has(source, 'Founder', 'entity.name.type');
  has(source, 'score', 'entity.name.function');
  has(source, 'doubled', 'entity.name.function');
  has(source, 'quest /*', 'entity.name.function', 1);
  has(source, 'init', 'entity.name.function.constructor');
  has(source, 'bro =', 'variable.other.definition');
  has(source, 'Founder(49)', 'entity.name.type');
  has(source, 'baddie', 'support.type');
  has(source, '2>', 'constant.numeric.integer');
  has(source, 'ConversionError', 'support.type');
  has(source, 'read', 'support.constant.effect');
  has(source, 'callback', 'variable.other');
  has(source, '=>', 'storage.type.function.arrow');
  has(source, 'ascend', 'support.function');
  lacks(source, '49);', 'meta.type.arguments');
});

test('effects and scenario labels are contextual; prelude words are not reserved keywords', () => {
  const source = 'uses(/* effect */ read, write, observe, io, abort)\nlet read = 1;\nlarp (bro) as PeterThiel { flex bro.aura = 49; canon bro.aura; }';
  for (const effect of ['read','write','observe','io','abort']) has(source, effect, 'support.constant.effect');
  lacks(source, 'read =', 'support.constant.effect');
  has(source, 'PeterThiel', 'entity.name.label');
  has(source, 'bro.aura', 'variable.other');
  has(source, 'aura', 'variable.other.member');
  for (const word of ['yap','some','win','fumble','ascend','fraud','palantir','no_cap','crashout','parseScore','args','readLine','fortnine','PeterThiel']) {
    lacks(word, word, 'keyword');
    has(word, word, 'support');
  }
  for (const word of ['import','class','async','await','try','catch','null','true','false','continue']) {
    assert.equal(at(word, word).at(-1), 'variable.other.larp', word);
  }
});

test('nested function types and commented generic calls retain type argument scopes', () => {
  const source = `sidequest callbacks() -> mfs<fn(mf) -> result<mf,text> uses(abort)> { return []; }
main_character {
  let n = ascend /* conversion */
    <unc>(49);
  let m = fraud
    /* conversion */ <mf>(n);
}`;
  has(source, 'result', 'support.type');
  has(source, 'text', 'meta.type.arguments');
  has(source, 'abort', 'support.constant.effect');
  has(source, 'unc', 'meta.type.arguments');
  has(source, 'mf>(n)', 'meta.type.arguments');
  lacks(source, '49', 'meta.type.arguments');
  has(source, 'main_character', 'entity.name.function.entry');
});

test('incomplete type arguments recover at a statement or block boundary', () => {
  for (const broken of ['mfs<mf;', 'mfs<mf {', 'ascend<unc;']) {
    const source = `${broken}\nmain_character { yap(fr); }`;
    has(source, 'main_character', 'entity.name.function.entry');
    lacks(source, 'fr', 'meta.type.arguments');
  }
});

test('long strings, comments and numeric literals tokenize within the engine budget', () => {
  for (const source of [
    `/* ${'/* fr 49 " '.repeat(3000)} */\nmain_character {}`,
    `"${String.raw`\n`.repeat(3000)}"\nmain_character {}`,
    `${'1_'.repeat(3000)}1;\nmain_character {}`,
  ]) has(source, 'main_character', 'entity.name.function.entry');
});

const fixtureRoot = new URL('./fixtures/upstream/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', fixtureRoot), 'utf8'));
const oracle = JSON.parse(await readFile(new URL('lexer-oracle.json', fixtureRoot), 'utf8'));
for (const fixture of manifest.files) {
  test(`upstream corpus: ${fixture.path}`, async () => {
    const bytes = await readFile(new URL(fixture.path, fixtureRoot));
    const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    assert.equal(hash, fixture.blob, 'fixture must match the pinned GitHub blob');
    const source = bytes.toString('utf8');
    const lines = tokenize(source);
    // Spans come from the actual upstream Rust lexer, not a second JS lexer.
    for (const [byteStart, byteEnd, kind] of oracle[fixture.path]) {
      const before = bytes.subarray(0, byteStart).toString('utf8').split(/\r?\n/);
      const text = bytes.subarray(byteStart, byteEnd).toString('utf8');
      const fragments = text.split(/\r?\n/);
      for (let n = 0; n < fragments.length; n++) {
        const column = n === 0 ? before.at(-1).length : 0;
        const tokens = lines[before.length - 1 + n].filter(t => t.end > column && t.start < column + fragments[n].length);
        for (const token of tokens) {
          const label = `${fixture.path}:${token.line} ${kind}: ${JSON.stringify(token.text)}`;
          const expected = {
            integer: 'constant.numeric.integer', float: 'constant.numeric.float',
            string: 'string.quoted.double', 'line-comment': 'comment.line', 'block-comment': 'comment.block',
          }[kind];
          if (expected) assert.ok(token.scopes.some(s => s.startsWith(expected)), label);
          else {
            assert.ok(!token.scopes.some(s => s.startsWith('comment.') || s.startsWith('string.')), label);
            assert.ok(token.scopes.length > 1, `unclassified ${label}`);
          }
        }
      }
    }
    for (const tokens of lines) {
      for (const token of tokens) {
        assert.equal(token.scopes[0], 'source.larp');
        assert.ok(!token.scopes.some(s => s.startsWith('invalid.')), `${fixture.path}:${token.line}: ${token.text}`);
      }
    }
    has(source, 'main_character', 'entity.name.function.entry');
    // No completed upstream file should leave comments, strings, or headers open.
    const sentinel = '\nmain_character { yap(fr); }';
    const tail = tokenize(source + sentinel).at(-1);
    assert.ok(tail.some(t => t.text === 'main_character' && t.scopes.includes('entity.name.function.entry.larp')));
    assert.ok(tail.some(t => t.text === 'fr' && t.scopes.includes('constant.language.boolean.larp')));
  });
}
