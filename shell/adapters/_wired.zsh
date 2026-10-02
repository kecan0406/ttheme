typeset -g TTHEME_GHOSTTY_PID=""
typeset -gi TTHEME_GHOSTTY_SENT=0

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

__tt_ghostty_owner() {
  local pid=$1 ppid comm
  REPLY=0
  while (( pid > 1 )); do
    read -r ppid comm <<< "$(ps -o ppid=,comm= -p $pid)"
    if [[ ${comm:t} == ghostty ]]; then
      REPLY=$pid
      return 0
    fi
    pid=$ppid
  done
  return 1
}

__tt_reload_ghostty() {
  local REPLY owner=$TTHEME_GHOSTTY_PID
  if (( TTHEME_TMUX )); then
    __tt_ghostty_owner "$(tmux display -p '#{client_pid}' 2>/dev/null)"
    owner=$REPLY
  elif [[ -z $owner ]]; then
    __tt_ghostty_owner $PPID
    owner=$REPLY TTHEME_GHOSTTY_PID=$REPLY
  fi
  (( owner )) && kill -USR2 $owner 2>/dev/null && { TTHEME_GHOSTTY_SENT=1; return 0 }
  pkill -USR2 -x ghostty 2>/dev/null && TTHEME_GHOSTTY_SENT=1
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

__tt_pictured_konsole() { (( ${TTHEME_TERMINALS[(Ie)iterm2]} || ${TTHEME_TERMINALS[(Ie)warp]} )) || __tt_cli image $1 tuned }

__tt_pictured_terminal-app() { (( ${TTHEME_TERMINALS[(Ie)iterm2]} || ${TTHEME_TERMINALS[(Ie)warp]} || ${TTHEME_TERMINALS[(Ie)konsole]} )) || __tt_cli image $1 tuned }

__tt_bg_aligns() { (( ! ${TTHEME_TERMINALS[(Ie)iterm2]} && ! ${TTHEME_TERMINALS[(Ie)warp]} )) }

__tt_bg_covers() { (( ${TTHEME_TERMINALS[(Ie)warp]} )) }
