import type { ServerResponse } from 'node:http'

interface UpdateMessage {
  readonly data: unknown
  readonly event: string
}

export class UpdateHub {
  readonly #clients = new Set<ServerResponse>()

  add(response: ServerResponse): () => void {
    this.#clients.add(response)
    response.write(': connected\n\n')
    return () => {
      this.#clients.delete(response)
    }
  }

  publish(message: UpdateMessage): void {
    const payload = `event: ${message.event}\ndata: ${JSON.stringify(message.data)}\n\n`
    for (const client of this.#clients) client.write(payload)
  }

  close(): void {
    for (const client of this.#clients) client.end()
    this.#clients.clear()
  }
}
