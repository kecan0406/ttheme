document.addEventListener('click', (event) => {
  const target = event.target as Element | null
  const addon = target?.closest('[data-slot="input-group-addon"]')
  if (!addon || target?.closest('button')) return
  addon.parentElement?.querySelector('input')?.focus()
})
