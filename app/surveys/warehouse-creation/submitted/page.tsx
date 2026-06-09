"use client";

import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Download,
  Eye,
  Search,
  X,
  ArrowLeft,
  CheckCircle,
  XCircle,
  RotateCcw
} from "lucide-react";
import BlinkingSirenIcon from '@/components/BlinkingSirenIcon';
import { DataTable } from '@/components/data-table';
import type { Row } from '@tanstack/react-table';
import WarehouseInspectionForm from '../inspection-form';

// Interface for inspection data
interface InspectionData {
  id: string;
  inspectionCode: string;
  warehouseCode: string;
  state: string;
  branch: string;
  location: string;
  businessType: string;
  warehouseStatus: string;
  warehouseName?: string;
  bankState: string;
  bankBranch: string;
  bankName: string;
  ifscCode: string;
  receiptType: string;
  createdAt: string | number | Date | null;
  warehouseInspectionData?: any;
  status?: string;
}

// Insurance expiry check function
function getInsuranceAlertStatus(inspection: InspectionData): 'none' | 'expiring' | 'expired' {
  const insuranceEntries = inspection.warehouseInspectionData?.insuranceEntries || [];
  if (insuranceEntries.length === 0) return 'none';

  const today = new Date();
  let hasExpired = false;

  insuranceEntries.forEach((insurance: any) => {
    [insurance.firePolicyEndDate, insurance.burglaryPolicyEndDate].forEach((date: any) => {
      if (date) {
        const endDate = new Date(date);
        if (endDate < today) {
          hasExpired = true;
        }
      }
    });
  });

  return hasExpired ? 'expired' : 'none';
}

// Robust date parser: handles Date, ISO strings, numeric timestamps (s or ms),
// and Firestore Timestamp objects (with toDate() or seconds).
function parseToDate(value: any): Date | null {
  if (!value && value !== 0) return null;
  // Firestore Timestamp with toDate()
  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }

  // Firestore-like object with seconds
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }

  // Date instance
  if (value instanceof Date) return value;

  // Numeric timestamp (seconds or milliseconds)
  if (typeof value === 'number') {
    // If value looks like seconds (<= 1e12), convert to ms
    const asMs = value > 1e12 ? value : value * 1000;
    const d = new Date(asMs);
    return isNaN(d.getTime()) ? null : d;
  }

  // String - try Date parsing
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function formatDateValue(value: any): string {
  const d = parseToDate(value);
  return d ? d.toLocaleDateString() : '';
}

// Define columns for DataTable
const submittedColumns = [
  {
    accessorKey: "inspectionCode",
    header: "Inspection Code",
    cell: ({ row }: { row: Row<any> }) => (
      <span className="font-bold text-orange-800 w-full flex justify-center">
        {row.getValue("inspectionCode")}
      </span>
    ),
    meta: { align: 'center' },
  },
  {
    accessorKey: "warehouseCode",
    header: "Warehouse Code",
    cell: ({ row }: { row: Row<any> }) => (
      <span className="text-green-700 w-full flex justify-center">
        {row.getValue("warehouseCode")}
      </span>
    ),
    meta: { align: 'center' },
  },
  {
    accessorKey: "state",
    header: "State",
    cell: ({ row }: { row: Row<any> }) => (
      <span className="text-green-700 w-full flex justify-center">
        {row.getValue("state")}
      </span>
    ),
    meta: { align: 'center' },
  },
  {
    accessorKey: "branch",
    header: "Branch",
    cell: ({ row }: { row: Row<any> }) => (
      <span className="text-green-700 w-full flex justify-center">
        {row.getValue("branch")}
      </span>
    ),
    meta: { align: 'center' },
  },
  {
    accessorKey: "location",
    header: "Location",
    cell: ({ row }: { row: Row<any> }) => (
      <span className="text-green-700 w-full flex justify-center">
        {row.getValue("location")}
      </span>
    ),
    meta: { align: 'center' },
  },
  {
    accessorKey: "businessType",
    header: "Business Type",
    cell: ({ row }: { row: Row<any> }) => (
      <span className="text-green-700 w-full flex justify-center">
        {(() => {
          const v = row.getValue("businessType");
          return typeof v === 'string' ? v.toUpperCase() : '-';
        })()}
      </span>
    ),
    meta: { align: 'center' },
  },
  {
    accessorKey: "warehouseName",
    header: "Warehouse Name",
    cell: ({ row }: { row: Row<any> }) => (
      <span className="text-green-700 w-full flex justify-center">
        {row.getValue("warehouseName") || '-'}
      </span>
    ),
    meta: { align: 'center' },
  },
  {
    accessorKey: "bankState",
    header: "Bank State",
    cell: ({ row }: { row: Row<any> }) => (
      <span className="text-green-700 w-full flex justify-center">
        {row.getValue("bankState")}
      </span>
    ),
    meta: { align: 'center' },
  },
  {
    accessorKey: "bankBranch",
    header: "Bank Name",
    cell: ({ row }: { row: Row<any> }) => (
      <span className="text-green-700 w-full flex justify-center">
        {row.getValue("bankBranch")}
      </span>
    ),
    meta: { align: 'center' },
  },
  {
    accessorKey: "bankName",
    header: "Bank Branch",
    cell: ({ row }: { row: Row<any> }) => (
      <span className="text-green-700 w-full flex justify-center">
        {row.getValue("bankName")}
      </span>
    ),
    meta: { align: 'center' },
  },
  {
    accessorKey: "ifscCode",
    header: "IFSC Code",
    cell: ({ row }: { row: Row<any> }) => (
      <span className="text-green-700 w-full flex justify-center">
        {row.getValue("ifscCode")}
      </span>
    ),
    meta: { align: 'center' },
  },
  {
    accessorKey: "receiptType",
    header: "Receipt Type",
    cell: ({ row }: { row: Row<any> }) => (
      <span className="text-green-700 w-full flex justify-center">
        {row.getValue("receiptType")}
      </span>
    ),
    meta: { align: 'center' },
  },
  {
    accessorKey: "createdAt",
    header: "Created Date",
    cell: ({ row }: { row: Row<any> }) => {
      const date = row.getValue("createdAt");
      const formattedDate = formatDateValue(date);
      return (
        <span className="text-green-700 w-full flex justify-center">
          {formattedDate}
        </span>
      );
    },
    meta: { align: 'center' },
  },
  {
    accessorKey: "dateOfInspection",
    header: "Date of Inspection",
    cell: ({ row }: { row: Row<any> }) => {
      const inspection = row.original;
      const inspectionDate = inspection.warehouseInspectionData?.dateOfInspection;
      const formattedDate = formatDateValue(inspectionDate);
      return (
        <span className="text-green-700 w-full flex justify-center">
          {formattedDate || '-'}
        </span>
      );
    },
    meta: { align: 'center' },
  },
  {
    accessorKey: "oeDate",
    header: "OE Date",
    cell: ({ row }: { row: Row<any> }) => {
      const inspection = row.original;
      const oeDate = inspection.warehouseInspectionData?.oeDate;
      const formattedDate = formatDateValue(oeDate);
      return (
        <span className="text-green-700 w-full flex justify-center">
          {formattedDate || '-'}
        </span>
      );
    },
    meta: { align: 'center' },
  },
  {
    accessorKey: "remarks",
    header: "Remarks",
    cell: ({ row }: { row: Row<any> }) => {
      const inspection = row.original;
      const remarks = inspection.warehouseInspectionData?.remarks || '';
      return (
        <div className="w-full flex justify-center">
          <div className="max-w-xs truncate" title={remarks}>
            {remarks || '-'}
          </div>
        </div>
      );
    },
    meta: { align: 'center' },
  },
  {
    accessorKey: "actions",
    header: "Actions",
    cell: ({ row }: { row: Row<any> }) => {
      const inspection = row.original;
      const insuranceStatus = getInsuranceAlertStatus(inspection);
      
      return (
        <div className="flex space-x-2 justify-center items-center">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              const event = new CustomEvent('viewSubmittedDetails', { detail: inspection });
              document.dispatchEvent(event);
            }}
            className="border-blue-300 text-blue-600 hover:bg-blue-50"
            title="View/Edit Details"
          >
            <Eye className="w-4 h-4" />
          </Button>
          {insuranceStatus === 'expired' && (
            <div title="Insurance Expired">
              <BlinkingSirenIcon color="red" size={20} />
            </div>
          )}
        </div>
      );
    },
    meta: { align: 'center' },
  },
];

export default function SubmittedWarehousePage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [inspections, setInspections] = useState<InspectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInspection, setSelectedInspection] = useState<InspectionData | null>(null);
  const [showInspectionForm, setShowInspectionForm] = useState(false);
  
  // Resubmission dialog states
  const [showResubmissionDialog, setShowResubmissionDialog] = useState(false);
  const [resubmissionRemarks, setResubmissionRemarks] = useState('');
  const [resubmissionInspection, setResubmissionInspection] = useState<InspectionData | null>(null);
  const [isSubmittingResubmission, setIsSubmittingResubmission] = useState(false);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('all-states');
  const [branchFilter, setBranchFilter] = useState('all-branches');
  const [businessTypeFilter, setBusinessTypeFilter] = useState('all-types');

  // Load inspections data
  const loadInspections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const querySnapshot = await getDocs(collection(db, 'inspections'));
      const inspectionData: InspectionData[] = [];
      
      console.log('Loading submitted inspections, total docs:', querySnapshot.size);
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Only include inspections with 'submitted' status
        if (data.status === 'submitted') {
          inspectionData.push({
            id: doc.id,
            inspectionCode: data.inspectionCode || '',
            warehouseCode: data.warehouseCode || '',
            state: data.state || '',
            branch: data.branch || '',
            location: data.location || '',
            businessType: data.businessType || '',
            warehouseStatus: data.warehouseStatus || '',
            warehouseName: data.warehouseName || '',
            bankState: data.bankState || '',
            bankBranch: data.bankBranch || '',
            bankName: data.bankName || '',
            ifscCode: data.ifscCode || '',
            receiptType: data.receiptType || '',
            createdAt: data.createdAt || '',
            warehouseInspectionData: data.warehouseInspectionData || {},
            status: data.status
          });
        }
      });
      
      console.log('Found submitted inspections:', inspectionData.length);
      setInspections(inspectionData);
    } catch (error) {
      console.error('Error loading inspections:', error);
      setError('Failed to load inspections');
      toast({
        title: "Error",
        description: "Failed to load inspections",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Load data on component mount
  useEffect(() => {
    loadInspections();
    
    // Add event listeners for actions and cross-module reflection
    const handleInspectionUpdate = (event: CustomEvent) => {
      if (event.detail && event.detail.source !== 'submitted-warehouse') {
        loadInspections();
      }
    };
    
    const handleViewDetails = (event: CustomEvent) => {
      setSelectedInspection(event.detail);
      setShowInspectionForm(true);
    };

    const handleActivateWarehouse = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const inspection = customEvent.detail;
      
      // Validate insurance before activation
      const validateInsurance = (warehouseData: any) => {
        const missingFields: string[] = [];
        
        // Check if at least one insurance entry exists (NEW CHECKBOX-BASED SYSTEM)
        if (!warehouseData.insuranceEntries || warehouseData.insuranceEntries.length === 0) {
          missingFields.push('At least one insurance must be selected');
          return missingFields;
        }

        // Validate each insurance entry
        warehouseData.insuranceEntries.forEach((insurance: any, index: number) => {
          // Only validate that insuranceTakenBy is present
          // Since insurances come from master data, they should already have all required fields
          if (!insurance.insuranceTakenBy) {
            missingFields.push(`Insurance ${index + 1}: Insurance Taken By field is missing`);
          }
        });

        return missingFields;
      };

      try {
        // Check if warehouse has proper insurance details
        const warehouseData = inspection.warehouseInspectionData || inspection;
        const missingInsuranceFields = validateInsurance(warehouseData);
        
        if (missingInsuranceFields.length > 0) {
          toast({
            title: "Cannot Activate Warehouse",
            description: `Missing insurance details: ${missingInsuranceFields.join(', ')}. Please complete the insurance information before activation.`,
            variant: "destructive",
          });
          return;
        }
        
        // If validation passes, proceed with activation
        console.log('Activating warehouse:', inspection);
        
        // Update the warehouse status to 'activated' in the database
        const inspectionRef = doc(db, 'inspections', inspection.id);
        await updateDoc(inspectionRef, {
          status: 'activated',
          activatedAt: new Date().toISOString(),
          activatedBy: 'checker' // You might want to add actual user info here
        });
        
        toast({
          title: "Warehouse Activated",
          description: `Warehouse ${inspection.warehouseCode} has been activated successfully.`,
        });
        
        // Reload the inspections to reflect the change
        loadInspections();
        
      } catch (error) {
        console.error('Error activating warehouse:', error);
        toast({
          title: "Activation Failed",
          description: "An error occurred while activating the warehouse.",
          variant: "destructive",
        });
      }
    };

    const handleRejectWarehouse = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const inspection = customEvent.detail;
      
      try {
        // Update the warehouse status to 'rejected' in the database
        const inspectionRef = doc(db, 'inspections', inspection.id);
        await updateDoc(inspectionRef, {
          status: 'rejected',
          rejectedAt: new Date().toISOString(),
          rejectedBy: 'checker', // You might want to add actual user info here
          rejectionRemarks: 'Rejected by checker' // You might want to add a dialog for rejection remarks
        });
        
        toast({
          title: "Warehouse Rejected",
          description: `Warehouse ${inspection.warehouseCode} has been rejected.`,
        });
        
        // Reload the inspections to reflect the change
        loadInspections();
        
      } catch (error) {
        console.error('Error rejecting warehouse:', error);
        toast({
          title: "Rejection Failed",
          description: "An error occurred while rejecting the warehouse.",
          variant: "destructive",
        });
      }
    };

    const handleResubmitWarehouse = (event: CustomEvent) => {
      const inspection = event.detail;
      setResubmissionInspection(inspection);
      setResubmissionRemarks('');
      setShowResubmissionDialog(true);
    };
    
    window.addEventListener('inspectionDataUpdated', handleInspectionUpdate as EventListener);
    document.addEventListener('viewSubmittedDetails', handleViewDetails as EventListener);
    document.addEventListener('activateWarehouse', handleActivateWarehouse as EventListener);
    document.addEventListener('rejectWarehouse', handleRejectWarehouse as EventListener);
    document.addEventListener('resubmitWarehouse', handleResubmitWarehouse as EventListener);
    
    return () => {
      window.removeEventListener('inspectionDataUpdated', handleInspectionUpdate as EventListener);
      document.removeEventListener('viewSubmittedDetails', handleViewDetails as EventListener);
      document.removeEventListener('activateWarehouse', handleActivateWarehouse as EventListener);
      document.removeEventListener('rejectWarehouse', handleRejectWarehouse as EventListener);
      document.removeEventListener('resubmitWarehouse', handleResubmitWarehouse as EventListener);
    };
  }, [loadInspections, toast]);

  // Filter and sort inspections data
  const filteredAndSortedInspections = useMemo(() => {
    let filtered = [...inspections];
    
    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(inspection => 
        inspection.inspectionCode.toLowerCase().includes(searchLower) ||
        inspection.warehouseCode.toLowerCase().includes(searchLower) ||
        inspection.state.toLowerCase().includes(searchLower) ||
        inspection.branch.toLowerCase().includes(searchLower) ||
        inspection.location.toLowerCase().includes(searchLower) ||
        (typeof inspection.businessType === 'string' && inspection.businessType.toLowerCase().includes(searchLower)) ||
        (inspection.warehouseName && inspection.warehouseName.toLowerCase().includes(searchLower)) ||
        inspection.bankState.toLowerCase().includes(searchLower) ||
        inspection.bankBranch.toLowerCase().includes(searchLower) ||
        inspection.bankName.toLowerCase().includes(searchLower) ||
        inspection.ifscCode.toLowerCase().includes(searchLower) ||
        inspection.receiptType.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply filters
    if (stateFilter && stateFilter !== 'all-states') {
      filtered = filtered.filter(inspection => inspection.state === stateFilter);
    }
    if (branchFilter && branchFilter !== 'all-branches') {
      filtered = filtered.filter(inspection => inspection.branch === branchFilter);
    }
    if (businessTypeFilter && businessTypeFilter !== 'all-types') {
      filtered = filtered.filter(inspection => inspection.businessType === businessTypeFilter);
    }
    
    // Sort by inspection code in ascending order
    filtered.sort((a, b) => a.inspectionCode.localeCompare(b.inspectionCode));

    return filtered;
  }, [inspections, searchTerm, stateFilter, branchFilter, businessTypeFilter]);

  // Get unique values for filter dropdowns
  const uniqueStates = useMemo(() => 
    Array.from(new Set(inspections.map(i => i.state).filter(Boolean)))
  , [inspections]);
  
  const uniqueBranches = useMemo(() => 
    Array.from(new Set(inspections.map(i => i.branch).filter(Boolean)))
  , [inspections]);
  
  const uniqueBusinessTypes = useMemo(() => 
    Array.from(new Set(
      inspections
        .map(i => (typeof i.businessType === 'string' ? i.businessType : ''))
        .filter(Boolean)
    ))
  , [inspections]);

  // Export to CSV function
  const exportToCSV = () => {
    const dataToExport = filteredAndSortedInspections;
    
    if (dataToExport.length === 0) {
      toast({
        title: "No Data",
        description: "No submitted inspections available to export",
        variant: "destructive",
      });
      return;
    }
    
    const headers = [
      'Inspection Code',
      'Warehouse Code', 
      'State',
      'Branch',
      'Location',
      'Business Type',
      'Warehouse Name',
      'Bank State',
      'Bank Name',
      'Bank Branch',
      'IFSC Code',
      'Receipt Type',
      'Created Date',
      'Date of Inspection',
      'OE Date',
      'Remarks'
    ];

    // Sort by inspection code in ascending order
    const sortedData = [...dataToExport].sort((a, b) => a.inspectionCode.localeCompare(b.inspectionCode));
    
    const csvData = sortedData.map(inspection => {
        const createdD = parseToDate(inspection.createdAt);
        const doiD = parseToDate(inspection.warehouseInspectionData?.dateOfInspection);
        const oeD = parseToDate(inspection.warehouseInspectionData?.oeDate);

        return [
          inspection.inspectionCode,
          inspection.warehouseCode,
          inspection.state,
          inspection.branch,
          inspection.location,
          (typeof inspection.businessType === 'string' ? inspection.businessType.toUpperCase() : ''),
          inspection.warehouseName || '',
          inspection.bankState,
          inspection.bankBranch,
          inspection.bankName,
          inspection.ifscCode,
          inspection.receiptType,
          // createdAt in ISO YYYY-MM-DD
          createdD ? createdD.toISOString().split('T')[0] : '',
          // Date of Inspection
          doiD ? doiD.toISOString().split('T')[0] : '',
          // OE Date
          oeD ? oeD.toISOString().split('T')[0] : '',
          inspection.warehouseInspectionData?.remarks || ''
        ];
    });

    // Create CSV content without extra blank rows
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    const filename = `submitted_warehouses_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: `${dataToExport.length} submitted warehouses exported to CSV`,
    });
  };

  // Handle status change
  const handleStatusChange = () => {
    setShowInspectionForm(false);
    setSelectedInspection(null);
    loadInspections();
    
    // Dispatch event for cross-module reflection
    window.dispatchEvent(new CustomEvent('inspectionDataUpdated', { 
      detail: { source: 'submitted-warehouse', action: 'statusChange' } 
    }));
  };

  // Handle the actual resubmission with remarks
  const handleSubmitResubmission = async () => {
    if (!resubmissionInspection || !resubmissionRemarks.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter remarks for resubmission.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingResubmission(true);

    try {
      // Update the warehouse status to 'resubmitted' and add checker remarks
      // CRITICAL: Preserve all existing inspection data including insurance
      const inspectionRef = doc(db, 'inspections', resubmissionInspection.id);
      await updateDoc(inspectionRef, {
        status: 'resubmitted',
        checkerRemarks: resubmissionRemarks.trim(),
        resubmissionRequestedAt: new Date().toISOString(),
        resubmissionRequestedBy: 'checker', // You might want to add actual user info here
        // CRITICAL FIX: Preserve all existing warehouse inspection data
        // This ensures insurance data and all other form data is not lost
        warehouseInspectionData: {
          ...resubmissionInspection.warehouseInspectionData,
          status: 'resubmitted',
          lastUpdated: new Date().toISOString()
        }
      });

      toast({
        title: "Resubmission Requested",
        description: `Warehouse ${resubmissionInspection.warehouseCode} has been moved to resubmitted section with your remarks.`,
        variant: "default",
      });

      // Close dialog and reset states
      setShowResubmissionDialog(false);
      setResubmissionInspection(null);
      setResubmissionRemarks('');

      // Reload inspections to reflect the change
      loadInspections();
      
      // Dispatch event for cross-module reflection
      window.dispatchEvent(new CustomEvent('inspectionDataUpdated', { 
        detail: { source: 'submitted-warehouse', action: 'resubmit', inspectionId: resubmissionInspection.id } 
      }));

    } catch (error) {
      console.error('Error requesting resubmission:', error);
      toast({
        title: "Resubmission Failed",
        description: "There was an error processing the resubmission request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingResubmission(false);
    }
  };

  // Handle canceling resubmission dialog
  const handleCancelResubmission = () => {
    setShowResubmissionDialog(false);
    setResubmissionInspection(null);
    setResubmissionRemarks('');
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm('');
    setStateFilter('all-states');
    setBranchFilter('all-branches');
    setBusinessTypeFilter('all-types');
  };

  const hasActiveFilters = searchTerm || 
    (stateFilter && stateFilter !== 'all-states') || 
    (branchFilter && branchFilter !== 'all-branches') || 
    (businessTypeFilter && businessTypeFilter !== 'all-types');

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-8">
        {/* Header with Dashboard Button and Centered Title */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4 w-full sm:w-auto">
            <button 
              onClick={() => router.push('/surveys/warehouse-creation')}
              className="inline-flex items-center text-base sm:text-lg font-semibold whitespace-nowrap tracking-tight bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Warehouse Creation
            </button>
          </div>
          
          {/* Centered Title with Light Orange Background */}
          <div className="flex-1 text-center w-full sm:w-auto">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-orange-600 inline-block border-b-4 border-green-500 pb-2 px-4 sm:px-6 py-2 sm:py-3 bg-orange-100 rounded-lg">
              Submitted Warehouses ({inspections.length})
            </h1>
          </div>
          
          {/* Export Button */}
          <div className="w-full sm:w-auto">
            {filteredAndSortedInspections.length > 0 && (
              <Button 
                onClick={exportToCSV}
                className="bg-blue-500 hover:bg-blue-600 text-white w-full sm:w-auto text-sm whitespace-nowrap"
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            )}
          </div>
        </div>

        {/* Search and Filter Section */}
        <Card className="border-green-300">
          <CardHeader className="bg-green-50 p-4">
            <CardTitle className="text-base sm:text-lg text-green-700">Search & Filter</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 space-y-4">
            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by inspection code, warehouse code, state, branch, location, business type, warehouse name, bank details..."
                  className="border-green-300 focus:border-green-500 pl-10"
              />
              </div>
              {hasActiveFilters && (
              <Button
                  onClick={clearAllFilters}
                variant="outline"
                size="sm"
                  className="border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                  <X className="w-4 h-4 mr-1" />
                  Clear All
              </Button>
              )}
            </div>

            {/* Filter Dropdowns */}
            {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-green-600 font-medium">State</Label>
                <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger className="border-green-300">
                      <SelectValue placeholder="All States" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-states">All States</SelectItem>
                      {uniqueStates.map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              <div className="space-y-2">
                <Label className="text-green-600 font-medium">Branch</Label>
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                    <SelectTrigger className="border-green-300">
                      <SelectValue placeholder="All Branches" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-branches">All Branches</SelectItem>
                      {uniqueBranches.map(branch => (
                        <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              <div className="space-y-2">
                <Label className="text-green-600 font-medium">Business Type</Label>
                <Select value={businessTypeFilter} onValueChange={setBusinessTypeFilter}>
                    <SelectTrigger className="border-green-300">
                    <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="all-types">All Types</SelectItem>
                      {uniqueBusinessTypes.map(type => (
                        <SelectItem key={type} value={type}>{type.toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                </div> */}

            {/* Entry Count */}
            <div className="text-sm text-green-600">
              {hasActiveFilters ? (
                <span className="font-medium">
                  {filteredAndSortedInspections.length} of {inspections.length} entries found
                  {searchTerm && ` for "${searchTerm}"`}
                </span>
              ) : (
                <span className="font-medium">
                  Total Entries: {inspections.length}
                </span>
              )}
              </div>
          </CardContent>
        </Card>

        {/* Inspections Table */}
        {loading ? (
          <Card className="border-green-300">
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading submitted warehouses...</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-red-300">
            <CardContent className="p-8 text-center text-red-600">
              <p>{error}</p>
              <Button 
                onClick={loadInspections} 
                className="mt-4"
                variant="outline"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-green-300">
            <CardHeader className="bg-green-50">
              <CardTitle className="text-green-700">
                Submitted Warehouse Inspections
                {hasActiveFilters && (
                  <span className="text-sm font-normal text-green-600 ml-2">
                    (Filtered: {filteredAndSortedInspections.length} of {inspections.length})
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-green-600">
                All submitted warehouse inspection surveys sorted by inspection code in ascending order.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <DataTable
                columns={submittedColumns}
                data={filteredAndSortedInspections}
                wrapperClassName="border-green-300"
                headClassName="bg-orange-100 text-orange-600 font-bold text-center text-xs sm:text-sm"
                cellClassName="text-green-800 text-center text-xs sm:text-sm"
                stickyHeader={true}
                stickyFirstColumn={true}
                showGridLines={true}
                isLoading={loading}
                error={error || undefined}
              />
            </CardContent>
          </Card>
        )}

        {/* Inspection Form Dialog */}
        <Dialog open={showInspectionForm} onOpenChange={(open) => {
          if (!open) {
            setShowInspectionForm(false);
            setSelectedInspection(null);
          }
        }}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-green-700">
                Warehouse Inspection Details - {selectedInspection?.inspectionCode}
              </DialogTitle>
            </DialogHeader>
            {selectedInspection && (
              <WarehouseInspectionForm
                onClose={() => {
                  setShowInspectionForm(false);
                  setSelectedInspection(null);
                }}
                initialData={selectedInspection}
                mode="edit"
                onStatusChange={handleStatusChange}
                // Pass action handlers for submitted status
                onActivate={async () => {
                  const event = new CustomEvent('activateWarehouse', { detail: selectedInspection });
                  document.dispatchEvent(event);
                  setShowInspectionForm(false);
                  setSelectedInspection(null);
                }}
                onReject={async () => {
                  const event = new CustomEvent('rejectWarehouse', { detail: selectedInspection });
                  document.dispatchEvent(event);
                  setShowInspectionForm(false);
                  setSelectedInspection(null);
                }}
                onResubmit={async () => {
                  const event = new CustomEvent('resubmitWarehouse', { detail: selectedInspection });
                  document.dispatchEvent(event);
                  setShowInspectionForm(false);
                  setSelectedInspection(null);
                }}
                showSubmittedActions={true}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Resubmission Dialog */}
        <Dialog open={showResubmissionDialog} onOpenChange={(open) => {
          if (!open) {
            handleCancelResubmission();
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-purple-700">
                Request Resubmission
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Warehouse Code: <span className="font-bold text-purple-600">
                    {resubmissionInspection?.warehouseCode}
                  </span>
                </Label>
                <Label className="text-sm font-medium text-gray-700">
                  Inspection Code: <span className="font-bold text-purple-600">
                    {resubmissionInspection?.inspectionCode}
                  </span>
                </Label>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="resubmissionRemarks" className="text-sm font-medium text-gray-700">
                  Remarks for Resubmission <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="resubmissionRemarks"
                  value={resubmissionRemarks}
                  onChange={(e) => setResubmissionRemarks(e.target.value)}
                  placeholder="Enter the reason for requesting resubmission and specific issues that need to be addressed..."
                  className="min-h-[120px] border-purple-300 focus:border-purple-500"
                  maxLength={500}
                />
                <div className="text-xs text-gray-500 text-right">
                  {resubmissionRemarks.length}/500 characters
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleCancelResubmission}
                  disabled={isSubmittingResubmission}
                  className="border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitResubmission}
                  disabled={isSubmittingResubmission || !resubmissionRemarks.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isSubmittingResubmission ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Request Resubmission
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
} 