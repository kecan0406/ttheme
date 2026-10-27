<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="https://kecan0406.github.io/ttheme/readme/banner-light.png">
    <img src="https://kecan0406.github.io/ttheme/readme/banner-dark.png" alt="ttheme" width="640">
  </picture>
</h1>

<p align="center"><em>Your favorite anime and game characters' colors in your terminal, one tab at a time.</em></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@kecan0406/ttheme"><img src="https://img.shields.io/npm/v/@kecan0406/ttheme?style=flat-square" alt="npm version"></a>
  <a href="https://github.com/kecan0406/ttheme/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/kecan0406/ttheme/ci.yml?branch=main&style=flat-square&label=ci" alt="CI status"></a>
  <a href="https://ttheme.dev/"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fcdn.jsdelivr.net%2Fnpm%2F%40kecan0406%2Fttheme%2Fdist%2Fbuiltin.json&query=%24.palettes.length&label=palettes&style=flat-square&color=c796c8" alt="built-in palettes"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/@kecan0406/ttheme?style=flat-square" alt="MIT license"></a>
  <a href="https://index.githits.dev/repositories/github.com/kecan0406/ttheme/"><img src="https://index.githits.dev/badge/repositories/github.com/kecan0406/ttheme/index-status.svg" alt="GitHits index status"></a>
</p>

<p align="center">
  <a href="https://ttheme.dev/">Site</a> ·
  <a href="https://ttheme.dev/docs">Docs</a> ·
  <a href="https://ttheme.dev/marketplace">Marketplace</a> ·
  <a href="https://ttheme.dev/docs/reference/terminals">Terminals</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <img src="docs/demo.gif" alt="ttheme: typing nichi filters to the Nichijou palettes, the tab shows each one as the cursor lands on it, then rei is picked and kept" width="860">
</p>

ttheme gives your terminal the colors of a character you love. Each
palette keeps the three colors that make its character recognizable, and every
built-in one passes contrast checks, so your text stays easy to read.

Every tab can show its own palette. Change one at any time, pin one to a
project folder, or let each new tab open on the next character.

## Quick start

```sh
npx @kecan0406/ttheme@latest init
```

`init` asks which terminals to wire and which palettes to install, shows every
file it will change, and writes nothing until you confirm. It needs Node 22 or
newer and zsh, which macOS ships. From bash or fish, `ttheme` works too.

Then load the command and try palettes on:

```sh
exec zsh   # the ttheme command in this tab
ttheme     # the tab shows each palette the cursor lands on; enter keeps one
```

ttheme adds one line to each config it wires and sets colors only.
`npx @kecan0406/ttheme@latest uninstall` takes it all back out
([what changed](https://ttheme.dev/docs/getting-started/what-changed)).

## What you can do

| To | Run |
|---|---|
| Try palettes on and keep one | `ttheme` |
| Use a palette in this tab | `ttheme use miku` |
| Set the palette new tabs open with | `ttheme default miku` |
| Give a folder or ssh host its own palette | `ttheme pin` |
| Show every palette in light, dark or your system's mode | `ttheme light` · `dark` · `auto` |
| Make a palette, or tune one | `ttheme new dusk` · `ttheme edit miku` |
| Share a palette as a link | `ttheme share dusk` |
| Give the terminal its own colors back, then ttheme's again | `ttheme off` · `on` |

`ttheme help` lists the everyday commands and `ttheme help all` every one. The
[docs](https://ttheme.dev/docs) cover the rest, from
[your first palette](https://ttheme.dev/docs/getting-started/first-palette) to
[troubleshooting](https://ttheme.dev/docs/getting-started/troubleshooting).

## Terminals

| | Ghostty | iTerm2 | kitty | Alacritty | WezTerm | Windows Terminal | Warp | Konsole | Terminal.app | Rio | Contour |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Setup with `init`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **A palette per tab** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Background pictures** | ✅ | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | ✅ | — | — |
| **Follows the system's appearance** | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — | — | ✅ |

Nothing is emulated: a terminal that cannot show something does not get it.
[Terminal support](https://ttheme.dev/docs/reference/terminals) says what each
one does.

## Readable by rule

Every built-in palette passes the contrast checks: body text at 7:1 against the
background (WCAG AAA), every meaningful ANSI color at 4.5:1 (WCAG AA). Red still
reads as an error and green as success, and the two stay apart for a
deuteranope. The build fails when a palette slips.
[Contrast checks](https://ttheme.dev/docs/reference/contrast-gate) explains each
threshold.

## More palettes

Browse, the second tab of `ttheme` (`shift+tab`), adds and removes palettes.
Anyone can publish their own from a GitHub repository, as a marketplace:

```sh
ttheme marketplace add alice/ttheme-pastel   # add alice's marketplace
ttheme add alice@pastel/dusk                 # install one of its palettes
```

A palette is a file of colors, never code. Nobody reviews a marketplace, and
only the built-in palettes are held to the contrast checks.
[The marketplace page](https://ttheme.dev/marketplace) lists the public ones.

## Your own palettes

```sh
ttheme new dusk     # the palette editor, on a blank palette
ttheme edit miku    # any palette; one that isn't yours keeps your changes as your tuning
ttheme share dusk   # a link that carries the palette
```

The editor grows twenty readable colors from a few seeds and shows them in a
mock terminal while you tune. The same builder runs at
[ttheme.dev/builder](https://ttheme.dev/builder). A coding agent with the
ttheme-palette skill makes one for a character you name: add it with
`npx skills add kecan0406/ttheme`, or let `init` add it.
[Your own palette](https://ttheme.dev/docs/creating-palettes/your-own) walks
through it.

## Background pictures

A palette can show its character behind your text. ttheme ships no pictures:
in `ttheme`, `tab` on a palette opens its panel, where `f` searches danbooru,
konachan, yande.re and zerochan (safe-rated by default) or takes a picture you
paste or drop. [Pictures](https://ttheme.dev/docs/usage/pictures) covers the
rest.

## Contributing

The built-in palettes and the commons (the shared list of works and characters)
take pull requests. [CONTRIBUTING.md](CONTRIBUTING.md) has their rules and the
checks a palette must pass, and [HACKING.md](HACKING.md) says how the code is
put together. The docs are Markdown in [`docs/`](docs).

## Credits

Base ANSI ramps come from
[mbadolato/iTerm2-Color-Schemes](https://github.com/mbadolato/iTerm2-Color-Schemes)
(MIT), whose notice keeps each scheme's copyright with its own author. Two
palettes start from a theme of their own: `miku` from
[vauxe/hatsune-miku-theme](https://github.com/vauxe/hatsune-miku-theme) (MIT)
and `magi` from [lotap/magi-theme](https://github.com/lotap/magi-theme) (MIT).
Each built-in palette names its source in `ansi_source`. Only that source's hues
survive, turned toward the palette's own, so no scheme is reproduced here.

JPEG pictures are decoded by [mozjpeg](https://github.com/mozilla/mozjpeg),
compiled to WebAssembly and packaged as
[@jsquash/jpeg](https://github.com/jamsinclair/jSquash) (Apache-2.0), which the
npm package carries inside `bin/ttheme.js`. This software is based in part on
the work of the Independent JPEG Group.

Palettes are inspired by characters from the works they name. This project is
unaffiliated with and unendorsed by their rights holders, and shares only color
values: no character art, audio or trademarked asset.

Every background picture belongs to the artist who drew it, and ttheme never
passes one on. A palette names a booru post, and your machine fetches it from
that booru when you pick it in `find`, or install or update a palette that lists
it. `find` names who drew each post and links their own pages, and `y` in the
panel copies a line that credits the artist, for when you show one off.

## License

[MIT](LICENSE)
