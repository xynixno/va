import '../settings.js';
import fs from 'fs';
import toMs from 'ms';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

class MongoDB {
	constructor(url = global.tempatDB, options = { useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 5000 }) {
		this.url = url
		this._model = null
		this.options = options
		this.isConnecting = false
		this.isReconnecting = false
		
		mongoose.connection.on('disconnected', async () => {
			if (this.isReconnecting) return
			this.isReconnecting = true
			console.warn('❗ MongoDB connection lost. Attempting to reconnect in 5 seconds...');
			await new Promise(resolve => setTimeout(resolve, 5000));
			await this.connect();
		});
	}
	
	connect = async (retries = 5, delay = 2000) => {
		if (mongoose.connection.readyState === 1 || this.isConnecting) {
			console.log('✅ MongoDB is already connected.');
			return;
		}
		this.isConnecting = true;
		while (retries > 0) {
			try {
				console.log(`🔄 Attempting to connect to MongoDB... (Attempt ${6 - retries}/5)`);
				if (mongoose.connection.readyState === 0) {
					await mongoose.connect(this.url, { ...this.options });
				}
				if (!this._model) {
					const schema = new mongoose.Schema({
						data: { type: Object, required: true, default: {} }
					})
					this._model = mongoose.models.data || mongoose.model('data', schema);
				}
				console.log('✅ Successfully connected to MongoDB.');
				this.isConnecting = false;
				this.isReconnecting = false;
				return;
			} catch (e) {
				console.error(`❌ MongoDB connection failed: ${e.message}`);
				await new Promise((res) => setTimeout(res, delay));
				retries--;
			}
		}
		this.isConnecting = false;
		throw new Error('❌ MongoDB connection failed after multiple attempts.');
	}
	
	read = async () => {
		if (mongoose.connection.readyState !== 1 && !this.isConnecting) {
			await this.connect();
		}
		let doc = await this._model.findOne({});
		if (!doc) {
			doc = new this._model({ data: {} });
			await doc.save();
		}
		try {
			return JSON.parse(doc.data);
		} catch {
			return doc.data || {};
		}
	}
	
	write = async (data) => {
		if (!data) return;
		if (mongoose.connection.readyState !== 1 && !this.isConnecting) {
			await this.connect();
		}
		const safeData = JSON.stringify(data, (key, value) => {
			if (typeof value === 'object' && value !== null && value._id) {
				return undefined;
			}
			if (typeof value === 'bigint') {
				return value.toString();
			}
			return value;
		});
		await this._model.findOneAndUpdate({}, { data: safeData }, { upsert: true, new: true, setDefaultsOnInsert: true });
	}
}

class JsonDB {
	constructor(file = global.tempatDB) {
		this.data = {}
		this.file = path.join(process.cwd(), 'database', file);
		this.isWriting = false;
		this.writePending = false;
	}
	
	_fileExists = async (filePath) => {
		try {
			await fs.promises.access(filePath);
			return true;
		} catch {
			return false;
		}
	}
	
	read = async () => {
		let data;
		const isExist = await this._fileExists(this.file);
		if (isExist) {
			try {
				const rawData = await fs.promises.readFile(this.file, 'utf-8');
				data = JSON.parse(rawData);
			} catch(e) {
				const isBakExist = await this._fileExists(this.file + '.bak');
				if (isBakExist) {
					const rawBakData = await fs.promises.readFile(this.file + '.bak', 'utf-8');
					data = JSON.parse(rawBakData);
					await fs.promises.writeFile(this.file, JSON.stringify(data, null, 2));
				} else {
					data = this.data;
					await fs.promises.writeFile(this.file, JSON.stringify(this.data, null, 2));
				}
			}
		} else {
			data = this.data;
			await fs.promises.mkdir(path.dirname(this.file), { recursive: true });
			await fs.promises.writeFile(this.file, JSON.stringify(this.data, null, 2));
		}
		return data;
	}
	
	write = async (data) => {
		this.data = data || global.db || {};
		if (this.isWriting) {
			this.writePending = true;
			return;
		}
		this.isWriting = true;
		try {
			let dirname = path.dirname(this.file);
			const isDirExist = await this._fileExists(dirname);
			if (!isDirExist) {
				await fs.promises.mkdir(dirname, { recursive: true });
			}
			const isFileExist = await this._fileExists(this.file);
			if (isFileExist) {
				await fs.promises.copyFile(this.file, this.file + '.bak');
			}
			if (Object.keys(this.data).length > 0) {
				const safeData = JSON.stringify(this.data, (key, value) => {
					if (typeof value === 'bigint') {
						return value.toString();
					}
					return value;
				}, 2);
				await fs.promises.writeFile(this.file, safeData);
			}
		} catch (e) {
			console.error('❌ Write Database failed: ', e);
		} finally {
			this.isWriting = false;
			if (this.writePending) {
				this.writePending = false;
				await this.write(this.data);
			}
		}
	}
}

class SqlDB {
	constructor(url) {
		this.url = url
		this.client = null
		this.queryClient = null
		this.isConnecting = false
		this.dialect = /^mysql:\/\//i.test(url) ? 'mysql' : 'postgres'
		this.tableName = 'bot_database'
	}

	_isSslEnabled = () => typeof this.url === 'string' && (/tidbcloud|psdb|planetscale|supabase|neon|heroku|render|azure|rds\.amazonaws|cloud|aiven/i.test(this.url) || /ssl=true|tls=true|sslmode=require/i.test(this.url))

	connect = async () => {
		if (this.queryClient || this.isConnecting) return;
		this.isConnecting = true;
		try {
			if (this.dialect === 'mysql') {
				let mysql;
				try {
					mysql = await import('mysql2/promise');
				} catch {
					throw new Error("Module 'mysql2' belum terpasang! Jalankan: npm install mysql2");
				}
				const useSsl = this._isSslEnabled();
				this.client = mysql.createPool({
					uri: this.url,
					...(useSsl ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } : {})
				});
				await this.client.execute(`CREATE TABLE IF NOT EXISTS \`${this.tableName}\` (id INT AUTO_INCREMENT PRIMARY KEY, data JSON NOT NULL)`);
				this.queryClient = async (sql, params) => this.client.execute(sql, params);
			} else {
				let pg;
				try {
					pg = await import('pg');
				} catch {
					throw new Error("Module 'pg' belum terpasang! Jalankan: npm install pg");
				}
				const useSsl = this._isSslEnabled();
				this.client = new pg.Pool({
					connectionString: this.url,
					...(useSsl ? { ssl: { rejectUnauthorized: false } } : {})
				});
				await this.client.query(`CREATE TABLE IF NOT EXISTS ${this.tableName} (id SERIAL PRIMARY KEY, data JSONB NOT NULL)`);
				this.queryClient = async (sql, params) => this.client.query(sql, params);
			}
			console.log(`✅ Successfully connected to ${this.dialect === 'mysql' ? 'MySQL' : 'PostgreSQL'}.`);
		} catch (e) {
			this.isConnecting = false;
			console.error(`❌ ${this.dialect} connection failed: ${e.message}`);
			throw e;
		}
		this.isConnecting = false;
	}

	read = async () => {
		if (!this.queryClient) await this.connect();
		const placeholder = this.dialect === 'mysql' ? `SELECT data FROM \`${this.tableName}\` LIMIT 1` : `SELECT data FROM ${this.tableName} LIMIT 1`;
		const result = await this.queryClient(placeholder);
		const rows = this.dialect === 'mysql' ? result[0] : result.rows;
		if (!rows || !rows.length) {
			const insertSql = this.dialect === 'mysql' ? `INSERT INTO \`${this.tableName}\` (data) VALUES (?)` : `INSERT INTO ${this.tableName} (data) VALUES ($1)`;
			await this.queryClient(insertSql, [this.dialect === 'mysql' ? '{}' : {}]);
			return {};
		}
		const data = rows[0].data;
		try {
			return typeof data === 'string' ? JSON.parse(data) : data;
		} catch {
			return data || {};
		}
	}

	write = async (data) => {
		if (!data) return;
		if (!this.queryClient) await this.connect();
		const safeData = JSON.stringify(data, (key, value) => {
			if (typeof value === 'bigint') return value.toString();
			return value;
		});
		if (this.dialect === 'mysql') {
			const [rows] = await this.queryClient(`SELECT id FROM \`${this.tableName}\` LIMIT 1`);
			if (rows.length) {
				await this.queryClient(`UPDATE \`${this.tableName}\` SET data = ? WHERE id = ?`, [safeData, rows[0].id]);
			} else {
				await this.queryClient(`INSERT INTO \`${this.tableName}\` (data) VALUES (?)`, [safeData]);
			}
		} else {
			const { rows } = await this.queryClient(`SELECT id FROM ${this.tableName} LIMIT 1`);
			if (rows.length) {
				await this.queryClient(`UPDATE ${this.tableName} SET data = $1 WHERE id = $2`, [safeData, rows[0].id]);
			} else {
				await this.queryClient(`INSERT INTO ${this.tableName} (data) VALUES ($1)`, [safeData]);
			}
		}
	}
}

const dataBase = (source) => {
	if (/^mongodb(\+srv)?:\/\//i.test(source)) {
		return new MongoDB(source);
	}
	if (/^mysql:\/\//i.test(source) || /^postgres(ql)?:\/\//i.test(source)) {
		return new SqlDB(source);
	}
	return new JsonDB(source);
}

const cmdAdd = (hit) => {
	if (hit && !hit.totalcmd) {
		hit.totalcmd = 0;
	}
	if (hit && !hit.todaycmd) {
		hit.todaycmd = 0;
	}
	hit.totalcmd++;
	hit.todaycmd++;
}
const cmdDel = (hit) => {
	hit.todaycmd = 0
}

const cmdAddHit = (hit, feature) => {
	if (hit && !hit[feature]) {
		hit[feature] = 0;
	}
	if (hit) hit[feature]++;
}

const addExpired = ({ id, expired, ...options }, _dir) => {
	const _cek = _dir.find((a) => a.id == id);
	if (_cek) {
		_cek.expired = _cek.expired + toMs(expired);
	} else {
		_dir.push({ id, expired: Date.now() + toMs(expired), ...options });
	}
};

const getPosition = (id, _dir) => _dir.findIndex(a => a.id === id || a.url === id);

const getExpired = (id, _dir) => _dir.find(a => a.id === id || a.url === id)?.expired;

const getStatus = (id, _dir) => _dir.find(a => a.id === id || a.url === id);

const checkStatus = (id, _dir) => _dir.some(a => a.id === id || a.url === id);

const getAllExpired = (_dir) => _dir.map(a => a.id);

const checkExpired = (_dir, conn) => {
	setInterval(() => {
		for (let i = _dir.length - 1; i >= 0; i--) {
			if (Date.now() >= _dir[i].expired) {
				if (conn) {
					conn.groupLeave(_dir[i].id).catch(e => {});
				}
				console.log(`Expired: ${_dir[i].id}`);
				_dir.splice(i, 1);
			}
		}
	}, 5 * 60 * 1000);
};

export {
	dataBase,
	cmdAdd,
	cmdDel,
	cmdAddHit,
	addExpired,
	getPosition,
	getStatus,
	getExpired,
	checkStatus,
	getAllExpired,
	checkExpired
};