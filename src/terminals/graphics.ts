const CHUNK = /.{1,4096}/g

export function graphic(control: string, data: string): string {
  const chunks = data.match(CHUNK) ?? ['']

  return chunks
    .map((chunk, i) => {
      const more = i < chunks.length - 1 ? 1 : 0

      return i === 0 ? `\x1b_G${control},m=${more},q=2;${chunk}\x1b\\` : `\x1b_Gm=${more},q=2;${chunk}\x1b\\`
    })
    .join('')
}
