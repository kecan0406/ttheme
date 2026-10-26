__tt_contour_wired() { (( ${TTHEME_TERMINALS[(Ie)contour]} )) }

__tt_keepable() { __tt_contour_wired }

__tt_follows_focus() { return 0 }

__tt_reports_appearance() { (( ! TTHEME_TMUX )) }

__tt_takes_default() { __tt_contour_wired && __tt_osc_reset }

__tt_osc_reset() {
  local spec=${TTHEME_STARTUP:+${TTHEME_PALETTE[$TTHEME_STARTUP]}}
  if __tt_contour_wired && [[ -n $spec ]]; then
    __tt_osc_apply "$spec"
  else
    __tt_worn ""
    __tt_out $'\e]104\e\\\e]110\e\\\e]111\e\\\e]112\e\\\e]117\e\\'
  fi
  unset TTHEME_PAINTED
  (( TTHEME_TMUX )) && tmux set -qu @ttheme_bg 2>/dev/null
  return 0
}

__tt_heard() {
  local spec=${TTHEME_STARTUP:+${TTHEME_PALETTE[$TTHEME_STARTUP]}} bg=${1%% *}
  [[ -n $bg && -n $spec && -z $TTHEME_PAINTED && $bg != "${spec%% *}" ]] && __tt_contour_wired && (( ! TTHEME_TMUX )) || return 0
  __tt_osc_reset
  TTHEME_HEARD=$spec
  return 0
}
