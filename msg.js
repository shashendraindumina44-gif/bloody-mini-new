const {
    proto,
    downloadContentFromMessage,
    getContentType
} = require('baileys')
const fs = require('fs')

/**
 * 📥 Media Download කරන ප්‍රධාන Function එක
 */
const downloadMediaMessage = async (m, filename) => {
    if (m.type === 'viewOnceMessage') {
        m.type = m.msg.type
    }
    const type = m.type.replace('Message', '')
    const stream = await downloadContentFromMessage(m.msg, type)
    let buffer = Buffer.from([])
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk])
    }
    
    // File Extension එක තීරණය කිරීම
    let ext = 'bin'
    if (m.type === 'imageMessage') ext = 'jpg'
    else if (m.type === 'videoMessage') ext = 'mp4'
    else if (m.type === 'audioMessage') ext = 'mp3'
    else if (m.type === 'stickerMessage') ext = 'webp'
    else if (m.type === 'documentMessage') ext = m.msg.fileName.split('.').pop()

    const saveName = filename ? `${filename}.${ext}` : `temp_${Date.now()}.${ext}`
    fs.writeFileSync(saveName, buffer)
    return buffer
}

/**
 * ✉️ Message එක Decode කරලා Shortcuts හදන Function එක
 */
const sms = (conn, m) => {
    if (m.key) {
        m.id = m.key.id
        m.chat = m.key.remoteJid
        m.fromMe = m.key.fromMe
        m.isGroup = m.chat.endsWith('@g.us')
        m.sender = m.fromMe ? conn.user.id.split(':')[0] + '@s.whatsapp.net' : m.isGroup ? m.key.participant : m.key.remoteJid
    }

    if (m.message) {
        m.type = getContentType(m.message)
        m.msg = (m.type === 'viewOnceMessage') ? m.message[m.type].message[getContentType(m.message[m.type].message)] : m.message[m.type]
        
        if (m.msg) {
            // බොඩි එක සහ කැප්ෂන් එක අරගැනීම
            m.body = (m.type === 'conversation') ? m.msg : (m.type === 'extendedTextMessage') ? m.msg.text : (m.type == 'imageMessage' || m.type == 'videoMessage') && m.msg.caption ? m.msg.caption : ''
            
            // Quoted Message (Reply) handle කිරීම
            m.quoted = m.msg.contextInfo ? m.msg.contextInfo.quotedMessage : null
            if (m.quoted) {
                m.quoted.type = getContentType(m.quoted)
                m.quoted.msg = m.quoted[m.quoted.type]
                m.quoted.sender = m.msg.contextInfo.participant
                m.quoted.id = m.msg.contextInfo.stanzaId
                m.quoted.download = (filename) => downloadMediaMessage(m.quoted, filename)
            }
        }
        m.download = (filename) => downloadMediaMessage(m, filename)
    }

    // --- 🚀 Reply Shortcuts ---
    m.reply = (text) => conn.sendMessage(m.chat, { text: text }, { quoted: m })
    m.react = (emoji) => conn.sendMessage(m.chat, { react: { text: emoji, key: m.key } })
    m.replyAud = (aud, ptt = false) => conn.sendMessage(m.chat, { audio: aud, ptt: ptt, mimetype: 'audio/mpeg' }, { quoted: m })
    m.replyVid = (vid, cap) => conn.sendMessage(m.chat, { video: vid, caption: cap }, { quoted: m })
    m.replyImg = (img, cap) => conn.sendMessage(m.chat, { image: img, caption: cap }, { quoted: m })

    return m
}

module.exports = { sms, downloadMediaMessage }