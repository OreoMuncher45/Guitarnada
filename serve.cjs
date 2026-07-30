const http = require('http')
const fs = require('fs')
const path = require('path')

const MIME = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const distDir = path.join(__dirname, 'dist')

http.createServer((req, res) => {
  let url = req.url.split('?')[0]
  let filePath = path.join(distDir, url === '/' ? 'index.html' : url)
  try {
    let content = fs.readFileSync(filePath)
    let ext = path.extname(filePath)
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    res.end(content)
  } catch (e) {
    // SPA fallback
    try {
      let content = fs.readFileSync(path.join(distDir, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(content)
    } catch (e2) {
      res.writeHead(404)
      res.end('Not found')
    }
  }
}).listen(8080, '0.0.0.0', () => {
  console.log('Guitarnada running at http://0.0.0.0:8080')
})
