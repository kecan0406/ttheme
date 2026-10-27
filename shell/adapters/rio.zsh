__tt_keepable() { (( ${TTHEME_TERMINALS[(Ie)rio]} )) }

__tt_follows_focus() { return 0 }

__tt_rio_settle() {
  local -a at
  local -F late
  local -i ticks
  zmodload -F zsh/stat b:zstat 2>/dev/null && zmodload zsh/datetime 2>/dev/null &&
    zmodload -F zsh/zselect b:zselect 2>/dev/null &&
    zstat -F %s.%N -A at +mtime -- ${XDG_CONFIG_HOME:-$HOME/.config}/rio/config.toml 2>/dev/null || return 0
  (( late = at[1] + 0.35 - EPOCHREALTIME ))
  (( late > 0 && late < 1 )) || return 0
  (( ticks = late * 100 + 1 ))
  zselect -t $ticks
  return 0
}

__tt_apply() {
  __tt_rio_settle
  __tt_osc_apply "$@"
}

__tt_reloaded() {
  [[ -n $TTHEME_PAINTED && -n $TTHEME_SPEC ]] || return 0
  __tt_apply "$TTHEME_SPEC"
}
