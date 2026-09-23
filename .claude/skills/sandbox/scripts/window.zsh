#!/usr/bin/env zsh
emulate -L zsh
setopt err_return pipe_fail

source ${${(%):-%x}:A:h}/lib.zsh

usage() { print -u2 "usage: window.zsh --kitty|--alacritty|--wezterm [--shots DIR] [--keep] [--empty | palette…] -- 'zsh commands'" }

main() {
  local -a shots keep empty kind
  zparseopts -D -E -F -- -shots:=shots -keep=keep -empty=empty -kitty=kind -alacritty=kind -wezterm=kind || { usage; return 1 }
  (( $#kind == 1 )) || { usage; return 1 }
  local split=${@[(i)--]}
  (( split <= $# )) || { usage; return 1 }
  local -a palettes=(${@[1,split-1]})
  local -A pattern=(--kitty "kitty --config $SANDBOX/" --alacritty "alacritty --config-file $SANDBOX/" --wezterm "wezterm-gui --config-file $SANDBOX/")
  local gui=$pattern[$kind[1]] dir=${shots[-1]:+${shots[-1]:A}} hook out pid
  [[ -z $dir ]] || mkdir -p $dir
  hook=$(mktemp -t ttheme-hook)
  write_hook $hook $HERE/probe.zsh -- ${@[split+1,-1]}
  if ! out=$(cd $ROOT && mise run sandbox $kind --behind --zshenv $hook $empty $palettes 2>&1); then
    rm -f $hook
    print -r -- $out
    return 1
  fi
  rm -f $hook
  pid=$(pgrep -f -- $gui | head -1)
  if ! await_run $pid $dir; then
    print -u2 "the first prompt never finished the commands — the window may have failed to open (see $SANDBOX)"
    (( $#keep )) || pkill -f -- $gui || :
    return 1
  fi
  sleep 0.6
  print -r -- "instance  $pid"
  report
  [[ -z $dir ]] || { capture $pid $dir/end.png && print -r -- "shot      $dir/end.png" >> $SANDBOX/shots.list }
  tail_report
  (( $#keep )) || pkill -f -- $gui || :
}

main $@
