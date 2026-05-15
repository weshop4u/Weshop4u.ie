/**
 * Script to add phone numbers to Twilio Verify Safe List
 * This prevents Fraud Guard from blocking legitimate verification attempts
 * 
 * Usage: npx tsx scripts/twilio-safelist.ts add +353892003003
 *        npx tsx scripts/twilio-safelist.ts check +353892003003
 *        npx tsx scripts/twilio-safelist.ts remove +353892003003
 */

import 'dotenv/config';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
  process.exit(1);
}

const client = twilio(accountSid, authToken);

const action = process.argv[2];
const phoneNumber = process.argv[3];

if (!action || !phoneNumber) {
  console.log('Usage: npx tsx scripts/twilio-safelist.ts <add|check|remove> <phone_number>');
  console.log('Example: npx tsx scripts/twilio-safelist.ts add +353892003003');
  process.exit(1);
}

async function main() {
  try {
    switch (action) {
      case 'add': {
        const result = await client.verify.v2.safelist.create({ phoneNumber });
        console.log(`✅ Added ${result.phoneNumber} to Safe List (SID: ${result.sid})`);
        break;
      }
      case 'check': {
        const result = await client.verify.v2.safelist(phoneNumber).fetch();
        console.log(`✅ ${result.phoneNumber} is in the Safe List (SID: ${result.sid})`);
        break;
      }
      case 'remove': {
        await client.verify.v2.safelist(phoneNumber).remove();
        console.log(`✅ Removed ${phoneNumber} from Safe List`);
        break;
      }
      default:
        console.error(`Unknown action: ${action}. Use add, check, or remove.`);
        process.exit(1);
    }
  } catch (error: any) {
    if (error.status === 404) {
      console.log(`ℹ️ ${phoneNumber} is NOT in the Safe List`);
    } else {
      console.error(`❌ Error: ${error.message}`);
      if (error.code) console.error(`   Code: ${error.code}`);
    }
  }
}

main();
