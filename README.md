# ttheme

Character terminal palettes — every new tab takes the next one.

One hundred and one palettes drawn from Vocaloid, Evangelion, Madoka Magica,
Steins;Gate, Lucky☆Star, Bocchi the Rock!, Monogatari, Sailor Moon, Serial
Experiments Lain, VA-11 Hall-A, Persona 5, Undertale, Call of the Night,
Higurashi, Doki Doki Literature Club, Umineko, K-On!, Cyberpunk: Edgerunners,
Touhou Project, Chuunibyou and Eternal Return, built for **Ghostty, kitty, Alacritty,
WezTerm and iTerm2**, plus a zsh layer that rotates through them as you open tabs.

Two things separate this from the usual color-scheme dump:

- **Every palette passes an accessibility gate.** Body text at 7:1 against the
  background (WCAG AAA), every meaningful ANSI color at 3:1. The build fails if a
  palette regresses, so "it looked cute in the screenshot" cannot ship.
- **Colors switch at runtime, not just at startup.** Tabs get different palettes
  in the same window, and any tab can be repainted at any time.

## Palettes

| Group | Palettes |
|---|---|
| Vocaloid | `miku` `kumori` `rin` `len` `luka` `kaito` `meiko` |
| Evangelion — エヴァンゲリオン | `asuka` `rei` `kaworu` `misato` `eva01` `magi` |
| Madoka Magica — 魔法少女まどか☆マギカ | `madoka` `homura` `sayaka` `kyoko` `mami` `nagisa` `kyubey` |
| Steins;Gate — シュタインズ・ゲート | `kurisu` `mayuri` `suzuha` |
| Lucky☆Star — らき☆すた | `konata` `kagami` `tsukasa` `miyuki` |
| Bocchi the Rock! — ぼっち・ざ・ろっく! | `bocchi` `nijika` `ryo` `kita` |
| Monogatari — 〈物語〉シリーズ | `hitagi` `shinobu` `tsubasa` `nadeko` |
| Sailor Moon — 美少女戦士セーラームーン | `moon` `mercury` `mars` `jupiter` `venus` |
| Lain — serial experiments lain | `lain` |
| VA-11 Hall-A — Cyberpunk Bartender Action | `jill` `dorothy` `alma` `stella` `sei` `valhalla` |
| Persona 5 — ペルソナ5 | `joker` `skull` `panther` `fox` `queen` `oracle` `velvet` |
| Undertale | `toriel` `sans` `papyrus` `undyne` `mettaton` `determination` |
| Call of the Night — よふかしのうた | `nazuna` `kou` `seri` `anko` `yofukashi` |
| Higurashi — ひぐらしのなく頃に | `rena` `mion` `rika` `satoko` `hinamizawa` |
| Doki Doki Literature Club | `sayori` `natsuki` `yuri` `monika` `glitch` |
| Umineko — うみねこのなく頃に | `battler` `beatrice` `bernkastel` `lambdadelta` `rokkenjima` |
| K-On! — けいおん! | `yui` `ritsu` `mio` `mugi` `azusa` |
| Cyberpunk: Edgerunners — サイバーパンク エッジランナーズ | `david` `lucy` `rebecca` `nightcity` |
| Touhou Project — 東方Project | `reimu` `marisa` `cirno` `youmu` `patchouli` `flandre` |
| Chuunibyou — 中二病でも恋がしたい! | `rikka` `yuuta` `shinka` `dekomori` `kumin` |
| Eternal Return — 이터널 리턴 | `bihyung` |
| — | `neutral` (default) |

`neutral` sits out of the rotation and the listings — it is the pre-shell
default, still applyable as `ttheme neutral`.

Backgrounds and cursors are hand-tuned; the 16 ANSI colors are borrowed from
established themes (Nvim Dark, Nightfox, Oxocarbon, Selenized, Monokai Pro,
Duotone, Gruvbox, Rose Pine, TokyoNight, Everforest, IR Black…) or from
published character themes, picked to match each character's
tones while passing the contrast gate. Each palette records where its ANSI set
came from — `ttheme` prints it, and it is in the theme's TOML.

## Install

**Ghostty, kitty or Alacritty** — one command, no clone:

```sh
npx @kecan0406/ttheme@latest init
```

It detects your terminal, asks which ones to wire, places the palettes and the
zsh layer under `~/.config/ttheme`, and edits your terminal config and `~/.zshrc`
between `# ttheme begin` / `# ttheme end` markers — everything outside the
markers is left alone. Running it again updates in place; `--yes` skips every
prompt and takes the defaults.

**WezTerm and iTerm2** — one archive per terminal in the
[latest release](https://github.com/kecan0406/ttheme/releases/latest):

```sh
REL=https://github.com/kecan0406/ttheme/releases/latest/download

# kitty
curl -L $REL/ttheme-kitty.tar.gz | tar xz
cp kitty/themes/miku.conf ~/.config/kitty/themes/
#   kitty.conf:  include themes/miku.conf

# alacritty
curl -L $REL/ttheme-alacritty.tar.gz | tar xz
cp alacritty/themes/miku.toml ~/.config/alacritty/themes/
#   alacritty.toml:  [general]
#                    import = ["~/.config/alacritty/themes/miku.toml"]

# wezterm
curl -L $REL/ttheme-wezterm.tar.gz | tar xz
cp wezterm/colors/miku.toml ~/.config/wezterm/colors/
#   wezterm.lua:  config.color_scheme = "miku"

# iTerm2 — import the .itermcolors under Settings > Profiles > Colors
curl -L $REL/ttheme-iterm2.tar.gz | tar xz
```

Each archive also carries a `config/` file per theme with that theme's font —
separate so you can take the colors without the rest. Ghostty is laid out
differently: the dock-icon colors travel inside each theme file (they derive
from the palette), and the font + shader — identical across themes — ship as
one shared `ttheme.conf` you include once with `config-file`.

Building from a checkout works too: `mise install && bun install && mise run
build` writes the same tree to `dist/`, and `bun src/bin.ts init --link`
symlinks the checkout into place so palette edits land live.

## Use

```
ttheme          list every palette, grouped, with previews
ttheme homura   pin this tab      (a unique prefix works: ttheme ho)
ttheme preview  browse live — focus repaints the tab, enter keeps it (this tab or default)
ttheme next     advance this tab to the next palette
ttheme pin      pick a palette for this directory — cd into it repaints, cd out restores
ttheme unpin    drop the palette pinned to this directory
ttheme config   edit settings in $EDITOR — they apply in new tabs
ttheme help     the list above, in your terminal
```

In `preview`, groups start folded with the cursor on the current palette;
`↑`/`↓` move (the tab repaints as the focus lands on a palette), `←`/`→` and
space fold and unfold, page up/down and home/end jump, typing filters by
substring (ctrl-u clears it), enter applies, and esc steps back — first out
of the filter, then out of the preview with the original colors restored.
Under Ghostty with `TTHEME_TAB_PALETTE=off`, enter asks **this tab** or
**default**: default rewrites `theme =` in the `# ttheme begin` block of your
Ghostty config and sends `SIGUSR2`, so new tabs — and open tabs you have not
painted by hand — take the palette without a restart. Painting is per surface
otherwise: a new tab starts from the configured theme, not from what the last
tab was painted.

A palette can also bring a Ghostty background image. The block `init` writes
includes `~/.config/ttheme/backgrounds/<palette>.conf` for the configured
theme with an optional `config-file = ?…`, and choosing **default** points that
include at the new palette — so whatever Ghostty settings you put in that file
follow the default, and palettes without one show no image:

```
# ~/.config/ttheme/backgrounds/kagami.conf
background-image = ~/.config/ttheme/backgrounds/kagami.png
background-image-fit = cover
background-image-opacity = 0.2
```

ttheme ships no images; they stay on your machine. A background is Ghostty
config, not an escape sequence, so it follows the default for every window
rather than the palette painted on one tab.

`preview` shows the background of the palette under the cursor while you
browse: through the kitty graphics protocol it draws that palette's
`background-image` where Ghostty would place it, faded by
`background-image-opacity`, behind the list — or just its plain background when
it has no file. Only PNG images preview.

The row above the key hints tunes that background in place. `[`/`]` walk the
size 1% at a time, shown large in the middle of the screen as it changes: 100%
is the whole image fitted into the window (`contain`), below that it shrinks to
20%, above it the image grows around the face until it covers the window, and
the top step is **fill** (`cover`). Fill uses `<palette>@fill-<focus>.png` when
it sits beside the image — a crop made to fill the window, whose name carries
the height of the face in percent, which the sizes above 100% zoom around — and
the image itself otherwise. `{`/`}` step through the nine
`background-image-position` anchors, `<`/`>` move the opacity by 0.01, space
turns the palette's background off and on, and `=` returns it to its defaults.

The palette's `.conf` holds those defaults; the preview only appends two
optional includes to it and keeps everything else in `<palette>.tune.conf` (the
tuning) and `<palette>.off.conf` (the off switch), which Ghostty loads after
the conf. Both are written when the preview closes, by whichever key, and
Ghostty reloads when that palette is the default. Ghostty has no scale setting,
so every size but 100% and fill is baked into a copy beside the image and the
tuning points at it: below 100% onto a transparent canvas of the image's own
size (`kagami@60-bottom-right.png`, fitted with `contain`), above it onto one of
the window's size at the time (`kagami@130-center-2880x1800.png`, with
`cover`). Baking runs `sips`, so those sizes are offered on macOS only.

The preview draws inside the cell grid, and Ghostty's `window-padding` around
it keeps showing the configured background. While the cursor rests on the
configured palette and nothing has been tuned, the preview draws nothing and
lets that background show through whole.

`pin` opens the same browser and, on enter, asks **this directory** or **and
below**; the answer lands in `~/.config/ttheme/pins`, one `path  palette` per
line, where `path/**` covers everything below it (`~` works, and the file is
yours to edit). From then on a tab that `cd`s into a pinned path takes its
palette — symlinks resolve to the pinned directory — and `cd`ing out restores
what the tab had before, unless you painted it by hand in between, in which
case your pick stays. The nearest pinned ancestor wins, so a project can pin
one palette and a subfolder another. Open tabs pick up a changed pins file on
their next `cd`; `unpin` drops the pin on the current directory.

`preview`, `next`, `pin`, `unpin`, `config` and `help` match exactly; every other first argument is read
as a palette name, where a unique prefix is enough. Mistyped names get a "did
you mean" suggestion instead of a wall of output. Piped output drops color and
turns tab-separated, and `NO_COLOR` is respected.

New tabs take the next palette in group order, with the counter shared across
tabs — so opening four tabs walks you through four different characters rather
than rolling the same one twice.

Settings live in `~/.config/ttheme/config.zsh` — `init` seeds it from your
answers and `ttheme config` opens it in `$EDITOR`. Each line is a plain zsh
`: ${VAR:=value}` assignment, so a variable exported before the layer loads
still wins:

| Setting | Default | |
|---|---|---|
| `TTHEME_TAB_PALETTE` | `seq` | `off` keeps new tabs on the terminal's configured theme (`preview` → default changes it) |
| `TTHEME_ANNOUNCE` | `1` | `0` silences the one-line notice under "Last login:" |
| `TTHEME_FX` | `typewriter` | search hint animation — `typewriter`, `decode` or `glitch` |

## What each terminal can actually do

Nothing is emulated — a terminal that cannot express something simply does not
get it.

| | palette file | runtime switching | font | shader |
|---|---|---|---|---|
| **Ghostty** | ✅ | ✅ native adapter | ✅ incl. per-codepoint map | ✅ |
| **kitty** | ✅ | ✅ native adapter | family + size | ✗ |
| **WezTerm** | ✅ | OSC — per window, never per pane | family + size | ✗ |
| **Alacritty** | ✅ | OSC only (no runtime color API exists) | family + size | ✗ |
| **iTerm2** | ✅ | OSC, minus the cursor (it ignores OSC 12) | profile-only | ✗ |
| anything else | — | OSC, if it speaks it | — | ✗ |

Ghostty is the only terminal here with GLSL shaders, and the only one with
per-codepoint font mapping — which is why the Hangul→D2Coding rule survives only
in its build.

## Adding a palette

One file — copy any of `themes/*.toml`:

```toml
[meta]
name = "homura"        # must match the filename
group = "Madoka Magica"
native = "魔法少女まどか☆マギカ"   # optional, shown dim after the group
order = 8              # position in the rotation
ansi_source = "Monokai Pro Machine + Magica"

[colors]
background = "#1b1428"
foreground = "#f2fffc"
cursor = "#8b5cf6"
selection_background = "#322447"
ansi = [ ... 16 colors ... ]
```

`[font]` and `[ghostty]` are inherited from `themes/_defaults.toml` unless the
theme overrides them. Then:

```sh
mise run build                # regenerates dist/ for all five terminals — fails on bad contrast
mise run build --only kitty   # just one terminal's subtree
mise run test
```

All ninety-six currently pass unwaived — `magi` comes closest at 7.09:1, since
amber on pure black is the whole point of the NERV CRT look. If a palette
genuinely has to break a rule, waive it by name and say why; a waiver without a
reason fails the test suite.

```toml
[contrast]
waive = ["foreground"]     # foreground | accents | ansi0-dark | light-ansi | ansi8-visible
reason = "why this palette is the exception"
```

## Credits

ANSI sets are adapted from published themes, credited per palette in
`meta.ansi_source`. Shaders come from
[sahaj-b/ghostty-cursor-shaders](https://github.com/sahaj-b/ghostty-cursor-shaders)
(MIT), see `ghostty/shaders/`.

Palettes are inspired by characters from the listed works; this project is
unaffiliated with and unendorsed by their rights holders. No character art,
audio or trademarked asset is redistributed here — only color values.
