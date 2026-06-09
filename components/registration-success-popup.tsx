'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Mail, Clock, Shield, User, Key } from 'lucide-react';

interface RegistrationSuccessPopupProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  email: string;
  role: string;
  password: string;
  registrationTime: string;
}

export function RegistrationSuccessPopup({
  isOpen,
  onClose,
  username,
  email,
  role,
  password,
  registrationTime
}: RegistrationSuccessPopupProps) {
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
      <Card className="w-full max-w-2xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto">
        <CardHeader className="text-center bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-lg p-4 md:p-6">
          <div className="flex items-center justify-center mb-3 md:mb-4">
            <CheckCircle className="h-12 w-12 md:h-16 md:w-16 text-white" />
          </div>
          <CardTitle className="text-xl md:text-3xl font-bold">
            🎉 Registration Successful!
          </CardTitle>
          <CardDescription className="text-green-100 text-sm md:text-lg">
            Welcome to the Warehouse Management System
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 md:space-y-6 p-4 md:p-6">
          {/* Success Message */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 md:p-6 text-center">
            <h3 className="text-lg md:text-xl font-bold text-green-800 mb-3 md:mb-4">
              THANK YOU FOR SUCCESSFUL REGISTRATION ON OUR PORTAL
            </h3>
            <p className="text-green-700 text-sm md:text-lg leading-relaxed">
              Please wait for sometime, once admin verifies your data, you will be allowed to access our portal. 
              After verification done, from our admin, you will be notified on your respective registered email ID.
            </p>
          </div>

          {/* Account Details */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
            <h4 className="text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4 flex items-center">
              <User className="h-4 w-4 md:h-5 md:w-5 mr-2 text-green-600" />
              Account Details
            </h4>
            <div className="grid grid-cols-1 gap-3 md:gap-4">
              <div className="flex flex-col sm:flex-row sm:justify-between">
                <span className="font-medium text-gray-600 text-sm md:text-base">Username:</span>
                <span className="text-gray-800 font-mono text-sm md:text-base break-all">{username}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between">
                <span className="font-medium text-gray-600 text-sm md:text-base">Email:</span>
                <span className="text-gray-800 text-sm md:text-base break-all">{email}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between">
                <span className="font-medium text-gray-600 text-sm md:text-base">Role:</span>
                <span className="text-gray-800 font-semibold text-sm md:text-base">{role.toUpperCase()}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between">
                <span className="font-medium text-gray-600 text-sm md:text-base">Registration Time:</span>
                <span className="text-gray-800 text-sm md:text-base break-all">{registrationTime}</span>
              </div>
            </div>
          </div>

          {/* Login Credentials */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 md:p-6">
            <h4 className="text-base md:text-lg font-semibold text-blue-800 mb-3 md:mb-4 flex items-center">
              <Key className="h-4 w-4 md:h-5 md:w-5 mr-2 text-blue-600" />
              Your Login Credentials
            </h4>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                <span className="font-medium text-blue-700 text-sm md:text-base">Username:</span>
                <span className="text-blue-900 font-mono text-sm md:text-lg break-all">{username}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
                <span className="font-medium text-blue-700 text-sm md:text-base">Password:</span>
                <div className="flex items-center space-x-2">
                  <span className="text-blue-900 font-mono text-sm md:text-lg break-all">
                    {showPassword ? password : '••••••••'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-blue-600 hover:text-blue-800 text-xs md:text-sm"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-blue-600 text-xs md:text-sm mt-3 text-center">
              Please save these credentials for future login
            </p>
          </div>

          {/* Important Information */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 md:p-6">
            <h4 className="text-base md:text-lg font-semibold text-yellow-800 mb-3 md:mb-4 flex items-center">
              <Shield className="h-4 w-4 md:h-5 md:w-5 mr-2 text-yellow-600" />
              Important Information
            </h4>
            <ul className="space-y-2 text-yellow-700 text-sm md:text-base">
              <li className="flex items-start">
                <span className="text-yellow-600 mr-2">•</span>
                Your account is pending admin verification
              </li>
              <li className="flex items-start">
                <span className="text-yellow-600 mr-2">•</span>
                You will receive an email notification once verified
              </li>
              <li className="flex items-start">
                <span className="text-yellow-600 mr-2">•</span>
                Do not share your login credentials with anyone
              </li>
              <li className="flex items-start">
                <span className="text-yellow-600 mr-2">•</span>
                Contact support if you have any questions
              </li>
            </ul>
          </div>

          {/* Email Notification Status */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 md:p-4">
            <div className="flex items-center justify-center space-x-2 text-gray-600">
              <Mail className="h-4 w-4 md:h-5 md:w-5" />
              <span className="text-xs md:text-sm text-center">
                A confirmation email has been sent to <strong className="break-all">{email}</strong>
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center">
            <Button
              onClick={() => {
                // Clear all form data and redirect to fresh login
                onClose();
                // Force page refresh to ensure clean state
                window.location.href = '/login';
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-6 md:px-8 py-2 text-sm md:text-base w-full sm:w-auto"
            >
              Continue to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
