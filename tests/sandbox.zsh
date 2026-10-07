#!/usr/bin/env zsh
emulate -L zsh
setopt err_return pipe_fail

typeset -g ROOT=${${(%):-%x}:A:h:h}
typeset -g REAL_HOME=$HOME
typeset -g MINE=${XDG_CONFIG_HOME:-$HOME/.config}/ttheme
typeset -g SANDBOX=${${TMPDIR:-/tmp}%/}/ttheme-sandbox
typeset -g SUITE=ttheme-sandbox
typeset -g SUITE_DIR="$HOME/Library/Application Support/$SUITE"
typeset -g ITERM_APP="^[^ ]*/iTerm2 -suite $SUITE( |$)"
typeset -g ITERM_SERVER="^$SUITE_DIR/iTermServer"
typeset -g WEZTERM_APP=${TTHEME_WEZTERM_APP:-/Applications/WezTerm.app}
typeset -g WEZTERM_GUI="wezterm-gui --config-file $SANDBOX/"
typeset -g KITTY_APP=${TTHEME_KITTY_APP:-/Applications/kitty.app}
typeset -g KITTY_GUI="kitty --config $SANDBOX/"
typeset -g ALACRITTY_APP=${TTHEME_ALACRITTY_APP:-/Applications/Alacritty.app}
typeset -g ALACRITTY_GUI="alacritty --config-file $SANDBOX/"
typeset -g WARP_LAUNCH=$HOME/.warp/launch_configurations/ttheme-sandbox.yaml
typeset -g KONSOLE_GUI="konsole --separate --workdir $SANDBOX"
typeset -g KONSOLE_SCREEN=${TTHEME_KONSOLE_SCREEN:-:77}
typeset -gi PICTURED=0 BRING=0
typeset -ga FOREIGN=(GHOSTTY_RESOURCES_DIR GHOSTTY_BIN_DIR GHOSTTY_SHELL_FEATURES TERM_PROGRAM TERM_PROGRAM_VERSION
  COLORTERM TERMINFO KITTY_WINDOW_ID ITERM_SESSION_ID ITERM_PROFILE WEZTERM_PANE WEZTERM_EXECUTABLE WEZTERM_UNIX_SOCKET
  WT_SESSION WT_PROFILE_ID ALACRITTY_WINDOW_ID KONSOLE_VERSION KONSOLE_DBUS_SERVICE KONSOLE_DBUS_SESSION KONSOLE_DBUS_WINDOW)

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
  pkill -f -- $KITTY_GUI 2>/dev/null || :
  pkill -f -- $ALACRITTY_GUI 2>/dev/null || :
  pkill -f -- $KONSOLE_GUI 2>/dev/null || :
  pkill -f -- "Xvfb $KONSOLE_SCREEN " 2>/dev/null || :
  quit_iterm
  defaults delete $SUITE 2>/dev/null || :
  rm -rf -- $SANDBOX $SUITE_DIR
  mkdir -p $SANDBOX
  print -rl -- 'autoload -Uz compinit && compinit' "PROMPT='%F{8}sandbox%f %~ %# '" > $SANDBOX/.zshrc
}

isolate() {
  unset ${(M)${(k)parameters}:#TTHEME_*} XDG_CONFIG_HOME XDG_STATE_HOME XDG_CACHE_HOME XDG_DATA_HOME ZDOTDIR
  export HOME=$SANDBOX TTHEME_ITERM_SUITE=$SUITE DBUS_SESSION_BUS_ADDRESS=disabled:
}

clone() {
  cp -cR -- $1 $2 2>/dev/null || { rm -rf -- $2; cp -R -- $1 $2 }
}

bring() {
  local to=$SANDBOX/.config/ttheme tilde=${MINE/#$REAL_HOME/\~} item src dest conf text
  local -a moved=() lines=()
  for item in config.zsh tone.json pins kept.json markets backgrounds; do
    [[ -e $MINE/$item ]] || continue
    rm -rf -- $to/$item
    clone $MINE/$item $to/$item
  done
  for src in ${(f)"$(node -p "(require(process.argv[1]).markets ?? []).filter((s) => s.startsWith('/')).join('\\n')" $MINE/installed.json)"}; do
    [[ -d $src ]] || continue
    dest=$to/market/${src:t}
    while [[ -e $dest ]]; do dest+=-; done
    mkdir -p ${dest:h}
    clone $src $dest
    moved+=($src $dest)
  done
  if [[ -f $to/pins ]]; then
    lines=("${(@f)$(<$to/pins)}")
    print -rl -- "${(@)lines/#\~/$REAL_HOME}" > $to/pins
  fi
  for conf in $to/backgrounds/*.conf(N); do
    text=$(<$conf)
    [[ $text == *($MINE|$tilde)/* ]] || continue
    text=${text//$MINE\//$to/}
    print -r -- ${text//$tilde\//$to/} > $conf
  done
  node -e '
const fs = require("node:fs")
const [mine, made, ...pairs] = process.argv.slice(1)
const own = JSON.parse(fs.readFileSync(mine, "utf8"))
const fresh = JSON.parse(fs.readFileSync(made, "utf8"))
const moved = new Map(pairs.flatMap((source, i) => (i % 2 === 0 ? [[source, pairs[i + 1]]] : [])))
const local = ["terminals", "itermBase", "konsoleBase", "terminalBase", "wtHome"]
const next = Object.fromEntries(Object.entries(own).filter(([key]) => !local.includes(key)))
for (const key of local.filter((key) => key in fresh)) next[key] = fresh[key]
if (next.markets) next.markets = next.markets.map((source) => moved.get(source) ?? source)
fs.writeFileSync(made, `${JSON.stringify(next, null, 2)}\n`)
' $MINE/installed.json $to/installed.json $moved
}

wire() {
  local label=$1
  shift
  node $ROOT/bin/ttheme.js init --yes > /dev/null
  (( $# == 0 )) || node $SANDBOX/.config/ttheme/ttheme.js add $@ > /dev/null
  if (( BRING )); then
    bring
    node $ROOT/bin/ttheme.js init --yes > /dev/null
  fi
  if (( PICTURED && $# )); then
    bun $ROOT/tests/picture.ts $SANDBOX/.config ${@[-1]}
    node $SANDBOX/.config/ttheme/ttheme.js image ${@[-1]} tuned > /dev/null
  fi
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

iterm_suite() {
  local legacy=$1 trust=$2
  local dp="$SANDBOX/Library/Application Support/iTerm2/DynamicProfiles"
  local shell="/usr/bin/env HOME=$SANDBOX TTHEME_ITERM_SUITE=$SUITE ZDOTDIR=$SANDBOX XDG_CONFIG_HOME=$SANDBOX/.config XDG_STATE_HOME=$SANDBOX/.local/state XDG_CACHE_HOME=$SANDBOX/.cache /bin/zsh -il"
  mkdir -p $dp
  jq -n --arg cmd $shell --arg dir $SANDBOX '{Profiles: [{
      Name: "ttheme sandbox", Guid: "sandbox",
      "Dynamic Profile Parent Name": "Default",
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
  defaults write $SUITE DisableAppNap -bool true
  defaults write $SUITE NoSyncVariablesToReport -string allow:id,allow:tab.id,allow:tab.window.id,allow:profileName,allow:user.ttheme_bg
  if (( legacy )); then
    defaults write $SUITE UseMetal -bool false
  else
    defaults write $SUITE disableMetalWhenUnplugged -bool false
    defaults write $SUITE disableMetalInLowPowerMode -bool false
  fi
  if (( trust )); then
    defaults write $SUITE PreventEscapeSequenceFromChangingProfile -bool false
    local key
    for key in Blend "Background Image Mode" "Background Image Location"; do
      defaults write $SUITE "NoSyncSetProfileProperty_$key" -int 0
    done
  fi
}

open_iterm() {
  local behind=$1
  env -u GHOSTTY_RESOURCES_DIR -u GHOSTTY_BIN_DIR -u GHOSTTY_SHELL_FEATURES -u TERM_PROGRAM -u TERM_PROGRAM_VERSION \
    -u COLORTERM -u TERMINFO -u KITTY_WINDOW_ID -u ITERM_SESSION_ID \
    open ${behind:+-g} -na iTerm --args -suite $SUITE \
    -ApplePersistenceIgnoreState YES -NSQuitAlwaysKeepsWindows NO -SUHasLaunchedBefore YES -SUEnableAutomaticChecks NO
}

sandbox_shell() {
  print -rl -- '#!/bin/zsh -f' 'unset ${(M)${(k)parameters}:#TTHEME_*} XDG_DATA_HOME' \
    "exec /usr/bin/env HOME=$SANDBOX ZDOTDIR=$SANDBOX XDG_CONFIG_HOME=$SANDBOX/.config XDG_STATE_HOME=$SANDBOX/.local/state XDG_CACHE_HOME=$SANDBOX/.cache /bin/zsh -il" > $SANDBOX/sandbox.command
  chmod +x $SANDBOX/sandbox.command
}

open_wezterm() {
  [[ -x $WEZTERM_APP/Contents/MacOS/wezterm-gui ]] || return 1
  env ${FOREIGN/#/-u} $WEZTERM_APP/Contents/MacOS/wezterm-gui --config-file $SANDBOX/.config/wezterm/wezterm.lua \
    start --always-new-process --cwd $SANDBOX -- /bin/zsh -il > /dev/null 2>&1 &!
}

open_kitty() {
  [[ -x $KITTY_APP/Contents/MacOS/kitty ]] || return 1
  env ${FOREIGN/#/-u} KITTY_CONFIG_DIRECTORY=$SANDBOX/.config/kitty $KITTY_APP/Contents/MacOS/kitty \
    --config $SANDBOX/.config/kitty/kitty.conf --directory $SANDBOX /bin/zsh -il > /dev/null 2>&1 &!
}

open_alacritty() {
  [[ -x $ALACRITTY_APP/Contents/MacOS/alacritty ]] || return 1
  env ${FOREIGN/#/-u} $ALACRITTY_APP/Contents/MacOS/alacritty --config-file $SANDBOX/.config/alacritty/alacritty.toml \
    --working-directory $SANDBOX -e /bin/zsh -il > /dev/null 2>&1 &!
}

open_konsole() {
  local behind=$1 i
  local -a env=(${FOREIGN/#/-u})
  (( $+commands[konsole] && $+commands[dbus-run-session] )) || return 1
  if [[ -n $behind ]]; then
    (( $+commands[Xvfb] && $+commands[xdotool] )) || return 1
    Xvfb $KONSOLE_SCREEN -screen 0 1400x900x24 -nolisten tcp > /dev/null 2>&1 &!
    for i in {1..50}; do
      DISPLAY=$KONSOLE_SCREEN xdotool getdisplaygeometry > /dev/null 2>&1 && break
      sleep 0.1
    done
    (( $+commands[xcompmgr] )) && DISPLAY=$KONSOLE_SCREEN xcompmgr > /dev/null 2>&1 &!
    env+=(-u WAYLAND_DISPLAY DISPLAY=$KONSOLE_SCREEN QT_QPA_PLATFORM=xcb)
  fi
  env $env dbus-run-session -- ${=KONSOLE_GUI} -e zsh -il > /dev/null 2>&1 &!
}

open_warp() {
  local behind=$1
  [[ -d /Applications/Warp.app ]] || return 1
  sandbox_shell
  mkdir -p ${WARP_LAUNCH:h}
  print -rl -- "name: ${WARP_LAUNCH:t:r}" 'windows:' '  - tabs:' '      - title: ttheme sandbox' '        layout:' \
    "          cwd: $SANDBOX" '        commands:' "          - exec: exec $SANDBOX/sandbox.command" > $WARP_LAUNCH
  env -i /usr/bin/open ${behind:+-g} "warp://launch/${WARP_LAUNCH:t}"
}

open_terminal_app() {
  local behind=$1
  sandbox_shell
  env -i /usr/bin/open ${behind:+-g} -a Terminal $SANDBOX/sandbox.command --args -ApplePersistenceIgnoreState YES
}

hand_back() {
  local front=$1 parent=$2 pid i
  for i in {1..50}; do
    pid=$(pgrep -f -- $parent) && pgrep -P ${pid%%$'\n'*} > /dev/null && break
    sleep 0.1
  done
  [[ $front == <-> ]] || return 0
  osascript -l JavaScript -e "ObjC.import('AppKit'); \$.NSRunningApplication.runningApplicationWithProcessIdentifier($front).activateWithOptions(0)" > /dev/null
}

usage() { print -u2 "usage: sandbox [--here | --behind] [--iterm [--legacy] [--trust] | --wezterm | --kitty | --alacritty | --warp | --terminal-app | --konsole] [--pictured] [--zshenv FILE] [--empty | --mine | palette…]" }

main() {
  local -a here behind iterm wezterm kitty alacritty warp tapp konsole legacy trust empty mine pictured zshenv
  zparseopts -D -E -F -- -here=here -behind=behind -iterm=iterm -wezterm=wezterm -kitty=kitty -alacritty=alacritty -warp=warp -terminal-app=tapp \
    -konsole=konsole -legacy=legacy -trust=trust -empty=empty -mine=mine -pictured=pictured -zshenv:=zshenv || { usage; return 1 }
  local -i other=$(( $#iterm + $#wezterm + $#kitty + $#alacritty + $#warp + $#tapp + $#konsole ))
  (( other > 1 || $#here && ($#behind || other) || ($#legacy || $#trust) && ! $#iterm || ($#empty || $#mine) && $# || $#empty && $#mine )) && { usage; return 1 }
  if (( $#mine )); then
    (( $#warp || $#tapp )) && { print -u2 -r -- "--mine stays out of --warp and --terminal-app, which wire the user's own app settings"; return 1 }
    [[ -r $MINE/installed.json ]] || { print -u2 "no ttheme install at ${MINE/#$REAL_HOME/~} to bring in"; return 1 }
  fi
  local -a palettes=($@)
  PICTURED=$#pictured BRING=$#mine
  local label=${(j: :)palettes}
  if (( $#mine )); then
    label="yours, from ${MINE/#$REAL_HOME/~}"
  elif (( $#empty )); then
    label="none, \`ttheme\` picks them"
  elif (( ! $#palettes )); then
    palettes=(${(f)"$(node -p "require(process.argv[1]).palettes.map((p) => p.name).join('\\n')" $ROOT/dist/manifest.json)"})
    label="all $#palettes"
  fi
  fresh
  local node
  node=$(node -p process.execPath 2>/dev/null) && print -r -- "path=(${(q)node:h} \$path)" > $SANDBOX/.zshenv
  (( $#zshenv )) && cat -- $zshenv[-1] >> $SANDBOX/.zshenv
  isolate
  if (( $#here )); then
    wire $label $palettes
    print -r -- "exit leaves; files stay until the next run"
    cd $HOME
    exec zsh -il
  fi
  export XDG_CONFIG_HOME=$SANDBOX/.config XDG_STATE_HOME=$SANDBOX/.local/state XDG_CACHE_HOME=$SANDBOX/.cache ZDOTDIR=$SANDBOX
  local front=""
  (( $+commands[lsappinfo] )) && [[ $(lsappinfo info -only pid "$(lsappinfo front)") =~ 'pid"?[[:space:]]*=[[:space:]]*([0-9]+)' ]] && front=$match[1]
  if (( $#iterm )); then
    iterm_suite $#legacy $#trust
    ( unset GHOSTTY_RESOURCES_DIR TERM_PROGRAM KITTY_WINDOW_ID; ITERM_SESSION_ID=w0 wire $label $palettes )
    open_iterm "${behind:+1}" || { print -u2 "no iTerm2 to open"; return 1 }
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
  if (( $#kitty )); then
    ( unset $FOREIGN; KITTY_WINDOW_ID=1 wire $label $palettes )
    open_kitty || { print -u2 "no kitty at $KITTY_APP — TTHEME_KITTY_APP names another kitty.app"; return 1 }
    (( $#behind )) && hand_back $front $KITTY_GUI
    print -r -- "opened a separate kitty on it — ⌘Q quits only that one; files stay until the next run"
    return
  fi
  if (( $#alacritty )); then
    ( unset $FOREIGN; ALACRITTY_WINDOW_ID=1 wire $label $palettes )
    open_alacritty || { print -u2 "no Alacritty at $ALACRITTY_APP — TTHEME_ALACRITTY_APP names another Alacritty.app"; return 1 }
    (( $#behind )) && hand_back $front $ALACRITTY_GUI
    print -r -- "opened a separate Alacritty on it — ⌘Q quits only that one; files stay until the next run"
    return
  fi
  if (( $#warp )); then
    mkdir -p $SANDBOX/.warp
    print -rl -- '[appearance.themes]' 'theme = "dark"' > $SANDBOX/.warp/settings.toml
    ( unset $FOREIGN; TERM_PROGRAM=WarpTerminal wire $label $palettes )
    open_warp "${behind:+1}" || { print -u2 "no Warp to open"; return 1 }
    print -r -- "opened a Warp tab on it through ${WARP_LAUNCH/#$REAL_HOME/~} — exit leaves; files stay until the next run"
    return
  fi
  if (( $#konsole )); then
    ( unset $FOREIGN; KONSOLE_VERSION=1 wire $label $palettes )
    open_konsole "${behind:+1}" || { print -u2 "no Konsole to open — --konsole needs konsole and dbus-run-session, and --behind Xvfb and xdotool"; return 1 }
    print -r -- "opened a separate Konsole on it${behind:+ on the private display $KONSOLE_SCREEN}, on a D-Bus session of its own — closing it quits only that one; files stay until the next run"
    return
  fi
  if (( $#tapp )); then
    zsh $ROOT/tests/terminal-prefs.zsh save
    ( unset $FOREIGN; TERM_PROGRAM=Apple_Terminal wire $label $palettes )
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
