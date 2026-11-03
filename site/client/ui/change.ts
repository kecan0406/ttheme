export type Reason =
  | 'trigger-press'
  | 'trigger-hover'
  | 'item-press'
  | 'outside-press'
  | 'close-press'
  | 'escape-key'
  | 'focus-out'
  | 'window-resize'
  | 'none'

export interface OpenChange {
  open: boolean
  reason: Reason
  trigger: Element | null
}

export interface ValueChange {
  value: string
  reason: Reason
  trigger: Element
}

export interface ItemHighlighted {
  value: string | null
  reason: 'keyboard' | 'pointer' | 'none'
}

export interface PressedChange {
  pressed: boolean
  reason: Reason
  trigger: Element
}

declare global {
  interface HTMLElementEventMap {
    openchange: CustomEvent<OpenChange>
    valuechange: CustomEvent<ValueChange>
    pressedchange: CustomEvent<PressedChange>
    itemhighlighted: CustomEvent<ItemHighlighted>
  }

  interface DocumentEventMap {
    openchange: CustomEvent<OpenChange>
    valuechange: CustomEvent<ValueChange>
    pressedchange: CustomEvent<PressedChange>
    itemhighlighted: CustomEvent<ItemHighlighted>
  }
}

export function emit<K extends 'openchange' | 'valuechange' | 'pressedchange' | 'itemhighlighted'>(
  target: Element,
  type: K,
  detail: HTMLElementEventMap[K]['detail'],
  cancelable: boolean,
): boolean {
  return target.dispatchEvent(new CustomEvent(type, { bubbles: true, cancelable, detail }))
}
