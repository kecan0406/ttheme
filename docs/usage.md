# Usage

## Commands

```
ttheme          list every palette, grouped, with previews
ttheme use      paint this tab    (a unique prefix works: ttheme use ho)
ttheme preview  browse live — focus repaints the tab, enter keeps it (this tab or default)
ttheme next     advance this tab to the next palette
ttheme default  make a palette the one new tabs open with
ttheme on       wear the default palette in new tabs again
ttheme off      take the palette and picture off every tab — the terminal's own colors until ttheme on
ttheme pin      pick a palette for this directory — cd into it repaints, cd out restores
ttheme unpin    drop the palette pinned to this directory
ttheme config   edit settings in $EDITOR — they apply in new tabs
ttheme help     the list above, in your terminal

ttheme browse   pick palettes from the catalog in a live picker
ttheme list     the catalog, ● installed and ○ not (a query filters it, --json prints it as JSON)
ttheme add      install palettes from the catalog
ttheme remove   uninstall palettes
ttheme update   refresh the catalog from the registry
```

`ttheme <command> --help` (or `ttheme help <command>`) describes one command
without running it, and `ttheme --version` prints the version. `TTHEME_DEBUG=1`
in front of any command prints where an error came from, for a bug report.

## Preview

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
alt-c opens the [settings](#settings) in place — `↑`/`↓` pick one, `←`/`→` change it
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

## Directory pins

`pin` opens the same browser and, on enter, asks **this directory** or **and
below**; the answer lands in `~/.config/ttheme/pins`, one `path  palette` per
line, where `path/**` covers everything below it (`~` works, and the file is
yours to edit). From then on a tab that `cd`s into a pinned path takes its
palette — symlinks resolve to the pinned directory — and `cd`ing out restores
what the tab had before, unless you painted it by hand in between, in which
case your pick stays. The nearest pinned ancestor wins, so a project can pin
one palette and a subfolder another. Open tabs pick up a changed pins file on
their next `cd`; `unpin` drops the pin on the current directory.

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
◆ catalog (4/150 · 2 picked)
│ ⌕ bo_
│   ○ select all (4)
│ ▾ Bocchi the Rock! (2/4) ぼっち・ざ・ろっく!
│   ▶ ● bocchi        ● ▁▁▁▁▁▁  Sakura + Kessoku
│     ● kita          ● ▁▁▁▁▁▁  Wild Cherry + Kessoku
│     ○ nijika        ● ▁▁▁▁▁▁  Medallion
│     ○ ryo           ● ▁▁▁▁▁▁  TokyoNight Storm
└ ↑↓ move · ←→ fold · space pick · type to filter · enter install · esc cancel
```

The counts stay honest: `4/150` is what the filter matched out of the catalog,
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
