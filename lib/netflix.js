// Credit: zx

class NFTokenGenerator {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://nftoken.zone.id';
    this.timeout = options.timeout || 30000;
    this.debug = options.debug || false;
    this.headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36',
      'Referer': `${this.baseUrl}/`,
      'Accept': 'application/json',
      ...options.headers
    };
  }

  log(...args) {
    if (this.debug) {
      console.log(`[NFToken ${new Date().toISOString()}]`, ...args);
    }
  }

  async fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...this.headers, ...options.headers },
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generate() {

    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/auto-generate`, {
        method: 'POST',
        body: JSON.stringify({}) 
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Server mengembalikan success=false');
      }

      if (!data.token) {
        throw new Error('Token tidak ditemukan dalam response');
      }

      return this.formatResult(data);

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Timeout: Request melebihi ${this.timeout}ms`);
      }
      this.log('Eror:', error.message);
      throw error;
    }
  }

  formatResult(data) {
    return {
      success: true,
      token: data.token,
      expiry: data.expiry || 'Tidak diketahui',
      type: data.type || 'cookie',
      profile: {
        country: data.profile?.country || 'Tidak diketahui',
        plan: data.profile?.plan || 'Tidak diketahui'
      },
      links: {
        pc: data.links?.pc || this.buildLink('', data.token),
        android: data.links?.android || this.buildLink('unsupported', data.token),
        tv: data.links?.tv || this.buildLink('tv2', data.token)
      },
      generatedAt: new Date().toISOString(),
      raw: data
    };
  }

  buildLink(path, token) {
    const base = 'https://netflix.com/';
    const fullPath = path ? `${path}?nftoken=` : '?nftoken=';
    return `${base}${fullPath}${encodeURIComponent(token)}`;
  }

  generateLinksFromToken(token) {
    if (!token) throw new Error('Token diperlukan');
    const encodedToken = encodeURIComponent(token);
    return {
      pc: `https://netflix.com/?nftoken=${encodedToken}`,
      android: `https://netflix.com/unsupported?nftoken=${encodedToken}`,
      tv: `https://netflix.com/tv2?nftoken=${encodedToken}`,
      tv8: `https://netflix.com/tv8?nftoken=${encodedToken}` 
    };
  }

  parseExpiry(expiryStr) {
    if (!expiryStr || expiryStr === 'Tidak diketahui') return null;
    try {
      const [datePart, timePart] = expiryStr.split(', ');
      const [day, month, year] = datePart.split('/');
      const [hour, minute, second] = timePart.replace(/\./g, ':').split(':');
      return new Date(year, month - 1, day, hour, minute, second);
    } catch (error) {
      this.log('Eror', expiryStr);
      return null;
    }
  }

  isTokenValid(expiryStr) {
    const expiryDate = this.parseExpiry(expiryStr);
    if (!expiryDate) return false;
    return new Date() < expiryDate;
  }

  getTokenLifetime(expiryStr) {
    const expiryDate = this.parseExpiry(expiryStr);
    if (!expiryDate) return 0;
    const now = new Date();
    const diff = expiryDate - now;
    return Math.max(0, Math.floor(diff / 1000));
  }

  formatLifetime(seconds) {
    if (seconds <= 0) return 'Expired';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}j ${minutes}m ${secs}d`;
    if (minutes > 0) return `${minutes}m ${secs}d`;
    return `${secs}d`;
  }
}

export default NFTokenGenerator;
