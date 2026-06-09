'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateUsername, formatUsername, getUsernameStrength } from '@/lib/username-validator';
import { CheckCircle, XCircle, AlertCircle, User } from 'lucide-react';

interface UsernameInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  placeholder?: string;
  className?: string;
  showValidation?: boolean;
  validationClassName?: string;
}

export function UsernameInput({
  value,
  onChange,
  onValidationChange,
  placeholder = "Enter your username",
  className = "",
  showValidation = true,
  validationClassName = ""
}: UsernameInputProps) {
  const [validation, setValidation] = useState(validateUsername(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const newValidation = validateUsername(value);
    setValidation(newValidation);
    onValidationChange?.(newValidation.isValid);
  }, [value, onValidationChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Only allow alphabetic characters
    const filteredValue = inputValue.replace(/[^a-zA-Z]/g, '');
    onChange(filteredValue);
  };

  const handleBlur = () => {
    // Format username on blur
    const formatted = formatUsername(value);
    if (formatted !== value) {
      onChange(formatted);
    }
    setIsFocused(false);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const strength = getUsernameStrength(value);
  const strengthColors = {
    weak: 'text-red-500',
    medium: 'text-yellow-500',
    strong: 'text-green-500'
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={`pl-10 ${className}`}
          maxLength={20}
        />
        {value && validation.isValid && (
          <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-500" />
        )}
        {value && !validation.isValid && (
          <XCircle className="absolute right-3 top-3 h-4 w-4 text-red-500" />
        )}
      </div>

      {showValidation && (value || isFocused) && (
        <div className={`space-y-2 ${validationClassName}`}>
          {/* Username Strength Indicator */}
          {value && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Strength:</span>
              <div className="flex space-x-1">
                {[1, 2, 3].map((level) => (
                  <div
                    key={level}
                    className={`h-2 w-6 rounded ${
                      level <= (strength === 'weak' ? 1 : strength === 'medium' ? 2 : 3)
                        ? strength === 'weak'
                          ? 'bg-red-500'
                          : strength === 'medium'
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <span className={`text-sm font-medium ${strengthColors[strength]}`}>
                {strength.charAt(0).toUpperCase() + strength.slice(1)}
              </span>
            </div>
          )}

          {/* Validation Rules */}
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              {value.length >= 4 ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm ${value.length >= 4 ? 'text-green-700' : 'text-red-700'}`}>
                At least 4 characters ({value.length}/4)
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {/^[a-zA-Z]+$/.test(value) ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm ${/^[a-zA-Z]+$/.test(value) ? 'text-green-700' : 'text-red-700'}`}>
                Only alphabets allowed
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {value.length > 0 && value[0] === value[0].toUpperCase() ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm ${value.length > 0 && value[0] === value[0].toUpperCase() ? 'text-green-700' : 'text-red-700'}`}>
                First letter must be capital
              </span>
            </div>
          </div>

          {/* Error Messages */}
          {validation.errors.length > 0 && (
            <div className="space-y-1">
              {validation.errors.map((error, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {validation.suggestions && validation.suggestions.length > 0 && (
            <div className="space-y-1">
              <span className="text-sm font-medium text-blue-700">Suggestions:</span>
              {validation.suggestions.map((suggestion, index) => (
                <div key={index} className="text-sm text-blue-600 ml-4">
                  • {suggestion}
                </div>
              ))}
            </div>
          )}

          {/* Example */}
          {!value && (
            <div className="text-sm text-gray-500">
              Example: John, Sarah, Michael
            </div>
          )}
        </div>
      )}
    </div>
  );
}
