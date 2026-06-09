export interface PasswordValidationRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
  required: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  rules: {
    [key: string]: {
      passed: boolean;
      label: string;
      required: boolean;
    };
  };
  strength: 'weak' | 'medium' | 'strong';
  message: string;
}

export const passwordValidationRules: PasswordValidationRule[] = [
  {
    id: 'starts_with_capital',
    label: 'Must start with a capital letter',
    test: (password: string) => /^[A-Z]/.test(password),
    required: true
  },
  {
    id: 'contains_lowercase',
    label: 'Must contain lowercase letters',
    test: (password: string) => /[a-z]/.test(password),
    required: true
  },
  {
    id: 'contains_special_chars',
    label: 'Must contain special characters (!@#$%^&*)',
    test: (password: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    required: true
  },
  {
    id: 'contains_numbers',
    label: 'Must contain numbers (0-9)',
    test: (password: string) => /[0-9]/.test(password),
    required: true
  },
  {
    id: 'min_length',
    label: 'Must be at least 8 characters long',
    test: (password: string) => password.length >= 8,
    required: true
  },
  {
    id: 'max_length',
    label: 'Must be no more than 50 characters',
    test: (password: string) => password.length <= 50,
    required: true
  }
];

export function validatePassword(password: string): PasswordValidationResult {
  const rules: { [key: string]: { passed: boolean; label: string; required: boolean } } = {};
  let passedRules = 0;
  let requiredRules = 0;

  // Check each rule
  passwordValidationRules.forEach(rule => {
    const passed = rule.test(password);
    rules[rule.id] = {
      passed,
      label: rule.label,
      required: rule.required
    };
    
    if (passed) passedRules++;
    if (rule.required) requiredRules++;
  });

  // Calculate strength
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (passedRules >= requiredRules) {
    if (passedRules >= requiredRules + 1) {
      strength = 'strong';
    } else {
      strength = 'medium';
    }
  }

  // Generate message
  let message = '';
  if (passedRules === requiredRules) {
    message = 'Password meets all requirements';
  } else if (passedRules > 0) {
    const remaining = requiredRules - passedRules;
    message = `${remaining} requirement${remaining !== 1 ? 's' : ''} remaining`;
  } else {
    message = 'Password does not meet requirements';
  }

  return {
    isValid: passedRules >= requiredRules,
    rules,
    strength,
    message
  };
}

export function getPasswordStrengthColor(strength: 'weak' | 'medium' | 'strong'): string {
  switch (strength) {
    case 'weak':
      return 'text-red-500';
    case 'medium':
      return 'text-yellow-500';
    case 'strong':
      return 'text-green-500';
    default:
      return 'text-gray-500';
  }
}

export function getPasswordStrengthBgColor(strength: 'weak' | 'medium' | 'strong'): string {
  switch (strength) {
    case 'weak':
      return 'bg-red-50 border-red-200';
    case 'medium':
      return 'bg-yellow-50 border-yellow-200';
    case 'strong':
      return 'bg-green-50 border-green-200';
    default:
      return 'bg-gray-50 border-gray-200';
  }
}

// Helper function to check if password follows the specific format
export function checkPasswordFormat(password: string): boolean {
  // Must start with capital letter
  if (!/^[A-Z]/.test(password)) return false;
  
  // Must contain lowercase letters
  if (!/[a-z]/.test(password)) return false;
  
  // Must contain special characters
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false;
  
  // Must contain numbers
  if (!/[0-9]/.test(password)) return false;
  
  // Must be at least 8 characters
  if (password.length < 8) return false;
  
  return true;
}
