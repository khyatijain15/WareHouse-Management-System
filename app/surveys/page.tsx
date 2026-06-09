"use client";

import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useRoleAccess } from '@/hooks/use-role-access';
import {
  ClipboardCheck,
  Building
} from "lucide-react";

const surveyModules = [
  {
    title: "Inspection Creation",
    icon: ClipboardCheck,
    href: "/surveys/inspection-creation",
    color: "text-blue-500",
    description: "Create and manage inspection surveys"
  },
  {
    title: "Warehouse Creation",
    icon: Building,
    href: "/surveys/warehouse-creation",
    color: "text-green-500",
    description: "Set up new warehouse facilities"
  }
];

export default function SurveysPage() {
  const router = useRouter();
  const { userRole, canAccess } = useRoleAccess();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header with Back Button and Centered Title */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4 w-full sm:w-auto">
            <button 
              onClick={() => router.push('/dashboard')}
              className="inline-block text-base sm:text-lg font-semibold tracking-tight bg-orange-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-md hover:bg-orange-600 transition-colors whitespace-nowrap"
            >
              ← Dashboard
            </button>
          </div>
          
          {/* Centered Title with Light Orange Background */}
          <div className="flex-1 text-center w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-orange-600 inline-block border-b-4 border-green-500 pb-2 px-4 sm:px-6 py-2 sm:py-3 bg-orange-100 rounded-lg">
              Survey
            </h1>
            {userRole === 'maker' && (
          <div className=""></div>
              // <div className="mt-2 inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              //   Maker Role - Create & Edit Surveys
              // </div>
            )}
          </div>
          
          {/* Role info */}
          <div className="w-full sm:w-32 text-center sm:text-right">
            <div className="text-sm text-gray-600">
              Role: <span className="font-semibold capitalize">{userRole}</span>
            </div>
          </div>
        </div>
        
        {/* Survey Module Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {surveyModules.map((module) => {
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
        <div className="mt-8 p-4 sm:p-6 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">i</span>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-blue-900">Survey Management</h4>
              <p className="text-xs sm:text-sm text-blue-700 mt-1">
                Create and manage warehouse surveys including inspections and facility setup. 
                Use these tools to maintain quality standards and operational efficiency.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}