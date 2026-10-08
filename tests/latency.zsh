#!/usr/bin/env zsh
emulate -L zsh
setopt err_return pipe_fail extended_glob
zmodload zsh/zpty zsh/zselect zsh/datetime
zmodload -F zsh/stat b:zstat

typeset -g ROOT=${${(%):-%x}:A:h:h}
typeset -g WORK=$(mktemp -d)
typeset -g BUF="" FD="" MAIN="" TERMINAL=""
typeset -gi MARK=0
typeset -ga EXTRA=()
typeset -gA ASKED=() SHOWN=()
typeset -gF LATE=0
typeset -ga LATER=()
typeset -ga METRICS=(first_prompt first_command command input)
typeset -gA LIMIT=(first_prompt 50 first_command 150 command 10 input 20)
typeset -g FORKS=$ROOT/tests/forks.tsv
typeset -gA IDENTITY=(
  ghostty 'GHOSTTY_RESOURCES_DIR=x'
  kitty 'KITTY_WINDOW_ID=1'
  wezterm 'WEZTERM_PANE=1'
  iterm2 'ITERM_SESSION_ID=w0t0p0:x TERM_PROGRAM=iTerm.app'
  alacritty 'ALACRITTY_WINDOW_ID=1'
  windows-terminal 'WT_SESSION=x'
  konsole 'KONSOLE_VERSION=230805'
  terminal-app 'TERM_PROGRAM=Apple_Terminal'
  warp 'TERM_PROGRAM=WarpTerminal'
)
trap 'stop; rm -rf $WORK' EXIT

home() {
  local h=$WORK/$1 tab=$2 src=${3:-$ROOT/shell}
  mkdir -p $h
  print -rl -- 'skip_global_compinit=1' \
    "if [[ -n \$TT_TRACE ]]; then zmodload zsh/system; setopt prompt_subst; PS4='+\${sysparams[pid]}> '; exec 2>>\$HOME/trace; setopt xtrace; fi" \
    'print -rn -- UP_$((2*3))_$$_' > $h/.zshenv
  print -rl -- 'autoload -Uz compinit && compinit -u -d $HOME/.zcompdump' "PROMPT='bench> '" > $h/.zshrc
  [[ -n $tab ]] || return 0
  mkdir -p $h/.config/ttheme
  cp -R $src/ttheme.zsh $src/preview.zsh(N) $src/adapters $ROOT/dist/shell/palettes.zsh $h/.config/ttheme/
  print -rl -- 'typeset -ga TTHEME_TERMINALS=(konsole warp)' "typeset -g TTHEME_KONSOLE_BASE='ColorScheme=Breeze;UseCustomCursorColor=false'" >> $h/.config/ttheme/palettes.zsh
  mkdir -p $h/.warp/themes $h/.config/warp-terminal $h/.local/share/warp-terminal/themes
  print -rl -- '[appearance.themes]' 'theme = "dark"' | tee $h/.warp/settings.toml > $h/.config/warp-terminal/settings.toml
  ( source $h/.config/ttheme/palettes.zsh; for n in $TTHEME_ORDER; do : > $h/.warp/themes/ttheme-${${n/@/--}/\//--}.yaml; done )
  cp $h/.warp/themes/*.yaml $h/.local/share/warp-terminal/themes/
  touch -t 202001010000 $h/.warp/themes/*.yaml $h/.local/share/warp-terminal/themes/*.yaml
  print -r -- ": \${TTHEME_TAB_PALETTE:=$tab}" > $h/.config/ttheme/config.zsh
  print -r -- 'source $XDG_CONFIG_HOME/ttheme/ttheme.zsh' >> $h/.zshrc
}

answer() {
  local p out="" c k
  for p in "${(@ps:\e:)1}"; do
    case $p in
      \](<->|4\;<->)\;\?*)
        c=${${SHOWN[${${p#\]}%%\;\?*}]:-#1e1e2e}#\#}
        out+=$'\e'"${p%%\?*}rgb:${c[1,2]}${c[1,2]}/${c[3,4]}${c[3,4]}/${c[5,6]}${c[5,6]}"$'\e\\'
        ASKED[$2]=1 ;;
      \](<->|4\;<->)\;\#[[:xdigit:]](#c6)*) SHOWN[${${p#\]}%%\;\#*}]=\#${(L)${p##*\#}[1,6]} ;;
      \]1(10|11|12|17)*) unset "SHOWN[${${p#\]1}[1,2]}]" ;;
      \]104*) for k in ${(k)SHOWN[(I)4;*]}; do unset "SHOWN[$k]"; done ;;
      \[5n*) out+=$'\e[0n' ;;
      \[16t*) out+=$'\e[6;16;8t' ;;
    esac
  done
  [[ -z $out ]] && return 0
  if (( LATE )); then
    LATER+=($(( EPOCHREALTIME + LATE )) "$out")
  else
    zpty -w -n sh "$out"
  fi
}

later() {
  local -a keep=()
  local -i i
  for (( i = 1; i < ${#LATER}; i += 2 )); do
    if (( EPOCHREALTIME >= LATER[i] )); then
      zpty -w -n sh "$LATER[i+1]" || :
    else
      keep+=($LATER[i] "$LATER[i+1]")
    fi
  done
  LATER=($keep)
}

upto() {
  local chunk
  local -F end=$(( EPOCHREALTIME + $2 ))
  until eval $1; do
    (( EPOCHREALTIME < end )) || return 1
    (( ${#LATER} )) && later
    zselect -t 1 -r $FD || continue
    zpty -rt sh chunk || continue
    BUF+=$chunk
    answer "$chunk" $3
  done
}

prompts() { REPLY=$(( ${#${(@s:bench> :)BUF}} - 1 )) }

start() {
  local name=$1 h=$WORK/$1 term=$TERMINAL
  local -a env=(PATH=$PATH HOME=$h ZDOTDIR=$h XDG_CONFIG_HOME=$h/.config XDG_STATE_HOME=$h/.state XDG_CACHE_HOME=$h/.cache TERM=xterm-256color $EXTRA)
  [[ -n $term ]] || { [[ $name == (ref-|)terminal-app ]] && term=terminal-app || term=ghostty }
  env+=(${=IDENTITY[$term]})
  stop
  BUF="" ASKED[$name]=0 SHOWN=()
  typeset -gF T0=$EPOCHREALTIME
  zpty -b sh env -i ${(q)env} zsh -i
  FD=$REPLY
  upto '[[ $BUF == *UP_6_<->_* ]]' 5 $name || { fail "$name: the shell never started"; return 1 }
  MAIN=${${BUF##*UP_6_}%%_*}
  zpty -w -n sh $'print -r -- TYPED_$((6*7))\r'
}

stop() {
  local keep=$BUF
  LATER=()
  if [[ -n $MAIN ]] && zpty -t sh 2>/dev/null; then
    kill -HUP $MAIN 2>/dev/null || :
    upto '! zpty -t sh' 2 stop || :
  fi
  zpty -d sh 2>/dev/null || :
  BUF=$keep MAIN=""
}

step() {
  local REPLY n
  prompts; n=$REPLY
  zpty -w -n sh "$1"
  upto 'prompts; (( REPLY > n ))' 3 $2 || { fail "$2: no prompt after ${(V)1}"; return 1 }
}

mark() {
  local -a size
  zstat -A size +size -- $WORK/$1/trace 2>/dev/null || size=(0)
  MARK=$size[1]
}

forked() {
  local -a pids=(${(u)${(f)"$(tail -c +$(( MARK + 1 )) $WORK/$1/trace | grep -oE '\+[0-9]+> ' | tr -dc '0-9\n')"}})
  REPLY=${#${pids:#$MAIN}}
}

fail() {
  print -u2 "$1"
  print -ru2 -- "the terminal saw: ${(V)BUF[-2000,-1]}"
  return 1
}

measure() {
  local name=$1 REPLY n m
  local -F t
  start $name
  upto '[[ $BUF == *"bench> "* ]]' 5 $name || { fail "$name: no prompt within 5s"; return 1 }
  typeset -gF fp=$(( (EPOCHREALTIME - T0) * 1000 ))
  zpty -w -n sh $'print -r -- SYNC_$((1+1))\r'
  upto '[[ $BUF == *(TYPED_42|SYNC_2)* ]]' 2 $name || { fail "$name: the shell stopped answering"; return 1 }
  typeset -g fc=lost
  if [[ $BUF == *TYPED_42* ]]; then
    fc=$(( (EPOCHREALTIME - T0) * 1000 ))
    n=3
  elif [[ -n $2 ]]; then
    fail "$name: a command typed before the first prompt never ran"
    return 1
  else
    n=2
  fi
  upto '[[ $BUF == *SYNC_2* ]] && prompts && (( REPLY >= n ))' 2 $name || { fail "$name: no prompt after the commands typed so far"; return 1 }
  typeset -ga cl=() il=()
  repeat $3; do
    prompts; n=$REPLY
    t=$EPOCHREALTIME
    zpty -w -n sh $'\r'
    upto 'prompts; (( REPLY > n ))' 2 $name || { fail "$name: an empty command never came back"; return 1 }
    cl+=$(( (EPOCHREALTIME - t) * 1000 ))
  done
  repeat $3; do
    m=${#BUF}
    t=$EPOCHREALTIME
    zpty -w -n sh x
    upto '[[ ${BUF[m+1,-1]} == *x* ]]' 2 $name || { fail "$name: a key never showed"; return 1 }
    il+=$(( (EPOCHREALTIME - t) * 1000 ))
  done
  (( $3 )) && zpty -w -n sh $'\C-u'
  if [[ -n $2 ]]; then
    zpty -w -n sh $'print -u2 ERR_$((6*7))\r'
    upto '[[ $BUF == *ERR_42* ]]' 2 $name || { fail "$name: stderr no longer reaches the terminal"; return 1 }
  fi
  stop
}

quantile() {
  local p=$1
  shift
  local -a s=(${(f)"$(print -l -- $@ | sort -g)"})
  REPLY=$s[$(( (${#s} - 1) * p / 100 + 1 ))]
}

median() { quantile 50 $@ }

typing() {
  local name=$1 REPLY session
  start $name
  upto '[[ $BUF == *TYPED_42* ]] && prompts && (( REPLY >= 2 ))' 5 $name || { fail "$name: no prompt within 5s"; return 1 }
  zpty -w -n sh $'stty rows 50 cols 160\r'
  upto 'prompts && (( REPLY >= 3 ))' 5 $name || { fail "$name: no prompt after resizing"; return 1 }
  BUF=""
  zpty -w -n sh $'ttheme\r'
  upto '[[ $BUF == *$'"'"'\e[?1049h'"'"'*$'"'"'\e[?2026l'"'"'* ]]' 5 $name || { fail "$name: preview never drew"; return 1 }
  [[ ${BUF%%$'\e[?2026h'*} == *$'\e[16t'* ]] ||
    { fail "$name: preview asked for its cell size inside a synchronized update, which WezTerm answers only once the update ends"; return 1 }
  zpty -w -n sh $'\e[C'
  repeat 40; do
    zpty -w -n sh $'\e[B'
    upto false 0.005 $name || :
  done
  upto false 0.3 $name || :
  local -i from=${#BUF}
  upto 'ticks $from && (( REPLY >= 8 || $#reply ))' 6 $name || { fail "$name: preview's search hint never animated while it sat idle"; return 1 }
  (( ! $#reply )) || { fail "$name: while preview sat idle, its search hint redrew the whole screen (${reply[1]} characters) instead of its search row"; return 1 }
  zpty -w -n sh $'\e'
  upto '[[ $BUF == *$'"'"'\e[?1049l'"'"'*"bench> "* ]]' 5 $name || { fail "$name: preview never closed"; return 1 }
  stop
  session=${${BUF#*$'\e[?1049h'}%$'\e[?1049l'*}
  [[ $session != *('^[['|$'\e[B')* ]] || { fail "$name: keys typed while preview drew were echoed into it"; return 1 }
}

flow() {
  local name=$1 REPLY
  start $name
  upto '[[ $BUF == *TYPED_42* ]] && prompts && (( REPLY >= 2 ))' 5 $name || { fail "$name: no prompt within 5s"; return 1 }
  zpty -w -n sh $'stty ixon -ixany\r'
  upto 'prompts && (( REPLY >= 3 ))' 5 $name || { fail "$name: no prompt after stty"; return 1 }
  BUF=""
  zpty -w -n sh $'ttheme\r'
  upto '[[ $BUF == *$'"'"'\e[?1049h'"'"'*$'"'"'\e[?2026l'"'"'* ]]' 5 $name || { fail "$name: preview never drew"; return 1 }
  zpty -w -n sh $'\x13'
  upto false 0.3 $name || :
  local -i from=${#BUF}
  zpty -w -n sh $'\e[B'
  upto '(( ${#BUF} > from ))' 2 $name || { zpty -w -n sh $'\x11'; fail "$name: ctrl+s stopped preview's output, so the key after it drew nothing"; return 1 }
  zpty -w -n sh $'\e'
  upto '[[ $BUF == *$'"'"'\e[?1049l'"'"'* ]]' 5 $name || { fail "$name: preview never closed"; return 1 }
  stop
}

pasting() {
  local name=$1 REPLY
  start $name
  upto '[[ $BUF == *TYPED_42* ]] && prompts && (( REPLY >= 2 ))' 5 $name || { fail "$name: no prompt within 5s"; return 1 }
  BUF=""
  zpty -w -n sh $'ttheme\r'
  upto '[[ $BUF == *$'"'"'\e[?1049h'"'"'*$'"'"'\e[?2026l'"'"'* ]]' 5 $name || { fail "$name: preview never drew"; return 1 }
  [[ ${BUF#*$'\e[?1049h'} == *$'\e[?2004h'* ]] || { fail "$name: preview left bracketed paste off, so a pasted newline pressed enter"; return 1 }
  zpty -w -n sh $'\e[200~kita\r\rprint -r -- PASTED_$((6*7))\r\e[201~'
  upto false 0.5 $name || :
  [[ $BUF != *$'\e[?1049l'* ]] || { fail "$name: a paste closed preview and ran its last line in the shell"; return 1 }
  zpty -w -n sh $'\e'
  upto false 0.3 $name || :
  zpty -w -n sh $'\e'
  upto '[[ $BUF == *$'"'"'\e[?1049l'"'"'*"bench> "* ]]' 5 $name || { fail "$name: preview never closed"; return 1 }
  BUF=""
  zpty -w -n sh $'ttheme\r'
  upto '[[ $BUF == *$'"'"'\e[?1049h'"'"'*$'"'"'\e[?2026l'"'"'* ]]' 5 $name || { fail "$name: preview never drew"; return 1 }
  zpty -w -n sh $'\e]11;rgb:1e1e/1e1e/2e2e\e\\\e_Gi=31;OK\e\\'
  upto false 0.5 $name || :
  [[ $BUF != *(rgb:1e1e|gi=31)* ]] || { fail "$name: an answer that came after preview stopped waiting was typed into its search"; return 1 }
  zpty -w -n sh $'\e'
  upto '[[ $BUF == *$'"'"'\e[?1049l'"'"'*"bench> "* ]]' 5 $name || { fail "$name: preview never closed"; return 1 }
  BUF=""
  zpty -w -n sh $'cd ~/a && ttheme unpin\r'
  upto '[[ $BUF == *UNPIN* ]]' 5 $name || { fail "$name: unpin never offered its choice"; return 1 }
  [[ ${BUF##*$'\e[?2004l'} == *$'\e[?2004h'* ]] || { fail "$name: unpin's choice left bracketed paste off, so a pasted newline chose"; return 1 }
  zpty -w -n sh $'\e[200~x\rprint -r -- PASTED_$((6*7))\r\e[201~'
  upto false 0.5 $name || :
  [[ $BUF != *Unpinned* ]] || { fail "$name: a paste into unpin's choice unpinned"; return 1 }
  zpty -w -n sh $'\e'
  upto '[[ $BUF == *"bench> "* ]]' 5 $name || { fail "$name: unpin's choice never closed"; return 1 }
  upto false 0.3 $name || :
  stop
  [[ $BUF != *PASTED_42* ]] || { fail "$name: a line pasted into preview or unpin's choice ran in the shell"; return 1 }
}

hovering() {
  local name=$1 REPLY session
  local -i from
  TERMINAL=iterm2
  start $name
  upto '[[ $BUF == *TYPED_42* ]] && prompts && (( REPLY >= 2 ))' 5 $name || { fail "$name: no prompt within 5s"; return 1 }
  zpty -w -n sh $'ttheme\r'
  upto '[[ $BUF == *$'"'"'\e[?1049h'"'"'*$'"'"'\e[?2026l'"'"'* ]]' 5 $name || { fail "$name: preview never drew"; return 1 }
  from=${#BUF}
  zpty -w -n sh $'\e[C'
  repeat 8; do
    zpty -w -n sh $'\e[B'
    upto false 0.05 $name || :
  done
  session=${BUF[from+1,-1]}
  zpty -w -n sh $'\e'
  upto '[[ $BUF == *$'"'"'\e[?1049l'"'"'*"bench> "* ]]' 5 $name || { fail "$name: preview never closed"; return 1 }
  stop
  TERMINAL=""
  if [[ $name == *-switch ]]; then
    [[ $session == *$'\e]1337;SetProfile=ttheme · '* ]] ||
      { fail "$name: hovering palettes in an iTerm2 that lets the shell switch profiles never switched one, so nothing was tested"; return 1 }
    [[ $session != *($'\e]4;'|$'\e]10;#'|$'\e]11;#')* ]] ||
      { fail "$name: a preview hover in iTerm2 painted OSC colors where one profile switch carries the whole palette in a fraction of the time"; return 1 }
    return 0
  fi
  [[ $session == *$'\e]11;#'* ]] || { fail "$name: hovering palettes in iTerm2 never painted one, so nothing was tested"; return 1 }
  [[ $session != *$'\e]4;'* ]] || { fail "$name: a preview hover in iTerm2 paints the ANSI colors again — each OSC color is a profile change there that holds its parser, and twenty per hover made every arrow key lag"; return 1 }
}

hostile() {
  local name=$1 REPLY
  home $name off
  print -rl -- 'autoload -Uz compinit && compinit -u -d $HOME/.zcompdump' "PROMPT='bench> '" \
    'setopt no_clobber sh_word_split ksh_arrays no_unset warn_create_global glob_subst extended_glob' \
    'source $XDG_CONFIG_HOME/ttheme/ttheme.zsh' > $WORK/$name/.zshrc
  measure $name stderr 0
  start $name
  upto '[[ $BUF == *TYPED_42* ]] && prompts && (( REPLY >= 2 ))' 5 $name || { fail "$name: no prompt within 5s"; return 1 }
  step $'ttheme use kita\r' $name
  step $'cd /\r' $name
  stop
  [[ $BUF == *$'\e]11;#'* ]] || { fail "$name: ttheme use painted nothing under the user's options"; return 1 }
  [[ $BUF != *(parameter not set|file exists|bad pattern|bad output format|bad substitution|bad math|no matches found|created globally|command not found)* ]] ||
    { fail "$name: the layer broke under options a user's .zshrc sets before it"; return 1 }
}

returning() {
  local name=$1 REPLY
  start $name
  upto '[[ $BUF == *TYPED_42* ]] && prompts && (( REPLY >= 2 ))' 5 $name || { fail "$name: no prompt within 5s"; return 1 }
  BUF=""
  zpty -w -n sh $'ttheme\r'
  upto '[[ $BUF == *$'"'"'\e[?1049h'"'"'*$'"'"'\e[?2026l'"'"'* ]]' 5 $name || { fail "$name: preview never drew"; return 1 }
  BUF=""
  zpty -w -n sh $'\e[Z'
  repeat 25; do
    upto false 0.015 $name || :
    zpty -w -n sh $'\e[B'
  done
  [[ $BUF == *"now 30×10"* ]] || { fail "$name: preview came back from a screen the window was resized under still drawing for the size it had before"; return 1 }
  zpty -w -n sh $'\e'
  upto '[[ $BUF == *$'"'"'\e[?1049l'"'"'* ]]' 5 $name || { fail "$name: preview never closed"; return 1 }
  stop
}

late() {
  local name=$1
  home $name off
  LATE=0.5
  start $name
  upto '[[ $BUF == *"bench> "* ]]' 5 $name || { LATE=0; fail "$name: no prompt within 5s"; return 1 }
  upto '(( ! ${#LATER} ))' 2 $name || :
  LATE=0
  step $'print -r -- AFTER_$((5*5))\r' $name
  [[ $BUF == *AFTER_25* && $BUF != *(command not found|no such file or directory)* ]] ||
    { fail "$name: an answer the terminal sent after the layer stopped waiting reached the command line"; return 1 }
  stop
}

check() {
  local name
  home base
  home off off
  home seq seq
  home terminal-app off
  home iterm2 off
  home iterm2-switch off
  print -rl -- 'typeset -g TTHEME_ITERM_SWITCH=1' "typeset -g TTHEME_ITERM_PROFILES=$WORK/iterm2-switch/profiles.json" >> $WORK/iterm2-switch/.config/ttheme/palettes.zsh
  print -r -- '{}' > $WORK/iterm2-switch/profiles.json
  touch -t 202001010000 $WORK/iterm2-switch/profiles.json
  for name in base off seq terminal-app; do
    measure $name stderr 0
    [[ $name == (base|seq) ]] || (( ASKED[$name] )) || { fail "$name: the layer asked the terminal nothing, so nothing was tested"; return 1 }
  done
  for name in off terminal-app; do
    measure $name stderr 0
    (( ASKED[$name] )) || { fail "$name: a second tab never checked the colors it remembered"; return 1 }
    [[ ${BUF%%$'\e]11;?'*} == *"bench> "* ]] || { fail "$name: a second tab asked the terminal before its first prompt"; return 1 }
  done
  typing off
  flow off
  home paste off
  mkdir -p $WORK/paste/a/b
  print -rl -- "$WORK/paste/a kita" "$WORK/paste/a/b rei" > $WORK/paste/.config/ttheme/pins
  pasting paste
  home back off
  print -r -- "const { execSync } = require('node:child_process'); if (process.argv[2] === 'browse') { execSync('stty rows 10 cols 30', { stdio: 'inherit' }); process.exit(21) } process.exit(1)" > $WORK/back/.config/ttheme/ttheme.js
  returning back
  hovering iterm2
  hovering iterm2-switch
  hostile options
  late late
  print "latency check ok — typeahead and stderr survive the startup queries (base, off, seq, terminal-app), a second tab asks only after its prompt, preview never echoes keys, its idle hint redraws one row, its hover in iTerm2 switches profiles where it may and otherwise leaves the ANSI colors alone, ctrl+s never stops its output, a paste never presses its keys, a late answer is never typed into it and it redraws for a window resized under another screen, a .zshrc's own options break none of it, and an answer that comes after the layer stopped waiting never reaches the command line"
}

bench() {
  local -a against
  zparseopts -D -E -F -- -against:=against || { usage; return 1 }
  local runs=${1:-30} ref=$against[-1] name i k REPLY lo hi
  local -a names=(base off seq terminal-app) order d a b
  local -A sum=() base=()
  if [[ -n $ref ]]; then
    git -C $ROOT rev-parse -q --verify "$ref^{commit}" > /dev/null || { print -u2 "no commit $ref"; return 1 }
    mkdir -p $WORK/ref
    git -C $ROOT archive "$ref" shell | tar -x -C $WORK/ref
    names+=(ref-off ref-seq ref-terminal-app)
  fi
  home base
  for name in ${names:#base}; do
    home $name ${${name#ref-}/terminal-app/off} ${${(M)name:#ref-*}:+$WORK/ref/shell}
  done
  for name in $names; do measure $name "" 1 > /dev/null; done
  for i in {1..$runs}; do
    order=(${(Oa)names})
    (( i % 2 )) && order=($names)
    for name in $order; do
      measure $name "" 5
      sum[$name.first_prompt]+=" $fp" sum[$name.first_command]+=" $fc"
      median $cl; sum[$name.command]+=" $REPLY"
      median $il; sum[$name.input]+=" $REPLY"
    done
    print -nu2 "\r$i/$runs"
  done
  print -u2
  printf '%-18s' "ms, median"
  for k in $METRICS; do printf '%24s' "${k//_/ } (≤$LIMIT[$k])"; done
  print
  for name in $names; do
    printf '%-18s' ${name/#ref-/$ref }
    for k in $METRICS; do
      if [[ ${sum[$name.$k]} == *lost* ]]; then
        printf '%24s' "typed keys lost"
        continue
      fi
      median ${=sum[$name.$k]}
      if [[ $name == base ]]; then
        base[$k]=$REPLY
        printf '%24.2f' $REPLY
      else
        printf '%13.2f %+6.2f %2d%%' $REPLY $(( REPLY - base[$k] )) $(( (REPLY - base[$k]) * 100 / LIMIT[$k] ))
      fi
    done
    print
  done
  print "$runs runs per shell, interleaved; each ttheme row is the median, its difference from base, and that difference as a share of zsh-bench's threshold (the largest latency its author could not tell from zero)"
  [[ -n $ref ]] || return 0
  print "\nworking tree minus $ref, paired by run: median [p25, p75]"
  for name in off seq terminal-app; do
    printf '%-18s' $name
    for k in $METRICS; do
      a=(${=sum[$name.$k]}) b=(${=sum[ref-$name.$k]}) d=()
      if [[ "$a $b" == *lost* ]]; then
        printf '%24s' "typed keys lost"
        continue
      fi
      for i in {1..$#a}; do d+=$(( a[i] - b[i] )); done
      quantile 25 $d; lo=$REPLY
      quantile 75 $d; hi=$REPLY
      median $d
      printf '%24s' "$(printf '%+.2f [%+.2f, %+.2f]' $REPLY $lo $hi)"
    done
    print
  done
}

ticks() {
  local frame
  local -a frames=("${(@ps:\e[?2026h:)${BUF[$1+1,-1]}}")
  REPLY=0 reply=()
  for frame in ${frames[2,-1]}; do
    [[ $frame == *$'\e[?2026l'* ]] || continue
    if [[ $frame == *$'\n'* ]]; then
      reply=(${#frame})
      break
    fi
    (( ++REPLY ))
  done
  return 0
}

traced() {
  local name=$1 term=$2 mode=$3 focus=$4 keys REPLY
  local -a counts=()
  TERMINAL=$term EXTRA=(TTHEME_TAB_PALETTE=$mode)
  start $name
  upto '[[ $BUF == *TYPED_42* ]] && prompts && (( REPLY >= 2 ))' 5 $name || { fail "$name ($term, $mode): no prompt after the command typed ahead"; return 1 }
  stop
  EXTRA=(TTHEME_TAB_PALETTE=$mode TT_TRACE=1)
  : > $WORK/$name/trace
  start $name
  upto '[[ $BUF == *TYPED_42* ]] && prompts && (( REPLY >= 2 ))' 5 $name || { fail "$name ($term, $mode): no prompt after the command typed ahead"; return 1 }
  MARK=0
  forked $name
  counts+=($REPLY)
  if [[ $mode == off ]]; then
    for keys in $'\r' ${focus:+$'\e[I\r'} $'cd /\r'; do
      mark $name
      step $keys $name
      forked $name
      counts+=($REPLY)
    done
  else
    mark $name
    step "print -n '\\e]112\\e\\\\'"$'\r' $name
    step $'\r' $name
    forked $name
    counts+=($REPLY)
  fi
  stop
  TERMINAL="" EXTRA=()
  reply=($counts)
}

focused() { grep -qxF '__tt_follows_focus() { return 0 }' $ROOT/shell/adapters/$1.zsh }

forks() {
  local -a upd head terms journeys base painted counts row out
  local -A want got
  local term journey line cell expect mark focus
  local -i i more=0 less=0
  zparseopts -D -E -F -- -update=upd || { usage; return 1 }
  head=(${=${(f)"$(<$FORKS)"}[1]})
  terms=(${head[2,-1]})
  for line in ${${(f)"$(<$FORKS)"}[2,-1]}; do
    row=(${=line})
    journeys+=($row[1])
    for (( i = 2; i <= $#row; i++ )); do want[$row[1].$terms[i-1]]=$row[i]; done
  done
  home fork-base
  home fork off
  traced fork-base ghostty off || return 1
  base=($reply)
  traced fork-base ghostty seq || return 1
  painted=($reply)
  for term in $terms; do
    focus=""
    focused $term && focus=1
    traced fork $term off $focus || return 1
    counts=($reply)
    got[start.$term]=$(( counts[1] - base[1] ))
    got[command.$term]=$(( counts[2] - base[2] ))
    got[focus.$term]=-
    (( $#counts == 4 )) && got[focus.$term]=$(( counts[3] - base[2] ))
    got[cd.$term]=$(( counts[-1] - base[3] ))
    traced fork $term seq || return 1
    got[start-seq.$term]=$(( reply[1] - base[1] ))
    got[mend.$term]=$(( reply[2] - painted[2] ))
  done
  if (( $#upd )); then
    out=("${(pj:\t:)head}")
    for journey in $journeys; do
      row=($journey)
      for term in $terms; do row+=(${got[$journey.$term]}); done
      out+=("${(pj:\t:)row}")
    done
    print -rl -- $out > $FORKS
    print -r -- "wrote $FORKS"
    return 0
  fi
  printf '%-12s' 'forks'
  printf ' %-18s' $terms
  print
  for journey in $journeys; do
    printf '%-12s' $journey
    for term in $terms; do
      cell=${got[$journey.$term]} expect=${want[$journey.$term]}
      if [[ $cell == $expect ]]; then
        mark="✓ $cell"
      elif [[ $cell == - || $expect == - ]] || (( cell > expect )); then
        mark="✗ $cell, was $expect" more+=1
      else
        mark="+ $cell, was $expect" less+=1
      fi
      printf ' %-18s' $mark
    done
    print
  done
  print -r -- "processes a shell with ttheme starts beyond a bare zsh, counted from its xtrace: a warm new tab (start, start-seq), an empty command, a focus-in, a cd, and a command that resets a painted tab's cursor (mend)"
  (( more )) && print -u2 "✗: a hot path starts a process again that $FORKS says it does not — find the new \$(…) or external command"
  (( less )) && print -u2 "+: fewer processes than $FORKS — lock the win in with \`mise run forks --update\`"
  (( more + less == 0 ))
}

usage() { print -u2 "usage: latency.zsh check | forks [--update] | bench [--against <ref>] [runs]" }

case $1 in
  check) check ;;
  forks) shift; forks $@ ;;
  bench) shift; bench $@ ;;
  *) usage; return 1 ;;
esac
