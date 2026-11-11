import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { type Post, postRef, SITES, type Site } from '../../core/booru.ts'
import { writeAtomic } from '../../store/edits.ts'
import type { Tone as NoticeTone } from '../bar.ts'
import { plain } from '../field.ts'
import { capped } from '../keycaps.ts'
import {
  type Clip,
  type Got,
  Grabber,
  LOCAL,
  type Loaded,
  loadRef,
  localId,
  normalize,
  pastedRefs,
  peekClipboard,
  readClipboard,
  remember,
  remote,
} from './attach.ts'
import type { Boards } from './boards.ts'
import type { Paint } from './paint.ts'
import type { FindView, Notice } from './screen.ts'
import { describe, origPath, previewPath } from './session.ts'
import type { Tags } from './tags.ts'

const PEEK = 8000
const PICTURE = /\.(png|jpe?g|gif|webp|heic|tiff?|bmp)$/i
const PASTE_KEY = process.platform === 'win32' ? 'alt+v' : 'ctrl+v'
const SCREENSHOT = process.platform === 'darwin' ? 'ctrl+shift+cmd+4 copies a screenshot' : 'copy a picture first'

interface Host {
  view: Readonly<FindView>
  scratch: string
  signal: AbortSignal
  paint: Paint
  boards: Boards
  tags: Tags
  site: () => Site | undefined
  write: (text: string) => void
  notice: (text: string, tone?: NoticeTone, ms?: number) => void
  hint: (text: string, ms: number) => void
  unhint: () => void
  unhelp: () => void
  unsave: () => void
  tell: (notice?: Notice) => void
}

export class Own {
  readonly grabber: Grabber
  private peeked?: string
  private attaching?: AbortController

  private readonly view: Readonly<FindView>
  private readonly scratch: string
  private readonly signal: AbortSignal
  private readonly paint: Paint
  private readonly boards: Boards
  private readonly tags: Tags
  private readonly site: () => Site | undefined
  private readonly notice: (text: string, tone?: NoticeTone, ms?: number) => void
  private readonly hint: (text: string, ms: number) => void
  private readonly unhint: () => void
  private readonly unhelp: () => void
  private readonly unsave: () => void
  private readonly tell: (notice?: Notice) => void

  constructor(host: Host) {
    this.view = host.view
    this.scratch = host.scratch
    this.signal = host.signal
    this.paint = host.paint
    this.boards = host.boards
    this.tags = host.tags
    this.site = host.site
    this.notice = host.notice
    this.hint = host.hint
    this.unhint = host.unhint
    this.unhelp = host.unhelp
    this.unsave = host.unsave
    this.tell = host.tell
    this.grabber = new Grabber(
      (text) => host.write(text),
      (got) => void this.got(got),
    )
  }

  stop(): void {
    this.grabber.stop()
    this.attaching?.abort()
  }

  pasted(text: string): void {
    const view = this.view

    if (view.editing !== undefined && text.trim() !== '' && !this.picture(text)) {
      this.tags.write(plain(text))
      this.tags.suggest()
      this.paint.draw()

      return
    }

    if (view.help) {
      view.help.paste(text)
      this.paint.draw()

      return
    }

    if (view.closing || view.panel !== undefined) {
      return
    }

    if (text.trim() === '') {
      void this.fromClipboard()

      return
    }

    void this.attach(text)
  }

  picture(text: string): boolean {
    const trimmed = text.trim()

    if (/^https?:\/\/\S+$/i.test(trimmed)) {
      return !postRef(trimmed, this.site() ?? (SITES[0] as Site))
    }

    return pastedRefs(trimmed).length > 0
  }

  private async got(got: Got): Promise<void> {
    if (got.kind === 'error') {
      this.notice(got.message, 'error')

      return
    }

    if (got.kind === 'text') {
      if (got.text.trim() === '') {
        this.notice(`No picture on the clipboard — ${capped(SCREENSHOT)}`)

        return
      }

      this.pasted(got.text)

      return
    }

    this.unhelp()
    await this.bring(() => normalize(got.bytes, got.source))
  }

  async peek(): Promise<void> {
    const view = this.view
    let seen: Awaited<ReturnType<typeof peekClipboard>>

    try {
      seen = await peekClipboard()
    } catch {
      return
    }

    if (!seen || seen.stamp === this.peeked) {
      return
    }

    this.peeked = seen.stamp

    if (!seen.picture || view.closing) {
      return
    }

    this.hint(capped(`Picture on the clipboard — ${PASTE_KEY} uses it`), PEEK)
  }

  async fromClipboard(): Promise<void> {
    if (remote()) {
      if (this.grabber.clipboard) {
        this.grabber.ask()

        return
      }

      this.notice('Over SSH the clipboard is not here — drop the file')

      return
    }

    let clip: Clip

    try {
      clip = await readClipboard(join(this.scratch, `clipboard-${Date.now()}.png`))
    } catch (error) {
      this.notice(`Could not read the clipboard: ${describe(error instanceof Error ? error : String(error))}`, 'error')

      return
    }

    this.unhint()

    if ('image' in clip) {
      await this.bring(async (signal) => ({ ...(await loadRef(clip.image, signal)), source: 'clipboard' }))

      return
    }

    const text = clip.text.trim()

    if (!text) {
      this.notice(`No picture on the clipboard — ${capped(SCREENSHOT)}`)

      return
    }

    if (this.picture(text)) {
      await this.attach(text)

      return
    }

    this.tags.edit()

    this.pasted(text)
  }

  async attach(text: string): Promise<void> {
    const trimmed = text.trim()

    if (/^https?:\/\//i.test(trimmed)) {
      const ref = postRef(trimmed, this.site() ?? (SITES[0] as Site))

      if (ref) {
        await this.boards.jump(ref.site, ref.id)

        return
      }
    }

    const [first, ...more] = pastedRefs(trimmed).sort((a, b) => Number(!PICTURE.test(a)) - Number(!PICTURE.test(b)))

    if (!first) {
      this.notice('Nothing to use in that — drop a picture, or paste one or its link')

      return
    }

    await this.bring((signal) => loadRef(first, signal), more.length)
  }

  private async bring(load: (signal: AbortSignal) => Promise<Loaded>, skipped = 0): Promise<void> {
    this.attaching?.abort()
    const control = new AbortController()
    this.attaching = control
    this.tell()
    this.unsave()
    this.boards.noted('Reading the picture…')
    this.paint.draw()
    let image: Loaded

    try {
      image = await load(AbortSignal.any([control.signal, this.signal]))
    } catch (error) {
      if (!control.signal.aborted) {
        this.boards.noted()
        this.notice(describe(error instanceof Error ? error : String(error)), 'error', 8000)
      }

      return
    }

    if (control.signal.aborted) {
      return
    }

    this.boards.noted(
      skipped > 0 ? `The first picture of ${skipped + 1} — drop one at a time to try the others` : undefined,
    )
    this.tags.quietSuggest()
    this.tags.shut()
    const id = localId(image.bytes)
    remember(id, image.source)
    const orig = origPath(this.scratch, LOCAL, id, image.ext)
    writeAtomic(orig, image.bytes)
    const url = pathToFileURL(orig).href

    const post: Post = {
      id,
      file: url,
      width: image.width,
      height: image.height,
      ext: image.ext,
      preview: url,
      owner: '',
      score: 0,
      rating: 's',
      md5: createHash('md5').update(image.bytes).digest('hex'),
      source: image.source,
      tags: [],
      named: { artist: [], character: [], copyright: [] },
      solo: undefined,
      family: 0,
      smaller: [],
    }

    const pick = { site: LOCAL, post }
    const preview = previewPath(this.scratch, pick)
    writeAtomic(preview, image.bytes)
    this.boards.alone(`local|post:${id}`, pick)
  }
}
