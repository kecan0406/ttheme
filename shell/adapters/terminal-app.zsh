source $TTHEME_HOME/adapters/_bg.zsh

typeset -g TTHEME_TERMINAL_BASE="" TTHEME_TERMINAL_VIEW=""
typeset -gi TTHEME_TERMINAL_RFD=0 TTHEME_TERMINAL_WFD=0 TTHEME_TERMINAL_PID=0 TTHEME_TERMINAL_VIEWS=0 TTHEME_TERMINAL_RESHAPE=0
(( ${+TTHEME_TERMINAL_SHOWN} )) || typeset -gx TTHEME_TERMINAL_SHOWN=""

__tt_terminal_wired() { (( ${TTHEME_TERMINALS[(Ie)terminal-app]} )) }

__tt_keepable() { __tt_terminal_wired }

__tt_follows_focus() { return 0 }

__tt_pv_bg_findable() { return 1 }

__tt_hear() {
  local q=$'\e]11;?\e\\\e]10;?\e\\\e]12;?\e\\\e]17;?\e\\' v i resp
  local -A got
  for i in {0..15}; do q+=$'\e]4;'$i$';?\e\\'; done
  __tt_terminal_wired && q+=$'\e[14t'
  __tt_ask $q || return 1
  resp=$REPLY
  [[ $resp == *'[4;'<1->';'<1->t* ]] && __tt_terminal_shape ${${resp##*\[4;}%%t*}
  __tt_colors "$resp"
  REPLY=""
  v="$got[11] $got[10] $got[12] ${got[17]:-$got[11]}"
  for i in {0..15}; do v+=" ${got[4;$i]}"; done
  (( ${#${=v}} == 20 )) || return 1
  REPLY=$v
}

__tt_heard() { TTHEME_TERMINAL_BASE=$1 }

__tt_terminal_shape() {
  local -a hw=(${(s:;:)1})
  local f=$TTHEME_STATE_DIR/terminal-app.window want was=""
  (( ${#hw} == 2 )) || return 0
  want=$hw[2]x$hw[1]
  [[ -r $f ]] && was=$(<$f)
  [[ $want != "$was" ]] || return 0
  [[ -d $TTHEME_STATE_DIR ]] || mkdir -p $TTHEME_STATE_DIR 2>/dev/null
  __tt_put $f "$want" 2>/dev/null
  if [[ $was == <1->x<1-> ]]; then
    local -i a=$(( 1000 * hw[2] / hw[1] )) b=$(( 1000 * ${was%x*} / ${was#*x} ))
    (( a * 100 > b * 104 || b * 100 > a * 104 )) || return 0
  fi
  TTHEME_TERMINAL_RESHAPE=1
}

__tt_follows_prompt() { __tt_terminal_wired }

__tt_prompted() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  (( TTHEME_TERMINAL_RESHAPE )) || return 0
  TTHEME_TERMINAL_RESHAPE=0
  [[ -n $TTHEME_TERMINAL_PICTURES && -n $TTHEME_ORDER[1] ]] || return 0
  __tt_cli image $TTHEME_ORDER[1] tuned >/dev/null 2>&1 &!
}

__tt_takes_default() { __tt_terminal_wired && __tt_osc_reset }

__tt_reverts() { return 1 }

__tt_terminal_tell() {
  local out
  out=$(osascript -e 'on run argv' -e "tell application \"Terminal\"" -e "if not (exists settings set (item 2 of argv)) then return \"missing\"" \
    -e 'set default settings to settings set (item 2 of argv)' -e 'set startup settings to settings set (item 2 of argv)' \
    -e 'end tell' -e 'return "ok"' -e 'end run' "$@" 2>/dev/null)
  [[ $out == ok ]]
}

__tt_terminal_switch() {
  REPLY=""
  [[ -n $TTY && -n $1 ]] && (( ! TTHEME_TMUX )) && __tt_terminal_wired || return 1
  local base=${TTHEME_TERMINAL_APP_BASE:-Basic}
  if (( TTHEME_TERMINAL_WFD )); then
    print -r -u $TTHEME_TERMINAL_WFD -- "tab"$'\t'"$TTY"$'\t'"$1"$'\t'"$base" 2>/dev/null &&
      read -r -t 2 -u $TTHEME_TERMINAL_RFD REPLY
  else
    REPLY=$(osascript -l JavaScript $TTHEME_HOME/terminal-app.js tab $TTY "$1" "$base" 2>/dev/null)
  fi
  [[ $REPLY == worn ]]
}

__tt_terminal_version() {
  local -A v=(${=TTHEME_TERMINAL_PICTURES})
  REPLY="$1 ${v[${${1/@/--}/\//--}]:--}"
}

__tt_terminal_wear() {
  local REPLY want
  __tt_terminal_version $1
  want=$REPLY
  [[ $want == "$TTHEME_TERMINAL_SHOWN" ]] && return 0
  if __tt_terminal_switch "ttheme · $1"; then
    TTHEME_TERMINAL_SHOWN=$want
    return 0
  fi
  TTHEME_TERMINAL_SHOWN=""
  return 1
}

__tt_osc_apply() {
  local -a p=(${=1})
  (( ${#p} >= 20 )) || return 1
  local REPLY
  __tt_name_of "$1"
  if ! __tt_terminal_wired || [[ ${TTHEME_PALETTE[$REPLY]} != "$1" ]] || ! __tt_terminal_wear $REPLY; then
    [[ -n $TTHEME_TERMINAL_SHOWN ]] && __tt_terminal_switch "${TTHEME_TERMINAL_APP_BASE:-Basic}"
    TTHEME_TERMINAL_SHOWN=""
    __tt_osc_colors "$1"
    __tt_out "$REPLY"
  fi
  export TTHEME_PAINTED=1
  (( TTHEME_TMUX )) && tmux set -q @ttheme_bg "$p[1]" 2>/dev/null
  __tt_worn "$1"
  return 0
}

__tt_osc_reset() {
  local spec=${TTHEME_STARTUP:+${TTHEME_PALETTE[$TTHEME_STARTUP]}} REPLY
  if __tt_terminal_wired && [[ -n $spec ]]; then
    __tt_osc_apply "$spec"
  elif __tt_terminal_wired && [[ -n $TTHEME_TERMINAL_APP_BASE ]] && __tt_terminal_switch "$TTHEME_TERMINAL_APP_BASE"; then
    TTHEME_TERMINAL_SHOWN=""
  elif [[ -n $TTHEME_TERMINAL_BASE ]]; then
    __tt_osc_apply "$TTHEME_TERMINAL_BASE"
  fi
  unset TTHEME_PAINTED
  return 0
}

__tt_terminal_follow() {
  local REPLY name=${TTHEME_TERMINAL_SHOWN%% *}
  [[ -n $name ]] || return 0
  __tt_terminal_version $name
  [[ $REPLY == "$TTHEME_TERMINAL_SHOWN" ]] && return 0
  if [[ -z ${TTHEME_PALETTE[$name]} ]]; then
    TTHEME_TERMINAL_SHOWN=""
  elif ! __tt_terminal_wear $name; then
    __tt_osc_colors "${TTHEME_PALETTE[$name]}"
    __tt_out "$REPLY"
  fi
}

__tt_reloaded() {
  __tt_terminal_wired || return 0
  local want f=$TTHEME_STATE_DIR/terminal-app.default was=""
  __tt_terminal_follow
  want=$(defaults read com.apple.Terminal 'Default Window Settings' 2>/dev/null) || return 0
  [[ -r $f ]] && was=$(<$f)
  [[ -n $want && $want != "$was" ]] || return 0
  __tt_terminal_tell default "$want" && __tt_put $f "$want"
  return 0
}

__tt_cli_env() {
  [[ -n $TTHEME_TERMINAL_SHOWN ]] && pass+=(TTHEME_TERMINAL_SHOWN=$TTHEME_TERMINAL_SHOWN TTHEME_TTY=$TTY)
}

__tt_pv_leave() {
  [[ $painted != "$orig" ]] || return 0
  if [[ -n $orig ]]; then
    __tt_apply "$orig"
  else
    __tt_osc_reset
  fi
  painted=$orig
}

__tt_pv_forget() {
  TTHEME_TERMINAL_SHOWN=""
  __tt_out $'\e]104\e\\\e]110\e\\\e]111\e\\\e]112\e\\\e]117\e\\'
}

__tt_bg_shown() {
  REPLY=${TTHEME_TERMINAL_SHOWN%% *}
  [[ -n $REPLY ]]
}

__tt_bg_cells() {
  local REPLY resp
  local -a px cells
  __tt_ask $'\e[14t\e[18t' || return 0
  resp=$REPLY
  [[ $resp == *'[4;'<1->';'<1->t* && $resp == *'[8;'<1->';'<1->t* ]] || return 0
  px=(${(s:;:)${${resp##*\[4;}%%t*}}) cells=(${(s:;:)${${resp##*\[8;}%%t*}})
  bgch=$(( 2 * px[1] / cells[1] )) bgcw=$(( 2 * px[2] / cells[2] ))
}

__tt_bg_send() { return 1 }

__tt_bg_wipe() { REPLY="" }

__tt_bg_refresh() {
  TTHEME_TERMINAL_VIEW=""
  __tt_palettes_load && __tt_terminal_follow
  return 0
}

__tt_pv_bg_open() {
  setopt localoptions nomonitor nonotify
  bgcw=0 bgch=0 bginc="" bgrel=0 bgmx=0 bgmy=0 bganchor=0
  local REPLY
  __tt_bg_shown && bginc=$REPLY
  (( TTHEME_TMUX )) && return 0
  __tt_bg_cells
  TTHEME_TYPED=
  __tt_terminal_wired && [[ -n $TTY ]] || return 0
  coproc osascript -l JavaScript $TTHEME_HOME/terminal-app.js serve 2>/dev/null
  exec {TTHEME_TERMINAL_RFD}<&p {TTHEME_TERMINAL_WFD}>&p
  TTHEME_TERMINAL_PID=$!
}

__tt_terminal_tuned() {
  [[ $1 == *:* ]] && return 0
  __tt_bg_load $1
  [[ "${bgsize[$1]} ${bgpos[$1]} ${bgop[$1]} ${bgoff[$1]}" != "${bgload[$1]}" ]]
}

__tt_terminal_view() {
  local name=$1 pal=${1%:*} img out place stem REPLY
  local -a wh fr held
  local -i W=$(( pw * bgcw )) H=$(( ph * bgch ))
  stem=${${pal/@/--}/\//--}
  held=(${TTHEME_CONFIG:h}/terminal-app/ttheme-$stem.*.png(N))
  (( ${#held} && W && H )) || return 1
  __tt_bg_load $name
  if [[ ${bgsize[$name]} == fill ]]; then
    img=${bgfill[$name]}
    __tt_bg_dim "$img" || return 1
    wh=(${=bgdim[$img]})
    __tt_bg_frame $wh[1] $wh[2] $W $H 100 ${bgpos[$name]} cover
  else
    img=${bgsrc[$name]}
    __tt_bg_dim "$img" || return 1
    wh=(${=bgdim[$img]})
    __tt_bg_frame $wh[1] $wh[2] $W $H ${bgsize[$name]} ${bgpos[$name]} contain ${bgfocus[$name]}
  fi
  fr=(${=REPLY})
  printf -v place '%dx%d%+d%+d' $fr
  out=${held[1]:h}/ttheme-$stem.v$$-$(( ++TTHEME_TERMINAL_VIEWS )).png
  __tt_cli flatten "$img" "$out" "${${TTHEME_PALETTE[$pal]}%% *}" "$(( bgoff[$name] ? 0 : ${bgop[$name]} ))" ${W}x$H $place $held[1] >/dev/null 2>&1 || return 1
  TTHEME_TERMINAL_VIEW=$name
  __tt_terminal_switch "ttheme · $pal" && TTHEME_TERMINAL_SHOWN="$pal -"
  return 0
}

__tt_terminal_unview() {
  [[ -n $TTHEME_TERMINAL_VIEW ]] || return 0
  local pal=${TTHEME_TERMINAL_VIEW%:*}
  TTHEME_TERMINAL_VIEW=""
  __tt_cli image $pal tuned >/dev/null 2>&1
  __tt_palettes_load
  [[ ${TTHEME_TERMINAL_SHOWN%% *} == $pal ]] || return 0
  TTHEME_TERMINAL_SHOWN=""
  __tt_terminal_wear $pal
}

__tt_pv_bg_show() {
  (( bgcw )) || return 0
  bgname=$1
  if __tt_terminal_tuned $1; then
    __tt_terminal_view $1
  elif [[ -n $TTHEME_TERMINAL_VIEW ]]; then
    __tt_terminal_unview
  fi
  return 0
}

__tt_pv_bg_close() {
  setopt localoptions nomonitor nonotify
  (( ${+bgedit[$bgname]} )) || [[ -n $bgname && ${bgview[${bgname%:*}]} == "$bgname" ]] || __tt_terminal_unview
  (( TTHEME_TERMINAL_WFD )) && exec {TTHEME_TERMINAL_WFD}>&-
  (( TTHEME_TERMINAL_RFD )) && exec {TTHEME_TERMINAL_RFD}<&-
  (( TTHEME_TERMINAL_PID )) && { kill $TTHEME_TERMINAL_PID 2>/dev/null; wait $TTHEME_TERMINAL_PID 2>/dev/null }
  TTHEME_TERMINAL_WFD=0 TTHEME_TERMINAL_RFD=0 TTHEME_TERMINAL_PID=0
  return 0
}

() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  [[ -o interactive && -t 1 ]] || return 0
  __tt_listen
  local spec=${TTHEME_STARTUP:+${TTHEME_PALETTE[$TTHEME_STARTUP]}} REPLY
  [[ -n $spec && -z $TTHEME_PAINTED && ${TTHEME_TERMINAL_BASE%% *} == "${spec%% *}" ]] && __tt_terminal_wired || return 0
  if [[ $TTHEME_TERMINAL_BASE == "$spec" ]]; then
    __tt_terminal_version $TTHEME_STARTUP
    TTHEME_TERMINAL_SHOWN=$REPLY
  else
    __tt_osc_apply "$spec"
    unset TTHEME_PAINTED
  fi
}
