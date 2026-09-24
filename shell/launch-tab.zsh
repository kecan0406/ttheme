#!/bin/zsh -f

config=${XDG_CONFIG_HOME:-$HOME/.config}/ttheme/config.zsh
[[ -r $config ]] && source $config

if [[ ${TTHEME_TAB_PALETTE:-off} != off ]]; then
  source ${0:A:h}/ttheme.zsh
  __tt_next
  __tt_apply "$REPLY"
  export TTHEME_SPEC=$REPLY
fi

exec ${SHELL:-/bin/zsh} -l
