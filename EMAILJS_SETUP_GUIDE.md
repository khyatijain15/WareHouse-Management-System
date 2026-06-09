# EmailJS Setup Guide - Fix Email Not Sending Issue

## Current Issue
Your email is not being sent because the template ID `"__ejs-test-mail-service__"` is a placeholder, not a real EmailJS template ID.

## Step-by-Step Fix

### 1. Go to EmailJS Dashboard
1. Open [https://www.emailjs.com/](https://www.emailjs.com/)
2. Login to your account
3. You should see your dashboard

### 2. Check Your Service
1. Go to **"Email Services"** in the left sidebar
2. Look for service ID `service_sh3at2u`
3. If it exists, note the service name
4. If it doesn't exist, you need to create a new service

### 3. Create Email Template (This is the missing piece!)
1. Go to **"Email Templates"** in the left sidebar
2. Click **"Create New Template"**
3. Use this template content:

**Template Name:** `WMS Login Notification`

**Subject:** `{{subject}}`

**Content:**
```
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

4. Click **"Save"**
5. **Copy the Template ID** (it will look like `template_xxxxx`)

### 4. Update Your Configuration
Replace the template ID in your code:

```typescript
// In lib/email-config.ts
export const emailConfig = {
  serviceId: "service_sh3at2u",
  templateId: "template_xxxxx", // Replace with your actual template ID
  publicKey: "rEntskmqP_FrBX5uy"
};
```

```typescript
// In lib/email-service.ts
constructor() {
  this.serviceId = "service_sh3at2u";
  this.templateId = "template_xxxxx"; // Replace with your actual template ID
  this.publicKey = "rEntskmqP_FrBX5uy";
  emailjs.init(this.publicKey);
}
```

### 5. Test the Configuration
1. Use the EmailDebug component to test
2. Check the browser console for detailed error messages
3. Try sending a test email

## Common Issues and Solutions

### Issue 1: "Template not found"
- **Solution:** Make sure you created the template and copied the correct template ID

### Issue 2: "Service not found"
- **Solution:** Check that your service ID is correct in EmailJS dashboard

### Issue 3: "Invalid public key"
- **Solution:** Verify your public key in Account → API Keys

### Issue 4: "Email not received"
- **Solution:** 
  - Check spam folder
  - Verify the email address is correct
  - Check EmailJS dashboard for delivery status

## Testing Steps

1. **Add EmailDebug component to your app:**
```tsx
import { EmailDebug } from '@/components/email-debug';

// Add to your dashboard or admin page
<EmailDebug />
```

2. **Check browser console** for detailed error messages

3. **Test with a real email address** (not test@example.com)

## Quick Fix Checklist

- [ ] Created email template in EmailJS dashboard
- [ ] Copied the real template ID (not placeholder)
- [ ] Updated template ID in both files
- [ ] Verified service ID is correct
- [ ] Verified public key is correct
- [ ] Tested with EmailDebug component
- [ ] Checked browser console for errors

## Need Help?

If you're still having issues:
1. Check the browser console for specific error messages
2. Verify all IDs in your EmailJS dashboard
3. Make sure your email service is properly configured
4. Try creating a simple test template first
