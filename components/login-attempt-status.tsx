'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLoginAttempts } from '@/hooks/use-login-attempts';
import { Clock, Shield, AlertTriangle, CheckCircle } from 'lucide-react';

interface LoginAttemptStatusProps {
  username: string;
  ipAddress?: string;
  onStatusChange?: (isBlocked: boolean, remainingAttempts: number) => void;
}

export function LoginAttemptStatus({ username, ipAddress, onStatusChange }: LoginAttemptStatusProps) {
  const [status, setStatus] = useState<{
    isBlocked: boolean;
    remainingAttempts: number;
    blockTimeRemaining?: number;
    message: string;
  } | null>(null);
  
  const { checkIfBlocked, clearAttempts, isLoading } = useLoginAttempts();

  useEffect(() => {
    if (username) {
      checkStatus();
    }
  }, [username, ipAddress]);

  const checkStatus = async () => {
    try {
      const result = await checkIfBlocked(username, ipAddress);
      setStatus(result);
      onStatusChange?.(result.isBlocked, result.remainingAttempts);
    } catch (error) {
      console.error('Failed to check login status:', error);
    }
  };

  const handleClearAttempts = async () => {
    try {
      await clearAttempts(username, ipAddress);
      await checkStatus();
    } catch (error) {
      console.error('Failed to clear attempts:', error);
    }
  };

  const formatTimeRemaining = (milliseconds: number): string => {
    const minutes = Math.ceil(milliseconds / (60 * 1000));
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };

  if (!status || isLoading) {
    return null;
  }

  if (status.isBlocked) {
    return (
      <Alert className="border-red-500 bg-red-50">
        <Shield className="h-4 w-4 text-red-500" />
        <AlertDescription className="text-red-700">
          <div className="flex items-center justify-between">
            <div>
              <strong>Account Temporarily Blocked</strong>
              <p className="text-sm mt-1">{status.message}</p>
              {status.blockTimeRemaining && (
                <p className="text-sm mt-1 flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Time remaining: {formatTimeRemaining(status.blockTimeRemaining)}
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearAttempts}
              className="text-red-600 border-red-300 hover:bg-red-100"
            >
              Clear Block
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (status.remainingAttempts < 3) {
    return (
      <Alert className="border-yellow-500 bg-yellow-50">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <AlertDescription className="text-yellow-700">
          <div className="flex items-center justify-between">
            <div>
              <strong>Login Attempts Warning</strong>
              <p className="text-sm mt-1">
                {status.remainingAttempts} attempt{status.remainingAttempts !== 1 ? 's' : ''} remaining before account is blocked.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearAttempts}
              className="text-yellow-600 border-yellow-300 hover:bg-yellow-100"
            >
              Clear Attempts
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-green-500 bg-green-50">
      <CheckCircle className="h-4 w-4 text-green-500" />
      <AlertDescription className="text-green-700">
        <strong>Login Status: Normal</strong>
        <p className="text-sm mt-1">No failed attempts recorded.</p>
      </AlertDescription>
    </Alert>
  );
}

// Admin component to view all login attempts
export function LoginAttemptsAdmin() {
  const [stats, setStats] = useState<{ totalBlocked: number; totalAttempts: number } | null>(null);
  const { getAttemptStats, cleanupExpiredBlocks } = useLoginAttempts();

  useEffect(() => {
    updateStats();
  }, []);

  const updateStats = () => {
    const currentStats = getAttemptStats();
    setStats(currentStats);
  };

  const handleCleanup = () => {
    cleanupExpiredBlocks();
    updateStats();
  };

  if (!stats) return null;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-orange-600">Login Security Status</CardTitle>
        <CardDescription>
          Monitor login attempts and security status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{stats.totalBlocked}</div>
            <div className="text-sm text-red-700">Blocked Accounts</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{stats.totalAttempts}</div>
            <div className="text-sm text-yellow-700">Total Attempts</div>
          </div>
        </div>
        
        <Button 
          onClick={handleCleanup}
          variant="outline"
          className="w-full"
        >
          Cleanup Expired Blocks
        </Button>
        
        <div className="text-xs text-gray-500 text-center">
          <p>• Accounts are blocked for 30 minutes after 3 failed attempts</p>
          <p>• IP address tracking helps prevent brute force attacks</p>
        </div>
      </CardContent>
    </Card>
  );
}
