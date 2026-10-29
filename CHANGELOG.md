# Changelog

## Unreleased

## 1.2.77

- Palettes no longer carry a `signature`: every palette is measured, fixed and turned into its other mode by the same rules. ttheme ignores a `signature` line a marketplace's file still holds, and `ttheme marketplace check` warns about it.
- An ANSI color a palette's signature let off its role keeps the role now: 61 colors in 42 built-in palettes moved, so red, green and yellow read as red, green and yellow again, and every built-in palette's other mode was made again.
- A palette's other mode tints its background and grays with the cursor's hue, keeps the foreground's own hue and shows the selection at one tone, the same for every palette.
- The palette editor drops `*` and the ✦ mark, and the builder its signature picks.
- `ttheme palette make` takes any number of anchors, `cursor` always among them.
- Share codes start with `tt8:`, and a `tt7:` link no longer opens.
