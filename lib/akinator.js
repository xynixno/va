import * as cheerio from 'cheerio';

let gotScraping;
async function loadGotScraping() {
    if (!gotScraping) {
        const mod = await import('got-scraping');
        gotScraping = mod.gotScraping;
    }
    return gotScraping;
}

const BASE_URL = 'https://id.akinator.com';
const THEMES = { characters: 1, animals: 14, objects: 2 };
const ANSWERS = { yes: 0, no: 1, idk: 2, probably: 3, 'probably not': 4 };

export function info() {
    return {
        status: true,
        name: 'Akinator Indonesia Scraper',
        version: '1.0.0',
        author: 'ScrapeBot',
        website: 'https://id.akinator.com',
        themes: THEMES,
        answers: ANSWERS,
        language: 'id'
    };
}

export async function start(childMode = false) {
    const got = await loadGotScraping();
    const jar = {};

    const homeRes = await got({ url: BASE_URL + '/', throwHttpErrors: false });

    const setCookies = homeRes.headers['set-cookie'];
    if (setCookies) {
        for (const c of setCookies) {
            const [kv] = c.split(';');
            const [k, v] = kv.split('=');
            jar[k.trim()] = v.trim();
        }
    }

    const cookieStr = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

    const res = await got({
        url: BASE_URL + '/game',
        method: 'POST',
        form: { sid: THEMES.characters, cm: String(childMode) },
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'cookie': cookieStr
        },
        throwHttpErrors: false
    });

    const newCookies = res.headers['set-cookie'];
    if (newCookies) {
        for (const c of newCookies) {
            const [kv] = c.split(';');
            const [k, v] = kv.split('=');
            jar[k.trim()] = v.trim();
        }
    }

    const $ = cheerio.load(res.body);
    const question = $('#question-label').text().trim();

    const sessionMatch = res.body.match(/name="session"[^>]*value="([^"]+)"/);
    const signatureMatch = res.body.match(/name="signature"[^>]*value="([^"]+)"/);
    const session = sessionMatch ? sessionMatch[1] : null;
    const signature = signatureMatch ? signatureMatch[1] : null;

    let akitude = 'defi.png';
    const akitudeMatch = res.body.match(/akitude[^"]*"[^"]*([^/]+\.png)"/);
    if (akitudeMatch) akitude = akitudeMatch[1];

    if (!session || !signature) {
        return { status: false, error: 'Gagal extract session/signature' };
    }

    return { status: true, session, signature, question, step: 0, progression: 0, akitude };
}

export async function answer(session, signature, step, progression, ans, childMode = false) {
    const got = await loadGotScraping();
    const answerId = typeof ans === 'number' ? ans : (ANSWERS[ans.toLowerCase()] ?? -1);

    if (answerId === -1) {
        return { status: false, error: `Jawaban tidak valid.` };
    }

    const res = await got({
        url: BASE_URL + '/answer',
        method: 'POST',
        form: {
            step: String(step),
            progression: String(progression),
            sid: String(THEMES.characters),
            cm: String(childMode),
            answer: String(answerId),
            session,
            signature
        },
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        throwHttpErrors: false
    });

    let data;
    try {
        data = JSON.parse(res.body);
    } catch (e) {
        return { status: false, error: 'Gagal parse response' };
    }

    if (data.completion === 'KO') {
        return { status: false, error: 'Session expired atau tebakan sudah melewati batas' };
    }

    if (data.id_proposition) {
        return {
            status: true,
            won: true,
            name: data.name_proposition,
            description: data.description_proposition,
            photo: data.photo,
            pseudo: data.pseudo
        };
    }

    return {
        status: true,
        won: false,
        question: data.question,
        step: parseInt(data.step),
        progression: parseFloat(data.progression),
        akitude: data.akitude
    };
}

export async function back(session, signature, step, progression, childMode = false) {
    const got = await loadGotScraping();
    const res = await got({
        url: BASE_URL + '/cancel_answer',
        method: 'POST',
        form: {
            step: String(step),
            progression: String(progression),
            sid: String(THEMES.characters),
            cm: String(childMode),
            session,
            signature
        },
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        throwHttpErrors: false
    });

    let data;
    try {
        data = JSON.parse(res.body);
    } catch (e) {
        return { status: false, error: 'Gagal parse response' };
    }

    return {
        status: true,
        question: data.question,
        step: parseInt(data.step),
        progression: parseFloat(data.progression),
        akitude: data.akitude
    };
}
