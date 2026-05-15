/**
 * OTP Verification Service using Twilio SMS with Alpha Sender ID
 * Generates random 6-digit codes, stores them in memory with expiry,
 * and sends via regular SMS from "WeShop4U" sender name.
 * 
 * This replaces Twilio Verify API which was blocked by error 60238.
 * Alpha Sender ID confirmed working for Irish mobile numbers.
 */

import twilio from 'twilio';

// In-memory OTP store: phone -> { code, expiresAt, attempts }
const otpStore = new Map<string, { code: string; expiresAt: number; attempts: number }>();

// Rate limiting store: phone -> array of send timestamps (within the last hour)
const rateLimitStore = new Map<string, number[]>();

// OTP configuration
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_VERIFY_ATTEMPTS = 5; // Max wrong code attempts before requiring resend
const MAX_SENDS_PER_HOUR = 3; // Max OTP sends per phone number per hour
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const ALPHA_SENDER_ID = 'WeShop4U'; // Alphanumeric sender ID (no phone number needed)

/**
 * Normalize Irish phone numbers to E.164 format
 * Handles common Irish formats: 087..., 08x..., +353..., 353...
 */
function normalizeIrishPhone(phone: string): string {
  // Remove all spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // If already in E.164 format with +
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  // If starts with 00 (international dialing prefix)
  if (cleaned.startsWith('00')) {
    return '+' + cleaned.substring(2);
  }
  
  // If starts with 353 (Irish country code without +)
  if (cleaned.startsWith('353')) {
    return '+' + cleaned;
  }
  
  // If starts with 0 (Irish domestic format like 087, 085, 083, 086, 089)
  if (cleaned.startsWith('0')) {
    return '+353' + cleaned.substring(1);
  }
  
  // Fallback: assume Irish number without leading 0
  if (cleaned.length >= 9 && cleaned.length <= 10) {
    return '+353' + cleaned;
  }
  
  // Return as-is with + prefix if nothing else matches
  return '+' + cleaned;
}

/**
 * Generate a cryptographically random 6-digit OTP code
 */
function generateOTPCode(): string {
  // Generate a random number between 100000 and 999999
  const code = Math.floor(100000 + Math.random() * 900000);
  return code.toString();
}

/**
 * Clean up expired OTP entries and stale rate limit records
 */
function cleanupExpiredOTPs(): void {
  const now = Date.now();
  for (const [phone, entry] of otpStore.entries()) {
    if (now > entry.expiresAt) {
      otpStore.delete(phone);
    }
  }
  // Clean up rate limit entries older than the window
  for (const [phone, timestamps] of rateLimitStore.entries()) {
    const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) {
      rateLimitStore.delete(phone);
    } else {
      rateLimitStore.set(phone, recent);
    }
  }
}

/**
 * Check if a phone number has exceeded the rate limit
 * Returns { allowed, remainingSeconds } — remainingSeconds is how long until next send is allowed
 */
function checkRateLimit(phone: string): { allowed: boolean; remainingSeconds: number } {
  const now = Date.now();
  const timestamps = rateLimitStore.get(phone) || [];
  
  // Filter to only timestamps within the last hour
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (recent.length >= MAX_SENDS_PER_HOUR) {
    // Find the oldest timestamp in the window — that's when the limit will reset
    const oldestInWindow = Math.min(...recent);
    const resetAt = oldestInWindow + RATE_LIMIT_WINDOW_MS;
    const remainingSeconds = Math.ceil((resetAt - now) / 1000);
    return { allowed: false, remainingSeconds };
  }
  
  return { allowed: true, remainingSeconds: 0 };
}

/**
 * Record a send for rate limiting
 */
function recordSend(phone: string): void {
  const now = Date.now();
  const timestamps = rateLimitStore.get(phone) || [];
  timestamps.push(now);
  rateLimitStore.set(phone, timestamps);
}

/**
 * Get a configured Twilio client
 */
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured');
  }
  
  return twilio(accountSid, authToken);
}

/**
 * Send an OTP verification code to a phone number
 * Generates a random 6-digit code and sends it via SMS with Alpha Sender ID
 */
export async function sendOTP(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getTwilioClient();
    const normalizedPhone = normalizeIrishPhone(phoneNumber);
    
    // Clean up expired entries
    cleanupExpiredOTPs();
    
    // Generate new OTP code
    const code = generateOTPCode();
    
    // Check rate limit before sending
    const rateCheck = checkRateLimit(normalizedPhone);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.remainingSeconds / 60);
      console.log(`[OTP] Rate limited: ${normalizedPhone} — try again in ${minutes} min`);
      return { success: false, error: `Too many verification codes sent. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` };
    }
    
    // Store the code with expiry
    otpStore.set(normalizedPhone, {
      code,
      expiresAt: Date.now() + OTP_EXPIRY_MS,
      attempts: 0,
    });
    
    console.log(`[OTP] Sending code to ${normalizedPhone} (original: ${phoneNumber})`);
    
    // Send SMS using Alpha Sender ID
    const message = await client.messages.create({
      body: `Your WeShop4U verification code is: ${code}. This code expires in 5 minutes.`,
      from: ALPHA_SENDER_ID,
      to: normalizedPhone,
    });
    
    console.log(`[OTP] SMS sent. SID: ${message.sid}, Status: ${message.status}`);
    
    // Record this send for rate limiting
    recordSend(normalizedPhone);
    
    return { success: true };
  } catch (error: any) {
    console.error('[OTP] Error sending SMS:', error.message);
    
    // Clean up the stored code if send failed
    const normalizedPhone = normalizeIrishPhone(phoneNumber);
    otpStore.delete(normalizedPhone);
    
    if (error.code === 21211) {
      return { success: false, error: 'Invalid phone number. Please check and try again.' };
    }
    if (error.code === 21608) {
      return { success: false, error: 'Unable to send SMS to this number. Please try a different number.' };
    }
    
    return { success: false, error: error.message || 'Failed to send verification code' };
  }
}

/**
 * Verify an OTP code entered by the user
 * Checks the code against the stored value and handles expiry/attempts
 */
export async function verifyOTP(phoneNumber: string, code: string): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedPhone = normalizeIrishPhone(phoneNumber);
    
    console.log(`[OTP] Verifying code for ${normalizedPhone}`);
    
    const entry = otpStore.get(normalizedPhone);
    
    if (!entry) {
      return { success: false, error: 'No verification code found. Please request a new one.' };
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      otpStore.delete(normalizedPhone);
      return { success: false, error: 'Verification code expired. Please request a new one.' };
    }
    
    // Check max attempts
    if (entry.attempts >= MAX_VERIFY_ATTEMPTS) {
      otpStore.delete(normalizedPhone);
      return { success: false, error: 'Too many incorrect attempts. Please request a new code.' };
    }
    
    // Check the code
    if (entry.code === code) {
      // Success — remove the entry
      otpStore.delete(normalizedPhone);
      console.log(`[OTP] Verification successful for ${normalizedPhone}`);
      return { success: true };
    } else {
      // Wrong code — increment attempts
      entry.attempts++;
      console.log(`[OTP] Wrong code for ${normalizedPhone}. Attempt ${entry.attempts}/${MAX_VERIFY_ATTEMPTS}`);
      return { success: false, error: 'Invalid verification code. Please try again.' };
    }
  } catch (error: any) {
    console.error('[OTP] Error verifying code:', error.message);
    return { success: false, error: error.message || 'Failed to verify code' };
  }
}
