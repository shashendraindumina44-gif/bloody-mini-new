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
    makeCacheableSignalKeyStore,
    Browsers
} = require('baileys');

const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// HTML file එක පෙන්වීම
app.use('/', async (req, res, next) => {
    if (req.path === '/') {
        return res.sendFile(path.join(process.cwd(), '/main.html'));
    }
    next();
});

// 🌹 පේයරින් කෝඩ් එක වෙබ් එකට ලබාදෙන Logic එක
app.get('/code', async (req, res) => {
    let phoneNumber = req.query.number;
    if (!phoneNumber) return res.status(400).json({ error: "Number required" });

    // තාවකාලිකව auth state එකක් හදාගන්නවා code එක ඉල්ලන්න
    const { state, saveCreds } = await useMultiFileAuthState('session');
    
    try {
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ["Ubuntu", "Chrome", "20.0.04"]
        });

        // බොට් දැනටමත් register වෙලා නැත්නම් විතරක් code එක ඉල්ලනවා
        if (!sock.authState.creds.registered) {
            setTimeout(async () => {
                try {
                    let code = await sock.requestPairingCode(phoneNumber);
                    code = code?.toUpperCase()?.match(/.{1,4}/g)?.join("-") || code;
                    
                    // මෙතනින් තමයි වෙබ් එකට "REQUESTED" වෙනුවට ඇත්තම code එක යවන්නේ
                    res.json({ code: code });
                } catch (err) {
                    console.error(err);
                    res.status(500).json({ error: "Failed to generate pairing code" });
                }
            }, 3000); // Socket එක connect වෙනකම් තත්පර 3ක් ඉන්නවා
        } else {
            res.json({ code: "ALREADY_CONNECTED", message: "Bot is already linked!" });
        }
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// --- 🌹 MAIN BOT STARTUP ---
async function startBloodyRose() {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    // මෙතන ඔයාගේ සාමාන්‍ය බොට් logic එක තියෙන්න දෙන්න...
}

app.listen(PORT, () => {
    console.log(`\n🌹 Bloody Rose Pairing Server: http://localhost:${PORT}`);
});
