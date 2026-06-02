'use server';

import { adminDb } from '@/lib/firebase-admin';
import { generateRegistrantToken } from '@/lib/meeting-tokens';
import { sendRawMessage, sendMessage } from '@/lib/messaging-engine';
import { ensureAbsoluteUrl, getBaseUrl, getRequestBaseUrl } from '@/lib/utils/url-helpers';

export async function deleteRegistrantAction(meetingId: string, registrantId: string) {
  try {
    const regDocRef = adminDb.collection(`meetings/${meetingId}/registrants`).doc(registrantId);
    const regSnap = await regDocRef.get();

    if (regSnap.exists) {
      const regData = regSnap.data()!;
      const email = regData.email?.toLowerCase().trim();
      const phone = regData.phone;

      // Find scheduled messages for this recipient
      const batch = adminDb.batch();
      
      const queryPromises = [];
      if (email) {
        queryPromises.push(
          adminDb.collection('scheduled_messages')
            .where('sourceEventId', '==', meetingId)
            .where('sourceEventType', '==', 'meeting')
            .where('recipientContact', '==', email)
            .get()
        );
      }
      if (phone) {
        queryPromises.push(
          adminDb.collection('scheduled_messages')
            .where('sourceEventId', '==', meetingId)
            .where('sourceEventType', '==', 'meeting')
            .where('recipientContact', '==', phone)
            .get()
        );
      }

      if (queryPromises.length > 0) {
        const querySnaps = await Promise.all(queryPromises);
        querySnaps.forEach(snap => {
          snap.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
        });
      }

      // Delete the registrant doc itself
      batch.delete(regDocRef);
      await batch.commit();
    }

    return { success: true };
  } catch (error: any) {
    console.error('[deleteRegistrantAction]', error);
    return { success: false, error: error.message };
  }
}

export async function updateRegistrantStatusAction(meetingId: string, registrantId: string, newStatus: string) {
  try {
    await adminDb.collection(`meetings/${meetingId}/registrants`).doc(registrantId).update({
      status: newStatus,
      ...(newStatus === 'approved' ? { approvedAt: new Date().toISOString() } : {}),
      ...(newStatus === 'cancelled' ? { cancelledAt: new Date().toISOString() } : {})
    });
    return { success: true };
  } catch (error: any) {
    console.error('[updateRegistrantStatusAction]', error);
    return { success: false, error: error.message };
  }
}

export async function sendRegistrantJoinLinkAction(
  meetingId: string,
  meetingTitle: string,
  registrants: { id: string; name: string; email?: string; personalizedMeetingUrl?: string }[],
  workspaceId: string
) {
  try {
    const results = await Promise.allSettled(
      registrants.map(async (reg) => {
        if (!reg.email) {
          throw new Error(`Registrant ${reg.name} has no email address.`);
        }
        if (!reg.personalizedMeetingUrl) {
          throw new Error(`Registrant ${reg.name} has no join link.`);
        }

        const subject = `Your Join Link: ${meetingTitle}`;
        const body = `
Hello ${reg.name},

You are registered for the upcoming meeting: **${meetingTitle}**.

Please use your unique join link below to access the session:
[Click Here to Join now](${ensureAbsoluteUrl(reg.personalizedMeetingUrl)})

We look forward to seeing you there!
`;

        const res = await sendRawMessage({
          channel: 'email',
          recipient: reg.email,
          subject,
          body,
          workspaceIds: [workspaceId]
        });

        if (!res.success) {
          throw new Error(res.error || 'Failed to send email');
        }

        // Update last invite sent
        await adminDb.collection(`meetings/${meetingId}/registrants`).doc(reg.id).update({
          lastInviteSentAt: new Date().toISOString()
        });

        return { id: reg.id, success: true };
      })
    );

    const successes = results.filter((r) => r.status === 'fulfilled').length;
    const failures = results.filter((r) => r.status === 'rejected').length;

    return {
      success: failures === 0,
      message: `Sent ${successes} emails successfully. ${failures > 0 ? `${failures} failed.` : ''}`
    };
  } catch (error: any) {
    console.error('[sendRegistrantJoinLinkAction]', error);
    return { success: false, message: error.message };
  }
}

export async function adminRegisterParticipantAction(
  meetingId: string,
  formData: { name: string; email: string; phone?: string }
) {
  try {
    const meetingSnap = await adminDb.collection('meetings').doc(meetingId).get();
    if (!meetingSnap.exists) {
      throw new Error('Meeting not found');
    }
    const meeting = meetingSnap.data()!;

    const registrantsRef = adminDb.collection(`meetings/${meetingId}/registrants`);

    // Basic Dedup Check
    const userEmail = formData.email.toLowerCase().trim();
    if (userEmail) {
      const q = await registrantsRef.where('email', '==', userEmail).limit(1).get();
      if (!q.empty) {
        throw new Error('User with this email is already registered.');
      }
    }

    const token = generateRegistrantToken();
    const baseUrl = await getRequestBaseUrl();
    const typeSlug = meeting.type?.id || 'meeting';
    const meetingSlug = meeting.meetingSlug || meeting.entitySlug || meetingSnap.id;
    const personalizedMeetingUrl = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/join?token=${token}`;

    const now = new Date().toISOString();

    const registrantData = {
      meetingId,
      workspaceIds: meeting.workspaceIds || [],
      token,
      status: 'approved', // Admin registration defaults to approved
      source: 'admin',
      registrationData: formData,
      name: formData.name,
      email: userEmail,
      phone: formData.phone || '',
      registeredAt: now,
      approvedAt: now,
      personalizedMeetingUrl,
    };

    const docRef = await registrantsRef.add(registrantData);

    const workspaceId = meeting.workspaceIds?.[0] || '';
    if (workspaceId) {
      const { emitMeetingRegistrantActivity } = await import('@/lib/meeting-automation-events');
      void emitMeetingRegistrantActivity({
        type: 'meeting_registrant_added',
        organizationId: meeting.organizationId || 'default',
        workspaceId,
        meetingId,
        registrantId: docRef.id,
        registrantName: formData.name,
        registrantEmail: userEmail,
        meetingTypeId: meeting.type?.id,
      });
    }

    return { success: true, registrantId: docRef.id };
  } catch (error: any) {
    console.error('[adminRegisterParticipantAction]', error);
    return { success: false, error: error.message };
  }
}

export async function sendMeetingInvitationsAction(
  meetingId: string,
  workspaceId: string,
  recipients: { entityId: string; name: string; email?: string; phone?: string; entityName?: string }[],
  channels: ('email' | 'sms')[],
  emailTemplateId?: string,
  smsTemplateId?: string,
  scheduleTime?: string,
  subscribeOnly?: boolean,
  stageId?: string
) {
  try {
    const meetingSnap = await adminDb.collection('meetings').doc(meetingId).get();
    if (!meetingSnap.exists) {
      throw new Error('Meeting not found');
    }
    const meeting = meetingSnap.data()!;

    const registrantsRef = adminDb.collection(`meetings/${meetingId}/registrants`);
    const baseUrl = await getRequestBaseUrl();
    const typeSlug = meeting.type?.id || 'meeting';
    const meetingSlug = meeting.meetingSlug || meeting.entitySlug || meetingId;
    const now = new Date().toISOString();

    const isScheduled = !!scheduleTime && new Date(scheduleTime) > new Date();

    const results = await Promise.allSettled(
      recipients.map(async (rec) => {
        let registrantId: string | null = null;
        let token = '';
        let personalizedMeetingUrl = '';

        let existingQuery = null;
        const emailToSearch = rec.email?.toLowerCase().trim();
        const phoneToSearch = rec.phone?.trim();

        if (emailToSearch) {
          const q = await registrantsRef
            .where('email', '==', emailToSearch)
            .limit(1)
            .get();
          if (!q.empty) {
            existingQuery = q;
          }
        }

        if (!existingQuery && phoneToSearch) {
          const q = await registrantsRef
            .where('phone', '==', phoneToSearch)
            .limit(1)
            .get();
          if (!q.empty) {
            existingQuery = q;
          }
        }

        if (!existingQuery && rec.entityId) {
          const q = await registrantsRef
            .where('entityId', '==', rec.entityId)
            .limit(1)
            .get();
          if (!q.empty) {
            existingQuery = q;
          }
        }

        if (existingQuery && !existingQuery.empty) {
          const existingDoc = existingQuery.docs[0];
          const existingData = existingDoc.data();

          // Skip contacts who have already accepted/registered/attended
          if (existingData.status === 'approved' || existingData.status === 'attended' || existingData.status === 'registered') {
            return {
              registrantId: existingDoc.id,
              success: true,
              skipped: true,
              recipient: {
                name: rec.name,
                email: rec.email || '',
                phone: rec.phone || '',
                status: existingData.status
              }
            };
          }

          registrantId = existingDoc.id;
          token = existingData.token;
          personalizedMeetingUrl = existingData.personalizedMeetingUrl;
          
          // Keep entityName updated if missing
          if (!existingDoc.data().entityName && rec.entityName) {
            await existingDoc.ref.update({ entityName: rec.entityName });
          }
        } else {
          token = generateRegistrantToken();
          personalizedMeetingUrl = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/join?token=${token}`;

          const docRef = await registrantsRef.add({
            meetingId,
            workspaceIds: meeting.workspaceIds || [workspaceId],
            entityId: rec.entityId,
            entityName: rec.entityName || '',
            token,
            status: 'pending',
            source: 'invite',
            name: rec.name,
            email: rec.email?.toLowerCase().trim() || '',
            phone: rec.phone || '',
            registeredAt: now,
            personalizedMeetingUrl,
          });
          registrantId = docRef.id;
        }

        if (subscribeOnly) {
          await registrantsRef.doc(registrantId).update({
            status: 'pending',
            sentInvitations: {}
          });
          return { registrantId, success: true };
        }

        const rsvpGoingUrl = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/respond?token=${token}&response=going`;
        const rsvpDeclinedUrl = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/respond?token=${token}&response=not_going`;
        const rsvpLaterUrl = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/respond?token=${token}&response=later`;

        for (const channel of channels) {
          const contactDetail = channel === 'email' ? rec.email : rec.phone;
          if (!contactDetail) continue;

          if (isScheduled) {
            const scheduledRef = adminDb.collection('scheduled_messages').doc();
            await scheduledRef.set({
              organizationId: meeting.organizationId || 'default',
              workspaceId,
              templateId: channel === 'email' ? emailTemplateId : smsTemplateId,
              channel,
              recipientContact: contactDetail,
              recipientEntityId: rec.entityId,
              variables: {
                meetingId,
                rsvpGoingUrl,
                rsvpDeclinedUrl,
                rsvpLaterUrl,
                meeting_title: meeting.heroTitle || meeting.entityName || 'Meeting',
                meeting_time: new Date(meeting.meetingTime).toLocaleString(),
                recipient_name: rec.name,
                meeting_registrant_one_click_link: `${baseUrl}/meetings/${typeSlug}/${meetingSlug}?token=${token}`,
                rsvp_going_url: rsvpGoingUrl,
                rsvp_declined_url: rsvpDeclinedUrl,
                rsvp_later_url: rsvpLaterUrl,
              },
              scheduledAt: scheduleTime,
              status: 'pending',
              reminderType: stageId ? `meeting_invitation_${stageId}` : 'meeting_invitation',
              sourceEventId: meetingId,
              sourceEventType: 'meeting',
              retryCount: 0,
              createdAt: now,
            });
          } else {
            const activeTemplateId = channel === 'email' ? emailTemplateId : smsTemplateId;
            if (activeTemplateId) {
              const res = await sendMessage({
                templateId: activeTemplateId,
                senderProfileId: 'default',
                recipient: contactDetail,
                variables: {
                  meetingId,
                  rsvpGoingUrl,
                  rsvpDeclinedUrl,
                  rsvpLaterUrl,
                  meeting_title: meeting.heroTitle || meeting.entityName || 'Meeting',
                  meeting_time: new Date(meeting.meetingTime).toLocaleString(),
                  recipient_name: rec.name,
                  meeting_registrant_one_click_link: `${baseUrl}/meetings/${typeSlug}/${meetingSlug}?token=${token}`,
                  rsvp_going_url: rsvpGoingUrl,
                  rsvp_declined_url: rsvpDeclinedUrl,
                  rsvp_later_url: rsvpLaterUrl,
                },
                entityId: rec.entityId,
                workspaceId,
              });
              if (!res.success) {
                throw new Error(res.error || 'Failed to dispatch message.');
              }
            } else {
              const subject = `Invitation: ${meeting.heroTitle || 'Meeting Session'}`;
              let body = '';

              if (channel === 'email') {
                body = `
<div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
  <h2 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-top: 0;">You're Invited!</h2>
  <p style="font-size: 14px; color: #475569; line-height: 1.6;">Hello ${rec.name},</p>
  <p style="font-size: 14px; color: #475569; line-height: 1.6;">You are cordially invited to the upcoming session: <strong>${meeting.heroTitle || 'Meeting Session'}</strong>.</p>
  
  <div style="margin: 24px 0; padding: 16px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #f1f5f9;">
    <p style="font-size: 13px; margin: 0 0 8px 0; color: #64748b;"><strong>Date & Time:</strong> ${new Date(meeting.meetingTime).toLocaleString()}</p>
    <p style="font-size: 13px; margin: 0; color: #64748b;"><strong>Platform:</strong> SmartSapp Portal</p>
  </div>

  <p style="font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 12px;">Please RSVP by clicking one of the options below:</p>
  
  <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px;">
    <a href="${rsvpGoingUrl}" style="background-color: #10b981; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 700; display: inline-block;">Going</a>
    <a href="${rsvpDeclinedUrl}" style="background-color: #ef4444; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 700; display: inline-block;">Not Going</a>
    <a href="${rsvpLaterUrl}" style="background-color: #f59e0b; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 700; display: inline-block;">Decide Later</a>
  </div>

  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
  <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">Sent via SmartSapp Onboarding. All rights reserved.</p>
</div>
                `;
              } else {
                body = `Invitation: ${meeting.heroTitle || 'Meeting'}\nTime: ${new Date(meeting.meetingTime).toLocaleString()}\nRSVP:\nGoing: ${rsvpGoingUrl}\nNo: ${rsvpDeclinedUrl}`;
              }

              const res = await sendRawMessage({
                channel,
                recipient: contactDetail,
                subject: channel === 'email' ? subject : undefined,
                body,
                workspaceIds: [workspaceId],
              });

              if (!res.success) {
                throw new Error(res.error || 'Failed to dispatch message.');
              }
            }
          }
        }

        const updateData: Record<string, any> = {
          lastInviteSentAt: new Date().toISOString(),
        };
        if (stageId) {
          updateData[`sentInvitations.${stageId}`] = new Date().toISOString();
          if (channels.includes('email') && rec.email) {
            updateData[`sentInvitations.${stageId}_email`] = new Date().toISOString();
          }
          if (channels.includes('sms') && rec.phone) {
            updateData[`sentInvitations.${stageId}_sms`] = new Date().toISOString();
          }

          // Mark all other invitation slots as sent/blocked so that
          // when sending immediately, the contact is only subscribed to the selected invitation slot.
          const slots: { id: string }[] = meeting.messagingConfig?.invitationSeries || [
            { id: 'initial' },
            { id: '1_month' },
            { id: '1_week' },
            { id: '5_days' },
            { id: '3_days' },
            { id: '2_days' },
            { id: '1_day' },
            { id: 'today' },
            { id: 'last_chance' }
          ];
          for (const slot of slots) {
            if (slot.id !== stageId) {
              updateData[`sentInvitations.${slot.id}`] = new Date().toISOString();
              updateData[`sentInvitations.${slot.id}_email`] = new Date().toISOString();
              updateData[`sentInvitations.${slot.id}_sms`] = new Date().toISOString();
            }
          }
        }
        await registrantsRef.doc(registrantId).update(updateData);

        return { registrantId, success: true };
      })
    );

    const skippedList: any[] = [];
    results.forEach((r) => {
      if (r.status === 'fulfilled' && (r.value as any)?.skipped && (r.value as any)?.recipient) {
        skippedList.push((r.value as any).recipient);
      }
    });

    const successes = results.filter((r) => r.status === 'fulfilled' && !(r.value as any)?.skipped).length;
    const skipped = results.filter((r) => r.status === 'fulfilled' && (r.value as any)?.skipped).length;
    const failures = results.filter((r) => r.status === 'rejected').length;

    return {
      success: failures === 0,
      message: isScheduled
        ? `Scheduled ${successes} invitations successfully. ${failures > 0 ? `${failures} failed.` : ''}`
        : `Dispatched ${successes} invitations immediately.${skipped > 0 ? ` Skipped ${skipped} already attending.` : ''} ${failures > 0 ? `${failures} failed.` : ''}`,
      totalRecipients: recipients.length,
      successCount: successes,
      skippedCount: skipped,
      failedCount: failures,
      skippedRecipients: skippedList,
    };
  } catch (error: any) {
    console.error('[sendMeetingInvitationsAction]', error);
    return { success: false, message: error.message, totalRecipients: 0, successCount: 0, skippedCount: 0, failedCount: 0, skippedRecipients: [] };
  }
}

export async function submitRsvpResponseAction(
  meetingId: string,
  token: string,
  responseStatus: 'going' | 'not_going' | 'later'
) {
  try {
    const registrantsRef = adminDb.collection(`meetings/${meetingId}/registrants`);
    const qSnap = await registrantsRef.where('token', '==', token).limit(1).get();

    if (qSnap.empty) {
      throw new Error('Invalid registrant token.');
    }

    const regDoc = qSnap.docs[0];
    const regData = regDoc.data();

    let targetStatus = 'pending';
    let targetSource = regData.source || 'invite';

    if (responseStatus === 'going') {
      targetStatus = 'approved';
      targetSource = 'one-click';
    } else if (responseStatus === 'not_going') {
      targetStatus = 'cancelled';
    }

    let updatedFields: Record<string, any> = {
      rsvpStatus: responseStatus,
      status: targetStatus,
      source: targetSource,
      rsvpUpdatedAt: new Date().toISOString(),
    };

    // Pull and sync contact details from workspace_entities or entities
    if (regData.entityId) {
      try {
        let entitySnap = await adminDb.collection('workspace_entities').doc(regData.entityId).get();
        if (!entitySnap.exists) {
          entitySnap = await adminDb.collection('entities').doc(regData.entityId).get();
        }

        if (entitySnap.exists) {
          const entityData = entitySnap.data()!;
          const contacts = entityData.entityContacts || entityData.contacts || [];
          const matchedContact = contacts.find((c: any) => 
            (c.email && c.email.toLowerCase().trim() === regData.email?.toLowerCase().trim()) ||
            (c.phone && c.phone === regData.phone)
          );
          if (matchedContact) {
            updatedFields.name = matchedContact.name || regData.name;
            if (matchedContact.email) updatedFields.email = matchedContact.email.toLowerCase().trim();
            if (matchedContact.phone) updatedFields.phone = matchedContact.phone;
          }
        }
      } catch (err) {
        console.warn('Entity sync skipped during RSVP:', err);
      }
    }

    await regDoc.ref.update(updatedFields);

    // If accepted going, trigger registrant activity tracking
    if (responseStatus === 'going') {
      const meetingSnap = await adminDb.collection('meetings').doc(meetingId).get();
      if (meetingSnap.exists) {
        const meeting = meetingSnap.data()!;
        const workspaceId = meeting.workspaceIds?.[0] || regData.workspaceIds?.[0] || '';
        if (workspaceId) {
          const { emitMeetingRegistrantActivity } = await import('@/lib/meeting-automation-events');
          void emitMeetingRegistrantActivity({
            type: 'meeting_registrant_added',
            organizationId: meeting.organizationId || 'default',
            workspaceId,
            meetingId,
            registrantId: regDoc.id,
            registrantName: updatedFields.name || regData.name,
            registrantEmail: updatedFields.email || regData.email,
            meetingTypeId: meeting.type?.id,
          });
        }
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('[submitRsvpResponseAction]', error);
    return { success: false, error: error.message };
  }
}

