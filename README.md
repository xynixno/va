## Information

<div align="center">
<a href="https://github.com/xynixno/va/watchers"><img title="Watchers" src="https://img.shields.io/github/watchers/xynixno/va?label=Watchers&color=green&style=flat-square"></a>
<a href="https://github.com/xynixno/va/network/members"><img title="Forks" src="https://img.shields.io/github/forks/xynixno/va?label=Forks&color=blue&style=flat-square"></a>
<a href="https://github.com/xynixno/va/stargazers"><img title="Stars" src="https://img.shields.io/github/stars/xynixno/va?label=Stars&color=yellow&style=flat-square"></a>
<a href="https://github.com/xynixno/va/issues"><img title="Issues" src="https://img.shields.io/github/issues/xynixno/va?label=Issues&color=success&style=flat-square"></a>
<a href="https://github.com/xynixno/va/issues?q=is%3Aissue+is%3Aclosed"><img title="Issues" src="https://img.shields.io/github/issues-closed/xynixno/va?label=Issues&color=red&style=flat-square"></a>
<a href="https://github.com/xynixno/va/pulls"><img title="Pull Request" src="https://img.shields.io/github/issues-pr/xynixno/va?label=PullRequest&color=success&style=flat-square"></a>
<a href="https://github.com/xynixno/va/pulls?q=is%3Apr+is%3Aclosed"><img title="Pull Request" src="https://img.shields.io/github/issues-pr-closed/xynixno/va?label=PullRequest&color=red&style=flat-square"></a>
</div>

This script is a modified/renamed version (**Xync**) built on top of the original script created by [Nazedev](https://github.com/nazedev) using Node.js and the [WhiskeySocket/Baileys](https://github.com/WhiskeySockets/Baileys) library. The script is currently in the development phase (BETA), so there may still be some errors that can be ignored. If errors persist even after debugging, please contact the owner for assistance.

---
## 📦 Requirements

Minimum requirements:
- **Node.js** v20 or higher
- **Git**

System dependencies (handled automatically by `install.sh`):
- ffmpeg
- imagemagick
- yarn / npm

---
## 🚀 Installation
### 1️⃣ Clone Repository
```bash
git clone https://github.com/xynixno/va
cd va
```
---
### 2️⃣ Automatic Installation (Recommended)

```bash
bash install.sh
```

This script will:
- Detect your package manager (`pkg`, `apt`, `dnf`, etc.)
- Install required system dependencies
- Install Node.js packages
- Start the bot automatically

---
## 📱 Termux (Android)
```bash
pkg update && pkg upgrade
pkg install git
pkg install nodejs
pkg install ffmpeg
pkg install imagemagick
git clone https://github.com/xynixno/va
cd va
npm install
```
[ RECOMMENDED INSTALL ON TERMUX ]
```bash
pkg install yarn
yarn
```
Use **yarn**:

```bash
yarn install
yarn start
```

> Make sure `nodejs` and `yarn` are installed. The `install.sh` script already handles this.

---
## 💻 Laptop / Ubuntu / VPS / SSH
* Download And Install Git [`Click Here`](https://git-scm.com/downloads)
* Download And Install NodeJS [`Click Here`](https://nodejs.org/en/download)
* Download And Install FFmpeg [`Click Here`](https://ffmpeg.org/download.html) (**Don't Forget Add FFmpeg to PATH enviroment variables**)
* Download And Install ImageMagick [`Click Here`](https://imagemagick.org/script/download.php)

Use **npm**:

```bash
npm install
npm start
```
---
## ▶️ Running the Bot

```bash
npm start
# or
yarn start
```

Scan the QR Code or use Pairing Code, and the bot is ready to use.

---

## 🌐 API Integration

This bot is integrated with the **Naze API Service** (third-party API this project depends on for downloader, AI tools, utilities, and media-processing features):

🔗 https://naze.biz.id

### API Key Requirement

To use all features properly, you **must provide your own API key**.

The API key is configured in:

📁 **[settings.js](https://github.com/xynixno/va/blob/main/settings.js)**  

Example configuration:

```js
global.APIKeys = {
  'https://api.naze.biz.id': 'YOUR_API_KEY_HERE'
}
```

⚠️ If the API key is invalid or not set:
- Some commands will not work
- API-based features may return errors

Make sure you register and obtain a valid API key from the official website before using the bot.

---
## ⚙️ Bot Configuration

All main configurations are located in:

📁 **[settings.js](https://github.com/xynixno/va/blob/main/settings.js)**

### Editable Settings

#### Owner Number
```js
global.owner = ['628xxxxxxxxxx']
```

#### Bot Identity
```js
global.botname = 'Xync'
global.author = 'Renx'
```

#### Command Prefix
```js
global.listprefix = ['!', '.', '+']
```

#### User Limits & Balance
```js
global.limit.free = 20
global.money.free = 10000
```

#### Pairing Code / Bot Number
```js
global.pairing_code = true
global.number_bot = '628xxxxxxxxxx'
```

> Any change in [settings.js](https://github.com/xynixno/va/blob/main/settings.js) will be **auto-reloaded** without restarting the bot.

---

## 🧩 Editing & Adding Features

All bot features are implemented in:

📁 **[xync.js](https://github.com/xynixno/va/blob/main/xync.js)**

Look for the **switch (command)** section near the top of the file.

### Where to Add New Features

Add or edit commands inside the `switch (command)` block.

### Example: Adding a New Command

```js
case 'ping': {
  reply('pong 🏓')
}
break
```

Guidelines:
- Always add new commands using `case`
- Do not remove the main switch structure
- Place feature logic inside each `case`

---

## 🔌 Connector & Core Handler

To understand the WhatsApp connection flow and event handling, see:

📁 **[index.js](https://github.com/xynixno/va/blob/main/index.js)**
This file is responsible for:
- Initializing Baileys connection
- Handling WhatsApp events
- Loading [settings.js](https://github.com/xynixno/va/blob/main/settings.js)
- Dispatching messages to [xync.js](https://github.com/xynixno/va/blob/main/xync.js)

⚠️ **Editing [index.js](https://github.com/xynixno/va/blob/main/index.js) is not recommended unless you fully understand the bot flow.**

---
## 🗂 Structure Project
```
├── Dockerfile
├── LICENSE
├── Procfile
├── README.md
├── app.json
├── database
│   ├── jadibot
│   │   └── Xync
│   └── temp
├── docker-compose.yml
├── heroku.yml
├── index.js
├── install.sh
├── lib
│   ├── converter.js
│   ├── exif.js
│   ├── function.js
│   ├── game.js
│   ├── math.js
│   ├── template_menu.js
│   ├── tictactoe.js
│   └── uploader.js
├── xync.js
├── nodemon.json
├── package.json
├── railway.json
├── replit.nix
├── settings.js
├── speed.py
├── plugins
│   ├── spotify.js
│   ├── play2.js
│   └── ...
├── src
│   ├── antispam.js
│   ├── database.js
│   ├── jadibot.js
│   ├── media
│   │   ├── fake.pdf
│   │   └── naze.png
│   ├── message.js
│   └── server.js
└── start.js
```
---
#### Deploy to Heroku
[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/xynixno/va)

#### Heroku Buildpack
| Build Pack | LINK |
|--------|--------|
| **NODEJS** | heroku/nodejs |
| **FFMPEG** | [here](https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest) |
| **IMAGEMAGICK** | [here](https://github.com/DuckyTeam/heroku-buildpack-imagemagick) |

---
### Features
| Menu     | Bot | Group | Search | Download | Tools | Ai | Game | Fun | Owner |
| -------- | --- | ----- | ------ | -------- | ----- | -- | ---- | --- | ----- |
| Work     |  ✅  |   ✅   |    ✅    |     ✅     |   ✅   | ✅ |   ✅   |  ✅  |    ✅    |


License: [MIT](https://choosealicense.com/licenses/mit/)

## Contributor

- [NazeDev](https://github.com/nazedev) (Pembuat)
- [Zaynn](https://github.com/ZaynRcK) (Penyedia Layanan API)
- [Dani](https://github.com/nazedev) (Penyumbang Code)

## Thanks to

| [![Nazedev](https://github.com/nazedev.png?size=100)](https://github.com/nazedev) | [![Zaynn](https://github.com/ZaynRcK.png?size=100)](https://github.com/ZaynRcK) | [![Dani](https://github.com/nazedev.png?size=100)](https://github.com/nazedev) | [![WhiskeySockets](https://github.com/WhiskeySockets.png?size=100)](https://github.com/WhiskeySockets) |
| --- | --- | --- | --- |
| [NazeDev](https://github.com/nazedev) | [Zaynn](https://github.com/ZaynRcK) | [Dani](https://github.com/dani) | [WhiskeySockets](https://github.com/WhiskeySockets) |
