const mongoose = require('mongoose');

// --- 🆔 ID GENERATOR FUNCTION ---
// උඹ දීපු example එකමයි මෙතන තියෙන්නේ
function makeid(num = 4) {
  let result = "";
  let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < num; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// --- 🗄️ MONGODB SESSION SCHEMA ---
// Render වලදී මැකෙන්නේ නැති වෙන්න මෙතන සේව් වෙනවා
const SessionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // මෙන්න මේක තමයි අර ROSE-ID එක
  session: { type: Object, required: true }, // මෙතන තමයි මුළු creds ටික තියෙන්නේ
});

const Session = mongoose.model('Session', SessionSchema);

// --- 🚀 MAIN EXPORT FUNCTION ---
async function saveSession(sessionData) {
  try {
    // 1. Unique ID එකක් හදනවා (උදා: ROSE-a7K2)
    const newID = "ROSE-" + makeid(4);
    
    // 2. MongoDB එකේ සේව් කරනවා
    await Session.create({
      id: newID,
      session: sessionData
    });

    // 3. හදපු ID එක ආපහු දෙනවා (යූසර්ට පෙන්වන්න)
    return newID;
  } catch (error) {
    console.error("❌ Session Save Error:", error);
    return null;
  }
}

module.exports = { makeid, saveSession };