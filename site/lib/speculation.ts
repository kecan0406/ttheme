export const SPECULATION_RULES = JSON.stringify({
  prerender: [
    {
      where: { and: [{ href_matches: '/*' }, { not: { selector_matches: '[data-pick]' } }] },
      eagerness: 'moderate',
    },
  ],
})
