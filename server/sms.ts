/**
 * SMS Service for sending text messages to customers
 * Uses Twilio with Alpha Sender ID "WeShop4U" for consistent branding.
 * 
 * All customer-facing SMS comes from "WeShop4U" sender name.
 * Irish numbers are normalized to E.164 format (+353...).
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
 * Send order confirmation SMS
 * Triggered: when order is placed
 */
export async function sendOrderConfirmationSMS(
  phoneNumber: string,
  storeName: string,
  orderId: number
): Promise<boolean> {
  const message = `Your ${storeName} order #${orderId} is confirmed! We'll text you when it's on the way.\n- WeShop4U`;
  return sendSMS({ to: phoneNumber, message });
}

/**
 * Send "driver at store" SMS
 * Triggered: when driver taps "Arrived at Store"
 */
export async function sendDriverAtStoreSMS(
  phoneNumber: string,
  storeName: string,
  orderNumber: string
): Promise<boolean> {
  const message = `Your driver has arrived at ${storeName} to collect your order ${orderNumber}. It won't be long now!\n- WeShop4U`;
  return sendSMS({ to: phoneNumber, message });
}

/**
 * Send "order picked up / on the way" SMS
 * Triggered: when driver taps "Picked Up Order" or status changes to on_the_way
 */
export async function sendOnTheWaySMS(
  phoneNumber: string,
  storeName: string,
  orderNumber: string
): Promise<boolean> {
  const message = `Your ${storeName} order ${orderNumber} is on its way to you! Your driver will be there shortly.\n- WeShop4U`;
  return sendSMS({ to: phoneNumber, message });
}

/**
 * Send "driver arrived at your location" SMS
 * Triggered: when driver is near customer (or taps "Arrived")
 */
export async function sendDriverArrivedSMS(
  phoneNumber: string,
  orderNumber: string
): Promise<boolean> {
  const message = `Your driver has arrived with your order ${orderNumber}! Please come to collect your delivery.\n- WeShop4U`;
  return sendSMS({ to: phoneNumber, message });
}

/**
 * Send "order delivered" SMS
 * Triggered: when driver marks order as delivered
 */
export async function sendDeliveredSMS(
  phoneNumber: string,
  orderNumber: string
): Promise<boolean> {
  const message = `Your order ${orderNumber} has been delivered. Enjoy! Thank you for using WeShop4U.\n- WeShop4U`;
  return sendSMS({ to: phoneNumber, message });
}

/**
 * Send "order cancelled" SMS
 * Triggered: when order is cancelled by store or system
 */
export async function sendOrderCancelledSMS(
  phoneNumber: string,
  orderNumber: string,
  storeName: string
): Promise<boolean> {
  const message = `Unfortunately your ${storeName} order ${orderNumber} has been cancelled. If you were charged, a refund will be processed. Contact us if you need help.\n- WeShop4U`;
  return sendSMS({ to: phoneNumber, message });
}
