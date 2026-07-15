import { sendEmail } from '../src/lib/resend-service';

async function testResend() {
  console.log('>>> Testing Resend API...');
  try {
    const res = await sendEmail({
      to: 'josephaidoo241@gmail.com',
      subject: 'Test Verification Email',
      html: '<p>Testing Resend API and checking daily limits</p>',
    });
    console.log('Resend Response Success:', JSON.stringify(res));
  } catch (err: any) {
    console.error('Resend Response Error:', err.message);
  }
}

testResend().catch(console.error);
