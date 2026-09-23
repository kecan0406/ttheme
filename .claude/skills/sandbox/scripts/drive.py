import fcntl
import os
import select
import signal
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
    'alt-c': '\x1bc',
    'ctrl-v': '\x16',
    'alt-v': '\x1bv',
    'focus-in': '\x1b[I',
    'focus-out': '\x1b[O',
}

GAP = 0.25
LINGER = 10.0


def keys(step):
    if step.startswith('text:'):
        return list(step[5:])
    if step.startswith('paste:'):
        return [f'\x1b[200~{step[6:]}\x1b[201~']
    if step in KEYS:
        return [KEYS[step]]
    if len(step) == 1:
        return [step]
    raise SystemExit(f'drive.py: unknown step {step!r}')


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
        raise SystemExit('usage: drive.py COMMAND [STEP…]  — a step is a key, text:…, paste:…, seconds or shot:NAME')
    command, steps = sys.argv[1], sys.argv[2:]
    shots = os.path.join(os.environ.get('ZDOTDIR') or os.environ['HOME'], 'shots')
    term = os.open('/dev/tty', os.O_RDWR)
    size = fcntl.ioctl(term, termios.TIOCGWINSZ, b'\0' * 8)
    pid, master = spawn(command, size)
    saved = termios.tcgetattr(term)
    tty.setraw(term)
    status = None
    try:
        at = time.monotonic() + GAP
        pending = []
        shot = None
        done = None
        while True:
            now = time.monotonic()
            if shot:
                if os.path.exists(f'{shot}.done') or os.path.exists(f'{shot}.skip'):
                    shot = None
                    at = now
            elif pending and now >= at:
                os.write(master, pending.pop(0).encode())
                at = now + GAP
            elif steps and now >= at:
                step = steps.pop(0)
                if step.startswith('shot:'):
                    os.makedirs(shots, exist_ok=True)
                    shot = os.path.join(shots, step[5:])
                    open(f'{shot}.req', 'w').close()
                else:
                    try:
                        at = now + float(step)
                    except ValueError:
                        pending = keys(step)
            elif not steps and not pending and not shot and done is None:
                done = now
            if done is not None and now - done > LINGER:
                os.kill(pid, signal.SIGTERM)
                done = now
            readable, _, _ = select.select([master, term], [], [], 0.02)
            if master in readable:
                try:
                    data = os.read(master, 65536)
                except OSError:
                    data = b''
                if data:
                    os.write(term, data)
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
    return status or 0


sys.exit(main())
