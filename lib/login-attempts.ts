export interface LoginAttempt {
  username: string;
  attempts: number;
  lastAttempt: number;
  blockedUntil: number | null;
  ipAddress?: string;
}

export interface LoginAttemptResult {
  isBlocked: boolean;
  remainingAttempts: number;
  blockTimeRemaining?: number;
  message: string;
}

class LoginAttemptService {
  private attempts: Map<string, LoginAttempt> = new Map();
  private readonly MAX_ATTEMPTS = 3;
  private readonly BLOCK_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

  private getKey(username: string, ipAddress?: string): string {
    return `${username}_${ipAddress || 'unknown'}`;
  }

  private isBlocked(attempt: LoginAttempt): boolean {
    if (!attempt.blockedUntil) return false;
    return Date.now() < attempt.blockedUntil;
  }

  private getBlockTimeRemaining(blockedUntil: number): number {
    return Math.max(0, blockedUntil - Date.now());
  }

  private formatTimeRemaining(milliseconds: number): string {
    const minutes = Math.ceil(milliseconds / (60 * 1000));
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  recordFailedAttempt(username: string, ipAddress?: string): LoginAttemptResult {
    const key = this.getKey(username, ipAddress);
    const now = Date.now();
    
    let attempt = this.attempts.get(key);
    
    if (!attempt) {
      attempt = {
        username,
        attempts: 0,
        lastAttempt: now,
        blockedUntil: null,
        ipAddress
      };
    }

    // Check if user is currently blocked
    if (this.isBlocked(attempt)) {
      const timeRemaining = this.getBlockTimeRemaining(attempt.blockedUntil!);
      return {
        isBlocked: true,
        remainingAttempts: 0,
        blockTimeRemaining: timeRemaining,
        message: `Account is temporarily blocked due to multiple failed login attempts. Please try again in ${this.formatTimeRemaining(timeRemaining)}.`
      };
    }

    // Increment attempt count
    attempt.attempts += 1;
    attempt.lastAttempt = now;

    // Check if user should be blocked
    if (attempt.attempts >= this.MAX_ATTEMPTS) {
      attempt.blockedUntil = now + this.BLOCK_DURATION;
      this.attempts.set(key, attempt);
      
      return {
        isBlocked: true,
        remainingAttempts: 0,
        blockTimeRemaining: this.BLOCK_DURATION,
        message: `Too many failed login attempts. Account blocked for ${this.formatTimeRemaining(this.BLOCK_DURATION)}. Please try again later.`
      };
    }

    // User is not blocked yet
    this.attempts.set(key, attempt);
    const remainingAttempts = this.MAX_ATTEMPTS - attempt.attempts;
    
    return {
      isBlocked: false,
      remainingAttempts,
      message: remainingAttempts > 1 
        ? `Invalid credentials. ${remainingAttempts} attempts remaining.`
        : `Invalid credentials. This is your last attempt before account is blocked.`
    };
  }

  recordSuccessfulAttempt(username: string, ipAddress?: string): void {
    const key = this.getKey(username, ipAddress);
    // Reset attempts on successful login
    this.attempts.delete(key);
  }

  checkIfBlocked(username: string, ipAddress?: string): LoginAttemptResult {
    const key = this.getKey(username, ipAddress);
    const attempt = this.attempts.get(key);
    
    if (!attempt) {
      return {
        isBlocked: false,
        remainingAttempts: this.MAX_ATTEMPTS,
        message: ''
      };
    }

    if (this.isBlocked(attempt)) {
      const timeRemaining = this.getBlockTimeRemaining(attempt.blockedUntil!);
      return {
        isBlocked: true,
        remainingAttempts: 0,
        blockTimeRemaining: timeRemaining,
        message: `Account is temporarily blocked due to multiple failed login attempts. Please try again in ${this.formatTimeRemaining(timeRemaining)}.`
      };
    }

    const remainingAttempts = this.MAX_ATTEMPTS - attempt.attempts;
    return {
      isBlocked: false,
      remainingAttempts,
      message: ''
    };
  }

  clearAttempts(username: string, ipAddress?: string): void {
    const key = this.getKey(username, ipAddress);
    this.attempts.delete(key);
  }

  // Clean up expired blocks (optional - for memory management)
  cleanupExpiredBlocks(): void {
    const now = Date.now();
    this.attempts.forEach((attempt, key) => {
      if (attempt.blockedUntil && now >= attempt.blockedUntil) {
        this.attempts.delete(key);
      }
    });
  }

  // Get attempt statistics (for admin purposes)
  getAttemptStats(): { totalBlocked: number; totalAttempts: number } {
    let totalBlocked = 0;
    let totalAttempts = 0;
    
    this.attempts.forEach((attempt) => {
      totalAttempts += attempt.attempts;
      if (this.isBlocked(attempt)) {
        totalBlocked++;
      }
    });
    
    return { totalBlocked, totalAttempts };
  }
}

// Export singleton instance
export const loginAttemptService = new LoginAttemptService();
export default loginAttemptService;
