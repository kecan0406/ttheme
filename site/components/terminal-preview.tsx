import type { ReactNode } from 'react'
import type { Theme } from '@/lib/themes'
import { cn } from '@/lib/utils'
import { wearStyle } from '@/lib/wear'

export const SCENES = ['shell', 'git', 'test', 'colors'] as const

export type Scene = (typeof SCENES)[number]

const NORMAL = [0, 1, 2, 3, 4, 5, 6, 7]
const BRIGHT = [8, 9, 10, 11, 12, 13, 14, 15]

function C({ n, bold, children }: { n: number; bold?: boolean; children: ReactNode }) {
  return <span className={cn(`term-c${n}`, bold && 'font-bold')}>{children}</span>
}

function L({ children }: { children?: ReactNode }) {
  return <div>{children}</div>
}

function Prompt() {
  return (
    <>
      <C n={2}>~/dotfiles</C> <C n={4}>main</C>{' '}
      <C n={5} bold>
        ❯
      </C>{' '}
    </>
  )
}

function Arrow() {
  return (
    <>
      <C n={5} bold>
        ❯
      </C>{' '}
    </>
  )
}

function Caret() {
  return <span className="inline-block w-[1ch] bg-(--cu)">&nbsp;</span>
}

function Shell({ use }: { use: string }) {
  return (
    <>
      <L>
        <Prompt />
        ls -F
      </L>
      <L>
        <C n={4} bold>
          shell/
        </C>
        {'  '}
        <C n={4} bold>
          themes/
        </C>
        {'  '}
        <C n={2} bold>
          setup.sh*
        </C>
        {'  '}
        <C n={6}>zshrc@</C>
        {'  todo.md'}
      </L>
      <L>
        <Prompt />
        ttheme use <C n={3}>{use}</C>
      </L>
      <L>
        <C n={8}>painted this tab</C>
      </L>
      <L>
        <Prompt />
        cat notes
      </L>
      <L>
        <C n={1}>cat: notes: No such file or directory</C>
      </L>
      <L>
        <Prompt />
        <Caret />
      </L>
    </>
  )
}

function Git() {
  return (
    <>
      <L>
        <Arrow />
        git log --oneline --graph -3
      </L>
      <L>
        <C n={1}>*</C> <C n={3}>a47f151</C> <C n={6}>(</C>
        <C n={6} bold>
          HEAD -&gt;{' '}
        </C>
        <C n={2} bold>
          main
        </C>
        <C n={6}>)</C> Bump version
      </L>
      <L>
        <C n={1}>*</C> <C n={3}>cd854dd</C> Name markets owner@name
      </L>
      <L>
        <C n={1}>*</C> <C n={3}>3e84502</C> Tier the help
      </L>
      <L>
        <Arrow />
        git diff --stat
      </L>
      <L>
        {' src/markets.ts | 12 '}
        <C n={2}>++++++++</C>
        <C n={1}>----</C>
      </L>
      <L>
        <Arrow />
        <span className="bg-(--se)">git push</span>
        <Caret />
      </L>
    </>
  )
}

function Test() {
  return (
    <>
      <L>
        <Arrow />
        bun test
      </L>
      <L>
        <C n={8}>src/contrast.test.ts:</C>
      </L>
      <L>
        <C n={2}>✓</C> gate passes every palette <C n={8}>[4.1ms]</C>
      </L>
      <L>
        <C n={2}>✓</C> a waiver needs a reason <C n={8}>[0.3ms]</C>
      </L>
      <L>
        <C n={1} bold>
          ✗
        </C>{' '}
        bright follows its normal <C n={8}>[1.2ms]</C>
      </L>
      <L>
        <C n={3}>»</C> fetches the picture <C n={8}>(skipped)</C>
      </L>
      <L>
        {' '}
        <C n={2}>41 pass</C> <C n={3}>1 skip</C>{' '}
        <C n={1} bold>
          1 fail
        </C>
      </L>
    </>
  )
}

function Colors() {
  return (
    <>
      <L>
        {NORMAL.map((n) => (
          <C key={n} n={n}>
            {'███ '}
          </C>
        ))}
      </L>
      <L>
        {BRIGHT.map((n) => (
          <C key={n} n={n}>
            {'███ '}
          </C>
        ))}
      </L>
      <L>
        {[...NORMAL.slice(1, 7), ...BRIGHT.slice(1, 7)].map((n) => (
          <C key={n} n={n}>
            {'Aa '}
          </C>
        ))}
      </L>
      <L>
        <span className="bg-(--se)"> selection </span> cursor <Caret />
      </L>
      <L>
        <C n={8}>comment</C> foreground <C n={7}>ansi7</C>{' '}
        <C n={15} bold>
          ansi15
        </C>
      </L>
    </>
  )
}

export function TerminalPreview({
  theme,
  scene,
  bare = false,
  worn = false,
  className,
}: {
  theme: Theme
  scene: Scene
  bare?: boolean
  worn?: boolean
  className?: string
}) {
  return (
    <pre
      data-slot="terminal-preview"
      style={worn ? undefined : wearStyle(theme)}
      className={cn(
        'min-h-45 overflow-hidden font-mono text-code whitespace-pre text-(--fg)',
        bare ? 'bg-transparent' : 'bg-(--bg) px-4.5 pt-4.5 pb-4',
        className,
      )}
    >
      {scene === 'git' ? <Git /> : null}
      {scene === 'test' ? <Test /> : null}
      {scene === 'colors' ? <Colors /> : null}
      {scene === 'shell' ? <Shell use={theme.market ? theme.id : theme.name} /> : null}
    </pre>
  )
}
