"use client";

import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Download, Plus, Edit, Trash2, Minus, Pause } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader as DialogHeaderUI, DialogTitle as DialogTitleUI } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, query, where } from 'firebase/firestore';
import { Select as SelectUI, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/data-table';
import Select from 'react-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/utils';

export default function InsuranceMasterPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const { toast } = useToast();

  // Data states
  const [states, setStates] = useState<string[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [commodities, setCommodities] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [insuranceData, setInsuranceData] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [expandedWarehouses, setExpandedWarehouses] = useState<Set<string>>(new Set());

  // Form state
  const [form, setForm] = useState<any>({
    state: '',
    branch: '',
    location: '',
    warehouse: '',
    commodities: [],
    banks: [],
    insuranceManagedBy: '',
    firePolicyNumber: '',
    firePolicyAmount: '',
    firePolicyStart: '',
    firePolicyEnd: '',
    burglaryPolicyNumber: '',
    burglaryPolicyAmount: '',
    burglaryPolicyStart: '',
    burglaryPolicyEnd: '',
    firePolicyCompanyName: '',
    burglaryPolicyCompanyName: '',
    clientName: '',
    clientId: '',
    bankFundedBy: '',
    // New insurance form fields
    insuranceType: '',
    commodity: '',
    clientAddress: '',
    firePolicyStartDate: '',
    firePolicyEndDate: '',
    burglaryPolicyStartDate: '',
    burglaryPolicyEndDate: '',
  });
  const [selectedBankDetails, setSelectedBankDetails] = useState<any[]>([]);

  // Edit modal state
  const [editRow, setEditRow] = useState<any>(null);

  // Table columns for insurance entries from warehouse inspections
  const columns: { key: string; label: string }[] = [
    { key: 'warehouseName', label: 'Warehouse Name' },
    { key: 'warehouseCode', label: 'Warehouse Code' },
    { key: 'insuranceTakenBy', label: 'Insurance Taken By' },
    { key: 'insuranceCommodity', label: 'Commodity' },
    { key: 'firePolicyCompanyName', label: 'Fire Policy Company Name' },
    { key: 'firePolicyNumber', label: 'Fire Policy Number' },
    { key: 'firePolicyAmount', label: 'Fire Policy Amount' },
    { key: 'firePolicyStartDate', label: 'Fire Policy Start Date' },
    { key: 'firePolicyEndDate', label: 'Fire Policy End Date' },
    { key: 'burglaryPolicyCompanyName', label: 'Burglary Policy Company Name' },
    { key: 'burglaryPolicyNumber', label: 'Burglary Policy Number' },
    { key: 'burglaryPolicyAmount', label: 'Burglary Policy Amount' },
    { key: 'burglaryPolicyStartDate', label: 'Burglary Policy Start Date' },
    { key: 'burglaryPolicyEndDate', label: 'Burglary Policy End Date' },
    { key: 'clientName', label: 'Client Name' },
    { key: 'clientAddress', label: 'Client Address' },
    { key: 'selectedBankName', label: 'Bank Name' },
    { key: 'createdAt', label: 'Created At' },
  ];

  // Fetch insurance entries from activated warehouses
  const fetchWarehouseInsurance = useCallback(async () => {
    const snap = await getDocs(collection(db, 'inspections'));
    const insuranceEntries: any[] = [];
    snap.docs.forEach(doc => {
      const data = doc.data();
      if (data.status === 'activated'||data.status === 'reactivate') {
        // Helper to get state/branch/location robustly
        const getField = (field: string) =>
          data[field] || (data.warehouseInspectionData && data.warehouseInspectionData[field]) || '';
        // 1. Top-level insuranceEntries array
        if (Array.isArray(data.insuranceEntries) && data.insuranceEntries.length > 0) {
          data.insuranceEntries.forEach((entry: any, idx: number) => {
            insuranceEntries.push({
              ...entry,
              id: entry.id || `${doc.id}_top_${idx}`,
              warehouseName: data.warehouseName || '',
              warehouseCode: data.warehouseCode || '',
              state: getField('state'),
              branch: getField('branch'),
              location: getField('location'),
            });
          });
        }
        // 2. Nested insuranceEntries in warehouseInspectionData
        else if (data.warehouseInspectionData && Array.isArray(data.warehouseInspectionData.insuranceEntries) && data.warehouseInspectionData.insuranceEntries.length > 0) {
          data.warehouseInspectionData.insuranceEntries.forEach((entry: any, idx: number) => {
            insuranceEntries.push({
              ...entry,
              id: entry.id || `${doc.id}_nested_${idx}`,
              warehouseName: data.warehouseName || '',
              warehouseCode: data.warehouseCode || '',
              state: getField('state'),
              branch: getField('branch'),
              location: getField('location'),
            });
          });
        }
        // 3. Legacy: single insurance fields at top-level or in warehouseInspectionData
        else {
          const legacy = data.insuranceTakenBy || (data.warehouseInspectionData && data.warehouseInspectionData.insuranceTakenBy);
          if (legacy) {
            const entry = {
              insuranceTakenBy: data.insuranceTakenBy || (data.warehouseInspectionData && data.warehouseInspectionData.insuranceTakenBy) || '',
              insuranceCommodity: data.insuranceCommodity || (data.warehouseInspectionData && data.warehouseInspectionData.insuranceCommodity) || '',
              clientName: data.clientName || (data.warehouseInspectionData && data.warehouseInspectionData.clientName) || '',
              clientAddress: data.clientAddress || (data.warehouseInspectionData && data.warehouseInspectionData.clientAddress) || '',
              selectedBankName: data.selectedBankName || (data.warehouseInspectionData && data.warehouseInspectionData.selectedBankName) || '',
              firePolicyCompanyName: data.firePolicyCompanyName || (data.warehouseInspectionData && data.warehouseInspectionData.firePolicyCompanyName) || '',
              firePolicyNumber: data.firePolicyNumber || (data.warehouseInspectionData && data.warehouseInspectionData.firePolicyNumber) || '',
              firePolicyAmount: data.firePolicyAmount || (data.warehouseInspectionData && data.warehouseInspectionData.firePolicyAmount) || '',
              firePolicyStartDate: data.firePolicyStartDate || (data.warehouseInspectionData && data.warehouseInspectionData.firePolicyStartDate) || '',
              firePolicyEndDate: data.firePolicyEndDate || (data.warehouseInspectionData && data.warehouseInspectionData.firePolicyEndDate) || '',
              burglaryPolicyCompanyName: data.burglaryPolicyCompanyName || (data.warehouseInspectionData && data.warehouseInspectionData.burglaryPolicyCompanyName) || '',
              burglaryPolicyNumber: data.burglaryPolicyNumber || (data.warehouseInspectionData && data.warehouseInspectionData.burglaryPolicyNumber) || '',
              burglaryPolicyAmount: data.burglaryPolicyAmount || (data.warehouseInspectionData && data.warehouseInspectionData.burglaryPolicyAmount) || '',
              burglaryPolicyStartDate: data.burglaryPolicyStartDate || (data.warehouseInspectionData && data.warehouseInspectionData.burglaryPolicyStartDate) || '',
              burglaryPolicyEndDate: data.burglaryPolicyEndDate || (data.warehouseInspectionData && data.warehouseInspectionData.burglaryPolicyEndDate) || '',
              createdAt: data.createdAt || (data.warehouseInspectionData && data.warehouseInspectionData.createdAt) || '',
              id: `${doc.id}_legacy`,
              warehouseName: data.warehouseName || '',
              warehouseCode: data.warehouseCode || '',
              state: getField('state'),
              branch: getField('branch'),
              location: getField('location'),
            };
            insuranceEntries.push(entry);
          }
        }
      }
    });
    setInsuranceData(insuranceEntries);
  }, []);

  // Fetch banks for display (if needed for bank name mapping)
  useEffect(() => {
    const fetchBanks = async () => {
      const bankSnap = await getDocs(collection(db, 'banks'));
      setBanks(bankSnap.docs.map(doc => doc.data()));
    };
    fetchBanks();
    fetchWarehouseInsurance();
  }, [fetchWarehouseInsurance]);

  // Table cell rendering
  function renderCell(row: any, col: { key: string; label: string }) {
    let value = row[col.key];
    if (col.key.toLowerCase().includes('date') && value) {
      value = formatDate(value);
    }
    if (value === undefined || value === null || value === '') {
      return <span className="text-gray-400">-</span>;
    }
    return <span className="text-green-700">{value}</span>;
  }

  // Get unique warehouses for the filter dropdown
  const warehouseOptions = useMemo(() => {
    const seen = new Set();
    return insuranceData
      .map(entry => ({
        value: entry.warehouseCode || entry.warehouseName,
        label: `${entry.warehouseName || ''} (${entry.warehouseCode || ''})`,
      }))
      .filter(option => {
        if (seen.has(option.value)) return false;
        seen.add(option.value);
        return true;
      });
  }, [insuranceData]);

  // Filtered insurance data based on search term and selected warehouse
  const filteredInsuranceData = insuranceData.filter((row: any) => {
    const search = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !search ||
      (row.warehouseName && row.warehouseName.toLowerCase().includes(search)) ||
      (row.insuranceTakenBy && row.insuranceTakenBy.toLowerCase().includes(search)) ||
      (row.insuranceCommodity && row.insuranceCommodity.toLowerCase().includes(search));
    const matchesWarehouse =
      !selectedWarehouse ||
      row.warehouseCode === selectedWarehouse ||
      row.warehouseName === selectedWarehouse;
    return matchesSearch && matchesWarehouse;
  });

  // Fetch all data on modal open
  useEffect(() => {
    if (!showAddModal && !editRow) return;
    const fetchData = async () => {
      // States
      setStates([
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
      ]);
      // Branches
      const branchSnap = await getDocs(collection(db, 'branches'));
      setBranches(branchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      // Commodities
      const commoditySnap = await getDocs(collection(db, 'commodities'));
      setCommodities(commoditySnap.docs.map(doc => doc.data()));
      // Clients
      const clientSnap = await getDocs(collection(db, 'clients'));
      setClients(clientSnap.docs.map(doc => doc.data()));
      // Warehouses (from inspections)
      const inspectionSnap = await getDocs(collection(db, 'inspections'));
      setWarehouses(inspectionSnap.docs.map(doc => doc.data()));
    };
    fetchData();
    fetchWarehouseInsurance();
  }, [showAddModal, editRow, fetchWarehouseInsurance]);

  // Dependent dropdowns
  useEffect(() => {
    if (!form.state) {
      setLocations([]);
      return;
    }
    const filteredBranches = branches.filter((b: any) => b.state === form.state);
    if (form.branch) {
      const branchObj = filteredBranches.find((b: any) => b.branch === form.branch);
      setLocations(branchObj?.locations || []);
    } else {
      setLocations([]);
    }
  }, [form.state, form.branch, branches]);

  // Bank details for selected banks
  useEffect(() => {
    if (!form.banks.length) {
      setSelectedBankDetails([]);
      return;
    }
    setSelectedBankDetails(
      banks.filter((b: any) => form.banks.includes(b.bankName) && b.state === form.state && b.branchName === form.branch)
    );
  }, [form.banks, banks, form.state, form.branch]);

  // Warehouse dropdown filtered by location and status
  const filteredWarehouses = warehouses.filter((wh: any) =>
    wh.location === form.location && (wh.status === 'activate' || wh.status === 'reactivate')
  );

  // Commodity multi-select options
  const commodityOptions = commodities.map((c: any) => c.commodityName);

  // Bank multi-select options
  const bankOptions = banks.filter((b: any) => b.state === form.state && b.branchName === form.branch).map((b: any) => b.bankName);

  // Client dropdown options
  const clientOptions = clients.map((c: any) => ({ name: c.firmName, id: c.clientId }));

  // Bank locations for selected state
  const bankLocationOptions = banks
    .flatMap((bank: any) =>
      (bank.locations || []).map((loc: any) => ({
        bankName: bank.bankName,
        bankId: bank.bankId,
        state: loc.state || form.state, // fallback to selected state if not present
        branchName: loc.branchName,
        ifscCode: loc.ifscCode,
        locationId: loc.locationId,
        locationName: loc.locationName,
      }))
    )
    .filter((loc: any) => loc.state === form.state);

  // Handle form changes
  const handleChange = (field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
    if (field === 'clientName') {
      const client = clients.find((c: any) => c.firmName === value);
      setForm((prev: any) => ({ ...prev, clientId: client ? client.clientId : '' }));
    }
  };

  // Generate sequential insuranceId
  async function generateInsuranceId(clientName?: string) {
    if (form.insuranceType === 'client' && clientName) {
      // For client insurance: Generate unique ID per client
      const clientDoc = await getDocs(query(collection(db, 'clients'), where('firmName', '==', clientName)));
      if (!clientDoc.empty) {
        const clientData = clientDoc.docs[0].data() as any;
        const existingInsurances = clientData.insurances || [];
        
        // Extract existing insurance IDs for this client
        const existingIds = existingInsurances
          .map((insurance: any) => insurance.insuranceId)
          .filter(Boolean)
          .map((id: string) => {
            const match = id.match(/INS-(\d{4})/);
            return match ? parseInt(match[1], 10) : 0;
          });
        
        const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
        return `INS-${(maxId + 1).toString().padStart(4, '0')}`;
      }
    } else if (form.insuranceType === 'agrogreen') {
      // For Agrogreen insurance: Generate unique ID across all Agrogreen insurances
      const agrogreenSnap = await getDocs(collection(db, 'agrogreen'));
      const ids = agrogreenSnap.docs
        .map(doc => doc.data().insuranceId)
        .filter(Boolean)
        .map((id) => {
          const match = id.match(/INS-(\d{4})/);
          return match ? parseInt(match[1], 10) : 0;
        });
      const maxId = ids.length > 0 ? Math.max(...ids) : 0;
      return `INS-${(maxId + 1).toString().padStart(4, '0')}`;
    }
    
    // Fallback: Generate unique ID across all insurance records
    const snap = await getDocs(collection(db, 'insurance'));
    const ids = snap.docs
      .map(doc => doc.data().insuranceId)
      .filter(Boolean)
      .map((id) => {
        const match = id.match(/INS-(\d{4})/);
        return match ? parseInt(match[1], 10) : 0;
      });
    const maxId = ids.length > 0 ? Math.max(...ids) : 0;
    return `INS-${(maxId + 1).toString().padStart(4, '0')}`;
  }

  // Validate insurance ID uniqueness for client
  async function validateInsuranceIdUniqueness(insuranceId: string, clientName: string) {
    const clientDoc = await getDocs(query(collection(db, 'clients'), where('firmName', '==', clientName)));
    if (!clientDoc.empty) {
      const clientData = clientDoc.docs[0].data() as any;
      const existingInsurances = clientData.insurances || [];
      
      // Check if insurance ID already exists for this client
      const existingInsurance = existingInsurances.find((insurance: any) => insurance.insuranceId === insuranceId);
      return !existingInsurance; // Return true if unique, false if duplicate
    }
    return true; // If client not found, consider it unique
  }

  // Handle form submit
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      // Validate required fields
      if (!form.insuranceType) {
        toast({ title: 'Error', description: 'Please select insurance type', variant: 'destructive' });
        return;
      }
      if (!form.commodity) {
        toast({ title: 'Error', description: 'Please enter commodity', variant: 'destructive' });
        return;
      }
      if (form.insuranceType === 'client' && !form.clientName) {
        toast({ title: 'Error', description: 'Please select client name', variant: 'destructive' });
        return;
      }
      if (!form.firePolicyCompanyName || !form.firePolicyNumber || !form.firePolicyAmount || !form.firePolicyStartDate || !form.firePolicyEndDate) {
        toast({ title: 'Error', description: 'Please fill all fire policy details', variant: 'destructive' });
        return;
      }
      if (!form.burglaryPolicyCompanyName || !form.burglaryPolicyNumber || !form.burglaryPolicyAmount || !form.burglaryPolicyStartDate || !form.burglaryPolicyEndDate) {
        toast({ title: 'Error', description: 'Please fill all burglary policy details', variant: 'destructive' });
        return;
      }

      // Prepare insurance data
      const insuranceData = {
        insuranceType: form.insuranceType,
        commodity: form.commodity,
        clientName: form.insuranceType === 'client' ? form.clientName : '',
        clientAddress: form.insuranceType === 'client' ? form.clientAddress : '',
        firePolicyCompanyName: form.firePolicyCompanyName,
        firePolicyNumber: form.firePolicyNumber,
        firePolicyAmount: form.firePolicyAmount,
        firePolicyStartDate: form.firePolicyStartDate,
        firePolicyEndDate: form.firePolicyEndDate,
        burglaryPolicyCompanyName: form.burglaryPolicyCompanyName,
        burglaryPolicyNumber: form.burglaryPolicyNumber,
        burglaryPolicyAmount: form.burglaryPolicyAmount,
        burglaryPolicyStartDate: form.burglaryPolicyStartDate,
        burglaryPolicyEndDate: form.burglaryPolicyEndDate,
        createdAt: new Date().toISOString(),
      };

      if (form.insuranceType === 'client') {
        // For client insurance: Add to client's document in clients collection
        const selectedClient = clients.find((c: any) => c.firmName === form.clientName);
        if (!selectedClient) {
          toast({ title: 'Error', description: 'Selected client not found', variant: 'destructive' });
          return;
        }

        // Generate insurance ID for this client
        const insuranceId = await generateInsuranceId(form.clientName);
        
        // Validate insurance ID uniqueness
        const isUnique = await validateInsuranceIdUniqueness(insuranceId, form.clientName);
        if (!isUnique) {
          toast({ title: 'Error', description: 'Insurance ID already exists for this client. Please try again.', variant: 'destructive' });
          return;
        }

        // Get current client data
        const clientDoc = await getDocs(query(collection(db, 'clients'), where('firmName', '==', form.clientName)));
        if (clientDoc.empty) {
          toast({ title: 'Error', description: 'Client document not found', variant: 'destructive' });
          return;
        }

        const clientDocSnapshot = clientDoc.docs[0];
        const clientData = clientDocSnapshot.data() as any;
        const existingInsurances = clientData.insurances || [];
        
        // Add new insurance to the array with the validated insurance ID
        const insuranceDataWithId = {
          ...insuranceData,
          insuranceId: insuranceId
        };
        const updatedInsurances = [...existingInsurances, insuranceDataWithId];
        
        // Update the client document with new insurance array
        await updateDoc(doc(db, 'clients', clientDocSnapshot.id), {
          insurances: updatedInsurances
        });

        toast({ title: 'Insurance added to client successfully!', variant: 'default' });
      } else if (form.insuranceType === 'agrogreen') {
        // For Agrogreen insurance: Create new document in agrogreen collection
        const insuranceId = await generateInsuranceId();
        const insuranceDataWithId = {
          ...insuranceData,
          insuranceId: insuranceId
        };
        await addDoc(collection(db, 'agrogreen'), insuranceDataWithId);
        toast({ title: 'Agrogreen insurance added successfully!', variant: 'default' });
      }

      fetchWarehouseInsurance();
      setShowAddModal(false);
      setEditRow(null);
      
      // Reset form
      setForm({
        state: '', branch: '', location: '', warehouse: '', commodities: [], banks: [], insuranceManagedBy: '', firePolicyNumber: '', firePolicyAmount: '', firePolicyStart: '', firePolicyEnd: '', burglaryPolicyNumber: '', burglaryPolicyAmount: '', burglaryPolicyStart: '', burglaryPolicyEnd: '', clientName: '', clientId: '', bankFundedBy: '', firePolicyCompanyName: '', burglaryPolicyCompanyName: '',
        // New insurance form fields
        insuranceType: '',
        commodity: '',
        clientAddress: '',
        firePolicyStartDate: '',
        firePolicyEndDate: '',
        burglaryPolicyStartDate: '',
        burglaryPolicyEndDate: '',
      });
    } catch (err) {
      toast({ title: 'Error saving insurance', description: String(err), variant: 'destructive' });
    }
  };

  // When opening edit modal, populate form
  useEffect(() => {
    if (editRow) {
      setForm({ ...editRow });
    }
  }, [editRow]);

  // When closing modal, clear editRow
  useEffect(() => {
    if (!showAddModal) {
      setEditRow(null);
      setForm({
        state: '', branch: '', location: '', warehouse: '', commodities: [], banks: [], insuranceManagedBy: '', firePolicyNumber: '', firePolicyAmount: '', firePolicyStart: '', firePolicyEnd: '', burglaryPolicyNumber: '', burglaryPolicyAmount: '', burglaryPolicyStart: '', burglaryPolicyEnd: '', clientName: '', clientId: '', bankFundedBy: '', firePolicyCompanyName: '', burglaryPolicyCompanyName: '',
      });
    }
  }, [showAddModal]);

  // Helper to get bank name from bankId
  function getBankNameFromId(val: string, banksArr: any[]) {
    const [bankId] = val.split('|');
    const bank = banksArr.find((b: any) => String(b.bankId) === String(bankId));
    return bank && bank.bankName ? bank.bankName : bankId;
  }

  useEffect(() => {
    if (banks.length > 0) {
      console.log('Banks:', banks);
    }
  }, [banks]);

  useEffect(() => {
    if (bankLocationOptions.length > 0) {
      console.log('Bank Location Options:', bankLocationOptions);
    }
  }, [bankLocationOptions]);

  // 2. CSV Export logic
  function downloadCSV() {
    if (filteredInsuranceData.length === 0) return;
    // Prepare CSV header
    const header = columns.filter(col => col.key !== 'actions').map(col => col.label);
    // Prepare CSV rows
    const rows = filteredInsuranceData.map(row =>
      columns.filter(col => col.key !== 'actions').map(col => {
        let value = row[col.key];
        if (col.key === 'bankFundedBy' && value && value !== '-') {
          value = getBankNameFromId(value, banks);
        }
        if (col.key === 'banks' && Array.isArray(value) && value[0] !== '-') {
          const names = value.map((v: string) => getBankNameFromId(v, banks));
          value = Array.from(new Set(names)).join(', ');
        }
        if (col.key === 'commodities' && Array.isArray(value) && value[0] !== '-') {
          value = value.join(', ');
        }
        if (col.key.toLowerCase().includes('date') && value) {
          value = formatDate(value);
        }
        if (value === undefined || value === null) value = '';
        return `"${String(value).replace(/"/g, '""')}"`;
      })
    );
    const csvContent = [header, ...rows].map(r => r.join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'insurance-data.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Group insurance entries by warehouseCode
  const groupedByWarehouse = useMemo(() => {
    const map: Record<string, { warehouseName: string; warehouseCode: string; insurances: any[] }> = {};
    insuranceData.forEach(entry => {
      const code = entry.warehouseCode || "-";
      if (!map[code]) {
        map[code] = {
          warehouseName: entry.warehouseName || "-",
          warehouseCode: code,
          insurances: [],
        };
      }
      map[code].insurances.push(entry);
    });
    return Object.values(map);
  }, [insuranceData]);

  // Toggle expand/collapse for a warehouse
  const toggleWarehouseExpansion = (warehouseCode: string) => {
    setExpandedWarehouses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(warehouseCode)) newSet.delete(warehouseCode);
      else newSet.add(warehouseCode);
      return newSet;
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header with Back Button and Centered Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => router.back()}
              className="inline-block text-lg font-semibold tracking-tight bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 transition-colors"
            >
              ← Dashboard
            </button>
          </div>
          <div className="flex-1 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-orange-600 inline-block border-b-4 border-green-500 pb-2 px-6 py-3 bg-orange-100 rounded-lg">
              Insurance Master
            </h1>
          </div>
        </div>

        {/* Add New Insurance Button */}
        <Card className="border-green-300 mb-4">
          <CardContent className="p-4">
            <div className="flex justify-center">
              <Button 
                onClick={() => setShowAddModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-lg font-semibold"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add New Insurance
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search & Export Section */}
        <Card className="border-green-300">
          <CardHeader className="bg-green-50">
            <CardTitle className="text-green-700">Search & Export Options</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2 flex-1 min-w-[300px]">
                <Search className="w-4 h-4 text-green-600" />
                <Label htmlFor="searchTerm" className="text-green-600 font-medium whitespace-nowrap">Search:</Label>
                <Input
                  id="searchTerm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by State, Branch, Location, Warehouse Code, or Name"
                  className="border-green-300 focus:border-green-500 flex-1"
                />
              </div>
              <Button className="bg-blue-500 hover:bg-blue-600 text-white whitespace-nowrap" onClick={downloadCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Placeholder */}
        {banks.length === 0 ? (
          <Card className="border-green-300 shadow-lg rounded-xl overflow-hidden">
            <CardHeader className="bg-green-50 rounded-t-xl sticky top-0 z-10">
              <CardTitle className="text-green-700">Registered Insurance</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <div className="w-full text-center text-gray-400 py-8">Loading banks...</div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-green-300 shadow-lg rounded-xl overflow-hidden">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="bg-orange-100 text-orange-600 font-bold">State</TableHead>
                    <TableHead className="bg-orange-100 text-orange-600 font-bold">Branch</TableHead>
                    <TableHead className="bg-orange-100 text-orange-600 font-bold">Location</TableHead>
                    <TableHead className="bg-orange-100 text-orange-600 font-bold">Warehouse Code</TableHead>
                    <TableHead className="bg-orange-100 text-orange-600 font-bold">Warehouse Name</TableHead>
                    <TableHead className="bg-orange-100 text-orange-600 font-bold sticky right-0 z-10">Expand</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedByWarehouse.map(wh => {
                    const first = wh.insurances[0] || {};
                    return (
                      <>
                        <TableRow key={wh.warehouseCode} className="border-b border-green-200">
                          <TableCell className="text-green-700">{first.state || '-'}</TableCell>
                          <TableCell className="text-green-700">{first.branch || '-'}</TableCell>
                          <TableCell className="text-green-700">{first.location || '-'}</TableCell>
                          <TableCell className="text-green-700">{wh.warehouseCode}</TableCell>
                          <TableCell className="text-green-700 font-medium">{wh.warehouseName}</TableCell>
                          <TableCell className="sticky right-0 bg-white z-10">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-orange-300 text-orange-600 hover:bg-orange-50 p-1"
                              onClick={() => toggleWarehouseExpansion(wh.warehouseCode)}
                              title={expandedWarehouses.has(wh.warehouseCode) ? 'Collapse' : 'Expand'}
                            >
                              {expandedWarehouses.has(wh.warehouseCode) ? <Minus className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expandedWarehouses.has(wh.warehouseCode) && (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-green-50 p-0">
                              <div className="p-4">
                                <h4 className="text-orange-700 font-semibold mb-2">Insurances</h4>
                                <Table className="border border-green-200 rounded-lg">
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-green-700">Fire Policy Company</TableHead>
                                      <TableHead className="text-green-700">Fire Policy Number</TableHead>
                                      <TableHead className="text-green-700">Fire Policy Amount</TableHead>
                                      <TableHead className="text-green-700 w-32">Fire Policy Start</TableHead>
                                      <TableHead className="text-green-700 w-32">Fire Policy End</TableHead>
                                      <TableHead className="text-green-700">Burglary Policy Company</TableHead>
                                      <TableHead className="text-green-700">Burglary Policy Number</TableHead>
                                      <TableHead className="text-green-700">Burglary Policy Amount</TableHead>
                                      <TableHead className="text-green-700 w-32">Burglary Policy Start</TableHead>
                                      <TableHead className="text-green-700 w-32">Burglary Policy End</TableHead>
                                      <TableHead className="text-green-700">Remaining Fire Policy Amount</TableHead>
                                      <TableHead className="text-green-700">Remaining Burglary Policy Amount</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {wh.insurances.map((ins, idx) => (
                                      <TableRow key={ins.id || idx} className="border-b border-green-100">
                                        <TableCell>{ins.firePolicyCompanyName || '-'}</TableCell>
                                        <TableCell>{ins.firePolicyNumber || '-'}</TableCell>
                                        <TableCell>{ins.firePolicyAmount || '-'}</TableCell>
                                        <TableCell className="w-32">{ins.firePolicyStartDate ? formatDate(ins.firePolicyStartDate) : '-'}</TableCell>
                                        <TableCell className="w-32">{ins.firePolicyEndDate ? formatDate(ins.firePolicyEndDate) : '-'}</TableCell>
                                        <TableCell>{ins.burglaryPolicyCompanyName || '-'}</TableCell>
                                        <TableCell>{ins.burglaryPolicyNumber || '-'}</TableCell>
                                        <TableCell>{ins.burglaryPolicyAmount || '-'}</TableCell>
                                        <TableCell className="w-32">{ins.burglaryPolicyStartDate ? formatDate(ins.burglaryPolicyStartDate) : '-'}</TableCell>
                                        <TableCell className="w-32">{ins.burglaryPolicyEndDate ? formatDate(ins.burglaryPolicyEndDate) : '-'}</TableCell>
                                        <TableCell>{ins.remainingFirePolicyAmount || '-'}</TableCell>
                                        <TableCell>{ins.remainingBurglaryPolicyAmount || '-'}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                  {groupedByWarehouse.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-8 border-r border-gray-300">
                        No activated warehouses with insurance entries found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Add New Insurance Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeaderUI>
              <DialogTitleUI>Add New Insurance</DialogTitleUI>
            </DialogHeaderUI>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Insurance Type Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-green-600 font-medium">Insurance Type</Label>
                  <SelectUI value={form.insuranceType} onValueChange={v => handleChange('insuranceType', v)} required>
                    <SelectTrigger className="border-orange-300 focus:border-orange-500 text-orange-700">
                      <SelectValue placeholder="Select Insurance Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="agrogreen">Agrogreen</SelectItem>
                    </SelectContent>
                  </SelectUI>
                </div>
                </div>

              {/* Client-specific fields */}
              {form.insuranceType === 'client' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                      <Label className="text-green-600 font-medium">Commodity</Label>
                      <Input 
                        value={form.commodity} 
                        onChange={e => handleChange('commodity', e.target.value)} 
                        className="border-orange-300 focus:border-orange-500 text-orange-700"
                        placeholder="Enter commodity name"
                        required
                  />
                </div>
                    <div className="space-y-2">
                      <Label className="text-green-600 font-medium">Client Name</Label>
                      <SelectUI value={form.clientName} onValueChange={v => {
                        const selectedClient = clients.find((c: any) => c.firmName === v);
                        handleChange('clientName', v);
                        handleChange('clientAddress', selectedClient?.companyAddress || '');
                      }} required>
                        <SelectTrigger className="border-orange-300 focus:border-orange-500 text-orange-700">
                          <SelectValue placeholder="Select Client" />
                        </SelectTrigger>
                    <SelectContent>
                          {clients.map((client: any) => (
                            <SelectItem key={client.clientId} value={client.firmName}>
                              {client.firmName}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </SelectUI>
                </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-green-600 font-medium">Client Address</Label>
                      <Input 
                        value={form.clientAddress} 
                        onChange={e => handleChange('clientAddress', e.target.value)} 
                        className="border-orange-300 focus:border-orange-500 text-orange-700"
                        placeholder="Client address will auto-fill"
                        required
                      />
                    </div>
                            </div>
                  </>
                )}

              {/* Agrogreen-specific fields */}
              {form.insuranceType === 'agrogreen' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Commodity</Label>
                    <Input 
                      value={form.commodity} 
                      onChange={e => handleChange('commodity', e.target.value)} 
                      className="border-orange-300 focus:border-orange-500 text-orange-700"
                      placeholder="Enter commodity name"
                      required
                    />
                    </div>
                    </div>
              )}

              {/* Fire Policy Details */}
              <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                <h3 className="text-lg font-semibold text-green-700 mb-4">Fire Policy Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Fire Policy Company Name</Label>
                    <Input 
                      value={form.firePolicyCompanyName} 
                      onChange={e => handleChange('firePolicyCompanyName', e.target.value)} 
                      className="border-orange-300 focus:border-orange-500 text-orange-700"
                      placeholder="Enter company name"
                      required
                    />
                  </div>
                    <div className="space-y-2">
                      <Label className="text-green-600 font-medium">Fire Policy Number</Label>
                    <Input 
                      value={form.firePolicyNumber} 
                      onChange={e => handleChange('firePolicyNumber', e.target.value)} 
                      className="border-orange-300 focus:border-orange-500 text-orange-700"
                      placeholder="Enter policy number"
                      required
                    />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-green-600 font-medium">Fire Policy Amount</Label>
                    <Input 
                      type="number"
                      value={form.firePolicyAmount} 
                      onChange={e => handleChange('firePolicyAmount', e.target.value)} 
                      className="border-orange-300 focus:border-orange-500 text-orange-700"
                      placeholder="Enter amount"
                      required
                    />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-green-600 font-medium">Fire Policy Start Date</Label>
                    <Input 
                      type="date"
                      value={form.firePolicyStartDate} 
                      onChange={e => handleChange('firePolicyStartDate', e.target.value)} 
                      className="border-orange-300 focus:border-orange-500 text-orange-700"
                      required
                    />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-green-600 font-medium">Fire Policy End Date</Label>
                    <Input 
                      type="date"
                      value={form.firePolicyEndDate} 
                      onChange={e => handleChange('firePolicyEndDate', e.target.value)} 
                      className="border-orange-300 focus:border-orange-500 text-orange-700"
                      required
                    />
                    </div>
                    </div>
              </div>

              {/* Burglary Policy Details */}
              <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                <h3 className="text-lg font-semibold text-green-700 mb-4">Burglary Policy Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Burglary Policy Company Name</Label>
                    <Input 
                      value={form.burglaryPolicyCompanyName} 
                      onChange={e => handleChange('burglaryPolicyCompanyName', e.target.value)} 
                      className="border-orange-300 focus:border-orange-500 text-orange-700"
                      placeholder="Enter company name"
                      required
                    />
                  </div>
                    <div className="space-y-2">
                      <Label className="text-green-600 font-medium">Burglary Policy Number</Label>
                    <Input 
                      value={form.burglaryPolicyNumber} 
                      onChange={e => handleChange('burglaryPolicyNumber', e.target.value)} 
                      className="border-orange-300 focus:border-orange-500 text-orange-700"
                      placeholder="Enter policy number"
                      required
                    />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-green-600 font-medium">Burglary Policy Amount</Label>
                    <Input 
                      type="number"
                      value={form.burglaryPolicyAmount} 
                      onChange={e => handleChange('burglaryPolicyAmount', e.target.value)} 
                      className="border-orange-300 focus:border-orange-500 text-orange-700"
                      placeholder="Enter amount"
                      required
                    />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-green-600 font-medium">Burglary Policy Start Date</Label>
                    <Input 
                      type="date"
                      value={form.burglaryPolicyStartDate} 
                      onChange={e => handleChange('burglaryPolicyStartDate', e.target.value)} 
                      className="border-orange-300 focus:border-orange-500 text-orange-700"
                      required
                    />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-green-600 font-medium">Burglary Policy End Date</Label>
                    <Input 
                      type="date"
                      value={form.burglaryPolicyEndDate} 
                      onChange={e => handleChange('burglaryPolicyEndDate', e.target.value)} 
                      className="border-orange-300 focus:border-orange-500 text-orange-700"
                      required
                    />
                    </div>
                    </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 shadow-lg">
                  Save Insurance
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
} 