interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

interface OTPEmailData {
  to: string;
  toName: string;
  otpCode: string;
  expiryMinutes: number;
  subject?: string; // Optional: defaults to password reset if not provided
}

interface PasswordResetEmailData {
  to: string;
  toName: string;
  username: string;
  newPassword: string;
  resetTime: string;
}

interface LoginNotificationData {
  to: string;
  toName: string;
  username: string;
  role: string;
  loginTime: string;
  ipAddress: string;
}

interface RegistrationNotificationData {
  to: string;
  toName: string;
  username: string;
  password: string;
  role: string;
  registrationTime: string;
}

class ClientEmailService {
  private config: EmailConfig;

  constructor() {
    this.config = {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: 'agrogreensoftware@gmail.com',
        pass: 'lsln qkyd qvml whgk'
      },
      from: 'Agrogreen Software <agrogreensoftware@gmail.com>'
    };
  }

  private async sendEmail(to: string, subject: string, htmlContent: string, textContent: string): Promise<boolean> {
    try {
      // For client-side, we'll use a simple fetch to a serverless function
      // This is a workaround since Nodemailer can't run directly in the browser
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          subject,
          html: htmlContent,
          text: textContent,
          config: this.config
        })
      });

      if (response.ok) {
        console.log('Email sent successfully');
        return true;
      } else {
        console.error('Failed to send email:', await response.text());
        return false;
      }
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  async sendOTPEmail(data: OTPEmailData): Promise<boolean> {
    const subject = data.subject || 'Password Reset OTP - WMS System';
    const htmlContent = this.generateOTPHTML(data);
    const textContent = this.generateOTPText(data);

    return await this.sendEmail(data.to, subject, htmlContent, textContent);
  }

  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<boolean> {
    const subject = 'Password Reset Successful - WMS System';
    const htmlContent = this.generatePasswordResetHTML(data);
    const textContent = this.generatePasswordResetText(data);

    return await this.sendEmail(data.to, subject, htmlContent, textContent);
  }

  async sendLoginNotification(data: LoginNotificationData): Promise<boolean> {
    const subject = 'WMS Login Notification - Successful Login';
    const htmlContent = this.generateLoginNotificationHTML(data);
    const textContent = this.generateLoginNotificationText(data);

    return await this.sendEmail(data.to, subject, htmlContent, textContent);
  }

  async sendRegistrationNotification(data: RegistrationNotificationData): Promise<boolean> {
    const subject = 'WMS Registration Successful - Account Created';
    const htmlContent = this.generateRegistrationNotificationHTML(data);
    const textContent = this.generateRegistrationNotificationText(data);

    return await this.sendEmail(data.to, subject, htmlContent, textContent);
  }

  private generateOTPHTML(data: OTPEmailData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset OTP</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ff6b35, #f7931e); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .otp-box { background: white; padding: 30px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
          .otp-code { font-size: 32px; font-weight: bold; color: #ff6b35; letter-spacing: 8px; margin: 20px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .security-icon { color: #ff6b35; font-size: 24px; margin-right: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Verify OTP</h1>
           
          </div>
          <div class="content">
            <div class="otp-box">
              <h3><span class="security-icon">🔑</span>Your OTP Code</h3>
              <div class="otp-code">${data.otpCode}</div>
              <p>This code will expire in <strong>${data.expiryMinutes} minutes</strong></p>
            </div>
            
            <div class="warning">
              <h4>⚠️ Security Information</h4>
              <ul>
                <li>This OTP is valid for ${data.expiryMinutes} minutes only</li>
                <li>Do not share this code with anyone</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Contact support if you have any concerns</li>
              </ul>
            </div>
            
            <div class="footer">
              <p>This is an automated message from the Warehouse Management System.</p>
              <p>Please do not reply to this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateOTPText(data: OTPEmailData): string {
    return `
Password Reset OTP - WMS System

Hello ${data.toName},

You have requested to reset your password for the Warehouse Management System.

Your OTP Code: ${data.otpCode}

This code will expire in ${data.expiryMinutes} minutes.

Security Information:
- This OTP is valid for ${data.expiryMinutes} minutes only
- Do not share this code with anyone
- If you didn't request this reset, please ignore this email
- Contact support if you have any concerns

This is an automated message from the Warehouse Management System.
Please do not reply to this email.
    `;
  }

  private generatePasswordResetHTML(data: PasswordResetEmailData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset Successful</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .info-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
          .label { font-weight: bold; color: #28a745; }
          .value { color: #333; }
          .password-box { background: #f8f9fa; border: 2px solid #28a745; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; }
          .password-text { font-size: 18px; font-weight: bold; color: #28a745; font-family: monospace; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .success-icon { color: #28a745; font-size: 24px; margin-right: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Password Reset Successful</h1>
            <p>Your password has been successfully reset</p>
          </div>
          <div class="content">
            <div class="info-box">
              <h3><span class="success-icon">🔐</span>Reset Details</h3>
              <div class="info-row">
                <span class="label">Username:</span>
                <span class="value">${data.username}</span>
              </div>
              <div class="info-row">
                <span class="label">Email:</span>
                <span class="value">${data.to}</span>
              </div>
              <div class="info-row">
                <span class="label">Reset Time:</span>
                <span class="value">${data.resetTime}</span>
              </div>
            </div>
            
            <div class="password-box">
              <h4>Your New Password</h4>
              <div class="password-text">${data.newPassword}</div>
              <p style="margin-top: 10px; color: #666;">Please change this password after your first login</p>
            </div>
            
            <div class="warning">
              <h4>🔒 Security Recommendations</h4>
              <ul>
                <li>Login immediately and change your password</li>
                <li>Use a strong, unique password</li>
                <li>Do not share your password with anyone</li>
                <li>Contact support if you notice any suspicious activity</li>
              </ul>
            </div>
            
            <div class="footer">
              <p>This is an automated notification from the Warehouse Management System.</p>
              <p>Please do not reply to this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generatePasswordResetText(data: PasswordResetEmailData): string {
    return `
Password Reset Successful - WMS System

Hello ${data.toName},

Your password has been successfully reset for the Warehouse Management System.

Reset Details:
- Username: ${data.username}
- Email: ${data.to}
- Reset Time: ${data.resetTime}

Your New Password: ${data.newPassword}

Security Recommendations:
- Login immediately and change your password
- Use a strong, unique password
- Do not share your password with anyone
- Contact support if you notice any suspicious activity

This is an automated notification from the Warehouse Management System.
Please do not reply to this email.
    `;
  }

  private generateLoginNotificationHTML(data: LoginNotificationData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>WMS Login Notification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .info-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
          .label { font-weight: bold; color: #28a745; }
          .value { color: #333; }
          .success-box { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; }
          .success-text { font-size: 18px; font-weight: bold; color: #155724; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .success-icon { color: #28a745; font-size: 24px; margin-right: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Login Successful</h1>
            <p>You have successfully logged into the WMS System</p>
          </div>
          <div class="content">
            <div class="success-box">
              <div class="success-text">Welcome back, ${data.toName}!</div>
              <p style="margin-top: 10px; color: #155724;">Your login was successful</p>
            </div>
            
            <div class="info-box">
              <h3><span class="success-icon">🔐</span>Login Details</h3>
              <div class="info-row">
                <span class="label">Username:</span>
                <span class="value">${data.username}</span>
              </div>
              <div class="info-row">
                <span class="label">Email:</span>
                <span class="value">${data.to}</span>
              </div>
              <div class="info-row">
                <span class="label">Role:</span>
                <span class="value">${data.role.toUpperCase()}</span>
              </div>
              <div class="info-row">
                <span class="label">Login Time:</span>
                <span class="value">${data.loginTime}</span>
              </div>
              <div class="info-row">
                <span class="label">IP Address:</span>
                <span class="value">${data.ipAddress}</span>
              </div>
            </div>
            
            <div class="footer">
              <p>This is an automated notification from the Warehouse Management System.</p>
              <p>If you did not perform this login, please contact support immediately.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateLoginNotificationText(data: LoginNotificationData): string {
    return `
WMS Login Notification - Successful Login

Hello ${data.toName},

You have successfully logged into the Warehouse Management System.

Login Details:
- Username: ${data.username}
- Email: ${data.to}
- Role: ${data.role.toUpperCase()}
- Login Time: ${data.loginTime}
- IP Address: ${data.ipAddress}

This is an automated notification from the Warehouse Management System.
If you did not perform this login, please contact support immediately.
    `;
  }

  private generateRegistrationNotificationHTML(data: RegistrationNotificationData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>WMS Registration Successful</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .success-box { background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
          .success-text { font-size: 20px; font-weight: bold; color: #155724; margin-bottom: 10px; }
          .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .info-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
          .label { font-weight: bold; color: #28a745; }
          .value { color: #333; }
          .credentials-box { background: #f8f9fa; border: 2px solid #28a745; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; }
          .credentials-text { font-size: 16px; font-weight: bold; color: #28a745; font-family: monospace; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .success-icon { color: #28a745; font-size: 24px; margin-right: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Registration Successful!</h1>
            <p>Welcome to the Warehouse Management System</p>
          </div>
          <div class="content">
            <div class="success-box">
              <div class="success-text">THANK YOU FOR SUCCESSFUL REGISTRATION ON OUR PORTAL</div>
              <p style="color: #155724; margin: 0;">Please wait for sometime, once admin verifies your data, you will be allowed to access our portal.</p>
            </div>
            
            <div class="info-box">
              <h3><span class="success-icon">👤</span>Account Details</h3>
              <div class="info-row">
                <span class="label">Username:</span>
                <span class="value">${data.username}</span>
              </div>
              <div class="info-row">
                <span class="label">Email:</span>
                <span class="value">${data.to}</span>
              </div>
              <div class="info-row">
                <span class="label">Role:</span>
                <span class="value">${data.role.toUpperCase()}</span>
              </div>
              <div class="info-row">
                <span class="label">Registration Time:</span>
                <span class="value">${data.registrationTime}</span>
              </div>
            </div>
            
            <div class="credentials-box">
              <h4>Your Login Credentials</h4>
              <div class="credentials-text">Username: ${data.username}</div>
              <div class="credentials-text">Password: ${data.password}</div>
              <p style="margin-top: 10px; color: #666;">Please save these credentials for future login</p>
            </div>
            
            <div class="warning">
              <h4>⚠️ Important Information</h4>
              <ul>
                <li>Your account is pending admin verification</li>
                <li>You will receive an email notification once verified</li>
                <li>Do not share your login credentials with anyone</li>
                <li>Contact support if you have any questions</li>
              </ul>
            </div>
            
            <div class="footer">
              <p>This is an automated notification from the Warehouse Management System.</p>
              <p>Please do not reply to this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateRegistrationNotificationText(data: RegistrationNotificationData): string {
    return `
WMS Registration Successful - Account Created

Hello ${data.toName},

THANK YOU FOR SUCCESSFUL REGISTRATION ON OUR PORTAL. PLEASE WAIT FOR SOMETIME, ONCE ADMIN VERIFIES YOUR DATA, YOU WILL BE ALLOWED TO ACCESS OUR PORTAL. AFTER VERIFICATION DONE, FROM OUR ADMIN, YOU WILL BE NOTIFIED ON YOUR RESPECTIVE REGISTERED EMAIL ID.

Account Details:
- Username: ${data.username}
- Email: ${data.to}
- Role: ${data.role.toUpperCase()}
- Registration Time: ${data.registrationTime}

Your Login Credentials:
- Username: ${data.username}
- Password: ${data.password}

Important Information:
- Your account is pending admin verification
- You will receive an email notification once verified
- Do not share your login credentials with anyone
- Contact support if you have any questions

This is an automated notification from the Warehouse Management System.
Please do not reply to this email.
    `;
  }
}

// Export singleton instance
export const clientEmailService = new ClientEmailService();
export default clientEmailService;
