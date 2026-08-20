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

const RETRY_DELAYS_MS = [60_000, 300_000]; // retry failed sends after 1 min, then 5 min

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
  const normalizedTo = normalizeIrishPhone(to);

  const ok = await tryGatewaySend(normalizedTo, message);
  if (ok) return true;

  // Gateway failed — retry in the background (1 min, then 5 min) so a
  // short sms-gate.app outage doesn't silently eat messages.
  scheduleRetries(normalizedTo, message);
  return false;
}

async function tryGatewaySend(normalizedTo: string, message: string): Promise<boolean> {
  const gateUser = process.env.SMSGATE_USER;
  const gatePass = process.env.SMSGATE_PASS;
  if (!gateUser || !gatePass) {
    console.error('[SMS] Gateway credentials not configured — SMS not sent');
    return false;
  }
  try {
    const res = await fetch('https://api.sms-gate.app/3rdparty/v1/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${gateUser}:${gatePass}`).toString('base64'),
      },
      body: JSON.stringify({ message, phoneNumbers: [normalizedTo] }),
    });
    if (res.ok) {
      console.log(`[SMS] Sent via phone gateway to ${normalizedTo}`);
      return true;
    }
    console.error(`[SMS] Gateway responded ${res.status} for ${normalizedTo}`);
    return false;
  } catch (error: any) {
    console.error('[SMS] Gateway error:', error.message);
    return false;
  }
}

function scheduleRetries(normalizedTo: string, message: string) {
  RETRY_DELAYS_MS.forEach((delay, i) => {
    setTimeout(async () => {
      const ok = await tryGatewaySend(normalizedTo, message);
      if (ok) {
        console.log(`[SMS] Retry ${i + 1} succeeded for ${normalizedTo}`);
      } else if (i === RETRY_DELAYS_MS.length - 1) {
        console.error(`[SMS] All retries exhausted — SMS to ${normalizedTo} LOST`);
      }
    }, delay);
  });
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
/**
 * SMS #3 — Order Delivered + App Plug
 * Triggered: when the order is marked delivered
 * Only sent to customers without the app (no push token)
 */
export async function sendOrderDeliveredSMS(
  phoneNumber: string
): Promise<boolean> {
  const message = `Order delivered - thank you for using WeShop4U! Get our app on the Play Store for faster ordering next time.\n- WeShop4U`;
  return sendSMS({ to: phoneNumber, message });
}

export async function sendDriverAtStoreSMS(
  phoneNumber: string,
  storeName: string,
  orderNumber: string,
  trackingUrl: string
): Promise<boolean> {
  const message = `Your driver has arrived at ${storeName} to collect your order ${orderNumber}! Track your driver here: ${trackingUrl}\n- WeShop4U`;
  return sendSMS({ to: phoneNumber, message });
}
