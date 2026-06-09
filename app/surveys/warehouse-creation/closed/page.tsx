"use client";

import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { useRoleAccess } from '@/hooks/use-role-access';
import {
  Archive,
  Download,
  Eye,
  Search,
  X,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Plus,
  Filter
} from "lucide-react";
import BlinkingSirenIcon from '@/components/BlinkingSirenIcon';
import { DataTable } from '@/components/data-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  warehouseInspectionData?: {
    remarks?: string;
    insuranceEntries?: any[];
  };
}

// Shape of the saved warehouse inspection form data we read from inspection.warehouseInspectionData
interface WarehouseFormData {
  warehouseName?: string;
  warehouseCode?: string;
  status?: string;
  bankState?: string;
  bankBranch?: string;
  bankName?: string;
  ifscCode?: string;
  state?: string;
  branch?: string;
  location?: string;
  businessType?: string;
  receiptType?: string;
  createdAt?: string;
  inspectionCode?: string;
  nameOfBank?: any[];
  attachedFiles?: any[];
  warehouseFitCertification?: boolean;
  dateOfInspection?: string | Date | null;
  validityOfInsurance?: string | Date | null;
  expiryDate?: string | Date | null;
  oeDate?: string | Date | null;
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

export default function ClosedWarehousePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { getSurveyTabMode } = useRoleAccess();
  const [inspections, setInspections] = useState<InspectionData[]>([]);
  const [showInspectionForm, setShowInspectionForm] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<InspectionData | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterBusinessType, setFilterBusinessType] = useState('all');
  const [filterReceiptType, setFilterReceiptType] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const loadInspections = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'inspections'));
      const inspectionData: InspectionData[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Only include documents with 'closed' status
        if (data.status === 'closed') {
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
            warehouseInspectionData: data.warehouseInspectionData || {}
          });
        }
      });
      
      // Filter for closed status - status filtering is now done in forEach loop above
      setInspections(inspectionData);
    } catch (error) {
      console.error('Error loading inspections:', error);
      toast({
        title: "Error",
        description: "Failed to load inspections",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Load inspections from Firebase
  useEffect(() => {
    loadInspections();
  }, [loadInspections]);

  // Get unique values for filter dropdowns
  const uniqueStates = useMemo(() => Array.from(new Set(inspections.map(i => i.state || '').filter(Boolean))), [inspections]);
  const uniqueBranches = useMemo(() => Array.from(new Set(inspections.map(i => i.branch || '').filter(Boolean))), [inspections]);
  const uniqueLocations = useMemo(() => Array.from(new Set(inspections.map(i => i.location || '').filter(Boolean))), [inspections]);
  const uniqueBusinessTypes = useMemo(() => Array.from(new Set(inspections.map(i => i.businessType || '').filter(Boolean))), [inspections]);
  const uniqueReceiptTypes = useMemo(() => Array.from(new Set(inspections.map(i => i.receiptType || '').filter(Boolean))), [inspections]);

  // Filter data based on search term and filters
  const filteredInspections = useMemo(() => {
    let filtered = inspections;

    // Apply search term filter
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(inspection => 
        inspection.inspectionCode?.toLowerCase().includes(lowerSearchTerm) ||
        inspection.warehouseCode?.toLowerCase().includes(lowerSearchTerm) ||
        inspection.warehouseName?.toLowerCase().includes(lowerSearchTerm) ||
        inspection.state?.toLowerCase().includes(lowerSearchTerm) ||
        inspection.branch?.toLowerCase().includes(lowerSearchTerm) ||
        inspection.location?.toLowerCase().includes(lowerSearchTerm) ||
        inspection.businessType?.toLowerCase().includes(lowerSearchTerm) ||
        inspection.bankName?.toLowerCase().includes(lowerSearchTerm) ||
        inspection.receiptType?.toLowerCase().includes(lowerSearchTerm)
      );
    }

    // Apply individual filters
    if (filterState && filterState !== 'all') {
      filtered = filtered.filter(inspection => (inspection.state || '') === filterState);
    }
    if (filterBranch && filterBranch !== 'all') {
      filtered = filtered.filter(inspection => (inspection.branch || '') === filterBranch);
    }
    if (filterLocation && filterLocation !== 'all') {
      filtered = filtered.filter(inspection => (inspection.location || '') === filterLocation);
    }
    if (filterBusinessType && filterBusinessType !== 'all') {
      filtered = filtered.filter(inspection => (inspection.businessType || '') === filterBusinessType);
    }
    if (filterReceiptType && filterReceiptType !== 'all') {
      filtered = filtered.filter(inspection => (inspection.receiptType || '') === filterReceiptType);
    }

    return filtered;
  }, [inspections, searchTerm, filterState, filterBranch, filterLocation, filterBusinessType, filterReceiptType]);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setFilterState('all');
    setFilterBranch('all');
    setFilterLocation('all');
    setFilterBusinessType('all');
    setFilterReceiptType('all');
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || 
    (filterState && filterState !== 'all') || 
    (filterBranch && filterBranch !== 'all') || 
    (filterLocation && filterLocation !== 'all') || 
    (filterBusinessType && filterBusinessType !== 'all') || 
    (filterReceiptType && filterReceiptType !== 'all');

  const getWarehouseStatus = (warehouseCode: string): 'pending' | 'submitted' | 'activated' | 'rejected' | 'resubmitted' | 'closed' => {
    // Simple logic to determine status - you can modify this based on your business logic
    // For demo purposes, showing empty results for non-pending statuses
    return 'pending'; // This will show no results for closed status
  };

  const exportToCSV = () => {
    // Use filtered data for CSV export
    const dataToExport = hasActiveFilters ? filteredInspections : inspections;
    
    const headers = [
      'Inspection Code', 'Warehouse Code', 'State', 'Branch', 'Location', 
      'Business Type', 'Warehouse Name', 'Bank State', 'Bank Name', 
      'Bank Branch', 'IFSC Code', 'Receipt Type', 'Created Date', 'Remarks'
    ];
    
    const csvContent = [
      headers.join(',') + '\n',
      ...dataToExport.map(inspection => [
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
        inspection.createdAt,
        inspection.warehouseInspectionData?.remarks || ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `closed-warehouse-inspections-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDelete = async (id: string) => {
    // This would typically delete from Firebase, but for now just show a message
    toast({
      title: "Delete",
      description: "Delete functionality would be implemented here",
    });
  };

  const handleViewDetails = (inspection: InspectionData) => {
    setSelectedInspection(inspection);
    setShowInspectionForm(true);
  };

  const convertInspectionToFormData = (inspection: InspectionData) => {
    // Get the saved warehouse inspection data from the inspection record
    const warehouseData = (inspection.warehouseInspectionData || {}) as Partial<WarehouseFormData>;
    
    // Return the saved form data with fallbacks to inspection data
    return {
      // Use saved warehouse inspection data if available, otherwise fallback to inspection data
      ...warehouseData,
      
      // Override with inspection-specific data
      warehouseName: inspection.warehouseName || warehouseData.warehouseName || '',
      warehouseCode: inspection.warehouseCode || warehouseData.warehouseCode || '',
      status: 'closed', // Always closed for this page
      
      // Bank details from inspection (these are the specific bank for this inspection)
      bankState: inspection.bankState || warehouseData.bankState || '',
      bankBranch: inspection.bankBranch || warehouseData.bankBranch || '',
      bankName: inspection.bankName || warehouseData.bankName || '',
      ifscCode: inspection.ifscCode || warehouseData.ifscCode || '',
      
      // Location details from inspection
      state: inspection.state || warehouseData.state || '',
      branch: inspection.branch || warehouseData.branch || '',
      location: inspection.location || warehouseData.location || '',
      businessType: inspection.businessType || warehouseData.businessType || '',
      receiptType: inspection.receiptType || warehouseData.receiptType || '',
      
      // Include creation info
      createdAt: inspection.createdAt || warehouseData.createdAt || '',
      inspectionCode: inspection.inspectionCode || inspection.id || '',
      
      // Ensure arrays and objects have defaults
      nameOfBank: warehouseData.nameOfBank || [],
      attachedFiles: warehouseData.attachedFiles || [],
      
      // Ensure boolean defaults
      warehouseFitCertification: warehouseData.warehouseFitCertification || false,
      
      // Ensure date fields are properly handled - convert strings to Date objects
      dateOfInspection: warehouseData.dateOfInspection ? new Date(warehouseData.dateOfInspection) : null,
      validityOfInsurance: warehouseData.validityOfInsurance ? new Date(warehouseData.validityOfInsurance) : null,
      expiryDate: warehouseData.expiryDate ? new Date(warehouseData.expiryDate) : null,
      oeDate: warehouseData.oeDate ? new Date(warehouseData.oeDate) : null
    };
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header with Back Button and Centered Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => router.push('/surveys/warehouse-creation')}
              className="inline-block text-lg font-semibold tracking-tight bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 transition-colors"
            >
              ← Warehouse Creation
            </button>
          </div>
          
          {/* Centered Title with Light Orange Background */}
          <div className="flex-1 text-center w-full sm:w-auto">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-orange-600 inline-block border-b-4 border-green-500 pb-2 px-4 sm:px-6 py-2 sm:py-3 bg-orange-100 rounded-lg">
              <Archive className="inline mr-2 h-8 w-8 text-gray-500" />
              Closed Warehouses
            </h1>
          </div>
          
          {/* Export Button */}
          <div className="w-full sm:w-auto">
            {(hasActiveFilters ? filteredInspections.length > 0 : inspections.length > 0) && (
              <Button 
                onClick={exportToCSV}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV {hasActiveFilters && `(${filteredInspections.length})`}
              </Button>
            )}
          </div>
        </div>

        {/* Status Description */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <Archive className="w-6 h-6 text-gray-500" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">Closed Warehouses</h3>
              <p className="text-gray-700 mt-1">
                Warehouses that have been decommissioned and are no longer in operation.
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="bg-green-50 border border-green-200">
          <CardHeader>
            <CardTitle className="text-green-800">Search & Filter Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Bar */}
            <div className="flex items-center gap-2">
              <Search className="text-gray-500" />
              <Label htmlFor="search-input" className="font-semibold text-gray-700">Search:</Label>
              <Input
                id="search-input"
                placeholder="Search by inspection code, warehouse code, warehouse name, state, branch, location, business type, bank name, or receipt type..."
                className="flex-1"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="border-green-300 text-green-700 hover:bg-green-100"
              >
                <Filter className="mr-2 h-4 w-4" />
                {showFilters ? 'Hide' : 'Show'} Filters
              </Button>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-green-200">
                <div>
                  <Label className="block font-medium mb-1 text-green-700">State</Label>
                  <Select value={filterState} onValueChange={setFilterState}>
                    <SelectTrigger className="border-green-300">
                      <SelectValue placeholder="All States" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All States</SelectItem>
                      {uniqueStates.map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="block font-medium mb-1 text-green-700">Branch</Label>
                  <Select value={filterBranch} onValueChange={setFilterBranch}>
                    <SelectTrigger className="border-green-300">
                      <SelectValue placeholder="All Branches" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Branches</SelectItem>
                      {uniqueBranches.map(branch => (
                        <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="block font-medium mb-1 text-green-700">Location</Label>
                  <Select value={filterLocation} onValueChange={setFilterLocation}>
                    <SelectTrigger className="border-green-300">
                      <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      {uniqueLocations.map(location => (
                        <SelectItem key={location} value={location}>{location}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="block font-medium mb-1 text-green-700">Business Type</Label>
                  <Select value={filterBusinessType} onValueChange={setFilterBusinessType}>
                    <SelectTrigger className="border-green-300">
                      <SelectValue placeholder="All Business Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Business Types</SelectItem>
                      {uniqueBusinessTypes.map(type => (
                        <SelectItem key={type} value={type}>{type.toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="block font-medium mb-1 text-green-700">Receipt Type</Label>
                  <Select value={filterReceiptType} onValueChange={setFilterReceiptType}>
                    <SelectTrigger className="border-green-300">
                      <SelectValue placeholder="All Receipt Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Receipt Types</SelectItem>
                      {uniqueReceiptTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                    className="border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Clear Filters
                  </Button>
                </div>
              </div>
            )}

            {/* Active Filters Summary */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 pt-2 border-t border-green-200">
                <span className="text-sm font-medium text-green-700">Active Filters:</span>
                {searchTerm && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    Search: &quot;{searchTerm}&quot;
                  </Badge>
                )}
                {filterState && filterState !== 'all' && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    State: {filterState}
                  </Badge>
                )}
                {filterBranch && filterBranch !== 'all' && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Branch: {filterBranch}
                  </Badge>
                )}
                {filterLocation && filterLocation !== 'all' && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Location: {filterLocation}
                  </Badge>
                )}
                {filterBusinessType && filterBusinessType !== 'all' && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Business Type: {filterBusinessType.toUpperCase()}
                  </Badge>
                )}
                {filterReceiptType && filterReceiptType !== 'all' && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Receipt Type: {filterReceiptType}
                  </Badge>
                )}
                <span className="text-sm text-green-600">
                  ({filteredInspections.length} of {inspections.length} results)
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inspections Table */}
        {filteredInspections.length > 0 ? (
          <Card className="border-green-300">
            <CardHeader className="bg-green-50">
              <CardTitle className="text-green-700">
                Closed Warehouse Inspections
                {hasActiveFilters && (
                  <span className="text-sm font-normal text-green-600 ml-2">
                    (Filtered: {filteredInspections.length} of {inspections.length})
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-green-600">
                All closed warehouse inspection surveys with their details and actions.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <div 
                className="overflow-x-auto relative"
                style={{
                  backgroundImage: `
                    radial-gradient(circle at 25% 25%, rgba(34, 197, 94, 0.03) 0%, transparent 50%),
                    radial-gradient(circle at 75% 75%, rgba(249, 115, 22, 0.03) 0%, transparent 50%),
                    linear-gradient(135deg, rgba(34, 197, 94, 0.01) 0%, rgba(249, 115, 22, 0.01) 100%)
                  `,
                  backgroundSize: '400px 400px, 300px 300px, 100% 100%',
                  backgroundPosition: '0% 0%, 100% 100%, 0% 0%',
                  backgroundRepeat: 'no-repeat, no-repeat, no-repeat'
                }}
              >
                <Table className="border-collapse">
                  <TableHeader>
                    <TableRow className="bg-orange-50 border-b-2 border-orange-200 sticky top-0 z-20">
                      <TableHead className="text-orange-700 font-semibold border-r border-orange-300 text-center p-2 whitespace-nowrap sticky top-0 left-0 z-30 bg-orange-50">Inspection Code</TableHead>
                      <TableHead className="text-orange-700 font-semibold border-r border-orange-300 text-center p-2 whitespace-nowrap sticky top-0 bg-orange-50">Warehouse Code</TableHead>
                      <TableHead className="text-orange-700 font-semibold border-r border-orange-300 text-center p-2 whitespace-nowrap sticky top-0 bg-orange-50">State</TableHead>
                      <TableHead className="text-orange-700 font-semibold border-r border-orange-300 text-center p-2 whitespace-nowrap sticky top-0 bg-orange-50">Branch</TableHead>
                      <TableHead className="text-orange-700 font-semibold border-r border-orange-300 text-center p-2 whitespace-nowrap sticky top-0 bg-orange-50">Location</TableHead>
                      <TableHead className="text-orange-700 font-semibold border-r border-orange-300 text-center p-2 whitespace-nowrap sticky top-0 bg-orange-50">Business Type</TableHead>
                      <TableHead className="text-orange-700 font-semibold border-r border-orange-300 text-center p-2 whitespace-nowrap sticky top-0 bg-orange-50">Warehouse Name</TableHead>
                      <TableHead className="text-orange-700 font-semibold border-r border-orange-300 text-center p-2 whitespace-nowrap sticky top-0 bg-orange-50">Bank State</TableHead>
                      <TableHead className="text-orange-700 font-semibold border-r border-orange-300 text-center p-2 whitespace-nowrap sticky top-0 bg-orange-50">Bank Name</TableHead>
                      <TableHead className="text-orange-700 font-semibold border-r border-orange-300 text-center p-2 whitespace-nowrap sticky top-0 bg-orange-50">Bank Branch</TableHead>
                      <TableHead className="text-orange-700 font-semibold border-r border-orange-300 text-center p-2 whitespace-nowrap sticky top-0 bg-orange-50">IFSC Code</TableHead>
                      <TableHead className="text-orange-700 font-semibold border-r border-orange-300 text-center p-2 whitespace-nowrap sticky top-0 bg-orange-50">Receipt Type</TableHead>
                      <TableHead className="text-orange-700 font-semibold border-r border-orange-300 text-center p-2 whitespace-nowrap sticky top-0 bg-orange-50">Created</TableHead>
                      <TableHead className="text-orange-700 font-semibold border-r border-orange-300 text-center p-2 whitespace-nowrap sticky top-0 bg-orange-50">Remarks</TableHead>
                      <TableHead className="text-orange-700 font-semibold text-center p-2 whitespace-nowrap sticky top-0 bg-orange-50">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInspections.map((inspection) => (
                      <TableRow key={inspection.id} className="hover:bg-green-50 border-b border-gray-200">
                        <TableCell className="text-green-700 font-bold border-r border-gray-300 text-center p-2 whitespace-nowrap sticky left-0 z-10 bg-white hover:bg-green-50">{inspection.inspectionCode}</TableCell>
                        <TableCell className="text-green-700 border-r border-gray-300 text-center p-2 whitespace-nowrap">{inspection.warehouseCode}</TableCell>
                        <TableCell className="text-green-700 border-r border-gray-300 text-center p-2 whitespace-nowrap">{inspection.state}</TableCell>
                        <TableCell className="text-green-700 border-r border-gray-300 text-center p-2 whitespace-nowrap">{inspection.branch}</TableCell>
                        <TableCell className="text-green-700 border-r border-gray-300 text-center p-2 whitespace-nowrap">{inspection.location}</TableCell>
                        <TableCell className="text-green-700 border-r border-gray-300 text-center p-2 whitespace-nowrap">{inspection.businessType.toUpperCase()}</TableCell>
                        <TableCell className="text-green-700 border-r border-gray-300 text-center p-2 whitespace-nowrap">{inspection.warehouseName}</TableCell>
                        <TableCell className="text-green-700 border-r border-gray-300 text-center p-2 whitespace-nowrap">{inspection.bankState}</TableCell>
                        <TableCell className="text-green-700 border-r border-gray-300 text-center p-2 whitespace-nowrap">{inspection.bankBranch}</TableCell>
                        <TableCell className="text-green-700 border-r border-gray-300 text-center p-2 whitespace-nowrap">{inspection.bankName}</TableCell>
                        <TableCell className="text-green-700 border-r border-gray-300 text-center p-2 whitespace-nowrap">{inspection.ifscCode}</TableCell>
                        <TableCell className="text-green-700 border-r border-gray-300 text-center p-2 whitespace-nowrap">{inspection.receiptType}</TableCell>
                        <TableCell className="text-green-700 border-r border-gray-300 text-center p-2 whitespace-nowrap">{inspection.createdAt}</TableCell>
                        <TableCell className="text-green-700 border-r border-gray-300 text-center p-2 max-w-xs">
                          <div className="truncate" title={inspection.warehouseInspectionData?.remarks || ''}>
                            {inspection.warehouseInspectionData?.remarks || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="text-center p-2">
                          <div className="flex space-x-2 justify-center items-center">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleViewDetails(inspection)}
                              className="border-blue-300 text-blue-600 hover:bg-blue-50"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {getInsuranceAlertStatus(inspection) === 'expired' && (
                              <div title="Insurance Expired">
                                <BlinkingSirenIcon color="red" size={20} />
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-12">
            <Archive className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {hasActiveFilters ? 'No Results Found' : 'No Closed Inspections'}
            </h3>
            <p className="text-gray-500">
              {hasActiveFilters 
                ? 'Try adjusting your search criteria or filters to find more results.'
                : 'There are currently no warehouse inspections in closed status.'
              }
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={clearFilters}
                className="mt-4 border-green-300 text-green-700 hover:bg-green-100"
              >
                <X className="mr-2 h-4 w-4" />
                Clear All Filters
              </Button>
            )}
          </div>
        )}

        {/* Warehouse Inspection Form Dialog */}
        <Dialog open={showInspectionForm} onOpenChange={setShowInspectionForm}>
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
                  loadInspections(); // Reload data after closing form
                }}
                initialData={convertInspectionToFormData(selectedInspection)}
                mode={getSurveyTabMode('closed')}
                onStatusChange={(warehouseCode, newStatus) => {
                  // Reload the inspections data after status change
                  loadInspections();
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
} 