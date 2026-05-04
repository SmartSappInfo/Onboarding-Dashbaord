const admin = require('firebase-admin');
admin.initializeApp();
async function run() {
  try {
    const snap = await admin.firestore().collection('deals').get();
    console.log("Admin got", snap.size, "deals.");
  } catch(e) { console.error("Admin error", e); }
}
run();
