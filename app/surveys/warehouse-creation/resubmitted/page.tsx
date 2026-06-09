"use client";

import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { useRoleAccess } from '@/hooks/use-role-access';
import {
  RotateCcw,
  Download,
  Eye,
  Search,
  X,
  ArrowLeft,
  FileText,
  AlertCircle,
  Send
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
  createdAt: string;
  warehouseInspectionData?: any;
  status?: string;
  resubmissionRemarks?: string;
  checkerRemarks?: string;
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

// Define columns for DataTable
const resubmittedColumns = [
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
      const formattedDate = (typeof date === 'string' || typeof date === 'number' || date instanceof Date)
        ? new Date(date).toLocaleDateString()
        : '';
      return (
        <span className="text-green-700 w-full flex justify-center">
          {formattedDate}
        </span>
      );
    },
    meta: { align: 'center' },
  },
  {
    accessorKey: "checkerRemarks",
    header: "Checker Remarks",
    cell: ({ row }: { row: Row<any> }) => {
      const inspection = row.original;
      const remarks = inspection.checkerRemarks || inspection.resubmissionRemarks || '';
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
              const event = new CustomEvent('viewResubmittedDetails', { detail: inspection });
              document.dispatchEvent(event);
            }}
            className="border-blue-300 text-blue-600 hover:bg-blue-50"
            title="View/Edit Details"
          >
            <Eye className="w-4 h-4" />
          </Button>
          {/* <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              const event = new CustomEvent('viewCheckerRemarks', { detail: inspection });
              document.dispatchEvent(event);
            }}
            className="border-purple-300 text-purple-600 hover:bg-purple-50"
            title="View Checker Remarks"
          >
            <AlertCircle className="w-4 h-4" />
          </Button> */}
          {/* Submit button moved to the inspection form dialog (end of form) */}
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

export default function ResubmittedWarehousePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { getSurveyTabMode } = useRoleAccess();
  
  const [inspections, setInspections] = useState<InspectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInspection, setSelectedInspection] = useState<InspectionData | null>(null);
  const [showInspectionForm, setShowInspectionForm] = useState(false);
  
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
      
      console.log('Loading resubmitted inspections, total docs:', querySnapshot.size);
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Only include inspections with 'resubmitted' status
        if (data.status === 'resubmitted') {
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
            status: data.status,
            resubmissionRemarks: data.resubmissionRemarks || '',
            checkerRemarks: data.checkerRemarks || ''
          });
        }
      });
      
      console.log('Found resubmitted inspections:', inspectionData.length);
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
      if (event.detail && event.detail.source !== 'resubmitted-warehouse') {
        loadInspections();
      }
    };
    
    const handleViewDetails = (event: CustomEvent) => {
      setSelectedInspection(event.detail);
      setShowInspectionForm(true);
    };

    const handleViewCheckerRemarks = (event: CustomEvent) => {
      const inspection = event.detail;
      const remarks = inspection.checkerRemarks || inspection.resubmissionRemarks || 'No remarks available';
      
      toast({
        title: "Checker Remarks",
        description: remarks,
        duration: 5000,
      });
    };

    const handleResubmitForm = (event: CustomEvent) => {
      const inspection = event.detail;
      
      // Validate that form has required data before allowing resubmission
      if (!inspection.warehouseInspectionData || Object.keys(inspection.warehouseInspectionData).length === 0) {
        toast({
          title: "Cannot Submit",
          description: "Please fill out the survey form before submitting. The form appears to be empty.",
          variant: "destructive",
        });
        return;
      }

      // TODO: Implement proper form validation and resubmission logic
      toast({
        title: "Feature Coming Soon",
        description: "Form resubmission with validation will be implemented.",
      });
      console.log('Resubmitting form for:', inspection);
    };

    const handleSubmitWarehouseEvent = (event: CustomEvent) => {
      const inspection = event.detail;
      handleSubmitWarehouse(inspection);
    };
    
    window.addEventListener('inspectionDataUpdated', handleInspectionUpdate as EventListener);
    document.addEventListener('viewResubmittedDetails', handleViewDetails as EventListener);
    document.addEventListener('viewCheckerRemarks', handleViewCheckerRemarks as EventListener);
    document.addEventListener('resubmitForm', handleResubmitForm as EventListener);
    document.addEventListener('submitWarehouse', handleSubmitWarehouseEvent as EventListener);
    
    return () => {
      window.removeEventListener('inspectionDataUpdated', handleInspectionUpdate as EventListener);
      document.removeEventListener('viewResubmittedDetails', handleViewDetails as EventListener);
      document.removeEventListener('viewCheckerRemarks', handleViewCheckerRemarks as EventListener);
      document.removeEventListener('resubmitForm', handleResubmitForm as EventListener);
      document.removeEventListener('submitWarehouse', handleSubmitWarehouseEvent as EventListener);
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
        inspection.businessType.toLowerCase().includes(searchLower) ||
        (inspection.warehouseName && inspection.warehouseName.toLowerCase().includes(searchLower)) ||
        inspection.bankState.toLowerCase().includes(searchLower) ||
        inspection.bankBranch.toLowerCase().includes(searchLower) ||
        inspection.bankName.toLowerCase().includes(searchLower) ||
        inspection.ifscCode.toLowerCase().includes(searchLower) ||
        inspection.receiptType.toLowerCase().includes(searchLower) ||
        (inspection.checkerRemarks && inspection.checkerRemarks.toLowerCase().includes(searchLower))
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
    Array.from(new Set(inspections.map(i => i.businessType).filter(Boolean)))
  , [inspections]);

  // Export to CSV function
  const exportToCSV = () => {
    const dataToExport = filteredAndSortedInspections;
    
    if (dataToExport.length === 0) {
      toast({
        title: "No Data",
        description: "No resubmitted inspections available to export",
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
      'Checker Remarks',
      'Resubmission Reason'
    ];

    // Sort by inspection code in ascending order
    const sortedData = [...dataToExport].sort((a, b) => a.inspectionCode.localeCompare(b.inspectionCode));
    
    const csvData = sortedData.map(inspection => [
      inspection.inspectionCode,
      inspection.warehouseCode,
      inspection.state,
      inspection.branch,
      inspection.location,
      inspection.businessType.toUpperCase(),
      inspection.warehouseName || '',
      inspection.bankState,
      inspection.bankBranch,
      inspection.bankName,
      inspection.ifscCode,
      inspection.receiptType,
      // Format date to show only date part
      inspection.createdAt ? new Date(inspection.createdAt).toLocaleDateString() : '',
      inspection.checkerRemarks || '',
      inspection.resubmissionRemarks || ''
    ]);

    // Create CSV content without extra blank rows
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    const filename = `resubmitted_warehouses_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: `${dataToExport.length} resubmitted warehouses exported to CSV`,
    });
  };

  // Handle status change
  const handleStatusChange = () => {
    setShowInspectionForm(false);
    setSelectedInspection(null);
    loadInspections();
    
    // Dispatch event for cross-module reflection
    window.dispatchEvent(new CustomEvent('inspectionDataUpdated', { 
      detail: { source: 'resubmitted-warehouse', action: 'statusChange' } 
    }));
  };

  // Handle warehouse submission
  const handleSubmitWarehouse = async (inspection: InspectionData) => {
    try {
      // Validate that form has required data before allowing submission
      if (!inspection.warehouseInspectionData || Object.keys(inspection.warehouseInspectionData).length === 0) {
        toast({
          title: "Cannot Submit",
          description: "Please fill out the survey form before submitting. The form appears to be empty.",
          variant: "destructive",
        });
        return;
      }

      // Update the status from 'resubmitted' to 'submitted' in Firebase
      const inspectionRef = doc(db, 'inspections', inspection.id);
      await updateDoc(inspectionRef, {
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        resubmittedAt: new Date().toISOString() // Keep track of when it was resubmitted
      });

      toast({
        title: "Successfully Submitted",
        description: `Warehouse ${inspection.warehouseCode} has been moved to submitted section.`,
        variant: "default",
      });

      // Reload inspections to reflect the change
      loadInspections();
      
      // Dispatch event for cross-module reflection
      window.dispatchEvent(new CustomEvent('inspectionDataUpdated', { 
        detail: { source: 'resubmitted-warehouse', action: 'submit', inspectionId: inspection.id } 
      }));

    } catch (error) {
      console.error('Error submitting warehouse:', error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting the warehouse. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle bulk submission of all resubmitted warehouses
  const handleBulkSubmit = async () => {
    const warehousesToSubmit = filteredAndSortedInspections.filter(inspection => 
      inspection.warehouseInspectionData && Object.keys(inspection.warehouseInspectionData).length > 0
    );

    if (warehousesToSubmit.length === 0) {
      toast({
        title: "No Valid Warehouses",
        description: "No warehouses with complete survey data found to submit.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Submit all valid warehouses
      const promises = warehousesToSubmit.map(async (inspection) => {
        const inspectionRef = doc(db, 'inspections', inspection.id);
        return updateDoc(inspectionRef, {
          status: 'submitted',
          submittedAt: new Date().toISOString(),
          resubmittedAt: new Date().toISOString()
        });
      });

      await Promise.all(promises);

      toast({
        title: "Bulk Submission Successful",
        description: `${warehousesToSubmit.length} warehouses have been submitted successfully.`,
        variant: "default",
      });

      // Reload inspections to reflect the changes
      loadInspections();
      
      // Dispatch event for cross-module reflection
      window.dispatchEvent(new CustomEvent('inspectionDataUpdated', { 
        detail: { source: 'resubmitted-warehouse', action: 'bulkSubmit', count: warehousesToSubmit.length } 
      }));

    } catch (error) {
      console.error('Error in bulk submission:', error);
      toast({
        title: "Bulk Submission Failed",
        description: "There was an error submitting some warehouses. Please try again.",
        variant: "destructive",
      });
    }
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
              Resubmitted Warehouses ({inspections.length})
            </h1>
          </div>
          
          {/* Action Buttons */}
          <div className="flex space-x-2">
            {filteredAndSortedInspections.length > 0 && (
              <>
                {/* <Button 
                  onClick={handleBulkSubmit}
                  className="bg-green-500 hover:bg-green-600 text-white"
                  title="Submit all valid warehouses to approval process"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Submit All
                </Button> */}
                <Button 
                  onClick={exportToCSV}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </>
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
                  placeholder="Search by inspection code, warehouse code, state, branch, location, business type, warehouse name, bank details, remarks..."
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

        {/* Important Notice */}
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <p className="text-orange-700 font-medium">
                Important: These surveys require corrections based on checker feedback. Please review the remarks and update the form accordingly before resubmission.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Inspections Table */}
        {loading ? (
          <Card className="border-green-300">
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading resubmitted warehouses...</p>
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
                Resubmitted Warehouse Inspections
                {hasActiveFilters && (
                  <span className="text-sm font-normal text-green-600 ml-2">
                    (Filtered: {filteredAndSortedInspections.length} of {inspections.length})
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-green-600">
                All resubmitted warehouse inspection surveys with checker remarks sorted by inspection code in ascending order.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <DataTable
                columns={resubmittedColumns}
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
                mode={getSurveyTabMode('resubmitted')}
                onStatusChange={handleStatusChange}
              />
            )}
            {selectedInspection && (
              <div className="mt-4 flex justify-end space-x-2">
                {/* <Button
                  variant="outline"
                  onClick={() => {
                    // Close the form without submitting
                    setShowInspectionForm(false);
                    setSelectedInspection(null);
                  }}
                >
                  Close
                </Button> */}
                <Button
                  className="bg-green-600 text-white"
                  onClick={async () => {
                    if (!selectedInspection) return;
                    const ok = window.confirm(`Are you sure you want to submit warehouse ${selectedInspection.warehouseCode} (${selectedInspection.inspectionCode})? This will move it to the Submitted tab.`);
                    if (!ok) return;
                    // call the existing handler
                    await handleSubmitWarehouse(selectedInspection);
                    // close the dialog
                    setShowInspectionForm(false);
                    setSelectedInspection(null);
                  }}
                >
                  Submit
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}