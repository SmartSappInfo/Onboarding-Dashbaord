'use server';

import { adminDb } from './firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { sendEmail } from './resend-service';
import { sendSms } from './mnotify-service'; 
import { mergePermissionsSchemas, getBlankPermissions } from './permissions-engine';
import type { PermissionsSchema } from './types';
import crypto from 'crypto';
import { resolveAndRender } from './template-resolver';
import { getBaseUrl } from './utils/url-helpers';

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
 * INVITE USER ACTION
 */
export async function inviteUserAction(params: {
    fullName: string;
    email: string;
    phone?: string;
    workspaceRoles: Record<string, string[]>;
    organizationId: string;
    sendMethods: ('email' | 'sms')[];
}) {
    try {
        const { fullName, email, phone, workspaceRoles, organizationId, sendMethods } = params;
        const auth = getAuth();
        const tempPassword = generateRandomPassword();
        const loginLink = `${getBaseUrl()}/login`;

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

        // 3. Hydrate Hierarchical Permissions per workspace
        const workspaceIds = Object.keys(workspaceRoles);
        const workspacePermissionsSchemas: Record<string, PermissionsSchema> = {};
        const workspacePermissions: Record<string, import('./types').AppPermissionId[]> = {};

        try {
            // First collect all unique roleIds to fetch them efficiently
            const allRoleIds = new Set<string>();
            Object.values(workspaceRoles).forEach(roleArray => {
                roleArray.forEach(r => allRoleIds.add(r));
            });

            // Fetch all roles needed
            const roleDocs = await Promise.all(
                Array.from(allRoleIds).map(roleId => adminDb.collection('roles').doc(roleId).get())
            );
            const rolesMap = new Map();
            roleDocs.forEach(snap => {
                if (snap.exists) rolesMap.set(snap.id, snap.data());
            });

            // Compute per-workspace schemas
            for (const wsId of workspaceIds) {
                const wsRoleIds = workspaceRoles[wsId] || [];
                const schemasToMerge: PermissionsSchema[] = [];
                const allPerms = new Set<import('./types').AppPermissionId>();

                wsRoleIds.forEach(roleId => {
                    const rData = rolesMap.get(roleId);
                    if (rData) {
                        schemasToMerge.push(rData.permissionsSchema || getBlankPermissions());
                        if (rData.permissions) rData.permissions.forEach((p: any) => allPerms.add(p));
                    }
                });

                workspacePermissionsSchemas[wsId] = schemasToMerge.length > 0 ? mergePermissionsSchemas(schemasToMerge) : getBlankPermissions();
                workspacePermissions[wsId] = Array.from(allPerms);
            }
        } catch (roleErr) {
            console.error('>>> [INVITE] Role hydration warning:', roleErr);
        }

        // 4. Create/Update Firestore Profile
        const userProfile = {
            id: userRecord.uid,
            name: fullName,
            email,
            phone: phone || '',
            workspaceIds,
            workspaceRoles,
            workspacePermissions,
            workspacePermissionsSchemas,
            organizationId,
            isAuthorized: true,
            requiresPasswordReset: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await adminDb.collection('users').doc(userRecord.uid).set(userProfile, { merge: true });

        // 5. Resolve templates with resilient defaults
        let emailSubject = `Invitation to join ${orgName}`;
        let emailHtml = `Hello ${fullName}, you have been invited to join ${orgName}. Your temporary password is: ${tempPassword}. Log in here: ${loginLink}`;
        let smsBody = `Hello ${fullName}, you have been invited to join ${orgName}. Temp password: ${tempPassword}. Link: ${loginLink}`;

        try {
            const emailTemplate = await resolveAndRender(
                'users',
                'user_invitation',
                organizationId,
                {
                    userId: userRecord.uid,
                    extraVars: { temp_password: tempPassword, login_link: loginLink }
                },
                'email'
            );
            if (emailTemplate.subject) emailSubject = emailTemplate.subject;
            emailHtml = emailTemplate.body;
        } catch (err) {
            console.error('Failed to resolve email template, using fallback:', err);
        }

        try {
            const smsTemplate = await resolveAndRender(
                'users',
                'user_invitation',
                organizationId,
                {
                    userId: userRecord.uid,
                    extraVars: { temp_password: tempPassword, login_link: loginLink }
                },
                'sms'
            );
            smsBody = smsTemplate.body;
        } catch (err) {
            console.error('Failed to resolve SMS template, using fallback:', err);
        }

        // 6. Send notifications using Promise.allSettled()
        const settledResults: Promise<{ type: string; success: boolean; error?: any }>[] = [];

        if (sendMethods.includes('email')) {
            settledResults.push(
                sendEmail({ to: email, subject: emailSubject, html: emailHtml })
                    .then(() => ({ type: 'email', success: true }))
                    .catch((err) => {
                        console.error('Email notification failed:', err);
                        return { type: 'email', success: false, error: err };
                    })
            );
        }

        if (sendMethods.includes('sms') && phone) {
            settledResults.push(
                sendSms({ 
                    recipient: phone, 
                    message: smsBody, 
                    sender: orgName.substring(0, 11) || 'SmartSapp' 
                })
                    .then(() => ({ type: 'sms', success: true }))
                    .catch((err) => {
                        console.error('SMS notification failed:', err);
                        return { type: 'sms', success: false, error: err };
                    })
            );
        }

        const results = await Promise.allSettled(settledResults);
        const warnings: string[] = [];
        results.forEach((r) => {
            if (r.status === 'fulfilled') {
                const val = r.value;
                if (!val.success) {
                    warnings.push(`Failed to send ${val.type}: ${val.error?.message || val.error}`);
                }
            } else {
                warnings.push(`Failed to send notification: ${r.reason?.message || r.reason}`);
            }
        });

        return { 
            success: true, 
            message: 'User invited successfully.', 
            warnings: warnings.length > 0 ? warnings : undefined 
        };
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
        
        const userData = userSnap.data()!;
        const tempPassword = generateRandomPassword();
        const loginLink = `${getBaseUrl()}/login`;

        // 1. Update Password in Firebase Auth
        await auth.updateUser(userId, { password: tempPassword });

        // 2. Update Firestore
        await adminDb.collection('users').doc(userId).update({
            requiresPasswordReset: true,
            updatedAt: new Date().toISOString()
        });

        const organizationId = userData.organizationId || 'system';
        const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
        const orgName = orgSnap.exists ? orgSnap.data()?.name || 'SmartSapp' : 'SmartSapp';

        // 3. Resolve templates with resilient defaults
        let emailSubject = `Password Reset for ${orgName}`;
        let emailHtml = `Hello ${userData.name || 'User'}, your password has been reset. Your temporary password is: ${tempPassword}. Log in here: ${loginLink}`;
        let smsBody = `Hello ${userData.name || 'User'}, your password has been reset. Temp password: ${tempPassword}. Link: ${loginLink}`;

        try {
            const emailTemplate = await resolveAndRender(
                'users',
                'user_password_reset',
                organizationId,
                {
                    userId,
                    extraVars: { temp_password: tempPassword, login_link: loginLink }
                },
                'email'
            );
            if (emailTemplate.subject) emailSubject = emailTemplate.subject;
            emailHtml = emailTemplate.body;
        } catch (err) {
            console.error('Failed to resolve email template, using fallback:', err);
        }

        try {
            const smsTemplate = await resolveAndRender(
                'users',
                'user_password_reset',
                organizationId,
                {
                    userId,
                    extraVars: { temp_password: tempPassword, login_link: loginLink }
                },
                'sms'
            );
            smsBody = smsTemplate.body;
        } catch (err) {
            console.error('Failed to resolve SMS template, using fallback:', err);
        }

        // 4. Send notifications using Promise.allSettled()
        const settledResults: Promise<{ type: string; success: boolean; error?: any }>[] = [];
        if (userData.email) {
            settledResults.push(
                sendEmail({ to: userData.email, subject: emailSubject, html: emailHtml })
                    .then(() => ({ type: 'email', success: true }))
                    .catch((err) => {
                        console.error('Email notification failed:', err);
                        return { type: 'email', success: false, error: err };
                    })
            );
        }
        if (userData.phone && userData.phone.length > 5) {
            settledResults.push(
                sendSms({ 
                    recipient: userData.phone, 
                    message: smsBody, 
                    sender: orgName.substring(0, 11) || 'SmartSapp' 
                })
                    .then(() => ({ type: 'sms', success: true }))
                    .catch((err) => {
                        console.error('SMS notification failed:', err);
                        return { type: 'sms', success: false, error: err };
                    })
            );
        }

        const results = await Promise.allSettled(settledResults);
        const warnings: string[] = [];
        results.forEach((r) => {
            if (r.status === 'fulfilled') {
                const val = r.value;
                if (!val.success) {
                    warnings.push(`Failed to send ${val.type}: ${val.error?.message || val.error}`);
                }
            } else {
                warnings.push(`Failed to send notification: ${r.reason?.message || r.reason}`);
            }
        });

        return { 
            success: true, 
            message: 'Password reset and notification sent.', 
            warnings: warnings.length > 0 ? warnings : undefined 
        };
    } catch (error: any) {
        console.error('>>> [RESET PASSWORD] Error:', error.message);
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
        
        // Find user by phone in Firestore
        const usersSnap = await adminDb.collection('users').where('phone', '==', phone).limit(1).get();
        if (usersSnap.empty) throw new Error('Phone number not recognized.');
        
        const userDoc = usersSnap.docs[0];
        const userId = userDoc.id;
        const userData = userDoc.data();

        const tempPassword = generateRandomPassword();
        const loginLink = `${getBaseUrl()}/login`;

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

        let smsBody = `Hello ${userData?.name || 'User'}, your password has been reset. Temp password: ${tempPassword}. Link: ${loginLink}`;
        try {
            const smsTemplate = await resolveAndRender(
                'users',
                'user_password_reset',
                organizationId,
                {
                    userId,
                    extraVars: { temp_password: tempPassword, login_link: loginLink }
                },
                'sms'
            );
            smsBody = smsTemplate.body;
        } catch (err) {
            console.error('Failed to resolve SMS template, using fallback:', err);
        }

        await sendSms({ 
            recipient: phone, 
            message: smsBody, 
            sender: orgName.substring(0, 11) || 'SmartSapp' 
        });

        return { success: true, message: 'If your number is registered, you will receive a new password via SMS.' };
    } catch (error: any) {
        console.error('>>> [PUBLIC RESET PASSWORD] Error:', error.message);
        return { success: true, message: 'Password recovery initiated.' };
    }
}

/**
 * ADMIN UPDATE USER ACCESS ACTION
 * Toggles access authorization for a user: Updates Firestore, Enables/Disables Auth user, sends cancellation notification if disabled.
 */
export async function adminUpdateUserAccessAction(userId: string, isAuthorized: boolean) {
    try {
        const auth = getAuth();
        
        // 1. Get User Profile from Firestore
        const userSnap = await adminDb.collection('users').doc(userId).get();
        if (!userSnap.exists) throw new Error('User not found.');
        const userData = userSnap.data()!;

        // 2. Toggle Firebase Auth user status (disabled flag)
        await auth.updateUser(userId, { disabled: !isAuthorized });

        // 3. Update Firestore profile
        await adminDb.collection('users').doc(userId).update({
            isAuthorized,
            approvalStatus: isAuthorized ? 'approved' : 'rejected',
            updatedAt: new Date().toISOString()
        });

        // 4. Send cancellation notification if access is revoked (isAuthorized = false)
        const warnings: string[] = [];
        if (!isAuthorized) {
            const organizationId = userData.organizationId || 'system';
            const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
            const orgName = orgSnap.exists ? orgSnap.data()?.name || 'SmartSapp' : 'SmartSapp';
            const loginLink = `${getBaseUrl()}/login`;

            let emailSubject = `Access Cancelled for ${orgName}`;
            let emailHtml = `Hello ${userData.name || 'User'}, your access to ${orgName} has been cancelled.`;
            let smsBody = `Hello ${userData.name || 'User'}, your access to ${orgName} has been cancelled.`;

            // Attempt resolving templates
            try {
                const emailTemplate = await resolveAndRender(
                    'users',
                    'user_access_cancellation',
                    organizationId,
                    {
                        userId,
                        extraVars: { login_link: loginLink }
                    },
                    'email'
                );
                if (emailTemplate.subject) emailSubject = emailTemplate.subject;
                emailHtml = emailTemplate.body;
            } catch (err) {
                console.error('Failed to resolve cancellation email template, using fallback:', err);
            }

            try {
                const smsTemplate = await resolveAndRender(
                    'users',
                    'user_access_cancellation',
                    organizationId,
                    {
                        userId,
                        extraVars: { login_link: loginLink }
                    },
                    'sms'
                );
                smsBody = smsTemplate.body;
            } catch (err) {
                console.error('Failed to resolve cancellation SMS template, using fallback:', err);
            }

            const settledResults: Promise<{ type: string; success: boolean; error?: any }>[] = [];
            if (userData.email) {
                settledResults.push(
                    sendEmail({ to: userData.email, subject: emailSubject, html: emailHtml })
                        .then(() => ({ type: 'email', success: true }))
                        .catch((err) => {
                            console.error('Email notification failed:', err);
                            return { type: 'email', success: false, error: err };
                        })
                );
            }
            if (userData.phone && userData.phone.length > 5) {
                settledResults.push(
                    sendSms({ 
                        recipient: userData.phone, 
                        message: smsBody, 
                        sender: orgName.substring(0, 11) || 'SmartSapp' 
                    })
                        .then(() => ({ type: 'sms', success: true }))
                        .catch((err) => {
                            console.error('SMS notification failed:', err);
                            return { type: 'sms', success: false, error: err };
                        })
                );
            }

            const results = await Promise.allSettled(settledResults);
            results.forEach((r) => {
                if (r.status === 'fulfilled') {
                    const val = r.value;
                    if (!val.success) {
                        warnings.push(`Failed to send cancellation ${val.type}: ${val.error?.message || val.error}`);
                    }
                } else {
                    warnings.push(`Failed to send cancellation notification: ${r.reason?.message || r.reason}`);
                }
            });
        }

        return { 
            success: true, 
            message: `User access has been ${isAuthorized ? 'restored' : 'cancelled'}.`, 
            warnings: warnings.length > 0 ? warnings : undefined 
        };
    } catch (error: any) {
        console.error('>>> [UPDATE ACCESS] Error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * DECLINE JOIN REQUEST ACTION
 * Declines a pending join request by setting approvalStatus to 'rejected' and disabling the Firebase Auth account.
 */
export async function declineJoinRequestAction(userId: string, adminUserId: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    warnings?: string[];
}> {
    try {
        const auth = getAuth();
        
        // 1. Authenticate caller (server-auth-actions)
        if (!adminUserId) throw new Error('Unauthorized: Admin User ID is required.');
        const adminSnap = await adminDb.collection('users').doc(adminUserId).get();
        if (!adminSnap.exists) throw new Error('Unauthorized: Admin profile not found.');
        const adminData = adminSnap.data()!;
        if (!adminData.isAuthorized || (!adminData.permissions?.includes('system_admin') && !adminData.roles?.includes('administrator'))) {
            throw new Error('Unauthorized: Insufficient administrative privileges.');
        }

        // 2. Fetch User Profile
        const userSnap = await adminDb.collection('users').doc(userId).get();
        if (!userSnap.exists) throw new Error('User not found.');
        const userData = userSnap.data()!;
        if (userData.organizationId !== adminData.organizationId && !adminData.permissions?.includes('system_admin')) {
            throw new Error('Unauthorized: Cannot decline users outside your organization.');
        }

        // 3. Disable Auth Account
        await auth.updateUser(userId, { disabled: true });

        // 4. Update Firestore Profile
        await adminDb.collection('users').doc(userId).update({
            isAuthorized: false,
            approvalStatus: 'rejected',
            updatedAt: new Date().toISOString()
        });

        // 5. Revoke session refresh tokens to force log out
        await auth.revokeRefreshTokens(userId);

        // 6. Send Rejection Email/SMS
        const warnings: string[] = [];
        const organizationId = userData.organizationId || 'system';
        const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
        const orgName = orgSnap.exists ? orgSnap.data()?.name || 'SmartSapp' : 'SmartSapp';
        const loginLink = `${getBaseUrl()}/login`;

        let emailSubject = `Join Request Declined for ${orgName}`;
        let emailHtml = `Hello ${userData.name || 'User'}, your request to join ${orgName} has been declined.`;
        let smsBody = `Hello ${userData.name || 'User'}, your request to join ${orgName} has been declined.`;

        try {
            const emailTemplate = await resolveAndRender(
                'users',
                'user_access_cancellation',
                organizationId,
                {
                    userId,
                    extraVars: { login_link: loginLink }
                },
                'email'
            );
            if (emailTemplate.subject) emailSubject = emailTemplate.subject;
            emailHtml = emailTemplate.body;
        } catch (err) {
            console.error('Failed to resolve declined email template, using fallback:', err);
        }

        try {
            const smsTemplate = await resolveAndRender(
                'users',
                'user_access_cancellation',
                organizationId,
                {
                    userId,
                    extraVars: { login_link: loginLink }
                },
                'sms'
            );
            smsBody = smsTemplate.body;
        } catch (err) {
            console.error('Failed to resolve declined SMS template, using fallback:', err);
        }

        const settledResults: Promise<{ type: string; success: boolean; error?: any }>[] = [];
        if (userData.email) {
            settledResults.push(
                sendEmail({ to: userData.email, subject: emailSubject, html: emailHtml })
                    .then(() => ({ type: 'email', success: true }))
                    .catch((err) => {
                        console.error('Email notification failed:', err);
                        return { type: 'email', success: false, error: err };
                    })
            );
        }
        if (userData.phone && userData.phone.length > 5) {
            settledResults.push(
                sendSms({ 
                    recipient: userData.phone, 
                    message: smsBody, 
                    sender: orgName.substring(0, 11) || 'SmartSapp' 
                })
                    .then(() => ({ type: 'sms', success: true }))
                    .catch((err) => {
                        console.error('SMS notification failed:', err);
                        return { type: 'sms', success: false, error: err };
                    })
            );
        }

        const results = await Promise.allSettled(settledResults);
        results.forEach((r) => {
            if (r.status === 'fulfilled') {
                const val = r.value;
                if (!val.success) {
                    warnings.push(`Failed to send rejection ${val.type}: ${val.error?.message || val.error}`);
                }
            } else {
                warnings.push(`Failed to send rejection notification: ${r.reason?.message || r.reason}`);
            }
        });

        return { 
            success: true, 
            message: `Join request from ${userData.name || 'User'} has been declined.`,
            warnings: warnings.length > 0 ? warnings : undefined
        };
    } catch (error: any) {
        console.error('>>> [DECLINE JOIN REQUEST] Error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * REMOVE USER FROM ORGANIZATION ACTION
 * Removes a user from the organization by clearing their organization bindings, resetting onboarding state,
 * and removing their workspace permissions, so they are detached from the organization completely.
 */
export async function removeUserFromOrgAction(userId: string, adminUserId: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
}> {
    try {
        const auth = getAuth();

        // 1. Authenticate caller (server-auth-actions)
        if (!adminUserId) throw new Error('Unauthorized: Admin User ID is required.');
        const adminSnap = await adminDb.collection('users').doc(adminUserId).get();
        if (!adminSnap.exists) throw new Error('Unauthorized: Admin profile not found.');
        const adminData = adminSnap.data()!;
        if (!adminData.isAuthorized || (!adminData.permissions?.includes('system_admin') && !adminData.roles?.includes('administrator'))) {
            throw new Error('Unauthorized: Insufficient administrative privileges.');
        }

        // 2. Fetch User Profile
        const userSnap = await adminDb.collection('users').doc(userId).get();
        if (!userSnap.exists) throw new Error('User not found.');
        const userData = userSnap.data()!;
        if (userData.organizationId !== adminData.organizationId && !adminData.permissions?.includes('system_admin')) {
            throw new Error('Unauthorized: Cannot remove users outside your organization.');
        }

        // 3. Clear all organization-bound and workspace-bound fields from user document
        await adminDb.collection('users').doc(userId).update({
            organizationId: '',
            workspaceIds: [],
            workspaceRoles: {},
            workspacePermissions: {},
            workspacePermissionsSchemas: {},
            isAuthorized: false,
            profileCompleted: false,
            approvalStatus: 'none', // reset status
            updatedAt: new Date().toISOString()
        });

        // 4. Invalidate the target user's active sessions (force them out immediately)
        try {
            await auth.revokeRefreshTokens(userId);
        } catch (e) {
            console.error('Failed to revoke tokens on user removal (non-blocking):', e);
        }

        return { 
            success: true, 
            message: `${userData.name || 'User'} has been removed from the organization.` 
        };
    } catch (error: any) {
        console.error('>>> [REMOVE USER FROM ORG] Error:', error.message);
        return { success: false, error: error.message };
    }
}
