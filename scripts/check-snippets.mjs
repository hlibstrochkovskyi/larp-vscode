import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const compiler = process.env.LARP_CLI || 'larp';
const version = spawnSync(compiler, ['--version'], { encoding: 'utf8' });
if (version.status !== 0 || !version.stdout.includes('0.1.0-preview.1')) {
  throw new Error('Set LARP_CLI to the v0.1.0-preview.1 compiler executable.');
}
const snippets = JSON.parse(await readFile(new URL('../snippets/larp.code-snippets', import.meta.url), 'utf8'));
const directory = await mkdtemp(join(tmpdir(), 'larp-snippets-'));
const root = 'archetype Founder { highkey mf aura; init() { self.aura = 0; } }';
const setup = 'Founder bro = new Founder();';
try {
  for (const [name, snippet] of Object.entries(snippets)) {
    const body = (Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body)
      .replace(/\$\{\d+:([^}]*)\}/g, '$1').replace(/\$\{\d+\}|\$\d+/g, '');
    let program;
    switch (snippet.prefix) {
      case 'main': program = body; break;
      case 'sidequest': case 'archetype': case 'role': program = `${body}\nmain_character {}`; break;
      case 'lambda': program = `main_character { let callback = ${body}; }`; break;
      case 'larp': program = `${root}\nmain_character { ${setup}\n${body}\n}`; break;
      case 'flex': case 'canon': program = `${root}\nmain_character { ${setup}\nlarp (bro) as Trial { ${body} } }`; break;
      default: program = `main_character {\n${body}\n}`;
    }
    const file = join(directory, `${snippet.prefix}.larp`);
    await writeFile(file, program);
    const checked = spawnSync(compiler, ['check', file], { encoding: 'utf8' });
    if (checked.status !== 0) throw new Error(`${name}:\n${checked.stderr}\n${program}`);
    console.log(`Compiler accepts snippet: ${name}`);
  }
  const fixtures = new URL('../tests/fixtures/upstream/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', fixtures), 'utf8'));
  for (const fixture of manifest.files.filter(f => f.path.startsWith('examples/'))) {
    const file = new URL(fixture.path, fixtures);
    const { fileURLToPath } = await import('node:url');
    const checked = spawnSync(compiler, ['check', fileURLToPath(file)], { encoding: 'utf8' });
    if (checked.status !== 0) throw new Error(`${fixture.path}:\n${checked.stderr}`);
    console.log(`Compiler accepts example: ${fixture.path}`);
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
