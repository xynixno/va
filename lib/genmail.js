import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export class TemporaryMail {
	constructor() {
		this.baseUrl = "https://generator.email";
		this.cookieJar = new Map();
		this.headers = {
			"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
			"accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
			"cache-control": "no-cache",
			"pragma": "no-cache",
			"user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36"
		};
		this.email = null;
		this.domains = [];
		
		try {
			this.cheerio = require('cheerio');
		} catch (e) {
			console.error('Modul cheerio belum diinstal!');
		}
	}

	_clean(text) {
		return text ? text.replace(/\s+/g, " ").trim() : "";
	}

	_updateCookies(response) {
		const setCookie = response.headers.getSetCookie 
			? response.headers.getSetCookie() 
			: [response.headers.get("set-cookie")].filter(Boolean);

		setCookie.forEach(cookieStr => {
			if (!cookieStr) return;
			const parts = cookieStr.split(";")[0].split("=");
			if (parts.length >= 2) {
				this.cookieJar.set(parts[0].trim(), parts.slice(1).join("=").trim());
			}
		});
	}

	_getCookieHeader() {
		return Array.from(this.cookieJar.entries())
			.map(([k, v]) => `${k}=${v}`)
			.join("; ");
	}

	_setCookie(name, value) {
		this.cookieJar.set(name, value);
	}

	_parseDomains($) {
		const domains = [];
		$("#newselect .tt-suggestion p").each((i, el) => {
			const domain = $(el).attr("id");
			if (domain) domains.push(domain);
		});
		return domains;
	}

	async create() {
		if (!this.cheerio) throw new Error("Modul cheerio belum diinstal! Ketik di terminal: npm install cheerio");
		try {
			const headers = { ...this.headers };
			const cookieHeader = this._getCookieHeader();
			if (cookieHeader) headers["cookie"] = cookieHeader;

			const res = await fetch(`${this.baseUrl}/email-generator`, {
				method: "GET",
				headers
			});

			this._updateCookies(res);
			const html = await res.text();
			const $ = this.cheerio.load(html);

			const user = $("#userName").val();
			const domain = $("#domainName2").val();

			if (!user || !domain) {
				throw new Error("Failed to init email - No user/domain found");
			}

			this.email = `${user}@${domain}`.toLowerCase();
			const path = `${domain.toLowerCase()}/${user.replace(/[^a-zA-Z_0-9.-]/g, "").toLowerCase()}`;
			this.domains = this._parseDomains($);

			this._setCookie("surl", path);
			this._setCookie("embx", encodeURIComponent(JSON.stringify([this.email])));

			try {
				const regHeaders = {
					...this.headers,
					"content-type": "application/x-www-form-urlencoded; charset=UTF-8",
					"x-requested-with": "XMLHttpRequest",
					"cookie": this._getCookieHeader()
				};

				const regRes = await fetch(`${this.baseUrl}/check_adres_validation3.php`, {
					method: "POST",
					headers: regHeaders,
					body: `usr=${encodeURIComponent(user)}&dmn=${encodeURIComponent(domain)}`
				});
				this._updateCookies(regRes);
			} catch (err) {}

			return {
				success: true,
				email: {
					address: this.email,
					username: user,
					domain: domain
				},
				urls: {
					inbox: `${this.baseUrl}/${path}`,
					refresh: `${this.baseUrl}/${path}`,
					path: path
				},
				domains: this.domains,
				timestamp: new Date().toISOString()
			};
		} catch (e) {
			throw new Error(`Create failed: ${e.message}`);
		}
	}

	async message({ email = this.email } = {}) {
		if (!this.cheerio) throw new Error("Modul cheerio belum diinstal! Ketik di terminal: npm install cheerio");
		if (!email) throw new Error("Email required");
		try {
			const [user, domain] = email.split("@");
			const path = `${domain.toLowerCase()}/${user.replace(/[^a-zA-Z_0-9.-]/g, "").toLowerCase()}`;

			this._setCookie("surl", path);
			this._setCookie("embx", encodeURIComponent(JSON.stringify([email])));

			const headers = {
				...this.headers,
				"cookie": this._getCookieHeader()
			};

			const res = await fetch(`${this.baseUrl}/${path}`, {
				method: "GET",
				headers
			});

			this._updateCookies(res);
			const html = await res.text();
			const $ = this.cheerio.load(html);

			const count = parseInt($("#mess_number").text()) || 0;
			const status = this._clean($("#checkdomainset").text());
			let uptime = null;
			const uptimeMatch = status.match(/uptime (\d+) days?/);
			if (uptimeMatch) uptime = parseInt(uptimeMatch[1]);

			const settings = {
				sound: $("#toggler-1").prop("checked") || false,
				sld: $("#toggler-2").prop("checked") || false,
				popup: $("#toggler-3").prop("checked") || false
			};

			const domains = this._parseDomains($);
			const messages = [];

			$("#email-table > .list-group-item:not(.active):not(script):not(ins)").each((i, el) => {
				const $el = $(el);
				if ($el.is(".adsbygoogle") || $el.find(".adsbygoogle").length) return;
				if ($el.find(".from_div_45g45gg").length > 0) {
					messages.push({
						id: i + 1,
						from: this._clean($el.find(".from_div_45g45gg").text()),
						subject: this._clean($el.find(".subj_div_45g45gg").text()),
						time: this._clean($el.find(".time_div_45g45gg").text()),
						hasDetail: $el.next().hasClass("row")
					});
				}
			});

			const $detail = $("#email-table > .list-group-item.row");
			if ($detail.length > 0 && messages.length > 0) {
				const msg = messages[0];
				const spans = $detail.find("span");
				const header = {
					to: this._clean(spans.eq(1).text()),
					from: this._clean(spans.eq(3).text().split("(")[0].trim()),
					subject: this._clean($detail.find("h1").text()),
					received: this._clean(spans.eq(7).text()),
					created: null
				};

				const senderLink = spans.eq(3).find("a").attr("href");
				if (senderLink) {
					header.sender_info = senderLink.startsWith("http") ? senderLink : `https:${senderLink}`;
				}

				const tooltip = $detail.find(".has-tooltip .tooltip").text();
				if (tooltip) {
					const createdMatch = tooltip.match(/Created: (.+)/);
					if (createdMatch) header.created = createdMatch[1].trim();
				}

				const bodyEl = $detail.find(".mess_bodiyy");
				const bodyText = this._clean(bodyEl.text());
				const bodyHtml = bodyEl.html() || "";

				const links = [];
				bodyEl.find("a").each((_, a) => {
					const href = $(a).attr("href");
					if (href) links.push({ url: href, text: this._clean($(a).text()) });
				});

				const images = [];
				bodyEl.find("img").each((_, img) => {
					const src = $(img).attr("src");
					if (src) images.push({ src: src, alt: $(img).attr("alt") || "" });
				});

				msg.detail = {
					header: header,
					body: {
						text: bodyText,
						html: bodyHtml
					},
					links: links,
					images: images
				};

				msg.from = header.from;
				msg.subject = header.subject;
				msg.time = header.received;
			}

			return {
				success: true,
				timestamp: new Date().toISOString(),
				inbox: {
					email: this._clean($("#email_ch_text").text()) || email,
					user: user,
					domain: domain,
					count: count,
					status: status,
					uptime: uptime
				},
				urls: {
					inbox: `${this.baseUrl}/${path}`,
					refresh: `${this.baseUrl}/${path}`,
					new: `${this.baseUrl}/email-generator`
				},
				settings: settings,
				domains: domains.length > 0 ? domains : this.domains,
				messages: {
					total: messages.length,
					list: messages
				}
			};
		} catch (error) {
			throw error;
		}
	}
}