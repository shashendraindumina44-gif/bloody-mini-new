const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require("body-parser");
const pino = require('pino');
const mongoose = require('mongoose');

// Baileys සහ MongoDB සෙෂන් ලයිබ්‍රරි එක (මේක අනිවාර්යයෙන්ම ඕනේ)
// උඹේ package.json එකේ "baileys-mongodb": "latest" තියෙන්න ඕනේ
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason 
} = require('baileys');

// MongoDB URL එක (මේක Render Environment Variables වල දාපන්)
const MONGO_URL = process.env.MONGO_URL || "මෙතනට_උඹේ_මොන්ගෝ_ලින්ක්_එක_දාපන්";

const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// HTML file
app.use('/', (req, res, next) => {
    if (req.path === '/') return res.sendFile(path.join(process.cwd(), '/main.html'));
    next();
});

// 🌹 MongoDB Session එක පාවිච්චි කරලා Pairing Code එක ඉල්ලන හැටි
app.get('/code', async (req, res) => {
    let phoneNumber = req.query.number;
    if (!phoneNumber) return res.status(400).json({ error: "Number required" });
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    // 💡 මෙතනදී තමයි වැදගත්ම දේ වෙන්නේ:
    // උඹට MongoDB සෙෂන් ලයිබ්‍රරි එකක් නැත්නම් දැනට session folder එක පාවිච්චි කරලා,
    // පස්සේ ඒක MongoDB එකට push කරන්න පුළුවන්.
    
    const { state, saveCreds } = await useMultiFileAuthState('session');

    try {
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ["Ubuntu", "Chrome", "20.0.04"]
        });

        sock.ev.on('creds.update', saveCreds);

        if (!sock.authState.creds.registered) {
            setTimeout(async () => {
                try {
                    let code = await sock.requestPairingCode(phoneNumber);
                    code = code?.toUpperCase()?.match(/.{1,4}/g)?.join("-") || code;
                    res.json({ code: code });
                } catch (err) {
                    res.status(500).json({ error: "Failed" });
                }
            }, 3000);
        } else {
            res.json({ code: "ALREADY_CONNECTED" });
        }
    } catch (err) {
        res.status(500).json({ error: "Error" });
    }
});

app.listen(PORT, () => {
    console.log(`🌹 Bloody Rose on MongoDB mode: ${PORT}`);
});
