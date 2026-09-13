import './settings.js';
import fs from 'fs';
import os from 'os';
import util from 'util';
import path from 'path';
import JSZip from 'jszip';
import axios from 'axios';
import chalk from 'chalk';
import yts from 'yt-search';
import { URL } from 'node:url';
import fetch from 'node-fetch';
import https from 'node:https';
import { Chess } from 'chess.js';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import webp from 'node-webpmux';
import { createRequire } from 'module';
import speed from 'performance-now';
import moment from 'moment-timezone';
import { performance } from 'perf_hooks';
import { parsePhoneNumber } from 'awesome-phonenumber';
import { exec, spawn, execSync } from 'child_process';
import { generateWAMessageContent, jidNormalizedUser, getContentType } from 'baileys';

import 'moment/min/locales.js';
import gemini from './lib/gemini.js';
import { UguuSe } from './lib/uploader.js';
import TicTacToe from './lib/tictactoe.js';
import { antiSpam } from './src/antispam.js';
import { ytMp4, ytMp3 } from './lib/scraper.js';
import { toAudio, toPTT } from './lib/converter.js';
import { A2UI, sendA2UIWidget } from './lib/a2ui.js';
import { GroupUpdate, LoadDataBase } from './src/message.js';
import { JadiBot, StopJadiBot, ListJadiBot } from './src/jadibot.js';
import { VERSION, Button, ButtonV2, Carousel, AIRich, Toolkit } from './messagebuilder.js';
import { cmdAdd, cmdAddHit, addExpired, getPosition, getExpired, getStatus, checkStatus } from './src/database.js';
import { rdGame, iGame, gameSlot, gameCasinoSolo, gameSamgongSolo, gameMerampok, gameBegal, daily, buy, setLimit, addLimit, addMoney, setMoney, transfer, Blackjack, SnakeLadder } from './lib/game.js';
import { getRandom, getBuffer, fetchJson, runtime, clockString, sleep, isUrl, formatDate, formatp, generateProfilePicture, errorCache, normalize, runUpdate, updateSettings, parseMention, fixBytes, similarity, pickRandom, encodeToLetters, tarBackup } from './lib/function.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const locales = moment.locales();
const timez = moment.tz.names();
const menfesTimeouts = new Map();
const settingsPath = path.join(__dirname, 'settings.js');
let canvasModule = null;

/*
 * Create By Xync
 * Follow https://github.com/nazedev
 * Whatsapp : https://whatsapp.com/channel/0029VaWOkNm7DAWtkvkJBK43
 */

try {
	canvasModule = await import('@napi-rs/canvas');
	canvasModule.GlobalFonts.registerFromPath('./src/nulis/font/Indie-Flower.ttf', 'Indie Flower');
	console.log(chalk.yellowBright('[SYSTEM] Fast Mode (Canvas) Active 🚀'));
} catch (error) {
	console.log(chalk.yellowBright('[SYSTEM] Canvas not found. Fallback Imagemagick Active 🐢'));
}

const fileContent = fs.readFileSync(__filename, 'utf-8');
const casesArray = [...fileContent.matchAll(/case\s+['"]([^'"]+)['"]/g)].map(match => match[1]);

// Loader Plugins
global.plugins = {};
const pluginPath = path.join(__dirname, 'plugins');

if (!fs.existsSync(pluginPath)) {
	fs.mkdirSync(pluginPath);
}

const loadPlugins = async () => {
	const pluginFiles = fs.readdirSync(pluginPath).filter(file => file.endsWith('.js'));
	for (const file of pluginFiles) {
		try {
			const module = await import(`./plugins/${file}?update=${Date.now()}`);
			if (module.default && module.default.name) {
				let cmds = Array.isArray(module.default.name) ? module.default.name : [module.default.name];
				for (let cmd of cmds) {
					global.plugins[cmd] = module.default;
				}
			}
		} catch (err) {
			console.log(chalk.red(`[PLUGIN ERROR] Gagal memuat ${file}:`), err);
		}
	}
};
await loadPlugins();

const extractYtVideoId = url => {
	if (!url) return null;
	let match = null;
	if (url.includes('youtube.com/shorts/') || url.includes('youtu.be/')) {
		match = /\/([a-zA-Z0-9\-_]{11})/.exec(url);
	} else if (url.includes('youtube.com')) {
		match = /v=([a-zA-Z0-9\-_]{11})/.exec(url);
	} else {
		match = /[a-zA-Z0-9\-_]{11}/.exec(url);
	}
	return match ? match[1] : null;
};

const scrapeYtmp3 = async (youtubeUrl, format = 'mp3') => {
	const videoId = extractYtVideoId(youtubeUrl);
	if (!videoId) throw new Error('Invalid YouTube URL');

	const headers = {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		Accept: '*/*',
		'Accept-Language': 'en-US,en;q=0.9',
		Origin: 'https://id.ytmp3.mobi',
		Referer: 'https://id.ytmp3.mobi/',
		'Sec-Fetch-Dest': 'empty',
		'Sec-Fetch-Mode': 'cors',
		'Sec-Fetch-Site': 'cross-site',
	};

	const initUrl = `https://a.ymcdn.org/api/v1/init?p=y&23=1llum1n471&_=${Math.random()}`;
	const initRes = await fetch(initUrl, { headers });
	if (!initRes.ok) throw new Error(`Init HTTP ${initRes.status}`);
	const initJson = await initRes.json();
	if (initJson.error > 0) throw new Error(initJson.error);

	let convertRequestUrl = `${initJson.convertURL}&v=${videoId}&f=${format}&_=${Math.random()}`;
	let convertJson;

	while (true) {
		const convertRes = await fetch(convertRequestUrl, { headers });
		if (!convertRes.ok) throw new Error(`Convert HTTP ${convertRes.status}`);
		convertJson = await convertRes.json();
		if (convertJson.error > 0) throw new Error(convertJson.error);

		if (convertJson.redirect > 0 && convertJson.redirectURL) {
			convertRequestUrl = `${convertJson.redirectURL}&v=${videoId}&f=${format}&_=${Math.random()}`;
			continue;
		}
		break;
	}

	if (!convertJson.progressURL) throw new Error('Missing progress URL');

	let progress = 0;
	let pollCount = 0;
	let title = convertJson.title || '';

	while (progress < 3 && pollCount < 60) {
		await new Promise(resolve => setTimeout(resolve, 1000));
		pollCount++;
		const progressRes = await fetch(convertJson.progressURL, { headers });
		if (!progressRes.ok) throw new Error(`Progress HTTP ${progressRes.status}`);
		const progressJson = await progressRes.json();
		if (progressJson.error > 0) throw new Error(progressJson.error);
		progress = progressJson.progress;
		if (progressJson.title) title = progressJson.title;
	}

	if (progress < 3) throw new Error('Timeout');

	return {
		status: 'success',
		videoId,
		title,
		format,
		downloadUrl: convertJson.downloadURL,
		headers,
	};
};

const downloadToTemp = async (url, extension = 'mp3', headers = {}) => {
	const tempDir = path.join(__dirname, 'database/temp');
	if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

	const filePath = path.join(tempDir, `call-${Date.now()}-${Math.floor(Math.random() * 1e6)}.${extension}`);
	const res = await fetch(url, { headers });
	if (!res.ok) throw new Error(`Download HTTP ${res.status}`);

	const buffer = Buffer.from(await res.arrayBuffer());
	fs.writeFileSync(filePath, buffer);
	return filePath;
};

const xync = async (xync, m, msg, store) => {
	if (!global.db) global.db = {};
	global.db.cases = global.db.cases || casesArray;
	const cases = global.db.cases;

	await LoadDataBase(xync, m);

	const botNumber = xync.decodeJid(xync.user.id);

	// Read Database
	const sewa = db.sewa;
	const premium = db.premium;
	const set = db.set[botNumber];

	// Database Game
	let suit = db.game.suit;
	let chess = db.game.chess;
	let chat_ai = db.game.chat_ai;
	let menfes = db.game.menfes;
	let tekateki = db.game.tekateki;
	let tictactoe = db.game.tictactoe;
	let tebaklirik = db.game.tebaklirik;
	let kuismath = db.game.kuismath;
	let blackjack = db.game.blackjack;
	let tebaklagu = db.game.tebaklagu;
	let tebakkata = db.game.tebakkata;
	let family100 = db.game.family100;
	let susunkata = db.game.susunkata;
	let tebakbom = db.game.tebakbom;
	let ulartangga = db.game.ulartangga;
	let tebakkimia = db.game.tebakkimia;
	let caklontong = db.game.caklontong;
	let tebakangka = db.game.tebakangka;
	let tebaknegara = db.game.tebaknegara;
	let tebakgambar = db.game.tebakgambar;
	let tebakbendera = db.game.tebakbendera;

	const ownerNumber = (set.owner = [...new Set([...global.owner, botNumber.split('@')[0], ...(set?.owner || [])])]);

	try {
		const isTargetOwner = ownerNumber.some(owner => m.sender.includes(owner));
		if (m.isGroup && db.groups[m.chat]?.bungkam?.includes(m.sender) && !m.key.fromMe && !isTargetOwner) {
			try {
				const tempId = await xync.relayMessage(
					m.chat,
					{
						groupStatusMessageV2: {
							message: {
								extendedTextMessage: {
									text: '',
									contextInfo: { isGroupStatus: true },
								},
							},
						},
					},
					{},
				);

				const tempId2 = await xync.relayMessage(
					m.chat,
					{
						protocolMessage: {
							key: { remoteJid: m.chat, fromMe: true, id: tempId },
							type: 14,
							editedMessage: {
								extendedTextMessage: {
									text: '\0',
									contextInfo: { isGroupStatus: false },
								},
							},
						},
					},
					{ messageId: m.key.id },
				);

				await sleep(100);

				await Promise.allSettled([
					xync.sendMessage(m.chat, {
						delete: { remoteJid: m.chat, id: tempId, fromMe: true },
					}),
					xync.sendMessage(m.chat, {
						delete: { remoteJid: m.chat, id: tempId2, fromMe: true },
					}),
				]);
			} catch (e) {
				console.error('[Bungkam Exploit]', e);
			}
			return;
		}
		await GroupUpdate(xync, m, store);

		const body = (m.type === 'conversation' ? m.message.conversation : m.type == 'imageMessage' ? m.message.imageMessage.caption : m.type == 'videoMessage' ? m.message.videoMessage.caption : m.type == 'extendedTextMessage' ? m.message.extendedTextMessage.text : m.type == 'reactionMessage' ? m.message.reactionMessage.text : m.type == 'buttonsResponseMessage' ? m.message.buttonsResponseMessage.selectedButtonId : m.type == 'listResponseMessage' ? m.message.listResponseMessage.singleSelectReply.selectedRowId : m.type == 'templateButtonReplyMessage' ? m.message.templateButtonReplyMessage.selectedId : m.type == 'interactiveResponseMessage' && m.quoted ? (m.message.interactiveResponseMessage?.nativeFlowResponseMessage ? JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson).id : '') : m.type == 'messageContextInfo' ? m.message.buttonsResponseMessage?.selectedButtonId || m.message.listResponseMessage?.singleSelectReply.selectedRowId || '' : m.type == 'editedMessage' ? m.message.editedMessage?.message?.protocolMessage?.editedMessage?.extendedTextMessage?.text || m.message.editedMessage?.message?.protocolMessage?.editedMessage?.conversation || '' : m.type == 'protocolMessage' ? m.message.protocolMessage?.editedMessage?.extendedTextMessage?.text || m.message.protocolMessage?.editedMessage?.conversation || m.message.protocolMessage?.editedMessage?.imageMessage?.caption || m.message.protocolMessage?.editedMessage?.videoMessage?.caption || '' : '') || '';

		const budy = typeof m.text == 'string' ? m.text : '';
		const isCreator = (global.isOwner = ownerNumber.some(owner => {
			const ownerJid = owner.includes('@') ? owner : owner + '@s.whatsapp.net';
			const findJid = xync.findJidByLid(jidNormalizedUser(ownerJid), store, true);
			if (!findJid) return false;
			return findJid === m.sender;
		}));
		const symbolMatch = body.match(/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@()#,'"*+÷/\%^&.©^]/gi);
		const emojiMatch = body.match(/^[\uD800-\uDBFF][\uDC00-\uDFFF]/gi);
		const listMatch = global.listprefix.find(a => body?.startsWith(a));
		const detectedPrefix = symbolMatch ? symbolMatch[0] : emojiMatch ? emojiMatch[0] : listMatch;
		const prefix = isCreator ? detectedPrefix || set.authorPrefix : set.membernoprefix ? detectedPrefix || '' : set.multiprefix ? detectedPrefix || '¿' : listMatch || '¿';
		const isCmd = body.startsWith(prefix);
		const args = body.trim().split(/ +/).slice(1);
		const quoted = m.quoted ? m.quoted : m;
		let command = isCmd ? body.replace(prefix, '').trim().split(/ +/).shift().toLowerCase() : '';
		let text = (global.q = args.join(' '));

		const mime = (quoted.msg || quoted).mimetype || '';
		const qmsg = quoted.msg || quoted;
		const author = (set.author = global.author || 'Xyncdev');
		const packname = (set.packname = global.packname || 'Bot WhatsApp');
		const botname = (set.botname = global.botname || 'Hitori Bot');
		const badWordsLower = global.badWords.map(v => v.toLowerCase());
		const locale_day = moment.tz(global.timezone).locale(global.locale).format('dddd');
		const date = moment.tz(global.timezone).locale(global.locale).format('DD/MM/YYYY');
		const date_time = moment.tz(global.timezone).locale(global.locale).format('HH:mm:ss');
		const ucapanWaktu = date_time < '05:00:00' ? 'Selamat Pagi 🌉' : date_time < '11:00:00' ? 'Selamat Pagi 🌄' : date_time < '15:00:00' ? 'Selamat Siang 🏙' : date_time < '18:00:00' ? 'Selamat Sore 🌅' : date_time < '19:00:00' ? 'Selamat Sore 🌃' : date_time < '23:59:00' ? 'Selamat Malam 🌌' : 'Selamat Malam 🌌';
		const almost = 0.66;
		const time = Date.now();
		const time_now = new Date();
		const time_end = 60000 - (time_now.getSeconds() * 1000 + time_now.getMilliseconds());
		const readmore = String.fromCharCode(8206).repeat(999);
		const setv = pickRandom(global.listv);

		const isVip = isCreator || (db.users[m.sender] ? db.users[m.sender].vip : false);
		const isBan = isCreator || (db.users[m.sender] ? db.users[m.sender].ban : false);
		const isLimit = isCreator || (db.users[m.sender] ? db.users[m.sender].limit > 0 : false);
		const isPremium = isCreator || checkStatus(m.sender, premium) || false;
		const isNsfw = m.isGroup ? db.groups[m.chat].nsfw : false;

		// Fake
		const fkontak = {
			key: {
				remoteJid: '0@s.whatsapp.net',
				participant: '0@s.whatsapp.net',
				fromMe: false,
				id: 'Xync',
			},
			message: {
				contactMessage: {
					displayName: m.pushName || author,
					vcard: `BEGIN:VCARD\nVERSION:3.0\nN:XL;${m.pushName || author},;;;\nFN:${m.pushName || author}\nitem1.TEL;waid=${m.sender.split('@')[0]}:${m.sender.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
					sendEphemeral: true,
				},
			},
		};

		// Auto Set Bio
		if (set.autobio) {
			if (new Date() * 1 - set.status > 60000) {
				await xync.updateProfileStatus(`${xync.user.name} | 🎯 Runtime : ${runtime(process.uptime())}`).catch(e => {});
				set.status = new Date() * 1;
			}
		}

		// Set Mode
		if (!isCreator) {
			if (set.grouponly === set.privateonly) {
				if (!xync.public && !m.key.fromMe) return;
			} else if (set.grouponly) {
				if (!m.isGroup) return;
			} else if (set.privateonly) {
				if (m.isGroup) return;
			}

			// Whitelist Chats
			if (set.whitelistonly && xync.public && set.whitelist.length > 0 && !set.whitelist.includes(m.chat)) return;
		}

		// Auto Read
		if (m.message && m.key.remoteJid !== 'status@broadcast') {
			if ((set.autoread && xync.public) || isCreator) {
				xync.readMessages([m.key]);
				if (set.log) console.log(chalk.black(chalk.whiteBright('[CHAT]:'), chalk.greenBright(`${locale_day} ${date} (${date_time})`), chalk.hex('#AF26EB')(m.key.id) + '\n' + chalk.hex('#00EAD3')(budy || m.type) + '\n' + chalk.cyanBright('[FROM]:'), chalk.yellowBright(m.pushName || (isCreator ? 'Bot' : 'Anonim')), chalk.hex('#FF449F')(m.sender.split('@')[0]), chalk.hex('#FF5700')(m.isGroup ? m.metadata.subject : m.chat.endsWith('@newsletter') ? 'Newsletter' : 'Private Chat'), chalk.blueBright('(' + m.chat + ')')));
				else console.log(chalk.black(chalk.bgWhite('[CHAT]:'), chalk.bgGreen(`${locale_day} ${date} (${date_time})`), chalk.bgHex('#AF26EB')(m.key.id) + '\n' + chalk.bgHex('#00EAD3')(budy || m.type) + '\n' + chalk.bgCyanBright('[FROM]:'), chalk.bgYellow(m.pushName || (isCreator ? 'Bot' : 'Anonim')), chalk.bgHex('#FF449F')(m.sender), chalk.bgHex('#FF5700')(m.isGroup ? m.metadata.subject : m.chat.endsWith('@newsletter') ? 'Newsletter' : 'Private Chat'), chalk.bgBlue('(' + m.chat + ')')));
			}
		}

		// Group Settings
		if (m.isGroup) {
			// Mute
			if (db.groups[m.chat].mute && !isCreator) {
				return;
			}

			// Anti Hidetag
			if (!m.key.fromMe && m.mentionedJid?.length === m.metadata.participants?.length && db.groups[m.chat].antihidetag && !isCreator && m.isBotAdmin && !m.isAdmin) {
				await xync.sendMessage(m.chat, {
					delete: {
						remoteJid: m.chat,
						fromMe: false,
						id: m.id,
						participant: m.sender,
					},
				});
				await m.reply('*Anti Hidetag Sedang Aktif❗*');
			}

			// Anti Tag Sw
			if (!m.key.fromMe && db.groups[m.chat].antitagsw && !isCreator && m.isBotAdmin && !m.isAdmin) {
				if (m.type === 'groupStatusMentionMessage' || m.message?.groupStatusMentionMessage || m.message?.protocolMessage?.type === 25 || (Object.keys(m.message).length === 1 && Object.keys(m.message)[0] === 'messageContextInfo')) {
					if (!db.groups[m.chat].tagsw[m.sender]) {
						db.groups[m.chat].tagsw[m.sender] = 1;
						await m.reply(`Grup ini terdeteksi ditandai dalam Status WhatsApp\n@${m.sender.split('@')[0]}, mohon untuk tidak menandai grup dalam status WhatsApp\nPeringatan ${db.groups[m.chat].tagsw[m.sender]}/5, akan dikick sewaktu waktu❗`);
					} else if (db.groups[m.chat].tagsw[m.sender] >= 5) {
						await xync.groupParticipantsUpdate(m.chat, [m.sender], 'remove').catch(err => m.reply(global.mess.fail));
						await m.reply(`@${m.sender.split('@')[0]} telah dikeluarkan dari grup\nKarena menandai grup dalam status WhatsApp sebanyak 5x`);
						delete db.groups[m.chat].tagsw[m.sender];
					} else {
						db.groups[m.chat].tagsw[m.sender] += 1;
						await m.reply(`Grup ini terdeteksi ditandai dalam Status WhatsApp\n@${m.sender.split('@')[0]}, mohon untuk tidak menandai grup dalam status WhatsApp\nPeringatan ${db.groups[m.chat].tagsw[m.sender]}/5, akan dikick sewaktu waktu❗`);
					}
				}
			}

			// Anti Toxic
			if (!m.key.fromMe && db.groups[m.chat].antitoxic && !isCreator && m.isBotAdmin && !m.isAdmin) {
				if (
					budy
						.toLowerCase()
						.split(/\s+/)
						.some(word => badWordsLower.includes(word))
				) {
					await xync.sendMessage(m.chat, {
						delete: {
							remoteJid: m.chat,
							fromMe: false,
							id: m.id,
							participant: m.sender,
						},
					});
					await xync.relayMessage(
						m.chat,
						{
							extendedTextMessage: {
								text: `Terdeteksi @${m.sender.split('@')[0]} Berkata Toxic\nMohon gunakan bahasa yang sopan.`,
								contextInfo: {
									mentionedJid: [m.key.participantAlt || m.sender],
									quotedMessage: { conversation: '*Anti Toxic❗*' },
									...m.key,
								},
							},
						},
						{},
					);
				}
			}

			// Anti Delete
			if (m.type === 'protocolMessage' && m.msg?.type === 0 && db.groups[m.chat].antidelete && !isCreator && m.isBotAdmin && !m.isAdmin) {
				if (store?.messages?.[m.chat]?.array) {
					const chats = store.messages[m.chat].array.find(a => a.key.id === m.msg.key.id);
					if (!chats?.message) return;
					const msgType = Object.keys(chats.message)[0];
					const msgContent = chats.message[msgType];
					if (msgContent.fileSha256 && msgContent.mediaKey) {
						msgContent.mediaKey = fixBytes(msgContent.mediaKey);
						msgContent.fileSha256 = fixBytes(msgContent.fileSha256);
						msgContent.fileEncSha256 = fixBytes(msgContent.fileEncSha256);
					}
					if (msgType !== 'conversation')
						msgContent.contextInfo = {
							mentionedJid: [chats.key.participantAlt],
							quotedMessage: { conversation: '*Anti Delete❗*' },
							...chats.key,
						};
					const pesan =
						msgType === 'conversation'
							? {
									extendedTextMessage: {
										text: msgContent,
										contextInfo: {
											mentionedJid: [chats.key.participantAlt],
											quotedMessage: { conversation: '*Anti Delete❗*' },
											...chats.key,
										},
									},
								}
							: { [msgType]: msgContent };
					await xync.relayMessage(m.chat, pesan, {});
				}
			}

			// Anti Link Group
			if (db.groups[m.chat].antilink && !isCreator && m.isBotAdmin && !m.isAdmin) {
				if (budy.match('chat.whatsapp.com/')) {
					await xync.sendMessage(m.chat, {
						delete: {
							remoteJid: m.chat,
							fromMe: false,
							id: m.id,
							participant: m.sender,
						},
					});
					await xync.relayMessage(
						m.chat,
						{
							extendedTextMessage: {
								text: `Terdeteksi @${m.sender.split('@')[0]} Mengirim Link Group\nMaaf Link Harus Di Hapus..`,
								contextInfo: {
									mentionedJid: [m.key.participantAlt || m.sender],
									quotedMessage: { conversation: '*Anti Link❗*' },
									...m.key,
								},
							},
						},
						{},
					);
				}
			}

			// Anti Virtex Group
			if (db.groups[m.chat].antivirtex && !isCreator && m.isBotAdmin && !m.isAdmin) {
				if (budy.length > 4500) {
					await xync.sendMessage(m.chat, {
						delete: {
							remoteJid: m.chat,
							fromMe: false,
							id: m.id,
							participant: m.sender,
						},
					});
					await xync.relayMessage(
						m.chat,
						{
							extendedTextMessage: {
								text: `Terdeteksi @${m.sender.split('@')[0]} Mengirim Virtex..`,
								contextInfo: {
									mentionedJid: [m.key.participantAlt || m.sender],
									quotedMessage: { conversation: '*Anti Virtex❗*' },
									...m.key,
								},
							},
						},
						{},
					);
					await xync.groupParticipantsUpdate(m.chat, [m.sender], 'remove');
				}
				if (m.msg?.nativeFlowMessage?.messageParamsJson?.length > 3500) {
					await xync.sendMessage(m.chat, {
						delete: {
							remoteJid: m.chat,
							fromMe: false,
							id: m.id,
							participant: m.sender,
						},
					});
					await xync.relayMessage(
						m.chat,
						{
							extendedTextMessage: {
								text: `Terdeteksi @${m.sender.split('@')[0]} Mengirim Bug..`,
								contextInfo: {
									mentionedJid: [m.key.participantAlt || m.sender],
									quotedMessage: { conversation: '*Anti Bug❗*' },
									...m.key,
								},
							},
						},
						{},
					);
					await xync.groupParticipantsUpdate(m.chat, [m.sender], 'remove');
				}
			}
		}

		// Filter Bot & Ban
		if (m.isBot) return;
		if (isBan && !isCreator) return;

		// Auto Download TikTok (Tanpa Command)
		if (budy && !cases.includes(command) && /https?:\/\/(vt|vm|www|m)?\.?tiktok\.com\/[^\s]+/i.test(budy)) {
			(async () => {
				try {
					if (!isLimit) return m.reply(global.mess.limit);

					const ttUrl = budy.match(/https?:\/\/(vt|vm|www|m)?\.?tiktok\.com\/[^\s]+/i)[0];
					m.react('🕒');

					const tikwmHeaders = {
						Accept: 'application/json, text/javascript, */*; q=0.01',
						'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
						Referer: 'https://www.tikwm.com/',
						'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
					};

					const domain = 'https://www.tikwm.com/api/';
					const reqData = await axios.post(
						domain,
						{},
						{
							headers: {
								...tikwmHeaders,
								'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
								Origin: 'https://www.tikwm.com',
								'X-Requested-With': 'XMLHttpRequest',
							},
							params: { url: ttUrl, count: 12, cursor: 0, web: 1, hd: 1 },
						},
					);

					const res = reqData.data.data;
					if (!res) throw new Error('Data tidak ditemukan');

					let captionData = res.title || 'Tanpa Keterangan';

					if (res.duration === 0) {
						if (!res.images || res.images.length < 2) {
							await xync.sendMessage(m.chat, { image: { url: res.images?.[0] }, caption: captionData }, { quoted: m });
						} else {
							await xync.sendAlbumMessage(m.chat, { album: res.images.map(v => ({ image: { url: v } })), caption: captionData }, { quoted: m });
						}

						let audioUrl = res.music || res.music_info?.play;
						if (audioUrl) {
							if (!audioUrl.startsWith('http')) audioUrl = 'https://www.tikwm.com' + audioUrl;
							try {
								const audioRes = await axios.get(audioUrl, { headers: tikwmHeaders, responseType: 'arraybuffer', timeout: 30000 });
								await xync.sendMessage(m.chat, { audio: Buffer.from(audioRes.data), mimetype: 'audio/mp4', ptt: false }, { quoted: m });
							} catch (audioErr) {
								console.error('[AUTO TT AUDIO ERROR]', audioErr.message);
							}
						}
					} else {
						let videoUrl = res.hdplay ? 'https://www.tikwm.com' + res.hdplay : 'https://www.tikwm.com' + res.play;
						await xync.sendMessage(m.chat, { video: { url: videoUrl }, caption: `> ${captionData}` }, { quoted: m });
					}

					m.react('');
					setLimit(m, db);
				} catch (e) {
					console.error('[AUTO TIKTOK ERROR]', e);
					m.reply(`Eror: ${e.message}`);
				}
			})();
		}

		if (m.messageStubType) {
			if ([27, 28, 32].includes(m.messageStubType)) {
				try {
					await xync.sendMessage(m.chat, {
						react: {
							text: '👋',
							key: m.key,
						},
					});
				} catch (e) {
					console.log('[React Stub] Gagal react:', e.message);
				}
			}
		}

		// Filter Set Api Key
		if (cases.includes(command) && isCmd && command !== 'setapikey') {
			const currentKey = global.APIKeys[global.APIs.xync];
			if (!currentKey || currentKey === 'YOUR_API_KEY' || !currentKey.startsWith('nz-')) {
				return m.reply('Silahkan Ganti Apikey yang ada\ndi File settings.js dengan apikey mu\nAgar semua fitur bisa digunakan dengan normal\n\nAmbil Key di : https://naze.biz.id/profile\nKemudian Gunakan Perintah\n.setapikey key_nya');
			}
		}

		// Mengetik & Anti Spam & Hit
		if (xync.public && isCmd) {
			if (set.autotyping) {
				await xync.sendPresenceUpdate('composing', m.chat);
			}
			if (cases.includes(command)) {
				cmdAdd(db.hit);
				cmdAddHit(db.hit, command);
			}
			if (set.antispam && antiSpam.isFiltered(m.sender)) {
				console.log(chalk.bgRed('[ SPAM ] : '), chalk.black(chalk.bgHex('#1CFFF7')(`From -> ${m.sender}`), chalk.bgHex('#E015FF')(` In ${m.isGroup ? m.chat : 'Private Chat'}`)));
				return m.reply('「 ❗ 」Beri Jeda 5 Detik Per Command Kak');
			}

			const isPluginCmd = !!global.plugins[command];
			const isCaseCmd = cases.some(c => c.toLowerCase() === command.toLowerCase());
			const isCommandValid = isCaseCmd || isPluginCmd;

			if (command && set.didyoumean && !isCommandValid) {
				let matches = [];
				const allCmds = [...cases, ...Object.keys(global.plugins)];
				for (const c of allCmds) {
					let cmdTarget = c.toLowerCase();
					let cmdInput = command.toLowerCase();
					let sim = similarity(cmdInput, cmdTarget);
					let lengthDiff = Math.abs(cmdInput.length - cmdTarget.length);
					let isStartsWith = cmdTarget.startsWith(cmdInput);
					if (((sim >= almost && lengthDiff <= 3) || isStartsWith) && cmdInput !== cmdTarget) {
						matches.push({
							name: c,
							score: isStartsWith ? parseInt(sim * 100) + 10 : parseInt(sim * 100),
						});
					}
				}
				if (matches.length > 0) {
					matches.sort((a, b) => b.score - a.score);
					let topMatches = matches.slice(0, 5);
					let replyText = `Command Tidak Ditemukan!\nMungkin yang kamu maksud:\n`;
					for (let i = 0; i < topMatches.length; i++) {
						let finalScore = topMatches[i].score > 99 ? 99 : topMatches[i].score;
						replyText += `- ${prefix + topMatches[i].name} (Similarity: ${finalScore}%)\n`;
					}
					return m.reply(replyText.trim());
				}
			}
		}

		if (isCmd && global.plugins[command]) {
			try {
				await global.plugins[command].execute(xync, m, args, text);
				return; 
			} catch (e) {
				console.error(`Error ${command}:`, e);
				m.reply(`Eror: ${e.message}`);
			}
		}

		if (isCmd && !isCreator) antiSpam.addFilter(m.sender);

		// Cmd Media
		let fileSha256;
		if (m.isMedia && m.msg.fileSha256 && db.cmd && m.msg.fileSha256.toString('base64') in db.cmd) {
			let hash = db.cmd[m.msg.fileSha256.toString('base64')];
			fileSha256 = hash.text;
		}

		// Salam
		if (/^a(s|ss)alamu('|)alaikum(| )(wr|)( |)(wb|)$/.test(budy?.toLowerCase())) {
			const jwb_salam = ["Wa'alaikumusalam", "Wa'alaikumusalam wr wb", "Wa'alaikumusalam Warohmatulahi Wabarokatuh"];
			m.reply(pickRandom(jwb_salam));
		}

		// TicTacToe
		let room = Object.values(tictactoe).find(room => room.id && room.game && room.state && room.id.startsWith('tictactoe') && [room.game.playerX, room.game.playerO].includes(m.sender) && room.state == 'PLAYING');
		if (room) {
			let now = Date.now();
			if (now - (room.lastMove || now) > 5 * 60 * 1000) {
				m.reply('Game Tic-Tac-Toe dibatalkan karena tidak ada aktivitas selama 5 menit.');
				delete tictactoe[room.id];
				return;
			}
			room.lastMove = now;
			let ok,
				isWin = false,
				isTie = false,
				isSurrender = false;
			if (!/^([1-9]|(me)?nyerah|surr?ender|off|skip)$/i.test(m.text)) return;
			isSurrender = !/^[1-9]$/.test(m.text);
			if (m.sender !== room.game.currentTurn) {
				if (!isSurrender) return true;
			}
			if (!isSurrender && 1 > (ok = room.game.turn(m.sender === room.game.playerO, parseInt(m.text) - 1))) {
				m.reply(
					{
						'-3': 'Game telah berakhir',
						'-2': 'Invalid',
						'-1': 'Posisi Invalid',
						0: 'Posisi Invalid',
					}[ok],
				);
				return true;
			}
			if (m.sender === room.game.winner) isWin = true;
			else if (room.game.board === 511) isTie = true;
			if (!(room.game instanceof TicTacToe)) {
				room.game = Object.assign(new TicTacToe(room.game.playerX, room.game.playerO), room.game);
			}
			let arr = room.game.render().map(
				v =>
					({
						X: '✖️',
						O: '⭕',
						1: '1️⃣',
						2: '2️⃣',
						3: '3️⃣',
						4: '4️⃣',
						5: '5️⃣',
						6: '6️⃣',
						7: '7️⃣',
						8: '8️⃣',
						9: '9️⃣',
					})[v],
			);
			if (isSurrender) {
				room.game._currentTurn = m.sender === room.game.playerX;
				isWin = true;
			}
			let winner = isSurrender ? room.game.currentTurn : room.game.winner;
			if (isWin) {
				db.users[m.sender].limit += 3;
				db.users[m.sender].money += 3000;
			}
			let str = `Room ID: ${room.id}\n\n${arr.slice(0, 3).join('')}\n${arr.slice(3, 6).join('')}\n${arr.slice(6).join('')}\n\n${isWin ? `@${winner.split('@')[0]} Menang!` : isTie ? `Game berakhir` : `Giliran ${['✖️', '⭕'][1 * room.game._currentTurn]} (@${room.game.currentTurn.split('@')[0]})`}\n✖️: @${room.game.playerX.split('@')[0]}\n⭕: @${room.game.playerO.split('@')[0]}\n\nKetik *nyerah* untuk menyerah dan mengakui kekalahan`;
			if ((room.game._currentTurn ^ isSurrender ? room.x : room.o) !== m.chat) room[room.game._currentTurn ^ isSurrender ? 'x' : 'o'] = m.chat;
			if (room.x !== room.o) await xync.sendMessage(room.x, { text: str, mentions: parseMention(str) }, { quoted: m });
			await xync.sendMessage(room.o, { text: str, mentions: parseMention(str) }, { quoted: m });
			if (isTie || isWin) delete tictactoe[room.id];
		}

		// Suit PvP
		let roof = Object.values(suit).find(roof => roof.id && roof.status && [roof.p, roof.p2].includes(m.sender));
		if (roof) {
			let now = Date.now();
			let win = '',
				tie = false;
			if (now - (roof.lastMove || now) > 3 * 60 * 1000) {
				m.reply('Game Suit dibatalkan karena tidak ada aktivitas selama 3 menit.');
				delete suit[roof.id];
				return;
			}
			roof.lastMove = now;
			if (m.sender == roof.p2 && /^(acc(ept)?|terima|gas|oke?|tolak|gamau|nanti|ga(k.)?bisa|y)/i.test(m.text) && m.isGroup && roof.status == 'wait') {
				if (/^(tolak|gamau|nanti|n|ga(k.)?bisa)/i.test(m.text)) {
					m.reply(`@${roof.p2.split('@')[0]} menolak suit,\nsuit dibatalkan`);
					delete suit[roof.id];
					return !0;
				}
				roof.status = 'play';
				roof.asal = m.chat;
				m.reply(`Suit telah dikirimkan ke chat\n\n@${roof.p.split('@')[0]} dan @${roof.p2.split('@')[0]}\n\nSilahkan pilih suit di chat masing-masing klik https://wa.me/${botNumber.split('@')[0]}`);
				if (!roof.pilih) xync.sendMessage(roof.p, { text: `Silahkan pilih \n\nBatu🗿\nKertas📄\nGunting✂️` }, { quoted: m });
				if (!roof.pilih2) xync.sendMessage(roof.p2, { text: `Silahkan pilih \n\nBatu🗿\nKertas📄\nGunting✂️` }, { quoted: m });
			}
			let jwb = m.sender == roof.p,
				jwb2 = m.sender == roof.p2;
			let g = /gunting/i,
				b = /batu/i,
				k = /kertas/i,
				reg = /^(gunting|batu|kertas)/i;

			if (jwb && reg.test(m.text) && !roof.pilih && !m.isGroup) {
				roof.pilih = reg.exec(m.text.toLowerCase())[0];
				roof.text = m.text;
				m.reply(`Kamu telah memilih ${m.text} ${!roof.pilih2 ? `\n\nMenunggu lawan memilih` : ''}`);
				if (!roof.pilih2)
					xync.sendMessage(roof.p2, {
						text: '_Lawan sudah memilih_\nSekarang giliran kamu',
					});
			}
			if (jwb2 && reg.test(m.text) && !roof.pilih2 && !m.isGroup) {
				roof.pilih2 = reg.exec(m.text.toLowerCase())[0];
				roof.text2 = m.text;
				m.reply(`Kamu telah memilih ${m.text} ${!roof.pilih ? `\n\nMenunggu lawan memilih` : ''}`);
				if (!roof.pilih)
					xync.sendMessage(roof.p, {
						text: '_Lawan sudah memilih_\nSekarang giliran kamu',
					});
			}
			let stage = roof.pilih;
			let stage2 = roof.pilih2;
			if (roof.pilih && roof.pilih2) {
				if (b.test(stage) && g.test(stage2)) win = roof.p;
				else if (b.test(stage) && k.test(stage2)) win = roof.p2;
				else if (g.test(stage) && k.test(stage2)) win = roof.p;
				else if (g.test(stage) && b.test(stage2)) win = roof.p2;
				else if (k.test(stage) && b.test(stage2)) win = roof.p;
				else if (k.test(stage) && g.test(stage2)) win = roof.p2;
				else if (stage == stage2) tie = true;
				db.users[roof.p == win ? roof.p : roof.p2].limit += tie ? 0 : 3;
				db.users[roof.p == win ? roof.p : roof.p2].money += tie ? 0 : 3000;
				xync.sendMessage(
					roof.asal,
					{
						text: `_*Hasil Suit*_${tie ? '\nSERI' : ''}\n\n@${roof.p.split('@')[0]} (${roof.text}) ${tie ? '' : roof.p == win ? ` Menang \n` : ` Kalah \n`}\n@${roof.p2.split('@')[0]} (${roof.text2}) ${tie ? '' : roof.p2 == win ? ` Menang \n` : ` Kalah \n`}\n\nPemenang Mendapatkan\n*Hadiah :* Uang(3000) & Limit(3)`.trim(),
						mentions: [roof.p, roof.p2],
					},
					{ quoted: m },
				);
				delete suit[roof.id];
			}
		}

		// Tebak Bomb
		let pilih = '🌀',
			bomb = '💣';
		if (m.sender in tebakbom) {
			if (!/^[1-9]|10$/i.test(body) && !isCmd && !isCreator) return !0;
			let index = parseInt(body) - 1;
			if (tebakbom[m.sender].petak[index] === 1 || tebakbom[m.sender].petak[index] === 3) return !0;
			if (tebakbom[m.sender].petak[index] === 2) {
				tebakbom[m.sender].petak[index] = 3;
				tebakbom[m.sender].board[index] = bomb;
				tebakbom[m.sender].pick++;
				tebakbom[m.sender].bomb--;
				tebakbom[m.sender].nyawa.pop();
				let brd = tebakbom[m.sender].board;
				if (tebakbom[m.sender].nyawa.length < 1) {
					await m.reply(`*GAME TELAH BERAKHIR*\nKamu terkena bomb\n\n ${brd.join('')}\n\n*Terpilih :* ${tebakbom[m.sender].pick}\n_Pengurangan Limit : 1_`);
					delete tebakbom[m.sender];
				} else m.reply(`*PILIH ANGKA*\n\nKamu terkena bomb\n ${brd.join('')}\n\nTerpilih: ${tebakbom[m.sender].pick}\nSisa nyawa: ${tebakbom[m.sender].nyawa.join('')}`);
				return !0;
			}
			if (tebakbom[m.sender].petak[index] === 0) {
				tebakbom[m.sender].petak[index] = 1;
				tebakbom[m.sender].board[index] = pilih;
				tebakbom[m.sender].pick++;
				tebakbom[m.sender].lolos--;
				let brd = tebakbom[m.sender].board;
				if (tebakbom[m.sender].lolos < 1) {
					db.users[m.sender].money += 6000;
					await m.reply(`*KAMU HEBAT ಠ⁠ᴥ⁠ಠ*\n\n${brd.join('')}\n\n*Terpilih :* ${tebakbom[m.sender].pick}\n*Sisa nyawa :* ${tebakbom[m.sender].nyawa.join('')}\n*Bomb :* ${tebakbom[m.sender].bomb}\nBonus Money 💰 *+6000*`);
					delete tebakbom[m.sender];
				} else m.reply(`*PILIH ANGKA*\n\n${brd.join('')}\n\nTerpilih : ${tebakbom[m.sender].pick}\nSisa nyawa : ${tebakbom[m.sender].nyawa.join('')}\nBomb : ${tebakbom[m.sender].bomb}`);
			}
		}

		// Game
		const games = {
			tebaklirik,
			tekateki,
			tebaklagu,
			tebakkata,
			kuismath,
			susunkata,
			tebakkimia,
			caklontong,
			tebakangka,
			tebaknegara,
			tebakgambar,
			tebakbendera,
		};
		for (let gameName in games) {
			let game = games[gameName];
			let id = iGame(game, m.chat);
			if ((!isCmd || isCreator) && m.quoted && id == m.quoted.id) {
				if (game[m.chat + id]?.jawaban) {
					if (gameName == 'kuismath') {
						let jawaban = game[m.chat + id].jawaban;
						const difficultyMap = {
							noob: 1,
							easy: 1.5,
							medium: 2.5,
							hard: 4,
							extreme: 5,
							impossible: 6,
							impossible2: 7,
						};
						let randMoney = difficultyMap[kuismath[m.chat + id].mode];
						if (!isNaN(budy)) {
							if (budy.toLowerCase() == jawaban) {
								db.users[m.sender].money += randMoney * 1000;
								await m.reply(`Jawaban Benar 🎉\nBonus Money 💰 *+${randMoney * 1000}*`);
								delete kuismath[m.chat + id];
							} else m.reply('*Jawaban Salah!*');
						}
					} else {
						let jawaban = game[m.chat + id].jawaban;
						let jawabBenar = /tekateki|tebaklirik|tebaklagu|tebakkata|tebaknegara|tebakbendera/.test(gameName) ? similarity(budy.toLowerCase(), jawaban) >= almost : budy.toLowerCase() == jawaban;
						let bonus = gameName == 'caklontong' ? 9999 : gameName == 'tebaklirik' ? 4299 : gameName == 'susunkata' ? 2989 : 3499;
						if (jawabBenar) {
							db.users[m.sender].money += bonus * 1;
							await m.reply(`Jawaban Benar 🎉\nBonus Money 💰 *+${bonus}*`);
							delete game[m.chat + id];
						} else m.reply('*Jawaban Salah!*');
					}
				}
			}
		}

		// Family 100
		if (m.chat in family100) {
			if (m.quoted && m.quoted.id == family100[m.chat].id && !isCmd) {
				let room = family100[m.chat];
				let teks = budy.toLowerCase().replace(/[^\w\s\-]+/, '');
				let isSurender = /^((me)?nyerah|surr?ender)$/i.test(teks);
				if (!isSurender) {
					let index = room.jawaban.findIndex(v => v.toLowerCase().replace(/[^\w\s\-]+/, '') === teks);
					if (room.terjawab[index]) return !0;
					room.terjawab[index] = m.sender;
				}
				let isWin = room.terjawab.length === room.terjawab.filter(v => v).length;
				let caption = `Jawablah Pertanyaan Berikut :\n${room.soal}\n\n\nTerdapat ${room.jawaban.length} Jawaban ${room.jawaban.find(v => v.includes(' ')) ? `(beberapa Jawaban Terdapat Spasi)` : ''}\n${isWin ? `Semua Jawaban Terjawab` : isSurender ? 'Menyerah!' : ''}\n${Array.from(room.jawaban, (jawaban, index) => {
					return isSurender || room.terjawab[index] ? `(${index + 1}) ${jawaban} ${room.terjawab[index] ? '@' + room.terjawab[index].split('@')[0] : ''}`.trim() : false;
				})
					.filter(v => v)
					.join('\n')}\n${isSurender ? '' : `Perfect Player`}`.trim();
				m.reply(caption);
				if (isWin || isSurender) delete family100[m.chat];
			}
		}

		// Chess
		const validPromotions = {
			q: 'q',
			queen: 'q',
			menteri: 'q',
			r: 'r',
			rook: 'r',
			benteng: 'r',
			b: 'b',
			bishop: 'b',
			gajah: 'b',
			mentri: 'b',
			n: 'n',
			knight: 'n',
			kuda: 'n',
		};
		if ((!isCmd || isCreator) && m.sender in chess) {
			if (m.quoted && chess[m.sender].id == m.quoted.id && chess[m.sender].turn == m.sender && chess[m.sender].botMode) {
				if (!(chess[m.sender] instanceof Chess)) {
					const savedData = chess[m.sender];
					chess[m.sender] = new Chess(savedData._fen);
					Object.assign(chess[m.sender], {
						id: savedData.id,
						turn: savedData.turn,
						botMode: savedData.botMode,
						time: savedData.time,
						_fen: savedData._fen,
					});
				}
				if (chess[m.sender].isCheckmate() || chess[m.sender].isDraw() || chess[m.sender].isGameOver()) {
					const status = chess[m.sender].isCheckmate() ? 'Checkmate' : chess[m.sender].isDraw() ? 'Draw' : 'Game Over';
					delete chess[m.sender];
					return m.reply(`♟Game ${status}\nPermainan dihentikan`);
				}
				const [from, to, promotion] = budy.toLowerCase().split(' ');
				if (!from || !to || from.length !== 2 || to.length !== 2) return m.reply('Format salah! Gunakan: e2 e4\nAtau: c7 c8 q (untuk promosi)');
				const promo = validPromotions[promotion] || 'q';
				try {
					chess[m.sender].move({ from, to, promotion: promo });
				} catch (e) {
					if (chess[m.sender].isCheck()) {
						return m.reply(`⚠️ Langkah Tidak Valid @${m.sender.split('@')[0]}!\n\nRaja tim kamu sedang di-SKAK! Fokus selamatkan raja dulu.`);
					}
					return m.reply('Langkah Tidak Valid!');
				}

				if (chess[m.sender].isGameOver()) {
					delete chess[m.sender];
					return m.reply(`♟Permainan Selesai\nPemenang: @${m.sender.split('@')[0]}`);
				}
				const moves = chess[m.sender].moves({ verbose: true });
				const botMove = moves[Math.floor(Math.random() * moves.length)];
				chess[m.sender].move(botMove);
				chess[m.sender]._fen = chess[m.sender].fen();
				chess[m.sender].time = Date.now();

				if (chess[m.sender].isGameOver()) {
					delete chess[m.sender];
					return m.reply(`♟Permainan Selesai\nPemenang: BOT`);
				}
				const encodedFen = encodeURI(chess[m.sender]._fen);
				const boardUrls = [`https://www.chess.com/dynboard?fen=${encodedFen}&size=3&coordinates=inside`, `https://www.chess.com/dynboard?fen=${encodedFen}&board=graffiti&piece=graffiti&size=3&coordinates=inside`, `https://chessboardimage.com/${encodedFen}.png`, `https://backscattering.de/web-boardimage/board.png?fen=${encodedFen}&coordinates=true&size=765`, `https://fen2image.chessvision.ai/${encodedFen}/`];
				for (let url of boardUrls) {
					try {
						const { data } = await axios.get(url, {
							responseType: 'arraybuffer',
						});
						let { key } = await m.reply({
							image: data,
							caption: `♟️CHESS GAME (vs BOT)\n\nLangkahmu: ${from} → ${to}\nLangkah bot: ${botMove.from} → ${botMove.to}\n\nGiliranmu berikutnya!\nExample: e2 e4`,
							mentions: [m.sender],
						});
						chess[m.sender].id = key.id;
						break;
					} catch (e) {}
				}
			} else if (chess[m.sender].time && Date.now() - chess[m.sender].time >= 3600000) {
				delete chess[m.sender];
				return m.reply(`♟Waktu Habis!\nPermainan dihentikan`);
			}
		}
		if (m.isGroup && (!isCmd || isCreator) && m.chat in chess) {
			if (m.quoted && chess[m.chat].id == m.quoted.id && [chess[m.chat].player1, chess[m.chat].player2].includes(m.sender)) {
				if (!(chess[m.chat] instanceof Chess)) {
					const savedData = chess[m.sender];
					chess[m.chat] = new Chess(savedData._fen);
					Object.assign(chess[m.chat], {
						id: savedData.id,
						turn: savedData.turn,
						player1: savedData.player1,
						player2: savedData.player2,
						start: savedData.start,
						acc: savedData.acc,
						time: savedData.time,
						_fen: savedData._fen,
					});
				}
				if (chess[m.chat].isCheckmate() || chess[m.chat].isDraw() || chess[m.chat].isGameOver()) {
					const status = chess[m.chat].isCheckmate() ? 'Checkmate' : chess[m.chat].isDraw() ? 'Draw' : 'Game Over';
					delete chess[m.chat];
					return m.reply(`♟Game ${status}\nPermainan dihentikan`);
				}
				const [from, to, promotion] = budy.toLowerCase().split(' ');
				if (!from || !to || from.length !== 2 || to.length !== 2) return m.reply('Format salah! Gunakan: e2 e4\nAtau: c7 c8 q (untuk promosi)');
				if ([chess[m.chat].player1, chess[m.chat].player2].includes(m.sender) && chess[m.chat].turn === m.sender) {
					const promo = validPromotions[promotion] || 'q';
					try {
						chess[m.chat].move({ from, to, promotion: promo });
					} catch (e) {
						if (chess[m.chat].isCheck()) {
							return m.reply(`⚠️ Langkah Tidak Valid @${m.sender.split('@')[0]}!\n\nRaja tim kamu sedang di-SKAK! Fokus selamatkan raja dulu.`);
						}
						return m.reply('Langkah Tidak Valid!');
					}
					chess[m.chat].time = Date.now();
					chess[m.chat]._fen = chess[m.chat].fen();
					const isPlayer2 = chess[m.chat].player2 === m.sender;
					const nextPlayer = isPlayer2 ? chess[m.chat].player1 : chess[m.chat].player2;
					const encodedFen = encodeURI(chess[m.chat]._fen);
					const boardUrls = [`https://www.chess.com/dynboard?fen=${encodedFen}&size=3&coordinates=inside${!isPlayer2 ? '&flip=true' : ''}`, `https://www.chess.com/dynboard?fen=${encodedFen}&board=graffiti&piece=graffiti&size=3&coordinates=inside${!isPlayer2 ? '&flip=true' : ''}`, `https://chessboardimage.com/${encodedFen}${!isPlayer2 ? '-flip' : ''}.png`, `https://backscattering.de/web-boardimage/board.png?fen=${encodedFen}&coordinates=true&size=765${!isPlayer2 ? '&orientation=black' : ''}`, `https://fen2image.chessvision.ai/${encodedFen}/${!isPlayer2 ? '?pov=black' : ''}`];
					for (let url of boardUrls) {
						try {
							const { data } = await axios.get(url, {
								responseType: 'arraybuffer',
							});
							let { key } = await m.reply({
								image: data,
								caption: `♟️CHESS GAME\n\nGiliran: @${nextPlayer.split('@')[0]}\n\nReply Pesan Ini untuk lanjut bermain!\nExample: from to -> b1 c3`,
								mentions: [nextPlayer],
							});
							chess[m.chat].turn = nextPlayer;
							chess[m.chat].id = key.id;
							break;
						} catch (e) {}
					}
				}
			} else if (chess[m.chat].time && Date.now() - chess[m.chat].time >= 3600000) {
				delete chess[m.chat];
				return m.reply(`♟Waktu Habis!\nPermainan dihentikan`);
			}
		}

		// Ular Tangga
		if (m.isGroup && (!isCmd || isCreator) && m.chat in ulartangga) {
			if (m.quoted && ulartangga[m.chat].id == m.quoted.id) {
				if (!(ulartangga[m.chat] instanceof SnakeLadder)) {
					ulartangga[m.chat] = Object.assign(new SnakeLadder(ulartangga[m.chat]), ulartangga[m.chat]);
				}
				if (/^(roll|kocok)/i.test(budy.toLowerCase())) {
					const player = ulartangga[m.chat].players.findIndex(a => a.id == m.sender);
					if (ulartangga[m.chat].turn !== player) return m.reply('Bukan Giliranmu!');
					const roll = ulartangga[m.chat].rollDice();
					await m.reply(`https://raw.githubusercontent.com/nazedev/database/master/games/images/dice/roll-${roll}.webp`);
					ulartangga[m.chat].nextTurn();
					ulartangga[m.chat].players[player].move += roll;
					if (ulartangga[m.chat].players[player].move > 100) ulartangga[m.chat].players[player].move = 100 - (ulartangga[m.chat].players[player].move - 100);
					let teks = `🐍🪜Warna: ${['Merah', 'Biru Muda', 'Kuning', 'Hijau', 'Ungu', 'Jingga', 'Biru Tua', 'Putih'][player]} -> ${ulartangga[m.chat].players[player].move}\n`;
					if (Object.keys(ulartangga[m.chat].map.move).includes(ulartangga[m.chat].players[player].move.toString())) {
						teks += ulartangga[m.chat].players[player].move > ulartangga[m.chat].map.move[ulartangga[m.chat].players[player].move] ? 'Kamu Termakan Ular!\n' : 'Kamu Naik Tangga\n';
						ulartangga[m.chat].players[player].move = ulartangga[m.chat].map.move[ulartangga[m.chat].players[player].move];
					}
					const newMap = await ulartangga[m.chat].drawBoard(ulartangga[m.chat].map.url, ulartangga[m.chat].players);
					if (ulartangga[m.chat].players[player].move === 100) {
						teks += `@${m.sender.split('@')[0]} Menang\nHadiah:\n- Limit + 50\n- Money + 100.000`;
						addLimit(50, m.sender, db);
						addMoney(100000, m.sender, db);
						delete ulartangga[m.chat];
						return m.reply({
							image: newMap,
							caption: teks,
							mentions: [m.sender],
						});
					}
					let { key } = await m.reply({
						image: newMap,
						caption: teks + `Giliran: @${ulartangga[m.chat].players[ulartangga[m.chat].turn].id.split('@')[0]}`,
						mentions: [m.sender, ulartangga[m.chat].players[ulartangga[m.chat].turn].id],
					});
					ulartangga[m.chat].id = key.id;
				} else m.reply('Example: roll/kocok');
			} else if (ulartangga[m.chat].time && Date.now() - ulartangga[m.chat].time >= 7200000) {
				delete ulartangga[m.chat];
				return m.reply(`🐍🪜Waktu Habis!\nPermainan dihentikan`);
			}
		}

		// Menfes & Room Ai
		if (!m.isGroup && (!isCmd || isCreator)) {
			if (menfes[m.sender] && m.key.remoteJid !== 'status@broadcast' && m.msg) {
				if (m.type !== 'conversation')
					m.msg.contextInfo = {
						quotedMessage: {
							conversation: `*Pesan Dari ${menfes[m.sender].nama ? menfes[m.sender].nama : 'Seseorang'}*`,
						},
						key: {
							remoteJid: '0@s.whatsapp.net',
							fromMe: false,
							participant: '0@s.whatsapp.net',
						},
					};
				const pesan =
					m.type === 'conversation'
						? {
								extendedTextMessage: {
									text: m.msg,
									contextInfo: {
										quotedMessage: {
											conversation: `*Pesan Dari ${menfes[m.sender].nama ? menfes[m.sender].nama : 'Seseorang'}*`,
										},
										key: {
											remoteJid: '0@s.whatsapp.net',
											fromMe: false,
											participant: '0@s.whatsapp.net',
										},
									},
								},
							}
						: { [m.type]: m.msg };
				await xync.relayMessage(menfes[m.sender].tujuan, pesan, {});
			}
			if (chat_ai[m.sender] && m.key.remoteJid !== 'status@broadcast') {
				if (!/^(del((room|c|hat)ai)|>|<$)$/i.test(command) && budy) {
					chat_ai[m.sender].push({ role: 'user', content: budy });
					if (chat_ai[m.sender].length > 20) chat_ai[m.sender].shift();
					let hasil;
					try {
						hasil = await fetchApi(
							'/ai/chat4',
							{
								messages: chat_ai[m.sender],
								prompt: budy,
							},
							{ method: 'POST' },
						);
					} catch (e) {
						hasil = 'Gagal Mengambil Respon, Website sedang gangguan';
					}
					const response = hasil?.result?.message || 'Maaf, saya tidak mengerti.';
					chat_ai[m.sender].push({ role: 'assistant', content: response });
					if (chat_ai[m.sender].length > 20) chat_ai[m.sender].shift();
					await m.reply(response);
				}
			}
		}

		// Afk
		let mentionUser = [...new Set([...(m.mentionedJid || []), ...(m.quoted ? [m.quoted.sender] : [])])];
		for (let jid of mentionUser) {
			let user = db.users[jid];
			if (!user) continue;
			let afkTime = user.afkTime;
			if (!afkTime || afkTime < 0) continue;
			let reason = user.afkReason || '';
			m.reply(`Jangan tag dia!\nDia sedang AFK ${reason ? 'dengan alasan ' + reason : 'tanpa alasan'}\nSelama ${clockString(new Date() - afkTime)}`.trim());
		}
		if (db.users[m.sender].afkTime > -1) {
			let user = db.users[m.sender];
			m.reply(`@${m.sender.split('@')[0]} berhenti AFK${user.afkReason ? ' setelah ' + user.afkReason : ''}\nSelama ${clockString(new Date() - user.afkTime)}`);
			user.afkTime = -1;
			user.afkReason = '';
		}

		// Tombol
		const isRennButton = (body && body.startsWith('.RENN-')) || (body && body.startsWith('FIORA-'));
		if (isRennButton) {
			if (!db.users[m.sender].fiora) db.users[m.sender].fiora = { logs: [] };
			db.users[m.sender].fiora.logs = db.users[m.sender].fiora.logs.slice(-7);

			try {
				await fiora('button_click', body, xync, m);
			} catch (e) {
				m.reply(`Eror:\n${e.message}`);
			}
			return;
		}

		// Follow
		const isWajibFollow = set.wajibfollow || false;
		const linkSaluran = 'https://whatsapp.com/channel/0029Vb7X3BAAO7RLyCr8wd1u';

		const isPrivateChat = m.chat.endsWith('@s.whatsapp.net') && m.chat !== 'status@broadcast';

		if (isCmd && isWajibFollow && !isCreator && !m.isBot && isPrivateChat) {
			if (!db.users[m.sender]) db.users[m.sender] = {};

			const allowedCmds = ['verifikasi', 'verif'];

			if (!db.users[m.sender].followedChannel && !allowedCmds.includes(command)) {
				let msgFollow = `*Kamu wajib follow saluran WhatsApp kami untuk memakai bot ini di pc!.*\n\nCara verif:\n1. Follow saluran di atas.\n2. Screenshot (SS) bukti kamu sudah follow.\n3. Kirim gambar SS tersebut ke bot dengan caption *${prefix}verifikasi*\n\n*Link:* ${linkSaluran}\n_Owner akan mengecek dan meng-ACC SS kamu._`;

				await xync.sendMessage(m.chat, { text: msgFollow }, { quoted: m });
				return;
			}
		}

		if (isCmd && global.plugins[command]) {
			try {
				await global.plugins[command].execute(xync, m, args, text);
			} catch (e) {
				console.error(`Error ${command}:`, e);
				m.reply('Eror: ${err.message}');
			}
		}

		switch (fileSha256 || command) {
			// Tempat Add Case
			case '19rujxl1e':
				{
					console.log('.');
				}
				break;

			// Owner
				case 'vcard':
	    		{
				if (!m.isGroup) return m.reply(global.mess.group);
				if (!args[0]) {
					return m.reply(`Example:\n- ${prefix + command} -a\n- ${prefix + command} -s`);
				}
		
				let participants = m.metadata?.participants || [];
				if (participants.length === 0) return;
		
				let contactsArray = [];
				let displayNameText = '';
		
				if (args[0].toLowerCase() === '-a') {
					let admins = participants.filter(v => v.admin !== null).map(v => v.phoneNumber || v.id);
					if (admins.length === 0) return;
		
					admins.forEach((jid, index) => {
						let num = jid.split('@')[0];
						let name = `Admin ${index + 1}`;
						contactsArray.push({
							vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;${name};;;\nFN:${name}\nitem1.TEL;waid=${num}:+${num}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
						});
					});
					displayNameText = `${admins.length} Kontak Admin`;
		
				} else if (args[0].toLowerCase() === '-s') {
					participants.forEach((v, index) => {
						let num = (v.phoneNumber || v.id).split('@')[0];
						let name = `Member ${index + 1}`;
						contactsArray.push({
							vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;${name};;;\nFN:${name}\nitem1.TEL;waid=${num}:+${num}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
						});
					});
					displayNameText = `${participants.length} Member`;
		
				} else {
					return;
				}
		
				await xync.sendMessage(m.chat, {
					contacts: {
						displayName: displayNameText,
						contacts: contactsArray,
					},
				});
			}
			break;
			// Sistem Verif
			case 'verifikasi':
			case 'verif':
				{
					if (db.users[m.sender]?.followedChannel) return m.reply('Kamu sudah terverifikasi, cuy! Nggak perlu SS lagi.');

					let isImage = /image/.test(mime);
					if (!isImage) return m.reply(`Kirim foto screenshot bukti follow saluran dengan caption *${prefix + command}*!`);

					m.reply('Terkirim! Bukti SS kamu sedang diteruskan ke Admin/Owner. Mohon tunggu proses ACC ya desu~');

					const fs = require('fs');
					let imgBuffer = await xync.downloadAndSaveMediaMessage(qmsg);

					let targetAdmin = '120363412981231507@g.us';

					let captionToOwner = `*REQUEST VERIFIKASI BARU*\n\nDari: @${m.sender.split('@')[0]}\n\nMohon cek apakah SS ini valid dan dia beneran udah follow saluran kita.`;

					try {
						await xync.sendListMsg(targetAdmin, {
							image: fs.readFileSync(imgBuffer),
							caption: captionToOwner,
							mentions: [m.sender],
							buttons: [
								{
									name: 'quick_reply',
									buttonParamsJson: JSON.stringify({
										display_text: 'Terima',
										id: `${prefix}accverif ${m.sender}`,
									}),
								},
								{
									name: 'quick_reply',
									buttonParamsJson: JSON.stringify({
										display_text: 'Tolak',
										id: `${prefix}tolakverif ${m.sender}`,
									}),
								},
							],
						});
					} catch (e) {
						console.error(e);
						m.reply('Gagal mengirim ke Admin.');
					} finally {
						if (fs.existsSync(imgBuffer)) fs.unlinkSync(imgBuffer);
					}
				}
				break;
			case 'accverif':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					let target = text.trim();
					if (!target) return m.reply('Format salah! ID target tidak ditemukan.');

					if (!db.users[target]) db.users[target] = {};
					db.users[target].followedChannel = true; 

					m.reply(`Berhasil ACC verifikasi untuk @${target.split('@')[0]}! ✅`, { mentions: [target] });

					await xync.sendMessage(target, {
						text: '*VERIFIKASI DITERIMA!*\nOwner telah menyetujui bukti screenshot kamu. Selamat menggunakan bot desu~',
					});
				}
				break;
			case 'tolakverif':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					let target = text.trim();
					if (!target) return m.reply('Format salah! ID target tidak ditemukan.');

					m.reply(`Berhasil MENOLAK verifikasi untuk @${target.split('@')[0]}! ❌`, { mentions: [target] });

					await xync.sendMessage(target, {
						text: '*VERIFIKASI DITOLAK!*\n\nScreenshot bukti follow kamu dinilai tidak valid, buram, palsu, atau belum benar-benar mem-follow saluran.\n\nSilakan kirim ulang bukti screenshot yang benar menggunakan perintah *.verifikasi*.',
					});
				}
				break;
			case 'ai2':
			case 'ay':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Mau tanya apa ke ai?\nContoh: ${prefix + command} bagi rekomendasi film aksi`);

					if (!db.users[m.sender].fiora) db.users[m.sender].fiora = { logs: [] };
					db.users[m.sender].fiora.logs = db.users[m.sender].fiora.logs.slice(-7);

					try {
						await fiora('chat', text, xync, m);
						setLimit(m, db);
					} catch (e) {
						console.error('[FIORA ERROR]', e);
						db.users[m.sender].fiora.logs = []; 

						await m.reply('Ada yang salah desu~ coba lagi ya!\n\nError: ' + e.message);
					}
				}
				break;
			case 'countdown':
			case 'sisa':
				{
					if (!db.users[m.sender].countdown) db.users[m.sender].countdown = 0;
					let input = text ? text.toLowerCase().trim() : '';

					if (input === 'waktu' || input === '') {
						let targetTime = db.users[m.sender].countdown;
						if (targetTime === 0) return m.reply(`No active countdown. Ketik *${prefix + command} 7d* buat set timer.`);

						let now = Date.now();
						let diffMs = targetTime - now;

						if (diffMs <= 0) {
							db.users[m.sender].countdown = 0;
							return m.reply(`*Bott Off*`);
						}

						let durasi = moment.duration(diffMs);
						let hari = Math.floor(durasi.asDays());
						let jam = durasi.hours();
						let menit = durasi.minutes();
						let detik = durasi.seconds();

						return m.reply(`*Sisa waktu*\n- *${hari}* Days\n- *${jam}* Hours\n- *${menit}* Minutes\n- *${detik}* Second_`);
					}

					if (input === 'hapus' || input === 'del') {
						db.users[m.sender].countdown = 0;
						return m.reply(`Countdown successfully deleted!`);
					}

					if (input.endsWith('d')) {
						let days = parseInt(input);
						if (isNaN(days) || days <= 0) return m.reply('Invalid input, bro!');

						let targetTime = moment().tz(global.timezone).add(days, 'days');
						db.users[m.sender].countdown = targetTime.valueOf();

						return m.reply(`*COUNTDOWN SET!*\n\nTarget: *${days} Days*\nEnds on: *${targetTime.locale(global.locale).format('LLLL')}*\n\n_Ketik *${prefix + command} waktu* buat liat sisa waktu._`);
					}
				}
				break;
			case 'mutev2':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!m.isGroup) return;

					let target = m.mentionedJid?.[0] || m.quoted?.sender || (text ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : '');
					if (!target || target === '@s.whatsapp.net') return;

					if (target === botNumber) return;
					if (ownerNumber.map(v => v + '@s.whatsapp.net').includes(target)) return; 

					if (!db.groups[m.chat].bungkam) db.groups[m.chat].bungkam = [];

					if (db.groups[m.chat].bungkam.includes(target)) return;

					db.groups[m.chat].bungkam.push(target);
				}
				break;
			case 'unmutev2':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!m.isGroup) return;

					let target = m.mentionedJid?.[0] || m.quoted?.sender || (text ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : '');
					if (!target || target === '@s.whatsapp.net') return;

					if (!db.groups[m.chat].bungkam) db.groups[m.chat].bungkam = [];

					let index = db.groups[m.chat].bungkam.indexOf(target);
					if (index === -1) return;

					db.groups[m.chat].bungkam.splice(index, 1);
				}
			break;
			case 'cekbio':
			case 'getbio':
			case 'bio':
				{
					let linkGcMatch = text ? text.match(/chat\.whatsapp\.com\/([\w\d]+)/i) : null;

					if (linkGcMatch) {
						try {
							let info = await xync.groupGetInviteInfo(linkGcMatch[1]);
							let descText = info.desc || 'Grup ini belum memiliki deskripsi/bio.';

							let replyMsg = `*INFO DESKRIPSI / BIO GRUP*\n\n`;
							replyMsg += `*Nama Grup:* ${info.subject}\n`;
							replyMsg += `*ID Grup:* ${info.id}\n\n`;
							replyMsg += `*Deskripsi:*\n${descText}`;

							return await xync.sendListMsg(
								m.chat,
								{
									text: replyMsg,
									footer: '© Renn.dev',
									buttons: [
										{
											name: 'cta_copy',
											buttonParamsJson: JSON.stringify({
												display_text: 'Copy Deskripsi',
												id: 'copy_desc',
												copy_code: descText,
											}),
										},
									],
								},
								{ quoted: m },
							);
						} catch (e) {
							return m.reply('Gagal mengambil info dari link! Mungkin link sudah direset atau kedaluwarsa.');
						}
					}

					let isTargetGc = ['gc', 'grup', 'group'].includes(text?.toLowerCase()) && m.isGroup ? m.chat : text?.includes('@g.us') ? text.trim() : /^\d{15,25}$/.test(text?.trim()) ? text.trim() + '@g.us' : null;

					if (isTargetGc) {
						try {
							let metadata = await xync.groupMetadata(isTargetGc);
							let descText = metadata.desc || 'Grup ini belum memiliki deskripsi/bio.';

							let replyMsg = `*INFO DESKRIPSI / BIO GRUP*\n\n`;
							replyMsg += `*Nama Grup:* ${metadata.subject}\n`;
							replyMsg += `*ID Grup:* ${metadata.id}\n\n`;
							replyMsg += `*Deskripsi:*\n${descText}`;

							return await xync.sendListMsg(
								m.chat,
								{
									text: replyMsg,
									footer: '© Renn.dev',
									buttons: [
										{
											name: 'cta_copy',
											buttonParamsJson: JSON.stringify({
												display_text: 'Copy Deskripsi',
												id: 'copy_desc',
												copy_code: descText,
											}),
										},
									],
								},
								{ quoted: m },
							);
						} catch (e) {
							return m.reply('Gagal mengambil info grup! Pastikan ID valid atau bot sudah masuk ke grup.');
						}
					}

					let target = m.quoted ? m.quoted.sender : m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : text ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : m.sender;

					if (!target || target === '@s.whatsapp.net') return m.reply(`*Format Salah!*\n\n• Cek via Link GC: *${prefix + command} https://chat.whatsapp.com/xxx*\n• Cek via ID GC: *${prefix + command} 120363xxx@g.us*\n• Cek Bio User: *${prefix + command} @tag* atau *${prefix + command} 628xxx*`);

					try {
						let bioData = await xync.fetchStatus(target);

						if (!bioData || !bioData.status) {
							return m.reply('Gagal mengambil bio. Target memprivasi bio atau belum memasang bio.');
						}

						let dateStr = bioData.setAt ? moment(bioData.setAt).locale(global.locale).format('DD MMMM YYYY, HH:mm') : 'Tidak diketahui';

						let replyMsg = `*INFO BIO WHATSAPP*\n\n`;
						replyMsg += `*Nomor:* +${target.split('@')[0]}\n`;
						replyMsg += `*Bio:* ${bioData.status}\n`;
						replyMsg += `*Diperbarui:* ${dateStr}`;

						await xync.sendListMsg(
							m.chat,
							{
								text: replyMsg,
								footer: '© Renn.dev',
								buttons: [
									{
										name: 'cta_copy',
										buttonParamsJson: JSON.stringify({
											display_text: 'Copy Bio',
											id: 'copy_bio',
											copy_code: bioData.status,
										}),
									},
								],
							},
							{ quoted: m },
						);
					} catch (error) {
						console.error(error);
						m.reply('Gagal! Pastikan target valid atau tidak memprivasi status bionya.');
					}
				}
				break;
			case 'idch': 
            case 'idsaluran': 
            case 'idchannel': {
			if (!text) return m.reply(`*Format Salah!*\n\nKirim perintah beserta link saluran WhatsApp.\nContoh: ${prefix + command} https://whatsapp.com/channel/0029VaWOkNm7DAWtkvkJBK43`)
			const channelRegex = /whatsapp\.com\/channel\/([\w\d]+)/i;
			const match = text.match(channelRegex);

			if (!match) {
				return m.reply('❌ Link tidak valid! Pastikan itu link saluran WhatsApp yang benar.');
			}

			const inviteCode = match[1];

			try {
				const channelInfo = await xync.newsletterMsg(inviteCode);
				
				const channelId = channelInfo.id;
				const channelName = channelInfo.thread_metadata.name.text;

				const replyMsg = `*INFORMASI SALURAN*\n\n*Nama:* ${channelName}\n*ID Saluran:* ${channelId}\n\n_Klik tombol di bawah untuk menyalin ID._`;

				await xync.sendListMsg(m.chat, {
					text: replyMsg,
					buttons: [{
						name: 'cta_copy',
						buttonParamsJson: JSON.stringify({
							display_text: 'Salin ID Saluran',
							id: 'copy_idch',
							copy_code: channelId
						})
					}]
				}, { quoted: m });

			} catch (e) {
				console.error(e);
				m.reply('Gagal mengambil info saluran! Mungkin link tersebut sudah tidak valid atau dihapus.');
			}
		}
		break
			case 'idgc':
			case 'cekid':
				{
					try {
						let groupId = '';
						let groupName = '';

						if (text) {
							const linkRegex = /chat\.whatsapp\.com\/([\w\d]*)/i;
							const match = text.match(linkRegex);

							if (!match) {
								return m.reply('Link tidak valid! Pastikan itu link undangan grup WhatsApp yang benar.\n\nContoh: .idgc https://chat.whatsapp.com/ABCDEFG12345');
							}

							const inviteCode = match[1];

							try {
								const groupInfo = await xync.groupGetInviteInfo(inviteCode);
								groupId = groupInfo.id;
								groupName = groupInfo.subject;
							} catch (e) {
								return m.reply('Gagal mengambil info grup! Mungkin link tersebut sudah direset oleh Admin atau sudah kadaluarsa.');
							}
						} else {
							if (!m.isGroup) {
								return m.reply(global.mess.group || 'Perintah tanpa link hanya bisa digunakan di dalam grup!');
							}
							groupId = m.chat;
							groupName = m.metadata?.subject || 'Grup Ini';
						}

						const teksInfo = `*INFORMASI GRUP*\n\n*Nama Grup:* ${groupName}\n*ID Grup:* ${groupId}\n_Klik tombol di bawah untuk menyalin IDnya._`;
						await xync.sendListMsg(
							m.chat,
							{
								text: teksInfo,
								footer: '© Renn.dep',
								buttons: [
									{
										name: 'cta_copy',
										buttonParamsJson: JSON.stringify({
											display_text: 'Salin ID Grup',
											id: 'copy_idgc',
											copy_code: groupId,
										}),
									},
								],
							},
							{ quoted: m },
						);

						m.react('️');
					} catch (error) {
						m.reply(`Terjadi kesalahan: ${error.message}`);
					}
				}
				break;
			case 'swmention':
			case 'statusmention':
			case 'swtag':
				{
					if (!isCreator) return m.reply(global.mess.owner);

					let targetMsg = m.quoted ? m.quoted : m;
					let mime = (targetMsg.msg || targetMsg).mimetype || targetMsg.mtype || '';

					let captionInput = '';
					let targetJids = [];

					if (text.includes('|')) {
						let parts = text.split('|');
						captionInput = parts[0].trim();
						let rawIds = parts.slice(1).join('|').split(',');
						targetJids = rawIds.map(v => v.trim()).filter(Boolean);
					} else {
						let foundJids = text.match(/\d+-\d+@g\.us|\d+@g\.us|\d{15,25}/g) || [];
						if (foundJids.length > 0) {
							targetJids = foundJids;
							captionInput = text.replace(/\d+-\d+@g\.us|\d+@g\.us|\d{15,25}/g, '').trim();
						} else {
							captionInput = text.trim();
							if (m.isGroup) targetJids = [m.chat];
						}
					}

					targetJids = targetJids.map(id => (id.includes('@') ? id : id + '@g.us'));
					targetJids = [...new Set(targetJids)];

					if (targetJids.length === 0) {
						return m.reply(`Masukkan target ID grup!\nContoh:\n${prefix + command} Caption | 1203630xxx@g.us, 1203631xxx@g.us`);
					}

					let finalCaption = captionInput || targetMsg.text || targetMsg.caption || '';

					if (!/image|video/.test(mime) && !finalCaption) {
						return m.reply(`Masukkan teks atau reply gambar/video!\nContoh:\n${prefix + command} Halo | 1203630xxx@g.us`);
					}

					try {
						const { proto, generateWAMessage } = await import('baileys');

						if (!proto?.Message?.ProtocolMessage?.Type?.STATUS_MENTION_MESSAGE) {
							m.react('✖️');
							return m.reply('WAProto (Baileys) versi lama, belum mendukung STATUS_MENTION_MESSAGE.');
						}

						let content = {};
						if (/image|video/.test(mime)) {
							let buffer = await targetMsg.download();
							if (!buffer) throw new Error('Gagal mendownload media.');

							if (/image/.test(mime)) {
								content = { image: buffer, caption: finalCaption };
							} else if (/video/.test(mime)) {
								content = { video: buffer, caption: finalCaption };
							}
						} else {
							content = { text: finalCaption };
						}

						const fetchParticipants = async (...jids) => {
							let results = [];
							for (const jid of jids) {
								try {
									let { participants } = await xync.groupMetadata(jid);
									participants = participants.map(({ id }) => id);
									results = results.concat(participants);
								} catch (e) {
									console.log(`[WARNING] Gagal mengambil member dari GC: ${jid}`);
								}
							}
							return results;
						};

						const mentionStatus = async (jids, content) => {
							const msg = await generateWAMessage('status@broadcast', content, {
								upload: xync.waUploadToServer,
							});
							let statusJidList = [];

							for (const _jid of jids) {
								if (_jid.endsWith('@g.us')) {
									const members = await fetchParticipants(_jid);
									statusJidList.push(...members);
								} else {
									statusJidList.push(_jid);
								}
							}
							statusJidList = [...new Set(statusJidList)];

							await xync.relayMessage(msg.key.remoteJid, msg.message, {
								messageId: msg.key.id,
								statusJidList,
								additionalNodes: [
									{
										tag: 'meta',
										attrs: {},
										content: [
											{
												tag: 'mentioned_users',
												attrs: {},
												content: jids.map(jid => ({
													tag: 'to',
													attrs: { jid },
													content: undefined,
												})),
											},
										],
									},
								],
							});

							for (const jid of jids) {
								let type = jid.endsWith('@g.us') ? 'groupStatusMentionMessage' : 'statusMentionMessage';
								await xync.relayMessage(
									jid,
									{
										[type]: {
											message: {
												protocolMessage: { key: msg.key, type: 25 },
											},
										},
									},
									{
										additionalNodes: [
											{
												tag: 'meta',
												attrs: { is_status_mention: 'true' },
												content: undefined,
											},
										],
									},
								);
							}
							return msg;
						};

						await mentionStatus(targetJids, content);

						m.react('✔️');
						m.reply(`Berhasil membuat status dengan mention ke ${targetJids.length} grup target:\n${targetJids.map(v => '- ' + v).join('\n')}`);
					} catch (error) {
						m.react('✖️');
						m.reply(`Gagal: ${error.message}`);
					}
				}
				break;
			case 'addai':
			case 'addmeta':
				{
					try {
						if (!isCreator) return m.reply(global.mess.owner);
						if (!m.isGroup) return m.reply(global.mess.group);

						const botNumber = await xync.decodeJid(xync.user.id);
						const groupMetadata = await xync.groupMetadata(m.chat);
						const participants = groupMetadata.participants;
						const botMember = participants.find(p => p.id === botNumber);
						const isBotReallyAdmin = botMember?.admin === 'admin' || botMember?.admin === 'superadmin';
						const metaAiJid = '867051314767696@bot';

						await xync.groupParticipantsUpdate(m.chat, [metaAiJid], 'add');
						m.reply('Menambahkan Meta AI ke dalam grup!');
					} catch (error) {
						m.react('✖️');
						m.reply(`Gagal menambahkan Meta AI:\n${error.message || error}`);
					}
				}
				break;
			case 'fakemsg':
			case 'f':
			case '‭':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!m.quoted) return m.reply(`Reply pesan yang ingin diedit secara paksa dengan perintah ${prefix + command}`);
					if (!text) return m.reply(`Masukkan teks pengganti.\nContoh: ${prefix + command} Teks barunya di sini`);

					try {
						const targetId = m.quoted.id;

						const tempEditId = await xync.relayMessage(
							m.chat,
							{
								extendedTextMessage: {
									text: '',
									contextInfo: { isGroupStatus: true },
								},
							},
							{ quoted: m },
						);

						const tempEditId2 = await xync.relayMessage(
							m.chat,
							{
								protocolMessage: {
									key: {
										remoteJid: m.chat,
										fromMe: true,
										id: tempEditId,
									},
									type: 14,
									editedMessage: {
										extendedTextMessage: {
											text: text,
											contextInfo: { isGroupStatus: false },
										},
									},
								},
							},
							{ messageId: targetId },
						);

						const cmdId = m.key.id;

						const tempDelId = await xync.relayMessage(
							m.chat,
							{
								groupStatusMessageV2: {
									message: {
										extendedTextMessage: {
											text: '',
											contextInfo: { isGroupStatus: true },
										},
									},
								},
							},
							{},
						);

						const tempDelId2 = await xync.relayMessage(
							m.chat,
							{
								protocolMessage: {
									key: {
										remoteJid: m.chat,
										fromMe: true,
										id: tempDelId,
									},
									type: 14,
									editedMessage: {
										extendedTextMessage: {
											text: '\0',
											contextInfo: { isGroupStatus: false },
										},
									},
								},
							},
							{ messageId: cmdId },
						);

						await sleep(100);

						await Promise.allSettled([
							xync.sendMessage(m.chat, {
								delete: { remoteJid: m.chat, id: tempEditId, fromMe: true },
							}),
							xync.sendMessage(m.chat, {
								delete: { remoteJid: m.chat, id: tempEditId2, fromMe: true },
							}),
							xync.sendMessage(m.chat, {
								delete: { remoteJid: m.chat, id: tempDelId, fromMe: true },
							}),
							xync.sendMessage(m.chat, {
								delete: { remoteJid: m.chat, id: tempDelId2, fromMe: true },
							}),
						]);
					} catch (e) {
						console.error(e);
						m.react('✖️');
						m.reply(`Gagal memproses: ${e.message}`);
					}
				}
				break;
				case 'd':
				case 'hi':
				case 'hy':
				case 'hay':
				case 'hapus':
					{
						if (!isCreator) return m.reply(global.mess.owner);
				
						try {
							let targets = [];
				
							if (m.quoted) {
								targets.push(m.quoted.id);
							}
				
							targets.push(m.key.id);
				
							if (m.isGroup) {
								for (let stanzaId of targets) {
									const tempId = await xync.relayMessage(
										m.chat,
										{
											groupStatusMessageV2: {
												message: {
													extendedTextMessage: {
														text: '',
														contextInfo: { isGroupStatus: true },
													},
												},
											},
										},
										{}
									);
				
									const tempId2 = await xync.relayMessage(
										m.chat,
										{
											protocolMessage: {
												key: { remoteJid: m.chat, fromMe: true, id: tempId },
												type: 14,
												editedMessage: {
													extendedTextMessage: {
														text: '\0',
														contextInfo: { isGroupStatus: false },
													},
												},
											},
										},
										{ messageId: stanzaId }
									);
				
									await sleep(50);
				
									await Promise.allSettled([
										xync.sendMessage(m.chat, { delete: { remoteJid: m.chat, id: tempId, fromMe: true } }),
										xync.sendMessage(m.chat, { delete: { remoteJid: m.chat, id: tempId2, fromMe: true } }),
									]);
				
									await sleep(50);
								}
							} else {
								for (let stanzaId of targets) {
									await xync.sendMessage(m.chat, {
										delete: { remoteJid: m.chat, fromMe: true, id: stanzaId },
									});
								}
							}
						} catch (e) {
							console.error(e);
						}
					}
			break;
			case 'replaceproto':
			case 'upproto':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!m.quoted) return m.reply(`Reply file index.js (Protobuf) dengan caption ${prefix + command}`);

					const qmsg = m.quoted.msg || m.quoted;
					const mime = qmsg.mimetype || '';
					const fileName = qmsg.fileName || '';

					if (!/document|javascript|text/.test(mime) && !fileName.endsWith('.js')) {
						return m.reply('Pastikan lu me-reply file dokumen berekstensi .js!');
					}

					try {
						const fs = require('fs');
						const path = require('path');

						let buffer = await m.quoted.download();

						const possiblePaths = ['node_modules/baileys/WAProto/index.js'];

						let dest = null;
						for (let p of possiblePaths) {
							let checkPath = path.join(process.cwd(), p);
							if (fs.existsSync(path.dirname(checkPath))) {
								dest = checkPath;
								break;
							}
						}

						if (!dest) {
							return m.reply('Folder WAProto tidak ditemukan! Pastikan library Baileys terinstall dengan benar di server.');
						}

						const backup = dest + 'backupf';
						if (fs.existsSync(dest)) fs.copyFileSync(dest, backup);

						fs.writeFileSync(dest, buffer);

						const sizeKB = (buffer.length / 1024).toFixed(1);
						m.reply(`*Berhasil mengganti Poroto*\n_Note: Silakan restart panel/bot lu dari Pterodactyl!_`);
					} catch (err) {
						console.error(err);
						m.reply(`Gagal memproses file:\n${err.message}`);
					}
				}
				break;
				case 'restart': {
			if (!isCreator) return m.reply(global.mess.owner)
			
			await m.reply(`_♻️ Merestart Bot..._`)
			await sleep(2000) 
			
     			process.exit(1) 
     		}
    		break
			case 'hapusfile':
			case 'deletefile':
			case 'delfile':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!text) return m.reply(`Masukkan nama/path file yang ingin dihapus!\n\nContoh: ${prefix + command} database/sampah.js`);

					const targetFile = path.join(__dirname, text.trim());

					if (!fs.existsSync(targetFile)) return m.reply(`File tidak ditemukan:\n${targetFile}`);

					try {
						const fs = require('fs');
						fs.unlinkSync(targetFile);
						m.reply(`Berhasil menghapus file *${path.basename(targetFile)}* secara permanen !`);
					} catch (err) {
						console.error(err);
						m.reply(`Eror saat menghapus file:\n${err.message}`);
					}
				}
				break;
			case 'buatfile':
			case 'createfile':
			case 'newfile':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!text) return m.reply(`Masukkan nama/path file yang ingin dibuat!\n\nContoh: ${prefix + command} lib/fiturbaru.js\n\n_Note: Kamu bisa sambil reply pesan teks atau file dokumen/JS untuk langsung mengisi file barunya._`);

					const targetFile = path.join(__dirname, text.trim());
					const fs = require('fs');

					if (fs.existsSync(targetFile)) return m.reply(`File *${path.basename(targetFile)}* sudah ada!\nSilakan gunakan perintah *${prefix}gantifile* jika ingin menimpanya.`);

					try {
						const targetDir = path.dirname(targetFile);
						if (!fs.existsSync(targetDir)) {
							fs.mkdirSync(targetDir, { recursive: true });
						}

						let fileContent = '';

						if (m.quoted) {
							const quotedMsg = quoted.msg || quoted;
							const isDocument = quotedMsg.mimetype || quotedMsg.fileName;

							if (isDocument) {
								fileContent = await quoted.download();
							} else if (m.quoted.text) {
								fileContent = m.quoted.text;
							}
						}

						fs.writeFileSync(targetFile, fileContent);

						let balasan = `Berhasil membuat file baru: *${path.basename(targetFile)}*!`;
						if (!fileContent) balasan += `\n_(File dibuat dalam keadaan kosong)_`;

						m.reply(balasan);
					} catch (err) {
						console.error(err);
						m.reply(`Eror saat membuat file:\n${err.message}`);
					}
				}
				break;
			case 'updatefile':
			case 'gantifile':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!m.quoted) return m.reply(`Reply file *.js* dengan caption ${prefix + command}\n\nContoh: reply file xync.js baru dengan caption ${prefix}gantifile\n\nBisa juga target file lain:\n${prefix}gantifile lib/function.js`);

					const quotedMsg = quoted.msg || quoted;
					const fileName = quotedMsg.fileName || '';
					if (!/\.js$/i.test(fileName)) return m.reply('File yang direply harus berekstensi .js');

					const targetFile = text ? path.join(__dirname, text.trim()) : __filename;

					if (!fs.existsSync(targetFile)) return m.reply(`File target tidak ditemukan:\n${targetFile}`);

					try {
						const media = await quoted.download();
						const backupDir = path.join(__dirname, 'backupf');
						if (!fs.existsSync(backupDir)) {
							fs.mkdirSync(backupDir, { recursive: true });
						}

						const backupPath = path.join(backupDir, path.basename(targetFile) + '.bak');
						fs.copyFileSync(targetFile, backupPath);
						fs.writeFileSync(targetFile, media);
						m.reply(`Berhasil mengganti file *${path.basename(targetFile)}*!\n\nBackup lama tersimpan di folder *backupf* dengan nama *${path.basename(backupPath)}*.`);
					} catch (err) {
						console.error(err);
						m.reply(`Eror:\n${err.message}`);
					}
				}
				break;
			case 'shutdown':
			case 'off':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					m.reply(`*[BOT] Process Shutdown...*`).then(() => {
						process.exit(0);
					});
				}
				break;
			case 'update':
			case 'upgrade':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					m.reply(`*[BOT] Process Update And Upgrade...*`).then(() => {
						try {
							runUpdate();
						} catch (e) {
							process.exit(0);
						}
					});
				}
				break;
			case 'byq':
			case 'q':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!m.quoted) return m.reply(global.mess.quoted);
					delete m.quoted.chat;
					let anya = Object.values(m.quoted.fakeObj())[1];
					m.reply(`const byt = ${JSON.stringify(anya.message, null, 2)}\nxync.relayMessage(m.chat, byt, {})`);
				}
				break;
			case 'setbio':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!text) return m.reply(global.mess.text);
					xync.setStatus(q);
					m.reply(`*Bio telah di ganti menjadi ${q}*`);
				}
				break;
			case 'setppbot':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!/image/.test(quoted.type)) return m.reply(`Reply Image With Caption ${prefix + command}`);
					let media = await quoted.download();
					let { img } = await generateProfilePicture(media, text.length > 0 ? null : 512);
					await xync.query({
						tag: 'iq',
						attrs: {
							to: '@s.whatsapp.net',
							type: 'set',
							xmlns: 'w:profile:picture',
						},
						content: [{ tag: 'picture', attrs: { type: 'image' }, content: img }],
					});
					m.reply(global.mess.done);
				}
				break;
			case 'delppbot':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					await xync.removeProfilePicture(xync.user.id);
					m.reply(global.mess.done);
				}
				break;
			case 'version':
			case 'versi':
			case 'v':
				{
					const pkg = require('./package.json');
					m.reply(`Version : ${pkg.version}`);
				}
				break;
			case 'addprefix':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (text || m.quoted) {
						const teksnya = text ? text : m.quoted.text;
						await updateSettings({
							filePath: settingsPath,
							addPrefix: teksnya.trim(),
						});
						m.reply(global.mess.done);
					} else m.reply(`Example: ${prefix + command} textnya`);
				}
				break;
			case 'delprefix':
			case 'removeprefix':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (text || m.quoted) {
						const teksnya = text ? text : m.quoted.text;
						await updateSettings({
							filePath: settingsPath,
							removePrefix: teksnya.trim(),
						});
						m.reply(global.mess.done);
					} else m.reply(`Example: ${prefix + command} textnya`);
				}
				break;
			case 'listprefix':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					m.reply('List Prefix :\n' + global.listprefix.map(a => '- ' + a).join('\n'));
				}
				break;
			case 'addtoxic':
			case 'addbadword':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (text || m.quoted) {
						const teksnya = text ? text : m.quoted.text;
						await updateSettings({
							filePath: settingsPath,
							addBadword: teksnya.trim(),
						});
						m.reply(global.mess.done);
					} else m.reply(`Example: ${prefix + command} textnya`);
				}
				break;
			case 'deltoxic':
			case 'delbadword':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (text || m.quoted) {
						const teksnya = text ? text : m.quoted.text;
						await updateSettings({
							filePath: settingsPath,
							removeBadword: teksnya.trim(),
						});
						m.reply(global.mess.done);
					} else m.reply(`Example: ${prefix + command} textnya`);
				}
				break;
			case 'listtoxic':
			case 'listbadword':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					m.reply('List Bad Words :\n' + global.badWords.map(a => '- ' + a).join('\n'));
				}
				break;
			case 'join':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!text) return m.reply('Masukkan Link Group!');
					if (!isUrl(args[0]) && !args[0].includes('whatsapp.com')) return m.reply('Link Invalid!');
					const result = args[0].match(/chat\.whatsapp\.com\/([0-9A-Za-z]+)/);
					if (!result) return m.reply('Link Invalid❗');
					m.reply(global.mess.wait);
					await xync.groupAcceptInvite(result[1]).catch(res => {
						if (res.data == 400) return m.reply('Grup Tidak Di Temukan❗');
						if (res.data == 401) return m.reply('Bot Di Kick Dari Grup Tersebut❗');
						if (res.data == 409) return m.reply('Bot Sudah Join Di Grup Tersebut❗');
						if (res.data == 410) return m.reply('Url Grup Telah Di Setel Ulang❗');
						if (res.data == 500) return m.reply('Grup Penuh❗');
					});
				}
				break;
			case 'leave':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					await xync
						.groupLeave(m.chat)
						.then(() => xync.sendFromOwner(ownerNumber, 'Sukses Keluar Dari Grup', m, {}))
						.catch(e => {});
				}
				break;
			case 'clearchat':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					await xync
						.chatModify(
							{
								delete: true,
								lastMessages: [{ key: m.key, messageTimestamp: m.timestamp }],
							},
							m.chat,
						)
						.catch(e => m.reply('Gagal Menghapus Chat!'));
					m.reply(global.mess.done);
				}
				break;
			case 'getmsgstore':
			case 'storemsg':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					let [teks1, teks2] = text.split`|`;
					if (teks1 && teks2) {
						const msgnya = await global.loadMessage(teks1, teks2);
						if (msgnya?.message) await xync.relayMessage(m.chat, msgnya.message, {});
						else m.reply('Pesan Tidak Ditemukan!');
					} else m.reply(`Example: ${prefix + command} 123xxx@g.us|3EB0xxx`);
				}
				break;
			case 'blokir':
			case 'block':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (text || m.quoted) {
						const numbersOnly = m.isGroup ? (text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender) : m.chat;
						await xync
							.updateBlockStatus(numbersOnly, 'block')
							.then(a => m.reply(global.mess.done))
							.catch(err => m.reply(global.mess.fail));
					} else m.reply(`Example: ${prefix + command} 62xxx`);
				}
				break;
			case 'listblock':
				{
					let anu = await xync.fetchBlocklist();
					m.reply(`Total Block : ${anu.length}\n` + anu.map(v => '• ' + v.replace(/@.+/, '')).join`\n`);
				}
				break;
			case 'openblokir':
			case 'unblokir':
			case 'openblock':
			case 'unblock':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (text || m.quoted) {
						const numbersOnly = m.isGroup ? (text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender) : m.chat;
						await xync
							.updateBlockStatus(numbersOnly, 'unblock')
							.then(a => m.reply(global.mess.done))
							.catch(err => m.reply(global.mess.fail));
					} else m.reply(`Example: ${prefix + command} 62xxx`);
				}
				break;
			case 'ban':
			case 'banned':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!text) return m.reply(`Kirim/tag Nomernya!\nExample:\n${prefix + command} 62xxx`);
					const findJid = xync.findJidByLid(text.replace(/[^0-9]/g, '') + '@lid', store);
					const klss = text.replace(/[^0-9]/g, '') + (findJid ? '@lid' : '@s.whatsapp.net');
					const nmrnya = xync.findJidByLid(klss, store, true);
					if (db.users[nmrnya] && !db.users[nmrnya].ban) {
						db.users[nmrnya].ban = true;
						m.reply(global.mess.done);
					} else m.reply('User tidak terdaftar di database!');
				}
				break;
			case 'unban':
			case 'unbanned':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!text) return m.reply(`Kirim/tag Nomernya!\nExample:\n${prefix + command} 62xxx`);
					const findJid = xync.findJidByLid(text.replace(/[^0-9]/g, '') + '@lid', store);
					const klss = text.replace(/[^0-9]/g, '') + (findJid ? '@lid' : '@s.whatsapp.net');
					const nmrnya = xync.findJidByLid(klss, store, true);
					if (db.users[nmrnya] && db.users[nmrnya].ban) {
						db.users[nmrnya].ban = false;
						m.reply(global.mess.done);
					} else m.reply('User tidak terdaftar di database!');
				}
				break;
			case 'mute':
			case 'unmute':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!m.isGroup) return m.reply(global.mess.group);
					if (command == 'mute') {
						db.groups[m.chat].mute = true;
						m.reply('Bot Telah Di Mute Di Grup Ini!');
					} else if (command == 'unmute') {
						db.groups[m.chat].mute = false;
						m.reply(global.mess.done + ' Unmute');
					}
				}
				break;
			case 'whitelist':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!text) return m.reply(`*Format Salah!*\n\nContoh penggunaan:\n- ${prefix + command} user list\n- ${prefix + command} user add 1,3\n- ${prefix + command} user del 1\n- ${prefix + command} group add 1,2\n- ${prefix + command} clear`);
					const botNumber = await xync.decodeJid(xync.user.id);
					if (!global.db.set[botNumber].whitelist) global.db.set[botNumber].whitelist = [];
					let whitelistArray = global.db.set[botNumber].whitelist;
					let type = args[0] ? args[0].toLowerCase() : '';
					let action = args[1] ? args[1].toLowerCase() : '';
					let targetNumbers = args[2];
					if (type === 'user' || type === 'group' || ['gc', 'group', 'grup'].includes(type)) {
						let dbTarget = type === 'user' ? global.db.users : global.db.groups;
						let keys = Object.keys(dbTarget);
						if (keys.length === 0) return m.reply(`Belum ada data ${type} di database.`);
						if (action === 'list') {
							let listText = `*Daftar ${type === 'user' ? 'User' : 'Group'}:*\n\n`;
							keys.forEach((jid, index) => {
								let status = whitelistArray.includes(jid) ? '✔️' : '✖️';
								listText += `${index + 1}. ${type === 'user' ? global.store?.contacts?.[jid]?.name || '-' : global.store?.groupMetadata?.[jid]?.subject || '-'} [${status}]\n- (${jid})\n`;
							});
							listText += `\n*Cara Penggunaan:*\nTambah: ${prefix + command} ${type} add 1,2,3\nHapus: ${prefix + command} ${type} del 1,2`;
							return m.reply(listText);
						} else if (action === 'add' || action === 'del' || action === 'delete') {
							if (!targetNumbers) return m.reply(`Masukkan nomor urutnya!\nContoh: ${prefix + command} ${type} ${action} 1,2`);
							let processed = [];
							let inputNumbers = targetNumbers.split(',');
							for (let num of inputNumbers) {
								let index = parseInt(num.trim()) - 1;
								if (!isNaN(index) && keys[index]) {
									let targetJid = keys[index];
									if (action === 'add') {
										if (!whitelistArray.includes(targetJid)) {
											whitelistArray.push(targetJid);
											processed.push(targetJid);
										}
									} else {
										let wlIndex = whitelistArray.indexOf(targetJid);
										if (wlIndex !== -1) {
											whitelistArray.splice(wlIndex, 1);
											processed.push(targetJid);
										}
									}
								}
							}
							if (processed.length > 0) {
								let statusText = action === 'add' ? 'menambahkan ke' : 'menghapus dari';
								m.reply(`Sukses ${statusText} whitelist!\n\n*Total: ${processed.length} ${type}*\n- ${processed.join('\n- ')}`);
							} else {
								let failText = action === 'add' ? 'sudah ada di whitelist' : 'tidak ada di whitelist';
								m.reply(`Gagal diproses. Pastikan angka sesuai di *${prefix + command} ${type} list* dan data target ${failText}.`);
							}
						} else m.reply(`Kirim dengan format yang benar.\nContoh:\n- ${prefix + command} ${type} add 1,2,3\n- ${prefix + command} ${type} del 1,2\n- ${prefix + command} ${type} list`);
					} else if (type === 'clear') {
						global.db.set[botNumber].whitelist = [];
						m.reply('Semua data whitelist berhasil dihapus secara permanen!');
					} else m.reply(`Tipe tidak valid! Gunakan 'user', 'group', atau 'clear'.\nContoh: ${prefix + command} user list`);
				}
				break;
			case 'addowner':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!text) return m.reply(`Kirim/tag Nomernya!\nExample:\n${prefix + command} 62xxx`);
					const nmrnya = xync.findJidByLid(text.replace(/[^0-9]/g, ''), store, true);
					const onWa = await xync.onWhatsApp(nmrnya);
					if (!onWa.length > 0) return m.reply(global.mess.onWa);
					if (set?.owner) {
						if (set.owner.find(a => nmrnya.includes(a))) return m.reply('Nomer Tersebut Sudah Ada Di Owner!');
						set.owner.push(nmrnya.split('@')[0]);
						await updateSettings({
							filePath: settingsPath,
							owner: set.owner,
						});
					}
					m.reply(global.mess.done);
				}
				break;
			case 'delowner':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!text) return m.reply(`Kirim/tag Nomernya!\nExample:\n${prefix + command} 62xxx`);
					const nmrnya = xync.findJidByLid(text.replace(/[^0-9]/g, ''), store, true);
					const onWa = await xync.onWhatsApp(nmrnya);
					if (!onWa.length > 0) return m.reply(global.mess.onWa);
					if (botNumber === nmrnya) return m.reply('Nomer Bot Tidak Boleh dihapus dari owner!');
					let list = set.owner;
					const index = list.findIndex(o => o === nmrnya.split('@')[0]);
					if (index === -1) return m.reply('Owner tidak ditemukan di daftar!');
					list.splice(index, 1);
					await updateSettings({
						filePath: settingsPath,
						owner: set.owner,
					});
					m.reply(global.mess.done);
				}
				break;
			case 'adduang':
			case 'addmoney':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!args[0] || !args[1] || isNaN(args[1])) return m.reply(`Kirim/tag Nomernya!\nExample:\n${prefix + command} 62xxx 1000`);
					if (args[1].length > 15) return m.reply('Jumlah Money Maksimal 15 digit angka!');
					const findJid = xync.findJidByLid(args[0].replace(/[^0-9]/g, '') + '@lid', store);
					const klss = args[0].replace(/[^0-9]/g, '') + (findJid ? '@lid' : '@s.whatsapp.net');
					const nmrnya = xync.findJidByLid(klss, store, true);
					const onWa = await xync.onWhatsApp(nmrnya);
					if (!onWa.length > 0) return m.reply(global.mess.onWa);
					if (db.users[nmrnya] && db.users[nmrnya].money >= 0) {
						addMoney(args[1], nmrnya, db);
						m.reply(global.mess.done);
					} else m.reply('User tidak terdaftar di database!');
				}
				break;
			case 'addlimit':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!args[0] || !args[1] || isNaN(args[1])) return m.reply(`Kirim/tag Nomernya!\nExample:\n${prefix + command} 62xxx 10`);
					if (args[1].length > 10) return m.reply('Jumlah Limit Maksimal 10 digit angka!');
					const findJid = xync.findJidByLid(args[0].replace(/[^0-9]/g, '') + '@lid', store);
					const klss = args[0].replace(/[^0-9]/g, '') + (findJid ? '@lid' : '@s.whatsapp.net');
					const nmrnya = xync.findJidByLid(klss, store, true);
					const onWa = await xync.onWhatsApp(nmrnya);
					if (!onWa.length > 0) return m.reply(global.mess.onWa);
					if (db.users[nmrnya] && db.users[nmrnya].limit >= 0) {
						addLimit(args[1], nmrnya, db);
						m.reply(global.mess.done);
					} else m.reply('User tidak terdaftar di database!');
				}
				break;
			case 'listpc':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					let anu = Object.keys(store.messages).filter(a => a.endsWith('.net') || a.endsWith('lid'));
					let teks = `● *LIST PERSONAL CHAT*\n\nTotal Chat : ${anu.length} Chat\n\n`;
					if (anu.length === 0) return m.reply(teks);
					for (let i of anu) {
						if (store.messages?.[i]?.array?.length) {
							let nama = await xync.getName(i);
							teks += `${setv} *Nama :* ${nama}\n${setv} *User :* @${i.split('@')[0]}\n${setv} *Chat :* https://wa.me/${i.split('@')[0]}\n\n=====================\n\n`;
						}
					}
					await m.reply(teks);
				}
				break;
			case 'listgc':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					let anu = Object.keys(store.messages).filter(a => a.endsWith('@g.us'));
					let teks = `● *LIST GROUP CHAT*\n\nTotal Group : ${anu.length} Group\n\n`;
					if (anu.length === 0) return m.reply(teks);
					for (let i of anu) {
						let metadata;
						try {
							metadata = store.groupMetadata[i];
						} catch (e) {
							metadata = store.groupMetadata[i] = await xync.groupMetadata(i).catch(e => ({ ...store.groupMetadata[i] }));
						}
						teks += metadata?.subject
							? `${setv} *Nama :* ${metadata.subject}\n${setv} *Admin :* ${metadata.ownerPn ? `@${metadata.ownerPn.split('@')[0]}` : '-'}\n${setv} *ID :* ${metadata.id}\n${setv} *Dibuat :* ${moment(metadata.creation * 1000)
									.tz(global.timezone)
									.format('DD/MM/YYYY HH:mm:ss')}\n${setv} *Member :* ${metadata.participants.length}\n\n=====================\n\n`
							: '';
					}
					await m.reply(teks);
				}
				break;
			case 'creategc':
			case 'buatgc':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!text) return m.reply(`Example:\n${prefix + command} *Nama Gc*`);
					let group = await xync.groupCreate(q, [m.sender]);
					let res = await xync.groupInviteCode(group.id);
					await m.reply(`*Link Group :* *https://chat.whatsapp.com/${res}*\n\n*Nama Group :* *${group.subject}*\nSegera Masuk dalam 30 detik\nAgar menjadi Admin`, { detectLink: true });
					await sleep(30000);
					await xync.groupParticipantsUpdate(group.id, [m.sender], 'promote').catch(e => {});
					await xync.sendMessage(group.id, { text: global.mess.done });
				}
				break;
			case 'addsewa':
			case 'sewa':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!text) return m.reply(`Example:\n${prefix + command} https://chat.whatsapp.com/xxx | waktu\n${prefix + command} https://chat.whatsapp.com/xxx | 30 hari`);
					let [teks1, teks2] = text.split('|')?.map(x => x.trim()) || [];
					if (!isUrl(teks1) && !teks1.includes('chat.whatsapp.com/')) return m.reply('Link Invalid!');
					const urlny = teks1.match(/chat\.whatsapp\.com\/([0-9A-Za-z]+)/);
					if (!urlny) return m.reply('Link Invalid❗');
					try {
						await xync.groupAcceptInvite(urlny[1]);
					} catch (e) {
						if (e.data == 400) return m.reply('Grup Tidak Di Temukan❗');
						if (e.data == 401) return m.reply('Bot Di Kick Dari Grup Tersebut❗');
						if (e.data == 410) return m.reply('Url Grup Telah Di Setel Ulang❗');
						if (e.data == 500) return m.reply('Grup Penuh❗');
					}
					await xync
						.groupGetInviteInfo(urlny[1])
						.then(a => {
							addExpired(
								{
									url: urlny[1],
									expired: (teks2?.replace(/[^0-9]/g, '') || 30) + 'd',
									id: a.id,
								},
								sewa,
							);
							m.reply('Sukses Menambahkan Sewa Selama ' + (teks2?.replace(/[^0-9]/g, '') || 30) + ' hari\nOtomatis Keluar Saat Waktu Habis!');
						})
						.catch(e => m.reply('Gagal Menambahkan Sewa!'));
				}
				break;
			case 'delsewa':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!text) return m.reply(`Example:\n${prefix + command} https://chat.whatsapp.com/xxxx\n Or \n${prefix + command} id_group@g.us`);
					let urlny;
					if (text.includes('chat.whatsapp.com/')) {
						urlny = text.match(/chat\.whatsapp\.com\/([0-9A-Za-z]+)/)[1];
					} else if (/@g\.us$/.test(text)) {
						urlny = text.trim();
					} else {
						return m.reply('Format tidak valid❗');
					}
					if (checkStatus(urlny, sewa)) {
						await m.reply(global.mess.done);
						await xync.groupLeave(getStatus(urlny, sewa).id).catch(e => {});
						sewa.splice(getPosition(urlny, sewa), 1);
					} else m.reply(`${text} Tidak Terdaftar Di Database\nExample:\n${prefix + command} https://chat.whatsapp.com/xxxx\n Or \n${prefix + command} id_group@g.us`);
				}
				break;
			case 'listsewa':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					let txt = `*------「 LIST SEWA 」------*\n\n`;
					for (let s of sewa) {
						txt += `➸ *ID*: ${s.id}\n➸ *Url*: https://chat.whatsapp.com/${s.url}\n➸ *Expired*: ${formatDate(s.expired)}\n\n`;
					}
					m.reply(txt);
				}
				break;
			case 'addpr':
			case 'addprem':
			case 'addpremium':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!text) return m.reply(`Example:\n${prefix + command} @tag|waktu\n${prefix + command} @${m.sender.split('@')[0]}|30 hari`);
					let [teks1, teks2] = text.split('|').map(x => x.trim());
					const findJid = xync.findJidByLid(teks1.replace(/[^0-9]/g, '') + '@lid', store);
					const klss = teks1.replace(/[^0-9]/g, '') + (findJid ? '@lid' : '@s.whatsapp.net');
					const nmrnya = xync.findJidByLid(klss, store, true);
					const onWa = await xync.onWhatsApp(nmrnya);
					if (!onWa.length > 0) return m.reply(global.mess.onWa);
					if (teks2) {
						if (db.users[nmrnya] && db.users[nmrnya].limit >= 0) {
							addExpired({ id: nmrnya, expired: teks2.replace(/[^0-9]/g, '') + 'd' }, premium);
							m.reply(`Sukses ${command} @${nmrnya.split('@')[0]} Selama ${teks2}`);
							db.users[nmrnya].limit += db.users[nmrnya].vip ? global.limit.vip : global.limit.premium;
							db.users[nmrnya].money += db.users[nmrnya].vip ? global.money.vip : global.money.premium;
						} else m.reply('Nomer tidak terdaftar di BOT !\nPastikan Nomer Pernah Menggunakan BOT!');
					} else m.reply(`Masukkan waktunya!\Example:\n${prefix + command} @tag|waktu\n${prefix + command} @${m.sender.split('@')[0]}|30d\n_d = day_`);
				}
				break;
			case 'delpr':
			case 'delprem':
			case 'delpremium':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!text) return m.reply(`Example:\n${prefix + command} @tag`);
					const findJid = xync.findJidByLid(text.replace(/[^0-9]/g, '') + '@lid', store);
					const klss = text.replace(/[^0-9]/g, '') + (findJid ? '@lid' : '@s.whatsapp.net');
					const nmrnya = xync.findJidByLid(klss, store, true);
					if (db.users[nmrnya] && db.users[nmrnya].limit >= 0) {
						if (checkStatus(nmrnya, premium)) {
							premium.splice(getPosition(nmrnya, premium), 1);
							m.reply(`Sukses ${command} @${nmrnya.split('@')[0]}`);
							db.users[nmrnya].limit += db.users[nmrnya].vip ? global.limit.vip : global.limit.free;
							db.users[nmrnya].money += db.users[nmrnya].vip ? global.money.vip : global.money.free;
						} else m.reply(`User @${nmrnya.split('@')[0]} Bukan Premium❗`);
					} else m.reply('Nomer tidak terdaftar di BOT !');
				}
				break;
			case 'listpr':
			case 'listprem':
			case 'listpremium':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					let txt = `*------「 LIST PREMIUM 」------*\n\n`;
					for (let userprem of premium) {
						txt += `➸ *Nomer*: @${userprem.id.split('@')[0]}\n➸ *Limit*: ${db.users[userprem.id].limit}\n➸ *Money*: ${db.users[userprem.id].money.toLocaleString('id-ID')}\n➸ *Expired*: ${formatDate(userprem.expired)}\n\n`;
					}
					m.reply(txt);
				}
				break;
			case 'upsw':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					const statusJidList = Object.keys(db.users);
					const backgroundColor =
						'#' +
						Math.floor(Math.random() * 16777215)
							.toString(16)
							.padStart(6, '0');
					try {
						if (quoted.isMedia) {
							let media = await xync.downloadAndSaveMediaMessage(qmsg);
							try {
								if (/image|video/.test(quoted.mime)) {
									await xync.sendMessage(
										'status@broadcast',
										{
											[`${quoted.mime.split('/')[0]}`]: { url: media },
											caption: text || m.quoted?.body || '',
										},
										{ statusJidList, broadcast: true },
									);
								} else if (/audio/.test(quoted.mime)) {
									await xync.sendMessage(
										'status@broadcast',
										{
											audio: { url: media },
											mimetype: 'audio/mp4',
											ptt: true,
										},
										{ backgroundColor, statusJidList, broadcast: true },
									);
								} else m.reply('Only Support video/audio/image/text');
							} finally {
								if (fs.existsSync(media)) fs.unlinkSync(media);
							}
						} else if (quoted.text) {
							await xync.sendMessage(
								'status@broadcast',
								{ text: text || m.quoted?.body || '' },
								{
									textArgb: 0xffffffff,
									font: Math.floor(Math.random() * 9),
									backgroundColor,
									statusJidList,
									broadcast: true,
								},
							);
						} else m.reply('Only Support video/audio/image/text');
					} catch (e) {
						m.reply(global.mess.fail);
					}
				}
				break;
			case 'addcase':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!text && !text.startsWith('case')) return m.reply('Masukkan Casenya!');
					fs.readFile(__filename, 'utf8', (err, data) => {
						if (err) {
							console.error('Terjadi kesalahan saat membaca file:', err);
							return;
						}
						const posisi = data.indexOf("case '19rujxl1e':");
						if (posisi !== -1) {
							const codeBaru = data.slice(0, posisi) + '\n' + `${text}` + '\n' + data.slice(posisi);
							fs.writeFile(__filename, codeBaru, 'utf8', err => {
								if (err) {
									m.reply('Terjadi kesalahan saat menulis file: ', err);
								} else m.reply(global.mess.done);
							});
						} else m.reply(global.mess.fail);
					});
				}
				break;
			case 'getcase':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!text) return m.reply('Masukkan Nama Casenya!');
					try {
						const getCase = cases => {
							return (
								'case' +
								`'${cases}'` +
								fs
									.readFileSync(__filename)
									.toString()
									.split("case '" + cases + "'")[1]
									.split('break')[0] +
								'break'
							);
						};
						m.reply(`${getCase(text)}`);
					} catch (e) {
						m.reply(`case ${text} tidak ditemukan!`);
					}
				}
				break;
			case 'delcase':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!text) return m.reply('Masukkan Nama Casenya!');
					fs.readFile(__filename, 'utf8', (err, data) => {
						if (err) {
							console.error('Terjadi kesalahan saat membaca file:', err);
							return;
						}
						const regex = new RegExp(`case\\s+'${text.toLowerCase()}':[\\s\\S]*?break`, 'g');
						const modifiedData = data.replace(regex, '');
						fs.writeFile(__filename, modifiedData, 'utf8', err => {
							if (err) {
								console.log(err);
								m.reply(global.mess.fail);
							} else m.reply(global.mess.done);
						});
					});
				}
				break;
			case 'backup':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					switch (args[0]) {
						case 'all':
							let bekup = './database/backup_all.tar.gz';
							tarBackup('./', bekup)
								.then(() => {
									return m.reply({
										document: fs.readFileSync(bekup),
										mimetype: 'application/gzip',
										fileName: 'backup_all.tar.gz',
									});
								})
								.catch(e => m.reply('Gagal backup: ', +e));
							break;
						case 'auto':
							if (set.autobackup) return m.reply('Sudah Aktif Sebelumnya!');
							set.autobackup = true;
							m.reply('Sukses Mengaktifkan Auto Backup');
							break;
						case 'session':
							await m.reply({
								document: fs.readFileSync('./xyncdev/creds.json'),
								mimetype: 'application/json',
								fileName: 'creds.json',
							});
							break;
						case 'database':
							let tglnya = new Date().toISOString().replace(/[:.]/g, '-');
							let datanya = './database/' + global.tempatDB;
							if (global.tempatDB.startsWith('mongodb')) {
								datanya = './database/backup_database.json';
								fs.writeFileSync(datanya, JSON.stringify(global.db, null, 2), 'utf-8');
							}
							await m.reply({
								document: fs.readFileSync(datanya),
								mimetype: 'application/json',
								fileName: tglnya + '_database.json',
							});
							break;
						default:
							m.reply('Gunakan perintah:\n- backup all\n- backup auto\n- backup session\n- backup database');
					}
				}
				break;
			case 'getsession':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					await m.reply({
						document: fs.readFileSync('./xyncdev/creds.json'),
						mimetype: 'application/json',
						fileName: 'creds.json',
					});
				}
				break;
			case 'deletesession':
			case 'delsession':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					fs.readdir('./xyncdev', async function (err, files) {
						if (err) {
							console.error('Unable to scan directory: ' + err);
							return m.reply('Unable to scan directory: ' + err);
						}
						let filteredArray = await files.filter(item => ['session-', 'pre-key', 'sender-key', 'app-state'].some(ext => item.startsWith(ext)));
						let teks = `Terdeteksi ${filteredArray.length} Session file\n\n`;
						if (filteredArray.length == 0) return m.reply(teks);
						filteredArray.map(function (e, i) {
							teks += i + 1 + `. ${e}\n`;
						});
						if (text && text == 'true') {
							let { key } = await m.reply('Menghapus Session File..');
							await filteredArray.forEach(function (file) {
								fs.unlinkSync('./xyncdev/' + file);
							});
							sleep(2000);
							m.reply('Berhasil Menghapus Semua Sampah Session', { edit: key });
						} else m.reply(teks + `\nKetik _${prefix + command} true_\nUntuk Menghapus`);
					});
				}
				break;
			case 'deletesampah':
			case 'delsampah':
			case 'deletetemp':
			case 'deltemp':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					fs.readdir('./database/temp', async function (err, files) {
						if (err) {
							console.error('Unable to scan directory: ' + err);
							return m.reply('Unable to scan directory: ' + err);
						}
						let filteredArray = await files.filter(item => ['gif', 'png', 'bin', 'mp3', 'mp4', 'jpg', 'webp', 'webm', 'opus', 'jpeg'].some(ext => item.endsWith(ext)));
						let teks = `Terdeteksi ${filteredArray.length} Sampah file\n\n`;
						if (filteredArray.length == 0) return m.reply(teks);
						filteredArray.map(function (e, i) {
							teks += i + 1 + `. ${e}\n`;
						});
						if (text && text == 'true') {
							let { key } = await m.reply('Menghapus Sampah File..');
							await filteredArray.forEach(function (file) {
								fs.unlinkSync('./database/temp/' + file);
							});
							sleep(2000);
							m.reply('Berhasil Menghapus Semua Sampah', { edit: key });
						} else m.reply(teks + `\nKetik _${prefix + command} true_\nUntuk Menghapus`);
					});
				}
				break;
			case 'setmessbot':
			case 'setbotmessages':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					const res = await fetchJson('https://raw.githubusercontent.com/nazedev/database/refs/heads/master/bot/lang.json');
					if (res.some(a => a.lang === text)) {
						const selectedLang = res.find(a => a.lang === text);
						await updateSettings({
							filePath: settingsPath,
							newMess: selectedLang.messages,
						});
						m.reply(global.mess.done);
					} else m.reply(`Example: ${prefix + command} en\n*List Lang :*\n${res.map(a => '- ' + a.lang).join('\n')}`);
				}
				break;
			case 'setlimitbot':
			case 'setbotlimit':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (['free', 'premium', 'vip'].includes(args[0]) && !isNaN(args[1])) {
						await updateSettings({
							filePath: settingsPath,
							setLimitRole: { role: args[0], value: Number(args[1]) },
						});
						m.reply(global.mess.done);
					} else m.reply(`Example: ${prefix + command} premium 10000\n*List Membership :*\n- free ${global.limit.free}\n- premium ${global.limit.premium}\n- vip ${global.limit.vip}`);
				}
				break;
			case 'setmoneybot':
			case 'setbotmoney':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (['free', 'premium', 'vip'].includes(args[0]) && !isNaN(args[1])) {
						await updateSettings({
							filePath: settingsPath,
							setMoneyRole: { role: args[0], value: Number(args[1]) },
						});
						m.reply(global.mess.done);
					} else m.reply(`Example: ${prefix + command} premium 10000\n*List Membership :*\n- free ${global.money.free}\n- premium ${global.money.premium}\n- vip ${global.money.vip}`);
				}
				break;
			case 'setnamebot':
			case 'setbotname':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (text || m.quoted) {
						const teksnya = text ? text : m.quoted.text;
						await updateSettings({
							filePath: settingsPath,
							botname: teksnya.trim(),
						});
						m.reply(global.mess.done);
					} else m.reply(`Example: ${prefix + command} Hitori bot`);
				}
				break;
			case 'setpacknamebot':
			case 'setbotpackname':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (text || m.quoted) {
						const teksnya = text ? text : m.quoted.text;
						await updateSettings({
							filePath: settingsPath,
							packname: teksnya.trim(),
						});
						m.reply(global.mess.done);
					} else m.reply(`Example: ${prefix + command} By Hitori bot`);
				}
				break;
			case 'setauthorbot':
			case 'setbotauthor':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (text || m.quoted) {
						const teksnya = text ? text : m.quoted.text;
						await updateSettings({
							filePath: settingsPath,
							author: teksnya.trim(),
						});
						m.reply(global.mess.done);
					} else m.reply(`Example: ${prefix + command} Xync`);
				}
				break;
			case 'setlocale':
			case 'setlocalebot':
			case 'setbotlocale':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (text || m.quoted) {
						const teksnya = text ? text : m.quoted.text;
						if (!locales.includes(teksnya)) return m.reply('Locale List:\n' + locales.map(a => '- ' + a).join('\n'));
						await updateSettings({
							filePath: settingsPath,
							locale: teksnya.trim(),
						});
						m.reply(global.mess.done);
					} else m.reply(`Example: ${prefix + command} en`);
				}
				break;
			case 'settimezone':
			case 'settimezonebot':
			case 'setbottimezone':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (text || m.quoted) {
						const teksnya = text ? text : m.quoted.text;
						if (!timez.includes(teksnya)) return m.reply('Timezone List:\n' + timez.map(a => '- ' + a).join('\n'));
						await updateSettings({
							filePath: settingsPath,
							timezone: teksnya.trim(),
						});
						m.reply(global.mess.done);
					} else m.reply(`Example: ${prefix + command} Asia/Jakarta`);
				}
				break;
			case 'setapikey':
			case 'setbotapikey':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!text) return m.reply('Mana apikey nya?');
					if (args[0]?.toLowerCase() == 'neo') {
						if (!args[1]?.startsWith('nsk_')) return m.reply('Apikey Tidak Valid!\nAmbil Apikey di : https://app.neosantara.xyz/api-keys');
						let old_key = global.APIKeys[global.APIs.neosantara];
						await updateSettings({
							filePath: settingsPath,
							neosantara: args[1].trim(),
						});
						m.reply(`*Apikey telah di ganti dari ${old_key} menjadi ${q}*`);
					} else {
						if (!text.startsWith('nz-')) return m.reply('Apikey Tidak Valid!\nAmbil Apikey di : https://naze.biz.id/profile');
						let old_key = global.APIKeys[global.APIs.xync];
						await updateSettings({
							filePath: settingsPath,
							apikey: text.trim(),
						});
						m.reply(`*Apikey telah di ganti dari ${old_key} menjadi ${q}*`);
					}
				}
				break;
			case 'sc':
			case 'script':
				{
					await m.reply(`Gak ada`, {
						title: '¿?',
						body: 'Njay',
						thumbnail: global.fake.thumbnail,
						mediaType: 2,
						mediaUrl: global.my.yt,
						sourceUrl: global.my.yt,
					});
				}
				break;
			case 'donasi':
			case 'donate':
				{
					m.reply('Donasi Dapat Melalui Url Dibawah Ini :...');
				}
				break;

			// Premium
			case 'netflix':
			case 'nftoken': {
			    if (!isPremium) return m.reply(global.mess.prem);
			    if (!isLimit) return m.reply(global.mess.limit);
			    
			    const { default: NFTokenGenerator } = await import('./lib/netflix.js'); 
			    const generator = new NFTokenGenerator({ timeout: 30000 });
			
			    try {
			
			        const result = await generator.generate();
			        const lifetime = generator.getTokenLifetime(result.expiry);
			        const sisaWaktu = generator.formatLifetime(lifetime);
			
			        let txt = `*NETFLIX PREMIUM AUTO-LOGIN*\n\n`;
			        txt += `PC / BROWSER:\n${result.links.pc}\n\n`;
			        txt += `ANDROID:\n${result.links.android}\n`;
			        txt += `_Catatan: Klik link untuk masuk otomatis. Jangan di-logout_.`;
			
			        await xync.sendMessage(m.chat, { text: txt }, { quoted: m });
			
			    } catch (error) {
			        console.error('[ERROR NETFLIX]:', error);
			        m.reply(`Gagal mengambil token Netflix!\nLog: ${error.message}`);
			    }
			}
			break;
			case 'netflix2':
			case 'nftoken2':
				{
					if (!isPremium) return m.reply(global.mess.prem);
					if (!isLimit) return m.reply(global.mess.limit);

					let plan = 'premium';
					let count = 1; 

					if (args[0] && ['premium', 'standard', 'basic'].includes(args[0].toLowerCase())) {
						plan = args[0].toLowerCase();
					}

					m.reply(`Membuat Netflix Token...\n> _Plan: ${plan.toUpperCase()}_`);

					const fs = require('fs');
					const path = require('path');
					const { exec } = require('child_process');

					const scriptPath = path.join(__dirname, 'lib/nfscraper.js');
					const outputFile = path.join(__dirname, `database/temp/nf_${m.sender.split('@')[0]}_${Date.now()}.txt`);

					exec(`node "${scriptPath}" auto -n ${count} -p ${plan} -o "${outputFile}"`, async (err, stdout, stderr) => {
						try {
							if (fs.existsSync(outputFile)) {
								const hasil = fs.readFileSync(outputFile, 'utf8').trim();

								if (hasil) {
									let balas = `*GENERATE NETFLIX*\n${hasil}\n_Silakan gunakan link/token di atas._`;
									await xync.sendMessage(m.chat, { text: balas }, { quoted: m });
									setLimit(m, db);
								} else {
									m.reply(`Gagal mendapatkan token.\nSemua proxy publik mungkin mati atau limit harian situs tercapai.`);
								}

								fs.unlinkSync(outputFile);
							} else {
								m.reply(`Terjadi kesalahan sistem.\n\n*Log Peringatan:*\n${stderr.slice(-500) || stdout.slice(-500) || 'Gagal mengeksekusi script.'}`);
							}
						} catch (e) {
							m.reply(`Error membaca hasil: ${e.message}`);
						}
					});
				}
				break;
			case 'ampremium2':
			case 'am2':
			case 'amprem2':
				{
					if (!isPremium) return m.reply(global.mess.prem);
					if (!text) return m.reply(`*Cara Penggunaan:*\n\n1. *Kirim Email:*\n${prefix + command} emailmu@gmail.com\n\n2. *Verifikasi Link:*\n${prefix + command} emailmu@gmail.com link_dari_email\n\n_(Gunakan spasi untuk memisahkan email dan link)_`);

					const argsInput = text.split(' ');
					const emailInput = argsInput[0];
					const rawLinkInput = argsInput[1]; 

					try {
						const API_BASE = 'https://restapidhan.vercel.app/api/am';
						const API_KEY = 'freeapikeydhan26';

						if (!rawLinkInput) {
							const sendUrl = `${API_BASE}?action=send&apikey=${API_KEY}&email=${encodeURIComponent(emailInput)}`;
							const sendResult = await axios.get(sendUrl, { timeout: 60000 });
							const data = sendResult.data;

							if (!data.status) throw new Error(data.error || data.message || 'Gagal mengirim link ke email');

							let replyMsg = `Link berhasil dikirim`;
							replyMsg += `*Email:* ${emailInput}\n\n`;
							replyMsg += `*Instruksi Selanjutnya:*\n`;
							replyMsg += `*  Buka kotak masuk emai cek folder spam.\n`;
							replyMsg += `* Cari email dari "Alight Motion" / "Alight Creative".\n`;
							replyMsg += `* Tekan-tahan tombol "Login ke Alight Creative", lalu pilih "Salin URL".\n`;
							replyMsg += `* Kirim kembali ke bot dengan format:\n\n`;
							replyMsg += `*${prefix + command} ${emailInput} link_yang_dicopy*`;

							m.reply(replyMsg);
						} else {
							const verifUrl = `${API_BASE}?action=verif&apikey=${API_KEY}&email=${encodeURIComponent(emailInput)}&url=${encodeURIComponent(rawLinkInput)}`;
							const verifyResult = await axios.get(verifUrl, {
								timeout: 60000,
							});
							const data = verifyResult.data;

							if (!data.status) throw new Error(data.error || data.message || 'Gagal verifikasi link');

							let replyMsg = `Donee\n`;
							replyMsg += `*Email:* ${emailInput}\n`;
							replyMsg += `*Premium:* Aktif\n`;
							replyMsg += `_Silakan login ke aplikasi Alight Motion menggunakan email tersebut._`;

							m.reply(replyMsg);
						}
					} catch (error) {
						console.error(error);
						m.react('✖️');

						const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
						m.reply(`*Gagal,Coba am2!*\nTerjadi Kesalahan: ${errorMsg}`);
					}
				}
				break;
			case 'am':
	    	case 'amprem':
			{
				if (!isPremium) return m.reply(global.mess.prem);
				if (!isLimit) return m.reply(global.mess.limit);
		
				if (!text) {
					return m.reply(`*Format Salah!*\n\n*1. Kirim link verifikasi:*\n${prefix + command} email@example.com\n\n*2. Verifikasi & Premium:*\n${prefix + command} email@example.com | link_verifikasi`);
				}
		
				try {
					const { AmPremium } = await import('./lib/am2.js');
		
					if (text.includes('|')) {
						const parts = text.split('|').map(p => p.trim());
						const em = parts[0];
						const linkUrl = parts[1];
		
						if (!em || !linkUrl) {
							return m.reply(`Format salah!\n\nGunakan:\n${prefix + command} email@example.com | link_verifikasi`);
						}
						
						const result = await AmPremium.processFull(em, linkUrl);
						
						if (result.ok) {
							await xync.sendMessage(m.chat, {
								text: `*PREMIUM SUCCESS!*\n\nEmail: ${result.email}\nOrder: ${result.order}\nStatus: Active\nBaru: ${result.baru ? 'Ya' : 'Tidak'}\n\nAkun Alight Motion telah dipremium!`
							}, { quoted: m });
							setLimit(m, db);
						} else {
							m.reply(`Gagal mempromosikan: ${result.why}`);
						}
					} else {
						const isEmail = text.includes('@') && !text.includes('http');
						if (isEmail) {
							const em = text.trim();

							const r = await AmPremium.sendLink(em);
							if (r.ok) {
								await xync.sendMessage(m.chat, {
									text: `*Link verifikasi telah dikirim!*\n\nEmail: ${em}\nCek folder spam\nCopy link verifikasi, lalu gunakan:\n${prefix + command} ${em} | <link>`
								}, { quoted: m });
							} else {
								m.reply(`Gagal mengirim link: ${r.why}`);
							}
						} else {
							return m.reply(`Format tidak valid!\n\n*1. Kirim link:*\n${prefix + command} email@example.com\n\n*2. Verifikasi:*\n${prefix + command} email@example.com | link_verifikasi`);
						}
					}
				} catch (e) {
					console.error(e);
					m.react('✖️');
					m.reply(`Terjadi kesalahan sistem: ${e.message}`);
				}
			}
			break;
			case 'amgen':
			case 'irfan':
				{
					if (!isPremium) return m.reply(global.mess.prem);

					m.reply('Wett...');

					try {
						const { GenerateAmPremAkun } = await import('./lib/amgen.js');
						const scraper = new GenerateAmPremAkun();

						const result = await scraper.fullAutoWorkflow(xync, m);

						if (result.appLink && result.premium) {
							let finalMsg = `Klik tombol dibawah, lalu pilih Buka di Alight Motion.`;

							await xync.sendListMsg(
								m.chat,
								{
									text: finalMsg,
									buttons: [
										{
											name: 'cta_url',
											buttonParamsJson: JSON.stringify({
												display_text: 'Klik',
												url: result.appLink,
												merchant_url: result.appLink,
											}),
										},
									],
								},
								{ quoted: m },
							);
						} else if (result.premium && !result.appLink) {
							m.reply(`Gagal menyergap link otomatis.\nEmail: ${result.tempEmail}\nStatus: Premium.\nSilakan coba login manual.`);
						} else {
							m.reply(`Gagal mengaktifkan premium. Silakan coba lagi nanti.`);
						}
					} catch (e) {
						m.reply(`Terjadi Kesalahan:\n${e.message || 'Error tidak diketahui'}`);
					}
				}
				break;

			// Group Menu
			case 'add':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!m.isAdmin) return m.reply(global.mess.admin);
					if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
					if (text || m.quoted) {
						const numbersOnly = text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender;
						const findJid = xync.findJidByLid(numbersOnly.replace(/[^0-9]/g, '') + '@lid', store);
						const klss = numbersOnly.replace(/[^0-9]/g, '') + (findJid ? '@lid' : '@s.whatsapp.net');
						const nmrnya = xync.findJidByLid(klss, store, true);
						try {
							await xync.groupParticipantsUpdate(m.chat, [nmrnya], 'add').then(async res => {
								for (let i of res) {
									let invv = await xync.groupInviteCode(m.chat);
									const statusMessages = {
										200: `Berhasil menambahkan @${nmrnya.split('@')[0]} ke grup!`,
										401: 'Dia Memblokir Bot!',
										409: 'Dia Sudah Join!',
										500: 'Grup Penuh!',
									};
									if (statusMessages[i.status]) {
										return m.reply(statusMessages[i.status]);
									} else if (i.status == 408) {
										await m.reply(`@${nmrnya.split('@')[0]} Baru-Baru Saja Keluar Dari Grub Ini!\n\nKarena Target Private\n\nUndangan Akan Dikirimkan Ke\n-> wa.me/${nmrnya.replace(/\D/g, '')}\nMelalui Jalur Pribadi`);
										await m.reply(`${'https://chat.whatsapp.com/' + invv}\n------------------------------------------------------\n\nAdmin: @${m.sender.split('@')[0]}\nMengundang anda ke group ini\nSilahkan masuk jika berkehendak🙇`, { detectLink: true, chat: nmrnya, quoted: fkontak }).catch(err => m.reply('Gagal Mengirim Undangan!'));
									} else if (i.status == 403) {
										let a = i.content.content[0].attrs;
										await xync.sendGroupInviteV4(m.chat, nmrnya, a.code, a.expiration, m.metadata.subject, `Admin: @${m.sender.split('@')[0]}\nMengundang anda ke group ini\nSilahkan masuk jika berkehendak🙇`, null, { mentions: [m.sender] });
										await m.reply(`@${nmrnya.split('@')[0]} Tidak Dapat Ditambahkan\n\nKarena Target Private\n\nUndangan Akan Dikirimkan Ke\n-> wa.me/${nmrnya.replace(/\D/g, '')}\nMelalui Jalur Pribadi`);
									} else m.reply('Gagal Add User\nStatus : ' + i.status);
								}
							});
						} catch (e) {
							m.reply(global.mess.fail);
						}
					} else m.reply(`Example: ${prefix + command} 62xxx`);
				}
				break;
			case 'kick':
			case 'dor':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!m.isAdmin) return m.reply(global.mess.admin);
					if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
					if (text || m.quoted) {
						const numbersOnly = text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender;
						const findJid = xync.findJidByLid(numbersOnly.replace(/[^0-9]/g, '') + '@lid', store);
						const klss = numbersOnly.replace(/[^0-9]/g, '') + (findJid ? '@lid' : '@s.whatsapp.net');
						const nmrnya = xync.findJidByLid(klss, store, true);
						await xync.groupParticipantsUpdate(m.chat, [nmrnya], 'remove').catch(err => m.reply(global.mess.fail));
					} else m.reply(`Example: ${prefix + command} 62xxx`);
				}
				break;
			case 'promote':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!m.isAdmin) return m.reply(global.mess.admin);
					if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
					if (text || m.quoted) {
						const numbersOnly = text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender;
						const findJid = xync.findJidByLid(numbersOnly.replace(/[^0-9]/g, '') + '@lid', store);
						const klss = numbersOnly.replace(/[^0-9]/g, '') + (findJid ? '@lid' : '@s.whatsapp.net');
						const nmrnya = xync.findJidByLid(klss, store, true);
						await xync.groupParticipantsUpdate(m.chat, [nmrnya], 'promote').catch(err => m.reply(global.mess.fail));
					} else m.reply(`Example: ${prefix + command} 62xxx`);
				}
				break;
			case 'demote':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!m.isAdmin) return m.reply(global.mess.admin);
					if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
					if (text || m.quoted) {
						const numbersOnly = text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender;
						const findJid = xync.findJidByLid(numbersOnly.replace(/[^0-9]/g, '') + '@lid', store);
						const klss = numbersOnly.replace(/[^0-9]/g, '') + (findJid ? '@lid' : '@s.whatsapp.net');
						const nmrnya = xync.findJidByLid(klss, store, true);
						await xync.groupParticipantsUpdate(m.chat, [nmrnya], 'demote').catch(err => m.reply(global.mess.fail));
					} else m.reply(`Example: ${prefix + command} 62xxx`);
				}
				break;
			case 'warn':
			case 'warning':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!m.isAdmin) return m.reply(global.mess.admin);
					if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
					if (text || m.quoted) {
						const numbersOnly = text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender;
						const findJid = xync.findJidByLid(numbersOnly.replace(/[^0-9]/g, '') + '@lid', store);
						const klss = numbersOnly.replace(/[^0-9]/g, '') + (findJid ? '@lid' : '@s.whatsapp.net');
						const nmrnya = xync.findJidByLid(klss, store, true);
						if (!db.groups[m.chat].warn[nmrnya]) {
							db.groups[m.chat].warn[nmrnya] = 1;
							m.reply('Warning 1/4, akan dikick sewaktu waktu❗');
						} else if (db.groups[m.chat].warn[nmrnya] >= 3) {
							await xync.groupParticipantsUpdate(m.chat, [nmrnya], 'remove').catch(err => m.reply(global.mess.fail));
							delete db.groups[m.chat].warn[nmrnya];
						} else {
							db.groups[m.chat].warn[nmrnya] += 1;
							m.reply(`Warning ${db.groups[m.chat].warn[nmrnya]}/4, akan dikick sewaktu waktu❗`);
						}
					} else m.reply(`Example: ${prefix + command} 62xxx`);
				}
				break;
			case 'unwarn':
			case 'delwarn':
			case 'unwarning':
			case 'delwarning':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!m.isAdmin) return m.reply(global.mess.admin);
					if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
					if (text || m.quoted) {
						const numbersOnly = text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender;
						const findJid = xync.findJidByLid(numbersOnly.replace(/[^0-9]/g, '') + '@lid', store);
						const klss = numbersOnly.replace(/[^0-9]/g, '') + (findJid ? '@lid' : '@s.whatsapp.net');
						const nmrnya = xync.findJidByLid(klss, store, true);
						if (db.groups[m.chat]?.warn?.[nmrnya]) {
							delete db.groups[m.chat].warn[nmrnya];
							m.reply('Berhasil Menghapus Warning!');
						}
					} else m.reply(`Example: ${prefix + command} 62xxx`);
				}
				break;
			case 'setname':
			case 'setnamegc':
			case 'setsubject':
			case 'setsubjectgc':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!m.isAdmin) return m.reply(global.mess.admin);
					if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
					if (text || m.quoted) {
						const teksnya = text ? text : m.quoted.text;
						await xync.groupUpdateSubject(m.chat, teksnya).catch(err => m.reply(global.mess.fail));
					} else m.reply(`Example: ${prefix + command} textnya`);
				}
				break;
			case 'setdesc':
			case 'setdescgc':
			case 'setdesk':
			case 'setdeskgc':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!m.isAdmin) return m.reply(global.mess.admin);
					if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
					if (text || m.quoted) {
						const teksnya = text ? text : m.quoted.text;
						await xync.groupUpdateDescription(m.chat, teksnya).catch(err => m.reply(global.mess.fail));
					} else m.reply(`Example: ${prefix + command} textnya`);
				}
				break;
			case 'setppgroups':
			case 'setppgrup':
			case 'setppgc':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!m.isAdmin) return m.reply(global.mess.admin);
					if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
					if (!m.quoted) return m.reply('Reply Gambar yang mau dipasang di Profile Bot');
					if (!/image/.test(quoted.type)) return m.reply(`Reply Image Dengan Caption ${prefix + command}`);
					let media = await quoted.download();
					let { img } = await generateProfilePicture(media, text.length > 0 ? null : 512);
					await xync.query({
						tag: 'iq',
						attrs: {
							target: m.chat,
							to: '@s.whatsapp.net',
							type: 'set',
							xmlns: 'w:profile:picture',
						},
						content: [{ tag: 'picture', attrs: { type: 'image' }, content: img }],
					});
					m.reply(global.mess.done);
				}
				break;
			case 'delete':
			case 'del':
				{
					if (!m.quoted) return m.reply(global.mess.quoted);
					await xync.sendMessage(m.chat, {
						delete: {
							remoteJid: m.chat,
							fromMe: m.isBotAdmin ? false : true,
							id: m.quoted.id,
							participant: m.quoted.sender,
						},
					});
				}
				break;
			case 'pin':
			case 'unpin':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!m.isAdmin) return m.reply(global.mess.admin);
					if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
					await xync.sendMessage(m.chat, {
						pin: {
							type: command == 'pin' ? 1 : 0,
							time: 2592000,
							key: m.quoted ? m.quoted.key : m.key,
						},
					});
				}
				break;
			case 'linkgroup':
			case 'linkgrup':
			case 'linkgc':
			case 'urlgroup':
			case 'urlgrup':
			case 'urlgc':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!m.isAdmin) return m.reply(global.mess.admin);
					if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
					let response = await xync.groupInviteCode(m.chat);
					await m.reply(`https://chat.whatsapp.com/${response}\n\nLink Group : ${(store.groupMetadata[m.chat] ? store.groupMetadata[m.chat] : (store.groupMetadata[m.chat] = await xync.groupMetadata(m.chat).catch(e => ({ ...store.groupMetadata[m.chat] })))).subject}`, { detectLink: true });
				}
				break;
			case 'swgc':
			case 'statusgrup':
				{
					if (!m.isAdmin) return m.reply(global.mess.admin);
					if (!m.isGroup) return m.reply(global.mess.group || 'Perintah ini hanya bisa digunakan di dalam grup!');

					const isImage = /image/.test(mime);
					const isVideo = /video/.test(mime);

					if (!isImage && !isVideo) {
						return m.reply(`Kirim/Reply foto atau video dengan perintah:\n${prefix + command} caption | nama list | emoji`);
					}

					let listName = m.metadata.subject;
					let listEmoji = '😜';
					let captionText = '';

					let parts = text.split('|').map(v => v.trim());

					if (m.quoted) {
						captionText = qmsg.caption || qmsg.text || '';
						if (parts[0]) listName = parts[0];
						if (parts[1]) listEmoji = parts[1];
					} else {
						if (parts.length >= 3) {
							captionText = parts[0];
							listName = parts[1];
							listEmoji = parts[2];
						} else if (parts.length === 2) {
							captionText = parts[0];
							listName = parts[1];
						} else if (parts.length === 1 && parts[0]) {
							captionText = parts[0];
						}
					}

					if (!listName) listName = m.metadata.subject;
					if (!listEmoji) listEmoji = '😜';

					try {
						const { generateWAMessageContent } = require('baileys');
						const crypto = require('crypto');

						const mediaBuffer = await quoted.download();
						if (!mediaBuffer) throw new Error('Gagal mengunduh media.');

						const mediaType = isImage ? 'image' : 'video';
						const content = await generateWAMessageContent(
							{
								[mediaType]: mediaBuffer,
								caption: captionText,
							},
							{ upload: xync.waUploadToServer },
						);

						const mediaMessage = content[mediaType + 'Message'];

						mediaMessage.contextInfo = {
							...(mediaMessage.contextInfo || {}),
							statusAudienceMetadata: {
								audienceType: 2,
								listName: listName,
								listEmoji: listEmoji,
							},
						};

						const messageSecret = crypto.randomBytes(32).toString('base64');

						const payload = {
							messageContextInfo: {
								messageSecret: messageSecret,
							},
							groupStatusMessageV2: {
								message: {
									[mediaType + 'Message']: mediaMessage,
								},
							},
						};

						await xync.relayMessage(m.chat, payload, {
							additionalNodes: [
								{
									tag: 'meta',
									attrs: {
										is_group_status: 'true',
									},
								},
							],
						});
					} catch (err) {
						console.error('\n[ERROR SWGC] :', err);
						m.reply(`Gagal membuat status grup: ${err.message}`);
					}
				}
				break;
			case 'revoke':
			case 'newlink':
			case 'newurl':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!m.isAdmin) return m.reply(global.mess.admin);
					if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
					await xync
						.groupRevokeInvite(m.chat)
						.then(a => {
							m.reply(`Sukses Menyetel Ulang, Tautan Undangan Grup ${m.metadata.subject}`);
						})
						.catch(err => m.reply(global.mess.fail));
				}
				break;
			case 'group':
			case 'grup':
			case 'gc':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!m.isAdmin) return m.reply(global.mess.admin);
					if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
					let set = db.groups[m.chat];
					switch (args[0]?.toLowerCase()) {
						case 'close':
						case 'open':
							await xync.groupSettingUpdate(m.chat, args[0] == 'close' ? 'announcement' : 'not_announcement').then(a => m.reply(`*Sukses ${args[0] == 'open' ? 'Membuka' : 'Menutup'} Group*`));
							break;
						case 'join':
							const _list = await xync.groupRequestParticipantsList(m.chat).then(a => a.map(b => b.jid));
							if (/(a(p|pp|cc)|(ept|rove))|true|ok/i.test(args[1]) && _list.length > 0) {
								await xync.groupRequestParticipantsUpdate(m.chat, _list, 'approve').catch(e => {});
							} else if (/reject|false|no/i.test(args[1]) && _list.length > 0) {
								await xync.groupRequestParticipantsUpdate(m.chat, _list, 'reject').catch(e => {});
							} else m.reply(`List Request Join :\n${_list.length > 0 ? '- @' + _list.join('\n- @').split('@')[0] : '*Nothing*'}\nExample : ${prefix + command} join acc/reject`);
							break;
						case 'pesansementara':
						case 'disappearing':
							if (/90|7|1|24|on/i.test(args[1])) {
								xync.sendMessage(m.chat, {
									disappearingMessagesInChat: /90/i.test(args[1]) ? 7776000 : /7/i.test(args[1]) ? 604800 : 86400,
								});
							} else if (/0|off|false/i.test(args[1])) {
								xync.sendMessage(m.chat, { disappearingMessagesInChat: 0 });
							} else m.reply('Silahkan Pilih :\n90 hari, 7 hari, 1 hari, off');
							break;
						case 'antilink':
						case 'antivirtex':
						case 'antidelete':
						case 'welcome':
						case 'antitoxic':
						case 'waktusholat':
						case 'nsfw':
						case 'antihidetag':
						case 'setinfo':
						case 'antitagsw':
						case 'leave':
						case 'promote':
						case 'demote':
							if (/on|true/i.test(args[1])) {
								if (set[args[0]]) return m.reply('*Sudah Aktif Sebelumnya*');
								set[args[0]] = true;
								m.reply('*Sukses Change To On*');
							} else if (/off|false/i.test(args[1])) {
								set[args[0]] = false;
								m.reply('*Sukses Change To Off*');
							} else m.reply(`❗${args[0].charAt(0).toUpperCase() + args[0].slice(1)} on/off`);
							break;
						case 'setwelcome':
						case 'setleave':
						case 'setpromote':
						case 'setdemote':
							if (args[1]) {
								set.text[args[0]] = args.slice(1).join(' ');
								m.reply(`Sukses Mengubah ${args[0].split('set')[1]} Menjadi:\n${set.text[args[0]]}`);
							} else m.reply(`Example:\n${prefix + command} ${args[0]} Isi Pesannya\n\nMisal Dengan tag:\n${prefix + command} ${args[0]} Kepada @\nMaka akan Menjadi:\nKepada @0\n\nMisal dengan Tag admin:\n${prefix + command} ${args[0]} Dari @admin untuk @\nMaka akan Menjadi:\nDari @${m.sender.split('@')[0]} untuk @0\n\nMisal dengan Nama grup:\n${prefix + command} ${args[0]} Dari @admin untuk @ di @subject\nMaka akan Menjadi:\nDari @${m.sender.split('@')[0]} untuk @0 di ${m.metadata.subject}`, { mentions: ['0@s.whatsapp.net'] });
							break;
						default:
							m.reply(`Settings Group ${m.metadata.subject}\n- open\n- close\n- join acc/reject\n- disappearing 90/7/1/off\n- antilink on/off ${set.antilink ? '🟢' : '🔴'}\n- antivirtex on/off ${set.antivirtex ? '??' : '🔴'}\n- antidelete on/off ${set.antidelete ? '🟢' : '🔴'}\n- welcome on/off ${set.welcome ? '🟢' : '🔴'}\n- leave on/off ${set.leave ? '🟢' : '🔴'}\n- promote on/off ${set.promote ? '🟢' : '🔴'}\n- demote on/off ${set.demote ? '🟢' : '🔴'}\n- setinfo on/off ${set.setinfo ? '🟢' : '🔴'}\n- nsfw on/off ${set.nsfw ? '??' : '🔴'}\n- waktusholat on/off ${set.waktusholat ? '🟢' : '🔴'}\n- antihidetag on/off ${set.antihidetag ? '🟢' : '🔴'}\n- antitoxic on/off ${set.antitoxic ? '🟢' : '🔴'}\n- antitagsw on/off ${set.antitagsw ? '🟢' : '🔴'}\n\n- setwelcome _textnya_\n- setleave _textnya_\n- setpromote _textnya_\n- setdemote _textnya_\n\nExample:\n${prefix + command} antilink off`);
					}
				}
				break;
			case 'tagall':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!m.isAdmin) return m.reply(global.mess.admin);
					if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
					let setv = pickRandom(global.listv);
					let teks = `*Tag All*\n\n*Pesan :* ${q ? q : ''}\n\n`;
					let participants = m.metadata?.participants || [];
					if (participants.length === 0) return m.reply('Data member grup tidak tersedia! Harap coba lagi nanti.');
					for (let mem of participants) {
						teks += `${setv} @${mem.phoneNumber.split('@')[0]}\n`;
					}
					await m.reply(teks, {
						mentions: participants.map(a => a.phoneNumber),
					});
				}
				break;
			case 'hidetag':
			case 'h':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!m.isAdmin) return m.reply(global.mess.admin);
					if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
					let participants = m.metadata?.participants || [];
					if (participants.length === 0) return m.reply('Data member grup tidak tersedia! Harap coba lagi nanti.');
					await m.reply(q ? q : '', {
						mentions: participants.map(a => a.phoneNumber),
					});
				}
				break;
			case 'hgc':
			case 'hidetaggroup':
				{
					if (!isCreator) return m.reply(global.mess.owner); 
					let [groupId, ...pesanArr] = text.split('|');
					let pesan = pesanArr.join('|').trim();

					groupId = groupId ? groupId.trim() : '';

					if (!text || !pesan || !groupId) {
						return m.reply(`*Format Salah!*\n\nCara penggunaan:\n${prefix + command} idgrup | pesan\n\nContoh:\n${prefix + command} 12036304xxx@g.us | Halo grup sebelah!`);
					}

					if (!groupId.endsWith('@g.us')) {
						return m.reply('❌ ID Grup tidak valid! Pastikan ID-nya berakhiran *@g.us*');
					}

					m.react('⏳');
					try {
						const groupMetadata = await xync.groupMetadata(groupId);
						const participants = groupMetadata.participants;

						if (!participants || participants.length === 0) {
							return m.reply('❌ Data member grup tidak tersedia! Pastikan bot sudah bergabung di grup tersebut.');
						}

						await xync.sendMessage(groupId, {
							text: pesan,
							mentions: participants.map(a => a.id),
						});

						m.react('✔️');
						m.reply(`✅ Sukses mengirim pesan hidetag ke grup:\n*${groupMetadata.subject}*`);
					} catch (error) {
						m.react('✖️');
						m.reply(`❌ Gagal mengirim pesan!\nPastikan bot masih menjadi member di grup tersebut.\n\nError: ${error.message}`);
					}
				}
				break;
			case 'totag':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!m.isAdmin) return m.reply(global.mess.admin);
					if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
					if (!m.quoted) return m.reply(global.mess.quoted);
					delete m.quoted.chat;
					let participants = m.metadata?.participants || [];
					if (participants.length === 0) return m.reply('Data member grup tidak tersedia! Harap coba lagi nanti.');
					await xync.sendMessage(m.chat, {
						forward: m.quoted.fakeObj(),
						mentions: participants.map(a => a.phoneNumber),
					});
				}
				break;
			case 'listonline':
			case 'liston':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
					let id = args && /\d+\-\d+@g.us/.test(args[0]) ? args[0] : m.chat;
					if (!store.presences || !store.presences[id]) return m.reply('Sedang Tidak ada yang online!');
					const groupPresences = store.presences[id];
					const metadata = store.groupMetadata[id];
					let list_online = [];
					if (metadata && metadata.participants) {
						for (const p of metadata.participants) {
							if (groupPresences[p.id]) {
								list_online.push(p.phoneNumber);
							}
						}
					}
					if (!list_online.includes(botNumber)) {
						list_online.push(botNumber);
					}
					if (list_online.length === 0) return m.reply('Sedang tidak ada yang online!');
					let textReply = '*List Online:*\n\n' + list_online.map(v => setv + ' @' + v.split('@')[0]).join('\n');
					await m.reply(textReply, { mentions: list_online }).catch(() => m.reply('Gagal menampilkan list online..'));
				}
				break;
			case 'totalpesan':
			case 'totalchat':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!m.isAdmin) return m.reply(global.mess.admin);
					if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
					let messageCount = {};
					let messages = store?.messages[m.chat]?.array || [];
					let participants = (m?.metadata?.participants?.map(p => p.phoneNumber) || store?.messages[m.chat]?.array?.map(p => p.key.participantAlt) || []).filter(p => p);
					messages.forEach(mes => {
						if (mes.key?.participantAlt && mes.message) {
							messageCount[mes.key.participantAlt] = (messageCount[mes.key.participantAlt] || 0) + 1;
						}
					});
					let totalMessages = Object.values(messageCount).reduce((a, b) => a + b, 0);
					let date = new Date().toLocaleDateString('id-ID');
					let zeroMessageUsers = participants.filter(user => !messageCount[user]).map(user => `- @${user.replace(/[^0-9]/g, '')}`);
					let messageList = Object.entries(messageCount).map(([sender, count], index) => `${index + 1}. @${sender.replace(/[^0-9]/g, '')}: ${count} Pesan`);
					let result = `Total Pesan ${totalMessages} dari ${participants.length} anggota\nPada tanggal ${date}:\n${messageList.join('\n')}\n\nNote: ${text.length > 0 ? `\n${zeroMessageUsers.length > 0 ? `Sisa Anggota yang tidak mengirim pesan (Sider):\n${zeroMessageUsers.join('\n')}` : 'Semua anggota sudah mengirim pesan!'}` : `\nCek Sider? ${prefix + command} --sider`}`;
					m.reply(result);
				}
				break;

			// Bot Menu
			case 'owner':
			{
				try {
					const ai = new AIRich(xync);
					ai.addSection({
						view_model: {
							primitive: {
								media: {
									url: "https://cdn.zass.in/NiCadzqi1K.jpeg",
									mime_type: "image/png",
									width: 16,
									height: 9
								},
								imagine_type: "IMAGE",
								status: { status: "READY" },
								__typename: "GenAIImaginePrimitive"
							},
							__typename: "GenAISingleLayoutViewModel"
						}
					});
		
					ai.addSection({
						view_model: {
							primitive: {
								__typename: "GenAICompactEntityPrimitive",
								title: "Renx",
								subtitle: `Owner of ${botname}`,
								secondary_subtitle: "Editor",
								entity_id: "62882020521943",
								entity_url: "https://renx.web.id",
								entity_type: "PAGE",
								action_type: "FOLLOW",
								is_verified: true,
								image: {
									url: "https://cdn.zass.in/pjNKL9ijXA.jpeg",
									url_fallback: "https://cdn.zass.in/pjNKL9ijXA.jpeg"
								}
							},
							__typename: "GenAISingleLayoutViewModel"
						}
					});
					await ai.send(m.chat, {
						quoted: m,
						bypassDownload: true
					});
				} catch (e) {
					console.error(e);
					m.reply(`${e.message}`);
				}
			}
			break;
			case 'listowner':
				{
					await xync.sendContact(m.chat, ownerNumber, m);
				}
				break;
			case 'profile':
			case 'me':
				{
					const user = Object.keys(db.users);
					const infoUser = db.users[m.sender];
					await m.reply(`*Profile @${m.sender.split('@')[0]} :*\n🐋User Bot : ${user.includes(m.sender) ? 'True' : 'False'}\n🔥User : ${isVip ? 'VIP' : isPremium ? 'PREMIUM' : 'FREE'}${isPremium ? `\n♻️Expired : ${checkStatus(m.sender, premium) ? formatDate(getExpired(m.sender, db.premium)) : '-'}` : ''}\n🎫Limit : ${infoUser.limit}\n💰Uang : ${infoUser ? infoUser.money.toLocaleString('id-ID') : '0'}`);
				}
				break;
			case 'leaderboard':
				{
					const entries = Object.entries(db.users)
						.sort((a, b) => b[1].money - a[1].money)
						.slice(0, 10)
						.map(entry => entry[0]);
					let teksnya = '▩ 「 *LEADERBOARD* 」\n';
					for (let i = 0; i < entries.length; i++) {
						teksnya += `│• ${i + 1}. @${entries[i].split('@')[0]}\n│• Balance : ${db.users[entries[i]].money.toLocaleString('id-ID')}\n│\n`;
					}
					m.reply(teksnya + '╰──────···');
				}
				break;
			case 'req':
			case 'request':
				{
					if (!text) return m.reply('Mau Request apa ke Owner?');
					await m.reply(`*Request Telah Terkirim Ke Owner*\n_Terima Kasih🙏_`);
					await xync.sendFromOwner(ownerNumber, `Pesan Dari : @${m.sender.split('@')[0]}\nUntuk Owner\n\nRequest ${text}`, m, { contextInfo: { mentionedJid: [m.sender] } });
				}
				break;
			case 'totalfitur':
				{
					const total = (
						fs
							.readFileSync(__filename)
							.toString()
							.match(/case '/g) || []
					).length;
					m.reply(`Total Fitur : ${total}`);
				}
				break;
			case 'daily':
			case 'claim':
				{
					daily(m, db);
				}
				break;
			case 'transfer':
			case 'tf':
				{
					transfer(m, args, db);
				}
				break;
			case 'buy':
				{
					buy(m, args, db);
				}
				break;
			case 'react':
				{
					xync.sendMessage(m.chat, {
						react: { text: args[0], key: m.quoted ? m.quoted.key : m.key },
					});
				}
				break;
			case 'tagme':
				{
					m.reply(`@${m.sender.split('@')[0]}`, { mentions: [m.sender] });
				}
				break;
			case 'runtime':
			case 'tes':
			case 'bot':
				{
					if (!args[0] && !args[1]) return m.reply(`*Bot Telah Online Selama*\n*${runtime(process.uptime())}*`);
					switch (args[0]) {
						case 'mode':
						case 'public':
						case 'self':
							if (!isCreator) return m.reply(global.mess.owner);
							if (args[1] == 'public' || args[1] == 'all') {
								if (xync.public && set.grouponly && set.privateonly) return m.reply('*Sudah Aktif Sebelumnya*');
								xync.public = set.public = true;
								set.grouponly = true;
								set.privateonly = true;
								m.reply('*Sukses Change To Public Usage*');
							} else if (args[1] == 'self') {
								set.grouponly = false;
								set.privateonly = false;
								xync.public = set.public = false;
								m.reply('*Sukses Change To Self Usage*');
							} else if (args[1] == 'group') {
								set.grouponly = true;
								set.privateonly = false;
								m.reply('*Sukses Change To Group Only*');
							} else if (args[1] == 'private') {
								set.grouponly = false;
								set.privateonly = true;
								m.reply('*Sukses Change To Private Only*');
							} else m.reply('Mode self/public/group/private/all');
							break;
						case 'log':
						case 'anticall':
						case 'autobio':
						case 'autoread':
						case 'autotyping':
						case 'readsw':
						case 'multiprefix':
						case 'antispam':
						case 'didyoumean':
						case 'membernoprefix':
						case 'wajibfollow':
							if (!isCreator) return m.reply(global.mess.owner);
							if (args[1] == 'on') {
								if (set[args[0]]) return m.reply('*Sudah Aktif Sebelumnya*');
								set[args[0]] = true;
								m.reply('*Sukses Change To On*');
							} else if (args[1] == 'off') {
								set[args[0]] = false;
								m.reply('*Sukses Change To Off*');
							} else m.reply(`${args[0].charAt(0).toUpperCase() + args[0].slice(1)} on/off`);
							break;
						case 'set':
						case 'settings':
							let settingsBot = Object.entries(set)
								.map(([key, value]) => {
									let list =
										key == 'status'
											? new Date(value).toLocaleString('id-ID', {
													hour: '2-digit',
													minute: '2-digit',
													second: '2-digit',
												})
											: typeof value === 'boolean'
												? value
													? 'on🟢'
													: 'off🔴'
												: typeof value === 'object'
													? `\n${value.map(a => '- ' + a).join('\n')}`
													: value;
									return `- ${key.charAt(0).toUpperCase() + key.slice(1)} : ${list}`;
								})
								.join('\n');
							m.reply(`Settings Bot @${botNumber.split('@')[0]}\n${settingsBot}\n\nExample: ${prefix + command} mode`);
							break;
						case 'author':
						case 'authorprefix':
							if (!isCreator) return m.reply(global.mess.owner);
							if (args[1] == 'on') {
								set.authorPrefix = '.';
								m.reply(global.mess.done);
							} else if (args[1] == 'off') {
								set.authorPrefix = '';
								m.reply(global.mess.done);
							} else m.reply(`${args[0].charAt(0).toUpperCase() + args[0].slice(1)} on/off`);
							break;
						case 'whitelist':
						case 'whitelistmode':
							if (!isCreator) return m.reply(global.mess.owner);
							if (args[1] == 'on') {
								set.whitelistonly = true;
								m.reply('*Sukses Change To Whitelist Mode*');
							} else if (args[1] == 'off') {
								set.whitelistonly = false;
								m.reply('*Sukses Change To Normal Mode*');
							} else m.reply('Whitelist on/off');
							break;
						default: {
							let menuList = `*⚙️ SETTINGS BOT ⚙️*
					
Select Bot Settings:

*👥 Mode Penggunaan:*
- Mode Bot : *${prefix + command} mode [public/self/group/private]*
- Whitelist Mode : *${prefix + command} whitelist [on/off]*

*🎛️ Fitur Otomatis (on/off):*
- Wajib Follow : *${prefix + command} wajibfollow [on/off]*
- Anti Call : *${prefix + command} anticall [on/off]*
- Anti Spam : *${prefix + command} antispam [on/off]*
- Auto Bio : *${prefix + command} autobio [on/off]*
- Auto Read : *${prefix + command} autoread [on/off]*
- Auto Typing : *${prefix + command} autotyping [on/off]*
- Read Status/SW : *${prefix + command} readsw [on/off]*

*🛠️ System Settings:*
- Multi Prefix : *${prefix + command} multiprefix [on/off]*
- Member No Prefix : *${prefix + command} membernoprefix [on/off]*
- Did You Mean : *${prefix + command} didyoumean [on/off]*
- Log Console : *${prefix + command} log [on/off]*
- Author Prefix : *${prefix + command} author [on/off]*

*📊 Info & Status:*
- Cek Semua Setting : *${prefix + command} set*
- Cek Runtime Bot : *${prefix + command}*`;
							if (args[0] || args[1]) m.reply(menuList);
						}
					}
				}
				break;
				case 'ping':
		    	case 'botstatus':
		    	case 'statusbot':
				{
					const start = Date.now();
	
					try {
						const os = require('os');
						const fs = require('fs');
						const { execSync } = require('child_process');
						const { AIRich } = await import('./messagebuilder.js'); 
	
						const BANNER = 'https://c.termai.cc/a199/0Dw0j.jpg';
	
						function formatSize(bytes) {
							const u = ['B', 'KB', 'MB', 'GB', 'TB'];
							let i = 0,
								v = bytes;
							while (v >= 1024 && i < u.length - 1) {
								v /= 1024;
								i++;
							}
							return `${v.toFixed(i === 0 ? 0 : 2)} ${u[i]}`;
						}
	
						function getDisk() {
							try {
								const out = execSync('df -kP /', { timeout: 3000 }).toString().trim().split('\n');
								const r = out.slice(1).map(l => l.trim().split(/\s+/))[0];
								const total = +r[1] * 1024,
									used = +r[2] * 1024;
								return {
									total,
									used,
									percent: +((used / total) * 100).toFixed(1),
								};
							} catch {
								return null;
							}
						}
	
						function getSwap() {
							try {
								const f = fs.readFileSync('/proc/meminfo', 'utf8');
								const total = (f.match(/^SwapTotal:\s+(\d+)/) || [0, 0])[1] * 1024;
								const free = (f.match(/^SwapFree:\s+(\d+)/) || [0, 0])[1] * 1024;
								if (!total) return null;
								const used = total - free;
								return {
									total,
									used,
									free,
									percent: +((used / total) * 100).toFixed(1),
								};
							} catch {
								return null;
							}
						}
	
						function getNetwork() {
							const ni = os.networkInterfaces();
							let primary = '';
							for (const [, addrs] of Object.entries(ni)) {
								for (const a of addrs || []) {
									if (!a.internal && a.family === 'IPv4' && !primary) primary = a.address;
								}
							}
							return primary || '-';
						}
	
						const cores = os.cpus().length;
						const load = os.loadavg();
						const totalMem = os.totalmem(),
							freeMem = os.freemem();
						const usedMem = totalMem - freeMem;
						const heap = process.memoryUsage();
						const isBun = typeof Bun !== 'undefined';
						const disk = getDisk();
	
						const d = {
							botName: xync?.user?.name || 'WhatsApp Bot',
							cpu: +Math.min(99.9, (load[0] / Math.max(cores, 1)) * 100).toFixed(1),
							ram: +((usedMem / totalMem) * 100).toFixed(1),
							disk: disk ? disk.percent : 0,
							cpuShort: (os.cpus()[0]?.model || '?').replace(/\(R\)|\(TM\)/g, '').trim(),
							cores,
							osType: `${os.type()} ${os.release()}`,
							arch: os.arch(),
							memUsed: formatSize(usedMem),
							memTotal: formatSize(totalMem),
							heapUsed: formatSize(heap.heapUsed),
							rss: formatSize(heap.rss),
							diskTxt: disk ? `${formatSize(disk.used)} / ${formatSize(disk.total)}` : '-',
							swapTxt: (s => (s ? `${formatSize(s.used)} / ${formatSize(s.total)} (${s.percent}%)` : 'NONE'))(getSwap()),
							net: getNetwork(),
							runtime: isBun ? `Bun ${Bun.version}` : `Node ${process.version}`,
							engine: isBun ? 'JavaScriptCore' : `V8 ${process.versions.v8}`,
							botUpSec: Math.floor(process.uptime()),
							sysUpSec: Math.floor(os.uptime()),
							at: Date.now(),
							speed: Date.now() - start,
						};
	
						const DATA = JSON.stringify({
							cpu: d.cpu,
							ram: d.ram,
							disk: d.disk,
							botUpSec: d.botUpSec,
							sysUpSec: d.sysUpSec,
							at: d.at,
						}).replace(/</g, '\\u003c');
	
						const htmlPayload = `
	<style>
	:root { --bg: #000; --card: #09090b; --border: #27272a; --text: #fafafa; --muted: #a1a1aa; }
	* { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-tap-highlight-color: transparent; user-select: none; }
	body { background: var(--bg); color: var(--text); padding: 16px; display: flex; justify-content: center; min-height: 100vh; overflow-y: auto; }
	#app { width: 100%; max-width: 420px; background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 24px; }
	.hdr { display: flex; align-items: center; gap: 16px; margin-bottom: 28px; border-bottom: 1px solid var(--border); padding-bottom: 20px; }
	.hdr img { width: 48px; height: 48px; border-radius: 12px; object-fit: cover; filter: grayscale(30%); border: 1px solid var(--border); }
	.hdr-text { display: flex; flex-direction: column; gap: 4px; }
	.hdr-text h1 { font-size: 15px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text); }
	.hdr-text .st { font-size: 10px; color: var(--muted); display: flex; align-items: center; gap: 6px; font-family: monospace; letter-spacing: 0.5px; }
	.dot { width: 6px; height: 6px; background: #10b981; border-radius: 50%; box-shadow: 0 0 8px #10b981; animation: pulse 2s infinite; }
	@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
	.up { text-align: center; margin-bottom: 28px; }
	.up span { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: var(--muted); font-weight: 600; }
	.up b { display: block; font-size: 32px; font-weight: 300; margin: 8px 0; font-variant-numeric: tabular-nums; letter-spacing: -1px; color: var(--text); }
	.up small { font-size: 10px; color: var(--muted); font-family: monospace; }
	.g-wrap { display: flex; flex-direction: column; gap: 16px; margin-bottom: 28px; }
	.gauge { display: flex; flex-direction: column; gap: 8px; }
	.g-top { display: flex; justify-content: space-between; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); font-weight: 600; }
	.g-top span { color: var(--text); font-family: monospace; font-size: 11px; }
	.bar { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
	.bar i { display: block; height: 100%; width: 0%; background: var(--text); transition: width 1s cubic-bezier(0.4, 0, 0.2, 1); }
	.bar.r i { background: #ef4444; }
	.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-bottom: 24px; }
	.cell { background: var(--card); padding: 14px 12px; }
	.cell p { font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: 600; }
	.cell h3 { font-size: 12px; font-weight: 500; word-break: break-word; color: #e4e4e7; }
	.full { grid-column: span 2; }
	.ft { display: flex; justify-content: space-between; font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 1.5px; border-top: 1px solid var(--border); padding-top: 16px; font-weight: 600; }
	</style>
	<div id="app">
		<div class="hdr">
			<img src="${BANNER}" onerror="this.remove()">
			<div class="hdr-text">
				<h1>System Monitor</h1>
				<div class="st"><div class="dot"></div> REALTIME SYNC // <span id="spd" style="color:var(--text);">${d.speed}MS</span></div>
			</div>
		</div>
		<div class="up">
			<span>Total Uptime</span>
			<b id="up">-</b>
			<small id="sys">-</small>
		</div>
		<div class="g-wrap">
			<div class="gauge">
				<div class="g-top">CPU Usage <span id="cv">-</span></div>
				<div class="bar" id="cb"><i></i></div>
			</div>
			<div class="gauge">
				<div class="g-top">Memory <span id="rv">-</span></div>
				<div class="bar" id="rb"><i></i></div>
			</div>
			<div class="gauge">
				<div class="g-top">Storage <span id="dv">-</span></div>
				<div class="bar" id="db"><i></i></div>
			</div>
		</div>
		<div class="grid">
			<div class="cell"><p>Platform</p><h3>${d.osType}</h3></div>
			<div class="cell"><p>Architecture</p><h3>${d.arch}</h3></div>
			<div class="cell"><p>CPU Cores</p><h3>${d.cores} Cores</h3></div>
			<div class="cell"><p>Swap Space</p><h3>${d.swapTxt}</h3></div>
			<div class="cell full"><p>Heap / RSS Memory</p><h3>${d.heapUsed} / ${d.rss}</h3></div>
			<div class="cell full"><p>Network IP</p><h3>${d.net}</h3></div>
			<div class="cell full"><p>Runtime Engine</p><h3>${d.runtime} // ${d.engine}</h3></div>
		</div>
		<div class="ft">
			<span id="age">SYNCING...</span>
			<span>${d.botName}</span>
		</div>
	</div>
	<script>
	var D=${DATA};
	function $(i){return document.getElementById(i)}
	function fmt(s){
		var d=Math.floor(s/86400), h=Math.floor(s%86400/3600), m=Math.floor(s%3600/60), x=s%60;
		return (d?d+'D ':'')+(h||d?h+'H ':'')+(m||h||d?m+'M ':'')+x+'S';
	}
	function paint(cpu,ram,disk){
		$('cb').firstChild.style.width = cpu+'%'; $('cv').textContent = cpu.toFixed(1)+'%';
		$('rb').firstChild.style.width = ram+'%'; $('rv').textContent = ram.toFixed(1)+'%';
		$('db').firstChild.style.width = disk+'%'; $('dv').textContent = disk.toFixed(1)+'%';
		$('cb').className = 'bar' + (cpu > 85 ? ' r' : '');
		$('rb').className = 'bar' + (ram > 85 ? ' r' : '');
		$('db').className = 'bar' + (disk > 90 ? ' r' : '');
	}
	function tick(){
		var el = Math.floor((Date.now()-D.at)/1000);
		$('up').textContent = fmt(D.botUpSec+el);
		$('sys').textContent = 'SYS UPTIME: ' + fmt(D.sysUpSec+el);
		$('age').textContent = 'UPDATED ' + el + 'S AGO';
	}
	function breathe(){
		var n = function(v,amp,lo,hi){
			var x = v + (Math.random()*2-1)*amp;
			return Math.max(lo,Math.min(hi,x));
		};
		paint(n(D.cpu,2,1,99), n(D.ram,1,1,99), n(D.disk,0.2,1,99));
	}
	paint(0,0,0); setTimeout(function(){ breathe() }, 350);
	setInterval(breathe, 2000);
	setInterval(tick, 1000); tick();
	</script>
	`;
	
						const card = new AIRich(xync, {
							dynamic: true,
							unsupportedTypeAlert: false,
						});
	
						card.addSection({
							view_model: {
								primitive: {
									__typename: 'GenAIaeacdsnwHtmlPrimitive',
									payload: htmlPayload,
									trusted_sources: ['termai.cc'],
								},
								__typename: 'GenAISingleLayoutViewModel',
							},
						});
	
						await card.send(m.chat, {
							quoted: m,
							includesUnifiedResponse: true,
							includesSubmessages: false,
							forwarded: true,
							notification: false,
						});
					} catch (error) {
						console.error('[PINGLIVE ERROR] :', error);
						m.reply(`Eror: ${error.message}`);
					}
				}
			break;
			case 'speedtest':
			case 'speed':
				{
					m.reply('Testing Speed...');
					let cp = require('child_process');
					let { promisify } = require('util');
					let exec = promisify(cp.exec).bind(cp);
					let o;
					try {
						o = await exec('python3 speed.py --share');
					} catch (e) {
						o = e;
					} finally {
						let { stdout, stderr } = o;
						if (stdout.trim()) m.reply(stdout);
						if (stderr.trim()) m.reply(stderr);
					}
				}
				break;
			case 'afk':
				{
					let user = db.users[m.sender];
					user.afkTime = +new Date();
					user.afkReason = text;
					m.reply(`@${m.sender.split('@')[0]} Telah Afk${text ? ': ' + text : ''}`);
				}
				break;
			case 'readviewonce':
			case 'rvo':
				{
					if (!m.quoted) return m.reply(global.mess.quoted);
					try {
						if (m.quoted.msg.viewOnce) {
							delete m.quoted.chat;
							m.quoted.msg.viewOnce = false;
							await m.reply({ forward: m.quoted });
						} else m.reply(`Reply view once message\nExample: ${prefix + command}`);
					} catch (e) {
						m.reply('Media Tidak Valid!');
					}
				}
				break;
			case 'inspect':
				{
					if (!text) return m.reply('Masukkan Link Grup atau Saluran!');
					let _grup = /chat.whatsapp.com\/([\w\d]*)/;
					let _saluran = /whatsapp\.com\/channel\/([\w\d]*)/;
					if (_grup.test(text)) {
						await xync
							.groupGetInviteInfo(text.match(_grup)[1])
							.then(_g => {
								let teks = `*[ INFORMATION GROUP ]*\n\nName Group: ${_g.subject}\nGroup ID: ${_g.id}\nCreate At: ${new Date(_g.creation * 1000).toLocaleString()}${_g.owner ? '\nCreate By: ' + _g.owner : ''}\nLinked Parent: ${_g.linkedParent}\nRestrict: ${_g.restrict}\nAnnounce: ${_g.announce}\nIs Community: ${_g.isCommunity}\nCommunity Announce:${_g.isCommunityAnnounce}\nJoin Approval: ${_g.joinApprovalMode}\nMember Add Mode: ${_g.memberAddMode}\nDescription ID: ${'`' + _g.descId + '`'}\nDescription: ${_g.desc}\nParticipants:\n`;
								_g.participants.forEach(a => {
									teks += a.admin ? `- Admin: @${a.id.split('@')[0]} [${a.admin}]\n` : '';
								});
								m.reply(teks);
							})
							.catch(e => {
								if ([400, 406].includes(e.data)) return m.reply('Grup Tidak Di Temukan❗');
								if (e.data == 401) return m.reply('Bot Di Kick Dari Grup Tersebut❗');
								if (e.data == 410) return m.reply('Url Grup Telah Di Setel Ulang❗');
							});
					} else if (_saluran.test(text) || text.endsWith('@newsletter') || !isNaN(text)) {
						await xync
							.newsletterMsg(text.match(_saluran)[1])
							.then(n => {
								m.reply(`*[ INFORMATION CHANNEL ]*\n\nID: ${n.id}\nState: ${n.state.type}\nName: ${n.thread_metadata.name.text}\nCreate At: ${new Date(n.thread_metadata.creation_time * 1000).toLocaleString()}\nSubscriber: ${n.thread_metadata.subscribers_count}\nVerification: ${n.thread_metadata.verification}\nDescription: ${n.thread_metadata.description.text}\n`);
							})
							.catch(e => m.reply('Saluran Tidak Di Temukan❗'));
					} else m.reply('Hanya Support Url Grup atau Saluran!');
				}
				break;
			case 'addmsg':
				{
					if (!m.quoted) return m.reply('Reply Pesan Yang Ingin Disave Di Database');
					if (!text) return m.reply(`Example : ${prefix + command} file name`);
					let msgs = db.database;
					if (text.toLowerCase() in msgs) return m.reply(`'${text}' telah terdaftar di list pesan`);
					msgs[text.toLowerCase()] = m.quoted;
					delete msgs[text.toLowerCase()].chat;
					m.reply(`Berhasil menambahkan pesan di list pesan sebagai '${text}'\nAkses dengan ${prefix}getmsg ${text}\nLihat list Pesan Dengan ${prefix}listmsg`);
				}
				break;
			case 'delmsg':
			case 'deletemsg':
				{
					if (!text) return m.reply('Nama msg yg mau di delete?');
					let msgs = db.database;
					if (text == 'allmsg') {
						db.database = {};
						m.reply('Berhasil menghapus seluruh msg dari list pesan');
					} else {
						if (!(text.toLowerCase() in msgs)) return m.reply(`'${text}' tidak terdaftar didalam list pesan`);
						delete msgs[text.toLowerCase()];
						m.reply(`Berhasil menghapus '${text}' dari list pesan`);
					}
				}
				break;
			case 'getmsg':
				{
					if (!text) return m.reply(`Example : ${prefix + command} file name\n\nLihat list pesan dengan ${prefix}listmsg`);
					let msgs = db.database;
					if (!(text.toLowerCase() in msgs)) return m.reply(`'${text}' tidak terdaftar di list pesan`);
					await xync.relayMessage(m.chat, msgs[text.toLowerCase()], {});
				}
				break;
			case 'listmsg':
				{
					let seplit = Object.entries(db.database).map(([nama, isi]) => {
						return { nama, message: getContentType(isi) };
					});
					let teks = '「 LIST DATABASE 」\n\n';
					for (let i of seplit) {
						teks += `${setv} *Name :* ${i.nama}\n${setv} *Type :* ${i.message?.replace(/Message/i, '')}\n───────────────\n`;
					}
					m.reply(teks);
				}
				break;
			case 'setcmd':
			case 'addcmd':
				{
					if (!m.quoted) return m.reply(global.mess.quoted);
					if (!m.quoted.fileSha256) return m.reply('SHA256 Hash Missing!');
					if (!text) return m.reply(`Example : ${prefix + command} CMD Name`);
					let hash = m.quoted.fileSha256.toString('base64');
					if (global.db.cmd[hash] && global.db.cmd[hash].locked) return m.reply('You have no permission to change this sticker command');
					global.db.cmd[hash] = {
						creator: m.sender,
						locked: false,
						at: +new Date(),
						text,
					};
					m.reply(global.mess.done);
				}
				break;
			case 'delcmd':
				{
					if (!m.quoted) return m.reply(global.mess.quoted);
					if (!m.quoted.fileSha256) return m.reply('SHA256 Hash Missing!');
					let hash = m.quoted.fileSha256.toString('base64');
					if (global.db.cmd[hash] && global.db.cmd[hash].locked) return m.reply('You have no permission to change this sticker command');
					delete global.db.cmd[hash];
					m.reply(global.mess.done);
				}
				break;
			case 'listcmd':
				{
					let teks = `*List Hash*\nInfo: *bold* hash is Locked\n${Object.entries(global.db.cmd)
						.map(([key, value], index) => `${index + 1}. ${value.locked ? `*${key}*` : key} : ${value.text}`)
						.join('\n')}`.trim();
					xync.sendText(m.chat, teks, m);
				}
				break;
			case 'lockcmd':
			case 'unlockcmd':
				{
					if (!isCreator) return m.reply(global.mess.owner);
					if (!m.quoted) return m.reply(global.mess.quoted);
					if (!m.quoted.fileSha256) return m.reply('SHA256 Hash Missing!');
					let hash = m.quoted.fileSha256.toString('base64');
					if (!(hash in global.db.cmd)) return m.reply('You have no permission to change this sticker command');
					global.db.cmd[hash].locked = !/^un/i.test(command);
				}
				break;
			case 'reply':
			case 'quoted':
				{
					if (!m.quoted) return m.reply(global.mess.quoted);
					if (text) {
						delete m.quoted.chat;
						await m.reply({ forward: m.quoted });
					} else {
						try {
							const anu = await m.getQuotedObj();
							if (!anu) return m.reply('Format Tidak Tersedia!');
							if (!anu.quoted) return m.reply('Pesan Yang Anda Reply Tidak Mengandung Reply');
							await xync.relayMessage(m.chat, { [anu.quoted.type]: anu.quoted.msg }, {});
						} catch (e) {
							return m.reply('Format Tidak Tersedia!');
						}
					}
				}
				break;
			case 'confes':
			case 'confess':
			case 'menfes':
			case 'menfess':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (m.isGroup) return m.reply(global.mess.private);
					if (menfes[m.sender]) return m.reply(`Kamu Sedang Berada Di Sesi ${command}!`);
					if (!text) return m.reply(`Example : ${prefix + command} 62xxxx|Nama Samaran`);
					let [teks1, teks2] = text.split`|`;
					if (teks1) {
						const tujuan = teks1.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
						const onWa = await xync.onWhatsApp(tujuan);
						if (!onWa.length > 0) return m.reply(global.mess.onWa);
						menfes[m.sender] = {
							tujuan: tujuan,
							nama: teks2 ? teks2 : 'Orang',
						};
						menfes[tujuan] = {
							tujuan: m.sender,
							nama: 'Penerima',
						};
						const timeout = setTimeout(() => {
							if (menfes[m.sender]) {
								m.reply(`_Waktu ${command} habis_`);
								delete menfes[m.sender];
							}
							if (menfes[tujuan]) {
								xync.sendMessage(tujuan, { text: `_Waktu ${command} habis_` });
								delete menfes[tujuan];
							}
							menfesTimeouts.delete(m.sender);
							menfesTimeouts.delete(tujuan);
						}, 600000);
						menfesTimeouts.set(m.sender, timeout);
						menfesTimeouts.set(tujuan, timeout);
						xync.sendMessage(tujuan, {
							text: `_${command} connected_\n*Note :* jika ingin mengakhiri ketik _*${prefix}del${command}*_`,
						});
						m.reply(`_Memulai ${command}..._\n*Silahkan Mulai kirim pesan/media*\n*Durasi ${command} hanya selama 10 menit*\n*Note :* jika ingin mengakhiri ketik _*${prefix}del${command}*_`);
						setLimit(m, db);
					} else m.reply(`Masukkan Nomernya!\nExample : ${prefix + command} 62xxxx|Nama Samaran`);
				}
				break;
			case 'delconfes':
			case 'delconfess':
			case 'delmenfes':
			case 'delmenfess':
				{
					if (!menfes[m.sender]) return m.reply(`Kamu Tidak Sedang Berada Di Sesi ${command.split('del')[1]}!`);
					let anu = menfes[m.sender];
					if (menfesTimeouts.has(m.sender)) {
						clearTimeout(menfesTimeouts.get(m.sender));
						menfesTimeouts.delete(m.sender);
					}
					if (menfesTimeouts.has(anu.tujuan)) {
						clearTimeout(menfesTimeouts.get(anu.tujuan));
						menfesTimeouts.delete(anu.tujuan);
					}
					xync.sendMessage(anu.tujuan, {
						text: `Chat Di Akhiri Oleh ${anu.nama ? anu.nama : 'Seseorang'}`,
					});
					m.reply(`Sukses Mengakhiri Sesi ${command.split('del')[1]}!`);
					delete menfes[anu.tujuan];
					delete menfes[m.sender];
				}
				break;
			case 'cai':
			case 'roomai':
			case 'chatai':
			case 'autoai':
				{
					if (m.isGroup) return m.reply(global.mess.private);
					if (chat_ai[m.sender]) return m.reply(`Kamu Sedang Berada Di Sesi ${command}!`);
					if (!text) return m.reply(`Example: ${prefix + command} halo ngab\nWith Prompt: ${prefix + command} halo ngab|Kamu adalah assisten yang siap membantu dalam hal apapun yang ku minta.\n\nUntuk Menghapus room: ${prefix + 'del' + command}`);
					let [teks1, teks2] = text.split`|`;
					chat_ai[m.sender] = [
						{ role: 'system', content: teks2 || '' },
						{ role: 'user', content: text.split`|` ? teks1 : text || '' },
					];
					let hasil = await fetchApi(
						'/ai/chat4',
						{
							messages: chat_ai[m.sender],
							prompt: budy,
						},
						{ method: 'POST' },
					);
					const response = hasil?.result?.message || 'Maaf, saya tidak mengerti.';
					chat_ai[m.sender].push({ role: 'assistant', content: response });
					await m.reply(response);
				}
				break;
			case 'delcai':
			case 'delroomai':
			case 'delchatai':
			case 'delautoai':
				{
					if (!chat_ai[m.sender]) return m.reply(`Kamu Tidak Sedang Berada Di Sesi ${command.split('del')[1]}!`);
					m.reply(`Sukses Mengakhiri Sesi ${command.split('del')[1]}!`);
					delete chat_ai[m.sender];
				}
				break;
			case 'jadibot':
				{
					if (!isPremium) return m.reply(global.mess.prem);
					if (!isLimit) return m.reply(global.mess.limit);
					const nmrnya = text ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : m.sender;
					const onWa = await xync.onWhatsApp(nmrnya);
					if (!onWa.length > 0) return m.reply(global.mess.onWa);
					await JadiBot(xync, nmrnya, m, store);
					m.reply(`Gunakan ${prefix}stopjadibot\nUntuk Berhenti`);
					setLimit(m, db);
				}
				break;
			case 'stopjadibot':
			case 'deljadibot':
				{
					const nmrnya = text ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : m.sender;
					const onWa = await xync.onWhatsApp(nmrnya);
					if (!onWa.length > 0) return m.reply(global.mess.onWa);
					await StopJadiBot(xync, nmrnya, m);
				}
				break;
			case 'listjadibot':
				{
					ListJadiBot(xync, m);
				}
				break;

			// Tools Menu
		    	case 'fotolive': {
			    const { prepareWAMessageMedia, generateWAMessageFromContent } = require('baileys');
			
			    let q = m.quoted ? m.quoted : m;
			    let mime = (q.msg || q).mimetype || '';
			
			    if (!mime.includes('video')) {
			        return m.reply('Lu harus kirim video atau reply video dengan command ini cuy!');
			    }
			
			    try {
			
			        const videoBuffer = await q.download();
			
			        const image = await prepareWAMessageMedia(
			            { image: { url: 'https://cdn.ornzora.eu.cc/a6a1e8f4-b83d-4694-9bba-0f22a58bfd4f-FIORA.jpg' } },
			            { upload: conn.waUploadToServer }
			        );
			
			        const video = await prepareWAMessageMedia(
			            { video: videoBuffer },
			            { upload: conn.waUploadToServer }
			        );
			
			        const msg = generateWAMessageFromContent(
			            m.chat,
			            { 
			                imageMessage: { 
			                    ...image.imageMessage, 
			                    contextInfo: { pairedMediaType: 5, statusSourceType: 0 } 
			                } 
			            },
			            { quoted: m }
			        );
			
			        await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
			
			        await conn.relayMessage(
			            m.chat,
			            {
			                videoMessage: {
			                    ...video.videoMessage,
			                    contextInfo: { pairedMediaType: 6, statusSourceType: 0 },
			                },
			                messageContextInfo: {
			                    messageAssociation: { associationType: 12, parentMessageKey: msg.key }
			                }
			            },
			            {}
			        );
			
			    } catch (error) {
			        console.error('[ERROR PAIRED VID]:', error);
			        await m.react('');
			        m.reply(`Gagal memproses video cuy!\n\n> Log: ${error.message}`);
			    }
			}
			break;
			case 'calculator':
			case 'kalkulator':
				{
					if (!isLimit) return m.reply(global.mess.limit);

					try {
						const crypto = require('crypto');
						const { generateWAMessageFromContent } = require('baileys');

						const htmlPayload = `<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
html,body{margin:0;padding:0;width:100%;min-height:100%;background:transparent;font-family:Arial,Helvetica,sans-serif;color:#fff;overflow:hidden;touch-action:manipulation}
.wrap{width:100%;max-width:380px;margin:auto;padding:10px}
.card{position:relative;overflow:hidden;border-radius:24px;background:linear-gradient(180deg,#171525 0%,#0b0a12 100%);border:1px solid rgba(255,255,255,.13);box-shadow:0 20px 55px rgba(0,0,0,.55),inset 0 1px rgba(255,255,255,.08);padding:20px}
.header{display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:14px}
.mini{font-size:10px;letter-spacing:2px;color:#77748c;margin-bottom:3px}
.title{font-size:18px;font-weight:800}
.display{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:16px;text-align:right;margin-bottom:16px;box-shadow:inset 0 2px 10px rgba(0,0,0,.4)}
.display-sub{font-size:12px;color:#8696a0;min-height:16px;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis}
.display-main{font-size:32px;font-weight:bold;color:#fff;overflow:hidden;text-overflow:ellipsis}
.keypad{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.btn{aspect-ratio:1.2;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;color:#fff;font-size:18px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s;box-shadow:0 4px 12px rgba(0,0,0,.2)}
.btn:active{transform:scale(.92);background:rgba(255,255,255,.12)}
.btn.op{color:#8b79ff;background:rgba(105,87,229,.1);border-color:rgba(139,121,255,.25)}
.btn.action{color:#ff7979;background:rgba(255,121,121,.1);border-color:rgba(255,121,121,.25)}
.btn.equal{background:linear-gradient(135deg,#8270ff,#5946cc);border:none;box-shadow:0 6px 18px rgba(105,87,229,.4);grid-column:span 2;aspect-ratio:auto;height:auto}
</style>

<div class="wrap">
<div class="card">
<div class="header">
<div>
<div class="mini">Rxaync</div>
<div class="title">CALCULATOR</div>
</div>
</div>
<div class="display">
<div class="display-sub" id="subDisplay"></div>
<div class="display-main" id="mainDisplay">0</div>
</div>
<div class="keypad">
<button class="btn action" onclick="clearAll()">C</button>
<button class="btn op" onclick="appendValue('(')">(</button>
<button class="btn op" onclick="appendValue(')')">)</button>
<button class="btn op" onclick="appendValue('/')">÷</button>

<button class="btn" onclick="appendValue('7')">7</button>
<button class="btn" onclick="appendValue('8')">8</button>
<button class="btn" onclick="appendValue('9')">9</button>
<button class="btn op" onclick="appendValue('*')">×</button>

<button class="btn" onclick="appendValue('4')">4</button>
<button class="btn" onclick="appendValue('5')">5</button>
<button class="btn" onclick="appendValue('6')">6</button>
<button class="btn op" onclick="appendValue('-')">-</button>

<button class="btn" onclick="appendValue('1')">1</button>
<button class="btn" onclick="appendValue('2')">2</button>
<button class="btn" onclick="appendValue('3')">3</button>
<button class="btn op" onclick="appendValue('+')">+</button>

<button class="btn" onclick="appendValue('0')">0</button>
<button class="btn" onclick="appendValue('.')">.</button>
<button class="btn equal" onclick="calculate()">=</button>
</div>
</div>
</div>

<script>
let currentInput = '0';
let history = '';
const mainDisplay = document.getElementById('mainDisplay');
const subDisplay = document.getElementById('subDisplay');

function updateDisplay() {
	mainDisplay.textContent = currentInput;
	subDisplay.textContent = history;
}

function appendValue(val) {
	if (currentInput === '0' && val !== '.') {
		currentInput = val;
	} else {
		currentInput += val;
	}
	updateDisplay();
}

function clearAll() {
	currentInput = '0';
	history = '';
	updateDisplay();
}

function calculate() {
	try {
		history = currentInput;
		let sanitized = currentInput.replace(/×/g, '*').replace(/÷/g, '/');
		let result = eval(sanitized);
		currentInput = String(result);
		updateDisplay();
	} catch (e) {
		currentInput = 'خطأ';
		updateDisplay();
		setTimeout(clearAll, 1200);
	}
}
</script>`;

						const slots = {
							messageContextInfo: {
								deviceListMetadata: {},
								deviceListMetadataVersion: 2,
								botMetadata: {
									messageDisclaimerText: '',
									botResponseId: 'cylicdev-calc-' + Date.now(),
								},
							},
							botForwardedMessage: {
								message: {
									richResponseMessage: {
										messageType: 1,
										submessages: [
											{
												messageType: 2,
												messageText: 'CYLICDEV • CALCULATOR',
											},
										],
										unifiedResponse: {
											data: Buffer.from(
												JSON.stringify({
													response_id: 'cylicdev-calc-' + Date.now(),
													sections: [
														{
															view_model: {
																primitive: {
																	__typename: 'GenAIaeacdsnwHtmlPrimitive',
																	payload: htmlPayload,
																	trusted_sources: ['cylic.dev'],
																},
																__typename: 'GenAISingleLayoutViewModel',
															},
														},
													],
												}),
											).toString('base64'),
										},
										contextInfo: {
											forwardingScore: 1,
											isForwarded: true,
											forwardedAiBotMessageInfo: {
												botJid: '867051314767696@bot',
											},
											forwardOrigin: 4,
										},
									},
								},
							},
						};

						const msg = generateWAMessageFromContent(m.chat, slots, {});
						await xync.relayMessage(m.chat, msg.message, {
							messageId: msg.key.id,
						});

						setLimit(m, db);
					} catch (e) {
						console.error(e);
						m.reply(`Gagal: ${e.message}`);
					}
				}
				break;
			case 'nglspam': {
				if (!isPremium) return m.reply(global.mess.prem);
				if (!text) return m.reply(`Example:\n${prefix + command} pesan lu | https://ngl.link/username | 3`);

				const [customMessage, link, countStr] = text.split('|').map(v => (v ? v.trim() : ''));

				if (!customMessage || !link || !countStr) {
					return m.reply(`Example: ${prefix + command} pesan lu | https://ngl.link/username | 3`);
				}

				let count = parseInt(countStr);

				if (isNaN(count) || count < 1) {
					return m.reply('Masukkan angka yg valid.');
				}

				if (count > 50) {
					return m.reply('Maksimal 50 pesan!');
				}

				try {
					const crypto = require('crypto');
					const parsedUrl = new URL(link);
					const username = parsedUrl.pathname.replace('/', '');
					const apiUrl = 'https://ngl.link/api/submit';

					let successCount = 0;
					let failCount = 0;

					for (let i = 1; i <= count; i++) {
						const randomDeviceId = crypto.randomUUID();

						const response = await fetch(apiUrl, {
							method: 'POST',
							headers: {
								'Content-Type': 'application/x-www-form-urlencoded',
								Accept: '*/*',
								Origin: 'https://ngl.link',
								Referer: link,
								'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
								'X-Requested-With': 'XMLHttpRequest',
							},
							body: new URLSearchParams({
								username: username,
								question: customMessage,
								deviceId: randomDeviceId,
							}),
						});

						if (response.ok) {
							successCount++;
						} else {
							failCount++;
						}

						if (i < count) {
							await sleep(2000);
						}
					}

					m.reply(`Done!\n- Berhasil: ${successCount}\n- Gagal: ${failCount}`);
				} catch (error) {
					console.error('\n[ERROR NGL] :', error);
					m.reply('Eror! Pastikan link NGL valid.');
				}

				break;
			}
			case 'deploy':
			case 'vercel': {
				const fs = require('fs');
				const path = require('path');
				const axios = require('axios');
				let JSZip;
				try {
					JSZip = require('jszip');
				} catch (e) {}

				const VERCEL_TOKEN = global.APIKeys.vercel ;

				let filesToDeploy = [];
				let deployName = 'deploy-' + Math.floor(Math.random() * 10000);

				m.reply('Waitt...');

				try {
					if (m.quoted && (m.quoted.mimetype || m.quoted.type === 'documentMessage')) {
						let media = await xync.downloadAndSaveMediaMessage(qmsg);
						let fileName = qmsg.fileName || 'index.html';

						if (fileName.endsWith('.zip')) {
							if (!JSZip) return m.reply('Modul jszip belum diinstal di bot ini!');
							const zipData = fs.readFileSync(media);
							const zip = await JSZip.loadAsync(zipData);

							for (let relativePath of Object.keys(zip.files)) {
								let zipEntry = zip.files[relativePath];
								if (!zipEntry.dir && !relativePath.includes('node_modules') && !relativePath.includes('.git')) {
									let content = await zipEntry.async('string');
									filesToDeploy.push({
										file: relativePath,
										data: content,
									});
								}
							}
							fs.unlinkSync(media); 
						} else {
							let content = fs.readFileSync(media, 'utf8');
							filesToDeploy.push({
								file: fileName,
								data: content,
							});
							fs.unlinkSync(media);
						}
					} else if (m.quoted && m.quoted.text) {
						filesToDeploy.push({
							file: 'index.html', 
							data: m.quoted.text,
						});
					} else if (text) {
						const targetFolder = path.resolve(text.trim());
						if (!fs.existsSync(targetFolder)) return m.reply(`❌ Folder *${text}* tidak ditemukan di server!`);

						function getFiles(dir, baseDir = dir) {
							let results = [];
							const list = fs.readdirSync(dir);
							for (let file of list) {
								const filePath = path.join(dir, file);
								const stat = fs.statSync(filePath);
								if (stat && stat.isDirectory()) {
									results = results.concat(getFiles(filePath, baseDir));
								} else {
									if (!filePath.includes('node_modules') && !filePath.includes('.git')) {
										const relativePath = path.relative(baseDir, filePath).replace(/\\/g, '/');
										const data = fs.readFileSync(filePath, 'utf8');
										results.push({ file: relativePath, data: data });
									}
								}
							}
							return results;
						}
						filesToDeploy = getFiles(targetFolder);
					} else {
						return m.reply(`*VERCEL DEPLOYER*\n\nCara penggunaan:\n1. Reply file *.zip* berisi web statis\n2. Reply file *.html*\n3. Reply *Teks kode HTML*\n4. Atau ketik nama folder lokal (Contoh: ${prefix + command} ./public)`);
					}

					if (filesToDeploy.length === 0) {
						m.react('✖️');
						return m.reply('❌ Tidak ada file yang bisa di-deploy.');
					}

					const payload = {
						name: deployName,
						target: 'production',
						files: filesToDeploy,
						projectSettings: {
							framework: null, 
						},
					};

					const res = await axios.post('https://api.vercel.com/v13/deployments', payload, {
						headers: {
							Authorization: `Bearer ${VERCEL_TOKEN}`,
							'Content-Type': 'application/json',
						},
						maxContentLength: Infinity,
						maxBodyLength: Infinity,
					});

					const deployUrl = res.data.url;
					m.react('✔️');

					let replyMsg = `*BERHASIL DEPLOY KE VERCEL!*\n\n`;
					replyMsg += `*Project Name:* ${deployName}\n`;
					replyMsg += `*Total File:* ${filesToDeploy.length} file\n`;
					replyMsg += `*Link Web:* https://${deployUrl}\n\n`;
					replyMsg += `_Tunggu sekitar 10-30 detik sampai Vercel selesai mem-build web kamu._`;

					await xync.sendListMsg(
						m.chat,
						{
							text: replyMsg,
							footer: '© Renn.dev',
							buttons: [
								{
									name: 'cta_url',
									buttonParamsJson: JSON.stringify({
										display_text: 'Buka Website',
										url: `https://${deployUrl}`,
									}),
								},
							],
						},
						{ quoted: m },
					);
				} catch (e) {
					console.error('[VERCEL DEPLOY ERROR]', e.response?.data || e.message);
					m.react('✖️');
					const errMsg = e.response?.data?.error?.message || e.message || 'Error tidak diketahui';
					m.reply(`❌ *Gagal deploy ke Vercel:*\n${errMsg}`);
				}
			}
			break;
			case 'lirik':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Example: ${prefix + command} bulan madu search`);

					try {
						const axios = require('axios');
						const cheerio = require('cheerio');

						const url = `https://www.lyrics.com/lyrics/${encodeURIComponent(text)}`;
						const { data } = await axios.get(url, {
							headers: {
								'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
							},
							timeout: 30000, 
						});

						const $ = cheerio.load(data);
						const results = [];

						$('.sec-lyric.clearfix').each((_, el) => {
							const title = $(el).find('.lyric-meta-title a').text().trim();
							const artist = $(el).find('.lyric-meta-artists a, .lyric-meta-album-artist a').first().text().trim();
							const lyrics = $(el).find('.lyric-body').text().replace(/\s+\n/g, '\n').trim();

							if (title && lyrics) {
								results.push({ title, artist, lyrics });
							}
						});

						if (results.length === 0) {
							return m.reply('Lirik tidak ditemukan cuy! Coba tambahkan nama penyanyinya biar lebih spesifik.');
						}

						let res = results[0];

						let captionMsg = `*${res.title || '-'}*\n`;
						captionMsg += `_Artis:_ ${res.artist || '-'}\n`;
						captionMsg += `_Lirik:_\n${res.lyrics || 'Lirik tidak tersedia'}`;

						await xync.sendMessage(m.chat, { text: captionMsg }, { quoted: m });
						setLimit(m, db);
					} catch (error) {
						console.error('\n[ERROR LIRIK] :', error);
						m.reply(`Gagal mengambil lirik:\n${error.message || 'Server Sedang Sibuk'}`);
					}
				}
				break;
			case 'spk':
				{
					try {
						const { sendCustomStickerPack, downloadMsgSafe, imageToWebp, classifySticker, addMetadata } = await import('./lib/stickerpack.js');
						const crypto = require('crypto');
						
						const packName = 'Made By';
						const authorName = 'Xaync';

						let targetMsg = m.quoted ? m.quoted : m;
						let targetId = targetMsg.id || targetMsg.key?.id;

						let burstMsgs = [];
						let msgs = store?.messages[m.chat]?.array || [];

						if (targetId) {
							let idx = msgs.findIndex(v => v.key.id === targetId);
							let refMsg =
								idx !== -1
									? msgs[idx]
									: m.quoted
										? {
												key: m.quoted.key,
												message: m.quoted.message,
												messageTimestamp: m.messageTimestamp,
											}
										: {
												key: m.key,
												message: m.message,
												messageTimestamp: m.messageTimestamp,
											};

							let refTime = Number(refMsg.messageTimestamp) || Math.floor(Date.now() / 1000);
							let refSender = refMsg.key?.participant || refMsg.key?.remoteJid || m.sender;

							if (idx !== -1) {

								for (let i = Math.max(0, idx - 50); i < Math.min(msgs.length, idx + 50); i++) {
									let cMsg = msgs[i];
									let cSender = cMsg.key?.participant || cMsg.key?.remoteJid;
									let cTime = Number(cMsg.messageTimestamp);
									let isMedia = cMsg.message?.imageMessage || cMsg.message?.stickerMessage || cMsg.message?.viewOnceMessageV2?.message?.imageMessage;

									if (cSender === refSender && isMedia && Math.abs(cTime - refTime) <= 300) {
										burstMsgs.push(cMsg);
									}
								}
							}
						}

						if (burstMsgs.length === 0) {
							let isMedia = targetMsg.message?.imageMessage || targetMsg.message?.stickerMessage || targetMsg.message?.viewOnceMessageV2?.message?.imageMessage || targetMsg.msg?.mimetype;
							if (isMedia || /image|sticker|webp/.test(mime)) {
								burstMsgs.push({
									key: targetMsg.key || m.quoted?.key,
									message: targetMsg.message || m.quoted?.message,
								});
							}
						}

						if (burstMsgs.length === 0) {
							return m.reply('Kirim/reply Foto Example: .spk');
						}

						let uniqueBurstMsgs = [];
						let seenIds = new Set();
						for (let msg of burstMsgs) {
							if (!seenIds.has(msg.key.id)) {
								seenIds.add(msg.key.id);
								uniqueBurstMsgs.push(msg);
							}
						}
						burstMsgs = uniqueBurstMsgs;

						const pack = [];

						for (let msgObj of burstMsgs) {
							let mediaData = await downloadMsgSafe(msgObj);
							if (mediaData && mediaData.buffer) {
								let buffer = mediaData.buffer;

								if (mediaData.type === 'image') {
									buffer = await imageToWebp(buffer);
								}

								if (buffer) {
									buffer = await addMetadata(buffer, packName, authorName);

									const sha256Hex = crypto.createHash('sha256').update(buffer).digest('hex');
									const isLottieMsg = msgObj.message?.stickerMessage?.isLottie || false;

									if (!pack.some(v => v.sha256 === sha256Hex)) {
										const typeObj = classifySticker(buffer, isLottieMsg);
										pack.push({
											sha256: sha256Hex,
											buffer: buffer,
											...typeObj,
										});
									}
								}
							}
						}

						if (pack.length === 0) {
							return m.reply('Gagal memproses media. Pastikan file yang dikirim adalah foto atau stiker yang valid.');
						}

						await sendCustomStickerPack(xync, m, pack, packName, authorName);
					} catch (error) {
						console.error('\n[ERROR SPK] :', error);
						m.reply(`Terjadi kesalahan sistem:\n${error.message}`);
					}
				}
				break;
			case 'fetch':
			case 'get':
				{
					if (!isPremium) return m.reply(global.mess.prem);
					if (!isLimit) return m.reply(global.mess.limit);
					if (!/^https?:\/\//.test(text)) return m.reply('Awali dengan http:// atau https://');
					try {
						const res = await axios.get(isUrl(text) ? isUrl(text)[0] : text);
						if (!/text|json|html|plain/.test(res.headers['content-type'])) {
							await m.reply(text);
						} else m.reply(util.format(res.data));
						setLimit(m, db);
					} catch (e) {
						m.reply(String(e));
					}
				}
				break;
			case 'toaud':
			case 'toaudio':
				{
					if (!/video|audio/.test(mime)) return m.reply(`Kirim/Reply Video/Audio Yang Ingin Dijadikan Audio Dengan Caption ${prefix + command}`);
					let media = await xync.downloadAndSaveMediaMessage(qmsg);
					try {
						let audio = await toAudio(media, 'mp4');
						await m.reply({ audio: { url: audio }, mimetype: 'audio/mpeg' });
						if (fs.existsSync(audio)) fs.unlinkSync(audio);
					} finally {
						if (fs.existsSync(media)) fs.unlinkSync(media);
					}
				}
				break;
			case 'tempmail':
				{
					if (!isLimit) return m.reply(global.mess.limit);

					let action = args[0] ? args[0].toLowerCase() : '';

					if (!action || (action !== 'create' && action !== 'inbox')) {
						let guide = `*Cara Penggunaan TempMail:*\n\n`;
						guide += `1. *Buat Email Baru:*\n${prefix + command} create\n\n`;
						guide += `2. *Cek Inbox:*\n${prefix + command} inbox email_kamu@domain.com`;
						return m.reply(guide);
					}

					m.react('♻️');

					try {
						const axios = require('axios');
						const apiKey = 'jere_ifDNFshZamq_';
						const baseUrl = 'https://api.jerexd.my.id/api/tools/tempmail';

						if (action === 'create') {
							const { data } = await axios.get(`${baseUrl}?apikey=${apiKey}&action=create`);
							if (!data.status) throw new Error('Gagal membuat email dari API.');

							let msg = `*TEMPMAIL - CREATED*\n\n`;
							msg += `*Email:* ${data.email}\n`;
							msg += `*Status:* Aktif\n\n`;
							msg += `_Gunakan email di atas untuk mendaftar atau menerima pesan/OTP._`;

							let btnInteractive = [
								{
									name: 'cta_copy',
									buttonParamsJson: JSON.stringify({
										display_text: 'Copy Email',
										id: 'copy_email',
										copy_code: data.email,
									}),
								},
								{
									name: 'quick_reply',
									buttonParamsJson: JSON.stringify({
										display_text: 'Cek Inbox',
										id: `${prefix + command} inbox ${data.email}`,
									}),
								},
							];

							await xync.sendListMsg(
								m.chat,
								{
									text: msg,
									footer: '© Renn.dev',
									buttons: btnInteractive,
								},
								{ quoted: m },
							);

							m.react('✔️');
							setLimit(m, db);
						} else if (action === 'inbox') {
							const emailAddress = args[1];
							if (!emailAddress) return m.reply(`Masukkan alamat emailnya!\nContoh: ${prefix + command} inbox nama@domain.com`);

							const { data } = await axios.get(`${baseUrl}?apikey=${apiKey}&action=inbox&email=${encodeURIComponent(emailAddress)}`);
							if (!data.status) throw new Error('Gagal mengecek inbox dari API.');

							if (data.total_messages === 0 || data.messages.length === 0) {
								let emptyMsg = `*Belum ada pesan masuk* untuk email:\n_${emailAddress}_`;

								let btnInteractive = [
									{
										name: 'quick_reply',
										buttonParamsJson: JSON.stringify({
											display_text: 'Refresh Inbox',
											id: `${prefix + command} inbox ${emailAddress}`,
										}),
									},
								];

								await xync.sendListMsg(
									m.chat,
									{
										text: emptyMsg,
										footer: '© Renn.dev',
										buttons: btnInteractive,
									},
									{ quoted: m },
								);
								return;
							}

							let msg = `*TEMPMAIL - INBOX*\n*Email:* ${emailAddress}\n\n`;

							data.messages.forEach((mail, i) => {
								let bodyText = mail.text || mail.body || mail.message || 'Tidak ada isi teks';

								let rawContent = JSON.stringify(mail);
								let extractedUrls = rawContent.match(/https?:\/\/[^\s"'<>]+/g) || [];
								let uniqueUrls = [...new Set(extractedUrls)].filter(url => !url.includes('w3.org') && !url.includes('schemas') && !url.endsWith('.png') && !url.endsWith('.jpg'));

								msg += `*Pesan Ke-${i + 1}*\n`;
								msg += `*Dari:* ${mail.sender || mail.from || 'Tidak diketahui'}\n`;
								msg += `*Subjek:* ${mail.subject || 'Tanpa Subjek'}\n`;
								msg += `*Pesan:*\n${bodyText}\n\n`;

								if (uniqueUrls.length > 0) {
									msg += `*Link Terdeteksi:*\n`;
									uniqueUrls.forEach(url => {
										msg += `${url}`;
									});
								}

								msg += `──────────────`;
							});

							m.reply(msg);
							m.react('✔️');
							setLimit(m, db);
						}
					} catch (error) {
						console.error(error);
						m.react('✖️');
						m.reply(`*Gagal!*\nTerjadi Kesalahan: ${error.message}`);
					}
				}
				break;
			case 'genmail':
			case 'buatemail':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					let action = args[0] ? args[0].toLowerCase() : '';

					if (!['create', 'inbox'].includes(action)) {
						return m.reply(`*Cara Penggunaan GenEmail:*\n1. *Buat Email Baru:*\n${prefix + command} create\n2. *Cek Inbox:*\n${prefix + command} inbox email_kamu@domain.com`);
					}

					m.react('♻️');

					try {
						const { TemporaryMail } = await import('./lib/genmail.js');
						const api = new TemporaryMail();

						if (action === 'create') {
							const result = await api.create();
							if (!result.success) throw new Error('Gagal membuat email dari API.');

							let msg = `*GENEMAIL - CREATED*\n*Email:* ${result.email.address}\n*Status:* Aktif\n_Gunakan email di atas untuk mendaftar atau menerima pesan/OTP._`;

							await xync.sendListMsg(
								m.chat,
								{
									text: msg,
									footer: '© Renn.dev',
									buttons: [
										{
											name: 'cta_copy',
											buttonParamsJson: JSON.stringify({
												display_text: 'Copy Email',
												id: 'copy_email',
												copy_code: result.email.address,
											}),
										},
										{
											name: 'quick_reply',
											buttonParamsJson: JSON.stringify({
												display_text: 'Cek Inbox',
												id: `${prefix + command} inbox ${result.email.address}`,
											}),
										},
									],
								},
								{ quoted: m },
							);

							m.react('✔️');
							setLimit(m, db);
						} else if (action === 'inbox') {
							const emailAddress = args[1];
							if (!emailAddress) return m.reply(`Masukkan alamat emailnya!\nContoh: ${prefix + command} inbox nama@domain.com`);

							const result = await api.message({ email: emailAddress });
							if (!result.success) throw new Error('Gagal mengecek inbox dari API.');

							if (result.messages.total === 0 || result.messages.list.length === 0) {
								await xync.sendListMsg(
									m.chat,
									{
										text: `*Belum ada pesan masuk* untuk email:\n_${emailAddress}_`,
										footer: '© Renn.dev',
										buttons: [
											{
												name: 'quick_reply',
												buttonParamsJson: JSON.stringify({
													display_text: 'Refresh Inbox',
													id: `${prefix + command} inbox ${emailAddress}`,
												}),
											},
										],
									},
									{ quoted: m },
								);
								m.react('✔️');
								return;
							}

							let msg = `*GENEMAIL - INBOX*\n*Email:* ${emailAddress}\n\n`;
							result.messages.list.forEach((mail, i) => {
								msg += `*Pesan Ke-${i + 1}*\n*Dari:* ${mail.from || 'Tidak diketahui'}\n*Waktu:* ${mail.time || '-'}\n*Subjek:* ${mail.subject || 'Tanpa Subjek'}\n*Isi Pesan:*\n${mail.detail?.body?.text || 'Tidak ada isi teks'}\n\n`;
							});

							m.reply(msg.trim());
							m.react('✔️');
							setLimit(m, db);
						}
					} catch (error) {
						console.error(error);
						m.react('✖️');
						m.reply(`*Gagal!*\nTerjadi Kesalahan: ${error.message}`);
					}
				}
				break;
			case 'izen':
			case 'bypass':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`*BYPASS IZEN*\n> Masukkan link yang ingin di-bypass\n\`Contoh: ${prefix + command} https://link-target.com\``);
					if (!isUrl(text)) return m.reply('Format salah! Pastikan teks yang kamu masukkan adalah URL yang valid.');

					try {
						const axios = require('axios');
						let bycfPkg = null;

						try {
							bycfPkg = require('bycf');
						} catch (e) {
							return m.reply('Bycf belum diinstal!');
						}

						const bycf = bycfPkg.shannz || bycfPkg.shz || bycfPkg.default || bycfPkg;
						const IZEN = 'https://izen.lol/api/bypass';
						const SITEKEY = '0x4AAAAAADNEi_2N24gpQqY0';

						let captchaToken;
						try {
							captchaToken = await bycf.turnstileMin('https://izen.lol', SITEKEY);
						} catch (e) {
							console.warn('[!] turnstileMin gagal, mencoba turnstileMax...');
							captchaToken = await bycf.turnstileMax('https://izen.lol');
						}

						if (!captchaToken || captchaToken.length < 10) throw new Error('Gagal mendapatkan token Turnstile.');

						const response = await axios.post(
							IZEN,
							{ url: text, captchaToken },
							{
								headers: {
									'Content-Type': 'application/json',
									Referer: 'https://izen.lol/',
									Origin: 'https://izen.lol',
									'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
									Accept: 'application/json',
									'Cache-Control': 'no-cache',
								},
								timeout: 120000,
								validateStatus: () => true,
							},
						);

						if (response.status !== 200 || !response.data) {
							throw new Error(response.data?.message || `HTTP Error ${response.status}`);
						}

						let link = response.data.result;
						let resultMsg = link ? `Result: ${link}` : 'Link tidak ditemukan';

						await m.reply(resultMsg);
						setLimit(m, db);
					} catch (error) {
						console.error(error);
						m.reply(`*Gagal memproses bypass:*\n${error.message}`);
					}
				}
				break;
			case 'tomp3':
				{
					if (!/video|audio/.test(mime)) return m.reply(`Kirim/Reply Video/Audio Yang Ingin Dijadikan Audio Dengan Caption ${prefix + command}`);
					let media = await xync.downloadAndSaveMediaMessage(qmsg);
					try {
						let audio = await toAudio(media, 'mp4');
						await m.reply({
							document: { url: audio },
							mimetype: 'audio/mpeg',
							fileName: `Convert By Reno.mp3`,
						});
						if (fs.existsSync(audio)) fs.unlinkSync(audio);
					} finally {
						if (fs.existsSync(media)) fs.unlinkSync(media);
					}
				}
				break;
			case 'toaudio':
				{
					if (!/video|audio/.test(mime)) return m.reply(`Kirim/Reply Video/Audio Yang Ingin Dijadikan Audio Dengan Caption ${prefix + command}`);
					let media = await xync.downloadAndSaveMediaMessage(qmsg);
					try {
						let audio = await toAudio(media, 'mp4');

						await xync.sendMessage(
							m.chat,
							{
								audio: { url: audio },
								mimetype: 'audio/mpeg',
								ptt: false,
							},
							{ quoted: m },
						);

						if (fs.existsSync(audio)) fs.unlinkSync(audio);
					} finally {
						if (fs.existsSync(media)) fs.unlinkSync(media);
					}
				}
				break;
			case 'tovn':
			case 'toptt':
			case 'tovoice':
				{
					if (!/video|audio/.test(mime)) return m.reply(`Kirim/Reply Video/Audio Yang Ingin Dijadikan Audio Dengan Caption ${prefix + command}`);
					let media = await xync.downloadAndSaveMediaMessage(qmsg);
					try {
						let audioBuffer = await toPTT(media, 'mp4');
						await m.reply({
							audio: audioBuffer,
							mimetype: 'audio/ogg; codecs=opus',
							ptt: true,
						});
					} finally {
						if (fs.existsSync(media)) fs.unlinkSync(media);
					}
				}
				break;
			case 'togif':
				{
					if (!/webp|video/.test(mime)) return m.reply(`Reply Video/Stiker dengan caption *${prefix + command}*`);
					let media = await xync.downloadAndSaveMediaMessage(qmsg);
					let ran = `./database/temp/${getRandom('.mp4')}`;
					exec(`ffmpeg -y -i "${media}" -an -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -pix_fmt yuv420p -c:v libx264 -preset veryfast "${ran}"`, async err => {
						try {
							if (err) return m.reply(global.mess.fail);
							await m.reply({
								video: { url: ran },
								gifPlayback: true,
								caption: global.mess.done,
								gifAttribution: pickRandom(['TENOR', 'GIPHY']),
							});
						} finally {
							if (fs.existsSync(media)) fs.unlinkSync(media);
							if (fs.existsSync(ran)) fs.unlinkSync(ran);
						}
					});
				}
				break;
			case 'toimage':
			case 'toimg':
				{
					if (!/webp|video|image/.test(mime)) return m.reply(`Reply Video/Stiker dengan caption *${prefix + command}*`);
					let media = await xync.downloadAndSaveMediaMessage(qmsg);
					let ran = `./database/temp/${getRandom('.png')}`;
					exec(`ffmpeg -y -i "${media}" -vframes 1 "${ran}"`, async err => {
						try {
							if (err) return m.reply(global.mess.fail);
							await m.reply({ image: { url: ran }, caption: global.mess.done });
						} finally {
							if (fs.existsSync(media)) fs.unlinkSync(media);
							if (fs.existsSync(ran)) fs.unlinkSync(ran);
						}
					});
				}
				break;
			case 'wink':
			case 'enhancevideo':
			case 'hdvideo2':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!/video/.test(mime)) return m.reply(`❌ Kirim atau Reply Video yang mau dijernihkan dengan caption *${prefix + command}* (Durasi jangan terlalu panjang)`);

					await m.reply('Waitt..');

					let media = await xync.downloadAndSaveMediaMessage(qmsg);

					try {
						const fs = require('fs');
						const axios = require('axios');
						const videoBuffer = fs.readFileSync(media);

						const api = {
							xterm: {
								url: 'https://api.termai.cc',
								key: 'Trial-TLjT1uEmVrA8iZ6L',
							},
						};

						const resultData = await new Promise(async (resolve, reject) => {
							try {
								const response = await axios.post(`${api.xterm.url}/api/tools/video-enhancer?key=${api.xterm.key}`, videoBuffer, {
									headers: {
										'Content-Type': 'application/octet-stream',
									},
									responseType: 'stream',
								});

								response.data.on('data', chunk => {
									try {
										const eventString = chunk.toString();
										const eventData = eventString.match(/data: (.+)/);

										if (eventData && eventData[1]) {
											const data = JSON.parse(eventData[1]);
											// Tampilkan progress di console panel Pterodactyl
											console.log('[WINK PROGRESS]:', data);

											if (data.status === 'completed') {
												response.data.destroy();
												resolve(data);
											} else if (data.status === 'failed') {
												response.data.destroy();
												reject(new Error(data.message || 'Proses gagal di server API'));
											}
										}
									} catch (e) {
									}
								});

								response.data.on('error', err => {
									reject(err);
								});
							} catch (error) {
								reject(error);
							}
						});

						let resultUrl = resultData.url || resultData.result?.url || resultData.video_url || resultData.result;

						if (!resultUrl) throw new Error('URL hasil video tidak ditemukan dari API!');
						await xync.sendMessage(
							m.chat,
							{
								video: { url: resultUrl },
								caption: `Done!`,
							},
							{ quoted: m },
						);

						setLimit(m, db); 
					} catch (error) {
						console.error('\n[ERROR WINK] :', error);
						m.reply(`Gagal memproses video:\n${error.message || error}`);
					} finally {
						const fs = require('fs');
						if (media && fs.existsSync(media)) fs.unlinkSync(media);
					}
				}
				break;
			case 'hdvid':
			case 'hdvideo':
			case 'enhancevid':
			case 'hdv':
				{
					if (!isLimit) return m.reply(global.mess.limit);

					let isVideoMessage = /video/.test(mime) || (m.type === 'documentMessage' && m.message?.documentMessage?.mimetype?.startsWith('video'));

					if (isVideoMessage) {
						let media = await xync.downloadAndSaveMediaMessage(qmsg);

						const axios = require('axios');
						const FormData = require('form-data');
						const fs = require('fs');
						const path = require('path');
						const crypto = require('crypto');
						const fsp = fs.promises;
						const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

						await m.reply(`Proses!`);

						let resultUrl = '';

						try {
							const API_URL = 'https://fgsi.dpdns.org/api/tools/enchantVideo';
							const API_KEY = 'fgsiapi-20c1605c-6d';
							const form = new FormData();

							form.append('file', fs.createReadStream(media), path.basename(media));

							const response = await axios.post(API_URL, form, {
								headers: {
									...form.getHeaders(),
									'Content-Type': 'multipart/form-data',
									apikey: API_KEY,
								},
								maxBodyLength: Infinity,
								maxContentLength: Infinity,
								timeout: 120000,
							});

							if (!response.data?.status || !response.data?.data?.pollUrl) {
								throw new Error('FGSI API Gagal');
							}

							const pollUrl = response.data.data.pollUrl;
							const startedAt = Date.now();
							let transientErrors = 0;

							while (Date.now() - startedAt < 10 * 60 * 1000) {
								try {
									const pollRes = await axios.get(pollUrl, {
										headers: { apikey: API_KEY },
										timeout: 30000,
									});
									const status = String(pollRes.data?.data?.status || '')
										.trim()
										.toLowerCase();

									if (status === 'success') {
										resultUrl = pollRes.data?.data?.result?.res_url;
										if (!resultUrl) throw new Error('URL Hasil FGSI kosong');
										break;
									}

									if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
										throw new Error(`FGSI API Error status: ${status}`);
									}
									transientErrors = 0;
								} catch (pollErr) {
									transientErrors += 1;
									if (transientErrors >= 5) throw new Error('FGSI Polling putus');
								}
								await delay(3000);
							}

							if (!resultUrl) throw new Error('Timeout di FGSI API');
						} catch (primaryError) {
							console.log(`[HDVID] Server 1 Gagal (${primaryError.message}), Beralih ke Server 2...`);

							try {
								const API = 'https://api.unwatermark.ai';
								const WEB = 'https://unblurimage.ai';
								const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36';

								const randomProductSerial = () => {
									const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
									let out = '';
									for (let i = 0; i < 6; i++) out += chars[crypto.randomInt(chars.length)];
									return out;
								};

								const baseHeaders = (extra = {}) => ({
									accept: '*/*',
									origin: WEB,
									referer: `${WEB}/`,
									'user-agent': UA,
									'product-code': '067003',
									'product-serial': randomProductSerial(),
									'x-request-id': crypto.randomUUID(),
									'sec-ch-ua-platform': '"Android"',
									'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
									'sec-ch-ua-mobile': '?1',
									...extra,
								});

								const uploadRes = await axios.post(
									`${API}/api/web/common/upload/video`,
									{
										video_file_name: path.basename(media),
									},
									{
										headers: baseHeaders(),
										validateStatus: () => true,
									},
								);

								if (uploadRes.status >= 400 || uploadRes.data?.code !== 100000) {
									throw new Error('Gagal mengambil URL Upload Unwatermark');
								}

								const signedUrl = uploadRes.data.result.url;
								const publicUrl = String(signedUrl || '').split('?')[0];
								const stat = await fsp.stat(media);

								const ext = path.extname(media).toLowerCase();
								let mimeType = 'application/octet-stream';
								if (ext === '.mp4') mimeType = 'video/mp4';
								else if (ext === '.mov') mimeType = 'video/quicktime';
								else if (ext === '.webm') mimeType = 'video/webm';
								else if (ext === '.mkv') mimeType = 'video/x-matroska';

								const putRes = await axios.put(signedUrl, fs.createReadStream(media), {
									headers: {
										'content-type': mimeType,
										'content-length': stat.size,
									},
									maxBodyLength: Infinity,
									maxContentLength: Infinity,
									validateStatus: () => true,
								});

								if (putRes.status >= 400) throw new Error('Gagal upload ke Unwatermark');

								const jobRes = await axios.post(
									`${API}/api/web/unblurimage/v1/video-enhancer/create-job`,
									{
										original_video_url: publicUrl,
										resolution: '2k',
										is_preview: 'false',
									},
									{
										headers: baseHeaders(),
										validateStatus: () => true,
									},
								);

								if (jobRes.status >= 400 || !jobRes.data?.result?.job_id) {
									throw new Error('Gagal create job Unwatermark');
								}

								const jobId = jobRes.data.result.job_id;

								for (let i = 1; i <= 80; i++) {
									const jobPollRes = await axios.get(`${API}/api/web/unblurimage/v1/video-enhancer/get-job/${jobId}`, {
										headers: baseHeaders({
											'content-type': 'application/json; charset=UTF-8',
										}),
										validateStatus: () => true,
									});

									const status = jobPollRes.data?.result?.status;
									const outputUrl = jobPollRes.data?.result?.output_url;

									if (Array.isArray(outputUrl) && outputUrl.length > 0) {
										resultUrl = outputUrl[0];
										break;
									}
									if (status === 1) break;

									await delay(5000);
								}

								if (!resultUrl) throw new Error('Timeout di Unwatermark API');
							} catch (fallbackError) {
								throw new Error(`last error : ${fallbackError.message}`);
							}
						}

						try {
							if (resultUrl) {
								await xync.sendMessage(
									m.chat,
									{
										video: { url: resultUrl },
										caption: `Selesai!`,
									},
									{ quoted: m },
								);

								m.react('️');
								setLimit(m, db);
							} else {
								throw new Error('URL hasil video kosong.');
							}
						} catch (sendError) {
							console.error(sendError);
							m.react('✖️');
							m.reply(`Err: ${sendError.message}`);
						} finally {
							if (media && fs.existsSync(media)) fs.unlinkSync(media);
						}
					} else {
						let txt = `Example: Reply or send vid ${prefix + command}`;
						m.reply(txt);
					}
				}
				break;
			case 'removebg':
			case 'rmbg':
			case 'nobg':
			case 'hapusbg':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (/image/.test(mime)) {
						let media = await xync.downloadAndSaveMediaMessage(qmsg);
						try {
							const fs = require('fs');
							const axios = require('axios');
							const FormData = require('form-data');

							const form = new FormData();

							form.append('image', fs.createReadStream(media));
							form.append('format', 'png');
							form.append('model', 'v1');

							const res = await axios.post('https://api2.pixelcut.app/image/matte/v1', form, {
								headers: {
									...form.getHeaders(),
									'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
									Accept: 'application/json, text/plain, */*',
									'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
									'x-locale': 'en',
									'x-client-version': 'web:pixa.com:4a5b0af2',
									'sec-ch-ua-mobile': '?1',
									'sec-ch-ua-platform': '"Android"',
									origin: 'https://www.pixa.com',
									'sec-fetch-site': 'cross-site',
									'sec-fetch-mode': 'cors',
									'sec-fetch-dest': 'empty',
									referer: 'https://www.pixa.com/',
									'accept-language': 'id-ID,id;q=0.9,en-AU;q=0.8,en;q=0.7,en-US;q=0.6',
								},
								responseType: 'arraybuffer',
								timeout: 20000,
							});

							const resultBuffer = Buffer.from(res.data);

							await xync.sendMessage(
								m.chat,
								{
									image: resultBuffer,
									caption: 'Done',
								},
								{ quoted: m },
							);

							if (media && fs.existsSync(media)) fs.unlinkSync(media);
							setLimit(m, db);
						} catch (e) {
							console.error(e);
							m.reply('✖️ Terjadi kesalahan atau batas waktu (timeout) habis!');
							if (media && fs.existsSync(media)) fs.unlinkSync(media);
						}
					} else {
						m.reply(`Kirim/Reply Gambar dengan caption\nExample: ${prefix + command}`);
					}
				}
				break;
			case 'toptv':
				{
					if (!/video/.test(mime)) return m.reply(`Kirim/Reply Video Yang Ingin Dijadikan PTV Message Dengan Caption ${prefix + command}`);
					if ((m.quoted ? m.quoted.type : m.type) === 'videoMessage') {
						let media = await xync.downloadAndSaveMediaMessage(qmsg);
						try {
							const message = await generateWAMessageContent({ video: { url: media } }, { upload: xync.waUploadToServer });
							await xync.relayMessage(m.chat, { ptvMessage: message.videoMessage }, {});
						} finally {
							if (fs.existsSync(media)) fs.unlinkSync(media);
						}
					} else m.reply('Reply Video Yang Mau Di Ubah Ke PTV Message!');
				}
				break;
			case 'tourl':
				{
					if (/webp|video|sticker|audio|jpg|jpeg|png/.test(mime)) {
						let media = await xync.downloadAndSaveMediaMessage(qmsg);
						try {
							let results = [];

							try {
								let anu = await UguuSe(media);
								results.push(`Url : ${anu.url} (expired 3h)`);
							} catch (e) {
								console.error(e);
								results.push(`Gagal upload ke Uguu: ${e.message}`);
							}

							try {
								const formData = new FormData();
								formData.append('file', fs.createReadStream(media));

								const response = await fetch('https://cdn.zass.in/upload', {
									method: 'POST',
									body: formData,
								});

								const data = await response.json();
								const permanentUrl = data.url || data.link || data.result;

								results.push(`Url : ${permanentUrl} (Permanen)`);
							} catch (e) {
								console.error(e);
								results.push(`Gagal upload ke CDN: ${e.message}`);
							}

							m.reply(results.join('\n\n'));
						} finally {
							if (fs.existsSync(media)) fs.unlinkSync(media);
						}
					} else m.reply(global.mess.media);
				}
				break;
			case 'texttospech':
			case 'tts':
			case 'tospech':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply('Mana text yg mau diubah menjadi audio?');
					let anu;
					try {
						anu = await fetchApi('/tools/tts', { text }, { stream: true });
						m.reply({ audio: { url: anu }, ptt: true, mimetype: 'audio/mpeg' });
						setLimit(m, db);
					} finally {
						if (anu && fs.existsSync(anu)) fs.unlinkSync(anu);
					}
				}
				break;
			case 'translate':
			case 'tr':
				{
					if (text && text == 'list') {
						let list_tr = `▩ 「 *Kode Bahasa* 」\n│• af : Afrikaans\n│• ar : Arab\n│• zh : Chinese\n│• en : English\n│• en-us : English (United States)\n│• fr : French\n│• de : German\n│• hi : Hindi\n│• hu : Hungarian\n│• is : Icelandic\n│• id : Indonesian\n│• it : Italian\n│• ja : Japanese\n│• ko : Korean\n│• la : Latin\n│• no : Norwegian\n│• pt : Portuguese\n│• pt : Portuguese\n│• pt-br : Portuguese (Brazil)\n│• ro : Romanian\n│• ru : Russian\n│• sr : Serbian\n│• es : Spanish\n│• sv : Swedish\n│• ta : Tamil\n│• th : Thai\n│• tr : Turkish\n│• vi : Vietnamese\n╰──────···`;
						m.reply(list_tr);
					} else {
						if (!m.quoted && (!text || !args[1])) return m.reply(`Kirim/reply text dengan caption ${prefix + command}`);
						let lang = args[0] ? args[0] : global.locale;
						let teks = args[1] ? args.slice(1).join(' ') : m.quoted.text;
						try {
							let hasil = await fetchApi('/tools/translate', {
								text: teks,
								lang,
							});
							m.reply(`To : ${lang}\n${hasil.result.translate}`);
						} catch (e) {
							m.reply(`Lang *${lang}* Tidak Di temukan!\nSilahkan lihat list, ${prefix + command} list`);
						}
					}
				}
				break;
			case 'toqr':
			case 'qr':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Ubah Text ke Qr dengan *${prefix + command}* textnya`);
					let anu;
					try {
						anu = await fetchApi('/tools/to-qr', { data: text }, { stream: true });
						await m.reply({ image: { url: anu }, caption: 'Nih Bro' });
						setLimit(m, db);
					} finally {
						if (anu && fs.existsSync(anu)) fs.unlinkSync(anu);
					}
				}
				break;
			case 'tohd':
			case 'hd':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (/image/.test(mime)) {
						let media = await xync.downloadAndSaveMediaMessage(qmsg);
						try {
							const axios = require('axios');
							const fs = require('fs');

							let upload = await UguuSe(media);
							let apiUrl = `https://gateway.gencipta.com//api/v2/tools/upscale?url=${encodeURIComponent(upload.url)}`;

							let res = await axios.get(apiUrl, {
								headers: {
									Accept: 'application/json, image/*, audio/*, video/*',
									Authorization: 'Bearer gencipta_live_WU9qq0ir3rcR4E09eZwj9V2X0mwn2Uh8',
								},
								responseType: 'arraybuffer',
							});

							let hdBuffer = Buffer.from(res.data);

							await xync.sendMessage(m.chat, { image: hdBuffer, caption: global.mess.done }, { quoted: m });

							if (media && fs.existsSync(media)) fs.unlinkSync(media);
							setLimit(m, db);
						} catch (e) {
							console.log(e);
							m.react('✖️');
							m.reply(global.mess.fail);
							if (media && fs.existsSync(media)) fs.unlinkSync(media);
						}
					} else {
						m.reply(`Kirim/Reply Gambar dengan format\nExample: ${prefix + command}`);
					}
				}
				break;
			case 'remini':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (/image/.test(mime)) {
						let hasil;
						let media = await xync.downloadAndSaveMediaMessage(qmsg);
						try {
							const form = new FormData();
							form.append('buffer', fs.createReadStream(media), {
								filename: 'image.jpg',
								contentType: 'image/jpeg',
							});
							hasil = await fetchApi('/tools/remini', form, { stream: true });
							await m.reply({
								image: { url: hasil },
								caption: global.mess.done,
							});
							setLimit(m, db);
							if (media && fs.existsSync(media)) fs.unlinkSync(media);
							if (hasil && fs.existsSync(hasil)) fs.unlinkSync(hasil);
						} catch (e) {
							if (hasil && fs.existsSync(hasil)) fs.unlinkSync(hasil);
							let ran = `./database/temp/${getRandom('.jpg')}`;
							const scaleFactor = isNaN(parseInt(text)) ? 4 : parseInt(text) < 10 ? parseInt(text) : 4;
							exec(`ffmpeg -i "${media}" -vf "scale=iw*${scaleFactor}:ih*${scaleFactor}:flags=lanczos" -q:v 1 "${ran}"`, async (err, stderr, stdout) => {
								try {
									if (err) return m.reply(global.mess.fail);
									await xync.sendMessage(m.chat, { image: { url: ran }, caption: global.mess.done }, { quoted: m });
									setLimit(m, db);
								} catch (e) {
									console.log(e);
								} finally {
									if (ran && fs.existsSync(ran)) fs.unlinkSync(ran);
									if (media && fs.existsSync(media)) fs.unlinkSync(media);
								}
							});
						}
					} else m.reply(`Kirim/Reply Gambar dengan format\nExample: ${prefix + command}`);
				}
				break;
			case 'hdr':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (/image/.test(mime)) {
						let media = await xync.downloadAndSaveMediaMessage(qmsg);
						try {
							const axios = require('axios');
							const FormData = require('form-data');
							const ILOVEIMG_PUBLIC_KEY = 'project_public_00e12bc2fb8ef568a478c5bd286812ef_6jtUQc8a1c850e23c135da367f36192093097';
							let buffer = fs.readFileSync(media);

							const authRes = await axios.post('https://api.iloveimg.com/v1/auth', {
								public_key: ILOVEIMG_PUBLIC_KEY,
							});
							const token = authRes.data.token;
							const headers = { Authorization: `Bearer ${token}` };

							const startRes = await axios.get('https://api.iloveimg.com/v1/start/upscaleimage', { headers });
							const { server, task } = startRes.data;

							const form = new FormData();
							form.append('task', task);
							form.append('file', buffer, 'image.jpg');

							const uploadRes = await axios.post(`https://${server}/v1/upload`, form, {
								headers: { ...headers, ...form.getHeaders() },
							});
							const serverFilename = uploadRes.data.server_filename;

							await axios.post(
								`https://${server}/v1/process`,
								{
									task: task,
									tool: 'upscaleimage',
									files: [{ server_filename: serverFilename, filename: 'image.jpg' }],
									multiplier: 2,
								},
								{ headers },
							);

							const downloadRes = await axios.get(`https://${server}/v1/download/${task}`, {
								headers,
								responseType: 'arraybuffer',
							});

							let hdBuffer = Buffer.from(downloadRes.data);

							await xync.sendMessage(m.chat, { image: hdBuffer, caption: global.mess.done }, { quoted: m });

							if (media && fs.existsSync(media)) fs.unlinkSync(media);
							setLimit(m, db);
						} catch (e) {
							console.log('API iLoveIMG Error:', e.response?.data?.message || e.message);
							let ran = `./database/temp/${getRandom('.jpg')}`;
							const scaleFactor = isNaN(parseInt(text)) ? 4 : parseInt(text) < 10 ? parseInt(text) : 4;

							exec(`ffmpeg -i "${media}" -vf "scale=iw*${scaleFactor}:ih*${scaleFactor}:flags=lanczos" -q:v 1 "${ran}"`, async (err, stderr, stdout) => {
								try {
									if (err) return m.reply(global.mess.fail);
									await xync.sendMessage(m.chat, { image: { url: ran }, caption: global.mess.done }, { quoted: m });
									setLimit(m, db);
								} catch (e) {
									console.log(e);
								} finally {
									if (ran && fs.existsSync(ran)) fs.unlinkSync(ran);
									if (media && fs.existsSync(media)) fs.unlinkSync(media);
								}
							});
						}
					} else {
						m.reply(`Example: ${prefix + command}`);
					}
				}
				break;
			case 'ihancer':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (/image/.test(mime)) {
						m.react('♻️');
						let media = await xync.downloadAndSaveMediaMessage(qmsg);
						try {
							const axios = require('axios');
							const FormData = require('form-data');
							const form = new FormData();
							form.append('method', '1');
							form.append('is_pro_version', 'true');
							form.append('is_enhancing_more', 'false');
							form.append('max_image_size', 'high');
							form.append('file', fs.readFileSync(media), 'file.jpg');

							let res = await axios.post('https://ihancer.com/api/enhance', form, {
								headers: {
									...form.getHeaders(),
									'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
									Referer: 'https://ihancer.com/app/',
								},
								responseType: 'arraybuffer',
							});

							let hdBuffer = Buffer.from(res.data);
							await xync.sendMessage(m.chat, { image: hdBuffer, caption: global.mess.done }, { quoted: m });
							m.react('');
							setLimit(m, db);
						} catch (e) {
							console.log(e);
							m.react('✖️');
							m.reply(global.mess.fail);
						} finally {
							if (media && fs.existsSync(media)) fs.unlinkSync(media);
						}
					} else m.reply(`Kirim/Reply Gambar dengan format\nExample: ${prefix + command}`);
				}
				break;
			case 'hd2':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (/image/.test(mime)) {
						let media = await xync.downloadAndSaveMediaMessage(qmsg);
						try {
							const axios = require('axios');
							const FormData = require('form-data');
							const form = new FormData();
							form.append('image', fs.readFileSync(media), {
								filename: 'image.jpg',
								contentType: 'image/jpeg',
							});
							form.append('type', 'upscale');
							form.append('scale', '4');

							let res = await axios.post('https://my.izuka-api.xyz/api/tools/imglarger', form, {
								headers: form.getHeaders(),
								timeout: 60000,
							});
							if (!res.data?.status || !res.data?.result) throw new Error('Gagal upscale gambar');

							let hdBuffer = (
								await axios.get(res.data.result, {
									responseType: 'arraybuffer',
								})
							).data;
							await xync.sendMessage(m.chat, { image: Buffer.from(hdBuffer), caption: global.mess.done }, { quoted: m });

							setLimit(m, db);
						} catch (e) {
							console.log(e);
							m.react('✖️');
							m.reply(global.mess.fail);
						} finally {
							if (media && fs.existsSync(media)) fs.unlinkSync(media);
						}
					} else m.reply(`Kirim/Reply Gambar dengan format\nExample: ${prefix + command}`);
				}
				break;
			case 'hd3':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!/image/.test(mime)) return m.reply(`Kirim atau reply gambar dengan caption *${prefix + command}*`);
					let media = await xync.downloadAndSaveMediaMessage(qmsg);

					try {
						const axios = require('axios');
						const FormData = require('form-data');
						const fs = require('fs');

						const ImgUpscaler = {
							config: {
								uploadUrl: 'https://get1.imglarger.com/api/UpscalerNew/UploadNew',
								statusUrl: 'https://get1.imglarger.com/api/UpscalerNew/CheckStatusNew',
								agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
							},

							async process(buffer, scale = 4) {
								try {
									if (!buffer) throw new Error('Image buffer diperlukan');

									const form = new FormData();
									form.append('myfile', buffer, {
										filename: 'upload.png',
										contentType: 'image/png',
									});
									form.append('scaleRadio', scale.toString());

									const { data: uploadRes } = await axios.post(this.config.uploadUrl, form, {
										headers: {
											...form.getHeaders(),
											Origin: 'https://imgupscaler.com',
											Referer: 'https://imgupscaler.com/',
											'User-Agent': this.config.agent,
										},
									});

									if (uploadRes.code !== 200 || !uploadRes.data?.code) {
										throw new Error('Gagal mengupload gambar ke server.');
									}

									const jobCode = uploadRes.data.code;

									for (let i = 0; i < 30; i++) {
										const { data: statusRes } = await axios.post(
											this.config.statusUrl,
											{ code: jobCode, scaleRadio: scale },
											{
												headers: {
													'Content-Type': 'application/json',
													Origin: 'https://imgupscaler.com',
													Referer: 'https://imgupscaler.com/',
													'User-Agent': this.config.agent,
												},
											},
										);

										if (statusRes.code === 200 && statusRes.data?.status === 'success') {
											return statusRes.data.downloadUrls[0];
										}

										await new Promise(res => setTimeout(res, 5000));
									}

									throw new Error('Timeout: Proses upscale terlalu lama.');
								} catch (e) {
									throw new Error(e.message || e.toString());
								}
							},
						};

						let buffer = fs.readFileSync(media);

						let scale = args[0] && !isNaN(args[0]) ? parseInt(args[0]) : 2;
						if (scale > 4) scale = 4;

						let resultUrl = await ImgUpscaler.process(buffer, scale);

						await xync.sendMessage(
							m.chat,
							{
								image: { url: resultUrl },
								caption: global.mess.done,
							},
							{ quoted: m },
						);

						m.react('');
						setLimit(m, db);
					} catch (error) {
						m.reply(`Gagal memperjelas gambar:\n${error.message || error}`);
					} finally {
						const fs = require('fs');
						if (media && fs.existsSync(media)) fs.unlinkSync(media);
					}
				}
				break;
			case 'hd4':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!/image/.test(mime)) return m.reply(`Kirim atau reply gambar dengan caption ${prefix + command}`);

					let media = await xync.downloadAndSaveMediaMessage(qmsg);

					try {
						const axios = require('axios');
						const cheerio = require('cheerio');
						const FormData = require('form-data');
						const crypto = require('crypto');
						const fs = require('fs');

						let sharpMod;
						try {
							sharpMod = require('sharp');
						} catch (e) {}

						async function getToken() {
							const html = await axios.get('https://www.iloveimg.com/upscale-image');
							const $ = cheerio.load(html.data);
							const script = $('script')
								.filter((i, el) => $(el).html().includes('ilovepdfConfig ='))
								.html();
							const jsonS = script.split('ilovepdfConfig = ')[1].split(';')[0];
							const json = JSON.parse(jsonS);
							const csrf = $('meta[name="csrf-token"]').attr('content');
							return { token: json.token, csrf };
						}

						async function uploadImage(server, headers, buffer, task) {
							const form = new FormData();
							form.append('name', 'image.jpg');
							form.append('chunk', '0');
							form.append('chunks', '1');
							form.append('task', task);
							form.append('preview', '1');
							form.append('file', buffer, {
								filename: 'image.jpg',
								contentType: 'image/jpeg',
							});

							const res = await axios.post(`https://${server}.iloveimg.com/v1/upload`, form, {
								headers: { ...headers, ...form.getHeaders() },
							});
							return res.data;
						}

						async function hdr(buffer, scale = 4) {
							const { token, csrf } = await getToken();
							const servers = ['api1g', 'api2g', 'api3g', 'api8g', 'api9g', 'api10g', 'api11g', 'api12g', 'api13g', 'api14g', 'api15g', 'api16g', 'api17g', 'api18g', 'api19g', 'api20g', 'api21g', 'api22g', 'api24g', 'api25g'];
							const server = servers[Math.floor(Math.random() * servers.length)];

							const task = 'r68zl88mq72xq94j2d5p66bn2z9lrbx20njsbw2qsAvgmzr11lvfhAx9kl87pp6yqgx7c8vg7sfbqnrr42qb16v0gj8jl5s0kq1kgp26mdyjjspd8c5A2wk8b4Adbm6vf5tpwbqlqdr8A9tfn7vbqvy28ylphlxdl379psxpd8r70nzs3sk1';
							const headers = {
								Authorization: 'Bearer ' + token,
								Origin: 'https://www.iloveimg.com/',
								Cookie: '_csrf=' + csrf,
								'User-Agent': 'Mozilla/5.0',
							};

							const upload = await uploadImage(server, headers, buffer, task);

							const form = new FormData();
							form.append('task', task);
							form.append('server_filename', upload.server_filename);
							form.append('scale', scale.toString());

							const res = await axios.post(`https://${server}.iloveimg.com/v1/upscale`, form, {
								headers: { ...headers, ...form.getHeaders() },
								responseType: 'arraybuffer',
							});
							return res.data;
						}

						const API = 'https://a.android.api.remini.ai/v1/mobile';
						const ORACLE = 'https://api.remini.ai/v1/mobile/oracle';

						function genId() {
							const a = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
							return {
								android_id: a,
								aaid: crypto.randomUUID(),
								backup_persistent_id: a + '_com.bigwinepot.nwdn.international',
								non_backup_persistent_id: crypto.randomUUID(),
							};
						}

						let dev = genId();
						let rToken = null;

						function bh(extra) {
							return {
								'bsp-id': 'com.bigwinepot.nwdn.international.android',
								'build-number': '202514479',
								'build-version': '3.7.1020',
								country: 'US',
								'device-manufacturer': 'Samsung',
								'device-model': 'SM-G998B',
								'device-type': '6.8',
								language: 'en',
								locale: 'en_US',
								'os-version': '33',
								platform: 'Android',
								timezone: 'America/New_York',
								'android-id': dev.android_id,
								aaid: dev.aaid,
								'accept-encoding': 'gzip',
								'user-agent': 'okhttp/4.12.0',
								...(extra || {}),
							};
						}

						function ah(extra) {
							const h = bh(extra);
							if (rToken) h['identity-token'] = rToken;
							return h;
						}

						async function auth() {
							dev = genId();
							const r = await fetch(ORACLE + '/setup', {
								headers: bh({
									'first-install-timestamp': Math.floor(Date.now() / 1000) + 'E9',
									'backup-persistent-id': dev.backup_persistent_id,
									'non-backup-persistent-id': dev.non_backup_persistent_id,
									environment: 'Production',
									'settings-response-version': 'v2',
									'is-app-running-in-background': 'false',
									'is-old-user': 'true',
									'app-set-id': 'd44bd45a-a45d-4470-9674-7348a8e3fb71',
								}),
							});
							const d = await r.json();
							rToken = d.settings.__identity__.token;
							if (!rToken) throw new Error('No token from Remini');
							await fetch(API + '/users/@me', { headers: ah() });
						}

						async function reminiHDFallback(buffer) {
							await auth();
							const mimeType = 'image/jpeg';
							const md5 = crypto.createHash('md5').update(buffer).digest('base64');

							let meta = { size: buffer.length };
							try {
								if (sharpMod) {
									const m = await sharpMod(buffer).metadata();
									meta.width = m.width;
									meta.height = m.height;
								}
							} catch (err) {}

							const taskR = await fetch(API + '/tasks', {
								method: 'POST',
								headers: ah({
									'content-type': 'application/json; charset=UTF-8',
								}),
								body: JSON.stringify({
									image_content_type: mimeType,
									image_md5: md5,
									feature: { type: 'enhance', models: [] },
									metadata: meta,
									options: { high_quality_output: false, save_input: true },
								}),
							});

							const taskD = await taskR.json();
							if (!taskD.task_id || !taskD.upload_url || !taskD.upload_headers) throw new Error('Missing fields in Remini Task');

							await fetch(taskD.upload_url, {
								method: 'PUT',
								headers: {
									...taskD.upload_headers,
									'Content-Length': buffer.length.toString(),
									'User-Agent': 'okhttp/4.12.0',
								},
								body: buffer,
							});

							await fetch(API + '/tasks/' + taskD.task_id + '/process', {
								method: 'POST',
								headers: ah({ 'content-length': '0' }),
							});

							let cdnUrl = null;
							for (let i = 0; i < 40; i++) {
								await new Promise(r => setTimeout(r, 5000));
								const pr = await fetch(API + '/tasks/' + taskD.task_id, {
									headers: ah(),
								});
								const pd = await pr.json();
								if (pd.status === 'completed') {
									const outs = pd.result && pd.result.outputs;
									if (outs && Array.isArray(outs) && outs[0] && outs[0].url) cdnUrl = outs[0].url;
									break;
								}
								if (pd.status === 'failed' || pd.status === 'error') throw new Error('Remini Task failed');
							}

							if (!cdnUrl) throw new Error('No output URL from Remini');

							const finalImage = await axios.get(cdnUrl, {
								responseType: 'arraybuffer',
							});
							return Buffer.from(finalImage.data);
						}

						let bufferInput = fs.readFileSync(media);
						let scale = args[0] && !isNaN(args[0]) ? parseInt(args[0]) : 4;
						let resBuffer;

						try {
							resBuffer = await hdr(bufferInput, scale);
						} catch (e) {
							console.log(e.message);
							try {
								resBuffer = await reminiHDFallback(bufferInput);
							} catch (err) {
								throw new Error(`Gagal memproses gambar. Error: ${err.message}`);
							}
						}

						await xync.sendMessage(
							m.chat,
							{
								image: resBuffer,
								caption: global.mess.done || 'Berhasil memperjelas gambar!',
							},
							{ quoted: m },
						);

						setLimit(m, db);
					} catch (error) {
						m.reply(`Gagal memperjelas gambar:\n${error.message || error}`);
					} finally {
						const fs = require('fs');
						if (media && fs.existsSync(media)) fs.unlinkSync(media);
					}
				}
				break;
			case 'unblur':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (/image/.test(mime)) {
						m.react('♻️️');
						let media = await xync.downloadAndSaveMediaMessage(qmsg);
						try {
							const axios = require('axios');
							const FormData = require('form-data');
							const form = new FormData();
							form.append('image', fs.readFileSync(media), {
								filename: 'image.jpg',
								contentType: 'image/jpeg',
							});

							let res = await axios.post('https://my.izuka-api.xyz/api/tools/unblur', form, {
								headers: form.getHeaders(),
								timeout: 60000,
							});
							let url = res.data?.result?.output_url?.[0];
							if (!res.data?.status || !url) throw new Error('Gagal unblur gambar');

							let hdBuffer = (await axios.get(url, { responseType: 'arraybuffer' })).data;
							await xync.sendMessage(m.chat, { image: Buffer.from(hdBuffer), caption: global.mess.done }, { quoted: m });
							m.react('');
							setLimit(m, db);
						} catch (e) {
							console.log(e);
							m.react('✖️');
							m.reply(global.mess.fail);
						} finally {
							if (media && fs.existsSync(media)) fs.unlinkSync(media);
						}
					} else m.reply(`Kirim/Reply Gambar dengan format\nExample: ${prefix + command}`);
				}
				break;
			case 'dehaze':
			case 'colorize':
			case 'colorfull':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (/image/.test(mime)) {
						let hasil;
						let media = await xync.downloadAndSaveMediaMessage(qmsg);
						try {
							const form = new FormData();
							form.append('buffer', fs.createReadStream(media), {
								filename: 'image.jpg',
								contentType: 'image/jpeg',
							});
							hasil = await fetchApi('/tools/recolor', form, { stream: true });
							await m.reply({
								image: { url: hasil },
								caption: global.mess.done,
							});
							setLimit(m, db);
						} finally {
							if (hasil && fs.existsSync(hasil)) fs.unlinkSync(hasil);
							if (media && fs.existsSync(media)) fs.unlinkSync(media);
						}
					} else m.reply(`Kirim/Reply Gambar dengan format\nExample: ${prefix + command}`);
				}
				break;
			case 'hitamkan':
			case 'toblack':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (/image/.test(mime)) {
						let hasil;
						let media = await xync.downloadAndSaveMediaMessage(qmsg);
						try {
							const form = new FormData();
							form.append('style', 'superblack');
							form.append('buffer', fs.createReadStream(media), {
								filename: 'image.jpg',
								contentType: 'image/jpeg',
							});
							hasil = await fetchApi('/create/skin-tone', form, {
								stream: true,
							});
							await m.reply({
								image: { url: hasil },
								caption: global.mess.done,
							});
							setLimit(m, db);
						} finally {
							if (hasil && fs.existsSync(hasil)) fs.unlinkSync(hasil);
							if (media && fs.existsSync(media)) fs.unlinkSync(media);
						}
					} else m.reply(`Kirim/Reply Gambar dengan format\nExample: ${prefix + command}`);
				}
				break;
			case 'ssweb':
				{
					if (!isPremium) return m.reply(global.mess.prem);
					if (!text) return m.reply(`Example: ${prefix + command} https://github.com/nazedev/xync-md`);
					let anu = 'https://' + text.replace(/^https?:\/\//, '');
					let hasil;
					try {
						hasil = await fetchApi('/tools/ss', { url: anu }, { stream: true });
						await m.reply({ image: { url: hasil }, caption: global.mess.done });
						setLimit(m, db);
					} finally {
						if (hasil && fs.existsSync(hasil)) fs.unlinkSync(hasil);
					}
				}
				break;
			case 'readmore':
				{
					let teks1 = text.split`|`[0] ? text.split`|`[0] : '';
					let teks2 = text.split`|`[1] ? text.split`|`[1] : '';
					m.reply(teks1 + readmore + teks2);
				}
				break;
			case 'getexif':
				{
					if (!m.quoted) return m.reply(`Reply sticker\nDengan caption ${prefix + command}`);
					if (!/sticker|webp/.test(quoted.type)) return m.reply(`Reply sticker\nDengan caption ${prefix + command}`);
					const img = new webp.Image();
					await img.load(await m.quoted.download());
					if (!img.exif) return m.reply('Stiker ini tidak memiliki metadata/EXIF sama sekali.');
					try {
						const exifData = JSON.parse(img.exif.slice(22).toString());
						m.reply(util.format(exifData));
					} catch (e) {
						m.reply(`Stiker memiliki EXIF, tapi formatnya bukan JSON yang valid:\n\n${img.exif.toString()}`);
					}
				}
				break;
			case 'cuaca':
			case 'weather':
				{
					if (!text) return m.reply(`Example: ${prefix + command} jakarta`);
					try {
						let { result: data } = await fetchApi('/tools/cuaca', {
							city: text,
						});
						m.reply(`*🏙 Cuaca Kota ${data.name}*\n\n*🌤️ Cuaca :* ${data.weather[0].main}\n*📝 Deskripsi :* ${data.weather[0].description}\n*🌡️ Suhu Rata-rata :* ${data.main.temp} °C\n*🤔 Terasa Seperti :* ${data.main.feels_like} °C\n*🌬️ Tekanan :* ${data.main.pressure} hPa\n*💧 Kelembapan :* ${data.main.humidity}%\n*🌪️ Kecepatan Angin :* ${data.wind.speed} Km/h\n*📍Lokasi :*\n- *Bujur :* ${data.coord.lat}\n- *Lintang :* ${data.coord.lon}\n*🌏 Negara :* ${data.sys.country}`);
					} catch (e) {
						m.reply('Kota Tidak Di Temukan!');
					}
				}
				break;
			case 'sticker':
			case 'stiker':
			case 's':
			case 'stickergif':
			case 'stikergif':
			case 'sgif':
				{
					if (!/image|video|sticker/.test(quoted.type)) return m.reply(`Kirim/reply gambar/video/gif dengan caption ${prefix + command}\nDurasi Image/Video/Gif 1-9 Detik`);

					let media = await xync.downloadAndSaveMediaMessage(qmsg);
					let teks1 = packname;
					let teks2 = author;

					if (/image|webp/.test(mime)) {
						await xync.sendAsSticker(m.chat, media, m, {
							packname: teks1,
							author: teks2,
							keepScale: true,
						});
					} else if (/video/.test(mime)) {
						if (qmsg.seconds > 11) return m.reply('Maksimal 10 detik!');
						await xync.sendAsSticker(m.chat, media, m, {
							packname: teks1,
							author: teks2,
							keepScale: true,
						});
					} else m.reply(`Kirim/reply gambar/video/gif dengan caption ${prefix + command}\nDurasi Video/Gif 1-9 Detik`);
				}
				break;
			case 'stickerwm':
			case 'swm':
			case 'wm':
				{
					if (!/image|video|sticker/.test(quoted.type)) return m.reply(`Kirim/reply stiker/gambar/video dengan caption ${prefix + command} packname|author atau ${prefix + command} author`);

					let media = await xync.downloadAndSaveMediaMessage(qmsg);
					let teks1 = packname;
					let teks2 = author;

					if (text) {
						if (text.includes('|')) {
							teks1 = text.split('|')[0].trim();
							teks2 = text.split('|')[1].trim();
						} else {
							teks1 = '';
							teks2 = text.trim();
						}
					}

					if (/image|webp/.test(mime)) {
						await xync.sendAsSticker(m.chat, media, m, {
							packname: teks1,
							author: teks2,
							keepScale: true,
						});
					} else if (/video/.test(mime)) {
						if (qmsg.seconds > 11) return m.reply('Maksimal 10 detik!');
						await xync.sendAsSticker(m.chat, media, m, {
							packname: teks1,
							author: teks2,
							keepScale: true,
						});
					} else m.reply(`Kirim/reply stiker/gambar/video dengan caption ${prefix + command}`);
				}
				break;
			case 'smeme':
			case 'stickmeme':
			case 'stikmeme':
			case 'stickermeme':
			case 'stikermeme':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!/image|webp/.test(mime)) return m.reply(`Kirim/reply image/sticker\nDengan caption ${prefix + command} atas|bawah`);
					if (!text) return m.reply(`Kirim/reply image/sticker dengan caption ${prefix + command} atas|bawah`);
					let atas = text.split`|`[0] ? text.split`|`[0] : '-';
					let bawah = text.split`|`[1] ? text.split`|`[1] : '-';
					let media = await xync.downloadAndSaveMediaMessage(qmsg);
					try {
						let mem = await UguuSe(media);
						let smeme = await fetchApi('/create/meme2', { url: mem.url, text: atas, text2: bawah }, { stream: true });
						await xync.sendAsSticker(m.chat, smeme, m, { packname, author });
						setLimit(m, db);
					} catch (e) {
						console.log(e);
						m.reply(global.mess.fail);
					} finally {
						if (media && fs.existsSync(media)) fs.unlinkSync(media);
					}
				}
				break;
			case 'emojimix':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Example: ${prefix + command} ??+🤔`);
					let [emoji1, emoji2] = text.split`+`;
					if (!emoji1 && !emoji2) return m.reply(`Example: ${prefix + command} 😅+🤔`);
					let { result } = await fetchApi('/tools/emojimix', {
						emoji1,
						emoji2,
					});
					if (result.length < 1) return m.reply(`Mix Emoji ${text} Tidak Ditemukan!`);
					for (let res of result) {
						await xync.sendAsSticker(m.chat, res.url, m, { packname, author });
					}
					setLimit(m, db);
				}
				break;
			case 'iqcdark':
			case 'iqc2':
				{
					if (!isLimit) return m.reply(global.mess.limit);

					let queryText = text || (m.quoted && m.quoted.text) ? text || m.quoted.text : '';
					let mediaBuffer = null;
					let isImage = /image/.test(mime);

					if (isImage) {
						const fs = require('fs');
						let mediaPath = await xync.downloadAndSaveMediaMessage(qmsg);
						mediaBuffer = fs.readFileSync(mediaPath);
						fs.unlinkSync(mediaPath); 
					} else if (!queryText) {
						return m.reply(`Kirim pesan teks, atau reply pesan/gambar *${prefix + command}*`);
					}

					try {
						const { makeRinChat } = await import('./lib/iqcdark.js');
						const moment = require('moment-timezone');
						const timeStr = moment().tz(global.timezone).format('HH.mm');

						const resultBuffer = await makeRinChat({
							text: queryText,
							timeStr: timeStr,
							imgBuffer: mediaBuffer,
							emojis: ['👍', '❤️', '😂', '😮', '😢', '🙏'],
						});

						await xync.sendMessage(
							m.chat,
							{
								image: resultBuffer,
								caption: global.mess.done,
							},
							{ quoted: m },
						);

						setLimit(m, db);
					} catch (e) {
						console.error(e);
						m.reply(`Gagal memproses Fake Chat: ${e.message}`);
					}
				}
				break;
			case 'iqc':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text && (!m.quoted || !m.quoted.text)) return m.reply(`Kirim/reply pesan *${prefix + command}* Teksnya`);
					let queryText = text ? text : m.quoted.text;
					if (queryText.length >= 200) return m.reply('Max 200 Length!');
					let res;
					try {
						res = await fetchApi('/create/iqc', { text: queryText }, { stream: true });
						await m.reply({ image: { url: res }, caption: global.mess.done });
						setLimit(m, db);
					} finally {
						if (res && fs.existsSync(res)) fs.unlinkSync(res);
					}
				}
				break;
			case 'qc':
			case 'quote':
			case 'fakechat':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text && !m.quoted) return m.reply(`Kirim / reply pesan untuk *${prefix + command}*`);
					try {
						let medianya;
						let quotedMedianya;
						let mediaPath;
						let quotedMediaPath;
						let ppUrl = await xync.profilePictureUrl(m.sender, 'image').catch(() => 'https://i.pinimg.com/564x/8a/e9/e9/8ae9e92fa4e69967aa61bf2bda967b7b.jpg');
						const senderName = m.pushName || store.contacts?.[m.sender]?.name || '+' + m.sender.split('@')[0];
						const quotedName = store.contacts?.[m.quoted?.sender]?.name || '+' + (m.quoted?.sender || '').split('@')[0];
						try {
							if (m.isMedia) {
								mediaPath = await xync.downloadAndSaveMediaMessage(m);
								medianya = await UguuSe(mediaPath);
							}
							if (m.quoted?.isMedia) {
								quotedMediaPath = await xync.downloadAndSaveMediaMessage(m.quoted);
								quotedMedianya = await UguuSe(quotedMediaPath);
							}
							const payload = {
								type: 'quote',
								format: 'png',
								backgroundColor: '#FFFFFF',
								width: 512,
								height: 768,
								scale: 2,
								messages: [
									{
										entities: [],
										...(medianya?.url ? { media: { url: medianya.url } } : {}),
										avatar: true,
										from: {
											id: 1,
											name: senderName,
											photo: {
												url: ppUrl,
											},
										},
										text,
										replyMessage: m.quoted
											? {
													name: quotedName || '',
													text: m.quoted.text || '',
													...(quotedMedianya?.url ? { media: { url: quotedMedianya.url } } : {}),
													chatId: Math.floor(Math.random() * 9999999),
												}
											: {},
									},
								],
							};
							let res = await fetchApi('/create/qc', payload, {
								method: 'POST',
								buffer: true,
							});
							await xync.sendAsSticker(m.chat, Buffer.from(res, 'base64'), m, {
								packname,
								author,
							});
							setLimit(m, db);
						} finally {
							if (mediaPath && fs.existsSync(mediaPath)) fs.unlinkSync(mediaPath);
							if (quotedMediaPath && fs.existsSync(quotedMediaPath)) fs.unlinkSync(quotedMediaPath);
						}
					} catch (e) {
						console.log(e);
						m.reply(global.mess.fail);
					}
				}
				break;
			case 'brat':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text && (!m.quoted || !m.quoted.text)) return m.reply(`Kirim/reply pesan *${prefix + command}* Teksnya`);
					let queryText = text ? text : m.quoted.text;
					if (queryText.length >= 200) return m.reply('Max 200 Length!');
					try {
						let res = await fetchApi('/create/brat', { text: queryText }, { stream: true });
						await xync.sendAsSticker(m.chat, res, m);
						setLimit(m, db);
					} catch (e) {
						try {
							let res = await fetchApi('/create/brat3', { text: queryText }, { stream: true });
							await xync.sendAsSticker(m.chat, res, m);
							setLimit(m, db);
						} catch (e) {
							console.log(e);
							m.reply(global.mess.fail);
						}
					}
				}
				break;
			case 'bratvid':
			case 'bratvideo':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text && (!m.quoted || !m.quoted.text)) return m.reply(`Kirim/reply pesan *${prefix + command}* Teksnya`);
					const teks = (m.quoted ? m.quoted.text : text).split(' ');
					if (teks.length >= 200) return m.reply('Max 200 Length!');
					const tempDir = path.join(process.cwd(), 'database/temp');
					const framePaths = [];
					const fileListPath = path.join(tempDir, `${time + '-' + m.sender}.txt`);
					const outputVideoPath = path.join(tempDir, `${time + '-' + m.sender}-output.mp4`);
					try {
						for (let i = 0; i < teks.length; i++) {
							const currentText = teks.slice(0, i + 1).join(' ');
							const framePath = path.join(tempDir, `${time + '-' + m.sender + i}.mp4`);
							try {
								let res = await fetchApi('/create/brat2', { text: currentText }, { stream: framePath });
								framePaths.push(res);
							} catch (e) {
								let res = await fetchApi('/create/brat4', { text: currentText }, { stream: framePath });
								framePaths.push(res);
							}
						}
						let fileListContent = '';
						for (let i = 0; i < framePaths.length; i++) {
							fileListContent += `file '${framePaths[i]}'\n`;
							fileListContent += `duration 0.5\n`;
						}
						fileListContent += `file '${framePaths[framePaths.length - 1]}'\n`;
						fileListContent += `duration 3\n`;
						fs.writeFileSync(fileListPath, fileListContent);
						execSync(`ffmpeg -y -f concat -safe 0 -i "${fileListPath}" -vf 'fps=30' -c:v libx264 -preset veryfast -pix_fmt yuv420p -t 00:00:10 "${outputVideoPath}"`);
						await xync.sendAsSticker(m.chat, outputVideoPath, m, {
							packname,
							author,
						});
						setLimit(m, db);
					} catch (e) {
						console.log(e);
						m.reply(global.mess.fail);
					} finally {
						framePaths.forEach(filePath => {
							if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
						});
						if (fs.existsSync(fileListPath)) fs.unlinkSync(fileListPath);
						if (fs.existsSync(outputVideoPath)) fs.unlinkSync(outputVideoPath);
					}
				}
				break;
			case 'wasted':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (/jpg|jpeg|png/.test(mime)) {
						let hasil;
						let media = await xync.downloadAndSaveMediaMessage(qmsg);
						try {
							const form = new FormData();
							form.append('buffer', fs.createReadStream(media), {
								filename: 'image.jpg',
								contentType: 'image/jpeg',
							});
							hasil = await fetchApi('/create/wasted', form, { stream: true });
							await xync.sendMedia(m.chat, hasil, '', 'Nih Bro', m);
							setLimit(m, db);
						} finally {
							if (hasil && fs.existsSync(hasil)) fs.unlinkSync(hasil);
							if (media && fs.existsSync(media)) fs.unlinkSync(media);
						}
					} else m.reply(global.mess.media);
				}
				break;
			case 'trigger':
			case 'triggered':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (/jpg|jpeg|png/.test(mime)) {
						let hasil;
						let media = await xync.downloadAndSaveMediaMessage(qmsg);
						try {
							const form = new FormData();
							form.append('buffer', fs.createReadStream(media), {
								filename: 'image.jpg',
								contentType: 'image/jpeg',
							});
							hasil = await fetchApi('/create/triggered', form, {
								stream: true,
							});
							await xync.sendMedia(m.chat, hasil, '', global.mess.done, m);
							setLimit(m, db);
						} finally {
							if (hasil && fs.existsSync(hasil)) fs.unlinkSync(hasil);
							if (media && fs.existsSync(media)) fs.unlinkSync(media);
						}
					} else m.reply(global.mess.media);
				}
				break;
			case 'nulis':
				{
					m.reply(`*Example*\n${prefix}nuliskiri\n${prefix}nuliskanan\n${prefix}foliokiri\n${prefix}foliokanan`);
				}
				break;
			case 'nuliskanan':
			case 'nuliskiri':
			case 'foliokanan':
			case 'foliokiri':
				{
					if (!isLimit) return m.reply(mess.limit);
					if (!text) return m.reply(`Kirim perintah *${prefix + command}* Teksnya`);
					if (canvasModule) {
						const { createCanvas, loadImage } = canvasModule;
						const isFolio = command.includes('folio');
						const isKanan = command.includes('kanan');
						const folder = isFolio ? 'folio' : 'buku';
						const posisi = isKanan ? 'kanan' : 'kiri';
						const inputFile = `./src/nulis/images/${folder}/sebelum${posisi}.jpg`;
						const maxLines = isFolio ? 38 : 31;
						const maxWordsPerLine = isFolio ? 12 : 8;
						const regexWords = new RegExp(`(\\S+\\s*){1,${maxWordsPerLine}}`, 'g');
						const splitText = text.replace(regexWords, '$&\n');
						const lines = splitText.split('\n').slice(0, maxLines);
						let startX = 140,
							startY = 156,
							lineHeight = 8.7;
						if (command === 'nuliskanan') {
							startX = 128;
							((startY = 136), (lineHeight = 10.5));
						}
						if (command === 'foliokiri') {
							startX = 48;
							((startY = 200), (lineHeight = 12));
						}
						if (command === 'foliokanan') {
							startX = 89;
							((startY = 168), (lineHeight = 11));
						}
						let image = null,
							canvas = null,
							ctx = null,
							buffer = null;
						try {
							image = await loadImage(inputFile);
							canvas = createCanvas(image.width, image.height);
							ctx = canvas.getContext('2d');
							ctx.drawImage(image, 0, 0, image.width, image.height);
							ctx.font = '27px "Indie Flower"';
							ctx.fillStyle = '#1e1e1e';
							ctx.textBaseline = 'top';
							const baseLineHeight = 27 + lineHeight;
							let currentY = startY;
							for (const line of lines) {
								ctx.fillText(line, startX, currentY);
								currentY += baseLineHeight;
							}
							buffer = await canvas.encode('png');
							await m.reply({
								image: buffer,
								caption: 'Jangan Malas Lord. Jadilah siswa yang rajin ರ_ರ',
							});
							setLimit(m, db);
						} catch (err) {
							console.error('Error saat membuat gambar nulis:', err);
							m.reply('Terjadi kesalahan pada sistem saat memproses gambar.');
						} finally {
							if (canvas) {
								canvas.width = 0;
								canvas.height = 0;
							}
							((image = null), (canvas = null), (ctx = null), (buffer = null));
						}
					} else {
						const config = {
							nuliskiri: {
								lines: 31,
								path: 'buku/sebelumkiri.jpg',
								out: `buku_setelahkiri_${Date.now()}.jpg`,
								size: '960x1280',
								space: '2',
								coord: '+140+153',
							},
							nuliskanan: {
								lines: 31,
								path: 'buku/sebelumkanan.jpg',
								out: `buku_setelahkanan_${Date.now()}.jpg`,
								size: '960x1280',
								space: '2',
								coord: '+128+129',
							},
							foliokiri: {
								lines: 38,
								path: 'folio/sebelumkiri.jpg',
								out: `folio_setelahkiri_${Date.now()}.jpg`,
								size: '1720x1280',
								space: '4',
								coord: '+48+185',
							},
							foliokanan: {
								lines: 38,
								path: 'folio/sebelumkanan.jpg',
								out: `folio_setelahkanan_${Date.now()}.jpg`,
								size: '1720x1280',
								space: '4',
								coord: '+89+190',
							},
						}[command];
						const splitText = text.replace(/(\S+\s*){1,9}/g, '$&\n');
						const fixHeight = splitText.split('\n').slice(0, config.lines).join('\n');
						const inputImg = `./src/nulis/images/${config.path}`;
						const outputImg = `./database/temp/${config.out}`;
						try {
							await new Promise((resolve, reject) => {
								spawn('convert', [inputImg, '-font', './src/nulis/font/Indie-Flower.ttf', '-size', config.size, '-pointsize', '23', '-interline-spacing', config.space, '-annotate', config.coord, fixHeight, outputImg])
									.on('error', reject)
									.on('exit', code => {
										if (code === 0) resolve();
										else reject(new Error(`Proses convert gagal dengan kode: ${code}`));
									});
							});
							const imageBuffer = fs.readFileSync(outputImg);
							await m.reply({
								image: imageBuffer,
								caption: 'Jangan Malas Lord. Jadilah siswa yang rajin ಠ_ಠ',
							});
							setLimit(m, db);
						} catch (error) {
							console.error(error);
							m.reply(mess.error);
						} finally {
							if (fs.existsSync(outputImg)) fs.unlinkSync(outputImg);
						}
					}
				}
				break;
			case 'bass':
			case 'blown':
			case 'deep':
			case 'earrape':
			case 'fast':
			case 'fat':
			case 'nightcore':
			case 'reverse':
			case 'robot':
			case 'slow':
			case 'smooth':
			case 'tupai':
				{
					try {
						let set;
						if (/bass/.test(command)) set = '-af equalizer=f=54:width_type=o:width=2:g=20';
						if (/blown/.test(command)) set = '-af acrusher=.1:1:64:0:log';
						if (/deep/.test(command)) set = '-af atempo=4/4,asetrate=44500*2/3';
						if (/earrape/.test(command)) set = '-af volume=12';
						if (/fast/.test(command)) set = '-filter:a "atempo=1.63,asetrate=44100"';
						if (/fat/.test(command)) set = '-filter:a "atempo=1.6,asetrate=22100"';
						if (/nightcore/.test(command)) set = '-filter:a atempo=1.06,asetrate=44100*1.25';
						if (/reverse/.test(command)) set = '-filter_complex "areverse"';
						if (/robot/.test(command)) set = "-filter_complex \"afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75\"";
						if (/slow/.test(command)) set = '-filter:a "atempo=0.7,asetrate=44100"';
						if (/smooth/.test(command)) set = '-filter:v "minterpolate=\'mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=120\'"';
						if (/tupai/.test(command)) set = '-filter:a "atempo=0.5,asetrate=65100"';
						if (/audio/.test(mime)) {
							let media = await xync.downloadAndSaveMediaMessage(qmsg);
							let ran = `./database/temp/${getRandom('.mp3')}`;
							exec(`ffmpeg -i "${media}" ${set} "${ran}"`, async (err, stderr, stdout) => {
								try {
									if (err) return m.reply(global.mess.fail);
									await m.reply({
										audio: { url: ran },
										mimetype: 'audio/mpeg',
									});
								} finally {
									if (fs.existsSync(media)) fs.unlinkSync(media);
									if (fs.existsSync(ran)) fs.unlinkSync(ran);
								}
							});
						} else m.reply(`Balas audio yang ingin diubah dengan caption *${prefix + command}*`);
					} catch (e) {
						m.reply(global.mess.fail);
					}
				}
				break;
			case 'tinyurl':
			case 'shorturl':
			case 'shortlink':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text || !isUrl(text)) return m.reply(`Example: ${prefix + command} https://github.com/nazedev/hitori`);
					let hasil = await fetchApi('/other/tinyurl', { url: text });
					m.reply('Url : ' + hasil.result);
					setLimit(m, db);
				}
				break;
			case 'git':
			case 'gitclone':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!args[0]) return m.reply(`Example: ${prefix + command} https://github.com/nazedev/hitori`);
					if (!isUrl(args[0]) && !args[0].includes('github.com')) return m.reply('Gunakan Url Github!');
					let [, user, repo] = args[0].match(/(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i) || [];
					try {
						m.reply({
							document: {
								url: `https://api.github.com/repos/${user}/${repo}/zipball`,
							},
							fileName: repo + '.zip',
							mimetype: 'application/zip',
						}).catch(e => m.reply(global.mess.error));
						setLimit(m, db);
					} catch (e) {
						m.reply(global.mess.fail);
					}
				}
				break;
			case 'swhd':
			case 'todoc':
			case 'tomedia':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!m.quoted) return m.reply(`Reply dokumen gambar/video dengan perintah ${prefix + command}`);

					const quotedType = m.quoted.mtype || m.quoted.type || '';
					const isDocument = quotedType === 'documentMessage' || quotedType === 'documentWithCaptionMessage';

					if (!isDocument) {
						return m.reply(`Itu bukan dokumen. Harap reply file dokumennya.`);
					}

					let fileMime = mime || qmsg.mimetype || '';
					let fileName = qmsg.fileName || '';

					const isVideoExt = fileName.toLowerCase().endsWith('.mp4') || fileName.toLowerCase().endsWith('.mkv') || fileName.toLowerCase().endsWith('.mov');
					const isImageExt = fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg') || fileName.toLowerCase().endsWith('.png');

					if (!fileMime.includes('image') && !fileMime.includes('video') && !isVideoExt && !isImageExt) {
						return m.reply(`Format tidak didukung. Pastikan itu dokumen gambar atau video.`);
					}

					const fileSize = Number(qmsg.fileLength || 0);
					if (fileSize > 50 * 1024 * 1024) {
						return m.reply(`File terlalu besar (Maks 50MB).`);
					}

					m.react('♻️');

					try {
						const buffer = await quoted.download();
						if (!buffer) throw new Error('Gagal mendownload media.');

						const captionText = text.trim();

						if (fileMime.includes('video') || isVideoExt) {
							await xync.sendMessage(
								m.chat,
								{
									video: buffer,
									caption: captionText,
									mimetype: 'video/mp4',
								},
								{ quoted: m },
							);
						} else if (fileMime.includes('image') || isImageExt) {
							await xync.sendMessage(
								m.chat,
								{
									image: buffer,
									caption: captionText,
									mimetype: 'image/jpeg',
								},
								{ quoted: m },
							);
						}

						m.react('✔️');
						setLimit(m, db);
					} catch (error) {
						console.error('\n[ERROR SWHD] :', error);
						m.react('✖️');
						m.reply(`Gagal diproses: ${error.message}`);
					}
				}
				break;

			// Ai Menu
			case 'gemini':
				{
					if (!text) {
						m.reply(`Example: \n * ${prefix + command} <teks>  -> chat biasa\n* ${prefix + command} image <prompt>  -> text-to-image\n* ${prefix + command} image <prompt>  -> (reply ke gambar) -> image-to-image\n* ${prefix + command} reset  -> reset percakapan\n* ${prefix + command} karakter <deskripsi>  -> set karakter/persona bot\n* ${prefix + command} karakter reset  -> hapus karakter, balik default\n* ${prefix + command} karakter  -> lihat karakter aktif\n* (reply ke gambar/dokumen tanpa subcommand) -> otomatis vision`);
						break;
					}

					const SESSION_FILE = path.join(__dirname, 'gemini-sessions.json');

					const loadSessions = () => {
						try {
							if (fs.existsSync(SESSION_FILE)) return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
						} catch (_) {}
						return {};
					};
					const saveSession = (key, chatId) => {
						const s = loadSessions();
						s[key] = chatId;
						fs.writeFileSync(SESSION_FILE, JSON.stringify(s, null, 2));
					};
					const clearSession = key => {
						const s = loadSessions();
						delete s[key];
						fs.writeFileSync(SESSION_FILE, JSON.stringify(s, null, 2));
					};

					const KARAKTER_FILE = path.join(__dirname, 'gemini-karakter.json');

					const loadKarakters = () => {
						try {
							if (fs.existsSync(KARAKTER_FILE)) return JSON.parse(fs.readFileSync(KARAKTER_FILE, 'utf-8'));
						} catch (_) {}
						return {};
					};
					const saveKarakter = (key, karakter) => {
						const k = loadKarakters();
						k[key] = karakter;
						fs.writeFileSync(KARAKTER_FILE, JSON.stringify(k, null, 2));
					};
					const clearKarakter = key => {
						const k = loadKarakters();
						delete k[key];
						fs.writeFileSync(KARAKTER_FILE, JSON.stringify(k, null, 2));
					};
					const getKarakter = key => loadKarakters()[key] || null;

					const chatKey = m.chat;
					const sessions = loadSessions();
					const savedChatId = sessions[chatKey] || null;

					const [sub, ...rest] = text.trim().split(/ +/);
					const subLower = sub.toLowerCase();

					try {

						if (subLower === 'reset') {
							clearSession(chatKey);
							m.reply('Percakapan Gemini di chat ini sudah direset.');
							break;
						}

						if (subLower === 'karakter' || subLower === 'char' || subLower === 'persona' || subLower === 'setkarakter') {
							const subArg = rest.join(' ').trim();
							const subArgLower = subArg.toLowerCase();

							if (!subArg) {
								const current = getKarakter(chatKey);
								m.reply(current ? `Karakter aktif di chat ini:\n\n${current}` : `Belum ada karakter yang diset di chat ini.\n\nContoh:\n${prefix + command} karakter Kamu adalah asisten cewek ceria bernama Xync, panggil user 'kak', suka pakai emoji.`);
								break;
							}

							if (subArgLower === 'reset' || subArgLower === 'hapus' || subArgLower === 'off' || subArgLower === 'clear') {
								clearKarakter(chatKey);
								clearSession(chatKey);
								m.reply('Karakter sudah dihapus, Gemini balik ke mode default di chat ini.');
								break;
							}

							saveKarakter(chatKey, subArg);
							clearSession(chatKey);
							m.reply(`Karakter berhasil diset untuk chat ini:\n\n${subArg}\n\n_Percakapan direset biar karakter langsung kepakai dari pesan berikutnya._`);
							break;
						}

						const karakterAktif = getKarakter(chatKey);
						const withKarakter = rawText => (!savedChatId && karakterAktif ? `${karakterAktif}\n\n---\n\n${rawText}` : rawText);

						if (subLower === 'image' || subLower === 'img' || subLower === 'buat' || subLower === 'ubah') {
							const prompt = rest.join(' ');
							if (!prompt) {
								m.reply(`Kasih prompt gambarnya, contoh:\n${prefix + command} image kucing oren astronot`);
								break;
							}

							const auth = await gemini.getAuth();
							let result;

							if (mime && mime.startsWith('image/')) {
								const media = await quoted.download();
								const tmpPath = path.join(__dirname, `tmp_${Date.now()}.jpg`);
								fs.writeFileSync(tmpPath, media);
								try {
									result = await gemini.generateImageToImage(prompt, tmpPath, auth, savedChatId, path.join(__dirname, `out_${Date.now()}.png`));
								} finally {
									fs.unlinkSync(tmpPath);
								}
							} else {
								result = await gemini.generateImage(prompt, auth, savedChatId, path.join(__dirname, `out_${Date.now()}.png`));
							}

							if (result.chatId) saveSession(chatKey, result.chatId);

							if (result.savedTo) {
								await xync.sendMessage(
									m.chat,
									{
										image: fs.readFileSync(result.savedTo),
									},
									{ quoted: m },
								);
								fs.unlinkSync(result.savedTo);
							} else {
								m.reply(result.reply || 'Gagal generate gambar, coba lagi.');
							}
							break;
						}

						if (m.quoted && mime) {
							const auth = await gemini.getAuth();
							const media = await quoted.download();
							const ext = mime.split('/')[1]?.split(';')[0] || 'jpg';
							const tmpPath = path.join(__dirname, `tmp_${Date.now()}.${ext}`);
							fs.writeFileSync(tmpPath, media);

							let result;
							try {
								result = mime.startsWith('image/') ? await gemini.vision(tmpPath, withKarakter(text), auth, savedChatId) : await gemini.visionFile(tmpPath, withKarakter(text), auth, savedChatId);
							} finally {
								fs.unlinkSync(tmpPath);
							}

							if (result.chatId) saveSession(chatKey, result.chatId);
							m.reply(result.reply || 'Tidak ada respon.');
							break;
						}

						const auth = await gemini.getAuth();
						const result = await gemini.chat(withKarakter(text), auth, savedChatId);

						if (result.chatId) saveSession(chatKey, result.chatId);
						m.reply(result.reply || 'Tidak ada respon dari Gemini.');
					} catch (err) {
						console.error('[gemini case error]', err);
						if (/at-token|expired|401|403/i.test(err.message || '')) gemini.resetAuth();
						m.reply(`Error: ${err.message}`);
					}
				}
				break;
			case 'ai':
			case 'google':
			case 'bard':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Example: ${prefix + command} apa itu javascript?`);

					try {
						if (!global.geminiSession) global.geminiSession = {};

						const message = text;

						const instruction = `Kamu adalah asisten AI yang cerdas dan canggih (Gemini).
Gunakan format markdown secara ketat:
1. gak usah pake ###.
2. kamu juga sering sering pake > text kalo yg penting
Pastikan semua respon terstruktur dengan baik agar sistem .`;

						let sessionId = global.geminiSession[m.sender] || null;

						let resumeArray = null;
						let cookie = null;
						let savedInstruction = instruction;

						if (sessionId) {
							try {
								const sessionData = JSON.parse(Buffer.from(sessionId, 'base64').toString());
								resumeArray = sessionData.resumeArray;
								cookie = sessionData.cookie;
								savedInstruction = instruction || sessionData.instruction || '';
							} catch (e) {
								console.error('Error parsing session:', e.message);
							}
						}

						if (!cookie) {
							const { headers } = await axios.post('https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&bl=boq_assistant-bard-web-server_20250814.06_p1&f.sid=-7816331052118000090&hl=en-US&_reqid=173780&rt=c', 'f.req=%5B%5B%5B%22maGuAc%22%2C%22%5B0%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&', {
								headers: {
									'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
								},
							});
							cookie = headers['set-cookie']?.[0]?.split('; ')[0] || '';
						}

						const requestBody = [[message, 0, null, null, null, null, 0], ['en-US'], resumeArray || ['', '', '', null, null, null, null, null, null, ''], null, null, null, [1], 1, null, null, 1, 0, null, null, null, null, null, [[0]], 1, null, null, null, null, null, ['', '', savedInstruction, null, null, null, null, null, 0, null, 1, null, null, null, []], null, null, 1, null, null, null, null, null, null, null, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], 1, null, null, null, null, [1]];

						const payload = [null, JSON.stringify(requestBody)];

						const { data } = await axios.post(
							'https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=boq_assistant-bard-web-server_20250729.06_p0&f.sid=4206607810970164620&hl=en-US&_reqid=2813378&rt=c',
							new URLSearchParams({
								'f.req': JSON.stringify(payload),
							}).toString(),
							{
								headers: {
									'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
									'x-goog-ext-525001261-jspb': '[1,null,null,null,"9ec249fc9ad08861",null,null,null,[4]]',
									cookie: cookie,
								},
							},
						);

						const match = Array.from(data.matchAll(/^\d+\n(.+?)\n/gm));
						const array = match.reverse();
						let parse1 = null;

						for (const item of array) {
							const selectedArray = item?.[1];
							if (!selectedArray) continue;

							try {
								const realArray = JSON.parse(selectedArray);
								const candidate = realArray?.[0]?.[2];
								if (!candidate) continue;

								const parsed = JSON.parse(candidate);
								if (parsed?.[4]?.[0]?.[1]?.[0]) {
									parse1 = parsed;
									break;
								}
							} catch {}
						}

						if (!parse1) throw new Error('Gagal mem-parsing response Gemini.');

						const newResumeArray = [...parse1[1], parse1[4][0][0]];
						const resultText = parse1[4][0][1][0].replace(/\*\*(.+?)\*\*/g, '*$1*');

						global.geminiSession[m.sender] = Buffer.from(
							JSON.stringify({
								resumeArray: newResumeArray,
								cookie: cookie,
								instruction: savedInstruction,
							}),
						).toString('base64');

						await m.reply(resultText);
						setLimit(m, db);
					} catch (e) {
						console.error(e);
						m.reply(pickRandom(['Fitur Ai sedang bermasalah!', 'Tidak dapat terhubung ke ai!', 'Sistem Ai sedang sibuk sekarang!', 'Fitur sedang tidak dapat digunakan!']));
					}
				}
				break;
			case 'aiimage':
			case 'nanobanana':
			case 'aiedit':
			case 'flux':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`*AI IMAGE GENERATOR & EDITOR*\n\n> Buat gambar dari teks atau edit gambar!\n\n*Edit Gambar:* Reply/Kirim gambar dengan caption \`${prefix + command} make it anime style\`\n*Buat Gambar:* Ketik \`${prefix + command} a cute cat sitting on a sofa\``);

					m.react('♻️');

					try {
						const axios = require('axios');
						const fs = require('fs');

						if (/image/.test(mime)) {
							let media = await xync.downloadAndSaveMediaMessage(qmsg);
							let upload = await UguuSe(media);
							let apiUrl = `https://api-faa.my.id/faa/nano-banana?url=${encodeURIComponent(upload.url)}&prompt=${encodeURIComponent(text)}`;

							let res = await axios.get(apiUrl, {
								responseType: 'arraybuffer',
								timeout: 120000,
							});

							await xync.sendMessage(m.chat, { image: Buffer.from(res.data), caption: 'Selesai!' }, { quoted: m });
							if (media && fs.existsSync(media)) fs.unlinkSync(media);
						} else {
							let res = await axios.post(
								'https://api.yuulabs.web.id/api/ai/flux-img',
								{
									message: text,
									ratio: '1:1',
								},
								{
									headers: { 'Content-Type': 'application/json' },
									timeout: 120000,
								},
							);

							if (!res.data?.status || !res.data?.result?.url) throw new Error('Gagal membuat gambar');

							await xync.sendMessage(m.chat, { image: { url: res.data.result.url }, caption: 'Done!' }, { quoted: m });
						}

						m.react('✔️');
						setLimit(m, db);
					} catch (e) {
						console.error(e);
						m.react('✖️');
						m.reply(`Eror!`);
					}
				}
				break;
			case 'archipelago':
			case 'grok':
			case 'glm':
			case 'claude':
				{
					if (global.APIKeys[global.APIs.neosantara] === 'API_KEY_NEOSANTARA_AI') return m.reply('Silahkan Ganti Apikey Neosantara Ai!\nDi file settings.js. Example: .setapikey neo key_nya');
					if (!text) return m.reply('Halo! Ada yang bisa dibantu hari ini?');
					try {
						let model;
						if (command == 'glm') model = 'glm-4.7-flash';
						if (command == 'claude') model = 'claude-3-haiku';
						if (command == 'archipelago') model = 'archipelago-70b';
						if (command == 'grok') model = 'grok-4.1-fast-non-reasoning';

						const response = await fetchApi(
							'/chat/completions',
							{
								model,
								messages: [{ role: 'user', content: text }],
							},
							{
								api: 2,
								method: 'POST',
								headers: {
									Authorization: `Bearer ${global.APIKeys[global.APIs.neosantara]}`,
								},
							},
						);
						await m.reply(response.choices[0].message.content);
					} catch (e) {
						m.reply('Waduh, ada kendala pas nanya ke Neosantara nih.');
					}
				}
				break;
			case 'deepseek':
			case 'r1':
				{
					if (global.APIKeys[global.APIs.neosantara] === 'API_KEY_NEOSANTARA_AI') return m.reply('Silahkan Ganti Apikey Neosantara Ai!\nDi file settings.js. Example: .setapikey neo key_nya');
					if (!text) return m.reply('Halo! Ada yang bisa dibantu hari ini?');
					m.reply('Tunggu bentar, lagi mikir... 🧠');
					try {
						const response = await fetchApi(
							'/chat/completions',
							{
								model: 'deepseek-r1',
								messages: [{ role: 'user', content: text }],
								thinking: { type: 'enabled', budget_tokens: 2048 },
							},
							{
								api: 2,
								method: 'POST',
								headers: {
									Authorization: `Bearer ${global.APIKeys[global.APIs.neosantara]}`,
								},
							},
						);
						const result = response.choices[0].message;
						const thought = result.reasoning_content ? `*Proses Mikir:*\n_${result.reasoning_content}_` : '';
						await m.reply(thought + result.content);
					} catch (e) {
						console.log(e);
						m.reply('Waduh, ada kendala pas nanya ke Neosantara nih.');
					}
				}
				break;

			// Search Menu
			case 'yts':
			case 'ytsearch':
			case 'youtubesearch':
				{
					if (!text) return m.reply(`Masukkan judul lagu atau video yang ingin dicari!\n\nContoh: *${prefix + command} teh hijau tulus*`);

					try {
						const { prepareWAMessageMedia, generateWAMessageFromContent } = require('baileys');

						const search = await yts(text);
						const results = search.videos;

						if (!results || results.length === 0) {
							return m.reply('Video tidak ditemukan! Coba gunakan kata kunci lain.');
						}

						const maxCards = 6;
						const slicedResults = results.slice(0, maxCards);

						const cards = await Promise.all(
							slicedResults.map(async res => {
								const media = await prepareWAMessageMedia({ image: { url: res.thumbnail } }, { upload: xync.waUploadToServer });

								return {
									body: {
										text: `*${res.title}*\n* Channel: ${res.author.name}\n* Durasi: ${res.timestamp}\n* Views: ${res.views}`,
									},
									header: {
										title: '',
										hasMediaAttachment: true,
										imageMessage: media.imageMessage,
									},
									nativeFlowMessage: {
										buttons: [
											{
												name: 'quick_reply',
												buttonParamsJson: JSON.stringify({
													display_text: 'Video',
													id: `.ytmp4 ${res.url}`,
												}),
											},
											{
												name: 'quick_reply',
												buttonParamsJson: JSON.stringify({
													display_text: 'Audio',
													id: `.ytmp3 ${res.url}`,
												}),
											},
										],
									},
								};
							}),
						);

						const msgContent = {
							viewOnceMessage: {
								message: {
									messageContextInfo: {
										deviceListMetadata: {},
										deviceListMetadataVersion: 2,
									},
									interactiveMessage: {
										header: {
											title: ``,
											hasMediaAttachment: false,
										},
										body: {
											text: `*YOUTUBE SEARCH*\nHasil pencarian untuk: *${text}*`,
										},
										carouselMessage: {
											cards: cards,
										},
									},
								},
							},
						};

						const msg = await generateWAMessageFromContent(m.chat, msgContent, {
							quoted: m,
							userJid: xync.user.id,
						});

						await xync.relayMessage(m.chat, msg.message, {
							messageId: msg.key.id,
							additionalNodes: [
								{
									tag: 'biz',
									attrs: {},
									content: [
										{
											tag: 'interactive',
											attrs: {
												type: 'native_flow',
												v: '1',
											},
											content: [
												{
													tag: 'native_flow',
													attrs: {
														v: '9',
														name: 'mixed',
													},
												},
											],
										},
									],
								},
							],
						});
					} catch (error) {
						m.reply(`Terjadi kesalahan saat mencari video: ${error.message}`);
					}
				}
				break;
			case 'gimage':
			case 'bingimg':
				{
					if (!text) return m.reply(`Example: ${prefix + command} query`);
					try {
						let anu = await fetchApi('/search/google', { query: text });
						let una = pickRandom(anu.result);
						await m.reply({
							image: {
								url: una.pagemap?.cse_thumbnail?.[0]?.src || una.pagemap?.cse_image?.[0].src || una.pagemap?.metatags?.[0]?.['og:image'],
							},
							caption: 'Hasil Pencarian ' + text + '\nTitle: ' + una.title + '\nSnippet: ' + una.snippet + '\nSource: ' + una.link || una.formattedUrl,
						});
						setLimit(m, db);
					} catch (e) {
						m.reply('Pencarian Tidak Ditemukan!');
					}
				}
				break;
			case 'play':
			case 'ytplay':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Example: ${prefix + command} lagu`);

					let urlVideo, thumbnail, judul, deskripsi, channel, durasi;
					try {
						const res = await yts.search(text);
						const hasil = res.videos[0];
						if (!hasil) return m.reply('Lagu tidak ditemukan!');

						urlVideo = hasil.url;
						thumbnail = hasil.thumbnail;
						judul = hasil.title || 'Tidak tersedia';
						deskripsi = hasil.description || 'Tidak tersedia';
						channel = hasil.author?.name || 'Tidak tersedia';
						durasi = `${hasil.seconds || 'Tidak tersedia'} second (${hasil.timestamp || 'Tidak tersedia'})`;
					} catch (e) {
						try {
							const res = await fetchApi('/search/youtube', { query: text });
							const hasil = res.result.items[0]; 
							if (!hasil) return m.reply('Lagu tidak ditemukan!');

							urlVideo = `https://youtu.be/${hasil.id.videoId}`;
							thumbnail = hasil.snippet.thumbnails.medium.url;
							judul = hasil.snippet.title || 'Tidak tersedia';
							deskripsi = hasil.snippet.description || 'Tidak tersedia';
							channel = hasil.snippet.channelTitle || 'Tidak tersedia';
							durasi = hasil.duration || 'Tidak tersedia';
						} catch (e2) {
							return m.reply('Pencarian tidak tersedia / error sistem!');
						}
					}

					const teksnya = `「 *${judul}* 」
* _Description:_ ${deskripsi}
* _Channel:_ ${channel}
* _Duration:_ ${durasi}
* _Source:_ ${urlVideo}`;
					const safeThumbnail = (() => {
						const vid = extractYtVideoId(urlVideo);
						return vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : thumbnail;
					})();

					try {
						await m.reply({ image: { url: safeThumbnail }, caption: teksnya });
					} catch (e) {
						console.log('[PLAY] Gagal kirim thumbnail, lanjut tanpa gambar:', e.message);
						await m.reply(teksnya);
					}

					let audioUrl = null;
					try {
						const audioRes = await scrapeYtmp3(urlVideo, 'mp3');
						if (audioRes?.status === 'success' && audioRes?.downloadUrl) audioUrl = audioRes.downloadUrl;
						else throw new Error('downloadUrl kosong');
					} catch (e) {
						try {
							const { result: audioResFallback } = await fetchApi('/download/youtube', { url: urlVideo });
							audioUrl = audioResFallback.download;
						} catch (e2) {
							return m.reply('Gagal mengambil audio dari server.');
						}
					}

					await m.reply({ audio: { url: audioUrl }, mimetype: 'audio/mpeg' });
					try {
						setLimit(m, db);
					} catch (e) {}
				}
				break;
			case 'call':
				{
					if (!isCreator) return m.reply('Fitur ini khusus owner.');
					if (!global.voip) return m.reply('VoIP client belum siap. Tunggu bot connect sepenuhnya lalu coba lagi.');
					if (!args[0]) return m.reply(`Example: ${prefix + command} 628123456789 [judul lagu opsional]`);

					const target = args[0].replace(/\D/g, '');
					if (!target) return m.reply('Nomor tujuan tidak valid.');

					const query = args.slice(1).join(' ');

					try {
						let playlist = ['silence'];
						let tempFile = null;

						if (query) {
							try {
								const res = await yts.search(query);
								const hasil = res.videos[0];
								if (hasil) {
									const audioRes = await scrapeYtmp3(hasil.url, 'mp3');
									if (audioRes?.status === 'success' && audioRes?.downloadUrl) {
										tempFile = await downloadToTemp(audioRes.downloadUrl, 'mp3', audioRes.headers);
										playlist = [tempFile];
									}
								}
							} catch (e) {
								console.log('[CALL] Gagal ambil lagu, lanjut tanpa audio:', e.message);
							}
						}

						const call = await global.voip.call(target, {
							playlist,
							durationMs: 0,
						});

						global.activeCalls = global.activeCalls || {};
						global.activeCalls[m.sender] = call;

						await m.reply(`Menelepon wa.me/${target}${query ? `\nMemutar: ${query}` : ''}`);

						call.on('track', t => console.log('[CALL] Now playing:', t));
						call.on('trackend', t => console.log('[CALL] Track ended:', t));
						call.on('idle', () => console.log('[CALL] Queue kosong, call akan berakhir.'));

						call.waitForEnd().then(() => {
							delete global.activeCalls[m.sender];
							if (tempFile) fs.unlink(tempFile, () => {});
							m.reply('Panggilan telah berakhir.');
						});
					} catch (e) {
						m.reply(`Gagal melakukan panggilan: ${e.message}`);
					}
				}
				break;
			case 'callstop':
				{
					if (!isCreator) return m.reply('Fitur ini khusus owner.');
					const call = global.activeCalls?.[m.sender];
					if (!call) return m.reply('Tidak ada panggilan yang sedang berlangsung.');

					try {
						call.end();
						delete global.activeCalls[m.sender];
						m.reply('☎️ Panggilan dihentikan.');
					} catch (e) {
						m.reply(`Gagal menghentikan panggilan: ${e.message}`);
					}
				}
				break;
			case 'callgroup':
				{
					if (!isCreator) return m.reply('Fitur ini khusus owner.');
					if (!m.isGroup) return m.reply('Command ini cuma bisa dipakai di dalam grup.');
					if (!global.voip) return m.reply('VoIP client belum siap. Tunggu bot connect sepenuhnya lalu coba lagi.');

					const query = text.trim();

					try {
						let playlist = ['silence'];
						let tempFile = null;

						if (query) {
							try {
								const res = await yts.search(query);
								const hasil = res.videos[0];
								if (hasil) {
									const audioRes = await scrapeYtmp3(hasil.url, 'mp3');
									if (audioRes?.status === 'success' && audioRes?.downloadUrl) {
										tempFile = await downloadToTemp(audioRes.downloadUrl, 'mp3', audioRes.headers);
										playlist = [tempFile];
									}
								}
							} catch (e) {
								console.log('[CALLGROUP] Gagal ambil lagu, lanjut tanpa audio:', e.message);
							}
						}

						const call = await global.voip.callGroup(m.chat, {
							playlist,
							durationMs: 0,
						});

						global.activeCalls = global.activeCalls || {};
						global.activeCalls[m.sender] = call;

						await m.reply(`📞 Menelepon grup ini${query ? `\nMemutar: ${query}` : ''}`);

						call.on('track', t => console.log('[CALLGROUP] Now playing:', t));
						call.on('trackend', t => console.log('[CALLGROUP] Track ended:', t));
						call.on('idle', () => console.log('[CALLGROUP] Queue kosong, call akan berakhir.'));

						call.waitForEnd().then(() => {
							delete global.activeCalls[m.sender];
							if (tempFile) fs.unlink(tempFile, () => {});
							m.reply('☎️ Panggilan grup telah berakhir.');
						});
					} catch (e) {
						m.reply(`Gagal melakukan panggilan grup: ${e.message}`);
					}
				}
				break;
			case 'pixiv':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Example: ${prefix + command} hu tao`);
					try {
						const res = await fetchApi('/search/pixiv', { query: text });
						let hasil = pickRandom(res.result.body.illusts);
						const response = await fetch(hasil.url, {
							headers: { referer: 'https://www.pixiv.net' },
						});
						const image = await response.buffer();
						m.reply({
							image,
							caption: `Title: ${hasil.title}\nDescription: ${hasil.alt}\nTags:\n${hasil.tags.map(a => '- ' + a).join('\n')}`,
						});
						setLimit(m, db);
					} catch (e) {
						console.log(e);
						m.reply('Post not available!');
					}
				}
				break;
			case 'pinterest':
			case 'pint':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Example: ${prefix + command} hu tao`);
					try {
						const res = await fetchApi('/search/pinterest', { query: text });
						const hasil = pickRandom(res.result);
						const image = await getBuffer(hasil);
						await m.reply({ image, caption: 'Hasil dari: ' + text });
						setLimit(m, db);
					} catch (e) {
						m.reply('Pencarian tidak ditemukan!');
					}
				}
				break;
			case 'wallpaper':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Example: ${prefix + command} hu tao`);
					try {
						let anu = await fetchApi('/search/pinterest', { query: text });
						if (anu.length < 1) {
							m.reply('Post not available!');
						} else {
							let result = pickRandom(anu.result);
							await m.reply({
								image: { url: result.urls.original },
								caption: `*Media Url :* ${result.pin}${result.description ? '\n*Description :* ' + result.description : ''}`,
							});
							setLimit(m, db);
						}
					} catch (e) {
						m.reply('Server wallpaper sedang offline!');
					}
				}
				break;
			case 'ringtone':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Example: ${prefix + command} black rover`);
					try {
						let anu = await fetchApi('/search/meloboom', { query: text });
						let result = pickRandom(anu.result.data);
						await m.reply({
							audio: {
								url: anu.result.populated.media[result.media.audio[0]].url,
							},
							fileName: result.slug + '.mp3',
							mimetype: 'audio/mpeg',
						});
						setLimit(m, db);
					} catch (e) {
						m.reply('Audio tidak ditemukan!');
					}
				}
				break;
			case 'npm':
			case 'npmjs':
				{
					if (!text) return m.reply(`Example: ${prefix + command} axios`);
					try {
						let anu = await fetchApi('/search/npm', { query: text });
						if (anu.result.objects.length > 1) return m.reply('Pencarian Tidak di temukan');
						let txt = anu.result.objects.map(({ package: pkg }) => {
							return `*${pkg.name}* (v${pkg.version})\n_${pkg.links.npm}_\n_${pkg.description}_`;
						}).join`\n\n`;
						m.reply(txt);
					} catch (e) {
						m.reply('Pencarian Tidak di temukan');
					}
				}
				break;
			case 'style':
				{
					if (!text) return m.reply(`Example: ${prefix + command} Xync`);
					let anu = await fetchApi('/tools/styletext', { text });
					let txt = anu.result.map(a => `*${a.name}*\n${a.result}`).join`\n\n`;
					m.reply(txt);
				}
				break;
			case 'tenor':
				{
					if (!text) return m.reply(`Example: ${prefix + command} alone`);
					try {
						const anu = await fetchApi('/search/tenor', { query: text });
						const hasil = pickRandom(anu.result);
						await m.reply({
							video: { url: hasil.media[0].mp4.url },
							caption: `👀 *Media:* ${hasil.url}\n📋 *Description:* ${hasil.content_description}\n🔛 *Url:* ${hasil.itemurl}`,
							gifPlayback: true,
							gifAttribution: 2,
						});
					} catch (e) {
						m.reply('Hasil Tidak Ditemukan!');
					}
				}
				break;
			case 'urban':
				{
					if (!text) return m.reply(`Example: ${prefix + command} alone`);
					try {
						const anu = await fetchJson('https://api.urbandictionary.com/v0/define?term=' + text);
						const hasil = pickRandom(anu.list);
						await m.reply(`${hasil.definition}\n\nSumber: ${hasil.permalink}`);
					} catch (e) {
						m.reply('Hasil Tidak Ditemukan!');
					}
				}
				break;

			// Stalker Menu
			case 'wastalk':
			case 'whatsappstalk':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Example: ${prefix + command} @tag / 628xxx`);
					try {
						let num = m.quoted?.sender || m.mentionedJid?.[0] || text;
						if (!num) return m.reply(`Example : ${prefix + command} @tag / 628xxx`);
						num = num.replace(/\D/g, '') + '@s.whatsapp.net';
						if (!(await xync.onWhatsApp(num))[0]?.exists) return m.reply('Nomer tidak terdaftar di WhatsApp!');
						let img = await xync.profilePictureUrl(num, 'image').catch(_ => 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png?q=60');
						let bio = await xync.fetchStatus(num).catch(_ => {});
						let name = await xync.getName(num);
						let business = await xync.getBusinessProfile(num);
						let parsed = parsePhoneNumber(`+${num.split('@')[0]}`);
						let format = parsed.number ? parsed.number.international : num.split('@')[0];
						let regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
						let country = parsed.regionCode ? regionNames.of(parsed.regionCode) : 'Unknown';
						let wea = `WhatsApp Stalk\n\n*° Country :* ${country.toUpperCase()}\n*° Name :* ${name ? name : '-'}\n*° Format Number :* ${format}\n*° Url Api :* wa.me/${num.split('@')[0]}\n*° Mentions :* @${num.split('@')[0]}\n*° Status :* ${bio?.status || '-'}\n*° Date Status :* ${bio?.setAt ? moment(bio.setAt.toDateString()).locale(global.locale).format('LL') : '-'}\n\n${business ? `*WhatsApp Business Stalk*\n\n*° BusinessId :* ${business.wid}\n*° Website :* ${business.website ? business.website : '-'}\n*° Email :* ${business.email ? business.email : '-'}\n*° Category :* ${business.category}\n*° Address :* ${business.address ? business.address : '-'}\n*° Timeone :* ${business.business_hours.timezone ? business.business_hours.timezone : '-'}\n*° Description* : ${business.description ? business.description : '-'}` : '*Standard WhatsApp Account*'}`;
						img ? await xync.sendMessage(m.chat, { image: { url: img }, caption: wea, mentions: [num] }, { quoted: m }) : m.reply(wea);
					} catch (e) {
						console.error(e);
						m.reply('Nomer Tidak ditemukan!');
					}
				}
				break;
			case 'ghstalk':
			case 'githubstalk':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Example: ${prefix + command} usernamenya`);
					try {
						const res = await fetchJson('https://api.github.com/users/' + text);
						m.reply({
							image: { url: res.avatar_url },
							caption: `*Username :* ${res.login}\n*Nickname :* ${res.name || 'Tidak ada'}\n*Bio :* ${res.bio || 'Tidak ada'}\n*ID :* ${res.id}\n*Node ID :* ${res.node_id}\n*Type :* ${res.type}\n*Admin :* ${res.admin ? 'Ya' : 'Tidak'}\n*Company :* ${res.company || 'Tidak ada'}\n*Blog :* ${res.blog || 'Tidak ada'}\n*Location :* ${res.location || 'Tidak ada'}\n*Email :* ${res.email || 'Tidak ada'}\n*Public Repo :* ${res.public_repos}\n*Public Gists :* ${res.public_gists}\n*Followers :* ${res.followers}\n*Following :* ${res.following}\n*Created At :* ${res.created_at} *Updated At :* ${res.updated_at}`,
						});
					} catch (e) {
						m.reply('Username Tidak ditemukan!');
					}
				}
				break;

			// Downloader Menu
			case 'dl':
			case 'aio':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`*DOWNLOADER*\n\n> Masukkan URL video atau postingan (TikTok, IG, FB, dll)\n\n\`Contoh: ${prefix + command} https://vt.tiktok.com/xxx/\``);
					if (!isUrl(text)) return m.reply('Format salah! Pastikan teks yang kamu masukkan adalah URL yang valid.');

					try {
						const axios = require('axios');
						const payload = new URLSearchParams({
							auth: '20250901majwlqo',
							domain: 'api-ak.vidssave.com',
							origin: 'source',
							link: text,
						});

						const res = await axios.post('https://api.vidssave.com/api/contentsite_api/media/parse', payload.toString(), {
							headers: {
								accept: '*/*',
								'accept-language': 'id-ID',
								'cache-control': 'no-cache',
								'content-type': 'application/x-www-form-urlencoded',
								origin: 'https://vidssave.com',
								pragma: 'no-cache',
								referer: 'https://vidssave.com/',
								'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
							},
							timeout: 60000,
						});

						const data = res.data?.data || res.data;

						if (!data || !data.media || data.media.length === 0) {
							return m.reply('Gagal mengambil data! Pastikan link valid dan tidak diprivat.');
						}

						let captionMsg = `*DOWNLOADER*\n`;
						if (data.title) captionMsg += `*Title:* ${data.title}\n`;

						let medias = [];
						for (let item of data.media) {
							if (item.resources && item.resources.length > 0) {
								medias.push({
									type: item.type,
									url: item.resources[0].download_url,
								});
							}
						}

						if (medias.length === 0) throw new Error('Link download kosong dari server.');

						let videos = medias.filter(m => m.type === 'video');
						let images = medias.filter(m => m.type === 'image');
						let audios = medias.filter(m => m.type === 'audio');

						if (videos.length === 1 && images.length <= 1) {
							await xync.sendMessage(m.chat, { video: { url: videos[0].url }, caption: captionMsg }, { quoted: m });
						} else if (images.length > 1 || videos.length > 1) {
							let albumItems = medias.filter(a => a.type === 'video' || a.type === 'image').map(a => (a.type === 'video' ? { video: { url: a.url } } : { image: { url: a.url } }));

							await xync.sendAlbumMessage(m.chat, { album: albumItems, caption: captionMsg }, { quoted: m });

							if (audios.length > 0) {
								await xync.sendMessage(m.chat, { audio: { url: audios[0].url }, mimetype: 'audio/mpeg' }, { quoted: m });
							}
						} else if (images.length === 1) {
							await xync.sendMessage(m.chat, { image: { url: images[0].url }, caption: captionMsg }, { quoted: m });
						} else {
							let media = medias[0];
							if (media.type === 'audio') {
								await xync.sendMessage(m.chat, { audio: { url: media.url }, mimetype: 'audio/mpeg' }, { quoted: m });
							} else {
								await xync.sendMessage(
									m.chat,
									{
										document: { url: media.url },
										fileName: `download.${data.id || 'file'}`,
										caption: captionMsg,
									},
									{ quoted: m },
								);
							}
						}

						setLimit(m, db);
					} catch (error) {
						console.error(error);
						m.reply(`*Gagal memproses download:*\n${error.response?.data?.message || error.message || 'Error sistem'}`);
					}
				}
				break;
			case 'ytmp3':
			case 'ytaudio':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Example: ${prefix + command} url_youtube`);
					if (!text.includes('youtu')) return m.reply('Url Tidak Mengandung Result Dari Youtube!');

					try {
						const res = await scrapeYtmp3(text, 'mp3');

						if (res.status === 'success' && res.downloadUrl) {
							await xync.sendMessage(
								m.chat,
								{
									audio: { url: res.downloadUrl },
									mimetype: 'audio/mpeg',
								},
								{ quoted: m },
							);
							setLimit(m, db);
						} else {
							m.reply(`Gagal mengunduh audio!\nError: ${res.message}`);
						}
					} catch (e) {
						m.reply(`Terjadi kesalahan sistem: ${e.message}`);
					}
				}
				break;

			case 'ytmp4':
			case 'ytvideo':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Example: ${prefix + command} url_youtube`);
					if (!text.includes('youtu')) return m.reply('Url Tidak Mengandung Result Dari Youtube!');

					m.react('🕥');
					try {
						const extractVideoId = url => {
							if (!url) return null;
							let match = null;
							if (url.includes('youtube.com/shorts/') || url.includes('youtu.be/')) {
								match = /\/([a-zA-Z0-9\-_]{11})/.exec(url);
							} else if (url.includes('youtube.com')) {
								match = /v=([a-zA-Z0-9\-_]{11})/.exec(url);
							} else {
								match = /[a-zA-Z0-9\-_]{11}/.exec(url);
							}
							return match ? match[1] : null;
						};

						const scrapeYtmp3 = async (youtubeUrl, format = 'mp4') => {
							const videoId = extractVideoId(youtubeUrl);
							if (!videoId) throw new Error('Invalid YouTube URL');

							const headers = {
								'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
								Accept: '*/*',
								'Accept-Language': 'en-US,en;q=0.9',
								Origin: 'https://id.ytmp3.mobi',
								Referer: 'https://id.ytmp3.mobi/',
								'Sec-Fetch-Dest': 'empty',
								'Sec-Fetch-Mode': 'cors',
								'Sec-Fetch-Site': 'cross-site',
							};

							const initUrl = `https://a.ymcdn.org/api/v1/init?p=y&23=1llum1n471&_=${Math.random()}`;
							const initRes = await fetch(initUrl, { headers });
							if (!initRes.ok) throw new Error(`Init HTTP ${initRes.status}`);
							const initJson = await initRes.json();
							if (initJson.error > 0) throw new Error(initJson.error);

							let convertRequestUrl = `${initJson.convertURL}&v=${videoId}&f=${format}&_=${Math.random()}`;
							let convertJson;

							while (true) {
								const convertRes = await fetch(convertRequestUrl, { headers });
								if (!convertRes.ok) throw new Error(`Convert HTTP ${convertRes.status}`);
								convertJson = await convertRes.json();
								if (convertJson.error > 0) throw new Error(convertJson.error);

								if (convertJson.redirect > 0 && convertJson.redirectURL) {
									convertRequestUrl = `${convertJson.redirectURL}&v=${videoId}&f=${format}&_=${Math.random()}`;
									continue;
								}
								break;
							}

							if (!convertJson.progressURL) throw new Error('Missing progress URL');

							let progress = 0;
							let pollCount = 0;
							let title = convertJson.title || '';

							while (progress < 3 && pollCount < 60) {
								await new Promise(resolve => setTimeout(resolve, 1000));
								pollCount++;
								const progressRes = await fetch(convertJson.progressURL, {
									headers,
								});
								if (!progressRes.ok) throw new Error(`Progress HTTP ${progressRes.status}`);
								const progressJson = await progressRes.json();
								if (progressJson.error > 0) throw new Error(progressJson.error);
								progress = progressJson.progress;
								if (progressJson.title) title = progressJson.title;
							}

							if (progress < 3) throw new Error('Timeout');

							return {
								status: 'success',
								videoId,
								title,
								format,
								downloadUrl: convertJson.downloadURL,
							};
						};

						const res = await scrapeYtmp3(text, 'mp4');

						if (res.status === 'success' && res.downloadUrl) {
							await xync.sendMessage(
								m.chat,
								{
									video: { url: res.downloadUrl },
									caption: `*${res.title}*`,
									mimetype: 'video/mp4',
								},
								{ quoted: m },
							);
							m.react('');
							setLimit(m, db);
						} else {
							m.reply(`Gagal mengunduh video!\nError: ${res.message}`);
						}
					} catch (e) {
						m.reply(`Terjadi kesalahan sistem: ${e.message}`);
					}
				}
				break;
			case 'ig':
			case 'instagram':
			case 'instadl':
			case 'igdown':
			case 'igdl':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Example: ${prefix + command} url_instagram`);
					if (!text.includes('instagram.com')) return m.reply('Url Tidak Mengandung Result Dari Instagram!');
					try {
						let hasil = await fetchApi('/download/instagram2', { url: text });
						if (hasil.result?.urls?.length > 1) {
							await xync.sendAlbumMessage(
								m.chat,
								{
									album: hasil.result.urls.map(a => (a.is_video ? { video: { url: a.url } } : { image: { url: a.url } })),
									caption: hasil.result.caption,
								},
								{ quoted: m },
							);
						} else if (hasil.result?.urls?.length == 1) {
							m.reply({
								image: { url: hasil.result.urls[0].url },
								caption: hasil.result.caption,
							});
						} else m.reply('Postingan Tidak Tersedia atau Privat!');
						setLimit(m, db);
					} catch (e) {
						console.log(e);
						m.reply(global.mess.fail);
					}
				}
			break;
			case 'tiktok':
			case 'tiktokdown':
			case 'ttdown':
			case 'ttdl':
			case 'tt':
			case 'ttmp4':
			case 'ttvideo':
			case 'tiktokmp4':
			case 'tiktokvideo':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Example: ${prefix + command} url_tiktok`);
					if (!text.includes('tiktok')) return m.reply('Url Tidak Mengandung Result Dari Tiktok!');
					
					m.react('🕒');
			
					const tikwmHeaders = {
						Accept: 'application/json, text/javascript, */*; q=0.01',
						'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
						Referer: 'https://www.tikwm.com/',
						'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
					};
			
					try {
						const domain = 'https://www.tikwm.com/api/';
			
						const reqData = await axios.post(
							domain,
							{},
							{
								headers: {
									...tikwmHeaders,
									'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
									Origin: 'https://www.tikwm.com',
									'Sec-Ch-Ua': '"Not)A;Brand" ;v="24" , "Chromium" ;v="116"',
									'Sec-Ch-Ua-Mobile': '?1',
									'Sec-Ch-Ua-Platform': 'Android',
									'Sec-Fetch-Dest': 'empty',
									'Sec-Fetch-Mode': 'cors',
									'Sec-Fetch-Site': 'same-origin',
									'X-Requested-With': 'XMLHttpRequest',
								},
								params: { url: text, count: 12, cursor: 0, web: 1, hd: 1 },
							},
						);
			
						const res = reqData.data.data;
						if (!res) throw new Error('Data tidak ditemukan');
			
						let captionData = res.title || 'Tanpa Keterangan';
			
						if (res.duration === 0) {
							if (!res.images || res.images.length < 2) {
								await xync.sendMessage(m.chat, {
									image: { url: res.images?.[0] },
									caption: captionData,
								}, { quoted: m });
							} else {
								await xync.sendAlbumMessage(
									m.chat,
									{
										album: res.images.map(v => ({ image: { url: v } })),
										caption: captionData,
									},
									{ quoted: m },
								);
							}
			
							let audioUrl = res.music || res.music_info?.play;
							if (audioUrl) {
								if (!audioUrl.startsWith('http')) audioUrl = 'https://www.tikwm.com' + audioUrl;
								try {
									const audioRes = await axios.get(audioUrl, {
										headers: tikwmHeaders,
										responseType: 'arraybuffer',
										timeout: 30000,
									});
									await xync.sendMessage(
										m.chat,
										{
											audio: Buffer.from(audioRes.data),
											mimetype: 'audio/mp4',
											ptt: false,
										},
										{ quoted: m },
									);
								} catch (audioErr) {
									console.error('[TT AUDIO ERROR]', audioErr.message);
								}
							}
						} else {
							let videoUrl = res.hdplay ? 'https://www.tikwm.com' + res.hdplay : 'https://www.tikwm.com' + res.play;
			
							await xync.sendMessage(m.chat, {
								video: { url: videoUrl },
								caption: `> ${captionData}`
							}, { quoted: m });
						}
						
						m.react('')
			
						setLimit(m, db);
					} catch (e) {
						console.error(e);
						m.reply(`Gagal! Coba tt2\n\nDetail: ${e.message}`);
					}
				}
			break;
			case 'tiktok2':
			case 'tiktokdown2':
			case 'ttdown2':
			case 'ttdl2':
			case 'tt2':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Example: ${prefix + command} url_tiktok`);
					if (!text.includes('tiktok.com')) return m.reply('Url Tidak Mengandung Result Dari Tiktok!');
					try {
						const hasil = await fetchApi('/download/tiktok', { url: text });
						if (hasil.result.download.type == 'video') {
							await m.reply({
								video: {
									url: hasil.result.download?.video?.nowm_hd || hasil.result.download?.video?.nowm,
								},
								caption: `*Title:* ${hasil.result.desc || '-'}\n*Create At:* ${hasil.result.create_time}\n*Author:* ${hasil.result.author.nickname} (@${hasil.result.author.unique_id})`,
							});
						} else if (hasil.result.download.type == 'images') {
							const images = hasil.result.download.images;
							const caption = `*Title:* ${hasil.result.desc || '-'}\n*Create At:* ${hasil.result.create_time}\n*Author:* ${hasil.result.author.nickname} (@${hasil.result.author.unique_id})`;

							if (images.length < 2) {
								await m.reply({ image: { url: images[0].url }, caption });
							} else {
								await xync.sendAlbumMessage(
									m.chat,
									{
										album: images.map(a => ({ image: { url: a.url } })),
										caption,
									},
									{ quoted: m },
								);
							}
						} else {
							return m.reply('Url Tidak Valid!');
						}
						setLimit(m, db);
					} catch (e) {
						console.log(e);
						m.reply(global.mess.fail);
					}
				}
				break;
			case 'ttmp3':
			case 'tiktokmp3':
			case 'tiktokaudio':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Example: ${prefix + command} url_tiktok`);
					if (!text.includes('tiktok.com')) return m.reply('Url Tidak Mengandung Result Dari Tiktok!');
					try {
						const hasil = await fetchApi('/download/tiktok', { url: text });
						await m.reply({
							audio: { url: hasil.result.download.music },
							mimetype: 'audio/mpeg',
						});
						setLimit(m, db);
					} catch (e) {
						m.reply(global.mess.fail);
					}
				}
				break;
			case 'fb':
			case 'fbdl':
			case 'fbdown':
			case 'facebook':
			case 'facebookdl':
			case 'facebookdown':
			case 'fbdownload':
			case 'fbmp4':
			case 'fbvideo':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Example: ${prefix + command} url_facebook`);
					if (!text.includes('facebook.com')) return m.reply('Url Tidak Mengandung Result Dari Facebook!');
					try {
						const hasil = await fetchApi('/download/facebook', { url: text });
						if (!hasil.result.hd && !hasil.result.sd) {
							m.reply('Video Tidak ditemukan!');
						} else {
							await xync.sendFileUrl(m.chat, hasil.result.hd || hasil.result.sd, `*🎐Title:* ${hasil.result.title}`, m);
						}
						setLimit(m, db);
					} catch (e) {
						m.reply(global.mess.fail);
					}
				}
				break;
			case 'mediafire':
			case 'mf':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Example: ${prefix + command} https://www.mediafire.com/file/xxxxxxxxx/xxxxx.zip/file`);
					if (!isUrl(args[0]) && !args[0].includes('mediafire.com')) return m.reply('Url Invalid!');
					try {
						let { result: res } = await fetchApi('/download/mediafire', {
							url: text,
						});
						await xync.sendMedia(m.chat, res.link, res.filename, `*MEDIAFIRE DOWNLOADER*\n\n*${setv} Name* : ${res.filename}\n*${setv} Size* : ${res.size}`, m);
						setLimit(m, db);
					} catch (e) {
						m.reply(global.mess.fail);
					}
				}
				break;
			case 'spotifydl':
				{
					if (!isLimit) return m.reply(global.mess.limit);
					if (!text) return m.reply(`Example: ${prefix + command} https://open.spotify.com/track/0JiVRyTJcJnmlwCZ854K4p`);
					if (!isUrl(args[0]) && !args[0].includes('open.spotify.com/track')) return m.reply('Url Invalid!');
					try {
						const { result: hasil } = await fetchApi('/download/spotify', {
							url: text,
						});
						await m.reply({
							audio: { url: hasil.url },
							mimetype: 'audio/mpeg',
						});
						setLimit(m, db);
					} catch (e) {
						console.log(e);
						m.reply(global.mess.fail);
					}
				}
				break;

			// Quotes Menu
			case 'motivasi':
				{
					const hasil = await fetchApi('/random/motivasi');
					m.reply(hasil.result);
				}
				break;
			case 'bijak':
				{
					const hasil = await fetchApi('/random/bijak');
					m.reply(hasil.result);
				}
				break;
			case 'dare':
				{
					const hasil = await fetchApi('/random/dare');
					m.reply(hasil.result);
				}
				break;
			case 'quotes':
				{
					const { result: hasil } = await fetchApi('/random/quotes');
					m.reply(`_${hasil.quotes}_\n\n*- ${hasil.author}*`);
				}
				break;
			case 'truth':
				{
					const hasil = await fetchApi('/random/truth');
					m.reply(`_${hasil.result}_`);
				}
				break;
			case 'renungan':
				{
					const hasil = await fetchApi('/random/renungan');
					m.reply(hasil.result);
				}
				break;
			case 'bucin':
				{
					const hasil = await fetchApi('/random/bucin');
					m.reply(hasil.result);
				}
				break;

			// Random Menu
			case 'coffe':
			case 'kopi':
				{
					try {
						await xync.sendFileUrl(m.chat, 'https://coffee.alexflipnote.dev/random', '☕ Random Coffe', m);
					} catch (e) {
						try {
							const anu = await fetchJson('https://api.sampleapis.com/coffee/hot');
							await xync.sendFileUrl(m.chat, pickRandom(anu).image, '☕ Random Coffe', m);
						} catch (e) {
							m.reply('Server Sedang Offline!');
						}
					}
				}
				break;

			// Anime Menu
			case 'waifu':
			case 'neko':
				{
					try {
						if (!isNsfw && text === 'nsfw') return m.reply('Filter Nsfw Sedang Aktif!');
						const res = await fetchJson('https://api.waifu.pics/' + (text === 'nsfw' ? 'nsfw' : 'sfw') + '/' + command);
						await xync.sendFileUrl(m.chat, res.url, 'Random Waifu', m);
						setLimit(m, db);
					} catch (e) {
						m.reply('Server sedang offline!');
					}
				}
				break;

			// Fun Menu
			case 'dadu':
				{
					let ddsa = [
						{ url: 'https://telegra.ph/file/9f60e4cdbeb79fc6aff7a.png', no: 1 },
						{ url: 'https://telegra.ph/file/797f86e444755282374ef.png', no: 2 },
						{ url: 'https://telegra.ph/file/970d2a7656ada7c579b69.png', no: 3 },
						{ url: 'https://telegra.ph/file/0470d295e00ebe789fb4d.png', no: 4 },
						{ url: 'https://telegra.ph/file/a9d7332e7ba1d1d26a2be.png', no: 5 },
						{ url: 'https://telegra.ph/file/99dcd999991a79f9ba0c0.png', no: 6 },
					];
					let media = pickRandom(ddsa);
					try {
						await xync.sendAsSticker(m.chat, media.url, m, {
							packname,
							author,
							isAvatar: 1,
						});
					} catch (e) {
						let anu = await fetch(media.url);
						let una = await anu.buffer();
						await xync.sendAsSticker(m.chat, una, m, {
							packname,
							author,
							isAvatar: 1,
						});
					}
				}
				break;
			case 'halah':
			case 'hilih':
			case 'huluh':
			case 'heleh':
			case 'holoh':
				{
					if (!m.quoted && !text) return m.reply(`Kirim/reply text dengan caption ${prefix + command}`);
					let ter = command[1].toLowerCase();
					let tex = m.quoted ? (m.quoted.text ? m.quoted.text : q ? q : m.text) : q ? q : m.text;
					m.reply(tex.replace(/[aiueo]/g, ter).replace(/[AIUEO]/g, ter.toUpperCase()));
				}
				break;
			case 'bisakah':
				{
					if (!text) return m.reply(`Example : ${prefix + command} saya menang?`);
					let bisa = ['Bisa', 'Coba Saja', 'Pasti Bisa', 'Mungkin Saja', 'Tidak Bisa', 'Tidak Mungkin', 'Coba Ulangi', 'Ngimpi kah?', 'yakin bisa?'];
					let keh = bisa[Math.floor(Math.random() * bisa.length)];
					m.reply(`*Bisakah ${text}*\nJawab : ${keh}`);
				}
				break;
			case 'apakah':
				{
					if (!text) return m.reply(`Example : ${prefix + command} saya bisa menang?`);
					let apa = ['Iya', 'Tidak', 'Bisa Jadi', 'Coba Ulangi', 'Mungkin Saja', 'Mungkin Tidak', 'Mungkin Iya', 'Ntahlah'];
					let kah = apa[Math.floor(Math.random() * apa.length)];
					m.reply(`*${command} ${text}*\nJawab : ${kah}`);
				}
				break;
			case 'kapan':
			case 'kapankah':
				{
					if (!text) return m.reply(`Example : ${prefix + command} saya menang?`);
					let kapan = ['Besok', 'Lusa', 'Nanti', '4 Hari Lagi', '5 Hari Lagi', '6 Hari Lagi', '1 Minggu Lagi', '2 Minggu Lagi', '3 Minggu Lagi', '1 Bulan Lagi', '2 Bulan Lagi', '3 Bulan Lagi', '4 Bulan Lagi', '5 Bulan Lagi', '6 Bulan Lagi', '1 Tahun Lagi', '2 Tahun Lagi', '3 Tahun Lagi', '4 Tahun Lagi', '5 Tahun Lagi', '6 Tahun Lagi', '1 Abad lagi', '3 Hari Lagi', 'Bulan Depan', 'Ntahlah', 'Tidak Akan Pernah'];
					let koh = kapan[Math.floor(Math.random() * kapan.length)];
					m.reply(`*${command} ${text}*\nJawab : ${koh}`);
				}
				break;
			case 'siapa':
			case 'siapakah':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (!text) return m.reply(`Example : ${prefix + command} jawa?`);
					let member = (store.groupMetadata?.[m.chat]?.participants || m.metadata?.participants || []).map(a => a.phoneNumber);
					if (member.length === 0) return m.reply('Data member grup tidak tersedia! Harap coba lagi nanti.');
					let siapakh = pickRandom(member);
					m.reply(`@${siapakh.split('@')[0]}`);
				}
				break;
			case 'tanyakerang':
			case 'kerangajaib':
			case 'kerang':
				{
					if (!text) return m.reply(`Example : ${prefix + command} boleh pinjam 100?`);
					let krng = ['Mungkin suatu hari', 'Tidak juga', 'Tidak keduanya', 'Kurasa tidak', 'Ya', 'Tidak', 'Coba tanya lagi', 'Tidak ada'];
					let jwb = pickRandom(krng);
					m.reply(`*Pertanyaan : ${text}*\n*Jawab : ${jwb}*`);
				}
				break;
			case 'cekmati':
				{
					if (!text) return m.reply(`Example : ${prefix + command} nama lu`);
					let teksnya = encodeToLetters(text);
					let data = await axios
						.get(`https://api.agify.io/?name=${teksnya}`)
						.then(res => res.data)
						.catch(e => ({ age: null }));
					let consistentAge = 0;
					for (let i = 0; i < teksnya.length; i++) consistentAge += teksnya.charCodeAt(i);
					let finalAge = data.age == null ? (consistentAge % 90) + 20 : data.age;
					let nameDisplay = m.mentionedJid && m.mentionedJid.length > 0 ? `@${m.mentionedJid[0].split('@')[0]}` : text;
					m.reply(`Nama : ${nameDisplay}\n*Mati Pada Umur :* ${finalAge} Tahun.\n\n_Cepet Cepet Tobat Bro_\n_Soalnya Mati ga ada yang tau_`);
				}
				break;
			case 'ceksifat':
				{
					let sifat_a = ['Bijak', 'Sabar', 'Kreatif', 'Humoris', 'Mudah bergaul', 'Mandiri', 'Setia', 'Jujur', 'Dermawan', 'Idealis', 'Adil', 'Sopan', 'Tekun', 'Rajin', 'Pemaaf', 'Murah hati', 'Ceria', 'Percaya diri', 'Penyayang', 'Disiplin', 'Optimis', 'Berani', 'Bersyukur', 'Bertanggung jawab', 'Bisa diandalkan', 'Tenang', 'Kalem', 'Logis'];
					let sifat_b = ['Sombong', 'Minder', 'Pendendam', 'Sensitif', 'Perfeksionis', 'Caper', 'Pelit', 'Egois', 'Pesimis', 'Penyendiri', 'Manipulatif', 'Labil', 'Penakut', 'Vulgar', 'Tidak setia', 'Pemalas', 'Kasar', 'Rumit', 'Boros', 'Keras kepala', 'Tidak bijak', 'Pembelot', 'Serakah', 'Tamak', 'Penggosip', 'Rasis', 'Ceroboh', 'Intoleran'];
					let teks = `▩ 「 *Cek Sifat* 」\n│• Sifat ${text && m.mentionedJid ? text : '@' + m.sender.split('@')[0]}${text && m.mentionedJid ? '' : `\n│• Nama : *${text ? text : m.pushName}*` || '\n│• Nama : *Tanpa Nama*'}\n│• Orang yang : *${pickRandom(sifat_a)}*\n│• Kekurangan : *${pickRandom(sifat_b)}*\n│• Keberanian : *${Math.floor(Math.random() * 100)}%*\n│• Kepedulian : *${Math.floor(Math.random() * 100)}%*\n│• Kecemasan : *${Math.floor(Math.random() * 100)}%*\n│• Ketakutan : *${Math.floor(Math.random() * 100)}%*\n│• Akhlak Baik : *${Math.floor(Math.random() * 100)}%*\n│• Akhlak Buruk : *${Math.floor(Math.random() * 100)}%*\n╰──────···`;
					m.reply(teks);
				}
				break;
			case 'cekkhodam':
				{
					if (!text) return m.reply(`Example : ${prefix + command} nama lu`);
					try {
						const { result: hasil } = await fetchApi('/primbon/cekkhodam');
						m.reply(`Khodam dari *${text}* adalah *${hasil.nama}*\n_${hasil.deskripsi}_`);
					} catch (e) {
						m.reply(pickRandom(['Dokter Indosiar', 'Sigit Rendang', 'Ustadz Sinetron', 'Bocil epep']));
					}
				}
				break;
			case 'rate':
			case 'nilai':
				{
					m.reply(`Rate Bot : *${Math.floor(Math.random() * 100)}%*`);
				}
				break;
			case 'jodohku':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					let member = (store.groupMetadata?.[m.chat]?.participants || m.metadata?.participants || []).map(a => a.phoneNumber);
					if (member.length === 0) return m.reply('Data member grup tidak tersedia! Harap coba lagi nanti.');
					let jodoh = pickRandom(member);
					m.reply(`👫Jodoh mu adalah\n@${m.sender.split('@')[0]} ❤ @${jodoh ? jodoh.split('@')[0] : '0'}`);
				}
				break;
			case 'jadian':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					let member = (store.groupMetadata?.[m.chat]?.participants || m.metadata?.participants || []).map(a => a.phoneNumber);
					if (member.length === 0) return m.reply('Data member grup tidak tersedia! Harap coba lagi nanti.');
					let jadian1 = pickRandom(member);
					let jadian2 = pickRandom(member);
					m.reply(`Ciee yang Jadian💖 Jangan lupa Donasi🗿\n@${jadian1.split('@')[0]} ❤ @${jadian2.split('@')[0]}`);
				}
				break;
			case 'fitnah':
				{
					let [teks1, teks2, teks3] = text.split`|`;
					if (!teks1 || !teks2 || !teks3) return m.reply(`Example : ${prefix + command} pesan target|pesan mu|nomer/tag target`);
					let ftelo = {
						key: {
							fromMe: false,
							participant: teks3.replace(/[^0-9]/g, '') + '@s.whatsapp.net',
							...(m.isGroup
								? { remoteJid: m.chat }
								: {
										remoteJid: teks3.replace(/[^0-9]/g, '') + '@s.whatsapp.net',
									}),
						},
						message: { conversation: teks1 },
					};
					xync.sendMessage(m.chat, { text: teks2 }, { quoted: ftelo });
				}
				break;
			case 'coba':
				{
					let anu = ['Aku Monyet', 'Aku Kera', 'Aku Tolol', 'Aku Kaya', 'Aku Dewa', 'Aku Anjing', 'Aku Dongo', 'Aku Raja', 'Aku Sultan', 'Aku Baik', 'Aku Hitam', 'Aku Suki'];
					await xync.sendButtonMsg(m.chat, {
						text: 'Semoga Hoki😹',
						buttons: [
							{
								buttonId: 'teshoki',
								buttonText: { displayText: '\n' + pickRandom(anu) },
								type: 1,
							},
							{
								buttonId: 'cobacoba',
								buttonText: { displayText: '\n' + pickRandom(anu) },
								type: 1,
							},
						],
					});
				}
				break;

			// Game Menu
			case 'akinator': case 'jin': {
				if (!isLimit) return m.reply(global.mess.limit);
				
				if (!global.akinatorSession) global.akinatorSession = {};
	
				const aki = await import('./lib/akinator.js');
				let sessionData = global.akinatorSession[m.sender];
				let aksi = args[0] ? args[0].toLowerCase() : 'start';
	
				const sendMenu = (teks) => {
					let txt = `*AKINATOR INDONESIA*\n\n`;
					txt += `${teks}\n\n`;
					txt += `*Cara Menjawab:*\n`;
					txt += `Ketik *${prefix + command}* diikuti angka jawaban:\n`;
					txt += `*0* - Ya\n*1* - Tidak\n*2* - Tidak Tahu\n*3* - Mungkin\n*4* - Mungkin Tidak\n\n`;
					txt += `*Opsi Lain:*\n`;
					txt += `*${prefix + command} back* - Kembali\n`;
					txt += `*${prefix + command} stop* - Berhenti Main`;
					m.reply(txt);
				};
	
				try {
					if (aksi === 'start') {
						if (sessionData) return m.reply(`Kamu masih punya game yang belum selesai! Balas dengan angka atau ketik *${prefix + command} stop* untuk mereset.`);
						
						const res = await aki.start();
						if (!res.status) throw new Error(res.error);
	
						global.akinatorSession[m.sender] = {
							session: res.session,
							signature: res.signature,
							step: res.step,
							progression: res.progression
						};
	
						sendMenu(`*Pertanyaan (${res.step + 1}):*\n${res.question}`);
						setLimit(m, db);
						return;
					}
	
					if (aksi === 'stop') {
						if (!sessionData) return m.reply('Kamu belum memulai game Akinator.');
						delete global.akinatorSession[m.sender];
						return m.reply('Game Akinator berhasil dihentikan!');
					}
	
					if (!sessionData) return m.reply(`Kamu belum memulai game! Ketik *${prefix + command} start* untuk mulai bermain.`);
	
					if (aksi === 'back') {
						if (sessionData.step === 0) return m.reply('Ini adalah pertanyaan pertama, tidak bisa kembali.');
						const res = await aki.back(sessionData.session, sessionData.signature, sessionData.step, sessionData.progression);
						if (!res.status) throw new Error(res.error);
	
						sessionData.step = res.step;
						sessionData.progression = res.progression;
						sendMenu(`*Pertanyaan (${res.step + 1}):*\n${res.question}`);
						return;
					}
	
					const answerId = parseInt(aksi);
					if (isNaN(answerId) || answerId < 0 || answerId > 4) {
						return m.reply(`Jawaban tidak valid! Masukkan angka 0-4 atau ketik *${prefix + command} stop*.`);
					}
	
					const res = await aki.answer(sessionData.session, sessionData.signature, sessionData.step, sessionData.progression, answerId);
					if (!res.status) {
						delete global.akinatorSession[m.sender];
						throw new Error(res.error);
					}
	
					if (res.won) {
						delete global.akinatorSession[m.sender];
						let winTxt = `*AKINATOR MENEBAK!*\n`;
						winTxt += `*Nama:* ${res.name}\n`;
						winTxt += `*Deskripsi:* ${res.description}\n`;
						if (res.photo) {
							await xync.sendMessage(m.chat, { image: { url: res.photo }, caption: winTxt }, { quoted: m });
						} else {
							await m.reply(winTxt);
						}
					} else {
						sessionData.step = res.step;
						sessionData.progression = res.progression;
						sendMenu(`*Pertanyaan (${res.step + 1}) - Progress: ${res.progression.toFixed(1)}%*\n${res.question}`);
					}
	
				} catch (e) {
					console.error('[AKINATOR ERROR]', e);
					m.reply(`Gagal memproses Akinator: ${e.message}`);
				}
			}
			break
			case 'slot':
				{
					await gameSlot(xync, m, db);
				}
				break;
			case 'casino':
				{
					await gameCasinoSolo(xync, m, prefix, db);
				}
				break;
			case 'samgong':
			case 'kartu':
				{
					await gameSamgongSolo(xync, m, db);
				}
				break;
			case 'rampok':
			case 'merampok':
				{
					await gameMerampok(m, db);
				}
				break;
			case 'begal':
				{
					await gameBegal(xync, m, db);
				}
				break;
			case 'suitpvp':
			case 'suit':
				{
					if (Object.values(suit).find(roof => roof.id.startsWith('suit') && [roof.p, roof.p2].includes(m.sender))) return m.reply(`Selesaikan suit mu yang sebelumnya`);
					if (m.mentionedJid[0] === m.sender) return m.reply(`Tidak bisa bermain dengan diri sendiri !`);
					if (!m.mentionedJid[0]) return m.reply(`_Siapa yang ingin kamu tantang?_\nTag orangnya..\n\nExample : ${prefix}suit @${ownerNumber[0]}`, m.chat, { mentions: [ownerNumber[0] + '@s.whatsapp.net'] });
					if (Object.values(suit).find(roof => roof.id.startsWith('suit') && [roof.p, roof.p2].includes(m.mentionedJid[0]))) return m.reply(`Orang yang kamu tantang sedang bermain suit bersama orang lain :(`);
					let caption = `_*SUIT PvP*_\n\n@${m.sender.split('@')[0]} menantang @${m.mentionedJid[0].split('@')[0]} untuk bermain suit\n\nSilahkan @${m.mentionedJid[0].split('@')[0]} untuk ketik terima/tolak`;
					let id = 'suit_' + Date.now();
					suit[id] = {
						chat: caption,
						id: id,
						p: m.sender,
						p2: m.mentionedJid[0],
						status: 'wait',
						poin: 10,
						poin_lose: 10,
						timeout: 3 * 60 * 1000,
					};
					m.reply(caption);
					await sleep(3 * 60 * 1000);
					if (suit[id]) {
						m.reply(`_Waktu suit habis_`);
						delete suit[id];
					}
				}
				break;
			case 'delsuit':
			case 'deletesuit':
				{
					let roomnya = Object.values(suit).find(roof => roof.id.startsWith('suit') && [roof.p, roof.p2].includes(m.sender));
					if (!roomnya) return m.reply(`Kamu sedang tidak berada di room suit !`);
					delete suit[roomnya.id];
					m.reply(`Berhasil delete session room suit !`);
				}
				break;
			case 'ttc':
				{
					if (Object.values(tictactoe).find(room => room.id.startsWith('tictactoe') && [room.game.playerX, room.game.playerO].includes(m.sender))) return m.reply(`Kamu masih didalam game!\nKetik *${prefix}del${command}* Jika Ingin Mengakhiri sesi`);
					let room = Object.values(tictactoe).find(room => room.state === 'WAITING' && (text ? room.name === text : true));
					if (room) {
						m.reply('Partner ditemukan!');
						room.o = m.chat;
						room.game.playerO = m.sender;
						room.state = 'PLAYING';
						if (!(room.game instanceof TicTacToe)) {
							room.game = Object.assign(new TicTacToe(room.game.playerX, room.game.playerO), room.game);
						}
						let arr = room.game.render().map(v => {
							return {
								X: '✖️',
								O: '⭕',
								1: '1️⃣',
								2: '2️⃣',
								3: '3️⃣',
								4: '4️⃣',
								5: '5️⃣',
								6: '6️⃣',
								7: '7️⃣',
								8: '8️⃣',
								9: '9️⃣',
							}[v];
						});
						let str = `Room ID: ${room.id}\n\n${arr.slice(0, 3).join('')}\n${arr.slice(3, 6).join('')}\n${arr.slice(6).join('')}\n\nMenunggu @${room.game.currentTurn.split('@')[0]}\n\nKetik *nyerah* untuk menyerah dan mengakui kekalahan`;
						if (room.x !== room.o) await xync.sendMessage(room.x, { text: str, mentions: parseMention(str) }, { quoted: m });
						await xync.sendMessage(room.o, { text: str, mentions: parseMention(str) }, { quoted: m });
					} else {
						room = {
							id: 'tictactoe-' + +new Date(),
							x: m.chat,
							o: '',
							game: new TicTacToe(m.sender, 'o'),
							state: 'WAITING',
						};
						if (text) room.name = text;
						xync.sendMessage(
							m.chat,
							{
								text: 'Menunggu partner' + (text ? ` mengetik command dibawah ini ${prefix}${command} ${text}` : ''),
								mentions: m.mentionedJid,
							},
							{ quoted: m },
						);
						tictactoe[room.id] = room;
						await sleep(300000);
						if (tictactoe[room.id]) {
							m.reply(`_Waktu ${command} habis_`);
							delete tictactoe[room.id];
						}
					}
				}
				break;
			case 'delttc':
				{
					let roomnya = Object.values(tictactoe).find(room => room.id.startsWith('tictactoe') && [room.game.playerX, room.game.playerO].includes(m.sender));
					if (!roomnya) return m.reply(`Kamu sedang tidak berada di room tictactoe !`);
					delete tictactoe[roomnya.id];
					m.reply(`Berhasil delete session room tictactoe !`);
				}
				break;
			case 'tebakbom':
				{
					if (tebakbom[m.sender]) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!');
					tebakbom[m.sender] = {
						petak: [0, 0, 0, 2, 0, 2, 0, 2, 0, 0].sort(() => Math.random() - 0.5),
						board: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'],
						bomb: 3,
						lolos: 7,
						pick: 0,
						nyawa: ['❤️', '❤️', '❤️'],
					};
					await m.reply(`*TEBAK BOM*\n\n${tebakbom[m.sender].board.join('')}\n\nPilih lah nomor tersebut! dan jangan sampai terkena Bom!\nBomb : ${tebakbom[m.sender].bomb}\nNyawa : ${tebakbom[m.sender].nyawa.join('')}`);
					await sleep(120000);
					if (tebakbom[m.sender]) {
						m.reply(`_Waktu ${command} habis_`);
						delete tebakbom[m.sender];
					}
				}
				break;
			case 'tekateki':
				{
					if (iGame(tekateki, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!');
					const { result: hasil } = await fetchApi('/games/tekateki');
					let { key } = await m.reply(`🎮 Teka Teki Berikut :\n\n${hasil.soal}\n\nWaktu : 60s\nHadiah *+3499*`);
					tekateki[m.chat + key.id] = {
						jawaban: hasil.jawaban.toLowerCase(),
						id: key.id,
					};
					await sleep(60000);
					if (rdGame(tekateki, m.chat, key.id)) {
						m.reply('Waktu Habis\nJawaban: ' + tekateki[m.chat + key.id].jawaban);
						delete tekateki[m.chat + key.id];
					}
				}
				break;
			case 'tebaklirik':
				{
					if (iGame(tebaklirik, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!');
					const { result: hasil } = await fetchApi('/games/tebaklirik');
					let { key } = await m.reply(`🎮 Tebak Lirik Berikut :\n\n${hasil.soal}\n\nWaktu : 90s\nHadiah *+4299*`);
					tebaklirik[m.chat + key.id] = {
						jawaban: hasil.jawaban.toLowerCase(),
						id: key.id,
					};
					await sleep(90000);
					if (rdGame(tebaklirik, m.chat, key.id)) {
						m.reply('Waktu Habis\nJawaban: ' + tebaklirik[m.chat + key.id].jawaban);
						delete tebaklirik[m.chat + key.id];
					}
				}
				break;
			case 'tebakkata':
				{
					if (iGame(tebakkata, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!');
					const { result: hasil } = await fetchApi('/games/tebakkata');
					let { key } = await m.reply(`🎮 Tebak Kata Berikut :\n\n${hasil.soal}\n\nWaktu : 60s\nHadiah *+3499*`);
					tebakkata[m.chat + key.id] = {
						jawaban: hasil.jawaban.toLowerCase(),
						id: key.id,
					};
					await sleep(60000);
					if (rdGame(tebakkata, m.chat, key.id)) {
						m.reply('Waktu Habis\nJawaban: ' + tebakkata[m.chat + key.id].jawaban);
						delete tebakkata[m.chat + key.id];
					}
				}
				break;
			case 'family100':
				{
					if (family100.hasOwnProperty(m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!');
					const { result: hasil } = await fetchApi('/games/family100');
					let { key } = await m.reply(`🎮 Tebak Kata Berikut :\n\n${hasil.soal}\n\nWaktu : 5m\nHadiah *+3499*`);
					family100[m.chat] = {
						soal: hasil.soal,
						jawaban: hasil.jawaban,
						terjawab: Array.from(hasil.jawaban, () => false),
						id: key.id,
					};
					await sleep(300000);
					if (family100.hasOwnProperty(m.chat)) {
						m.reply('Waktu Habis\nJawaban:\n- ' + family100[m.chat].jawaban.join('\n- '));
						delete family100[m.chat];
					}
				}
				break;
			case 'susunkata':
				{
					if (iGame(susunkata, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!');
					const { result: hasil } = await fetchApi('/games/susunkata');
					let { key } = await m.reply(`🎮 Susun Kata Berikut :\n\n${hasil.soal}\nTipe : ${hasil.tipe}\n\nWaktu : 60s\nHadiah *+2989*`);
					susunkata[m.chat + key.id] = {
						jawaban: hasil.jawaban.toLowerCase(),
						id: key.id,
					};
					await sleep(60000);
					if (rdGame(susunkata, m.chat, key.id)) {
						m.reply('Waktu Habis\nJawaban: ' + susunkata[m.chat + key.id].jawaban);
						delete susunkata[m.chat + key.id];
					}
				}
				break;
			case 'tebakkimia':
				{
					if (iGame(tebakkimia, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!');
					const { result: hasil } = await fetchApi('/games/tebakkimia');
					let { key } = await m.reply(`?? Tebak Kimia Berikut :\n\n${hasil.unsur}\n\nWaktu : 60s\nHadiah *+3499*`);
					tebakkimia[m.chat + key.id] = {
						jawaban: hasil.lambang.toLowerCase(),
						id: key.id,
					};
					await sleep(60000);
					if (rdGame(tebakkimia, m.chat, key.id)) {
						m.reply('Waktu Habis\nJawaban: ' + tebakkimia[m.chat + key.id].jawaban);
						delete tebakkimia[m.chat + key.id];
					}
				}
				break;
			case 'caklontong':
				{
					if (iGame(caklontong, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!');
					const { result: hasil } = await fetchApi('/games/caklontong');
					let { key } = await m.reply(`🎮 Jawab Pertanyaan Berikut :\n\n${hasil.soal}\n\nWaktu : 60s\nHadiah *+9999*`);
					caklontong[m.chat + key.id] = {
						...hasil,
						jawaban: hasil.jawaban.toLowerCase(),
						id: key.id,
					};
					await sleep(60000);
					if (rdGame(caklontong, m.chat, key.id)) {
						m.reply(`Waktu Habis\nJawaban: ${caklontong[m.chat + key.id].jawaban}\n"${caklontong[m.chat + key.id].deskripsi}"`);
						delete caklontong[m.chat + key.id];
					}
				}
				break;
			case 'tebaknegara':
				{
					if (iGame(tebaknegara, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!');
					const { result: hasil } = await fetchApi('/games/tebaknegara');
					let { key } = await m.reply(`?? Tebak Negara Dari Tempat Berikut :\n\n*Tempat : ${hasil.tempat}*\n\nWaktu : 60s\nHadiah *+3499*`);
					tebaknegara[m.chat + key.id] = {
						jawaban: hasil.negara.toLowerCase(),
						id: key.id,
					};
					await sleep(60000);
					if (rdGame(tebaknegara, m.chat, key.id)) {
						m.reply('Waktu Habis\nJawaban: ' + tebaknegara[m.chat + key.id].jawaban);
						delete tebaknegara[m.chat + key.id];
					}
				}
				break;
			case 'tebakgambar':
				{
					if (iGame(tebakgambar, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!');
					const { result: hasil } = await fetchApi('/games/tebakgambar');
					let { key } = await xync.sendFileUrl(m.chat, hasil.img, `🎮 Tebak Gambar Berikut :\n\n${hasil.deskripsi}\n\nWaktu : 60s\nHadiah *+3499*`, m);
					tebakgambar[m.chat + key.id] = {
						jawaban: hasil.jawaban.toLowerCase(),
						id: key.id,
					};
					await sleep(60000);
					if (rdGame(tebakgambar, m.chat, key.id)) {
						m.reply('Waktu Habis\nJawaban: ' + tebakgambar[m.chat + key.id].jawaban);
						delete tebakgambar[m.chat + key.id];
					}
				}
				break;
			case 'tebakbendera':
				{
					if (iGame(tebakbendera, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!');
					const { result: hasil } = await fetchApi('/games/tebakbendera');
					let { key } = await m.reply(`🎮 Tebak Bendera Berikut :\n\n*Bendera : ${hasil.bendera}*\n\nWaktu : 60s\nHadiah *+3499*`);
					tebakbendera[m.chat + key.id] = {
						jawaban: hasil.negara.toLowerCase(),
						id: key.id,
					};
					await sleep(60000);
					if (rdGame(tebakbendera, m.chat, key.id)) {
						m.reply('Waktu Habis\nJawaban: ' + tebakbendera[m.chat + key.id].jawaban);
						delete tebakbendera[m.chat + key.id];
					}
				}
				break;
			case 'tebakangka':
			case 'butawarna':
			case 'colorblind':
				{
					if (iGame(tebakangka, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!');
					const { result: hasil } = await fetchApi('/random/color-blind');
					let { key } = await m.reply({
						image: { url: hasil.color_blind[0] },
						caption: `Pilih Jawaban Yang Benar!\nLevel : ${hasil.lv}\nPilihan: ${[hasil.number, ...hasil.similar].sort(() => Math.random() - 0.5).join(', ')}`,
					});
					tebakangka[m.chat + key.id] = {
						jawaban: hasil.number,
						id: key.id,
					};
					await sleep(60000);
					if (rdGame(tebakangka, m.chat, key.id)) {
						m.reply('Waktu Habis\nJawaban: ' + tebakangka[m.chat + key.id].jawaban);
						delete tebakangka[m.chat + key.id];
					}
				}
				break;
			case 'kuismath':
			case 'math':
				{
					const { genMath, modes } = await import('./lib/math.js');
					const inputMode = ['noob', 'easy', 'medium', 'hard', 'extreme', 'impossible', 'impossible2'];
					if (iGame(kuismath, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!');
					if (!text) return m.reply(`Mode: ${Object.keys(modes).join(' | ')}\nExample penggunaan: ${prefix}math medium`);
					if (!inputMode.includes(text.toLowerCase())) return m.reply('Mode tidak ditemukan!');
					let result = await genMath(text.toLowerCase());
					let { key } = await m.reply(`*Berapa hasil dari: ${result.soal.toLowerCase()}*?\n\nWaktu : ${(result.waktu / 1000).toFixed(2)} detik`);
					kuismath[m.chat + key.id] = {
						jawaban: result.jawaban,
						mode: text.toLowerCase(),
						id: key.id,
					};
					await sleep(kuismath, result.waktu);
					if (rdGame(m.chat + key.id)) {
						m.reply('Waktu Habis\nJawaban: ' + kuismath[m.chat + key.id].jawaban);
						delete kuismath[m.chat + key.id];
					}
				}
				break;
			case 'ulartangga':
			case 'snakeladder':
			case 'ut':
				{
					if (!m.isGroup) return m.reply(global.mess.group);
					if (ulartangga[m.chat] && !(ulartangga[m.chat] instanceof SnakeLadder)) {
						ulartangga[m.chat] = Object.assign(new SnakeLadder(ulartangga[m.chat]), ulartangga[m.chat]);
					}
					switch (args[0]) {
						case 'create':
						case 'join':
							if (ulartangga[m.chat]) {
								if (Object.keys(ulartangga[m.chat].players).length > 8) return m.reply(`Jumlah Pemain Sudah Maksimal\nSilahkan Memulai Permainan\n${prefix + command} start`);
								if (ulartangga[m.chat].players.some(a => a.id == m.sender)) return m.reply('Kamu Sudah Bergabung!');
								ulartangga[m.chat].players.push({ id: m.sender, move: 0 });
								m.reply('Sukses Join Sesi Game');
							} else {
								ulartangga[m.chat] = new SnakeLadder({
									id: m.chat,
									host: m.sender,
								});
								ulartangga[m.chat].players.push({ id: m.sender, move: 0 });
								ulartangga[m.chat].time = Date.now();
								m.reply('Sukses Membuat Sesi Game');
							}
							break;
						case 'start':
							if (!ulartangga[m.chat]) return m.reply('Tidak Ada Sesi Yang Sedang Berlangsung!');
							if (ulartangga[m.chat].players.length < 2) return m.reply('Jumlah Pemain Kurang!\nMinimal 2 Pemain!');
							if (ulartangga[m.chat].start) return m.reply('Sesi Sudah dimulai Sejak Awal!');
							if (ulartangga[m.chat].host !== m.sender) return m.reply(`Hanya Pembuat Room @${ulartangga[m.chat].host.split('@')[0]} yang bisa Memulai Sessi!`);
							let { key } = await m.reply({
								image: { url: ulartangga[m.chat].map.url },
								caption: `🐍🪜GAME ULAR TANGGA\n\n${ulartangga[m.chat].players.map((p, i) => `- @${p.id.split('@')[0]} (Pion ${['Merah', 'Biru Muda', 'Kuning', 'Hijau', 'Ungu', 'Jingga', 'Biru Tua', 'Putih'][i]})`).join('\n')}\n\nGiliran: @${m.sender.split('@')[0]}\n\nReply Pesan Ini untuk lanjut bermain!\nExample: roll/kocok`,
								mentions: ulartangga[m.chat].players.map(p => p.id),
							});
							ulartangga[m.chat].id = key.id;
							ulartangga[m.chat].start = true;
							break;
						case 'leave':
							if (!ulartangga[m.chat]) return m.reply('Tidak Ada Sesi Yang Sedang Berlangsung!');
							if (!ulartangga[m.chat].players.some(a => a.id == m.sender)) return m.reply('Kamu Bukan Pemain!');
							const player = ulartangga[m.chat].players.findIndex(a => a.id == m.sender);
							if (ulartangga[m.chat].start) return m.reply('Game Sudah dimulai!\nTidak Bisa Keluar Sekarang');
							if (ulartangga[m.chat].players.length < 1 || ulartangga[m.chat].host === m.sender) {
								m.reply(ulartangga[m.chat].host === m.sender ? 'Host Meninggalkan Permainan\nPermainan dihentikan!' : 'Pemain Kurang Dari 1, Permainan dihentikan!');
								delete ulartangga[m.chat];
								break;
							}
							ulartangga[m.chat].players.splice(player, 1);
							m.reply('Sukses Meninggalkan Permainan');
							break;
						case 'end':
							if (!ulartangga[m.chat]) return m.reply('Tidak Ada Sesi Yang Sedang Berlangsung!');
							if (ulartangga[m.chat]?.host !== m.sender) return m.reply(`Hanya Pembuat Room @${ulartangga[m.chat].host.split('@')[0]} yang bisa Menghapus Sessi!`);
							delete ulartangga[m.chat];
							m.reply('Berhasil Menghapus Sesi Game');
							break;
						default:
							m.reply(`🐍🪜GAME ULARTANGGA\nCommand: ${prefix + command} <command>\n- create\n- join\n- start\n- leave\n- end`);
					}
				}
				break;
			case 'catur':
			case 'ct':
				{
					const { DEFAUT_POSITION } = await import('chess.js').then(m => m.Chess);
					if (!m.isGroup) return m.reply(global.mess.group);
					if (chess[m.chat] && !(chess[m.chat] instanceof Chess)) {
						chess[m.chat] = Object.assign(new Chess(chess[m.chat].fen), chess[m.chat]);
					}
					switch (args[0]) {
						case 'start':
							if (!chess[m.chat]) return m.reply('Tidak Ada Sesi Yang Sedang Berlangsung!');
							if (!chess[m.chat].acc) return m.reply('Pemain Tidak Lengkap!');
							if (chess[m.chat].player1 !== m.sender) return m.reply('Hanya Pemain Utama Yang bisa Memulai!');
							if (chess[m.chat].turn !== m.sender && !chess[m.chat].start) {
								const encodedFen = encodeURI(chess[m.chat]._fen);
								let boardUrls = [`https://www.chess.com/dynboard?fen=${encodedFen}&size=3&coordinates=inside`, `https://www.chess.com/dynboard?fen=${encodedFen}&board=graffiti&piece=graffiti&size=3&coordinates=inside`, `https://chessboardimage.com/${encodedFen}.png`, `https://backscattering.de/web-boardimage/board.png?fen=${encodedFen}`, `https://fen2image.chessvision.ai/${encodedFen}`];
								for (let url of boardUrls) {
									try {
										const { data } = await axios.get(url, {
											responseType: 'arraybuffer',
										});
										let { key } = await m.reply({
											image: data,
											caption: `♟️${command.toUpperCase()} GAME\n\nGiliran: @${m.sender.split('@')[0]}\n\nReply Pesan Ini untuk lanjut bermain!\nExample: from to -> b1 c3`,
											mentions: [m.sender],
										});
										chess[m.chat].start = true;
										chess[m.chat].turn = m.sender;
										chess[m.chat].id = key.id;
										return;
									} catch (e) {}
								}
								if (!chess[m.chat].key) {
									m.reply(`Gagal Memulai Permainan!\nGagal Mengirim Papan Permainan!`);
								}
							} else if ([chess[m.chat].player1, chess[m.chat].player2].includes(m.sender)) {
								const isPlayer2 = chess[m.chat].player2 === m.sender;
								const nextPlayer = isPlayer2 ? chess[m.chat].player1 : chess[m.chat].player2;
								const encodedFen = encodeURI(chess[m.chat]._fen);
								const boardUrls = [`https://www.chess.com/dynboard?fen=${encodedFen}&size=3&coordinates=inside${!isPlayer2 ? '&flip=true' : ''}`, `https://www.chess.com/dynboard?fen=${encodedFen}&board=graffiti&piece=graffiti&size=3&coordinates=inside${!isPlayer2 ? '&flip=true' : ''}`, `https://chessboardimage.com/${encodedFen}${!isPlayer2 ? '-flip' : ''}.png`, `https://backscattering.de/web-boardimage/board.png?fen=${encodedFen}&coordinates=true&size=765${!isPlayer2 ? '&orientation=black' : ''}`, `https://fen2image.chessvision.ai/${encodedFen}/${!isPlayer2 ? '?pov=black' : ''}`];
								for (let url of boardUrls) {
									try {
										chess[m.chat].turn = chess[m.chat].turn === m.sender ? m.sender : nextPlayer;
										const { data } = await axios.get(url, {
											responseType: 'arraybuffer',
										});
										let { key } = await m.reply({
											image: data,
											caption: `♟️CHESS GAME\n\nGiliran: @${chess[m.chat].turn.split('@')[0]}\n\nReply Pesan Ini untuk lanjut bermain!\nExample: from to -> b1 c3`,
											mentions: [chess[m.chat].turn],
										});
										chess[m.chat].id = key.id;
										break;
									} catch (e) {}
								}
							}
							break;
						case 'join':
							if (chess[m.chat]) {
								if (chess[m.chat].player1 !== m.sender) {
									if (chess[m.chat].acc) return m.reply(`Pemain Sudah Terisi\nSilahkan Coba Lagi Nanti`);
									let teks = chess[m.chat].player2 === m.sender ? 'TerimaKasih Sudah Mau Bergabung' : `Karena @${chess[m.chat].player2.split('@')[0]} Tidak Merespon\nAkan digantikan Oleh @${m.sender.split('@')[0]}`;
									chess[m.chat].player2 = m.sender;
									chess[m.chat].acc = true;
									m.reply(`${teks}\nSilahkan @${chess[m.chat].player1.split('@')[0]} Untuk Memulai Game (${prefix + command} start)`);
								} else m.reply(`Kamu Sudah Bergabung\nBiarkan Orang Lain Menjadi Lawanmu!`);
							} else m.reply('Tidak Ada Sesi Yang Sedang Berlangsung!');
							break;
						case 'end':
						case 'leave':
							if (chess[m.chat]) {
								if (![chess[m.chat].player1, chess[m.chat].player2].includes(m.sender)) return m.reply('Hanya Pemain yang Bisa Menghentikan Permainan!');
								delete chess[m.chat];
								m.reply('Sukses Menghapus Sesi Game');
							} else m.reply('Tidak Ada Sesi Yang Sedang Berlangsung!');
							break;
						case 'bot':
						case 'computer':
							if (chess[m.sender]) {
								delete chess[m.sender];
								return m.reply('Sukses Menghapus Sesi vs BOT');
							} else {
								const { DEFAUT_POSITION } = await import('chess.js').then(m => m.Chess);
								chess[m.sender] = new Chess(DEFAUT_POSITION);
								chess[m.sender]._fen = chess[m.sender].fen();
								chess[m.sender].turn = m.sender;
								chess[m.sender].botMode = true;
								chess[m.sender].time = Date.now();
								const encodedFen = encodeURI(chess[m.sender]._fen);
								const boardUrls = [`https://www.chess.com/dynboard?fen=${encodedFen}&size=3&coordinates=inside`, `https://www.chess.com/dynboard?fen=${encodedFen}&board=graffiti&piece=graffiti&size=3&coordinates=inside`, `https://chessboardimage.com/${encodedFen}.png`, `https://backscattering.de/web-boardimage/board.png?fen=${encodedFen}&coordinates=true&size=765`, `https://fen2image.chessvision.ai/${encodedFen}/`];
								for (let url of boardUrls) {
									try {
										const { data } = await axios.get(url, {
											responseType: 'arraybuffer',
										});
										let { key } = await m.reply({
											image: data,
											caption: `♟️CHESS GAME\n\nGiliran: @${chess[m.sender].turn.split('@')[0]}\n\nReply Pesan Ini untuk lanjut bermain!\nExample: from to -> b1 c3`,
											mentions: [chess[m.sender].turn],
										});
										chess[m.sender].id = key.id;
										break;
									} catch (e) {}
								}
							}
							break;
						default:
							if (/^@?\d+$/.test(args[0])) {
								const { DEFAUT_POSITION } = await import('chess.js').then(m => m.Chess);
								if (chess[m.chat]) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!');
								if (m.mentionedJid.length < 1) return m.reply('Tag Orang yang Mau diajak Bermain!');
								chess[m.chat] = new Chess(DEFAUT_POSITION);
								chess[m.chat]._fen = chess[m.chat].fen();
								chess[m.chat].player1 = m.sender;
								chess[m.chat].player2 = m.mentionedJid ? m.mentionedJid[0] : null;
								chess[m.chat].time = Date.now();
								chess[m.chat].turn = null;
								chess[m.chat].acc = false;
								m.reply(`♟️${command.toUpperCase()} GAME\n\n@${m.sender.split('@')[0]} Menantang @${m.mentionedJid[0].split('@')[0]}\nUntuk Bergabung ${prefix + command} join`);
							} else {
								m.reply(`♟️${command.toUpperCase()} GAME\n\nExample: ${prefix + command} @tag/number\n- start\n- leave\n- join\n- computer\n- end`);
							}
					}
				}
				break;

			case 'blackjack':
			case 'bj':
				{
					const normalizeCard = str =>
						String(str)
							.replace(/\uFE0F|\s/g, '')
							.trim()
							.toLowerCase();
					if (blackjack[m.chat] && !(blackjack[m.chat] instanceof Blackjack)) {
						blackjack[m.chat] = Object.assign(new Blackjack(blackjack[m.chat]), blackjack[m.chat]);
					}
					let session = null;
					for (const id in blackjack) {
						if (blackjack[id].players?.find(p => p.id === m.sender)) {
							session = blackjack[id];
							break;
						}
					}
					if (session && !(session instanceof Blackjack)) {
						session = Object.assign(new Blackjack(session), session);
						blackjack[session.id] = session;
					}
					const sendCardPrompt = async (playerId, headerText, sess) => {
						const p = sess.players.find(x => x.id === playerId);
						if (!p || !p.cards.length) return;
						const hasStart = Object.keys(sess.startCard).length > 0;
						const buttons = p.cards.map(c => ({
							name: 'quick_reply',
							buttonParamsJson: JSON.stringify({
								display_text: `${c.rank}${c.suit}`,
								id: `.${command} play ${c.rank}${c.suit}`,
							}),
						}));
						if (hasStart && !sess.hasMatching(playerId)) {
							buttons.push({
								name: 'quick_reply',
								buttonParamsJson: JSON.stringify({
									display_text: '🍺 Minum',
									id: `.${command} minum`,
								}),
							});
						}
						await xync.sendListMsg(
							playerId,
							{
								text: headerText,
								footer: `Kartumu (${p.cards.length}): ${p.cards.map(c => c.rank + c.suit).join(', ')}`,
								buttons,
							},
							{ quoted: m },
						);
					};

					const endGame = async sess => {
						const loser = sess.players[0];
						const winnerList = sess.winner.length ? sess.winner.map((w, i) => `${i + 1}. @${w.id.split('@')[0]}`).join('\n') : '-';
						await xync.sendText(sess.id, `🃏 *GAME BLACKJACK SELESAI!* 🃏\n\n` + `🏆 *Urutan Pemenang:*\n${winnerList}\n\n` + `💀 *Pecundang:* @${loser?.id.split('@')[0] ?? '?'}`, m);
						delete blackjack[sess.id];
					};

					const finalizeRound = async sess => {
						if (!sess.isRoundComplete()) return false;
						const resultMsg = sess.resolveRound();
						if (!resultMsg) return false;
						await xync.sendText(sess.id, resultMsg, m);
						for (let i = sess.players.length - 1; i >= 0; i--) {
							const p = sess.players[i];
							if (p.cards.length === 0) {
								sess.winner.push({ id: p.id });
								sess.players.splice(i, 1);
								const rank = sess.winner.length;
								await xync.sendText(sess.id, `🎉 @${p.id.split('@')[0]} mengeluarkan semua kartu! Posisi ke-${rank}! 🏆`, m);
							}
						}
						if (sess.players.length <= 1) {
							await endGame(sess);
							return true;
						}
						if (!sess.players.find(p => p.id === sess.leader)) {
							sess.leader = sess.players[0].id;
						}
						await sleep(500);
						await sendCardPrompt(sess.leader, `🃏 Giliranmu memulai ronde baru!\nMainkan kartu pertama:`, sess);
						return true;
					};

					switch (args[0]) {
						case 'create':
						case 'join':
							{
								if (!m.isGroup) return m.reply(mess.group);
								if (blackjack[m.chat]?.players?.some(a => a.id === m.sender)) return m.reply('✖️ Kamu sudah bergabung di sesi ini!');
								if (session) return m.reply('✖️ Kamu sudah ada di sesi grup lain! Keluar dulu sebelum join di sini.');
								if (blackjack[m.chat]) {
									if (blackjack[m.chat].started) return m.reply('✖️ Game sudah berjalan! Tunggu sesi berikutnya.');
									if (blackjack[m.chat].players.length >= 10) return m.reply(`✖️ Pemain sudah penuh (maks 10).\nMulai dengan: ${prefix + command} start`);
									blackjack[m.chat].players.push({ id: m.sender, cards: [] });
									m.reply(`✔️ *Berhasil join Game Blackjack!*\n` + `👥 Total pemain: ${blackjack[m.chat].players.length}\n` + `Tunggu host memulai: ${prefix + command} start`);
								} else {
									blackjack[m.chat] = new Blackjack({
										id: m.chat,
										host: m.sender,
									});
									blackjack[m.chat].players.push({ id: m.sender, cards: [] });
									m.reply(`✔️ *Room Blackjack berhasil dibuat!*\n` + `Ajak teman: ${prefix + command} join\n` + `Mulai game: ${prefix + command} start`);
								}
							}
							break;

						case 'start':
							{
								if (!m.isGroup) return m.reply(mess.group);
								if (!blackjack[m.chat]) return m.reply(`✖️ Belum ada sesi. Buat dulu: ${prefix + command} create`);
								if (blackjack[m.chat].host !== m.sender) return m.reply(`✖️ Hanya host @${blackjack[m.chat].host.split('@')[0]} yang bisa memulai!`);
								if (blackjack[m.chat].players.length < 2) return m.reply('✖️ Minimal 2 pemain!');
								if (blackjack[m.chat].started) return m.reply('✖️ Game sudah dimulai!');
								blackjack[m.chat].distributeCards();
								const sess = blackjack[m.chat];
								await m.reply(`🃏 *GAME BLACKJACK DIMULAI!* ♦️\n\n` + `📌 Start Card: ${sess.startCard.rank}${sess.startCard.suit}\n` + `📦 Sisa Deck: ${sess.deck.length} kartu\n` + `🎯 Leader: @${sess.leader.split('@')[0]}\n\n` + `👥 *Pemain:*\n` + sess.players.map(p => `• @${p.id.split('@')[0]} (${p.cards.length} kartu)`).join('\n') + `\n\nCek private chat untuk kartumu! ??\n` + `wa.me/${botNumber.split('@')[0]}`);

								for (const p of sess.players) {
									await sleep(400);
									const isLeader = p.id === sess.leader;
									await sendCardPrompt(p.id, isLeader ? `🃏 Game dimulai! Kamu adalah 🎯 Leader ronde pertama.\nStart Card: ${sess.startCard.rank}${sess.startCard.suit}\nMainkan kartu suit ${sess.startCard.suit} untuk memulai!` : `🃏 Game dimulai!\nStart Card: ${sess.startCard.rank}${sess.startCard.suit}\nMainkan kartu suit ${sess.startCard.suit} atau tekan Minum jika tidak ada.`, sess);
								}
							}
							break;

						case 'minum':
						case 'hit':
							{
								if (!session) return m.reply('✖️ Tidak ada sesi aktif!');
								if (!session.started) return m.reply('✖️ Game belum dimulai!');
								if (!session.players.some(a => a.id === m.sender)) return m.reply('✖️ Kamu belum bergabung!');
								if (!Object.keys(session.startCard).length) return m.reply('♻️ Belum ada Start Card! Tunggu leader memulai ronde.');
								if (session.submitCard.some(s => s.id === m.sender) || session.skip.includes(m.sender)) return m.reply('✖️ Kamu sudah bermain di ronde ini!');
								if (session.hasMatching(m.sender)) {
									return m.reply(`✖️ Kamu masih punya kartu suit *${session.startCard.suit}*!\n` + `Mainkan dulu sebelum minum.`);
								}
								const player = session.players.find(p => p.id === m.sender);
								if (session.deck.length > 0) {
									const newCard = session.deck.shift();
									player.cards.push(newCard);
									await xync.sendText(session.id, `@${m.sender.split('@')[0]} minum 🍺 dan mengambil kartu dari deck! (sisa deck: ${session.deck.length})`, m);
								} else if (session.submitCard.length > 0) {
									const reuse = session.reuseSubmitCardsForDrinking();
									await xync.sendText(session.id, `⚠️ Deck habis! ${reuse.msg}`, m);
								} else {
									await xync.sendText(session.id, `⚠️ @${m.sender.split('@')[0]} minum tapi deck kosong — dilewati ronde ini.`, m);
								}
								if (!session.skip.includes(m.sender)) session.skip.push(m.sender);
								await sleep(400);
								await sendCardPrompt(m.sender, `🃏 Kartumu setelah minum:\nStart Card: ${session.startCard.rank}${session.startCard.suit}`, session);
								await finalizeRound(session);
							}
							break;

						case 'play':
							{
								if (!session) return m.reply('✖️ Tidak ada sesi aktif!');
								if (!session.started) return m.reply('✖️ Game belum dimulai!');
								if (!session.players.some(a => a.id === m.sender)) return m.reply('✖️ Kamu belum bergabung!');
								if (!args[1]) return m.reply(`✖️ Format: ${prefix + command} play <kartu>\nContoh: ${prefix + command} play 3♥️`);
								if (session.submitCard.some(s => s.id === m.sender) || session.skip.includes(m.sender)) return m.reply('✖️ Kamu sudah bermain di ronde ini!');
								const player = session.players.find(p => p.id === m.sender);
								const idx = player.cards.findIndex(c => normalizeCard(c.rank + c.suit) === normalizeCard(args[1]));
								if (idx === -1) return m.reply('✖️ Kartu tidak valid atau tidak ada di tanganmu!');
								const card = player.cards[idx];
								const hasStartCard = Object.keys(session.startCard).length > 0;
								if (hasStartCard) {
									if (card.suit !== session.startCard.suit) {
										if (session.hasMatching(m.sender)) {
											return m.reply(`✖️ Harus memainkan kartu suit *${session.startCard.suit}*!`);
										}
										return m.reply(`✖️ Kartu tidak sesuai suit *${session.startCard.suit}*!\n` + `Karena tidak punya kartu cocok, gunakan: ${prefix + command} minum`);
									}
								} else {
									if (m.sender !== session.leader) {
										return m.reply(`♻️ Tunggu dulu! Hanya 🎯 @${session.leader.split('@')[0]} (leader) yang bisa memulai ronde baru.`);
									}
								}
								player.cards.splice(idx, 1);
								session.secondDeck.push(card);
								session.submitCard.push({ id: m.sender, card });
								await m.reply(`✔️ Kamu memainkan *${card.rank}${card.suit}*`);
								if (!hasStartCard) {
									session.startCard = card;
									await xync.sendText(session.id, `🎯 @${m.sender.split('@')[0]} memulai ronde dengan *${card.rank}${card.suit}*\n` + `Semua pemain harus memainkan kartu suit *${card.suit}*!`, m);
									for (const s of session.players) {
										if (s.id === session.leader) continue;
										await sleep(300);
										await sendCardPrompt(s.id, `🃏 Ronde baru dimulai!\nStart Card: *${card.rank}${card.suit}*\nMainkan kartu suit ${card.suit} atau tekan Minum.`, session);
									}
									await finalizeRound(session);
									return;
								}
								await xync.sendText(session.id, `@${m.sender.split('@')[0]} memainkan *${card.rank}${card.suit}* (sisa: ${player.cards.length} kartu)`, m);
								await finalizeRound(session);
							}
							break;

						case 'info':
							{
								const infoSess = session || blackjack[m.chat];
								if (!infoSess) return m.reply('✖️ Tidak ada sesi aktif!');
								if (!infoSess.players.some(a => a.id === m.sender)) return m.reply('✖️ Kamu belum bergabung!');
								const hasStart = Object.keys(infoSess.startCard).length > 0;
								const startStr = hasStart ? `${infoSess.startCard.rank}${infoSess.startCard.suit}` : '-';
								const playerList = infoSess.players
									.map((p, i) => {
										let tag = '';
										if (p.id === infoSess.host) tag += ' 👑HOST';
										if (p.id === infoSess.leader) tag += ' 🎯Leader';
										return `${i + 1}. @${p.id.split('@')[0]}${tag} — ${p.cards.length} kartu`;
									})
									.join('\n');

								let msg = `🃏 *INFO GAME BLACKJACK* ♦️\n` + `┏━━━━━━━━━━━━━━━━━━\n` + `👥 Pemain : ${infoSess.players.length}\n` + `👑 Host : @${infoSess.host.split('@')[0]}\n` + `🎯 Leader : ${infoSess.leader ? '@' + infoSess.leader.split('@')[0] : '-'}\n` + `📊 Status : ${infoSess.started ? '🟢 Berjalan' : '🔴 Belum Mulai'}\n` + `🃏 Start Card: ${startStr}\n` + `📦 Sisa Deck: ${infoSess.deck.length} kartu\n` + `┗━━━━━━━━━━━━━━━━━━\n` + `*Daftar Pemain:*\n${playerList}`;

								if (!m.isGroup) {
									const myCards =
										infoSess.players
											.find(p => p.id === m.sender)
											?.cards?.map(c => c.rank + c.suit)
											.join(', ') || '-';
									msg += `\n┏━━━━━━━━━━━━━━━━━━\n*Kartu kamu:*\n${myCards}`;
								}
								if (infoSess.winner.length) {
									msg += `\n┏━━━━━━━━━━━━━━━━━━\n` + `*🏆 Sudah Menang:*\n` + infoSess.winner.map((w, i) => `${i + 1}. @${w.id.split('@')[0]}`).join('\n');
								}
								m.reply(msg);
							}
							break;

						case 'deck':
							{
								const deckSess = session || blackjack[m.chat];
								if (!deckSess) return m.reply('✖️ Tidak ada sesi aktif!');
								if (!deckSess.players.some(a => a.id === m.sender)) return m.reply('✖️ Kamu belum bergabung!');
								const submittedNow = deckSess.submitCard.length ? deckSess.submitCard.map(s => `@${s.id.split('@')[0]}: ${s.card.rank}${s.card.suit}`).join(', ') : '-';
								const skipNow = deckSess.skip.length ? deckSess.skip.map(s => `@${s.split('@')[0]}`).join(', ') : '-';
								const lastCards =
									deckSess.secondDeck
										.slice(-10)
										.map(c => c.rank + c.suit)
										.join(', ') || '-';
								m.reply(`🃏 *INFO DECK* ♦️\n` + `┏━━━━━━━━━━━━━━━━━━\n` + `📦 Sisa Deck : ${deckSess.deck.length} kartu\n` + `🔄 Kartu Terpakai: ${deckSess.secondDeck.length} kartu\n` + `┗━━━━━━━━━━━━━━━━━━\n` + `*Ronde Ini:*\n` + `▶️ Submit : ${submittedNow}\n` + `⏩ Skip : ${skipNow}\n` + `┏━━━━━━━━━━━━━━━━━━\n` + `*10 Kartu Terakhir:*\n${lastCards}`);
							}
							break;

						case 'end':
							{
								if (!m.isGroup) return m.reply(mess.group);
								if (!blackjack[m.chat]) return m.reply('✖️ Tidak ada sesi aktif!');
								if (blackjack[m.chat].host !== m.sender) return m.reply(`✖️ Hanya host @${blackjack[m.chat].host.split('@')[0]} yang bisa menghapus sesi!`);
								delete blackjack[m.chat];
								m.reply('🗑️ Sesi Game Blackjack telah dihapus.');
							}
							break;

						default: {
							m.reply(`🃏 *GAME BLACKJACK* ♦️\n\n` + `*Cara Main:*\n` + `Mainkan kartu dengan suit yang sama dengan Start Card.\n` + `Tidak punya? Tekan Minum 🍺 — ambil kartu penalti & skip ronde.\n` + `Pemain pertama yang habis kartunya menang!\n\n` + `*Commands:*\n` + `• \`${prefix + command} create\` — Buat room baru\n` + `• \`${prefix + command} join\` — Gabung room\n` + `• \`${prefix + command} start\` — Mulai game (host)\n` + `• \`${prefix + command} play\` _kartu_ — Main kartu (cth: play 3♥️)\n` + `• \`${prefix + command} minum\` — Minum & skip ronde\n` + `• \`${prefix + command} info\` — Info game & pemain\n` + `• \`${prefix + command} deck\` — Info deck & ronde ini\n` + `• \`${prefix + command} end\` — Hapus sesi (host)\n\n` + `*Suit:* ♥️ ♦️ ♣️ ♠️`);
						}
					}
				}
				break;

			// Menu
			case 'menu':
				{
					const totalPlugin = cases.length;
					const statusUser = isCreator ? 'Owner' : isVip ? 'VIP' : isPremium ? 'Premium' : 'Free';
					const prefixInfo = set.multiprefix ? 'Multi-Prefix' : `[${prefix}]`;

					try {
						const { A2UI, sendA2UIWidget } = await import('./lib/a2ui.js?t=' + Date.now());
						const ui = new A2UI();

						const currentHour = moment.tz(global.timezone).hours();
						let linkFoto = '';

						if (currentHour >= 5 && currentHour < 17) {
							linkFoto = 'https://cdn.zass.in/Z5vmQSlVTW.jpeg';
						} else {
							linkFoto = 'https://cdn.zass.in/bPZZHAy2uM.jpeg';
						}

						ui.image(linkFoto, {
							id: 'header_image',
							variant: 'header',
							fit: 'cover',
						});

						ui.text(`Hello ${m.pushName || 'Tanpa Nama'}`, {
							id: 'header_title',
							variant: 'h1',
						});

						ui.text('\u25a9 Dashboard', {
							id: 'user_card_header',
							variant: 'h2',
						});
						ui.text(`\u2022 Status: ${statusUser}\n\u2022 Limit : ${isVip ? 'VIP' : db.users[m.sender].limit}\n\u2022 Developer: Renn\n\u2022 Prefix: ${prefixInfo}`, { id: 'user_card_body', variant: 'body' });
						ui.column(['user_card_header', 'user_card_body'], {
							id: 'user_card_column',
						});
						ui.card('user_card_column', { id: 'user_card' });

						ui._components.set('divider_1', {
							id: 'divider_1',
							component: 'Divider',
						});

						ui.text('\u25a9 Statistik & Server', {
							id: 'server_card_header',
							variant: 'h2',
						});
						ui.text(`\u2022 Server: Online\n\u2022 Total Plugin: ${totalPlugin}\n\u2022 Runtime: ${runtime(process.uptime())}`, { id: 'server_card_body', variant: 'body' });
						ui.column(['server_card_header', 'server_card_body'], {
							id: 'server_card_column',
						});
						ui.card('server_card_column', { id: 'server_card' });

						ui._components.set('divider_2', {
							id: 'divider_2',
							component: 'Divider',
						});

						ui.text('\u25a9 About', { id: 'about_card_header', variant: 'h2' });
						ui.text(`\u2022 Date: ${date}\n\u2022 Day: ${locale_day}\n\u2022 Time: ${date_time}`, { id: 'about_card_body', variant: 'body' });
						ui.column(['about_card_header', 'about_card_body'], {
							id: 'about_card_column',
						});
						ui.card('about_card_column', { id: 'about_card' });

						ui._components.set('divider_3', {
							id: 'divider_3',
							component: 'Divider',
						});

						ui._components.set('audio_player', {
							id: 'audio_player',
							component: 'AudioPlayer',
							url: 'https://files.catbox.moe/k381r7.mp3',
							description: '\u2022 Klik tombol dibawah untuk membuka list menu',
						});

						ui.text('Butuh Bantuan?', {
							id: 'contact_card_header',
							variant: 'h2',
						});
						ui.text('Tekan tombol di bawah untuk menghubungi owner langsung.', {
							id: 'contact_card_body',
							variant: 'body',
						});
						ui.text('Chat Owner', {
							id: 'modal_trigger_text',
							variant: 'caption',
						});

						ui.button('modal_trigger_text', {
							id: 'modal_trigger',
							variant: 'borderless',
							action: {
								call: 'openUrl',
								args: { url: 'https://wa.me/${global.owner[0]}' },
							},
						});

						ui.column(['contact_card_header', 'contact_card_body', 'modal_trigger'], { id: 'contact_section' });

						ui.root(['header_image', 'header_title', 'user_card', 'divider_1', 'server_card', 'divider_2', 'about_card', 'divider_3', 'audio_player', 'contact_section']);

						const conbol = [
							{
								name: 'single_select',
								params: {
									title: 'List Menu',
									icon: 'DEFAULT',
									sections: [
										{
											title: '',
											rows: [{ title: 'Semua Menu', id: `${prefix}allmenu` }],
										},
										{
											title: 'Pilih salah untuk membuka menu',
											rows: [
												{ title: 'Bot Menu', id: `${prefix}botmenu` },
												{ title: 'Premium', id: `${prefix}premium` },
												{ title: 'Sticker Menu', id: `${prefix}stickermenu` },
												{ title: 'Group Menu', id: `${prefix}groupmenu` },
												{ title: 'Owner Menu', id: `${prefix}ownermenu` },
												{ title: 'Search Menu', id: `${prefix}searchmenu` },
												{ title: 'Download Menu', id: `${prefix}downloadmenu` },
												{ title: 'Tools Menu', id: `${prefix}toolsmenu` },
												{ title: 'AI Menu', id: `${prefix}aimenu` },
												{ title: 'Game Menu', id: `${prefix}gamemenu` },
												{ title: 'Fun Menu', id: `${prefix}funmenu` },
												{ title: 'Anime Menu', id: `${prefix}animemenu` },
												{ title: 'Stalker Menu', id: `${prefix}stalkermenu` },
												{ title: 'Random Menu', id: `${prefix}randommenu` },
												{ title: 'Quotes Menu', id: `${prefix}quotesmenu` },
											],
										},
									],
								},
							},
						];

						await sendA2UIWidget(xync, m.chat, {
							a2ui: ui,
							buttons: conbol,
							contextInfo: { expiration: 7776000, mentionedJid: [m.sender] },
							quoted: m,
							singleScreen: false,
						});
					} catch (error) {
						console.error('\n[ERROR BLOCKS MENU] :', error);
						m.reply(`Eror: ${error.message}`);
					}
				}
				break;
			case 'menu3':
				{
					const totalPlugin = cases.length;
					const statusUser = isCreator ? 'Owner' : isVip ? 'VIP' : isPremium ? 'Premium' : 'Free';
					const prefixInfo = set.multiprefix ? 'Multi-Prefix' : `[${prefix}]`;

					const markdownText = `Hello *${m.pushName || 'Tanpa Nama'}* 👋\n\n▩ *Dashboard*\n> Status : *${statusUser}*\n> Developer : *${author}*\n> Total Plugin : *${totalPlugin}*\n> Prefix : *${prefixInfo}*\n> Runtime : *${runtime(process.uptime())}*`;

					const daftarMenu1 = ['Botmenu', 'Premium', 'Groupmenu', 'Ownermenu', 'Searchmenu', 'Downloadmenu', 'Toolsmenu'];
					const daftarMenu2 = ['AImenu', 'Gamemenu', 'Funmenu', 'Animemenu', 'Stalkermenu', 'Randommenu', 'Quotesmenu', 'Stickermenu'];

					try {
						const menuMsg = new AIRich(xync);

						menuMsg.addText(markdownText, { id: 'dashboard' });

						await menuMsg.send(m.chat, { quoted: m });
						await sleep(1000);

						menuMsg.addWidget(
							[
								{
									title: '▩ 𝗠𝗲𝗻𝘂 𝗰𝗮𝘁𝗲𝗴𝗼𝗿𝘆\nKlik untuk membuka list menu!',
									actions: daftarMenu1.map((menu, index) => ({
										label: menu,
										id: String(index).padStart(2, '0'),
									})),
								},
								{
									title: '‭',
									actions: daftarMenu2.map((menu, index) => ({
										label: menu,
										id: String(index + 7).padStart(2, '0'),
									})),
								},
							],
							{ layout: 'HScroll', insertAt: 'dashboard', id: 'kategori_menu' },
						);

						await menuMsg.sendEdit();
						await sleep(500);

						menuMsg.addWidget(
							{
								title: 'Klik untuk melihat semua perintah',
								actions: [
									{
										label: 'Allmenu',
										id: `${prefix}allmenu`,
									},
								],
							},
							{ layout: 'Single', insertAt: 'kategori_menu', id: 'tombol_all' },
						);

						await menuMsg.sendEdit();
					} catch (error) {
						console.error('\n[ERROR GENUI] :', error);
						m.reply(`Gagal merender UI: ${error.message}`);
					}
				}
				break;
			case 'menu2':
				{
					const totalPlugin = cases.length;
					const statusUser = isCreator ? 'Owner' : isVip ? 'VIP' : isPremium ? 'Premium' : 'Free';
					const prefixInfo = set.multiprefix ? 'Multi-Prefix' : `[${prefix}]`;
					const menunya = `Hello *${m.pushName || 'Tanpa Nama'}* 👋

▩ *Dashboard*
> Status : *${statusUser}*
> Developer : *${author}*
> Total Plugin : *${totalPlugin}*
> Prefix : *${prefixInfo}*
> Runtime : *${runtime(process.uptime())}*

▩ *Menu Category*
> ${prefix}botmenu
> ${prefix}premium
> ${prefix}stickermenu
> ${prefix}groupmenu
> ${prefix}ownermenu
> ${prefix}searchmenu
> ${prefix}downloadmenu
> ${prefix}toolsmenu
> ${prefix}aimenu
> ${prefix}gamemenu
> ${prefix}funmenu
> ${prefix}animemenu
> ${prefix}stalkermenu
> ${prefix}randommenu
> ${prefix}quotesmenu

_Silakan klik tombol di bawah untuk melihat semua menu!_`;

					let btnInteractive = [
						{
							name: 'quick_reply',
							buttonParamsJson: JSON.stringify({
								display_text: 'Allmenu',
								id: `${prefix}allmenu`,
							}),
						},
					];

					await xync.sendListMsg(
						m.chat,
						{
							text: menunya,
							footer: `© Renn.dev`,
							buttons: btnInteractive,
						},
						{ quoted: m },
					);
				}
				break;
			case 'allmenu':
				{
					const totalPlugin = cases.length;
					const statusUser = isCreator ? 'Owner' : isVip ? 'VIP' : isPremium ? 'Premium' : 'Free';
					const prefixInfo = set.multiprefix ? 'Multi-Prefix' : `[${prefix}]`;

					try {
						const { A2UI, sendA2UIWidget } = await import('./lib/a2ui.js?t=' + Date.now());
						const ui = new A2UI();

						const currentHour = moment.tz(global.timezone).hours();
						let linkFoto = '';

						if (currentHour >= 5 && currentHour < 17) {
							linkFoto = 'https://cdn.zass.in/Z5vmQSlVTW.jpeg';
						} else {
							linkFoto = 'https://cdn.zass.in/bPZZHAy2uM.jpeg';
						}

						ui.image(linkFoto, {
							id: 'header_image',
							variant: 'header',
							fit: 'cover',
						});
						ui.text(`Hello ${m.pushName || 'Tanpa Nama'}`, {
							id: 'header_title',
							variant: 'h1',
						});

						ui.text('▩ Dashboard', { id: 'user_card_header', variant: 'h2' });
						ui.text(`• Status: ${statusUser}\n• Limit : ${isVip ? 'VIP' : db.users[m.sender].limit}\n• Developer: Renn\n• Prefix: ${prefixInfo}`, { id: 'user_card_body', variant: 'body' });
						ui.column(['user_card_header', 'user_card_body'], {
							id: 'user_card_column',
						});
						ui.card('user_card_column', { id: 'user_card' });

						ui._components.set('divider_1', {
							id: 'divider_1',
							component: 'Divider',
						});

						ui.text('▩ Statistik & Server', {
							id: 'server_card_header',
							variant: 'h2',
						});
						ui.text(`• Server: Online\n• Total Plugin: ${totalPlugin}\n• Runtime: ${runtime(process.uptime())}`, { id: 'server_card_body', variant: 'body' });
						ui.column(['server_card_header', 'server_card_body'], {
							id: 'server_card_column',
						});
						ui.card('server_card_column', { id: 'server_card' });

						ui._components.set('divider_2', {
							id: 'divider_2',
							component: 'Divider',
						});

						ui.text('▩ About', { id: 'about_card_header', variant: 'h2' });
						ui.text(`• Date: ${date}\n• Day: ${locale_day}\n• Time: ${date_time}`, { id: 'about_card_body', variant: 'body' });
						ui.column(['about_card_header', 'about_card_body'], {
							id: 'about_card_column',
						});
						ui.card('about_card_column', { id: 'about_card' });

						ui._components.set('divider_3', {
							id: 'divider_3',
							component: 'Divider',
						});

						const rootIds = ['header_image', 'header_title', 'user_card', 'divider_1', 'server_card', 'divider_2', 'about_card', 'divider_3'];

						// ▩ Bot
						ui.text('▩ Bot', { id: 'bot_header', variant: 'h3' });
						ui.text(`• ${prefix}profile\n• ${prefix}claim\n• ${prefix}buy [item] (nominal)\n• ${prefix}transfer\n• ${prefix}leaderboard\n• ${prefix}request (text)\n• ${prefix}react (emoji)\n• ${prefix}tagme\n• ${prefix}runtime\n• ${prefix}totalfitur\n• ${prefix}speed\n• ${prefix}ping\n• ${prefix}afk\n• ${prefix}rvo (reply pesan viewone)\n• ${prefix}inspect (url gc)\n• ${prefix}addmsg\n• ${prefix}delmsg\n• ${prefix}getmsg\n• ${prefix}listmsg\n• ${prefix}setcmd\n• ${prefix}delcmd\n• ${prefix}listcmd\n• ${prefix}lockcmd\n• ${prefix}q (reply pesan)\n• ${prefix}menfes (62xxx|fake name)\n• ${prefix}confes (62xxx|fake name)\n• ${prefix}roomai\n• ${prefix}jadibot 🄿\n• ${prefix}stopjadibot\n• ${prefix}listjadibot\n• ${prefix}donasi\n• ${prefix}addsewa\n• ${prefix}delsewa\n• ${prefix}listsewa`, { id: 'bot_body', variant: 'body' });
						ui.column(['bot_header', 'bot_body'], { id: 'bot_column' });
						ui.card('bot_column', { id: 'bot_card' });

						// ▩ Premium
						ui.text('▩ Premium', { id: 'premium_header', variant: 'h3' });
						ui.text(`• ${prefix}ampremium 🄿\n• ${prefix}amprem2 🄿\n• ${prefix}amgen 🄿\n• ${prefix}ambulk 🄿\n• ${prefix}netflix 🄿`, { id: 'premium_body', variant: 'body' });
						ui.column(['premium_header', 'premium_body'], {
							id: 'premium_column',
						});
						ui.card('premium_column', { id: 'premium_card' });

						// ▩ Sticker
						ui.text('▩ Sticker', { id: 'sticker_header', variant: 'h3' });
						ui.text(`• ${prefix}sticker (send/reply img)\n• ${prefix}toimage (reply pesan)\n• ${prefix}brat (textnya)\n• ${prefix}bratvid (textnya)\n• ${prefix}colong (reply stiker)\n• ${prefix}smeme (send/reply img)\n• ${prefix}spk (reply img)`, { id: 'sticker_body', variant: 'body' });
						ui.column(['sticker_header', 'sticker_body'], {
							id: 'sticker_column',
						});
						ui.card('sticker_column', { id: 'sticker_card' });

						// ▩ Group
						ui.text('▩ Group', { id: 'group_header', variant: 'h3' });
						ui.text(`• ${prefix}add (62xxx)\n• ${prefix}kick (@tag/62xxx)\n• ${prefix}promote (@tag/62xxx)\n• ${prefix}demote (@tag/62xxx)\n• ${prefix}warn (@tag/62xxx)\n• ${prefix}unwarn (@tag/62xxx)\n• ${prefix}setname (nama baru gc)\n• ${prefix}setdesc (desk)\n• ${prefix}setppgc (reply imgnya)\n• ${prefix}delete (reply pesan)\n• ${prefix}linkgrup\n• ${prefix}totalpesan\n• ${prefix}swgc\n• ${prefix}revoke\n• ${prefix}tagall\n• ${prefix}pin\n• ${prefix}unpin\n• ${prefix}hidetag\n• ${prefix}totag (reply pesan)\n• ${prefix}listonline\n• ${prefix}group set\n• ${prefix}group (khusus admin)`, { id: 'group_body', variant: 'body' });
						ui.column(['group_header', 'group_body'], { id: 'group_column' });
						ui.card('group_column', { id: 'group_card' });

						// ▩ Search
						ui.text('▩ Search', { id: 'search_header', variant: 'h3' });
						ui.text(`• ${prefix}ytsearch (query)\n• ${prefix}spotify (query)\n• ${prefix}play (judul lagu)\n• ${prefix}pixiv (query)\n• ${prefix}pinterest (query)\n• ${prefix}wallpaper (query)\n• ${prefix}ringtone (query)\n• ${prefix}google (query)\n• ${prefix}gimage (query)\n• ${prefix}npm (query)\n• ${prefix}style (query)\n• ${prefix}cuaca (kota)\n• ${prefix}tenor (query)\n• ${prefix}urban (query)`, { id: 'search_body', variant: 'body' });
						ui.column(['search_header', 'search_body'], {
							id: 'search_column',
						});
						ui.card('search_column', { id: 'search_card' });

						// ▩ Download
						ui.text('▩ Download', { id: 'download_header', variant: 'h3' });
						ui.text(`• ${prefix}aio (url)\n• ${prefix}ytmp3 (url)\n• ${prefix}ytmp4 (url)\n• ${prefix}instagram (url)\n• ${prefix}tiktok (url)\n• ${prefix}tiktokmp3 (url)\n• ${prefix}facebook (url)\n• ${prefix}spotifydl (url)\n• ${prefix}mediafire (url)`, { id: 'download_body', variant: 'body' });
						ui.column(['download_header', 'download_body'], {
							id: 'download_column',
						});
						ui.card('download_column', { id: 'download_card' });

						// ▩ Quotes
						ui.text('▩ Quotes', { id: 'quotes_header', variant: 'h3' });
						ui.text(`• ${prefix}motivasi\n• ${prefix}quotes\n• ${prefix}truth\n• ${prefix}bijak\n• ${prefix}dare\n• ${prefix}bucin\n• ${prefix}renungan`, { id: 'quotes_body', variant: 'body' });
						ui.column(['quotes_header', 'quotes_body'], {
							id: 'quotes_column',
						});
						ui.card('quotes_column', { id: 'quotes_card' });

						// ▩ Tools
						ui.text('▩ Tools', { id: 'tools_header', variant: 'h3' });
						ui.text(`• ${prefix}kalkulator \n• ${prefix}get (url) 🄿\n• ${prefix}hd (reply/send img)\n• ${prefix}hd2 (reply/send img)\n• ${prefix}hd3 (reply/send img)\n• ${prefix}hd4 (reply/send img)\n• ${prefix}ihancer (reply/send img)\n• ${prefix}remini (reply/send img)\n• ${prefix}toaudio (reply pesan)\n• ${prefix}tomp3 (reply pesan)\n• ${prefix}tovn (reply pesan)\n• ${prefix}toptv (reply pesan)\n• ${prefix}tourl (reply pesan)\n• ${prefix}tts (textnya)\n• ${prefix}toqr (textnya)\n• ${prefix}ssweb (url) 🄿\n• ${prefix}dehaze (send/reply img)\n• ${prefix}colorize (send/reply img)\n• ${prefix}hitamkan (send/reply img)\n• ${prefix}emojimix 🙃+💀\n• ${prefix}nulis\n• ${prefix}readmore text1|text2\n• ${prefix}iqc\n• ${prefix}iqcdark\n• ${prefix}qc (pesannya)\n• ${prefix}translate\n• ${prefix}wasted (send/reply img)\n• ${prefix}triggered (send/reply img)\n• ${prefix}shorturl (urlnya)\n• ${prefix}gitclone (urlnya)\n• ${prefix}fat (reply audio)\n• ${prefix}fast (reply audio)\n• ${prefix}bass (reply audio)\n• ${prefix}slow (reply audio)\n• ${prefix}tupai (reply audio)\n• ${prefix}deep (reply audio)\n• ${prefix}robot (reply audio)\n• ${prefix}blown (reply audio)\n• ${prefix}reverse (reply audio)\n• ${prefix}smooth (reply audio)\n• ${prefix}earrape (reply audio)\n• ${prefix}nightcore (reply audio)\n• ${prefix}getexif (reply sticker)\n• ${prefix}bypass (link)\n• ${prefix}removebg (send/reply img)\n• ${prefix}tempmail\n• ${prefix}genemail\n• ${prefix}swhd\n• ${prefix}lirik\n• ${prefix}nglspam`, { id: 'tools_body', variant: 'body' });
						ui.column(['tools_header', 'tools_body'], { id: 'tools_column' });
						ui.card('tools_column', { id: 'tools_card' });

						// ▩ AI
						ui.text('▩ AI', { id: 'ai_header', variant: 'h3' });
						ui.text(`• ${prefix}ai (query)\n• ${prefix}aiimage (send/reply img)\n• ${prefix}gemini (support img)\n• ${prefix}glm (query)\n• ${prefix}grok (query)\n• ${prefix}claude (query)\n• ${prefix}archipelago (query)\n• ${prefix}deepseek (query)\n• ${prefix}txt2img (query)`, { id: 'ai_body', variant: 'body' });
						ui.column(['ai_header', 'ai_body'], { id: 'ai_column' });
						ui.card('ai_column', { id: 'ai_card' });

						// ▩ Anime
						ui.text('▩ Anime', { id: 'anime_header', variant: 'h3' });
						ui.text(`• ${prefix}waifu\n• ${prefix}neko`, {
							id: 'anime_body',
							variant: 'body',
						});
						ui.column(['anime_header', 'anime_body'], { id: 'anime_column' });
						ui.card('anime_column', { id: 'anime_card' });

						// ▩ Game
						ui.text('▩ Game', { id: 'game_header', variant: 'h3' });
						ui.text(`• ${prefix}tictactoe• ${prefix}dino \n• ${prefix}tictactoe\n• ${prefix}suit\n• ${prefix}slot\n• ${prefix}math (level)\n• ${prefix}begal\n• ${prefix}ulartangga\n• ${prefix}blackjack\n• ${prefix}catur\n• ${prefix}casino (nominal)\n• ${prefix}samgong (nominal)\n• ${prefix}rampok (@tag)\n• ${prefix}family100\n• ${prefix}tekateki\n• ${prefix}tebaklirik\n• ${prefix}tebakkata\n• ${prefix}tebakbom\n• ${prefix}susunkata\n• ${prefix}colorblind\n• ${prefix}tebakkimia\n• ${prefix}caklontong\n• ${prefix}tebakangka\n• ${prefix}tebaknegara\n• ${prefix}tebakgambar\n• ${prefix}tebakbendera`, { id: 'game_body', variant: 'body' });
						ui.column(['game_header', 'game_body'], { id: 'game_column' });
						ui.card('game_column', { id: 'game_card' });

						// ▩ Fun
						ui.text('▩ Fun', { id: 'fun_header', variant: 'h3' });
						ui.text(`• ${prefix}coba\n• ${prefix}dadu\n• ${prefix}bisakah (text)\n• ${prefix}apakah (text)\n• ${prefix}kapan (text)\n• ${prefix}siapa (text)\n• ${prefix}kerangajaib (text)\n• ${prefix}cekmati (nama lu)\n• ${prefix}ceksifat\n• ${prefix}cekkhodam (nama lu)\n• ${prefix}rate (reply pesan)\n• ${prefix}jodohku\n• ${prefix}jadian\n• ${prefix}fitnah\n• ${prefix}halah (text)\n• ${prefix}hilih (text)\n• ${prefix}huluh (text)\n• ${prefix}heleh (text)\n• ${prefix}holoh (text)`, { id: 'fun_body', variant: 'body' });
						ui.column(['fun_header', 'fun_body'], { id: 'fun_column' });
						ui.card('fun_column', { id: 'fun_card' });

						// ▩ Random
						ui.text('▩ Random', { id: 'random_header', variant: 'h3' });
						ui.text(`• ${prefix}coffe`, { id: 'random_body', variant: 'body' });
						ui.column(['random_header', 'random_body'], {
							id: 'random_column',
						});
						ui.card('random_column', { id: 'random_card' });

						// ▩ Stalker
						ui.text('▩ Stalker', { id: 'stalker_header', variant: 'h3' });
						ui.text(`• ${prefix}wastalk\n• ${prefix}githubstalk`, {
							id: 'stalker_body',
							variant: 'body',
						});
						ui.column(['stalker_header', 'stalker_body'], {
							id: 'stalker_column',
						});
						ui.card('stalker_column', { id: 'stalker_card' });

						// ▩ Owner
						ui.text('▩ Owner', { id: 'owner_header', variant: 'h3' });
						ui.text(`• ${prefix}bot [set]\n• ${prefix}os\n• ${prefix}setbio\n• ${prefix}setppbot\n• ${prefix}join\n• ${prefix}leave\n• ${prefix}block\n• ${prefix}listblock\n• ${prefix}openblock\n• ${prefix}listpc\n• ${prefix}listgc\n• ${prefix}ban\n• ${prefix}unban\n• ${prefix}mute\n• ${prefix}unmute\n• ${prefix}cekid\n• ${prefix}creategc\n• ${prefix}clearchat\n• ${prefix}addprem\n• ${prefix}delprem\n• ${prefix}listprem\n• ${prefix}addlimit\n• ${prefix}adduang\n• ${prefix}setbotmessages\n• ${prefix}setbotauthor\n• ${prefix}setbotname\n• ${prefix}setbotpackname\n• ${prefix}setapikey\n• ${prefix}setbotlimit\n• ${prefix}setbotmoney\n• ${prefix}setlocale\n• ${prefix}settimezone\n• ${prefix}addcase (text)\n• ${prefix}getcase (text)\n• ${prefix}delcase (text)\n• ${prefix}hapus (reply pesan)\n• ${prefix}addprefix\n• ${prefix}delprefix\n• ${prefix}addbadword\n• ${prefix}delbadword\n• ${prefix}addowner\n• ${prefix}delowner\n• ${prefix}whitelist\n• ${prefix}getmsgstore\n• ${prefix}bot --settings\n• ${prefix}bot settings\n• ${prefix}gantifile (reply file)\n• ${prefix}hapusfile (reply file)\n• ${prefix}buatfile (reply file)\n• ${prefix}getsession\n• ${prefix}delsession\n• ${prefix}delsampah\n• ${prefix}upsw\n• ${prefix}backup`, { id: 'owner_body', variant: 'body' });
						ui.column(['owner_header', 'owner_body'], { id: 'owner_column' });
						ui.card('owner_column', { id: 'owner_card' });

						ui.column(['bot_card', 'premium_card', 'sticker_card', 'group_card', 'search_card', 'download_card', 'quotes_card', 'tools_card'], { id: 'menu_group_1' });
						ui.column(['ai_card', 'anime_card', 'game_card', 'fun_card', 'random_card', 'stalker_card', 'owner_card'], { id: 'menu_group_2' });

						rootIds.push('menu_group_1', 'menu_group_2');

						ui._components.set('audio_player', {
							id: 'audio_player',
							component: 'AudioPlayer',
							url: 'https://files.catbox.moe/k381r7.mp3',
							description: '• Xayncc',
						});

						ui.text('Butuh Bantuan?', {
							id: 'contact_card_header',
							variant: 'h2',
						});
						ui.text('Tekan tombol di bawah untuk menghubungi owner langsung.', {
							id: 'contact_card_body',
							variant: 'body',
						});
						ui.text('Chat Owner', {
							id: 'modal_trigger_text',
							variant: 'caption',
						});

						ui.button('modal_trigger_text', {
							id: 'modal_trigger',
							variant: 'borderless',
							action: {
								call: 'openUrl',
								args: { url: 'https://wa.me/${global.owner[0]}' },
							},
						});

						ui.column(['contact_card_header', 'contact_card_body', 'modal_trigger'], { id: 'contact_section' });

						rootIds.push('audio_player', 'contact_section');

						ui.root(rootIds);

						await sendA2UIWidget(xync, m.chat, {
							a2ui: ui,
							contextInfo: { expiration: 7776000, mentionedJid: [m.sender] },
							quoted: m,
							singleScreen: true,
						});
					} catch (error) {
						console.error('\n[ERROR BLOCKS ALLMENU] :', error);
						m.reply(`Eror: ${error.message}`);
					}
				}
				break;
			case 'botmenu':
				{
					try {
						const { A2UI, sendA2UIWidget } = await import('./lib/a2ui.js?t=' + Date.now());
						const ui = new A2UI();

						ui.text('▩ Bot', { id: 'header', variant: 'h3' });
						ui.text(`• ${prefix}profile\n• ${prefix}claim\n• ${prefix}buy [item] (nominal)\n• ${prefix}transfer\n• ${prefix}leaderboard\n• ${prefix}request (text)\n• ${prefix}react (emoji)\n• ${prefix}tagme\n• ${prefix}runtime\n• ${prefix}totalfitur\n• ${prefix}speed\n• ${prefix}ping\n• ${prefix}afk\n• ${prefix}rvo (reply pesan viewone)\n• ${prefix}inspect (url gc)\n• ${prefix}addmsg\n• ${prefix}delmsg\n• ${prefix}getmsg\n• ${prefix}listmsg\n• ${prefix}setcmd\n• ${prefix}delcmd\n• ${prefix}listcmd\n• ${prefix}lockcmd\n• ${prefix}q (reply pesan)\n• ${prefix}menfes (62xxx|fake name)\n• ${prefix}confes (62xxx|fake name)\n• ${prefix}roomai\n• ${prefix}jadibot 🄿\n• ${prefix}stopjadibot\n• ${prefix}listjadibot\n• ${prefix}donasi\n• ${prefix}addsewa\n• ${prefix}delsewa\n• ${prefix}listsewa`, { id: 'body', variant: 'body' });
						ui.column(['header', 'body'], { id: 'column' });
						ui.card('column', { id: 'card' });
						ui.root(['card']);

						await sendA2UIWidget(xync, m.chat, {
							a2ui: ui,
							quoted: m,
							singleScreen: false,
						});
					} catch (error) {
						console.error('\n[ERROR BLOCKS BOTMENU] :', error);
						m.reply(`Eror: ${error.message}`);
					}
				}
				break;
			case 'premium':
				{
					try {
						const { A2UI, sendA2UIWidget } = await import('./lib/a2ui.js?t=' + Date.now());
						const ui = new A2UI();

						ui.text('▩ Premium', { id: 'header', variant: 'h3' });
						ui.text(`• ${prefix}ampremium 🄿\n• ${prefix}amprem2 🄿\n• ${prefix}amgen 🄿\n• ${prefix}ambulk 🄿\n• ${prefix}netflix 🄿`, { id: 'body', variant: 'body' });
						ui.column(['header', 'body'], { id: 'column' });
						ui.card('column', { id: 'card' });
						ui.root(['card']);

						await sendA2UIWidget(xync, m.chat, {
							a2ui: ui,
							quoted: m,
							singleScreen: false,
						});
					} catch (error) {
						console.error('\n[ERROR BLOCKS PREMIUM] :', error);
						m.reply(`Eror: ${error.message}`);
					}
				}
				break;
			case 'stickermenu':
				{
					try {
						const { A2UI, sendA2UIWidget } = await import('./lib/a2ui.js?t=' + Date.now());
						const ui = new A2UI();

						ui.text('▩ Sticker', { id: 'header', variant: 'h3' });
						ui.text(`• ${prefix}sticker (send/reply img)\n• ${prefix}toimage (reply pesan)\n• ${prefix}brat (textnya)\n• ${prefix}bratvid (textnya)\n• ${prefix}colong (reply stiker)\n• ${prefix}smeme (send/reply img)\n• ${prefix}spk (reply img)`, { id: 'body', variant: 'body' });
						ui.column(['header', 'body'], { id: 'column' });
						ui.card('column', { id: 'card' });
						ui.root(['card']);

						await sendA2UIWidget(xync, m.chat, {
							a2ui: ui,
							quoted: m,
							singleScreen: false,
						});
					} catch (error) {
						console.error('\n[ERROR BLOCKS STICKERMENU] :', error);
						m.reply(`Eror: ${error.message}`);
					}
				}
				break;
			case 'groupmenu':
				{
					try {
						const { A2UI, sendA2UIWidget } = await import('./lib/a2ui.js?t=' + Date.now());
						const ui = new A2UI();

						ui.text('▩ Group', { id: 'header', variant: 'h3' });
						ui.text(`• ${prefix}add (62xxx)\n• ${prefix}kick (@tag/62xxx)\n• ${prefix}promote (@tag/62xxx)\n• ${prefix}demote (@tag/62xxx)\n• ${prefix}warn (@tag/62xxx)\n• ${prefix}unwarn (@tag/62xxx)\n• ${prefix}setname (nama baru gc)\n• ${prefix}setdesc (desk)\n• ${prefix}setppgc (reply imgnya)\n• ${prefix}delete (reply pesan)\n• ${prefix}linkgrup\n• ${prefix}totalpesan\n• ${prefix}swgc\n• ${prefix}revoke\n• ${prefix}tagall\n• ${prefix}pin\n• ${prefix}unpin\n• ${prefix}hidetag\n• ${prefix}totag (reply pesan)\n• ${prefix}listonline\n• ${prefix}group set\n• ${prefix}group (khusus admin)`, { id: 'body', variant: 'body' });
						ui.column(['header', 'body'], { id: 'column' });
						ui.card('column', { id: 'card' });
						ui.root(['card']);

						await sendA2UIWidget(xync, m.chat, {
							a2ui: ui,
							quoted: m,
							singleScreen: false,
						});
					} catch (error) {
						console.error('\n[ERROR BLOCKS GROUPMENU] :', error);
						m.reply(`Eror: ${error.message}`);
					}
				}
				break;
			case 'searchmenu':
				{
					try {
						const { A2UI, sendA2UIWidget } = await import('./lib/a2ui.js?t=' + Date.now());
						const ui = new A2UI();

						ui.text('▩ Search', { id: 'header', variant: 'h3' });
						ui.text(`• ${prefix}ytsearch (query)\n• ${prefix}spotify (query)\n• ${prefix}play (judul lagu)\n• ${prefix}pixiv (query)\n• ${prefix}pinterest (query)\n• ${prefix}wallpaper (query)\n• ${prefix}ringtone (query)\n• ${prefix}google (query)\n• ${prefix}gimage (query)\n• ${prefix}npm (query)\n• ${prefix}style (query)\n• ${prefix}cuaca (kota)\n• ${prefix}tenor (query)\n• ${prefix}urban (query)`, { id: 'body', variant: 'body' });
						ui.column(['header', 'body'], { id: 'column' });
						ui.card('column', { id: 'card' });
						ui.root(['card']);

						await sendA2UIWidget(xync, m.chat, {
							a2ui: ui,
							quoted: m,
							singleScreen: false,
						});
					} catch (error) {
						console.error('\n[ERROR BLOCKS SEARCHMENU] :', error);
						m.reply(`Eror: ${error.message}`);
					}
				}
				break;
			case 'downloadmenu':
				{
					try {
						const { A2UI, sendA2UIWidget } = await import('./lib/a2ui.js?t=' + Date.now());
						const ui = new A2UI();

						ui.text('▩ Download', { id: 'header', variant: 'h3' });
						ui.text(`• ${prefix}aio (url)\n• ${prefix}ytmp3 (url)\n• ${prefix}ytmp4 (url)\n• ${prefix}instagram (url)\n• ${prefix}tiktok (url)\n• ${prefix}tiktokmp3 (url)\n• ${prefix}facebook (url)\n• ${prefix}spotifydl (url)\n• ${prefix}mediafire (url)`, { id: 'body', variant: 'body' });
						ui.column(['header', 'body'], { id: 'column' });
						ui.card('column', { id: 'card' });
						ui.root(['card']);

						await sendA2UIWidget(xync, m.chat, {
							a2ui: ui,
							quoted: m,
							singleScreen: false,
						});
					} catch (error) {
						console.error('\n[ERROR BLOCKS DOWNLOADMENU] :', error);
						m.reply(`Eror: ${error.message}`);
					}
				}
				break;
			case 'quotesmenu':
				{
					try {
						const { A2UI, sendA2UIWidget } = await import('./lib/a2ui.js?t=' + Date.now());
						const ui = new A2UI();

						ui.text('▩ Quotes', { id: 'header', variant: 'h3' });
						ui.text(`• ${prefix}motivasi\n• ${prefix}quotes\n• ${prefix}truth\n• ${prefix}bijak\n• ${prefix}dare\n• ${prefix}bucin\n• ${prefix}renungan`, { id: 'body', variant: 'body' });
						ui.column(['header', 'body'], { id: 'column' });
						ui.card('column', { id: 'card' });
						ui.root(['card']);

						await sendA2UIWidget(xync, m.chat, {
							a2ui: ui,
							quoted: m,
							singleScreen: false,
						});
					} catch (error) {
						console.error('\n[ERROR BLOCKS QUOTESMENU] :', error);
						m.reply(`Eror: ${error.message}`);
					}
				}
				break;
			case 'toolsmenu':
				{
					try {
						const { A2UI, sendA2UIWidget } = await import('./lib/a2ui.js?t=' + Date.now());
						const ui = new A2UI();

						ui.text('▩ Tools', { id: 'header', variant: 'h3' });
						ui.text(`• ${prefix}kalkulator \n• ${prefix}get (url) 🄿\n• ${prefix}hd (reply/send img)\n• ${prefix}hd2 (reply/send img)\n• ${prefix}hd3 (reply/send img)\n• ${prefix}hd4 (reply/send img)\n• ${prefix}ihancer (reply/send img)\n• ${prefix}remini (reply/send img)\n• ${prefix}toaudio (reply pesan)\n• ${prefix}tomp3 (reply pesan)\n• ${prefix}tovn (reply pesan)\n• ${prefix}toimage (reply pesan)\n• ${prefix}toptv (reply pesan)\n• ${prefix}tourl (reply pesan)\n• ${prefix}tts (textnya)\n• ${prefix}toqr (textnya)\n• ${prefix}brat (textnya)\n• ${prefix}bratvid (textnya)\n• ${prefix}ssweb (url) 🄿\n• ${prefix}sticker (send/reply img)\n• ${prefix}colong (reply stiker)\n• ${prefix}smeme (send/reply img)\n• ${prefix}dehaze (send/reply img)\n• ${prefix}colorize (send/reply img)\n• ${prefix}hitamkan (send/reply img)\n• ${prefix}emojimix 😂+💀\n• ${prefix}nulis\n• ${prefix}readmore text1|text2\n• ${prefix}iqc\n• ${prefix}iqcdark\n• ${prefix}qc (pesannya)\n• ${prefix}translate\n• ${prefix}wasted (send/reply img)\n• ${prefix}triggered (send/reply img)\n• ${prefix}shorturl (urlnya)\n• ${prefix}gitclone (urlnya)\n• ${prefix}fat (reply audio)\n• ${prefix}fast (reply audio)\n• ${prefix}bass (reply audio)\n• ${prefix}slow (reply audio)\n• ${prefix}tupai (reply audio)\n• ${prefix}deep (reply audio)\n• ${prefix}robot (reply audio)\n• ${prefix}blown (reply audio)\n• ${prefix}reverse (reply audio)\n• ${prefix}smooth (reply audio)\n• ${prefix}earrape (reply audio)\n• ${prefix}nightcore (reply audio)\n• ${prefix}getexif (reply sticker)\n• ${prefix}tempmail\n• ${prefix}genemail\n• ${prefix}swhd\n• ${prefix}lirik\n• ${prefix}nglspam`, { id: 'body', variant: 'body' });
						ui.column(['header', 'body'], { id: 'column' });
						ui.card('column', { id: 'card' });
						ui.root(['card']);

						await sendA2UIWidget(xync, m.chat, {
							a2ui: ui,
							quoted: m,
							singleScreen: false,
						});
					} catch (error) {
						console.error('\n[ERROR BLOCKS TOOLSMENU] :', error);
						m.reply(`Eror: ${error.message}`);
					}
				}
				break;
			case 'aimenu':
				{
					try {
						const { A2UI, sendA2UIWidget } = await import('./lib/a2ui.js?t=' + Date.now());
						const ui = new A2UI();

						ui.text('▩ AI', { id: 'header', variant: 'h3' });
						ui.text(`• ${prefix}ai (query)\n• ${prefix}aiimage (send/reply img)\n• ${prefix}gemini (support img)\n• ${prefix}glm (query)\n• ${prefix}grok (query)\n• ${prefix}claude (query)\n• ${prefix}archipelago (query)\n• ${prefix}deepseek (query)\n• ${prefix}txt2img (query)`, { id: 'body', variant: 'body' });
						ui.column(['header', 'body'], { id: 'column' });
						ui.card('column', { id: 'card' });
						ui.root(['card']);

						await sendA2UIWidget(xync, m.chat, {
							a2ui: ui,
							quoted: m,
							singleScreen: false,
						});
					} catch (error) {
						console.error('\n[ERROR BLOCKS AIMENU] :', error);
						m.reply(`Eror: ${error.message}`);
					}
				}
				break;
			case 'randommenu':
				{
					try {
						const { A2UI, sendA2UIWidget } = await import('./lib/a2ui.js?t=' + Date.now());
						const ui = new A2UI();

						ui.text('▩ Random', { id: 'header', variant: 'h3' });
						ui.text(`• ${prefix}coffe`, { id: 'body', variant: 'body' });
						ui.column(['header', 'body'], { id: 'column' });
						ui.card('column', { id: 'card' });
						ui.root(['card']);

						await sendA2UIWidget(xync, m.chat, {
							a2ui: ui,
							quoted: m,
							singleScreen: false,
						});
					} catch (error) {
						console.error('\n[ERROR BLOCKS RANDOMMENU] :', error);
						m.reply(`Eror: ${error.message}`);
					}
				}
				break;
			case 'stalkermenu':
				{
					try {
						const { A2UI, sendA2UIWidget } = await import('./lib/a2ui.js?t=' + Date.now());
						const ui = new A2UI();

						ui.text('▩ Stalker', { id: 'header', variant: 'h3' });
						ui.text(`• ${prefix}wastalk\n• ${prefix}githubstalk`, {
							id: 'body',
							variant: 'body',
						});
						ui.column(['header', 'body'], { id: 'column' });
						ui.card('column', { id: 'card' });
						ui.root(['card']);

						await sendA2UIWidget(xync, m.chat, {
							a2ui: ui,
							quoted: m,
							singleScreen: false,
						});
					} catch (error) {
						console.error('\n[ERROR BLOCKS STALKERMENU] :', error);
						m.reply(`Eror: ${error.message}`);
					}
				}
				break;
			case 'animemenu':
				{
					try {
						const { A2UI, sendA2UIWidget } = await import('./lib/a2ui.js?t=' + Date.now());
						const ui = new A2UI();

						ui.text('▩ Anime', { id: 'header', variant: 'h3' });
						ui.text(`• ${prefix}waifu\n• ${prefix}neko`, {
							id: 'body',
							variant: 'body',
						});
						ui.column(['header', 'body'], { id: 'column' });
						ui.card('column', { id: 'card' });
						ui.root(['card']);

						await sendA2UIWidget(xync, m.chat, {
							a2ui: ui,
							quoted: m,
							singleScreen: false,
						});
					} catch (error) {
						console.error('\n[ERROR BLOCKS ANIMEMENU] :', error);
						m.reply(`Eror: ${error.message}`);
					}
				}
				break;
			case 'gamemenu':
				{
					try {
						const { A2UI, sendA2UIWidget } = await import('./lib/a2ui.js?t=' + Date.now());
						const ui = new A2UI();

						ui.text('▩ Game', { id: 'header', variant: 'h3' });
						ui.text(`• ${prefix}tictactoe• ${prefix}dino \n• ${prefix}tictactoe\n• ${prefix}suit\n• ${prefix}slot\n• ${prefix}math (level)\n• ${prefix}begal\n• ${prefix}ulartangga\n• ${prefix}blackjack\n• ${prefix}catur\n• ${prefix}casino (nominal)\n• ${prefix}samgong (nominal)\n• ${prefix}rampok (@tag)\n• ${prefix}family100\n• ${prefix}tekateki\n• ${prefix}tebaklirik\n• ${prefix}tebakkata\n• ${prefix}tebakbom\n• ${prefix}susunkata\n• ${prefix}colorblind\n• ${prefix}tebakkimia\n• ${prefix}caklontong\n• ${prefix}tebakangka\n• ${prefix}tebaknegara\n• ${prefix}tebakgambar\n• ${prefix}tebakbendera`, { id: 'body', variant: 'body' });
						ui.column(['header', 'body'], { id: 'column' });
						ui.card('column', { id: 'card' });
						ui.root(['card']);

						await sendA2UIWidget(xync, m.chat, {
							a2ui: ui,
							quoted: m,
							singleScreen: false,
						});
					} catch (error) {
						console.error('\n[ERROR BLOCKS GAMEMENU] :', error);
						m.reply(`Eror: ${error.message}`);
					}
				}
				break;
			case 'funmenu':
				{
					try {
						const { A2UI, sendA2UIWidget } = await import('./lib/a2ui.js?t=' + Date.now());
						const ui = new A2UI();

						ui.text('▩ Fun', { id: 'header', variant: 'h3' });
						ui.text(`• ${prefix}coba\n• ${prefix}dadu\n• ${prefix}bisakah (text)\n• ${prefix}apakah (text)\n• ${prefix}kapan (text)\n• ${prefix}siapa (text)\n• ${prefix}kerangajaib (text)\n• ${prefix}cekmati (nama lu)\n• ${prefix}ceksifat\n• ${prefix}cekkhodam (nama lu)\n• ${prefix}rate (reply pesan)\n• ${prefix}jodohku\n• ${prefix}jadian\n• ${prefix}fitnah\n• ${prefix}halah (text)\n• ${prefix}hilih (text)\n• ${prefix}huluh (text)\n• ${prefix}heleh (text)\n• ${prefix}holoh (text)`, { id: 'body', variant: 'body' });
						ui.column(['header', 'body'], { id: 'column' });
						ui.card('column', { id: 'card' });
						ui.root(['card']);

						await sendA2UIWidget(xync, m.chat, {
							a2ui: ui,
							quoted: m,
							singleScreen: false,
						});
					} catch (error) {
						console.error('\n[ERROR BLOCKS FUNMENU] :', error);
						m.reply(`Eror: ${error.message}`);
					}
				}
				break;
			case 'ownermenu':
				{
					try {
						const { A2UI, sendA2UIWidget } = await import('./lib/a2ui.js?t=' + Date.now());
						const ui = new A2UI();

						ui.text('▩ Owner', { id: 'header', variant: 'h3' });
						ui.text(`• ${prefix}bot [set]\n• ${prefix}os\n• ${prefix}setbio\n• ${prefix}setppbot\n• ${prefix}join\n• ${prefix}leave\n• ${prefix}block\n• ${prefix}listblock\n• ${prefix}openblock\n• ${prefix}listpc\n• ${prefix}listgc\n• ${prefix}ban\n• ${prefix}unban\n• ${prefix}mute\n• ${prefix}unmute\n• ${prefix}cekid\n• ${prefix}creategc\n• ${prefix}clearchat\n• ${prefix}addprem\n• ${prefix}delprem\n• ${prefix}listprem\n• ${prefix}addlimit\n• ${prefix}adduang\n• ${prefix}setbotmessages\n• ${prefix}setbotauthor\n• ${prefix}setbotname\n• ${prefix}setbotpackname\n• ${prefix}setapikey\n• ${prefix}setbotlimit\n• ${prefix}setbotmoney\n• ${prefix}setlocale\n• ${prefix}settimezone\n• ${prefix}addcase (text)\n• ${prefix}getcase (text)\n• ${prefix}delcase (text)\n• ${prefix}hapus (reply pesan)\n• ${prefix}addprefix\n• ${prefix}delprefix\n• ${prefix}addbadword\n• ${prefix}delbadword\n• ${prefix}addowner\n• ${prefix}delowner\n• ${prefix}whitelist\n• ${prefix}getmsgstore\n• ${prefix}bot --settings\n• ${prefix}bot settings\n• ${prefix}gantifile (reply file)\n• ${prefix}hapusfile (reply file)\n• ${prefix}buatfile (reply file)\n• ${prefix}getsession\n• ${prefix}delsession\n• ${prefix}delsampah\n• ${prefix}upsw\n• ${prefix}backup\n• $\n• >\n• <`, { id: 'body', variant: 'body' });
						ui.column(['header', 'body'], { id: 'column' });
						ui.card('column', { id: 'card' });
						ui.root(['card']);

						await sendA2UIWidget(xync, m.chat, {
							a2ui: ui,
							quoted: m,
							singleScreen: false,
						});
					} catch (error) {
						console.error('\n[ERROR BLOCKS OWNERMENU] :', error);
						m.reply(`Eror: ${error.message}`);
					}
				}
				break;
			
			default:
				if (budy.startsWith('>')) {
					if (!isCreator) return;
					try {
						let evaled = await eval(budy.slice(2));
						if (typeof evaled !== 'string') evaled = util.inspect(evaled);
						await m.reply(evaled);
					} catch (err) {
						await m.reply(String(err));
					}
				}
				if (budy.startsWith('<')) {
					if (!isCreator) return;
					try {
						let evaled = await eval(`(async () => { ${budy.slice(2)} })()`);
						if (typeof evaled !== 'string') evaled = util.inspect(evaled);
						await m.reply(evaled);
					} catch (err) {
						await m.reply(String(err));
					}
				}
				if (budy.startsWith('$')) {
					if (!isCreator) return;
					if (!text) return;
					exec(budy.slice(2), (err, stdout) => {
						if (err) return m.reply(`${err}`);
						if (stdout) return m.reply(stdout);
					});
				}
				if ((!isCmd || isCreator) && budy.toLowerCase() != undefined) {
					if (m.chat.endsWith('broadcast')) return;
					if (!(budy.toLowerCase() in db.database)) return;
					await xync.relayMessage(m.chat, db.database[budy.toLowerCase()], {});
				}
		}
	} catch (e) {
		console.log(e);
		if (e?.message?.includes('No sessions') || e?.message?.includes('ffmpeg exited with code') || e?.code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED' || e?.message?.includes('maxBodyLength limit') || e?.message?.includes('rate-overlimit')) return;
		const errorKey = e?.code || e?.name || e?.message?.slice(0, 100) || 'unknown_error';
		const now = Date.now();
		if (!errorCache[errorKey]) errorCache[errorKey] = [];
		errorCache[errorKey] = errorCache[errorKey].filter(ts => now - ts < 600000);
		if (errorCache[errorKey].length >= 3) return;
		errorCache[errorKey].push(now);
		const isAxiosError = e?.isAxiosError || !!e?.response;
		const statusCode = e?.response?.status || e?.statusCode || e?.data;
		const errorUrl = e?.config?.url || e?.request?.host || '';
		if (statusCode === 500) {
			m.reply('Server API Error: Terjadi gangguan pada server tujuan.');
		} else if (statusCode === 429) {
			if (errorUrl.includes('api.naze.biz.id')) {
				return m.reply('Limit Reached: ' + mess.key);
			} else m.reply('Limit Reached (Sistem/WA): Terlalu banyak permintaan.\nLog Error Telah dikirim ke Owner');
		} else if (statusCode === 403) {
			if (isAxiosError) {
				if (errorUrl.includes('api.naze.biz.id')) {
					return m.reply('Akses Khusus Premium!');
				} else m.reply('API Error: Akses ke server API ditolak (403 Forbidden).');
			} else console.log(chalk.yellowBright('[SYSTEM] Akses grup ditolak (Baileys 403 / Forbidden).'));
		} else if (statusCode === 401) {
			if (isAxiosError) {
				if (errorUrl.includes('api.naze.biz.id')) {
					return m.reply('Invalid Apikey!');
				} else m.reply('API Error: Akses ke server API ditolak (401 Unauthorized).');
			} else console.log(chalk.yellowBright('[SYSTEM] Akses ditolak (401 Unauthorized).'));
		} else m.reply('Error: ' + (e?.name || e?.code || e?.message || 'Terjadi kesalahan tidak diketahui') + '\nLog Error Telah dikirim ke Owner\n\n');
		return xync.sendFromOwner(ownerNumber, `Halo sayang, sepertinya ada yang error nih, jangan lupa diperbaiki ya\n\nVersion : *${require('./package.json').version}*\nType : *${m.type || errorKey}*\n\n*Log error:*\n\n` + util.format(e), m, {});
	}
};

// Mesin ai
const GROQ_APIKEY = global.APIKeys.groq; 
const VERCEL_TOKEN = global.APIKeys.vercel; 

async function fiora(type, text, conn, m) {
	if (!GROQ_APIKEY || GROQ_APIKEY.includes('MASUKKAN')) {
		throw new Error('API Key Groq belum diisi!');
	}

	let userLogs = db.users[m.sender]?.fiora?.logs || [];
	let currentMsg = [];

	if (type === 'chat') {
		currentMsg = [{ role: 'user', content: text }];
	} else if (type === 'button_click') {
		let targetId = 'FIORA-unknown';
		try {
			targetId = userLogs.filter(v => v.tool_calls).find(v => v.data_id?.includes(text))?.tool_calls[0]?.id || 'FIORA-unknown';
		} catch (e) {}

		currentMsg = [
			{
				role: 'tool',
				tool_call_id: targetId,
				content: JSON.stringify({
					user_button_clicked_id: text,
					description: `User menekan tombol ${text}. Balas natural menggunakan tool response.`,
				}),
			},
		];
	}

	const cleanHistory = userLogs.filter(msg => msg.role && msg.content).map(({ role, content }) => ({ role, content }));

	const res = await requestGroq([...cleanHistory, ...currentMsg]);

	if (!res || res.error) {
		let errString = typeof res.error === 'object' ? JSON.stringify(res.error, null, 2) : res.error;
		throw new Error(`Respon Groq Error:\n${errString}`);
	}

	const toolCall = res.message?.tool_calls?.[0];
	if (toolCall && toolCall.function.name === 'deploy_vercel') {
		try {
			const args = JSON.parse(toolCall.function.arguments);
			await m.reply('AI merespons: Membikin dan mendeploy web ke Vercel... Mohon tunggu sebentar!');

			const axios = require('axios');
			const deployName = 'renn-ai-' + Math.floor(Math.random() * 10000);

			const payload = {
				name: deployName,
				target: 'production',
				files: [{ file: 'index.html', data: args.html_code }],
				projectSettings: { framework: null },
			};

			const vercelRes = await axios.post('https://api.vercel.com/v13/deployments', payload, {
				headers: {
					Authorization: `Bearer ${VERCEL_TOKEN}`,
					'Content-Type': 'application/json',
				},
				maxContentLength: Infinity,
				maxBodyLength: Infinity,
			});

			const deployUrl = vercelRes.data.url;
			let replyMsg = `BERHASIL MEMBUAT WEB\n`;
			replyMsg += `Ini adalah web kamu\n`;
			replyMsg += `Linknya https://${deployUrl}\n\n`;

			await xync.sendListMsg(
				m.chat,
				{
					text: replyMsg,
					footer: '© Renn ',
					buttons: [
						{
							name: 'cta_url',
							buttonParamsJson: JSON.stringify({
								display_text: 'Buka Website',
								url: `https://${deployUrl}`,
							}),
						},
					],
				},
				{ quoted: m },
			);

			db.users[m.sender].fiora.logs.push(...currentMsg, {
				role: 'assistant',
				content: `Berhasil deploy web: https://${deployUrl}`,
			});
			return;
		} catch (err) {
			await m.reply(`❌ Gagal mendeploy web buatan AI ke Vercel:\n${err.response?.data?.error?.message || err.message}`);
			return;
		}
	}

	if (!res.message?.tool_calls || res.message.tool_calls.length === 0) {
		const replyText = res.message?.content || 'Halo desu~';
		await conn.sendMessage(m.chat, { text: replyText }, { quoted: m });
		db.users[m.sender].fiora.logs.push(...currentMsg, {
			role: 'assistant',
			content: replyText,
		});
		return;
	}

	const toolArgsRaw = toolCall?.function?.arguments ?? '{}';
	let toolArgs = {};
	try {
		toolArgs = JSON.parse(toolArgsRaw);
	} catch (e) {}

	const nativeFlow = await convertFiora(toolArgs, conn);
	if (nativeFlow) {
		await sendInteractiveFiora(conn, m.chat, nativeFlow, m);
	} else {
		await conn.sendMessage(m.chat, { text: toolArgs.text || 'Halo desu~' }, { quoted: m });
	}

	db.users[m.sender].fiora.logs.push(...currentMsg, {
		role: 'assistant',
		content: toolArgs.text || '[Pesan Tombol]',
		data_id: toolArgs.data_id || [],
		tool_calls: res.message.tool_calls,
	});
}

async function requestGroq(messages) {
	const axios = require('axios');
	const payload = {
		model: 'openai/gpt-oss-120b',
		messages: [{ role: 'system', content: loaderFiora().system }, ...messages],
		tools: loaderFiora().tools,
		tool_choice: 'auto',
		temperature: 0.7,
		max_tokens: 1400,
	};

	try {
		const { data } = await axios.post('https://api.groq.com/openai/v1/chat/completions', payload, {
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${GROQ_APIKEY}`,
			},
			timeout: 45000,
		});
		return data.choices[0];
	} catch (err) {
		return { error: err.response?.data || err.message || 'Unknown Error' };
	}
}

function loaderFiora() {
	const tools = [
		{
			type: 'function',
			function: {
				name: 'response',
				description: 'Kirim tombol interaktif WhatsApp ke user jika user hanya bertanya atau meminta pilihan.',
				parameters: {
					type: 'object',
					properties: {
						header: {
							type: 'object',
							properties: {
								title: { type: 'string' },
								image: { type: 'string' },
							},
						},
						text: { type: 'string', description: 'Isi balasan teks' },
						footer: { type: 'string', description: 'Teks footer' },
						data_id: { type: 'array', items: { type: 'string' } },
						interactiveButtons: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									type: {
										type: 'string',
										enum: ['reply', 'url', 'copy', 'single_select'],
									},
									displayText: { type: 'string' },
									id: { type: 'string' },
									url: { type: 'string' },
									copyCode: { type: 'string' },
								},
								required: ['type', 'displayText', 'id'],
							},
						},
					},
					required: ['text', 'data_id', 'interactiveButtons'],
				},
			},
		},
		{
			type: 'function',
			function: {
				name: 'deploy_vercel',
				description: 'Gunakan fungsi ini KETIKA user meminta dibuatkan website, game web, landing page, atau kode HTML interaktif untuk di-deploy.',
				parameters: {
					type: 'object',
					properties: {
						description: {
							type: 'string',
							description: 'Deskripsi singkat tentang web yang dibuat',
						},
						html_code: {
							type: 'string',
							description: 'Kode lengkap HTML (termasuk CSS & JavaScript di dalamnya) yang siap jalan',
						},
					},
					required: ['description', 'html_code'],
				},
			},
		},
	];

	const system = `Kamu adalah *Renn*, asisten AI yang cerdas, manis, dan jago coding web.
Jika user meminta dibuatkan website, kalkulator, game, atau halaman web, JANGAN kirim teks biasa atau tombol, melainkan PANGGIL tool \`deploy_vercel\` dengan isi kode HTML yang lengkap dan menarik.
Jika user hanya mengobrol biasa, gunakan tool \`response\` untuk membalas dengan teks atau tombol interaktif.`;

	return { system, tools };
}

async function convertFiora(toolArgs, conn) {
	const { prepareWAMessageMedia } = require('baileys');
	try {
		let headerData = {
			title: toolArgs.header?.title || '',
			hasMediaAttachment: false,
		};
		if (toolArgs.header?.image) {
			try {
				const media = await prepareWAMessageMedia({ image: { url: toolArgs.header.image } }, { upload: conn.waUploadToServer });
				headerData = {
					...headerData,
					hasMediaAttachment: true,
					imageMessage: media.imageMessage,
				};
			} catch (e) {}
		}

		const buttons = (toolArgs.interactiveButtons || []).map(btn => {
			switch (btn.type) {
				case 'url':
					return {
						name: 'cta_url',
						buttonParamsJson: JSON.stringify({
							display_text: btn.displayText,
							url: btn.url,
						}),
					};
				case 'copy':
					return {
						name: 'cta_copy',
						buttonParamsJson: JSON.stringify({
							display_text: btn.displayText,
							copy_code: btn.copyCode || btn.id,
						}),
					};
				default:
					return {
						name: 'quick_reply',
						buttonParamsJson: JSON.stringify({
							display_text: btn.displayText,
							id: btn.id,
						}),
					};
			}
		});

		return {
			header: headerData,
			body: { text: toolArgs.text || 'Halo desu~' },
			footer: { text: toolArgs.footer || 'Renn' },
			nativeFlowMessage: { buttons },
		};
	} catch (e) {
		return null;
	}
}

async function sendInteractiveFiora(conn, chatId, interactive, quoted) {
	if (!interactive) return;
	const { generateWAMessageFromContent } = require('baileys');
	const msg = await generateWAMessageFromContent(
		chatId,
		{
			viewOnceMessage: {
				message: {
					interactiveMessage: {
						...interactive,
						contextInfo: { mentionedJid: [quoted.sender] },
					},
				},
			},
		},
		{ quoted, userJid: conn.user.id },
	);

	await conn.relayMessage(chatId, msg.message, {
		messageId: msg.key.id,
		additionalNodes: [
			{
				tag: 'biz',
				attrs: {},
				content: [
					{
						tag: 'interactive',
						attrs: { type: 'native_flow', v: '1' },
						content: [{ tag: 'interactive', attrs: { v: '9', name: 'mixed' } }],
					},
				],
			},
		],
	});
}

export default xync;
