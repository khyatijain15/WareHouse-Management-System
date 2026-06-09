interface UsernameValidationResult {
  isValid: boolean;
  errors: string[];
  suggestions?: string[];
}

export function validateUsername(username: string): UsernameValidationResult {
  const errors: string[] = [];
  const suggestions: string[] = [];

  // Check if username is provided
  if (!username || username.trim().length === 0) {
    errors.push('Username is required');
    return { isValid: false, errors };
  }

  const trimmedUsername = username.trim();

  // Check minimum length (4 characters)
  if (trimmedUsername.length < 4) {
    errors.push('Username must be at least 4 characters long');
    suggestions.push('Try adding more characters to make it at least 4 characters');
  }

  // Check if username contains only alphabets
  const alphabetOnlyRegex = /^[a-zA-Z]+$/;
  if (!alphabetOnlyRegex.test(trimmedUsername)) {
    errors.push('Username must contain only alphabets (letters)');
    suggestions.push('Remove numbers, spaces, and special characters');
  }

  // Check if first letter is capital
  if (trimmedUsername.length > 0 && trimmedUsername[0] !== trimmedUsername[0].toUpperCase()) {
    errors.push('Username must start with a capital letter');
    suggestions.push(`Try: ${trimmedUsername[0].toUpperCase() + trimmedUsername.slice(1)}`);
  }

  // Check maximum length (reasonable limit)
  if (trimmedUsername.length > 20) {
    errors.push('Username must be 20 characters or less');
    suggestions.push('Try shortening your username');
  }

  return {
    isValid: errors.length === 0,
    errors,
    suggestions: suggestions.length > 0 ? suggestions : undefined
  };
}

export function formatUsername(username: string): string {
  // Remove non-alphabetic characters and convert to proper case
  const cleaned = username.replace(/[^a-zA-Z]/g, '');
  if (cleaned.length === 0) return '';
  
  // Ensure first letter is capital and rest are lowercase
  return cleaned[0].toUpperCase() + cleaned.slice(1).toLowerCase();
}

export function getUsernameStrength(username: string): 'weak' | 'medium' | 'strong' {
  if (username.length < 4) return 'weak';
  if (username.length < 8) return 'medium';
  return 'strong';
}
