import { clientEmailService } from './client-email-service';

interface OTPEmailData {
  to_email: string;
  to_name: string;
  otp_code: string;
  expiry_minutes: number;
  from_name: string;
  subject: string;
}

interface PasswordResetEmailData {
  to_email: string;
  to_name: string;
  username: string;
  new_password: string;
  reset_time: string;
  from_name: string;
  subject: string;
}

class PasswordResetEmailService {
  async sendOTPEmail(data: OTPEmailData): Promise<boolean> {
    try {
      console.log('Sending OTP email to:', data.to_email);

      const result = await clientEmailService.sendOTPEmail({
        to: data.to_email,
        toName: data.to_name,
        otpCode: data.otp_code,
        expiryMinutes: data.expiry_minutes
      });

      console.log('OTP email sent successfully:', result);
      return result;
    } catch (error) {
      console.error('Error sending OTP email:', error);
      return false;
    }
  }

  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<boolean> {
    try {
      console.log('Sending password reset email to:', data.to_email);

      const result = await clientEmailService.sendPasswordResetEmail({
        to: data.to_email,
        toName: data.to_name,
        username: data.username,
        newPassword: data.new_password,
        resetTime: data.reset_time
      });

      console.log('Password reset email sent successfully:', result);
      return result;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return false;
    }
  }

}

// Export singleton instance
export const passwordResetEmailService = new PasswordResetEmailService();
export default passwordResetEmailService;
