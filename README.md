# ttheme

Character terminal palettes — every new tab takes the next one.

One hundred and eight palettes drawn from Vocaloid, Evangelion, Madoka Magica,
Steins;Gate, Lucky☆Star, Bocchi the Rock!, Monogatari, Sailor Moon, Serial
Experiments Lain, VA-11 Hall-A, Persona 5, Undertale, Call of the Night,
Higurashi, Doki Doki Literature Club, Umineko, K-On!, Cyberpunk: Edgerunners,
Touhou Project, Chuunibyou and Jujutsu Kaisen, built for **Ghostty, kitty, Alacritty,
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
| Jujutsu Kaisen — 呪術廻戦 | `gojo` `yuji` `megumi` `nobara` `nanami` `geto` `sukuna` |
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

It asks which terminals to wire and which series to install — `space` marks
one, enter moves on, and `select all` takes the lot — then shows what it is
about to change and writes it all at once, so cancelling before that touches
nothing. It places the zsh layer under `~/.config/ttheme` and edits your
terminal config and `~/.zshrc` between `# ttheme begin` / `# ttheme end`
markers — everything outside the markers is left alone. It ends with a receipt,
paints the first palette onto the tab you ran it in and lists what to do next
(`exec zsh` for the `ttheme` command here, a terminal restart for new tabs).
Running it again updates in place; `--yes` skips every prompt and installs no
palettes — `ttheme browse` opens the full catalog any time, to add or drop
single palettes.

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
build` writes the same tree to `dist/`, `mise run sandbox` tries it in a
throwaway home, and `mise run bin:build && node bin/ttheme.js init` installs
it for real.

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

ttheme browse   pick palettes from the catalog in a live picker
ttheme list     the catalog, ● installed and ○ not (a query filters it)
ttheme add      install palettes from the catalog
ttheme remove   uninstall palettes
ttheme update   refresh the catalog from the registry
```

In `preview`, series and palettes are listed by name (`TTHEME_SORT=series`
keeps the order they were added), groups start folded with the cursor on the
current palette;
`↑`/`↓` move (the tab repaints as the focus lands on a palette), `←`/`→` fold
and unfold (so do enter and space on a series), page up/down and home/end
jump, typing filters by substring and underlines the match (ctrl-u clears it),
enter applies, and esc steps back — first out of the filter, then out of the
preview with the original colors restored. Each palette row carries its 16
colors, normal over bright. The last line lists only the keys that work right
there, names the mode when it is not plain browsing (`FILTER`, `TUNE`, `CONFIG`,
`APPLY`, `KEYS`) and pins where esc goes to the right; `?` shows all of them.
alt-c opens the settings below in place — `↑`/`↓` pick one, `←`/`→` change it
(the sort and the search hint animation change live), enter writes the changed
lines to `config.zsh`, esc puts every value back. From 76
columns on, a sample session sits against the right edge of the window — the
16 colors, a prompt, git and test output, a selection — in the palette under
the cursor. The list and the sample widen with the window (the sample up to 64
columns) and the gap between them takes the rest; the tuning panel takes the
sample's place while open, and so does the key list once the sample is 48
columns wide.
Under Ghostty with `TTHEME_TAB_PALETTE=off`, enter asks **this tab** or
**default**: default records the palette as your startup palette (so a later
`add` or `remove` keeps it), rewrites `theme =` in the `# ttheme begin` block of
your Ghostty config and sends `SIGUSR2` to the Ghostty that owns the tab, so new tabs — and open tabs you have not
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

A palette with no background yet can find one: on it in `preview`, tab opens
**find**, which searches a booru for the palette's character tag
(`meta.booru`) and lays the results out as a grid of thumbnails. It starts on
safebooru; `p` moves to yande.re, then konachan, then back — the three share
one tag vocabulary, so the same tag works on each. The site you are on sits in
a colored badge at the top right, and again at the start of the line above a
picture you try on, next to the site the artwork itself came from when the post
records one (`pixiv.net`, `deviantart.com`). The grid starts
with **cutouts** — posts carrying the site's transparency tags
(`transparent_background` or `vector_trace` on safebooru, `transparent_png` on
yande.re, `transparent` or `vector` on konachan) whose PNG header says they have
an alpha channel; yande.re's `transparent_png` already means exactly that, so
its posts skip the header check, which its slow file server would drag out —
and the counter reads shown out of checked, `13/33`. Pictures by the uploader of the backgrounds you already have
in the same series come first and carry `≈`, so a series keeps one hand;
anything under 1600 px on its long edge shows its size in yellow. Enter tries
the picture on: ttheme downloads the original and paints the whole window with
it the way the installed background will look — tinted with the palette,
cropped with headroom above the face, at the opacity the contrast gate allows —
over a sample of shell output, with the share of transparent pixels next to its
size (`opaque` when there are none). `←`/`→` try the neighbours, enter installs,
and the preview carries on straight into the tuning panel below. Tab switches to
every post of the character, esc goes back. Only `safe` and `general` posts are
ever shown — yande.re and konachan are always asked for `rating:s`, whatever
else is searched — and downloads stay in `~/.cache/ttheme/<site>/`. ttheme keeps no
list of images — the tag is all it knows about a character.

An install writes `<palette>.png` (the tinted figure), `<palette>@fill-<focus>.png`
(the window-shaped crop), `<palette>.conf` and the untouched original under
`backgrounds/originals/`, and removes any earlier tuning of that palette. The
conf opens with where the picture came from —
`# from yande.re 214705 https://yande.re/post/show/214705` — and the tuning
panel shows it next to the palette's name.

`preview` shows the background of the palette under the cursor while you
browse: through the kitty graphics protocol it draws that palette's
`background-image` where Ghostty would place it, faded by
`background-image-opacity`, behind the list — or just its plain background when
it has no file. Only PNG images preview.

On a palette with a background, tab opens a panel that tunes it in place:
`↑`/`↓` pick size, position or opacity, and `←`/`→` change it (with shift, ten
steps at a time). Size walks 1% at a time, shown large in the middle of the
screen as it changes: 100% is the whole image fitted into the window
(`contain`), below that it shrinks to 20%, above it the image grows around the
face until it covers the window, and the top step is **fill** (`cover`). Fill
uses `<palette>@fill-<focus>.png` when it sits beside the image — a crop made
to fill the window, whose name carries the height of the face in percent, which
the sizes above 100% zoom around — and the image itself otherwise. Position
steps through the nine `background-image-position` anchors, or `1`–`9` jump to
one in reading order; opacity moves by 0.01. Space turns the palette's
background off and on, `=` returns it to its defaults, enter keeps the change
and esc puts back what the panel opened with. `f` in the panel opens find again
to replace the picture.

The palette's `.conf` holds those defaults; the preview only appends two
optional includes to it and keeps everything else in `<palette>.tune.conf` (the
tuning) and `<palette>.off.conf` (the off switch), which Ghostty loads after
the conf. Kept changes are written when the preview closes, by whichever key, and
Ghostty reloads when that palette is the default. Ghostty has no scale setting,
so every size but 100% and fill is baked into a copy beside the image and the
tuning points at it: below 100% onto a transparent canvas of the image's own
size (`kagami@60-bottom-right.png`, fitted with `contain`), above it onto one of
the window's size at the time (`kagami@130-center-2880x1800.png`, with
`cover`). Baking runs `sips`, so those sizes are offered on macOS only.

The preview draws inside the cell grid, and Ghostty's `window-padding` around
it keeps showing the configured background. While the cursor rests on the
configured palette and nothing has been tuned, the preview draws nothing and
lets that background show through whole. Once Ghostty supports kitty's relative
placements (merged after 1.3.1), the preview notices when it opens and hangs
its layers out over the padding instead, so every palette reaches the window
edge.

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

Settings live in `~/.config/ttheme/config.zsh` — `init` seeds it with the
defaults and never overwrites a line you changed, `ttheme config` opens it in `$EDITOR` and alt-c in `preview` edits it in place. Each line is a plain zsh
`: ${VAR:=value}` assignment, so a variable exported before the layer loads
still wins:

| Setting | Default | |
|---|---|---|
| `TTHEME_TAB_PALETTE` | `seq` | `off` keeps new tabs on the terminal's configured theme (`preview` → default changes it) |
| `TTHEME_ANNOUNCE` | `1` | `0` silences the one-line notice under "Last login:" |
| `TTHEME_FX` | `typewriter` | search hint animation — `typewriter`, `decode` or `glitch` |
| `TTHEME_SORT` | `abc` | `series` lists series and palettes in the order they were added instead of by name — in `ttheme`, `preview` and, once exported, the `init` picker |

## The catalog

The catalog is not installed wholesale: `init` installs the series you pick, and
`init --yes` none at all. `ttheme browse` opens the catalog as a live picker —
groups fold and unfold, typing filters (a query has no spaces, `space` is the
pick key), the tab repaints as the cursor lands on a palette, `space` marks one
(a series from its header, everything shown from `select all`), and enter
installs exactly what is marked and removes what is not:

```
◆ catalog (4/107 · 2 picked)
│ ⌕ bo_
│   ○ select all (4)
│ ▾ Bocchi the Rock! (2/4) ぼっち・ざ・ろっく!
│   ▶ ● bocchi        ● ▁▁▁▁▁▁  Sakura + Kessoku
│     ● kita          ● ▁▁▁▁▁▁  Wild Cherry + Kessoku
│     ○ nijika        ● ▁▁▁▁▁▁  Medallion
│     ○ ryo           ● ▁▁▁▁▁▁  TokyoNight Storm
└ ↑↓ move · ←→ fold · space pick · type to filter · enter install · esc cancel
```

The counts stay honest: `4/107` is what the filter matched out of the catalog,
`2 picked` is the install set, and `(2/4)` on the series header is how many of
its shown palettes are in it. The dot and the bar are the palette's real cursor
and its ANSI colors.

The same four verbs work without the picker:

```sh
ttheme list jujutsu     # what the catalog has, and what you already installed
ttheme add gojo geto    # two more, written into your terminal configs
ttheme remove kyubey    # and one fewer
ttheme update           # new palettes, without an npm release
```

`browse`, `add` and `remove` rewrite `palettes.zsh`, each wired terminal's
`themes/` directory and the `theme =` line in its config, then the shell re-reads
them — the change is live in the tab you ran it in. The first palette you install
becomes the one new windows open with.

`update` refetches the catalog from the registry; every palette in it has already
passed the contrast gate in CI, and `add` checks the numbers again before it
writes anything.

Installed palettes are listed in `~/.config/ttheme/installed.json`, and the
catalog is cached in `~/.config/ttheme/catalog.json`.

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

One file — copy any of `themes/*.toml`. `CONTRIBUTING.md` has the rules for
sending one back; the short version is that this repository takes **color values
only and never images**:

```toml
[meta]
name = "madoka"                            # must match the filename
group = "Madoka Magica"                    # needs a [[group]] in themes/_groups.toml
order = 15                                 # position in the rotation
ansi_source = "Elegant + Magica"           # what the harmonizer was fed
booru = "kaname_madoka"                    # safebooru character tag find searches
signature = ["cursor", "ansi1", "ansi3"]   # the three slots the site draws as identity

[colors]
background = "#201516"
foreground = "#fbdbdd"
cursor = "#ffc1c6"
selection_background = "#553444"
ansi = [ ... 16 colors ... ]
```

The series title and its `native` reading live once in `themes/_groups.toml`,
never in a theme file. `[font]` and `[ghostty]` are inherited from
`themes/_defaults.toml` unless the theme overrides them. Then:

```sh
mise run build                # regenerates dist/ for all five terminals — fails on bad contrast
mise run build --only kitty   # just one terminal's subtree
mise run test
```

All one hundred and eight currently pass unwaived — `kyubey` runs tightest at
4.28:1 where accents need 3:1: it is the one light palette, so every accent has
to darken enough to hold against a near-white background. If a palette genuinely
has to break a rule, waive it by name and say why; a waiver without a reason
fails the test suite.

```toml
[contrast]
waive = ["foreground"]     # foreground | accents | ansi0-dark | light-ansi | ansi8-visible
reason = "why this palette is the exception"
```

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
reproduced here. Shaders come from
[sahaj-b/ghostty-cursor-shaders](https://github.com/sahaj-b/ghostty-cursor-shaders)
(MIT), see `ghostty/shaders/`.

Palettes are inspired by characters from the listed works; this project is
unaffiliated with and unendorsed by their rights holders. No character art,
audio or trademarked asset is redistributed here — only color values.
Terminal background images are downloaded from the booru you pick only when you
ask `find` for one, built on your own machine and written to
`~/.config/ttheme/backgrounds/`; none ship in this repository or on npm.
