const MOVES = new Map<string, (index: number, count: number) => number>([
  ['ArrowRight', (index) => index + 1],
  ['ArrowLeft', (index) => index - 1],
  ['Home', () => 0],
  ['End', (_, count) => count - 1],
])

export function stepTo<T extends Element>(key: string, items: T[], from: T): T | undefined {
  const move = MOVES.get(key)

  return move ? items[(move(items.indexOf(from), items.length) + items.length) % items.length] : undefined
}
