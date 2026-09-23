typeset -g TTHEME_WEZTERM_SHOWN=""

__tt_keepable() { (( ${TTHEME_TERMINALS[(Ie)wezterm]} )) }

__tt_wezterm_show() { printf '\e]1337;SetUserVar=ttheme_shown=%s\a' "$(print -rn -- $1 | base64)" }

__tt_shown() {
  [[ $2 != force && $TTHEME_WEZTERM_SHOWN == $1 ]] && return 1
  TTHEME_WEZTERM_SHOWN=$1
  __tt_wezterm_show $1
  return 1
}

__tt_pv_bg_show() {
  bgname=$1
  __tt_wezterm_show $1
}

__tt_pv_bg_close() { [[ -z $TTHEME_WEZTERM_SHOWN ]] || __tt_wezterm_show $TTHEME_WEZTERM_SHOWN }
