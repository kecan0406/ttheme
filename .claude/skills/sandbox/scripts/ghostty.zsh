#!/usr/bin/env zsh
emulate -L zsh
setopt err_return pipe_fail

typeset -g HERE=${${(%):-%x}:A:h}
typeset -g ROOT=${HERE:h:h:h:h}
typeset -g SANDBOX=${${TMPDIR:-/tmp}%/}/ttheme-sandbox

usage() { print -u2 "usage: ghostty.zsh [--shot FILE] [--keep] [palette…] -- 'zsh commands'" }

instance() { pgrep -f -- "--config-file=$SANDBOX/" }

window_of() {
  osascript -l JavaScript -e "ObjC.import('CoreGraphics');
    const w = ObjC.castRefToObject(\$.CGWindowListCopyWindowInfo(\$.kCGWindowListOptionOnScreenOnly, 0)).js
      .map(d => d.js)
      .filter(d => d.kCGWindowOwnerPID.js === $1 && d.kCGWindowLayer.js === 0)
      .sort((a, b) => b.kCGWindowBounds.js.Height.js - a.kCGWindowBounds.js.Height.js)[0];
    w ? w.kCGWindowNumber.js : ''"
}

reloads() {
  local -a seen=(${(f)"$(/usr/bin/log show --info --style compact --start $1 \
    --predicate 'process == "ghostty" AND eventMessage CONTAINS "in response to SIGUSR2"' 2>/dev/null |
    grep -oE 'ghostty\[[0-9]+' | cut -d'[' -f2 | sort | uniq -c | awk '{print $2 "×" $1}')"})
  print -r -- "${seen:-none}"
}

main() {
  local -a shot keep
  zparseopts -D -E -F -- -shot:=shot -keep=keep || { usage; return 1 }
  local split=${@[(i)--]}
  (( split <= $# )) || { usage; return 1 }
  local -a palettes=(${@[1,split-1]})
  local hook out i wid pid start
  hook=$(mktemp -t ttheme-hook)
  start=$(date '+%Y-%m-%d %H:%M:%S')
  { <$HERE/probe.zsh; print -rl -- '__sb_commands() {' "${(j:; :)@[split+1,-1]}" '}' } > $hook
  if ! out=$(cd $ROOT && mise run sandbox --ghostty --behind --zshenv $hook $palettes 2>&1); then
    rm -f $hook
    print -r -- $out
    return 1
  fi
  rm -f $hook
  for i in {1..150}; do
    [[ -s $SANDBOX/run.status ]] && break
    sleep 0.2
  done
  if [[ ! -s $SANDBOX/run.status ]]; then
    print -u2 "the first prompt never ran the commands — the window may have failed to open (see $SANDBOX)"
    (( $#keep )) || pkill -f -- "--config-file=$SANDBOX/" || :
    return 1
  fi
  sleep 0.6
  pid=$(instance)
  print -r -- "instance  $pid"
  print -r -- "status    $(<$SANDBOX/run.status)"
  print -r -- "$(<$SANDBOX/run.out)"
  print -r -- "reloads   $(reloads $start)"
  [[ -s $SANDBOX/run.err ]] && print -r -- "stderr" "$(<$SANDBOX/run.err)"
  if (( $#shot )); then
    wid=$(window_of $pid)
    screencapture -x -o -l $wid $shot[-1]
    sips -Z 1200 $shot[-1] > /dev/null
    print -r -- "screenshot $shot[-1]"
  fi
  (( $#keep )) || pkill -f -- "--config-file=$SANDBOX/" || :
}

main $@
