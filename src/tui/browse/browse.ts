import type { Readable } from 'node:stream'
import { Glide } from '../motion.ts'
import { Screen } from '../screen.ts'
import { ALT_SCREEN, HIDE_CURSOR, NO_WRAP, PASTES, pointing, within } from '../terminal.ts'
import { Browse } from './model.ts'
import type { BrowseOptions, BrowseResult, Spot } from './types.ts'
import { drawBrowse } from './view.ts'

export class BrowsePanel {
  private readonly model: Browse
  private readonly input: Readable | undefined

  constructor(opts: BrowseOptions) {
    this.model = new Browse(opts)
    this.input = opts.input
  }

  run(): Promise<'submit' | 'cancel'> {
    const model = this.model
    const modes = [...(model.owns ? [ALT_SCREEN, HIDE_CURSOR, NO_WRAP] : []), PASTES, ...pointing()]
    const assume = model.owns ? [] : [HIDE_CURSOR, NO_WRAP]

    return within({ input: this.input, output: model.output, modes, assume }, async (terminal) => {
      const lists = [model.list, model.panel.inside, model.search.results]

      for (const list of lists) {
        list.glide = true
      }

      const glide = new Glide(
        () => lists.map((list) => list.step()).includes(true),
        () => model.request(),
      )

      const screen = new Screen({
        write: (text) => terminal.write(text),
        view: () => {
          if (model.state !== 'active') {
            return undefined
          }

          const rows = model.rows()
          const { text, laid } = drawBrowse(model, model.columns(), rows)
          const lines = text.split('\n')
          model.lay(laid)

          if (lists.some((list) => list.moving())) {
            glide.start()
          }

          return {
            lines: Array.from({ length: rows }, (_, row) => lines[row] ?? ''),
            ticking:
              model.review.phase === 'applying' || model.form.fetching() || model.standing?.standing === 'checking',
            hovers: (target) => model.free() || !['row', 'hub', 'form'].includes((target as Spot).kind),
          }
        },
        beat: () => model.tick(),
      })

      model.request = () => screen.request()
      terminal.onHover((event) => screen.hover(event))
      terminal.onResize(() => {
        screen.reset()
        screen.request()
      })
      screen.now()

      try {
        return await terminal.loop(
          (event) => {
            if (event.kind === 'key') {
              model.key(event.key)
            } else if (event.kind === 'paste') {
              model.pasted(event.text)
            } else if (event.kind === 'mouse') {
              model.mouse(event, screen.point(event))
            }

            return model.state === 'active' ? undefined : model.state
          },
          () => {
            model.follow()
            screen.soon()
          },
        )
      } finally {
        glide.stop()
        screen.stop()
        model.request = () => {}

        model.stop()
      }
    })
  }

  applied(): boolean {
    return this.model.applied()
  }

  lines(): string[] {
    return this.model.lines()
  }

  failure(): Error | undefined {
    return this.model.failure()
  }

  next(): number | undefined {
    return this.model.next()
  }

  idle(): Promise<void> {
    return this.model.idle()
  }

  result(): BrowseResult {
    return this.model.result()
  }
}
