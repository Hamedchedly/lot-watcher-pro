import 'dotenv/config'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
// Railway joint le conteneur via son réseau interne : on écoute sur toutes les interfaces.
const HOST = process.env.HOST || '0.0.0.0'

// The generated Start server entry exports a fetch(request, env, ctx) handler
// (an H3-compatible SSR entry). It must receive a standard Web `Request` with a
// full URL, not a raw Node IncomingMessage (which makes `new URL(req.url)` throw
// "Invalid URL"). This thin adapter bridges the Node HTTP server and the entry.
const { default: entry } = await import('./dist/server/server.js')

const server = createServer(async (req, res) => {
  try {
    const headers = {}
    for (const [key, value] of Object.entries(req.headers)) {
      headers[key] = Array.isArray(value) ? value.join(', ') : value
    }
    const url = `http://localhost:${PORT}${req.url || '/'}`
    const init = { method: req.method || 'GET', headers: new Headers(headers) }
    // Node IncomingMessage is a readable stream usable as a Request body
    if (req.method && !['GET', 'HEAD'].includes(req.method)) {
      init.body = req
    }
    const request = new Request(url, init)
    const response = await entry.fetch(request, process.env, { req, res })

    const outHeaders = {}
    response.headers.forEach((value, key) => {
      outHeaders[key] = value
    })
    res.writeHead(response.status, outHeaders)
    const body = await response.text()
    res.end(body)
  } catch (error) {
    console.error(error)
    res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' })
    res.end('<!doctype html><html><body><h1>Server Error</h1></body></html>')
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`)
})
