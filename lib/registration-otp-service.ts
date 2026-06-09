import { otpService } from './otp-service';
import { clientEmailService } from './client-email-service';

interface RegistrationOTPData {
  email: string;
  username: string;
  otpId: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  verified: boolean;
}

class RegistrationOTPService {
  private registrationOTPs: Map<string, RegistrationOTPData> = new Map();
  private readonly OTP_EXPIRY_MINUTES = 10;
  private readonly MAX_ATTEMPTS = 3;
  private readonly RESEND_COOLDOWN_SECONDS = 60; // 60 seconds cooldown between resends
  private readonly MAX_RESEND_ATTEMPTS = 3; // 3 resend attempts allowed
  private readonly BLOCK_DURATION_MINUTES = 10; // 10 minutes block after max resends

  async sendRegistrationOTP(email: string, username: string): Promise<{ success: boolean; message: string; otpId?: string; canResend?: boolean; resendCooldown?: number; blockedUntil?: number }> {
    try {
      // Use the enhanced OTP service
      const otpResult = otpService.generateOTP(email, username);
      
      if (!otpResult.success) {
        return {
          success: false,
          message: otpResult.message,
          canResend: otpResult.canResend,
          resendCooldown: otpResult.resendCooldown,
          blockedUntil: otpResult.blockedUntil
        };
      }

      // Get the OTP data
      const otpData = otpService.getOTPData(otpResult.otpId!);
      if (!otpData) {
        return {
          success: false,
          message: 'Failed to generate OTP. Please try again.'
        };
      }

      // Send OTP email for REGISTRATION (not password reset)
      const emailSent = await clientEmailService.sendOTPEmail({
        to: email,
        toName: username,
        otpCode: otpData.code,
        expiryMinutes: this.OTP_EXPIRY_MINUTES,
        subject: 'Login OTP Verification - WMS System'
      });

      if (!emailSent) {
        return {
          success: false,
          message: 'Failed to send OTP email. Please try again.'
        };
      }

      // Store registration OTP data
      const registrationOTPData: RegistrationOTPData = {
        email,
        username,
        otpId: otpResult.otpId!,
        createdAt: Date.now(),
        expiresAt: Date.now() + (this.OTP_EXPIRY_MINUTES * 60 * 1000),
        attempts: 0,
        verified: false
      };

      this.registrationOTPs.set(otpResult.otpId!, registrationOTPData);

      return {
        success: true,
        message: `OTP sent successfully to ${email}. Valid for ${this.OTP_EXPIRY_MINUTES} minutes.`,
        otpId: otpResult.otpId!,
        canResend: otpResult.canResend,
        resendCooldown: otpResult.resendCooldown
      };
    } catch (error) {
      console.error('Error sending registration OTP:', error);
      return {
        success: false,
        message: 'An error occurred while sending OTP. Please try again.'
      };
    }
  }

  async verifyRegistrationOTP(otpId: string, enteredOTP: string): Promise<{ success: boolean; message: string; remainingAttempts?: number }> {
    try {
      const registrationOTPData = this.registrationOTPs.get(otpId);
      
      if (!registrationOTPData) {
        return {
          success: false,
          message: 'Invalid OTP session. Please request a new OTP.'
        };
      }

      if (this.isOTPExpired(registrationOTPData)) {
        this.registrationOTPs.delete(otpId);
        return {
          success: false,
          message: 'OTP has expired. Please request a new one.'
        };
      }

      if (registrationOTPData.verified) {
        return {
          success: false,
          message: 'OTP has already been used. Please request a new one.'
        };
      }

      if (registrationOTPData.attempts >= this.MAX_ATTEMPTS) {
        this.registrationOTPs.delete(otpId);
        return {
          success: false,
          message: 'Maximum verification attempts exceeded. Please request a new OTP.'
        };
      }

      // Verify OTP using the main OTP service
      const otpResult = otpService.verifyOTP(otpId, enteredOTP);
      
      if (!otpResult.success) {
        // Update attempts
        registrationOTPData.attempts += 1;
        this.registrationOTPs.set(otpId, registrationOTPData);
        
        return {
          success: false,
          message: otpResult.message,
          remainingAttempts: this.MAX_ATTEMPTS - registrationOTPData.attempts
        };
      }

      // Mark as verified
      registrationOTPData.verified = true;
      this.registrationOTPs.set(otpId, registrationOTPData);

      return {
        success: true,
        message: 'OTP verified successfully.'
      };
    } catch (error) {
      console.error('Error verifying registration OTP:', error);
      return {
        success: false,
        message: 'An error occurred while verifying OTP. Please try again.'
      };
    }
  }

  getRegistrationOTPData(otpId: string): RegistrationOTPData | null {
    const otpData = this.registrationOTPs.get(otpId);
    if (otpData && !this.isOTPExpired(otpData)) {
      return otpData;
    }
    return null;
  }

  markOTPAsUsed(otpId: string): boolean {
    const otpData = this.registrationOTPs.get(otpId);
    if (otpData && otpData.verified) {
      this.registrationOTPs.delete(otpId);
      return true;
    }
    return false;
  }

  private isOTPExpired(otpData: RegistrationOTPData): boolean {
    return Date.now() > otpData.expiresAt;
  }

  // Resend OTP with proper blocking logic
  async resendRegistrationOTP(email: string, username: string): Promise<{ success: boolean; message: string; otpId?: string; canResend?: boolean; resendCooldown?: number; blockedUntil?: number }> {
    try {
      // Use the enhanced OTP service resend functionality
      const otpResult = otpService.resendOTP(email, username);
      
      if (!otpResult.success) {
        return {
          success: false,
          message: otpResult.message,
          canResend: otpResult.canResend,
          resendCooldown: otpResult.resendCooldown,
          blockedUntil: otpResult.blockedUntil
        };
      }

      // Get the OTP data
      const otpData = otpService.getOTPData(otpResult.otpId!);
      if (!otpData) {
        return {
          success: false,
          message: 'Failed to generate OTP. Please try again.'
        };
      }

      // Send OTP email for REGISTRATION (not password reset)
      const emailSent = await clientEmailService.sendOTPEmail({
        to: email,
        toName: username,
        otpCode: otpData.code,
        expiryMinutes: this.OTP_EXPIRY_MINUTES,
        subject: 'Login OTP Verification - WMS System'
      });

      if (!emailSent) {
        return {
          success: false,
          message: 'Failed to send OTP email. Please try again.'
        };
      }

      // Update registration OTP data
      const registrationOTPData: RegistrationOTPData = {
        email,
        username,
        otpId: otpResult.otpId!,
        createdAt: Date.now(),
        expiresAt: Date.now() + (this.OTP_EXPIRY_MINUTES * 60 * 1000),
        attempts: 0,
        verified: false
      };

      this.registrationOTPs.set(otpResult.otpId!, registrationOTPData);

      return {
        success: true,
        message: otpResult.message,
        otpId: otpResult.otpId!,
        canResend: otpResult.canResend,
        resendCooldown: otpResult.resendCooldown
      };
    } catch (error) {
      console.error('Error resending registration OTP:', error);
      return {
        success: false,
        message: 'An error occurred while resending OTP. Please try again.'
      };
    }
  }

  // Get resend status for UI
  getResendStatus(email: string): { canResend: boolean; cooldownRemaining: number; blockedUntil: number; remainingAttempts: number } {
    return otpService.getResendStatus(email);
  }

  cleanupExpiredOTPs(): void {
    const now = Date.now();
    this.registrationOTPs.forEach((otpData, otpId) => {
      if (now > otpData.expiresAt) {
        this.registrationOTPs.delete(otpId);
      }
    });
  }
}

// Export singleton instance
export const registrationOTPService = new RegistrationOTPService();
export default registrationOTPService;
