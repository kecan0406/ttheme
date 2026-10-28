#!/usr/bin/env zsh
emulate -L zsh

(( $# >= 3 && $# % 2 == 1 )) || { print -u2 "usage: pixel.zsh FILE X Y [X Y…]"; return 1 }
[[ -r $1 ]] || { print -u2 "pixel.zsh: cannot read $1"; return 1 }

osascript -l JavaScript - ${1:A} ${@[2,-1]} <<'EOF'
ObjC.import('AppKit');
function run(argv) {
  const rep = $.NSBitmapImageRep.imageRepWithData($.NSData.dataWithContentsOfFile(argv[0]));
  const hex = (c) => '#' + [c.redComponent, c.greenComponent, c.blueComponent]
    .map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
  const out = [];
  const w = rep.pixelsWide, h = rep.pixelsHigh;
  for (let i = 1; i + 1 < argv.length; i += 2) {
    if (Number(argv[i]) >= w || Number(argv[i + 1]) >= h) {
      out.push(`${argv[i]},${argv[i + 1]}  outside the ${w}x${h} image`);
      continue;
    }
    const c = rep.colorAtXY(Number(argv[i]), Number(argv[i + 1]));
    out.push(`${argv[i]},${argv[i + 1]}  p3 ${hex(c.colorUsingColorSpace($.NSColorSpace.displayP3ColorSpace))}  srgb ${hex(c.colorUsingColorSpace($.NSColorSpace.sRGBColorSpace))}`);
  }
  return out.join('\n');
}
EOF
