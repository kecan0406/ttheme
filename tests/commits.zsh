#!/usr/bin/env zsh
emulate -L zsh
setopt err_return pipe_fail

cd ${${(%):-%x}:A:h:h}

git rev-parse --verify -q origin/main > /dev/null || return 0

local -a areas=(core store pictures terminals tui cli shell site docs builtin commons schemas skills tests ci agents)
local -a bad
local hash subject area

git log --no-merges --format='%h %s' origin/main..HEAD | while read -r hash subject; do
  area=${subject%%: *}
  if [[ $subject != *': '* ]] || (( ! ${areas[(Ie)$area]} )); then
    bad+=("$hash ${subject[1,60]}: no area")
  elif (( ${#subject} > 72 )); then
    bad+=("$hash ${subject[1,60]}…: ${#subject} characters")
  elif [[ $subject == *. ]]; then
    bad+=("$hash $subject: a full stop")
  fi
done

(( $#bad )) || return 0
print -u2 -l -- $bad "A subject is <area>: <summary> in 72 characters at most, without a full stop, the area one of: ${(j:, :)areas} (AGENTS.md, \"Commits\")"
return 1
