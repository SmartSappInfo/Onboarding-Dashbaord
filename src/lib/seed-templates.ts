
import { doc, getFirestore, setDoc, writeBatch } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

/**
 * SEED: System-wide Message Templates
 * These templates serve as the global defaults for invitations and password resets.
 */
export async function seedSystemTemplates(firestore: any): Promise<number> {
    const batch = writeBatch(firestore);
    const timestamp = new Date().toISOString();

    const templatesRef = doc(firestore, 'system_settings', 'templates');
    
    batch.set(templatesRef, {
        id: 'templates',
        invitation: {
            subject: 'Welcome to {{orgName}}',
            emailHtml: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; rounded-xl: 12px;">
                    <h2 style="color: #3B5FFF;">Welcome to {{orgName}}!</h2>
                    <p>Hello <strong>{{userName}}</strong>,</p>
                    <p>You have been invited to join <strong>{{orgName}}</strong> as a team member.</p>
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 14px; color: #666;">Login Credentials:</p>
                        <p style="margin: 5px 0; font-size: 16px;"><strong>Email:</strong> {{email}}</p>
                        <p style="margin: 5px 0; font-size: 16px;"><strong>Temporary Password:</strong> <code style="background: #eee; padding: 2px 6px; border-radius: 4px;">{{tempPassword}}</code></p>
                    </div>
                    <p>Please log in using the link below. You will be asked to change your password upon your first login.</p>
                    <a href="{{loginLink}}" style="display: inline-block; background: #3B5FFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">Log In to Dashboard</a>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
                    <p style="font-size: 12px; color: #999;">If you didn't expect this invitation, please ignore this email.</p>
                </div>
            `,
            smsBody: 'Hi {{userName}}, welcome to {{orgName}}. Login at {{loginLink}} with email {{email}} and temp password: {{tempPassword}}'
        },
        passwordReset: {
            subject: 'Your Password Has Been Reset - {{orgName}}',
            emailHtml: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; rounded-xl: 12px;">
                    <h2 style="color: #3B5FFF;">Password Reset Successful</h2>
                    <p>Hello <strong>{{userName}}</strong>,</p>
                    <p>Your password for <strong>{{orgName}}</strong> has been reset by an administrator.</p>
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 14px; color: #666;">New Temporary Credentials:</p>
                        <p style="margin: 5px 0; font-size: 16px;"><strong>Email:</strong> {{email}}</p>
                        <p style="margin: 5px 0; font-size: 16px;"><strong>New Temporary Password:</strong> <code style="background: #eee; padding: 2px 6px; border-radius: 4px;">{{tempPassword}}</code></p>
                    </div>
                    <p>For security reasons, you will be required to change this password immediately after logging in.</p>
                    <a href="{{loginLink}}" style="display: inline-block; background: #3B5FFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">Log In to Security Center</a>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
                    <p style="font-size: 12px; color: #999;">This is an automated security message.</p>
                </div>
            `,
            smsBody: 'Your {{orgName}} password has been reset. New temp password: {{tempPassword}}. Login at {{loginLink}}'
        },
        updatedAt: timestamp,
        updatedBy: 'system_seed'
    }, { merge: true });

    await batch.commit();
    console.log('✅ Seeded system templates successfully');
    return 1;
}
