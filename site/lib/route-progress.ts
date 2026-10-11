export const ROUTE_KEY = 'ttheme-site-route'

export const ROUTE_SCRIPT = `try{var r=JSON.parse(sessionStorage.getItem('${ROUTE_KEY}'));sessionStorage.removeItem('${ROUTE_KEY}');if(r&&Math.abs(Date.now()-r.nav-performance.now())<500){var s=document.documentElement;s.style.setProperty('--route-from',String(Date.now()-r.at));s.dataset.arriving=''}}catch(e){}`
