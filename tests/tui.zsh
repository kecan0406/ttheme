#!/usr/bin/env zsh
emulate -L zsh
setopt err_return pipe_fail

if ! command -v tmux > /dev/null 2>&1; then
  print "tui skipped — no tmux on this machine"
  exit 0
fi

typeset -g ROOT=${${(%):-%x}:A:h:h}
typeset -g SOCKET=ttheme-tui
typeset -g SCREENS=$ROOT/tests/screens
typeset -g FIXTURE=$ROOT/tests/fixture.json
typeset -g COLS=100 ROWS=24

typeset -gA STATES=(
  empty  ''
  few    'konata kita'
  market 'konata fix@shop/arcade'
  pinned 'konata kita'
)

typeset -ga SCENARIOS=(
  'browse-empty    empty  browse'
  'browse-filter   few    browse   k i'
  'browse-picked   few    browse   Right Down Right Down Space'
  'browse-review   few    browse   Right Down Right Down Space Enter'
  'browse-series   few    browse   Right Down Space'
  'browse-scope   market browse   v C-s C-s'
  'browse-markets  market browse   Down DC'
  'browse-keys     few    browse   ?'
  'list-few        few    list'
  'hub-few         few    hub'
  'hub-empty       empty  hub'
  'hub-browse      few    hub      Tab@GitHub'
  'hub-ask         few    hub      Tab@GitHub Right Down Right Down Space Tab@Apply'
  'hub-back        few    hub      Down Right Tab@GitHub BTab@PREVIEW'
  'hub-keys        few    hub      ?'
  'preview-open    few    hub  Down Right'
  'preview-config  few    hub  M-c'
  'preview-colors  few    hub  M-c Down Down Down Down Down Down Right'
  'theme-edit      few    hub  Down Right Down Tab@Palette'
  'theme-editor    few    hub  Down Right Down Tab@Palette Enter@slot'
  'theme-keys      few    hub  Down Right Down Right@Palette ?'
  'browse-market   market browse   Down Right Down Right Down'
  'preview-market  market hub  Down Right Down Right Down'
  'hub-market      market hub'
  'pins-map        pinned pins'
  'pin-scope       pinned pin      Right Down Enter@PIN Left'
  'pin-repo        pinned pin-deep Right Down Enter@PIN Right'
  'pin-ssh         pinned pin-ssh  Right Down Enter@PIN'
  'unpin-choose    pinned unpin    Right'
)

fixture_home() {
  local state=$1 home
  home=$(mktemp -d)
  env -i PATH=$PATH HOME=$home XDG_CONFIG_HOME=$home TTHEME_NAMES=off TTHEME_AUTO_UPDATE=off ZDOTDIR=$home GHOSTTY_RESOURCES_DIR=x \
    node $ROOT/bin/ttheme.js init --yes < /dev/null > /dev/null
  cp $FIXTURE $home/ttheme/catalog.json
  if [[ $state == market ]]; then
    cp -R $ROOT/tests/market $home/shop
    env -i PATH=$PATH HOME=$home XDG_CONFIG_HOME=$home TTHEME_NAMES=off TTHEME_AUTO_UPDATE=off \
      node $ROOT/bin/ttheme.js market add $home/shop > /dev/null
  fi
  local -a palettes=(${=STATES[$state]})
  if (( ${#palettes} )); then
    env -i PATH=$PATH HOME=$home XDG_CONFIG_HOME=$home TTHEME_NAMES=off TTHEME_AUTO_UPDATE=off \
      node $ROOT/bin/ttheme.js add $palettes > /dev/null
  fi
  if [[ $state == pinned ]]; then
    mkdir -p $home/work/.git $home/work/api/v2 $home/work/site $home/notes
    print -l '~/work/**  konata' '~/work/site  kita' '~/notes/**  ryo' '/nonexistent-ttheme/archive/**  kita' 'ssh:tusa  konata' 'ssh:*.prod  kita' > $home/ttheme/pins
  fi
  print -r -- $home
}

command_for() {
  local target=$1 home=$2
  case $target in
    browse|list|add|remove) print -r -- "node $ROOT/bin/ttheme.js $target" ;;
    hub) print -r -- "source $home/ttheme/ttheme.zsh; ttheme" ;;
    pins) print -r -- "source $home/ttheme/ttheme.zsh; cd ~/work/api/v2; ttheme pins" ;;
    pin) print -r -- "source $home/ttheme/ttheme.zsh; cd ~/work; ttheme pin" ;;
    pin-deep) print -r -- "source $home/ttheme/ttheme.zsh; cd ~/work/api/v2; ttheme pin" ;;
    pin-ssh) print -r -- "source $home/ttheme/ttheme.zsh; cd ~/work; ttheme pin ssh:tusa" ;;
    unpin) print -r -- "source $home/ttheme/ttheme.zsh; cd ~/work/site; ttheme unpin" ;;
    *) print -u2 "unknown target $target"; return 1 ;;
  esac
}

scenario_env() {
  reply=(XDG_CONFIG_HOME=$1 HOME=$1 TTHEME_FORCE=1 TTHEME_SORT=abc TTHEME_ANNOUNCE=0 TTHEME_MARKET_LOOKUP=off TTHEME_NAMES=off TTHEME_AUTO_UPDATE=off)
}

settle() {
  local before='' after='' i
  for i in {1..80}; do
    after=$(tmux -L $SOCKET capture-pane -p 2>/dev/null) || return 0
    [[ -n ${after//[[:space:]]/} && $after == $before ]] && return 0
    before=$after
    sleep 0.12
  done
}

await() {
  local i
  for i in {1..150}; do
    tmux -L $SOCKET capture-pane -p 2>/dev/null | grep -qF -- "$1" && return 0
    sleep 0.1
  done
}

normalize() {
  expand -t 8 |
    sed -E -e 's/Search….*│$/Search… ‹hint› │/' -e t -e 's/Search….*/Search… ‹hint›/' |
    sed -e 's/[[:space:]]*$//' |
    awk 'BEGIN{n=0} {lines[n++]=$0} END{while(n>0 && lines[n-1]=="") n--; for(i=0;i<n;i++) print lines[i]}'
}

capture() {
  local state=$1 target=$2; shift 2
  local home cmd key
  local -a reply
  home=$(fixture_home $state)
  cmd=$(command_for $target $home)
  scenario_env $home
  tmux -L $SOCKET kill-server 2>/dev/null || true
  tmux -L $SOCKET new-session -d -x $COLS -y $ROWS \
    "env -u GHOSTTY_RESOURCES_DIR -u KITTY_WINDOW_ID -u WEZTERM_PANE -u ALACRITTY_WINDOW_ID -u ITERM_SESSION_ID $reply NO_COLOR=1 zsh -f -c '${cmd}; sleep 60'"
  settle
  for key in "$@"; do
    tmux -L $SOCKET send-keys -- "${key%%@*}"
    [[ $key == *@* ]] && await "${key#*@}"
    settle
  done
  tmux -L $SOCKET capture-pane -p | normalize
  tmux -L $SOCKET kill-server 2>/dev/null || true
  rm -rf $home
}

scenario_fields() {
  local line
  for line in $SCENARIOS; do
    local -a parts=(${=line})
    [[ $parts[1] == $1 ]] && { print -r -- $line; return 0 }
  done
  return 1
}

chosen() {
  local line pat
  reply=()
  for line in $SCENARIOS; do
    local -a parts=(${=line})
    if (( $# == 0 )); then
      reply+=($line)
      continue
    fi
    for pat in $@; do
      [[ $parts[1] == ${~pat} ]] && { reply+=($line); break }
    done
  done
  (( ${#reply} )) && return 0
  print -u2 "no scenario matches ${(j: :)@} — try one of:"
  for line in $SCENARIOS; do print -u2 "  ${${=line}[1]}"; done
  return 1
}

run() {
  local mode=$1 line name state target failed=0 golden actual
  local -a reply
  shift
  chosen $@
  local -a picked=($reply)
  mkdir -p $SCREENS
  for line in $picked; do
    local -a parts=(${=line})
    name=$parts[1] state=$parts[2] target=$parts[3]
    local -a keys=(${parts[4,-1]})
    golden=$SCREENS/$name.txt
    actual=$(capture $state $target $keys)
    if [[ $mode == update ]]; then
      print -r -- $actual > $golden
      print "  updated $name"
    elif [[ ! -f $golden ]]; then
      print -u2 "  ✗ $name — no golden screen, run \`mise run tui:update\`"
      failed=1
    elif [[ $actual == "$(<$golden)" ]]; then
      print "  ✓ $name"
    else
      print -u2 "  ✗ $name"
      diff $golden =(print -r -- $actual) | sed 's/^/      /' >&2 || true
      failed=1
    fi
  done
  (( failed )) && { print -u2 "\ntui: screens changed — look at the diff, then \`mise run tui:update${*:+ ${(j: :)${(q)@}}}\` if it is right"; return 1 }
  print "\ntui ok — ${#picked} screens"
}

demo() {
  local line
  if ! line=$(scenario_fields $1); then
    print -u2 "no scenario named ${1:-<none>} — try one of:"
    local l
    for l in $SCENARIOS; do print -u2 "  ${${=l}[1]}"; done
    return 1
  fi
  local -a parts=(${=line}) reply
  local home cmd
  home=$(fixture_home $parts[2])
  cmd=$(command_for $parts[3] $home)
  scenario_env $home
  print "$parts[1] — state '$parts[2]' in $home"
  { env $reply zsh -f -c $cmd } always { rm -rf $home }
}

case ${1:-check} in
  --update|update) shift; run update $@ ;;
  demo) shift; demo $1 ;;
  check) run check ${@[2,-1]} ;;
  *) run check $@ ;;
esac
