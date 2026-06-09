interface OTPData {
  code: string;
  email: string;
  username: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  verified: boolean;
  resendCount: number;
  lastResendAt: number;
}

interface OTPResult {
  success: boolean;
  message: string;
  otpId?: string;
  remainingAttempts?: number;
  canResend?: boolean;
  resendCooldown?: number;
  blockedUntil?: number;
}

interface ResendBlockData {
  email: string;
  resendAttempts: number;
  blockedUntil: number;
  lastAttemptAt: number;
}

class OTPService {
  private otps: Map<string, OTPData> = new Map();
  private resendBlocks: Map<string, ResendBlockData> = new Map();
  private readonly OTP_LENGTH = 6;
  private readonly OTP_EXPIRY_MINUTES = 10;
  private readonly MAX_ATTEMPTS = 3;
  private readonly RESEND_COOLDOWN_SECONDS = 60; // 60 seconds cooldown between resends
  private readonly MAX_RESEND_ATTEMPTS = 3; // 3 resend attempts allowed
  private readonly BLOCK_DURATION_MINUTES = 10; // 10 minutes block after max resends

  private generateOTPCode(): string {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < this.OTP_LENGTH; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
  }

  private generateOTPId(): string {
    return `otp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isOTPExpired(otpData: OTPData): boolean {
    return Date.now() > otpData.expiresAt;
  }

  private cleanupExpiredOTPs(): void {
    const now = Date.now();
    this.otps.forEach((otpData, otpId) => {
      if (now > otpData.expiresAt) {
        this.otps.delete(otpId);
      }
    });
    
    // Also cleanup expired resend blocks
    this.resendBlocks.forEach((blockData, email) => {
      if (now > blockData.blockedUntil) {
        this.resendBlocks.delete(email);
      }
    });
  }

  private checkResendStatus(email: string): { canResend: boolean; cooldownRemaining: number; blockedUntil: number } {
    const now = Date.now();
    
    // Check if email is blocked
    const blockData = this.resendBlocks.get(email);
    if (blockData && now < blockData.blockedUntil) {
      return {
        canResend: false,
        cooldownRemaining: 0,
        blockedUntil: blockData.blockedUntil
      };
    }
    
    // Find active OTP for this email
    const activeOTP = this.getActiveOTPByEmail(email);
    if (!activeOTP) {
      return {
        canResend: true,
        cooldownRemaining: 0,
        blockedUntil: 0
      };
    }
    
    const timeSinceLastResend = now - activeOTP.otpData.lastResendAt;
    const cooldownRemaining = Math.max(0, (this.RESEND_COOLDOWN_SECONDS * 1000) - timeSinceLastResend);
    
    return {
      canResend: cooldownRemaining === 0,
      cooldownRemaining: Math.ceil(cooldownRemaining / 1000),
      blockedUntil: 0
    };
  }

  private getActiveOTPByEmail(email: string): { otpId: string; otpData: OTPData } | null {
    let result: { otpId: string; otpData: OTPData } | null = null;
    this.otps.forEach((otpData, otpId) => {
      if (otpData.email === email && !this.isOTPExpired(otpData) && !otpData.verified && result === null) {
        result = { otpId, otpData };
      }
    });
    return result;
  }

  generateOTP(email: string, username: string): OTPResult {
    try {
      // Clean up expired OTPs first
      this.cleanupExpiredOTPs();

      const now = Date.now();
      
      // Check resend status
      const resendStatus = this.checkResendStatus(email);
      if (!resendStatus.canResend) {
        if (resendStatus.blockedUntil > 0) {
          const blockedMinutes = Math.ceil((resendStatus.blockedUntil - now) / (1000 * 60));
          return {
            success: false,
            message: `Too many resend attempts. Please wait ${blockedMinutes} minutes before trying again.`,
            blockedUntil: resendStatus.blockedUntil
          };
        } else {
          return {
            success: false,
            message: `Please wait ${resendStatus.cooldownRemaining} seconds before requesting another OTP.`,
            canResend: false,
            resendCooldown: resendStatus.cooldownRemaining
          };
        }
      }

      const otp = this.generateOTPCode();
      const otpId = this.generateOTPId();

      const otpData: OTPData = {
        code: otp,
        email,
        username,
        createdAt: now,
        expiresAt: now + (this.OTP_EXPIRY_MINUTES * 60 * 1000),
        attempts: 0,
        verified: false,
        resendCount: 0,
        lastResendAt: now
      };

      this.otps.set(otpId, otpData);

      return {
        success: true,
        message: `OTP generated successfully. Valid for ${this.OTP_EXPIRY_MINUTES} minutes.`,
        otpId,
        canResend: true,
        resendCooldown: this.RESEND_COOLDOWN_SECONDS
      };
    } catch (error) {
      console.error('Error generating OTP:', error);
      return {
        success: false,
        message: 'Failed to generate OTP. Please try again.'
      };
    }
  }

  verifyOTP(otpId: string, enteredOTP: string): OTPResult {
    try {
      const otpData = this.otps.get(otpId);
      
      if (!otpData) {
        return {
          success: false,
          message: 'Invalid OTP ID. Please request a new OTP.'
        };
      }

      if (this.isOTPExpired(otpData)) {
        this.otps.delete(otpId);
        return {
          success: false,
          message: 'OTP has expired. Please request a new one.'
        };
      }

      if (otpData.verified) {
        return {
          success: false,
          message: 'OTP has already been used. Please request a new one.'
        };
      }

      if (otpData.attempts >= this.MAX_ATTEMPTS) {
        this.otps.delete(otpId);
        return {
          success: false,
          message: 'Maximum verification attempts exceeded. Please request a new OTP.'
        };
      }

      // Increment attempts
      otpData.attempts += 1;

      if (otpData.code === enteredOTP) {
        otpData.verified = true;
        this.otps.set(otpId, otpData);
        return {
          success: true,
          message: 'OTP verified successfully.'
        };
      } else {
        this.otps.set(otpId, otpData);
        const remainingAttempts = this.MAX_ATTEMPTS - otpData.attempts;
        return {
          success: false,
          message: `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
          remainingAttempts
        };
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return {
        success: false,
        message: 'Failed to verify OTP. Please try again.'
      };
    }
  }

  getOTPData(otpId: string): OTPData | null {
    const otpData = this.otps.get(otpId);
    if (otpData && !this.isOTPExpired(otpData)) {
      return otpData;
    }
    return null;
  }

  markOTPAsUsed(otpId: string): boolean {
    const otpData = this.otps.get(otpId);
    if (otpData && otpData.verified) {
      this.otps.delete(otpId);
      return true;
    }
    return false;
  }

  getOTPStats(): { totalActive: number; totalExpired: number } {
    const now = Date.now();
    let totalActive = 0;
    let totalExpired = 0;

    this.otps.forEach((otpData) => {
      if (now > otpData.expiresAt) {
        totalExpired++;
      } else {
        totalActive++;
      }
    });

    return { totalActive, totalExpired };
  }

  // Resend OTP with proper blocking logic
  resendOTP(email: string, username: string): OTPResult {
    try {
      this.cleanupExpiredOTPs();
      
      const now = Date.now();
      
      // Check if email is blocked
      const blockData = this.resendBlocks.get(email);
      if (blockData && now < blockData.blockedUntil) {
        const blockedMinutes = Math.ceil((blockData.blockedUntil - now) / (1000 * 60));
        return {
          success: false,
          message: `Too many resend attempts. Please wait ${blockedMinutes} minutes before trying again.`,
          blockedUntil: blockData.blockedUntil
        };
      }
      
      // Find active OTP for this email
      const activeOTP = this.getActiveOTPByEmail(email);
      if (!activeOTP) {
        // No active OTP, generate new one
        return this.generateOTP(email, username);
      }
      
      const { otpId, otpData } = activeOTP;
      
      // Check cooldown
      const timeSinceLastResend = now - otpData.lastResendAt;
      if (timeSinceLastResend < (this.RESEND_COOLDOWN_SECONDS * 1000)) {
        const cooldownRemaining = Math.ceil(((this.RESEND_COOLDOWN_SECONDS * 1000) - timeSinceLastResend) / 1000);
        return {
          success: false,
          message: `Please wait ${cooldownRemaining} seconds before requesting another OTP.`,
          canResend: false,
          resendCooldown: cooldownRemaining
        };
      }
      
      // Check if max resends reached
      if (otpData.resendCount >= this.MAX_RESEND_ATTEMPTS) {
        // Block this email for 10 minutes
        const blockedUntil = now + (this.BLOCK_DURATION_MINUTES * 60 * 1000);
        this.resendBlocks.set(email, {
          email,
          resendAttempts: otpData.resendCount,
          blockedUntil,
          lastAttemptAt: now
        });
        
        // Remove the current OTP
        this.otps.delete(otpId);
        
        return {
          success: false,
          message: `Too many resend attempts. Please wait ${this.BLOCK_DURATION_MINUTES} minutes before trying again.`,
          blockedUntil
        };
      }
      
      // Generate new OTP code and update existing data
      const newOTPCode = this.generateOTPCode();
      const updatedOTPData: OTPData = {
        ...otpData,
        code: newOTPCode,
        resendCount: otpData.resendCount + 1,
        lastResendAt: now,
        attempts: 0, // Reset verification attempts for new code
        verified: false
      };
      
      this.otps.set(otpId, updatedOTPData);
      
      const remainingResends = this.MAX_RESEND_ATTEMPTS - updatedOTPData.resendCount;
      
      return {
        success: true,
        message: `OTP resent successfully. ${remainingResends} resend${remainingResends !== 1 ? 's' : ''} remaining.`,
        otpId,
        canResend: remainingResends > 0,
        resendCooldown: this.RESEND_COOLDOWN_SECONDS
      };
      
    } catch (error) {
      console.error('Error resending OTP:', error);
      return {
        success: false,
        message: 'Failed to resend OTP. Please try again.'
      };
    }
  }

  // Get resend status for UI
  getResendStatus(email: string): { canResend: boolean; cooldownRemaining: number; blockedUntil: number; remainingAttempts: number } {
    const now = Date.now();
    
    // Check if blocked
    const blockData = this.resendBlocks.get(email);
    if (blockData && now < blockData.blockedUntil) {
      return {
        canResend: false,
        cooldownRemaining: 0,
        blockedUntil: blockData.blockedUntil,
        remainingAttempts: 0
      };
    }
    
    // Check active OTP
    const activeOTP = this.getActiveOTPByEmail(email);
    if (!activeOTP) {
      return {
        canResend: true,
        cooldownRemaining: 0,
        blockedUntil: 0,
        remainingAttempts: this.MAX_RESEND_ATTEMPTS
      };
    }
    
    const timeSinceLastResend = now - activeOTP.otpData.lastResendAt;
    const cooldownRemaining = Math.max(0, (this.RESEND_COOLDOWN_SECONDS * 1000) - timeSinceLastResend);
    const remainingAttempts = this.MAX_RESEND_ATTEMPTS - activeOTP.otpData.resendCount;
    
    return {
      canResend: cooldownRemaining === 0 && remainingAttempts > 0,
      cooldownRemaining: Math.ceil(cooldownRemaining / 1000),
      blockedUntil: 0,
      remainingAttempts
    };
  }

  // Get OTP by email (for admin purposes)
  getOTPByEmail(email: string): { otpId: string; otpData: OTPData } | null {
    for (const otpId of Array.from(this.otps.keys())) {
      const data = this.otps.get(otpId)!;
      if (data.email === email && !this.isOTPExpired(data)) {
        return { otpId, otpData: data };
      }
    }
    return null;
  }
}

// Export singleton instance
export const otpService = new OTPService();
export default otpService;
