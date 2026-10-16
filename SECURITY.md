# Security

Report a vulnerability privately through
[GitHub's private vulnerability reporting](https://github.com/kecan0406/ttheme/security/advisories/new),
not in a public issue. Only the latest release on npm is supported; a fix ships
as a new release.

ttheme writes marked blocks into `~/.zshrc` and your terminals' config files,
runs zsh code at every prompt, fetches the marketplaces you add from GitHub,
asks npm's registry once a day whether a newer ttheme is out, reads the
marketplace index Browse's search lists from GitHub Pages, downloads
characters' names from aninames' releases on GitHub, downloads the pictures a
palette lists when `add`, Browse or `update` installs it, and `find` downloads
pictures from the booru sites listed in `src/core/booru.ts`. Anything that lets a
palette, a marketplace, the index, the names or a downloaded picture run code,
or write outside ttheme's own blocks and directories, is in scope.
