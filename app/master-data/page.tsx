"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import {
  Users,
  Package,
  Building2,
  MapPin
} from "lucide-react";

const masterDataModules = [
  {
    title: "Client Module",
    icon: Users,
    href: "/master-data/clients",
    color: "text-blue-500",
    description: "Manage client information and profiles"
  },
  {
    title: "Commodity Module",
    icon: Package,
    href: "/master-data/commodities",
    color: "text-green-500",
    description: "Manage commodity types and specifications"
  },
  {
    title: "Bank Module",
    icon: Building2,
    href: "/master-data/banks",
    color: "text-purple-500",
    description: "Manage bank information and details"
  },
  {
    title: "Branch & Location Module",
    icon: MapPin,
    href: "/master-data/branch",
    color: "text-orange-500",
    description: "Manage branch and location data"
  },
  {
    title: "Reservation + Billing",
    icon: Building2,
    href: "/master-data/reservation-billing",
    color: "text-pink-500",
    description: "Manage reservation and billing rates"
  },
  {
    title: "Insurance Master",
    icon: Package,
    href: "/master-data/insurance-master",
    color: "text-yellow-500",
    description: "Manage insurance master rates and details"
  },
];

export default function MasterDataPage() {
  const { user } = useAuth();
  const router = useRouter();

  // No role-based restrictions for master data access

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-8">
        {/* Header with Back Button and Centered Title */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <button 
            onClick={() => router.push('/dashboard')}
            className="text-base sm:text-lg font-semibold tracking-tight bg-orange-500 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-orange-600 transition-colors whitespace-nowrap w-full sm:w-auto"
          >
            ← Dashboard
          </button>
          
          {/* Centered Title with Light Orange Background */}
          <div className="flex-1 text-center w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-orange-600 inline-block border-b-4 border-green-500 pb-2 px-4 sm:px-6 py-2 sm:py-3 bg-orange-100 rounded-lg">
              Master Data
            </h1>
          </div>
          
          {/* Empty div for spacing */}
          <div className="hidden sm:block sm:w-32"></div>
        </div>
        
        {/* Master Data Module Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {masterDataModules.map((module) => {
            const Icon = module.icon;
            return (
              <Link key={module.title} href={module.href} className="w-full">
                <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 h-full">
                  <CardContent className="p-4 sm:p-6 flex flex-col items-center justify-center space-y-3 sm:space-y-4 text-center h-full">
                    <div className="p-2 sm:p-3 rounded-lg bg-white shadow-sm">
                      <Icon className={`w-6 h-6 sm:w-8 sm:h-8 ${module.color}`} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xs sm:text-sm font-semibold text-gray-900 border-b border-gray-300 pb-1">
                        {module.title}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {module.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Additional Info Section */}
        <div className="mt-4 sm:mt-8 p-4 sm:p-6 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">i</span>
              </div>
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-medium text-blue-900">Master Data Management</h4>
              <p className="text-xs sm:text-sm text-blue-700 mt-1">
                Configure and manage essential warehouse data including clients, commodities, banking information, and location details. 
                These modules form the foundation of your warehouse management system.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}