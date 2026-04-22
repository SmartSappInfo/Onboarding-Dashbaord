'use server';

import { adminDb } from '@/lib/firebase-admin';
import { sendRawMessage } from '@/lib/messaging-engine';

interface AssigneeDetails {
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  photoURL?: string;
}

export async function getAssigneeDetails(userIds: string[]): Promise<{ success: boolean; assignees?: AssigneeDetails[]; error?: string }> {
  try {
    if (!userIds || userIds.length === 0) {
      return { success: true, assignees: [] };
    }

    const assignees: AssigneeDetails[] = [];

    // Fetch user details in batches (Firestore 'in' query limit is 10)
    const batchSize = 10;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const usersSnap = await adminDb
        .collection('users')
        .where('__name__', 'in', batch)
        .get();

      usersSnap.forEach((doc) => {
        const userData = doc.data();
        assignees.push({
          userId: doc.id,
          name: userData.displayName || userData.name || 'Unknown User',
          email: userData.email,
          phone: userData.phone,
          photoURL: userData.photoURL,
        });
      });
    }

    return { success: true, assignees };
  } catch (error: any) {
    console.error('Error fetching assignee details:', error);
    return { success: false, error: error.message || 'Failed to fetch assignee details' };
  }
}

export async function sendSurveyLinkToAssignee(
  userId: string,
  surveyTitle: string,
  surveyLink: string,
  channel: 'email' | 'sms'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch user details
    const userSnap = await adminDb.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      return { success: false, error: 'User not found' };
    }

    const userData = userSnap.data();
    const userName = userData?.displayName || userData?.name || 'there';
    const recipient = channel === 'email' ? userData?.email : userData?.phone;

    if (!recipient) {
      return { success: false, error: `No ${channel} address found for user` };
    }

    // Prepare message content
    const variables = {
      user_name: userName,
      survey_title: surveyTitle,
      survey_link: surveyLink,
    };

    let body: string;
    let subject: string | undefined;

    if (channel === 'email') {
      subject = `Survey Assignment: ${surveyTitle}`;
      body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Survey Assignment</h2>
          <p>Hi ${userName},</p>
          <p>You have been assigned to complete the following survey:</p>
          <p style="font-weight: bold; font-size: 18px; color: #4F46E5;">${surveyTitle}</p>
          <p>Click the button below to access your personalized survey:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${surveyLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Start Survey
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">Or copy this link: <a href="${surveyLink}" style="color: #4F46E5;">${surveyLink}</a></p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">This is an automated message from SmartSapp.</p>
        </div>
      `;
    } else {
      body = `Hi ${userName}, you've been assigned to complete "${surveyTitle}". Access your survey here: ${surveyLink}`;
    }

    // Send message using raw message function
    const result = await sendRawMessage({
      channel,
      recipient,
      body,
      subject,
      variables,
      workspaceIds: userData?.workspaceIds || ['onboarding'],
    });

    return result;
  } catch (error: any) {
    console.error('Error sending survey link:', error);
    return { success: false, error: error.message || 'Failed to send message' };
  }
}
