# Changelog

## Unreleased

## 1.2.79

- An ssh pin takes in Ghostty under the alias Ghostty 1.4 suggests, `alias ssh='ghostty +ssh --'`, and when you run `ghostty +ssh` yourself.
- After `reset` in Ghostty 1.4 or Alacritty, which put back only the default palette's 16 ANSI colors, a tab shows its own palette again at the next prompt.

## 1.2.78

- The ttheme-palette skill is skill format 3: an older copy, which may still take the first anchor for the color a palette leans toward, asks to be updated before it starts. The skill also says where a color no ANSI role holds, such as an orange between red and yellow, goes.

## 1.2.77

- Palettes no longer carry a `signature`: every palette is measured, fixed and turned into its other mode by the same rules. ttheme ignores a `signature` line a marketplace's file still holds, and `ttheme marketplace check` warns about it.
- An ANSI color a palette's signature let off its role keeps the role now: 61 colors in 42 built-in palettes moved, so red, green and yellow read as red, green and yellow again, and every built-in palette's other mode was made again.
- A palette's other mode tints its background and grays with the cursor's hue, keeps the foreground's own hue and shows the selection at one tone, the same for every palette.
- The palette editor drops `*` and the ✦ mark, and the builder its signature picks.
- `ttheme palette make` takes any number of anchors, `cursor` always among them.
- Share codes start with `tt8:`, and a `tt7:` link no longer opens.
