# Use ttheme

Try palettes on, use one in a tab or as the default, pin one to a folder, switch
between light and dark, add palettes and pictures, and take it all back out.

## Try palettes on

Run `ttheme` on its own. It opens Preview, where the tab shows every palette you
installed as the cursor lands on it, so you choose by looking.

```screen title="ttheme"
 >ω   Preview   Browse   ⇧tab Browse       konata  Lucky☆Star
 ⌕ Search… e.g. kita | Lucky☆St…  2/2      Shell  Code  Diff  Logs  Monitor

   ▸ Bocchi the Rock!  ぼっち・ざ…  1      ▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀
   ▾ Lucky☆Star  らき☆すた          1
▌    ■ konata             ■ ■ ■ ■ ■ ■      ~/code/demo on main +2 ~1
                                           ❯ git status -sb
                                            M src/main.rs
                                           ?? notes.md

                                           ❯ cargo test
                                            ✓ parses config
                                            ✗ renders frame

                                           ❯ echo selected text
  PREVIEW   enter use   tab edit   ⇧←→ sample   ? keys               esc cancel
```

- `↑` `↓` move, and the tab shows each palette the moment the cursor lands on it.
  `→` or `enter` opens a work, `←` closes it.
- Typing filters the list. It matches palette names, works and characters, and a
  character's names in their original language too, so `hitori` and `ひとり`
  both find `bocchi`.
- From 76 columns on, a sample beside the list shows the palette in a shell
  session, code, a diff, logs and a process monitor. `⇧←` `⇧→` switch the scene.
- `?` lists every key of the screen you are on, and the mouse works too.

## This tab, new tabs and the default

`enter` on a palette asks where it goes. **Default** makes it the palette new tabs
open with, in every terminal you wired; **This tab** uses it in this tab alone.
`esc` leaves Preview and puts the tab back the way it was. When you know the
name, skip Preview:

```sh
ttheme use miku          # this tab only
ttheme use ttheme/miku   # by its full name, when two marketplaces have a miku
ttheme default miku      # the default for new tabs
```

- A tab only ever changes its own colors, so a palette you used there stays
  until you change it. A new default reaches open tabs where you never used a
  palette by hand at once.
- Set `TTHEME_TAB_PALETTE` to `seq` (in `ttheme config`, or `alt+c` in `ttheme`)
  and each new tab takes the next palette: work by work, each work's characters
  in the order of its cast, then the originals. `off`, the default, keeps new
  tabs on the default palette.
- `ttheme off` gives every tab the terminal's own colors and keeps everything
  installed; `ttheme on` uses the default again. Pins and rotating new tabs rest
  while it is off.
- A change made in one tab reaches every other tab that sits idle at its prompt
  at once. A tab busy with a program catches up at its next prompt.

## Pin a folder or an ssh host

A pin gives a folder, or an ssh host, its own palette. A tab shows it while it
is there and puts back what it showed before when it leaves.

```sh
ttheme pin              # this folder
ttheme pin ~/work/site  # another folder, without going there
ttheme pin ssh:tusa     # one host
ttheme pin ssh:*.prod   # every host ending in .prod
```

`ttheme pin` opens the palette list. Pick a palette with `enter`, then choose how
far the pin reaches with `←` `→`:

| Reach | Covers |
|---|---|
| **This directory** | the folder alone; a folder below it keeps whatever covers it |
| **And below** | the folder and everything under it, except a folder with a pin of its own |
| **Repository** | the whole git repository you are in, from its root down |

The nearest pin above a folder wins, and a palette you used in the tab by hand
between a `cd` in and out stays. An ssh pin shows from the moment you run
`ssh tusa` until the prompt comes back. The host is the name you type after
`ssh`, so a `Host` from `~/.ssh/config` works as it is, and a host's own pin
beats a pattern. Only a session counts: `scp`, `rsync`, `git` and an `ssh` in a
script leave the tab alone. In Ghostty, `ghostty +ssh tusa` counts too, and so
does `ssh tusa` under the alias Ghostty suggests, `alias ssh='ghostty +ssh --'`.

```sh
ttheme pins             # every pin as a tree, in its palette's colors
ttheme unpin            # this folder's pin, or choose which
ttheme unpin ssh:tusa
```

Pins live in `~/.config/ttheme/pins`, one per line, and the file is yours to edit
(`~/work/**  ttheme/konata`, where `path/**` covers everything below the path).

## Light, dark and auto

Every palette comes in a light and a dark mode, and one setting picks the mode
all of them show in.

```sh
ttheme light   # dark text on a light background
ttheme dark    # light text on a dark background
ttheme auto    # the system's appearance, followed as it changes
```

A switch changes every open tab in every terminal you wired, and moves each
palette's pictures to the new mode. `alt+c` in `ttheme` has the same setting as
its **Mode** row. `auto` is offered where a wired terminal tells ttheme about the
system's appearance: Ghostty, iTerm2, kitty, WezTerm and Contour. Once one of
them hears a change, every terminal you wired switches with it.

The built-in palettes carry both modes. A marketplace palette made in one mode
gets the other by the same rules: each color keeps its hue, its lightness moves
to the other side, and the colors that identify the character are kept apart.
Your tuning belongs to the mode it was made in.

## Add and update palettes

Palettes come from marketplaces. The built-in one ships with ttheme, and anyone
can publish another from a GitHub repository. A palette is someone's take on a
character, or on a whole work, in colors; Preview and Browse show every palette
under its work, whichever marketplace it comes from. A palette of no work is an
original, on a shelf per marketplace. `alt+g` in Preview groups the list by work
or by marketplace and sorts a work's characters by name (`abc`) or by cast.

Every palette has a full name: `ttheme/rei` for a built-in one,
`alice@pastel/rei` for the rei in alice's `pastel` marketplace. A name typed
alone works when only one palette has it, and `tab` completes full names.

`ttheme`, then `shift+tab`, opens Browse: a card per marketplace you added and
the palettes of the one under the cursor, by work.

- Typing filters every marketplace at once.
- `space` marks a palette, a work or a whole marketplace to install; marking one
  you have removes it.
- `enter` reviews everything you marked, and `enter` again applies it. Nothing is
  written before that.

```sh
ttheme add gojo geto                        # install palettes by name
ttheme add alice@pastel/dusk                # a palette from another marketplace
ttheme add tt8:…                            # a share link or its code
ttheme marketplace add alice/ttheme-pastel  # a GitHub repository; #v1 pins a tag, branch or commit
ttheme marketplace add ./my-marketplace     # a folder, always up to date
ttheme marketplace remove alice@pastel      # installed palettes keep working
```

In Browse, `+ Add marketplace` takes the same sources, and `⌕ Search marketplace`
lists every public marketplace on GitHub. A palette is colors in a TOML file,
never code. Nobody reviews a marketplace, and only the built-in palettes must
pass every contrast check before they ship; Browse shows the numbers of the
rest.

```sh
ttheme update                  # ttheme itself, then every marketplace
ttheme update alice@pastel     # one marketplace
```

The built-in palettes change with a new ttheme release, which `ttheme update`
installs through npx or bunx, whichever ran `init`; other marketplaces are
fetched again. An installed palette keeps the colors it was installed with until
you take its update: `ttheme update` names the palettes that have one, and
Browse marks them `⇡`, where `ctrl+r` stages one for `enter` to apply. Your
tuning stays on top. `TTHEME_AUTO_UPDATE=off` in `ttheme config` stops the daily
release check and the refetch of a marketplace you switched to update on its
own.

## Pictures

A palette can carry a picture of its character behind your text. ttheme ships
none: pictures are downloaded to your machine, into `~/.config/ttheme/backgrounds`,
cut out and kept faint enough that your text still passes the contrast checks.
[Terminal support](../reference/terminals.md) says which terminals draw them.

In `ttheme`, put the cursor on a palette and press `tab` to open its panel. The
**Pictures** row holds the palette's pictures; `enter` on an empty frame opens
**find**, and `f` does from anywhere in the panel.

- **find** searches danbooru, konachan, yande.re and zerochan and lays the posts
  out as a grid of thumbnails. `tab` moves between all and each site, `c` narrows
  to cutouts, `/` edits the search (or takes a post's link or number) and `s`
  opens the filters. It lists only posts rated safe by default, and shows each
  post's number and artist. It is not offered in Terminal.app or inside tmux.
- `enter` on a thumbnail shows the window the way the picture will look. `x`
  switches between the cut-out and the whole picture (on macOS `>=14` the
  system's own Vision framework does the cutting; nothing is uploaded), `c` draws
  it in its own colors or tinted in one color of the palette, and `t` opens the
  tuning. `enter` installs it with the artist and the artwork's page.
- Drop a picture file on the window while find is open, or paste one: a file, its
  path, a link, or a screenshot with `ctrl+v`. PNG and JPEG work everywhere.

The panel tunes a picture row by row with `←` `→`: **Colors**, **Size** (up to
**fill**), **Position** (nine anchors, `1`–`9`) and **Opacity**. `=` resets a row
and `+` every row, `space` hides the picture, `s` saves and `esc` drops what you
changed since the last save. Opacity starts at the highest value at which the
palette's text still passes the contrast checks; the panel lets you raise it
further.

A palette keeps every picture you install on it. `,` and `.` move along the
Pictures row, `s` makes the one you land on the palette's picture, and `D`
removes it, files and all. `y` copies a line that credits the artist, ready to
paste beside a screenshot.
[Settings](../reference/settings.md) lists `TTHEME_BG_COLORS`, `TTHEME_BG_BLUR`
and every `TTHEME_FIND_*` filter.

## What init changes

`init` adds one guarded block to each config it wires and keeps everything else
in `~/.config/ttheme`. ttheme sets colors only, never a font or a shader, and
`init` keeps `<file>.ttheme.bak` before its first edit of a file. Everything
outside the block stays yours.

```sh tab="npx"
npx @kecan0406/ttheme@latest uninstall
```

```sh tab="bunx"
bunx @kecan0406/ttheme@latest uninstall
```

Uninstall lists what it will do, then takes every ttheme block out of your
configs and startup files, gives Warp, iTerm2, Konsole and Terminal.app their own
themes and default profiles back, and deletes `~/.config/ttheme`, the
`ttheme-*` theme files and the cache. A config you did not touch since `init`
comes back byte for byte; one you edited keeps its backup.

> [!WARNING]
> Your own palettes live in `~/.config/ttheme/marketplace` and go with the rest.
> [Publish them](make.md#publish-a-marketplace) or copy the folder first.

## When something goes wrong

- **The `ttheme` command is not found.** Tabs opened before `init` started their
  shell without it. Start the shell again, as in [Quick start](quickstart.md).
- **A terminal shows no palette.** Quit and reopen iTerm2, Konsole, Terminal.app
  or Contour once. If ttheme never wired that terminal, run `init` again from
  inside it, answer **No, set it up again**, and mark it where it says
  `detected`.
- **`init` stops without asking anything.** It asks in a terminal and stops where
  there is none. Run it in a terminal tab, or add `--yes`.

When none of these fits, `ttheme info` prints what a bug report needs (before
ttheme is set up, `npx @kecan0406/ttheme@latest info`, or the same through
`bunx`).
[Report a bug](https://github.com/kecan0406/ttheme/issues/new?template=bug.yml)
with that output.
