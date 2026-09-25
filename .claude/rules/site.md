---
paths:
  - "site/**"
---

# site/

## Conventions

- `site/` consumes `@base-ui/react` only through `site/components/ui/*`, managed by the shadcn CLI (`site/components.json`, style `base-nova`): add parts with `bunx shadcn@latest add <name>` from `site/`, then adapt them in place — feature components never import `@base-ui/react` directly (biome enforces it). Color tokens use shadcn's vocabulary in a dark-only `:root`. The landing root wears the current palette: its inline style sets the raw slots (`--bg`, `--fg`, `--cu`, `--se`, `--a0`–`--a15`) and the `.wear` class in `globals.css` remaps the shadcn tokens onto them, so every part on the page — ui primitives included — wears that palette.

- `/markets` (`site/app/markets/page.tsx`, `site/lib/markets.ts`) is built from GitHub's topic search for `ttheme-market` and each hit's `ttheme-market.json` at build time — `GITHUB_TOKEN` when set, an empty list when the network is not there — so `pages.yml` rebuilds daily to pick up new markets.

## Gotchas

- `bunx shadcn@latest add` can emit `import { cn } from "cn"` and add the unrelated `cn` npm package to site/package.json — point the import at `@/lib/utils` and `bun remove cn`.
- The shadcn parts carry `dark:` variants and `<html>` always has `.dark`, so a plain `hover:`/`data-*:` override loses to them on specificity — adapt the part in place or use a plain element.
