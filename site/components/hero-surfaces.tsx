'use client'

import { Fragment, type ReactNode, useMemo } from 'react'
import type { Theme } from '@/lib/themes'
import { bandsOf } from './palette-sidebar'

const ansiKeys = Array.from({ length: 16 }, (_, index) => `ansi${index}`)
const NAME_COLUMN = 8
const NUMBER_COLUMN = 3
const CURSOR_ROW = 10

function Line({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={className ? `term-line ${className}` : 'term-line'}>{children}</div>
}

function Dim({ children }: { children: ReactNode }) {
  return <span className="term-dim">{children}</span>
}

function Prompt() {
  return (
    <>
      <span className="term-c2">{'➜  '}</span>
      <span className="term-c6">ttheme</span>
      <span className="term-c4">{' git:('}</span>
      <span className="term-c1">main</span>
      <span className="term-c4">{') '}</span>
    </>
  )
}

function Caret() {
  return <span className="term-caret" />
}

function Field({ name, children }: { name: string; children: ReactNode }) {
  return (
    <>
      <span className="term-c4">{name}</span>
      <span className="term-c8">{' = '}</span>
      {children}
    </>
  )
}

function Text({ children }: { children: ReactNode }) {
  return <span className="term-c2">{`"${children}"`}</span>
}

function Swatch({ tone }: { tone: string }) {
  return <span className={`term-blk ${tone}`} />
}

export function ListSurface({ theme, themes }: { theme: Theme; themes: Theme[] }) {
  const bands = useMemo(() => bandsOf(themes), [themes])

  return (
    <>
      <Line>
        <Prompt />
        ttheme
      </Line>
      {bands.map((band) => (
        <Fragment key={band.group}>
          <Line>
            <b>{band.group}</b>
            {band.native ? <Dim>{` ${band.native}`}</Dim> : null}
          </Line>
          {band.themes.map((entry) => (
            <Line key={entry.name}>
              {entry.name === theme.name ? <span className="term-cu">{'◆ '}</span> : '  '}
              <span className="term-chip" style={{ background: entry.background, color: entry.cursor }}>
                {' ● '}
              </span>
              {` ${entry.name.padEnd(NAME_COLUMN)} `}
              <Dim>{`· ANSI ${entry.ansiSource}`}</Dim>
            </Line>
          ))}
        </Fragment>
      ))}
      <Line />
      <Line>
        <Dim>{'ttheme <name> paints this tab · ttheme preview · ttheme help'}</Dim>
      </Line>
      <Line />
      <Line>
        <Prompt />
        {`ttheme ${theme.name}`}
      </Line>
      <Line>
        <span className="term-chip term-on-se">{` ${theme.group} `}</span>
        {theme.native ? <Dim>{`  ${theme.native}`}</Dim> : null}
      </Line>
      <Line>
        <span className="term-chip term-on-cu">{` ${theme.name} `}</span>
        <Dim>{` · ANSI ${theme.ansiSource}`}</Dim>
      </Line>
      <Line>
        <Prompt />
        <Caret />
      </Line>
    </>
  )
}

export function NvimSurface({ theme }: { theme: Theme }) {
  const rows: { key: string; node: ReactNode }[] = [
    { key: 'meta', node: <span className="term-c5">[meta]</span> },
    { key: 'name', node: <Field name="name">{<Text>{theme.name}</Text>}</Field> },
    { key: 'group', node: <Field name="group">{<Text>{theme.group}</Text>}</Field> },
    { key: 'order', node: <Field name="order">{<span className="term-c3">{theme.order}</span>}</Field> },
    { key: 'source', node: <Field name="ansi_source">{<Text>{theme.ansiSource}</Text>}</Field> },
    {
      key: 'signature',
      node: (
        <Field name="signature">
          <span className="term-c6">[</span>
          {theme.signatureSlots.map((slot, index) => (
            <Fragment key={slot}>
              {index > 0 ? <span className="term-c8">, </span> : null}
              <Text>{slot}</Text>
            </Fragment>
          ))}
          <span className="term-c6">]</span>
        </Field>
      ),
    },
    { key: 'gap-meta', node: null },
    { key: 'colors', node: <span className="term-c5">[colors]</span> },
    {
      key: 'background',
      node: (
        <>
          <Field name="background">{<Text>{theme.background}</Text>}</Field>
          {'  '}
          <Swatch tone="term-bg" />
        </>
      ),
    },
    {
      key: 'foreground',
      node: (
        <>
          <Field name="foreground">{<Text>{theme.foreground}</Text>}</Field>
          {'  '}
          <Swatch tone="term-fg" />
        </>
      ),
    },
    {
      key: 'cursor',
      node: (
        <>
          <Field name="cursor">{<Text>{theme.cursor}</Text>}</Field>
          {'  '}
          <Swatch tone="term-cu" />
        </>
      ),
    },
    {
      key: 'selection',
      node: (
        <>
          <Field name="selection_background">{<Text>{theme.selectionBackground}</Text>}</Field>
          {'  '}
          <Swatch tone="term-se" />
        </>
      ),
    },
    { key: 'ansi', node: <Field name="ansi">{<span className="term-c6">[</span>}</Field> },
    ...theme.ansi.flatMap((color, index) => {
      const row = {
        key: ansiKeys[index] ?? `ansi${index}`,
        node: (
          <>
            {'  '}
            <Text>{color}</Text>
            <span className="term-c8">,</span>
            {'  '}
            <Swatch tone={`term-c${index}`} />
          </>
        ),
      }
      return index === 8 ? [{ key: 'gap-ansi', node: null }, row] : [row]
    }),
    { key: 'ansi-close', node: <span className="term-c6">]</span> },
  ]

  return (
    <>
      {rows.map((row, index) => (
        <Line key={row.key} className={index === CURSOR_ROW ? 'term-curline' : undefined}>
          <span className="term-lnum">{`${String(index + 1).padStart(NUMBER_COLUMN)} `}</span>
          {row.node}
        </Line>
      ))}
    </>
  )
}

export function NvimStatus({ theme }: { theme: Theme }) {
  return (
    <div className="hero-nvimline">
      <span className="hero-nvimline-mode">NORMAL</span>
      <span className="hero-nvimline-file">{`themes/${theme.name}.toml`}</span>
      <span className="hero-nvimline-mode">{`toml  ${CURSOR_ROW + 1}:1`}</span>
    </div>
  )
}

export function GitSurface({
  theme,
  score,
  rules,
  count,
}: {
  theme: Theme
  score: number
  rules: number
  count: number
}) {
  const before = theme.ansi[7] ?? theme.foreground
  return (
    <>
      <Line>
        <Prompt />
        git status -sb
      </Line>
      <Line>
        <Dim>{'## '}</Dim>
        <span className="term-c2">main</span>
        <Dim>...</Dim>
        <span className="term-c1">origin/main</span>
        <span className="term-c3">{' [ahead 1]'}</span>
      </Line>
      <Line>
        <span className="term-c2">{'M  '}</span>
        {`themes/${theme.name}.toml`}
      </Line>
      <Line />
      <Line>
        <Prompt />
        git diff
      </Line>
      <Line>
        <span className="term-c3">{`diff --git a/themes/${theme.name}.toml b/themes/${theme.name}.toml`}</span>
      </Line>
      <Line>
        <span className="term-c3">{`--- a/themes/${theme.name}.toml`}</span>
      </Line>
      <Line>
        <span className="term-c3">{`+++ b/themes/${theme.name}.toml`}</span>
      </Line>
      <Line>
        <span className="term-c6">{'@@ -8,7 +8,7 @@ [colors]'}</span>
      </Line>
      <Line>{` background = "${theme.background}"`}</Line>
      <Line>{` foreground = "${theme.foreground}"`}</Line>
      <Line>
        <span className="term-c1">{`-cursor = "${before}"`}</span>
      </Line>
      <Line>
        <span className="term-c2">{`+cursor = "${theme.cursor}"`}</span>
      </Line>
      <Line>{` selection_background = "${theme.selectionBackground}"`}</Line>
      <Line />
      <Line>
        <Prompt />
        mise run test
      </Line>
      <Line>
        {'  '}
        <span className="term-c2">✓</span>
        {` contrast ${score}/${rules} · ${count} palettes · ${theme.waived.length} waivers`}
      </Line>
      <Line>
        <Prompt />
        <Caret />
      </Line>
    </>
  )
}
