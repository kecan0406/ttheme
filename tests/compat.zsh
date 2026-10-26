#!/usr/bin/env zsh
emulate -L zsh
setopt err_return pipe_fail

typeset -g ROOT=${${(%):-%x}:A:h:h}
typeset -g SANDBOX=${${TMPDIR:-/tmp}%/}/ttheme-sandbox
typeset -g OUT=${TTHEME_COMPAT_OUT:-${${TMPDIR:-/tmp}%/}/ttheme-compat}
typeset -g EXPECT=$ROOT/tests/compat/expect.tsv
typeset -g XVFB=${TTHEME_XVFB_DISPLAY:-:77}
typeset -g TIP=${TTHEME_GHOSTTY_TIP:-/opt/ghostty-tip/bin}
typeset -ga TERMINALS=(ghostty iterm2 wezterm kitty alacritty warp terminal-app konsole rio contour)
typeset -ga LINUX_TERMINALS=(ghostty ghostty-tip kitty alacritty wezterm warp rio contour)
typeset -gA FLAG=(ghostty '' ghostty-tip '' iterm2 '--iterm --trust' wezterm --wezterm kitty --kitty alacritty --alacritty warp --warp terminal-app '--terminal-app --pictured' konsole --konsole rio --rio contour --contour)
typeset -gA ADAPTER=(ghostty ghostty ghostty-tip ghostty iterm2 iterm2 wezterm wezterm kitty kitty alacritty alacritty warp warp terminal-app terminal-app konsole konsole rio rio contour contour)
typeset -gA PATTERN=(ghostty "--config-file=$SANDBOX/" ghostty-tip "--config-file=$SANDBOX/" iterm2 "iTerm2 -suite ttheme-sandbox"
  wezterm "wezterm-gui --config-file $SANDBOX/" kitty "kitty --config $SANDBOX/" alacritty "alacritty --config-file $SANDBOX/"
  warp /Applications/Warp.app/Contents/MacOS/ konsole "konsole --separate --workdir $SANDBOX" rio "rio --working-dir $SANDBOX" contour "contour working-directory $SANDBOX")
typeset -gi LINUX=0
typeset -ga MEASURING=()
if [[ $OSTYPE == linux* ]]; then
  LINUX=1
  PATTERN[warp]='^warp-terminal'
fi

abandon() {
  trap '' HUP INT TERM
  (( ${#MEASURING} )) && { quit $MEASURING || : }
  exit $1
}

trap 'abandon 129' HUP
trap 'abandon 130' INT
trap 'abandon 143' TERM

installed() {
  if (( LINUX )); then
    (( $+commands[Xvfb] && $+commands[xdotool] && $+commands[import] )) || return 1
    case $1 in
      ghostty|kitty|alacritty|rio|contour) (( $+commands[$1] )) ;;
      ghostty-tip) [[ -x $TIP/ghostty ]] ;;
      wezterm) (( $+commands[wezterm-gui] )) ;;
      warp) (( $+commands[warp-terminal] )) ;;
      konsole) (( $+commands[konsole] && $+commands[dbus-run-session] )) ;;
      *) return 1 ;;
    esac
    return
  fi
  case $1 in
    ghostty) [[ -d /Applications/Ghostty.app ]] ;;
    iterm2) [[ -d /Applications/iTerm.app ]] ;;
    wezterm) [[ -x ${TTHEME_WEZTERM_APP:-/Applications/WezTerm.app}/Contents/MacOS/wezterm-gui ]] ;;
    kitty) [[ -x ${TTHEME_KITTY_APP:-/Applications/kitty.app}/Contents/MacOS/kitty ]] ;;
    alacritty) [[ -x ${TTHEME_ALACRITTY_APP:-/Applications/Alacritty.app}/Contents/MacOS/alacritty ]] ;;
    warp) [[ -d /Applications/Warp.app ]] ;;
    terminal-app) [[ -d /System/Applications/Utilities/Terminal.app ]] ;;
    konsole) (( $+commands[konsole] && $+commands[dbus-run-session] && $+commands[Xvfb] && $+commands[xdotool] && $+commands[import] )) ;;
    rio) [[ -x ${TTHEME_RIO_APP:-/Applications/Rio.app}/Contents/MacOS/rio ]] ;;
    contour) [[ -x ${TTHEME_CONTOUR_APP:-/Applications/contour.app}/Contents/MacOS/contour ]] ;;
    *) return 1 ;;
  esac
}

pids_of() {
  if [[ $1 == terminal-app ]]; then
    pgrep -x Terminal
  else
    pgrep -f -- $PATTERN[$1]
  fi | tr '\n' ' '
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

x_window() {
  local pid only
  for only in --onlyvisible ""; do
    for pid in ${=$(pids_of $1)}; do
      REPLY=$(DISPLAY=$XVFB xdotool search $only --pid $pid 2>/dev/null | tail -1) || REPLY=""
      if [[ -n $REPLY ]]; then
        return 0
      fi
    done
  done
  REPLY=""
  return 1
}

sample() {
  if (( LINUX )); then
    bun $ROOT/tests/compat/sample-png.ts $1
  else
    osascript -l JavaScript $ROOT/tests/compat/sample.js $1
  fi
}

shoot() {
  local term=$1 title=$2 old=$3 shot=$4 wid REPLY
  if (( LINUX )); then
    x_window $term || return 1
    DISPLAY=$XVFB import -window $REPLY $shot 2>/dev/null
    return
  fi
  wid=$(window_of "$(pids_of $term)" $title $old)
  [[ -n $wid ]] && screencapture -x -o -l $wid $shot
}

nudge() {
  local pid wid other REPLY
  (( LINUX && $+commands[xmessage] )) || return 1
  x_window $1 || return 1
  wid=$REPLY
  DISPLAY=$XVFB xmessage -geometry +0+0 ttheme-compat > /dev/null 2>&1 &!
  pid=$!
  sleep 0.5
  other=$(DISPLAY=$XVFB xdotool search --class xmessage 2>/dev/null | tail -1)
  [[ -n $other ]] || { kill $pid 2>/dev/null; return 1 }
  DISPLAY=$XVFB xdotool windowfocus $wid; sleep 0.3
  DISPLAY=$XVFB xdotool windowfocus $other; sleep 0.3
  DISPLAY=$XVFB xdotool windowfocus $wid; sleep 0.3
  kill $pid 2>/dev/null
  return 0
}

serve() {
  local term=$1 title=$2 old=$3 req shot color i
  if [[ -e $SANDBOX/compat/focus.req ]]; then
    rm -f -- $SANDBOX/compat/focus.req
    if nudge $term; then
      print -r -- moved > $SANDBOX/compat/focus.done
    else
      print -r -- skip > $SANDBOX/compat/focus.done
    fi
  fi
  for req in $SANDBOX/compat/*.req(N); do
    sleep 0.4
    shot=$OUT/$term-${req:t:r}.png
    shoot $term $title "$old" $shot || continue
    for i in 1 2 3; do
      color=$(sample $shot 2>/dev/null)
      [[ $color == *'#'* ]] && break
      sleep 0.3
    done
    print -r -- $color > $SANDBOX/compat/${req:t:r}.done
    rm -f -- $req
  done
}

quit() {
  local i
  case $1 in
    terminal-app)
      if (( ! $2 )); then
        pkill -x Terminal 2>/dev/null || :
        for i in {1..50}; do
          pgrep -x Terminal > /dev/null || break
          sleep 0.1
        done
      fi
      zsh $ROOT/tests/terminal-prefs.zsh restore
      ;;
    warp)
      if (( LINUX )); then
        pkill -f -- $PATTERN[warp] 2>/dev/null || :
      else
        rm -f -- $HOME/.warp/launch_configurations/ttheme-sandbox.yaml
      fi
      ;;
    *) pkill -f -- $PATTERN[$1] 2>/dev/null || : ;;
  esac
  (( LINUX )) && { pkill -f -- "Xvfb $XVFB " 2>/dev/null || : }
  return 0
}

measure() {
  local term=$1 hook i title=ttheme-compat-$1-$$ was=0 old=""
  local -a env=()
  (( LINUX )) || [[ $term == konsole ]] || old=$(windows_of "$(pids_of $term)")
  [[ $term == terminal-app ]] && pgrep -x Terminal > /dev/null && was=1
  [[ $term == ghostty-tip ]] && env=(PATH=$TIP:$PATH)
  hook=$(mktemp "${TMPDIR:-/tmp}/ttheme-compat.XXXXXX")
  print -rl -- "typeset -g CC_ADAPTER=$ADAPTER[$term] CC_TITLE=$title" "source ${(q)ROOT}/tests/compat/cases.zsh" > $hook
  MEASURING=($term $was)
  if ! env $env zsh $ROOT/tests/sandbox.zsh --behind ${=FLAG[$term]} --zshenv $hook miku asuka rei > /dev/null; then
    rm -f $hook
    { quit $term $was } always { MEASURING=() }
    return 1
  fi
  rm -f $hook
  for i in {1..900}; do
    [[ -e $SANDBOX/compat/done ]] && break
    [[ -d $SANDBOX/compat ]] && serve $term $title "$old"
    sleep 0.1
  done
  { quit $term $was } always { MEASURING=() }
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
    [[ -n ${got[$f[1]]} && ( ${got[$f[1]]} != skip || $f[col] == '?' ) ]] && f[col]=$got[$f[1]]
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
      elif [[ $got == skip && $want != skip ]]; then mark="  skip"
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
  print -r -- "✓ as expected · known gap ✗ regression + better than expected ? not measured before, skip: not measurable this run — screenshots in $OUT"
  (( ! broken ))
}

versions() {
  local term
  for term in $@; do
    case $term in
      ghostty) print -r -- "ghostty: $(ghostty +version 2>/dev/null | head -1)" ;;
      ghostty-tip) print -r -- "ghostty-tip: $($TIP/ghostty +version 2>/dev/null | head -1)" ;;
      kitty) print -r -- "kitty: $(kitty --version 2>/dev/null)" ;;
      alacritty) print -r -- "alacritty: $(alacritty --version 2>/dev/null)" ;;
      wezterm) print -r -- "wezterm: $(wezterm --version 2>/dev/null)" ;;
      warp) print -r -- "warp: $(dpkg-query -W -f '${Version}' warp-terminal 2>/dev/null)" ;;
      rio) print -r -- "rio: $(rio --version 2>/dev/null)" ;;
      contour) print -r -- "contour: $(contour version 2>/dev/null | head -1)" ;;
    esac
  done
}

in_container() {
  local image=$1
  shift
  (( $+commands[docker] )) || { print -u2 "$image: these cases run in a container, which needs Docker"; return 1 }
  print -r -- "$image: building tests/compat/$image.Dockerfile…"
  docker build -q -t ttheme-$image -f "$ROOT/tests/compat/$image.Dockerfile" "$ROOT/tests/compat" > /dev/null || return
  docker run --rm -v "$ROOT":/work -v "$OUT":"$OUT" -e TTHEME_COMPAT_OUT="$OUT" ttheme-$image zsh tests/compat.zsh $@
}

main() {
  local -a upd linux
  zparseopts -D -E -F -- -update=upd -linux=linux || { print -u2 "usage: compat [--update] [--linux] [terminal…]"; return 1 }
  if (( $#linux )); then
    EXPECT=$ROOT/tests/compat/expect-linux.tsv
    TERMINALS=($LINUX_TERMINALS)
  fi
  local -a terms=(${@:-$TERMINALS}) ran=()
  local term contained=0
  for term in $terms; do
    (( ${TERMINALS[(Ie)$term]} )) || { print -u2 "unknown terminal $term — one of $TERMINALS"; return 1 }
  done
  mkdir -p $OUT
  [[ -n $TTHEME_COMPAT_IMAGE ]] || rm -rf -- $OUT/*(N)
  if (( $#linux )) && [[ $TTHEME_COMPAT_IMAGE != linux && $TTHEME_COMPAT_IMAGE != contour ]]; then
    if (( ${terms[(Ie)contour]} )); then
      terms=(${terms:#contour})
      in_container contour $upd --linux contour || contained=1
      (( ${#terms} )) || return $contained
    fi
    in_container linux $upd --linux $terms && (( ! contained ))
    return
  fi
  if (( ! $#linux && $# && ${terms[(Ie)konsole]} )) && ! installed konsole && (( $+commands[docker] )); then
    terms=(${terms:#konsole})
    in_container konsole $upd konsole || contained=1
    (( ${#terms} )) || return $contained
  fi
  (( $#linux )) && versions $terms
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
  report $ran && (( ! contained ))
}

main $@
