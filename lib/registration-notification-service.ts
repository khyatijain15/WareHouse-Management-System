import { clientEmailService } from './client-email-service';

interface RegistrationNotificationData {
  to: string;
  toName: string;
  username: string;
  password: string;
  role: string;
  registrationTime: string;
}

class RegistrationNotificationService {
  async sendRegistrationNotification(data: RegistrationNotificationData): Promise<boolean> {
    try {
      console.log('Sending registration notification to:', data.to);

      const result = await clientEmailService.sendRegistrationNotification({
        to: data.to,
        toName: data.toName,
        username: data.username,
        password: data.password,
        role: data.role,
        registrationTime: data.registrationTime
      });

      console.log('Registration notification sent successfully:', result);
      return result;
    } catch (error) {
      console.error('Error sending registration notification:', error);
      return false;
    }
  }
}

// Export singleton instance
export const registrationNotificationService = new RegistrationNotificationService();
export default registrationNotificationService;
