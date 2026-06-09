'use client';

import { useState, useCallback } from 'react';
import { otpService } from '@/lib/otp-service';
import { passwordResetEmailService } from '@/lib/password-reset-email';
import { validatePassword } from '@/lib/password-validator';
import { doc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import bcrypt from 'bcryptjs';

interface PasswordResetState {
  step: 'email' | 'otp' | 'new-password' | 'success';
  email: string;
  username: string;
  otpId: string | null;
  isLoading: boolean;
  error: string | null;
}

export function usePasswordReset() {
  const [state, setState] = useState<PasswordResetState>({
    step: 'email',
    email: '',
    username: '',
    otpId: null,
    isLoading: false,
    error: null
  });

  const sendOTP = useCallback(async (email: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Find user by email
      const userQuery = query(
        collection(db, 'users'),
        where('email', '==', email)
      );
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: 'No account found with this email address.' 
        }));
        return false;
      }

      const userData = userSnapshot.docs[0].data();
      const username = userData.username;

      // Generate OTP
      const otpResult = otpService.generateOTP(email, username);
      
      if (!otpResult.success) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: otpResult.message 
        }));
        return false;
      }

      // Send OTP email
      const emailSent = await passwordResetEmailService.sendOTPEmail({
        to_email: email,
        to_name: username,
        otp_code: otpService.getOTPData(otpResult.otpId!)?.code || '',
        expiry_minutes: 10,
        from_name: 'WMS System',
        subject: 'Password Reset OTP - WMS System'
      });

      if (!emailSent) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: 'Failed to send OTP email. Please try again.' 
        }));
        return false;
      }

      setState(prev => ({
        ...prev,
        step: 'otp',
        email,
        username,
        otpId: otpResult.otpId!,
        isLoading: false,
        error: null
      }));

      return true;
    } catch (error) {
      console.error('Error sending OTP:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'An error occurred while sending OTP. Please try again.' 
      }));
      return false;
    }
  }, []);

  const verifyOTP = useCallback(async (otpCode: string): Promise<boolean> => {
    if (!state.otpId) {
      setState(prev => ({ 
        ...prev, 
        error: 'No OTP session found. Please request a new OTP.' 
      }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const otpResult = otpService.verifyOTP(state.otpId, otpCode);
      
      if (!otpResult.success) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: otpResult.message 
        }));
        return false;
      }

      setState(prev => ({
        ...prev,
        step: 'new-password',
        isLoading: false,
        error: null
      }));

      return true;
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'An error occurred while verifying OTP. Please try again.' 
      }));
      return false;
    }
  }, [state.otpId]);

  const resetPassword = useCallback(async (newPassword: string): Promise<boolean> => {
    if (!state.otpId || !state.email) {
      setState(prev => ({ 
        ...prev, 
        error: 'Invalid session. Please start the reset process again.' 
      }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Validate new password
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        const failedRules = Object.entries(passwordValidation.rules)
          .filter(([_, rule]) => !rule.passed && rule.required)
          .map(([_, rule]) => rule.label);
        
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: `Password validation failed: ${failedRules.join(', ')}` 
        }));
        return false;
      }

      // Verify OTP is still valid
      const otpData = otpService.getOTPData(state.otpId);
      if (!otpData || !otpData.verified) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: 'OTP session expired. Please start the reset process again.' 
        }));
        return false;
      }

      // Get current user data to check password history
      const userQuery = query(
        collection(db, 'users'),
        where('email', '==', state.email)
      );
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: 'User not found. Please try again.' 
        }));
        return false;
      }

      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      
      // Check if new password matches current password using bcrypt
      if (userData.password) {
        const isSamePassword = await bcrypt.compare(newPassword, userData.password);
        if (isSamePassword) {
          setState(prev => ({ 
            ...prev, 
            isLoading: false, 
            error: 'New password must be different from your current password' 
          }));
          return false;
        }
      }

      // Hash the new password before storing
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password in database
      await updateDoc(doc(db, 'users', userDoc.id), {
        password: hashedPassword, // Store hashed password
        updatedAt: new Date().toISOString()
      });

      // Send password reset confirmation email
      const emailSent = await passwordResetEmailService.sendPasswordResetEmail({
        to_email: state.email,
        to_name: state.username,
        username: state.username,
        new_password: newPassword,
        reset_time: new Date().toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short'
        }),
        from_name: 'WMS System',
        subject: 'Password Reset Successful - WMS System'
      });

      if (!emailSent) {
        console.warn('Password reset successful but failed to send confirmation email');
      }

      // Mark OTP as used
      otpService.markOTPAsUsed(state.otpId);

      setState(prev => ({
        ...prev,
        step: 'success',
        isLoading: false,
        error: null
      }));

      return true;
    } catch (error) {
      console.error('Error resetting password:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'An error occurred while resetting password. Please try again.' 
      }));
      return false;
    }
  }, [state.otpId, state.email, state.username]);

  const resetState = useCallback(() => {
    setState({
      step: 'email',
      email: '',
      username: '',
      otpId: null,
      isLoading: false,
      error: null
    });
  }, []);

  const resendOTP = useCallback(async (): Promise<boolean> => {
    if (!state.email || !state.username) {
      setState(prev => ({ 
        ...prev, 
        error: 'Invalid session. Please start the reset process again.' 
      }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Use the new resendOTP method from otpService
      const otpResult = otpService.resendOTP(state.email, state.username);
      
      if (!otpResult.success) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: otpResult.message 
        }));
        return false;
      }

      // Send OTP email
      const emailSent = await passwordResetEmailService.sendOTPEmail({
        to_email: state.email,
        to_name: state.username,
        otp_code: otpService.getOTPData(otpResult.otpId!)?.code || '',
        expiry_minutes: 10,
        from_name: 'WMS System',
        subject: 'Password Reset OTP - WMS System (Resent)'
      });

      if (!emailSent) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: 'Failed to send OTP email. Please try again.' 
        }));
        return false;
      }

      setState(prev => ({
        ...prev,
        otpId: otpResult.otpId!,
        isLoading: false,
        error: null
      }));

      return true;
    } catch (error) {
      console.error('Error resending OTP:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Failed to resend OTP. Please try again.' 
      }));
      return false;
    }
  }, [state.email, state.username]);

  const getResendStatus = useCallback(() => {
    if (!state.email) {
      return {
        canResend: false,
        cooldownRemaining: 0,
        blockedUntil: 0,
        remainingAttempts: 0
      };
    }
    return otpService.getResendStatus(state.email);
  }, [state.email]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    sendOTP,
    verifyOTP,
    resetPassword,
    resendOTP,
    getResendStatus,
    resetState,
    clearError
  };
}
