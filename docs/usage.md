# Usage

## Commands

Three cover most days: `ttheme preview` tries every palette live and keeps the
one you land on, `ttheme browse` installs or drops palettes, and `ttheme use
<palette>` paints this tab. `ttheme help` shows those and the rest by task;
`ttheme help all` lists every command with what it does:

```
ttheme          list every palette, grouped, with previews

This tab
ttheme use      paint this tab    (a unique prefix works: ttheme use ho)
ttheme preview  browse live — focus repaints the tab, enter keeps it (this tab or default)
ttheme next     advance this tab to the next palette
ttheme pin      pick a palette for this directory — cd into it repaints, cd out restores
ttheme unpin    drop the palette pinned to this directory

New tabs
ttheme default  make a palette the one new tabs open with
ttheme on       wear the default palette in new tabs again
ttheme off      take the palette and picture off every tab — the terminal's own colors until ttheme on
ttheme config   edit settings in $EDITOR — they apply in new tabs

Palettes
ttheme browse   pick palettes from the catalog in a live picker
ttheme list     the catalog, ● installed and ○ not (a query filters it, --json prints it as JSON)
ttheme add      install palettes from the catalog, or from a share code (ttheme add tt1:…)
ttheme remove   uninstall palettes
ttheme update   refresh every market you added
ttheme market   the markets you added — add, remove and search them; init makes one of your own

Your own
ttheme new      make a palette of your own, <you>@<market>/<name>, from another one (--from, --in)
ttheme edit     change one of your palettes in $EDITOR — the gate advises, never refuses
ttheme check    measure a palette against the contrast gate (--fix writes colors that pass)
ttheme share    print a share code — the colors and the pictures' post numbers
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
│    bo_
│    ○ select all (4)
│    ▾ Bocchi the Rock! (2/4) ぼっち・ざ・ろっく!
│ ▌    ● bocchi   ■ ■ ■ ■ ■ ■
│      ● kita     ■ ■ ■ ■ ■ ■
│      ○ nijika   ■ ■ ■ ■ ■ ■
│      ○ ryo      ■ ■ ■ ■ ■ ■
└ ↑↓ move · ←→ fold · space pick · type to filter · enter install · esc cancel
```

The counts stay honest: `4/150` is what the filter matched out of the catalog,
`2 picked` is the install set, and `(2/4)` on the series header is how many of
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

## Markets

The catalog is every market you added, laid together. The official one
(`official`, the palettes in this repository) is there from `init`; any GitHub
repository with a `ttheme-market.json` at its root is another:

```sh
ttheme market search              # repositories with the ttheme-market topic
ttheme market add alice/ttheme-pastel   # a repository — its index names it: alice@pastel
ttheme market add ./my-market     # a folder, read in place on every command
ttheme market                     # what you added, with counts
ttheme market remove alice@pastel # installed palettes from it keep working
```

A market is `<owner>@<name>`: the repository's owner and the name its index
gives. Its palettes are `<owner>@<name>/<palette>` (`ttheme add
alice@pastel/dusk`), and the market is their group: `preview`, `browse` and the
bare `ttheme` list it below every series, past a `── markets` line. Only the
official catalog is held to the contrast gate — a market palette installs
whatever its numbers, and `ttheme check` shows them. `ttheme market remove
official` drops the official catalog too; `ttheme market add official` brings
it back.

Installed palettes and the markets you added are listed in
`~/.config/ttheme/installed.json`; the official catalog is cached in
`~/.config/ttheme/catalog.json` and each other market in
`~/.config/ttheme/markets/<owner>--<repository>.json`.

## Your own palettes

```sh
ttheme new rei --from rei        # kecan0406@dust/rei, installed at once
ttheme edit rei                  # $EDITOR; the bare name works for yours
ttheme check --fix rei           # colors that pass the gate, written in
ttheme share rei                 # tt1:… — anyone runs ttheme add tt1:…
```

Your palettes are files in a local market: the first `new` asks for its name and
creates `~/.config/ttheme/market/<name>` (`ttheme market init <name>` makes one
up front, or in a folder you give, and `--in <name>` picks between several). Each is
`palettes/<name>.toml`, in the same format as `themes/*.toml` (see
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
up; `add`, a new `[[picture]]` in `edit`, and `update` fetch the posts on your
machine through your own rating and block settings, cut them out and tint them as
`find` does. A picture you drop is not fetched again. Pictures keep the tint they
were installed with, so after changing a palette's colors, reinstall a picture
from `find` to retint it.

`uninstall` deletes your markets under `~/.config/ttheme/market` along with the rest of
`~/.config/ttheme` — push it first, or keep it in a folder of your own.
