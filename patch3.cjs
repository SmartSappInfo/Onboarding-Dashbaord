const fs = require('fs');
const file = 'src/lib/services/call-centre-service.ts';
let content = fs.readFileSync(file, 'utf-8');

if (!content.includes('PortalInvitationService')) {
  content = content.replace(
    "import { updateEntityAction } from '../entity-actions';",
    "import { updateEntityAction } from '../entity-actions';\nimport { PortalInvitationService } from './portal-invitation-service';"
  );
}

const newCase = `        case 'ADD_TO_MEMBERSHIP_PORTAL': {
          if (!params.portalId) return { success: false, error: 'No portal configured.' };
          
          const email = activeContact?.email;
          if (!email) {
            return { success: false, error: 'Contact lacks an email address. Cannot add to portal.' };
          }

          const portalSnap = await adminDb.collection('portals').doc(params.portalId).get();
          if (!portalSnap.exists) {
            return { success: false, error: 'Portal not found.' };
          }
          const portalData = portalSnap.data();

          // Idempotency: Check if member or pending invite exists
          const existingMemSnap = await adminDb.collection('portal_memberships')
            .where('portalId', '==', params.portalId)
            .where('email', '==', email.toLowerCase().trim())
            .limit(1)
            .get();
          if (!existingMemSnap.empty) {
            return { success: true }; // Already a member, act idempotently
          }

          let invitationToken = '';
          const existingInvSnap = await adminDb.collection('portal_invitations')
            .where('portalId', '==', params.portalId)
            .where('email', '==', email.toLowerCase().trim())
            .where('status', '==', 'pending')
            .limit(1)
            .get();
          
          if (!existingInvSnap.empty) {
            invitationToken = existingInvSnap.docs[0].data().token;
          } else {
            const newInvite = await PortalInvitationService.createInvitation({
              organizationId,
              portalId: params.portalId,
              workspaceIds: [workspaceId],
              email,
              role: params.portalRole || 'member',
              planId: params.portalPlanId,
            }, systemActor);
            invitationToken = newInvite.token;
          }

          // Dispatch Email
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://go.smartsapp.com';
          const joinUrl = \`\${baseUrl}/portal/\${portalData?.slug || params.portalId}/join?token=\${invitationToken}\`;
          
          let resendKey: string | undefined = undefined;
          let resendDomain: string | undefined = undefined;
          if (workspaceId) {
            const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
            if (wsSnap.exists && wsSnap.data()?.organizationId) {
              const orgSnap = await adminDb.collection('organizations').doc(wsSnap.data()?.organizationId).get();
              const org = orgSnap.data();
              if (org?.emailKeyMode === 'custom' && org?.resendApiKey) {
                resendKey = org.resendApiKey as string;
                resendDomain = org.resendDomain as string;
              }
            }
          }

          const htmlBody = \`
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
              <h2 style="color: #2563eb;">You've been invited!</h2>
              <p>Hi \${activeContact?.firstName || 'there'},</p>
              <p>You have been invited to join the <strong>\${portalData?.name || 'Membership'}</strong> portal.</p>
              <a href="\${joinUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 16px;">
                Accept Invitation
              </a>
            </div>
          \`;

          await sendEmail({
            to: email,
            subject: \`Invitation to join \${portalData?.name || 'our Portal'}\`,
            html: htmlBody,
            apiKey: resendKey,
            domain: resendDomain
          });

          await logActivity({
            organizationId,
            workspaceId,
            entityId,
            entityType: 'person' as any,
            userId,
            type: 'system',
            source: 'system',
            description: \`Sent portal invitation for \${portalData?.name || 'Membership Portal'} to \${email}\`,
          });

          return { success: true };
        }

        case 'UPDATE_CONTACT':`;

content = content.replace("        case 'UPDATE_CONTACT':", newCase);
fs.writeFileSync(file, content);
