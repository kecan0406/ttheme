#!/usr/bin/env zsh
emulate -L zsh
setopt err_return

local backup=${TMPDIR%/}/ttheme-terminal-prefs.plist key
local -a keep now

case $1 in
  save)
    [[ -e $backup ]] || defaults export com.apple.Terminal $backup
    ;;
  restore)
    [[ -e $backup ]] || return 0
    defaults import com.apple.Terminal $backup
    keep=(${${(M)${(f)"$(plutil -p $backup)"}:#  \"*}%%\" =>*})
    now=(${${(M)${(f)"$(defaults export com.apple.Terminal - | plutil -p -)"}:#  \"*}%%\" =>*})
    for key in ${now:|keep}; do
      defaults delete com.apple.Terminal "${key#  \"}" 2>/dev/null || :
    done
    rm -f -- $backup
    ;;
  *)
    print -u2 "usage: terminal-prefs.zsh save|restore"
    return 1
    ;;
esac
