'use client';

import { useState, useCallback } from 'react';
import { emailService } from '@/lib/email-service';

interface LoginNotificationData {
  username: string;
  email: string;
  role: string;
  loginTime: string;
  ipAddress?: string;
}

export function useEmailNotification() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendLoginNotification = useCallback(async (data: LoginNotificationData): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Get user's IP address (client-side)
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      const ipAddress = ipData.ip;

      const notificationData = {
        ...data,
        ipAddress,
        loginTime: new Date().toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short'
        })
      };

      const success = await emailService.sendLoginNotification(notificationData);
      
      if (!success) {
        setError('Failed to send login notification email');
        return false;
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Email notification error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const testEmailConnection = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const isConnected = await emailService.testConnection();
      if (!isConnected) {
        setError('Email service connection failed. Please check configuration.');
      }
      return isConnected;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection test failed';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    sendLoginNotification,
    testEmailConnection,
    isLoading,
    error,
    clearError: () => setError(null)
  };
}
