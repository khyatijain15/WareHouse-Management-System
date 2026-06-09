"use client";

import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ClipboardCheck,
  Package,
  ArrowLeftRight,
  Truck,
  Box,
  FileText,
  Database
} from "lucide-react";

const reportModules = [

  {
    id: "inward",
    title: "Stock Reports",
    icon: Package,
    color: "text-yellow-500",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    description: "Generate reports for inward transactions",
    count: "View Reports"
  },
  {
    id: "outward",
    title: "Outward Reports",
    icon: Box,
    color: "text-orange-500",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    description: "Generate reports for outward transactions, deliveries, and stock releases",
    count: "View Reports"
  },
  {
    id: "release-order",
    title: "Release Order Reports",
    icon: ArrowLeftRight,
    color: "text-purple-500",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    description: "25-column comprehensive release order report with all parameters from RO section",
    count: "View Reports"
  },
  {
    id: "delivery-order",
    title: "Delivery Order Reports",
    icon: Truck,
    color: "text-pink-500",
    bgColor: "bg-pink-50",
    borderColor: "border-pink-200",
    description: "21-column comprehensive delivery order report with all parameters from DO section",
    count: "View Reports"
  },
  {
    id: "insurance",
    title: "Insurance Reports",
    icon: FileText,
    color: "text-red-500",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    description: "Generate reports for insurance policies, coverage, and claims",
    count: "View Reports"
  },
  {
    id: "detailed-inward",
    title: "Detailed Inward Report",
    icon: Package,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    description: "23-column comprehensive detailed inward report with all parameters from inward section",
    count: "View Reports"
  },
  
 
];

export default function ReportsPage() {
  const router = useRouter();

  const handleCardClick = (moduleId: string) => {
    router.push(`/reports/${moduleId}`);
  };

  return (
    <DashboardLayout>
      {/* Constrain width & add responsive horizontal padding similar to inward page */}
      <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header with Back Button and Centered Title */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center justify-between md:justify-start w-full md:w-auto">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-lg font-semibold tracking-tight bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 transition-colors w-full md:w-auto"
            >
              ← Dashboard
            </button>
          </div>

          {/* Centered Title with Logo and Light Orange Background */}
          <div className="flex-1 text-center flex flex-col items-center">
            <div className="w-36 h-10 relative mb-3 bg-white rounded-lg px-2 py-1">
              {/* Logo placeholder */}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-orange-600 inline-block border-b-4 border-green-500 pb-2 px-4 sm:px-6 py-3 bg-orange-100 rounded-lg w-full md:w-auto">
              Reports & Analytics
            </h1>
          </div>

          {/* Right side future actions area */}
          <div className="flex space-x-2 justify-center md:justify-end">
            {/* Reserved for future quick actions */}
          </div>
        </div>

        {/* Report Module Cards */}
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {reportModules.map((module) => {
            const Icon = module.icon;
            return (
              <Card 
                key={module.title} 
                className={`hover:shadow-lg transition-all duration-300 cursor-pointer ${module.bgColor} hover:bg-opacity-80 rounded-lg ${module.borderColor} border-2 h-full`}
                onClick={() => handleCardClick(module.id)}
              >
                <CardContent className="p-4 sm:p-6 flex flex-col items-center justify-center space-y-4 text-center h-full">
                  <div className="p-3 rounded-lg bg-white shadow-sm">
                    <Icon className={`w-8 h-8 ${module.color}`} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 border-b border-gray-300 pb-1">
                      {module.title}
                    </h3>
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${module.color} ${module.bgColor} border ${module.borderColor}`}>
                      {module.count}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {module.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Additional Info Section */}
        <div className="mt-4 sm:mt-8 p-4 sm:p-6 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">i</span>
              </div>
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-medium text-green-900">Report Generation</h4>
              <p className="text-xs sm:text-sm text-green-700 mt-1 leading-relaxed">
                Access comprehensive reports and analytics for all warehouse operations. 
                Generate detailed insights for inward, outward, release orders, delivery orders, and insurance data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
