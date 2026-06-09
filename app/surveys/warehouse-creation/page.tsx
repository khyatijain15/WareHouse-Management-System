"use client";

import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRoleAccess } from '@/hooks/use-role-access';
import {
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  RotateCcw,
  Archive,
  RefreshCw
} from "lucide-react";

export default function WarehouseCreationPage() {
  const router = useRouter();
  const { userRole, canAccessSurveyTab, getSurveyTabMode } = useRoleAccess();
  const [statusCounts, setStatusCounts] = useState({
    pending: 0,
    submitted: 0,
    activated: 0,
    rejected: 0,
    resubmitted: 0,
    closed: 0,
    reactivate: 0
  });

  // Load status counts
  useEffect(() => {
    const loadStatusCounts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'inspections'));
        const counts = {
          pending: 0,
          submitted: 0,
          activated: 0,
          rejected: 0,
          resubmitted: 0,
          closed: 0,
          reactivate: 0
        };

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const status = data.status || 'pending';
          if (counts.hasOwnProperty(status)) {
            counts[status as keyof typeof counts]++;
          }
        });

        setStatusCounts(counts);
      } catch (error) {
        console.error('Error loading status counts:', error);
      }
    };

    loadStatusCounts();

    // Add event listener for cross-module updates
    const handleInspectionUpdate = () => {
      loadStatusCounts();
    };

    window.addEventListener('inspectionDataUpdated', handleInspectionUpdate);

    return () => {
      window.removeEventListener('inspectionDataUpdated', handleInspectionUpdate);
    };
  }, []);

  const warehouseStatusModules = [
    {
      id: "pending",
      title: "Pending",
      icon: Clock,
      color: "text-yellow-500",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      description: "Warehouses awaiting initial review",
      count: statusCounts.pending
    },
    {
      id: "submitted",
      title: "Submitted",
      icon: FileText,
      color: "text-blue-500",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      description: "Warehouses submitted for approval",
      count: statusCounts.submitted
    },
    {
      id: "activated",
      title: "Activated",
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      description: "Active and operational warehouses",
      count: statusCounts.activated
    },
    {
      id: "rejected",
      title: "Rejected",
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      description: "Warehouses requiring corrections",
      count: statusCounts.rejected
    },
    {
      id: "resubmitted",
      title: "Resubmitted",
      icon: RotateCcw,
      color: "text-purple-500",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      description: "Warehouses resubmitted after corrections",
      count: statusCounts.resubmitted
    },
    {
      id: "closed",
      title: "Closed",
      icon: Archive,
      color: "text-gray-500",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-200",
      description: "Decommissioned warehouse facilities",
      count: statusCounts.closed
    },
    {
      id: "reactivate",
      title: "Reactivate",
      icon: RefreshCw,
      color: "text-teal-500",
      bgColor: "bg-teal-50",
      borderColor: "border-teal-200",
      description: "Warehouses pending reactivation",
      count: statusCounts.reactivate
    }
  ];

  const handleCardClick = (moduleId: string) => {
    // Check if user can access this tab
    if (canAccessSurveyTab(moduleId)) {
      router.push(`/surveys/warehouse-creation/${moduleId}`);
    }
  };

  // Filter tabs based on role permissions
  const getAccessibleTabs = () => {
    return warehouseStatusModules.filter(module => canAccessSurveyTab(module.id));
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-8">
        {/* Header with Back Button and Centered Title */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4 w-full sm:w-auto">
            <button 
              onClick={() => router.push('/surveys')}
              className="inline-block text-base sm:text-lg font-semibold tracking-tight bg-orange-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-md hover:bg-orange-600 transition-colors whitespace-nowrap"
            >
              ← Dashboard
            </button>
          </div>
          
          {/* Centered Title with Light Orange Background */}
          <div className="flex-1 text-center w-full sm:w-auto">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-orange-600 inline-block border-b-4 border-green-500 pb-2 px-4 sm:px-6 py-2 sm:py-3 bg-orange-100 rounded-lg">
              Warehouse Creation
            </h1>
            {userRole === 'checker' && (
            <div></div>
            )}
            {userRole === 'maker' && (
               <div></div>
            )}
            {userRole === 'admin' && (
             <div></div>
            )}
          </div>
          
          {/* Empty space for layout balance */}
          <div className="flex space-x-2">
            {/* Removed Add New Warehouse button */}
          </div>
        </div>
        
        {/* Warehouse Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {getAccessibleTabs().map((module) => {
            const Icon = module.icon;
            return (
              <Card 
                key={module.title} 
                className={`hover:shadow-lg transition-all duration-300 cursor-pointer ${module.bgColor} hover:bg-opacity-80 rounded-lg ${module.borderColor} border-2 h-full ${
                  getSurveyTabMode(module.id) === 'view' ? 'opacity-75' : ''
                }`}
                onClick={() => handleCardClick(module.id)}
              >
                <CardContent className="p-4 sm:p-6 flex flex-col items-center justify-center space-y-3 sm:space-y-4 text-center h-full">
                  <div className="p-2 sm:p-3 rounded-lg bg-white shadow-sm">
                    <Icon className={`w-6 h-6 sm:w-8 sm:h-8 ${module.color}`} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 border-b border-gray-300 pb-1">
                      {module.title}
                      {getSurveyTabMode(module.id) === 'view' && (
                        <span className="ml-2 text-xs text-gray-500 font-normal">(Read Only)</span>
                      )}
                    </h3>
                    <div className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${module.color} ${module.bgColor} border ${module.borderColor}`}>
                      {module.count} Warehouses
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

        {/* Role-specific guidance */}
        {userRole === 'checker' && (
          <div className="mt-4 sm:mt-8 p-4 sm:p-6 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-green-900">Checker Permissions</h4>
                <div className="text-sm text-green-700 mt-2 space-y-1">
                  <p><strong>Full Access:</strong> Activated, Closed, Reactivate tabs - Approve, Reject, Resubmit actions available</p>
                  <p><strong>Read Only:</strong> Pending, Rejected, Resubmitted tabs - View only, no editing allowed</p>
                  <p><strong>Special:</strong> Insurance functions available in full access tabs</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Additional Info Section */}
        <div className="mt-4 sm:mt-8 p-4 sm:p-6 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">i</span>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-blue-900">Warehouse Management</h4>
              <p className="text-sm text-blue-700 mt-1">
                Manage warehouse facilities across different stages of their lifecycle. 
                Track status from initial creation through activation and eventual closure.
                {getSurveyTabMode('pending') === 'view' && ' Tabs marked as (Read Only) have limited access based on your role.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
} 