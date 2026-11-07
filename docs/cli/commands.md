# Commands

Every ttheme command, with its arguments, actions and options. This page is
made from the same source as `ttheme help all`, so the two never disagree.

`ttheme help <command>` prints one of them in your terminal, and
`ttheme <command> --help` does the same without running it. A bare `ttheme`
opens Preview and Browse.

Before ttheme is set up, `init`, `uninstall` and `info` run through npx or bunx
in place of `ttheme`:

```sh tab="npx"
npx @kecan0406/ttheme@latest info
```

```sh tab="bunx"
bunx @kecan0406/ttheme@latest info
```

Every command exits 0 when it is done, 1 when it failed, 2 when nothing changed
because you cancelled or what it would write is already there, 3 on invalid
input, with the message naming what it takes, and 4 when a network request
failed. Closing a bare `ttheme` exits 0.
