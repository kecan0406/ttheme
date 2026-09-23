#!/usr/bin/env zsh
emulate -L zsh
setopt err_return pipe_fail

typeset -g ROOT=${${(%):-%x}:A:h:h}
typeset -g REAL_HOME=$HOME
typeset -g SANDBOX=${${TMPDIR:-/tmp}%/}/ttheme-sandbox
typeset -g SUITE=ttheme-sandbox
typeset -g SUITE_DIR="$HOME/Library/Application Support/$SUITE"
typeset -g ITERM_APP="^[^ ]*/iTerm2 -suite $SUITE( |$)"
typeset -g ITERM_SERVER="^$SUITE_DIR/iTermServer"
typeset -g WEZTERM_APP=${TTHEME_WEZTERM_APP:-/Applications/WezTerm.app}
typeset -g WEZTERM_GUI="wezterm-gui --config-file $SANDBOX/"
typeset -g WARP_LAUNCH=$HOME/.warp/launch_configurations/ttheme-sandbox.yaml
typeset -ga FOREIGN=(GHOSTTY_RESOURCES_DIR GHOSTTY_BIN_DIR GHOSTTY_SHELL_FEATURES TERM_PROGRAM TERM_PROGRAM_VERSION
  COLORTERM TERMINFO KITTY_WINDOW_ID ITERM_SESSION_ID ITERM_PROFILE WEZTERM_PANE WEZTERM_EXECUTABLE WEZTERM_UNIX_SOCKET
  WT_SESSION WT_PROFILE_ID ALACRITTY_WINDOW_ID)

quit_iterm() {
  local i
  pkill -f -- $ITERM_APP 2>/dev/null || :
  for i in {1..30}; do
    pgrep -f -- $ITERM_APP > /dev/null || break
    sleep 0.1
  done
  pkill -f -- $ITERM_SERVER 2>/dev/null || :
}

fresh() {
  pkill -f -- "--config-file=$SANDBOX/" 2>/dev/null || :
  pkill -f -- $WEZTERM_GUI 2>/dev/null || :
  quit_iterm
  defaults delete $SUITE 2>/dev/null || :
  rm -rf -- $SANDBOX $SUITE_DIR
  mkdir -p $SANDBOX
  print -rl -- 'autoload -Uz compinit && compinit' "PROMPT='%F{8}sandbox%f %~ %# '" > $SANDBOX/.zshrc
}

isolate() {
  unset ${(M)${(k)parameters}:#TTHEME_*} XDG_CONFIG_HOME XDG_STATE_HOME XDG_CACHE_HOME ZDOTDIR
  export HOME=$SANDBOX TTHEME_ITERM_SUITE=$SUITE
}

wire() {
  local label=$1
  shift
  node $ROOT/bin/ttheme.js init --yes > /dev/null
  (( $# == 0 )) || node $SANDBOX/.config/ttheme/ttheme.js add $@ > /dev/null
  print -r -- "ttheme sandbox — $SANDBOX"
  print -r -- "palettes: $label"
}

open_ghostty() {
  open -na Ghostty --args \
    --config-default-files=false \
    --config-file=$SANDBOX/.config/ghostty/config \
    --window-save-state=never \
    --working-directory=$SANDBOX
}

open_iterm() {
  local legacy=$1 trust=$2 behind=$3
  local dp="$SANDBOX/Library/Application Support/iTerm2/DynamicProfiles"
  local shell="/usr/bin/env HOME=$SANDBOX TTHEME_ITERM_SUITE=$SUITE ZDOTDIR=$SANDBOX XDG_CONFIG_HOME=$SANDBOX/.config XDG_STATE_HOME=$SANDBOX/.local/state XDG_CACHE_HOME=$SANDBOX/.cache /bin/zsh -il"
  mkdir -p $dp
  jq -n --arg cmd $shell --arg dir $SANDBOX '{Profiles: [{
      Name: "ttheme sandbox", Guid: "sandbox",
      "Custom Command": "Yes", Command: $cmd,
      "Custom Directory": "Yes", "Working Directory": $dir,
      "Close Sessions On End": true
    }]}' > $dp/sandbox.json
  defaults write $SUITE DynamicProfilesPath -string $dp
  defaults write $SUITE "Default Bookmark Guid" -string sandbox
  defaults write $SUITE EnableAPIServer -bool true
  defaults write $SUITE SetCookie -bool true
  defaults write $SUITE SetIT2AppPath -bool true
  defaults write $SUITE PromptOnQuit -bool false
  defaults write $SUITE NoSyncVariablesToReport -string allow:id,allow:tab.id,allow:tab.window.id,allow:profileName,allow:user.ttheme_bg
  (( legacy )) && defaults write $SUITE UseMetal -bool false
  if (( trust )); then
    defaults write $SUITE PreventEscapeSequenceFromChangingProfile -bool false
    local key
    for key in Blend "Background Image Mode" "Background Image Location"; do
      defaults write $SUITE "NoSyncSetProfileProperty_$key" -int 0
    done
  fi
  env -u GHOSTTY_RESOURCES_DIR -u GHOSTTY_BIN_DIR -u GHOSTTY_SHELL_FEATURES -u TERM_PROGRAM -u TERM_PROGRAM_VERSION \
    -u COLORTERM -u TERMINFO -u KITTY_WINDOW_ID -u ITERM_SESSION_ID \
    open ${behind:+-g} -na iTerm --args -suite $SUITE \
    -ApplePersistenceIgnoreState YES -NSQuitAlwaysKeepsWindows NO -SUHasLaunchedBefore YES -SUEnableAutomaticChecks NO
}

sandbox_shell() {
  REPLY="/usr/bin/env HOME=$SANDBOX ZDOTDIR=$SANDBOX XDG_CONFIG_HOME=$SANDBOX/.config XDG_STATE_HOME=$SANDBOX/.local/state XDG_CACHE_HOME=$SANDBOX/.cache /bin/zsh -il"
}

open_wezterm() {
  [[ -x $WEZTERM_APP/Contents/MacOS/wezterm-gui ]] || return 1
  env ${FOREIGN/#/-u} $WEZTERM_APP/Contents/MacOS/wezterm-gui --config-file $SANDBOX/.config/wezterm/wezterm.lua \
    start --always-new-process --cwd $SANDBOX -- /bin/zsh -il > /dev/null 2>&1 &!
}

open_warp() {
  local behind=$1 REPLY
  [[ -d /Applications/Warp.app ]] || return 1
  sandbox_shell
  mkdir -p ${WARP_LAUNCH:h}
  print -rl -- "name: ${WARP_LAUNCH:t:r}" 'windows:' '  - tabs:' '      - title: ttheme sandbox' '        layout:' \
    "          cwd: $SANDBOX" '        commands:' "          - exec: exec $REPLY" > $WARP_LAUNCH
  env ${FOREIGN/#/-u} open ${behind:+-g} "warp://launch/${WARP_LAUNCH:t}"
}

open_terminal_app() {
  local behind=$1 REPLY
  sandbox_shell
  print -rl -- '#!/bin/zsh -f' "exec $REPLY" > $SANDBOX/sandbox.command
  chmod +x $SANDBOX/sandbox.command
  env ${FOREIGN/#/-u} open ${behind:+-g} -a Terminal $SANDBOX/sandbox.command --args -ApplePersistenceIgnoreState YES
}

hand_back() {
  local front=$1 parent=$2 pid i
  for i in {1..50}; do
    pid=$(pgrep -f -- $parent) && pgrep -P ${pid%%$'\n'*} > /dev/null && break
    sleep 0.1
  done
  osascript -l JavaScript -e "ObjC.import('AppKit'); \$.NSRunningApplication.runningApplicationWithProcessIdentifier($front).activateWithOptions(0)" > /dev/null
}

usage() { print -u2 "usage: sandbox [--here | --behind] [--iterm [--legacy] [--trust] | --wezterm | --warp | --terminal-app] [--zshenv FILE] [--empty | palette…]" }

main() {
  local -a here behind iterm wezterm warp tapp legacy trust empty zshenv
  zparseopts -D -E -F -- -here=here -behind=behind -iterm=iterm -wezterm=wezterm -warp=warp -terminal-app=tapp \
    -legacy=legacy -trust=trust -empty=empty -zshenv:=zshenv || { usage; return 1 }
  local -i other=$(( $#iterm + $#wezterm + $#warp + $#tapp ))
  (( other > 1 || $#here && ($#behind || other) || ($#legacy || $#trust) && ! $#iterm || $#empty && $# )) && { usage; return 1 }
  local -a palettes=($@)
  local label=${(j: :)palettes}
  if (( $#empty )); then
    label="none, \`ttheme browse\` picks them"
  elif (( ! $#palettes )); then
    palettes=(${(f)"$(node -p "require(process.argv[1]).palettes.map((p) => p.name).join('\\n')" $ROOT/dist/manifest.json)"})
    label="all $#palettes"
  fi
  fresh
  (( $#zshenv )) && cp -- $zshenv[-1] $SANDBOX/.zshenv
  isolate
  if (( $#here )); then
    wire $label $palettes
    print -r -- "exit leaves; files stay until the next run"
    cd $HOME
    exec zsh -il
  fi
  export XDG_CONFIG_HOME=$SANDBOX/.config XDG_STATE_HOME=$SANDBOX/.local/state XDG_CACHE_HOME=$SANDBOX/.cache ZDOTDIR=$SANDBOX
  local front=${$(lsappinfo info -only pid "$(lsappinfo front)")##*=}
  if (( $#iterm )); then
    ( unset GHOSTTY_RESOURCES_DIR TERM_PROGRAM KITTY_WINDOW_ID; ITERM_SESSION_ID=w0 wire $label $palettes )
    open_iterm $#legacy $#trust "${behind:+1}" || { print -u2 "no iTerm2 to open"; return 1 }
    (( $#behind )) && hand_back $front $ITERM_SERVER
    print -r -- "opened a separate iTerm2 (settings suite $SUITE) on it — ⌘Q quits only that one; files stay until the next run"
    return
  fi
  if (( $#wezterm )); then
    ( unset $FOREIGN; WEZTERM_PANE=0 wire $label $palettes )
    open_wezterm || { print -u2 "no WezTerm at $WEZTERM_APP — TTHEME_WEZTERM_APP names another WezTerm.app"; return 1 }
    (( $#behind )) && hand_back $front $WEZTERM_GUI
    print -r -- "opened a separate WezTerm on it — ⌘Q quits only that one; files stay until the next run"
    return
  fi
  if (( $#warp )); then
    ( unset $FOREIGN; TERM_PROGRAM=WarpTerminal wire $label $palettes )
    open_warp "${behind:+1}" || { print -u2 "no Warp to open"; return 1 }
    print -r -- "opened a Warp tab on it through ${WARP_LAUNCH/#$REAL_HOME/~} — exit leaves; files stay until the next run"
    return
  fi
  if (( $#tapp )); then
    ( unset $FOREIGN; GHOSTTY_RESOURCES_DIR=x wire $label $palettes )
    open_terminal_app "${behind:+1}" || { print -u2 "Terminal.app did not open a window"; return 1 }
    print -r -- "opened a Terminal.app window on it — exit leaves; files stay until the next run"
    return
  fi
  GHOSTTY_RESOURCES_DIR=${GHOSTTY_RESOURCES_DIR:-x} wire $label $palettes
  open_ghostty || { print -u2 "no Ghostty to open — \`mise run sandbox --here\` runs it in this tab"; return 1 }
  (( $#behind )) && hand_back $front "--config-file=$SANDBOX/"
  print -r -- "opened a separate Ghostty on it — ⌘Q quits only that one; files stay until the next run"
}

main $@
