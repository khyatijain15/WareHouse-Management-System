# WMS Email Notification Setup

This document explains how to set up email notifications for successful logins in the Warehouse Management System (WMS) using EmailJS.

## Features

- ✅ Automatic email notifications on successful login
- ✅ Beautiful HTML email templates
- ✅ User details including username, role, and login time
- ✅ IP address detection
- ✅ Security information and warnings
- ✅ Client-side implementation using EmailJS
- ✅ Support for multiple email providers (Gmail, Outlook, Yahoo, etc.)
- ✅ Free tier available (200 emails/month)

## Quick Setup

### 1. Create EmailJS Account

1. Go to [EmailJS.com](https://www.emailjs.com/)
2. Sign up for a free account
3. Verify your email address

### 2. Add Email Service

1. Go to **Email Services** in your EmailJS dashboard
2. Click **"Add New Service"**
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow the setup instructions for your provider
5. Copy the **Service ID**

### 3. Create Email Template

1. Go to **Email Templates** in your EmailJS dashboard
2. Click **"Create New Template"**
3. Use this template content:

```
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
```

4. Save the template and copy the **Template ID**

### 4. Get Public Key

1. Go to **Account → API Keys** in your EmailJS dashboard
2. Copy your **Public Key**

### 5. Environment Variables

Create a `.env.local` file in your project root:

```bash
# EmailJS Configuration
NEXT_PUBLIC_EMAILJS_SERVICE_ID=your_service_id
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=your_template_id
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your_public_key
```

## Testing

### 1. Test Email Connection

Use the EmailTest component to verify your configuration:

```tsx
import { EmailTest } from '@/components/email-test';

// Add to your dashboard or admin page
<EmailTest />
```

### 2. Test Login Notification

1. Start your development server: `npm run dev`
2. Go to the login page
3. Login with any username
4. Check the registered email for the notification

## Email Template

The system sends beautifully formatted emails with:

- **Professional Design**: Clean, readable format
- **Login Details**: Username, email, role, login time, IP address
- **Security Information**: Instructions for unauthorized access
- **Template Variables**: Dynamic content using EmailJS variables

## Files Created

- `lib/email-service.ts` - Main email service using EmailJS
- `lib/email-config.ts` - EmailJS configuration and setup instructions
- `hooks/use-email-notification.ts` - React hook for email functionality
- `components/email-test.tsx` - Testing component for email setup
- `contexts/AuthContext.tsx` - Updated to send notifications on login

## Security Notes

- Never commit `.env.local` to version control
- EmailJS handles authentication securely
- Email notifications include IP address for security tracking
- Free tier has rate limiting (200 emails/month)

## Troubleshooting

### Common Issues

1. **"EmailJS configuration not properly set up"**
   - Check that all environment variables are set correctly
   - Verify Service ID, Template ID, and Public Key are correct
   - Ensure `.env.local` file is in the project root

2. **"Template not found"**
   - Verify the Template ID matches your EmailJS template
   - Check that the template is published in EmailJS dashboard

3. **"Service not found"**
   - Verify the Service ID matches your EmailJS service
   - Check that the service is properly configured

4. **"Email not received"**
   - Check spam/junk folder
   - Verify email address is correct
   - Check EmailJS dashboard for delivery status

### Debug Mode

Check the browser console for detailed error messages from EmailJS.

## Production Deployment

For production deployment:

1. Set up environment variables in your hosting platform
2. Consider upgrading to EmailJS paid plan for higher limits
3. Monitor email delivery in EmailJS dashboard
4. Set up proper error handling and logging

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify your EmailJS configuration
3. Test with the EmailTest component
4. Check EmailJS documentation: https://www.emailjs.com/docs/

---

**Note**: This implementation uses EmailJS for client-side email sending, which is secure and reliable for most use cases.
