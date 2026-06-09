'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useLoginAttempts } from '@/hooks/use-login-attempts';
import { LoginAttemptsAdmin } from './login-attempt-status';
import { Shield, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export function LoginSecurityDemo() {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attemptStatus, setAttemptStatus] = useState<{
    isBlocked: boolean;
    remainingAttempts: number;
    blockTimeRemaining?: number;
    message: string;
  } | null>(null);
  
  const { recordFailedAttempt, recordSuccessfulAttempt, checkIfBlocked, clearAttempts } = useLoginAttempts();
  const { toast } = useToast();

  const handleFailedLogin = async () => {
    if (!username.trim()) {
      toast({
        title: "Error",
        description: "Please enter a username",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await recordFailedAttempt(username);
      setAttemptStatus(result);
      
      toast({
        title: "Failed Login Attempt",
        description: result.message,
        variant: result.isBlocked ? "destructive" : "default",
        className: result.isBlocked 
          ? "bg-red-100 border-red-500 text-red-700"
          : "bg-yellow-100 border-yellow-500 text-yellow-700"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record attempt",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessfulLogin = async () => {
    if (!username.trim()) {
      toast({
        title: "Error",
        description: "Please enter a username",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      await recordSuccessfulAttempt(username);
      setAttemptStatus(null);
      
      toast({
        title: "Successful Login",
        description: "Login attempt recorded successfully",
        variant: "default",
        className: "bg-green-100 border-green-500 text-green-700"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record successful login",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!username.trim()) {
      toast({
        title: "Error",
        description: "Please enter a username",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await checkIfBlocked(username);
      setAttemptStatus(result);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check status",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAttempts = async () => {
    if (!username.trim()) {
      toast({
        title: "Error",
        description: "Please enter a username",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      await clearAttempts(username);
      setAttemptStatus(null);
      
      toast({
        title: "Attempts Cleared",
        description: "Login attempts cleared successfully",
        variant: "default",
        className: "bg-green-100 border-green-500 text-green-700"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear attempts",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeRemaining = (milliseconds: number): string => {
    const minutes = Math.ceil(milliseconds / (60 * 1000));
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-orange-600 flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Login Security Demo
          </CardTitle>
          <CardDescription>
            Test the login attempt tracking and blocking system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="demo-username">Username</Label>
            <Input
              id="demo-username"
              placeholder="Enter username to test"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={handleFailedLogin}
              disabled={isLoading}
              className="bg-red-500 hover:bg-red-600"
            >
              {isLoading ? 'Processing...' : 'Simulate Failed Login'}
            </Button>
            
            <Button 
              onClick={handleSuccessfulLogin}
              disabled={isLoading}
              className="bg-green-500 hover:bg-green-600"
            >
              {isLoading ? 'Processing...' : 'Simulate Successful Login'}
            </Button>
            
            <Button 
              onClick={handleCheckStatus}
              disabled={isLoading}
              variant="outline"
            >
              Check Status
            </Button>
            
            <Button 
              onClick={handleClearAttempts}
              disabled={isLoading}
              variant="outline"
              className="text-orange-600 border-orange-300 hover:bg-orange-50"
            >
              Clear Attempts
            </Button>
          </div>

          {attemptStatus && (
            <div className="mt-4 p-4 rounded-lg border-2">
              {attemptStatus.isBlocked ? (
                <div className="flex items-start space-x-3">
                  <Shield className="h-5 w-5 text-red-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-700">Account Blocked</h4>
                    <p className="text-sm text-red-600 mt-1">{attemptStatus.message}</p>
                    {attemptStatus.blockTimeRemaining && (
                      <p className="text-sm text-red-600 mt-1 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        Time remaining: {formatTimeRemaining(attemptStatus.blockTimeRemaining)}
                      </p>
                    )}
                  </div>
                </div>
              ) : attemptStatus.remainingAttempts < 3 ? (
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-yellow-700">Warning</h4>
                    <p className="text-sm text-yellow-600 mt-1">
                      {attemptStatus.remainingAttempts} attempt{attemptStatus.remainingAttempts !== 1 ? 's' : ''} remaining before account is blocked.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-green-700">Status Normal</h4>
                    <p className="text-sm text-green-600 mt-1">No failed attempts recorded.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">How it works:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 3 failed login attempts will block the account for 30 minutes</li>
              <li>• IP address tracking helps prevent brute force attacks</li>
              <li>• Successful login clears all failed attempts</li>
              <li>• Admin can manually clear attempts if needed</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <LoginAttemptsAdmin />
    </div>
  );
}
