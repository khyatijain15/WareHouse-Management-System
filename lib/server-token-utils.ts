// Server-side token utilities for admin approval/rejection
// This file is used by API routes and does not have 'use client' directive

// Generate a secure token for approve/reject links
export function generateSecureToken(userId: string): string {
  // In a production environment, you'd want to use a more secure token generation
  // and store it in the database with expiration time
  const timestamp = Date.now().toString();
  const randomString = Math.random().toString(36).substring(2, 15);
  return btoa(`${userId}:${timestamp}:${randomString}`).replace(/[+/=]/g, '');
}

// Verify the secure token (to be used in API routes)
export function verifySecureToken(userId: string, token: string): boolean {
  try {
    const decoded = atob(token);
    const [tokenUserId, timestamp, randomString] = decoded.split(':');
    
    // Check if userId matches
    if (tokenUserId !== userId) return false;
    
    // Check if token is not older than 24 hours (86400000 ms)
    const tokenTime = parseInt(timestamp);
    const currentTime = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (currentTime - tokenTime > maxAge) return false;
    
    return true;
  } catch (error) {
    console.error('Token verification failed:', error);
    return false;
  }
}