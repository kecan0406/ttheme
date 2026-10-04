export function html(element: JSX.Element): string {
  if (typeof element !== 'string') throw new Error('an async component cannot render here')
  return element
}

export function json(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}
