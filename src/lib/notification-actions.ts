
'use server';

import { sendEmail } from './resend-service';
import { sendSms } from './mnotify-service';
import { getBaseUrl } from './utils/url-helpers';

/**
 * Handles automated notifications for subscription payment receipt requests.
 * Sends a high-end email and SMS to the client, a notification to the finance team,
 * and syncs with the Pabbly webhook.
 */
export async function sendReceiptAcknowledgementAction(payload: {
    name: string;
    school: string;
    phone: string;
    email: string;
    amount: string;
}) {
    const { name, school, phone, email, amount } = payload;
    const PABBLY_WEBHOOK_URL = 'https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjYwNTY0MDYzMzA0MzU1MjZhNTUzNjUxMzUi_pc';

    try {
        // 1. Send Client Acknowledgement Email
        const clientEmailHtml = `
            <!DOCTYPE html>
            <html lang="en" style="margin:0;padding:0;">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Receipt Request Received</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700&display=swap');
                    body { margin: 0; padding: 0; background-color: #f9fafc; font-family: 'Figtree', Arial, sans-serif; color: #222; }
                    .email-container { width: 100%; background-color: #f9fafc; padding: 60px 0; }
                    .content { max-width: 640px; background-color: #ffffff; border-radius: 18px; padding: 50px 45px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); }
                    .logo { display: block; width: 160px; margin-bottom: 40px; }
                    .title { font-size: 24px; font-weight: 700; color: #111; text-align: left; margin-bottom: 25px !important; }
                    .text { font-size: 16px; line-height: 1.8; color: #333; text-align: left; margin-bottom: 20px; }
                    .highlight { color: #3A86FF; font-weight: 700; }
                    .footer { font-size: 13px; color: #999; text-align: center; line-height: 24px; margin-top: 40px; }
                </style>
            </head>
            <body>
                <table class="email-container" width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                        <td align="center">
                            <table class="content" width="100%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td>
                                        <img src="https://github.com/SmartSappInfo/DynamicWebsiteImages/raw/main/SmartSapp%20Logo.png" alt="SmartSapp Logo" class="logo">
                                    </td>
                                </tr>
                                <tr>
                                    <td class="title">We've Received Your Request</td>
                                </tr>
                                <tr>
                                    <td class="text">
                                        Hi <strong>${name}</strong>,<br><br>
                                        Thank you for submitting your receipt request for <span class="highlight">${school}</span>. We have successfully received your payment notification of <span class="highlight">GHS ${amount}</span>.<br><br>
                                        Our Accounts Department is currently verifying the transaction and will issue your official electronic receipt to this email address shortly.<br><br>
                                        In the meantime, your school’s account remains active and secure. If you have any urgent questions, feel free to reply to this email.
                                    </td>
                                </tr>
                                <tr>
                                    <td class="text">
                                        <br>Warmly,<br>
                                        <strong>SmartSapp Accounts Team</strong>
                                    </td>
                                </tr>
                            </table>
                            <div class="footer">
                                © Minex360 Services Limited | SmartSapp. <br>
                                Automating the future of school management.
                            </div>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;

        await sendEmail({
            to: email,
            subject: "We've received your receipt request — SmartSapp Accounts",
            html: clientEmailHtml
        });

        // 2. Send Finance Team Notification Email (Old Template Style)
        const financeEmailHtml = `
            <!DOCTYPE html> <html lang="en" style="margin:0;padding:0;"> <head> <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <title>New Payment Notification</title> <style> @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700&display=swap'); body { margin: 0; padding: 0; background-color: #f9fafc; font-family: 'Figtree', Arial, sans-serif; color: #222; } .email-container { width: 100%; background-color: #f9fafc; padding: 60px 0; } .content { max-width: 640px; background-color: #ffffff; border-radius: 18px; padding: 50px 45px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); } .logo { display: block; width: 160px; margin-bottom: 40px; } .title { font-size: 24px; font-weight: 700; color: #111; text-align: left; margin-bottom: 45px !important; } .text { font-size: 16px; line-height: 1.8; color: #333; text-align: left; margin-bottom: 10px; } .button { display: inline-block; background-color: #3A86FF; color: #ffffff; text-decoration: none; padding: 14px 38px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 30px 0px; } .cta { text-align: left; margin-bottom: 50px; } .footer { font-size: 13px; color: #999; text-align: center; line-height: 24px; margin-top: 40px; } .highlight { color: red; } a { text-decoration: none; } @media only screen and (max-width: 600px) { .content { padding: 35px 25px; } .title { font-size: 20px; } } </style> </head> <body> <table class="email-container" width="100%" border="0" cellspacing="0" cellpadding="0"> <tr> <td align="center"> <table class="content" width="100%" border="0" cellspacing="0" cellpadding="0"> <tr> <td> <img src="https://github.com/SmartSappInfo/DynamicWebsiteImages/raw/main/SmartSapp%20Logo.png" alt="SmartSapp Logo" class="logo"> </td> </tr> <tr> <td class="title"> Subscription Payment Notification<br><br></td> </tr> <tr> <td class="text"> Hi <strong>Finance Team</strong>,<br><br> A new payment has been made. Here are the details for a receipt to be issued out to the school:<br><br>
            School Name: <strong class="highlight">${school}</strong><br>
            Contact Person: <strong class="highlight">${name}</strong><br>
            Amount Paid: <strong class="highlight">GHS ${amount}</strong><br>
            Phone: <strong class="highlight">${phone}</strong><br>
            Email: <strong class="highlight">${email}</strong><br><br>
            Kindly update the <strong>Subscription Bills Sheet</strong> using the link below:<br>${getBaseUrl()}/q/subs-paid</td> </tr> <tr> <td class="cta"> <a href="${getBaseUrl()}/q/subs-paid" class="button" style="color:white">Subscription Bills</a> </td> </tr> <tr> <td class="text">  </td> </tr> <tr> <td class="text"> <br> Warmly,<br> <strong>SmartSapp Accounts Team</strong> </td> </tr> </table> <div class="footer"> © Minex360 Services Limited | SmartSapp. </div> </td> </tr> </table> </body> </html>
        `;

        await sendEmail({
            to: ['info@smartsapp.com', 'accounts@smartsapp.com'],
            subject: `New Payment Receipt Request: ${school}`,
            html: financeEmailHtml
        });

        // 3. Send Client Acknowledgement SMS
        const clientSmsMessage = `Hi ${name}, we've received your receipt request for ${school}. Our accounts team is processing your GHS ${amount} payment now. You'll receive your official receipt shortly. Thank you!`;
        
        await sendSms({
            recipient: phone,
            message: clientSmsMessage,
            sender: 'SMARTSAPP'
        });

        // 4. Send SmartSapp Team SMS Notification
        const teamSmsMessage = `💡 New Payment - Receipt Requested\nPayee: ${name}\nSchool: ${school}\nAmount: GHS ${amount}\nEmail: ${email}\nPhone: ${phone}\nUpdate Billing: ${getBaseUrl()}/q/subs-paid`;
        
        const teamRecipients = ['233242737120', '233248826361', '233509751798', '233204308682'];
        
        await sendSms({
            recipient: teamRecipients,
            message: teamSmsMessage,
            sender: 'SMARTSAPP'
        });

        // 4. Sync with Pabbly Webhook
        await fetch(PABBLY_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...payload,
                type: 'subscription_payment_receipt_request',
                source: 'portal_automatic_flow',
                timestamp: new Date().toISOString()
            }),
            mode: 'no-cors'
        });

        return { success: true };
    } catch (error: any) {
        console.error(">>> [NOTIFICATION ERROR]", error);
        return { success: false, error: error.message };
    }
}
