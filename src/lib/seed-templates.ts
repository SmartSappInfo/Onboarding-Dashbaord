
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
        bulkUploadCompleted: {
            subject: 'Bulk Import Complete: {{filename}}',
            emailHtml: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <span style="display: inline-block; background-color: #e0e7ff; color: #4f46e5; font-size: 24px; padding: 12px; border-radius: 50%; line-height: 1;">📊</span>
                        <h2 style="color: #4f46e5; margin-top: 12px; margin-bottom: 4px; font-weight: 800; font-size: 22px;">Bulk Account Import Finished</h2>
                        <p style="color: #64748b; font-size: 14px; margin: 0;">File: {{filename}}</p>
                    </div>
                    
                    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 24px;">
                        Hello <strong>{{userName}}</strong>,<br />
                        Your spreadsheet import has finished processing on <strong>{{orgName}}</strong>. Here is a summary of the execution results:
                    </p>
                    
                    <div style="display: flex; gap: 12px; margin-bottom: 28px; background-color: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #f1f5f9; text-align: center; justify-content: space-around;">
                        <div style="padding: 8px;">
                            <div style="font-size: 22px; font-weight: 800; color: #10b981;">{{successCount}}</div>
                            <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-top: 4px;">Created</div>
                        </div>
                        <div style="padding: 8px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; width: 100%;">
                            <div style="font-size: 22px; font-weight: 800; color: #f59e0b;">{{duplicateCount}}</div>
                            <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-top: 4px;">Duplicates</div>
                        </div>
                        <div style="padding: 8px;">
                            <div style="font-size: 22px; font-weight: 800; color: #ef4444;">{{failedCount}}</div>
                            <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-top: 4px;">Failed</div>
                        </div>
                    </div>

                    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
                        All imported records are now fully accessible and wired with the configured automation sequences. Any failed records have been logged with detailed diagnostics so you can resolve them easily.
                    </p>

                    <div style="text-align: center; margin-bottom: 32px;">
                        <a href="{{importLogLink}}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
                            View Import Details
                        </a>
                    </div>
                    
                    <hr style="margin: 24px 0; border: none; border-top: 1px solid #e2e8f0;" />
                    <p style="font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.4;">
                        This is an automated system notification from your SmartSapp Onboarding portal.
                    </p>
                </div>
            `,
            smsBody: 'Your bulk upload "{{filename}}" on {{orgName}} is done. ✅ {{successCount}} created, ⚠️ {{duplicateCount}} duplicates, ❌ {{failedCount}} failed. View details: {{importLogLink}}'
        },
        updatedAt: timestamp,
        updatedBy: 'system_seed'
    }, { merge: true });

    await batch.commit();
    console.log('✅ Seeded system templates successfully');
    return 1;
}
