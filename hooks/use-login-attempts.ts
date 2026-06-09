'use client';

import { useState, useCallback } from 'react';
import { loginAttemptService, LoginAttemptResult } from '@/lib/login-attempts';

export function useLoginAttempts() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordFailedAttempt = useCallback(async (username: string, ipAddress?: string): Promise<LoginAttemptResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = loginAttemptService.recordFailedAttempt(username, ipAddress);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to record login attempt';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const recordSuccessfulAttempt = useCallback(async (username: string, ipAddress?: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      loginAttemptService.recordSuccessfulAttempt(username, ipAddress);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to record successful login';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkIfBlocked = useCallback(async (username: string, ipAddress?: string): Promise<LoginAttemptResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = loginAttemptService.checkIfBlocked(username, ipAddress);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check login status';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearAttempts = useCallback(async (username: string, ipAddress?: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      loginAttemptService.clearAttempts(username, ipAddress);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear login attempts';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getAttemptStats = useCallback(() => {
    return loginAttemptService.getAttemptStats();
  }, []);

  const cleanupExpiredBlocks = useCallback(() => {
    loginAttemptService.cleanupExpiredBlocks();
  }, []);

  return {
    recordFailedAttempt,
    recordSuccessfulAttempt,
    checkIfBlocked,
    clearAttempts,
    getAttemptStats,
    cleanupExpiredBlocks,
    isLoading,
    error,
    clearError: () => setError(null)
  };
}
