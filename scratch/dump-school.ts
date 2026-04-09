import { adminDb } from './src/lib/firebase-admin';

async function dump() {
    console.log("Dumping a school document...");
    const snap = await adminDb.collection('schools').limit(1).get();
    if (snap.empty) {
        console.log("No schools found.");
        return;
    }
    const school = snap.docs[0].data();
    console.log("School Name:", school.name);
    console.log("workspaceIds:", JSON.stringify(school.workspaceIds));
    console.log("migrationStatus:", school.migrationStatus);
}

dump();
