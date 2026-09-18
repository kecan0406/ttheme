#!/usr/bin/env zsh
emulate -L zsh
setopt err_return pipe_fail

typeset -g HERE=${${(%):-%x}:A:h}
typeset -g ROOT=${HERE:h:h:h:h}
typeset -g SOCKET=ttheme-sandbox
typeset -g COLS=110 ROWS=32

show() {
  tmux -L $SOCKET capture-pane -p $@ |
    awk '{sub(/[[:space:]]+$/, "")} {lines[n++]=$0} END{while(n>0 && lines[n-1]=="") n--; for(i=0;i<n;i++) print lines[i]}'
}

settle() {
  local before='' after='' i
  for i in {1..80}; do
    after=$(tmux -L $SOCKET capture-pane -p 2>/dev/null) || return 0
    [[ -n ${after//[[:space:]]/} && $after == $before ]] && return 0
    before=$after
    sleep 0.12
  done
}

start() {
  local i
  tmux -L $SOCKET kill-server 2>/dev/null || :
  tmux -L $SOCKET new-session -d -x $COLS -y $ROWS -c $ROOT "mise run sandbox --zshenv $HERE/quiet.zsh $*"
  for i in {1..300}; do
    tmux -L $SOCKET capture-pane -p 2>/dev/null | grep -q '^sandbox .*%' && break
    sleep 0.2
  done
  settle
  show
}

case $1 in
  start) shift; start $@ ;;
  send) shift; tmux -L $SOCKET send-keys -- $@; settle; show ;;
  show) shift; show $@ ;;
  stop) tmux -L $SOCKET kill-server 2>/dev/null || : ;;
  *) print -u2 "usage: shell.zsh start [palette…] | send <tmux keys…> | show [-e] | stop"; return 1 ;;
esac
