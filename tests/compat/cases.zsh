typeset -g CC_DIR=${ZDOTDIR:-$HOME}/compat

__cc_ask() {
  local c fd saved
  REPLY=""
  exec {fd}<>/dev/tty || return 1
  saved=$(stty -g <&$fd)
  stty raw -echo min 0 time 20 <&$fd
  printf '%s\e[5n' "$1" >&$fd
  while IFS= read -r -k 1 -u $fd c; do
    REPLY+=$c
    [[ $REPLY == *$'\e[0n' ]] && break
    (( ${#REPLY} < 4096 )) || break
  done
  stty $saved <&$fd
  exec {fd}>&-
  [[ $REPLY == *$'\e[0n' ]] || return 1
  REPLY=${REPLY%$'\e[0n'}
}

__cc_color() {
  __cc_ask $'\e]'$1$';?\e\\' || return 1
  [[ $REPLY == *rgb:* ]] || { REPLY=""; return 1 }
  local -a p=(${(s:/:)${${REPLY#*rgb:}%%[^0-9A-Fa-f/]*}})
  (( ${#p} >= 3 )) || { REPLY=""; return 1 }
  REPLY="#${(L)p[1][1,2]}${(L)p[2][1,2]}${(L)p[3][1,2]}"
}

__cc_near() {
  local a=${1#\#} b=${2#\#} i
  [[ ${#a} == 6 && ${#b} == 6 ]] || return 1
  for i in 1 3 5; do
    (( ${$(( 16#${a[i,i+1]} - 16#${b[i,i+1]} ))#-} <= ${3:-12} )) || return 1
  done
}

__cc_dist() {
  local a=${1#\#} b=${2#\#} i
  REPLY=0
  for i in 1 3 5; do
    (( REPLY += ${$(( 16#${a[i,i+1]} - 16#${b[i,i+1]} ))#-} ))
  done
}

__cc_report() { print -r -- "$1"$'\t'"$2"$'\t'"$3" >> $CC_DIR/results }

__cc_mode() {
  __cc_ask $'\e[?'$1'$p' || return 1
  [[ $REPLY == *$'\e[?'$1';'<->'$y'* ]] || { REPLY=0; return 1 }
  REPLY=${${REPLY##*\;}%%\$*}
  (( REPLY != 0 ))
}

__cc_shot() {
  local i
  : > $CC_DIR/$1.req
  for i in {1..100}; do
    [[ -e $CC_DIR/$1.done ]] && { REPLY=$(<$CC_DIR/$1.done); return 0 }
    sleep 0.1
  done
  REPLY=""
  return 1
}

__cc_painted() {
  local want=$2 from=$3 got
  local -i near far
  printf '\e[H\e[2J'
  sleep 0.3
  if ! __cc_shot $1; then
    __cc_report $1 skip "no screenshot"
    return
  fi
  local shot=$REPLY
  for got in ${(M)${=shot}:#\#*}; do
    __cc_near $want $got 24 || continue
    __cc_dist $want $got; near=$REPLY
    __cc_dist ${from:-$want} $got; far=$REPLY
    [[ -z $from ]] || (( near < far )) || continue
    __cc_report $1 pass "$want painted as $got"
    return
  done
  __cc_report $1 fail "wanted $want over ${from:-?}, the window shows ${shot:-nothing}"
}

__cc_roundtrip() {
  local id=$1 slot=$2 want=$3
  printf '\e]%s;%s\e\\' $slot $want
  if __cc_color $slot && __cc_near $want $REPLY; then
    __cc_report $id pass "set $want, read $REPLY"
  else
    __cc_report $id fail "set $want, read ${REPLY:-no answer}"
  fi
}

__cc_cases() {
  local start REPLY spec other
  printf '\e]0;%s\a' ${CC_TITLE:-ttheme-compat}

  if [[ $TTHEME_ADAPTER == $CC_ADAPTER ]]; then
    __cc_report detect pass $TTHEME_ADAPTER
  else
    __cc_report detect fail "${TTHEME_ADAPTER:-none}, wanted $CC_ADAPTER"
  fi

  if (( $+functions[__tt_active] )) && __tt_active; then
    __cc_report layer pass "active, ${#TTHEME_PALETTE} palettes"
  else
    __cc_report layer fail "inactive"
  fi

  if __cc_color 11; then
    start=$REPLY
    __cc_report osc-query pass $start
  else
    __cc_report osc-query fail "no answer to OSC 11 ?"
  fi

  __cc_roundtrip osc-bg 11 '#5a4e46'
  __cc_roundtrip osc-fg 10 '#d8cfc4'
  __cc_roundtrip osc-cursor 12 '#c47a5a'
  __cc_roundtrip osc-selection 17 '#46505a'
  __cc_roundtrip osc-ansi '4;1' '#b85c5c'

  printf '\e]104\e\\\e]110\e\\\e]111\e\\\e]112\e\\\e]117\e\\'
  if [[ -z $start ]]; then
    __cc_report osc-reset skip "no starting color to return to"
  elif __cc_color 11 && __cc_near $start $REPLY; then
    __cc_report osc-reset pass "back to $REPLY"
  else
    __cc_report osc-reset fail "wanted $start, read ${REPLY:-no answer}"
  fi

  printf '\e]11;#3a6f5c\e\\'
  __cc_painted painted '#3a6f5c' $start
  printf '\e]111\e\\'

  (( $+functions[__tt_name_of] )) && __tt_name_of "$TTHEME_SPEC"
  other=${${TTHEME_ORDER:#$REPLY}[1]}
  if (( $+functions[ttheme] )) && [[ -n $other ]]; then
    ttheme $other
    spec=${${=TTHEME_PALETTE[$other]}[1]}
    REPLY=""
    if [[ $TTHEME_SPEC == ${TTHEME_PALETTE[$other]} ]] && __cc_color 11 && __cc_near $spec $REPLY; then
      __cc_report wear pass "ttheme $other reads back $REPLY"
    else
      __cc_report wear fail "ttheme $other left the tab on ${REPLY:-its own colors}, wanted $spec"
    fi
    __cc_painted wear-painted $spec $start
  else
    __cc_report wear fail "no ttheme command or no palette"
    __cc_report wear-painted skip "nothing worn"
  fi

  if (( ! $+functions[__tt_osc_reset] )) || [[ -z $start ]]; then
    __cc_report restore skip "no layer or no starting color"
  else
    __tt_osc_reset
    if __cc_color 11 && __cc_near $start $REPLY; then
      __cc_report restore pass "back to $REPLY"
    else
      __cc_report restore fail "wanted $start, read ${REPLY:-no answer}"
    fi
  fi

  if __cc_ask $'\e[16t' && [[ $REPLY == *$'\e[6;'<1->';'<1->t* ]]; then
    __cc_report cell-size pass "CSI 16t ${${REPLY##*\[6;}%%t*}"
  elif __cc_ask $'\e]1337;ReportCellSize\a' && [[ $REPLY == *ReportCellSize=* ]]; then
    __cc_report cell-size pass "OSC 1337 ${${REPLY##*ReportCellSize=}%%[$'\a\e']*}"
  else
    __cc_report cell-size fail "neither CSI 16t nor OSC 1337 ReportCellSize"
  fi

  if __cc_ask $'\e_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA\e\\' && [[ $REPLY == *'_Gi=31;OK'* ]]; then
    __cc_report kitty-graphics pass "a=q answered OK"
  else
    __cc_report kitty-graphics fail "${${(V)REPLY}:-no answer}"
  fi

  if __cc_mode 2026; then
    __cc_report sync-output pass "DECRQM 2026 = $REPLY"
  else
    __cc_report sync-output fail "DECRQM 2026 = ${REPLY:-no answer}"
  fi

  if __cc_mode 1004; then
    __cc_report focus-report pass "DECRQM 1004 = $REPLY"
  else
    __cc_report focus-report fail "DECRQM 1004 = ${REPLY:-no answer}"
  fi
}

__cc_run() {
  precmd_functions=(${precmd_functions:#__cc_run})
  mkdir -p $CC_DIR
  mkdir $CC_DIR/started 2>/dev/null || return
  __cc_cases 2>> $CC_DIR/errors
  : > $CC_DIR/done
  exit
}

precmd_functions+=(__cc_run)
