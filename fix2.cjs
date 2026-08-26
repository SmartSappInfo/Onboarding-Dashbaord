const fs = require('fs');
const file = 'src/lib/services/call-centre-service.ts';
let content = fs.readFileSync(file, 'utf-8');

const replacement = `        case 'ADD_TO_MEMBERSHIP_PORTAL': {
          if (!params.portalId) return { success: false, error: 'No portal configured.' };
          
          const entitySnap = await adminDb.collection('entities').doc(entityId).get();
          const entityData = entitySnap.exists ? entitySnap.data() : null;
          const contactsList = (entityData?.entityContacts ?? []) as any[];
          
          const activeContact = contactId 
            ? contactsList.find(c => c.id === contactId || c.email === contactId || c.phone === contactId) || contactsList.find(c => c.isPrimary) || contactsList[0]
            : contactsList.find(c => c.isPrimary) || contactsList[0];

          const email = activeContact?.email;`;

content = content.replace(`        case 'ADD_TO_MEMBERSHIP_PORTAL': {
          if (!params.portalId) return { success: false, error: 'No portal configured.' };
          
          const email = activeContact?.email;`, replacement);

fs.writeFileSync(file, content);
