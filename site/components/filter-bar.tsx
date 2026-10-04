import { Contrast, Moon, Search } from 'lucide'
import { Badge } from '@/components/ui/badge'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { START } from '@/lib/gallery'
import { Icon } from '@/lib/icons'
import { SCENES } from './terminal-preview'

export function FilterBar({ total, sources = true }: { total: number; sources?: boolean }) {
  return (
    <div class="sticky top-28 z-9 flex flex-wrap items-center gap-2.5 rounded-xl border bg-glass p-2.5 shadow-sm backdrop-blur-[10px] max-[560px]:static">
      <InputGroup class="min-w-60 flex-1">
        <InputGroupAddon>
          <Icon node={Search} />
        </InputGroupAddon>
        <InputGroupInput
          name="query"
          placeholder="search palettes, series, owners"
          aria-label="search palettes"
          spellcheck="false"
          autocomplete="off"
        />
        <InputGroupAddon align="inline-end">
          <Kbd>/</Kbd>
        </InputGroupAddon>
      </InputGroup>
      {sources ? (
        <ToggleGroup label="source">
          <ToggleGroupItem name="source" value="all" checked>
            all
          </ToggleGroupItem>
          <ToggleGroupItem name="source" value="official">
            official
          </ToggleGroupItem>
          <ToggleGroupItem name="source" value="markets">
            markets
          </ToggleGroupItem>
        </ToggleGroup>
      ) : null}
      <ToggleGroup label="background">
        <ToggleGroupItem name="ground" value="dark">
          <Icon node={Moon} />
          dark
        </ToggleGroupItem>
        <ToggleGroupItem name="ground" value="light">
          <Icon node={Contrast} />
          light
        </ToggleGroupItem>
        <ToggleGroupItem name="ground" value="both" checked>
          both
        </ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup label="scene">
        {SCENES.map((scene) => (
          <ToggleGroupItem name="scene" value={scene} checked={scene === START.scene}>
            {scene}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Badge variant="count" class="ml-auto" data-shown>
        {total} of {total} palettes
      </Badge>
    </div>
  )
}
