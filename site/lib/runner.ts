export const RUNNER_KEY = 'ttheme-site-runner'

export const RUNNER_SCRIPT = `(function(){try{if(localStorage.getItem('${RUNNER_KEY}')==='bunx')document.documentElement.dataset.runner='bunx'}catch(e){}})()`
