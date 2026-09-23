# ttheme

Character terminal palettes — every new tab takes the next one.

One hundred and eight palettes drawn from Vocaloid, Evangelion, Madoka Magica,
Steins;Gate, Lucky☆Star, Bocchi the Rock!, Monogatari, Sailor Moon, Serial
Experiments Lain, VA-11 Hall-A, Persona 5, Undertale, Call of the Night,
Higurashi, Doki Doki Literature Club, Umineko, K-On!, Cyberpunk: Edgerunners,
Touhou Project, Chuunibyou and Jujutsu Kaisen, built for **Ghostty, kitty, Alacritty,
WezTerm and iTerm2**, plus a zsh layer that repaints tabs at runtime — one palette everywhere, or
the next one on every new tab.

Two things separate this from the usual color-scheme dump:

- **Every palette passes an accessibility gate.** Body text at 7:1 against the
  background (WCAG AAA), every meaningful ANSI color at 3:1. The build fails if a
  palette regresses, so "it looked cute in the screenshot" cannot ship.
- **Colors switch at runtime, not just at startup.** Tabs get different palettes
  in the same window, and any tab can be repainted at any time.

## Terminal support

Nothing is emulated — a terminal that cannot express something simply does not
get it.

| Feature | Ghostty | iTerm2 | kitty | Alacritty | WezTerm | Windows Terminal | Warp | Terminal.app | Other |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Setup with `init`** | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![No][no] | ![No][no] |
| **Palette files** | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![No][no] | ![No][no] |
| **Runtime repaint** | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![Done][done] | ![No][no] | ![Done][done] | ![Partial][partial] |
| **Font** | ![Done][done] | ![No][no] | ![Done][done] | ![Done][done] | ![Done][done] | ![No][no] | ![No][no] | ![No][no] | ![No][no] |
| **Shader** | ![Done][done] | ![No][no] | ![No][no] | ![No][no] | ![No][no] | ![No][no] | ![No][no] | ![No][no] | ![No][no] |
| **Background pictures** | ![Done][done] | ![Done][done] | ![Done][done] | ![No][no] | ![Partial][partial] | ![No][no] | ![No][no] | ![No][no] | ![No][no] |

- **Setup with `init`** — iTerm2 is offered on macOS only, Windows Terminal
  from WSL (or a native Windows zsh), where init writes a settings fragment on
  the Windows side. Warp gets its themes, and the default palette through its
  `settings.toml` (the Warp builds that have one).
- **Palette files** — iTerm2 gets one dynamic profile per palette, plus
  `.itermcolors` in the archive; Windows Terminal gets one fragment carrying
  every installed scheme.
- **Runtime repaint** — OSC escape sequences everywhere, per pane in kitty,
  WezTerm and Windows Terminal, one color per sequence (Alacritty drops an OSC 4
  carrying more than seven). kitty and Windows Terminal reset every OSC color
  when their config reloads, so a changed default would undo the palettes open
  tabs wear: kitty's watcher puts each window's palette back as the reload ends,
  and a Windows Terminal tab repaints itself at its next prompt or focus.
  Terminal.app takes every OSC color but no OSC reset, so ttheme reads its
  colors when the shell starts and puts them back itself. Warp answers OSC
  color queries but paints one theme app-wide and never the background an OSC
  sets, so the shell layer stays off there and `ttheme <palette>` points you at
  `ttheme default <palette>`, which puts the palette on every Warp window; any other terminal that speaks OSC 4/10/11 (foot, Konsole,
  VTE-based terminals…) gets repainting and nothing else.
- **Font** — family and size everywhere it is marked; Ghostty also maps
  codepoints to fonts. iTerm2 keeps the font of your own profile, Windows
  Terminal and Warp the one you set in them.
- **Background pictures** — `find`, `ttheme image` and `preview`'s live
  backdrop. Ghostty shows one picture app-wide, following the focused tab;
  iTerm2 (3.7 or newer) shows one per tab and kitty one per window (a split
  pane included), both with the same preview, tuning and find. WezTerm shows the
  picture of the active tab per window and switches it as `preview` moves, but
  has no in-terminal preview or tuning — find and tune from Ghostty, iTerm2 or
  kitty. Alacritty has no graphics at all. Cut-outs and baked crops need macOS.

[done]: https://img.shields.io/badge/Done-2ea44f?style=flat-square
[partial]: https://img.shields.io/badge/Partial-e3b341?style=flat-square
[no]: https://img.shields.io/badge/Not%20supported-d0d7de?style=flat-square

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

**Ghostty, kitty, Alacritty, WezTerm, iTerm2, Windows Terminal or Warp** — one command, no clone:

```sh
npx @kecan0406/ttheme@latest init
```

It asks which terminals to wire and which series to install — `space` marks
one, enter moves on, and `select all` takes the lot — and how the terminal
should wear them: `default` (preselected) puts one palette on every tab,
`rotate` gives every new tab the next palette, `keep` leaves your terminal colors
alone and only installs. Then it shows what it is about to change and writes it all at once,
so cancelling before that touches nothing. It places the zsh layer under
`~/.config/ttheme` and edits your terminal config and `~/.zshrc` between
`# ttheme begin` / `# ttheme end` markers — everything outside the markers is
left alone. iTerm2 has no config file to edit, so it gets one profile per
installed palette instead — `ttheme · miku` and so on, in
`~/Library/Application Support/iTerm2/DynamicProfiles/ttheme.json`, which
iTerm2 reloads by itself whenever `ttheme browse` adds or drops one. One more,
`ttheme · default`, always wears your default palette (none under `keep`), and
init makes it iTerm2's default profile, so new tabs and windows open wearing the
palette and its picture from their first frame and follow `ttheme default` from
then on. iTerm2 reads its default profile only when it starts, so quit and
reopen it once after init. The profile it replaces stays the parent of every
ttheme profile, so your font and keys carry over, and `keep` gives it back.
WezTerm's config is Lua, so init puts a two-line block that runs
`~/.config/ttheme/wezterm.lua` just before your config's `return config` (or
writes a small `wezterm.lua` when there is none); WezTerm reloads it by itself.
Windows Terminal gets a fragment,
`%LOCALAPPDATA%\Microsoft\Windows Terminal\Fragments\ttheme\ttheme.json`,
with every installed scheme and the default palette on the profile init ran in —
`settings.json` is never edited, only touched so the terminal reloads. Warp gets
a theme per palette, `~/.warp/themes/ttheme-<palette>.yaml`, and the default
palette as the one `theme` key of `[appearance.themes]` in `~/.warp/settings.toml`
— Warp applies it within a few seconds, and `keep` puts back the theme you had.
It ends with a receipt, paints the first palette onto the tab you
ran it in (not under `keep`) and lists what to do next (`exec zsh` for the
`ttheme` command here, a terminal restart for new tabs).
Running it again updates in place; `--yes` skips every prompt and installs no
palettes — `ttheme browse` opens the full catalog any time, to add or drop
single palettes.

**Any of them by hand** — one archive per terminal in the
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

# iTerm2 — open a .itermcolors to add it to Settings > Profiles > Colors presets
curl -L $REL/ttheme-iterm2.tar.gz | tar xz

# windows terminal — every scheme in one fragment
curl -L $REL/ttheme-windows-terminal.tar.gz | tar xz
#   copy windows-terminal/ttheme.json into
#   %LOCALAPPDATA%\Microsoft\Windows Terminal\Fragments\ttheme\

# warp
curl -L $REL/ttheme-warp.tar.gz | tar xz
cp warp/themes/ttheme-miku.yaml ~/.warp/themes/
```

The kitty, Alacritty and WezTerm archives also carry a `config/` file per theme
with that theme's font — separate so you can take the colors without the rest. Ghostty is laid out
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
ttheme homura   paint this tab    (a unique prefix works: ttheme ho)
ttheme preview  browse live — focus repaints the tab, enter keeps it (this tab or default)
ttheme next     advance this tab to the next palette
ttheme default  make a palette the one new tabs open with
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
Under Ghostty or iTerm2 with `TTHEME_TAB_PALETTE=off` (the default), enter asks **this tab** or
**default**: default records the palette as your default palette (so a later
`add` or `remove` keeps it), rewrites `theme =` in the `# ttheme begin` block of
your Ghostty config and sends `SIGUSR2` to the Ghostty that owns the tab, and
rewrites iTerm2's `ttheme · default` profile, which iTerm2 reloads by itself — so new tabs, and open tabs you have not
painted by hand, take the palette without a restart. Painting is per surface
otherwise: a new tab starts from the configured theme, not from what the last
tab was painted.

A palette can also bring a Ghostty background image. The block `init` writes
includes `~/.config/ttheme/backgrounds/shown.conf` with an optional
`config-file = ?…`, and that one line names the palette whose picture is up.
Putting a palette on — `ttheme <name>`, enter in `preview`, `ttheme next`,
`ttheme default`, cd into a pinned directory — rewrites the line and sends
`SIGUSR2`, so whatever Ghostty settings you put in `<palette>.conf` arrive with
the palette, and palettes without a file show no image:

```
# ~/.config/ttheme/backgrounds/kagami.conf
background-image = ~/.config/ttheme/backgrounds/kagami.png
background-image-fit = cover
background-image-opacity = 0.2
```

ttheme ships no images; they stay on your machine. A background is Ghostty
config, not an escape sequence, and Ghostty keeps one background for the whole
app, so one picture is up at a time, in every window. Moving to another tab
brings its own: while a tab sits at its prompt it asks for focus events, and
taking focus puts that tab's picture up — or clears it, when its palette has
none. A tab busy with a command catches up at its next prompt, focus reporting
is off while that command runs, and a tab whose colors are not a ttheme palette
leaves the picture where it is.

iTerm2 keeps a picture per tab. There the picture lives in the palette's own
profile — `ttheme · kagami` carries the file, its opacity as Blend and cover or
contain as the image mode, rewritten whenever the picture or its tuning
changes — and putting a palette with a picture on, or taking one off, moves the
tab to that palette's profile with `OSC 1337 SetProfile`. The first time,
iTerm2 asks at the top of the tab whether a control sequence may change the
profile: Always Allow lets every later switch through — put the palette on once
more for the one that asked — and a tab it refuses still wears the palette's
colors, only without the picture. iTerm2 has no
position setting, so a tuned picture that is not centered is baked onto a canvas
the size of the window, as the sizes above 100% are.

A palette with no background yet can find one: on it in `preview`, tab opens
**find**, which searches a booru for the palette's character tag
(`meta.booru`) and lays the results out as a grid of thumbnails. It starts on
danbooru; tab moves to konachan, then yande.re, then back — they share one tag
vocabulary, so the same tag works on each. danbooru and yande.re carry every
rating and `TTHEME_FIND_RATING` picks which come through; konachan is
`konachan.net`, the mirror that carries safe posts only, since `konachan.com`
answers with a Cloudflare challenge. When a site's connection is cut off — the
way a network that blocks boorus by name drops danbooru — find asks whether to
turn on the unblock proxy (`TTHEME_FIND_UNBLOCK`); `y` saves the setting and
opens find again through it, `n` leaves it off. The
sites sit in a strip of tabs under the query, the one you are on lit in its own
color, and it comes again as a badge at the start of the line above a picture
you try on, next to the site the artwork itself came from when the post records
one (`pixiv.net`, `deviantart.com`). The grid starts
with every post of the character; `c` narrows it to **cutouts** — posts carrying
the site's transparency tags (`transparent_background` on danbooru,
`transparent` or `vector` on konachan, `transparent_png` on yande.re) whose PNG header says they have
an alpha channel; yande.re's `transparent_png` already means exactly that, so
its posts skip the header check, which its slow file server would drag out —
and the counter reads shown out of checked, `13/33`. find checks only as far as
the grid reaches and checks more as you scroll; each answer is remembered, so
coming back to a site or a palette never asks its file server again, and a site
you have already seen comes back the moment you tab to it. Newer series carry
few of those tags, so `TTHEME_FIND_CUTOUTS` names the ones to look for, site by
site.

Under each thumbnail is its post id and size, and under that whoever made it:
the artist, which every site names through its tag types at no extra
request, and the uploader as `@name` where a post has no artist tag. A score follows as
`★22` on the sites that keep one. When the same hand uploads the same picture at
the same size over and over, find folds that run into one tile marked `×9`,
wherever the order puts its pictures, and folds in the same way a picture
another site holds too — re-encoded at the same shape, cut from the post its
source names, or hung under the same parent; space unfolds it and folds it
again. Pictures by the uploader of the backgrounds
you already have in the same series come first and carry `≈`, so a series keeps
one hand; anything under 1600 px on its long edge shows its size in yellow.

`s` opens the settings — the ratings to list, the nudity and underwear tags to
block, cutouts or all, newest or score, and whether runs fold — with ↑↓ on the
setting, enter to save them to `config.zsh` and esc to put them back. ←→ change
a value; on the two rows of checkboxes (rating and block) they move between the
boxes and space ticks one, so `safe` and `explicit` can be listed without
`questionable`, or underwear let through while nudity stays blocked. At least
one rating stays ticked. Whatever is not the default shows next to the query, so
the screen never hides what it is filtering by.

`/` opens the query for editing — type a tag to search for something else, or paste a post url or id
(`https://yande.re/post/show/214705`, `konachan:244200`, `7159377`) to go
straight to that one picture. While you type, danbooru's tag completion lists
up to eight tags that start like the last word, each with its post count — the
way to find a costume variant such as `amane_suzuha_(beta)` or a tag you only
half remember; `↑`/`↓` pick one and enter searches it. A palette with no `meta.booru` tag at all opens
find on that empty query, so it can have a background too. `o` opens the post's
page in a browser.

Enter tries the picture on: ttheme downloads the original and paints the whole
window with it the way the installed background will look — tinted with the
palette, cropped with headroom above the face, at the opacity the contrast gate
allows — over a sample of shell output, with the share of transparent pixels
next to its size (`opaque` when there are none). On macOS an opaque picture is
cut out first: ttheme asks the system's own Vision framework (macOS 14 or newer,
through `osascript` — nothing is installed or uploaded) for the character alone,
marks the picture `cut out`, and `x` switches between the cut-out and the picture
as it is. When Vision finds no character, or would leave almost nothing or
remove almost nothing, the picture stays opaque; elsewhere it always does. A post over 25 megapixels is
fetched as the site's own smaller copy instead — up to 3500 px on yande.re and
konachan, 850 px on danbooru — and its size carries `↓`; those
copies are JPEGs, so a cutout tried on that way comes out opaque. `←`/`→` try
the neighbours, which find fetches ahead of you two at a time, and enter installs
and returns to the grid with the tile marked `✓`, the tab, search and scroll as
you left them; esc then hands the last one installed to the preview, which
carries on straight into the tuning panel below. `c` switches
between every post and the cutouts, esc goes back. Unless the settings say otherwise,
only `safe` and `general` posts are shown, and none tagged with nudity or
underwear (`nude`, `panties` and each site's own spelling of them) — with only
`safe` ticked yande.re and konachan are asked for `rating:s`, whatever else is
searched; ticking more ratings or unticking a block in the `s` panel widen it. danbooru takes only two tags from a
signed-out search, so on it a cutout search leaves the score order out and says
so. Thumbnails and header checks stay in
`~/.cache/ttheme/<site>/`; the pictures you try on last only while find is open.
When a site asks ttheme to slow down, find waits as long as it names, up to a
minute, with a countdown at the bottom. ttheme keeps no
list of images — the tag is all it knows about a character.

An install writes `<palette>.<hash>.png` (the tinted figure),
`<palette>.<hash>@fill-<focus>.png` (the picture made at the shape of the window
find ran in: a cut-out stands whole from its head down against the right edge, a
little taller than the window, and a wallpaper covers it from its top) — the hash is of
their content, because Ghostty and iTerm2 reload a background only when its path
changes, so no two pictures may share a name — `<palette>.conf` and the untouched original under
`backgrounds/originals/`, and starts it untuned — the picture it replaces moves
to the shelf with the tuning it had. The
conf opens with where the picture came from —
`# from yande.re 214705 https://yande.re/post/show/214705` — and the tuning
panel shows it next to the palette's name.

`preview` shows the background of the palette under the cursor while you
browse: through the kitty graphics protocol (Ghostty, kitty, and iTerm2 3.7 or newer)
it draws that palette's `background-image` where Ghostty would place it, faded by
`background-image-opacity`, behind the list — or just its plain background when
it has no file. Only PNG images preview.

On a palette with a background, tab opens a panel that tunes it in place:
`↑`/`↓` pick size, position or opacity, and `←`/`→` change it (with shift, ten
steps at a time). Size walks 1% at a time, shown large in the middle of the
screen as it changes: 100% is the whole image fitted into the window
(`contain`), below that it shrinks to 20%, above it the image grows around the
face until it covers the window, and the top step is **fill** (`cover`). Fill
uses `<palette>.<hash>@fill-<focus>.png` when it sits beside the image — a crop made
to fill the window, whose name carries the height of the figure at the window's middle, which
the sizes above 100% zoom around — and the image itself otherwise. Position
steps through the nine `background-image-position` anchors, or `1`–`9` jump to
one in reading order; opacity moves by 0.01. Space turns the palette's
background off and on, `=` returns it to its defaults, enter keeps the change
and esc puts back what the panel opened with. `f` in the panel opens find again
to replace the picture.

A palette holds every picture installed on it: an install shelves the one on
screen rather than dropping it, `,` and `.` walk the saved pictures, and `D`
removes the one shown. Each picture carries its own settings — size, position,
opacity, the off switch and the baked crops travel with it under
`backgrounds/shelf/<palette>/<post>/`, so walking back to a picture puts it
back the way you left it, and tuning you have not confirmed is written to the
picture before `,` or `.` moves off it.

The palette's `.conf` holds those defaults; the preview only appends two
optional includes to it and keeps everything else in `<palette>.tune.conf` (the
tuning) and `<palette>.off.conf` (the off switch), which Ghostty loads after
the conf. Kept changes are written when the preview closes, by whichever key,
and reach both terminals from whichever one ran the preview: Ghostty reloads
when it is showing that palette, and iTerm2's profiles are rewritten. Ghostty has no scale setting,
so every size but 100% and fill is baked into a copy beside the image and the
tuning points at it: below 100% onto a transparent canvas of the image's own
size (`kagami.1a2b3c4d@60-bottom-right.png`, fitted with `contain`), above it onto
one of the window's size at the time (`kagami.1a2b3c4d@130-center-2880x1800.png`,
with `cover`). With iTerm2 wired, a size of 100% or less that is not centered
goes onto the window-sized canvas too, since iTerm2 cannot place an image.
Baking runs `sips`, so those sizes are offered on macOS only.

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

`preview`, `next`, `default`, `pin`, `unpin`, `config` and `help` match exactly; every other first argument is read
as a palette name, where a unique prefix is enough. Mistyped names get a "did
you mean" suggestion instead of a wall of output. Piped output drops color and
turns tab-separated, and `NO_COLOR` is respected.

With `TTHEME_TAB_PALETTE=seq`, new tabs take the next palette in group order, with the counter shared across
tabs — so opening four tabs walks you through four different characters rather
than rolling the same one twice.

Settings live in `~/.config/ttheme/config.zsh` — `init` seeds it with every
setting at its default on a commented line, so a default a later version changes
reaches you, and never overwrites a line you changed — bar `TTHEME_TAB_PALETTE`, which its
default/rotate/keep question sets — `ttheme config` opens it in `$EDITOR` and alt-c in `preview` edits it in place. Only a value that differs from the default
is left uncommented; setting one back comments it out again. Each line is a plain zsh
`: ${VAR:=value}` assignment, so a variable exported before the layer loads
still wins:

| Setting | Default | |
|---|---|---|
| `TTHEME_TAB_PALETTE` | `off` | `off` keeps new tabs on the terminal's configured theme (`preview` → default changes it); `seq` gives every new tab the next palette. `init` writes `seq` for rotate and `off` for default and keep |
| `TTHEME_ANNOUNCE` | `1` | `0` silences the one-line notice under "Last login:" |
| `TTHEME_FX` | `typewriter` | search hint animation — `typewriter`, `decode` or `glitch` |
| `TTHEME_SORT` | `abc` | `series` lists series and palettes in the order they were added instead of by name — in `ttheme`, `preview` and, once exported, the `init` picker |
| `TTHEME_FIND_RATING` | `safe` | the ratings `find` lists, any of `safe`, `questionable` and `explicit` separated by spaces (`"safe explicit"`). Each site is read in its own vocabulary, so danbooru's `s` (sensitive) is not mistaken for yande.re's `s` (safe). The set shows next to the query whenever it is not just `safe` |
| `TTHEME_FIND_BLOCK` | `nudity underwear` | the posts `find` drops by tag: `nudity` (`nude`, `naked`, `topless`…), `underwear` (`panties`, `bra`, `lingerie`… — each with the site's own spelling), both, or `none` to keep every post. What is let through shows next to the query as `allows …` |
| `TTHEME_FIND_POSTS` | `all` | what `find` opens on — every post of the character, or only the transparent cutouts (`cutouts`) |
| `TTHEME_FIND_CUTOUTS` | — | the tags `find` calls a transparent cutout, as `key=tag,tag` pairs separated by spaces, keyed by `danbooru`, `konachan` or `yande` (`konachan=transparent,vector yande=transparent_png`). A site with several tags matches any of them; `danbooru=` names none, so its cutouts are the posts whose PNG header has an alpha channel. A site named here loses yande.re's shortcut of skipping that header check. Sites left out keep the built-in tags |
| `TTHEME_FIND_SOLO` | `on` | `on` keeps only the posts tagged `solo` — the character alone, which is what a backdrop needs. konachan and yande.re do not tag how many people a picture shows, so their posts borrow the tags danbooru holds for the same file, one request per page; a post danbooru does not have is left alone. The query line says `solo` while it is on |
| `TTHEME_FIND_ORDER` | `fit` | the order `find` lists posts in — `fit` ranks each page it fetches by how well a post makes a backdrop (solo, resolution against the window, a cutout or an aspect close to the window's, score within the page, the palette's colors in its preview; comics, monochrome, sketches and landscapes sink) and appends it below what is already shown, so nothing moves under you; `newest`; or `score` |
| `TTHEME_FIND_SETS` | `fold` | a run of the same picture at the same size from one uploader, and a picture another site holds too: `fold` shows it as one tile marked `×N`, `show` lists every one |
| `TTHEME_FIND_REMOVE_BG` | `on` | on macOS, `on` cuts the character out of an opaque picture `find` tries on, with the system's Vision framework; `off` leaves it as it is. The row is in the `s` panel as `remove bg` |
| `TTHEME_FIND_UNBLOCK` | `0` | find offers to turn it on when a site's connection is cut off. `1` sends `find`'s requests to danbooru through a proxy it runs on `127.0.0.1`, which splits the TLS handshake across two records so a network that blocks it by hostname cannot read the name; konachan and yande.re, which no network is known to block, still go direct. It is not a VPN: the address you reach is unchanged and nothing else on the machine is affected. Needs node 22.21 or newer, and the query line says `unblock` while it is on |
| `TTHEME_FIND_HOSTS` | — | send a `find` site somewhere else, as `key=https://host` pairs (`danbooru=https://safebooru.donmai.us`, the general-rated mirror, reachable where danbooru is blocked). The tab keeps its name and carries `*` |

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

## Terminal notes

Ghostty is the only terminal here with GLSL shaders, and the only one with
per-codepoint font mapping — which is why the Hangul→D2Coding rule survives only
in its build.

WezTerm keeps an OSC-set palette per pane, but a picture belongs to the window:
the Lua module ttheme runs follows the active pane's `ttheme_shown` user var,
which the shell layer sets whenever the tab's palette changes, and reads the
picture from `backgrounds/<palette>.conf` itself — so a picture installed or
tuned from Ghostty or iTerm2 reaches WezTerm within a second.

kitty gets a watcher, `~/.config/ttheme/kitty.py`, which the kitty block loads:
the shell layer tells it what a window wears and shows through user vars
(`ttheme_worn`, `ttheme_shown`, `ttheme_startup`), and it answers with the
window's logo — kitty's per-window picture, drawn above the default background
and below any cell with a background of its own, which does not scroll — read
from `backgrounds/<palette>.conf` itself, so a picture tuned in another terminal
shows the next time a kitty window takes focus. kitty 0.49 draws every logo at
the global `window_logo_alpha` and scales every logo by `window_logo_scale`, so
the block sets those to 1 and 100 and the watcher fades the picture's own alpha
to the tuned opacity instead. kitty reloads its config by itself whenever
`kitty.conf` or a file it includes changes, and a reload resets every color an
OSC set; the watcher wraps the reload and puts each window's palette back, and
`sync` writes a file only when its content changed, so installing palettes
reloads nothing. The watcher reaches kitty windows opened after `init`.

Alacritty reloads its config by itself and keeps OSC colors through a reload.
`sync` puts its import in the config's own `[general]` table when there is one —
TOML allows a table once — and leaves a config that already imports files
there alone, with a note.

iTerm2 reads the colors an OSC sets as Display P3 — its default color space — so
its profiles and `.itermcolors` files are written in P3 too: a tab opened on a
`ttheme · <palette>` profile and a tab repainted to that palette land on the
same colors, and ttheme recognizes the palette either way.

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
booru = "kaname_madoka"                    # booru character tag find searches
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
mise run build                # regenerates dist/ for every terminal — fails on bad contrast
mise run build --only kitty   # just one terminal's subtree
mise run test
mise run compat               # the terminal compatibility cases, in each installed terminal
```

`mise run compat` opens each installed terminal behind your windows on a
throwaway home (`mise run sandbox`), runs the cases in `tests/compat/cases.zsh`
inside it — adapter detection, OSC set/query/reset, what the window really
paints (read off a screenshot), `ttheme <palette>` and its restore, cell size,
kitty graphics, synchronized output and focus reporting — and compares them
with `tests/compat/expect.tsv`: a case that used to pass and fails is a
regression and fails the run, and `--update` records what was measured.

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
