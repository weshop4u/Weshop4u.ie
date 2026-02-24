import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock twilio before importing anything that uses it
vi.mock("twilio", () => {
  const mockCreate = vi.fn().mockResolvedValue({ sid: "SM_test_123", status: "queued" });
  return {
    default: () => ({
      messages: { create: mockCreate },
    }),
    __mockCreate: mockCreate,
  };
});

describe("SMS Notification System", () => {
  describe("sms.ts — Alpha Sender ID and message functions", () => {
    let sendSMS: any;
    let sendOrderConfirmationSMS: any;
    let sendDriverAtStoreSMS: any;
    let sendOnTheWaySMS: any;
    let sendDriverArrivedSMS: any;
    let sendDeliveredSMS: any;
    let sendOrderCancelledSMS: any;
    let mockCreate: any;

    beforeEach(async () => {
      vi.resetModules();
      process.env.TWILIO_ACCOUNT_SID = "AC_test_sid";
      process.env.TWILIO_AUTH_TOKEN = "test_auth_token";

      const twilioMock = await import("twilio");
      mockCreate = (twilioMock as any).__mockCreate;
      mockCreate.mockClear();
      mockCreate.mockResolvedValue({ sid: "SM_test_123", status: "queued" });

      const sms = await import("../server/sms");
      sendSMS = sms.sendSMS;
      sendOrderConfirmationSMS = sms.sendOrderConfirmationSMS;
      sendDriverAtStoreSMS = sms.sendDriverAtStoreSMS;
      sendOnTheWaySMS = sms.sendOnTheWaySMS;
      sendDriverArrivedSMS = sms.sendDriverArrivedSMS;
      sendDeliveredSMS = sms.sendDeliveredSMS;
      sendOrderCancelledSMS = sms.sendOrderCancelledSMS;
    });

    it("should use Alpha Sender ID 'WeShop4U' instead of phone number", async () => {
      await sendSMS({ to: "+353891234567", message: "Test" });
      expect(mockCreate).toHaveBeenCalledWith({
        body: "Test",
        from: "WeShop4U",
        to: "+353891234567",
      });
    });

    it("should normalize Irish domestic numbers to E.164", async () => {
      await sendSMS({ to: "0891234567", message: "Test" });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ to: "+353891234567" })
      );
    });

    it("should normalize numbers starting with 353 (no plus)", async () => {
      await sendSMS({ to: "353891234567", message: "Test" });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ to: "+353891234567" })
      );
    });

    it("sendOrderConfirmationSMS should include store name and order ID", async () => {
      await sendOrderConfirmationSMS("+353891234567", "Spar Balbriggan", 42);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining("Spar Balbriggan"),
          from: "WeShop4U",
        })
      );
      expect(mockCreate.mock.calls[0][0].body).toContain("#42");
      expect(mockCreate.mock.calls[0][0].body).toContain("WeShop4U");
    });

    it("sendDriverAtStoreSMS should mention store and order number", async () => {
      await sendDriverAtStoreSMS("+353891234567", "Spar Balbriggan", "WS4U/SPR/070");
      const body = mockCreate.mock.calls[0][0].body;
      expect(body).toContain("Spar Balbriggan");
      expect(body).toContain("WS4U/SPR/070");
      expect(body).toContain("arrived");
    });

    it("sendOnTheWaySMS should mention order is on the way", async () => {
      await sendOnTheWaySMS("+353891234567", "Spar Balbriggan", "WS4U/SPR/070");
      const body = mockCreate.mock.calls[0][0].body;
      expect(body).toContain("on its way");
      expect(body).toContain("WS4U/SPR/070");
    });

    it("sendDriverArrivedSMS should tell customer driver has arrived", async () => {
      await sendDriverArrivedSMS("+353891234567", "WS4U/SPR/070");
      const body = mockCreate.mock.calls[0][0].body;
      expect(body).toContain("arrived");
      expect(body).toContain("WS4U/SPR/070");
    });

    it("sendDeliveredSMS should confirm delivery", async () => {
      await sendDeliveredSMS("+353891234567", "WS4U/SPR/070");
      const body = mockCreate.mock.calls[0][0].body;
      expect(body).toContain("delivered");
      expect(body).toContain("WS4U/SPR/070");
    });

    it("sendOrderCancelledSMS should mention cancellation and store", async () => {
      await sendOrderCancelledSMS("+353891234567", "WS4U/SPR/070", "Spar Balbriggan");
      const body = mockCreate.mock.calls[0][0].body;
      expect(body).toContain("cancelled");
      expect(body).toContain("Spar Balbriggan");
    });

    it("should log to console and return true when Twilio not configured", async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      // Re-import to get fresh module
      vi.resetModules();
      const smsNoConfig = await import("../server/sms");
      const result = await smsNoConfig.sendSMS({ to: "+353891234567", message: "Test" });
      expect(result).toBe(true);
    });

    it("should return false when Twilio throws an error", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Twilio error"));
      const result = await sendSMS({ to: "+353891234567", message: "Test" });
      expect(result).toBe(false);
    });
  });

  describe("OTP Rate Limiting", () => {
    it("should block after 3 sends to the same number within an hour", async () => {
      vi.resetModules();
      process.env.TWILIO_ACCOUNT_SID = "AC_test_sid";
      process.env.TWILIO_AUTH_TOKEN = "test_auth_token";

      const otp = await import("../server/otp");

      // First 3 sends should succeed
      const result1 = await otp.sendOTP("+353891111111");
      expect(result1.success).toBe(true);

      const result2 = await otp.sendOTP("+353891111111");
      expect(result2.success).toBe(true);

      const result3 = await otp.sendOTP("+353891111111");
      expect(result3.success).toBe(true);

      // 4th send should be rate limited
      const result4 = await otp.sendOTP("+353891111111");
      expect(result4.success).toBe(false);
      expect(result4.error).toContain("Too many verification codes");
    });

    it("should allow sends to different phone numbers independently", async () => {
      vi.resetModules();
      process.env.TWILIO_ACCOUNT_SID = "AC_test_sid";
      process.env.TWILIO_AUTH_TOKEN = "test_auth_token";

      const otp = await import("../server/otp");

      // Send 3 to number A
      await otp.sendOTP("+353892222222");
      await otp.sendOTP("+353892222222");
      await otp.sendOTP("+353892222222");

      // Number A should be rate limited
      const resultA = await otp.sendOTP("+353892222222");
      expect(resultA.success).toBe(false);

      // Number B should still work
      const resultB = await otp.sendOTP("+353893333333");
      expect(resultB.success).toBe(true);
    });

    it("should normalize phone numbers for rate limiting (087... and +353...)", async () => {
      vi.resetModules();
      process.env.TWILIO_ACCOUNT_SID = "AC_test_sid";
      process.env.TWILIO_AUTH_TOKEN = "test_auth_token";

      const otp = await import("../server/otp");

      // Send using different formats of the same number
      await otp.sendOTP("0894444444");
      await otp.sendOTP("+353894444444");
      await otp.sendOTP("353894444444");

      // 4th send (same number, different format) should be blocked
      const result = await otp.sendOTP("089 444 4444");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Too many");
    });
  });

  describe("SMS message content quality", () => {
    let sendOrderConfirmationSMS: any;
    let sendDriverAtStoreSMS: any;
    let sendOnTheWaySMS: any;
    let sendDriverArrivedSMS: any;
    let sendDeliveredSMS: any;
    let sendOrderCancelledSMS: any;
    let mockCreate: any;

    beforeEach(async () => {
      vi.resetModules();
      process.env.TWILIO_ACCOUNT_SID = "AC_test_sid";
      process.env.TWILIO_AUTH_TOKEN = "test_auth_token";

      const twilioMock = await import("twilio");
      mockCreate = (twilioMock as any).__mockCreate;
      mockCreate.mockClear();
      mockCreate.mockResolvedValue({ sid: "SM_test_123", status: "queued" });

      const sms = await import("../server/sms");
      sendOrderConfirmationSMS = sms.sendOrderConfirmationSMS;
      sendDriverAtStoreSMS = sms.sendDriverAtStoreSMS;
      sendOnTheWaySMS = sms.sendOnTheWaySMS;
      sendDriverArrivedSMS = sms.sendDriverArrivedSMS;
      sendDeliveredSMS = sms.sendDeliveredSMS;
      sendOrderCancelledSMS = sms.sendOrderCancelledSMS;
    });

    it("all SMS messages should end with WeShop4U branding", async () => {
      await sendOrderConfirmationSMS("+353891234567", "Spar", 1);
      expect(mockCreate.mock.calls[0][0].body).toContain("WeShop4U");

      mockCreate.mockClear();
      await sendDriverAtStoreSMS("+353891234567", "Spar", "WS4U/SPR/001");
      expect(mockCreate.mock.calls[0][0].body).toContain("WeShop4U");

      mockCreate.mockClear();
      await sendOnTheWaySMS("+353891234567", "Spar", "WS4U/SPR/001");
      expect(mockCreate.mock.calls[0][0].body).toContain("WeShop4U");

      mockCreate.mockClear();
      await sendDriverArrivedSMS("+353891234567", "WS4U/SPR/001");
      expect(mockCreate.mock.calls[0][0].body).toContain("WeShop4U");

      mockCreate.mockClear();
      await sendDeliveredSMS("+353891234567", "WS4U/SPR/001");
      expect(mockCreate.mock.calls[0][0].body).toContain("WeShop4U");

      mockCreate.mockClear();
      await sendOrderCancelledSMS("+353891234567", "WS4U/SPR/001", "Spar");
      expect(mockCreate.mock.calls[0][0].body).toContain("WeShop4U");
    });

    it("all SMS messages should be under 160 characters (single SMS segment)", async () => {
      // Test with typical data
      await sendOrderConfirmationSMS("+353891234567", "Spar Balbriggan", 70);
      expect(mockCreate.mock.calls[0][0].body.length).toBeLessThanOrEqual(160);

      mockCreate.mockClear();
      await sendDriverAtStoreSMS("+353891234567", "Spar Balbriggan", "WS4U/SPR/070");
      expect(mockCreate.mock.calls[0][0].body.length).toBeLessThanOrEqual(160);

      mockCreate.mockClear();
      await sendOnTheWaySMS("+353891234567", "Spar Balbriggan", "WS4U/SPR/070");
      expect(mockCreate.mock.calls[0][0].body.length).toBeLessThanOrEqual(160);

      mockCreate.mockClear();
      await sendDriverArrivedSMS("+353891234567", "WS4U/SPR/070");
      expect(mockCreate.mock.calls[0][0].body.length).toBeLessThanOrEqual(160);

      mockCreate.mockClear();
      await sendDeliveredSMS("+353891234567", "WS4U/SPR/070");
      expect(mockCreate.mock.calls[0][0].body.length).toBeLessThanOrEqual(160);
    });
  });
});
