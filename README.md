<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="https://index.ttheme.dev/readme/banner-light.png">
    <img src="https://index.ttheme.dev/readme/banner-dark.png" alt="ttheme" width="640">
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
  <a href="https://ttheme.dev/browse">Browse</a> ·
  <a href="https://ttheme.dev/docs/reference/terminals">Terminals</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <img src="docs/demo.gif" alt="ttheme: typing nichi filters to the Nichijou palettes, the tab shows each one as the cursor lands on it, then rei is picked and kept" width="860">
</p>

ttheme gives your terminal the colors of a character you love. Every tab can
show its own palette, and every built-in palette passes contrast checks, so your
text stays easy to read.

## Quick start

```sh
npx @kecan0406/ttheme@latest init
```

With Bun, `bunx @kecan0406/ttheme@latest init` does the same, and `ttheme update`
then updates through bunx. `init` asks which terminals to wire and which palettes
to install, shows every file it will change, and writes nothing until you
confirm. ttheme requires Node.js `>=22` and zsh, which macOS ships, with bunx
too. From bash or fish, `ttheme` works too.

Then load the command and try palettes on:

```sh
exec zsh   # the ttheme command in this tab
ttheme     # the tab shows each palette the cursor lands on; enter keeps one
```

ttheme adds one line to each config it wires and sets colors only.
`npx @kecan0406/ttheme@latest uninstall` takes it all back out
([what changed](https://ttheme.dev/docs/guide/use#what-init-changes)).

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

`ttheme help` lists the everyday commands and `ttheme help all` every one.

## Docs

- [Quick start](https://ttheme.dev/docs/guide/quickstart): install, load the
  command and pick a palette.
- [Use ttheme](https://ttheme.dev/docs/guide/use): tabs, pins, light and dark,
  marketplaces and pictures, what `init` changes and how to undo it, and fixes
  when something goes wrong.
- [Make a palette](https://ttheme.dev/docs/guide/make): the editor, the contrast
  checks every built-in palette passes, share links and publishing a
  marketplace.
- [Terminal support](https://ttheme.dev/docs/reference/terminals): Ghostty,
  iTerm2, kitty, Alacritty, WezTerm, Windows Terminal, Warp, Konsole,
  Terminal.app, Rio and Contour, and what each can show.

## Contributing

The built-in palettes and the commons (the shared list of works and characters)
take pull requests. [CONTRIBUTING.md](CONTRIBUTING.md) has their rules,
[HACKING.md](HACKING.md) says how the code is put together, and the docs are
Markdown in [`docs/`](docs).

## Credits

Base ANSI ramps come from
[mbadolato/iTerm2-Color-Schemes](https://github.com/mbadolato/iTerm2-Color-Schemes)
(MIT), whose notice keeps each scheme's copyright with its own author. Two
palettes start from a theme of their own: `miku` from
[vauxe/hatsune-miku-theme](https://github.com/vauxe/hatsune-miku-theme) (MIT)
and `magi` from [lotap/magi-theme](https://github.com/lotap/magi-theme) (MIT).
Only a base scheme's hues survive, turned toward the palette's own, so no scheme
is reproduced here.

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
