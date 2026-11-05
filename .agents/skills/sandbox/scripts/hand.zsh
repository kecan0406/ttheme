#!/usr/bin/env zsh
emulate -L zsh
setopt err_return pipe_fail

source ${${(%):-%x}:A:h}/lib.zsh

usage() { print -u2 "usage: hand.zsh [--size COLSxROWS] COMMAND [STEP…]" }

main() {
  local -a size=(--size 140x44)
  zparseopts -D -F -K -- -size:=size || { usage; return 1 }
  (( $# )) || { usage; return 1 }
  local hook rc=0
  hook=$(mktemp -t ttheme-hook)
  print -rl -- \
    "typeset -g SB_HERE=${(q)HERE}" \
    '__sb_hand() {' \
    '  precmd_functions=(${precmd_functions:#__sb_hand})' \
    '  [[ -e ${ZDOTDIR:-$HOME}/handed ]] && return' \
    '  : > ${ZDOTDIR:-$HOME}/handed' \
    "  SB_TTY=\$TTY python3 \$SB_HERE/drive.py --hand ${(j: :)${(q)@}}" \
    '}' \
    'precmd_functions+=(__sb_hand)' > $hook
  ( cd $ROOT && mise run sandbox --mine $size --zshenv $hook ) || rc=$?
  rm -f $hook
  return $rc
}

main $@
