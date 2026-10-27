# Troubleshooting

Fixes for the problems people meet most, by what you see, and what a bug report
needs when none of them fits.

## Setting up

<details>
<summary>The ttheme command is not found</summary>

Tabs opened before `init` started their shell without it. New tabs have it; in
an open tab, start the shell again:

```sh tab="zsh"
exec zsh
```

```sh tab="bash"
exec bash -l
```

```sh tab="fish"
exec fish
```

</details>

<details>
<summary>A terminal shows no palette after init</summary>

iTerm2, Konsole, Terminal.app and Contour read their profiles only when they
start, so quit and reopen them once. A palette added while Terminal.app runs
gets its profile at its next start too.

If ttheme never wired that terminal, run `init` again from inside it, answer
**No, set it up again**, and mark it in the list, where it says `detected`.

</details>

<details>
<summary>init stops without asking anything</summary>

`init` asks its questions in a terminal, and stops where there is none to ask
in. Run it in a terminal tab, or answer every question at once:

```sh
npx @kecan0406/ttheme@latest init --yes
```

On a first install, `--yes` wires the terminal you are in and installs no
palettes, so your colors stay as they are until you pick one.

</details>

<details>
<summary>Some colors stay the terminal's own</summary>

Color keys you set in your terminal's config yourself, such as `background` or
`palette`, win over any theme, and Alacritty lets its own `[colors]` win over
an import. `init` names them when it finds them. Take them out of your config
to let the palette show.

</details>

## Using it

<details>
<summary>ttheme use says two palettes share the name</summary>

Two marketplaces have a palette of that name:

```text
ttheme: rei is ttheme/rei, kec@bemani/rei — name the one you mean
```

Name it in full:

```sh
ttheme use ttheme/rei
```

</details>

<details>
<summary>ttheme use refuses to run in an editor's terminal</summary>

An editor's terminal, such as Neovim's `:terminal`, Vim's, Emacs or VS Code,
draws in the editor's own theme, so ttheme stays out of it. Run the command in
a terminal tab outside the editor.

</details>

<details>
<summary>auto is not offered</summary>

`auto` follows your system's appearance where the terminal tells ttheme about
it: Ghostty, iTerm2, kitty, WezTerm and Contour. Everywhere else, pick `light`
or `dark`.

</details>

<details>
<summary>A pin does nothing in bash or fish</summary>

Every command works in bash and fish, but what runs at each prompt, such as a
pin taking effect on `cd`, stays with zsh tabs.

</details>

<details>
<summary>No picture shows</summary>

Alacritty, Windows Terminal, Rio and Contour draw no pictures. Inside tmux,
Preview draws none and find is not offered, and Terminal.app shows a palette's
picture but cannot run find.
[Where pictures show](../usage/pictures.md#where-pictures-show) lists what each
terminal draws.

</details>

<details>
<summary>Neovim shows its own colors, not the palette</summary>

With `termguicolors`, Neovim draws every cell itself, so its colorscheme decides
the editor and the palette shows around it. To show the palette inside the
editor too:

```text title="init.vim"
set notermguicolors
```

Neovim's default colorscheme then uses the 16 ANSI colors.

</details>

## Report a bug

```sh
ttheme info                                 # what a bug report needs
npx @kecan0406/ttheme@latest info           # the same, before ttheme is set up
TTHEME_DEBUG=1 ttheme use miku              # where an error came from
```

[Report a bug](https://github.com/kecan0406/ttheme/issues/new?template=bug.yml)
with the output of `ttheme info`: it names ttheme's version, your system, shell
and terminal, the terminals you wired and the settings you changed, so nothing
has to be typed by hand.
