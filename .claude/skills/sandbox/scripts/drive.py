import fcntl
import os
import select
import signal
import struct
import subprocess
import sys
import termios
import time
import tty

KEYS = {
    'up': '\x1b[A',
    'down': '\x1b[B',
    'right': '\x1b[C',
    'left': '\x1b[D',
    'shift-up': '\x1b[1;2A',
    'shift-down': '\x1b[1;2B',
    'shift-right': '\x1b[1;2C',
    'shift-left': '\x1b[1;2D',
    'home': '\x1b[H',
    'end': '\x1b[F',
    'pgup': '\x1b[5~',
    'pgdn': '\x1b[6~',
    'enter': '\r',
    'esc': '\x1b',
    'tab': '\t',
    'space': ' ',
    'bs': '\x7f',
    'ctrl-c': '\x03',
    'ctrl-u': '\x15',
    'shift-tab': '\x1b[Z',
    'alt-c': '\x1bc',
    'ctrl-v': '\x16',
    'alt-v': '\x1bv',
    'focus-in': '\x1b[I',
    'focus-out': '\x1b[O',
}

GAP = 0.25
REPEAT = 0.03
LINGER = 10.0
WAIT = 10.0


def keys(step):
    if step.startswith('text:'):
        return list(step[5:]), GAP
    if step.startswith('paste:'):
        return [f'\x1b[200~{step[6:]}\x1b[201~'], GAP
    if step in KEYS:
        return [KEYS[step]], GAP
    if step.startswith('hold:'):
        key, _, count = step[5:].rpartition(':')
        if key in KEYS and count.isdigit():
            return [KEYS[key]] * int(count), REPEAT
    if len(step) == 1:
        return [step], GAP
    raise SystemExit(f'drive.py: unknown step {step!r}')


class Screen:
    def __init__(self, size):
        rows, cols = struct.unpack('HHHH', size)[:2]
        helper = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screen.mjs')
        try:
            self.proc = subprocess.Popen(['node', helper, str(cols), str(rows)], stdin=subprocess.PIPE,
                                         stdout=subprocess.PIPE, bufsize=0)
        except OSError:
            self.proc = None

    def send(self, kind, body=b''):
        if self.proc is None:
            return False
        try:
            self.proc.stdin.write(kind + struct.pack('>I', len(body)) + body)
            return True
        except OSError:
            self.proc = None
            return False

    def feed(self, data):
        self.send(b'd', data)

    def text(self):
        if not self.send(b't'):
            return None
        out = b''
        fd = self.proc.stdout.fileno()
        while not out.endswith(b'\0'):
            if fd not in select.select([fd], [], [], 2)[0]:
                return None
            chunk = os.read(fd, 65536)
            if not chunk:
                self.proc = None
                return None
            out += chunk
        return out[:-1].decode('utf-8', 'replace')

    def close(self):
        if self.proc is None:
            return
        try:
            self.proc.stdin.close()
            self.proc.wait(timeout=2)
        except (OSError, subprocess.TimeoutExpired):
            self.proc.kill()


def spawn(command, size):
    master, slave = os.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, size)
    pid = os.fork()
    if pid == 0:
        os.close(master)
        os.setsid()
        fcntl.ioctl(slave, termios.TIOCSCTTY, 0)
        for fd in (0, 1, 2):
            os.dup2(slave, fd)
        if slave > 2:
            os.close(slave)
        os.execvp('zsh', ['zsh', '-i', '-c', command])
    os.close(slave)
    return pid, master


def main():
    if len(sys.argv) < 2:
        raise SystemExit('usage: drive.py COMMAND [STEP…]  — a step is a key, text:…, paste:…, seconds, wait:TEXT or shot:NAME')
    command, steps = sys.argv[1], sys.argv[2:]
    shots = os.path.join(os.environ.get('ZDOTDIR') or os.environ['HOME'], 'shots')
    term = os.open('/dev/tty', os.O_RDWR)
    size = fcntl.ioctl(term, termios.TIOCGWINSZ, b'\0' * 8)
    pid, master = spawn(command, size)
    screen = Screen(size)
    failed = False
    saved = termios.tcgetattr(term)
    tty.setraw(term)
    status = None
    try:
        at = time.monotonic() + GAP
        pending = []
        gap = GAP
        shot = None
        done = None
        waiting = None
        poll = 0.0
        while True:
            now = time.monotonic()
            if shot:
                if os.path.exists(f'{shot}.done') or os.path.exists(f'{shot}.skip'):
                    seen = screen.text()
                    if seen is not None:
                        with open(f'{shot}.screen', 'w') as out:
                            out.write(seen + '\n')
                    shot = None
                    at = now
            elif waiting and now >= poll:
                seen = screen.text()
                if seen is not None and waiting[0] in seen:
                    waiting = None
                    at = now
                elif seen is None or now >= waiting[1]:
                    why = f'not on the screen after {WAIT:g} s' if seen is not None else 'no screen text (node or @xterm/headless missing)'
                    sys.stderr.write(f'drive.py: wait:{waiting[0]} — {why}\n{seen or ""}\n')
                    failed = True
                    waiting = None
                    steps, pending = [], []
                    done = now - LINGER
                else:
                    poll = now + 0.1
            elif waiting:
                pass
            elif pending and now >= at:
                os.write(master, pending.pop(0).encode())
                at = now + (gap if pending else GAP)
            elif steps and now >= at:
                step = steps.pop(0)
                if step.startswith('shot:'):
                    os.makedirs(shots, exist_ok=True)
                    shot = os.path.join(shots, step[5:])
                    open(f'{shot}.req', 'w').close()
                elif step.startswith('wait:'):
                    waiting = (step[5:], now + WAIT)
                    poll = now
                else:
                    try:
                        at = now + float(step)
                    except ValueError:
                        pending, gap = keys(step)
            elif not steps and not pending and not shot and not waiting and done is None:
                done = now
            if done is not None and now - done > LINGER:
                os.kill(pid, signal.SIGHUP)
                done = now
            readable, _, _ = select.select([master, term], [], [], 0.02)
            if master in readable:
                try:
                    data = os.read(master, 65536)
                except OSError:
                    data = b''
                if data:
                    os.write(term, data)
                    screen.feed(data)
                elif status is not None:
                    break
            if term in readable:
                data = os.read(term, 4096)
                if data:
                    os.write(master, data)
            if status is None:
                waited, code = os.waitpid(pid, os.WNOHANG)
                if waited:
                    status = os.waitstatus_to_exitcode(code)
                    if master not in select.select([master], [], [], 0.05)[0]:
                        break
    finally:
        termios.tcsetattr(term, termios.TCSADRAIN, saved)
        screen.close()
    return 1 if failed else status or 0


sys.exit(main())
