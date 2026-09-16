if (( $+commands[kitten] )); then
  __tt_kitty() { kitten @ "$@" }
elif (( $+commands[kitty] )); then
  __tt_kitty() { kitty @ "$@" }
else
  __tt_kitty() { return 1 }
fi

__tt_kitty_args() {
  local -a p=(${=1})
  (( ${#p} >= 20 )) || return 1
  reply=(
    foreground=$p[2]
    background=$p[1]
    cursor=$p[3]
    cursor_text_color=$p[1]
    selection_background=$p[4]
    selection_foreground=$p[2]
  )
  local i
  for i in {0..15}; do reply+=("color$i=$p[i+5]"); done
}

__tt_apply() {
  local -a reply
  if [[ ${1%% *} != - ]] && __tt_kitty_args "$1"; then
    __tt_kitty set-colors -- "${reply[@]}" 2>/dev/null && return 0
  fi

  __tt_osc_apply "$1"
}
