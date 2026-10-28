import { checked, codeBody, type Draft, draftOf, opened, sealed, smallest } from '../../src/core/draft.ts'
import { paletteEntry } from '../../src/core/manifest.ts'
import { readSet, type SetPalette } from '../../src/core/sets.ts'
import { themeOf } from '../../src/core/theme.ts'

async function digest(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice()))
}

async function streamed(
  bytes: Uint8Array,
  through: ReadableWritablePair<Uint8Array, ArrayBufferView | ArrayBuffer>,
): Promise<Uint8Array> {
  const reader = new Blob([bytes.slice()]).stream().pipeThrough(through).getReader()
  const parts: Uint8Array[] = []
  let size = 0

  for (;;) {
    const { done, value } = await reader.read()

    if (done) break
    size += value.length
    parts.push(value)
  }

  const out = new Uint8Array(size)
  let at = 0

  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }

  return out
}

export async function webCode(drafts: readonly Draft[]): Promise<string> {
  const body = codeBody(drafts)
  const deflated = await streamed(body, new CompressionStream('deflate-raw'))
  const packed = smallest([body, deflated])

  return sealed(packed, await digest(packed))
}

export async function webCheck(code: string): Promise<void> {
  const sealedCode = opened(code)
  checked(sealedCode, await digest(sealedCode.packed))
}

export function textDraft(file: string, text: string): Draft {
  const { slug, doc } = readSet(file, text)[0] as SetPalette
  const theme = themeOf(slug, doc, { name: slug, foreign: true })

  return draftOf(paletteEntry(theme), theme.name, theme.waiveReason)
}
