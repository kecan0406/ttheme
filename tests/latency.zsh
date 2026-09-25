#!/usr/bin/env zsh
emulate -L zsh
setopt err_return pipe_fail extended_glob
zmodload zsh/zpty zsh/zselect zsh/datetime

typeset -g ROOT=${${(%):-%x}:A:h:h}
typeset -g WORK=$(mktemp -d)
typeset -g BUF="" FD=""
typeset -gA ASKED=()
typeset -ga METRICS=(first_prompt first_command command input)
typeset -gA LIMIT=(first_prompt 50 first_command 150 command 10 input 20)
trap 'zpty -d sh 2>/dev/null; rm -rf $WORK' EXIT

home() {
  local h=$WORK/$1 tab=$2 src=${3:-$ROOT/shell}
  mkdir -p $h
  print -rl -- 'skip_global_compinit=1' 'print -rn -- UP_$((2*3))' > $h/.zshenv
  print -rl -- 'autoload -Uz compinit && compinit -u -d $HOME/.zcompdump' "PROMPT='bench> '" > $h/.zshrc
  [[ -n $tab ]] || return 0
  mkdir -p $h/.config/ttheme
  cp -R $src/ttheme.zsh $src/adapters $ROOT/dist/shell/palettes.zsh $h/.config/ttheme/
  print -r -- ": \${TTHEME_TAB_PALETTE:=$tab}" > $h/.config/ttheme/config.zsh
  print -r -- 'source $XDG_CONFIG_HOME/ttheme/ttheme.zsh' >> $h/.zshrc
}

answer() {
  local p out=""
  for p in "${(@ps:\e:)1}"; do
    case $p in
      \](<->|4\;<->)\;\?*) out+=$'\e'"${p%%\?*}rgb:1e1e/1e1e/2e2e"$'\e\\'; ASKED[$2]=1 ;;
      \[5n*) out+=$'\e[0n' ;;
      \[16t*) out+=$'\e[6;16;8t' ;;
    esac
  done
  [[ -z $out ]] || zpty -w -n sh "$out"
}

upto() {
  local chunk
  local -F end=$(( EPOCHREALTIME + $2 ))
  until eval $1; do
    (( EPOCHREALTIME < end )) || return 1
    zselect -t 1 -r $FD || continue
    zpty -rt sh chunk || continue
    BUF+=$chunk
    answer "$chunk" $3
  done
}

prompts() { REPLY=$(( ${#${(@s:bench> :)BUF}} - 1 )) }

start() {
  local name=$1 h=$WORK/$1
  local -a env=(PATH=$PATH HOME=$h ZDOTDIR=$h XDG_CONFIG_HOME=$h/.config XDG_STATE_HOME=$h/.state XDG_CACHE_HOME=$h/.cache TERM=xterm-256color)
  [[ $name == (ref-|)terminal-app ]] && env+=(TERM_PROGRAM=Apple_Terminal) || env+=(GHOSTTY_RESOURCES_DIR=x)
  BUF="" ASKED[$name]=0
  zpty -d sh 2>/dev/null || :
  typeset -gF T0=$EPOCHREALTIME
  zpty -b sh env -i ${(q)env} zsh -i
  FD=$REPLY
  upto '[[ $BUF == *UP_6* ]]' 5 $name || { fail "$name: the shell never started"; return 1 }
  zpty -w -n sh $'print -r -- TYPED_$((6*7))\r'
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
  zpty -d sh
}

quantile() {
  local p=$1
  shift
  local -a s=(${(f)"$(print -l -- $@ | sort -g)"})
  REPLY=$s[$(( (${#s} - 1) * p / 100 + 1 ))]
}

median() { quantile 50 $@ }

check() {
  local name
  home base
  home off off
  home seq seq
  home terminal-app off
  for name in base off seq terminal-app; do
    measure $name stderr 0
    [[ $name == (base|seq) ]] || (( ASKED[$name] )) || { fail "$name: the layer asked the terminal nothing, so nothing was tested"; return 1 }
  done
  print "latency check ok — typeahead and stderr survive the startup queries (base, off, seq, terminal-app)"
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

usage() { print -u2 "usage: latency.zsh check | bench [--against <ref>] [runs]" }

case $1 in
  check) check ;;
  bench) shift; bench $@ ;;
  *) usage; return 1 ;;
esac
