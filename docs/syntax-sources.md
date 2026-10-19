# Syntax baseline

Reviewed on 2026-10-19, before implementing the extension.

The source of truth is [hlibstrochkovskyi/larp-lang](https://github.com/hlibstrochkovskyi/larp-lang),
default-branch commit `5bd3f1f4f9de9be6b7ce6d195bf952f21d88bdc1`.
The compiler release `v0.1.0-preview.1` points to commit
`61cc9314916c510673112dc799e247c0f59cc3b9` (annotated tag object
`bd9f81de19285a1ae4f3ee5c1e329f05dcd27005`). The specification, EBNF, lexer,
and parser are identical between these two commits.

Reviewed sources (paths relative to that pinned commit):

- [Specification](https://github.com/hlibstrochkovskyi/larp-lang/blob/5bd3f1f4f9de9be6b7ce6d195bf952f21d88bdc1/docs/spec/v0.1.md), especially sections 2–8.
- [EBNF](https://github.com/hlibstrochkovskyi/larp-lang/blob/5bd3f1f4f9de9be6b7ce6d195bf952f21d88bdc1/docs/spec/grammar.ebnf).
- [Lexer](https://github.com/hlibstrochkovskyi/larp-lang/blob/5bd3f1f4f9de9be6b7ce6d195bf952f21d88bdc1/crates/larp-syntax/src/lexer.rs) and parser in the same directory.
- Practical reference `docs/reference.md`, implementation status, release notes, and README.
- Frontend tests in `crates/larp-syntax/tests/`, official `examples/`, and `tests/conformance/{pass,fail,runtime}/`.

The local language checkout was read only. Relevant files were compared with
GitHub blob hashes; differing lexer/parser files were fetched from the pinned
commit. No language repository files were edited.

## Decisions

- Declarative VS Code language contributions: JSON TextMate grammar, language
  configuration, and snippets. No runtime extension entry point, TypeScript, or LSP.
- Recognize exactly `.larp`; bytecode `.larpbc` is not source.
- ASCII identifiers, case sensitive. Unicode is supported inside strings/comments.
- Decimal integers and floats only; underscores occur singly between digits.
  A sign is an operator; `0..10` is an integer, a range, and an integer.
- Double-quoted, single-line strings; escapes are exactly `\"`, `\\`, `\n`,
  `\r`, and `\t`. No interpolation, raw strings, or character literals.
- `//` and non-nesting `/* ... */`. Unterminated strings recover on the next
  line for editing; unterminated block comments continue to EOF.
- Recognize individual words of `npc loop` and `locked_in while`, including
  comments/newlines between them.
- Built-in types are type names, not reserved words. Effects are names within
  `uses(...)`, not global keywords. Prelude names are shadowable; syntactic
  highlighting cannot resolve shadowing or determine a receiver's type.
- Highlight functions, methods, constructors, extension receivers, role/class
  names, function types, nested type arguments, lambdas, and scenario labels.
- Bracket matching/autoclosing for `{}`, `[]`, `()`, and string quotes. Angle
  brackets are not auto-paired because they also represent comparisons.
- No invented imports, inheritance, async, exception handling, interpolation,
  ternaries, hexadecimal literals, or additional operators.

## VS Code references

- [Syntax highlighting](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide)
- [Language configuration](https://code.visualstudio.com/api/language-extensions/language-configuration-guide)
- [Packaging and local VSIX installation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

Tests use Microsoft's `vscode-textmate` and `vscode-oniguruma`, the same grammar
engine family used by VS Code. Source fixtures keep their upstream paths and
blob hashes in `tests/fixtures/upstream/manifest.json`; their MIT license is retained.
