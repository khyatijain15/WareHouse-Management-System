import { clientEmailService } from './client-email-service';

interface LoginNotificationData {
  username: string;
  email: string;
  role: string;
  loginTime: string;
  ipAddress?: string;
}

class EmailService {
  constructor() {
    // Using client email service with Nodemailer
  }

  async sendLoginNotification(data: LoginNotificationData): Promise<boolean> {
    try {
      console.log('Sending login notification to:', data.email);

      const result = await clientEmailService.sendLoginNotification({
        to: data.email,
        toName: data.username,
        username: data.username,
        role: data.role,
        loginTime: data.loginTime,
        ipAddress: data.ipAddress || 'Unknown'
      });

      console.log('Login notification sent successfully:', result);
      return result;
    } catch (error) {
      console.error('Error sending login notification:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // Test with a simple email
      const result = await clientEmailService.sendLoginNotification({
        to: 'test@example.com',
        toName: 'Test User',
        username: 'testuser',
        role: 'admin',
        loginTime: new Date().toLocaleString(),
        ipAddress: '127.0.0.1'
      });
      
      console.log('Email service test result:', result);
      return result;
    } catch (error) {
      console.error('Email service test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;