import { type AddressInfo, connect, createServer, type Server, type Socket } from 'node:net'

const SPLIT = 20
const HANDSHAKE = 0x16

export interface Tunnel {
  port: number
  close(): void
}

function joined(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

export function reframe(record: Uint8Array, at = SPLIT): Uint8Array[] {
  const body = record.subarray(5)
  if (record[0] !== HANDSHAKE || body.length < 2) {
    return [record]
  }
  const cut = Math.max(1, Math.min(at, body.length - 1))
  const framed = (part: Uint8Array) =>
    joined([
      Uint8Array.from([
        record[0] as number,
        record[1] as number,
        record[2] as number,
        part.length >> 8,
        part.length & 0xff,
      ]),
      part,
    ])
  return [framed(body.subarray(0, cut)), framed(body.subarray(cut))]
}

function tunnelTo(client: Socket, host: string, port: number, rest: Uint8Array): void {
  const upstream = connect(port, host, () => {
    upstream.setNoDelay(true)
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    let held = rest
    let framed = false
    const forward = (chunk: Uint8Array) => {
      if (framed) {
        upstream.write(chunk)
        return
      }
      held = joined([held, chunk])
      if (held.length < 5) {
        return
      }
      const length = (held[3] as number) * 256 + (held[4] as number)
      if (held[0] !== HANDSHAKE) {
        framed = true
        upstream.write(held)
        return
      }
      if (held.length < 5 + length) {
        return
      }
      framed = true
      const [first, second] = reframe(held.subarray(0, 5 + length))
      upstream.write(first as Uint8Array)
      setTimeout(() => {
        if (second) {
          upstream.write(second)
        }
        upstream.write(held.subarray(5 + length))
      }, 10)
    }
    client.on('data', forward)
    if (held.length > 0) {
      const pending = held
      held = new Uint8Array(0)
      forward(pending)
    }
    upstream.pipe(client)
  })
  upstream.on('error', () => client.destroy())
  upstream.on('close', () => client.destroy())
  client.on('error', () => upstream.destroy())
  client.on('close', () => upstream.destroy())
}

function serve(client: Socket): void {
  client.setNoDelay(true)
  let head = new Uint8Array(0)
  const onData = (chunk: Uint8Array) => {
    head = joined([head, chunk])
    const text = Buffer.from(head).toString('latin1')
    const end = text.indexOf('\r\n\r\n')
    if (end === -1) {
      return
    }
    client.off('data', onData)
    const target = /^CONNECT ([^ :]+):(\d+)/.exec(text)
    if (!target) {
      client.end('HTTP/1.1 405 Method Not Allowed\r\n\r\n')
      return
    }
    tunnelTo(client, target[1] as string, Number(target[2]), head.subarray(end + 4))
  }
  client.on('data', onData)
  client.on('error', () => client.destroy())
}

export function tunnel(): Promise<Tunnel> {
  const server: Server = createServer(serve)
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: (server.address() as AddressInfo).port,
        close: () => {
          server.close()
          server.unref()
        },
      })
    })
  })
}
