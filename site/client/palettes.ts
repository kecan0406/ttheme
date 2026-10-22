import type { Theme } from '@/lib/themes'

const loads = new Map<string, Promise<Theme[]>>()

export function palettes(src: string): Promise<Theme[]> {
  const held = loads.get(src)

  if (held) return held

  const load = fetch(src, { priority: 'low' }).then((response) => {
    if (!response.ok) throw new Error(String(response.status))

    return response.json() as Promise<Theme[]>
  })

  loads.set(src, load)
  load.catch(() => loads.delete(src))

  return load
}

export function afterPaint(run: () => void) {
  requestAnimationFrame(() => setTimeout(run))
}
