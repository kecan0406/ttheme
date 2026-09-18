#!/usr/bin/env zsh
emulate -L zsh
setopt err_return pipe_fail

typeset -g ROOT=${${(%):-%x}:A:h:h}
typeset -g SANDBOX=${${TMPDIR:-/tmp}%/}/ttheme-sandbox

fresh() {
  pkill -f -- "--config-file=$SANDBOX/" 2>/dev/null || :
  rm -rf -- $SANDBOX
  mkdir -p $SANDBOX
  print -rl -- 'autoload -Uz compinit && compinit' "PROMPT='%F{8}sandbox%f %~ %# '" > $SANDBOX/.zshrc
}

isolate() {
  unset ${(M)${(k)parameters}:#TTHEME_*} XDG_CONFIG_HOME XDG_STATE_HOME ZDOTDIR
  export HOME=$SANDBOX
}

wire() {
  node $ROOT/bin/ttheme.js init --yes > /dev/null
  (( $# == 0 )) || node $SANDBOX/.config/ttheme/ttheme.js add $@ > /dev/null
  print -r -- "ttheme sandbox — $SANDBOX"
  print -r -- "palettes: ${${(j: :)@}:-none, \`ttheme browse\` picks them}"
}

open_ghostty() {
  open -na Ghostty --args \
    --config-default-files=false \
    --config-file=$SANDBOX/.config/ghostty/config \
    --window-save-state=never \
    --working-directory=$SANDBOX
}

hand_back() {
  local pid i
  for i in {1..50}; do
    pid=$(pgrep -f -- "--config-file=$SANDBOX/") && pgrep -P $pid > /dev/null && break
    sleep 0.1
  done
  osascript -l JavaScript -e "ObjC.import('AppKit'); \$.NSRunningApplication.runningApplicationWithProcessIdentifier($1).activateWithOptions(0)" > /dev/null
}

main() {
  local -a ghostty behind zshenv
  zparseopts -D -E -F -- -ghostty=ghostty -behind=behind -zshenv:=zshenv ||
    { print -u2 "usage: sandbox [--ghostty [--behind]] [--zshenv FILE] [palette…]"; return 1 }
  fresh
  (( $#zshenv )) && cp -- $zshenv[-1] $SANDBOX/.zshenv
  isolate
  if (( $#ghostty )); then
    export XDG_CONFIG_HOME=$SANDBOX/.config XDG_STATE_HOME=$SANDBOX/.local/state ZDOTDIR=$SANDBOX
    GHOSTTY_RESOURCES_DIR=${GHOSTTY_RESOURCES_DIR:-x} wire $@
    local front=${$(lsappinfo info -only pid "$(lsappinfo front)")##*=}
    open_ghostty
    (( $#behind )) && hand_back $front
    print -r -- "opened a separate Ghostty on it — ⌘Q quits only that one; files stay until the next run"
  else
    wire $@
    print -r -- "exit leaves; files stay until the next run"
    cd $HOME
    exec zsh -il
  fi
}

main $@
