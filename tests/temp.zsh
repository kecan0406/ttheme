#!/usr/bin/env zsh
emulate -L zsh

export TMPDIR=$(mktemp -d)
trap 'rm -rf -- $TMPDIR' EXIT
"$@"
