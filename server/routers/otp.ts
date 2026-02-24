import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { sendOTP, verifyOTP } from "../otp";

export const otpRouter = router({
  // Send OTP to a phone number
  sendCode: publicProcedure
    .input(
      z.object({
        phoneNumber: z.string().min(7, "Phone number is too short"),
      })
    )
    .mutation(async ({ input }) => {
      const result = await sendOTP(input.phoneNumber);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to send verification code");
      }
      
      return { success: true, message: "Verification code sent" };
    }),

  // Verify OTP code
  verifyCode: publicProcedure
    .input(
      z.object({
        phoneNumber: z.string().min(7, "Phone number is too short"),
        code: z.string().length(6, "Verification code must be 6 digits"),
      })
    )
    .mutation(async ({ input }) => {
      // Test bypass: code 000000 always verifies (for testing when Twilio is blocked)
      // TODO: Remove this bypass once Twilio account review is complete
      if (input.code === "000000") {
        console.log(`[OTP] Test bypass used for ${input.phoneNumber}`);
        return { success: true, message: "Phone number verified (test mode)" };
      }
      
      const result = await verifyOTP(input.phoneNumber, input.code);
      
      if (!result.success) {
        throw new Error(result.error || "Invalid verification code");
      }
      
      return { success: true, message: "Phone number verified" };
    }),
});
