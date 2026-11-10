#!/usr/bin/env zsh
emulate -L zsh
setopt err_return pipe_fail

release() { gh api repos/$1/releases/latest --jq .tag_name }

zig_of() {
  gh api "repos/ghostty-org/ghostty/contents/build.zig.zon?ref=$1" --jq .content | base64 -d |
    sed -n 's/.*minimum_zig_version *= *"\([^"]*\)".*/\1/p'
}

warp_newest() {
  curl -fsSL --retry 5 --retry-all-errors https://releases.warp.dev/linux/deb/dists/stable/main/binary-amd64/Packages |
    awk '$1 == "Package:" { name = $2 } $1 == "Version:" && name == "warp-terminal" { print $2 }' | sort -V | tail -1
}

main() {
  local ghostty tip kitty rio contour warp
  ghostty=$(gh api 'repos/ghostty-org/ghostty/tags?per_page=100' --jq '.[].name' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)
  tip=$(gh api repos/ghostty-org/ghostty/commits/main --jq .sha)
  kitty=$(release kovidgoyal/kitty)
  rio=$(release raphamorim/rio)
  contour=$(release contour-terminal/contour)
  warp=$(warp_newest)
  [[ -n $warp ]] || { print -u2 "latest: Warp's apt index names no warp-terminal version"; return 1 }
  local -a args=(
    GHOSTTY=${ghostty#v} ZIG=$(zig_of $ghostty)
    GHOSTTY_TIP=$tip ZIG_TIP=$(zig_of $tip)
    KITTY=${kitty#v} RIO=${rio#v} WARP=$warp
  )
  if gh api repos/contour-terminal/contour/releases/latest --jq '.assets[].name' | grep -qx "contour-${contour#v}-ubuntu26.04-amd64.deb"; then
    args+=(CONTOUR=${contour#v})
  fi
  print -r -- "TTHEME_COMPAT_BUILD_ARGS=${(j: :)args}"
}

main
