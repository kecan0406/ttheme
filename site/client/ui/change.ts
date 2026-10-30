export type Reason =
  | 'trigger-press'
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
  }

  interface DocumentEventMap {
    openchange: CustomEvent<OpenChange>
    valuechange: CustomEvent<ValueChange>
    pressedchange: CustomEvent<PressedChange>
  }
}

export function emit<K extends 'openchange' | 'valuechange' | 'pressedchange'>(
  target: Element,
  type: K,
  detail: HTMLElementEventMap[K]['detail'],
  cancelable: boolean,
): boolean {
  return target.dispatchEvent(new CustomEvent(type, { bubbles: true, cancelable, detail }))
}
