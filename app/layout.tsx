import './globals.css';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import ClientLayout from '@/components/layout/client-layout';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'WMS - Warehouse Management System',
  description: 'A comprehensive warehouse management system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}