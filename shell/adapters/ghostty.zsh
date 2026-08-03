__tt_new_window() {
  local name=$1
  shift
  local -a p=(${=TTHEME_PALETTE[$name]}) palargs
  (( ${#p} >= 20 )) || return 1

  local i
  for i in {0..15}; do palargs+=("--palette=$i=$p[i+5]"); done

  open -na Ghostty.app --args \
    --background="$p[1]" \
    --foreground="$p[2]" \
    --cursor-color="$p[3]" \
    --selection-background="$p[4]" \
    $palargs \
    --working-directory="$PWD" \
    --keybind=global:cmd+shift+grave_accent=unbind \
    "$@"
}
