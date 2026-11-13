#!/bin/sh
# Releases go out weekly (AGENTS.md). Prints the days since the last release
# that was not a hotfix, and fails within six days of it.
last=$(git for-each-ref 'refs/tags/v*' --sort=-creatordate --format='%(creatordate:unix) %(contents:subject)' | grep -v ' hotfix$' | head -1 | cut -d' ' -f1)
[ -n "$last" ] || exit 0
now=$(date +%s)
echo $(((now - last) / 86400))
[ $((now - last)) -ge $((6 * 86400)) ]
