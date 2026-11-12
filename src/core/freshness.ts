export const REFRESH_AFTER = 24 * 60 * 60 * 1000
export const RETRY_AFTER = 60 * 60 * 1000

export type Freshness =
  | { last: 'never'; due: true }
  | { last: 'fetched'; at: number; due: boolean }
  | { last: 'failed'; at: number; fetched: number | undefined; due: boolean }

export function freshnessOf(fetched: number | undefined, failed: number | undefined, now: number): Freshness {
  const old = fetched === undefined || now - fetched >= REFRESH_AFTER

  if (failed !== undefined && (fetched === undefined || failed > fetched)) {
    return { last: 'failed', at: failed, fetched, due: old && now - failed >= RETRY_AFTER }
  }

  return fetched === undefined ? { last: 'never', due: true } : { last: 'fetched', at: fetched, due: old }
}
