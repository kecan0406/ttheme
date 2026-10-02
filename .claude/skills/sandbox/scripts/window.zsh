#!/usr/bin/env zsh
emulate -L zsh
setopt err_return pipe_fail

source ${${(%):-%x}:A:h}/lib.zsh

usage() { print -u2 "usage: window.zsh --kitty|--alacritty|--wezterm|--warp|--terminal-app [--shots DIR] [--keep] [--pictured] [--empty | palette…] -- 'zsh commands'" }

main() {
  local -a shots keep empty pictured kind
  zparseopts -D -E -F -- -shots:=shots -keep=keep -empty=empty -pictured=pictured -kitty=kind -alacritty=kind -wezterm=kind -warp=kind -terminal-app=kind ||
    { usage; return 1 }
  (( $#kind == 1 )) || { usage; return 1 }
  local split=${@[(i)--]}
  (( split <= $# )) || { usage; return 1 }
  local -a palettes=(${@[1,split-1]})
  local -A pattern=(--kitty "kitty --config $SANDBOX/" --alacritty "alacritty --config-file $SANDBOX/" --wezterm "wezterm-gui --config-file $SANDBOX/")
  local gui=$pattern[$kind[1]] dir=${shots[-1]:+${shots[-1]:A}} hook out pid
  local -i app=0 was=0
  [[ $kind[1] == (--warp|--terminal-app) ]] && app=1
  [[ $kind[1] == --terminal-app ]] && pgrep -x Terminal > /dev/null && was=1
  [[ -z $dir ]] || mkdir -p $dir
  hook=$(mktemp -t ttheme-hook)
  if (( app )); then
    export SB_NEWEST=1
    write_hook $hook $HERE/probe.zsh -- 'print -r -- $$ > $ZDOTDIR/shell.pid' ${@[split+1,-1]}
  else
    write_hook $hook $HERE/probe.zsh -- ${@[split+1,-1]}
  fi
  if ! out=$(cd $ROOT && mise run sandbox $kind --behind $pictured --zshenv $hook $empty $palettes 2>&1); then
    rm -f $hook
    print -r -- $out
    return 1
  fi
  rm -f $hook
  if [[ $kind[1] == --warp ]]; then
    pid=${${(M)${(f)"$(ps -axo pid=,comm=)"}:#*/Warp.app/Contents/MacOS/*}[1]## #}
    pid=${pid%% *}
  elif [[ $kind[1] == --terminal-app ]]; then
    pid=$(pgrep -x Terminal | head -1)
  else
    pid=$(pgrep -f -- $gui | head -1)
  fi
  if ! await_run $pid $dir; then
    print -u2 "the first prompt never finished the commands — the window may have failed to open (see $SANDBOX)"
    (( app || $#keep )) || pkill -f -- $gui || :
    if [[ $kind[1] == --terminal-app ]] && (( ! $#keep )); then
      (( was )) || { pkill -x Terminal 2>/dev/null || : }
      zsh $ROOT/tests/terminal-prefs.zsh restore
    fi
    return 1
  fi
  sleep 0.6
  print -r -- "instance  $pid"
  report
  [[ -z $dir ]] || { capture $pid $dir/end.png && print -r -- "shot      $dir/end.png" >> $SANDBOX/shots.list }
  tail_report
  (( $#keep )) && return 0
  if (( app )); then
    [[ ! -s $SANDBOX/shell.pid ]] || kill -HUP $(<$SANDBOX/shell.pid) 2>/dev/null || :
    if [[ $kind[1] == --terminal-app ]]; then
      (( was )) || { pkill -x Terminal 2>/dev/null || : }
      zsh $ROOT/tests/terminal-prefs.zsh restore
    fi
  else
    pkill -f -- $gui || :
  fi
  return 0
}

main $@
