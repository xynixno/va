import { Cangkulan } from '../lib/game.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default {
	name: ['cangkulan', 'ck'],
	execute: async (xync, m, args, text) => {
		try {
			const botNumber = xync.decodeJid(xync.user.id);
			const cangkulan = global.db.game.cangkulan;

					const normalizeCard = (str) =>
						String(str)
							.replace(/\uFE0F|\s/g, "")
							.trim()
							.toLowerCase();
					if (cangkulan[m.chat] && !(cangkulan[m.chat] instanceof Cangkulan)) {
						cangkulan[m.chat] = Object.assign(new Cangkulan(cangkulan[m.chat]), cangkulan[m.chat]);
					}
					let session = null;
					for (const id in cangkulan) {
						if (cangkulan[id].players?.find((p) => p.id === m.sender)) {
							session = cangkulan[id];
							break;
						}
					}
					if (session && !(session instanceof Cangkulan)) {
						session = Object.assign(new Cangkulan(session), session);
						cangkulan[session.id] = session;
					}
					const sendCardPrompt = async (playerId, headerText, sess) => {
						const p = sess.players.find((x) => x.id === playerId);
						if (!p || !p.cards.length) return;
						const hasStart = Object.keys(sess.startCard).length > 0;
						const buttons = p.cards.map((c) => ({
							name: "quick_reply",
							buttonParamsJson: JSON.stringify({
								display_text: `${c.rank}${c.suit}`,
								id: `.${m.command} play ${c.rank}${c.suit}`,
							}),
						}));
						if (hasStart && !sess.hasMatching(playerId)) {
							buttons.push({
								name: "quick_reply",
								buttonParamsJson: JSON.stringify({
									display_text: "🍺 Minum",
									id: `.${m.command} minum`,
								}),
							});
						}
						await xync.sendListMsg(
							playerId,
							{
								text: headerText,
								footer: `Kartumu (${p.cards.length}): ${p.cards.map((c) => c.rank + c.suit).join(", ")}`,
								buttons,
							},
							{ quoted: m },
						);
					};

					const endGame = async (sess) => {
						const loser = sess.players[0];
						const winnerList = sess.winner.length ? sess.winner.map((w, i) => `${i + 1}. @${w.id.split("@")[0]}`).join("\n") : "-";
						await xync.sendText(sess.id, `🃏 *GAME CANGKULAN SELESAI!* 🃏\n\n` + `🏆 *Urutan Pemenang:*\n${winnerList}\n\n` + `💀 *Pecundang:* @${loser?.id.split("@")[0] ?? "?"}`, m);
						delete cangkulan[sess.id];
					};

					const finalizeRound = async (sess) => {
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
								await xync.sendText(sess.id, `🎉 @${p.id.split("@")[0]} mengeluarkan semua kartu! Posisi ke-${rank}! 🏆`, m);
							}
						}
						if (sess.players.length <= 1) {
							await endGame(sess);
							return true;
						}
						if (!sess.players.find((p) => p.id === sess.leader)) {
							sess.leader = sess.players[0].id;
						}
						await sleep(500);
						await sendCardPrompt(sess.leader, `🃏 Giliranmu memulai ronde baru!\nMainkan kartu pertama:`, sess);
						return true;
					};

					switch (args[0]) {
						case "create":
						case "join":
							{
								if (!m.isGroup) return m.reply(global.mess.group);
								if (cangkulan[m.chat]?.players?.some((a) => a.id === m.sender)) return m.reply("❌ Kamu sudah bergabung di sesi ini!");
								if (session) return m.reply("❌ Kamu sudah ada di sesi grup lain! Keluar dulu sebelum join di sini.");
								if (cangkulan[m.chat]) {
									if (cangkulan[m.chat].started) return m.reply("❌ Game sudah berjalan! Tunggu sesi berikutnya.");
									if (cangkulan[m.chat].players.length >= 10) return m.reply(`❌ Pemain sudah penuh (maks 10).\nMulai dengan: ${m.prefix + m.command} start`);
									cangkulan[m.chat].players.push({ id: m.sender, cards: [] });
									m.reply(`✅ *Berhasil join Game Cangkulan!*\n` + `👥 Total pemain: ${cangkulan[m.chat].players.length}\n` + `Tunggu host memulai: ${m.prefix + m.command} start`);
								} else {
									cangkulan[m.chat] = new Cangkulan({
										id: m.chat,
										host: m.sender,
									});
									cangkulan[m.chat].players.push({ id: m.sender, cards: [] });
									m.reply(`✅ *Room Cangkulan berhasil dibuat!*\n` + `Ajak teman: ${m.prefix + m.command} join\n` + `Mulai game: ${m.prefix + m.command} start`);
								}
							}
							break;

						case "start":
							{
								if (!m.isGroup) return m.reply(global.mess.group);
								if (!cangkulan[m.chat]) return m.reply(`❌ Belum ada sesi. Buat dulu: ${m.prefix + m.command} create`);
								if (cangkulan[m.chat].host !== m.sender) return m.reply(`❌ Hanya host @${cangkulan[m.chat].host.split("@")[0]} yang bisa memulai!`);
								if (cangkulan[m.chat].players.length < 2) return m.reply("❌ Minimal 2 pemain!");
								if (cangkulan[m.chat].started) return m.reply("❌ Game sudah dimulai!");
								cangkulan[m.chat].distributeCards();
								const sess = cangkulan[m.chat];
								await m.reply(
									`🃏 *GAME CANGKULAN DIMULAI!* ♦️\n\n` +
										`📌 Start Card: ${sess.startCard.rank}${sess.startCard.suit}\n` +
										`📦 Sisa Deck: ${sess.deck.length} kartu\n` +
										`🎯 Leader: @${sess.leader.split("@")[0]}\n\n` +
										`👥 *Pemain:*\n` +
										sess.players.map((p) => `• @${p.id.split("@")[0]} (${p.cards.length} kartu)`).join("\n") +
										`\n\nCek private chat untuk kartumu! 👇\n` +
										`wa.me/${botNumber.split("@")[0]}`,
								);

								for (const p of sess.players) {
									await sleep(400);
									const isLeader = p.id === sess.leader;
									await sendCardPrompt(
										p.id,
										isLeader
											? `🃏 Game dimulai! Kamu adalah 🎯 Leader ronde pertama.\nStart Card: ${sess.startCard.rank}${sess.startCard.suit}\nMainkan kartu suit ${sess.startCard.suit} untuk memulai!`
											: `🃏 Game dimulai!\nStart Card: ${sess.startCard.rank}${sess.startCard.suit}\nMainkan kartu suit ${sess.startCard.suit} atau tekan Minum jika tidak ada.`,
										sess,
									);
								}
							}
							break;

						case "minum":
						case "hit":
							{
								if (!session) return m.reply("❌ Tidak ada sesi aktif!");
								if (!session.started) return m.reply("❌ Game belum dimulai!");
								if (!session.players.some((a) => a.id === m.sender)) return m.reply("❌ Kamu belum bergabung!");
								if (!Object.keys(session.startCard).length) return m.reply("⏳ Belum ada Start Card! Tunggu leader memulai ronde.");
								if (session.submitCard.some((s) => s.id === m.sender) || session.skip.includes(m.sender)) return m.reply("❌ Kamu sudah bermain di ronde ini!");
								if (session.hasMatching(m.sender)) {
									return m.reply(`❌ Kamu masih punya kartu suit *${session.startCard.suit}*!\n` + `Mainkan dulu sebelum minum.`);
								}
								const player = session.players.find((p) => p.id === m.sender);

								if (session.deck.length > 0) {
									const newCard = session.deck.shift();
									player.cards.push(newCard);
									await xync.sendText(session.id, `@${m.sender.split("@")[0]} minum 🍺 dan mengambil kartu dari deck! (sisa deck: ${session.deck.length})`, m);
									await sleep(400);
									await sendCardPrompt(m.sender, `🃏 Kartumu setelah minum:\nStart Card: ${session.startCard.rank}${session.startCard.suit}`, session);
								} else {
									await xync.sendText(session.id, `⚠️ @${m.sender.split("@")[0]} terpaksa skip karena deck kosong. Waspada hukuman kartu meja!`, m);
									if (!session.skip.includes(m.sender)) session.skip.push(m.sender);
									await finalizeRound(session);
								}
							}
							break;

						case "play":
							{
								if (!session) return m.reply("❌ Tidak ada sesi aktif!");
								if (!session.started) return m.reply("❌ Game belum dimulai!");
								if (!session.players.some((a) => a.id === m.sender)) return m.reply("❌ Kamu belum bergabung!");
								if (!args[1]) return m.reply(`❌ Format: ${m.prefix + m.command} play <kartu>\nContoh: ${m.prefix + m.command} play 3♥️`);
								if (session.submitCard.some((s) => s.id === m.sender) || session.skip.includes(m.sender)) return m.reply("❌ Kamu sudah bermain di ronde ini!");
								const player = session.players.find((p) => p.id === m.sender);
								const idx = player.cards.findIndex((c) => normalizeCard(c.rank + c.suit) === normalizeCard(args[1]));
								if (idx === -1) return m.reply("❌ Kartu tidak valid atau tidak ada di tanganmu!");
								const card = player.cards[idx];
								const hasStartCard = Object.keys(session.startCard).length > 0;
								if (hasStartCard) {
									if (card.suit !== session.startCard.suit) {
										if (session.hasMatching(m.sender)) {
											return m.reply(`❌ Harus memainkan kartu suit *${session.startCard.suit}*!`);
										}
										return m.reply(`❌ Kartu tidak sesuai suit *${session.startCard.suit}*!\n` + `Karena tidak punya kartu cocok, gunakan: ${m.prefix + m.command} minum`);
									}
								} else {
									if (m.sender !== session.leader) {
										return m.reply(`⏳ Tunggu dulu! Hanya 🎯 @${session.leader.split("@")[0]} (leader) yang bisa memulai ronde baru.`);
									}
								}
								player.cards.splice(idx, 1);
								session.secondDeck.push(card);
								session.submitCard.push({ id: m.sender, card });
								await m.reply(`✅ Kamu memainkan *${card.rank}${card.suit}*`);
								if (!hasStartCard) {
									session.startCard = card;
									await xync.sendText(session.id, `🎯 @${m.sender.split("@")[0]} memulai ronde dengan *${card.rank}${card.suit}*\n` + `Semua pemain harus memainkan kartu suit *${card.suit}*!`, m);
									for (const s of session.players) {
										if (s.id === session.leader) continue;
										await sleep(300);
										await sendCardPrompt(s.id, `🃏 Ronde baru dimulai!\nStart Card: *${card.rank}${card.suit}*\nMainkan kartu suit ${card.suit} atau tekan Minum.`, session);
									}
									await finalizeRound(session);
									return;
								}
								await xync.sendText(session.id, `@${m.sender.split("@")[0]} memainkan *${card.rank}${card.suit}* (sisa: ${player.cards.length} kartu)`, m);
								await finalizeRound(session);
							}
							break;

						case "info":
							{
								const infoSess = session || cangkulan[m.chat];
								if (!infoSess) return m.reply("❌ Tidak ada sesi aktif!");
								if (!infoSess.players.some((a) => a.id === m.sender)) return m.reply("❌ Kamu belum bergabung!");
								const hasStart = Object.keys(infoSess.startCard).length > 0;
								const startStr = hasStart ? `${infoSess.startCard.rank}${infoSess.startCard.suit}` : "-";
								const playerList = infoSess.players
									.map((p, i) => {
										let tag = "";
										if (p.id === infoSess.host) tag += " 👑HOST";
										if (p.id === infoSess.leader) tag += " 🎯Leader";
										return `${i + 1}. @${p.id.split("@")[0]}${tag} — ${p.cards.length} kartu`;
									})
									.join("\n");

								let msg =
									`🃏 *INFO GAME CANGKULAN* ♦️\n` +
									`┏━━━━━━━━━━━━━━━━━━\n` +
									`👥 Pemain : ${infoSess.players.length}\n` +
									`👑 Host : @${infoSess.host.split("@")[0]}\n` +
									`🎯 Leader : ${infoSess.leader ? "@" + infoSess.leader.split("@")[0] : "-"}\n` +
									`📊 Status : ${infoSess.started ? "🟢 Berjalan" : "🔴 Belum Mulai"}\n` +
									`🃏 Start Card: ${startStr}\n` +
									`📦 Sisa Deck: ${infoSess.deck.length} kartu\n` +
									`┗━━━━━━━━━━━━━━━━━━\n` +
									`*Daftar Pemain:*\n${playerList}`;

								if (!m.isGroup) {
									const myCards =
										infoSess.players
											.find((p) => p.id === m.sender)
											?.cards?.map((c) => c.rank + c.suit)
											.join(", ") || "-";
									msg += `\n┏━━━━━━━━━━━━━━━━━━\n*Kartu kamu:*\n${myCards}`;
								}
								if (infoSess.winner.length) {
									msg += `\n┏━━━━━━━━━━━━━━━━━━\n` + `*🏆 Sudah Menang:*\n` + infoSess.winner.map((w, i) => `${i + 1}. @${w.id.split("@")[0]}`).join("\n");
								}
								m.reply(msg);
							}
							break;

						case "deck":
							{
								const deckSess = session || cangkulan[m.chat];
								if (!deckSess) return m.reply("❌ Tidak ada sesi aktif!");
								if (!deckSess.players.some((a) => a.id === m.sender)) return m.reply("❌ Kamu belum bergabung!");
								const submittedNow = deckSess.submitCard.length ? deckSess.submitCard.map((s) => `@${s.id.split("@")[0]}: ${s.card.rank}${s.card.suit}`).join(", ") : "-";
								const skipNow = deckSess.skip.length ? deckSess.skip.map((s) => `@${s.split("@")[0]}`).join(", ") : "-";
								const lastCards =
									deckSess.secondDeck
										.slice(-10)
										.map((c) => c.rank + c.suit)
										.join(", ") || "-";
								m.reply(
									`🃏 *INFO DECK* ♦️\n` +
										`┏━━━━━━━━━━━━━━━━━━\n` +
										`📦 Sisa Deck : ${deckSess.deck.length} kartu\n` +
										`🔄 Kartu Terpakai: ${deckSess.secondDeck.length} kartu\n` +
										`┗━━━━━━━━━━━━━━━━━━\n` +
										`*Ronde Ini:*\n` +
										`▶️ Submit : ${submittedNow}\n` +
										`⏩ Skip : ${skipNow}\n` +
										`┏━━━━━━━━━━━━━━━━━━\n` +
										`*10 Kartu Terakhir:*\n${lastCards}`,
								);
							}
							break;

						case "end":
							{
								if (!m.isGroup) return m.reply(global.mess.group);
								if (!cangkulan[m.chat]) return m.reply("❌ Tidak ada sesi aktif!");
								if (cangkulan[m.chat].host !== m.sender) return m.reply(`❌ Hanya host @${cangkulan[m.chat].host.split("@")[0]} yang bisa menghapus sesi!`);
								delete cangkulan[m.chat];
								m.reply("🗑️ Sesi Game Cangkulan telah dihapus.");
							}
							break;

						default: {
							m.reply(
								`🃏 *GAME CANGKULAN* ♦️\n\n` +
									`*Cara Main:*\n` +
									`Mainkan kartu dengan suit yang sama dengan Start Card.\n` +
									`Tidak punya? Tekan Minum 🍺 — ambil kartu penalti & skip ronde.\n` +
									`Pemain pertama yang habis kartunya menang!\n\n` +
									`*Commands:*\n` +
									`• \`${m.prefix + m.command} create\` — Buat room baru\n` +
									`• \`${m.prefix + m.command} join\` — Gabung room\n` +
									`• \`${m.prefix + m.command} start\` — Mulai game (host)\n` +
									`• \`${m.prefix + m.command} play\` _kartu_ — Main kartu (cth: play 3♥️)\n` +
									`• \`${m.prefix + m.command} minum\` — Minum & skip ronde\n` +
									`• \`${m.prefix + m.command} info\` — Info game & pemain\n` +
									`• \`${m.prefix + m.command} deck\` — Info deck & ronde ini\n` +
									`• \`${m.prefix + m.command} end\` — Hapus sesi (host)\n\n` +
									`*Suit:* ♥️ ♦️ ♣️ ♠️`,
							);
						}
					}
				
		} catch (error) {
			console.error('[CANGKULAN ERROR]', error);
			m.reply('Terjadi kesalahan pada game Cangkulan.');
		}
	}
}
