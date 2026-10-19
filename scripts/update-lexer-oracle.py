#!/usr/bin/env python3
"""Generate token spans using the pinned upstream Rust lexer, in a temp build."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--upstream', type=Path, required=True, help='read-only larp-lang checkout')
parser.add_argument('--lexer-file', type=Path, help='optional fetched copy of the pinned lexer')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
fixtures = root / 'tests/fixtures/upstream'
manifest = json.loads((fixtures / 'manifest.json').read_text())
upstream = args.upstream.resolve()
lexer = (args.lexer_file or upstream / 'crates/larp-syntax/src/lexer.rs').resolve()
raw = lexer.read_bytes()
blob = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
if blob != manifest['lexerBlob']:
    raise SystemExit('Lexer differs from the pinned upstream blob. Review the baseline first.')

driver = r'''
use larp_source::{SourceFile, SourceId};
#[path = LEXER_PATH]
mod lexer;
fn main() {
    for path in std::env::args().skip(1) {
        let text = std::fs::read_to_string(&path).unwrap();
        let source = SourceFile::new(SourceId(0), &path, text);
        let scanned = lexer::lex_with_comments(&source).unwrap();
        for token in scanned.tokens {
            let kind = match token.kind {
                lexer::Kind::Word(_) => "word",
                lexer::Kind::Integer(_) => "integer",
                lexer::Kind::Float(_) => "float",
                lexer::Kind::Text(_) => "string",
                lexer::Kind::Punctuation(_) => "punctuation",
                lexer::Kind::Eof => continue,
            };
            let range = token.span.range();
            println!("{}\t{}\t{}\t{}", path, range.start, range.end, kind);
        }
        for comment in scanned.comments {
            let kind = match comment.kind {
                lexer::CommentKind::Line => "line-comment",
                lexer::CommentKind::Block => "block-comment",
            };
            let range = comment.span.range();
            println!("{}\t{}\t{}\t{}", path, range.start, range.end, kind);
        }
    }
}
'''.replace('LEXER_PATH', json.dumps(str(lexer)))

with tempfile.TemporaryDirectory(prefix='larp-lexer-oracle-') as temporary:
    project = Path(temporary)
    (project / 'src').mkdir()
    dependencies = '\n'.join(
        f'{name} = {{ path = {json.dumps(str(upstream / "crates" / name))} }}'
        for name in ['larp-source', 'larp-diagnostics']
    )
    (project / 'Cargo.toml').write_text(
        '[package]\nname = "larp-lexer-oracle"\nversion = "0.0.0"\n'
        'edition = "2024"\n[dependencies]\n' + dependencies + '\n'
    )
    (project / 'src/main.rs').write_text(driver)
    result = subprocess.run([
        'cargo', 'run', '--quiet', '--offline', '--manifest-path', str(project / 'Cargo.toml'),
        '--target-dir', str(project / 'target'), '--',
        *[str(fixtures / file['path']) for file in manifest['files']],
    ], check=True, capture_output=True, text=True)

tokens = {file['path']: [] for file in manifest['files']}
for line in result.stdout.splitlines():
    filename, start, end, kind = line.split('\t')
    tokens[str(Path(filename).relative_to(fixtures))].append([int(start), int(end), kind])
for spans in tokens.values():
    spans.sort(key=lambda span: span[0])
output = fixtures / 'lexer-oracle.json'
# One file per line keeps the generated data compact and reviewable.
output.write_text('{\n' + ',\n'.join(
    '  ' + json.dumps(filename) + ': ' + json.dumps(spans, separators=(',', ':'))
    for filename, spans in tokens.items()
) + '\n}\n')
print(f'Generated {sum(map(len, tokens.values()))} compiler token spans across {len(tokens)} files.')
