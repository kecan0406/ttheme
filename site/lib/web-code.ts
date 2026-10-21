import {
  checked,
  codeBody,
  type Draft,
  draftOf,
  draftsOf,
  opened,
  paletteSlug,
  readOwnText,
  sealed,
  smallest,
  UNPACKED,
} from '../../src/core/draft.ts'
import { paletteEntry } from '../../src/core/manifest.ts'
import { nameProblem } from '../../src/core/theme.ts'

async function digest(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice()))
}

async function streamed(
  bytes: Uint8Array,
  through: ReadableWritablePair<Uint8Array, ArrayBufferView | ArrayBuffer>,
  most: number,
): Promise<Uint8Array> {
  const reader = new Blob([bytes.slice()]).stream().pipeThrough(through).getReader()
  const parts: Uint8Array[] = []
  let size = 0

  for (;;) {
    const { done, value } = await reader.read()

    if (done) break
    size += value.length

    if (size > most) {
      await reader.cancel()
      throw new Error('it unpacks to more than a share code holds')
    }

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
  const deflated = await streamed(body, new CompressionStream('deflate-raw'), Number.POSITIVE_INFINITY)
  const packed = smallest([body, deflated])

  return sealed(packed, await digest(packed))
}

export async function webDrafts(code: string): Promise<Draft[]> {
  const sealedCode = opened(code)
  const packed = checked(sealedCode, await digest(sealedCode.packed))
  const method = packed[0]

  if (method === 2) {
    throw new Error(
      'this link is packed with brotli, which a browser does not unpack — ttheme add opens it in a terminal',
    )
  }

  if (method !== 0 && method !== 1) throw new Error('the share code is packed in a way this page does not read')
  const rest = packed.subarray(1)
  let body = rest

  if (method === 1) {
    try {
      body = await streamed(rest, new DecompressionStream('deflate-raw'), UNPACKED)
    } catch {
      throw new Error('the share code does not unpack — was it copied whole?')
    }
  }

  const drafts = draftsOf(body)
  const named = drafts.find((draft) => nameProblem(draft.name))

  if (named) throw new Error(`the share code's palette ${named.name} ${nameProblem(named.name)}`)

  return drafts
}

export function textDraft(file: string, text: string): Draft {
  const theme = readOwnText(paletteSlug(file, text), text, [], true)

  return draftOf(paletteEntry(theme), theme.name, theme.waiveReason)
}
