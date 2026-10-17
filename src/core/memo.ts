interface Used {
  fresh: boolean
  entries: [string, string][]
}

const held = new Map<string, string>()
const used = new Set<string>()
let fresh = false

function hashOf(text: string): string {
  let a = 0xdeadbeef
  let b = 0x41c6ce57

  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    a = Math.imul(a ^ c, 2654435761)
    b = Math.imul(b ^ c, 1597334677)
  }

  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909)
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909)

  return `${(b >>> 0).toString(36)}${(a >>> 0).toString(36)}`
}

function recalled<T>(text: string | undefined): T | undefined {
  if (text === undefined) {
    return undefined
  }

  try {
    return JSON.parse(text) as T
  } catch {
    return undefined
  }
}

export function memo<T extends object>(kind: string, input: string, compute: () => T): T {
  const key = `${kind}:${input.length}:${hashOf(input)}`
  let value = recalled<T>(held.get(key))

  if (value === undefined) {
    const text = JSON.stringify(compute())
    held.set(key, text)
    fresh = true
    value = JSON.parse(text) as T
  }

  used.add(key)

  return value
}

export function recallMemo(entries: Iterable<[string, string]>): void {
  for (const [key, text] of entries) {
    held.set(key, text)
  }
}

export function memoUsed(): Used {
  return {
    fresh,
    entries: [...used].flatMap((key) => {
      const text = held.get(key)

      return text === undefined ? [] : [[key, text] as [string, string]]
    }),
  }
}
