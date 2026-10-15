__tt_keepable() { (( ${TTHEME_TERMINALS[(Ie)windows-terminal]} )) }

__tt_reloaded() {
  local REPLY
  integer i
  [[ -n $TTHEME_PAINTED ]] || return 0
  if [[ $1 != behind ]]; then
    for (( i = 0; i < 20; i++ )); do
      __tt_query_bg && [[ ${(L)REPLY} == ${(L)${TTHEME_SPEC%% *}} ]] || break
      sleep 0.05
    done
  fi
  __tt_repaint
}

__tt_holds() { return 1 }

__tt_follows_focus() { return 0 }
