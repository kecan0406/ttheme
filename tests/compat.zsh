#!/usr/bin/env zsh
emulate -L zsh
setopt err_return pipe_fail

typeset -g ROOT=${${(%):-%x}:A:h:h}
typeset -g SANDBOX=${${TMPDIR:-/tmp}%/}/ttheme-sandbox
typeset -g OUT=${${TMPDIR:-/tmp}%/}/ttheme-compat
typeset -g EXPECT=$ROOT/tests/compat/expect.tsv
typeset -ga TERMINALS=(ghostty iterm2 wezterm warp terminal-app)
typeset -gA FLAG=(ghostty '' iterm2 --iterm wezterm --wezterm warp --warp terminal-app --terminal-app)
typeset -gA ADAPTER=(ghostty ghostty iterm2 iterm2 wezterm wezterm warp warp terminal-app terminal-app)

installed() {
  case $1 in
    ghostty) [[ -d /Applications/Ghostty.app ]] ;;
    iterm2) [[ -d /Applications/iTerm.app ]] ;;
    wezterm) [[ -x ${TTHEME_WEZTERM_APP:-/Applications/WezTerm.app}/Contents/MacOS/wezterm-gui ]] ;;
    warp) [[ -d /Applications/Warp.app ]] ;;
    terminal-app) [[ -d /System/Applications/Utilities/Terminal.app ]] ;;
    *) return 1 ;;
  esac
}

pids_of() {
  case $1 in
    ghostty) pgrep -f -- "--config-file=$SANDBOX/" ;;
    iterm2) pgrep -f -- "iTerm2 -suite ttheme-sandbox" ;;
    wezterm) pgrep -f -- "wezterm-gui --config-file $SANDBOX/" ;;
    warp) pgrep -f -- "/Applications/Warp.app/Contents/MacOS/" ;;
    terminal-app) pgrep -x Terminal ;;
  esac | tr '\n' ' '
}

window_of() {
  osascript -l JavaScript -e "ObjC.import('CoreGraphics');
    const pids = '$1'.split(' ').filter(Boolean).map(Number);
    const all = ObjC.castRefToObject(\$.CGWindowListCopyWindowInfo(\$.kCGWindowListOptionOnScreenOnly, 0)).js
      .map(d => d.js).filter(d => d.kCGWindowLayer.js === 0 && pids.includes(d.kCGWindowOwnerPID.js));
    const name = (d) => d.kCGWindowName ? d.kCGWindowName.js : '';
    const big = (a, b) => b.kCGWindowBounds.js.Height.js - a.kCGWindowBounds.js.Height.js;
    const old = '$3'.split(' ');
    const w = all.filter(d => name(d).includes('$2')).sort(big)[0]
      || all.filter(d => !old.includes(String(d.kCGWindowNumber.js))).sort(big)[0];
    w ? w.kCGWindowNumber.js : ''"
}

windows_of() {
  osascript -l JavaScript -e "ObjC.import('CoreGraphics');
    const pids = '$1'.split(' ').filter(Boolean).map(Number);
    ObjC.castRefToObject(\$.CGWindowListCopyWindowInfo(0, 0)).js.map(d => d.js)
      .filter(d => pids.includes(d.kCGWindowOwnerPID.js)).map(d => d.kCGWindowNumber.js).join(' ')"
}

sample() { osascript -l JavaScript $ROOT/tests/compat/sample.js $1 }

serve() {
  local term=$1 title=$2 old=$3 req wid shot color i
  for req in $SANDBOX/compat/*.req(N); do
    sleep 0.4
    wid=$(window_of "$(pids_of $term)" $title $old)
    shot=$OUT/$term-${req:t:r}.png
    [[ -n $wid ]] && screencapture -x -o -l $wid $shot || continue
    for i in 1 2 3; do
      color=$(sample $shot 2>/dev/null) && [[ $color == *'#'* ]] && break
      sleep 0.3
    done
    print -r -- $color > $SANDBOX/compat/${req:t:r}.done
    rm -f -- $req
  done
}

quit() {
  case $1 in
    terminal-app) (( $2 )) || pkill -x Terminal 2>/dev/null || : ;;
    ghostty) pkill -f -- "--config-file=$SANDBOX/" 2>/dev/null || : ;;
    iterm2) pkill -f -- "iTerm2 -suite ttheme-sandbox" 2>/dev/null || : ;;
    wezterm) pkill -f -- "wezterm-gui --config-file $SANDBOX/" 2>/dev/null || : ;;
    warp) rm -f -- $HOME/.warp/launch_configurations/ttheme-sandbox.yaml ;;
  esac
  return 0
}

measure() {
  local term=$1 hook i title=ttheme-compat-$1-$$ was=0 old
  old=$(windows_of "$(pids_of $term)")
  [[ $term == terminal-app ]] && pgrep -x Terminal > /dev/null && was=1
  hook=$(mktemp -t ttheme-compat)
  print -rl -- "typeset -g CC_ADAPTER=$ADAPTER[$term] CC_TITLE=$title" "source ${(q)ROOT}/tests/compat/cases.zsh" > $hook
  if ! zsh $ROOT/tests/sandbox.zsh --behind ${FLAG[$term]:+$FLAG[$term]} --zshenv $hook miku asuka > /dev/null; then
    rm -f $hook
    return 1
  fi
  rm -f $hook
  for i in {1..900}; do
    [[ -e $SANDBOX/compat/done ]] && break
    [[ -d $SANDBOX/compat ]] && serve $term $title "$old"
    sleep 0.1
  done
  quit $term $was
  [[ -e $SANDBOX/compat/done ]] || { print -u2 "$term: the cases never finished"; return 1 }
  cp $SANDBOX/compat/results $OUT/$term.tsv
  [[ -s $SANDBOX/compat/errors ]] && cp $SANDBOX/compat/errors $OUT/$term.err
  return 0
}

column_of() {
  local -a head=(${=${(f)"$(<$EXPECT)"}[1]})
  REPLY=${head[(Ie)$1]}
}

expected() {
  local line
  column_of $1
  (( REPLY )) || { REPLY='?'; return }
  local -i col=$REPLY
  for line in ${(f)"$(<$EXPECT)"}; do
    [[ ${${=line}[1]} == $2 ]] && { REPLY=${${=line}[col]}; return }
  done
  REPLY='?'
}

update() {
  local term=$1 line id
  local -A got
  for line in ${(f)"$(<$OUT/$term.tsv)"}; do got[${line%%$'\t'*}]=${${(s:	:)line}[2]}; done
  column_of $term
  local -i col=$REPLY
  local -a out=()
  for line in ${(f)"$(<$EXPECT)"}; do
    local -a f=(${=line})
    [[ -n ${got[$f[1]]} ]] && f[col]=$got[$f[1]]
    out+=("${(j:	:)f}")
  done
  print -rl -- $out > $EXPECT
}

report() {
  local -a terms=($@) cases=(${${(f)"$(<$EXPECT)"}[2,-1]%%$'\t'*})
  local term id line mark want got detail
  local -i broken=0
  local -A result note
  for term in $terms; do
    [[ -r $OUT/$term.tsv ]] || continue
    for line in ${(f)"$(<$OUT/$term.tsv)"}; do
      local -a f=("${(@s:	:)line}")
      result[$term.$f[1]]=$f[2] note[$term.$f[1]]=$f[3]
    done
  done
  printf '%-15s' case; printf ' %-13s' $terms; print
  for id in $cases; do
    printf '%-15s' $id
    for term in $terms; do
      got=${result[$term.$id]:-}
      expected $term $id
      want=$REPLY
      if [[ -z $got ]]; then mark="  (not run)"
      elif [[ $want == '?' ]]; then mark="? $got"
      elif [[ $got == $want ]]; then [[ $got == pass ]] && mark="✓ pass" || mark="· $got"
      elif [[ $want == pass ]]; then mark="✗ $got"; broken+=1
      else mark="+ $got"
      fi
      printf ' %-13s' $mark
    done
    print
  done
  print
  for term in $terms; do
    for id in $cases; do
      got=${result[$term.$id]:-}
      expected $term $id
      [[ -n $got && $got != $REPLY ]] && print -r -- "$term $id: $got — ${note[$term.$id]}"
    done
    [[ -s $OUT/$term.err ]] && print -r -- "$term stderr: $(<$OUT/$term.err)"
  done
  print -r -- "✓ as expected · known gap ✗ regression + better than expected ? not measured before — screenshots in $OUT"
  (( ! broken ))
}

main() {
  local -a upd
  zparseopts -D -E -F -- -update=upd || { print -u2 "usage: compat [--update] [${(j:|:)TERMINALS}…]"; return 1 }
  local -a terms=(${@:-$TERMINALS}) ran=()
  local term
  for term in $terms; do
    (( ${TERMINALS[(Ie)$term]} )) || { print -u2 "unknown terminal $term — one of $TERMINALS"; return 1 }
  done
  rm -rf -- $OUT
  mkdir -p $OUT
  for term in $terms; do
    if ! installed $term; then
      print -r -- "$term: not installed, skipped"
      continue
    fi
    print -r -- "$term: running the cases…"
    measure $term && ran+=($term)
  done
  (( ${#ran} )) || return 1
  if (( $#upd )); then
    for term in $ran; do update $term; done
  fi
  report $ran
}

main $@
