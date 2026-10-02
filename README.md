<h1 align="center">ttheme</h1>

<p align="center"><em>Character terminal palettes — readable by rule, switched live, one tab at a time.</em></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@kecan0406/ttheme"><img src="https://img.shields.io/npm/v/@kecan0406/ttheme?style=flat-square" alt="npm version"></a>
  <a href="https://github.com/kecan0406/ttheme/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/kecan0406/ttheme/ci.yml?branch=main&style=flat-square&label=ci" alt="CI status"></a>
  <a href="https://kecan0406.github.io/ttheme/"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fkecan0406.github.io%2Fttheme%2Fmanifest.json&query=%24.palettes.length&label=palettes&style=flat-square&color=c796c8" alt="palettes in the catalog"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/@kecan0406/ttheme?style=flat-square" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://kecan0406.github.io/ttheme/">Site</a> ·
  <a href="#palettes">Palettes</a> ·
  <a href="docs/usage.md">Usage</a> ·
  <a href="docs/terminals.md">Terminals</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <img src="docs/demo.gif" alt="ttheme preview: typing nichi filters to the Nichijou palettes, each one repaints the tab as the cursor lands on it, then rei is picked and applied" width="860">
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

It asks which terminals to wire and which series to install, shows every file it
is about to change, and writes nothing until you confirm. Then:

```sh
exec zsh               # the ttheme command in this tab
ttheme                 # preview and browse as tabs — tab switches
```

<details>
<summary><b>What init changes</b></summary>

- Your terminal config and `~/.zshrc` get a block between `# ttheme begin` /
  `# ttheme end`; everything outside it is left alone, and what goes in is
  colors only — no font, font size or shader.
- Each file is backed up once to `<file>.ttheme.bak` before the first edit, and
  written through symlinks, so a dotfiles repo keeps its links.
- A key you set yourself stays yours, and every file ttheme adds to a terminal's
  folders is named `ttheme-<palette>`.
- `npx @kecan0406/ttheme@latest uninstall` lists and then reverses all of it.

Per-terminal details, manual install from the release archives and building from
a checkout are in [docs/install.md](docs/install.md).

</details>

## Palettes

<p align="center">
  <a href="https://kecan0406.github.io/ttheme/"><img src="https://kecan0406.github.io/ttheme/readme/series.svg" alt="One card per series, drawn in its lead palette" width="856"></a>
</p>

<details>
<summary><b>Every palette</b></summary>
<br>
<img src="https://kecan0406.github.io/ttheme/readme/palettes.svg" alt="Every palette in the catalog, grouped by series" width="856">
</details>

Both images are drawn from the live catalog, so they always match what
`ttheme browse` offers. `init` installs the series you pick; `ttheme browse`
adds or drops single palettes any time, and a merged palette reaches everyone
within a day of using ttheme — or at once through `ttheme update` — without
waiting for a release.

### Markets

Anyone can publish palettes from a GitHub repository. A market is named
`<owner>@<name>` — its repository's owner and the name its index gives — and
sits below the series in `ttheme preview` and `ttheme browse`, past a line, with
the folders under its `palettes/` as catalogs:

```
▾ Evangelion
    rei
    asuka
── Markets ──────────
▾ alice@pastel
  ▾ night
      dusk
      moon
  ▸ day
```

```sh
ttheme add dusk --market alice/ttheme-pastel  # add alice's market and install from it
ttheme market add alice/ttheme-pastel#v1      # or add it alone, pinned to a tag
ttheme browse                                 # shift+→ to Markets: add, remove, auto-update
```

`ttheme browse` handles markets the way it handles palettes: its Markets tab
adds one by repository or folder, finds the public ones on GitHub, marks one for
removal and switches its auto-update, and enter applies all of it with the
palettes you picked. The official catalog updates on its own once a day as you
use ttheme; a repository asks when you add it. Nobody reviews a market. Its
palettes are colors and post numbers, never code, and the contrast gate's
numbers are shown for them but never enforced — only the official catalog is
held to the gate. `ttheme update` refreshes every market now; `ttheme market
remove alice@pastel` drops one, and the palettes you installed from it keep
working. The official catalog is a market too (`official`). [The markets
page](https://kecan0406.github.io/ttheme/market) lists the public ones.

### Your own palettes

`ttheme new rei` opens the palette editor on a blank palette: a few seeds grow
twenty colors that pass the contrast gate, then each one is tuned in OKLCH while
the terminal repaints as you go. It makes `<you>@<market>/rei`, named after your
GitHub handle and a market name the first `new` asks for, in
`~/.config/ttheme/market/<market>`, and installs it; `--from rei` starts from
rei's colors instead. `ttheme edit rei` opens the same editor, and `ttheme check
--fix` suggests colors that pass the gate.

A local market is already a repository layout: `palettes/*.toml` (a folder
under it, such as `palettes/night/`, is a catalog), the
`ttheme-market.json` index and a workflow that rebuilds the index on every
push. `ttheme market init <name>` makes one and prints the commands that
publish it:

```sh
cd ~/.config/ttheme/market/<name>
git init -b main && git add -A && git commit -m "<you>@<name>"
gh repo create <you>/ttheme-<name> --public --source . --push
gh repo edit <you>/ttheme-<name> --add-topic ttheme-market
```

`ttheme share <palette>` prints a code — `tt1:…`, about 200 characters — that
carries the colors and the numbers of its background posts with their framing.
`ttheme add tt1:…` installs it anywhere without a market, fetching those posts
from the booru the way `find` does.

## Usage

| Command | |
|---|---|
| `ttheme` | Preview and browse as tabs of one screen — `tab` and `shift+tab` switch |
| `ttheme preview` | Browse live — the tab repaints as the cursor moves, enter applies it to this tab or makes it the default |
| `ttheme use <palette>` | Paint this tab (a unique prefix works) |
| `ttheme next` | Advance this tab to the next palette |
| `ttheme default <palette>` | The palette new tabs open with |
| `ttheme pin` / `unpin` | A palette for this directory, everything below it, its repository or an ssh host (`ssh:<host>`) — a panel shows what each choice reaches; `cd` or `ssh` in repaints, leaving restores |
| `ttheme pins` | Map every pinned directory as a tree, in each palette's colors, with where you are marked, and every pinned ssh host |
| `ttheme browse` | Pick palettes and markets — `shift+←/→` moves between Catalog, Installed, Markets and Errors |
| `ttheme market add <owner/repo>` | Add someone's market (`#v1` pins it) — `ttheme market` lists yours; `search`, `remove` too |
| `ttheme new <name>` | Make a palette of your own in the palette editor (`--from <palette>` starts from its colors); `edit`, `check`, `share` follow |
| `ttheme on` / `off` | Wear the default again / give the terminal its own colors back |
| `ttheme config` | Settings in `$EDITOR` |

`ttheme help` shows the three to start with and the rest by task; `ttheme help
all` lists every command. Preview's keys, directory pins, rotating new
tabs and every setting are in [docs/usage.md](docs/usage.md).

## Terminal support

| | Ghostty | iTerm2 | kitty | Alacritty | WezTerm | Windows Terminal | Warp | Konsole | Terminal.app |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Setup with `init`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| **Runtime repaint** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Background pictures** | ✅ | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | — |

Nothing is emulated — a terminal that cannot express something does not get it.
Any other terminal that speaks OSC 4/10/11 gets runtime repainting. A default
set, a palette added or a picture tuned in one terminal reaches every other one
you wired. Why each cell is what it is: [docs/terminals.md](docs/terminals.md).
An editor such as Neovim keeps its own colorscheme inside its window — how the
two share the screen, and how to let Neovim wear the palette instead:
[docs/terminals.md#editors](docs/terminals.md#editors).

## Background pictures

A palette can wear a picture behind the text. ttheme ships none: `ttheme
preview` → enter, then `f` in the picture panel searches danbooru, konachan, yande.re and zerochan for the character live
(safe-rated by default), or takes a picture you paste or drop, cuts the
character out on macOS, tints it to the palette — or keeps its own colors — and
installs it on your machine only. Ghostty shows the focused tab's picture, iTerm2 and Konsole one per tab, kitty one per
window, WezTerm the active tab's per window, Warp the tab in front's, through its one app-wide theme. See [docs/backgrounds.md](docs/backgrounds.md).

## Contributing

A palette is one TOML file of color values and post numbers — never images.
Your own go in your own market, with no review; the official catalog takes pull
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

Every background picture belongs to the artist who drew it. ttheme never passes
one on: a palette or a share code names a booru post by its number, and each
machine fetches it from that booru itself. `find` names who drew each post and
links the post and the artwork's own page, an installed picture keeps its
artist and source, and preview's image edit names the artist over the picture. The
pictures are for your own terminal — when you show one off, credit the artist
and link the artwork's page, not the booru's copy.

## License

[MIT](LICENSE)
