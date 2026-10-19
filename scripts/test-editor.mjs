import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runTests } from '@vscode/test-electron';

const root = resolve(import.meta.dirname, '..');
const directory = resolve(root, '.vscode-test');
const workspace = resolve(directory, 'workspace');
const resultFile = resolve(directory, 'editor-result.txt');
await mkdir(resolve(workspace, '.vscode'), { recursive: true });
await rm(resultFile, { force: true });
await writeFile(resolve(workspace, '.vscode/settings.json'), JSON.stringify({
  'editor.autoIndent': 'full',
  'editor.autoClosingBrackets': 'always',
  'editor.autoClosingQuotes': 'always',
  'editor.insertSpaces': true,
  'editor.tabSize': 4,
  'editor.detectIndentation': false,
  'editor.quickSuggestions': false,
  'editor.wordBasedSuggestions': 'off',
  'files.autoSave': 'off',
  'security.workspace.trust.enabled': false,
}));
// Never forward requests to an existing personal editor session.
delete process.env.ELECTRON_RUN_AS_NODE;
delete process.env.VSCODE_IPC_HOOK_CLI;
const extra = process.env.VSCODE_HEADLESS === '1'
  ? ['--ozone-platform=headless', '--disable-gpu'] : [];
try {
  await runTests({
    vscodeExecutablePath: process.env.VSCODE_EXECUTABLE || undefined,
    version: process.env.VSCODE_VERSION || 'stable',
    cachePath: directory,
    extensionDevelopmentPath: root,
    extensionTestsPath: resolve(root, 'tests/editor.cjs'),
    extensionTestsEnv: { LARP_EDITOR_RESULT: resultFile },
    launchArgs: [
      workspace, '--no-sandbox', '--skip-welcome', '--skip-release-notes',
      '--disable-workspace-trust', '--disable-updates', '--disable-telemetry',
      `--user-data-dir=${resolve(directory, 'user-data')}`,
      `--extensions-dir=${resolve(directory, 'extensions')}`,
      ...extra,
    ],
  });
  if ((await readFile(resultFile, 'utf8')).trim() !== 'passed') {
    throw new Error('The editor did not report successful test completion.');
  }
} catch (error) {
  console.error('VS Code editor tests did not complete successfully:', error.message);
  process.exitCode = 1;
}
