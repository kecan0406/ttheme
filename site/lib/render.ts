export function html(element: JSX.Element): string {
  if (element instanceof Promise) throw new Error('an async component cannot render here')

  return element
}

export function json<Data>(value: Data): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}
