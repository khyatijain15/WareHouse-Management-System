import { NextRequest, NextResponse } from 'next/server';

interface ApprovalNotificationData {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
  approved: boolean;
  adminName: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ApprovalNotificationData = await request.json();
    const { user, approved, adminName } = body;

    const subject = approved 
      ? 'WMS Account Approved - Welcome!' 
      : 'WMS Account Registration Not Approved';

    const htmlContent = approved ? generateApprovalHTML(user) : generateRejectionHTML(user);
    const textContent = approved ? generateApprovalText(user) : generateRejectionText(user);

    // Send email using the email API
    const emailResponse = await fetch(`${request.nextUrl.origin}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: user.email,
        subject,
        html: htmlContent,
        text: textContent,
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

    if (emailResponse.ok) {
      return NextResponse.json({ 
        success: true, 
        message: `${approved ? 'Approval' : 'Rejection'} notification sent successfully` 
      });
    } else {
      const errorText = await emailResponse.text();
      throw new Error(`Failed to send email: ${errorText}`);
    }

  } catch (error) {
    console.error('Error sending approval notification:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send notification' 
      },
      { status: 500 }
    );
  }
}

function generateApprovalHTML(userData: { username: string; email: string; role: string }): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Approved - Welcome to WMS</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .success-box { background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .success-text { font-size: 20px; font-weight: bold; color: #155724; margin-bottom: 10px; }
        .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .info-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
        .label { font-weight: bold; color: #28a745; }
        .value { color: #333; }
        .login-box { background: #e3f2fd; border: 2px solid #2196f3; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .login-button { display: inline-block; background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .success-icon { color: #28a745; font-size: 24px; margin-right: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎉 Account Approved!</h1>
        <p>Welcome to the Warehouse Management System</p>
      </div>
      <div class="content">
        <div class="success-box">
          <div class="success-text">Congratulations! Your account has been approved</div>
          <p style="color: #155724; margin: 0;">You can now access the Warehouse Management System with full privileges.</p>
        </div>
        
        <div class="info-box">
          <h3><span class="success-icon">👤</span>Your Account Details</h3>
          <div class="info-row">
            <span class="label">Username:</span>
            <span class="value">${userData.username}</span>
          </div>
          <div class="info-row">
            <span class="label">Email:</span>
            <span class="value">${userData.email}</span>
          </div>
          <div class="info-row">
            <span class="label">Role:</span>
            <span class="value">${userData.role.toUpperCase()}</span>
          </div>
          <div class="info-row">
            <span class="label">Status:</span>
            <span class="value">✅ Approved & Active</span>
          </div>
        </div>
        
        <div class="login-box">
          <h3>Ready to Get Started?</h3>
          <p>Click the button below to log in to your account</p>
          <a href="${typeof window !== 'undefined' ? window.location.origin : process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login" class="login-button">
            🚀 Login to WMS System
          </a>
          <p style="margin-top: 15px; color: #666; font-size: 14px;">
            Use your registered username and password to access the system
          </p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #495057;">What's Next?</h4>
          <ul style="margin-bottom: 0; color: #495057;">
            <li>Log in using your username and password</li>
            <li>Explore the dashboard and available features</li>
            <li>Start managing warehouse operations based on your role</li>
            <li>Contact support if you need any assistance</li>
          </ul>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from Agrogreen Warehousing Private Limited</p>
          <p>If you have any questions, please contact our support team.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateApprovalText(userData: { username: string; email: string; role: string }): string {
  return `
Account Approved - Welcome to WMS System

Congratulations ${userData.username}!

Your account has been approved and you can now access the Warehouse Management System.

Account Details:
- Username: ${userData.username}
- Email: ${userData.email}
- Role: ${userData.role.toUpperCase()}
- Status: ✅ Approved & Active

What's Next:
- Log in using your registered username and password
- Explore the dashboard and available features
- Start managing warehouse operations based on your role
- Contact support if you need any assistance

Login URL: ${typeof window !== 'undefined' ? window.location.origin : process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login

This is an automated notification from Agrogreen Warehousing Private Limited.
If you have any questions, please contact our support team.
  `;
}

function generateRejectionHTML(userData: { username: string; email: string; role: string }): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Registration Not Approved - WMS</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc3545, #c82333); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .rejection-box { background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .rejection-text { font-size: 18px; font-weight: bold; color: #721c24; margin-bottom: 10px; }
        .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .info-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
        .label { font-weight: bold; color: #dc3545; }
        .value { color: #333; }
        .reapply-box { background: #e3f2fd; border: 2px solid #2196f3; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .reapply-button { display: inline-block; background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .warning-icon { color: #dc3545; font-size: 24px; margin-right: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>❌ Registration Not Approved</h1>
        <p>Warehouse Management System</p>
      </div>
      <div class="content">
        <div class="rejection-box">
          <div class="rejection-text">We regret to inform you that your registration was not approved</div>
          <p style="color: #721c24; margin: 0;">Your application to access the Warehouse Management System has been reviewed and unfortunately cannot be approved at this time.</p>
        </div>
        
        <div class="info-box">
          <h3><span class="warning-icon">📋</span>Application Details</h3>
          <div class="info-row">
            <span class="label">Username:</span>
            <span class="value">${userData.username}</span>
          </div>
          <div class="info-row">
            <span class="label">Email:</span>
            <span class="value">${userData.email}</span>
          </div>
          <div class="info-row">
            <span class="label">Applied Role:</span>
            <span class="value">${userData.role.toUpperCase()}</span>
          </div>
          <div class="info-row">
            <span class="label">Status:</span>
            <span class="value">❌ Not Approved</span>
          </div>
        </div>
        
        <div class="reapply-box">
          <h3>Want to Try Again?</h3>
          <p>You can register again with updated information if you believe this decision was made in error or if your circumstances have changed.</p>
          <a href="${typeof window !== 'undefined' ? window.location.origin : process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login" class="reapply-button">
            📝 Register Again
          </a>
          <p style="margin-top: 15px; color: #666; font-size: 14px;">
            Please ensure all information is accurate and complete
          </p>
        </div>
        
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #856404;">📞 Need Help?</h4>
          <p style="margin-bottom: 0; color: #856404;">
            If you believe this decision was made in error or if you need clarification, 
            please contact our support team. We're here to help you through the process.
          </p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from Agrogreen Warehousing Private Limited</p>
          <p>Thank you for your interest in our Warehouse Management System.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateRejectionText(userData: { username: string; email: string; role: string }): string {
  return `
Registration Not Approved - WMS System

Dear ${userData.username},

We regret to inform you that your registration for the Warehouse Management System was not approved.

Application Details:
- Username: ${userData.username}
- Email: ${userData.email}
- Applied Role: ${userData.role.toUpperCase()}
- Status: ❌ Not Approved

Want to Try Again?
You can register again with updated information if you believe this decision was made in error or if your circumstances have changed.

Registration URL: ${typeof window !== 'undefined' ? window.location.origin : process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login

Need Help?
If you believe this decision was made in error or if you need clarification, please contact our support team. We're here to help you through the process.

This is an automated notification from Agrogreen Warehousing Private Limited.
Thank you for your interest in our Warehouse Management System.
  `;
}