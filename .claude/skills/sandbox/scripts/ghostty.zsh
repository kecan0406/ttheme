#!/usr/bin/env zsh
emulate -L zsh
setopt err_return pipe_fail

source ${${(%):-%x}:A:h}/lib.zsh

usage() { print -u2 "usage: ghostty.zsh [--shots DIR] [--keep] [--empty | palette…] -- 'zsh commands'" }

instance() { pgrep -f -- "--config-file=$SANDBOX/" }

reloads() {
  local -a seen=(${(f)"$(/usr/bin/log show --info --style compact --start $1 \
    --predicate 'process == "ghostty" AND eventMessage CONTAINS "in response to SIGUSR2"' 2>/dev/null |
    grep -oE 'ghostty\[[0-9]+' | cut -d'[' -f2 | sort | uniq -c | awk '{print $2 "×" $1}')"})
  print -r -- "${seen:-none}"
}

main() {
  local -a shots keep empty
  zparseopts -D -E -F -- -shots:=shots -keep=keep -empty=empty || { usage; return 1 }
  local split=${@[(i)--]}
  (( split <= $# )) || { usage; return 1 }
  local -a palettes=(${@[1,split-1]})
  local dir=${shots[-1]:+${shots[-1]:A}} hook out pid start
  [[ -z $dir ]] || mkdir -p $dir
  hook=$(mktemp -t ttheme-hook)
  start=$(date '+%Y-%m-%d %H:%M:%S')
  write_hook $hook $HERE/probe.zsh -- ${@[split+1,-1]}
  if ! out=$(cd $ROOT && mise run sandbox --behind --zshenv $hook $empty $palettes 2>&1); then
    rm -f $hook
    print -r -- $out
    return 1
  fi
  rm -f $hook
  pid=$(instance)
  if ! await_run $pid $dir; then
    print -u2 "the first prompt never finished the commands — the window may have failed to open (see $SANDBOX)"
    (( $#keep )) || pkill -f -- "--config-file=$SANDBOX/" || :
    return 1
  fi
  sleep 0.6
  print -r -- "instance  $pid"
  report
  print -r -- "reloads   $(reloads $start)"
  [[ -z $dir ]] || { capture $pid $dir/end.png && print -r -- "shot      $dir/end.png" >> $SANDBOX/shots.list }
  tail_report
  (( $#keep )) || pkill -f -- "--config-file=$SANDBOX/" || :
}

main $@
