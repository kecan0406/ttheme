typeset -g TTHEME_GHOSTTY_PID=""

__tt_reload() {
  local wired
  for wired in $TTHEME_TERMINALS; do
    (( $+functions[__tt_reload_$wired] )) && __tt_reload_$wired
  done
  return 0
}

__tt_pictured() {
  local wired
  for wired in $TTHEME_TERMINALS; do
    (( $+functions[__tt_pictured_$wired] )) && __tt_pictured_$wired "$@"
  done
  return 0
}

__tt_reload_ghostty() {
  local pid=$PPID ppid comm owner=$TTHEME_GHOSTTY_PID
  (( TTHEME_TMUX )) && { pid=$(tmux display -p '#{client_pid}' 2>/dev/null) owner="" }
  if [[ -z $owner ]]; then
    owner=0
    while (( pid > 1 )); do
      read -r ppid comm <<< "$(ps -o ppid=,comm= -p $pid)"
      if [[ ${comm:t} == ghostty ]]; then
        owner=$pid
        break
      fi
      pid=$ppid
    done
    (( TTHEME_TMUX )) || TTHEME_GHOSTTY_PID=$owner
  fi
  (( owner )) && kill -USR2 $owner 2>/dev/null && return
  pkill -USR2 -x ghostty 2>/dev/null
}

__tt_ghostty_shown() {
  local f=${TTHEME_CONFIG:h}/backgrounds/shown.conf
  REPLY=""
  [[ -r $f ]] || return 1
  REPLY=${${"$(<$f)"}##*\?}
  REPLY=${REPLY%.conf}
  REPLY=${${REPLY/--/@}/--//}
}

__tt_pictured_ghostty() {
  local REPLY
  __tt_ghostty_shown && (( ${@[(Ie)$REPLY]} )) && __tt_reload_ghostty
  return 0
}

__tt_pictured_iterm2() { __tt_cli image $1 tuned }

__tt_pictured_warp() { (( ${TTHEME_TERMINALS[(Ie)iterm2]} )) || __tt_cli image $1 tuned }

__tt_bg_aligns() { (( ! ${TTHEME_TERMINALS[(Ie)iterm2]} && ! ${TTHEME_TERMINALS[(Ie)warp]} )) }

__tt_bg_covers() { (( ${TTHEME_TERMINALS[(Ie)warp]} )) }
