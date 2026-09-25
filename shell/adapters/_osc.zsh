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
  export TTHEME_PAINTED=1
  (( TTHEME_TMUX )) && tmux set -q @ttheme_bg "$p[1]" 2>/dev/null
  __tt_worn "$1"
  return 0
}

__tt_osc_reset() {
  __tt_out $'\e]104\e\\\e]110\e\\\e]111\e\\\e]112\e\\\e]117\e\\'
  unset TTHEME_PAINTED
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
typeset -gi TTHEME_RAW=0

__tt_b64() {
  local t=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/ out="" i n
  local -a b=("$@")
  for (( i = 1; i <= ${#b}; i += 3 )); do
    n=$(( (b[i] << 16) | (${b[i+1]:-0} << 8) | ${b[i+2]:-0} ))
    out+=${t:$(( (n >> 18) & 63 )):1}${t:$(( (n >> 12) & 63 )):1}
    if (( i + 1 <= ${#b} )); then out+=${t:$(( (n >> 6) & 63 )):1}; else out+='='; fi
    if (( i + 2 <= ${#b} )); then out+=${t:$(( n & 63 )):1}; else out+='='; fi
  done
  REPLY=$out
}

__tt_b64s() {
  setopt localoptions nomultibyte
  local s=$1 c
  local -a b=()
  local -i i n
  for (( i = 1; i <= ${#s}; i++ )); do
    c=${s[i]}
    n=$(( #c ))
    (( n < 0 )) && (( n += 256 ))
    b+=($n)
  done
  __tt_b64 $b
}

__tt_ask() {
  setopt localoptions extendedglob
  local fd saved="" buf="" chunk seqs=$'\e[]_P][^\a\e]#(\a|\e\\\\)|\e\\[[0-?]#[ -/]#[@-~]|\e[^][_P]'
  local -a match mbegin mend
  REPLY=""
  { exec {fd}<>/dev/tty } 2>/dev/null || return 1
  if (( ! TTHEME_RAW )) && ! zle; then
    saved=$(stty -g <&$fd 2>/dev/null && stty raw -echo <&$fd 2>/dev/null)
    if [[ -z $saved ]]; then
      exec {fd}>&-
      return 1
    fi
  fi
  printf '%s\e[5n' "$1" >&$fd
  while sysread -t 0.3 -i $fd -s 4096 chunk 2>/dev/null; do
    buf+=$chunk
    [[ $buf == *$'\e[0n'* ]] && break
    (( ${#buf} < 16384 )) || break
  done
  [[ -n $saved ]] && stty "$saved" <&$fd 2>/dev/null
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

__tt_hear() { __tt_query_bg }

__tt_heard() { : }

__tt_start_bg() {
  REPLY=${TTHEME_HEARD%% *}
  [[ -n $REPLY ]]
}

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
