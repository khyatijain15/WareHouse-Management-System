'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import AuthCheck from '@/components/auth/auth-check';
import { Toaster } from '@/components/ui/toaster';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AuthCheck>
        {children}
      </AuthCheck>
      <Toaster />
    </AuthProvider>
  );
} 