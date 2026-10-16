interface Used {
  fresh: boolean
  entries: [string, string][]
}

const held = new Map<string, string>()
const made = new Set<string>()
const used = new Set<string>()

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

export function memo<T>(kind: string, input: string, compute: () => T): T {
  const key = `${kind}:${input.length}:${hashOf(input)}`
  used.add(key)
  let text = held.get(key)

  if (text === undefined) {
    try {
      text = JSON.stringify({ v: compute() })
    } catch (error) {
      text = JSON.stringify({ e: error instanceof Error ? error.message : String(error) })
    }

    held.set(key, text)
    made.add(key)
  }

  const value = JSON.parse(text) as { v: T } | { e: string }

  if ('e' in value) {
    throw new Error(value.e)
  }

  return value.v
}

export function recallMemo(entries: Iterable<[string, string]>): void {
  for (const [key, text] of entries) {
    held.set(key, text)
  }
}

export function memoUsed(): Used {
  return {
    fresh: made.size > 0,
    entries: [...used].flatMap((key) => {
      const text = held.get(key)

      return text === undefined ? [] : [[key, text] as [string, string]]
    }),
  }
}
