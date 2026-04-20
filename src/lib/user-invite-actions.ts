
'use server';

import { adminDb } from './firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { sendEmail } from './resend-service';
import { sendSms } from './mnotify-service'; 
import { mergePermissionsSchemas, getBlankPermissions } from './permissions-engine';
import type { PermissionsSchema } from './types';
import crypto from 'crypto';

interface TemplateVariables {
    userName: string;
    email: string;
    orgName: string;
    tempPassword?: string;
    loginLink: string;
}

/**
 * Utility to replace {{variable}} placeholders in templates.
 */
function replaceVariables(template: string, variables: TemplateVariables): string {
    let result = template;
    const { userName, email, orgName, tempPassword, loginLink } = variables;
    
    result = result.replace(/{{userName}}/g, userName);
    result = result.replace(/{{email}}/g, email);
    result = result.replace(/{{orgName}}/g, orgName);
    if (tempPassword) {
        result = result.replace(/{{tempPassword}}/g, tempPassword);
    }
    result = result.replace(/{{loginLink}}/g, loginLink);
    
    return result;
}

/**
 * Generates a random secure password.
 */
function generateRandomPassword(length = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        password += chars.charAt(bytes[i] % chars.length);
    }
    return password;
}

/**
 * Fetches the merged template (Org override -> System default).
 */
async function getEffectiveTemplate(organizationId: string, type: 'invitation' | 'passwordReset') {
    // 1. Get System Defaults
    const systemSnap = await adminDb.collection('system_settings').doc('templates').get();
    const systemDefaults = systemSnap.exists ? systemSnap.data() : null;

    // 2. Get Org Overrides
    const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
    const orgData = orgSnap.exists ? orgSnap.data() : null;
    const orgOverrides = orgData?.templateOverrides;

    // Merge logic
    const defaultTemplate = systemDefaults?.[type] || {};
    const overrideTemplate = orgOverrides?.[type] || {};

    return {
        subject: overrideTemplate.subject || defaultTemplate.subject || (type === 'invitation' ? 'You have been invited' : 'Password Reset'),
        emailHtml: overrideTemplate.emailHtml || defaultTemplate.emailHtml || '',
        smsBody: overrideTemplate.smsBody || defaultTemplate.smsBody || ''
    };
}

/**
 * INVITE USER ACTION
 */
export async function inviteUserAction(params: {
    fullName: string;
    email: string;
    phone?: string;
    roles: string[];
    organizationId: string;
    sendMethods: ('email' | 'sms')[];
}) {
    try {
        const { fullName, email, phone, roles, organizationId, sendMethods } = params;
        const auth = getAuth();
        const tempPassword = generateRandomPassword();
        const loginLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`;

        // 1. Fetch Organization Details
        const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
        const orgName = orgSnap.exists ? orgSnap.data()?.name || 'SmartSapp' : 'SmartSapp';

        // 2. Create User in Firebase Auth
        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(email);
            // If user exists, we might want to just update them or error
            throw new Error('User already exists in authentication system.');
        } catch (e: any) {
            if (e.code === 'auth/user-not-found') {
                userRecord = await auth.createUser({
                    email,
                    password: tempPassword,
                    displayName: fullName,
                    phoneNumber: phone || undefined,
                    emailVerified: false,
                });
            } else {
                throw e;
            }
        }

        // 3. Hydrate Hierarchical Permissions
        const schemasToMerge: PermissionsSchema[] = [];
        try {
            const rolesSnaps = await Promise.all(
                roles.map(roleId => adminDb.collection('roles').doc(roleId).get())
            );
            
            rolesSnaps.forEach(snap => {
                if (snap.exists) {
                    const rData = snap.data();
                    schemasToMerge.push(rData?.permissionsSchema || getBlankPermissions());
                }
            });
        } catch (roleErr) {
            console.error('>>> [INVITE] Role hydration warning:', roleErr);
        }

        const permissionsSchema = mergePermissionsSchemas(schemasToMerge);

        // 4. Create/Update Firestore Profile
        const userProfile = {
            id: userRecord.uid,
            name: fullName,
            email,
            phone: phone || '',
            roles,
            permissionsSchema,
            organizationId,
            isAuthorized: true,
            requiresPasswordReset: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await adminDb.collection('users').doc(userRecord.uid).set(userProfile, { merge: true });

        // 4. Send Notifications
        const template = await getEffectiveTemplate(organizationId, 'invitation');
        const variables: TemplateVariables = {
            userName: fullName,
            email,
            orgName,
            tempPassword,
            loginLink
        };

        const settledResults = [];

        if (sendMethods.includes('email')) {
            const subject = replaceVariables(template.subject, variables);
            const html = replaceVariables(template.emailHtml, variables);
            settledResults.push(sendEmail({ to: email, subject, html }));
        }

        if (sendMethods.includes('sms') && phone) {
            const message = replaceVariables(template.smsBody, variables);
            settledResults.push(sendSms({ 
                recipient: phone, 
                message, 
                sender: orgName.substring(0, 11) || 'SmartSapp' 
            }));
        }

        await Promise.all(settledResults);

        return { success: true, message: 'User invited successfully.' };
    } catch (error: any) {
        console.error('>>> [INVITE] Error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * ADMIN RESET PASSWORD ACTION
 */
export async function adminResetUserPasswordAction(userId: string) {
    try {
        const auth = getAuth();
        const userSnap = await adminDb.collection('users').doc(userId).get();
        if (!userSnap.exists) throw new Error('User not found.');
        
        const userData = userSnap.data();
        const tempPassword = generateRandomPassword();
        const loginLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`;

        // 1. Update Password in Firebase Auth
        await auth.updateUser(userId, { password: tempPassword });

        // 2. Update Firestore
        await adminDb.collection('users').doc(userId).update({
            requiresPasswordReset: true,
            updatedAt: new Date().toISOString()
        });

        // 3. Send Notification
        const organizationId = userData?.organizationId || 'system';
        const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
        const orgName = orgSnap.exists ? orgSnap.data()?.name || 'SmartSapp' : 'SmartSapp';

        const template = await getEffectiveTemplate(organizationId, 'passwordReset');
        const variables: TemplateVariables = {
            userName: userData?.name || 'User',
            email: userData?.email || '',
            orgName,
            tempPassword,
            loginLink
        };

        const notifications = [];
        if (userData?.email) {
            const subject = replaceVariables(template.subject, variables);
            const html = replaceVariables(template.emailHtml, variables);
            notifications.push(sendEmail({ to: userData.email, subject, html }));
        }
        if (userData?.phone && userData?.phone.length > 5) {
            const message = replaceVariables(template.smsBody, variables);
            notifications.push(sendSms({ 
                recipient: userData.phone, 
                message, 
                sender: orgName.substring(0, 11) || 'SmartSapp' 
            }));
        }

        await Promise.all(notifications);

        return { success: true, message: 'Password reset and notification sent.' };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * PUBLIC PHONE RESET ACTION
 * For users who forgot their password and use their phone number.
 */
export async function publicResetPasswordViaPhoneAction(phone: string) {
    try {
        const auth = getAuth();
        
        // Find user by phone in Firestore (Auth lookup by phone is tricky without specific E164 formatting)
        const usersSnap = await adminDb.collection('users').where('phone', '==', phone).limit(1).get();
        if (usersSnap.empty) throw new Error('Phone number not recognized.');
        
        const userDoc = usersSnap.docs[0];
        const userId = userDoc.id;
        const userData = userDoc.data();

        const tempPassword = generateRandomPassword();
        const loginLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`;

        // 1. Update Auth
        await auth.updateUser(userId, { password: tempPassword });

        // 2. Update Firestore
        await userDoc.ref.update({
            requiresPasswordReset: true,
            updatedAt: new Date().toISOString()
        });

        // 3. Send SMS
        const organizationId = userData?.organizationId || 'system';
        const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
        const orgName = orgSnap.exists ? orgSnap.data()?.name || 'SmartSapp' : 'SmartSapp';

        const template = await getEffectiveTemplate(organizationId, 'passwordReset');
        const variables: TemplateVariables = {
            userName: userData?.name || 'User',
            email: userData?.email || '',
            orgName,
            tempPassword,
            loginLink
        };

        const message = replaceVariables(template.smsBody, variables);
        await sendSms({ 
            recipient: phone, 
            message, 
            sender: orgName.substring(0, 11) || 'SmartSapp' 
        });


        return { success: true, message: 'If your number is registered, you will receive a new password via SMS.' };
    } catch (error: any) {
        // Return success even on error to prevent enumeration? Or be specific for internal dashboards.
        // For public forgot password, be generic.
        return { success: true, message: 'Password recovery initiated.' };
    }
}
