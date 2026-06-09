'use client';

import { EmailTestNodemailer } from '@/components/email-test-nodemailer';
import { PasswordResetDemo } from '@/components/password-reset-demo';

export default function TestEmailPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-orange-600 mb-4">
            Email System Test
          </h1>
          <p className="text-lg text-gray-600">
            Test the complete email functionality with Nodemailer and Gmail SMTP
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-semibold text-orange-600 mb-4">
              Direct Email Testing
            </h2>
            <EmailTestNodemailer />
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-orange-600 mb-4">
              Password Reset Flow
            </h2>
            <PasswordResetDemo />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-lg">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Email Configuration
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">SMTP Settings:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>Host: smtp.gmail.com</li>
                <li>Port: 587</li>
                <li>Security: TLS</li>
                <li>Authentication: Yes</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Email Templates:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Login Notifications</li>
                <li>• OTP Verification</li>
                <li>• Password Reset</li>
                <li>• Professional HTML Design</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
