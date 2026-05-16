'use server';

import { sendRawMessage } from '@/lib/messaging-engine';
import { MeetingFacilitator } from '@/lib/types';

export async function resendFacilitatorLinksAction(
  meetingId: string,
  meetingTitle: string,
  facilitators: MeetingFacilitator[],
  workspaceId: string
) {
  try {
    const results = await Promise.allSettled(
      facilitators.map(async (fac) => {
        if (!fac.email) {
          throw new Error(`Facilitator ${fac.name} has no email address.`);
        }

        const subject = `Your Facilitator Link: ${meetingTitle}`;
        const body = `
Hello ${fac.name},

You have been assigned as a facilitator for the upcoming meeting: **${meetingTitle}**.
Your assigned role is: ${fac.role || 'Facilitator'}.

Please use your unique join link below to access the session:
${fac.joinLink}

If you have any questions, please contact the workspace administrator.
`;

        const res = await sendRawMessage({
          channel: 'email',
          recipient: fac.email,
          subject,
          body,
          workspaceIds: [workspaceId]
        });

        if (!res.success) {
          throw new Error(res.error || 'Failed to send email');
        }
        return { facilitatorId: fac.id, success: true };
      })
    );

    const successes = results.filter((r) => r.status === 'fulfilled').length;
    const failures = results.filter((r) => r.status === 'rejected').length;

    return {
      success: failures === 0,
      message: `Sent ${successes} emails successfully. ${failures > 0 ? `${failures} failed.` : ''}`
    };
  } catch (error: any) {
    console.error('[Facilitator Actions] Error resending links:', error);
    return { success: false, message: error.message };
  }
}
