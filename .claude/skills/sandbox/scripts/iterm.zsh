#!/usr/bin/env zsh
emulate -L zsh
setopt err_return pipe_fail

source ${${(%):-%x}:A:h}/lib.zsh

typeset -g SUITE=ttheme-sandbox
typeset -g ITERM_APP="^[^ ]*/iTerm2 -suite $SUITE( |$)"
typeset -g ITERM_SERVER="^$HOME/Library/Application Support/$SUITE/iTermServer"

usage() { print -u2 "usage: iterm.zsh [--shots DIR] [--keep] [--legacy] [--trust] [--empty | palette…] -- 'zsh commands'" }

quit() {
  pkill -f -- $ITERM_APP 2>/dev/null || :
  sleep 0.5
  pkill -f -- $ITERM_SERVER 2>/dev/null || :
}

main() {
  local -a shots keep legacy trust empty
  zparseopts -D -E -F -- -shots:=shots -keep=keep -legacy=legacy -trust=trust -empty=empty || { usage; return 1 }
  local split=${@[(i)--]}
  (( split <= $# )) || { usage; return 1 }
  local -a palettes=(${@[1,split-1]})
  local dir=${shots[-1]:+${shots[-1]:A}} hook out pid
  [[ -z $dir ]] || mkdir -p $dir
  hook=$(mktemp -t ttheme-hook)
  write_hook $hook $HERE/probe.zsh $HERE/iterm-probe.zsh -- ${@[split+1,-1]}
  if ! out=$(cd $ROOT && mise run sandbox --iterm --behind $legacy $trust --zshenv $hook $empty $palettes 2>&1); then
    rm -f $hook
    print -r -- $out
    return 1
  fi
  rm -f $hook
  pid=$(pgrep -f -- $ITERM_APP)
  if ! await_run $pid $dir; then
    print -u2 "the first prompt never finished the commands — the window may be stuck on a dialog (see $SANDBOX)"
    [[ -z $dir ]] || { capture $pid $dir/stuck.png && print -u2 "screen: $dir/stuck.png" }
    (( $#keep )) || quit
    return 1
  fi
  sleep 0.6
  print -r -- "instance  $pid"
  report
  [[ -z $dir ]] || { capture $pid $dir/end.png && print -r -- "shot      $dir/end.png" >> $SANDBOX/shots.list }
  tail_report
  (( $#keep )) || quit
}

main $@
