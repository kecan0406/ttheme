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
  empty ''
  few   'konata kita'
)

typeset -ga SCENARIOS=(
  'browse-empty    empty  browse'
  'browse-filter   few    browse   k i'
  'browse-picked   few    browse   Right Down Tab'
  'browse-series   few    browse   Tab'
  'list-few        few    list'
  'menu-few        few    menu'
  'menu-empty      empty  menu'
  'preview-folded  few    preview'
  'preview-open    few    preview  Down Right'
  'preview-keys    few    preview  ?'
)

fixture_home() {
  local state=$1 home
  home=$(mktemp -d)
  env -i PATH=$PATH HOME=$home XDG_CONFIG_HOME=$home ZDOTDIR=$home GHOSTTY_RESOURCES_DIR=x \
    node $ROOT/bin/ttheme.js init --yes < /dev/null > /dev/null
  cp $FIXTURE $home/ttheme/catalog.json
  local -a palettes=(${=STATES[$state]})
  if (( ${#palettes} )); then
    env -i PATH=$PATH HOME=$home XDG_CONFIG_HOME=$home \
      node $ROOT/bin/ttheme.js add $palettes > /dev/null
  fi
  print -r -- $home
}

command_for() {
  local target=$1 home=$2 inner
  case $target in
    browse|list|add|remove) inner="node $ROOT/bin/ttheme.js $target" ;;
    preview) inner="source $home/ttheme/ttheme.zsh; ttheme preview" ;;
    menu) inner="source $home/ttheme/ttheme.zsh; ttheme" ;;
    *) print -u2 "unknown target $target"; return 1 ;;
  esac
  print -r -- "zsh -f -c '${inner}; sleep 60'"
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

normalize() {
  sed -e 's/[[:space:]]*$//' -e 's/search….*/search… ‹hint›/' |
    awk 'BEGIN{n=0} {lines[n++]=$0} END{while(n>0 && lines[n-1]=="") n--; for(i=0;i<n;i++) print lines[i]}'
}

capture() {
  local state=$1 target=$2; shift 2
  local home cmd key
  home=$(fixture_home $state)
  cmd=$(command_for $target $home)
  tmux -L $SOCKET kill-server 2>/dev/null || true
  tmux -L $SOCKET new-session -d -x $COLS -y $ROWS \
    -e XDG_CONFIG_HOME=$home -e HOME=$home -e NO_COLOR=1 \
    -e TTHEME_FORCE=1 -e TTHEME_SORT=abc -e TTHEME_ANNOUNCE=0 \
    "$cmd"
  settle
  for key in "$@"; do
    tmux -L $SOCKET send-keys -- "$key"
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

run() {
  local mode=$1 line name state target failed=0 golden actual
  mkdir -p $SCREENS
  for line in $SCENARIOS; do
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
  (( failed )) && { print -u2 "\ntui: screens changed — look at the diff, then \`mise run tui:update\` if it is right"; return 1 }
  print "\ntui ok — ${#SCENARIOS} screens"
}

demo() {
  local line
  if ! line=$(scenario_fields $1); then
    print -u2 "no scenario named ${1:-<none>} — try one of:"
    local l
    for l in $SCENARIOS; do print -u2 "  ${${=l}[1]}"; done
    return 1
  fi
  local -a parts=(${=line})
  local home
  home=$(fixture_home $parts[2])
  print "$parts[1] — state '$parts[2]' in $home"
  XDG_CONFIG_HOME=$home HOME=$home NO_COLOR=$NO_COLOR TTHEME_FORCE=1 TTHEME_SORT=abc TTHEME_ANNOUNCE=0 \
    zsh -f -c "$(case $parts[3] in
      browse|list) print -r -- "node $ROOT/bin/ttheme.js $parts[3]" ;;
      preview) print -r -- "source $home/ttheme/ttheme.zsh; ttheme preview" ;;
      menu) print -r -- "source $home/ttheme/ttheme.zsh; ttheme" ;;
    esac)"
  rm -rf $home
}

case ${1:-check} in
  --update|update) run update ;;
  demo) shift; demo $1 ;;
  *) run check ;;
esac
