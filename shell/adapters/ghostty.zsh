__tt_persist() {
  local f=${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/config name=$1
  [[ -r $f && -w $f ]] || return 1
  local -a lines=("${(@f)$(<$f)}")
  local i in=0 hit=0
  for (( i = 1; i <= ${#lines}; i++ )); do
    case ${lines[i]} in
      '# ttheme begin') in=1 ;;
      '# ttheme end') in=0 ;;
      'theme = '*|'theme='*) (( in )) && { lines[i]="theme = $name"; hit=1 } ;;
    esac
  done
  (( hit )) || return 1
  print -rl -- "${lines[@]}" > $f || return 1
  killall -USR2 ghostty 2>/dev/null || pkill -USR2 -x ghostty 2>/dev/null
  return 0
}
