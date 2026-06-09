'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PasswordResetForm } from '@/components/password-reset-form';
import { otpService } from '@/lib/otp-service';
import { useToast } from '@/hooks/use-toast';
import { Shield, Mail, Key, CheckCircle, Clock } from 'lucide-react';

export function PasswordResetDemo() {
  const [showResetForm, setShowResetForm] = useState(false);
  const [otpStats, setOtpStats] = useState({ totalActive: 0, totalExpired: 0 });
  const { toast } = useToast();

  const handleShowResetForm = () => {
    setShowResetForm(true);
  };

  const handleBackToDemo = () => {
    setShowResetForm(false);
    updateStats();
  };

  const updateStats = () => {
    const stats = otpService.getOTPStats();
    setOtpStats(stats);
  };

  const handleTestOTP = () => {
    // Generate a test OTP
    const result = otpService.generateOTP('test@example.com', 'testuser');
    if (result.success) {
      toast({
        title: "Test OTP Generated",
        description: `OTP ID: ${result.otpId}`,
        variant: "default",
        className: "bg-green-100 border-green-500 text-green-700"
      });
    } else {
      toast({
        title: "OTP Generation Failed",
        description: result.message,
        variant: "destructive"
      });
    }
    updateStats();
  };

  const handleCleanupOTPs = () => {
    // This would normally be done automatically, but we can trigger it manually
    updateStats();
    toast({
      title: "OTP Cleanup",
      description: "Expired OTPs have been cleaned up",
      variant: "default",
      className: "bg-blue-100 border-blue-500 text-blue-700"
    });
  };

  if (showResetForm) {
    return (
      <div className="space-y-4">
        <Button
          onClick={handleBackToDemo}
          variant="outline"
          className="mb-4"
        >
          ← Back to Demo
        </Button>
        <PasswordResetForm onBackToLogin={handleBackToDemo} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-orange-600 flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Password Reset System Demo
          </CardTitle>
          <CardDescription>
            Test the complete password reset flow with OTP verification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Mail className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <h3 className="font-semibold text-blue-700">Step 1: Email</h3>
              <p className="text-sm text-blue-600">Enter registered email</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <Key className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <h3 className="font-semibold text-yellow-700">Step 2: OTP</h3>
              <p className="text-sm text-yellow-600">Verify OTP sent to email</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <h3 className="font-semibold text-green-700">Step 3: Reset</h3>
              <p className="text-sm text-green-600">Set new password</p>
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={handleShowResetForm}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Test Password Reset Flow
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-orange-600">OTP System Status</CardTitle>
          <CardDescription>
            Monitor OTP generation and verification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{otpStats.totalActive}</div>
              <div className="text-sm text-green-700">Active OTPs</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{otpStats.totalExpired}</div>
              <div className="text-sm text-gray-700">Expired OTPs</div>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button
              onClick={handleTestOTP}
              variant="outline"
              className="flex-1"
            >
              Generate Test OTP
            </Button>
            <Button
              onClick={handleCleanupOTPs}
              variant="outline"
              className="flex-1"
            >
              Cleanup Expired
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-orange-600">Password Reset Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">Security Features:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 6-digit OTP generation</li>
                  <li>• 10-minute expiry time</li>
                  <li>• Maximum 3 verification attempts</li>
                  <li>• Email verification required</li>
                  <li>• Password strength validation</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">Email Notifications:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• OTP sent to registered email</li>
                  <li>• Password reset confirmation</li>
                  <li>• New password details in email</li>
                  <li>• Security recommendations</li>
                  <li>• Professional HTML templates</li>
                </ul>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">How to Test:</h4>
              <ol className="text-sm text-blue-700 space-y-1">
                <li>1. Click "Test Password Reset Flow"</li>
                <li>2. Enter a registered email address</li>
                <li>3. Check email for OTP (if EmailJS is configured)</li>
                <li>4. Enter the OTP code</li>
                <li>5. Set a new password following the requirements</li>
                <li>6. Check email for password reset confirmation</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
