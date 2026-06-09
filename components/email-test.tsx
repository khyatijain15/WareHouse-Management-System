'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useEmailNotification } from '@/hooks/use-email-notification';
import { setupInstructions } from '@/lib/email-config';

export function EmailTest() {
  const [showInstructions, setShowInstructions] = useState(false);
  const { sendLoginNotification, testEmailConnection, isLoading, error } = useEmailNotification();
  const { toast } = useToast();

  const handleTestConnection = async () => {
    const success = await testEmailConnection();
    if (success) {
      toast({
        title: "Email Connection Test",
        description: "Email service is configured correctly!",
        variant: "default",
        className: "bg-green-100 border-green-500 text-green-700"
      });
    } else {
      toast({
        title: "Email Connection Test",
        description: error || "Email service connection failed. Please check configuration.",
        variant: "destructive"
      });
    }
  };

  const handleTestNotification = async () => {
    const testData = {
      username: 'test_user',
      email: 'test@example.com', // Change this to your actual email for testing
      role: 'admin',
      loginTime: new Date().toLocaleString()
    };

    const success = await sendLoginNotification(testData);
    if (success) {
      toast({
        title: "Test Notification",
        description: "Test login notification sent successfully! Check your email.",
        variant: "default",
        className: "bg-green-100 border-green-500 text-green-700"
      });
    } else {
      toast({
        title: "Test Notification",
        description: error || "Failed to send test notification. Check EmailJS configuration.",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-orange-600">Email Notification Setup</CardTitle>
        <CardDescription>
          Configure email notifications for WMS login events
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={handleTestConnection}
            disabled={isLoading}
            className="bg-blue-500 hover:bg-blue-600"
          >
            {isLoading ? 'Testing...' : 'Test Email Connection'}
          </Button>
          
          <Button 
            onClick={handleTestNotification}
            disabled={isLoading}
            className="bg-green-500 hover:bg-green-600"
          >
            {isLoading ? 'Sending...' : 'Send Test Notification'}
          </Button>
        </div>

        <Button 
          onClick={() => setShowInstructions(!showInstructions)}
          variant="outline"
          className="w-full"
        >
          {showInstructions ? 'Hide' : 'Show'} Setup Instructions
        </Button>

        {showInstructions && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">Setup Instructions:</h3>
            <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono">
              {setupInstructions}
            </pre>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-2">Quick Setup:</h4>
          <ol className="text-sm text-blue-700 space-y-1">
            <li>1. Sign up at <a href="https://www.emailjs.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">EmailJS.com</a></li>
            <li>2. Add your email service and create a template</li>
            <li>3. Create a <code>.env.local</code> file with your EmailJS credentials</li>
            <li>4. Restart your development server</li>
            <li>5. Test the connection using the button above</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
