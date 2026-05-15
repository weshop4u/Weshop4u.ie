import { describe, it, expect } from "vitest";

describe("Twilio credentials validation", () => {
  it("should have all required Twilio environment variables set", () => {
    expect(process.env.TWILIO_ACCOUNT_SID).toBeDefined();
    expect(process.env.TWILIO_ACCOUNT_SID).toMatch(/^AC/);
    expect(process.env.TWILIO_AUTH_TOKEN).toBeDefined();
    expect(process.env.TWILIO_AUTH_TOKEN!.length).toBeGreaterThan(10);
    expect(process.env.TWILIO_PHONE_NUMBER).toBeDefined();
    expect(process.env.TWILIO_PHONE_NUMBER).toMatch(/^\+/);
    expect(process.env.TWILIO_VERIFY_SERVICE_SID).toBeDefined();
    expect(process.env.TWILIO_VERIFY_SERVICE_SID).toMatch(/^VA/);
  });

  it("should authenticate with Twilio API using Account SID and Auth Token", async () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;

    // Make a lightweight API call to verify credentials
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
      {
        headers: {
          Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        },
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sid).toBe(accountSid);
    expect(data.status).toBe("active");
  });

  it("should validate Twilio Verify Service SID exists", async () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID!;

    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${verifySid}`,
      {
        headers: {
          Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        },
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sid).toBe(verifySid);
    expect(data.friendly_name).toBeTruthy();
  });
});
