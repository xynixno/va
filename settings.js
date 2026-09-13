import fs from 'fs';
import chalk from 'chalk';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

/*
	* Rename By Xync
	* Follow https://github.com/nazedev
	* Whatsapp : https://whatsapp.com/..
*/

//~~~~~~~~~~~~< GLOBAL SETTINGS >~~~~~~~~~~~~\\

// KALO ADA YANG EROR 𝗖𝗛𝗔𝗧 𝗡𝗢 𝗜𝗡𝗜 𝗨𝗡𝗧𝗨𝗞 𝗕𝗔𝗡𝗧𝗨𝗔𝗡 
// +62 851-9634-5835 // 𝗖𝗦

global.owner = ["6288242935717"] // ['628','628'] 2 owner atau lebih
global.author = 'Renx'
global.botname = 'Bot'
global.packname = 'By'
global.timezone = 'Asia/Jakarta' // Ganti pakai command .settimezone
global.locale = 'en' // Ganti pakai command .setlocale
global.listprefix = [","]
global.defaultAdminKey = crypto.randomBytes(5).toString("hex");

global.listv = ['•','●','■','✿','▲','➩','➢','➣','➤','✦','✧','△','❀','○','□','♤','♡','◇','♧','々','〆']
global.tempatDB = 'database.json' // Taruh url mongodb/mysql/postgres di sini jika pakai db online. Format : 'mongodb+srv://...' / 'mysql://...' / 'postgres://...'
global.tempatStore = 'baileys_store.json' // Taruh url mongodb/mysql/postgres di sini jika pakai db online. Format : 'mongodb+srv://...' / 'mysql://...' / 'postgres://...'
global.pairing_code = true
global.number_bot = '6288242935717' // Kalo pake panel bisa masukin nomer di sini, jika belum ambil session. Format : '628xx'

global.fake = {
	anonim: 'https://telegra.ph/file/95670d63378f7f4210f03.png',
	thumbnailUrl: 'https://telegra.ph/file/fe4843a1261fc414542c4.jpg',
	thumbnail: fs.readFileSync('./src/media/xync.png'),
	docs: fs.readFileSync('./src/media/fake.pdf'),
	listfakedocs: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/pdf'],
}

global.my = {
	yt: "https://youtube.com/...",
	gh: "https://github.com/...",
	gc: "https://chat.whatsapp.com...",
	ch: "120363408193878462@newsletter"
}

global.limit = {
	free: 5,
	premium: 999,
	vip: 900
}

global.money = {
	free: 10000,
	premium: 1000000,
	vip: 10000000
}

global.mess = {
	key: "Apikey limit!",
	owner: "Khusus Owner!",
	admin: "Khusus Admin!",
	botAdmin: "Bot harus Admin!",
	onWa: "Nomor tersebut tidak terdaftar di WhatsApp!",
	group: "Khusus Grup!",
	private: "Khusus Private Chat!",
	quoted: "Reply pesannya!",
	limit: "Limit habis!",
	prem: "Khusus Premium!",
	text: "Masukkan teksnya!",
	media: "Kirim medianya!",
	wait: "Proses...",
	fail: "Gagal!",
	error: "Error!",
	done: "Done!"
}

global.APIs = {
	xync: 'https://api.naze.biz.id',
	neosantara: 'https://api.neosantara.xyz/v1',
}
global.APIKeys = {
	'https://api.naze.biz.id': 'nz-298327ff62',
	'https://api.neosantara.xyz/v1': 'API_KEY_NEOSANTARA_AI',
	vercel: "Token_Vercel",
	groq: "Apikey_Groq"
}

// Lainnya
global.jadwalSholat = {
	Subuh: '04:30',
	Dzuhur: '12:06',
	Ashar: '15:21',
	Maghrib: '18:08',
	Isya: '19:00'
}

global.badWords = ["dongo","konsol"] // input kata-kata toxic yg lain. ex: ['dongo','dongonya']
global.chatLength = 1000

fs.watchFile(__filename, async () => {
	console.log(chalk.yellowBright(`[UPDATE] ${__filename}`))
});