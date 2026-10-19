# Vendored anti-slop

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) at commit
`13909c9e07590f5a85d93c62712259fe14a883f7` (2026-10-13), MIT. Copied on
2026-10-15 from a clone of that commit's `skills/install-anti-slop/assets/anti-slop`
(tree `54b50f11bed7f52ca1948f8802f4df591644762f`; the skill folder is tree
`97962dc9fad565ca7695bf57805d9d0138ce1def`).

The pristine base for the next update is that folder at that commit. Every file
here matches it except `LICENSE` and this one.

The update from `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b` (tree
`a7831feb0c097943ac813ddcb1367e26eef52da5`, the base of the 2026-10-08 copy, which
matched it byte for byte) brought one upstream change, `d2a9aea`:
`require-readable-spacing` keeps consecutive single-line bindings grouped at any
scope, module scope included, unless a binding has its own leading comment
(`rules/require-readable-spacing.ts`, and `createPaddingLineRule` taking
caller-defined statement types in `vendor/eslint-stylistic/`). Nothing local
needed merging.

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
- `no-conditional-empty-object-spread` is off: `...(x ? { k: x } : {})` is
  how ttheme builds an object with optional keys throughout (164 places when
  the rule came in), and with `exactOptionalPropertyTypes` off the statement
  form it asks for would only trade expressions for mutation.
- `no-runtime-typeof`, `no-unknown-parameters`, `no-unknown-returns` and
  `no-unsafe-dictionary-type` are off in the files `.oxlintrc.json`'s
  `overrides` lists: the modules that decode a file or a response into
  ttheme's types by hand.
- oxlint's default `correctness` category is off. Biome is ttheme's general
  linter; `mise run lint` runs it and then oxlint, which runs these rules and
  nothing else (`mise run format` applies oxlint's fixes before Biome's).
- Biome skips this folder (`biome.json`), so it keeps upstream's formatting.

## Dependencies

`oxlint` and `@oxlint/plugins` are pinned to the same exact version, `1.89.0`.
Upstream develops against `1.78.0`. JS plugins are alpha and not bound by
semver, so move both packages together and run `mise run slop` afterwards.

## Verification (2026-10-15)

- `mise run slop` over main (`93ed484`) found 6,652 problems: 6,271 of them
  `require-readable-spacing`, where the 2026-10-08 copy found 6,605 on the same
  tree, and the other rules' 381 unchanged. The copy still runs on
  `@oxlint/plugins` 1.87.0.
- The skill bundle ships no tests. Upstream keeps them beside each rule, in
  `src/rules/*.test.ts`, which `d2a9aea` extended for the grouping.
