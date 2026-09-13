/*
Gemini AI Chat - lib
Base : https://gemini.google.com
Feature :
  - Chat & multi-turn conversation (chatId/metadata based)
  - Web search (native, handled by Gemini itself)
  - Nano Banana text-to-image & image-to-image (image edit)
  - Vision (image) + vision (file)

Cara pakai cookie:
  Ambil cookie pakai extension "J2TEAM Cookies" pas lagi login di gemini.google.com,
  export ke file, taruh sebagai cookies.json di root project (format J2TEAM: { cookies: [{name,value}, ...] })

Developer asli: ZennzXD
Dirapikan jadi module lib/gemini.js
*/

import https from 'https'
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'

const agent = new https.Agent({ keepAlive: true })

const randomUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0
  return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
})

function syncCookies(jar, setCookies = []) {
  const list = Array.isArray(setCookies) ? setCookies : [setCookies]
  for (const item of list) {
    const pair = item.split(';')[0].split('=')
    if (pair.length >= 2) jar[pair[0].trim()] = pair.slice(1).join('=').trim()
  }
}

const buildCookieString = jar => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')

function cleanText(text) {
  if (!text) return ''
  return text
    .replace(/https?:\/\/[a-z0-9.-]*googleusercontent\.com\/[^\s\n"<>]+/gi, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .trim()
}

function request(url, { method = 'GET', headers = {}, body = null, stream = false } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: body ? { ...headers, 'content-length': Buffer.byteLength(body) } : headers,
      agent,
      maxHeaderSize: 1048576
    }, res => {
      if (stream) return resolve({ res, headers: res.headers })
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ text: Buffer.concat(chunks).toString(), headers: res.headers }))
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

function download(url, cookieStr = null, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 5) return reject(new Error('Too many redirects'))
    const safeUrl = url.startsWith('http:') ? url.replace('http:', 'https:') : url
    const u = new URL(safeUrl)
    const headers = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    if (cookieStr) headers['cookie'] = cookieStr
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers, maxHeaderSize: 1048576, agent }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume()
        return download(res.headers.location, cookieStr, hops + 1).then(resolve).catch(reject)
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    }).on('error', reject)
  })
}

function parseFrames(buffer) {
  const frames = []
  let remaining = buffer
  if (remaining.startsWith(")]}'")) remaining = remaining.substring(4).trimStart()
  while (true) {
    const nl = remaining.indexOf('\n')
    if (nl === -1) break
    const size = parseInt(remaining.substring(0, nl).trim(), 10)
    if (isNaN(size)) { remaining = remaining.substring(nl + 1); continue }
    if (remaining.length < nl + size) break
    const framePayload = remaining.substring(nl, nl + size)
    remaining = remaining.substring(nl + size)
    try {
      const frameData = JSON.parse(framePayload)
      for (const item of (Array.isArray(frameData) ? frameData : [frameData])) {
        if (!item?.[2]) continue
        try { frames.push(JSON.parse(item[2])) } catch (_) {}
      }
    } catch (_) {}
  }
  return { frames, remaining }
}

/**
 * Mulai session baru (ambil cookie + token dari halaman gemini.google.com/app)
 * @param {string|null} cookieStr - optional cookie string mentah, kalau kosong baca dari cookies.json
 */
async function startSession(cookieStr = null) {
  const cookies = {}
  if (!cookieStr) {
    try {
      if (fs.existsSync('cookies.json')) {
        const cookieData = JSON.parse(fs.readFileSync('cookies.json', 'utf8'))
        if (cookieData?.cookies) cookieData.cookies.forEach(c => cookies[c.name] = c.value)
      }
    } catch (err) { console.error('Failed to load cookies.json:', err.message) }
  } else {
    for (const pair of cookieStr.split(';')) {
      const idx = pair.indexOf('=')
      if (idx > 0) cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim()
    }
  }

  const pageRes = await request('https://gemini.google.com/app', {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...(Object.keys(cookies).length > 0 ? { cookie: buildCookieString(cookies) } : {})
    }
  })
  syncCookies(cookies, pageRes.headers['set-cookie'])

  const buildLabel = pageRes.text.match(/"cfb2h":\s*"(.*?)"/)?.[1] ?? 'boq_assistant-bard-web-server_20260709.09_p0'
  const atToken = pageRes.text.match(/"SNlM0e":"([^"]+)"/)?.[1] ?? null
  const fSid = pageRes.text.match(/"FdrFJe":"(-?\d+)"/)?.[1] ?? null

  if (!atToken) throw new Error('Gagal ambil at-token. Cookie kemungkinan sudah expired, export ulang cookies.json.')

  const batchRes = await request('https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&hl=en-US&_reqid=1&rt=c', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', cookie: buildCookieString(cookies) },
    body: 'f.req=[[["maGuAc","[0]",null,"generic"]]]&'
  })
  syncCookies(cookies, batchRes.headers['set-cookie'])

  return {
    cookies,
    buildLabel,
    sessionId: Array.from({ length: 19 }, () => Math.floor(Math.random() * 10)).join(''),
    atToken,
    fSid,
    reqId: Math.floor(Math.random() * 90000) + 10000
  }
}

function buildStreamRequest(prompt, metadata, auth, imageParam = null) {
  const traceId = randomUUID().toUpperCase()
  const qp = new URLSearchParams({ hl: 'en-US', _reqid: String(auth.reqId), rt: 'c', pageId: 'none' })
  if (auth.buildLabel) qp.set('bl', auth.buildLabel)
  qp.set('f.sid', auth.fSid || auth.sessionId)

  const p = new Array(97).fill(null)
  p[0] = [prompt, 0, null, imageParam, null, null, 0]
  p[1] = ['en-US']
  p[2] = metadata
  p[6] = [1]; p[7] = 1; p[10] = 1; p[11] = 0
  p[17] = [[0]]; p[18] = 0; p[27] = 1; p[30] = [4]
  p[41] = [1]; p[49] = 14; p[53] = 0; p[59] = traceId
  p[61] = []; if (imageParam) p[67] = 0
  p[68] = 2; p[79] = 6; p[80] = 1; p[91] = 0; p[96] = 0

  const body = new URLSearchParams({ 'f.req': JSON.stringify([null, JSON.stringify(p)]) })
  if (auth.atToken) body.set('at', auth.atToken)

  return {
    url: `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?${qp}`,
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'x-goog-ext-525001261-jspb': `[1,null,null,null,null,null,null,0,[4,5,6,8,4,5,6,8],null,null,2,null,null,6,1,"${traceId}"]`,
      'x-goog-ext-525005358-jspb': `["${traceId}",1]`,
      'x-goog-ext-73010989-jspb': '[0]',
      'x-goog-ext-73010990-jspb': '[0,0,0]',
      'x-same-domain': '1',
      'origin': 'https://gemini.google.com',
      'referer': 'https://gemini.google.com/',
      cookie: buildCookieString(auth.cookies)
    },
    body: body.toString()
  }
}

/**
 * Susun pesan error yang jelas kalau balasan Gemini kosong, biar gampang di-debug.
 */
function diagnoseEmptyResponse(statusCode, fullRaw, frameCount) {
  if (statusCode && statusCode !== 200) {
    return new Error(`Gemini balas status ${statusCode}. Cookie kemungkinan sudah expired/invalid, coba export ulang cookies.json.`)
  }
  if (/accounts\.google\.com|<html|sign in|ServiceLogin/i.test(fullRaw.slice(0, 500))) {
    return new Error('Gemini minta login ulang (dapet halaman HTML, bukan data chat). Cookie di cookies.json sudah expired, export ulang.')
  }

  let logPath = null
  try {
    logPath = path.join(process.cwd(), `gemini-debug-${Date.now()}.log`)
    fs.writeFileSync(logPath, fullRaw, 'utf8')
  } catch (_) {}

  const logHint = logPath ? ` Respon mentah lengkap disimpan di: ${logPath}` : ''

  if (frameCount === 0) {
    return new Error(`Tidak ada data yang kebaca dari respon Gemini (0 frame). Kemungkinan cookie invalid, kena rate limit, atau format response Google berubah.${logHint}`)
  }
  const snippet = fullRaw.replace(/\s+/g, ' ').slice(0, 300)
  return new Error(`Respon diterima (${frameCount} frame) tapi teksnya kosong. Kemungkinan diblokir/rate limited oleh Google, atau ada perubahan format respon.${logHint} Cuplikan: ${snippet}`)
}

/**
 * Chat teks biasa (mendukung web search otomatis dari sisi Gemini)
 * @param {string} prompt
 * @param {object|null} auth - hasil dari startSession(), kalau null bakal bikin session baru
 * @param {string|array|null} chatId - metadata percakapan sebelumnya, buat lanjut chat
 * @param {function|null} onChunk - callback streaming per potongan teks
 */
async function chat(prompt, auth = null, chatId = null, onChunk = null) {
  auth = auth || await startSession()
  auth.reqId = (auth.reqId || 10000) + 100000

  let metadata = ['', '', '', null, null, null, null, null, null, '']
  if (chatId) try { metadata = typeof chatId === 'string' ? JSON.parse(chatId) : chatId } catch (_) {}

  const req = buildStreamRequest(prompt, metadata, auth)
  const { res, headers: resHeaders } = await request(req.url, { method: 'POST', headers: req.headers, body: req.body, stream: true })
  syncCookies(auth.cookies, resHeaders['set-cookie'])

  return new Promise((resolve, reject) => {
    let accumulatedText = '', lastSentText = '', buf = '', updatedMetadata = metadata
    let fullRaw = '', frameCount = 0

    res.on('data', chunk => {
      try {
        const s = chunk.toString('utf8')
        fullRaw += s
        buf += s
        const { frames, remaining } = parseFrames(buf)
        buf = remaining
        frameCount += frames.length
        for (const pj of frames) {
          if (pj?.[1]) updatedMetadata = pj[1]
          if (typeof pj?.[25] === 'string') updatedMetadata[9] = pj[25]
          for (const cand of (pj?.[4] || [])) {
            const cleaned = cleanText(cand?.[1]?.[0] || '')
            if (cleaned) {
              accumulatedText = cleaned
              const delta = cleaned.substring(lastSentText.length)
              if (delta && onChunk) { onChunk(delta); lastSentText = cleaned }
            }
          }
        }
      } catch (err) { reject(err) }
    })

    res.on('end', () => {
      if (!accumulatedText) {
        return reject(diagnoseEmptyResponse(res.statusCode, fullRaw, frameCount))
      }
      const delta = accumulatedText.substring(lastSentText.length)
      if (delta && onChunk) onChunk(delta)
      resolve({ reply: accumulatedText, chatId: updatedMetadata, auth })
    })
    res.on('error', reject)
  })
}

const uploadHeaders = (extra = {}) => ({
  'x-goog-upload-protocol': 'resumable',
  'x-goog-upload-command': 'start',
  'push-id': 'feeds/mcudyrk2a4khkz',
  'x-client-pctx': 'CgcSBWjK7pYx',
  'x-tenant-id': 'bard-storage',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'origin': 'https://gemini.google.com',
  'referer': 'https://gemini.google.com/',
  'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
  ...extra
})

async function uploadImage(filePath) {
  const fileData = fs.readFileSync(filePath)
  const ext = filePath.split('.').pop().toLowerCase()
  const hashedName = `${crypto.createHash('md5').update(fileData).digest('hex')}.${ext === 'jpeg' ? 'jpg' : ext}`

  const startRes = await request('https://push.clients6.google.com/upload/', {
    method: 'POST',
    headers: uploadHeaders({ 'x-goog-upload-header-content-length': String(fileData.length) }),
    body: `File name: ${hashedName}`
  })

  const uploadRes = await request(startRes.headers['x-goog-upload-url'], {
    method: 'POST',
    headers: { ...uploadHeaders(), 'x-goog-upload-command': 'upload, finalize', 'x-goog-upload-offset': '0', 'content-length': String(fileData.length) },
    body: fileData
  })
  return uploadRes.text.trim()
}

async function uploadImageFull(filePath, auth) {
  const fileData = fs.readFileSync(filePath)
  const ext = filePath.split('.').pop().toLowerCase()
  const mimeType = ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' })[ext] || 'image/jpeg'
  const hashedName = `${crypto.createHash('md5').update(fileData).digest('hex')}.${ext === 'jpeg' ? 'jpg' : ext}`
  const cookieStr = buildCookieString(auth.cookies)

  const startRes = await request('https://push.clients6.google.com/upload/', {
    method: 'POST',
    headers: uploadHeaders({ 'x-goog-upload-header-content-length': String(fileData.length), cookie: cookieStr }),
    body: `File name: ${hashedName}`
  })
  const uploadUrl = startRes.headers['x-goog-upload-url']
  if (!uploadUrl) throw new Error('Upload failed: no upload URL returned')

  const uploadRes = await request(uploadUrl, {
    method: 'POST',
    headers: { ...uploadHeaders(), 'x-goog-upload-command': 'upload, finalize', 'x-goog-upload-offset': '0', 'content-length': String(fileData.length), cookie: cookieStr },
    body: fileData
  })
  const contribPath = uploadRes.text.trim()
  if (!contribPath.startsWith('/contrib_service/')) throw new Error(`Upload finalize failed: ${contribPath.substring(0, 100)}`)

  const traceId = randomUUID().toUpperCase()
  const qp = new URLSearchParams({ _reqid: String((auth.reqId || 10000) + 1000), rt: 'c', hl: 'en-US' })
  if (auth.buildLabel) qp.set('bl', auth.buildLabel)
  qp.set('f.sid', auth.fSid || auth.sessionId)

  const processPayload = [[[contribPath, null, 1, mimeType], hashedName, null, null, null, null, null, null, [0]], null, 1, ['en-US']]
  const processBody = new URLSearchParams({ 'f.req': JSON.stringify([null, JSON.stringify(processPayload)]) })
  if (auth.atToken) processBody.set('at', auth.atToken)

  const processRes = await request(
    `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/ProcessFile?${qp}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'x-goog-ext-525001261-jspb': `[1,null,null,null,null,null,null,null,[4,5,6,8],null,null,null,null,null,6,1,"${traceId}"]`,
        'x-same-domain': '1', 'origin': 'https://gemini.google.com', 'referer': 'https://gemini.google.com/', cookie: cookieStr
      },
      body: processBody.toString()
    }
  )

  let fileUUID = null
  for (const line of processRes.text.split('\n')) {
    if (!line.trim() || /^\d+$/.test(line.trim())) continue
    try {
      for (const item of JSON.parse(line.trim())) {
        if (!item?.[2]) continue
        const inner = JSON.parse(item[2])
        if (Array.isArray(inner?.[3]) && inner[3][0]) { fileUUID = inner[3][0]; break }
      }
    } catch (_) {}
    if (fileUUID) break
  }

  return { contribPath, fileUUID, hashedName, mimeType }
}

function extractImageUrl(frames, fullRawText) {
  for (const pj of frames) {
    try {
      for (const g of (pj?.[26] || [])) for (const g2 of (g || [])) for (const g3 of (g2 || [])) {
        for (const img of (g3?.[9] || [])) {
          const url = img?.[0]?.[0]?.[3]?.[3]
          if (url?.includes('googleusercontent.com/gg-dl/')) return url
        }
      }
    } catch (_) {}
    try {
      for (const cand of (pj?.[4] || [])) for (const img of (cand?.[12]?.[0] || [])) {
        const url = img?.[0]?.[0]?.[3]?.[3]
        if (url?.includes('googleusercontent.com/gg-dl/')) return url
      }
    } catch (_) {}
  }
  return fullRawText.match(/https?:\/\/[a-z0-9.-]*googleusercontent\.com\/(?:rd-)?gg-dl\/[^\s\n"<>'\\]+/i)?.[0] ?? null
}

/**
 * Text-to-image pakai Nano Banana (Gemini native image gen)
 */
async function generateImage(prompt, auth = null, chatId = null, outputPath = 'output.png') {
  auth = auth || await startSession()
  auth.reqId = (auth.reqId || 10000) + 100000

  let metadata = ['', '', '', null, null, null, null, null, null, '']
  if (chatId) try { metadata = typeof chatId === 'string' ? JSON.parse(chatId) : chatId } catch (_) {}

  const req = buildStreamRequest(prompt, metadata, auth)
  const { res, headers: resHeaders } = await request(req.url, { method: 'POST', headers: req.headers, body: req.body, stream: true })
  syncCookies(auth.cookies, resHeaders['set-cookie'])

  return new Promise((resolve, reject) => {
    let rawText = '', fullRawText = '', buf = '', updatedMetadata = metadata
    const allFrames = []

    res.on('data', chunk => {
      try {
        const s = chunk.toString('utf8')
        fullRawText += s; buf += s
        const { frames, remaining } = parseFrames(buf)
        buf = remaining; allFrames.push(...frames)
        for (const pj of frames) {
          if (pj?.[1]) updatedMetadata = pj[1]
          if (typeof pj?.[25] === 'string') updatedMetadata[9] = pj[25]
          for (const cand of (pj?.[4] || [])) { const raw = cand?.[1]?.[0] || ''; if (raw) rawText += raw }
        }
      } catch (err) { reject(err) }
    })

    res.on('end', async () => {
      try {
        const imageUrl = extractImageUrl(allFrames, fullRawText)
        if (!imageUrl) return resolve({ imageUrl: null, reply: cleanText(rawText), chatId: updatedMetadata, auth })
        const imgBuf = await download(imageUrl, buildCookieString(auth.cookies))
        fs.writeFileSync(outputPath, imgBuf)
        resolve({ imageUrl, savedTo: outputPath, chatId: updatedMetadata, auth })
      } catch (err) { reject(err) }
    })
    res.on('error', reject)
  })
}

/**
 * Image-to-image (edit gambar) pakai Nano Banana
 */
async function generateImageToImage(prompt, imagePath, auth = null, chatId = null, outputPath = 'output_img2img.png') {
  auth = auth || await startSession()
  auth.reqId = (auth.reqId || 10000) + 100000

  const { contribPath, fileUUID, hashedName, mimeType } = await uploadImageFull(imagePath, auth)
  const imageParam = [[[contribPath, 1, null, mimeType, fileUUID], hashedName, null, null, null, null, null, null, [0]]]

  let metadata = ['', '', '', null, null, null, null, null, null, '']
  if (chatId) try { metadata = typeof chatId === 'string' ? JSON.parse(chatId) : chatId } catch (_) {}

  const req = buildStreamRequest(prompt, metadata, auth, imageParam)
  const { res, headers: resHeaders } = await request(req.url, { method: 'POST', headers: req.headers, body: req.body, stream: true })
  syncCookies(auth.cookies, resHeaders['set-cookie'])

  return new Promise((resolve, reject) => {
    let rawText = '', fullRawText = '', buf = '', updatedMetadata = metadata
    const allFrames = []

    res.on('data', chunk => {
      try {
        const s = chunk.toString('utf8')
        fullRawText += s; buf += s
        const { frames, remaining } = parseFrames(buf)
        buf = remaining; allFrames.push(...frames)
        for (const pj of frames) {
          if (pj?.[1]) updatedMetadata = pj[1]
          if (typeof pj?.[25] === 'string') updatedMetadata[9] = pj[25]
          for (const cand of (pj?.[4] || [])) { const raw = cand?.[1]?.[0] || ''; if (raw) rawText += raw }
        }
      } catch (err) { reject(err) }
    })

    res.on('end', async () => {
      try {
        const imageUrl = extractImageUrl(allFrames, fullRawText)
        if (!imageUrl) return resolve({ imageUrl: null, reply: cleanText(rawText), chatId: updatedMetadata, auth })
        const imgBuf = await download(imageUrl, buildCookieString(auth.cookies))
        fs.writeFileSync(outputPath, imgBuf)
        resolve({ imageUrl, savedTo: outputPath, chatId: updatedMetadata, auth })
      } catch (err) { reject(err) }
    })
    res.on('error', reject)
  })
}

/**
 * Vision: kirim gambar + prompt teks
 */
async function vision(imagePath, prompt, auth = null, chatId = null) {
  auth = auth || await startSession()
  auth.reqId = (auth.reqId || 10000) + 100000

  const contribPath = await uploadImage(imagePath)
  const imageParam = [[[contribPath, 1], imagePath.split('/').pop()]]

  let metadata = ['', '', '', null, null, null, null, null, null, '']
  if (chatId) try { metadata = typeof chatId === 'string' ? JSON.parse(chatId) : chatId } catch (_) {}

  const req = buildStreamRequest(prompt, metadata, auth, imageParam)
  const { res, headers: resHeaders } = await request(req.url, { method: 'POST', headers: req.headers, body: req.body, stream: true })
  syncCookies(auth.cookies, resHeaders['set-cookie'])

  return new Promise((resolve, reject) => {
    let rawText = '', buf = '', updatedMetadata = metadata

    res.on('data', chunk => {
      try {
        buf += chunk.toString('utf8')
        const { frames, remaining } = parseFrames(buf)
        buf = remaining
        for (const pj of frames) {
          if (pj?.[1]) updatedMetadata = pj[1]
          if (typeof pj?.[25] === 'string') updatedMetadata[9] = pj[25]
          for (const cand of (pj?.[4] || [])) { const raw = cand?.[1]?.[0] || ''; if (raw) rawText += raw }
        }
      } catch (err) { reject(err) }
    })

    res.on('end', () => resolve({ reply: cleanText(rawText), chatId: updatedMetadata, auth }))
    res.on('error', reject)
  })
}

/**
 * Vision file: sama seperti vision() tapi buat file non-gambar (dokumen, kode, dll)
 */
async function visionFile(filePath, prompt, auth = null, chatId = null) {
  return vision(filePath, prompt, auth, chatId)
}

let cachedAuth = null
let cachedAt = 0
const SESSION_TTL_MS = 25 * 60 * 1000

async function getAuth() {
  const now = Date.now()
  if (cachedAuth && (now - cachedAt) < SESSION_TTL_MS) return cachedAuth
  cachedAuth = await startSession()
  cachedAt = now
  return cachedAuth
}

function resetAuth() {
  cachedAuth = null
  cachedAt = 0
}

export {
  startSession,
  chat,
  generateImage,
  generateImageToImage,
  vision,
  visionFile,
  buildCookieString,
  uploadImage,
  uploadImageFull,
  getAuth,
  resetAuth
}

export default {
  startSession,
  chat,
  generateImage,
  generateImageToImage,
  vision,
  visionFile,
  buildCookieString,
  uploadImage,
  uploadImageFull,
  getAuth,
  resetAuth
}