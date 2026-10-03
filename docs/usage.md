# Usage

## Commands

Three cover most days: `ttheme preview` tries every palette live and keeps the
one you land on, `ttheme browse` installs or drops palettes, and `ttheme use
<palette>` paints this tab. `ttheme` alone opens the first two as tabs of one
screen. `ttheme help` shows those and the rest by task; `ttheme help all` lists
every command with what it does:

```
This tab
  preview                                        Try palettes live — focus repaints, enter edits its tone and picture and applies it, esc restores, ? lists keys
  use <palette>                                  Paint this tab — a unique prefix works: ttheme use ho
  next                                           Advance this tab to the next palette
  pin [directory|ssh:<host>]                     Pick a palette for this directory, everything below it, its repository or an ssh host — cd or ssh in repaints, leaving restores
  unpin [directory|ssh:<host>]                   Drop a pin — this directory's, every one below it, the one above that paints it, or an ssh host's
  pins                                           Map every pinned directory as a tree in its palette's colors, every ssh host, and the pin that covers this one

New tabs
  default <palette>                              Make a palette the one new tabs open with
  on                                             Wear the default palette in new tabs again
  off                                            Take the palette and picture off every tab — the terminal's own colors until `ttheme on`
  config                                         Edit settings in $EDITOR — they apply in new tabs

Palettes
  browse                                         Pick palettes and markets in a live picker — shift+←/→ moves between Catalog, Installed, Markets and Errors
  list [--json] [query]                          Show the catalog, marking what is installed
  add [--market <source>] <palette...>           Install palettes from the catalog, or from a share code: ttheme add tt1:…
  remove <palette...>                            Uninstall palettes
  update                                         Refresh every market you added now — those with auto-update refresh on their own once a day
  market [action] [source]                       The markets you added — add, remove and search them; init makes one of your own

Your own
  new [--from <palette>] [--in <market>] <name>  Make a palette of your own, <you>@<market>/<name>, from blank in the palette editor — installed at once
  edit <palette>                                 Change one of your palettes in the palette editor — the contrast gate advises, never refuses
  check [--fix] <palette>                        Measure a palette against the contrast gate and suggest colors that pass
  share [--tone <tuned|original>] <palette>      Print a share code — ttheme add <code> installs it anywhere, pictures included

Setup
  init [--yes]                                   Install the shell layer and wire your terminal configs
  uninstall [--yes]                              Take ttheme out of every terminal config and delete what it wrote

Support
  info                                           Print what a bug report needs — version, OS, shell, terminal and the settings you changed
```

`ttheme <command> --help` (or `ttheme help <command>`) describes one command
without running it, and `ttheme --version` prints the version. A bug report
takes the output of `ttheme info` (`npx @kecan0406/ttheme@latest info` when
ttheme is not set up), and `TTHEME_DEBUG=1` in front of any command prints
where an error came from.

## The tabs

`ttheme` alone opens preview and browse as two tabs of one full screen, on
preview, with the tabs named in the top row. `tab` moves to the next tab and
`shift+tab` to the previous one — except on a palette in preview, where `tab`
opens its [panel](#palette-edit) and `shift+tab` is the way to browse. Both
screens filter as you type, so a letter is
never a command here: what they do besides typing sits on `tab`, the arrows,
`enter`, `space`, `esc` and `ctrl` or `alt` with a key ([the keys each screen
takes](../CONTRIBUTING.md#keys-a-screen-takes) are listed for anyone adding one).
Preview keeps its filter, its open series and its cursor while you are in
browse, and comes back repainted in the colors it was showing. A browse tab
starts fresh each time: with picks or market changes staged, `tab` asks
whether to apply them first — `y` applies and closes, `n` discards and moves
on, `esc` stays. Inside browse, its own four tabs move with `shift+←`/`shift+→`.

The two screens share their keys wherever they do the same thing: `←`/`→`
and `enter` open and close a series, `esc` clears the filter and, once it is
clear, closes the tabs from either screen, and `?` lists the keys. On a palette
`enter` does what it does on that screen: preview applies the palette it landed
on, browse applies its picks and closes. `ttheme preview` and `ttheme browse`
open one screen on its own, with no tab row; `ttheme pin` is preview alone as
well. Piped, `ttheme` prints the palettes, one per line, as name, series and
source separated by tabs.

## The mouse

Preview, browse, the palette editor and find take the mouse too, and every
click has a key that does the same. A click on a row moves the cursor there —
in preview the tab repaints, as with the arrows — and a double click does what
enter does: preview applies the palette, browse picks it, the editor tunes the
slot, find tries the picture on. The wheel moves the cursor a row (find's grid a
row of tiles, its try-on to the next picture), and the burst a terminal sends
for one notch counts once. The tabs, the market chips, a series' ▸, a palette's
○ and the keys named on the last line are buttons: they act when you let go
over them, so moving off first cancels. In the editor and in the panel beside a
palette, a click on the L, C, H or ◐ bar tunes that channel to the point and a
drag moves it, past either end of the bar too; the picture's size and opacity
bars and its nine positions work the same way.

While a screen has the mouse, the terminal selects text with a modifier: Shift
in most terminals, Option in iTerm2. find opens a post, its page or its source
when you click it (not over SSH, where the browser would open on the other
machine); anywhere else a link opens with the terminal's own gesture —
Shift-click in kitty, WezTerm and Alacritty, Shift+Cmd-click in Ghostty, Cmd-click
in iTerm2. `TTHEME_MOUSE=off` leaves the mouse to the terminal everywhere, and
alt-c in preview has it as `Mouse`. `init`'s picker, drawn under your prompt
rather than over the window, never takes the mouse, so the wheel keeps
scrolling the terminal.

## Preview

In `preview`, series and palettes are listed by name (`TTHEME_SORT=series`
keeps the order they were added), groups start folded with the cursor on the
current palette;
`↑`/`↓` move (the tab repaints as the focus lands on a palette) and wrap
around at either end, `←`/`→` fold and unfold (so do enter and space on a
series), page up/down jump a screen (from the last row to the first, and back)
and home/end to either end, typing filters and underlines the match (ctrl-u clears it) —
any text, Japanese included, against the palette, series and catalog names, each
series' Japanese title and the character's names in Japanese and as its booru tag
spells them, ignoring case and punctuation, so `ひとり` or `hitori` finds `bocchi`
and `らきすた` finds Lucky☆Star; a row that matched on one of those other names
shows it dimmed beside its own, and a Japanese input method composes in the
search field itself.
Enter [applies](#applying) the palette, and `tab`, `→` or `ctrl+e` moves into its
[palette and picture panel](#palette-edit) beside the list; esc steps back — out of the
panel, then out of the filter, then out of the preview with the original colors
restored. Each palette row carries its 16 colors, normal over bright. The last
line lists only the keys that work right there, always names the mode
(`PREVIEW`, `PREVIEW (FILTER)`, `PREVIEW (APPLY)`,
`PREVIEW (PIN)`, `EDIT`, `EDIT (TUNE)`, `EDIT (APPLY)`, `CONFIG`, `HELP`) and pins where
esc goes to the right; `?` shows all of them.
In Warp, which wears one theme for the whole app, the tab in front decides it:
preview switches that theme as the focus moves — every Warp window at once —
and so do `ttheme use`, `next` and a pin, while switching tabs or windows puts
on the palette of the one you switch to. Warp itself takes about 0.6 s to show
a change; with `TTHEME_WARP_FAST` on (the default) it takes about 0.2 s while
your tabs wear different palettes, and for 3 s after the tab in front changes
its own, so preview's second palette onwards shows that fast too.
alt-c opens the [settings](#settings) in place — `↑`/`↓` (or `j`/`k`) pick one, `←`/`→` change it
(the sort and the search hint animation change live), enter writes the changed
lines to `config.zsh`, esc puts every value back. From 76
columns on, a sample sits against the right edge of the window in the palette
under the cursor — the 16 colors over one of five scenes, a shell session, code,
a diff, logs and a process monitor, named in a strip above it; ⇧←→ switch
scenes, and find's try-on opens on the one preview showed. The list and the sample widen with the window (the sample up to 64
columns) and the gap between them takes the rest; the key list takes the
sample's place while open, once the sample is 48 columns wide.

## Palette edit

`tab`, `→` or `ctrl+e` on a palette in `preview` moves into a panel (**EDIT**)
that takes the sample's place beside the list: the palette's background
picture on top, its colors under it and an **Apply** button at the bottom, all
live — the tab is painted with the colors as you change them, and the picture
moves behind the text. It is one list, starting on the picture: `↓` past the
picture's last field goes on into the slots and past the last slot to Apply,
both ends wrap around, and `home`/`end` jump to the top and to Apply; `j`/`k`
work as `↓`/`↑` throughout. The picture half starts with **Images**, the
palette's pictures as thumbnails, where `←`/`→` pick one; a palette with none
shows an empty frame there, and `enter` on it opens
[find](backgrounds.md#finding-one), with the fields under it dimmed until a
picture arrives. While
you move through the slots the palette half shows the slots alone so
everything fits, with what the gate says against the slot under the cursor
when it misses; tuning one shows that slot alone in the same rows — its
lightness, chroma and hue bars and its checks — until enter or esc brings the
slots back, so nothing under it moves. A taller window keeps the slots and the
bars together, and a window too short for it all scrolls with the cursor. A window too narrow for
the sample gives the panel the whole screen.

The palette half is the palette editor `ttheme new` opens, without its seeds,
and takes the same keys:
every slot is shown in OKLCH — lightness, chroma, hue — with its hex beside the
one being tuned; `↑`/`↓` pick a slot, `←`/`→` switch between its normal and bright colors, `enter`
or `tab` tunes the slot in OKLCH — `↑`/`↓` pick lightness, chroma or hue, `←`/`→`
step, `enter` keeps it; chroma stops at the sRGB edge, and what lightness or
hue takes away while you tune comes back where it fits again, marked `○` on
the bar —
`#` types a color, `c` and `v` copy and paste one, `f` moves the colors the
contrast gate misses, `u` undoes and `space` shows the colors before. A slot off
its palette's own color carries `↺`: `r` puts the slot back and `R` all of them.
`✗` marks every slot whose own checks miss — a background too light carries
it along with the colors that read on it — and `n`/`N` walk them. While tuning,
`◐` is a fourth channel beside lightness, chroma and hue: `←`/`→` move the
slot's lightness until its contrast with the color it is read against (the
background, or the foreground for the background and the selection) changes,
`home` sets it to the gate's floor and `1`–`9` to that ratio; `a` widens what
moves — this slot, its pair, the six normal or bright accents, or all twelve —
and every slot in it moves by the same step, keeping its own color. `g` swaps the
slots for their relations: every ANSI color's lightness, normal over bright, the
gate's misses between them named under it.
The contrast gate advises here, never refuses. The picture half is the one
[Tuning](backgrounds.md#tuning) describes — the pictures, then colors, size,
position and opacity — with `f` to find one.

`s` saves, and nothing else does: what you changed is kept only from then on,
the tone as an override of the palette's own colors (`tone.json`, beside
`installed.json`, naming just the slots you moved, so the palette itself and
`kept.json` stay as the market gave them) and the picture as its own tuning.
`sync` lays the tone over the palette before it writes anything, so every
terminal's theme file, the zsh table and the pictures' tint follow it, and
`ttheme update` leaves it be. The picture behind follows the colors as you
change them — the background under it, its tint, and its opacity, which moves
with the palette as saving would set it unless you set it yourself — in
Ghostty, kitty, iTerm2, Konsole and WezTerm. Terminal.app and Warp show the
new tint once you save, and the picture's title line says `recolors on save`
until then. `esc` goes back to the list and drops
what you changed since the last save, without asking.

## Applying

`enter` on a palette in the list, or on its panel's Apply button — which saves
what you changed first, as `shift+enter` anywhere in the panel does in a
terminal that tells it from `enter`, such as Ghostty — applies it as it is on
screen and asks
where: **default** or **this tab**. Default records the palette as
your default palette (so a later `add` or `remove` keeps it) and hands it to
every terminal you wired, whichever one you are in, and this tab keeps it for
the tab alone; `←`/`→` move between them, starting on default. In `ttheme pin`
it asks how far the pin reaches instead (see [Directory pins](#directory-pins)),
and without the choice — `TTHEME_TAB_PALETTE=seq`, or a terminal init did not
wire — enter applies to this tab at once.

The question is asked with `TTHEME_TAB_PALETTE=off` (the default), in a
terminal init wired — and always in Ghostty and iTerm2. Default rewrites `theme =` in the `# ttheme begin` block of your Ghostty config and sends
`SIGUSR2` to the Ghostty that owns the tab, rewrites iTerm2's `ttheme · default`
profile, which iTerm2 reloads by itself, makes the palette's
`ttheme · <palette>` profile Konsole's default, which every running Konsole
takes over D-Bus, and Terminal.app's, which a running Terminal.app takes at the
next prompt one of its tabs shows — so new tabs, and open tabs you have not
painted by hand, take the palette without a restart. Painting is per surface otherwise: a new tab
starts from the configured theme, not from what the last tab was painted.

## Directory pins

`pin` opens the same browser, and enter on a palette — or in its panel — asks how far it reaches:

- **This directory** — the directory alone; `cd` into a folder below it and the
  tab takes back whatever covers that folder.
- **And below** — the directory and everything under it, except a folder that
  has a pin of its own.
- **Repository** — the whole git repository you are in, from its root down;
  offered when you are below the root (never for your home directory itself).

`←`/`→` move between them, starting on the reach the directory's pin already
has (**and below** for one without a pin), and the right-hand panel — above the
key bar in a narrow window — shows what the choice does before you confirm: the
pins around it as a tree, as they will be, the new one marked `new`, the pins
below that keep their own palette, the pin it replaces, and the palette this
directory will wear. `ttheme pin <directory>` pins another directory without
going there.

The answer lands in `~/.config/ttheme/pins`, one `path  palette` per line, where
`path/**` covers everything below it (`~` works, and the file is yours to edit).
From then on a tab that `cd`s into a pinned path takes its palette — symlinks
resolve to the pinned directory — and `cd`ing out restores what the tab had
before, unless you painted it by hand in between, in which case your pick stays.
The nearest pinned ancestor wins, so a project can pin one palette and a
subfolder another, and where a directory has both a pin of its own and one for
everything below, its own one wins there. Open tabs pick up a changed pins file
at their next prompt, and in a terminal that reports focus as soon as they come
to the front: a tab already in a directory you pin elsewhere repaints then, and
one under a pin you drop goes back to what it had before.

`unpin` works from wherever you are and offers what can go:

- **This directory** — the pin on this directory.
- **And below** — that and every pin further down (offered when there are any).
- **The pin above** — named by its path, such as `~/work`: the pin that covers
  this directory from a parent, which also covers its other folders.

With only this directory's own pin to drop it drops it at once. Otherwise it
shows a bar under the prompt — `←`/`→` choose, enter unpins, esc keeps
everything — above the pins involved as a tree, where `✕ unpin` marks what the
choice drops and the last line says what this directory will wear afterwards:

```
[UNPIN] [This directory]  And below   ~/work    ←→ choose · enter unpin · esc keep
~/work          konata  and below
└─ site ← here  kita    this directory  ✕ unpin
   └─ docs      rei     and below
Then here · konata pinned to ~/work and below
```

`ttheme unpin <directory>` drops that directory's pins without asking, and
without a terminal `unpin` drops this directory's own pin or says which command
drops the one above.

`pins` draws them as a map: every pinned directory in a tree from `~`, and in
another from `/` for those outside your home, with a run of directories that
hold no pin folded into one row. Each pin shows its palette's name in that
palette's own background and foreground, then its six colors and how far it
reaches. The branches below an **and below** pin are drawn in its cursor color,
so each palette's ground shows at a glance; the directory you are in is marked
`← here` in the color of the pin that covers it, and the line under the tree
names that pin:

```
~
├─ notes      ryo     and below · not installed
└─ work       konata  and below
   ├─ api/v2 ← here
   └─ site    kita    this directory
/srv/archive  kita    and below · no such directory

Here · konata pinned to ~/work and below
ttheme pin picks one here · ttheme unpin drops one · ~/.config/ttheme/pins
```

A pin whose palette is not installed, or whose directory is gone, stays in the
file and does nothing; the map says which. Piped, `pins` prints one line per pin
instead: its path, a tab and its palette.

## SSH host pins

`ttheme pin ssh:<host>` pins a palette to a host instead of a directory: the
tab wears it from the moment you run `ssh <host>` until the prompt comes back,
then takes back what it wore before — unless you painted it by hand in
between, in which case your pick stays. The host is the name you type after
`ssh`, so a `Host` from `~/.ssh/config` works as is, without the user; `*` and
`?` match as they do there, so `ssh:*.prod` covers every host ending in
`.prod`. A host's own pin wins over a pattern, and a longer pattern over a
shorter one. It opens the same browser as a directory's pin, where enter
offers **This host** (**Every match** for a pattern) and the panel
lists the host pins as they will be. The pin lands in the same `pins` file as
`ssh:<host>  <palette>`; `pins` lists it below the directories, and
`ttheme unpin ssh:<host>` drops it.

```
[PREVIEW (PIN)] kita → [This host]   ssh tusa   enter confirm             esc back
```

Only a session counts: `ssh tusa`, `ssh -p 2222 bob@tusa`, `ssh tusa -A`, an
alias that expands to one, and a remote command only with `-t`
(`ssh -t tusa tmux attach`). A remote command without it (`ssh tusa uptime`),
`-N`, `-f`, `-T`, a pipe, a redirect or `&` leave the tab alone, as do an `ssh`
inside a script or a function, `scp`, `rsync` and `git`. Inside tmux the tab
keeps its palette, since the colors belong to the terminal tab rather than the
pane. While the session runs, a remote program that resets the terminal's
colors (`reset`, some Neovim setups) puts the terminal's own colors back until
the prompt returns.

## Names and output

A palette is never a command: `ttheme use <palette>` paints a tab, where a
unique prefix is enough, and a mistyped name gets a "did you mean" suggestion
instead of a wall of output. Piped output drops color and
turns tab-separated, and `NO_COLOR` is respected.

## A new palette on every tab

With `TTHEME_TAB_PALETTE=seq`, new tabs take the next palette in group order, with the counter shared across
tabs — so opening four tabs walks you through four different characters rather
than rolling the same one twice.

## Settings

Settings live in `~/.config/ttheme/config.zsh` — `init` seeds it with every
setting at its default on a commented line, so a default a later version changes
reaches you, and never overwrites a line you changed. `ttheme config` opens it in
`$EDITOR` and alt-c in `preview` edits it in place. Only a value that differs from
the default is left uncommented; setting one back comments it out again. Each line is a plain zsh
`: ${VAR:=value}` assignment, so a variable exported before the layer loads
still wins:

| Setting | Default | |
|---|---|---|
| `TTHEME_TAB_PALETTE` | `off` | `off` keeps new tabs on the terminal's configured theme (`preview` → default changes it); `seq` gives every new tab the next palette. |
| `TTHEME_ANNOUNCE` | `1` | `0` silences the one-line notice under "Last login:" |
| `TTHEME_FX` | `typewriter` | search hint animation — `typewriter`, `decode` or `glitch` |
| `TTHEME_SORT` | `abc` | `series` lists series and palettes in the order they were added instead of by name — in `ttheme`, `preview` and, once exported, the `init` picker |
| `TTHEME_MOUSE` | `on` | `off` leaves the mouse to the terminal in every screen, so a drag selects text and a click opens a link without a modifier, and the wheel scrolls the terminal ([the mouse](#the-mouse)). alt-c in `preview` has it as `Mouse`, and turning it off there lets go of the mouse at once |
| `TTHEME_BG_BLUR` | `0` | softens every background picture behind the text: a blur of this many screen pixels, up to 8, where `0` keeps them sharp. Changing it draws every picture again from its original — from `ttheme config`, or from alt-c in `preview`, whose `Blur` row offers `off` to `4px`. It is read from `config.zsh` itself, not from a shell's variables, since the pictures it draws are shared by every tab |
| `TTHEME_BG_COLORS` | `tone` | the colors a new background picture is drawn in: `tone` tints it in one color of its palette, `original` keeps its own colors. It only decides what `find` and `add` install from now on — every picture switches on its own afterwards, from the `Colors` row of `preview`'s tuning panel — so changing it draws nothing again. Set it in `ttheme config`, or in alt-c in `preview`, whose `Colors` row offers `tone` and `original`. Like the blur, it is read from `config.zsh` itself |
| `TTHEME_WARP_FAST` | `on` | in Warp, which reads its settings only half a second after they change, `on` keeps it rereading them while it is in front and your tabs wear different palettes (and for 3 s after the tab in front changes its own), so a tab you switch to shows its palette in about 0.2 s instead of 0.6 s. That costs about 8% CPU, as Activity Monitor counts it, for as long as it lasts — about 6% in Warp and 2% in ttheme's background process (measured with a Warp window in front); `off` leaves it to Warp. `init` asks when you wire Warp, and `ttheme config` changes it |
| `TTHEME_MARKET_LOOKUP` | `on` | `ttheme browse`'s Markets tab looks GitHub up by itself: the repositories carrying the `ttheme-market` topic when the tab opens and again, a moment after you stop typing, for what you typed, and the index of the repository you type (`owner/repo`) or move onto, so its palettes show in the detail panel before you add it. GitHub lets a search through about ten times a minute without signing in, so a busy minute shows a failed search that `space` retries. `off` waits for `space` on each |
| `TTHEME_FIND_RATING` | `safe` | the ratings `find` lists, any of `safe`, `questionable` and `explicit` separated by spaces (`"safe explicit"`). Each site is read in its own vocabulary, so danbooru's `s` (sensitive) is not mistaken for yande.re's `s` (safe); zerochan keeps no rating, so its posts count as safe unless they carry a nudity tag, which makes them questionable. The set shows next to the query whenever it is not just `safe` |
| `TTHEME_FIND_BLOCK` | `nudity underwear` | the posts `find` drops by tag: `nudity` (`nude`, `naked`, `topless`…), `underwear` (`panties`, `bra`, `lingerie`… — each with the site's own spelling), both, or `none` to keep every post. What is let through shows next to the query as `allows …` |
| `TTHEME_FIND_POSTS` | `all` | what `find` opens on — every post of the character, or only the transparent cutouts (`cutouts`) |
| `TTHEME_FIND_CUTOUTS` | — | the tags `find` calls a transparent cutout, as `key=tag,tag` pairs separated by spaces, keyed by `danbooru`, `konachan`, `yande` or `zerochan` (`konachan=transparent,vector yande=transparent_png`). A site with several tags matches any of them, except zerochan, which searches for its first alone; `danbooru=` names none, so its cutouts are the posts whose PNG header has an alpha channel. A site named here loses yande.re's shortcut of skipping that header check. Sites left out keep the built-in tags |
| `TTHEME_FIND_SOLO` | `on` | `on` keeps only the posts tagged `solo` — the character alone, which is what a backdrop needs. zerochan tags `Solo` itself; konachan and yande.re do not tag how many people a picture shows. Their posts, and zerochan's, borrow the tags danbooru holds for the same file, one request per page, and download that file from danbooru's servers; a post danbooru does not have keeps its own. The query line says `solo` while it is on |
| `TTHEME_FIND_ORDER` | `fit` | the order `find` lists posts in — `fit` ranks each page it fetches by how well a post makes a backdrop (solo, resolution against the window, a cutout or an aspect close to the window's, score within the page, the palette's colors in its preview; comics, monochrome, sketches and landscapes sink) and appends it below what is already shown, so nothing moves under you; `newest`; or `score` |
| `TTHEME_FIND_SETS` | `fold` | a run of the same picture at the same size from one uploader, and a picture another site holds too: `fold` shows it as one tile marked `×N`, `show` lists every one |
| `TTHEME_FIND_REMOVE_BG` | `on` | on macOS, `on` cuts the character out of an opaque picture `find` tries on, with the system's Vision framework; `off` leaves it as it is. The row is in the `s` panel as `remove bg` |
| `TTHEME_FIND_MIN_SCORE` | `off` | the lowest score `find` lists — any number; the panel steps through `5`, `10`, `25`, `50` and `100` with ←→ and takes another typed. danbooru, konachan and yande.re are asked for it (`score:>=10`, which danbooru does not count against its two tags); zerochan keeps no score, so its posts are not held to it and the query line says so. On the `s` panel's advanced page (`a`) as `min score` |
| `TTHEME_FIND_MIN_SIZE` | `off` | the shortest side a picture must reach, in px — any number; the panel steps through `720`, `1080`, `1440`, `1800` and `2560` and takes another typed. Each site is asked for it — `width:>=` and `height:>=` on the boorus, zerochan's own `large` (1080) or `huge` (1800) for the nearest step below — and every post is checked against the exact number again. The query line says `≥1080px` |
| `TTHEME_FIND_SITES` | all four | the sites the all tab mixes, any of `danbooru`, `konachan`, `yande.re` and `zerochan` separated by spaces; a site left out keeps its own tab. At least one stays ticked, and the query line names the ones the all tab skips |
| `TTHEME_FIND_HIDE` | `none` | the kinds of picture `find` leaves out by tag: `comic` (`comic`, `4koma`), `monochrome` (`monochrome`, `greyscale`), `sketch` (`sketch`, `lineart`) and `chibi`, each in every site's spelling and including the tags a post borrows from danbooru. Unticked, `fit` still ranks comics, monochrome and sketches low |
| `TTHEME_FIND_HIDE_TAGS` | — | more tags `find` leaves out, spaced (`cosplay multiple_girls`), matched against every tag a post carries or borrows. Typed on the `hide tags` row |
| `TTHEME_FIND_PNG` | `off` | `on` lists PNG originals only: danbooru is asked for `filetype:png`, the other sites are told by the file's extension, and a zerochan post counts only where danbooru holds the same file, since zerochan's list names no file |
| `TTHEME_FIND_HOSTS` | — | send a `find` site somewhere else, as `key=https://host` pairs (`danbooru=https://danbooru.donmai.us` asks danbooru at its main name instead of `shima.donmai.us`, the one networks that block the main name by hostname let through). The tab keeps its name and carries `*` |

## The catalog

The catalog is not installed wholesale: `init` installs the series you pick, and
`init --yes` none at all. `ttheme browse` opens it as a full-screen live picker in
four tabs — `shift+→` moves on, `shift+←` back, and each tab keeps its own filter.
The rest is preview's: `↑`/`↓`, page up/down and home/end move through a list,
`←`/`→` and `enter` open and close a series, `esc` clears the filter before it
leaves, `?` lists the keys, and the last line names the keys of the row you are
on:

- **Catalog** is every palette of every market you added. Groups fold and
  unfold, typing filters (a query has no spaces, `space` is the pick key), the
  tab repaints as the cursor lands on a palette, and `space` marks one (a series
  from its header, everything shown from `Select all`). With two markets or more
  a strip under the search box counts each one (`All 130 · official 108 ·
  alice@pastel 22`), and `ctrl+s` narrows the list to the next market, then
  back to all of them.
- **Installed** is the same list cut down to what you have, so unmarking one
  there is how you drop it. It has its own strip, with the markets you have a
  palette from.
- **Markets** lists the markets you added over two lines each — where it comes
  from, how many palettes it holds and how many of them you have, when it was
  updated. `space` marks one for removal (its installed palettes stay), `←` and
  `→` turn its auto-update off and on, and `ctrl+r` updates it now. Under
  `On GitHub` it lists the repositories with the `ttheme-market` topic by
  itself as the tab opens, and again a moment after you stop typing, for what
  you typed; moving onto one fetches its index, so the detail panel names the
  palettes it would bring before you add it, and `space` adds it — after asking
  whether it updates on its own. Type a repository (`alice/ttheme-pastel`,
  `#v1` pins it) or a folder and an `Add` row appears, looked up the same way.
  A search GitHub turns away shows as a row that `space` or `ctrl+r` retries;
  `TTHEME_MARKET_LOOKUP=off` leaves all of this to `space`.
- **Errors** collects what went wrong: a market that failed to update, an index
  that cannot be read, a palette file of yours that does not parse.

Nothing is written until you apply. enter on anything but a series opens a
review of everything staged across the tabs — the markets added and removed, the
auto-update switches, and exactly the palettes marked (installing the new ones,
removing the unmarked); enter again applies it, esc goes back to the tabs. The
screen stays while it works: what it has done so far, and one line for the step
in hand (a picture being fetched,
`Downloading kita · danbooru 1234 · 3.1/8.4 MB · 1/2`), then what was applied,
until enter closes it — and the same lines are left in your scrollback. With
nothing staged enter simply leaves, and esc on the tabs, with the filter clear,
leaves everything as it was. From 94 columns up, the panel on the right
describes whatever the cursor is on — a palette's market, its gate score and
failing rules, its pictures, and what enter will do to it; a narrower window
gets the same as one line under the list:

```
 [Catalog]  Installed   Markets   Errors
 Discover palettes (1/6 · 2 picked)
 ╭──────────────────────────────────────────────────────────────────────────────────────╮
 │ ⌕ ki_                                                                                │
 ╰──────────────────────────────────────────────────────────────────────────────────────╯
                                                               │ kita
    ● Select all (1)                                           │ The ttheme catalog
    ▾ Bocchi the Rock! (1/1) ぼっち・ざ・ろっく!               │ Bocchi the Rock!
 ▌    ● kita   ■ ■ ■ ■ ■ ■                                     │ ぼっち・ざ・ろっく!
                                                               │ Installed
                                                               │ Gate 9/9 · passes
 [BROWSE (FILTER)] space pick   enter close   ⇧←→ tabs   ? keys          esc clear filter
```

The counts stay honest: `1/6` is what the filter matched out of the catalog,
`2 picked` is the install set, and `(1/1)` on the series header is how many of
its shown palettes are in it. The six squares are the palette's own colors — its
foreground, the three that identify the character, then its red and green — and
the focused row is drawn in the palette's selection color, which `ttheme`,
`preview` and `browse` all share.

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

`update` refetches every market you added, rewrites what you installed from
them and fetches any picture a palette newly lists. A palette that leaves its
market stays installed from the copy the last change kept
(`~/.config/ttheme/kept.json`); `list` marks it.

A market with auto-update on does that by itself: when a copy is a day old,
`browse`, `add`, `remove`, `market`, `default`, `on` and `off` fetch it first —
`browse` in the background while it is open, the others waiting a few seconds
at most — and say so on your terminal, never into a pipe
(`Updated official 1.0.50 — 153 palettes (3 new)`), when something changed. A failed try is kept quiet, shown under Errors, and tried
again an hour later; the one exception is an index written in a newer schema
than your ttheme reads, which a terminal is told about
(`github.com/alice/ttheme-pastel: catalog is schema 2, newer than the schema 1
this ttheme reads — npx @kecan0406/ttheme@latest init updates it`) while the
copy from the last update stays in use. After refreshing the official catalog
ttheme also says when a newer release than yours is out — `update` always, the
automatic refresh in a terminal. Nothing ever runs from the shell or a new tab.

## Markets

The catalog is every market you added, laid together. The official one
(`official`, the palettes in this repository) is there from `init`; any GitHub
repository with a `ttheme-market.json` at its root is another:

```sh
ttheme market search              # repositories with the ttheme-market topic
ttheme market add alice/ttheme-pastel   # a repository — its index names it: alice@pastel
ttheme market add alice/ttheme-pastel#v1  # the same, pinned to a tag, branch or commit
ttheme market add ./my-market     # a folder, read in place on every command
ttheme add dusk --market alice/ttheme-pastel  # add the market and install from it in one step
ttheme market                     # what you added: counts, auto-update, the last update
ttheme market remove alice@pastel # installed palettes from it keep working
```

Adding a repository asks whether it updates on its own (no, without a
terminal); the official catalog always starts with auto-update on, and a folder
is read in place, so it needs none. `browse`'s Markets tab switches it later.
Adding a repository you already have with another `#ref` moves it there,
keeping its auto-update.

A market is `<owner>@<name>`: the repository's owner and the name its index
gives. Its palettes are `<owner>@<name>/<palette>` (`ttheme add
alice@pastel/dusk`), and `preview` and `browse` — the two tabs of the bare
`ttheme` — list the market below every series, past a `── Markets` line: the market, then its
catalogs — the folders under its `palettes/` — then their palettes by their
own names, and a palette filed straight under `palettes/` after the catalogs.

```
alice/ttheme-pastel               ▾ alice@pastel
  palettes/night/dusk.toml          ▾ night
  palettes/night/moon.toml              dusk
  palettes/day/noon.toml                moon
  palettes/rei.toml                 ▸ day
                                      rei
```

The catalog is only a shelf, never part of the name — dusk stays
`alice@pastel/dusk` wherever its file moves — so a palette name is used once in
a market; `market build` refuses a second one. Only the
official catalog is held to the contrast gate — a market palette installs
whatever its numbers, and `ttheme check` shows them. `ttheme market remove
official` drops the official catalog too; `ttheme market add official` brings
it back.

Installed palettes and the markets you added are listed in
`~/.config/ttheme/installed.json`, with an auto-update switch under `updates`
only where it differs from the default; the official catalog is cached in
`~/.config/ttheme/catalog.json` and each other market in
`~/.config/ttheme/markets/<owner>--<repository>.json`, whose age is how auto-update
tells a day has passed. Failed tries are kept in
`~/.local/state/ttheme/markets.json`.

Every index carries a `schema` number beside its `version` (the release that
wrote it). It is raised only when a change would make an older ttheme misread
the index, never for a palette or an optional field added; a ttheme that finds
a higher one than it reads refuses the index and keeps its last copy, and so
does an index with none: a market written before the field existed runs its
action once more (`ttheme market build` by hand), and `ttheme update` fetches
it.

## Your own palettes

```sh
ttheme new rei                   # kecan0406@dust/rei, from blank in the palette editor
ttheme new rei --from rei        # the same, starting from rei's colors and pictures
ttheme edit rei                  # the same editor; the bare name works for yours
ttheme check --fix rei           # colors that pass the gate, written in
ttheme share rei                 # tt1:… — anyone runs ttheme add tt1:…
ttheme share rei --tone original # the palette as it was, when you tuned it in palette edit
```

`share` prints a palette as you wear it. When you tuned its tone in [palette
edit](#palette-edit) it asks which to share, your tone or the original;
`--tone tuned` or `--tone original` answers for it, and without a terminal it
shares the tuned one. A tuned palette goes out as `<name>-tuned`, since its own
name belongs to the original wherever that is installed.

`new` opens the palette editor full screen on a blank palette (it needs 80×24).
It starts on the seeds: the lightness of the background and the foreground, a
hue and a tint for the neutrals and the cursor, and one lightness and chroma the
accents share, each accent on the hue its ANSI role reads as. Every slider is
drawn in the colors it would give, and whatever the seeds, the twenty colors they
grow pass the gate. enter moves on to the slots, and the seeds stay behind;
`edit` and `--from` open on the slots. The slots take the keys of
[preview's panel](#palette-edit), so a key means the same in both:

- The left side lists the twenty colors, normal and bright side by side, each as
  its OKLCH lightness, chroma and hue (the hex a terminal gets is in the slot's
  details), with ✗ on every slot whose own checks miss (`n`/`N` walk them), and
  the gate's nine
  rules under them, each miss naming its slots. `↑↓` (or `j`/`k`) picks a slot
  and keeps its column through the base colors, `←→` its normal or bright.
- The right side shows the slot: its OKLCH first, then hex and rgb, the color it started as, a
  gradient for lightness, chroma and hue that is the color each step would give
  (`░` past the sRGB edge), its contrast against the color it is read against
  with the gate's floor marked (`◐`), what the gate says about it — its contrast,
  its ANSI role's hue band, how far its bright drifts, what it reads as — with
  the key that fixes a miss, and preview's five scenes in the draft's colors
  (`⇧←→`), the slot underlined wherever it is used. `g` turns it into the
  palette's relations: the lightness and chroma of every ANSI color, normal and
  bright, its hue over the role bands, and the misses between them.
- enter or `tab` tunes the slot, as preview tunes a picture: `↑↓` lightness,
  chroma, hue or `◐` contrast, `←→` a step, `⇧←→` five (ten degrees of hue),
  `home`/`end` the ends, `0`–`9` a jump along the range, enter keeps and esc puts
  back every slot the tune moved. On `◐`, `←→` move lightness until the contrast
  with the color the slot is read against changes, `home` sets the gate's floor
  and `1`–`9` that ratio. `a` widens what moves — this slot, its pair, the six
  normal or bright accents, or all twelve — and each moves by the same step,
  keeping its own color, as palette tools that shift a group at once do. Chroma stops at the sRGB
  edge, and what lightness or hue takes away while you tune comes back where it
  fits again (`○` on the bar); once you keep, the color is what you see. `#` takes `#rrggbb`, `rgb(r g b)` or
  `oklch(l c h)`, and so does a paste.
- `c` and `v` copy a color between slots, `=` makes a bright follow its normal,
  `r` puts a slot back as it opened and `R` all of them, `*` marks a signature
  color (a fourth drops the oldest, and says so), `f` moves the colors the gate
  misses, `o` takes another palette's colors, `u` and ctrl+r undo and redo, and
  space shows the colors you started from. `?` lists the keys; `s` saves and
  esc asks before it throws changes away.
- Behind the editor lies the palette's own picture, framed as the terminal
  shows it and tinted with the colors being edited, so a change to the
  background, the cursor or a signature color shows on it at once (Ghostty,
  kitty, iTerm2, Konsole and WezTerm).
- Pictures come in without leaving the editor: `p` opens `find` on the colors
  being edited, and a picture dropped on the window or pasted — the file, its
  path or its link, or the clipboard's with ctrl+v or an empty paste — opens
  straight in find's try-on, cut out and tinted as find does. Whatever find
  installs is counted in the title line; a post from a booru is listed in the
  palette's `[[picture]]` tables when you save, your own picture stays on your
  machine, and cancelling takes back what was added.

While the editor is open the terminal wears the colors being edited, one changed
slot at a time — in iTerm2, where each OSC color is a profile change, only the
background and foreground, with the rest drawn in the editor — and gets its own
colors back when it closes. `--from <palette>` skips the seeds.

Your palettes are files in a local market: the first `new` asks for its name and
creates `~/.config/ttheme/market/<name>` (`ttheme market init <name>` makes one
up front, or in a folder you give, and `--in <name>` picks between several). Each is
`palettes/<name>.toml` (move it into a folder there to shelve it in a catalog), in the same format as `themes/*.toml` (see
CONTRIBUTING.md) with a bare `meta.name`; the market's `ttheme-market.json`
carries its name and `<you>`, your GitHub handle — read from `gh` when it is logged in, asked
once otherwise, and kept in `installed.json`. A file you break stays out of the
list (every command says why on stderr) until you fix it; `edit` keeps a palette
that misses the gate and prints the numbers, and `check --fix` writes colors that
pass.

The folder is a repository layout already, with a workflow that rebuilds the
index on every push. `ttheme market init` prints the `git` and `gh` commands
that publish it as `<you>/ttheme-<name>` with the `ttheme-market` topic; after
that, anyone runs `ttheme market add <you>/ttheme-<name>`.

A palette can list background posts by number with their framing, in
`[[picture]]` tables. `new` and `share` fill them in from the pictures you have
up; `add` and `update` fetch the posts on your
machine through your own rating and block settings, cut them out and tint them as
`find` does. A picture you drop is not fetched again. When a palette's colors
change — `edit`, `update` — its pictures take the new tone at once, keeping their
framing and tuning.

`uninstall` deletes your markets under `~/.config/ttheme/market` along with the rest of
`~/.config/ttheme` — push it first, or keep it in a folder of your own.
