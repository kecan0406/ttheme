ObjC.import('AppKit')

function run(argv) {
  const rep = $.NSBitmapImageRep.imageRepWithData($.NSData.dataWithContentsOfFile(argv[0]))
  const c = rep.colorAtXY(Math.round(rep.pixelsWide * 0.7), Math.round(rep.pixelsHigh * 0.6))
  const hex = (space) => {
    const v = c.colorUsingColorSpace(space)
    return `#${[v.redComponent, v.greenComponent, v.blueComponent]
      .map((x) =>
        Math.round(Math.min(1, Math.max(0, x)) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')}`
  }
  return `srgb ${hex($.NSColorSpace.sRGBColorSpace)} p3 ${hex($.NSColorSpace.displayP3ColorSpace)}`
}
