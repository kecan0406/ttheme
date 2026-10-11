export function composing(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === 229
}

export function typing(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('input, textarea, select, [contenteditable]') !== null
}

export function bare(event: KeyboardEvent): boolean {
  return !(event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented || composing(event))
}

export function printable(event: KeyboardEvent): boolean {
  return bare(event) && [...event.key].length === 1
}
