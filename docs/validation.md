# Validation for 0.1.0

Date: 2026-10-19. Compiler baseline: `v0.1.0-preview.1`.

## Executed locally

- `npm test`: **118 passed**, none failed or skipped. Uses `vscode-textmate`
  9.3.2 and `vscode-oniguruma` 2.0.1 with its real Oniguruma WASM engine.
- All **102** upstream fixtures match their pinned Git blob hashes. Their
  highlighting is checked against **6614 token/comment spans** produced by the
  upstream Rust lexer. Coverage includes 13 official examples, 39 passing
  conformance programs, 40 semantic-error programs, and 10 runtime-error programs.
- Explicit scope assertions cover every reserved word, ASCII boundaries, case,
  operators, range/float boundaries, numeric separators, invalid numbers,
  the five valid escapes, invalid escapes, non-nesting comments, LF/CRLF,
  unfinished-string recovery, incomplete type recovery, nested function/generic
  types, commented conversion calls, declarations, scenarios, and effects.
- Long strings, comments, and numeric literals remain within the TextMate engine
  test budget. This is a bounded regression check, not a general performance proof.
- `npm run test:compiler`: all **18 snippet defaults** compile in appropriate
  contexts, and all **13 official examples** compile using `larp check` from the
  v0.1.0-preview.1 compiler. Programs are checked without execution.
- `npm run package`: Microsoft `@vscode/vsce` 4.0.0 builds a universal VSIX.
  The package checker validates ZIP integrity, exact archive members, matching
  grammar/config/snippet bytes, language contributions, and VSIX identity.
  The archive has seven extension files and two VSIX metadata files; it contains
  no tests, source corpus, development tools, Git metadata, or node_modules.
- The generated VSIX installs through the installed VS Code **1.141.1** CLI into
  temporary user-data/extensions directories. `--list-extensions --show-versions`
  reports `hlibstrochkovskyi.larp-vscode@0.1.0`.
- The final dependency installation reports **zero npm audit vulnerabilities**.
- Git whitespace checks pass. The language repository is only read, never modified.

## Editor integration

`npm run test:editor` uses Microsoft's `@vscode/test-electron` 3.1.0. The suite
opens an actual `.larp` fixture and checks language detection, bracket/quote
closing, indentation/outdent, comment commands, snippet registration, and all
18 snippet expansions. A completion marker prevents a silent editor launch
failure from producing a passing test result.

The local managed sandbox blocks Electron startup before the tests run:

```text
FATAL:content/browser/sandbox_host_linux.cc:41
Check failed: . shutdown: Operation not permitted (1)
```

This run fails explicitly with SIGTRAP; editor integration and visual appearance
are **not locally verified**. The successful CLI installation does not establish
GUI behavior. CI is configured to run these checks under Xvfb on VS Code **1.85.2**
and **stable**. See the repository's actual Actions results for remote execution;
merely adding a workflow does not mean it passed.

## Manual check

1. Install `dist/larp-vscode-0.1.0.vsix` and open a `.larp` file. Verify **LARP**
   in the status bar. Open `tests/fixtures/upstream/examples/pitch-deck.larp` for
   objects, callbacks, scenarios, numbers, built-in types, and functions.
2. Check that strings/comments have separate colors in your theme. Inspect scopes
   using **Developer: Inspect Editor Tokens and Scopes**; the root is `source.larp`.
3. In a new `.larp` file, insert the `main` snippet. Type `{`, `(`, `[`, and `"`
   to check pairs; press Enter after an opening brace to check indentation.
4. Use **Toggle Line Comment** and **Toggle Block Comment**, then toggle back.
5. Insert the `npc`, `sidequest`, `archetype`, and `larp` snippets. Tab through
   placeholders; edit the scenario root to an existing eligible object.
6. Check `0..10`, `1_000`, `1.0e-2`, `"🦀\\n"`, and a multiline `/* … */` comment.
   Put `fr`, `49`, and braces inside strings/comments: their scopes should stay
   within that string/comment.
7. Run `npm test`, optionally `npm run test:compiler` with the compiler in PATH,
   and `npm run test:editor` in a desktop session or through Xvfb.
