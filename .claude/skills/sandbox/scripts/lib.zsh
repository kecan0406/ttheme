typeset -g HERE=${${(%):-%x}:A:h}
typeset -g ROOT=${HERE:h:h:h:h}
typeset -g SANDBOX=${${TMPDIR:-/tmp}%/}/ttheme-sandbox

window_of() {
  osascript -l JavaScript -e "ObjC.import('CoreGraphics');
    const w = ObjC.castRefToObject(\$.CGWindowListCopyWindowInfo(\$.kCGWindowListOptionOnScreenOnly, 0)).js
      .map(d => d.js)
      .filter(d => d.kCGWindowOwnerPID.js === $1 && d.kCGWindowLayer.js === 0)
      .sort((a, b) => b.kCGWindowBounds.js.Height.js - a.kCGWindowBounds.js.Height.js)[0];
    w ? w.kCGWindowNumber.js : ''"
}

capture() {
  local wid
  wid=$(window_of $1)
  [[ -n $wid ]] || return 1
  screencapture -x -o -l $wid $2 && sips -Z 1200 $2 > /dev/null
}

write_hook() {
  local out=$1 split=${@[(i)--]}
  { print -r -- "typeset -g SB_HERE=${(q)HERE}"; cat -- ${@[2,split-1]}; print -rl -- '__sb_commands() {' "${(j:; :)@[split+1,-1]}" '}' } > $out
}

serve() {
  local pid=$1 dir=$2 req name
  for req in $SANDBOX/shots/*.req(N); do
    name=${req:t:r}
    sleep 0.4
    if [[ -n $dir ]] && capture $pid $dir/$name.png; then
      print -r -- "shot      $dir/$name.png" >> $SANDBOX/shots.list
      command mv -f -- $req $SANDBOX/shots/$name.done
    else
      command mv -f -- $req $SANDBOX/shots/$name.skip
    fi
  done
}

settled() {
  local t
  [[ -s $SANDBOX/run.status ]] || return 1
  for t in $SANDBOX/tabs/*.run(N); do [[ -e ${t:r}.status ]] || return 1; done
}

await_run() {
  local pid=$1 dir=$2 i
  for i in {1..1500}; do
    serve $pid $dir
    settled && return 0
    sleep 0.1
  done
  return 1
}

report() {
  print -r -- "status    $(<$SANDBOX/run.status)"
  print -r -- "$(<$SANDBOX/run.out)"
}

tail_report() {
  local t
  for t in $SANDBOX/tabs/*.zsh(N); do print -r -- "tab ${t:t:r} never started"; done
  [[ -s $SANDBOX/run.err ]] && print -r -- "stderr" "$(<$SANDBOX/run.err)"
  [[ -s $SANDBOX/shots.list ]] && print -r -- "$(<$SANDBOX/shots.list)"
  return 0
}
