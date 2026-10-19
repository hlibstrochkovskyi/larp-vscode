import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import vsce from '@vscode/vsce';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const name = `${manifest.name}-${manifest.version}.vsix`;
const directory = resolve(root, 'dist');
await mkdir(directory, { recursive: true });
const path = resolve(directory, name);
await vsce.createVSIX({ cwd: root, packagePath: path, dependencies: false });
const verified = spawnSync(process.env.PYTHON || 'python3', [resolve(root, 'scripts/check-vsix.py'), path], { stdio: 'inherit' });
if (verified.status !== 0) process.exit(verified.status ?? 1);
const digest = createHash('sha256').update(await readFile(path)).digest('hex');
await writeFile(`${path}.sha256`, `${digest}  ${name}\n`);
console.log(`SHA-256: ${digest}`);
