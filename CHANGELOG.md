# Changelog

## Unreleased

## 1.2.98

- Seven Chainsaw Man palettes join the built-in ones: Denji, Power, Makima, Hayakawa Aki, Higashiyama Kobeni, Reze and Himeno.

## 1.2.97

- `ttheme help <command>` now links to the command on the docs' new CLI pages, at ttheme.dev/docs/cli/commands, beside Configuration and Environment variables.

## 1.2.96

- In Warp, moving onto a palette with pictures in Preview's list is faster: each picture's thumbnail is now kept beside it in the form Warp is sent, so the shell no longer starts a process for every thumbnail. The update writes it for the pictures you already have.

## 1.2.95

- Preview now shows the panel of the palette under the cursor beside the list, its pictures, colors and Apply, so you can see and change them while you look: `→` or a click moves into it. `tab` shows the sample full screen instead, where `↑` `↓` move between palettes and `⇧←` `⇧→` switch the scene. The panel needs 86 columns; a narrower window lists the palettes alone, and `→` still opens the panel full screen. In `ttheme pin`, your pins are a `tab` away too.

## 1.2.94

- What a click would act on now lights up under the pointer in Preview, Browse, the palette editor and the picture search, down to the search's pictures and the tabs and text of the editor's mock terminal, and a press shows on the thing pressed until you let go. The sample's tabs in Preview and the key beside the bare `ttheme`'s tabs now take a click too. In terminals that allow it the pointer turns into a hand there. A key puts the highlight out until the pointer moves again, and `TTHEME_MOUSE=off` turns it off with the rest of the mouse; over ssh only the press shows.

## 1.2.93

- With the mode on `auto`, a tab that heard the system's appearance just as the palettes changed could keep a shell using a whole CPU core, even after the tab closed, and no tab followed the appearance while that tab stayed open. Background jobs no longer touch the terminal.

## 1.2.92

- A Help box keeps the keys no bar names on screen in Preview, Browse and the picture preview, and in the edit panel and the palette editor where the window is tall enough; the picture search names its own on the line above the key bar. Preview showed its keys only until the first key press, and the others only behind `?`, which still lists every key. `TTHEME_HELP_BOX=off`, or **Help** in `alt+c`, turns them off.
- Preview's sample, settings and pin choices now sit in boxes as tall as what they hold, as the edit panel's do.
- `?` in Preview's settings lists the keys of the settings; it listed the keys of the palette list.
- `a` in the picture search opens the advanced filters, as its help and tips say; it did nothing.

## 1.2.91

- A background picture that stands on its own now gets a white edge like a sticker, with hair and other thin ends drawn finer, and at the full size a top, right or bottom side the picture itself cuts off runs off the window instead of showing a straight edge. Your pictures are drawn again once. `TTHEME_BG_STICKER=off`, or **Sticker** in `alt+c`, leaves the edge as it was cut.
- On a light palette a new picture in its own colors opens as faint as its darkest colors need; it used to open fully opaque and cover the text.

## 1.2.90

- A new tab starts a little sooner: it reads only what a tab needs, and the rest waits until a `ttheme` command or a completion asks for it.
- The first tab after a change to your palettes no longer pauses to compile ttheme's shell files: `init`, `ttheme update` and every change compile them as they write them.

## 1.2.89

- ttheme keeps nothing in `~/.cache/ttheme` any more: no drawings of your pictures, no copies of booru posts, of the marketplace list or of name lookups. You can delete the folder, which can hold hundreds of megabytes.
- Switching between dark and light no longer draws tinted pictures again: each one keeps its drawing for the other mode beside it.
- Browse's marketplace search and its name lookups ask the network every time, so while offline they say they cannot reach it instead of showing an older list.
- `ttheme palette make` keeps its base schemes in `~/.config/ttheme/schemes.json`, fetched the first time it needs them and again by `ttheme update`.

## 1.2.88

- The list of works and characters now comes from names.ttheme.dev when you install and update, instead of inside the package, so a work added to it reaches you without a new ttheme. Until it has loaded, or with `TTHEME_NAME_LOOKUP=off`, palettes are listed without their works.
- A request for a character from Browse's search now opens in aninames, where works and characters are added, and there is no more request for a palette: `Make one` is how you get one.
- Key hints on a Mac now read `⌥ + u` and `⌃ + r`, where they read `⌥U` and `⌃R`.
- Keys that do the same thing are apart by a slash, as in `? / esc`, in the key bars and in Help.
- Outside a Mac, the Shift keys read `shift+tab`, `shift+enter` and `shift+←→`, where they read `⇧tab`, `⇧enter` and `⇧←→`.
- Clicking `erase` in find's bar now erases.
- `ttheme pin` opens its side panel on a new Pins tab, showing every pin and which one covers this folder, and the step that asks how far a pin reaches now shows every pin too, ssh hosts included.
- Facts on one line now stand two spaces apart on every screen and message, without the middle dot that used to sit between them.
- iTerm2, Konsole and Terminal.app profiles are now named `ttheme: <palette>`, and Warp themes `<palette>, dark`.

## 1.2.87

- The cursor of every built-in palette now reads at 4.5:1 or better on its background, so the letter under a block cursor is easier to read. 98 of the 298 light and dark shades move a little in brightness; their hue stays.
- A palette you make holds its cursor to the same 4.5:1: `ttheme palette make` keeps it there, and the palette editor shows the check on the cursor's row.
- On a network that needs a proxy, the `ttheme` command now sends its requests through `HTTPS_PROXY` and `HTTP_PROXY`, with Node.js 22.21 or newer; every command that uses the network failed there before.
- `ttheme init` and `ttheme uninstall` typed in a shell now name the `npx` command that does them, instead of calling the command unknown.
- `ttheme use` with its output in a pipe or a file now says `ttheme use: needs a terminal`, where it wrote its color codes there.
- Cancelling `init`, `uninstall`, `share`, `edit` or `new` now exits 2, as nothing changed, where they exited 1 or 0, so a script can tell a cancel from a failure.
- `ctrl+z` at one of ttheme's questions no longer leaves the cursor hidden, and `fg` asks the question again, where it ended the command.
- In a narrow window, Browse's questions shorten to `Apply 5?` and `Remove alice@pastel?`, so their `y` and `n` answers stay on the bar.
- `ç` and `©` typed in Preview's filter are now typed once it holds text, where they opened the settings and the group menu as `alt+c` and `alt+g` do on a Mac; with an empty filter they still open them.

## 1.2.86

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
- `ttheme palette` works from the shell command; before, it did nothing unless run through its file.
- A mistyped command, option or action now exits 3 from the shell command as from the CLI, and `ttheme help <unknown>` says so instead of printing the general help.
- A verb's `--json` output piped into something that stops reading no longer ends in a stack trace.
- Network failures say what went wrong, such as a name that did not resolve or no answer in time.
- `ttheme update` exits non-zero when it could not reach a marketplace or check for a release.
- A paste or a terminal answer that is cut short no longer locks up Browse, the palette editor or find.
- Resizing the window while holding a key no longer garbles preview until the key is let go.
- Moving the mouse a little while clicking in preview no longer closes it and leaves stray text at the prompt.
- Browse's search says the marketplace index is not JSON when a portal or a proxy answers in its place.
- find says its search failed, in red, when no site could be reached, rather than that there are no posts.
- Browse's search stops looking up names when the server gives no answer in 20 seconds.
- Pasting a long text into preview no longer freezes it.
- Pasting a very long text into Browse no longer slows every key after it.
- Alt+enter no longer closes Browse, the palette editor or find.
- Preview's list says how many rows are above and below the window.

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
