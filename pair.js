const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const router = express.Router();
const pino = require('pino');
const moment = require('moment-timezone');
const Jimp = require('jimp');
const crypto = require('crypto');
const axios = require('axios');
const FileType = require('file-type');
const fetch = require('node-fetch');
const mongoose = require('mongoose'); // 🩸 MongoDB වැඩ වලට අනිවාර්යයි
const { MongoClient } = require('mongodb');

// 💉 THE BAILEYS ENGINE (Optimized for Render)
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    getContentType,
    jidDecode,
    downloadContentFromMessage,
    fetchLatestBaileysVersion,
    Browsers
} = require('baileys'); // 🌹 '@whiskeysockets/baileys' වෙනුවට මෙතන 'baileys' විතරක් තිබීම අනිවාර්යයි

// 🩸 GLOBAL CONFIG LOAD
const config = require('./config'); 

// 🌹 LOADING ANIMATION HELPER
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
//config file

module.exports = {
    AUTO_VIEW_STATUS: 'true',
    AUTO_LIKE_STATUS: 'true',
    AUTO_RECORDING: 'true',
    AUTO_LIKE_EMOJI: ['🌹', '💉', '🩸', '💀', '🥀', '💊', '💫', '🍂', '🌟', '🎋', '😶‍🌫️', '🫀', '🧿', '👀', '🤖', '🚩', '🥰', '🗿', '💜', '💙', '🌝', '🖤', '💚'],
    PREFIX: '.',
    MAX_RETRIES: 3,
    GROUP_INVITE_LINK: 'https://chat.whatsapp.com/BFalrJo3NQj0lq5F9GKvR5?mode=gi_t',
    ADMIN_LIST_PATH: './admin.json',
    IMAGE_PATH: 'https://files.catbox.moe/3mv4wd.jpg', // Bloody Rose Image
    NEWSLETTER_JID: '120363406176407309@newsletter',
    NEWSLETTER_MESSAGE_ID: '428',
    OTP_EXPIRY: 300000,
    NEWS_JSON_URL: '',
    BOT_NAME: '🌹 ＢＬＯＯＤＹ ＲＯＳＥ 🌹',
    OWNER_NAME: 'ＬＯＲＤ ＩＮＤＵＭＩＮＡ 💉',
    OWNER_NUMBER: '94763003966',
    BOT_VERSION: '1.0.0',
    BOT_FOOTER: '> ＢＬＯＯＤＹ ＲＯＳＥ ＢＯＴ 🥀',
    CHANNEL_LINK: 'https://whatsapp.com/channel/0029VbBjdX81XquXcMfqXz2z',
};


//mongo setup

// ---------------- MONGO SETUP (උඹේ අලුත් Setup එක) ----------------

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://indumina2011:lindumina2011@cluster0.a5nqcag.mongodb.net/';
const MONGO_DB = process.env.MONGO_DB || 'indumina2011';
let mongoClient, mongoDB;
let sessionsCol, numbersCol, adminsCol, newsletterCol, configsCol, newsletterReactsCol;

// User Configs වලට Cache එකක් (DB කියවන වාර ගණන අඩු කරන්න)
const userConfigCache = new Map();
const USER_CONFIG_CACHE_TTL = 30 * 1000; // 30 seconds

async function initMongo() {
  try {
    // දැනටමත් කනෙක්ට් වෙලාද කියලා බලනවා
    try {
      if (mongoClient && mongoClient.topology && mongoClient.topology.isConnected && mongoClient.topology.isConnected()) return;
    } catch(e){}

    mongoClient = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await mongoClient.connect();
    mongoDB = mongoClient.db(MONGO_DB);

    // Collections ටික හදනවා
    sessionsCol = mongoDB.collection('sessions');
    numbersCol = mongoDB.collection('numbers');
    adminsCol = mongoDB.collection('admins');
    newsletterCol = mongoDB.collection('newsletter_list');
    configsCol = mongoDB.collection('configs');
    newsletterReactsCol = mongoDB.collection('newsletter_reacts');

    // Index හදනවා (දත්ත වේගයෙන් සොයන්න සහ Unique කරන්න)
    await sessionsCol.createIndex({ number: 1 }, { unique: true });
    await numbersCol.createIndex({ number: 1 }, { unique: true });
    await newsletterCol.createIndex({ jid: 1 }, { unique: true });
    await newsletterReactsCol.createIndex({ jid: 1 }, { unique: true });
    await configsCol.createIndex({ number: 1 }, { unique: true });

    console.log('✅ Mongo initialized and collections ready for Bloody Rose');
  } catch (err) {
    console.error('❌ Mongo Initialization Failed:', err);
  }
}

// ---------------- MONGO HELPERS (BLOODY ROSE EDITION) ----------------

// 1. WhatsApp සෙෂන් එක (Creds) MongoDB එකේ සේව් කිරීම
async function saveCredsToMongo(number, creds, keys = null) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    const doc = { 
      number: sanitized, 
      creds, 
      keys, 
      updatedAt: new Date() 
    };
    // එකම නම්බර් එකට දත්ත තිබුණොත් Update කරයි, නැත්නම් අලුතින් Insert කරයි (Upsert)
    await sessionsCol.updateOne({ number: sanitized }, { $set: doc }, { upsert: true });
    console.log(`✅ [DB] Creds saved for: ${sanitized}`);
  } catch (e) { 
    console.error('❌ saveCredsToMongo error:', e); 
  }
}

// 2. සෙෂන් එකක් තිබේදැයි පරීක්ෂා කර එය ලබාගැනීම
async function loadCredsFromMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    const doc = await sessionsCol.findOne({ number: sanitized });
    return doc || null;
  } catch (e) { 
    console.error('❌ loadCredsFromMongo error:', e); 
    return null; 
  }
}

// 3. ලොග් අවුට් වුණොත් සෙෂන් එක මැකීම
async function removeSessionFromMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    await sessionsCol.deleteOne({ number: sanitized });
    console.log(`🗑️ [DB] Session removed for: ${sanitized}`);
  } catch (e) { 
    console.error('❌ removeSessionFromMongo error:', e); 
  }
}

// 4. බොට්ගේ Config (Settings) සේව් කිරීම (Cache එකත් සමඟ)
async function setUserConfigInMongo(number, conf) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    await configsCol.updateOne(
      { number: sanitized }, 
      { $set: { number: sanitized, config: conf, updatedAt: new Date() } }, 
      { upsert: true }
    );
    // Cache එක Update කිරීම
    userConfigCache.set(sanitized, { config: conf, ts: Date.now() });
  } catch (e) { 
    console.error('❌ setUserConfigInMongo error:', e); 
  }
}

// 5. ඇඩ්මින්ලා ලැයිස්තුව ලබාගැනීම
async function loadAdminsFromMongo() {
  try {
    await initMongo();
    const docs = await adminsCol.find({}).toArray();
    // JID එක හරි නම්බර් එක හරි අරගෙන Empty ඒවා අයින් කරයි
    return docs.map(d => d.jid || d.number).filter(Boolean);
  } catch (e) { 
    console.error('❌ loadAdminsFromMongo error:', e); 
    return []; 
  }
}

// 6. නිව්ස්ලෙටර් එකතු කිරීම (Reaction Emojis සමඟ)
async function addNewsletterToMongo(jid, emojis = []) {
  try {
    await initMongo();
    const doc = { 
      jid, 
      emojis: Array.isArray(emojis) ? emojis : [], 
      addedAt: new Date() 
    };
    await newsletterCol.updateOne({ jid }, { $set: doc }, { upsert: true });
    console.log(`📢 [DB] Newsletter added: ${jid}`);
  } catch (e) { 
    console.error('❌ addNewsletterToMongo error:', e); 
  }
}

// -------------- newsletter react-config helpers --------------

// 1. අලුතින් චැනල් එකක් ඇඩ් කරනකොට අපේ ස්ටයිල් එකේ ඉමෝජි සෙට් එකම වැටෙන්න හදමු
async function addNewsletterReactConfig(jid, emojis = ['🌹', '💉', '🩸', '💀', '🥀', '💊', '🫀', '🧿', '🖤', '🔥']) {
  try {
    await initMongo();
    // උඹේ config එකේ තියෙන ලස්සන ඉමෝජි ටික මෙතනට default එනවා
    await newsletterReactsCol.updateOne(
      { jid }, 
      { $set: { jid, emojis, addedAt: new Date() } }, 
      { upsert: true }
    );
    console.log(`✅ Added Bloody Rose react-config for ${jid}`);
  } catch (e) { 
    console.error('addNewsletterReactConfig error:', e); 
    throw e; 
  }
}

// 2. රියැක්ෂන් කොන්ෆිග් එක අයින් කිරීම
async function removeNewsletterReactConfig(jid) {
  try {
    await initMongo();
    await newsletterReactsCol.deleteOne({ jid });
    console.log(`🗑️ Removed react-config for ${jid}`);
  } catch (e) { 
    console.error('removeNewsletterReactConfig error:', e); 
    throw e; 
  }
}

// 3. සියලුම චැනල් රියැක්ෂන් ලිස්ට් එක (Default එකටත් අපේ ඉමෝජි දාමු)
async function listNewsletterReactsFromMongo() {
  try {
    await initMongo();
    const docs = await newsletterReactsCol.find({}).toArray();
    return docs.map(d => ({ 
      jid: d.jid, 
      emojis: Array.isArray(d.emojis) ? d.emojis : ['🌹', '💀', '🔥'] 
    }));
  } catch (e) { 
    console.error('listNewsletterReactsFromMongo error:', e); 
    return [{ jid: 'default', emojis: ['🌹', '💀', '🔥'] }]; 
  }
}

// 4. චැනල් එකකට අදාළ ඉමෝජි ලබාගැනීම
async function getReactConfigForJid(jid) {
  try {
    await initMongo();
    const doc = await newsletterReactsCol.findOne({ jid });
    // දත්ත නැත්නම් Bloody Rose style එකේ ඉමෝජි 3ක් default දෙනවා
    return doc ? (Array.isArray(doc.emojis) ? doc.emojis : ['🌹', '💉', '🩸']) : null;
  } catch (e) { 
    console.error('getReactConfigForJid error:', e); 
    return null; 
  }
}

// ---------------- BASIC UTILS ----------------

// මැසේජ් ලස්සනට පෝර්මැට් කරන්න (Bloody Rose Style)
function formatMessage(title, content, footer) {
  return `*${title}*\n\n${content}\n\n> *${footer}*`;
}

// ඉලක්කම් 6ක OTP එකක් හැදීම
function generateOTP() { 
  return Math.floor(100000 + Math.random() * 900000).toString(); 
}

// ලංකාවේ වෙලාව ලබාගැනීම
function getSriLankaTimestamp() { 
  return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss'); 
}

// ---------------- GLOBAL MAPS ----------------

// දැනට වැඩ කරන කනෙක්ෂන් (Socket) ටික තියාගන්න
const activeSockets = new Map();

// කනෙක්ෂන් එක පටන් ගත්ත වෙලාව (Timeouts වලට ඕන වෙයි)
const socketCreationTime = new Map();

// ජෙනරේට් කරපු OTP තාවකාලිකව සේව් කරගන්න
const otpStore = new Map();


// ---------------- helpers kept/adapted (BLOODY ROSE STYLE) ----------------

// 1. බොට්ව ඔටෝම ගෲප් එකට එකතු කරගන්නා ලොජික් එක
async function joinGroup(socket) {
  let retries = config.MAX_RETRIES;
  const inviteCodeMatch = (config.GROUP_INVITE_LINK || '').match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
  
  if (!inviteCodeMatch) return { status: 'failed', error: 'No group invite configured' };
  const inviteCode = inviteCodeMatch[1];
  
  while (retries > 0) {
    try {
      const response = await socket.groupAcceptInvite(inviteCode);
      if (response?.gid) return { status: 'success', gid: response.gid };
      throw new Error('No group ID in response');
    } catch (error) {
      retries--;
      let errorMessage = error.message || 'Unknown error';
      if (error.message && error.message.includes('not-authorized')) errorMessage = 'Bot not authorized';
      else if (error.message && error.message.includes('conflict')) errorMessage = 'Already a member';
      else if (error.message && error.message.includes('gone')) errorMessage = 'Invite invalid/expired';
      
      if (retries === 0) return { status: 'failed', error: errorMessage };
      await delay(2000 * (config.MAX_RETRIES - retries));
    }
  }
  return { status: 'failed', error: 'Max retries reached' };
}

// 2. Dashboard එකට ලොග් වෙනකොට OTP එක යවන ලොජික් එක (Fancy Style)
async function sendOTP(socket, number, otp) {
  const userJid = jidNormalizedUser(socket.user.id);
  
  // උඹේ නියම ස්ටයිල් එකට Font එක මෙන්න මෙහෙමයි එන්න ඕනේ
  const fancyMessage = `🌹 *ＢＬＯＯＤＹ ＲＯＳＥ ＯＴＰ* 🌹\n\n` +
                       `🔐 *𝐘𝐎𝐔𝐑 𝐎𝐓𝐏 𝐂𝐎𝐃𝐄:* \` ${otp} \` \n` +
                       `⏳ *𝐄𝐗𝐏𝐈𝐑𝐄𝐒 𝐈𝐍:* 𝟓 𝐌𝐈𝐍𝐔𝐓𝐄𝐒\n\n` +
                       `👤 *𝐍𝐔𝐌𝐁𝐄𝐑:* ${number}\n\n` +
                       `> *🥀 𝖯𝗈𝗐𝖾𝗋𝖾𝖽 𝖡𝗒 𝖡𝗅𝗈𝗈𝖽𝗒 𝖱𝗈𝗌𝖾 𝖬𝖣*`;

  try { 
    await socket.sendMessage(userJid, { 
      text: fancyMessage,
      contextInfo: {
        externalAdReply: {
          title: "🌹 BLOODY ROSE SECURITY SYSTEM 🌹",
          body: "OTP Verification",
          mediaType: 1,
          sourceUrl: config.CHANNEL_LINK,
          thumbnailUrl: config.IMAGE_PATH
        }
      }
    }); 
    console.log(`✅ [OTP SENT] ${otp} -> ${number}`); 
  } catch (error) { 
    console.error(`❌ [OTP ERROR] ${number}:`, error); 
    throw error; 
  }
}

// ---------------- Updated Step 09 (Admin Power Edition) ----------------

async function setupNewsletterHandlers(socket, sessionNumber) {
    const rrPointers = new Map();

    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || !message.key.remoteJid.endsWith('@newsletter')) return;
        
        const jid = message.key.remoteJid;

        try {
            await initMongo();
            
            // 1. යූසර්ගේ පෞද්ගලික සැකසුම් බලමු (ඔටෝ රියැක්ට් ඕෆ් කරලද කියලා)
            const userConf = await loadUserConfigFromMongo(sessionNumber);
            if (userConf && userConf.AUTO_LIKE_STATUS === 'false') return;

            // 2. ඇඩ්මින් (උඹ) සෙට් කරපු චැනල් ලිස්ට් එක ගමු
            const reactConfigs = await listNewsletterReactsFromMongo(); 
            const reactMap = new Map();
            for (const r of reactConfigs) reactMap.set(r.jid, r.emojis || []);

            // 3. මේ චැනල් එක අපේ "Master List" එකේ නැත්නම් රියැක්ට් කරන්නේ නැහැ
            if (!reactMap.has(jid)) return;

            // 4. ඉමෝජි තෝරාගැනීම (Admin Set කරපු ඒවා හෝ Default Bloody Rose Emojis)
            let emojis = reactMap.get(jid);
            if (!emojis || emojis.length === 0) emojis = config.AUTO_LIKE_EMOJI;

            let idx = rrPointers.get(jid) || 0;
            const emoji = emojis[idx % emojis.length];
            rrPointers.set(jid, (idx + 1) % emojis.length);

            const messageId = message.newsletterServerId || message.key.id;
            if (!messageId) return;

            // 5. රියැක්ට් කිරීමේ ක්‍රියාවලිය
            let retries = 3;
            while (retries-- > 0) {
                try {
                    await socket.newsletterReactMessage(jid, messageId.toString(), emoji);
                    console.log(`🌹 [Master Admin Command] Reacted to ${jid} with ${emoji} for user ${sessionNumber}`);
                    await saveNewsletterReaction(jid, messageId.toString(), emoji, sessionNumber);
                    break;
                } catch (err) {
                    await delay(1500);
                }
            }
        } catch (error) {
            console.error('Newsletter handler error:', error?.message);
        }
    });
}

// ---------------- BLOODY STATUS & REVOCATION HANDLERS ----------------

async function setupStatusHandlers(socket, sessionNumber) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant) return;
        
        try {
            // MongoDB එකෙන් යූසර්ගේ Configs ලෝඩ් කිරීම
            let userEmojis = config.AUTO_LIKE_EMOJI;
            let autoViewStatus = config.AUTO_VIEW_STATUS;
            let autoLikeStatus = config.AUTO_LIKE_STATUS;
            let autoRecording = config.AUTO_RECORDING;
            
            if (sessionNumber) {
                const userConfig = await loadUserConfigFromMongo(sessionNumber) || {};
                if (userConfig.AUTO_LIKE_EMOJI?.length > 0) userEmojis = userConfig.AUTO_LIKE_EMOJI;
                if (userConfig.AUTO_VIEW_STATUS !== undefined) autoViewStatus = userConfig.AUTO_VIEW_STATUS;
                if (userConfig.AUTO_LIKE_STATUS !== undefined) autoLikeStatus = userConfig.AUTO_LIKE_STATUS;
                if (userConfig.AUTO_RECORDING !== undefined) autoRecording = userConfig.AUTO_RECORDING;
            }

            // 1. Auto Recording Status
            if (autoRecording === 'true') {
                await socket.sendPresenceUpdate("recording", message.key.remoteJid);
            }
            
            // 2. Auto View Status (With Retry Logic)
            if (autoViewStatus === 'true') {
                let retries = config.MAX_RETRIES;
                while (retries-- > 0) {
                    try { await socket.readMessages([message.key]); break; }
                    catch { await delay(1500); }
                }
            }
            
            // 3. Auto Like Status (Random Emoji)
            if (autoLikeStatus === 'true') {
                const randomEmoji = userEmojis[Math.floor(Math.random() * userEmojis.length)];
                await socket.sendMessage(message.key.remoteJid, { 
                    react: { text: randomEmoji, key: message.key } 
                }, { statusJidList: [message.key.participant] });
            }
        } catch (error) { console.error('💉 [STATUS ERROR]:', error.message); }
    });
}

// ---------------- BLOODY STATUS & REVOCATION HANDLERS ----------------

async function setupStatusHandlers(socket, sessionNumber) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant) return;
        
        try {
            // MongoDB එකෙන් යූසර්ගේ Configs ලෝඩ් කිරීම
            let userEmojis = config.AUTO_LIKE_EMOJI;
            let autoViewStatus = config.AUTO_VIEW_STATUS;
            let autoLikeStatus = config.AUTO_LIKE_STATUS;
            let autoRecording = config.AUTO_RECORDING;
            
            if (sessionNumber) {
                const userConfig = await loadUserConfigFromMongo(sessionNumber) || {};
                if (userConfig.AUTO_LIKE_EMOJI?.length > 0) userEmojis = userConfig.AUTO_LIKE_EMOJI;
                if (userConfig.AUTO_VIEW_STATUS !== undefined) autoViewStatus = userConfig.AUTO_VIEW_STATUS;
                if (userConfig.AUTO_LIKE_STATUS !== undefined) autoLikeStatus = userConfig.AUTO_LIKE_STATUS;
                if (userConfig.AUTO_RECORDING !== undefined) autoRecording = userConfig.AUTO_RECORDING;
            }

            // 1. Auto Recording Status 💉
            if (autoRecording === 'true') {
                await socket.sendPresenceUpdate("recording", message.key.remoteJid);
            }
            
            // 2. Auto View Status 🩸
            if (autoViewStatus === 'true') {
                let retries = config.MAX_RETRIES;
                while (retries-- > 0) {
                    try { await socket.readMessages([message.key]); break; }
                    catch { await delay(1500); }
                }
            }
            
            // 3. Auto Like Status (Random Emoji from Rose Pool) 🌹
            if (autoLikeStatus === 'true') {
                const randomEmoji = userEmojis[Math.floor(Math.random() * userEmojis.length)];
                await socket.sendMessage(message.key.remoteJid, { 
                    react: { text: randomEmoji, key: message.key } 
                }, { statusJidList: [message.key.participant] });
            }
        } catch (error) { console.error('💉 [STATUS ERROR]:', error.message); }
    });
}

// ---------------- ANTI-DELETE (REVOCATION) ----------------

async function handleMessageRevocation(socket, number) {
    socket.ev.on('messages.delete', async ({ keys }) => {
        if (!keys || keys.length === 0) return;
        const messageKey = keys[0];
        const userJid = jidNormalizedUser(socket.user.id);
        
        const message = formatMessage(
            `💉 *ＭＥＳＳＡＧＥ ＤＥＬＥＴＥＤ*`, 
            `🩸 *Notice:* A message was revoked!\n\n` +
            `👤 *From:* ${messageKey.remoteJid.split('@')[0]}\n` +
            `⏰ *Time:* ${getSriLankaTimestamp()}\n\n` +
            `> *🌹 𝖯𝗈𝗐𝖾𝗋𝖾𝖽 𝖡𝗒 𝖫𝗈𝗋𝖽 𝖨𝗇𝖽𝗎𝗆𝗂𝗇𝖺 🗣️*`, 
            BOT_NAME_FANCY
        );

        try { 
            await socket.sendMessage(userJid, { image: { url: config.RCD_IMAGE_PATH }, caption: message }); 
        } catch (error) { console.error('🩸 [REVOCATION ERROR]:', error.message); }
    });
}

// ---------------- THE POWERFUL COMMAND PARSER ----------------

function setupCommandHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg || !msg.message || msg.key.remoteJid === 'status@broadcast') return;

        const type = getContentType(msg.message);
        let msgContent = msg.message;

        if (type === 'ephemeralMessage') {
            msgContent = msgContent.ephemeralMessage.message;
        }

        let body = '';
        try {
            if (type === 'conversation') body = msgContent.conversation;
            else if (type === 'extendedTextMessage') body = msgContent.extendedTextMessage?.text;
            else if (type === 'imageMessage') body = msgContent.imageMessage?.caption;
            else if (type === 'videoMessage') body = msgContent.videoMessage?.caption;
            else if (type === 'buttonsResponseMessage') body = msgContent.buttonsResponseMessage?.selectedButtonId;
            else if (type === 'listResponseMessage') body = msgContent.listResponseMessage?.singleSelectReply?.selectedRowId;
            else if (type === 'templateButtonReplyMessage') body = msgContent.templateButtonReplyMessage?.selectedId;
            else if (type === 'interactiveResponseMessage') {
                const paramsJson = msgContent.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
                body = paramsJson ? JSON.parse(paramsJson).id : '';
            }
            else if (type === 'viewOnceMessage' || type === 'viewOnceMessageV2') {
                const viewOnce = msgContent.viewOnceMessage?.message || msgContent.viewOnceMessageV2?.message;
                const vType = getContentType(viewOnce);
                body = viewOnce[vType]?.caption || '';
            }

            if (!body || typeof body !== 'string') return;

            const prefix = config.PREFIX;
            const isCmd = body.startsWith(prefix);
            const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : null;

            if (isCmd) {
                console.log(`🩸 [COMMAND] ${command} | Master: ${number}`);
                // මෙතනින් පස්සේ ප්ලගින් වලට වැඩේ යනවා...
            }
        } catch (e) { console.error('🌹 [PARSER ERROR]:', e); }
    });
}

// Helper: Image Resizer
async function resize(image, width, height) {
    const Jimp = require('jimp');
    let oyy = await Jimp.read(image);
    return await oyy.resize(width, height).getBufferAsync(Jimp.MIME_JPEG);
}
// 💉 Helper: Download quoted media into buffer
async function downloadQuotedMedia(quoted) {
    if (!quoted) return null;
    const qTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
    const qType = qTypes.find(t => quoted[t]);
    if (!qType) return null;

    try {
        const messageType = qType.replace(/Message$/i, '').toLowerCase();
        const stream = await downloadContentFromMessage(quoted[qType], messageType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        return {
            buffer,
            mime: quoted[qType].mimetype || '',
            caption: quoted[qType].caption || quoted[qType].fileName || '',
            ptt: quoted[qType].ptt || false,
            fileName: quoted[qType].fileName || ''
        };
    } catch (e) {
        console.error('🩸 [DOWNLOAD ERROR]:', e.message);
        return null;
    }
}

// ---------------- COMMAND PROCESSING ----------------

if (!command) return;

try {
    // 🌹 Load user config for work type restrictions
    const sanitized = (number || '').replace(/[^0-9]/g, '');
    const userConfig = await loadUserConfigFromMongo(sanitized) || {};
    
    // 🩸 Work Type Check (Public/Private/OnlyOwner)
    const workType = userConfig.WORK_TYPE || config.WORK_TYPE || 'private';
    const isOwner = config.OWNER_NUMBER.includes(sanitized);

    if (workType === 'private' && !isOwner) return; // Ignore if private and not owner
    
    console.log(`💉 [EXEC] ${command} | Master: ${sanitized} | WorkType: ${workType}`);

    // මෙතනින් පස්සේ තමයි උඹේ Case logic හෝ Plugin logic එක වැඩ කරන්නේ...
    // උදාහරණයක් විදිහට:
    // if (command === 'img') { ... }

} catch (e) {
    console.error('🩸 [CORE ERROR]:', e);
}
// ========== 💉 ADD WORK TYPE RESTRICTIONS HERE (INDUMINA EDITION) ==========

if (!isOwner) {
    // MongoDB එකෙන් හෝ Global Config එකෙන් Work Type එක ගැනීම
    const workType = userConfig.WORK_TYPE || config.WORK_TYPE || 'public';

    // 1. Private Mode: අයිතිකාරයාට විතරමයි
    if (workType === "private") {
        console.log(`💉 [BLOCKED] WORK_TYPE is private for ${sanitized}`);
        return;
    }

    // 2. Inbox Only: ගෲප් වල වැඩ කරන්නේ නැත
    if (isGroup && workType === "inbox") {
        console.log(`🩸 [BLOCKED] WORK_TYPE is inbox | Group: ${from}`);
        return;
    }

    // 3. Groups Only: පෞද්ගලික චැට් (Inbox) වල වැඩ කරන්නේ නැත
    if (!isGroup && workType === "groups") {
        console.log(`🌹 [BLOCKED] WORK_TYPE is groups | Inbox: ${from}`);
        return;
    }

    // 4. Public Mode: ඕනෑම තැනක වැඩ කරයි (No restrictions)
}

// ========== 🩸 END WORK TYPE RESTRICTIONS ==========

switch (command) {
    // --- 🌹 Commands ලියන තැන ---
    
    case 'alive':
        await socket.sendMessage(from, { 
            text: `🌹 *ＢＬＯＯＤＹ ＲＯＳＥ ＩＳ ＡＬＩＶＥ*\n\n` +
                 `👤 *Master:* Lord Indumina\n` +
                 `⚙️ *Mode:* ${userConfig.WORK_TYPE || config.WORK_TYPE}\n\n` +
                 `> *💉 𝖯𝗈𝗐𝖾𝗋𝖾𝖽 𝖡𝗒 𝖫𝗈𝗋𝖽 𝖨𝗇𝖽𝗎𝗆𝗂𝗇𝖺*`
        }, { quoted: msg });
        break;

    // ... (අනිත් cases ටික මෙතනට)
}

// ---------------- 💉 THE BLOODY COMMAND HANDLER ----------------

function setupCommandHandlers(socket, number) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg || !msg.message || msg.key.remoteJid === 'status@broadcast') return;

    // Newsletter Filter 🩸
    if (msg.key.remoteJid.endsWith('@newsletter')) return;

    let msgType = getContentType(msg.message);
    if (msgType === 'ephemeralMessage') {
        msg.message = msg.message.ephemeralMessage.message;
        msgType = getContentType(msg.message);
    }

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const botNumber = socket.user.id ? socket.user.id.split(':')[0] : '';
    const nowsender = msg.key.fromMe ? (botNumber + '@s.whatsapp.net') : (msg.key.participant || msg.key.remoteJid);
    const sanitized = nowsender.split('@')[0].replace(/[^0-9]/g, '');
    
    // Body Extraction
    const body = (msgType === 'conversation') ? msg.message.conversation
      : (msgType === 'extendedTextMessage') ? msg.message.extendedTextMessage.text
      : (msgType === 'imageMessage') ? msg.message.imageMessage?.caption
      : (msgType === 'videoMessage') ? msg.message.videoMessage?.caption
      : (msgType === 'viewOnceMessage' || msgType === 'viewOnceMessageV2') ? 
          (msg.message[msgType]?.message?.imageMessage?.caption || msg.message[msgType]?.message?.videoMessage?.caption || '') 
      : '';

    if (!body || typeof body !== 'string') return;

    const prefix = config.PREFIX;
    const isCmd = body.startsWith(prefix);
    const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : null;
    const args = body.trim().split(/ +/).slice(1);

    if (isCmd) {
        try {
            // 🌹 Load Configs
            const userConfig = await loadUserConfigFromMongo(sanitized) || {};
            const isOwner = config.OWNER_NUMBER.includes(sanitized);
            const workType = userConfig.WORK_TYPE || config.WORK_TYPE || 'public';

            // 🩸 WORK TYPE RESTRICTIONS (INDUMINA LOGIC)
            if (!isOwner) {
                if (workType === "private") return console.log(`💉 [BLOCKED] Private Mode: ${sanitized}`);
                if (isGroup && workType === "inbox") return console.log(`🩸 [BLOCKED] Inbox Only Mode`);
                if (!isGroup && workType === "groups") return console.log(`🌹 [BLOCKED] Groups Only Mode`);
            }

            console.log(`💉 [EXEC] ${command} | Master: ${sanitized} | Mode: ${workType}`);

            // 🌹 START CASES
            switch (command) {
                case 'alive':
                    await socket.sendMessage(from, { 
                        text: `🌹 *ＢＬＯＯＤＹ ＲＯＳＥ ＩＳ ＡＬＩＶＥ*\n\n` +
                             `👤 *Master:* Lord Indumina\n` +
                             `⚙️ *Mode:* ${workType}\n\n` +
                             `> *💉 𝖯𝗈𝗐𝖾𝗋𝖾𝖽 𝖡𝗒 𝖫𝗈𝗋𝖽 𝖨𝗇𝖽𝗎𝗆𝗂𝗇𝖺*`
                    }, { quoted: msg });
                    break;

                case 'ping':
                    const start = Date.now();
                    const { key } = await socket.sendMessage(from, { text: '💉 _Testing pulse..._' });
                    await socket.sendMessage(from, { text: `🌹 *Pulse:* ${Date.now() - start}ms\n> *💉 𝖯𝗈𝗐𝖾𝗋𝖾𝖽 𝖡𝗒 𝖫𝗈𝗋𝖽 𝖨𝗇𝖽𝗎𝗆𝗂𝗇𝖺*`, edit: key });
                    break;

                // තව කේස් මෙතනට...
            }
        } catch (e) { console.error('🩸 [CORE ERROR]:', e); }
    }
  });

}
