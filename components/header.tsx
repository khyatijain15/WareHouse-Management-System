"use client";

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, MenuIcon } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  LayoutDashboard,
  ClipboardList,
  ArrowDownCircle,
  ArrowUpCircle,
  FileBarChart2,
  FileOutput,
  Database,
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Header() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged Out Successfully",
        description: `Goodbye, ${user?.username}! You have been logged out successfully.`,
        variant: "default",
        className: "bg-green-100 border-green-500 text-green-700"
      });
    } catch (error) {
      console.error('Logout failed', error);
      toast({
        title: "Logout Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive"
      });
    }
  };

  const navigationItems: Array<{
    name: string;
    href: string;
    icon: any;
    allowedRoles: string[];
  }> = [
    // Dashboard button removed as requested
  ];

  return (
    <header className="border-b border-border h-16 md:h-20 px-2 md:px-4 flex items-center justify-between bg-green-600 z-10 w-full relative">
      <div className="flex items-center gap-1 md:gap-2 lg:gap-3 bg-white rounded-lg px-1 md:px-2 py-1">
        <div className="w-20 h-6 sm:w-24 sm:h-8 md:w-36 md:h-10 relative">
          <Image 
            src="/AGlogo.webp" 
            alt="AgroGreen Logo" 
            fill
            className="object-contain"
            priority
          />
        </div>
        
      
        <nav className={cn(
          "md:flex items-center space-x-4 ml-2 md:ml-6",
          isNavOpen ? "absolute top-16 left-0 w-full bg-green-600 shadow-md flex-col space-x-0 space-y-2 p-4 md:relative md:flex-row md:space-y-0 md:p-0 md:shadow-none" : "hidden md:flex"
        )}>
          {navigationItems
            .filter(item => user?.role && item.allowedRoles.includes(user.role))
            .map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  setIsNavOpen(false);
                  if (item.name === 'Dashboard' && pathname === '/dashboard') {
                    window.location.reload();
                  }
                }}
                className={cn(
                  "flex items-center gap-1 text-sm font-medium transition-colors px-3 py-1.5 rounded-md",
                  pathname === item.href
                    ? "bg-white/20 text-white font-bold hover:bg-white/30"
                    : "text-white/90 hover:text-white"
                )}
              >
                <span>{item.name}</span>
              </Link>
            ))}
        </nav>
      </div>

      {/* User info and logout */}
      <div className="flex items-center gap-1 md:gap-2 lg:gap-4">
        {user && (
          <div className="flex items-center gap-1 md:gap-2 lg:gap-3">
            <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-xs sm:text-sm font-semibold">
                {user.username[0].toUpperCase()}
              </span>
            </div>
            <div className="flex flex-col">
              <p className="text-xs sm:text-sm font-medium text-white truncate max-w-20 sm:max-w-none">{user.username}</p>
              <p className="text-xs text-white/80 capitalize truncate max-w-20 sm:max-w-none">{user.role}</p>
            </div>
          </div>
        )}
        <Button 
          variant="secondary" 
          size="sm"
          onClick={handleLogout} 
          className="bg-gray-100 hover:bg-gray-200 text-green-600 transition-colors px-1 sm:px-2 md:px-3 py-1 text-xs sm:text-sm"
        >
          <LogOut className="w-3 h-3 sm:w-4 sm:h-4 mr-0 sm:mr-1" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}