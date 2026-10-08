# Security

Report a vulnerability privately through
[GitHub's private vulnerability reporting](https://github.com/kecan0406/ttheme/security/advisories/new),
not in a public issue. Only the latest release on npm is supported; a fix ships
as a new release.

ttheme writes marked blocks into `~/.zshrc` and your terminals' config files,
runs zsh code at every prompt, fetches the marketplaces you add from GitHub, and
`find` downloads pictures from the booru sites listed in `src/booru.ts`.
Anything that lets a palette, a marketplace or a downloaded picture run code, or
write outside ttheme's own blocks and directories, is in scope.
