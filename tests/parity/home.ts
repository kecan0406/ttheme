import { Database } from 'bun:sqlite'
import { chmodSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { PaletteEntry } from '../../src/manifest.ts'
import { TERMINAL_DOMAIN } from '../../src/terminals/terminal-app.ts'
import { installTestPicture } from '../picture.ts'
import { COLS, ITERM_SUITE, type Place, ROWS, warpPaths } from './model.ts'
import { BEHAVIOR, OWN, type Term, WIRING, WT_PROFILE } from './terms.ts'

export const PALETTES = ['konata', 'kita', 'miku', 'rei']
export const PICTURED = ['konata', 'kita']
export const STARTUP = 'konata'

const SHIMS: Record<string, string> = {
  ps: 'exit 0',
  ssh: [
    's=$(stty -g)',
    'stty raw -echo',
    'printf "\\033[?1004hremote> "',
    'while [ "$(dd bs=1 count=1 2>/dev/null)" != q ]; do :; done',
    'printf "\\033[?1004l"',
    'stty "$s"',
  ].join('\n'),
  osascript: [
    'term="$HOME/.parity/terminal"',
    "enc() { printf '%s' \"$1\" | sed 's|/|--|g'; }",
    'case "$*" in',
    '  *terminal-app.js*)',
    `    shift 3; exec '${process.execPath}' '${join(import.meta.dirname, 'apple.ts')}' "$@" ;;`,
    "  *'on run argv'*)",
    '    while [ "$1" = -e ]; do shift 2; done',
    '    [ -f "$term/loaded/$(enc "$2")" ] || { echo missing; exit 0; }',
    '    [ "$1" = default ] && printf \'%s\\n\' "$2" > "$term/default"',
    '    echo ok',
    '    exit 0 ;;',
    'esac',
    'front="$HOME/.parity/front"',
    'for ps in /bin/ps /usr/bin/ps; do [ -x "$ps" ] && break; done',
    'answer() { read -r tty < "$front"; echo "1 $tty $("$ps" -o tpgid= -t "${tty#/dev/}" 2>/dev/null | awk \'NR == 1 { print $1 }\')"; }',
    'case "$*" in',
    '  *getppid*)',
    '    parent=$PPID last=""',
    '    while kill -0 "$parent" 2>/dev/null; do',
    '      if [ -s "$front" ]; then read -r now < "$front"; [ "$now" = "$last" ] || { last=$now; answer; }; fi',
    '      sleep 0.05',
    '    done',
    '    exit 0 ;;',
    'esac',
    '[ -s "$front" ] || { echo none; exit 0; }',
    'answer',
  ].join('\n'),
  pkill: 'case " $* " in *" -USR2 "*" ghostty "*) printf \'reload\\n\' >> "$HOME/.parity/reloads" ;; esac\nexit 0',
  pgrep:
    'case " $* " in *" -x Terminal "*) [ -f "$HOME/.parity/terminal.running" ] && echo 4242 && exit 0 ;; esac\nexit 1',
  defaults: [
    'dir="$HOME/.parity/defaults/$2"',
    'case "$1" in',
    '  read) [ -f "$dir/$3" ] || exit 1; cat "$dir/$3" ;;',
    '  write) mkdir -p "$dir"; printf "%s\\n" "$5" > "$dir/$3" ;;',
    '  delete) rm -f "$dir/$3" ;;',
    'esac',
  ].join('\n'),
  'dbus-send': [
    'running="$HOME/.parity/konsole.running"',
    '[ -f "$running" ] || exit 1',
    'case " $* " in',
    '  *" org.freedesktop.DBus.ListNames "*) printf \'   string "%s"\\n\' "$(cat "$running")" ;;',
    '  *" org.freedesktop.DBus.Introspectable.Introspect "*) printf \'<node name="1"/>\\n\' ;;',
    '  *".setDefaultProfile "*) for a; do case "$a" in string:*) printf "%s\\n" "${a#string:}" > "$HOME/.parity/konsole.default" ;; esac; done ;;',
    '  *".defaultProfile "*) printf \'   string "%s"\\n\' "$(cat "$HOME/.parity/konsole.default" 2>/dev/null)" ;;',
    'esac',
  ].join('\n'),
}

export function shims(work: string): string {
  const bin = join(work, 'bin')
  mkdirSync(bin, { recursive: true })
  for (const [name, body] of Object.entries(SHIMS)) {
    const file = join(bin, name)
    writeFileSync(file, `#!/bin/sh\n${body}\n`)
    chmodSync(file, 0o755)
  }
  return bin
}

function need(command: string): string {
  const found = Bun.which(command)
  if (!found) {
    throw new Error(`parity needs ${command} on PATH`)
  }
  return found
}

function nodeDir(): string {
  const real = Bun.spawnSync([need('node'), '-p', 'process.execPath'])
    .stdout.toString()
    .trim()
  return dirname(real || need('node'))
}

export function placeFor(work: string, term: Term, bin: string, slot: string): Place {
  const root = join(work, `${term}-${slot}`)
  const home = join(root, 'home')
  const configHome = join(home, '.config')
  const place: Place = {
    root,
    home,
    configHome,
    stateHome: join(home, '.local', 'state'),
    dataHome: join(home, '.local', 'share'),
    cacheHome: join(home, '.cache'),
    wtHome: join(home, 'wt'),
    env: {},
  }
  const zsh = need('zsh')
  place.env = {
    PATH: [bin, nodeDir(), dirname(zsh), dirname(need('sqlite3')), '/usr/bin', '/bin', '/usr/sbin', '/sbin'].join(':'),
    HOME: home,
    ZDOTDIR: home,
    XDG_CONFIG_HOME: configHome,
    XDG_STATE_HOME: place.stateHome,
    XDG_CACHE_HOME: place.cacheHome,
    XDG_DATA_HOME: place.dataHome,
    XDG_DATA_DIRS: join(home, '.nowhere'),
    TERM: 'xterm-256color',
    SHELL: zsh,
    LANG: process.platform === 'darwin' ? 'en_US.UTF-8' : 'C.UTF-8',
    USER: process.env.USER ?? 'parity',
    LOGNAME: process.env.USER ?? 'parity',
    TMPDIR: join(root, 'tmp'),
    TTHEME_ITERM_SUITE: ITERM_SUITE,
    TTHEME_NAMES: 'off',
    TTHEME_AUTO_UPDATE: 'off',
  }
  return place
}

function write(file: string, content: string): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}

async function run(place: Place, argv: string[], extra: Record<string, string> = {}): Promise<string> {
  const proc = Bun.spawn(argv, {
    cwd: place.root,
    env: { ...place.env, ...extra },
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (code !== 0) {
    throw new Error(`${argv.join(' ')} failed: ${err}${out}`)
  }
  return out
}

export function cli(place: Place, ...args: string[]): Promise<string> {
  return run(place, ['node', join(place.configHome, 'ttheme', 'ttheme.js'), ...args])
}

const OWN_SCHEME = [
  ['Background', '11'],
  ['Foreground', '10'],
  ...Array.from({ length: 8 }, (_, i) => [`Color${i}`, `4;${i}`]),
  ...Array.from({ length: 8 }, (_, i) => [`Color${i}Intense`, `4;${i + 8}`]),
]
  .map(([group, code]) => {
    const color = OWN.get(code as string) as string
    const rgb = [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16)).join(',')
    return `[${group}]\nColor=${rgb}\n`
  })
  .join('\n')

function prepare(place: Place, term: Term): void {
  write(join(place.home, '.zshenv'), 'unsetopt global_rcs\n')
  mkdirSync(join(place.home, '.parity'), { recursive: true })
  mkdirSync(join(place.root, 'tmp'), { recursive: true })
  write(join(place.home, '.parity', 'defaults', ITERM_SUITE, 'Default Bookmark Guid'), 'own\n')
  write(join(place.home, '.parity', 'defaults', ITERM_SUITE, 'PreventEscapeSequenceFromChangingProfile'), '0\n')
  if (term === 'terminal-app') {
    write(join(place.home, '.parity', 'defaults', TERMINAL_DOMAIN, 'Default Window Settings'), 'Own\n')
    write(join(place.home, '.parity', 'defaults', TERMINAL_DOMAIN, 'Startup Window Settings'), 'Own\n')
    write(join(place.stateHome, 'ttheme', 'terminal-app.window'), `${(COLS * 8) / 2}x${(ROWS * 17) / 2}\n`)
  }
  if (term === 'konsole') {
    write(join(place.dataHome, 'konsole', 'Own.colorscheme'), OWN_SCHEME)
    write(join(place.dataHome, 'konsole', 'Own.profile'), '[Appearance]\nColorScheme=Own\n\n[General]\nName=Own\n')
    write(join(place.configHome, 'konsolerc'), '[Desktop Entry]\nDefaultProfile=Own.profile\n')
  }
  if (term === 'warp') {
    const warp = warpPaths(place)
    write(warp.settings, '[appearance.themes]\ntheme = "dark"\n')
    mkdirSync(warp.themes, { recursive: true })
    mkdirSync(dirname(warp.db), { recursive: true })
    const db = new Database(warp.db)
    db.run('pragma journal_mode = wal')
    db.run('create table app (id integer primary key, active_window_id integer)')
    db.run('create table windows (id integer primary key, active_tab_index integer)')
    db.run('create table tabs (id integer primary key, window_id integer)')
    db.run('create table pane_nodes (id integer primary key, tab_id integer, is_leaf integer)')
    db.run('create table pane_leaves (pane_node_id integer, is_focused integer)')
    db.run('create table terminal_panes (id integer primary key, uuid blob)')
    db.run('insert into app (id, active_window_id) values (1, 1)')
    db.run('insert into windows (id, active_tab_index) values (1, 0)')
    db.close()
  }
  if (term === 'windows-terminal') {
    write(
      join(place.wtHome, 'Microsoft', 'Windows Terminal', 'settings.json'),
      `${JSON.stringify({ defaultProfile: WT_PROFILE, profiles: { list: [{ guid: WT_PROFILE, name: 'zsh' }] } }, null, 2)}\n`,
    )
  }
}

export const HARNESS = [
  "PROMPT='pt> '",
  "RPROMPT=''",
  'print -r -- $TTY >| $HOME/.parity/tty.$PT_TAB',
  '__pt_dump() { print -r -- "${TTHEME_SPEC}|${TTHEME_PAINTED}|${TTHEME_STARTUP}" >| $HOME/.parity/wears.$PT_TAB }',
  'zle -N __pt_dump',
  "bindkey '^[[5555~' __pt_dump",
  '',
].join('\n')

export interface Fixture {
  term: Term
  place: Place
  snapshot: string
}

export async function build(
  term: Term,
  work: string,
  bin: string,
  repo: string,
  slot: string,
  wiring: boolean,
): Promise<Fixture> {
  const place = placeFor(work, term, bin, slot)
  rmSync(place.root, { recursive: true, force: true })
  mkdirSync(place.home, { recursive: true })
  prepare(place, term)
  await run(place, ['node', join(repo, 'bin', 'ttheme.js'), 'init', '--yes'], {
    GHOSTTY_RESOURCES_DIR: '/nonexistent/ghostty',
  })
  const installedPath = join(place.configHome, 'ttheme', 'installed.json')
  const installed = JSON.parse(readFileSync(installedPath, 'utf8'))
  const wired = wiring ? WIRING[term] : undefined
  installed.terminals = wired ? [wired] : []
  if (wired === 'windows-terminal') {
    installed.wtHome = place.wtHome
    installed.wtProfile = WT_PROFILE
  }
  writeFileSync(installedPath, `${JSON.stringify(installed, null, 2)}\n`)
  if (wired !== 'ghostty') {
    rmSync(join(place.configHome, 'ghostty'), { recursive: true, force: true })
  }
  await cli(place, 'add', ...PALETTES)
  const manifest = JSON.parse(readFileSync(join(repo, 'dist', 'manifest.json'), 'utf8')) as { palettes: PaletteEntry[] }
  PICTURED.forEach((name, i) => {
    const entry = manifest.palettes.find((p) => p.name === name)
    if (!entry) {
      throw new Error(`no ${name} in the catalog`)
    }
    installTestPicture(place.configHome, entry, 1000 + i, { width: 800, height: 510 })
  })
  await cli(place, 'default', STARTUP)
  writeFileSync(
    join(place.home, '.zshrc'),
    `${readFileSync(join(place.home, '.zshrc'), 'utf8')}${HARNESS}${BEHAVIOR[term].promptTrap ? '' : "trap '' URG\n"}`,
  )
  await run(place, ['zsh', '-i', '-c', 'exit'], { GHOSTTY_RESOURCES_DIR: '' })
  const snapshot = join(place.root, 'snapshot')
  await run(place, ['cp', '-a', place.home, snapshot])
  return { term, place, snapshot }
}

export async function reap(place: Place): Promise<void> {
  const proc = Bun.spawn(['ps', '-A', '-ww', '-o', 'pid=,args='], { stdout: 'pipe', stderr: 'ignore' })
  const out = await new Response(proc.stdout).text()
  const pids = out.split('\n').flatMap((line) => {
    const match = /^\s*(\d+)\s+(.*)$/.exec(line)
    return match?.[2]?.includes(place.home) && !match[2].startsWith('ps ') ? [Number(match[1])] : []
  })
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {}
  }
}

export async function restore(fixture: Fixture): Promise<void> {
  await reap(fixture.place)
  rmSync(fixture.place.home, { recursive: true, force: true })
  await run(fixture.place, ['cp', '-a', fixture.snapshot, fixture.place.home])
}

export function workDir(): string {
  const base = realpathSync(process.env.TMPDIR ?? '/tmp')
  const dir = join(base, `ttheme-parity-${process.pid}`)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return dir
}
