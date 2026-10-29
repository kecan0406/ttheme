# src/core

The pure model. It does no I/O: no `process`, `fetch` or `Bun`, and of node only `node:crypto`, `node:path` and `node:zlib`; `booru.ts` is the one file that reads the environment (`TTHEME_FIND_HOSTS`, `TTHEME_FIND_CUTOUTS`). The site's browser code imports from here.

## Names

- A palette's full name is `<publisher>/<slug>` (`nameProblem`, `publisherOf`, `slugOf`, `isBuiltin` in `theme.ts`): `ttheme/<slug>` for a built-in one, `<owner>@<name>/<slug>` for a marketplace's. The slug is its `[[palette]]` table's `slug` key (`sets.ts`) and is used once in a marketplace, across all its sets.
- Where a name becomes a file it goes through `stem`. `STEM_RULES` is the one rule, rendered into Python, Lua and zsh by `src/terminals/emit/stem.ts`.
- A subject is `<work>` or `<work>/<character>` (`subjectProblem`); one character has one subject.

## Colors and the gate

- Every built-in palette passes the contrast gate in both modes. A new rule goes on the end of `GATE_RULES`; a rule that does not apply to a palette measures `NaN`, which every reader skips.
- `missedRules` (`contrast.ts`) decides which rules a palette misses, from the colors, unrounded. Count misses in rules, and never read an entry's stored `gate`, which an older copy holds with fewer rules. `measure`'s rounded values are only shown.
- `signature` names three slots that resolve to three different colors, in both modes.
- A palette is made in one mode (`modeOf`), and its other mode is the mirror (`mirror.ts`, the one implementation), the same whether a set keeps it or the runtime makes it.

## Memo and caches

- Whatever the CLI derives from a palette's or a work's text goes through `memo` (`memo.ts`), keyed by a hash of everything the computation reads; never key it on less.
- Never `memo` a derivation whose input changes while a screen is up (a draft, a hover, a frame): the memo never evicts.
- The color math keeps bounded in-process caches (`oklch`, `lab` and `deuteranope` in `color.ts`; `hctOf` and `hctHex` in `hct.ts`, the one place that reads or solves HCT). They are never written to disk and hold frozen values, since every caller shares them.

## Share codes

- A share code is `tt6:`. A change to its layout goes under another prefix, and an older prefix is refused, never read.
- The format is `draft.ts`, pure, with the hash and the packing handed in: `own.ts` packs with `node:zlib` and hashes with `node:crypto`; the site's builder uses `CompressionStream` and WebCrypto, never brotli.

## Decoders

- The sources run under bun (`bun test`, `bun src/bin.ts`) and the built bundle under node, but the sources do not run under plain node: the JPEG decoder (`jpeg.ts`, mozjpeg as WebAssembly) is inlined by the `src/embed.ts` Bun macro.
- It throws on an arithmetic-coded JPEG. Every decoder applies the EXIF orientation, so a cut-out's mask fits the picture as decoded.
