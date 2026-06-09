export const emailConfig = {
  // EmailJS Configuration
  serviceId:"service_sh3at2u",
  templateId: "__ejs-test-mail-service__",
  publicKey: "rEntskmqP_FrBX5uy"
};

// Additional template IDs for password reset
export const passwordResetTemplates = {
  otpTemplateId: process.env.NEXT_PUBLIC_EMAILJS_OTP_TEMPLATE_ID || 'template_otp',
  resetTemplateId: process.env.NEXT_PUBLIC_EMAILJS_RESET_TEMPLATE_ID || 'template_reset'
};

export const templateVariables = {
  to_email: '{{to_email}}',
  to_name: '{{to_name}}',
  username: '{{username}}',
  user_role: '{{user_role}}',
  login_time: '{{login_time}}',
  ip_address: '{{ip_address}}',
  from_name: '{{from_name}}',
  subject: '{{subject}}',
  message: '{{message}}',
  html_message: '{{html_message}}'
};

export const setupInstructions = `
EmailJS Setup Instructions for WMS Login Notifications:

1. Create EmailJS Account:
   - Go to https://www.emailjs.com/
   - Sign up for a free account
   - Verify your email address

2. Add Email Service:
   - Go to Email Services in your dashboard
   - Click "Add New Service"
   - Choose your email provider (Gmail, Outlook, etc.)
   - Follow the setup instructions
   - Copy the Service ID

3. Create Email Template:
   - Go to Email Templates in your dashboard
   - Click "Create New Template"
   - Use this template content:
   
   Subject: {{subject}}
   
   Hello {{to_name}},
   
   You have successfully logged into the Warehouse Management System.
   
   Login Details:
   - Username: {{username}}
   - Role: {{user_role}}
   - Login Time: {{login_time}}
   - IP Address: {{ip_address}}
   
   If you did not perform this login, please contact your administrator immediately.
   
   Best regards,
   WMS System
   
   - Save the template and copy the Template ID

4. Get Public Key:
   - Go to Account → API Keys
   - Copy your Public Key

5. Environment Variables:
   - Create a .env.local file in your project root
   - Add these variables:
     NEXT_PUBLIC_EMAILJS_SERVICE_ID=your_service_id
     NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=your_template_id
     NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your_public_key
   - Restart your development server

6. Test Configuration:
   - Use the EmailTest component to verify setup
   - Check that emails are being sent successfully

`;
