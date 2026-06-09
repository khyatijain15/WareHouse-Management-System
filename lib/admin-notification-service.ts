import { generateSecureToken } from './server-token-utils';

interface AdminNotificationData {
  userId: string;
  username: string;
  email: string;
  role: string;
  registrationTime: string;
}

export const adminNotificationService = {
  async sendAdminNotification(data: AdminNotificationData): Promise<{ success: boolean; message: string }> {
    try {
      // Get the base URL for approve/reject links
      const baseUrl = typeof window !== 'undefined' 
        ? window.location.origin 
        : process.env.NEXTAUTH_URL || 'http://localhost:3000';

      const approveUrl = `${baseUrl}/api/admin/approve-user?userId=${data.userId}&token=${generateSecureToken(data.userId)}`;
      const rejectUrl = `${baseUrl}/api/admin/reject-user?userId=${data.userId}&token=${generateSecureToken(data.userId)}`;

      // Admin email - you can configure this in environment variables
      const adminEmail = process.env.ADMIN_EMAIL || 'sachinprogramming62@gmail.com';
      const adminName = process.env.ADMIN_NAME || 'Admin';

      const emailData = {
        to: adminEmail,
        toName: adminName,
        subject: `New User Registration Approval Required - ${data.username}`,
        htmlContent: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>User Registration Approval Required</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; margin-bottom: 20px; }
              .content { background-color: #ffffff; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px; }
              .user-details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
              .action-buttons { text-align: center; margin: 30px 0; }
              .approve-btn, .reject-btn { 
                display: inline-block; 
                padding: 12px 30px; 
                margin: 10px; 
                text-decoration: none; 
                border-radius: 5px; 
                font-weight: bold; 
                color: white !important;
              }
              .approve-btn { background-color: #28a745; }
              .reject-btn { background-color: #dc3545; }
              .approve-btn:hover { background-color: #218838; }
              .reject-btn:hover { background-color: #c82333; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
              .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 15px 0; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="color: #007bff; margin: 0;">New User Registration</h1>
              <p style="margin: 5px 0 0 0; color: #666;">Approval Required - Warehouse Management System</p>
            </div>
            
            <div class="content">
              <h2 style="color: #28a745;">New User Registration Details</h2>
              
              <p>Dear Admin,</p>
              
              <p>A new user has registered on the Warehouse Management System and requires your approval to access the portal.</p>
              
              <div class="user-details">
                <h3 style="margin-top: 0; color: #007bff;">User Information</h3>
                <p><strong>Username:</strong> ${data.username}</p>
                <p><strong>Email:</strong> ${data.email}</p>
                <p><strong>Role:</strong> ${data.role.toUpperCase()}</p>
                <p><strong>Registration Time:</strong> ${data.registrationTime}</p>
                <p><strong>User ID:</strong> ${data.userId}</p>
              </div>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> Please verify the user's identity and credentials before approving access to the system.
              </div>
              
              <div class="action-buttons">
                <h3 style="color: #333;">Choose Action:</h3>
                <a href="${approveUrl}" class="approve-btn">✅ APPROVE USER</a>
                <a href="${rejectUrl}" class="reject-btn">❌ REJECT USER</a>
              </div>
              
              <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin-top: 20px;">
                <h4 style="margin-top: 0; color: #495057;">What happens when you:</h4>
                <ul style="margin-bottom: 0;">
                  <li><strong>Approve:</strong> User will be able to log in and will receive a welcome email</li>
                  <li><strong>Reject:</strong> User will be notified that their application was not approved</li>
                </ul>
              </div>
              
              <p style="margin-top: 20px;">
                <strong>Note:</strong> If you have any questions about this registration, please contact the user directly at 
                <a href="mailto:${data.email}" style="color: #007bff;">${data.email}</a>
              </p>
            </div>
            
            <div class="footer">
              <p>This is an automated notification from Agrogreen Warehousing Private Limited</p>
              <p>Please do not reply to this email. For support, contact your system administrator.</p>
            </div>
          </body>
          </html>
        `
      };

      // Use the email API endpoint directly
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.htmlContent,
          text: emailData.htmlContent.replace(/<[^>]*>/g, ''), // Simple HTML to text conversion
          config: {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
              user: 'agrogreensoftware@gmail.com',
              pass: 'lsln qkyd qvml whgk'
            },
            from: 'Agrogreen Software <agrogreensoftware@gmail.com>'
          }
        })
      });

      if (response.ok) {
        console.log('Admin notification sent successfully for user:', data.username);
        return { success: true, message: 'Admin notification sent successfully' };
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to send admin notification: ${errorText}`);
      }
    } catch (error) {
      console.error('Failed to send admin notification:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to send admin notification' 
      };
    }
  }
};

