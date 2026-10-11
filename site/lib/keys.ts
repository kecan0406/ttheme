export const APPLE = 'data-apple'

export const KEYS_SCRIPT = `(function(){if(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent))document.documentElement.setAttribute('${APPLE}','')})()`
