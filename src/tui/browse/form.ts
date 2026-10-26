import { parseSource, sameMarketplace } from '../../store/sources.ts'
import { wrapText } from '../ansi.ts'
import type { Hint } from '../bar.ts'
import { Field } from '../field.ts'
import { type Paint, SPINNER } from '../style.ts'
import { zone } from '../zones.ts'
import { framed, typedSource, whereOf } from './draw.ts'
import type { Network } from './network.ts'
import type { Spot } from './types.ts'

export class AddForm {
  readonly address = new Field()
  adding: string | undefined
  private error: string | undefined
  private readonly network: Network
  private readonly p: Paint

  constructor(network: Network, p: Paint) {
    this.network = network
    this.p = p
  }

  seed(typed: string): void {
    if (!this.address.value && typedSource(typed)) {
      this.address.value = typed
    }
  }

  edited(): void {
    this.error = undefined
    this.adding = undefined
  }

  parse(): string | undefined {
    const typed = this.address.value.trim()

    if (!typed) {
      this.error = 'type a repository or a folder'

      return undefined
    }

    try {
      return parseSource(typed)
    } catch (error) {
      this.error = (error as Error).message

      return undefined
    }
  }

  fetching(): boolean {
    return this.adding !== undefined && this.network.busy.has(this.adding)
  }

  lands(source: string): boolean {
    return this.adding !== undefined && sameMarketplace(this.adding, source)
  }

  done(): void {
    this.address.value = ''
    this.adding = undefined
  }

  drop(): void {
    if (this.adding !== undefined) {
      this.network.unstage(this.adding)
    }
  }

  keys(): Hint[] {
    return this.fetching() ? [] : [['enter', 'add'], ...(this.address.value ? [['bksp', 'edit'] as Hint] : [])]
  }

  lines(width: number, focused: boolean, beat: number): string[] {
    const { p } = this
    const value = this.address.value
    const text = value ? `${value}${focused ? '_' : ''}` : focused ? '_' : p.dim('owner/repo or a folder')
    const problem = this.error ?? (this.adding === undefined ? undefined : this.network.failed.get(this.adding))

    const status =
      this.adding !== undefined && this.fetching()
        ? [p.dim(`${SPINNER[beat % SPINNER.length]} Fetching ${whereOf(this.adding)}…`)]
        : problem
          ? wrapText(problem, width).map((l) => p.error(l))
          : []

    return [
      'Enter marketplace source:',
      p.dim('Examples:'),
      ...['owner/repo (GitHub)', 'owner/repo#v1 (a tag or branch)', '~/path/to/marketplace (a folder)'].map((l) =>
        p.dim(`  ${l}`),
      ),
      '',
      ...framed(p, width, text).map((line) => zone({ kind: 'form' } satisfies Spot, line)),
      ...(status.length > 0 ? ['', ...status] : []),
    ]
  }
}
