#!/bin/zsh -f

source ${0:A:h}/ttheme.zsh

if [[ ${TTHEME_TAB_PALETTE:-seq} != off ]]; then
  __tt_next
  __tt_apply "$REPLY"
  export TTHEME_SPEC=$REPLY
fi

exec /bin/zsh -l
