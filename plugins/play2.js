// plugins/play2.js
// YTMusic Search + LRCLIB Synced Lyrics + Savetube + WebSocket MSE Streamer

'use strict';

import { createDecipheriv } from 'crypto';
import yts from 'yt-search';
import YTMusic from 'ytmusic-api';
import sharp from 'sharp';
import { AIRich } from '../messagebuilder.js'; // Sesuaikan path ini dengan bot lu

/* =========================================================
 * CONFIG
 * ========================================================= */

const METADATA_DECRYPTION_KEY = Buffer.from('C5D58EF67A7584E4A29F6C35BBC4EB12', 'hex');

const HEADERS = {
    'Content-Type': 'application/json',
    'Origin': 'https://yt.savetube.me',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'
};

/* =========================================================
 * LRCLIB & LRC PARSER (TETAP SAMA)
 * ========================================================= */

const LRCLIB_API = 'https://lrclib.net/api';
const LRCLIB_USER_AGENT = 'AnyaMD-Play2/1.0 (https://github.com/)';

async function getLRCLyrics({ title, artist, duration = 0, album = '' }) {
    try {
        if (!title) return null;

        // percobaan 1: strict match kalau artist valid
        if (artist && artist !== 'Unknown Artist') {
            const params = new URLSearchParams({ track_name: String(title).trim(), artist_name: String(artist).trim() });
            if (album) params.set('album_name', String(album).trim());
            const dur = Number(duration);
            if (Number.isFinite(dur) && dur >= 1 && dur <= 3600) params.set('duration', String(Math.round(dur)));

            const res = await fetch(`${LRCLIB_API}/get?${params.toString()}`, { headers: { Accept: 'application/json', 'User-Agent': LRCLIB_USER_AGENT } });
            if (res.ok) {
                const data = await res.json();
                if (data) {
                    return {
                        trackName: data.trackName || title,
                        artistName: data.artistName || artist,
                        duration: Number(data.duration || duration || 0),
                        plainLyrics: data.plainLyrics || '',
                        syncedLyrics: data.syncedLyrics || ''
                    };
                }
            }
        }

        // percobaan 2: fallback fuzzy search
        const q = artist && artist !== 'Unknown Artist' ? `${title} ${artist}` : title;
        const searchRes = await fetch(`${LRCLIB_API}/search?q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json', 'User-Agent': LRCLIB_USER_AGENT } });
        if (!searchRes.ok) return null;
        const list = await searchRes.json();
        if (!Array.isArray(list) || !list.length) return null;
        const best = list[0];
        return {
            trackName: best.trackName || title,
            artistName: best.artistName || artist,
            duration: Number(best.duration || duration || 0),
            plainLyrics: best.plainLyrics || '',
            syncedLyrics: best.syncedLyrics || ''
        };
    } catch { return null; }
}

function parseLrcTimestamp(match) {
    if (!match) return null;
    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    const fractionText = match[3] || '';
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    let milliseconds = 0;
    if (fractionText) {
        milliseconds = fractionText.length === 1 ? Number(fractionText) * 100 : fractionText.length === 2 ? Number(fractionText) * 10 : Number(fractionText.slice(0, 3));
    }
    return minutes * 60 + seconds + milliseconds / 1000;
}

function parseSyncedLyrics(lrc = '') {
    if (!lrc) return [];
    const result = [];
    const lines = lrc.split(/\r?\n/);
    const timestampRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    for (const rawLine of lines) {
        const matches = [...rawLine.matchAll(timestampRegex)];
        if (!matches.length) continue;
        const text = rawLine.replace(timestampRegex, '').trim();
        if (!text) continue;
        for (const match of matches) {
            const time = parseLrcTimestamp(match);
            if (time !== null) result.push({ time, text });
        }
    }
    return result.sort((a, b) => a.time - b.time);
}

function plainLyricsToSynced(lyrics = '', duration = 0) {
    if (!lyrics) return [];
    const lines = lyrics.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const totalDuration = Number(duration);
    let interval = totalDuration > 0 && lines.length > 1 ? Math.max(2, Math.min(8, totalDuration / lines.length)) : 5;
    return lines.map((text, index) => ({ time: index * interval, text }));
}

function normalizeLyrics(lyrics = []) {
    if (!Array.isArray(lyrics)) return [];
    return lyrics.filter(item => Number.isFinite(Number(item.time)) && item.text)
                 .map(item => ({ time: Number(item.time), text: String(item.text).trim() }))
                 .sort((a, b) => a.time - b.time);
}

/* =========================================================
 * YT MUSIC & SAVETUBE
 * ========================================================= */

let ytMusicInstance = null;
async function getYTMusic() {
    if (!ytMusicInstance) {
        ytMusicInstance = new YTMusic();
        await ytMusicInstance.initialize();
    }
    return ytMusicInstance;
}

async function savetube(url, { downloadType = 'audio', quality = '128kbps' } = {}) {
    const idMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
    if (!idMatch) throw new Error('URL YouTube tidak valid');
    const videoId = idMatch[1];

    const cdnRes = await fetch('https://media.savetube.vip/api/random-cdn', { headers: HEADERS }).then(v => v.json()).catch(() => null);
    if (!cdnRes?.cdn) throw new Error('CDN tidak tersedia');
    
    const info = await fetch(`https://${cdnRes.cdn}/v2/info`, {
        method: 'POST', headers: HEADERS, body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}` })
    }).then(v => v.json()).catch(() => null);
    
    if (!info?.data) throw new Error('Metadata kosong');
    
    let metadata;
    try {
        const encrypted = Buffer.from(info.data, 'base64');
        const decipher = createDecipheriv('aes-128-cbc', METADATA_DECRYPTION_KEY, encrypted.subarray(0, 16));
        const decrypted = Buffer.concat([decipher.update(encrypted.subarray(16)), decipher.final()]);
        metadata = JSON.parse(decrypted.toString('utf8'));
    } catch { throw new Error('Decrypt metadata gagal'); }
    
    const dl = await fetch(`https://${cdnRes.cdn}/download`, {
        method: 'POST', headers: HEADERS, body: JSON.stringify({ id: videoId, downloadType, quality, key: metadata.key })
    }).then(v => v.json()).catch(() => null);
    
    if (!dl?.data?.downloadUrl) throw new Error('Download gagal');
    return { url: dl.data.downloadUrl };
}

async function savetubeRetry(url, opts, retry = 3) {
    let lastErr;
    for (let i = 0; i < retry; i++) {
        try { return await savetube(url, opts); } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 1000)); }
    }
    throw lastErr;
}

/* =========================================================
 * HELPERS
 * ========================================================= */

function escapeHtml(text = '') { return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function escapeAttr(text = '') { return escapeHtml(text); }
function formatDuration(seconds = 0) {
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
}

async function getThumb(url) {
    try {
        if (!url) return Buffer.alloc(0);
        const res = await fetch(url);
        const raw = Buffer.from(await res.arrayBuffer());
        return await sharp(raw).resize(250, 250, { fit: 'cover' }).jpeg({ quality: 50 }).toBuffer();
    } catch { return Buffer.alloc(0); }
}

/* =========================================================
 * HTML MUSIC PLAYER (UI ASLI + WEBSOCKET MSE)
 * ========================================================= */
function createMusicPlayer({ title, artist, duration, rawAudioUrl, imageSrc, lyrics }) {
  const safeTitle = escapeHtml(title);
  const safeArtist = escapeHtml(artist);
  const safeDuration = escapeHtml(duration || '0:00');
  const safeImage = imageSrc || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzFhMGQxMiIvPjx0ZXh0IHg9IjIwMCIgeT0iMjEwIiBmb250LXNpemU9IjM0IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+TUFJTiBQQ0xAYVlFUlI8L3RleHQ+PC9zdmc+';

  const lyricsJson = Buffer.from(
    JSON.stringify(Array.isArray(lyrics) ? lyrics : []),
    'utf8'
  ).toString('base64');

  // Akal-akalan buat fix durasi 0:00 di MSE Streaming
  const timeParts = safeDuration.split(':').map(Number);
  let totalSecs = 0;
  if (timeParts.length === 2) totalSecs = timeParts[0] * 60 + timeParts[1];
  else if (timeParts.length === 3) totalSecs = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
  if (!totalSecs) totalSecs = 200; // Fallback kalau gagal baca durasi

  return `
<style>
  :root { --ink: #ffffff; --muted: #b9b1b6; --sys: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { background: transparent; color: var(--ink); font-family: var(--sys); -webkit-font-smoothing: antialiased; }
  .wrap { display: flex; align-items: center; justify-content: center; padding: 10px; }
  .player { position: relative; width: 100%; max-width: 330px; border-radius: 18px; overflow: hidden; background: #1a0d12; box-shadow: 0 18px 40px rgba(0,0,0,.5); }
  .bg { position: absolute; inset: -30%; width: 160%; height: 160%; object-fit: cover; filter: blur(38px) saturate(1.5); opacity: .85; z-index: 0; }
  .veil { position: absolute; inset: 0; z-index: 1; background: linear-gradient(180deg, rgba(20,8,12,.65) 0%, rgba(20,8,12,.8) 45%, rgba(12,5,8,.96) 100%); }
  .content { position: relative; z-index: 2; padding: 16px 18px 18px; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
  .head__icon { width: 18px; height: 18px; color: var(--ink); opacity: .85; flex: none; }
  .head__mid { text-align: center; flex: 1; min-width: 0; }
  .head__from { font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
  .head__album { font-size: 12px; font-weight: 600; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .poster { width: 100%; aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: rgba(255,255,255,.06); box-shadow: 0 12px 26px rgba(0,0,0,.45); margin-bottom: 14px; }
  .poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .info { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
  .info__names { min-width: 0; }
  .info__title { font-size: 17px; font-weight: 600; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .info__artist { font-size: 12px; color: var(--muted); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .info__heart { width: 34px; height: 34px; flex: none; display: flex; align-items: center; justify-content: center; background: none; border: none; color: var(--muted); cursor: pointer; padding: 0; }
  .info__heart.is-on { color: #ff5c8a; }
  .mini-lyrics { position: relative; height: 82px; overflow-x: hidden; overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none; margin-bottom: 10px; overscroll-behavior: contain; scroll-behavior: auto; mask-image: linear-gradient(180deg, transparent 0%, black 18%, black 82%, transparent 100%); -webkit-mask-image: linear-gradient(180deg, transparent 0%, black 18%, black 82%, transparent 100%); }
  .mini-lyrics::-webkit-scrollbar { display: none; }
  .lyrics-text { width: 100%; padding: 32px 0; display: flex; flex-direction: column; gap: 5px; }
  .lyric-line { font-size: 10.5px; color: rgba(255,255,255,.4); line-height: 1.4; transition: color .25s ease, font-size .25s ease, opacity .25s ease, transform .25s ease; text-align: left; white-space: normal; word-wrap: break-word; overflow-wrap: anywhere; font-weight: 500; opacity: .75; transform: translateX(0) scale(1); transform-origin: left center; }
  .lyric-line.is-active { font-size: 12px; color: #fff; font-weight: 700; opacity: 1; transform: translateX(2px) scale(1.01); }
  .lyrics-empty { font-size: 10.5px; color: var(--muted); text-align: left; padding: 16px 0; }
  .bar { position: relative; height: 4px; border-radius: 4px; background: rgba(255,255,255,.22); cursor: pointer; margin-bottom: 6px; touch-action: none; }
  .bar__fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; border-radius: 4px; background: #fff; pointer-events: none; }
  .bar__dot { position: absolute; top: 50%; left: 0; width: 11px; height: 11px; border-radius: 50%; background: #fff; transform: translate(-50%,-50%); pointer-events: none; }
  .time { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); margin-bottom: 12px; font-variant-numeric: tabular-nums; }
  .controls { display: flex; align-items: center; justify-content: space-between; }
  .ctrl { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; color: var(--ink); background: none; border: none; cursor: pointer; padding: 0; transition: opacity .2s ease, transform .15s ease; }
  .ctrl:active { opacity: .6; transform: scale(.92); }
  .play { width: 52px; height: 52px; border-radius: 50%; background: #fff; color: #12070b; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex: none; padding: 0; box-shadow: 0 6px 16px rgba(0,0,0,.4); transition: transform .15s ease; }
  .play:active { transform: scale(.93); }
  .note { margin-top: 12px; text-align: center; font-size: 10px; color: var(--muted); line-height: 1.6; }
</style>

<div class="wrap">
  <div class="player">
    <img class="bg" src="${escapeAttr(safeImage)}" alt="">
    <div class="veil"></div>
    <div class="content">
      <div class="head">
        <svg class="head__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        <div class="head__mid">
          <div class="head__from" id="stream-status">Stream</div>
          <div class="head__album">${safeArtist}</div>
        </div>
        <svg class="head__icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
      </div>

      <div class="poster">
        <img src="${escapeAttr(safeImage)}" alt="${escapeAttr(safeTitle)}">
      </div>

      <div class="info">
        <div class="info__names">
          <div class="info__title">${safeTitle}</div>
          <div class="info__artist">${safeArtist}</div>
        </div>
        <button class="info__heart" id="heart" aria-label="Favorite">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M20.8 5.6 a5.1 5.1 0 0 0-7.2 0 L12 7.2 l-1.6-1.6 a5.1 5.1 0 0 0-7.2 7.2 l1.6 1.6 L12 21.6 l7.2-7.2 1.6-1.6 a5.1 5.1 0 0 0 0-7.2z"/></svg>
        </button>
      </div>

      <div class="mini-lyrics" id="mini-lyrics">
        <div class="lyrics-text" id="lyrics-text"></div>
      </div>

      <div class="bar" id="bar">
        <div class="bar__fill" id="fill"></div>
        <div class="bar__dot" id="dot"></div>
      </div>

      <div class="time">
        <span id="cur">0:00</span>
        <span id="dur">${safeDuration}</span>
      </div>

      <div class="controls">
        <button class="ctrl" style="opacity:.5; cursor:default;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </button>
        <button class="ctrl" id="btn-rw" aria-label="Mundur 10 detik">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><text x="12" y="16.5" font-size="7.5" font-family="sans-serif" font-weight="bold" stroke="none" fill="currentColor" text-anchor="middle">10</text></svg>
        </button>
        <button class="play" id="play" aria-label="Play">
          <svg id="icon-play" viewBox="0 0 24 24" fill="currentColor" width="26" height="26"><path d="M8 5.6 v12.8 a.6.6 0 0 0 .92.5 l10-6.4 a.6.6 0 0 0 0-1 l-10-6.4 a.6.6 0 0 0-.92.5z"/></svg>
          <svg id="icon-pause" viewBox="0 0 24 24" fill="currentColor" width="26" height="26" style="display:none"><rect x="6.5" y="5" width="3.8" height="14" rx="1"/><rect x="13.7" y="5" width="3.8" height="14" rx="1"/></svg>
        </button>
        <button class="ctrl" id="btn-fw" aria-label="Maju 10 detik">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><text x="12" y="16.5" font-size="7.5" font-family="sans-serif" font-weight="bold" stroke="none" fill="currentColor" text-anchor="middle">10</text></svg>
        </button>
        <button class="ctrl" style="opacity:.5; cursor:default;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1 a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1 a4 4 0 0 1-4 4H3"/></svg>
        </button>
      </div>

      <div class="note">Support terus kami yaaa</div>
    </div>
  </div>
</div>

<audio id="audio" style="display:none;"></audio>

<script>
(function() {
  'use strict';
  const audio = document.getElementById('audio');
  const play = document.getElementById('play');
  const bar = document.getElementById('bar');
  const fill = document.getElementById('fill');
  const dot = document.getElementById('dot');
  const cur = document.getElementById('cur');
  const heart = document.getElementById('heart');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const lyricsContainer = document.getElementById('mini-lyrics');
  const lyricsText = document.getElementById('lyrics-text');
  const btnRw = document.getElementById('btn-rw');
  const btnFw = document.getElementById('btn-fw');
  const statusFrom = document.getElementById('stream-status');

  // --- 1. SETUP LIRIK ---
  let lyrics = [];
  try {
    const encoded = '${lyricsJson}';
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder('utf-8').decode(bytes);
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      lyrics = parsed.filter(item => item && Number.isFinite(Number(item.time)))
                     .map(item => ({ time: Number(item.time), text: String(item.text || '♪') }))
                     .sort((a, b) => a.time - b.time);
    }
  } catch { lyrics = []; }

  const lyricElements = [];
  function renderLyrics() {
    lyricsText.innerHTML = '';
    if (!lyrics.length) {
      lyricsText.innerHTML = '<div class="lyrics-empty">Lirik belum tersedia untuk lagu ini.</div>';
      return;
    }
    const fragment = document.createDocumentFragment();
    lyrics.forEach((line) => {
      const el = document.createElement('div');
      el.className = 'lyric-line';
      el.textContent = line.text;
      fragment.appendChild(el);
      lyricElements.push(el);
    });
    lyricsText.appendChild(fragment);
  }
  renderLyrics();

  let activeLyricIndex = -1;
  function updateLyrics(currentTime) {
    if (!lyrics.length) return;
    const index = lyrics.findIndex(l => l.time > currentTime) - 1;
    const activeIdx = index < 0 ? 0 : index;
    if (activeIdx === activeLyricIndex) return;
    activeLyricIndex = activeIdx;
    
    lyricElements.forEach((el, i) => {
        el.classList.toggle('is-active', i === activeIdx);
        if (i === activeIdx && lyricsContainer) {
            const top = el.offsetTop - (lyricsContainer.clientHeight / 2) + 10;
            lyricsContainer.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }
    });
  }

  // --- 2. WEBSOCKET & MSE SETUP ---
  const WS_URL = 'wss://music.ceciliaa.my.id';
  const TARGET_URL = '${rawAudioUrl}';
  const TOTAL_SECONDS = ${totalSecs}; // Fix bug progress bar error

  if (!window.MediaSource) {
      statusFrom.innerText = "MSE NOT SUPPORTED";
  } else {
      const ms = new MediaSource();
      audio.src = URL.createObjectURL(ms);
      let sourceBuffer;
      let queue = [];

      ms.addEventListener('sourceopen', () => {
          try {
              sourceBuffer = ms.addSourceBuffer('audio/mpeg');
              sourceBuffer.addEventListener('updateend', () => {
                  if (queue.length > 0 && !sourceBuffer.updating) {
                      sourceBuffer.appendBuffer(queue.shift());
                  }
              });
              
              const ws = new WebSocket(WS_URL);
              ws.binaryType = 'arraybuffer';

              ws.onopen = () => {
                  statusFrom.innerText = "REQUESTING TRACK...";
                  ws.send('PLAY:' + TARGET_URL);
              };

              ws.onmessage = (event) => {
                  if (event.data instanceof ArrayBuffer) {
                      statusFrom.innerText = "Terhubung";
                      queue.push(event.data);
                      if (!sourceBuffer.updating && queue.length === 1) {
                          sourceBuffer.appendBuffer(queue.shift());
                          if (audio.paused) audio.play().catch(()=>{});
                      }
                  } else if (event.data === 'STREAM_DONE') {
                      statusFrom.innerText = "Terhubung";
                  }
              };
          } catch (e) {
              statusFrom.innerText = "CODEC ERROR";
          }
      });
  }

  // --- 3. CONTROLS LOGIC ---
  function formatTime(sec) {
    sec = Number(sec);
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function updateProgress() {
    let duration = Number(audio.duration);
    // Kalau stream error baca max duration, pakai fallback yg dikalkulasi bot!
    if (!Number.isFinite(duration) || duration <= 0 || duration === Infinity) {
        duration = TOTAL_SECONDS; 
    }
    const current = Math.max(0, Math.min(duration, Number(audio.currentTime) || 0));
    const percent = (current / duration) * 100;
    fill.style.width = percent + '%';
    dot.style.left = percent + '%';
    cur.textContent = formatTime(current);
    updateLyrics(current);
  }

  play.addEventListener('click', () => {
    if (audio.paused) { audio.play(); } else { audio.pause(); }
  });

  heart.addEventListener('click', () => heart.classList.toggle('is-on'));

  btnRw.addEventListener('click', () => {
    audio.currentTime = Math.max(0, audio.currentTime - 10);
    updateProgress();
  });

  btnFw.addEventListener('click', () => {
    let duration = Number(audio.duration);
    if (!Number.isFinite(duration) || duration <= 0 || duration === Infinity) duration = TOTAL_SECONDS;
    audio.currentTime = Math.min(duration, audio.currentTime + 10);
    updateProgress();
  });

  bar.addEventListener('pointerdown', event => {
    let duration = Number(audio.duration);
    if (!Number.isFinite(duration) || duration <= 0 || duration === Infinity) duration = TOTAL_SECONDS;
    const rect = bar.getBoundingClientRect();
    if (!rect.width) return;
    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    audio.currentTime = (x / rect.width) * duration;
    updateProgress();
  });

  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('play', () => { iconPlay.style.display='none'; iconPause.style.display='block'; });
  audio.addEventListener('pause', () => { iconPlay.style.display='block'; iconPause.style.display='none'; });
  audio.addEventListener('ended', () => {
    iconPlay.style.display='block'; iconPause.style.display='none';
    fill.style.width = '0%'; dot.style.left = '0%'; cur.textContent = '0:00';
  });

})();
</script>
`;
}

/* =========================================================
 * HANDLER
 * ========================================================= */

export default {
    name: 'play2', 
    execute: async (xync, m, args, text) => {
        if (!text) return m.reply(`Masukkan judul lagu cuy!`);

        try {
            await m.react('🕒');
            let ytUrl = text.trim();
            let title = 'Unknown', artist = 'Unknown', duration = '0:00', durationSec = 0, thumbUrl = '', trackIdForLyrics = null, album = '';

            // 1. CARI LAGU
            if (!/youtube\.com|youtu\.be/i.test(text)) {
                const ytm = await getYTMusic();
                const songs = await ytm.search(text);
                const track = songs.find(s => s.type === 'SONG') || songs[0];
                if (!track) throw new Error('Lagu tidak ditemukan');
                trackIdForLyrics = track.videoId;
                ytUrl = `https://www.youtube.com/watch?v=${track.videoId}`;
                title = track.name || track.title || 'Unknown';
artist = track.artists?.length
    ? track.artists.map(a => (typeof a === 'string' ? a : a.name)).filter(Boolean).join(', ')
    : (track.artist?.name || 'Unknown Artist');
durationSec = Number(track.duration) || 0;
duration = formatDuration(durationSec);
                if (track.thumbnails?.length) thumbUrl = track.thumbnails[track.thumbnails.length - 1].url;
            }

            // 2. AMBIL LIRIK
            let syncedLyrics = [];
            const lrclib = await getLRCLyrics({ title, artist, duration: durationSec });
            if (lrclib?.syncedLyrics) syncedLyrics = parseSyncedLyrics(lrclib.syncedLyrics);
            else if (lrclib?.plainLyrics) syncedLyrics = plainLyricsToSynced(lrclib.plainLyrics, durationSec);
            syncedLyrics = normalizeLyrics(syncedLyrics);

            // 3. AMBIL THUMBNAIL & LINK SAVETUBE
            const thumb = await getThumb(thumbUrl);
            const imageSrc = thumb?.length ? `data:image/jpeg;base64,${thumb.toString('base64')}` : '';
            
            const audioData = await savetubeRetry(ytUrl, { downloadType: 'audio', quality: '128kbps' });
            if (!audioData?.url) throw new Error('URL audio tidak tersedia');

            // 4. RAKIT HTML
            const htmlPayload = createMusicPlayer({
                title, artist, duration, imageSrc, lyrics: syncedLyrics,
                rawAudioUrl: audioData.url // KITA LEMPAR RAW URL KE DALAM SCRIPT
            });

            // 5. KIRIM PESAN AIRICH
            const rich = new AIRich(xync, { dynamic: true, unsupportedTypeAlert: false });
            rich.addSection({
                view_model: {
                    primitive: {
                        __typename: 'GenAIaeacdsnwHtmlPrimitive',
                        payload: htmlPayload,
                        trusted_sources: ['localhost', '443', '127.0.0.1', '154.12.118.154']
                    },
                    __typename: 'GenAISingleLayoutViewModel'
                }
            });

            await rich.send(m.chat, { quoted: m, includesUnifiedResponse: true, forwarded: true, notification: false });
            await m.react('');

        } catch (error) {
            console.error("Error play2:", error);
            m.reply(`Gagal: ${error?.message || 'Unknown'}`);
        }
    }
};