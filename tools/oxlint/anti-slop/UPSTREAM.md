# Vendored anti-slop

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) at commit
`c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b` (2026-09-10), MIT. Copied on
2026-10-08 from the `install-anti-slop` skill's `assets/anti-slop/`. The skill
folder (tree `89044d21c75a367eac1ddbaf208e650b1a7d5820`, the hash
`~/.agents/.skill-lock.json` records) is byte-identical to
`skills/install-anti-slop` at that commit, and has not changed since
`e6676e8d0bf17c678cb45b9dacb2bd6ca8dea53a`.

The pristine base for the next update is upstream's
`skills/install-anti-slop/assets/anti-slop` at that commit, tree
`a7831feb0c097943ac813ddcb1367e26eef52da5`. Every file here matches it except
`LICENSE` and this one.

## Files

- `index.ts`, `rules/`, `shared/` — the generic plugin, registered in
  `.oxlintrc.json` as `anti-slop`.
- `effect/` — the opt-in Effect plugin. It is not registered, since ttheme does
  not depend on `effect`.
- `vendor/eslint-stylistic/` — ESLint Stylistic's
  `padding-line-between-statements`, which `require-readable-spacing` runs on,
  with its own `LICENSE` and `UPSTREAM.md`.
- `LICENSE` — upstream's MIT license, verbatim (blob
  `69239ead1ed4a05db45c0da08d1b8f64c0a76ee4` at that commit). The skill bundle
  does not carry it.

## Local deviations

The source is upstream's, unchanged. The configuration differs from what the
skill installs:

- `require-safety-comment-for-type-assertion` is off, because first-party code
  carries no comments (`AGENTS.md`). `no-chained-type-assertions` and
  `no-widen-then-assert` stay on.
- `no-runtime-typeof`, `no-unknown-parameters`, `no-unknown-returns` and
  `no-unsafe-dictionary-type` are off in the files `.oxlintrc.json`'s
  `overrides` lists: the modules that decode a file or a response into
  ttheme's types by hand.
- oxlint's default `correctness` category is off. Biome is ttheme's linter
  (`mise run lint`); oxlint runs these rules and nothing else.
- Biome skips this folder (`biome.json`), so it keeps upstream's formatting.

## Dependencies

`oxlint` and `@oxlint/plugins` are pinned to the same exact version, `1.87.0`.
Upstream develops against `1.78.0`. JS plugins are alpha and not bound by
semver, so move both packages together and run `mise run slop` afterwards.

## Verification (2026-10-09)

- The copy typechecks against `@oxlint/plugins` 1.87.0 with upstream's compiler
  options. ttheme's own `noUncheckedIndexedAccess` fails
  `shared/dictionary-types.ts:201` (`unsafeMembers[0]`). The root `tsc` covers
  only `src/` and `tests/`, so it never sees this folder.
- The skill bundle ships no tests. Upstream keeps them beside each rule, in
  `src/rules/*.test.ts`.
- `mise run slop` over ttheme found 6,141 problems in 230 files. 5,793 of them
  are `require-readable-spacing`, which `oxlint --fix` clears by adding one
  blank line each and touching no other line; Biome changes nothing after that
  fix, and a second run of both changes nothing.
