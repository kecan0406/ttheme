# Commands

Every ttheme command, with its arguments, actions and options. This page is
made from the same source as `ttheme help all`, so the two never disagree.

`ttheme help <command>` prints one of them in your terminal, and
`ttheme <command> --help` does the same without running it. A bare `ttheme`
opens Preview and Browse.

Every command exits 0 when it is done, 1 when it failed, 3 on invalid input,
with the message naming what it takes, and 4 when a network request failed.
`ttheme palette` exits 2 when what it would write is already there.
