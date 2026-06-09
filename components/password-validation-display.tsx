'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { validatePassword, getPasswordStrengthColor, getPasswordStrengthBgColor, PasswordValidationResult } from '@/lib/password-validator';

interface PasswordValidationDisplayProps {
  password: string;
  showValidation?: boolean;
  className?: string;
}

export function PasswordValidationDisplay({ 
  password, 
  showValidation = true, 
  className = '' 
}: PasswordValidationDisplayProps) {
  const [validation, setValidation] = useState<PasswordValidationResult | null>(null);

  useEffect(() => {
    if (password && showValidation) {
      const result = validatePassword(password);
      setValidation(result);
    } else {
      setValidation(null);
    }
  }, [password, showValidation]);

  if (!showValidation || !password || !validation) {
    return null;
  }

  const strengthColor = getPasswordStrengthColor(validation.strength);
  const strengthBgColor = getPasswordStrengthBgColor(validation.strength);

  return (
    <div className={`mt-2 p-2 md:p-3 rounded-lg border ${strengthBgColor} ${className}`}>
      {/* Password Strength Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 space-y-2 sm:space-y-0">
        <div className="flex items-center space-x-2">
          <span className="text-xs md:text-sm font-medium text-gray-700">Password Strength:</span>
          <span className={`text-xs md:text-sm font-semibold ${strengthColor} capitalize`}>
            {validation.strength}
          </span>
        </div>
        <div className="flex space-x-1">
          {[1, 2, 3].map((level) => (
            <div
              key={level}
              className={`h-2 w-4 md:w-6 rounded ${
                (validation.strength === 'weak' && level === 1) ||
                (validation.strength === 'medium' && level <= 2) ||
                (validation.strength === 'strong' && level <= 3)
                  ? strengthColor.replace('text-', 'bg-')
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Validation Rules */}
      <div className="space-y-1 md:space-y-2">
        {Object.entries(validation.rules).map(([ruleId, rule]) => (
          <div key={ruleId} className="flex items-center space-x-2">
            {rule.passed ? (
              <CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-green-500 flex-shrink-0" />
            ) : (
              <XCircle className="h-3 w-3 md:h-4 md:w-4 text-red-500 flex-shrink-0" />
            )}
            <span
              className={`text-xs md:text-sm ${
                rule.passed ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {rule.label}
            </span>
          </div>
        ))}
      </div>

      {/* Overall Status Message */}
      <div className="mt-2 md:mt-3 pt-2 border-t border-gray-200">
        <div className="flex items-center space-x-2">
          {validation.isValid ? (
            <CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-3 w-3 md:h-4 md:w-4 text-yellow-500" />
          )}
          <span className={`text-xs md:text-sm font-medium ${
            validation.isValid ? 'text-green-700' : 'text-yellow-700'
          }`}>
            {validation.message}
          </span>
        </div>
      </div>

      {/* Format Example */}
      <div className="mt-2 md:mt-3 p-2 bg-gray-100 rounded text-xs text-gray-600">
        <strong>Example format:</strong> <code className="text-blue-600">Password123!</code>
        <div className="mt-1 text-gray-500">
          • Starts with capital letter (P)
          <br />
          • Contains lowercase letters (assword)
          <br />
          • Contains numbers (123)
          <br />
          • Contains special character (!)
        </div>
      </div>
    </div>
  );
}
