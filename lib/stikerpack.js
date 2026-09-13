import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import cp from 'child_process';
import { promisify } from 'util';
import { downloadContentFromMessage } from 'baileys';
import JSZip from 'jszip';
import webpmux from 'node-webpmux';

const execAsync = promisify(cp.exec);

export function toBuffer(value) {
	if (Buffer.isBuffer(value)) return value;
	if (value && value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data);
	if (typeof value === 'string') return Buffer.from(value, 'base64');
	throw new Error('Format buffer tidak dikenali');
}

export function toStoredBuffer(buffer) {
	return Buffer.from(buffer).toString('base64');
}

export function getStickerStore(db, sender) {
	if (!db.sticker) db.sticker = {};
	if (!db.sticker[sender]) db.sticker[sender] = [];
	const list = db.sticker[sender];
	for (const item of list) {
		if (typeof item.buffer !== 'string') {
			item.buffer = toStoredBuffer(toBuffer(item.buffer));
		}
	}
	return list;
}

export function sha256(buffer) {
	return crypto.createHash('sha256').update(buffer).digest();
}

export function toB64Url(buffer) {
	return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function isWebP(buffer) {
	return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
}

export function isAnimatedWebP(buffer) {
	if (!isWebP(buffer)) return false;
	let offset = 12;
	while (offset < buffer.length - 8) {
		const chunk = buffer.toString('ascii', offset, offset + 4);
		const size = buffer.readUInt32LE(offset + 4);
		if (chunk === 'VP8X' && (buffer[offset + 8] & 0x02)) return true;
		if (chunk === 'ANIM' || chunk === 'ANMF') return true;
		offset += 8 + size + (size % 2);
	}
	return false;
}

export function classifySticker(buffer, isLottieMsg) {
	if (isLottieMsg) return { ext: 'json', mimetype: 'application/json', isAnimated: true, isLottie: true };
	return { ext: 'webp', mimetype: 'image/webp', isAnimated: isAnimatedWebP(buffer), isLottie: false };
}

export async function imageToWebp(buffer) {
	const tmpIn = `./database/temp/${crypto.randomBytes(4).toString('hex')}.jpg`;
	const tmpOut = `./database/temp/${crypto.randomBytes(4).toString('hex')}.webp`;
	fs.writeFileSync(tmpIn, buffer);
	try {
		await execAsync(`ffmpeg -i "${tmpIn}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color='#00000000'" -vcodec libwebp -quality 80 "${tmpOut}"`);
		return fs.readFileSync(tmpOut);
	} finally {
		if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn);
		if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
	}
}

async function makeTrayWebp(buffer) {
	const tmpIn = `./database/temp/${crypto.randomBytes(4).toString('hex')}.webp`;
	const tmpOut = `./database/temp/${crypto.randomBytes(4).toString('hex')}_tray.webp`;
	fs.writeFileSync(tmpIn, buffer);
	try {
		await execAsync(`ffmpeg -i "${tmpIn}" -vf "scale=252:252:force_original_aspect_ratio=decrease,format=rgba,pad=252:252:(ow-iw)/2:(oh-ih)/2:color='#00000000'" -vcodec libwebp -quality 80 "${tmpOut}"`);
		return fs.readFileSync(tmpOut);
	} finally {
		if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn);
		if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
	}
}

async function makeBlankTrayWebp() {
	return Buffer.from('UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==', 'base64');
}

async function makeThumbnailJpeg(buffer) {
	const tmpIn = `./database/temp/${crypto.randomBytes(4).toString('hex')}.webp`;
	const tmpOut = `./database/temp/${crypto.randomBytes(4).toString('hex')}_thumb.jpg`;
	fs.writeFileSync(tmpIn, buffer);
	try {
		await execAsync(`ffmpeg -i "${tmpIn}" -vf "scale=252:252:force_original_aspect_ratio=decrease,pad=252:252:(ow-iw)/2:(oh-ih)/2:color=white" -vcodec mjpeg -q:v 2 "${tmpOut}"`);
		return fs.readFileSync(tmpOut);
	} finally {
		if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn);
		if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
	}
}

export async function uploadToServer(conn, buffer, { hkdf, mediaPath, mediaKey = crypto.randomBytes(32) }) {
	const expanded = Buffer.from(crypto.hkdfSync('sha256', mediaKey, Buffer.alloc(32), Buffer.from(hkdf), 112));
	const iv = expanded.subarray(0, 16);
	const cipherKey = expanded.subarray(16, 48);
	const macKey = expanded.subarray(48, 80);
	const cipher = crypto.createCipheriv('aes-256-cbc', cipherKey, iv);
	const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
	const mac = crypto.createHmac('sha256', macKey).update(iv).update(encrypted).digest().subarray(0, 10);
	const encBuffer = Buffer.concat([encrypted, mac]);
	const fileSha256 = sha256(buffer);
	const fileEncSha256 = sha256(encBuffer);

	const iq = await conn.query({
		tag: 'iq',
		attrs: { id: conn.generateMessageTag?.() ?? Date.now().toString(), to: 's.whatsapp.net', type: 'set', xmlns: 'w:m' },
		content: [{ tag: 'media_conn', attrs: {} }]
	});

	const mediaConn = iq.content?.find(v => v.tag === 'media_conn');
	if (!mediaConn) throw new Error('media_conn tidak ditemukan');
	const auth = mediaConn.attrs?.auth;
	if (!auth) throw new Error('auth media_conn tidak ditemukan');
	const hosts = (mediaConn.content || []).filter(v => v.tag === 'host').map(v => v.attrs?.hostname).filter(Boolean);
	if (!hosts.length) throw new Error('host upload tidak ditemukan');

	const token = encodeURIComponent(fileEncSha256.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''));
	let lastError;

	for (const host of hosts) {
		try {
			const json = await new Promise((resolve, reject) => {
				const url = new URL(`https://${host}${mediaPath}/${token}?auth=${encodeURIComponent(auth)}&token=${token}`);
				const req = https.request({
					hostname: url.hostname, port: 443, path: url.pathname + url.search, method: 'POST',
					headers: { Origin: 'https://web.whatsapp.com', Referer: 'https://web.whatsapp.com/', 'Content-Type': 'application/octet-stream', 'Content-Length': encBuffer.length }
				}, (res) => {
					let body = '';
					res.on('data', c => body += c);
					res.on('end', () => {
						if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`Upload gagal ${res.statusCode}: ${body}`));
						try { resolve(JSON.parse(body)); } catch { reject(new Error(`Response bukan JSON: ${body}`)); }
					});
				});
				req.on('error', reject);
				req.write(encBuffer);
				req.end();
			});
			const directPath = json.direct_path ?? json.directPath ?? json.url ?? json.path;
			if (!directPath) throw new Error('directPath tidak ditemukan');
			return { mediaKey, fileLength: buffer.length, fileSha256, fileEncSha256, directPath, ...json };
		} catch (e) {
			lastError = e;
		}
	}
	throw lastError ?? new Error('Semua host upload gagal');
}

export async function addMetadata(webpBuffer, packname, author) {
	try {
		const img = new webpmux.Image();
		await img.load(webpBuffer);

		const json = {
			"sticker-pack-id": `renn_${crypto.randomBytes(4).toString('hex')}`,
			"sticker-pack-name": packname,
			"sticker-pack-publisher": author,
			"emojis": ["\u2764\uFE0F"]
		};

		const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
		const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf-8');
		const exif = Buffer.concat([exifAttr, jsonBuffer]);
		exif.writeUInt32LE(jsonBuffer.length, 14);

		img.exif = exif;
		return await img.save(null);
	} catch (e) {
		console.error("Gagal nyuntik EXIF:", e);
		return webpBuffer;
	}
}

export async function sendCustomStickerPack(conn, m, pack, packName = 'Renn SPack', authorName = 'Renn-kun') {
	const zip = new JSZip();
	const stickersMetadata = [];
	const hydrated = pack.map(item => ({ ...item, buffer: toBuffer(item.buffer) }));

	for (const item of hydrated) {
		const fileName = `${toB64Url(sha256(item.buffer))}.${item.ext}`;
		zip.file(fileName, item.buffer);
		stickersMetadata.push({ fileName, isAnimated: item.isAnimated, emojis: [''], accessibilityLabel: '', isLottie: item.isLottie, mimetype: item.mimetype });
	}

	const trayIconFileName = 'tray_icon.webp';
	const traySource = hydrated.find(v => !v.isLottie)?.buffer;
	const trayBuffer = traySource ? await makeTrayWebp(traySource) : await makeBlankTrayWebp();
	zip.file(trayIconFileName, trayBuffer);

	const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
	const packUpload = await uploadToServer(conn, archive, { hkdf: 'WhatsApp Sticker Pack Keys', mediaPath: '/mms/sticker-pack' });
	const thumbnailBuffer = await makeThumbnailJpeg(trayBuffer);
	const thumbUpload = await uploadToServer(conn, thumbnailBuffer, { hkdf: 'WhatsApp Sticker Pack Thumbnail Keys', mediaPath: '/mms/thumbnail-sticker-pack', mediaKey: packUpload.mediaKey });

	await conn.relayMessage(m.chat, {
		messageContextInfo: { messageSecret: crypto.randomBytes(32) },
		stickerPackMessage: {
			stickerPackId: 'Pack_' + crypto.randomBytes(8).toString('hex'),
			name: packName,
			publisher: authorName,
			packDescription: 'Stiker pack by xaync',
			stickers: stickersMetadata,
			fileLength: packUpload.fileLength, fileSha256: packUpload.fileSha256, fileEncSha256: packUpload.fileEncSha256, mediaKey: packUpload.mediaKey, directPath: packUpload.directPath, mediaKeyTimestamp: Math.floor(Date.now() / 1000), stickerPackSize: packUpload.fileLength, stickerPackOrigin: 2, trayIconFileName, thumbnailDirectPath: thumbUpload.directPath, thumbnailSha256: thumbUpload.fileSha256, thumbnailEncSha256: thumbUpload.fileEncSha256, thumbnailHeight: 252, thumbnailWidth: 252, imageDataHash: thumbUpload.fileSha256.toString('base64')
		}
	}, { quoted: m });
}

export async function downloadMsgSafe(msgObj) {
	try {
		let msgContent = msgObj.message?.imageMessage || msgObj.message?.stickerMessage || msgObj.message?.viewOnceMessageV2?.message?.imageMessage;
		if (!msgContent) {
			msgContent = msgObj.msg || msgObj.message;
		}
		if (!msgContent) return null;
		let type = (msgObj.message?.stickerMessage || msgContent.mimetype?.includes('webp')) ? 'sticker' : 'image';
		let stream = await downloadContentFromMessage(msgContent, type);
		let buffer = Buffer.from([]);
		for await (const chunk of stream) {
			buffer = Buffer.concat([buffer, chunk]);
		}
		return { buffer, type };
	} catch (e) {
		return null;
	}
}