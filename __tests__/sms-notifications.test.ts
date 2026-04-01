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

describe("SMS Notification System — 2 SMS per guest order", () => {
  describe("sms.ts — Alpha Sender ID and core sendSMS", () => {
    let sendSMS: any;
    let sendOrderConfirmationSMS: any;
    let sendDriverAtStoreSMS: any;
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

    it("should normalize numbers with spaces and dashes", async () => {
      await sendSMS({ to: "089-123 4567", message: "Test" });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ to: "+353891234567" })
      );
    });

    it("should log to console and return true when Twilio not configured", async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
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

  describe("SMS #1 — sendOrderConfirmationSMS", () => {
    let sendOrderConfirmationSMS: any;
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
    });

    it("should include store name and order ID", async () => {
      await sendOrderConfirmationSMS("+353891234567", "Spar Balbriggan", 42);
      const body = mockCreate.mock.calls[0][0].body;
      expect(body).toContain("Spar Balbriggan");
      expect(body).toContain("#42");
    });

    it("should tell customer we'll notify when driver is at store", async () => {
      await sendOrderConfirmationSMS("+353891234567", "Spar Balbriggan", 70);
      const body = mockCreate.mock.calls[0][0].body;
      expect(body).toContain("driver is at the store");
    });

    it("should include WeShop4U branding", async () => {
      await sendOrderConfirmationSMS("+353891234567", "Spar", 1);
      expect(mockCreate.mock.calls[0][0].body).toContain("WeShop4U");
    });

    it("should use Alpha Sender ID", async () => {
      await sendOrderConfirmationSMS("+353891234567", "Spar", 1);
      expect(mockCreate.mock.calls[0][0].from).toBe("WeShop4U");
    });
  });

  describe("SMS #2 — sendDriverAtStoreSMS", () => {
    let sendDriverAtStoreSMS: any;
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
      sendDriverAtStoreSMS = sms.sendDriverAtStoreSMS;
    });

    it("should mention store name and order number", async () => {
      await sendDriverAtStoreSMS("+353891234567", "Spar Balbriggan", "WS4U/SPR/070", "https://weshop4u.app/track/123");
      const body = mockCreate.mock.calls[0][0].body;
      expect(body).toContain("Spar Balbriggan");
      expect(body).toContain("WS4U/SPR/070");
    });

    it("should include tracking link", async () => {
      await sendDriverAtStoreSMS("+353891234567", "Spar Balbriggan", "WS4U/SPR/070", "https://weshop4u.app/track/123");
      const body = mockCreate.mock.calls[0][0].body;
      expect(body).toContain("https://weshop4u.app/track/123");
    });

    it("should say driver has arrived", async () => {
      await sendDriverAtStoreSMS("+353891234567", "Spar", "WS4U/SPR/070", "https://weshop4u.app/track/123");
      const body = mockCreate.mock.calls[0][0].body;
      expect(body).toContain("arrived");
    });

    it("should include WeShop4U branding", async () => {
      await sendDriverAtStoreSMS("+353891234567", "Spar", "WS4U/SPR/070", "https://weshop4u.app/track/123");
      expect(mockCreate.mock.calls[0][0].body).toContain("WeShop4U");
    });

    it("should use Alpha Sender ID", async () => {
      await sendDriverAtStoreSMS("+353891234567", "Spar", "WS4U/SPR/070", "https://weshop4u.app/track/123");
      expect(mockCreate.mock.calls[0][0].from).toBe("WeShop4U");
    });
  });

  describe("Only 2 SMS functions exported (cost saving)", () => {
    it("should only export sendSMS, sendOrderConfirmationSMS, and sendDriverAtStoreSMS", async () => {
      vi.resetModules();
      const sms = await import("../server/sms");
      const exportedKeys = Object.keys(sms);
      
      expect(exportedKeys).toContain("sendSMS");
      expect(exportedKeys).toContain("sendOrderConfirmationSMS");
      expect(exportedKeys).toContain("sendDriverAtStoreSMS");
      
      // These should NOT exist anymore
      expect(exportedKeys).not.toContain("sendOnTheWaySMS");
      expect(exportedKeys).not.toContain("sendDriverArrivedSMS");
      expect(exportedKeys).not.toContain("sendDeliveredSMS");
      expect(exportedKeys).not.toContain("sendOrderCancelledSMS");
    });
  });

  describe("OTP Rate Limiting", () => {
    it("should block after 3 sends to the same number within an hour", async () => {
      vi.resetModules();
      process.env.TWILIO_ACCOUNT_SID = "AC_test_sid";
      process.env.TWILIO_AUTH_TOKEN = "test_auth_token";

      const otp = await import("../server/otp");

      const result1 = await otp.sendOTP("+353891111111");
      expect(result1.success).toBe(true);

      const result2 = await otp.sendOTP("+353891111111");
      expect(result2.success).toBe(true);

      const result3 = await otp.sendOTP("+353891111111");
      expect(result3.success).toBe(true);

      const result4 = await otp.sendOTP("+353891111111");
      expect(result4.success).toBe(false);
      expect(result4.error).toContain("Too many verification codes");
    });

    it("should allow sends to different phone numbers independently", async () => {
      vi.resetModules();
      process.env.TWILIO_ACCOUNT_SID = "AC_test_sid";
      process.env.TWILIO_AUTH_TOKEN = "test_auth_token";

      const otp = await import("../server/otp");

      await otp.sendOTP("+353892222222");
      await otp.sendOTP("+353892222222");
      await otp.sendOTP("+353892222222");

      const resultA = await otp.sendOTP("+353892222222");
      expect(resultA.success).toBe(false);

      const resultB = await otp.sendOTP("+353893333333");
      expect(resultB.success).toBe(true);
    });

    it("should normalize phone numbers for rate limiting (087... and +353...)", async () => {
      vi.resetModules();
      process.env.TWILIO_ACCOUNT_SID = "AC_test_sid";
      process.env.TWILIO_AUTH_TOKEN = "test_auth_token";

      const otp = await import("../server/otp");

      await otp.sendOTP("0894444444");
      await otp.sendOTP("+353894444444");
      await otp.sendOTP("353894444444");

      const result = await otp.sendOTP("089 444 4444");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Too many");
    });
  });
});
