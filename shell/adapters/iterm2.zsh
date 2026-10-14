source "$TTHEME_HOME/adapters/_bg.zsh"

zmodload -F zsh/datetime p:EPOCHREALTIME 2>/dev/null

() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  (( ${+TTHEME_ITERM_SHOWN} )) && return 0
  typeset -gx TTHEME_ITERM_SHOWN="" TTHEME_ITERM_DYED=0
  [[ $ITERM_PROFILE == 'ttheme · '* ]] && TTHEME_ITERM_SHOWN=${ITERM_PROFILE#ttheme · }
  return 0
}

__tt_keepable() { return 0 }

__tt_reverts() { return 1 }

__tt_follows_focus() { return 0 }

__tt_takes_default() {
  local REPLY was=$TTHEME_ITERM_SHOWN
  (( ! TTHEME_ITERM_DYED )) || return 1
  (( TTHEME_TMUX )) && was=$(tmux show -qv @ttheme_shown 2>/dev/null)
  [[ $was == default ]] && return 0
  [[ -z $was ]] && __tt_hear && [[ $REPLY == ${TTHEME_PALETTE[$TTHEME_STARTUP]%% *} ]] || return 1
  TTHEME_ITERM_SHOWN=default
  (( TTHEME_TMUX )) && tmux set -q @ttheme_shown default 2>/dev/null
  return 0
}

__tt_cli_env() { pass+=(TTHEME_ITERM_SWITCH=$TTHEME_ITERM_SWITCH) }

__tt_switchable() {
  local -a at
  [[ $TTHEME_ITERM_SWITCH == 1 ]] && (( ${TTHEME_ORDER[(Ie)$1]} )) || return 1
  zstat -F %s.%N -A at +mtime -- $TTHEME_ITERM_PROFILES 2>/dev/null && (( EPOCHREALTIME - at[1] >= 1 ))
}

__tt_profiled() {
  __tt_name_of "$1"
  __tt_switchable $REPLY
}

__tt_profile() {
  local out=$'\e]1337;SetProfile='${1:+ttheme · $1}$'\a'
  if [[ $TTHEME_ITERM_SWITCH == 1 ]] && (( TTHEME_ITERM_DYED )); then
    if (( TTHEME_ITERM_DYED == 1 )); then
      out=$'\e]104;0;1;2;3;4;5;6;7;8;9;10;11;12;13;14;15\e\\\e]110\e\\\e]111\e\\\e]112\e\\\e]117\e\\'$out
    else
      out=$'\e]110\e\\\e]111\e\\'$out
    fi
    (( TTHEME_RAW )) || out=$'\e[?2026h'$out$'\e[?2026l'
  fi
  __tt_out "$out"
  TTHEME_ITERM_SHOWN=${1:-${TTHEME_STARTUP:+default}} TTHEME_ITERM_DYED=0
  (( TTHEME_TMUX )) && tmux set -q @ttheme_shown "$TTHEME_ITERM_SHOWN" 2>/dev/null
  return 0
}

__tt_osc_apply() {
  local -a p=(${=1})
  (( ${#p} >= 20 )) || return 1
  local REPLY
  if __tt_profiled "$1"; then
    __tt_profile $REPLY
  else
    __tt_osc_colors "$1"
    __tt_out "$REPLY"
    TTHEME_ITERM_DYED=1
  fi
  export TTHEME_PAINTED=1
  (( TTHEME_TMUX )) && tmux set -q @ttheme_bg "$p[1]" 2>/dev/null
  return 0
}

__tt_osc_reset() {
  if [[ $TTHEME_ITERM_SWITCH != 1 ]]; then
    __tt_out $'\e]104\e\\\e]110\e\\\e]111\e\\\e]112\e\\\e]117\e\\'
  elif (( TTHEME_TMUX || TTHEME_ITERM_DYED )) || [[ $TTHEME_ITERM_SHOWN != "${TTHEME_STARTUP:+default}" ]]; then
    __tt_profile ""
  fi
  unset TTHEME_PAINTED
  (( TTHEME_TMUX )) && tmux set -qu @ttheme_bg 2>/dev/null
  return 0
}

__tt_pv_leave() {
  [[ $TTHEME_ITERM_SWITCH == 1 && $painted != "$orig" ]] || return 0
  printf '\e[?2026h'
  if [[ -n $orig ]]; then
    __tt_apply "$orig"
  else
    __tt_osc_reset
  fi
  printf '\e[?2026l'
  painted=$orig
}

__tt_pv_paint() {
  local -a p=(${=1})
  local REPLY
  if (( ${#p} < 20 )); then
    if [[ $TTHEME_ITERM_SWITCH == 1 ]]; then
      __tt_osc_reset
    else
      __tt_out $'\e]110\e\\\e]111\e\\'
    fi
    return 0
  fi
  if __tt_profiled "$1"; then
    __tt_apply "$1" && painted=$1
    return 0
  fi
  (( TTHEME_ITERM_DYED )) || TTHEME_ITERM_DYED=2
  if [[ $p[1] == - ]]; then
    __tt_out $'\e]111\e\\\e]10;'$p[2]$'\e\\'
  else
    __tt_out $'\e]11;'$p[1]$'\e\\\e]10;'$p[2]$'\e\\'
  fi
}

__tt_bg_shown() {
  REPLY=""
  (( TTHEME_TMUX )) && REPLY=$(tmux show -qv @ttheme_shown 2>/dev/null)
  [[ -n $REPLY ]] || REPLY=$TTHEME_ITERM_SHOWN
  [[ $REPLY == default ]] && REPLY=$TTHEME_STARTUP
  [[ -n $REPLY ]]
}

__tt_shown() {
  local dir=${TTHEME_CONFIG:h}/backgrounds was REPLY
  __tt_bg_shown
  was=$REPLY
  if __tt_switchable $1; then
    [[ $was == $1 ]] && (( ! TTHEME_ITERM_DYED )) || __tt_profile $1
    return 1
  fi
  [[ $2 != force && $was == $1 ]] && return 1
  [[ -r $dir/${${1/@/--}/\//--}.conf || ( -n $was && -r $dir/${${was/@/--}/\//--}.conf ) ]] || (( TTHEME_MUXED )) || return 1
  (( ${TTHEME_ORDER[(Ie)$1]} )) || return 1
  __tt_profile $1
  return 1
}

__tt_unshown() {
  local want=${TTHEME_STARTUP:+default} was=$TTHEME_ITERM_SHOWN
  (( TTHEME_TMUX )) && was=$(tmux show -qv @ttheme_shown 2>/dev/null)
  [[ $1 != force && $was == "$want" ]] && return 0
  __tt_profile ""
}

__tt_bg_cells() {
  local REPLY resp
  local -a p
  __tt_ask $'\e]1337;ReportCellSize\a' || return 0
  resp=$REPLY
  [[ $resp == *ReportCellSize=*($'\a'|$'\e\\') ]] || return 0
  p=(${(s:;:)${${resp##*ReportCellSize=}%%($'\a'|$'\e\\')*}})
  (( ${#p} == 3 )) || return 0
  bgch=${$(( p[1] * p[3] + 0.5 ))%.*} bgcw=${$(( p[2] * p[3] + 0.5 ))%.*}
}

__tt_bg_crop() {
  local img=$1 band
  local -i iw=$2 ih=$3 y=$4 h=$5 d=$(( 2 * $4 + $5 - $3 ))
  if (( d * d <= 1 )); then
    __tt_bg_send $img
    REPLY="$REPLY $y"
    return 0
  fi
  [[ -n $bgcut ]] || bgcut=$(mktemp -d) || return 1
  band=$bgcut/${${img:t}%.png}-$y-$h.png
  [[ -r $band ]] || __tt_bg_bake $img $band $iw $h $iw $ih 0 $(( -y )) || return 1
  __tt_bg_send $band
  REPLY="$REPLY 0"
}
