## What this changes



## Palette checklist

Skip this section if the pull request adds no palette.

- [ ] One palette, a `[[palette]]` table in `builtin/sets/<work>.toml` (`original.toml` for a palette of no work), its `slug` no other built-in palette's
- [ ] Its `subject` names a work or a character `commons/works/<work>.toml` holds — a new one gets its record there, in cast order
- [ ] The character's `danbooru` is its tag with posts on danbooru, held by no other character, or is left out
- [ ] `signature` names three slots that resolve to three different colors, in both modes
- [ ] `ansi_source` names the real base scheme; its license:
- [ ] Color values and post numbers only — no images, links or any other asset
- [ ] `mise run ci` passes
