import { escapeHtml, type PropsWithChildren } from '@kitajs/html'
import { isPlain, type Line, piecesOf, type Run } from '@/lib/terminal'

function Text({ text }: { text: string }) {
  return (
    <>
      {piecesOf(text).map((piece) =>
        piece.cells === 0 ? (
          escapeHtml(piece.text)
        ) : (
          <span data-cells data-fill={piece.fill ? '' : undefined} style={`--w:${piece.cells}`} safe>
            {piece.text}
          </span>
        ),
      )}
    </>
  )
}

function inkOf(run: Run): string | undefined {
  const declared = [run.ink && `color:${run.ink}`, run.ground && `background-color:${run.ground}`].filter(Boolean)

  return declared.length > 0 ? declared.join(';') : undefined
}

function RunText({ run, inspect }: { run: Run; inspect: boolean }) {
  if (!inspect && isPlain(run)) return <Text text={run.text} />
  const drawn = run.live === 'name' || run.live === 'work'

  return (
    <span
      class={inspect ? 'r' : undefined}
      data-t={inspect || run.t !== 1 ? String(run.t) : undefined}
      data-g={inspect || run.g !== 0 ? String(run.g) : undefined}
      data-b={run.bold ? '' : undefined}
      data-f={run.faint ? '' : undefined}
      data-c={run.cursor ? '' : undefined}
      data-blank={inspect && !run.cursor && run.text.trim() === '' ? '' : undefined}
      data-live={run.live === 'use' ? 'use' : undefined}
      data-text={drawn ? run.live : undefined}
      style={inkOf(run)}
    >
      {drawn ? '' : <Text text={run.text} />}
    </span>
  )
}

export function TerminalLines({ lines, inspect = false }: { lines: Line[]; inspect?: boolean }) {
  return (
    <>
      {lines.map((runs, at) => (
        <>
          {at > 0 ? '\n' : ''}
          {runs.map((run) => (
            <RunText run={run} inspect={inspect} />
          ))}
        </>
      ))}
    </>
  )
}

export function TerminalScreen({
  lines,
  cols,
  inspect = false,
  decorative = false,
  class: className,
  style,
  children,
  ...props
}: PropsWithChildren<
  Omit<JSX.HtmlTag, 'class' | 'style'> & {
    lines?: Line[]
    cols?: number
    inspect?: boolean
    decorative?: boolean
    class?: string
    style?: string
  }
>) {
  const fitted = [cols === undefined ? '' : `--cols:${cols}`, style ?? ''].filter(Boolean).join(';')

  return (
    <pre
      {...props}
      data-slot="terminal-screen"
      data-fit={cols === undefined ? undefined : 'scale'}
      translate="no"
      aria-hidden={decorative ? 'true' : undefined}
      class={className}
      style={fitted || undefined}
    >
      {lines ? <TerminalLines lines={lines} inspect={inspect} /> : children}
    </pre>
  )
}
