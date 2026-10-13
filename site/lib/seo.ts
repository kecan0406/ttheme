import { escapeHtml } from '@kitajs/html'
import type { Facts } from '@/lib/facts'
import { NPM_URL, OFFICIAL_REPO, OFFICIAL_URL } from '@/lib/gallery'
import { siteMeta } from '@/lib/titles'
import pkg from '../../package.json' with { type: 'json' }
import { SHARE_URL } from '../../src/own.ts'
import { revision } from './embed.ts' with { type: 'macro' }

export const ORIGIN = new URL(SHARE_URL).origin

export const CARD_REV = `${pkg.version}-${revision('./card.ts', './raster.ts', './oklab.ts', './embed.ts')}`

const [OWNER] = OFFICIAL_REPO.split('/') as [string]

export const ROBOTS = `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`

export function sitemapXml(paths: string[]): string {
  const urls = paths.map((path) => `<url><loc>${escapeHtml(`${ORIGIN}${path}`)}</loc></url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export function siteGraph({ palettes, version }: Facts): object {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${ORIGIN}/#website`, name: 'ttheme', url: `${ORIGIN}/`, inLanguage: 'en' },
      {
        '@type': 'SoftwareSourceCode',
        '@id': `${ORIGIN}/#code`,
        name: 'ttheme',
        url: `${ORIGIN}/`,
        description: siteMeta(palettes).description,
        codeRepository: OFFICIAL_URL,
        programmingLanguage: ['TypeScript', 'Zsh'],
        runtimePlatform: 'Node.js, zsh',
        license: 'https://opensource.org/licenses/MIT',
        version,
        author: { '@type': 'Person', name: OWNER, url: `https://github.com/${OWNER}` },
        sameAs: [NPM_URL],
      },
    ],
  }
}

export function crumbs(trail: { name: string; path: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(({ name, path }, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: `${ORIGIN}${path}`,
    })),
  }
}
