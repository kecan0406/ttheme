#!/usr/bin/env zsh
emulate -L zsh
setopt err_return pipe_fail

cd ${${(%):-%x}:A:h:h}

local stamp=$(git rev-parse --git-path ttheme-checked)
local begun=$stamp.begun

snapshot() {
  local index=$(mktemp)
  cp -- $(git rev-parse --git-path index) $index
  GIT_INDEX_FILE=$index git add -A
  GIT_INDEX_FILE=$index git write-tree
  rm -f -- $index
}

case $1 in
  begin)
    snapshot > $begun
    ;;
  end)
    if [[ -r $begun && $(snapshot) == $(<$begun) ]]; then
      mv -f -- $begun $stamp
    else
      rm -f -- $begun
      print "ci passed, but the tree changed while it ran, so mise run release checks it again"
    fi
    ;;
  clean)
    [[ $(snapshot) == $(git rev-parse 'HEAD^{tree}') ]] && return 0
    print -u2 "release: the working tree differs from HEAD — commit or stash first"
    return 1
    ;;
  fresh)
    [[ -r $stamp && $(<$stamp) == $(git rev-parse 'HEAD^{tree}') ]]
    ;;
  *)
    print -u2 "usage: checked.zsh begin|end|clean|fresh"
    return 1
    ;;
esac
