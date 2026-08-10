import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000

async function createHandler() {
  const { default: entry } = await import('./dist/server/server.js')
  return entry.fetch.bind(entry)
}

createHandler().then((handler) => {
  const server = createServer(async (req, res) => {
    try {
      const response = await handler(req, {}, {})
      const headers: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        headers[key] = value
      })
      res.writeHead(response.status, headers)
      const body = await response.text()
      res.end(body)
    } catch (error) {
      console.error(error)
      res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' })
      res.end('<!doctype html><html><body><h1>Server Error</h1></body></html>')
    }
  })

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}).catch((error) => {
  console.error('Failed to load server entry:', error)
  process.exit(1)
})
