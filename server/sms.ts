/**
 * SMS Service for sending text messages to customers
 * Uses Twilio for SMS delivery
 */

interface SendSMSParams {
  to: string;
  message: string;
}

/**
 * Send an SMS message to a phone number
 */
export async function sendSMS({ to, message }: SendSMSParams): Promise<boolean> {
  try {
    // For now, log SMS to console (replace with actual Twilio integration)
    console.log(`[SMS] Sending to ${to}:`);
    console.log(`[SMS] ${message}`);
    
    // TODO: Integrate with Twilio or other SMS provider
    // const accountSid = process.env.TWILIO_ACCOUNT_SID;
    // const authToken = process.env.TWILIO_AUTH_TOKEN;
    // const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    // 
    // const client = require('twilio')(accountSid, authToken);
    // await client.messages.create({
    //   body: message,
    //   from: fromNumber,
    //   to: to
    // });
    
    return true;
  } catch (error) {
    console.error('[SMS] Error sending SMS:', error);
    return false;
  }
}

/**
 * Send order confirmation SMS
 */
export async function sendOrderConfirmationSMS(
  phoneNumber: string,
  storeName: string,
  orderId: number
): Promise<boolean> {
  const message = `Your ${storeName} order #${orderId} is confirmed! We'll text you when it's on the way.\n- WESHOP4U`;
  return sendSMS({ to: phoneNumber, message });
}

/**
 * Send on-the-way SMS with tracking link
 */
export async function sendOnTheWaySMS(
  phoneNumber: string,
  storeName: string,
  trackingId: string,
  trackingUrl: string
): Promise<boolean> {
  const message = `Your ${storeName} order is on the way! Track driver & ETA: ${trackingUrl}\n- WESHOP4U`;
  return sendSMS({ to: phoneNumber, message });
}
