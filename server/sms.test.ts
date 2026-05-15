import { describe, it, expect } from 'vitest';
import twilio from 'twilio';

describe('Twilio SMS Integration', () => {
  it('should validate Twilio credentials', async () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    // Check that all credentials are present
    expect(accountSid).toBeDefined();
    expect(authToken).toBeDefined();
    expect(fromNumber).toBeDefined();

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Twilio credentials not configured');
    }

    // Validate credentials by creating a Twilio client and fetching account info
    const client = twilio(accountSid, authToken);
    
    try {
      // Fetch account information to validate credentials
      const account = await client.api.accounts(accountSid).fetch();
      
      // Check that the account is active
      expect(account.status).toBe('active');
      expect(account.sid).toBe(accountSid);
      
      console.log('✅ Twilio credentials validated successfully');
      console.log(`Account Status: ${account.status}`);
      console.log(`Account Type: ${account.type}`);
    } catch (error: any) {
      console.error('❌ Twilio credential validation failed:', error.message);
      throw new Error(`Invalid Twilio credentials: ${error.message}`);
    }
  });
});
