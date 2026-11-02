# Changelog

## Unreleased

- In Windows Terminal, `ttheme light`, `ttheme dark` and `ttheme auto` typed in a tab with a palette no longer drop that tab to the default palette.
- `ttheme add` says "1 palette installed" rather than "1 palettes installed".
- The builder's `Slot` tab reads `Color`.
- In Contour, a tab keeps its palette when the system turns dark or light while `ttheme dark` or `ttheme light` is set, where it used to drop to the terminal's own colors until the next command.
- A tag with a quote or a `$` in find's Hide tags no longer breaks config.zsh or runs as a command when a shell starts.
- A marketplace of more than 300 palettes and works no longer shows in Browse's search or on the site, and is still added by its name.
- Search marketplace finds a palette of a marketplace you have not added by its whole name, `bob@neon/glow`.
- Over ssh, enter on Request a palette or Make one in Browse shows the address to open, where it did nothing.
- An update no longer turns a palette into its other mode when you and its upstream each changed its background or foreground; `ttheme edit` picks between them.
- `ttheme update` and `ttheme edit` no longer lose or garble colors in a palette you wrote by hand with single quotes, indented keys or comments in its ANSI list.
- A broken link or an odd file in your marketplace's `sets/` folder no longer stops every command; ttheme skips it and `ttheme marketplace check` names it.
- `ttheme edit` and `ttheme add` no longer break the other palettes in a set you wrote by hand; they say so when they cannot change it in place.
- A damaged PNG now fails with a plain message, and a PNG built to swell in memory is refused.
- A session of find that meets many damaged JPEGs no longer stops showing pictures.
- `ttheme palette make` no longer crashes on an anchors file that names every accent color.
- A marketplace description or a find setting holding `$&` or `$'` goes in as you typed it.
- `ttheme init` and `uninstall` no longer take out lines of your config when one of them happens to mention `# ttheme begin`.
- `ttheme share` says when your tuning has turned a palette into its other mode, instead of printing a link nobody can add.
- Changing what find hides no longer overwrites your hidden tags in a config.zsh that has no line for it.
- An empty `XDG_CONFIG_HOME`, `XDG_STATE_HOME`, `XDG_CACHE_HOME` or `XDG_DATA_HOME` now means the default folder, instead of the folder you ran ttheme in.
- `ttheme share` refuses a link too large to open again and points to a marketplace, instead of printing one that fails for whoever opens it.
- `ttheme palette make` no longer overwrites a work file that has a typo in it; it says which file to fix.
- In Warp, a command that rewrites ttheme's files, `ttheme add` for one, no longer takes away a palette you put on with `ttheme use` while ttheme is off.
- `ttheme palette` works from the shell command; before, it did nothing unless run through its file
- A mistyped command, option or action now exits 3 from the shell command as from the CLI, and `ttheme help <unknown>` says so instead of printing the general help

## 1.2.85

- A marketplace palette whose `subject` names a built-in character by an old id, `vocaloid/miku` for one, fails `ttheme marketplace check` until it names the new id, `vocaloid/hatsune-miku`; it still installs and shows.
- `ttheme use` and every other shell command take a palette or path with `-h` in its name, such as `akemi-homura`, instead of printing their usage

## 1.2.84

- Every built-in palette whose character has a danbooru tag now goes by the character's full name: `bocchi` is `gotoh-hitori`, `gojo` is `gojo-satoru`, `joker` is `amamiya-ren`. A palette you installed under the old name stays installed under it but no longer updates; add the new name to follow it, and pin or tune it again there.
- Search marketplace finds works by their titles and palettes by their whole names. It no longer finds a work by the name of a character in it; look for the work, then the character on the site's page for that work.

## 1.2.83

- The ttheme-palette agent skill is about 30% shorter with the same steps, so an agent following it spends less of its context.

## 1.2.82

- Search marketplace in Browse answers a character's name sooner: it no longer looks up the works of a character ttheme already knows, and a file names.ttheme.dev fails to send is asked for again on its own instead of the whole search starting over.

## 1.2.81

- Search marketplace in Browse finds a work or a character typed in any language you know it by, such as 치이카와 or ぼざろ, and lists the work with every marketplace that has palettes of it. It asks names.ttheme.dev once you stop typing; `TTHEME_NAME_LOOKUP=off` keeps it to the text alone. When no marketplace has it yet, Request a palette opens the request form on GitHub with the name filled in.
- A Preview filter that finds nothing offers ⌕ Search marketplace for it, and `enter` or a click takes the filter to Browse.

## 1.2.80

- ttheme installs with Bun too: `bunx @kecan0406/ttheme@latest init`. `init` remembers whether npx or bunx ran it, and `ttheme update` checks for and installs a new release the same way, so a Bun setup needs no npm. ttheme still runs on Node.js 22 or newer.
- `init` stops when it finds no Node.js 22 or newer on PATH, where under bunx alone it used to finish an install whose `ttheme` command then failed in every tab.

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
