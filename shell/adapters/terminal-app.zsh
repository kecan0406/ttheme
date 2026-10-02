typeset -g TTHEME_TERMINAL_BASE=""

__tt_terminal_wired() { (( ${TTHEME_TERMINALS[(Ie)terminal-app]} )) }

__tt_keepable() { __tt_terminal_wired }

__tt_follows_focus() { return 0 }

__tt_hear() {
  local q=$'\e]11;?\e\\\e]10;?\e\\\e]12;?\e\\\e]17;?\e\\' v i
  local -A got
  for i in {0..15}; do q+=$'\e]4;'$i$';?\e\\'; done
  __tt_ask $q || return 1
  __tt_colors "$REPLY"
  REPLY=""
  v="$got[11] $got[10] $got[12] ${got[17]:-$got[11]}"
  for i in {0..15}; do v+=" ${got[4;$i]}"; done
  (( ${#${=v}} == 20 )) || return 1
  REPLY=$v
}

__tt_heard() { TTHEME_TERMINAL_BASE=$1 }

__tt_takes_default() { __tt_terminal_wired && __tt_osc_reset }

__tt_reverts() { return 1 }

__tt_terminal_tell() {
  local out
  out=$(osascript -e 'on run argv' -e "tell application \"Terminal\"" -e "if not (exists settings set (item 2 of argv)) then return \"missing\"" \
    -e 'if item 1 of argv is "default" then' -e 'set default settings to settings set (item 2 of argv)' -e 'set startup settings to settings set (item 2 of argv)' \
    -e 'else' -e 'repeat with w in windows' -e 'repeat with t in tabs of w' -e 'if tty of t is (item 3 of argv) then set current settings of t to settings set (item 2 of argv)' \
    -e 'end repeat' -e 'end repeat' -e 'end if' -e 'end tell' -e 'return "ok"' -e 'end run' "$@" 2>/dev/null)
  [[ $out == ok ]]
}

__tt_osc_reset() {
  local spec=${TTHEME_STARTUP:+${TTHEME_PALETTE[$TTHEME_STARTUP]}}
  if __tt_terminal_wired && [[ -n $spec ]]; then
    __tt_osc_apply "$spec"
  elif ! __tt_terminal_wired || [[ -z $TTHEME_TERMINAL_APP_BASE ]] || ! __tt_terminal_tell tab "$TTHEME_TERMINAL_APP_BASE" $TTY; then
    [[ -n $TTHEME_TERMINAL_BASE ]] && __tt_osc_apply "$TTHEME_TERMINAL_BASE"
  fi
  unset TTHEME_PAINTED
  return 0
}

__tt_reloaded() {
  __tt_terminal_wired || return 0
  local want f=$TTHEME_STATE_DIR/terminal-app.default was=""
  want=$(defaults read com.apple.Terminal 'Default Window Settings' 2>/dev/null) || return 0
  [[ -r $f ]] && was=$(<$f)
  [[ -n $want && $want != "$was" ]] || return 0
  __tt_terminal_tell default "$want" && __tt_put $f "$want"
  return 0
}

() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  [[ -o interactive && -t 1 ]] || return 0
  __tt_listen
  local spec=${TTHEME_STARTUP:+${TTHEME_PALETTE[$TTHEME_STARTUP]}}
  [[ -n $spec && -z $TTHEME_PAINTED && $TTHEME_TERMINAL_BASE != "$spec" && ${TTHEME_TERMINAL_BASE%% *} == "${spec%% *}" ]] && __tt_terminal_wired || return 0
  __tt_osc_apply "$spec"
  unset TTHEME_PAINTED
}
