<h1 align="center">ttheme</h1>

<p align="center"><em>Character terminal palettes — readable by rule, switched live, one tab at a time.</em></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@kecan0406/ttheme"><img src="https://img.shields.io/npm/v/@kecan0406/ttheme?style=flat-square" alt="npm version"></a>
  <a href="https://github.com/kecan0406/ttheme/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/kecan0406/ttheme/ci.yml?branch=main&style=flat-square&label=ci" alt="CI status"></a>
  <a href="https://ttheme.vercel.app/"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fkecan0406.github.io%2Fttheme%2Fmanifest.json&query=%24.palettes.length&label=palettes&style=flat-square&color=c796c8" alt="palettes in the catalog"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/@kecan0406/ttheme?style=flat-square" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://ttheme.vercel.app/">Site</a> ·
  <a href="#palettes">Palettes</a> ·
  <a href="docs/usage.md">Usage</a> ·
  <a href="docs/terminals.md">Terminals</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <img src="docs/demo.gif" alt="ttheme: typing nichi filters to the Nichijou palettes, each one repaints the tab as the cursor lands on it, then rei is picked and applied" width="860">
</p>

## Why ttheme

- **Colors from the character.** Every palette keeps the three colors that
  identify its character and borrows its ANSI ramp from an established scheme,
  harmonized so the whole catalog reads alike.
- **Every palette passes an accessibility gate.** Body text at 7:1 against the
  background (WCAG AAA), every meaningful ANSI color at 3:1, and each accent stays
  in its role — red reads as an error, green as success. The build fails if a
  palette regresses.
- **Switched live, per tab.** Tabs in one window can wear different palettes,
  any tab can be repainted at any time, a directory can pin its own, and a new
  tab can take the next character.

## Quick start

```sh
npx @kecan0406/ttheme@latest init
```

It needs Node 22 or newer and zsh, which macOS ships — bash and fish get the
`ttheme` command too, run through zsh. It asks which terminals to wire and which
series to install, shows every file it is about to change, and writes nothing
until you confirm. Then:

```sh
exec zsh               # the ttheme command in this tab
ttheme                 # preview and browse as tabs — tab switches
```

<details>
<summary><b>What init changes</b></summary>

- Your terminal config and `~/.zshrc` get one line between `# ttheme begin` /
  `# ttheme end` that loads a file ttheme keeps under `~/.config/ttheme`, and
  only while it is there — so changing the default palette never touches your
  config again, and a config synced to a machine without ttheme still works.
  Everything outside the block is left alone, and what ttheme sets is colors —
  no font, font size or shader — plus, in Ghostty while new tabs rotate
  palettes, the `command` that opens them on the next one.
- Each file is backed up once to `<file>.ttheme.bak` before the first edit, and
  written through symlinks, so a dotfiles repo keeps its links.
- A `command` or `shell-integration` you set in Ghostty stays yours, and every
  file ttheme adds to a terminal's folders is named `ttheme-<palette>`.
- `npx @kecan0406/ttheme@latest uninstall` lists and then reverses all of it.

Per-terminal details, manual install from the release archives and building from
a checkout are in [docs/install.md](docs/install.md).

</details>

## Palettes

<p align="center">
  <a href="https://ttheme.vercel.app/"><img src="https://kecan0406.github.io/ttheme/readme/series.svg" alt="One card per series, drawn in its lead palette" width="856"></a>
</p>

<details>
<summary><b>Every palette</b></summary>
<br>
<img src="https://kecan0406.github.io/ttheme/readme/palettes.svg" alt="Every palette in the catalog, grouped by series" width="856">
</details>

Both images are drawn from the live catalog, so they always match what
Browse offers. `init` installs the series you pick; Browse, the second tab of
`ttheme`, adds or drops single palettes any time, and a merged palette reaches everyone
with the next release — `ttheme update` brings it, and ttheme says when one is
out.

### Marketplaces

Anyone can publish palettes from a GitHub repository. A marketplace is named
`<owner>@<name>` — its repository's owner and the name its `ttheme-marketplace.toml` gives — and
sits below the series in Preview and Browse, past a line, with
the folders under its `palettes/` as catalogs:

```
▾ Evangelion
    rei
    asuka
── Marketplaces ─────
▾ alice@pastel
  ▾ night
      dusk
      moon
  ▸ day
```

```sh
ttheme add dusk --marketplace alice/ttheme-pastel  # add alice's marketplace and install from it
ttheme marketplace add alice/ttheme-pastel#v1      # or add it alone, pinned to a tag
ttheme                                             # shift+tab to Browse: marketplaces are rows there — add, remove, auto-update
```

Browse handles marketplaces the way it handles palettes: in the same list it
adds one by repository or folder, finds the public ones on GitHub, marks one for
removal and switches its auto-update, and enter applies all of it with the
palettes you picked. The official catalog comes with ttheme and updates with it;
a repository asks when you add it whether its list updates on its own, and a
palette you installed from it keeps its colors until you take its update —
`ctrl+r` on a palette marked `↑` in Browse. Nobody reviews a marketplace. Its
palettes are colors and post numbers, never code, and the contrast gate's
numbers are shown for them but never enforced — only the official catalog is
held to the gate. `ttheme update` updates ttheme and refreshes every marketplace now; `ttheme marketplace
remove alice@pastel` drops one, and the palettes you installed from it keep
working. The official catalog is a marketplace too (`official`). [The marketplaces
page](https://ttheme.vercel.app/marketplace) lists the public ones.

### Your own palettes

`ttheme new rei` opens the palette editor on a blank palette: a few seeds grow
twenty colors that pass the contrast gate, then each one is tuned in OKLCH while
a mock terminal beside them shows the result. It makes `<you>@<marketplace>/rei`, named after your
GitHub handle and a marketplace name the first `new` asks for, in
`~/.config/ttheme/marketplace/<marketplace>`, and installs it; `--from rei` starts from
rei's colors instead. `ttheme edit rei` opens the same editor — on any palette,
the official ones included: one that is not yours keeps your changes as a tone
over its own colors, and `R` then `s` in the editor puts them back. `ttheme check
--fix` writes colors that pass the gate (as a tone, for a palette that is not
yours). Left without a palette, `edit`, `check` and `share` ask to use the one
the tab wears; `share` into a pipe uses it without asking.

A local marketplace is already a repository layout: `palettes/*.toml` (a folder
under it, such as `palettes/night/`, is a catalog) and the
`ttheme-marketplace.toml` that names it — nothing to build, since ttheme reads the
files as pushed. `ttheme marketplace init <name>` makes one and prints the commands that
publish it:

```sh
cd ~/.config/ttheme/marketplace/<name>
git init -b main && git add -A && git commit -m "<you>@<name>"
gh repo create <you>/ttheme-<name> --public --source . --push
gh repo edit <you>/ttheme-<name> --add-topic ttheme-marketplace
```

`ttheme share <palette>` prints a link — `https://ttheme.vercel.app/p/tt2:…` —
and, in a terminal, its QR code. The link carries the colors and the numbers of
its background posts with their framing, so nothing is uploaded: the page it
opens draws the palette in a terminal, lists the posts, and gives the
`ttheme add` command, and its preview image for chat apps is drawn in the palette's colors.
`ttheme add <link>` (or the bare `tt2:…` code at its end) installs it anywhere
without a marketplace, fetching those posts from the booru the way `find` does.

## Usage

| Command | |
|---|---|
| `ttheme` | Preview and Browse as tabs of one screen — `tab` and `shift+tab` switch. Preview tries palettes live: the tab repaints as the cursor moves, enter applies it to this tab or makes it the default. Browse picks palettes and marketplaces in one list: a marketplace's row takes `delete`, `shift+←/→` for its auto-update and `ctrl+r` |
| `ttheme use <palette>` | Paint this tab (a unique prefix works) |
| `ttheme default <palette>` | The palette new tabs open with |
| `ttheme pin` / `unpin` | A palette for this directory, everything below it, its repository or an ssh host (`ssh:<host>`) — a panel shows what each choice reaches; `cd` or `ssh` in repaints, leaving restores |
| `ttheme pins` | Map every pin as a file tree — the pinned directories in each palette's colors, with where you are marked, and every pinned ssh host |
| `ttheme marketplace add <owner/repo>` | Add someone's marketplace (`#v1` pins it) — `ttheme marketplace` lists yours; `search`, `remove` too |
| `ttheme new <name>` | Make a palette of your own in the palette editor (`--from <palette>` starts from its colors); `edit`, `check`, `share` follow |
| `ttheme on` / `off` | Wear the default again / give the terminal its own colors back |
| `ttheme config` | Settings in `$EDITOR` |

`ttheme help` lists every command by task; `ttheme help all` adds their
options and examples. Preview's keys and the mouse, directory pins,
rotating new tabs and every setting are in [docs/usage.md](docs/usage.md).

## Terminal support

| | Ghostty | iTerm2 | kitty | Alacritty | WezTerm | Windows Terminal | Warp | Konsole | Terminal.app |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Setup with `init`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Runtime repaint** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Background pictures** | ✅ | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | ✅ |

Nothing is emulated — a terminal that cannot express something does not get it.
Any other terminal that speaks OSC 4/10/11 gets runtime repainting. A default
set, a palette added or a picture tuned in one terminal reaches every other one
you wired. Why each cell is what it is: [docs/terminals.md](docs/terminals.md).
An editor such as Neovim keeps its own colorscheme inside its window — how the
two share the screen, and how to let Neovim wear the palette instead:
[docs/terminals.md#editors](docs/terminals.md#editors).

## Background pictures

A palette can wear a picture behind the text. ttheme ships none: in `ttheme`,
`tab` on a palette opens its panel, and `f` there searches danbooru, konachan, yande.re and zerochan for the character live
(safe-rated by default), or takes a picture you paste or drop, cuts the
character out on macOS, tints it to the palette — or keeps its own colors — and
installs it on your machine only. Ghostty shows the focused tab's picture, iTerm2, Konsole and Terminal.app one per tab, kitty one per
window, WezTerm the active tab's per window, Warp the tab in front's, through its one app-wide theme. See [docs/backgrounds.md](docs/backgrounds.md).

## Contributing

A palette is one TOML file of color values and post numbers — never images.
Your own go in your own marketplace, with no review; the official catalog takes pull
requests, and [CONTRIBUTING.md](CONTRIBUTING.md) has its rules, the file format
and the checks a palette must pass.

## Credits

Base ANSI ramps come from
[mbadolato/iTerm2-Color-Schemes](https://github.com/mbadolato/iTerm2-Color-Schemes)
(MIT), whose notice keeps each individual scheme's copyright with its own
author. Two palettes are sourced directly instead: `miku` from
[vauxe/hatsune-miku-theme](https://github.com/vauxe/hatsune-miku-theme) (MIT)
and `magi` from [lotap/magi-theme](https://github.com/lotap/magi-theme) (MIT).
Every palette records its input in `meta.ansi_source`, and only that input's
hues survive: the harmonizer normalizes lightness and saturation away and
rotates each non-signature hue toward the palette's own seed, so no scheme is
reproduced here.

JPEG pictures are decoded by [mozjpeg](https://github.com/mozilla/mozjpeg),
compiled to WebAssembly and packaged as
[@jsquash/jpeg](https://github.com/jamsinclair/jSquash) (Apache-2.0), which the
npm package carries inside `bin/ttheme.js`. This software is based in part on
the work of the Independent JPEG Group.

Palettes are inspired by characters from the listed works; this project is
unaffiliated with and unendorsed by their rights holders. No character art,
audio or trademarked asset is redistributed here — only color values.
Terminal background images are downloaded from the booru you pick only when you
ask `find` for one, built on your own machine and written to
`~/.config/ttheme/backgrounds/`; none ship in this repository or on npm.

Characters' names in every language — what preview, browse, `list` and
`find`'s search box match besides the palette names — come from the weekly
release of [aninames](https://github.com/kecan0406/aninames), which your machine
downloads into `~/.cache/ttheme/aninames/` (about 7 MB, checked once a day in
the background; `TTHEME_NAMES=off` in `ttheme config` leaves them as they are).
It is built from Wikidata (CC0), anime-offline-database and VNDB (ODbL),
Korean Wikipedia (CC BY-SA 4.0), and AniDB's titles, Bangumi, Anissia and
Danbooru, which state no license; none of it ships on npm.

Every background picture belongs to the artist who drew it. ttheme never passes
one on: a palette or a share code names a booru post by its number, and each
machine fetches it from that booru itself. `find` names who drew each post and
links the artwork's own page, the post and the artist's own pages — pixiv, X and
Bluesky, and Fanbox, Skeb, Patreon or Fantia where they take support. An
installed picture keeps them all, preview's image edit names the artist over the
picture with the same links, and a share link's page names them too. The
pictures are for your own terminal — when you show one off, `y` in preview's
image edit copies a line that credits the artist and links the artwork's page,
not the booru's copy.

## License

[MIT](LICENSE)
