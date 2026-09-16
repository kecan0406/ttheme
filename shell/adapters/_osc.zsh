__tt_osc_apply() {
  local -a p=(${=1})
  (( ${#p} >= 20 )) || return 1

  if [[ $p[1] == - ]]; then
    printf '\033]111\033\\'
  else
    printf '\033]11;%s\033\\' "$p[1]"
  fi
  printf '\033]10;%s\033\\\033]12;%s\033\\\033]17;%s\033\\' "$p[2]" "$p[3]" "$p[4]"

  local osc4="" i
  for i in {0..15}; do osc4+=";$i;$p[i+5]"; done
  printf '\033]4%s\033\\' "$osc4"
}

__tt_osc_reset() { printf '\033]104\033\\\033]110\033\\\033]111\033\\\033]112\033\\\033]117\033\\' }

__tt_apply() { __tt_osc_apply "$@" }

__tt_pv_bg_open() { : }

__tt_pv_bg_show() { : }

__tt_pv_bg_adjust() { : }

__tt_pv_bg_state() { REPLY=""; return 1 }

__tt_pv_bg_panel() { : }

__tt_pv_bg_close() { : }

__tt_pv_bg_save() { : }

__tt_query_bg() {
  local saved resp="" c fd
  REPLY=""
  exec {fd}<>/dev/tty 2>/dev/null || return 1

  saved=$(stty -g <&$fd 2>/dev/null)
  if [[ -z $saved ]]; then
    exec {fd}>&-
    return 1
  fi

  stty raw -echo min 0 time 3 <&$fd 2>/dev/null
  printf '\033]11;?\033\\' >&$fd
  while IFS= read -r -k 1 -u $fd c 2>/dev/null; do
    resp+=$c
    [[ $resp == *$'\e\\' || $resp == *$'\a' ]] && break
    (( ${#resp} < 64 )) || break
  done
  stty "$saved" <&$fd 2>/dev/null
  exec {fd}>&-

  [[ $resp == *rgb:* ]] || return 1
  local -a parts=(${(s:/:)${${resp#*rgb:}%%[^0-9A-Fa-f/]*}})
  (( ${#parts} >= 3 )) || return 1
  REPLY="#${(L)parts[1]:0:2}${(L)parts[2]:0:2}${(L)parts[3]:0:2}"
}
