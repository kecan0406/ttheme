export const WIDE = 44

interface Scene {
  name: string
  lines: string[]
}

export const SCENES: Scene[] = [
  {
    name: 'Shell',
    lines: [
      '«B4»~/code/demo«d» on «5»main«2» +2«3» ~1',
      '«2»❯ «»git status -sb',
      '«w»## «2»main«»...«1»origin/main«3» [ahead 1]',
      '«1» M«» src/main.rs',
      '«1»??«» notes.md',
      '',
      '«w»«2»❯ «»ls',
      '«w»«B4»docs«»  «B4»src«»  «B4»tests«»  Cargo.toml  README.md',
      '«w»',
      '«2»❯ «»cargo test',
      '«2» ✓«» parses config',
      '«n»«1» ✗«» renders frame',
      '«w»«1» ✗«» renders frame«d»  expected «2»3«d», received «1»2',
      '',
      '«2»❯ «»echo «s»selected text«» «c» ',
    ],
  },
  {
    name: 'Code',
    lines: [
      "«d» 12 │ «5»import«» { readFile } «5»from «2»'node:fs/promises'",
      '«d» 13 │',
      '«d» 14 │ «8»// Read a palette and check its sixteen colors',
      '«d» 15 │ «5»export async function «4»load«»(path: «6»string«») {',
      "«d» 16 │   «5»const«» text = «5»await «4»readFile«»(path, «2»'utf8'«»)",
      '«b» 17 «d»│   «5»const«» colors = «s»parse(text)«».colors ?? {}',
      '«d» 18 │   «5»if«» (colors.ansi.length !== «3»16«») {',
      "«d» 19 │     «5»throw new «6»Error«»(«2»'needs 16 colors'«»)",
      '«d» 20 │   }',
      '«d» 21 │   «5»return«» { ...colors, ratio: «c»4«3».5«» }',
      '«d» 22 │ }',
    ],
  },
  {
    name: 'Diff',
    lines: [
      '«2»❯ «»git diff --stat',
      '«» src/theme.ts | 3 «2»++«1»-',
      '«2»❯ «»git diff',
      '«b»diff --git a/src/theme.ts b/src/theme.ts',
      '«6»@@ -16,3 +16,4 @@«» export async function load(',
      "«»   const text = await readFile(path, 'utf8')",
      '«1»-  const colors = parse(text).colors',
      '«2»+  const colors = parse(text).colors ?? {}',
      '«2»+  const ratio = contrast(colors)',
      '«2»❯ «»git log --oneline --graph -4',
      '«3»* 3f2a1c9 («B6»HEAD -> «B2»main«3»)«» Check contrast on load',
      '«3»*   9b04e7d«» Merge branch ansi',
      '«1»|«5»\\',
      '«1»| «5»* «3»51cd0aa«» Add sixteen ANSI colors',
      '«1»|«5»/',
      '«3»* 07be2f1 («B1»origin/main«3», «B3»tag: v1.0«3»)«» Read palette files',
    ],
  },
  {
    name: 'Logs',
    lines: [
      '«2»❯ «»npm run dev',
      '«B2»  VITE v6.2.0«d»  ready in «b»412«d» ms',
      '«2»  ➜  «b»Local«»:   «6»http://localhost:5173/',
      '«d»10:42:07 «2»INFO «» GET  /api/palettes      «2»200«d»  12 ms',
      '«d»10:42:08 «2»INFO «» GET  /api/themes/kita   «2»200«d»   8 ms',
      '«d»10:42:09 «3»WARN «» slow query: palettes «3»812 ms',
      '«d»10:42:10 «4»DEBUG«» cache hit themes/kita',
      '«d»10:42:11 «B1»ERROR«» POST /api/share        «1»500«d»  41 ms',
      '«1»    Error«»: read ECONNRESET',
      '«d»        at «»TCP.onStreamRead «d»(«6»node:net:216:20«d»)',
      '«d»        at «»share «d»(«6»src/share.ts:48:11«d»)',
      '«d»10:42:12 «2»INFO «» retry 1/3 in 200 ms',
    ],
  },
  {
    name: 'Monitor',
    lines: [
      '«6»  1 «b»[«2»|||||||||||||«1»||«»      42.1%«b»]«6»  Tasks: «b»128«», 412 thr; «B2»3«» running',
      '«6»  2 «b»[«2»||||||«4»||«»             21.4%«b»]«6»  Load average: «b»1.42 «»1.18 0.97',
      '«6»  3 «b»[«2»||||||||||||||«1»|||||«»  71.0%«b»]«6»  Uptime: «b»3 days, 04:12:55',
      '«6»  4 «b»[«2»||«»                    7.9%«b»]',
      '«6»  Mem«b»[«2»||||||||«4»||«3»||«»  6.21G/16.0G«b»]',
      '«6»  Swp«b»[«1»|«»             0.10G/2.00G«b»]',
      '',
      '«K2»    PID USER      CPU% MEM%    TIME+  Command     ',
      '«s»   4127 kec       38.2  2.1  3:12.44  node dev.js ',
      '«»   2210 kec       12.0  4.8  1:02.10  «b»ghostty',
      '«»   3301 kec        4.4  1.2  0:05.61  «b»zsh',
      '«»    812 «1»root«»       3.1  0.3  0:44.02  «d»kernel_task',
      '«»    167 «1»root«»       0.9  0.1  0:12.80  «d»WindowServer',
    ],
  },
]

export function sceneAt(index: number): Scene {
  const n = SCENES.length
  return SCENES[((index % n) + n) % n] as Scene
}

export function sceneParts(line: string, width: number): [string, string][] | undefined {
  const pieces = line.split('«')
  const out: [string, string][] = pieces[0] ? [[pieces[0], '']] : []
  for (const piece of pieces.slice(1)) {
    const end = piece.indexOf('»')
    const role = piece.slice(0, end)
    const text = piece.slice(end + 1)
    if (role === 'w' || role === 'n') {
      if ((role === 'w') !== width >= WIDE) {
        return undefined
      }
    }
    if (text) {
      out.push([text, role === 'w' || role === 'n' ? '' : role])
    }
  }
  return out
}
