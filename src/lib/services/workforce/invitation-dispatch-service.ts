/**
 * @fileOverview Centralized Multi-Channel Invitation Dispatch Service (Workforce 2.0)
 *
 * Dispatches invitations across Email (Resend), SMS (mNotify), and WhatsApp (Meta Cloud API).
 * Updates Firestore invitation and user documents with per-channel delivery telemetry
 * (sent, failed, error, dispatchedAt) and provides deterministic failure diagnostics.
 *
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Pointers):
 * - Conforms to .agents/AGENTS.md with strictly-typed signatures (zero `any` or `any[]`).
 * - Employs Promise.allSettled() so a failure in one channel (e.g. unconfigured WhatsApp)
 *   does not block other viable channels (e.g. Email).
 * - Records errors directly onto the database record so administrators have full delivery audits.
 *
 * @testability Covered in `invitation-dispatch-service.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/resend-service';
import { sendSms } from '@/lib/mnotify-service';
import type { InvitationChannelState } from '@/lib/types';

export type DispatchChannel = 'email' | 'sms' | 'whatsapp';

export interface WorkforceInvitationDispatchInput {
  invitationId: string;
  organizationId: string;
  organizationName?: string;
  email: string;
  invitedPersonName?: string;
  phone?: string;
  rawToken: string;
  workspaceName?: string;
  roleNames?: string[];
  channels?: DispatchChannel[];
  baseUrl?: string;
}

export interface UserCredentialsDispatchInput {
  userId: string;
  organizationId: string;
  organizationName?: string;
  email: string;
  fullName: string;
  phone?: string;
  tempPassword: string;
  loginUrl: string;
  workspaceName?: string;
  channels: DispatchChannel[];
}

export interface PasswordResetDispatchInput {
  userId: string;
  organizationId: string;
  organizationName?: string;
  email: string;
  fullName: string;
  phone?: string;
  tempPassword: string;
  loginUrl: string;
  channels: DispatchChannel[];
}

export interface ChannelDeliveryOutcome {
  status: 'sent' | 'failed' | 'skipped';
  dispatchedAt?: string;
  error?: string;
}

export interface DispatchInvitationResult {
  success: boolean;
  channels: {
    email?: ChannelDeliveryOutcome;
    sms?: ChannelDeliveryOutcome;
    whatsapp?: ChannelDeliveryOutcome;
  };
  warnings: string[];
  errors: string[];
}

export class InvitationDispatchService {
  /**
   * Generates a clean, accessible HTML email for workforce invitations.
   */
  private static generateInvitationEmailHtml(params: {
    orgName: string;
    personName: string;
    acceptUrl: string;
    workspaceName?: string;
    roleNames?: string[];
  }): string {
    const { orgName, personName, acceptUrl, workspaceName, roleNames } = params;
    const greeting = personName ? `Hello ${personName},` : 'Hello,';
    const roleDetails = roleNames && roleNames.length > 0 ? roleNames.join(', ') : 'Team Member';
    const workspaceDetail = workspaceName ? ` on the <strong>${workspaceName}</strong> workspace` : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invitation to join ${orgName}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
            .container { max-width: 580px; margin: 40px auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
            .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
            .content { padding: 36px 32px; font-size: 15px; line-height: 1.6; }
            .badge { display: inline-block; background-color: #eff6ff; color: #1d4ed8; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid #bfdbfe; }
            .cta-button { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 700; font-size: 14px; margin: 24px 0; text-align: center; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
            .footer { padding: 24px 32px; background-color: #f1f5f9; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
            .raw-link { word-break: break-all; color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${orgName}</h1>
            </div>
            <div class="content">
              <div class="badge">Official Invitation</div>
              <p>${greeting}</p>
              <p>You have been invited to join <strong>${orgName}</strong>${workspaceDetail} as a <strong>${roleDetails}</strong>.</p>
              <p>Click the button below to activate your account and complete your security registration:</p>
              <div style="text-align: center;">
                <a href="${acceptUrl}" class="cta-button">Activate Your Account</a>
              </div>
              <p style="margin-top: 24px; font-size: 13px; color: #64748b;">If the button above does not work, copy and paste this activation link directly into your browser:</p>
              <p class="raw-link"><a href="${acceptUrl}">${acceptUrl}</a></p>
              <p style="font-size: 12px; color: #94a3b8; margin-top: 32px;">This single-use cryptographic invitation link will expire in 7 days.</p>
            </div>
            <div class="footer">
              &copy; ${new Date().getFullYear()} ${orgName}. All rights reserved.
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Resolves the primary organization name if not supplied.
   */
  private static async resolveOrgName(orgId: string, fallback?: string): Promise<string> {
    if (fallback && fallback.trim()) return fallback.trim();
    try {
      const orgDoc = await adminDb.collection('organizations').doc(orgId).get();
      if (orgDoc.exists) {
        return orgDoc.data()?.name || 'SmartSapp';
      }
    } catch (e) {
      console.warn(`[InvitationDispatchService] Could not resolve org ${orgId}:`, e);
    }
    return 'SmartSapp';
  }

  /**
   * Dispatches a single Workforce 2.0 cryptographic invitation over requested channels.
   */
  static async dispatch(input: WorkforceInvitationDispatchInput): Promise<DispatchInvitationResult> {
    const {
      invitationId,
      organizationId,
      email,
      phone,
      rawToken,
      workspaceName,
      roleNames,
    } = input;

    const channelsToDispatch: DispatchChannel[] =
      input.channels && input.channels.length > 0 ? input.channels : ['email'];

    const orgName = await this.resolveOrgName(organizationId, input.organizationName);
    const origin = input.baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://smartsapp.com');
    const acceptUrl = `${origin.replace(/\/+$/, '')}/accept-invitation?token=${rawToken}`;
    const personName = input.invitedPersonName || '';

    const warnings: string[] = [];
    const errors: string[] = [];
    const channelOutcomes: DispatchInvitationResult['channels'] = {};

    const now = new Date().toISOString();
    const firestoreUpdates: Record<string, unknown> = {
      updatedAt: now,
    };

    // 1. Dispatch Email
    if (channelsToDispatch.includes('email')) {
      try {
        const emailHtml = this.generateInvitationEmailHtml({
          orgName,
          personName,
          acceptUrl,
          workspaceName,
          roleNames,
        });

        await sendEmail({
          to: email,
          subject: `You've been invited to join ${orgName}`,
          html: emailHtml,
        });

        channelOutcomes.email = {
          status: 'sent',
          dispatchedAt: now,
        };
        firestoreUpdates['channels.email.status'] = 'sent';
        firestoreUpdates['channels.email.dispatchedAt'] = now;
        firestoreUpdates['channels.email.error'] = null;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Email dispatch failed';
        console.error(`[InvitationDispatchService] Email to ${email} failed:`, msg);
        channelOutcomes.email = {
          status: 'failed',
          dispatchedAt: now,
          error: msg,
        };
        warnings.push(`Email dispatch failed: ${msg}`);
        errors.push(`Email: ${msg}`);
        firestoreUpdates['channels.email.status'] = 'failed';
        firestoreUpdates['channels.email.error'] = msg;
      }
    }

    // 2. Dispatch SMS
    if (channelsToDispatch.includes('sms')) {
      const cleanPhone = (phone || '').trim();
      if (!cleanPhone) {
        const msg = 'Recipient phone number is required for SMS delivery.';
        channelOutcomes.sms = { status: 'failed', error: msg };
        warnings.push(`SMS dispatch failed: ${msg}`);
        errors.push(`SMS: ${msg}`);
        firestoreUpdates['channels.sms.status'] = 'failed';
        firestoreUpdates['channels.sms.error'] = msg;
      } else {
        try {
          const smsText = `Hello ${personName || 'there'}, you have been invited to join ${orgName}. Activate your account here: ${acceptUrl}`;
          await sendSms({
            recipient: cleanPhone,
            message: smsText,
            sender: orgName.substring(0, 11) || 'SmartSapp',
          });

          channelOutcomes.sms = {
            status: 'sent',
            dispatchedAt: now,
          };
          firestoreUpdates['channels.sms.status'] = 'sent';
          firestoreUpdates['channels.sms.dispatchedAt'] = now;
          firestoreUpdates['channels.sms.error'] = null;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'SMS dispatch failed';
          console.error(`[InvitationDispatchService] SMS to ${cleanPhone} failed:`, msg);
          channelOutcomes.sms = {
            status: 'failed',
            dispatchedAt: now,
            error: msg,
          };
          warnings.push(`SMS dispatch failed: ${msg}`);
          errors.push(`SMS: ${msg}`);
          firestoreUpdates['channels.sms.status'] = 'failed';
          firestoreUpdates['channels.sms.error'] = msg;
        }
      }
    }

    // 3. Dispatch WhatsApp
    if (channelsToDispatch.includes('whatsapp')) {
      const cleanPhone = (phone || '').trim();
      if (!cleanPhone) {
        const msg = 'Recipient phone number is required for WhatsApp delivery.';
        channelOutcomes.whatsapp = { status: 'failed', error: msg };
        warnings.push(`WhatsApp dispatch failed: ${msg}`);
        errors.push(`WhatsApp: ${msg}`);
        firestoreUpdates['channels.whatsapp.status'] = 'failed';
        firestoreUpdates['channels.whatsapp.error'] = msg;
      } else {
        try {
          const { sendWhatsApp } = await import('@/lib/whatsapp/whatsapp-send');
          const waBody = `Hello ${personName || 'there'}, you have been invited to join *${orgName}*. Complete your activation here: ${acceptUrl}`;

          await sendWhatsApp({
            organizationId,
            recipient: cleanPhone,
            resolvedBody: waBody,
          });

          channelOutcomes.whatsapp = {
            status: 'sent',
            dispatchedAt: now,
          };
          firestoreUpdates['channels.whatsapp.status'] = 'sent';
          firestoreUpdates['channels.whatsapp.dispatchedAt'] = now;
          firestoreUpdates['channels.whatsapp.error'] = null;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'WhatsApp dispatch failed';
          console.error(`[InvitationDispatchService] WhatsApp to ${cleanPhone} failed:`, msg);
          channelOutcomes.whatsapp = {
            status: 'failed',
            dispatchedAt: now,
            error: msg,
          };
          warnings.push(`WhatsApp dispatch failed: ${msg}`);
          errors.push(`WhatsApp: ${msg}`);
          firestoreUpdates['channels.whatsapp.status'] = 'failed';
          firestoreUpdates['channels.whatsapp.error'] = msg;
        }
      }
    }

    // Determine overall success (true if at least one requested channel succeeded)
    const attemptedCount = channelsToDispatch.length;
    const failedCount = Object.values(channelOutcomes).filter(c => c?.status === 'failed').length;
    const overallSuccess = attemptedCount > 0 && failedCount < attemptedCount;

    if (!overallSuccess) {
      firestoreUpdates['status'] = 'failed';
    } else {
      firestoreUpdates['status'] = 'sent';
    }

    // Persist channel state update to Firestore
    try {
      await adminDb.collection('invitations').doc(invitationId).update(firestoreUpdates);
    } catch (dbErr) {
      console.warn(`[InvitationDispatchService] Failed to update invitation doc ${invitationId}:`, dbErr);
    }

    return {
      success: overallSuccess,
      channels: channelOutcomes,
      warnings,
      errors,
    };
  }

  /**
   * Dispatches credential-based invitations (used when autogenerating credentials for direct account creation).
   */
  static async dispatchUserCredentials(input: UserCredentialsDispatchInput): Promise<DispatchInvitationResult> {
    const {
      userId,
      organizationId,
      email,
      fullName,
      phone,
      tempPassword,
      loginUrl,
      channels,
    } = input;

    const orgName = await this.resolveOrgName(organizationId, input.organizationName);
    const warnings: string[] = [];
    const errors: string[] = [];
    const channelOutcomes: DispatchInvitationResult['channels'] = {};
    const now = new Date().toISOString();

    const deliveryRecord: Record<string, InvitationChannelState> = {};

    // 1. Email
    if (channels.includes('email')) {
      try {
        const emailHtml = `
          <div style="font-family: sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
            <h2 style="color: #1e293b; margin-top: 0;">Welcome to ${orgName}</h2>
            <p>Hello ${fullName},</p>
            <p>An institutional account has been provisioned for you at <strong>${orgName}</strong>.</p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Login Email:</strong> ${email}</p>
              <p style="margin: 0; font-size: 14px;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${tempPassword}</code></p>
            </div>
            <p><a href="${loginUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold;">Log In to Platform</a></p>
            <p style="font-size: 12px; color: #64748b;">You will be prompted to reset your password upon first login.</p>
          </div>
        `;

        await sendEmail({
          to: email,
          subject: `Your Account Credentials for ${orgName}`,
          html: emailHtml,
        });

        channelOutcomes.email = { status: 'sent', dispatchedAt: now };
        deliveryRecord.email = { status: 'sent', dispatchedAt: now };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Email dispatch failed';
        console.error(`[InvitationDispatchService] Credentials email failed:`, msg);
        channelOutcomes.email = { status: 'failed', error: msg, dispatchedAt: now };
        deliveryRecord.email = { status: 'failed', error: msg, dispatchedAt: now };
        warnings.push(`Email dispatch failed: ${msg}`);
        errors.push(`Email: ${msg}`);
      }
    }

    // 2. SMS
    if (channels.includes('sms')) {
      const cleanPhone = (phone || '').trim();
      if (!cleanPhone) {
        const msg = 'Recipient phone number is required for SMS delivery.';
        channelOutcomes.sms = { status: 'failed', error: msg };
        deliveryRecord.sms = { status: 'failed', error: msg };
        warnings.push(`SMS dispatch failed: ${msg}`);
        errors.push(`SMS: ${msg}`);
      } else {
        try {
          const smsText = `Hello ${fullName}, your account for ${orgName} is ready. Temp password: ${tempPassword}. Log in: ${loginUrl}`;
          await sendSms({
            recipient: cleanPhone,
            message: smsText,
            sender: orgName.substring(0, 11) || 'SmartSapp',
          });

          channelOutcomes.sms = { status: 'sent', dispatchedAt: now };
          deliveryRecord.sms = { status: 'sent', dispatchedAt: now };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'SMS dispatch failed';
          console.error(`[InvitationDispatchService] Credentials SMS failed:`, msg);
          channelOutcomes.sms = { status: 'failed', error: msg, dispatchedAt: now };
          deliveryRecord.sms = { status: 'failed', error: msg, dispatchedAt: now };
          warnings.push(`SMS dispatch failed: ${msg}`);
          errors.push(`SMS: ${msg}`);
        }
      }
    }

    // 3. WhatsApp
    if (channels.includes('whatsapp')) {
      const cleanPhone = (phone || '').trim();
      if (!cleanPhone) {
        const msg = 'Recipient phone number is required for WhatsApp delivery.';
        channelOutcomes.whatsapp = { status: 'failed', error: msg };
        deliveryRecord.whatsapp = { status: 'failed', error: msg };
        warnings.push(`WhatsApp dispatch failed: ${msg}`);
        errors.push(`WhatsApp: ${msg}`);
      } else {
        try {
          const { sendWhatsApp } = await import('@/lib/whatsapp/whatsapp-send');
          const waText = `Hello *${fullName}*, your account for *${orgName}* is ready.\n\n*Temporary Password:* ${tempPassword}\n*Log in:* ${loginUrl}`;
          await sendWhatsApp({
            organizationId,
            recipient: cleanPhone,
            resolvedBody: waText,
          });

          channelOutcomes.whatsapp = { status: 'sent', dispatchedAt: now };
          deliveryRecord.whatsapp = { status: 'sent', dispatchedAt: now };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'WhatsApp dispatch failed';
          console.error(`[InvitationDispatchService] Credentials WhatsApp failed:`, msg);
          channelOutcomes.whatsapp = { status: 'failed', error: msg, dispatchedAt: now };
          deliveryRecord.whatsapp = { status: 'failed', error: msg, dispatchedAt: now };
          warnings.push(`WhatsApp dispatch failed: ${msg}`);
          errors.push(`WhatsApp: ${msg}`);
        }
      }
    }

    // Persist delivery telemetry on user profile
    try {
      await adminDb.collection('users').doc(userId).update({
        invitationDelivery: deliveryRecord,
        updatedAt: now,
      });
    } catch (dbErr) {
      console.warn(`[InvitationDispatchService] Failed to record delivery on user ${userId}:`, dbErr);
    }

    const attemptedCount = channels.length;
    const failedCount = Object.values(channelOutcomes).filter(c => c?.status === 'failed').length;
    const overallSuccess = attemptedCount > 0 && failedCount < attemptedCount;

    return {
      success: overallSuccess,
      channels: channelOutcomes,
      warnings,
      errors,
    };
  }

  /**
   * Dispatches password reset security notifications across requested channels (Email, SMS, WhatsApp).
   */
  static async dispatchPasswordReset(input: PasswordResetDispatchInput): Promise<DispatchInvitationResult> {
    const {
      userId,
      organizationId,
      email,
      fullName,
      phone,
      tempPassword,
      loginUrl,
      channels,
    } = input;

    const orgName = await this.resolveOrgName(organizationId, input.organizationName);
    const warnings: string[] = [];
    const errors: string[] = [];
    const channelOutcomes: DispatchInvitationResult['channels'] = {};
    const now = new Date().toISOString();

    const deliveryRecord: Record<string, InvitationChannelState> = {};

    // 1. Email Channel
    if (channels.includes('email')) {
      try {
        const emailHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Password Reset for ${orgName}</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
                .container { max-width: 580px; margin: 40px auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
                .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 32px; text-align: center; color: #ffffff; }
                .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
                .content { padding: 36px 32px; font-size: 15px; line-height: 1.6; }
                .badge { display: inline-block; background-color: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid #fde68a; }
                .cred-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0; }
                .cta-button { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 700; font-size: 14px; margin: 20px 0; text-align: center; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
                .footer { padding: 24px 32px; background-color: #f1f5f9; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>${orgName}</h1>
                </div>
                <div class="content">
                  <div class="badge">Password Reset</div>
                  <p>Hello ${fullName || 'User'},</p>
                  <p>Your password for <strong>${orgName}</strong> has been reset by an administrator.</p>
                  <div class="cred-box">
                    <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Account Email:</strong> ${email}</p>
                    <p style="margin: 0; font-size: 14px;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 3px 8px; border-radius: 6px; font-weight: bold; color: #0f172a;">${tempPassword}</code></p>
                  </div>
                  <p>Click below to log in and set a permanent new password:</p>
                  <div style="text-align: center;">
                    <a href="${loginUrl}" class="cta-button">Log In & Set New Password</a>
                  </div>
                  <p style="font-size: 13px; color: #64748b; margin-top: 24px;">For your account security, you will be prompted to create a new password immediately upon logging in.</p>
                </div>
                <div class="footer">
                  &copy; ${new Date().getFullYear()} ${orgName}. All rights reserved.
                </div>
              </div>
            </body>
          </html>
        `;

        await sendEmail({
          to: email,
          subject: `Password Reset Instructions for ${orgName}`,
          html: emailHtml,
        });

        channelOutcomes.email = { status: 'sent', dispatchedAt: now };
        deliveryRecord.email = { status: 'sent', dispatchedAt: now };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Email dispatch failed';
        console.error(`[InvitationDispatchService] Password reset email failed:`, msg);
        channelOutcomes.email = { status: 'failed', error: msg, dispatchedAt: now };
        deliveryRecord.email = { status: 'failed', error: msg, dispatchedAt: now };
        warnings.push(`Email dispatch failed: ${msg}`);
        errors.push(`Email: ${msg}`);
      }
    }

    // 2. SMS Channel
    if (channels.includes('sms')) {
      const cleanPhone = (phone || '').trim();
      if (!cleanPhone) {
        const msg = 'Recipient phone number is required for SMS delivery.';
        channelOutcomes.sms = { status: 'failed', error: msg };
        deliveryRecord.sms = { status: 'failed', error: msg };
        warnings.push(`SMS dispatch failed: ${msg}`);
        errors.push(`SMS: ${msg}`);
      } else {
        try {
          const smsText = `Hello ${fullName || 'User'}, your password has been reset for ${orgName}. Temp password: ${tempPassword}. Log in here: ${loginUrl}`;
          await sendSms({
            recipient: cleanPhone,
            message: smsText,
            sender: orgName.substring(0, 11) || 'SmartSapp',
          });

          channelOutcomes.sms = { status: 'sent', dispatchedAt: now };
          deliveryRecord.sms = { status: 'sent', dispatchedAt: now };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'SMS dispatch failed';
          console.error(`[InvitationDispatchService] Password reset SMS failed:`, msg);
          channelOutcomes.sms = { status: 'failed', error: msg, dispatchedAt: now };
          deliveryRecord.sms = { status: 'failed', error: msg, dispatchedAt: now };
          warnings.push(`SMS dispatch failed: ${msg}`);
          errors.push(`SMS: ${msg}`);
        }
      }
    }

    // 3. WhatsApp Channel
    if (channels.includes('whatsapp')) {
      const cleanPhone = (phone || '').trim();
      if (!cleanPhone) {
        const msg = 'Recipient phone number is required for WhatsApp delivery.';
        channelOutcomes.whatsapp = { status: 'failed', error: msg };
        deliveryRecord.whatsapp = { status: 'failed', error: msg };
        warnings.push(`WhatsApp dispatch failed: ${msg}`);
        errors.push(`WhatsApp: ${msg}`);
      } else {
        try {
          const { sendWhatsApp } = await import('@/lib/whatsapp/whatsapp-send');
          const waText = `Hello *${fullName || 'User'}*, your password has been reset for *${orgName}* by an administrator.\n\n*Temporary Password:* ${tempPassword}\n*Log in:* ${loginUrl}\n\nPlease change your password upon login.`;
          await sendWhatsApp({
            organizationId,
            recipient: cleanPhone,
            resolvedBody: waText,
          });

          channelOutcomes.whatsapp = { status: 'sent', dispatchedAt: now };
          deliveryRecord.whatsapp = { status: 'sent', dispatchedAt: now };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'WhatsApp dispatch failed';
          console.error(`[InvitationDispatchService] Password reset WhatsApp failed:`, msg);
          channelOutcomes.whatsapp = { status: 'failed', error: msg, dispatchedAt: now };
          deliveryRecord.whatsapp = { status: 'failed', error: msg, dispatchedAt: now };
          warnings.push(`WhatsApp dispatch failed: ${msg}`);
          errors.push(`WhatsApp: ${msg}`);
        }
      }
    }

    // Persist password reset delivery telemetry
    try {
      await adminDb.collection('users').doc(userId).update({
        passwordResetDelivery: deliveryRecord,
        updatedAt: now,
      });
    } catch (dbErr) {
      console.warn(`[InvitationDispatchService] Failed to record password reset on user ${userId}:`, dbErr);
    }

    const attemptedCount = channels.length;
    const failedCount = Object.values(channelOutcomes).filter(c => c?.status === 'failed').length;
    const overallSuccess = attemptedCount > 0 && failedCount < attemptedCount;

    return {
      success: overallSuccess,
      channels: channelOutcomes,
      warnings,
      errors,
    };
  }
}
