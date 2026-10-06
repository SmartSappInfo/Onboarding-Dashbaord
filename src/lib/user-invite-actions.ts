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
import { InvitationDispatchService } from './services/workforce/invitation-dispatch-service';
import { IdentityMigrationService } from './services/identity/identity-migration-service';
import { DepartmentService } from './services/workforce/department-service';
import { PersonService } from './services/identity/person-service';
import { InviteCryptoService } from './services/crypto/invite-crypto-service';
import { InvitationLifecycleService } from './services/workforce/invitation-lifecycle-service';
import { getErrorCode, getErrorMessage } from '@/lib/errors/report-error';
import { requireUserManager, requireUserManagerForUser } from './auth/require-user-manager';
import { assertInviteScope } from './services/workforce/invite-scope';

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
    department?: string;
    departmentId?: string;
    workspaceIds?: string[];
    workspaceRoles: Record<string, string[]>;
    organizationId: string;
    sendMethods: ('email' | 'sms' | 'whatsapp')[];
}) {
    try {
        // Server actions are public endpoints: the caller must be signed in and allowed to
        // manage users in the organization they are inviting into.
        const caller = await requireUserManager(params.organizationId);

        const { fullName, email, phone, organizationId, sendMethods } = params;
        let deptName = params.department?.trim();
        let deptId = params.departmentId?.trim();

        // A department id from the caller must belong to this organization; its canonical name
        // wins. Anything else (another tenant's id, or a legacy name sent as the id) is dropped
        // and the name is resolved below instead.
        if (deptId) {
            try {
                const dDoc = await DepartmentService.getDepartmentForOrganization(organizationId, deptId);
                deptId = dDoc?.id;
                if (dDoc) deptName = dDoc.name;
            } catch (err) {
                deptId = undefined;
                console.warn('[inviteUserAction] Could not fetch department by id:', err);
            }
        }
        if (deptName && !deptId) {
            try {
                const resolved = await DepartmentService.findOrCreateDepartmentByName(organizationId, deptName);
                deptId = resolved.id;
                deptName = resolved.name;
            } catch (err) {
                console.warn('[inviteUserAction] Could not resolve department by name:', err);
            }
        }
        const workspaceRoles = params.workspaceRoles || {};
        const workspaceIds = Array.isArray(params.workspaceIds) && params.workspaceIds.length > 0
            ? Array.from(new Set([...params.workspaceIds, ...Object.keys(workspaceRoles)]))
            : Object.keys(workspaceRoles);
        await assertInviteScope({
            organizationId,
            workspaceIds,
            roleIds: Array.from(new Set(Object.values(workspaceRoles).flat())),
            callerIsSystemAdmin: caller.isSystemAdmin,
        });
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
        } catch (e: unknown) {
            if (getErrorCode(e) === 'auth/user-not-found') {
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
                        if (rData.permissions) rData.permissions.forEach((p: import('./types').AppPermissionId) => allPerms.add(p));
                    }
                });

                workspacePermissionsSchemas[wsId] = schemasToMerge.length > 0 ? mergePermissionsSchemas(schemasToMerge) : getBlankPermissions();
                workspacePermissions[wsId] = Array.from(allPerms);
            }
        } catch (roleErr) {
            console.error('>>> [INVITE] Role hydration warning:', roleErr);
        }

        // 4. Create/Update Firestore Profile
        const finalDeptName = deptName || 'General';
        const userProfile = {
            id: userRecord.uid,
            name: fullName,
            email,
            phone: phone || '',
            department: finalDeptName,
            ...(deptId ? { departmentId: deptId } : {}),
            workspaceIds,
            workspaceRoles,
            workspacePermissions,
            workspacePermissionsSchemas,
            organizationId,
            isAuthorized: true,
            approvalStatus: 'approved',
            requiresPasswordReset: true,
            onboardingCompleted: false,
            onboardingStatus: 'pending',
            profileCompleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await adminDb.collection('users').doc(userRecord.uid).set(userProfile, { merge: true });

        // Sync with Canonical Identity Person Graph
        try {
            await IdentityMigrationService.getOrMigratePerson(userRecord.uid, organizationId);
            if (deptId) {
                await PersonService.updatePerson(userRecord.uid, {
                    departmentId: deptId,
                    departmentName: finalDeptName,
                });
                await DepartmentService.recalculateMemberCount(organizationId, deptId);
            }
        } catch (syncErr) {
            console.warn('[inviteUserAction] Person sync warning:', syncErr);
        }

        // 5. Provision formal invitation lifecycle record in Firestore invitations collection
        let invitationId = '';
        try {
            const primaryWorkspaceId = workspaceIds[0];
            const primaryRoles = (primaryWorkspaceId && workspaceRoles[primaryWorkspaceId]) || ['default_member'];
            const inviteRes = await InvitationLifecycleService.createInvitation(organizationId, {
                email,
                phone: phone || undefined,
                invitedPersonName: fullName,
                workspaceId: primaryWorkspaceId || undefined,
                roleIds: primaryRoles,
                departmentId: deptId || undefined,
                invitedBy: caller.uid,
                channels: sendMethods as ('email' | 'sms' | 'whatsapp')[],
            });
            invitationId = inviteRes.invitation.id;
        } catch (invErr) {
            console.warn('[inviteUserAction] Failed to create invitation doc in invitations collection:', invErr);
        }

        // 6. Generate tamper-proof encrypted onboarding payload
        let encryptedInviteToken: string | undefined;
        try {
            const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
            encryptedInviteToken = InviteCryptoService.encryptInvitePayload({
                invitationId: invitationId || userRecord.uid,
                organizationId,
                organizationName: orgName,
                departmentId: deptId || '',
                departmentName: finalDeptName,
                email,
                fullName,
                tempPassword,
                workspaceId: workspaceIds[0] || undefined,
                roleIds: workspaceRoles[workspaceIds[0]] || [],
                exp,
            });
        } catch (cryptoErr) {
            console.warn('[inviteUserAction] Failed to generate encryptedInviteToken, falling back to direct login link:', cryptoErr);
        }

        // 7. Dispatch credentials over requested channels (Email, SMS, WhatsApp)
        const dispatchRes = await InvitationDispatchService.dispatchUserCredentials({
            userId: userRecord.uid,
            organizationId,
            organizationName: orgName,
            email,
            fullName,
            phone,
            tempPassword,
            loginUrl: loginLink,
            encryptedInviteToken,
            channels: sendMethods,
        });

        return { 
            success: true, 
            message: 'User account created successfully.',
            channels: dispatchRes.channels,
            warnings: dispatchRes.warnings.length > 0 ? dispatchRes.warnings : undefined 
        };
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to invite user';
        console.error('>>> [INVITE] Error:', msg);
        return { success: false, error: msg };
    }
}

export interface AdminResetPasswordParams {
    userId: string;
    channels?: ('email' | 'sms' | 'whatsapp')[];
}

/**
 * ADMIN RESET PASSWORD ACTION
 */
export async function adminResetUserPasswordAction(params: AdminResetPasswordParams | string): Promise<{
    success: boolean;
    tempPassword?: string;
    message: string;
    channels?: Record<string, { status: 'sent' | 'failed' | 'skipped'; error?: string; dispatchedAt?: string }>;
    warnings?: string[];
    error?: string;
}> {
    try {
        const userId = typeof params === 'string' ? params : params.userId;
        // This returns the new temporary password, so only a signed-in user manager of the
        // target's organization may call it (and only a system admin for a system admin).
        await requireUserManagerForUser(userId);
        const auth = getAuth();
        const userSnap = await adminDb.collection('users').doc(userId).get();
        if (!userSnap.exists) throw new Error('User not found.');
        
        const userData = userSnap.data()!;
        const tempPassword = generateRandomPassword();
        const loginLink = `${getBaseUrl()}/login`;

        // 1. Update Password in Firebase Auth
        await auth.updateUser(userId, { password: tempPassword });

        // 2. Update Firestore
        const now = new Date().toISOString();
        await adminDb.collection('users').doc(userId).update({
            requiresPasswordReset: true,
            updatedAt: now,
        });

        const organizationId = userData.organizationId || 'system';
        const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
        const orgName = orgSnap.exists ? orgSnap.data()?.name || 'SmartSapp' : 'SmartSapp';

        // 3. Resolve requested delivery channels
        let channelsToUse: ('email' | 'sms' | 'whatsapp')[];
        if (typeof params !== 'string' && params.channels && params.channels.length > 0) {
            channelsToUse = params.channels;
        } else {
            channelsToUse = ['email'];
            if (userData.phone && userData.phone.length > 5) {
                channelsToUse.push('sms');
                channelsToUse.push('whatsapp');
            }
        }

        // 3b. Generate tamper-proof encrypted reset token (AES-256-GCM) matching invite email link tracking
        let encryptedResetToken: string | undefined;
        try {
            const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
            encryptedResetToken = InviteCryptoService.encryptInvitePayload({
                invitationId: userId,
                organizationId,
                organizationName: orgName,
                departmentId: userData.departmentId || '',
                departmentName: userData.departmentName || '',
                email: userData.email,
                fullName: userData.name || userData.displayName || 'User',
                tempPassword,
                workspaceId: userData.workspaceIds?.[0] || undefined,
                roleIds: userData.roleIds || [],
                exp,
            });
        } catch (cryptoErr) {
            console.warn('[adminResetUserPasswordAction] Failed to generate encryptedResetToken, falling back to direct login link:', cryptoErr);
        }

        // 4. Dispatch security notification over requested channels (Email, SMS, WhatsApp)
        const dispatchRes = await InvitationDispatchService.dispatchPasswordReset({
            userId,
            organizationId,
            organizationName: orgName,
            email: userData.email,
            fullName: userData.name || userData.displayName || 'User',
            phone: userData.phone,
            tempPassword,
            loginUrl: loginLink,
            encryptedResetToken,
            channels: channelsToUse,
            baseUrl: getBaseUrl(),
        });

        return { 
            success: true, 
            tempPassword,
            message: `Password reset successfully. Notification sent via ${channelsToUse.join(', ')}.`, 
            channels: dispatchRes.channels,
            warnings: dispatchRes.warnings.length > 0 ? dispatchRes.warnings : undefined 
        };
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to reset password';
        console.error('>>> [RESET PASSWORD] Error:', msg);
        return { success: false, error: msg, message: msg };
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

        // Generate encrypted reset token for SMS link tracking
        let encryptedResetToken: string | undefined;
        try {
            const exp = Date.now() + 24 * 60 * 60 * 1000;
            encryptedResetToken = InviteCryptoService.encryptInvitePayload({
                invitationId: userId,
                organizationId,
                organizationName: orgName,
                email: userData?.email || '',
                fullName: userData?.name || 'User',
                tempPassword,
                exp,
            });
        } catch (cryptoErr) {
            console.warn('[publicResetPasswordViaPhoneAction] Failed to generate encryptedResetToken:', cryptoErr);
        }

        const trackedLoginLink = encryptedResetToken
            ? `${loginLink}?invite=${encodeURIComponent(encryptedResetToken)}&email=${encodeURIComponent(userData?.email || '')}`
            : loginLink;

        let smsBody = `Hello ${userData?.name || 'User'}, your password has been reset. Temp password: ${tempPassword}. Link: ${trackedLoginLink}`;
        try {
            const smsTemplate = await resolveAndRender(
                'users',
                'user_password_reset',
                organizationId,
                {
                    userId,
                    extraVars: { temp_password: tempPassword, login_link: trackedLoginLink, reset_link: trackedLoginLink }
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
    } catch (error: unknown) {
        console.error('>>> [PUBLIC RESET PASSWORD] Error:', getErrorMessage(error));
        return { success: true, message: 'Password recovery initiated.' };
    }
}

/**
 * PUBLIC EMAIL RESET ACTION
 * For users who forgot their password and request recovery via email.
 * Dispatches password reset notification with encrypted tracking token
 * matching the invitation link flow.
 */
export async function publicResetPasswordViaEmailAction(email: string) {
    try {
        const normalizedEmail = (email || '').trim().toLowerCase();
        if (!normalizedEmail) {
            return { success: false, message: 'Please enter a valid email address.' };
        }
        const auth = getAuth();
        
        let userId: string | null = null;
        let userData: Record<string, unknown> | null = null;

        const usersSnap = await adminDb.collection('users').where('email', '==', normalizedEmail).limit(1).get();
        if (!usersSnap.empty) {
            const userDoc = usersSnap.docs[0];
            userId = userDoc.id;
            userData = userDoc.data();
        } else {
            try {
                const authUser = await auth.getUserByEmail(normalizedEmail);
                userId = authUser.uid;
            } catch {
                // Privacy / anti-enumeration: return friendly success message
                return { success: true, message: 'If your email is registered, you will receive password reset instructions.' };
            }
        }

        if (!userId) {
            return { success: true, message: 'If your email is registered, you will receive password reset instructions.' };
        }

        const tempPassword = generateRandomPassword();
        const loginLink = `${getBaseUrl()}/login`;

        // 1. Update Firebase Auth password
        await auth.updateUser(userId, { password: tempPassword });

        // 2. Mark password reset required in Firestore
        const now = new Date().toISOString();
        await adminDb.collection('users').doc(userId).set({
            requiresPasswordReset: true,
            updatedAt: now,
        }, { merge: true });

        const organizationId = (userData?.organizationId as string) || 'system';
        const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
        const orgName = orgSnap.exists ? orgSnap.data()?.name || 'SmartSapp' : 'SmartSapp';
        const fullName = (userData?.name as string) || (userData?.displayName as string) || 'User';

        // 3. Generate encrypted reset token (AES-256-GCM) matching invite tracking flow
        let encryptedResetToken: string | undefined;
        try {
            const exp = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
            encryptedResetToken = InviteCryptoService.encryptInvitePayload({
                invitationId: userId,
                organizationId,
                organizationName: orgName,
                departmentId: (userData?.departmentId as string) || '',
                departmentName: (userData?.departmentName as string) || '',
                email: normalizedEmail,
                fullName,
                tempPassword,
                exp,
            });
        } catch (cryptoErr) {
            console.warn('[publicResetPasswordViaEmailAction] Failed to generate encryptedResetToken:', cryptoErr);
        }

        // 4. Dispatch security notification via email
        await InvitationDispatchService.dispatchPasswordReset({
            userId,
            organizationId,
            organizationName: orgName,
            email: normalizedEmail,
            fullName,
            phone: (userData?.phone as string) || undefined,
            tempPassword,
            loginUrl: loginLink,
            encryptedResetToken,
            channels: ['email'],
            baseUrl: getBaseUrl(),
        });

        return { success: true, message: 'If your email is registered, you will receive password reset instructions.' };
    } catch (error: unknown) {
        console.error('>>> [PUBLIC RESET PASSWORD VIA EMAIL] Error:', getErrorMessage(error));
        return { success: true, message: 'If your email is registered, you will receive password reset instructions.' };
    }
}

/**
 * ADMIN UPDATE USER ACCESS ACTION
 * Toggles access authorization for a user: Updates Firestore, Enables/Disables Auth user, sends cancellation notification if disabled.
 */
export async function adminUpdateUserAccessAction(userId: string, isAuthorized: boolean) {
    try {
        await requireUserManagerForUser(userId);
        const auth = getAuth();
        
        // 1. Get User Profile from Firestore
        const userSnap = await adminDb.collection('users').doc(userId).get();
        if (!userSnap.exists) throw new Error('User not found.');
        const userData = userSnap.data()!;

        // Enforce user must have at least one workspace when being activated
        if (isAuthorized) {
            const workspaceIds = userData.workspaceIds || [];
            if (workspaceIds.length === 0) {
                const { flagMissingWorkspaceToAdmin } = await import('./services/workspace-resolver');
                await flagMissingWorkspaceToAdmin(userId, userData.organizationId || 'default');
                return { success: false, error: 'Cannot activate user: User has no active workspace assigned. Organization admin has been alerted.' };
            }
        }

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
    } catch (error: unknown) {
        console.error('>>> [UPDATE ACCESS] Error:', getErrorMessage(error));
        return { success: false, error: getErrorMessage(error) };
    }
}

/**
 * DECLINE JOIN REQUEST ACTION
 * Declines a pending join request by setting approvalStatus to 'rejected' and disabling the Firebase Auth account.
 */
export async function declineJoinRequestAction(userId: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    warnings?: string[];
}> {
    try {
        const auth = getAuth();

        // 1. Authenticate the caller from the session. This used to trust a caller-supplied
        //    "admin user id", so anyone could act as any administrator.
        await requireUserManagerForUser(userId);

        // 2. Fetch User Profile
        const userSnap = await adminDb.collection('users').doc(userId).get();
        if (!userSnap.exists) throw new Error('User not found.');
        const userData = userSnap.data()!;

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
    } catch (error: unknown) {
        console.error('>>> [DECLINE JOIN REQUEST] Error:', getErrorMessage(error));
        return { success: false, error: getErrorMessage(error) };
    }
}

/**
 * REMOVE USER FROM ORGANIZATION ACTION
 * Removes a user from the organization by clearing their organization bindings, resetting onboarding state,
 * and removing their workspace permissions, so they are detached from the organization completely.
 */
export async function removeUserFromOrgAction(userId: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
}> {
    try {
        const auth = getAuth();

        // 1. Authenticate the caller from the session. This used to trust a caller-supplied
        //    "admin user id", so anyone could act as any administrator.
        await requireUserManagerForUser(userId);

        // 2. Fetch User Profile
        const userSnap = await adminDb.collection('users').doc(userId).get();
        if (!userSnap.exists) throw new Error('User not found.');
        const userData = userSnap.data()!;

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
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to remove user';
        console.error('>>> [REMOVE USER FROM ORG] Error:', msg);
        return { success: false, error: msg };
    }
}

export interface CompleteForcePasswordResetParams {
    idToken: string;
    newPassword?: string;
}

export interface CompleteForcePasswordResetResult {
    success: boolean;
    message: string;
    redirectTo?: string;
    error?: string;
}

/**
 * COMPLETE FORCE PASSWORD RESET ACTION
 * 
 * Verifies caller's session token via Firebase Admin Auth, securely updates their 
 * Firebase Auth password, and clears the requiresPasswordReset flag in Firestore.
 */
export async function completeForcePasswordResetAction(
    params: CompleteForcePasswordResetParams
): Promise<CompleteForcePasswordResetResult> {
    try {
        if (!params.idToken) {
            return {
                success: false,
                message: 'Missing authentication token.',
                error: 'Your session has expired. Please log in again.',
            };
        }

        const auth = getAuth();
        const decodedToken = await auth.verifyIdToken(params.idToken);
        const uid = decodedToken.uid;

        // 1. Update Firebase Auth password if provided
        if (params.newPassword) {
            if (params.newPassword.length < 8) {
                return {
                    success: false,
                    message: 'Password must be at least 8 characters.',
                    error: 'Password must be at least 8 characters.',
                };
            }
            await auth.updateUser(uid, { password: params.newPassword });
        }

        // 2. Clear requiresPasswordReset in users collection
        const now = new Date().toISOString();
        const userRef = adminDb.collection('users').doc(uid);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            return {
                success: false,
                message: 'User account not found.',
                error: 'User profile does not exist.',
            };
        }

        await userRef.update({
            requiresPasswordReset: false,
            updatedAt: now,
        });

        // 3. Keep people projection in sync if present
        try {
            const personRef = adminDb.collection('people').doc(uid);
            const personSnap = await personRef.get();
            if (personSnap.exists) {
                await personRef.update({
                    requiresPasswordReset: false,
                    updatedAt: now,
                });
            }
        } catch (projErr) {
            console.warn('[completeForcePasswordResetAction] People projection update warning:', projErr);
        }

        const userData = userSnap.data() || {};
        const isSystemAdmin =
            userData.permissions?.includes('system_admin') ||
            userData.role === 'system_admin' ||
            userData.superAdmin === true;

        const needsProfileSetup = !isSystemAdmin && (userData.profileCompleted === false || !userData.profileCompleted);
        const redirectTo = isSystemAdmin
            ? '/admin/settings/organizations'
            : needsProfileSetup
                ? '/profile-setup'
                : '/admin';

        return {
            success: true,
            message: 'Password updated successfully.',
            redirectTo,
        };
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to update password';
        console.error('>>> [COMPLETE FORCE PASSWORD RESET] Error:', msg);
        return {
            success: false,
            message: msg,
            error: msg,
        };
    }
}

