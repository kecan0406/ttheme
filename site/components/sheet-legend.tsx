import type { Mode } from './sheet-head'
import { Chip, Key, Tag } from './sheet-parts'

export function SheetLegend({ mode }: { mode: Mode }) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 border-t px-5 py-[9px] text-[11.5px] text-muted-foreground max-[860px]:px-4">
      {mode === 'backdrop' ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <span>
            <b className="text-foreground">tint</b> the palette’s background into one signature color
          </span>
          <span>
            <b className="text-foreground">opacity</b> as high as the contrast floors still clear
          </span>
          <span>
            install one with <code>ttheme preview</code>, then <Key>tab</Key>
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <span className="inline-flex items-center gap-2">
            <Chip slots={['a1', 'a9']} className="h-3.5 w-6" />
            normal · bright
          </span>
          <span>
            <b className="text-foreground">n:1 ≥floor</b> contrast on the background and the build's floor
          </span>
          <span className="inline-flex items-center gap-2">
            <Tag>weakest</Tag>
            lowest accent
          </span>
        </div>
      )}
      <span>
        <Key>←</Key> <Key>→</Key> turn the sheet, like <code>ttheme next</code>
      </span>
    </footer>
  )
}
