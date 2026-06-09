"use client";

import DashboardLayout from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, ClipboardCheck, Plus, Download, Eye, Edit, Trash2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { CSVLink } from 'react-csv';
import { format, parseISO } from 'date-fns';

// Helper function to get status styling
const getStatusStyling = (status: string) => {
  const normalizedStatus = status?.toLowerCase().trim() || '';
  
  if (normalizedStatus === 'pending' || normalizedStatus === 'inactive' || normalizedStatus === 'closed') {
    return 'bg-yellow-100 text-black px-2 py-1 rounded-full text-xs font-medium inline-block';
  }
  
  if (normalizedStatus === 'approved' || normalizedStatus === 'activate' || normalizedStatus === 'reactivate' || 
      normalizedStatus === 'approve' || normalizedStatus === 'reactive' || normalizedStatus === 'activated' || 
      normalizedStatus === 'submitted') {
    return 'bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium inline-block';
  }
  
  if (normalizedStatus === 'resubmit' || normalizedStatus === 'reject' || normalizedStatus === 'rejected' || 
      normalizedStatus === 'resubmitted') {
    return 'bg-pink-100 text-red-600 px-2 py-1 rounded-full text-xs font-medium inline-block';
  }
  
  return 'bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium inline-block';
};

// Data interfaces
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
  
  // Data from Firebase
  const [branchesData, setBranchesData] = useState<BranchData[]>([]);
  const [banksData, setBanksData] = useState<BankData[]>([]);
  const [inspections, setInspections] = useState<InspectionData[]>([]);
  const [existingWarehouses, setExistingWarehouses] = useState<string[]>([]);
  const [warehouseInspections, setWarehouseInspections] = useState<WarehouseInspectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
    bank: '',
    bankBranch: '',
    bankName: '',
    ifscCode: '',
    receiptType: ''
  });

  // Dropdown options state
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
  
  // Bank form state
  const [bankFormData, setBankFormData] = useState({
    bankState: '',
    bank: '',
    bankBranch: '',
    bankName: '',
    ifscCode: ''
  });

  const columns: ColumnDef<InspectionData>[] = [
    { accessorKey: "inspectionCode", header: "Inspection Code" },
    { accessorKey: "warehouseCode", header: "Warehouse Code" },
    { accessorKey: "state", header: "State" },
    { accessorKey: "branch", header: "Branch" },
    { accessorKey: "location", header: "Location" },
    { accessorKey: "businessType", header: "Business Type", cell: ({ row }) => row.original.businessType.toUpperCase() },
    { accessorKey: "warehouseName", header: "Warehouse Name" },
    { accessorKey: "bankState", header: "Bank State" },
    { accessorKey: "bankBranch", header: "Bank Branch" },
    { accessorKey: "bankName", header: "Bank Name" },
    { accessorKey: "ifscCode", header: "IFSC Code" },
    { accessorKey: "receiptType", header: "Receipt Type" },
    { 
      accessorKey: "createdAt", 
      header: "Created Date",
      cell: ({ row }) => format(parseISO(row.original.createdAt), 'dd/MM/yyyy')
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex space-x-2 justify-center">
          <Button variant="outline" size="sm" onClick={() => handleEdit(row.original)} className="border-orange-300 text-orange-600 hover:bg-orange-50" title="Edit Inspection">
            <Edit className="w-4 h-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-red-300 text-red-600 hover:bg-red-50" title="Delete Inspection">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Inspection</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete inspection <strong>{row.original.inspectionCode}</strong>? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDelete(row.original.id)} className="bg-red-500 hover:bg-red-600">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" size="sm" onClick={() => handleAddBankClick(row.original)} className="border-blue-300 text-blue-600 hover:bg-blue-50" title="Add Bank">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [branchesSnapshot, banksSnapshot, inspectionsSnapshot, warehouseInspectionsSnapshot] = await Promise.all([
        getDocs(collection(db, 'branches')),
        getDocs(collection(db, 'banks')),
        getDocs(collection(db, 'inspections')),
        getDocs(collection(db, 'warehouse-inspections'))
      ]);

      const branches = branchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), locations: doc.data().locations || [] })) as BranchData[];
      setBranchesData(branches);

      const banks = banksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), locations: doc.data().locations || [] })) as BankData[];
      setBanksData(banks);

      const inspectionsData = inspectionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InspectionData[];
      setInspections(inspectionsData);
      
      // Cross-module reflection
      window.dispatchEvent(new CustomEvent('inspectionDataUpdated', { detail: { inspections: inspectionsData } }));


      const warehouses = inspectionsData.filter(i => i.warehouseName).map(i => i.warehouseName!).filter((v, i, a) => a.indexOf(v) === i);
      setExistingWarehouses(warehouses);

      const warehouseInspectionsData = warehouseInspectionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as WarehouseInspectionData[];
      setWarehouseInspections(warehouseInspectionsData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredInspections = useMemo(() => {
    return inspections
      .filter(inspection =>
        Object.values(inspection).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
      .sort((a, b) => a.inspectionCode.localeCompare(b.inspectionCode));
  }, [inspections, searchTerm]);

  const csvData = useMemo(() => {
    if (filteredInspections.length === 0) return [];
    
    const headers = [
      'Inspection Code', 'Warehouse Code', 'State', 'Branch', 'Location', 
      'Business Type', 'Warehouse Name', 'Bank State', 'Bank Branch', 
      'Bank Name', 'IFSC Code', 'Receipt Type', 'Created Date'
    ];

    const data = filteredInspections.map(i => [
      i.inspectionCode, i.warehouseCode, i.state, i.branch, i.location,
      i.businessType.toUpperCase(), i.warehouseName || '', i.bankState, i.bankBranch,
      i.bankName, i.ifscCode, i.receiptType, format(parseISO(i.createdAt), 'dd/MM/yyyy')
    ]);

    return [headers, ...data];
  }, [filteredInspections]);


  // Dynamic dropdown logic
  useEffect(() => {
    if (branchesData.length > 0) {
      setAvailableStates(Array.from(new Set(branchesData.map(b => b.state))));
    }
  }, [branchesData]);

  useEffect(() => {
    if (banksData.length > 0) {
      setAvailableBankStates(Array.from(new Set(banksData.map(b => b.state))));
    }
  }, [banksData]);

  useEffect(() => {
    if (formData.state) {
      const branches = branchesData.filter(b => b.state === formData.state);
      setAvailableBranches(Array.from(new Set(branches.map(b => b.branch))));
      setFormData(prev => ({ ...prev, branch: '', location: '' }));
    }
  }, [formData.state, branchesData]);

  useEffect(() => {
    if (formData.branch) {
      const branch = branchesData.find(b => b.state === formData.state && b.branch === formData.branch);
      if (branch) {
        setAvailableLocations(branch.locations.map(l => l.locationName));
      }
      setFormData(prev => ({ ...prev, location: '' }));
    }
  }, [formData.branch, formData.state, branchesData]);

  useEffect(() => {
    const updateBankOptions = (state: string, setBankOpts: Function, resetFields: object) => {
      if (state) {
        const banksInState = banksData.filter(b => b.state === state);
        const banksWithDetails: {label: string, bankName: string, branchName: string, ifscCode: string}[] = [];
        banksInState.forEach(bank => {
          bank.locations.forEach(location => {
            if (location.branchName && location.branchName.trim() !== '' && location.ifscCode && location.locationName) {
              banksWithDetails.push({
                label: `${location.locationName}-${location.branchName}`,
                bankName: location.locationName,
                branchName: location.branchName,
                ifscCode: location.ifscCode
              });
            }
          });
        });
        setBankOpts(banksWithDetails);
        setFormData(prev => ({ ...prev, ...resetFields }));
      }
    };
    updateBankOptions(formData.bankState, setAvailableBanks, { bank: '', bankBranch: '', bankName: '', ifscCode: '' });
  }, [formData.bankState, banksData]);

  useEffect(() => {
    if (formData.bank) {
      const selectedBank = availableBanks.find(b => b.label === formData.bank);
      if (selectedBank) {
        setFormData(prev => ({ ...prev, bankName: selectedBank.bankName, bankBranch: selectedBank.branchName, ifscCode: selectedBank.ifscCode }));
      }
    }
  }, [formData.bank, availableBanks]);
  
  useEffect(() => {
    if (bankFormData.bankState) {
        const banksInState = banksData.filter(bank => bank.state === bankFormData.bankState);
        const banksWithDetails: {label: string, bankName: string, branchName: string, ifscCode: string}[] = [];
        banksInState.forEach(bank => {
            bank.locations.forEach(location => {
                if (location.branchName && location.branchName.trim() !== '' && location.ifscCode && location.locationName) {
                    banksWithDetails.push({
                        label: `${location.locationName}-${location.branchName}`,
                        bankName: location.locationName,
                        branchName: location.branchName,
                        ifscCode: location.ifscCode
                    });
                }
            });
        });
        setAvailableBanks(banksWithDetails);
        setBankFormData(prev => ({ ...prev, bank: '', bankBranch: '', bankName: '', ifscCode: '' }));
    }
}, [bankFormData.bankState, banksData]);

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


  const generateCodes = (selectedWarehouse?: string) => {
    const inspectionCount = inspections.length + 1;
    const inspectionCode = `SUR-${inspectionCount.toString().padStart(4, '0')}`;
    
    if (selectedWarehouse && formData.warehouseStatus === 'existing') {
      const existingInspection = inspections.find(i => i.warehouseName === selectedWarehouse);
      if (existingInspection) {
        return { inspectionCode, warehouseCode: existingInspection.warehouseCode };
      }
    }
    
    const warehouseCode = `WH-${inspectionCount.toString().padStart(4, '0')}`;
    return { inspectionCode, warehouseCode };
  };

  const handleAddBankClick = (inspection: InspectionData) => {
    setSelectedInspectionForBank(inspection);
    setBankFormData({ bankState: '', bank: '', bankBranch: '', bankName: '', ifscCode: '' });
    setShowAddBankModal(true);
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInspectionForBank) return;

    const requiredBankFields = [
      { field: bankFormData.bankState, name: 'Bank State' },
      { field: bankFormData.bankBranch, name: 'Bank Branch' },
      { field: bankFormData.bankName, name: 'Bank Name' },
      { field: bankFormData.ifscCode, name: 'IFSC Code' }
    ];

    const missingFields = requiredBankFields.filter(item => !item.field || item.field.trim() === '');
    if (missingFields.length > 0) {
      toast({ title: "Missing Required Fields", description: `Please fill in: ${missingFields.map(f => f.name).join(', ')}`, variant: "destructive" });
      return;
    }

    const duplicateBank = inspections.find(i => 
      i.warehouseCode === selectedInspectionForBank.warehouseCode &&
      i.bankState === bankFormData.bankState &&
      i.bankBranch === bankFormData.bankBranch &&
      i.bankName === bankFormData.bankName &&
      i.ifscCode === bankFormData.ifscCode
    );

    if (duplicateBank) {
      toast({ title: "Duplicate Bank Error", description: `This bank is already associated with warehouse ${selectedInspectionForBank.warehouseCode}`, variant: "destructive" });
      return;
    }

    try {
      const newInspectionCode = `SUR-${(inspections.length + 1).toString().padStart(4, '0')}`;
      const newInspection: Omit<InspectionData, 'id'> = {
        inspectionCode: newInspectionCode,
        warehouseCode: selectedInspectionForBank.warehouseCode,
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

      await addDoc(collection(db, 'inspections'), newInspection);
      fetchData();
      toast({ title: "Success!", description: `New inspection ${newInspectionCode} added.` });
      setShowAddBankModal(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to add bank to inspection", variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const requiredFields = [
      { field: formData.state, name: 'State' }, { field: formData.branch, name: 'Branch' },
      { field: formData.location, name: 'Location' }, { field: formData.businessType, name: 'Business Type' },
      { field: formData.warehouseStatus, name: 'Warehouse Status' }, { field: formData.receiptType, name: 'Receipt Type' }
    ];

    if (formData.businessType === 'cm') {
      requiredFields.push(
        { field: formData.bankState, name: 'Bank State' }, { field: formData.bankBranch, name: 'Bank Branch' },
        { field: formData.bankName, name: 'Bank Name' }, { field: formData.ifscCode, name: 'IFSC Code' }
      );
    }

    if (formData.warehouseStatus === 'new') {
      requiredFields.push({ field: formData.warehouseName, name: 'Warehouse Name' });
    } else if (formData.warehouseStatus === 'existing') {
      requiredFields.push({ field: formData.existingWarehouse, name: 'Existing Warehouse' });
    }

    const missingFields = requiredFields.filter(item => !item.field || item.field.trim() === '');
    if (missingFields.length > 0) {
      toast({ title: "Missing Required Fields", description: `Please fill in: ${missingFields.map(f => f.name).join(', ')}`, variant: "destructive" });
      return;
    }

    const convertReceiptType = (type: string) => type === 'storage' ? 'SR' : type === 'warehouse' ? 'WR' : type;
    
    try {
      if (isEditing && editingInspectionId) {
        const updatedInspection = {
          state: formData.state, branch: formData.branch, location: formData.location,
          businessType: formData.businessType, warehouseStatus: formData.warehouseStatus,
          warehouseName: formData.warehouseStatus === 'new' ? formData.warehouseName : formData.existingWarehouse,
          bankState: formData.bankState, bankBranch: formData.bankBranch, bankName: formData.bankName,
          ifscCode: formData.ifscCode, receiptType: convertReceiptType(formData.receiptType)
        };
        await updateDoc(doc(db, 'inspections', editingInspectionId), updatedInspection);
        toast({ title: "Updated!", description: "Inspection updated successfully" });
      } else {
        const selectedWarehouseName = formData.warehouseStatus === 'new' ? formData.warehouseName : formData.existingWarehouse;
        const { inspectionCode, warehouseCode } = generateCodes(selectedWarehouseName);
        const newInspection: Omit<InspectionData, 'id'> = {
          inspectionCode, warehouseCode, state: formData.state, branch: formData.branch,
          location: formData.location, businessType: formData.businessType,
          warehouseStatus: formData.warehouseStatus, warehouseName: selectedWarehouseName,
          bankState: formData.bankState, bankBranch: formData.bankBranch, bankName: formData.bankName,
          ifscCode: formData.ifscCode, receiptType: convertReceiptType(formData.receiptType),
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'inspections'), newInspection);
        toast({ title: "Success!", description: `Inspection ${inspectionCode} created successfully` });
      }
      fetchData();
      setShowAddModal(false);
      setIsEditing(false);
      setEditingInspectionId(null);
      setFormData({
        state: '', branch: '', location: '', businessType: '', warehouseStatus: '',
        warehouseName: '', existingWarehouse: '', bankState: '', bank: '',
        bankBranch: '', bankName: '', ifscCode: '', receiptType: ''
      });
    } catch (error) {
      toast({ title: "Error", description: `Failed to ${isEditing ? 'update' : 'create'} inspection`, variant: "destructive" });
    }
  };

  const handleEdit = (inspection: InspectionData) => {
    const convertReceiptTypeForForm = (type: string) => type === 'SR' ? 'storage' : type === 'WR' ? 'warehouse' : type;
    setFormData({
      state: inspection.state, branch: inspection.branch, location: inspection.location,
      businessType: inspection.businessType, warehouseStatus: inspection.warehouseStatus,
      warehouseName: inspection.warehouseName || '',
      existingWarehouse: inspection.warehouseStatus === 'existing' ? (inspection.warehouseName || '') : '',
      bankState: inspection.bankState,
      bank: inspection.bankName && inspection.bankBranch ? `${inspection.bankName}-${inspection.bankBranch}` : '',
      bankBranch: inspection.bankBranch, bankName: inspection.bankName, ifscCode: inspection.ifscCode,
      receiptType: convertReceiptTypeForForm(inspection.receiptType)
    });
    setIsEditing(true);
    setEditingInspectionId(inspection.id);
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'inspections', id));
      fetchData();
      toast({ title: "Deleted", description: "Inspection deleted successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete inspection", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Inspection Creation</h1>
          <div className="flex space-x-2">
            <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
              <DialogTrigger asChild>
                <Button className="bg-green-500 hover:bg-green-600 text-white">
                  <Plus className="mr-2 h-4 w-4" /> Add New Inspection
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{isEditing ? 'Edit Inspection Survey' : 'New Inspection Survey'}</DialogTitle>
                  <DialogDescription>{isEditing ? 'Update the details.' : 'Fill out the form to create a new inspection.'}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
              {/* Location Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">Location Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="state">State <span className="text-red-500">*</span></Label>
                    <Select value={formData.state} onValueChange={(value) => setFormData(prev => ({ ...prev, state: value }))} required>
                      <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
                      <SelectContent>
                        {availableStates.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="branch">Branch <span className="text-red-500">*</span></Label>
                    <Select value={formData.branch} onValueChange={(value) => setFormData(prev => ({ ...prev, branch: value }))} disabled={!formData.state} required>
                      <SelectTrigger><SelectValue placeholder="Select Branch" /></SelectTrigger>
                      <SelectContent>
                        {availableBranches.map(branch => <SelectItem key={branch} value={branch}>{branch}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location <span className="text-red-500">*</span></Label>
                    <Select value={formData.location} onValueChange={(value) => setFormData(prev => ({ ...prev, location: value }))} disabled={!formData.branch} required>
                      <SelectTrigger><SelectValue placeholder="Select Location" /></SelectTrigger>
                      <SelectContent>
                        {availableLocations.map(location => <SelectItem key={location} value={location}>{location}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Business Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">Business Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessType">Type of Business <span className="text-red-500">*</span></Label>
                    <Select value={formData.businessType} onValueChange={(value) => setFormData(prev => ({ ...prev, businessType: value }))} required>
                      <SelectTrigger><SelectValue placeholder="Select Business Type" /></SelectTrigger>
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
                      <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
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
                    <Input id="warehouseName" value={formData.warehouseName} onChange={(e) => setFormData(prev => ({ ...prev, warehouseName: e.target.value }))} placeholder="Enter warehouse name" required />
                  </div>
                )}
                {formData.warehouseStatus === 'existing' && (
                  <div className="space-y-2">
                    <Label htmlFor="existingWarehouse">Select Existing Warehouse <span className="text-red-500">*</span></Label>
                    <Select value={formData.existingWarehouse} onValueChange={(value) => setFormData(prev => ({ ...prev, existingWarehouse: value }))} required>
                      <SelectTrigger><SelectValue placeholder="Select Warehouse" /></SelectTrigger>
                      <SelectContent>
                        {existingWarehouses.map(warehouse => <SelectItem key={warehouse} value={warehouse}>{warehouse}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Bank Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">Bank Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bankState">Bank State {formData.businessType === 'cm' && <span className="text-red-500">*</span>}</Label>
                    <Select value={formData.bankState} onValueChange={(value) => setFormData(prev => ({ ...prev, bankState: value }))} required={formData.businessType === 'cm'}>
                      <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
                      <SelectContent>
                        {availableBankStates.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank">Bank {formData.businessType === 'cm' && <span className="text-red-500">*</span>}</Label>
                    <Select value={formData.bank} onValueChange={(value) => setFormData(prev => ({ ...prev, bank: value }))} disabled={!formData.bankState} required={formData.businessType === 'cm'}>
                      <SelectTrigger><SelectValue placeholder="Select Bank" /></SelectTrigger>
                      <SelectContent>
                        {availableBanks.map(bank => <SelectItem key={bank.label} value={bank.label}>{bank.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ifscCode">IFSC Code</Label>
                    <Input id="ifscCode" value={formData.ifscCode} readOnly placeholder="Auto-filled" className="bg-gray-50" />
                  </div>
                </div>
              </div>

              {/* Receipt Type */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">Receipt Details</h3>
                <div className="space-y-2">
                  <Label htmlFor="receiptType">Receipt Type <span className="text-red-500">*</span></Label>
                  <Select value={formData.receiptType} onValueChange={(value) => setFormData(prev => ({ ...prev, receiptType: value }))} required>
                    <SelectTrigger><SelectValue placeholder="Select Receipt Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="storage">Storage Receipt(SR)</SelectItem>
                      <SelectItem value="warehouse">Warehouse Receipt(WR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full">{isEditing ? 'Update Inspection' : 'Create Inspection'}</Button>
            </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Manage Inspections</CardTitle>
              <CSVLink data={csvData} filename={"inspections.csv"}>
                <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
              </CSVLink>
            </div>
            <div className="mt-4 relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search inspections..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              Showing {filteredInspections.length} of {inspections.length} entries.
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={filteredInspections}
              isLoading={loading}
              error={error || undefined}
              stickyHeader
              stickyFirstColumn
              showGridLines
            />
          </CardContent>
        </Card>

        <Dialog open={showAddBankModal} onOpenChange={setShowAddBankModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Bank to Warehouse: {selectedInspectionForBank?.warehouseCode}</DialogTitle>
              <DialogDescription>Create a new inspection with a different bank for the same warehouse.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleBankSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bankState">Bank State <span className="text-red-500">*</span></Label>
                  <Select value={bankFormData.bankState} onValueChange={(value) => setBankFormData(prev => ({ ...prev, bankState: value }))} required>
                    <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
                    <SelectContent>
                      {availableBankStates.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank">Bank <span className="text-red-500">*</span></Label>
                  <Select value={bankFormData.bank} onValueChange={(value) => setBankFormData(prev => ({ ...prev, bank: value }))} disabled={!bankFormData.bankState} required>
                    <SelectTrigger><SelectValue placeholder="Select Bank" /></SelectTrigger>
                    <SelectContent>
                      {availableBanks.map(bank => <SelectItem key={bank.label} value={bank.label}>{bank.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ifscCode">IFSC Code</Label>
                  <Input id="ifscCode" value={bankFormData.ifscCode} readOnly placeholder="Auto-filled" className="bg-gray-50" />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowAddBankModal(false)}>Cancel</Button>
                <Button type="submit">Add Bank</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
