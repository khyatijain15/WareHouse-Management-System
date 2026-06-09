'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import emailjs from '@emailjs/browser';

export function EmailDebug() {
  const [isLoading, setIsLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const { toast } = useToast();

  const testEmailJS = async () => {
    setIsLoading(true);
    setDebugInfo('Testing EmailJS configuration...\n');

    try {
      // Initialize EmailJS
      emailjs.init('rEntskmqP_FrBX5uy');
      setDebugInfo(prev => prev + 'EmailJS initialized successfully\n');

      // Test parameters
      const templateParams = {
        to_email: 'test@example.com', // Change this to your actual email
        to_name: 'Test User',
        username: 'test_user',
        user_role: 'ADMIN',
        login_time: new Date().toLocaleString(),
        ip_address: '127.0.0.1',
        from_name: 'WMS System',
        subject: 'WMS Test Email',
        message: 'This is a test email from WMS system.',
        html_message: '<p>This is a test email from WMS system.</p>'
      };

      setDebugInfo(prev => prev + `Template params: ${JSON.stringify(templateParams, null, 2)}\n`);

      // Try to send email
      const result = await emailjs.send(
        'service_sh3at2u',
        '__ejs-test-mail-service__', // This needs to be your actual template ID
        templateParams
      );

      setDebugInfo(prev => prev + `Email sent successfully: ${JSON.stringify(result)}\n`);
      
      toast({
        title: "Email Test",
        description: "Email sent successfully!",
        variant: "default",
        className: "bg-green-100 border-green-500 text-green-700"
      });

    } catch (error: any) {
      const errorMessage = error?.text || error?.message || 'Unknown error';
      setDebugInfo(prev => prev + `Error: ${errorMessage}\n`);
      
      toast({
        title: "Email Test Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkConfiguration = () => {
    setDebugInfo(`
Current Configuration:
- Service ID: service_sh3at2u
- Template ID: __ejs-test-mail-service__ (This looks like a placeholder!)
- Public Key: rEntskmqP_FrBX5uy

Issues Found:
1. Template ID "__ejs-test-mail-service__" is a placeholder, not a real template ID
2. You need to create a template in your EmailJS dashboard
3. Template ID should look like "template_xxxxx" or similar

Next Steps:
1. Go to https://www.emailjs.com/
2. Login to your account
3. Go to Email Templates
4. Create a new template or use an existing one
5. Copy the real template ID
6. Update the template ID in your code
    `);
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="text-orange-600">Email Debug Tool</CardTitle>
        <CardDescription>
          Debug EmailJS configuration and test email sending
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={checkConfiguration}
            className="bg-blue-500 hover:bg-blue-600"
          >
            Check Configuration
          </Button>
          
          <Button 
            onClick={testEmailJS}
            disabled={isLoading}
            className="bg-green-500 hover:bg-green-600"
          >
            {isLoading ? 'Testing...' : 'Test Email Sending'}
          </Button>
        </div>

        {debugInfo && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">Debug Information:</h3>
            <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono">
              {debugInfo}
            </pre>
          </div>
        )}

        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Common Issues:</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Template ID is a placeholder - you need to create a real template</li>
            <li>• Service ID might be incorrect</li>
            <li>• Public Key might be wrong</li>
            <li>• Email service might not be properly configured in EmailJS</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
