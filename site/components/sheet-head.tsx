import { Button } from '@/components/ui/button'
import { gatePassed, sheetNumber, slotOf } from '@/lib/sheet'
import type { GateRule, Theme } from '@/lib/themes'

const LINE = 'rounded-[2px]'
const FLIP = `${LINE} size-[26px] text-[15px]`

export function SheetHead({
  theme,
  themes,
  gate,
  onStep,
  onOpenSheets,
}: {
  theme: Theme
  themes: Theme[]
  gate: GateRule[]
  onStep: (delta: number) => void
  onOpenSheets: () => void
}) {
  const passed = gatePassed(theme, gate)
  const waived = gate.length - passed

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2.5 border-b px-5 py-3 max-[860px]:px-4">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-[18px] gap-y-1">
        <Button
          variant="line"
          size="xs"
          aria-controls="sheets"
          className={`${LINE} hidden self-center max-[860px]:inline-flex`}
          onClick={onOpenSheets}
        >
          sheets
        </Button>
        <h1 className="font-pixel text-[clamp(28px,2.8vw,38px)] leading-[1.05] font-normal text-primary [overflow-wrap:anywhere]">
          {theme.name}
        </h1>
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
          <span>{theme.group}</span>
          <span aria-hidden="true" className="text-muted-foreground/70">
            ·
          </span>
          <span>ANSI {theme.ansiSource}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-[26px] gap-y-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-[9px]">
          <span className="flex gap-1">
            {theme.signatureSlots.map((slot) =>
              slot === 'selection' ? (
                <b
                  key={slot}
                  className="flex h-[18px] items-center rounded-full border px-1.5 font-normal text-[10px]"
                  style={{ background: 'var(--se)', color: 'var(--fg)' }}
                >
                  sel
                </b>
              ) : (
                <i
                  key={slot}
                  className="size-[18px] rounded-full border"
                  style={{ background: `var(--${slotOf(slot)})` }}
                />
              ),
            )}
          </span>
          {theme.signatureSlots.join(' · ')}
        </span>
        <span className="flex items-center gap-[9px]">
          <b className="text-[15px] text-foreground tabular-nums">
            {passed}/{gate.length}
          </b>
          {waived === 0 ? 'contrast floors cleared' : `floors, ${waived} waived`}
        </span>
        <span className="flex items-center gap-2.5 text-[13px] text-foreground">
          <Button variant="line" size="icon-xs" aria-label="previous sheet" className={FLIP} onClick={() => onStep(-1)}>
            ‹
          </Button>
          <output className="min-w-[8ch] text-center font-bold tabular-nums">
            {sheetNumber(themes, theme)}
            <span className="font-normal text-muted-foreground/70"> / {themes.length}</span>
          </output>
          <Button variant="line" size="icon-xs" aria-label="next sheet" className={FLIP} onClick={() => onStep(1)}>
            ›
          </Button>
        </span>
      </div>
    </header>
  )
}
