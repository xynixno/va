import { werewolf } from '../lib/werewolf.js';

export default {
	name: ['werewolf', 'ww'],
	execute: async (xync, m, args, text) => {
		try {
			await werewolf(xync, m.prefix, m, args);
		} catch (error) {
			console.error('[WEREWOLF ERROR]', error);
			m.reply('Terjadi kesalahan pada game Werewolf.');
		}
	}
}
