__tt_out() {
  if (( TTHEME_TMUX )); then
    printf '\ePtmux;%s\e\\' "${1//$'\e'/$'\e\e'}"
  else
    printf '%s' "$1"
  fi
}

__tt_osc_apply() {
  local -a p=(${=1})
  (( ${#p} >= 20 )) || return 1
  local out i

  if [[ $p[1] == - ]]; then
    out=$'\e]111\e\\'
  else
    out=$'\e]11;'$p[1]$'\e\\'
  fi
  out+=$'\e]10;'$p[2]$'\e\\\e]12;'$p[3]$'\e\\\e]17;'$p[4]$'\e\\'
  for i in {0..15}; do out+=$'\e]4;'$i';'$p[i+5]$'\e\\'; done
  __tt_out "$out"
  (( TTHEME_TMUX )) && tmux set -q @ttheme_bg "$p[1]" 2>/dev/null
  __tt_worn "$1"
  return 0
}

__tt_osc_reset() {
  __tt_out $'\e]104\e\\\e]110\e\\\e]111\e\\\e]112\e\\\e]117\e\\'
  (( TTHEME_TMUX )) && tmux set -qu @ttheme_bg 2>/dev/null
  __tt_worn ""
  return 0
}

__tt_reset_reloaded() { __tt_osc_reset }

__tt_repaint() {
  if [[ -n $TTHEME_SPEC ]]; then
    __tt_apply "$TTHEME_SPEC"
  else
    __tt_osc_reset
  fi
}

__tt_apply() { __tt_osc_apply "$@" }

__tt_shown() { return 1 }

__tt_unshown() { : }

__tt_reloaded() { : }

__tt_worn() { : }

__tt_keepable() { return 1 }

__tt_pv_bg_open() { : }

__tt_pv_bg_show() { : }

__tt_pv_bg_adjust() { : }

__tt_pv_bg_state() { REPLY=""; return 1 }

__tt_pv_bg_findable() { return 1 }

__tt_pv_bg_find() { return 1 }

__tt_pv_bg_images() { REPLY=1 }

__tt_pv_bg_image() { : }

__tt_pv_bg_panel() { : }

__tt_pv_bg_close() { : }

__tt_pv_bg_save() { : }

zmodload zsh/system

typeset -g TTHEME_TYPED=""

__tt_ask() {
  setopt localoptions extendedglob
  local fd saved buf="" chunk seqs=$'\e[]_P][^\a\e]#(\a|\e\\\\)|\e\\[[0-?]#[ -/]#[@-~]|\e[^][_P]'
  local -a match mbegin mend
  REPLY=""
  { exec {fd}<>/dev/tty } 2>/dev/null || return 1
  saved=$(stty -g <&$fd 2>/dev/null && stty raw -echo min 0 time 3 <&$fd 2>/dev/null)
  if [[ -z $saved ]]; then
    exec {fd}>&-
    return 1
  fi
  printf '%s\e[5n' "$1" >&$fd
  while sysread -i $fd -s 4096 chunk 2>/dev/null; do
    buf+=$chunk
    [[ $buf == *$'\e[0n'* ]] && break
    (( ${#buf} < 16384 )) || break
  done
  stty "$saved" <&$fd 2>/dev/null
  exec {fd}>&-
  while [[ $buf == (#b)([^$'\e']#)(${~seqs})(*) ]]; do
    TTHEME_TYPED+=$match[1] REPLY+=$match[2] buf=$match[-1]
  done
  [[ $buf == $'\e'* ]] || TTHEME_TYPED+=$buf
  REPLY=${REPLY%$'\e[0n'}
}

__tt_typed() {
  [[ -n $TTHEME_TYPED ]] || return 0
  zle -U -- "$TTHEME_TYPED"
  TTHEME_TYPED=
}

__tt_start_bg() { __tt_query_bg }

__tt_query_bg() {
  local resp
  REPLY=""
  if (( TTHEME_TMUX )); then
    REPLY=$(tmux show -qv @ttheme_bg 2>/dev/null)
    [[ $REPLY == \#* ]] && return 0
    REPLY=""
  fi
  __tt_ask $'\e]11;?\e\\' || return 1
  resp=$REPLY
  REPLY=""
  [[ $resp == *rgb:* ]] || return 1
  local -a parts=(${(s:/:)${${resp#*rgb:}%%[^0-9A-Fa-f/]*}})
  (( ${#parts} >= 3 )) || return 1
  REPLY="#${(L)parts[1]:0:2}${(L)parts[2]:0:2}${(L)parts[3]:0:2}"
}
