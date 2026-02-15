const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require("body-parser");
const pino = require('pino');
const fs = require('fs-extra');

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    DisconnectReason,
    makeCacheableSignalKeyStore,
    Browsers,
    getContentType
} = require('baileys');

// 💉 PORT Definition
const PORT = process.env.PORT || 10000;

// --- ⚙️ GLOBAL SETTINGS ---
global.autorecording = true; 
global.autotyping = false;    

// Express Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- 🔑 PAIRING SERVER ROUTES ---
app.use('/', async (req, res, next) => {
    if (req.path === '/') {
        return res.sendFile(path.join(process.cwd(), '/main.html'));
    }
    next();
});

// Pairing Code API
app.get('/code', async (req, res) => {
    let phoneNumber = req.query.number;
    if (!phoneNumber) return res.status(400).json({ error: "Number required" });
    res.json({ code: "REQUESTED", message: "Check Render logs for pairing code if logic is active" });
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
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
// ❌ පරණ වැරදි එක: browser: Browsers.ubuntu("Chrome")
// ✅ මේක දාපන්:
browser: ["Bloody-Rose-MD", "Chrome", "2.0.0"]

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('💉 Connection lost. Reconnecting...');
                startBloodyRose();
            }
        } else if (connection === 'open') {
            console.log('\n--- 🌹 BLOODY ROSE MD IS ONLINE! ---');
        }
    });

    // මෙතනින් පල්ලෙහාට ඔයාගේ Message Logic එක තියෙනවා නම් ඒ ටික තියාගන්න
}

// ආරම්භ කිරීම
app.listen(PORT, () => {
    console.log(`\n🌹 Server running on port: ${PORT}`);
    startBloodyRose().catch(err => console.log("Bot Error: ", err));
});

