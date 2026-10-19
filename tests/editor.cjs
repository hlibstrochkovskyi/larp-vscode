const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vscode = require('vscode');

exports.run = async function () {
  const extension = vscode.extensions.getExtension('hlibstrochkovskyi.larp-vscode');
  assert.ok(extension, 'the LARP extension must be registered');
  const fixture = path.join(extension.extensionPath, 'tests/fixtures/upstream/examples/pitch-deck.larp');
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(fixture));
  assert.equal(doc.languageId, 'larp', '.larp files must be detected automatically');
  assert.ok((await vscode.languages.getLanguages()).includes('larp'));

  async function fresh(content = '') {
    const document = await vscode.workspace.openTextDocument({ language: 'larp', content });
    const editor = await vscode.window.showTextDocument(document);
    editor.options = { insertSpaces: true, tabSize: 4 };
    const end = document.positionAt(content.length);
    editor.selection = new vscode.Selection(end, end);
    // Auto-outdent requires VS Code's background tokenizer to reach this line.
    // Document edits complete before the renderer's tokenization pass.
    await new Promise(resolve => setTimeout(resolve, 100));
    return editor;
  }
  async function type(text) {
    await vscode.commands.executeCommand('type', { text });
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}'], ['"', '"']]) {
    const editor = await fresh();
    await type(open);
    assert.equal(editor.document.getText(), open + close, `autoclose ${open}`);
  }
  let editor = await fresh('main_character {');
  await type('\n');
  assert.equal(editor.document.getText(), 'main_character {\n    ', 'indent a block');
  await type('}');
  assert.equal(editor.document.getText(), 'main_character {\n}', 'outdent a closing brace');

  editor = await fresh('yap(');
  await type('\n');
  assert.equal(editor.document.getText(), 'yap(\n    ', 'indent a multiline call');

  editor = await fresh('yap(49);');
  editor.selection = new vscode.Selection(0, 0, 0, 8);
  await vscode.commands.executeCommand('editor.action.commentLine');
  assert.equal(editor.document.getText(), '// yap(49);', 'line comment command');
  await vscode.commands.executeCommand('editor.action.commentLine');
  assert.equal(editor.document.getText(), 'yap(49);', 'line comment toggle');
  editor.selection = new vscode.Selection(0, 0, 0, 8);
  await vscode.commands.executeCommand('editor.action.blockComment');
  assert.match(editor.document.getText(), /^\/\*\s*yap\(49\);\s*\*\/$/, 'block comment command');

  editor = await fresh();
  await vscode.commands.executeCommand('editor.action.insertSnippet', { langId: 'larp', name: 'Program entry' });
  assert.match(editor.document.getText(), /^main_character \{\n +\n\}$/, 'registered LARP snippet');
  const snippets = JSON.parse(fs.readFileSync(path.join(extension.extensionPath, 'snippets/larp.code-snippets'), 'utf8'));
  for (const [name, snippet] of Object.entries(snippets)) {
    editor = await fresh();
    await editor.insertSnippet(new vscode.SnippetString(Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body));
    assert.ok(editor.document.getText().length > 0, `${name} expands`);
    assert.ok(!editor.document.getText().includes('${'), `${name} has no unexpanded placeholders`);
  }
  console.log(`LARP editor checks passed, including ${Object.keys(snippets).length} snippets.`);
  fs.writeFileSync(process.env.LARP_EDITOR_RESULT, 'passed\n');
};
