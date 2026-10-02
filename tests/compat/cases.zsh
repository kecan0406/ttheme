typeset -g CC_DIR=${ZDOTDIR:-$HOME}/compat
typeset -gi CC_DRAWN=1

__cc_ask() {
  local c fd saved
  REPLY=""
  exec {fd}<>/dev/tty || return 1
  saved=$(stty -g <&$fd)
  stty raw -echo min 0 time 20 <&$fd
  printf '%s\e[5n' "$1" >&$fd
  while IFS= read -r -k 1 -u $fd c; do
    REPLY+=$c
    [[ $REPLY == *$'\e[0n' ]] && break
    (( ${#REPLY} < 4096 )) || break
  done
  stty $saved <&$fd
  exec {fd}>&-
  [[ $REPLY == *$'\e[0n' ]] || return 1
  REPLY=${REPLY%$'\e[0n'}
}

__cc_drain() {
  local c fd saved buf=""
  exec {fd}<>/dev/tty || return 1
  saved=$(stty -g <&$fd)
  stty raw -echo min 0 time 10 <&$fd
  while IFS= read -r -k 1 -u $fd c; do
    buf+=$c
    [[ $buf == *$'\e[0n' ]] && break
  done
  stty $saved <&$fd
  exec {fd}>&-
}

__cc_color() {
  __cc_ask $'\e]'$1$';?\e\\' || return 1
  [[ $REPLY == *rgb:* ]] || { REPLY=""; return 1 }
  local -a p=(${(s:/:)${${REPLY#*rgb:}%%[^0-9A-Fa-f/]*}})
  (( ${#p} >= 3 )) || { REPLY=""; return 1 }
  REPLY="#${(L)p[1][1,2]}${(L)p[2][1,2]}${(L)p[3][1,2]}"
}

__cc_near() {
  local a=${1#\#} b=${2#\#} i
  [[ ${#a} == 6 && ${#b} == 6 ]] || return 1
  for i in 1 3 5; do
    (( ${$(( 16#${a[i,i+1]} - 16#${b[i,i+1]} ))#-} <= ${3:-12} )) || return 1
  done
}

__cc_dist() {
  local a=${1#\#} b=${2#\#} i
  REPLY=0
  for i in 1 3 5; do
    (( REPLY += ${$(( 16#${a[i,i+1]} - 16#${b[i,i+1]} ))#-} ))
  done
}

__cc_report() { print -r -- "$1"$'\t'"$2"$'\t'"$3" >> $CC_DIR/results }

__cc_mode() {
  __cc_ask $'\e[?'$1'$p' || return 2
  [[ $REPLY == *$'\e[?'$1';'<->'$y'* ]] || { REPLY=""; return 2 }
  REPLY=${${REPLY##*\;}%%\$*}
  (( REPLY != 0 ))
}

__cc_decrqm() {
  __cc_mode $2
  case $? in
    0) __cc_report $1 pass "DECRQM $2 = $REPLY" ;;
    1) __cc_report $1 fail "DECRQM $2 = 0, not recognized" ;;
    *) __cc_report $1 skip "no DECRQM answer, so the mode is unknown" ;;
  esac
}

__cc_focus() {
  local c fd saved buf="" moved=""
  local -i i
  exec {fd}<>/dev/tty || return 1
  saved=$(stty -g <&$fd)
  stty raw -echo min 0 time 1 <&$fd
  printf '\e[?1004h' >&$fd
  while IFS= read -r -k 1 -u $fd c; do :; done
  rm -f -- $CC_DIR/focus.done
  : > $CC_DIR/focus.req
  for (( i = 0; i < 100; i++ )); do
    while IFS= read -r -k 1 -u $fd c; do buf+=$c; done
    [[ -e $CC_DIR/focus.done ]] && { moved=$(<$CC_DIR/focus.done); break }
  done
  while IFS= read -r -k 1 -u $fd c; do buf+=$c; done
  printf '\e[?1004l' >&$fd
  stty $saved <&$fd
  exec {fd}>&-
  if [[ $moved != moved ]]; then
    __cc_report focus-event skip "moving focus here would take it from the user"
  elif [[ $buf == *$'\e['[IO]* ]]; then
    __cc_report focus-event pass "focus moved away and back, and the terminal reported ${(V)${buf//[^$'\e'\[IO]/}}"
  else
    __cc_report focus-event fail "focus moved away and back, and the terminal reported nothing"
  fi
}

__cc_front() {
  local REPLY fg
  local -a ans
  if [[ $TTHEME_ADAPTER != ghostty ]]; then
    __cc_report front-tty fail "ttheme asks only Ghostty, whose picture is app-wide, which terminal is in front"
    return
  fi
  if (( ! $+functions[__tt_ghostty_ask] )); then
    __cc_report front-tty skip "no layer"
    return
  fi
  if (( ! $+commands[osascript] )); then
    __cc_report front-tty skip "no osascript, so nothing asks Ghostty which terminal is in front"
    return
  fi
  __tt_ghostty_owner $PPID
  TTHEME_GHOSTTY_PID=$REPLY
  __tt_ghostty_ask
  ans=(${=REPLY})
  fg=${$(ps -o tpgid= -p $$)// /}
  if [[ $ans[2] == "$TTY" && $ans[3] == "$fg" ]]; then
    __cc_report front-tty pass "Ghostty named this terminal's tty and the process in front of it: $ans[2] $ans[3]"
  else
    __cc_report front-tty fail "Ghostty answered ${REPLY:-nothing}, where this terminal is $TTY with $fg in front"
  fi
}

__cc_shot() {
  local i
  : > $CC_DIR/$1.req
  for i in {1..100}; do
    [[ -e $CC_DIR/$1.done ]] && { REPLY=$(<$CC_DIR/$1.done); return 0 }
    sleep 0.1
  done
  REPLY=""
  return 1
}

__cc_painted() {
  printf '\e[H\e[2J'
  __cc_seen $@
}

__cc_seen() {
  local want=$2 from=$3 miss=${5:-fail} got
  local -i within=${4:-24}
  local -i near far
  sleep 0.3
  if (( ! CC_DRAWN )); then
    __cc_report $1 skip "the window does not redraw while it is covered"
    return
  fi
  if ! __cc_shot $1; then
    __cc_report $1 skip "no screenshot"
    return
  fi
  local shot=$REPLY
  for got in ${(M)${=shot}:#\#*}; do
    __cc_near $want $got $within || continue
    __cc_dist $want $got; near=$REPLY
    __cc_dist ${from:-$want} $got; far=$REPLY
    [[ -z $from ]] || (( near < far )) || continue
    __cc_report $1 pass "$want painted as $got"
    return
  done
  __cc_report $1 $miss "${${miss:#fail}:+the window does not redraw while it is covered: }wanted $want over ${from:-?}, the window shows ${shot:-nothing}"
}

__cc_roundtrip() {
  local id=$1 slot=$2 want=$3
  printf '\e]%s;%s\e\\' $slot $want
  sleep 0.1
  if __cc_color $slot && __cc_near $want $REPLY; then
    __cc_report $id pass "set $want, read $REPLY"
  else
    __cc_report $id fail "set $want, read ${REPLY:-no answer}"
  fi
}

__cc_fill() {
  printf '\e_Ga=t,f=24,s=1,v=%d,i=%d,q=2;%s\e\\' $3 $1 $2
  printf '\e[H\e_Ga=p,i=%d,p=%d%s,c=%d,r=%d,C=1,z=%d,q=2\e\\' $1 $1 "$5" $COLUMNS $LINES $4
}

__cc_kitty() {
  local -i r
  printf '\e[H\e[2J'
  __cc_fill 40 QKBA 1 -1
  sleep 0.5
  __cc_seen kitty-shown '#40a040' $start 64
  printf '\e_Ga=d,d=A,q=2\e\\\e[H\e[2J'
  if [[ $(tail -1 $CC_DIR/results) != kitty-shown$'\t'pass* ]]; then
    __cc_report kitty-under-bg skip "the image never showed"
    __cc_report kitty-el skip "the image never showed"
    __cc_report kitty-crop skip "the image never showed"
    return
  fi
  printf '\e[H\e[48;2;160;64;64m'
  for (( r = 1; r <= LINES; r++ )); do printf '\e[%d;1H%*s' $r $COLUMNS ''; done
  printf '\e[0m'
  __cc_fill 41 QKBA 1 -1073741826
  sleep 0.5
  __cc_seen kitty-under-bg '#a04040' '#40a040'
  printf '\e_Ga=d,d=A,q=2\e\\\e[H\e[2J'
  __cc_fill 42 QKBA 1 -1
  for (( r = 1; r <= LINES; r++ )); do printf '\e[%d;1H\e[K' $r; done
  __cc_seen kitty-el '#40a040' $start 64
  printf '\e_Ga=d,d=A,q=2\e\\\e[H\e[2J'
  __cc_fill 43 QECgoEBAoEBAoEBA 4 -1 ,x=0,y=0,w=1,h=1
  __cc_seen kitty-crop '#4040a0' '#a04040' 64
  printf '\e_Ga=d,d=A,q=2\e\\\e[H\e[2J'
}

__cc_scheme() {
  print -l '[Background]' 'Color=160,64,64' '' '[Foreground]' 'Color=230,230,230' '' '[General]' \
    'Description=ttheme compat' 'Opacity=1' "Wallpaper=$2" 'FillStyle=Stretch' 'WallpaperOpacity=1' > $1
}

__cc_schemes() {
  local dir=${XDG_DATA_HOME:-$HOME/.local/share}/konsole green blue
  if [[ $TTHEME_ADAPTER != konsole ]]; then
    __cc_report scheme-picture fail "only Konsole switches a tab's color scheme from the shell, so no scheme carries a picture here"
    __cc_report scheme-held fail "only Konsole switches a tab's color scheme from the shell, so there is no scheme to hold"
    __cc_report scheme-released fail "only Konsole switches a tab's color scheme from the shell, so there is no scheme to read again"
    __cc_report scheme-fresh fail "only Konsole switches a tab's color scheme from the shell, so there is no scheme to read"
    return
  fi
  mkdir -p $dir
  green=$dir/ttheme-compat-green.png blue=$dir/ttheme-compat-blue.png
  print -rn -- iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4AWNwWOAAAAJEASFujDCPAAAAAElFTkSuQmCC | base64 -d > $green
  print -rn -- iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4AWNwcFgAAAHkASGcSLolAAAAAElFTkSuQmCC | base64 -d > $blue
  printf '\e[H\e[2J'
  __cc_scheme $dir/ttheme-compat-a.colorscheme $green
  printf '\e]50;ColorScheme=ttheme-compat-a\a'
  __cc_seen scheme-picture '#40a040' '#a04040'
  __cc_scheme $dir/ttheme-compat-a.colorscheme $blue
  printf '\e]50;ColorScheme=ttheme-compat-a\a'
  __cc_seen scheme-held '#40a040' '#4040a0'
  __cc_scheme $dir/ttheme-compat-b.colorscheme $green
  printf '\e]50;ColorScheme=ttheme-compat-b\a'
  sleep 0.3
  printf '\e]50;ColorScheme=ttheme-compat-a\a'
  __cc_seen scheme-released '#4040a0' '#40a040'
  __cc_scheme $dir/ttheme-compat-c.colorscheme $green
  printf '\e]50;ColorScheme=ttheme-compat-c\a'
  __cc_seen scheme-fresh '#40a040' '#4040a0'
  (( $+functions[__tt_osc_reset] )) && __tt_osc_reset
  sleep 0.3
  rm -f $dir/ttheme-compat-*
  printf '\e[H\e[2J'
}

__cc_profiles() {
  local id dir laid stem pal bg green=iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4AWNwWOAAAAJEASFujDCPAAAAAElFTkSuQmCC
  local blue=iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4AWNwcFgAAAHkASGcSLolAAAAAElFTkSuQmCC REPLY
  local -a held
  if [[ $TTHEME_ADAPTER != terminal-app ]]; then
    for id in profile-picture picture-held picture-renamed picture-gone; do
      __cc_report $id fail "only Terminal.app keeps a tab's picture in its profile, read from a file the profile bookmarks"
    done
    return
  fi
  dir=${TTHEME_CONFIG:h}/terminal-app
  held=($dir/ttheme-*.png(N))
  if (( ! $+functions[__tt_terminal_switch] || ! ${#held} )); then
    for id in profile-picture picture-held picture-renamed picture-gone; do
      __cc_report $id skip "no palette here carries a picture in its profile — the sandbox puts one on with --pictured"
    done
    return
  fi
  laid=$held[1]
  stem=${${laid:t}#ttheme-}
  stem=${stem%%.*}
  pal=${${stem/--/@}/--//}
  bg=${${=TTHEME_PALETTE[$pal]}[1]}
  printf '\e[H\e[2J'
  print -rn -- $green | base64 -d > $laid
  mv -f -- $laid $dir/ttheme-$stem.compat1.png
  laid=$dir/ttheme-$stem.compat1.png
  __tt_terminal_switch "ttheme · $pal"
  printf '\e]11;#a04040\a'
  __cc_seen profile-picture '#40a040' '#a04040'
  print -rn -- $blue | base64 -d > $laid
  __tt_terminal_switch "ttheme · $pal"
  __cc_seen picture-held '#40a040' '#4040a0'
  mv -f -- $laid $dir/ttheme-$stem.compat2.png
  laid=$dir/ttheme-$stem.compat2.png
  __tt_terminal_switch "ttheme · $pal"
  __cc_seen picture-renamed '#4040a0' '#40a040'
  rm -f -- $laid
  __tt_terminal_switch "ttheme · $pal"
  __cc_seen picture-gone $bg '#4040a0'
  TTHEME_TERMINAL_SHOWN=""
  __tt_osc_reset
  sleep 0.3
  printf '\e[H\e[2J'
}

__cc_follow() {
  local before=$TTHEME_STARTUP target shown="" worn want was
  local -a others=(${TTHEME_ORDER:#$before})
  local -i i
  target=$others[1]
  if (( ! $+functions[ttheme] )) || [[ -z $before || -z $target ]]; then
    __cc_report follow-default skip "no layer or fewer than two palettes"
    __cc_report follow-belief skip "no layer or fewer than two palettes"
    return
  fi
  if [[ $TTHEME_ADAPTER == warp ]]; then
    __cc_report follow-default skip "Warp reads only the real ~/.warp, which the sandbox never touches"
    __cc_report follow-belief skip "Warp reads only the real ~/.warp, which the sandbox never touches"
    return
  fi
  want=${${=TTHEME_PALETTE[$target]}[1]} was=${${=TTHEME_PALETTE[$before]}[1]}
  __tt_osc_reset
  __tt_unshown force
  for (( i = 0; i < 20; i++ )); do
    __cc_color 11 && __cc_near $was $REPLY && break
    sleep 0.1
  done
  if (( i == 20 )); then
    __cc_report follow-default skip "the window does not show the default palette"
    __cc_report follow-belief skip "the window does not show the default palette"
    return
  fi
  TTHEME_SPEC=${TTHEME_PALETTE[$before]}
  ttheme default $target
  for (( i = 0; i < 50; i++ )); do
    __cc_color 11 && shown=$REPLY
    [[ -n $shown ]] && __cc_near $want $shown && break
    sleep 0.1
  done
  __tt_name_of "$TTHEME_SPEC"
  worn=$REPLY
  if [[ -n $shown ]] && __cc_near $want $shown; then
    __cc_report follow-default pass "a tab that never painted took the new default $target"
    if [[ $worn == $target ]]; then
      __cc_report follow-belief pass "the shell wears $worn too"
    else
      __cc_report follow-belief fail "the tab shows $target, the shell wears $worn"
    fi
  elif [[ -n $shown ]] && __cc_near $was $shown; then
    __cc_report follow-default fail "a tab that never painted kept $before"
    if [[ $worn == $before ]]; then
      __cc_report follow-belief pass "the shell wears $worn too"
    else
      __cc_report follow-belief fail "the tab shows $before, the shell wears $worn"
    fi
  else
    __cc_report follow-default fail "read ${shown:-no answer}, wanted $want or $was"
    __cc_report follow-belief skip "the tab shows neither palette"
  fi
  ttheme default $before
  sleep 1
  printf '\e[H\e[2J'
}

__cc_keep() {
  local before=$TTHEME_STARTUP paint target shown="" want
  local -a others=(${TTHEME_ORDER:#$before})
  paint=$others[1] target=$others[2]
  if (( ! $+functions[ttheme] )) || [[ -z $before || -z $target ]]; then
    __cc_report keep-painted skip "no layer or fewer than three palettes"
    return
  fi
  if [[ $TTHEME_ADAPTER == warp ]]; then
    __cc_report keep-painted skip "Warp reads only the real ~/.warp, which the sandbox never touches"
    return
  fi
  want=${${=TTHEME_PALETTE[$paint]}[1]}
  ttheme use $paint
  sleep 0.5
  ttheme default $target
  sleep 3
  __cc_color 11 && shown=$REPLY
  if [[ -n $shown ]] && __cc_near $want $shown; then
    __cc_report keep-painted pass "a tab painted $paint kept it through ttheme default $target"
  else
    __cc_report keep-painted fail "a tab painted $paint shows ${shown:-nothing} after ttheme default $target"
  fi
  ttheme default $before
  sleep 1
  (( $+functions[__tt_osc_reset] )) && __tt_osc_reset
  sleep 0.3
  printf '\e[H\e[2J'
}

__cc_cases() {
  local start REPLY spec other bgcw=0 bgch=0 bgrel=0 bgmx=0 bgmy=0
  local -i r
  printf '\e]0;%s\a' ${CC_TITLE:-ttheme-compat}

  if [[ $TTHEME_ADAPTER == $CC_ADAPTER ]]; then
    __cc_report detect pass $TTHEME_ADAPTER
  else
    __cc_report detect fail "${TTHEME_ADAPTER:-none}, wanted $CC_ADAPTER"
  fi

  if (( $+functions[__tt_active] )) && __tt_active; then
    __cc_report layer pass "active, ${#TTHEME_PALETTE} palettes"
  else
    __cc_report layer fail "inactive"
  fi

  if __cc_color 11; then
    start=$REPLY
    __cc_report osc-query pass $start
  else
    __cc_report osc-query fail "no answer to OSC 11 ?"
  fi

  __cc_roundtrip osc-bg 11 '#5a4e46'
  __cc_roundtrip osc-fg 10 '#d8cfc4'
  __cc_roundtrip osc-cursor 12 '#c47a5a'
  __cc_roundtrip osc-selection 17 '#46505a'
  __cc_roundtrip osc-ansi '4;1' '#b85c5c'

  printf '\e]104\e\\\e]110\e\\\e]111\e\\\e]112\e\\\e]117\e\\'
  sleep 0.1
  if [[ -z $start ]]; then
    __cc_report osc-reset skip "no starting color to return to"
  elif __cc_color 11 && __cc_near $start $REPLY; then
    __cc_report osc-reset pass "back to $REPLY"
  else
    __cc_report osc-reset fail "wanted $start, read ${REPLY:-no answer}"
  fi

  printf '\e[H\e[2J\e[48;2;106;90;143m'
  for (( r = 1; r <= LINES; r++ )); do printf '\e[%d;1H%*s' $r $COLUMNS ''; done
  printf '\e[0m'
  __cc_seen drawn '#6a5a8f' $start 24 skip
  [[ $(tail -1 $CC_DIR/results) == drawn$'\t'skip$'\t'the\ window* ]] && CC_DRAWN=0
  printf '\e[H\e[2J'

  printf '\e]11;#3a6f5c\e\\'
  __cc_painted painted '#3a6f5c' $start
  printf '\e]111\e\\'

  local fg="" red=""
  __cc_color 10 && fg=$REPLY
  __cc_color '4;1' && red=$REPLY
  printf '\e]10;#5a8f6a\e\\\e[H\e[2J\e[7m'
  for (( r = 1; r <= LINES; r++ )); do printf '\e[%d;1H%*s' $r $COLUMNS ''; done
  printf '\e[0m'
  __cc_seen fg-painted '#5a8f6a' ${fg:-$start}
  printf '\e]110\e\\\e]4;1;#8f5a6a\e\\\e[H\e[2J\e[41m'
  for (( r = 1; r <= LINES; r++ )); do printf '\e[%d;1H%*s' $r $COLUMNS ''; done
  printf '\e[0m'
  __cc_seen ansi-painted '#8f5a6a' ${red:-$start}
  printf '\e]104;1\e\\\e[H\e[2J'

  if __cc_ask $'\e[?1004h' && [[ $REPLY == *$'\e['[IO]* ]]; then
    __cc_report focus-answer pass "turning focus reporting on answered ${${(V)REPLY}[1,12]}"
  else
    __cc_report focus-answer fail "turning focus reporting on answered ${${(V)REPLY}:-nothing}"
  fi
  printf '\e[?1004l'


  (( $+functions[__tt_name_of] )) && __tt_name_of "$TTHEME_SPEC"
  other=${${TTHEME_ORDER:#$REPLY}[1]}
  if [[ $TTHEME_ADAPTER == warp ]]; then
    __cc_report wear skip "Warp reads only the real ~/.warp, which the sandbox never touches"
    __cc_report wear-painted skip "Warp reads only the real ~/.warp, which the sandbox never touches"
    __cc_report wear-ansi skip "Warp reads only the real ~/.warp, which the sandbox never touches"
  elif (( $+functions[ttheme] )) && [[ -n $other ]]; then
    ttheme use $other
    sleep 0.1
    spec=${${=TTHEME_PALETTE[$other]}[1]}
    local ansi=${${=TTHEME_PALETTE[$other]}[6]} got="" bg=""
    local -i blind=0
    [[ -n ${(M)${(f)"$(<$CC_DIR/results)"}:#ansi-painted$'\t'fail*} ]] && blind=1
    __cc_color '4;1' && got=$REPLY
    __cc_color 11 && bg=$REPLY
    if [[ $TTHEME_SPEC == ${TTHEME_PALETTE[$other]} ]] && __cc_near $spec $bg && (( blind )); then
      __cc_report wear pass "ttheme use $other reads back $bg; ansi 1 is wear-ansi's to judge, since this terminal answers OSC 4 with what was set, not what it draws ($got)"
    elif [[ $TTHEME_SPEC == ${TTHEME_PALETTE[$other]} ]] && __cc_near $spec $bg && __cc_near $ansi $got; then
      __cc_report wear pass "ttheme use $other reads back $bg, ansi 1 $got"
    else
      __cc_report wear fail "ttheme use $other left the tab on ${bg:-its own colors} and ansi 1 ${got:-unread}, wanted $spec and $ansi"
    fi
    __cc_painted wear-painted $spec $start
    printf '\e[H\e[2J\e[41m'
    for (( r = 1; r <= LINES; r++ )); do printf '\e[%d;1H%*s' $r $COLUMNS ''; done
    printf '\e[0m'
    __cc_seen wear-ansi $ansi $spec
    printf '\e[H\e[2J'
  else
    __cc_report wear fail "no ttheme command or no palette"
    __cc_report wear-painted skip "nothing worn"
    __cc_report wear-ansi skip "nothing worn"
  fi

  if [[ $TTHEME_ADAPTER == warp ]]; then
    __cc_report reset-worn skip "Warp reads only the real ~/.warp, which the sandbox never touches"
  elif (( $+functions[__tt_mend] )) && [[ -n $other && $TTHEME_SPEC == ${TTHEME_PALETTE[$other]} ]]; then
    local -a worn=(${=TTHEME_PALETTE[$other]})
    local rbg="" rcur=""
    local -i deaf=0
    [[ -n ${(M)${(f)"$(<$CC_DIR/results)"}:#osc-cursor$'\t'fail*} ]] && deaf=1
    printf '\e]112\e\\\e]111\e\\'
    sleep 0.1
    TTHEME_RAN=1
    __tt_mend
    sleep 0.1
    __cc_color 11 && rbg=$REPLY
    (( deaf )) || { __cc_color 12 && rcur=$REPLY }
    if [[ -n $rbg ]] && __cc_near $worn[1] $rbg && { (( deaf )) || { [[ -n $rcur ]] && __cc_near $worn[3] $rcur } }; then
      __cc_report reset-worn pass "after a program's OSC 111 and 112 and the next prompt the tab still wears $other: $rbg, cursor ${rcur:-unread, since this terminal answers no OSC 12}"
    else
      __cc_report reset-worn fail "after a program's OSC 111 and 112 and the next prompt the tab shows ${rbg:-no answer}, cursor ${rcur:-no answer}, not $other's $worn[1] and $worn[3]"
    fi
  else
    __cc_report reset-worn skip "nothing worn"
  fi

  local -a pair=(${TTHEME_ORDER:#$other})
  if [[ $TTHEME_ADAPTER != iterm2 ]]; then
    __cc_report reset-baseline fail "only iTerm2 switches a tab's profile from the shell, so a reset has no color of another profile to go back to"
  elif (( ${#pair} < 1 )) || [[ -z $other ]]; then
    __cc_report reset-baseline skip "fewer than two palettes"
  else
    local -a from=(${=TTHEME_PALETTE[$pair[1]]}) to=(${=TTHEME_PALETTE[$other]})
    local first="" second=""
    printf '\e]1337;SetProfile=ttheme · %s\a' $pair[1]
    sleep 0.3
    printf '\e]11;#5a4e46\e\\'
    sleep 0.1
    printf '\e]1337;SetProfile=ttheme · %s\a' $other
    sleep 0.3
    printf '\e]111\e\\'
    sleep 0.2
    __cc_color 11 && first=$REPLY
    printf '\e]111\e\\'
    sleep 0.2
    __cc_color 11 && second=$REPLY
    if [[ -n $first && -n $second ]] && __cc_near $from[1] $first && __cc_near $to[1] $second; then
      __cc_report reset-baseline pass "an OSC 11 on $pair[1], then $other's profile: the first reset brought back $pair[1]'s $first, the next $other's $second"
    else
      __cc_report reset-baseline fail "an OSC 11 on $pair[1], then $other's profile: the resets brought back ${first:-no answer} and ${second:-no answer}, where $pair[1] is $from[1] and $other $to[1]"
    fi
  fi

  if (( ! $+functions[__tt_osc_reset] )) || [[ -z $start ]]; then
    __cc_report restore skip "no layer or no starting color"
  else
    __tt_osc_reset
    sleep 0.1
    if __cc_color 11 && __cc_near $start $REPLY; then
      __cc_report restore pass "back to $REPLY"
    else
      __cc_report restore fail "wanted $start, read ${REPLY:-no answer}"
    fi
  fi

  if (( ! $+functions[__tt_query_bg] )) || [[ -z $start ]]; then
    __cc_report layer-query skip "no layer or no starting color"
  elif __tt_query_bg && __cc_near $start $REPLY; then
    __cc_report layer-query pass "__tt_query_bg read $REPLY"
  else
    __cc_report layer-query fail "wanted $start, __tt_query_bg read ${REPLY:-nothing}"
  fi

  if (( ! $+functions[__tt_bg_cells] )); then
    __cc_report layer-cells skip "the $TTHEME_ADAPTER adapter asks for no cell size"
  elif __tt_bg_cells && (( bgcw > 0 && bgch > 0 )); then
    __cc_report layer-cells pass "__tt_bg_cells read ${bgcw}×${bgch}"
  else
    __cc_report layer-cells fail "__tt_bg_cells read ${bgcw}×${bgch}"
  fi

  if [[ $TTHEME_ADAPTER != terminal-app ]]; then
    __cc_report layer-base skip "only Terminal.app reads its colors at startup"
  elif (( ${#${=TTHEME_TERMINAL_BASE}} == 20 )); then
    __cc_report layer-base pass "read 20 colors, bg ${${=TTHEME_TERMINAL_BASE}[1]}"
  else
    __cc_report layer-base fail "read ${#${=TTHEME_TERMINAL_BASE}} of 20 colors"
  fi

  if __cc_ask $'\e[16t' && [[ $REPLY == *$'\e[6;'<1->';'<1->t* ]]; then
    __cc_report cell-size pass "CSI 16t ${${REPLY##*\[6;}%%t*}"
  elif __cc_ask $'\e]1337;ReportCellSize\a' && [[ $REPLY == *ReportCellSize=* ]]; then
    __cc_report cell-size pass "OSC 1337 ${${REPLY##*ReportCellSize=}%%[$'\a\e']*}"
  else
    __cc_report cell-size fail "neither CSI 16t nor OSC 1337 ReportCellSize"
  fi

  if __cc_ask $'\e[14t\e[18t' && [[ $REPLY == *$'\e[4;'<1->';'<1->t* && $REPLY == *$'\e[8;'<1->';'<1->t* ]]; then
    __cc_report cell-points pass "CSI 14t ${${REPLY##*\[4;}%%t*} over CSI 18t ${${REPLY##*\[8;}%%t*}"
  else
    __cc_report cell-points fail "no CSI 14t and 18t pair"
  fi

  if __cc_ask $'\e_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA\e\\' && [[ $REPLY == *'_Gi=31;OK'* ]]; then
    __cc_report kitty-graphics pass "a=q answered OK"
    __cc_kitty
  else
    __cc_report kitty-graphics fail "${${(V)REPLY}:-no answer}"
    __cc_report kitty-shown skip "no kitty graphics"
    __cc_report kitty-under-bg skip "no kitty graphics"
    __cc_report kitty-el skip "no kitty graphics"
    __cc_report kitty-crop skip "no kitty graphics"
  fi

  __cc_decrqm sync-output 2026

  printf '\e[?2026h'
  if __cc_ask ''; then
    printf '\e[?2026l'
    __cc_report sync-query pass "a DSR answered inside a synchronized update"
  else
    printf '\e[?2026l'
    __cc_drain
    __cc_report sync-query fail "a DSR went unanswered until the synchronized update ended"
  fi

  __cc_decrqm focus-report 1004
  __cc_focus
  __cc_front
  __cc_schemes
  __cc_profiles

  __cc_follow
  __cc_keep
  __cc_back
}

__cc_back() {
  local start=$TTHEME_STARTUP want shown="" worn
  local -i i
  if (( ! $+functions[ttheme] )) || [[ -z $start ]]; then
    __cc_report on-follow skip "no layer or no default palette"
    __cc_report on-belief skip "no layer or no default palette"
    return
  fi
  if [[ $TTHEME_ADAPTER == warp ]]; then
    __cc_report on-follow skip "Warp reads only the real ~/.warp, which the sandbox never touches"
    __cc_report on-belief skip "Warp reads only the real ~/.warp, which the sandbox never touches"
    return
  fi
  want=${${=TTHEME_PALETTE[$start]}[1]}
  __tt_osc_reset
  __tt_unshown force
  TTHEME_SPEC=${TTHEME_PALETTE[$start]}
  sleep 0.5
  ttheme off
  for (( i = 0; i < 50; i++ )); do
    __cc_color 11 && shown=$REPLY
    [[ -n $shown ]] && ! __cc_near $want $shown 3 && break
    sleep 0.1
  done
  if (( i == 50 )); then
    ttheme on
    __cc_report on-follow skip "the tab kept $start through ttheme off"
    __cc_report on-belief skip "the tab kept $start through ttheme off"
    return
  fi
  __tt_cli on > /dev/null
  __tt_reload
  sleep 1
  (( TTHEME_FOCUS )) && __tt_focus
  shown=""
  for (( i = 0; i < 50; i++ )); do
    __cc_color 11 && shown=$REPLY
    [[ -n $shown ]] && __cc_near $want $shown 3 && break
    sleep 0.1
  done
  worn=""
  [[ -n $TTHEME_SPEC ]] && __tt_name_of "$TTHEME_SPEC" && worn=$REPLY
  if [[ -n $shown ]] && __cc_near $want $shown 3; then
    __cc_report on-follow pass "a tab that went off took the default $start back at its focus"
    if [[ $worn == $start ]]; then
      __cc_report on-belief pass "the shell wears $worn too"
    else
      __cc_report on-belief fail "the tab shows $start, the shell wears ${worn:-nothing}"
    fi
  else
    __cc_report on-follow fail "a tab that went off shows ${shown:-no answer} at its focus, not $start"
    if [[ -z $worn ]]; then
      __cc_report on-belief pass "the shell wears nothing either"
    else
      __cc_report on-belief fail "the tab shows ${shown:-no answer}, the shell wears $worn"
    fi
  fi
  __tt_osc_reset
  sleep 0.3
  printf '\e[H\e[2J'
}

__cc_idle() {
  local -i shell=$$
  TRAPURG() {
    kill $CC_WAITER 2>/dev/null
    if (( ${#zsh_eval_context} == 1 )); then
      __cc_report prompt-trap pass "a signal to the shell idle at its prompt ran its trap at once"
    else
      __cc_report prompt-trap fail "a signal to the shell idle at its prompt ran its trap inside ${zsh_eval_context[1,-2]}"
    fi
    : > $CC_DIR/done
    kill -HUP $$
    return 0
  }
  {
    sleep 1
    kill -URG $shell
    sleep 3
    kill -0 $shell 2>/dev/null || exit 0
    __cc_report prompt-trap fail "a signal to the shell idle at its prompt ran no trap within 3 s"
    : > $CC_DIR/done
    kill -HUP $shell
  } &!
  typeset -gi CC_WAITER=$!
}

__cc_run() {
  precmd_functions=(${precmd_functions:#__cc_run})
  mkdir -p $CC_DIR
  mkdir $CC_DIR/started 2>/dev/null || return
  __cc_cases 2>> $CC_DIR/errors
  __cc_idle
}

precmd_functions+=(__cc_run)
