/**
 * SMS Service for WeShop4U
 * 
 * Cost-saving strategy: Only 2 SMS per guest order.
 * Logged-in users get push notifications instead (free).
 * 
 * SMS #1 — Order Confirmed (sent on order placement)
 * SMS #2 — Driver at Store + tracking link (sent when driver taps "Arrived at Store")
 * 
 * Uses Twilio with Alpha Sender ID "WeShop4U" for consistent branding.
 */

import twilio from 'twilio';

const ALPHA_SENDER_ID = 'WeShop4U';

interface SendSMSParams {
  to: string;
  message: string;
}

/**
 * Normalize Irish phone numbers to E.164 format
 * Handles: 087..., 08x..., +353..., 353..., 00353...
 */
function normalizeIrishPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return '+' + cleaned.substring(2);
  if (cleaned.startsWith('353')) return '+' + cleaned;
  if (cleaned.startsWith('0')) return '+353' + cleaned.substring(1);
  if (cleaned.length >= 9 && cleaned.length <= 10) return '+353' + cleaned;
  
  return '+' + cleaned;
}

/**
 * Send an SMS message using Alpha Sender ID "WeShop4U"
 */
export async function sendSMS({ to, message }: SendSMSParams): Promise<boolean> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.log('[SMS] Twilio not configured. Logging SMS to console:');
      console.log(`[SMS] To: ${to}`);
      console.log(`[SMS] Message: ${message}`);
      return true;
    }

    const normalizedTo = normalizeIrishPhone(to);
    const client = twilio(accountSid, authToken);
    const result = await client.messages.create({
      body: message,
      from: ALPHA_SENDER_ID,
      to: normalizedTo,
    });

    console.log(`[SMS] Sent to ${normalizedTo}. SID: ${result.sid}, Status: ${result.status}`);
    return true;
  } catch (error: any) {
    console.error('[SMS] Error sending SMS:', error.message);
    return false;
  }
}

/**
 * SMS #1 — Order Confirmed
 * Triggered: when a GUEST order is placed (no customerId)
 * 
 * "Your Spar Balbriggan order #70 is confirmed! We'll let you know when the driver is at the store."
 */
export async function sendOrderConfirmationSMS(
  phoneNumber: string,
  storeName: string,
  orderId: number
): Promise<boolean> {
  const message = `Your ${storeName} order #${orderId} is confirmed! We'll let you know when the driver is at the store.\n- WeShop4U`;
  return sendSMS({ to: phoneNumber, message });
}

/**
 * SMS #2 — Driver at Store + Tracking Link
 * Triggered: when driver taps "Arrived at Store" (notifyDriverAtStore endpoint)
 * Only sent to GUEST orders (no customerId)
 * 
 * "Your driver has arrived at Spar Balbriggan to collect your order WS4U/SPR/070!
 *  Track your driver here: https://..."
 */
export async function sendDriverAtStoreSMS(
  phoneNumber: string,
  storeName: string,
  orderNumber: string,
  trackingUrl: string
): Promise<boolean> {
  const message = `Your driver has arrived at ${storeName} to collect your order ${orderNumber}! Track your driver here: ${trackingUrl}\n- WeShop4U`;
  return sendSMS({ to: phoneNumber, message });
}
