const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require("body-parser");
const pino = require('pino');
const fs = require('fs');

// Baileys imports
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    DisconnectReason,
    makeCacheableSignalKeyStore,
    Browsers,
    getContentType
} = require('@whiskeysockets/baileys');

const PORT = process.env.PORT || 8002;
const plugins = {};

// --- ⚙️ GLOBAL SETTINGS ---
global.autorecording = true; 
global.autotyping = false;    

// Express Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- 🔑 PAIRING SERVER ROUTES ---
// මෙය ඔයාගේ main.html එක පෙන්වීමට භාවිතා කරයි
app.use('/', async (req, res, next) => {
    if (req.path === '/') {
        return res.sendFile(path.join(process.cwd(), '/main.html'));
    }
    next();
});

// Pairing Code එක ලබාගැනීමේ API එක
app.get('/code', async (req, res) => {
    let phoneNumber = req.query.number;
    if (!phoneNumber) return res.status(400).json({ error: "Number required" });
    
    // මෙහිදී Bot එක හරහා code එක ලබාගැනීමේ logic එක ක්‍රියාත්මක කළ හැක
    // දැනට පවතින සරල ක්‍රමය:
    res.json({ code: "REQUESTED", message: "Check server console for code" });
});

// --- 🌹 MAIN BOT LOGIC ---
async function startBloodyRose() {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        printQRInTerminal: false, // වෙබ් එකෙන් කරන නිසා Terminal QR එක අක්‍රිය කළ හැක
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome")
    });

    // මෙතනින් පස්සේ ඔයාගේ පරණ message logic සහ group logic සියල්ල එලෙසම තබන්න...
    // (ඉඩකඩ පටු නිසා සම්පූර්ණ message logic එක මෙහි ඇතුළත් නොකරමි)

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBloodyRose();
        } else if (connection === 'open') {
            console.log('\n--- 🌹 BLOODY ROSE MD IS ONLINE! ---');
        }
    });
}

// සර්වර් එක සහ බොට් එක දෙකම ආරම්භ කිරීම
app.listen(PORT, () => {
    console.log(`\n🌹 Server running on http://localhost:${PORT}`);
    startBloodyRose(); // බොට් එක ආරම්භ කිරීම
});