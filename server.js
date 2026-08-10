import 'dotenv/config'
import { createServer } from 'node:http'
import { stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
// Railway joint le conteneur via son réseau interne : on écoute sur toutes les interfaces.
const HOST = process.env.HOST || '0.0.0.0'

// Racine des fichiers statiques générés côté client par le build Vite.
const CLIENT_DIR = path.join(__dirname, 'dist', 'client')

// Cartographie extension -> Content-Type (CSS, JS, images, SVG, fonts, etc.).
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
}

function getMimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
}

/**
 * Résout un chemin de requête vers un fichier strictement situé dans dist/client.
 *
 * Sécurité :
 *  - rejette les segments de remontée ('..', '.') AVANT toute normalisation d'URL ;
 *  - rejette les backslashes (contournement Windows potentiel) ;
 *  - vérifie ensuite que le chemin résolu reste dans dist/client (donc jamais dist/server).
 *
 * Retourne null si le chemin n'est pas sûr ou ne peut pas être décodé.
 */
function resolveClientPath(rawUrl) {
  try {
    const rawPath = rawUrl.split('?')[0].split('#')[0]
    if (rawPath.includes('\\')) return null
    // Remontée de répertoire, y compris encodée, détectée avant normalisation.
    if (/(^|\/)\.{1,2}(\/|$)/.test(rawPath)) return null

    const decoded = decodeURIComponent(rawPath)
    if (/(^|\/)\.{1,2}(\/|$)/.test(decoded)) return null

    const segments = decoded.split('/').filter(Boolean)
    const filePath = path.join(CLIENT_DIR, ...segments)

    const relative = path.relative(CLIENT_DIR, filePath)
    if (relative.startsWith('..') || path.isAbsolute(relative)) return null

    return filePath
  } catch {
    // URL encodée invalide -> on ne sert aucun fichier.
    return null
  }
}

// The generated Start server entry exports a fetch(request, env, ctx) handler
// (an H3-compatible SSR entry). It must receive a standard Web `Request` with a
// full URL, not a raw Node IncomingMessage (which makes `new URL(req.url)` throw
// "Invalid URL"). This thin adapter bridges the Node HTTP server and the entry.
const { default: entry } = await import('./dist/server/server.js')

/**
 * Sert un fichier statique de dist/client si la requête y correspond.
 * Retourne false si la requête doit continuer vers le SSR TanStack Start.
 */
async function serveStatic(req, res, rawUrl) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false

  const filePath = resolveClientPath(rawUrl)
  if (!filePath) return false

  let fileStat
  try {
    fileStat = await stat(filePath)
  } catch {
    // Fichier inexistant -> la requête passe au SSR (routes dynamiques, API…).
    return false
  }
  if (!fileStat.isFile()) return false

  const pathname = rawUrl.split('?')[0].split('#')[0]
  const isFingerprinted = pathname.startsWith('/assets/')
  const cacheControl = isFingerprinted
    ? 'public, max-age=31536000, immutable'
    : 'no-cache'
  const lastModified = fileStat.mtime.toUTCString()

  // GET conditionnel (If-Modified-Since) -> 304 sans corps.
  const ifModifiedSince = req.headers['if-modified-since']
  if (ifModifiedSince) {
    const ims = new Date(ifModifiedSince).getTime()
    if (!Number.isNaN(ims) && ims >= Math.floor(fileStat.mtimeMs / 1000) * 1000) {
      res.writeHead(304, {
        'last-modified': lastModified,
        'cache-control': cacheControl,
      })
      res.end()
      return true
    }
  }

  res.writeHead(200, {
    'content-type': getMimeType(filePath),
    'content-length': String(fileStat.size),
    'last-modified': lastModified,
    'cache-control': cacheControl,
  })
  if (req.method === 'HEAD') {
    res.end()
    return true
  }
  const stream = createReadStream(filePath)
  stream.on('error', (error) => {
    console.error(error)
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' })
    }
    res.end()
  })
  stream.pipe(res)
  return true
}

const server = createServer(async (req, res) => {
  try {
    const rawUrl = req.url || '/'

    // Endpoint de santé Railway : GET /health -> 200 {"status":"ok"}
    if ((req.method === 'GET' || req.method === 'HEAD') && rawUrl.split('?')[0] === '/health') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      res.end('{"status":"ok"}')
      return
    }

    // Fichiers statiques de dist/client : assets fingerprintés, favicon, robots.txt…
    if (await serveStatic(req, res, rawUrl)) return

    const headers = {}
    for (const [key, value] of Object.entries(req.headers)) {
      headers[key] = Array.isArray(value) ? value.join(', ') : value
    }
    const url = `http://localhost:${PORT}${req.url || '/'}`
    const init = { method: req.method || 'GET', headers: new Headers(headers) }
    // Node IncomingMessage is a readable stream usable as a Request body.
    // Node (>= 18, dont node:22-alpine dans le Docker) exige `duplex: 'half'`
    // dès qu'un stream est utilisé comme body d'un Web Request, sinon il lève :
    //   TypeError: RequestInit: duplex option is required when sending a body.
    // C'est ce qui cassait les POST des Server Functions TanStack Start.
    if (req.method && !['GET', 'HEAD'].includes(req.method)) {
      init.body = req
      init.duplex = 'half'
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
    // Log explicite sans secret : message, nom et stack uniquement.
    // Aucune variable d'environnement, aucun contenu de body/upload,
    // aucune donnée utilisateur.
    console.error('[server] Request handling error:', {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' })
    res.end('<!doctype html><html><body><h1>Server Error</h1></body></html>')
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`)
})
