import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Use an installed VS Code. User data, extensions, and workspace are isolated.
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
const extra = process.env.VSCODE_HEADLESS === '1'
  ? ['--ozone-platform=headless', '--disable-gpu'] : [];
const env = { ...process.env, LARP_EDITOR_RESULT: resultFile };
delete env.ELECTRON_RUN_AS_NODE;
delete env.VSCODE_IPC_HOOK_CLI;
const child = spawn(process.env.VSCODE_EXECUTABLE || 'code', [
  '--new-window', '--wait', '--no-sandbox', '--skip-welcome', '--skip-release-notes',
  '--disable-workspace-trust', '--disable-updates', '--disable-telemetry',
  `--user-data-dir=${resolve(directory, 'user-data')}`,
  `--extensions-dir=${resolve(directory, 'extensions')}`,
  `--extensionDevelopmentPath=${root}`,
  `--extensionTestsPath=${resolve(root, 'tests/editor.cjs')}`,
  ...extra, workspace,
], { stdio: 'inherit', env });
const timer = setTimeout(() => {
  console.error('VS Code editor tests exceeded 90 seconds.');
  child.kill('SIGTERM');
  process.exitCode = 1;
}, 90_000);
child.on('error', error => {
  clearTimeout(timer);
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', async code => {
  clearTimeout(timer);
  try {
    if (code !== 0 || (await readFile(resultFile, 'utf8')).trim() !== 'passed') throw new Error();
  } catch {
    console.error('VS Code editor tests did not complete successfully. See the editor output above.');
    process.exitCode = 1;
  }
});
