"use client";

import DashboardLayout from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, ClipboardCheck, Plus, Download, Eye, Edit, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Helper function to get status styling
const getStatusStyling = (status: string) => {
  const normalizedStatus = status?.toLowerCase().trim() || '';
  
  // Pending/inactive/closed - yellow background, black font
  if (normalizedStatus === 'pending' || normalizedStatus === 'inactive' || normalizedStatus === 'closed') {
    return 'bg-yellow-100 text-black px-2 py-1 rounded-full text-xs font-medium inline-block';
  }
  
  // Approve/activate/reactive - light green background, dark green font
  if (normalizedStatus === 'approved' || normalizedStatus === 'activate' || normalizedStatus === 'reactivate' || 
      normalizedStatus === 'approve' || normalizedStatus === 'reactive' || normalizedStatus === 'activated' || 
      normalizedStatus === 'submitted') {
    return 'bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium inline-block';
  }
  
  // Resubmit/reject - baby pink background, red font
  if (normalizedStatus === 'resubmit' || normalizedStatus === 'reject' || normalizedStatus === 'rejected' || 
      normalizedStatus === 'resubmitted') {
    return 'bg-pink-100 text-red-600 px-2 py-1 rounded-full text-xs font-medium inline-block';
  }
  
  // Default styling for unknown status
  return 'bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium inline-block';
};
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { DataTable } from '@/components/data-table';
import { Search } from 'lucide-react';
import { useRoleAccess } from '@/hooks/use-role-access';

// Data interfaces matching the master data modules
interface BranchLocation {
  id?: string;
  locationId: string;
  locationName: string;
  address?: string;
  pincode?: string;
  createdAt?: string;
}

interface BranchData {
  id?: string;
  branchId: string;
  name: string;
  state: string;
  branch: string;
  locations: BranchLocation[];
  createdAt?: string;
}

interface BankLocation {
  id?: string;
  locationId: string;
  locationName: string;
  branchName: string;
  ifscCode: string;
  address?: string;
  authorizePerson1?: string;
  authorizePerson2?: string;
  createdAt?: string;
}

interface BankData {
  id?: string;
  bankId: string;
  bankName: string;
  state: string;
  branch: string;
  locations: BankLocation[];
  createdAt?: string;
}

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
}

interface WarehouseInspectionData {
  id: string;
  warehouseName: string;
  warehouseCode: string;
  status: 'pending' | 'submitted' | 'activated' | 'rejected' | 'resubmitted' | 'closed';
  [key: string]: any;
}

export default function InspectionCreationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { userRole, canAccess } = useRoleAccess();
  
  // Data from Firebase
  const [branchesData, setBranchesData] = useState<BranchData[]>([]);
  const [banksData, setBanksData] = useState<BankData[]>([]);
  const [inspections, setInspections] = useState<InspectionData[]>([]);
  const [existingWarehouses, setExistingWarehouses] = useState<string[]>([]);
  const [warehouseInspections, setWarehouseInspections] = useState<WarehouseInspectionData[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    state: '',
    branch: '',
    location: '',
    businessType: '',
    warehouseStatus: '',
    warehouseName: '',
    existingWarehouse: '',
    bankState: '',
    bank: '', // Combined bank field (bankname-branch format)
    bankBranch: '', // Hidden field for storage
    bankName: '', // Hidden field for storage
    ifscCode: '',
    receiptType: ''
  });

  // Dropdown options state (derived from Firebase data)
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [availableBankStates, setAvailableBankStates] = useState<string[]>([]);

  const [availableBanks, setAvailableBanks] = useState<{label: string, bankName: string, branchName: string, ifscCode: string}[]>([]);
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [selectedInspectionForBank, setSelectedInspectionForBank] = useState<InspectionData | null>(null);
  const [showWarehouseInspectionModal, setShowWarehouseInspectionModal] = useState(false);
  const [selectedWarehouseInspection, setSelectedWarehouseInspection] = useState<WarehouseInspectionData | null>(null);
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editingInspectionId, setEditingInspectionId] = useState<string | null>(null);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Bank form state for adding new bank to existing warehouse
  const [bankFormData, setBankFormData] = useState({
    bankState: '',
    bank: '', // Combined bank field
    bankBranch: '', // Hidden field for storage
    bankName: '', // Hidden field for storage
    ifscCode: ''
  });

  // Load data from Firebase on component mount
  useEffect(() => {
    loadBranchesData();
    loadBanksData();
    loadInspections();
    loadWarehouseInspections();
    
    // Add event listener for cross-module reflection
    const handleInspectionUpdate = (event: CustomEvent) => {
      // Reload data when other modules update inspection data
      if (event.detail && event.detail.source !== 'inspection-creation') {
        loadInspections();
      }
    };
    
    window.addEventListener('inspectionDataUpdated', handleInspectionUpdate as EventListener);
    
    return () => {
      window.removeEventListener('inspectionDataUpdated', handleInspectionUpdate as EventListener);
    };
  }, []);

  // Extract unique states from branches data
  useEffect(() => {
    if (branchesData.length > 0) {
      const states = Array.from(new Set(branchesData.map(branch => branch.state)));
      setAvailableStates(states);
    }
  }, [branchesData]);

  // Extract unique bank states from banks data
  useEffect(() => {
    if (banksData.length > 0) {
      const states = Array.from(new Set(banksData.map(bank => bank.state)));
      setAvailableBankStates(states);
    }
  }, [banksData]);

  // Update branches when state changes
  useEffect(() => {
    if (formData.state) {
      const branchesInState = branchesData.filter(branch => branch.state === formData.state);
      const branches = Array.from(new Set(branchesInState.map(branch => branch.branch)));
      setAvailableBranches(branches);
      setFormData(prev => ({ ...prev, branch: '', location: '' }));
    }
  }, [formData.state, branchesData]);

  // Update locations when branch changes
  useEffect(() => {
    if (formData.branch) {
      const branchData = branchesData.find(branch => 
        branch.state === formData.state && branch.branch === formData.branch
      );
      if (branchData) {
        const locations = branchData.locations.map(loc => loc.locationName);
        setAvailableLocations(locations);
      }
      setFormData(prev => ({ ...prev, location: '' }));
    }
  }, [formData.branch, formData.state, branchesData]);

  // Update available banks when bank state changes
  useEffect(() => {
    if (formData.bankState) {
      const banksInState = banksData.filter(bank => bank.state === formData.bankState);
      
      const banksWithDetails: {label: string, bankName: string, branchName: string, ifscCode: string}[] = [];
      
      banksInState.forEach(bank => {
        bank.locations.forEach(location => {
          if (location.branchName && location.branchName.trim() !== '' && location.ifscCode && location.locationName) {
            banksWithDetails.push({
              label: `${location.locationName}-${location.branchName}`,
              bankName: location.locationName, // Use locationName as the bank name
              branchName: location.branchName,
              ifscCode: location.ifscCode
            });
          }
        });
      });
      
      setAvailableBanks(banksWithDetails);
      setFormData(prev => ({ ...prev, bank: '', bankBranch: '', bankName: '', ifscCode: '' }));
    }
  }, [formData.bankState, banksData]);

  // Update bank details and IFSC when bank is selected
  useEffect(() => {
    if (formData.bank) {
      const selectedBank = availableBanks.find(bank => bank.label === formData.bank);
      if (selectedBank) {
        setFormData(prev => ({
          ...prev,
          bankName: selectedBank.bankName,
          bankBranch: selectedBank.branchName,
          ifscCode: selectedBank.ifscCode
        }));
      }
    }
  }, [formData.bank, availableBanks]);

  // Update available banks when bank state changes (for bank form)
  useEffect(() => {
    if (bankFormData.bankState) {
      const banksInState = banksData.filter(bank => bank.state === bankFormData.bankState);
      
      const banksWithDetails: {label: string, bankName: string, branchName: string, ifscCode: string}[] = [];
      
      banksInState.forEach(bank => {
        bank.locations.forEach(location => {
          if (location.branchName && location.branchName.trim() !== '' && location.ifscCode && location.locationName) {
            banksWithDetails.push({
              label: `${location.locationName}-${location.branchName}`,
              bankName: location.locationName, // Use locationName as the bank name
              branchName: location.branchName,
              ifscCode: location.ifscCode
            });
          }
        });
      });
      
      // Update availableBanks for bank form (reusing the main form's dropdown)
      setAvailableBanks(banksWithDetails);
      setBankFormData(prev => ({ ...prev, bank: '', bankBranch: '', bankName: '', ifscCode: '' }));
    }
  }, [bankFormData.bankState, banksData]);

  // Update bank details and IFSC when bank is selected (for bank form)
  useEffect(() => {
    if (bankFormData.bank) {
      const selectedBank = availableBanks.find(bank => bank.label === bankFormData.bank);
      if (selectedBank) {
        setBankFormData(prev => ({
          ...prev,
          bankName: selectedBank.bankName,
          bankBranch: selectedBank.branchName,
          ifscCode: selectedBank.ifscCode
        }));
      }
    }
  }, [bankFormData.bank, availableBanks]);

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
        inspection.receiptType.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort by inspection code in ascending order
    filtered.sort((a, b) => a.inspectionCode.localeCompare(b.inspectionCode));
    
    return filtered;
  }, [inspections, searchTerm]);

  // Define columns for DataTable
  const inspectionColumns = [
    {
      accessorKey: "inspectionCode",
      header: "Inspection Code",
      cell: ({ row }: { row: any }) => <span className="font-bold text-orange-800 w-full flex justify-center">{row.getValue("inspectionCode")}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "warehouseCode",
      header: "Warehouse Code",
      cell: ({ row }: { row: any }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("warehouseCode")}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "state",
      header: "State",
      cell: ({ row }: { row: any }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("state")}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "branch",
      header: "Branch",
      cell: ({ row }: { row: any }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("branch")}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "location",
      header: "Location",
      cell: ({ row }: { row: any }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("location")}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "businessType",
      header: "Business Type",
      cell: ({ row }: { row: any }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("businessType").toUpperCase()}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "warehouseName",
      header: "Warehouse Name",
      cell: ({ row }: { row: any }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("warehouseName") || ''}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "bankState",
      header: "Bank State",
      cell: ({ row }: { row: any }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("bankState")}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "bankBranch",
      header: "Bank Name",
      cell: ({ row }: { row: any }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("bankBranch")}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "bankName",
      header: "Bank Branch",
      cell: ({ row }: { row: any }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("bankName")}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "ifscCode",
      header: "IFSC Code",
      cell: ({ row }: { row: any }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("ifscCode")}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "receiptType",
      header: "Receipt Type",
      cell: ({ row }: { row: any }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("receiptType")}</span>,
      meta: { align: 'center' },
    },
    {
      accessorKey: "createdAt",
      header: "Created Date",
      cell: ({ row }: { row: any }) => {
        const date = row.getValue("createdAt");
        const formattedDate = date ? new Date(date).toLocaleDateString() : '';
        return <span className="text-green-700 w-full flex justify-center">{formattedDate}</span>;
      },
      meta: { align: 'center' },
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: ({ row }: { row: any }) => {
        const inspection = row.original;
        return (
          <div className="flex space-x-2 justify-center">
            {/* Edit Button - Only for Checker and Admin */}
            {(userRole === 'checker' || userRole === 'admin') && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleEdit(inspection)}
                className="border-orange-300 text-orange-600 hover:bg-orange-50"
                title="Edit Inspection"
              >
                <Edit className="w-4 h-4" />
              </Button>
            )}
            
            {/* Delete Button - Only for Checker and Admin */}
            {(userRole === 'checker' || userRole === 'admin') && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete inspection ${inspection.inspectionCode}? This action cannot be undone.`)) {
                    handleDelete(inspection.id);
                  }
                }}
                className="border-red-300 text-red-600 hover:bg-red-50"
                title="Delete Inspection"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            
            {/* Add Bank Button - Available for all roles */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleAddBankClick(inspection)}
              className="border-blue-300 text-blue-600 hover:bg-blue-50"
              title="Add Bank"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        );
      },
      meta: { align: 'center' },
    },
  ];

  // Export to CSV function
  const exportToCSV = () => {
    const dataToExport = searchTerm.trim() ? filteredAndSortedInspections : inspections;
    
    if (dataToExport.length === 0) {
      toast({
        title: "No Data",
        description: "No inspections available to export",
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
      'Bank Branch',
      'Bank Name',
      'IFSC Code',
      'Receipt Type',
      'Created Date'
    ];

    // Format date to show only date (not time) and sort by inspection code
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
      inspection.createdAt ? new Date(inspection.createdAt).toLocaleDateString() : ''
    ]);

    // Create CSV content without extra blank rows
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Use appropriate filename based on search context
    const filename = searchTerm.trim() 
      ? `inspections_filtered_${new Date().toISOString().split('T')[0]}.csv`
      : `inspections_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: `${dataToExport.length} inspections exported to CSV`,
    });
  };

  const loadBranchesData = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'branches'));
      const branches = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        locations: doc.data().locations || []
      })) as BranchData[];
      setBranchesData(branches);
    } catch (error) {
      console.error('Error loading branches:', error);
      toast({
        title: "Error",
        description: "Failed to load branches data",
        variant: "destructive",
      });
    }
  };

  const loadBanksData = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'banks'));
      const banks = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        locations: doc.data().locations || []
      })) as BankData[];
      setBanksData(banks);
    } catch (error) {
      console.error('Error loading banks:', error);
      toast({
        title: "Error",
        description: "Failed to load banks data",
        variant: "destructive",
      });
    }
  };

  const loadInspections = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'inspections'));
      const inspectionsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InspectionData[];
      setInspections(inspectionsData);

      // Extract existing warehouse names
      const warehouses = inspectionsData
        .filter(inspection => inspection.warehouseName)
        .map(inspection => inspection.warehouseName!)
        .filter((name, index, self) => self.indexOf(name) === index); // Remove duplicates
      setExistingWarehouses(warehouses);
    } catch (error) {
      console.error('Error loading inspections:', error);
    }
  };

  const loadWarehouseInspections = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'warehouse-inspections'));
      const warehouseInspectionsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WarehouseInspectionData[];
      setWarehouseInspections(warehouseInspectionsData);
    } catch (error) {
      console.error('Error loading warehouse inspections:', error);
    }
  };

  const generateCodes = (selectedWarehouse?: string) => {
    const inspectionCount = inspections.length + 1;
    const inspectionCode = `SUR-${inspectionCount.toString().padStart(4, '0')}`;
    
    // If existing warehouse is selected, find and reuse its warehouse code
    if (selectedWarehouse && formData.warehouseStatus === 'existing') {
      const existingInspection = inspections.find(inspection => 
        inspection.warehouseName === selectedWarehouse
      );
      
      if (existingInspection) {
        return { 
          inspectionCode, 
          warehouseCode: existingInspection.warehouseCode 
        };
      }
    }
    
    // Generate new warehouse code for new warehouses or if no existing code found
    const warehouseCode = `WH-${inspectionCount.toString().padStart(4, '0')}`;
    return { inspectionCode, warehouseCode };
  };

  // Get warehouse status for inspection
  const getWarehouseStatus = (warehouseCode: string): 'pending' | 'submitted' | 'activated' | 'rejected' | 'resubmitted' | 'closed' => {
    const warehouseInspection = warehouseInspections.find(wi => wi.warehouseCode === warehouseCode);
    return warehouseInspection?.status || 'pending';
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusClass = getStatusStyling(status);
    const normalizedStatus = status?.toLowerCase().trim() || '';
    
    // Capitalize first letter for display
    const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
    
    return (
      <span className={`${statusClass} cursor-pointer hover:opacity-80`}>
        {displayStatus}
      </span>
    );
  };

  // Handle remarks click
  const handleRemarksClick = (inspection: InspectionData) => {
    const warehouseInspection = warehouseInspections.find(wi => wi.warehouseCode === inspection.warehouseCode);
    if (warehouseInspection) {
      setSelectedWarehouseInspection(warehouseInspection);
      setShowWarehouseInspectionModal(true);
    } else {
      toast({
        title: "No Inspection Found",
        description: "No warehouse inspection form found for this warehouse",
        variant: "destructive",
      });
    }
  };

  // Handle add bank button click
  const handleAddBankClick = (inspection: InspectionData) => {
    setSelectedInspectionForBank(inspection);
    setBankFormData({
      bankState: '',
      bank: '', // Combined bank field
      bankBranch: '', // Hidden field for storage
      bankName: '', // Hidden field for storage
      ifscCode: ''
    });
    setShowAddBankModal(true);
  };

  // Handle bank form submission
  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedInspectionForBank) return;

    // Form validation for bank fields
    const requiredBankFields = [
      { field: bankFormData.bankState, name: 'Bank State' },
      { field: bankFormData.bankBranch, name: 'Bank Branch' },
      { field: bankFormData.bankName, name: 'Bank Name' },
      { field: bankFormData.ifscCode, name: 'IFSC Code' }
    ];

    const missingFields = requiredBankFields.filter(item => !item.field || item.field.trim() === '');
    
    if (missingFields.length > 0) {
      toast({
        title: "Missing Required Fields",
        description: `Please fill in: ${missingFields.map(f => f.name).join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate bank for the same warehouse
    const duplicateBank = inspections.find(inspection => 
      inspection.warehouseCode === selectedInspectionForBank.warehouseCode &&
      inspection.bankState === bankFormData.bankState &&
      inspection.bankBranch === bankFormData.bankBranch &&
      inspection.bankName === bankFormData.bankName &&
      inspection.ifscCode === bankFormData.ifscCode
    );

    if (duplicateBank) {
      toast({
        title: "Duplicate Bank Error",
        description: `This bank (${bankFormData.bankName}) is already associated with warehouse ${selectedInspectionForBank.warehouseCode}`,
        variant: "destructive",
      });
      return;
    }

    try {
      // Generate new inspection code (increment from total inspections)
      const newInspectionCode = `SUR-${(inspections.length + 1).toString().padStart(4, '0')}`;
      
      // Create new inspection with same warehouse details but new bank
      const newInspection: Omit<InspectionData, 'id'> = {
        inspectionCode: newInspectionCode,
        warehouseCode: selectedInspectionForBank.warehouseCode, // Same warehouse code
        state: selectedInspectionForBank.state,
        branch: selectedInspectionForBank.branch,
        location: selectedInspectionForBank.location,
        businessType: selectedInspectionForBank.businessType,
        warehouseStatus: selectedInspectionForBank.warehouseStatus,
        warehouseName: selectedInspectionForBank.warehouseName,
        bankState: bankFormData.bankState,
        bankBranch: bankFormData.bankBranch,
        bankName: bankFormData.bankName,
        ifscCode: bankFormData.ifscCode,
        receiptType: selectedInspectionForBank.receiptType,
        createdAt: new Date().toISOString()
      };

      // Save to Firebase
      const docRef = await addDoc(collection(db, 'inspections'), newInspection);
      
      // Update local state
      const savedInspection: InspectionData = {
        id: docRef.id,
        ...newInspection,
        createdAt: new Date().toLocaleDateString()
      };
      
      // Find the index of the original inspection and insert the new one right after it
      const originalIndex = inspections.findIndex(insp => insp.id === selectedInspectionForBank.id);
      const newInspections = [...inspections];
      newInspections.splice(originalIndex + 1, 0, savedInspection);
      setInspections(newInspections);

      // Dispatch event for cross-module reflection
      window.dispatchEvent(new CustomEvent('inspectionDataUpdated', { 
        detail: { inspections: newInspections, action: 'addBank', newInspection: savedInspection, source: 'inspection-creation' } 
      }));

      toast({
        title: "Success!",
        description: `New inspection ${newInspectionCode} added with different bank`,
      });

      // Close modal and reset form
      setShowAddBankModal(false);
      setBankFormData({
        bankState: '',
        bank: '', // Combined bank field
        bankBranch: '', // Hidden field for storage
        bankName: '', // Hidden field for storage
        ifscCode: ''
      });
      setSelectedInspectionForBank(null);

    } catch (error) {
      console.error('Error adding bank to inspection:', error);
      toast({
        title: "Error",
        description: "Failed to add bank to inspection",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Form validation - check all required fields
    const requiredFields = [
      { field: formData.state, name: 'State' },
      { field: formData.branch, name: 'Branch' },
      { field: formData.location, name: 'Location' },
      { field: formData.businessType, name: 'Business Type' },
      { field: formData.warehouseStatus, name: 'Warehouse Status' },
      { field: formData.receiptType, name: 'Receipt Type' }
    ];

    // Add bank fields as required only if business type is CM (Collateral Management)
    if (formData.businessType === 'cm') {
      requiredFields.push(
        { field: formData.bankState, name: 'Bank State' },
        { field: formData.bankBranch, name: 'Bank Branch' },
        { field: formData.bankName, name: 'Bank Name' },
        { field: formData.ifscCode, name: 'IFSC Code' }
      );
    }

    // Check warehouse name based on status
    if (formData.warehouseStatus === 'new') {
      requiredFields.push({ field: formData.warehouseName, name: 'Warehouse Name' });
    } else if (formData.warehouseStatus === 'existing') {
      requiredFields.push({ field: formData.existingWarehouse, name: 'Existing Warehouse' });
    }

    // Find missing fields
    const missingFields = requiredFields.filter(item => !item.field || item.field.trim() === '');
    
    if (missingFields.length > 0) {
      toast({
        title: "Missing Required Fields",
        description: `Please fill in: ${missingFields.map(f => f.name).join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    // Validation for duplicate receipt types on existing warehouses
    if (formData.warehouseStatus === 'existing' && formData.existingWarehouse && formData.receiptType) {
      const selectedWarehouseName = formData.existingWarehouse;
      const selectedReceiptType = formData.receiptType;
      
      // Check if there's already an inspection for this warehouse with the same receipt type
      const duplicateInspection = inspections.find(inspection => {
        const sameWarehouse = inspection.warehouseName === selectedWarehouseName;
        const sameReceiptType = inspection.receiptType === (selectedReceiptType === 'storage' ? 'SR' : selectedReceiptType === 'warehouse' ? 'WR' : selectedReceiptType);
        const notCurrentInspection = (!isEditing || inspection.id !== editingInspectionId);
        
        // For CM business type, also check if bank is different
        if (formData.businessType === 'cm' && sameWarehouse && sameReceiptType && notCurrentInspection) {
          // If bank is different, allow creation (no duplicate)
          const sameBank = inspection.bankName === formData.bankName && 
                          inspection.bankBranch === formData.bankBranch && 
                          inspection.ifscCode === formData.ifscCode;
          return sameBank; // Only consider duplicate if bank is also same
        }
        
        // For non-CM business types, original logic (warehouse + receipt type)
        return sameWarehouse && sameReceiptType && notCurrentInspection;
      });

      if (duplicateInspection) {
        const receiptTypeDisplay = selectedReceiptType === 'storage' ? 'Storage Receipt (SR)' : 
                                 selectedReceiptType === 'warehouse' ? 'Warehouse Receipt (WR)' : 
                                 selectedReceiptType;
        
        if (formData.businessType === 'cm') {
          toast({
            title: "Duplicate Receipt Type with Same Bank",
            description: `An inspection for warehouse "${selectedWarehouseName}" with receipt type "${receiptTypeDisplay}" and the same bank already exists. Please change the bank or select a different receipt type.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Duplicate Receipt Type",
            description: `An inspection for warehouse "${selectedWarehouseName}" with receipt type "${receiptTypeDisplay}" already exists. Please select a different receipt type.`,
            variant: "destructive",
          });
        }
        return;
      }
    }
    
    // Convert receipt type for Firebase storage
    const convertReceiptType = (type: string) => {
      switch (type) {
        case 'storage':
          return 'SR';
        case 'warehouse':
          return 'WR';
        default:
          return type; // Keep as is if it's already SR/WR or other values
      }
    };
    
    try {
      if (isEditing && editingInspectionId) {
        // Update existing inspection
        const updatedInspection = {
          state: formData.state,
          branch: formData.branch,
          location: formData.location,
          businessType: formData.businessType,
          warehouseStatus: formData.warehouseStatus,
          warehouseName: formData.warehouseStatus === 'new' ? formData.warehouseName : formData.existingWarehouse,
          bankState: formData.bankState,
          bankBranch: formData.bankBranch,
          bankName: formData.bankName,
          ifscCode: formData.ifscCode,
          receiptType: convertReceiptType(formData.receiptType)
        };

        // Update in Firebase
        await updateDoc(doc(db, 'inspections', editingInspectionId), updatedInspection);
        
        // Update local state
        const updatedInspections = inspections.map(inspection => 
          inspection.id === editingInspectionId 
            ? { ...inspection, ...updatedInspection }
            : inspection
        );
        setInspections(updatedInspections);

        // Dispatch event for cross-module reflection
        window.dispatchEvent(new CustomEvent('inspectionDataUpdated', { 
          detail: { inspections: updatedInspections, action: 'update', updatedId: editingInspectionId, source: 'inspection-creation' } 
        }));

        toast({
          title: "Updated!",
          description: "Inspection updated successfully",
        });
      } else {
        // Create new inspection
        const selectedWarehouseName = formData.warehouseStatus === 'new' ? formData.warehouseName : formData.existingWarehouse;
        const { inspectionCode, warehouseCode } = generateCodes(selectedWarehouseName);
        
        const newInspection: Omit<InspectionData, 'id'> = {
          inspectionCode,
          warehouseCode,
          state: formData.state,
          branch: formData.branch,
          location: formData.location,
          businessType: formData.businessType,
          warehouseStatus: formData.warehouseStatus,
          warehouseName: selectedWarehouseName,
          bankState: formData.bankState,
          bankBranch: formData.bankBranch,
          bankName: formData.bankName,
          ifscCode: formData.ifscCode,
          receiptType: convertReceiptType(formData.receiptType),
          createdAt: new Date().toISOString()
        };

        // Save to Firebase
        const docRef = await addDoc(collection(db, 'inspections'), newInspection);
        
        // Update local state
        const savedInspection: InspectionData = {
          id: docRef.id,
          ...newInspection,
          createdAt: new Date().toLocaleDateString()
        };
        
        const updatedInspections = [...inspections, savedInspection];
        setInspections(updatedInspections);

        // Dispatch event for cross-module reflection
        window.dispatchEvent(new CustomEvent('inspectionDataUpdated', { 
          detail: { inspections: updatedInspections, action: 'create', newInspection: savedInspection, source: 'inspection-creation' } 
        }));

        // If new warehouse, add to existing warehouses list
        if (formData.warehouseStatus === 'new' && formData.warehouseName) {
          setExistingWarehouses(prev => [...prev, formData.warehouseName]);
        }

        toast({
          title: "Success!",
          description: `Inspection ${inspectionCode} created successfully`,
        });
      }

      // Reset form and editing state
      setFormData({
        state: '',
        branch: '',
        location: '',
        businessType: '',
        warehouseStatus: '',
        warehouseName: '',
        existingWarehouse: '',
        bankState: '',
        bank: '', // Combined bank field
        bankBranch: '', // Hidden field for storage
        bankName: '', // Hidden field for storage
        ifscCode: '',
        receiptType: ''
      });
      setIsEditing(false);
      setEditingInspectionId(null);

      // Close modal after successful submission
      setShowAddModal(false);

    } catch (error) {
      console.error('Error saving inspection:', error);
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? 'update' : 'create'} inspection`,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (inspection: InspectionData) => {
    // Convert receipt type from Firebase format to form format
    const convertReceiptTypeForForm = (type: string) => {
      switch (type) {
        case 'SR':
          return 'storage';
        case 'WR':
          return 'warehouse';
        default:
          return type; // Keep as is if it's already storage/warehouse or other values
      }
    };

    // Populate form with inspection data
    setFormData({
      state: inspection.state,
      branch: inspection.branch,
      location: inspection.location,
      businessType: inspection.businessType,
      warehouseStatus: inspection.warehouseStatus,
      warehouseName: inspection.warehouseName || '',
      existingWarehouse: inspection.warehouseStatus === 'existing' ? (inspection.warehouseName || '') : '',
      bankState: inspection.bankState,
      bank: inspection.bankName && inspection.bankBranch ? `${inspection.bankName}-${inspection.bankBranch}` : '',
      bankBranch: inspection.bankBranch,
      bankName: inspection.bankName,
      ifscCode: inspection.ifscCode,
      receiptType: convertReceiptTypeForForm(inspection.receiptType)
    });
    
    setIsEditing(true);
    setEditingInspectionId(inspection.id);
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      // Delete from Firebase database
      await deleteDoc(doc(db, 'inspections', id));
      
      // Update local state
      const updatedInspections = inspections.filter(inspection => inspection.id !== id);
      setInspections(updatedInspections);
      
      // Dispatch event for cross-module reflection
      window.dispatchEvent(new CustomEvent('inspectionDataUpdated', { 
        detail: { inspections: updatedInspections, action: 'delete', deletedId: id, source: 'inspection-creation' } 
      }));
      
      toast({
        title: "Deleted",
        description: "Inspection deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting inspection:', error);
      toast({
        title: "Error",
        description: "Failed to delete inspection",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header with Back Button and Add Inspection Button */}
        <div className="flex items-center justify-between gap-4">
          <button 
            onClick={() => router.back()}
            className="text-lg font-semibold tracking-tight bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 transition-colors whitespace-nowrap"
          >
            ← Dashboard
          </button>
          
          {/* Add New Inspection Button - Only for Maker and Admin */}
          {(userRole === 'maker' || userRole === 'admin') && (
            <button 
              onClick={() => {
                setShowAddModal(true);
                setIsEditing(false);
                setEditingInspectionId(null);
              }}
              className="text-lg font-semibold tracking-tight bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors whitespace-nowrap"
            >
              + Add Inspection
            </button>
          )}
        </div>

        {/* Centered Title with Light Orange Background */}
        <div className="flex justify-center">
          <h1 className="text-3xl font-bold tracking-tight text-orange-600 inline-block border-b-4 border-green-500 pb-2 px-6 py-3 bg-orange-100 rounded-lg">
            Inspection Creation
          </h1>
        </div>

        {/* Add/Edit Inspection Dialog */}
        <Dialog open={showAddModal} onOpenChange={(open) => {
          setShowAddModal(open);
          if (!open) {
            // Reset editing state when modal closes
            setIsEditing(false);
            setEditingInspectionId(null);
            setFormData({
              state: '',
              branch: '',
              location: '',
              businessType: '',
              warehouseStatus: '',
              warehouseName: '',
              existingWarehouse: '',
              bankState: '',
              bank: '',
              bankBranch: '',
              bankName: '',
              ifscCode: '',
              receiptType: ''
            });
          }
        }}>
          <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center text-base sm:text-lg">
                <ClipboardCheck className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                {isEditing ? 'Edit Inspection Survey' : 'New Inspection Survey'}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {isEditing ? 'Update the inspection details below.' : 'Fill out the details below to create a new inspection survey.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              {/* Location Section */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-medium border-b pb-2">Location Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="state">State <span className="text-red-500">*</span></Label>
                    <Select value={formData.state} onValueChange={(value) => setFormData(prev => ({ ...prev, state: value }))} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select State" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStates.filter(state => state && state.trim() !== '').map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="branch">Branch <span className="text-red-500">*</span></Label>
                    <Select value={formData.branch} onValueChange={(value) => setFormData(prev => ({ ...prev, branch: value }))} disabled={!formData.state} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBranches.filter(branch => branch && branch.trim() !== '').map(branch => (
                          <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location <span className="text-red-500">*</span></Label>
                    <Select value={formData.location} onValueChange={(value) => setFormData(prev => ({ ...prev, location: value }))} disabled={!formData.branch} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Location" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLocations.filter(location => location && location.trim() !== '').map(location => (
                          <SelectItem key={location} value={location}>{location}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Business Details */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-medium border-b pb-2">Business Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessType">Type of Business <span className="text-red-500">*</span></Label>
                    <Select value={formData.businessType} onValueChange={(value) => setFormData(prev => ({ ...prev, businessType: value }))} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Business Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cm">Collateral Management (CM)</SelectItem>
                        <SelectItem value="pwh">Professional Warehousing (PWH)</SelectItem>
                        <SelectItem value="ncdex">NCDEX</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="warehouseStatus">Warehouse Status <span className="text-red-500">*</span></Label>
                    <Select value={formData.warehouseStatus} onValueChange={(value) => setFormData(prev => ({ ...prev, warehouseStatus: value }))} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="existing">Existing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.warehouseStatus === 'new' && (
                  <div className="space-y-2">
                    <Label htmlFor="warehouseName">Warehouse Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="warehouseName"
                      value={formData.warehouseName}
                      onChange={(e) => setFormData(prev => ({ ...prev, warehouseName: e.target.value }))}
                      placeholder="Enter warehouse name"
                      required
                    />
                  </div>
                )}

                {formData.warehouseStatus === 'existing' && (
                  <div className="space-y-2">
                    <Label htmlFor="existingWarehouse">Select Existing Warehouse <span className="text-red-500">*</span></Label>
                    <Select value={formData.existingWarehouse} onValueChange={(value) => setFormData(prev => ({ ...prev, existingWarehouse: value }))} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        {existingWarehouses.filter(warehouse => warehouse && warehouse.trim() !== '').map(warehouse => (
                          <SelectItem key={warehouse} value={warehouse}>{warehouse}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Bank Section */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-medium border-b pb-2">Bank Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bankState">Bank State {formData.businessType === 'cm' && <span className="text-red-500">*</span>}</Label>
                    <Select value={formData.bankState} onValueChange={(value) => setFormData(prev => ({ ...prev, bankState: value }))} required={formData.businessType === 'cm'}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select State" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBankStates.filter(state => state && state.trim() !== '').map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bank">Bank {formData.businessType === 'cm' && <span className="text-red-500">*</span>}</Label>
                    <Select value={formData.bank} onValueChange={(value) => setFormData(prev => ({ ...prev, bank: value }))} disabled={!formData.bankState} required={formData.businessType === 'cm'}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Bank" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBanks.filter(bank => bank.label && bank.label.trim() !== '').map(bank => (
                          <SelectItem key={bank.label} value={bank.label}>{bank.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ifscCode">IFSC Code</Label>
                    <Input
                      id="ifscCode"
                      value={formData.ifscCode}
                      readOnly
                      placeholder="Auto-filled"
                      className="bg-gray-50"
                    />
                  </div>
                </div>
              </div>

              {/* Receipt Type */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-medium border-b pb-2">Receipt Details</h3>
                <div className="space-y-2">
                  <Label htmlFor="receiptType">Receipt Type <span className="text-red-500">*</span></Label>
                  <Select value={formData.receiptType} onValueChange={(value) => setFormData(prev => ({ ...prev, receiptType: value }))} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Receipt Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="storage">Storage Receipt(SR)</SelectItem>
                      <SelectItem value="warehouse">Warehouse Receipt(WR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

                <Button type="submit" className="w-full">
                  {isEditing ? 'Update Inspection' : 'Create Inspection'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

        {/* Search Bar */}
        {inspections.length > 0 && (
          <Card className="border-green-300">
            <CardHeader className="bg-green-50 p-4">
              <CardTitle className="text-base sm:text-lg text-green-700">Search & Filter</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
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
                <Button 
                  onClick={exportToCSV}
                  className="bg-blue-500 hover:bg-blue-600 text-white w-full sm:w-auto text-sm"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                {searchTerm && (
                  <Button
                    onClick={() => setSearchTerm('')}
                    variant="outline"
                    size="sm"
                    className="border-gray-300 text-gray-600 hover:bg-gray-50 w-full sm:w-auto"
                  >
                    Clear
                  </Button>
                )}
              </div>
              
              {/* Entry Count */}
              <div className="mt-3 text-xs sm:text-sm text-green-600">
                {searchTerm ? (
                  <>
                    <span className="font-medium">
                      {filteredAndSortedInspections.length} of {inspections.length} entries found for "{searchTerm}"
                    </span>
                  </>
                ) : (
                  <span className="font-medium">
                    Total Entries: {inspections.length}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Inspections Table */}
        {inspections.length > 0 && (
          <Card className="border-green-300">
            <CardHeader className="bg-green-50 p-4">
              <CardTitle className="text-base sm:text-lg text-green-700">Created Inspections</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-green-600">
                All created inspection surveys with their details and actions. Sorted by inspection code in ascending order.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <DataTable
                columns={inspectionColumns}
                data={filteredAndSortedInspections}
                wrapperClassName="border-green-300 min-w-full"
                headClassName="bg-orange-100 text-orange-600 font-bold text-center text-xs sm:text-sm"
                cellClassName="text-green-800 text-center text-xs sm:text-sm"
                stickyHeader={true}
                stickyFirstColumn={true}
                showGridLines={true}
              />
            </CardContent>
          </Card>
        )}

        {/* Add Bank Dialog */}
        <Dialog open={showAddBankModal} onOpenChange={setShowAddBankModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center text-base sm:text-lg">
                <Plus className="mr-2 h-5 w-5 text-blue-600" />
                Add Bank to Warehouse: {selectedInspectionForBank?.warehouseCode}
              </DialogTitle>
              <DialogDescription>
                Add a new bank for the existing warehouse. This will create a new inspection with the same warehouse details.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleBankSubmit} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-medium border-b pb-2">Bank Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bankState">Bank State <span className="text-red-500">*</span></Label>
                    <Select 
                      value={bankFormData.bankState} 
                      onValueChange={(value) => setBankFormData(prev => ({ ...prev, bankState: value }))} 
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select State" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBankStates.filter(state => state && state.trim() !== '').map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bank">Bank <span className="text-red-500">*</span></Label>
                    <Select 
                      value={bankFormData.bank} 
                      onValueChange={(value) => setBankFormData(prev => ({ ...prev, bank: value }))} 
                      disabled={!bankFormData.bankState} 
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Bank" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBanks.filter(bank => bank.label && bank.label.trim() !== '').map(bank => (
                          <SelectItem key={bank.label} value={bank.label}>{bank.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ifscCode">IFSC Code</Label>
                    <Input
                      id="ifscCode"
                      value={bankFormData.ifscCode}
                      readOnly
                      placeholder="Auto-filled"
                      className="bg-gray-50"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddBankModal(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-500 hover:bg-blue-600 w-full sm:w-auto">
                  Add Bank
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Warehouse Inspection Details Modal */}
        <Dialog open={showWarehouseInspectionModal} onOpenChange={setShowWarehouseInspectionModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center text-base sm:text-lg">
                <Eye className="mr-2 h-5 w-5 text-green-600" />
                Warehouse Inspection Details: {selectedWarehouseInspection?.warehouseCode}
              </DialogTitle>
              <DialogDescription>
                View the detailed warehouse inspection form for {selectedWarehouseInspection?.warehouseName}
              </DialogDescription>
            </DialogHeader>
            
            {selectedWarehouseInspection && (
              <div className="space-y-6">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">Status:</span>
                    {getStatusBadge(selectedWarehouseInspection.status)}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Navigate to warehouse creation page with this inspection
                      router.push('/surveys/warehouse-creation');
                    }}
                    className="bg-blue-50 text-blue-600 border-blue-300 hover:bg-blue-100"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View in Warehouse Creation
                  </Button>
                </div>

                {/* Basic Information */}
                <Card className="border-green-300">
                  <CardHeader className="bg-green-50 p-3 sm:p-4">
                    <CardTitle className="text-sm sm:text-base text-green-700">Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <Label className="font-medium">Warehouse Name:</Label>
                        <p className="text-gray-700">{selectedWarehouseInspection.warehouseName}</p>
                      </div>
                      <div>
                        <Label className="font-medium">Warehouse Code:</Label>
                        <p className="text-gray-700">{selectedWarehouseInspection.warehouseCode}</p>
                      </div>
                      <div>
                        <Label className="font-medium">Type of Warehouse:</Label>
                        <p className="text-gray-700">{selectedWarehouseInspection.typeOfWarehouse}</p>
                      </div>
                      <div>
                        <Label className="font-medium">Date of Inspection:</Label>
                        <p className="text-gray-700">
                          {selectedWarehouseInspection.dateOfInspection ? 
                            new Date(selectedWarehouseInspection.dateOfInspection).toLocaleDateString() : 
                            'N/A'
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Address */}
                {selectedWarehouseInspection.address && (
                  <Card className="border-green-300">
                    <CardHeader className="bg-green-50 p-3 sm:p-4">
                      <CardTitle className="text-sm sm:text-base text-green-700">Address</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4">
                      <p className="text-gray-700">{selectedWarehouseInspection.address}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Bank Details */}
                <Card className="border-green-300">
                  <CardHeader className="bg-green-50 p-3 sm:p-4">
                    <CardTitle className="text-sm sm:text-base text-green-700">Bank Details</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <Label className="font-medium">Bank State:</Label>
                        <p className="text-gray-700">{selectedWarehouseInspection.bankState}</p>
                      </div>
                      <div>
                        <Label className="font-medium">Bank Name :</Label>
                        <p className="text-gray-700">{selectedWarehouseInspection.bankBranch}</p>
                      </div>
                      <div>
                        <Label className="font-medium">Bank Branch:</Label>
                        <p className="text-gray-700">{selectedWarehouseInspection.bankName}</p>
                      </div>
                      <div>
                        <Label className="font-medium">IFSC Code:</Label>
                        <p className="text-gray-700">{selectedWarehouseInspection.ifscCode}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Warehouse Dimensions */}
                <Card className="border-green-300">
                  <CardHeader className="bg-green-50 p-3 sm:p-4">
                    <CardTitle className="text-sm sm:text-base text-green-700">Warehouse Dimensions</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                      <div>
                        <Label className="font-medium">Length (sq ft):</Label>
                        <p className="text-gray-700">{selectedWarehouseInspection.warehouseLength}</p>
                      </div>
                      <div>
                        <Label className="font-medium">Breadth (sq ft):</Label>
                        <p className="text-gray-700">{selectedWarehouseInspection.warehouseBreadth}</p>
                      </div>
                      <div>
                        <Label className="font-medium">Height (sq ft):</Label>
                        <p className="text-gray-700">{selectedWarehouseInspection.warehouseHeight}</p>
                      </div>
                      <div>
                        <Label className="font-medium">Capacity (MT):</Label>
                        <p className="text-green-600 font-semibold">
                          {selectedWarehouseInspection.warehouseCapacity}
                        </p>
                      </div>
                      <div>
                        <Label className="font-medium">Construction Year:</Label>
                        <p className="text-gray-700">{selectedWarehouseInspection.constructionYear}</p>
                      </div>
                      <div>
                        <Label className="font-medium">Total Chambers:</Label>
                        <p className="text-gray-700">{selectedWarehouseInspection.totalChambers}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* OE Details */}
                <Card className="border-green-300">
                  <CardHeader className="bg-green-50 p-3 sm:p-4">
                    <CardTitle className="text-sm sm:text-base text-green-700">Operational Executive Details</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <Label className="font-medium">Name of Operational Executive:</Label>
                        <p className="text-gray-700">{selectedWarehouseInspection.nameOfOE}</p>
                      </div>
                      <div>
                        <Label className="font-medium">Contact Number:</Label>
                        <p className="text-gray-700">{selectedWarehouseInspection.contactNumber}</p>
                      </div>
                      <div>
                        <Label className="font-medium">Place:</Label>
                        <p className="text-gray-700">{selectedWarehouseInspection.place}</p>
                      </div>
                      <div>
                        <Label className="font-medium">Date:</Label>
                        <p className="text-gray-700">
                          {selectedWarehouseInspection.oeDate ? 
                            new Date(selectedWarehouseInspection.oeDate).toLocaleDateString() : 
                            'N/A'
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowWarehouseInspectionModal(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
} 