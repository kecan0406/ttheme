'use client'

import { Fragment, type ReactNode, useMemo } from 'react'
import type { Theme } from '@/lib/themes'
import { bandsOf } from './palette-sidebar'

const NAME_COLUMN = 8

function Line({ children }: { children?: ReactNode }) {
  return <div className="term-line">{children}</div>
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
        <span className="term-caret" />
      </Line>
    </>
  )
}
