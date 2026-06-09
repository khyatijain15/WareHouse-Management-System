'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { clientEmailService } from '@/lib/client-email-service';
import { Mail, Send, CheckCircle, AlertCircle } from 'lucide-react';

export function EmailTestNodemailer() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  const handleTestOTPEmail = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    try {
      const result = await clientEmailService.sendOTPEmail({
        to: email,
        toName: 'Test User',
        otpCode: '123456',
        expiryMinutes: 10
      });

      if (result) {
        setTestResult({ success: true, message: 'OTP email sent successfully!' });
        toast({
          title: "Success",
          description: "OTP email sent successfully!",
          variant: "default",
          className: "bg-green-100 border-green-500 text-green-700"
        });
      } else {
        setTestResult({ success: false, message: 'Failed to send OTP email' });
        toast({
          title: "Error",
          description: "Failed to send OTP email",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error testing OTP email:', error);
      setTestResult({ success: false, message: 'Error sending email: ' + error });
      toast({
        title: "Error",
        description: "Error sending email: " + error,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestPasswordResetEmail = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    try {
      const result = await clientEmailService.sendPasswordResetEmail({
        to: email,
        toName: 'Test User',
        username: 'testuser',
        newPassword: 'NewPass123!',
        resetTime: new Date().toLocaleString()
      });

      if (result) {
        setTestResult({ success: true, message: 'Password reset email sent successfully!' });
        toast({
          title: "Success",
          description: "Password reset email sent successfully!",
          variant: "default",
          className: "bg-green-100 border-green-500 text-green-700"
        });
      } else {
        setTestResult({ success: false, message: 'Failed to send password reset email' });
        toast({
          title: "Error",
          description: "Failed to send password reset email",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error testing password reset email:', error);
      setTestResult({ success: false, message: 'Error sending email: ' + error });
      toast({
        title: "Error",
        description: "Error sending email: " + error,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-orange-600 flex items-center">
          <Mail className="h-5 w-5 mr-2" />
          Nodemailer Email Test
        </CardTitle>
        <CardDescription>
          Test email sending with Nodemailer and Gmail SMTP
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-orange-600">Test Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter email to test"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-orange-500 focus:ring-orange-500 focus:border-orange-500 text-orange-600 placeholder:text-green-500"
          />
        </div>

        <div className="flex space-x-2">
          <Button
            onClick={handleTestOTPEmail}
            disabled={isLoading || !email}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
          >
            {isLoading ? 'Sending...' : 'Test OTP Email'}
          </Button>
          <Button
            onClick={handleTestPasswordResetEmail}
            disabled={isLoading || !email}
            variant="outline"
            className="flex-1 border-orange-500 text-orange-600 hover:bg-orange-50"
          >
            {isLoading ? 'Sending...' : 'Test Reset Email'}
          </Button>
        </div>

        {testResult && (
          <div className={`p-3 rounded-lg flex items-center ${
            testResult.success 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            {testResult.success ? (
              <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
            )}
            <span className={`text-sm ${
              testResult.success ? 'text-green-700' : 'text-red-700'
            }`}>
              {testResult.message}
            </span>
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>Configuration:</strong></p>
          <p>Host: smtp.gmail.com</p>
          <p>Port: 587</p>
          <p>User: agrogreensoftware@gmail.com</p>
          <p>From: Agrogreen Software &lt;agrogreensoftware@gmail.com&gt;</p>
        </div>
      </CardContent>
    </Card>
  );
}
