#!/bin/sh

set -eu

REPO=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DEST=${TTHEME_DEST:-${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/ttheme}
LINK=0

[ "${1:-}" = "--link" ] && LINK=1

if [ ! -d "$REPO/dist" ]; then
  echo "dist/ is missing — building it first"
  (cd "$REPO" && bun install --silent && bun src/cli.ts build)
fi

place() {
  src=$1
  dst=$2
  mkdir -p "$(dirname -- "$dst")"
  if [ -e "$dst" ] && [ ! -L "$dst" ]; then
    mv -- "$dst" "$dst.bak"
    echo "  kept your existing file as $(basename -- "$dst").bak"
  fi
  if [ "$LINK" -eq 1 ]; then
    ln -sfn -- "$src" "$dst"
  else
    rm -rf -- "$dst"
    cp -R -- "$src" "$dst"
  fi
}

echo "installing into $DEST"
place "$REPO/shell/ttheme.zsh"        "$DEST/ttheme.zsh"
place "$REPO/shell/launch-tab.zsh"    "$DEST/launch-tab.zsh"
place "$REPO/shell/adapters"          "$DEST/adapters"
place "$REPO/dist/shell/palettes.zsh" "$DEST/palettes.zsh"
chmod +x "$DEST/launch-tab.zsh" 2>/dev/null || true

GHOSTTY=${XDG_CONFIG_HOME:-$HOME/.config}/ghostty
place "$REPO/dist/ghostty/themes" "$GHOSTTY/themes"
place "$REPO/ghostty/shaders"     "$GHOSTTY/shaders"

cat <<EOF

done. Add these to $GHOSTTY/config:

  command = $DEST/launch-tab.zsh
  shell-integration = zsh
  theme = neutral

and this to your ~/.zshrc, after compinit:

  source $DEST/ttheme.zsh

Then open a new tab. \`ttheme\` lists every palette.
EOF
