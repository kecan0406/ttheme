#!/usr/bin/env zsh
emulate -L zsh

(( $# == 5 || $# == 6 )) || { print -u2 "usage: zoom.zsh FILE X Y W H [LONGEST]"; return 1 }
local file=${1:A} full src out
local -i x=$2 y=$3 w=$4 h=$5 longest=${6:-900} fw sw fx fy cw ch
[[ -r $file ]] || { print -u2 "zoom.zsh: cannot read $1"; return 1 }
full=${file:r}.full.png
src=$file
[[ -r $full ]] && src=$full
sw=$(sips -g pixelWidth $file | awk '/pixelWidth/ {print $2}')
fw=$(sips -g pixelWidth $src | awk '/pixelWidth/ {print $2}')
fx=$(( x * fw / sw )) fy=$(( y * fw / sw )) cw=$(( w * fw / sw )) ch=$(( h * fw / sw ))
(( fx < 1 )) && fx=1
(( fy < 1 )) && fy=1
out=${file:r}.x${x}y${y}w${w}h${h}.png
sips -c $ch $cw --cropOffset $fy $fx $src --out $out > /dev/null && sips -Z $longest $out > /dev/null || return 1
print -r -- "$out  (${cw}x${ch} of $src)"
