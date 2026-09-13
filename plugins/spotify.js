// plugins/spotify.js
// sesuaikan aja
'use strict';

import { sendHtmlCard } from '../lib/sendcard.js';

const WS_URL = 'wss://spotify.ceciliaa.my.id'; 

function createSpotifyCard(initialQuery = '') {
    const safeInitialQuery = JSON.stringify(initialQuery || '');
    return `
<style>
  :root { --green: #1DB954; --black: #121212; --panel: #121212; --card-bg: #181818; --card-hover: #282828; --muted: #b3b3b3; --sys: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { background: transparent; color: #fff; font-family: var(--sys); -webkit-font-smoothing: antialiased; }
  
  .wrap { display: flex; justify-content: center; padding: 10px; }
  .panel { position: relative; width: 100%; max-width: 380px; height: 600px; background: var(--black); border-radius: 16px; overflow: hidden; box-shadow: 0 18px 40px rgba(0,0,0,.5); display: flex; flex-direction: column; }

  /* VIEWS CONTAINER */
  .views { flex: 1; overflow-y: auto; overflow-x: hidden; position: relative; scroll-behavior: smooth; -webkit-overflow-scrolling: touch; }
  .views::-webkit-scrollbar { display: none; }
  .view { display: none; padding: 16px; padding-bottom: 80px; min-height: 100%; }
  .view.is-active { display: block; animation: fadeIn 0.3s ease; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  /* HEADER GENERAL */
  .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .top-title { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
  .top-status { display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--muted); background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 12px; }
  .status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); }
  .status-dot.is-on { background: var(--green); box-shadow: 0 0 6px var(--green); }

  /* HOME VIEW */
  .home-header { background: linear-gradient(180deg, #333333 0%, var(--black) 100%); margin: -16px -16px 16px -16px; padding: 16px; padding-bottom: 0; }
  .grid-home { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px; }
  .grid-item { display: flex; align-items: center; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; cursor: pointer; transition: background 0.2s; }
  .grid-item:active { background: rgba(255,255,255,0.2); }
  .grid-item img { width: 56px; height: 56px; object-fit: cover; flex: none; box-shadow: 4px 0 6px rgba(0,0,0,0.2); background: #222; }
  .grid-item span { font-size: 12px; font-weight: 600; padding: 0 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

  /* SEARCH VIEW */
  .searchbox { display: flex; align-items: center; gap: 8px; background: #fff; border-radius: 4px; padding: 0 12px; margin-bottom: 20px; }
  .searchbox svg { width: 20px; height: 20px; color: #000; flex: none; }
  .searchbox input { flex: 1; background: none; border: none; outline: none; color: #000; font-size: 14px; padding: 12px 0; font-family: var(--sys); font-weight: 500; }
  .searchbox input::placeholder { color: #555; }

  /* LIST STYLES */
  .row { display: flex; align-items: center; gap: 12px; padding: 8px 0; cursor: pointer; }
  .row:active { opacity: 0.7; }
  .row__thumb { width: 48px; height: 48px; border-radius: 4px; overflow: hidden; flex: none; background: #222; }
  .row__thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: opacity 0.3s; }
  .row__meta { flex: 1; min-width: 0; }
  .row__title { font-size: 15px; font-weight: 500; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px; }
  .row__artist { font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row__action { color: var(--muted); padding: 8px; }
  .empty, .loading { padding: 40px 16px; text-align: center; font-size: 14px; color: var(--muted); }

  /* BOTTOM NAV */
  .bottom-nav { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(0deg, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%); display: flex; justify-content: space-around; padding: 12px 10px 16px; z-index: 10; display: none; }
  .nav-btn { background: none; border: none; color: var(--muted); display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 10px; cursor: pointer; transition: color 0.2s; }
  .nav-btn svg { width: 24px; height: 24px; }
  .nav-btn.is-active { color: #fff; }

  /* MINI PLAYER */
  .mini-player { position: absolute; bottom: 64px; left: 8px; right: 8px; background: #2a2a2a; border-radius: 6px; padding: 8px; display: none; align-items: center; gap: 10px; z-index: 11; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border-bottom: 2px solid var(--black); }
  .mini-player.is-active { display: flex; }
  .mp-info { flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; cursor: pointer; }
  .mp-thumb { width: 36px; height: 36px; border-radius: 4px; overflow: hidden; background: #111; flex: none; }
  .mp-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .mp-text { flex: 1; min-width: 0; }
  .mp-title { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #fff; }
  .mp-artist { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mp-ctrls { display: flex; align-items: center; gap: 12px; padding-right: 8px; }
  .mp-btn { background: none; border: none; color: #fff; display: flex; align-items: center; justify-content: center; padding: 0; cursor: pointer; }
  .mp-btn:active { transform: scale(0.9); }
  .mp-progress { position: absolute; bottom: 0; left: 8px; right: 8px; height: 2px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; }
  .mp-fill { height: 100%; background: #fff; width: 0%; transition: width 0.1s linear; }

  /* NOW PLAYING FULLSCREEN */
  .now-playing { position: absolute; inset: 0; background: var(--black); z-index: 20; display: none; flex-direction: column; }
  .now-playing.is-active { display: flex; animation: slideUp 0.3s ease; }
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .np-bg { position: absolute; inset: -50%; width: 200%; height: 200%; object-fit: cover; filter: blur(60px) brightness(0.6); z-index: -1; }
  .np-header { display: flex; justify-content: space-between; align-items: center; padding: 16px; }
  .np-btn { background: none; border: none; color: #fff; padding: 8px; cursor: pointer; }
  .np-header-text { font-size: 12px; font-weight: 600; letter-spacing: 1px; color: rgba(255,255,255,0.8); text-transform: uppercase; }
  
  .np-main { flex: 1; display: flex; flex-direction: column; padding: 0 24px 24px; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .np-main::-webkit-scrollbar { display: none; }
  .np-art-wrap { width: 100%; aspect-ratio: 1; margin-bottom: 30px; margin-top: auto; }
  .np-art { width: 100%; height: 100%; border-radius: 8px; object-fit: cover; box-shadow: 0 10px 30px rgba(0,0,0,0.5); background: #222; }
  
  .np-info-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .np-meta { flex: 1; min-width: 0; padding-right: 16px; }
  .np-title { font-size: 22px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
  .np-artist { font-size: 15px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .np-like { background: none; border: none; color: var(--muted); cursor: pointer; transition: transform 0.2s; }
  .np-like.is-liked { color: var(--green); }
  .np-like:active { transform: scale(1.2); }

  .np-slider-wrap { margin-bottom: 24px; }
  .np-slider { height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; position: relative; cursor: pointer; }
  .np-fill { position: absolute; left: 0; top: 0; height: 100%; background: #fff; border-radius: 2px; pointer-events: none; }
  .np-dot { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 12px; height: 12px; background: #fff; border-radius: 50%; opacity: 0; transition: opacity 0.2s; pointer-events: none; }
  .np-slider:hover .np-dot { opacity: 1; }
  .np-slider:hover .np-fill { background: var(--green); }
  .np-time-row { display: flex; justify-content: space-between; margin-top: 6px; font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }

  .np-controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
  .np-ctrl-btn { background: none; border: none; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .np-ctrl-btn.secondary { position: relative; color: var(--muted); width: 36px; height: 36px; border-radius: 50%; transition: background 0.2s ease, color 0.2s ease; }
  .np-ctrl-btn.secondary:active { transform: scale(0.92); }
  .np-ctrl-btn.secondary.is-active { color: var(--green); background: rgba(29,185,84,0.18); }
  .np-play-btn { width: 64px; height: 64px; background: #fff; color: #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer; }
  .np-play-btn:active { transform: scale(0.95); }

  /* Badge kecil di pojok tombol Repeat, dipakai buat mode "Ulangi Lagu Ini" */
  #repeat-badge { display: none; position: absolute; top: -2px; right: -2px; width: 14px; height: 14px; border-radius: 50%; background: var(--green); color: #000; font-size: 9px; font-weight: 800; align-items: center; justify-content: center; line-height: 1; box-shadow: 0 0 0 2px var(--black); }
  #repeat-badge.is-visible { display: flex; }

  /* Toast notifikasi singkat (dipakai untuk konfirmasi Share/Copy link) */
  .toast { position: absolute; left: 50%; bottom: 100px; transform: translate(-50%, 10px); background: #fff; color: #000; font-size: 13px; font-weight: 600; padding: 10px 18px; border-radius: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); opacity: 0; pointer-events: none; transition: opacity 0.25s ease, transform 0.25s ease; z-index: 100; max-width: 85%; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .toast.is-visible { opacity: 1; transform: translate(-50%, 0); }

  /* Tombol Lirik */
  .np-lyrics-btn-wrap { display: flex; justify-content: center; }
  .np-lyrics-btn { background: rgba(255,255,255,0.15); color: #fff; border: none; border-radius: 20px; padding: 8px 16px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; }
  .np-lyrics-btn:active { background: rgba(255,255,255,0.25); }

  /* --- FULL LYRICS VIEW --- */
  .lyrics-view { position: absolute; inset: 0; background: var(--black); z-index: 30; display: none; flex-direction: column; }
  .lyrics-view.is-active { display: flex; animation: slideUp 0.3s ease; }
  .lv-header { display: flex; align-items: center; padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); }
  .lv-close { background: none; border: none; color: #fff; cursor: pointer; padding: 8px; margin-right: 12px; }
  .lv-title { font-size: 14px; font-weight: 700; flex: 1; text-align: center; padding-right: 40px; }
  .lv-content { flex: 1; overflow-y: auto; padding: 30px 24px; scroll-behavior: smooth; -webkit-overflow-scrolling: touch; }
  .lv-content::-webkit-scrollbar { display: none; }
  .lyric-line { font-size: 18px; font-weight: 700; color: rgba(255,255,255,0.4); line-height: 1.6; margin-bottom: 16px; transition: all 0.3s ease; transform-origin: left center; }
  .lyric-line.is-active { color: #fff; font-size: 22px; transform: scale(1.02); }
  
  /* --- ABOUT / SUPPORT VIEW --- */
  .about-section { margin-bottom: 26px; }
  .about-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: var(--green); margin-bottom: 10px; }
  .about-card { background: var(--card-bg); border-radius: 10px; padding: 16px; display: flex; align-items: center; gap: 12px; }
  .about-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--green); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; flex: none; }
  .about-name { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 2px; }
  .about-role { font-size: 12px; color: var(--muted); margin-bottom: 8px; }
  .about-contact { font-size: 13px; color: #fff; display: flex; align-items: center; gap: 6px; }
  .about-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .about-chip { background: var(--card-bg); color: #fff; font-size: 13px; font-weight: 600; padding: 8px 14px; border-radius: 20px; }
  .about-text { font-size: 13px; color: var(--muted); line-height: 1.6; }
  .about-footer { text-align: center; font-size: 11px; color: var(--muted); margin-top: 8px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); }

  /* CUSTOM SCROLLBAR: garis vertikal di kanan, bisa digeser buat scroll manual */
  .vscroll { position: absolute; right: 2px; width: 22px; z-index: 25; touch-action: none; }
  .vscroll-line { position: absolute; left: 50%; top: 0; transform: translateX(-50%); width: 4px; height: 40px; border-radius: 3px; background: rgba(255,255,255,0.25); transition: background 0.15s; }
  .vscroll.is-dragging .vscroll-line { background: rgba(255,255,255,0.6); }
  #main-views-scroll { top: 8px; bottom: 78px; }
  #np-main-scroll { top: 64px; bottom: 8px; }
  #lv-content-scroll { top: 64px; bottom: 8px; }
</style>

<div class="wrap">
  <div class="panel">

    <!-- MAIN VIEWS -->
    <div class="views" id="main-views">
      
      <!-- HOME VIEW -->
      <div id="view-home" class="view">
        <div class="home-header">
          <div class="top-bar">
            <div class="top-title" id="user-greeting">Spotify</div>
            <div class="top-status">
              <div class="status-dot" id="ws-dot"></div>
              <span id="ws-status">Connecting...</span>
            </div>
          </div>
          <div class="grid-home" id="home-grid"></div>
        </div>
        <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">Sering didengarkan</h2>
        <div id="home-recent-list"></div>
      </div>

      <!-- SEARCH VIEW -->
      <div id="view-search" class="view">
        <div class="top-bar">
          <div class="top-title">Cari</div>
        </div>
        <div class="searchbox">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input id="search-input" type="text" placeholder="Artis, lagu, atau podcast">
        </div>
        <div id="search-results">
          <div class="empty">Mulai ketik untuk mencari lagu.</div>
        </div>
      </div>

      <!-- PLAYLIST VIEW -->
      <div id="view-playlist" class="view">
        <div class="top-bar">
          <div class="top-title">Koleksi Kamu</div>
        </div>
        <div id="playlist-results">
          <div class="empty">Belum ada lagu yang disimpan.</div>
        </div>
      </div>

      <!-- ABOUT VIEW -->
      <div id="view-about" class="view">
        <div class="top-bar">
          <div class="top-title">Tentang</div>
        </div>

        <div class="about-section">
          <div class="about-label">Developer</div>
          <div class="about-card">
            <div class="about-avatar">R</div>
            <div>
              <div class="about-name">Renx</div>
              <div class="about-role">Developer & Creator</div>
              <div class="about-contact">
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1L6.6 10.8z"/></svg>
                088242935717
              </div>
            </div>
          </div>
        </div>

        <div class="about-section">
          <div class="about-label">API Provider</div>
          <div class="about-list">
            <div class="about-chip">Nexray</div>
            <div class="about-chip">Zellray</div>
            <div class="about-chip">lrclib</div>
          </div>
        </div>

        <div class="about-section">
          <div class="about-label">Support</div>
          <div class="about-text">Butuh bantuan? Temukan bug atau punya saran? Hubungi kami, kami siap membantu.</div>
        </div>

        <div class="about-section">
          <div class="about-label">Special Thanks</div>
          <div class="about-text">Terima kasih kepada semua developer, contributor, tester, dan pengguna yang telah membantu memberikan dukungan, masukan, serta ide untuk membuat aplikasi ini terus berkembang.</div>
        </div>

        <div class="about-footer">© 2026 — All Rights Reserved</div>
      </div>

    </div>

    <!-- CUSTOM SCROLLBAR: MAIN VIEWS -->
    <div class="vscroll" id="main-views-scroll"><div class="vscroll-line"></div></div>

    <!-- MINI PLAYER -->
    <div id="mini-player" class="mini-player">
      <div class="mp-info" id="mp-open">
        <div class="mp-thumb"><img id="mp-art" src="" onerror="this.onerror=null;this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzE4MTgxOCIvPjwvc3ZnPg==';"></div>
        <div class="mp-text">
          <div class="mp-title" id="mp-title">-</div>
          <div class="mp-artist" id="mp-artist">-</div>
        </div>
      </div>
      <div class="mp-ctrls">
        <button class="mp-btn" id="mp-like">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <button class="mp-btn" id="mp-play">
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" id="mp-icon-play"><path d="M8 5v14l11-7z"/></svg>
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" id="mp-icon-pause" style="display:none"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        </button>
      </div>
      <div class="mp-progress"><div class="mp-fill" id="mp-fill"></div></div>
    </div>

    <!-- BOTTOM NAV -->
    <div class="bottom-nav" id="bottom-nav">
      <button class="nav-btn is-active" data-target="view-home">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.1l-10 9h3v9.9h5.5v-6h3v6H19v-9.9h3L12 2.1z"/></svg>
        Home
      </button>
      <button class="nav-btn" data-target="view-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        Search
      </button>
      <button class="nav-btn" data-target="view-playlist">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 6h16M4 12h16M4 18h8"/><circle cx="17" cy="17" r="3"/><path d="M20 17h2v-2"/></svg>
        Playlist
      </button>
      <button class="nav-btn" data-target="view-about">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        Tentang
      </button>
    </div>

    <!-- NOW PLAYING FULLSCREEN -->
    <div id="now-playing" class="now-playing">
      <img id="np-bg" class="np-bg" src="" onerror="this.onerror=null;this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzE4MTgxOCIvPjwvc3ZnPg==';">
      <div class="np-veil"></div>
      <div class="np-header">
        <button class="np-btn" id="np-close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="np-header-text">Sedang Diputar</div>
        <div style="width:24px"></div>
      </div>
      <div class="np-main">
        <div class="np-art-wrap">
          <img id="np-art" class="np-art" src="" onerror="this.onerror=null;this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzE4MTgxOCIvPjwvc3ZnPg==';">
        </div>
        <div class="np-info-row">
          <div class="np-meta">
            <div class="np-title" id="np-title">-</div>
            <div class="np-artist" id="np-artist">-</div>
          </div>
          <button class="np-like" id="np-like">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
        </div>
        <div class="np-slider-wrap">
          <div class="np-slider" id="np-bar">
            <div class="np-fill" id="np-fill"></div>
            <div class="np-dot" id="np-dot"></div>
          </div>
          <div class="np-time-row">
            <span id="np-cur">0:00</span>
            <span id="np-dur">0:00</span>
          </div>
        </div>
        <div class="np-controls">
          <button class="np-ctrl-btn secondary" id="np-repeat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
            <span id="repeat-badge">1</span>
          </button>
          <button class="np-ctrl-btn" id="np-prev">
            <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
          </button>
          <button class="np-play-btn" id="np-play">
            <svg id="np-icon-play" viewBox="0 0 24 24" fill="currentColor" width="36" height="36"><path d="M8 5v14l11-7z"/></svg>
            <svg id="np-icon-pause" viewBox="0 0 24 24" fill="currentColor" width="36" height="36" style="display:none"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          </button>
          <button class="np-ctrl-btn" id="np-next">
            <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>
          <button class="np-ctrl-btn secondary" id="np-share" title="Bagikan lagu ini">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
          </button>
        </div>
        <div class="np-lyrics-btn-wrap">
          <button class="np-lyrics-btn" id="btn-show-lyrics">Tampilan Lirik</button>
        </div>
      </div>
      <div class="vscroll" id="np-main-scroll"><div class="vscroll-line"></div></div>
    </div>

    <!-- TOAST NOTIFIKASI (contoh: konfirmasi link disalin) -->
    <div class="toast" id="app-toast"></div>

    <!-- FULL LYRICS VIEW -->
    <div id="full-lyrics" class="lyrics-view">
      <div class="lv-header">
        <button class="lv-close" id="btn-hide-lyrics">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="lv-title">Lirik</div>
      </div>
      <div class="lv-content" id="lv-content">
        <div class="lyric-line is-active">Memuat lirik...</div>
      </div>
      <div class="vscroll" id="lv-content-scroll"><div class="vscroll-line"></div></div>
    </div>

  </div>
</div>

<audio id="audio" style="display:none;"></audio>

<script>
(function() {
  'use strict';

  const WS_URL = '${WS_URL}';
  const INITIAL_QUERY = ${safeInitialQuery};
  const FALLBACK_ART = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzE4MTgxOCIvPjwvc3ZnPg==';
  
  // Daftar lagu Home: mulai dari data lokal (thumbnail masih URL asli, dipakai
  // sebagai placeholder biar UI langsung ada isinya), lalu di-refresh otomatis
  // begitu server balas 'HOME_RESULTS:' dengan thumbnail yang sudah base64
  // (lihat ws.onopen & ws.onmessage) — ini yang benerin gambar Home yang tadinya kosong.
  let HOME_SONGS = [
	{ title: "Dunia Yang Nanti", artist: "Raim Laode", spotifyUrl: "https://open.spotify.com/track/1sVQuuvFDKu6vklPVeiUXT", thumbnail: "https://i.scdn.co/image/ab67616d0000b273a9d1f9b5d3275b0625e13e79" },
	{ title: "Teh Hijau", artist: "Tulus", spotifyUrl: "https://open.spotify.com/track/4R9G7azXaZe93KTX65P9fU", thumbnail: "https://i.scdn.co/image/ab67616d0000b273e4086e5f9d79cf18ed601015" },
	{ title: "Sesi Potret", artist: "eńau", spotifyUrl: "https://open.spotify.com/track/4xoY4lZNoTjEuHsSmhgF1G", thumbnail: "https://i.scdn.co/image/ab67616d0000b273172768978c7f929803ad7e8b" },
	{ title: "iqro'", artist: "Raim Laode", spotifyUrl: "https://open.spotify.com/track/2YRHj7X19faZv4WZZ3JnZq", thumbnail: "https://i.scdn.co/image/ab67616d0000b273e455819f67875ffb8d96e837" },
	{ title: "Kangen", artist: "Dewa 19", spotifyUrl: "https://open.spotify.com/track/3ZyMRe0jlSqffPBMeHUZFX", thumbnail: "https://i.scdn.co/image/ab67616d0000b27369222d0908ecf5d22cc9d960" },
	{ title: "Bahagia Lagi", artist: "Piche Kota", spotifyUrl: "https://open.spotify.com/track/5tZaKZPJtiHh6teQfVEHB5", thumbnail: "https://i.scdn.co/image/ab67616d0000b2735bd00b369e89c5cbc74d827b" },
    { title: "You & I", artist: "One Direction", spotifyUrl: "https://open.spotify.com/track/2afCBiru10AFckfOa49wIa", thumbnail: "https://i.scdn.co/image/ab67616d0000b2733cf0191cca87a4bc7e34bc4a" },
    { title: "A Thousand Miles", artist: "Vanessa Carlton", spotifyUrl: "https://open.spotify.com/track/4w1lzcaoZ1IC2K5TwjalRP", thumbnail: "https://i.scdn.co/image/ab67616d0000b273bc3ada3a19bb4e657f10917e" },
    { title: "Sure Thing", artist: "Miguel", spotifyUrl: "https://open.spotify.com/track/0JXXNGljqupsJaZsgSbMZV", thumbnail: "https://i.scdn.co/image/ab67616d0000b273d5a8395b0d80b8c48a5d851c" },
    { title: "About You", artist: "The 1975", spotifyUrl: "https://open.spotify.com/track/3hEfpBHxgieRLz4t3kLNEg", thumbnail: "https://i.scdn.co/image/ab67616d0000b27300702474f8e0e2b6155d48e3" }
  ];

  let ws;
  let reconnectTimer = null;

  // Playlist disimpan lokal di browser (localStorage) - gak ada login/akun
  // dan gak ada database di server, jadi playlist ini cuma ada di device ini.
  const PLAYLIST_STORAGE_KEY = 'renx_spotify_playlist';

  function loadLocalPlaylist() {
      try {
          const raw = localStorage.getItem(PLAYLIST_STORAGE_KEY);
          const parsed = raw ? JSON.parse(raw) : [];
          return Array.isArray(parsed) ? parsed : [];
      } catch (e) { return []; }
  }
  function saveLocalPlaylist() {
      try { localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(myPlaylist)); } catch (e) {}
  }

  let myPlaylist = loadLocalPlaylist();
  let currentTrack = null;
  let currentQueue = [];
  let currentIndex = -1;
  let totalSecs = 200;
  let repeatMode = 0; 
  let lyrics = [];
  let lyricElements = [];
  let activeLyricIndex = -1;

  /* ---------------- ELEMENTS ---------------- */
  const els = {
    bottomNav: document.getElementById('bottom-nav'),
    
    // Core Views
    wsDot: document.getElementById('ws-dot'),
    wsStatus: document.getElementById('ws-status'),
    navBtns: document.querySelectorAll('.nav-btn'),
    views: document.querySelectorAll('.view'),
    homeGrid: document.getElementById('home-grid'),
    homeRecent: document.getElementById('home-recent-list'),
    input: document.getElementById('search-input'),
    searchList: document.getElementById('search-results'),
    playlistList: document.getElementById('playlist-results'),
    
    // Mini Player
    miniPlayer: document.getElementById('mini-player'),
    mpOpen: document.getElementById('mp-open'),
    mpArt: document.getElementById('mp-art'),
    mpTitle: document.getElementById('mp-title'),
    mpArtist: document.getElementById('mp-artist'),
    mpPlay: document.getElementById('mp-play'),
    mpIconPlay: document.getElementById('mp-icon-play'),
    mpIconPause: document.getElementById('mp-icon-pause'),
    mpLike: document.getElementById('mp-like'),
    mpFill: document.getElementById('mp-fill'),
    
    // Now Playing
    nowPlaying: document.getElementById('now-playing'),
    npClose: document.getElementById('np-close'),
    npBg: document.getElementById('np-bg'),
    npArt: document.getElementById('np-art'),
    npTitle: document.getElementById('np-title'),
    npArtist: document.getElementById('np-artist'),
    npLike: document.getElementById('np-like'),
    npBar: document.getElementById('np-bar'),
    npFill: document.getElementById('np-fill'),
    npDot: document.getElementById('np-dot'),
    npCur: document.getElementById('np-cur'),
    npDur: document.getElementById('np-dur'),
    npPlay: document.getElementById('np-play'),
    npIconPlay: document.getElementById('np-icon-play'),
    npIconPause: document.getElementById('np-icon-pause'),
    npPrev: document.getElementById('np-prev'),
    npNext: document.getElementById('np-next'),
    npRepeat: document.getElementById('np-repeat'),
    repeatBadge: document.getElementById('repeat-badge'),
    npShare: document.getElementById('np-share'),
    
    // Lyrics Fullscreen
    fullLyrics: document.getElementById('full-lyrics'),
    btnShowLyrics: document.getElementById('btn-show-lyrics'),
    btnHideLyrics: document.getElementById('btn-hide-lyrics'),
    lvContent: document.getElementById('lv-content'),

    toast: document.getElementById('app-toast'),
    
    audio: document.getElementById('audio')
  };

  /* ---------------- INIT APP ---------------- */
  // Gak ada login/akun - app langsung tampil begitu dibuka. Playlist
  // ("Koleksi Kamu") cuma tersimpan lokal di device ini lewat localStorage.
  function initApp() {
      els.bottomNav.style.display = 'flex';
      els.navBtns[0].click(); // Arahkan ke Home
      renderHome();
      renderPlaylist();
  }
  initApp();

  /* ---------------- HELPERS ---------------- */
  function setStatus(text, on) {
    if(els.wsStatus) els.wsStatus.textContent = text;
    if(els.wsDot) els.wsDot.classList.toggle('is-on', !!on);
  }

  function formatTime(sec) {
    sec = Number(sec);
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  // Safe Image Fetcher (sama seperti spotify.js: coba convert ke base64 data URI
  // dulu biar gak keblokir trusted_sources/CORS pas ditampilkan). Bedanya: kalau
  // fetch()-nya sendiri yang diblokir sistem (yang paling sering kejadian buat
  // URL CDN asli kayak i.scdn.co), kita gak langsung nyerah ke FALLBACK_ART -
  // kita balikin URL aslinya biar tag <img> coba muat sendiri secara native.
  // Native <img src> gak butuh izin CORS buat SEKEDAR nampilin gambar (beda
  // sama fetch()/canvas yang butuh CORS buat BACA data-nya), jadi ini sering
  // berhasil walau fetch()-nya gagal. FALLBACK_ART cuma dipakai kalau <img>-nya
  // sendiri juga gagal muat (lihat atribut onerror di setiap <img> thumbnail).
  const thumbCache = new Map();
  async function toDataUrl(url) {
    if (!url) return FALLBACK_ART;
    if (url.startsWith('data:')) return url;
    if (thumbCache.has(url)) return thumbCache.get(url);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      thumbCache.set(url, dataUrl);
      console.log('[sPR_THUMB] sukses convert thumbnail ke data URL:', url);
      return dataUrl;
    } catch (e) {
      console.warn('[sPR_THUMB] fetch()/CORS diblokir, fallback ke <img> native:', url, e);
      return url; // biarkan <img> coba load langsung; onerror akan handle kalau ini juga gagal
    }
  }

  function getHeartIcon(isLiked) {
    if (isLiked) return '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  }

  function isTrackLiked(trackUrl) {
    return myPlaylist.some(t => t.spotifyUrl === trackUrl);
  }

  function toggleLike() {
    if (!currentTrack) return;
    const exists = isTrackLiked(currentTrack.spotifyUrl);
    if (exists) {
      myPlaylist = myPlaylist.filter(t => t.spotifyUrl !== currentTrack.spotifyUrl);
    } else {
      myPlaylist.push(currentTrack);
    }

    // Simpan lokal (localStorage) - gak ada server/database buat playlist.
    saveLocalPlaylist();

    els.mpLike.classList.toggle('is-liked', !exists);
    els.npLike.classList.toggle('is-liked', !exists);
    els.mpLike.innerHTML = getHeartIcon(!exists);
    els.npLike.innerHTML = getHeartIcon(!exists);
    renderPlaylist();
  }
  
  if(els.mpLike) els.mpLike.addEventListener('click', toggleLike);
  if(els.npLike) els.npLike.addEventListener('click', toggleLike);

  /* ---------------- UI NAVIGATION ---------------- */
  els.navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      els.navBtns.forEach(b => b.classList.remove('is-active'));
      els.views.forEach(v => v.classList.remove('is-active'));
      btn.classList.add('is-active');
      const target = document.getElementById(btn.dataset.target);
      if(target) target.classList.add('is-active');
    });
  });

  if(els.mpOpen) {
      els.mpOpen.addEventListener('click', () => {
        if (!currentTrack) return;
        els.nowPlaying.classList.add('is-active');
      });
  }
  if(els.npClose) els.npClose.addEventListener('click', () => els.nowPlaying.classList.remove('is-active'));
  
  // Full Lyrics Navigation
  if(els.btnShowLyrics) els.btnShowLyrics.addEventListener('click', () => els.fullLyrics.classList.add('is-active'));
  if(els.btnHideLyrics) els.btnHideLyrics.addEventListener('click', () => els.fullLyrics.classList.remove('is-active'));

  // Label state Repeat: 0 = mati, 1 = ulangi semua lagu di daftar (queue),
  // 2 = ulangi lagu yang sedang diputar terus-menerus.
  const REPEAT_LABELS = ['Ulangi: Mati', 'Ulangi: Semua Lagu', 'Ulangi: Lagu Ini'];

  function applyRepeatUI() {
    if (!els.npRepeat) return;
    els.npRepeat.classList.toggle('is-active', repeatMode !== 0);
    els.npRepeat.title = REPEAT_LABELS[repeatMode];
    els.npRepeat.setAttribute('aria-pressed', repeatMode !== 0 ? 'true' : 'false');
    if (els.repeatBadge) els.repeatBadge.classList.toggle('is-visible', repeatMode === 2);
  }

  if(els.npRepeat) {
      els.npRepeat.addEventListener('click', () => {
        repeatMode = (repeatMode + 1) % 3;
        applyRepeatUI();
      });
      applyRepeatUI(); // set indikator awal (mati) saat pertama kali load
  }

  /* ---------------- RENDERING ---------------- */
  // Template Row List
  function createRowElement(t, onClick) {
    const div = document.createElement('div');
    div.className = 'row';
    div.innerHTML = \`
      <div class="row__thumb"><img src="\${FALLBACK_ART}" onerror="this.onerror=null;this.src='\${FALLBACK_ART}';"></div>
      <div class="row__meta">
        <div class="row__title">\${t.title}</div>
        <div class="row__artist">\${t.artist}</div>
      </div>
      <div class="row__action">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="12" cy="12" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="12" cy="19" r="2"/></svg>
      </div>\`;
    
    div.addEventListener('click', onClick);
    // Load gambar asli
    const img = div.querySelector('img');
    toDataUrl(t.thumbnail).then(src => { img.src = src; });
    return div;
  }

  function renderHome() {
    if(els.homeGrid) {
        els.homeGrid.innerHTML = '';
        HOME_SONGS.slice(0, 6).forEach((t, i) => {
          const div = document.createElement('div');
          div.className = 'grid-item';
          div.innerHTML = \`<img src="\${FALLBACK_ART}" onerror="this.onerror=null;this.src='\${FALLBACK_ART}';"><span>\${t.title}</span>\`;
          div.addEventListener('click', () => { playTrack(t, HOME_SONGS, i); });
          
          const img = div.querySelector('img');
          toDataUrl(t.thumbnail).then(src => { img.src = src; });
          els.homeGrid.appendChild(div);
        });
    }

    if(els.homeRecent) {
        els.homeRecent.innerHTML = '';
        HOME_SONGS.slice(6).forEach((t, i) => {
          els.homeRecent.appendChild(createRowElement(t, () => playTrack(t, HOME_SONGS, i + 6)));
        });
    }
  }

  function renderPlaylist() {
    if(!els.playlistList) return;
    if (!myPlaylist.length) {
      els.playlistList.innerHTML = '<div class="empty">Belum ada lagu yang disimpan. Tap logo Love buat nyimpen.</div>';
      return;
    }
    els.playlistList.innerHTML = '';
    myPlaylist.forEach((t, i) => {
      els.playlistList.appendChild(createRowElement(t, () => playTrack(t, myPlaylist, i)));
    });
  }

  function renderSearch(tracks) {
    if(!els.searchList) return;
    if (!tracks.length) {
      els.searchList.innerHTML = '<div class="empty">Lagu gak ketemu, coba kata kunci lain.</div>';
      return;
    }
    els.searchList.innerHTML = '';
    tracks.forEach((t, i) => {
      els.searchList.appendChild(createRowElement(t, () => playTrack(t, tracks, i)));
    });
  }

  /* ---------------- WEBSOCKET ---------------- */
  function connect() {
    ws = new WebSocket(WS_URL);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      setStatus('Online', true);
      // Minta daftar Home dengan thumbnail yang sudah dikonversi ke base64
      // di server (biar gak diblokir WebView kayak sebelumnya).
      ws.send('GET_HOME');
      if (INITIAL_QUERY) doSearch(INITIAL_QUERY);
    };

    ws.onclose = () => {
      setStatus('Terputus...', false);
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 2000);
    };
    ws.onerror = () => setStatus('Error server', false);

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        handleAudioChunk(event.data);
        return;
      }
      const text = event.data;
      if (text.startsWith('HOME_RESULTS:')) {
        try {
          const payload = JSON.parse(text.slice(13));
          if (payload.ok && Array.isArray(payload.tracks) && payload.tracks.length) {
            HOME_SONGS = payload.tracks;
            renderHome();
          }
        } catch (e) {}
        return;
      }
      if (text.startsWith('RESULTS:')) {
        try {
          const payload = JSON.parse(text.slice(8));
          if (payload.ok) renderSearch(payload.tracks);
          else if(els.searchList) els.searchList.innerHTML = '<div class="empty">Error server pencarian.</div>';
        } catch (e) {}
        return;
      }
      if (text.startsWith('TRACK_META:')) {
        try { applyTrackMeta(JSON.parse(text.slice(11))); } catch (e) {}
        return;
      }
      if (text === 'STREAM_DONE') return;
      if (text === 'ERROR_FETCH') {
        setStatus('Gagal fetch audio!', false);
        setTimeout(playNextTrack, 2000); 
      }
    };
  }

  // Mulai koneksi WS
  connect();

  /* ---------------- SEARCH EVENT ---------------- */
  let searchTimeout;
  function doSearch(q) {
    q = q.trim();
    if (!q) return;
    if(els.navBtns.length > 1) els.navBtns[1].click(); 
    if(els.input) els.input.value = q;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if(els.searchList) els.searchList.innerHTML = '<div class="loading">Mencari "'+q+'"...</div>';
    ws.send('SEARCH:' + q);
  }
  
  if(els.input) {
      els.input.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          if (e.target.value.trim().length > 2) doSearch(e.target.value);
        }, 800);
      });
  }

  /* ---------------- PLAYER LOGIC ---------------- */
  let ms, sourceBuffer, queueAudio = [];

  // Terapkan durasi asli ke MediaSource begitu tahu (dari metadata server).
  // Tanpa ini, els.audio.duration akan tetap "Infinity" selama stream masih
  // jalan, dan itu yang bikin progress bar gak pernah keisi/gerak.
  function applyMediaSourceDuration() {
    if (!ms || ms.readyState !== 'open' || !Number.isFinite(totalSecs) || totalSecs <= 0) return;
    if (sourceBuffer && sourceBuffer.updating) {
      sourceBuffer.addEventListener('updateend', applyMediaSourceDuration, { once: true });
      return;
    }
    try { ms.duration = totalSecs; } catch (e) {}
  }

  function resetMediaSource() {
    queueAudio = [];
    sourceBuffer = null;
    ms = new MediaSource();
    if(els.audio) {
        els.audio.pause();
        els.audio.src = URL.createObjectURL(ms);
    }
    ms.addEventListener('sourceopen', () => {
      try {
        sourceBuffer = ms.addSourceBuffer('audio/mpeg');
        sourceBuffer.addEventListener('updateend', () => {
          if (queueAudio.length > 0 && !sourceBuffer.updating) sourceBuffer.appendBuffer(queueAudio.shift());
        });
        applyMediaSourceDuration();
      } catch (e) {}
    });
  }

  // Ambil batas akhir bagian lagu yang sudah ke-download/ke-buffer sejauh ini.
  // Dipakai buat membatasi seek maju, karena lagu di-stream berurutan dari
  // awal (bukan file utuh yang bisa diakses acak).
  function getBufferedEnd() {
    if (!sourceBuffer || !sourceBuffer.buffered || !sourceBuffer.buffered.length) return 0;
    try { return sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1); } catch (e) { return 0; }
  }

  function handleAudioChunk(buf) {
    if (!sourceBuffer) { queueAudio.push(buf); return; }
    queueAudio.push(buf);
    if (!sourceBuffer.updating && queueAudio.length === 1) {
      sourceBuffer.appendBuffer(queueAudio.shift());
      if (els.audio && els.audio.paused) els.audio.play().catch(() => {});
    }
  }

  function playTrack(track, queueList, index) {
    currentTrack = track;
    currentQueue = queueList;
    currentIndex = index;
    totalSecs = 200;

    // Update Text
    if(els.mpTitle) els.mpTitle.textContent = track.title;
    if(els.mpArtist) els.mpArtist.textContent = track.artist;
    if(els.npTitle) els.npTitle.textContent = track.title;
    if(els.npArtist) els.npArtist.textContent = track.artist;
    
    // Set Fallback gambar dulu
    if(els.mpArt) els.mpArt.src = FALLBACK_ART;
    if(els.npArt) els.npArt.src = FALLBACK_ART;
    if(els.npBg) els.npBg.src = FALLBACK_ART;

    // Fetch gambar asli via DataURL
    toDataUrl(track.thumbnail).then(src => {
        if(els.mpArt) els.mpArt.src = src;
        if(els.npArt) els.npArt.src = src;
        if(els.npBg) els.npBg.src = src;
    });

    const isLiked = isTrackLiked(track.spotifyUrl);
    if(els.mpLike) els.mpLike.innerHTML = getHeartIcon(isLiked);
    if(els.npLike) els.npLike.innerHTML = getHeartIcon(isLiked);
    if(els.mpLike) els.mpLike.classList.toggle('is-liked', isLiked);
    if(els.npLike) els.npLike.classList.toggle('is-liked', isLiked);

    if(els.miniPlayer) els.miniPlayer.classList.add('is-active');
    
    // Reset Lyrics
    lyrics = [];
    activeLyricIndex = -1;
    if(els.lvContent) els.lvContent.innerHTML = '<div class="lyric-line is-active">Mencari lirik...</div>';

    setStatus('Loading...', true);
    resetMediaSource();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send('PLAY_SPOTIFY:' + track.spotifyUrl);
    }
  }

  function playNextTrack() {
    if (!currentQueue.length) return;
    let nextIdx = currentIndex + 1;
    if (nextIdx >= currentQueue.length) {
      if (repeatMode === 1) nextIdx = 0; 
      else return; 
    }
    playTrack(currentQueue[nextIdx], currentQueue, nextIdx);
  }

  function playPrevTrack() {
    if (!currentQueue.length) return;
    if (els.audio && els.audio.currentTime > 3) {
      els.audio.currentTime = 0;
      return;
    }
    let prevIdx = currentIndex - 1;
    if (prevIdx < 0) {
      if (repeatMode === 1) prevIdx = currentQueue.length - 1;
      else prevIdx = 0;
    }
    playTrack(currentQueue[prevIdx], currentQueue, prevIdx);
  }

  function applyTrackMeta(meta) {
    if (meta.durationSec) {
      totalSecs = meta.durationSec;
      applyMediaSourceDuration();
    }
    if (Array.isArray(meta.lyrics)) {
      lyrics = meta.lyrics.filter(i => i && Number.isFinite(Number(i.time)) && i.text).sort((a, b) => a.time - b.time);
      if(els.lvContent) {
          if (!lyrics.length) els.lvContent.innerHTML = '<div class="lyric-line">Lirik tidak tersedia.</div>';
          else {
            els.lvContent.innerHTML = lyrics.map(l => \`<div class="lyric-line">\${l.text}</div>\`).join('');
            lyricElements = Array.from(els.lvContent.children);
          }
      }
    }
    setStatus('Playing', true);
  }

  /* ---------------- CONTROLS & EVENTS ---------------- */
  function togglePlay() {
    if (!currentTrack || !els.audio) return;
    if (els.audio.paused) els.audio.play(); else els.audio.pause();
  }

  if(els.mpPlay) els.mpPlay.addEventListener('click', togglePlay);
  if(els.npPlay) els.npPlay.addEventListener('click', togglePlay);
  if(els.npNext) els.npNext.addEventListener('click', playNextTrack);
  if(els.npPrev) els.npPrev.addEventListener('click', playPrevTrack);

  /* ---------------- TOAST & SHARE ---------------- */
  let toastTimer = null;
  function showToast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove('is-visible');
    }, 2200);
  }

  // Fallback copy buat browser/WebView lama yang gak dukung navigator.clipboard
  function legacyCopyToClipboard(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  async function shareCurrentTrack() {
    if (!currentTrack || !currentTrack.spotifyUrl) {
      showToast('Belum ada lagu yang diputar.');
      return;
    }
    const url = currentTrack.spotifyUrl;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        showToast('Link Spotify disalin!');
      } else if (legacyCopyToClipboard(url)) {
        showToast('Link Spotify disalin!');
      } else {
        showToast('Gagal menyalin link.');
      }
    } catch (e) {
      if (legacyCopyToClipboard(url)) showToast('Link Spotify disalin!');
      else showToast('Gagal menyalin link.');
    }
  }

  if(els.npShare) els.npShare.addEventListener('click', shareCurrentTrack);

  if(els.npBar && els.audio) {
      els.npBar.addEventListener('pointerdown', (e) => {
        const dur = Number.isFinite(els.audio.duration) && els.audio.duration > 0 ? els.audio.duration : totalSecs;
        const rect = els.npBar.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        let target = (x / rect.width) * dur;

        // Lagu di-stream berurutan dari awal, jadi belum bisa loncat ke bagian
        // yang belum ke-download. Mundur ke bagian yang sudah diputar selalu
        // aman; maju dibatasi maksimal sejauh yang sudah ke-buffer.
        const bufferedEnd = getBufferedEnd();
        if (bufferedEnd > 0) target = Math.min(target, Math.max(bufferedEnd - 0.5, 0));

        if (Number.isFinite(target) && target >= 0) els.audio.currentTime = target;
      });
  }

  if(els.audio) {
      els.audio.addEventListener('timeupdate', () => {
        const dur = Number.isFinite(els.audio.duration) && els.audio.duration > 0 ? els.audio.duration : totalSecs;
        let cur = els.audio.currentTime || 0;
        let pct = dur > 0 ? (cur / dur) * 100 : 0;
        
        if(els.mpFill) els.mpFill.style.width = pct + '%';
        if(els.npFill) els.npFill.style.width = pct + '%';
        if(els.npDot) els.npDot.style.left = pct + '%';
        if(els.npCur) els.npCur.textContent = formatTime(cur);
        if(els.npDur) els.npDur.textContent = formatTime(dur);

        // Sync Lirik
        if (lyrics.length > 0 && els.lvContent && els.fullLyrics.classList.contains('is-active')) {
          // Cari baris terakhir yang waktunya sudah lewat/sama dengan posisi
          // sekarang. -1 berarti belum masuk baris manapun (masih sebelum
          // baris pertama) - sebelumnya di sini ada bug yang selalu
          // menganggap baris pertama aktif sejak detik ke-0.
          let idx = -1;
          for (let i = 0; i < lyrics.length; i++) {
            if (lyrics[i].time <= cur) idx = i; else break;
          }
          if (idx !== activeLyricIndex) {
            activeLyricIndex = idx;
            lyricElements.forEach((el, i) => {
                const isActive = i === idx;
                el.classList.toggle('is-active', isActive);
                // Scroll otomatis ke lirik yang aktif
                if(isActive) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
          }
        }
      });

      els.audio.addEventListener('play', () => {
        if(els.mpIconPlay) els.mpIconPlay.style.display = 'none'; 
        if(els.mpIconPause) els.mpIconPause.style.display = 'block';
        if(els.npIconPlay) els.npIconPlay.style.display = 'none'; 
        if(els.npIconPause) els.npIconPause.style.display = 'block';
      });
      
      els.audio.addEventListener('pause', () => {
        if(els.mpIconPlay) els.mpIconPlay.style.display = 'block'; 
        if(els.mpIconPause) els.mpIconPause.style.display = 'none';
        if(els.npIconPlay) els.npIconPlay.style.display = 'block'; 
        if(els.npIconPause) els.npIconPause.style.display = 'none';
      });

      els.audio.addEventListener('ended', () => {
        if (repeatMode === 2) {
          els.audio.currentTime = 0;
          els.audio.play();
        } else {
          playNextTrack();
        }
      });
  }

  /* ---------------- CUSTOM SCROLLBAR (drag manual) ---------------- */
  function bindDragScrollbar(scrollEl, trackEl) {
    if (!scrollEl || !trackEl) return;
    const thumbEl = trackEl.querySelector('.vscroll-line');
    if (!thumbEl) return;

    function syncThumb() {
      const scrollable = scrollEl.scrollHeight - scrollEl.clientHeight;
      if (scrollable <= 4) {
        trackEl.style.display = 'none';
        return;
      }
      trackEl.style.display = 'block';
      const trackH = trackEl.clientHeight;
      const thumbH = Math.max(32, (scrollEl.clientHeight / scrollEl.scrollHeight) * trackH);
      const ratio = scrollEl.scrollTop / scrollable;
      thumbEl.style.height = thumbH + 'px';
      thumbEl.style.top = (ratio * (trackH - thumbH)) + 'px';
    }

    function moveToY(clientY) {
      const rect = trackEl.getBoundingClientRect();
      const thumbH = thumbEl.offsetHeight;
      const usable = rect.height - thumbH;
      let pos = clientY - rect.top - (thumbH / 2);
      pos = Math.max(0, Math.min(pos, usable));
      const ratio = usable > 0 ? pos / usable : 0;
      scrollEl.scrollTop = ratio * (scrollEl.scrollHeight - scrollEl.clientHeight);
    }

    let dragging = false;
    function start(e) {
      dragging = true;
      trackEl.classList.add('is-dragging');
      moveToY(e.touches ? e.touches[0].clientY : e.clientY);
      e.preventDefault();
    }
    function move(e) {
      if (!dragging) return;
      moveToY(e.touches ? e.touches[0].clientY : e.clientY);
      e.preventDefault();
    }
    function stop() {
      dragging = false;
      trackEl.classList.remove('is-dragging');
    }

    trackEl.addEventListener('touchstart', start, { passive: false });
    trackEl.addEventListener('mousedown', start);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mousemove', move);
    window.addEventListener('touchend', stop);
    window.addEventListener('mouseup', stop);
    scrollEl.addEventListener('scroll', syncThumb);
    window.addEventListener('resize', syncThumb);
    new MutationObserver(syncThumb).observe(scrollEl, { childList: true, subtree: true });

    syncThumb();
  }

  bindDragScrollbar(document.getElementById('main-views'), document.getElementById('main-views-scroll'));
  bindDragScrollbar(els.nowPlaying ? els.nowPlaying.querySelector('.np-main') : null, document.getElementById('np-main-scroll'));
  bindDragScrollbar(els.lvContent, document.getElementById('lv-content-scroll'));

})();
</script>
`;
}

export default {
    name: 'spotify',
    execute: async (xync, m, args, text) => {
        try {
            const htmlPayload = createSpotifyCard(text ? text.trim() : '');
            await sendHtmlCard(xync, m.chat, htmlPayload);
        } catch (error) {
            console.error('Error spotify:', error);
            m.reply(`Gagal buka Spotify card: ${error?.message || 'Unknown'}`);
        }
    }
}; 