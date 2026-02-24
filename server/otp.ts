/**
 * OTP Verification Service using Twilio Verify API
 * Used for guest checkout phone number verification
 */

import twilio from 'twilio';

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
 * Uses Twilio Verify API which handles code generation, delivery, and expiry
 */
export async function sendOTP(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
  try {
    const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!verifySid) {
      throw new Error('Twilio Verify Service SID not configured');
    }
    
    const client = getTwilioClient();
    const normalizedPhone = normalizeIrishPhone(phoneNumber);
    
    console.log(`[OTP] Sending verification to ${normalizedPhone} (original: ${phoneNumber})`);
    
    const verification = await client.verify.v2
      .services(verifySid)
      .verifications.create({
        to: normalizedPhone,
        channel: 'sms',
      });
    
    console.log(`[OTP] Verification sent. Status: ${verification.status}, SID: ${verification.sid}`);
    
    return { success: true };
  } catch (error: any) {
    console.error('[OTP] Error sending verification:', error.message);
    
    // Handle common Twilio errors with user-friendly messages
    if (error.code === 60200) {
      return { success: false, error: 'Invalid phone number. Please check and try again.' };
    }
    if (error.code === 60203) {
      return { success: false, error: 'Too many verification attempts. Please wait a few minutes and try again.' };
    }
    if (error.code === 60212) {
      return { success: false, error: 'Too many verification attempts for this number. Please try again later.' };
    }
    
    return { success: false, error: error.message || 'Failed to send verification code' };
  }
}

/**
 * Verify an OTP code entered by the user
 * Returns true if the code is correct and not expired
 */
export async function verifyOTP(phoneNumber: string, code: string): Promise<{ success: boolean; error?: string }> {
  try {
    const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!verifySid) {
      throw new Error('Twilio Verify Service SID not configured');
    }
    
    const client = getTwilioClient();
    const normalizedPhone = normalizeIrishPhone(phoneNumber);
    
    console.log(`[OTP] Checking verification for ${normalizedPhone}`);
    
    const verificationCheck = await client.verify.v2
      .services(verifySid)
      .verificationChecks.create({
        to: normalizedPhone,
        code: code,
      });
    
    console.log(`[OTP] Verification check status: ${verificationCheck.status}`);
    
    if (verificationCheck.status === 'approved') {
      return { success: true };
    } else {
      return { success: false, error: 'Invalid verification code. Please try again.' };
    }
  } catch (error: any) {
    console.error('[OTP] Error checking verification:', error.message);
    
    if (error.code === 60200) {
      return { success: false, error: 'Invalid phone number format.' };
    }
    if (error.code === 20404) {
      return { success: false, error: 'Verification code expired. Please request a new one.' };
    }
    
    return { success: false, error: error.message || 'Failed to verify code' };
  }
}
