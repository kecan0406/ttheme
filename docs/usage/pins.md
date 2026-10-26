# Pin to a folder or ssh host

A pin gives a folder, or an ssh host, its own palette. A tab shows it while it is
there and takes back what it wore when it leaves.

## Pin this folder

```sh
ttheme pin              # this folder
ttheme pin ~/work/site  # another folder, without going there
```

`ttheme pin` opens the palette list. Pick a palette with `enter`, then choose
how far the pin reaches with `←` `→`:

| Reach | Covers |
|---|---|
| **This directory** | the folder alone; a folder below it keeps whatever covers it |
| **And below** | the folder and everything under it, except a folder with a pin of its own |
| **Repository** | the whole git repository you are in, from its root down |

The panel beside the list shows the pins around it as a tree, as they will be,
before you confirm.

From then on, a tab that `cd`s into the folder shows its palette, and `cd`ing
out puts back what it showed. If you used a palette in the tab by hand in
between, your pick stays. The nearest pin above a folder wins, so a project can use one
palette and a subfolder another.

## Pin an ssh host

```sh
ttheme pin ssh:tusa     # one host
ttheme pin ssh:*.prod   # every host ending in .prod
```

The tab shows the palette from the moment you run `ssh tusa` until the prompt
comes back. The host is the name you type after `ssh`, so a `Host` from
`~/.ssh/config` works as it is. `*` and `?` match as they do there, a host's own
pin wins over a pattern, and a longer pattern wins over a shorter one.

Only a session counts: `ssh tusa`, `ssh -p 2222 bob@tusa` or
`ssh -t tusa tmux attach`. A remote command without `-t`, `scp`, `rsync`, `git`
and an `ssh` inside a script leave the tab alone.

## See your pins

```sh
ttheme pins
```

`pins` draws every pin as a file tree, each in its palette's own colors, and
marks the folder you are in:

```text
~
├── notes/     ryo     and below · not installed
└── work/      konata  and below
    ├── api/v2/ ← here
    └── site/  kita    this directory
ssh
└── tusa       konata  while connected

Here · konata pinned to ~/work and below
```

A pin whose palette is not installed, or whose folder is gone, does nothing
until that changes, and the map says so.

## Drop a pin

```sh
ttheme unpin            # this folder's pin, or choose which
ttheme unpin ~/work     # that folder's pins, without asking
ttheme unpin ssh:tusa
```

With more than one pin in reach, `unpin` asks which to drop: this folder's,
every pin below it, or the pin above that covers it.

## The pins file

Every pin is one line in `~/.config/ttheme/pins`, and the file is yours to edit:

```text title="~/.config/ttheme/pins"
~/work/**        konata
~/work/site      kita
ssh:tusa         konata
```

`path/**` covers everything below the path. Open tabs pick up a change to the
file at their next prompt, and a pin set with `ttheme pin` in another tab at
once.
