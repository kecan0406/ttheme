__tt_osc_apply() {
  local -a p=(${=1})
  (( ${#p} >= 20 )) || return 1

  [[ $p[1] != - ]] && printf '\033]11;%s\033\\' "$p[1]"
  printf '\033]10;%s\033\\\033]12;%s\033\\\033]17;%s\033\\' "$p[2]" "$p[3]" "$p[4]"

  local osc4="" i
  for i in {0..15}; do osc4+=";$i;$p[i+5]"; done
  printf '\033]4%s\033\\' "$osc4"
}

__tt_apply() { __tt_osc_apply "$@" }

__tt_pv_bg_open() { : }

__tt_pv_bg_show() { : }

__tt_pv_bg_adjust() { : }

__tt_pv_bg_line() { REPLY="" }

__tt_pv_bg_close() { : }

__tt_pv_bg_save() { : }

__tt_query_bg() {
  local saved resp fd
  exec {fd}<>/dev/tty 2>/dev/null || return 1

  saved=$(stty -g <&$fd 2>/dev/null)
  if [[ -z $saved ]]; then
    exec {fd}>&-
    return 1
  fi

  stty raw -echo min 0 time 3 <&$fd 2>/dev/null
  printf '\033]11;?\033\\' >&$fd
  IFS= read -r -k 40 -u $fd resp 2>/dev/null
  stty "$saved" <&$fd 2>/dev/null
  exec {fd}>&-

  [[ $resp == *rgb:* ]] || return 1
  local -a parts=(${(s:/:)${resp#*rgb:}})
  (( ${#parts} >= 3 )) || return 1
  printf '#%s%s%s' "${parts[1]:0:2}" "${parts[2]:0:2}" "${parts[3]:0:2}"
}
