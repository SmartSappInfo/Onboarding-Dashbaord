import { getWorkspaceContacts } from '../src/lib/contact-adapter';

async function test() {
    console.log("Testing getWorkspaceContacts...");
    const workspaceId = "604d5500-b6f4-4f0e-8f23-34e8f17ed987"; // Client Onboarding from previous logs
    try {
        const contacts = await getWorkspaceContacts(workspaceId);
        console.log(`Found ${contacts.length} contacts.`);
        if (contacts.length > 0) {
            console.log("First contact:", contacts[0].name);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
