"use client";

import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Download, Plus, Edit, Trash2, Calendar, AlertTriangle, Lightbulb } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { CSVLink } from 'react-csv';
import { parseISO, format, differenceInDays } from 'date-fns';

// Interfaces
interface InsuranceData {
  id?: string;
  insuranceCode: string;
  warehouseName: string;
  warehouseCode: string;
  state: string;
  branch: string;
  location: string;
  commodityName: string;
  varietyName?: string; // Made optional since variety field is removed
  insuranceType: 'bank-funded' | 'client' | 'agrogreen' | 'warehouse-owner';
  clientName?: string;
  clientCode?: string;
  clientAddress?: string;
  bankFundedBy?: string;
  firePolicyCompanyName: string;
  firePolicyNumber: string;
  firePolicyAmount: string;
  firePolicyStartDate: string;
  firePolicyEndDate: string;
  firePolicyUsedAmount?: string; // Amount used/deducted from fire policy
  firePolicyRemainingAmount?: string; // Calculated remaining balance
  burglaryPolicyCompanyName: string;
  burglaryPolicyNumber: string;
  burglaryPolicyAmount: string;
  burglaryPolicyStartDate: string;
  burglaryPolicyEndDate: string;
  burglaryPolicyUsedAmount?: string; // Amount used/deducted from burglary policy
  burglaryPolicyRemainingAmount?: string; // Calculated remaining balance
  selectedCommodities?: Array<{
    commodityName: string;
    varietyName?: string; // Made optional
  }>; // Multiple commodity selections
  createdAt: string;
}

interface CommodityData {
  id: string;
  commodityId: string;
  commodityName: string;
  varieties: Array<{
    varietyId: string;
    varietyName: string;
    locationId: string;
    locationName: string;
    branchName: string;
  }>;
}

interface ClientData {
  id: string;
  clientId: string;
  firmName: string;
  companyAddress: string;
  warehouseName: string;
  warehouseCode: string;
  commodityName: string;
  varietyName: string;
}

interface WarehouseData {
  id: string;
  warehouseCode: string;
  warehouseName: string;
  state: string;
  branch: string;
  location: string;
}

interface BankData {
  id: string;
  bankId: string;
  bankName: string;
  state: string;
  branch: string;
  locations?: Array<{
    locationId: string;
    locationName: string;
    branchName: string;
    ifscCode: string;
    address?: string;
    authorizePerson1?: string;
    authorizePerson2?: string;
  }>;
}

export default function InsuranceMasterPage() {
  const router = useRouter();
  const { toast } = useToast();

  // State management
  const [insuranceData, setInsuranceData] = useState<InsuranceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Reference data
  const [commodities, setCommodities] = useState<CommodityData[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [banks, setBanks] = useState<BankData[]>([]);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingInsurance, setEditingInsurance] = useState<InsuranceData | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; insurance: InsuranceData | null }>({ open: false, insurance: null });
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [selectedInsuranceForAction, setSelectedInsuranceForAction] = useState<InsuranceData | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<InsuranceData>>({
    state: '',
    branch: '',
    location: '',
    warehouseName: '',
    warehouseCode: '',
    commodityName: '',
    // varietyName is optional and removed from form
    insuranceType: 'bank-funded',
    clientName: '',
    clientCode: '',
    clientAddress: '',
    bankFundedBy: '',
    firePolicyCompanyName: '',
    firePolicyNumber: '',
    firePolicyAmount: '',
    firePolicyStartDate: '',
    firePolicyEndDate: '',
    firePolicyUsedAmount: '0',
    burglaryPolicyCompanyName: '',
    burglaryPolicyNumber: '',
    burglaryPolicyAmount: '',
    burglaryPolicyStartDate: '',
    burglaryPolicyEndDate: '',
    burglaryPolicyUsedAmount: '0',
  });

  // Multiple commodity selection
  const [selectedCommodities, setSelectedCommodities] = useState<Array<{
    commodityName: string;
    varietyName?: string; // Made optional since variety field is removed
  }>>([]);

  // Utility function to get insurance expiry status
  const getInsuranceStatus = (firePolicyEndDate: string) => {
    try {
      const endDate = parseISO(firePolicyEndDate);
      const today = new Date();
      const daysUntilExpiry = differenceInDays(endDate, today);
      
      if (daysUntilExpiry < 0) {
        return 'expired'; // Blue light - expired
      } else if (daysUntilExpiry <= 5) {
        return 'expiring'; // Red light - expiring within 5 days
      }
      return 'active'; // No light - active
    } catch {
      return 'active';
    }
  };

  // Handle extend insurance
  const handleExtendInsurance = (insurance: InsuranceData) => {
    setSelectedInsuranceForAction(insurance);
    setFormData({
      firePolicyEndDate: insurance.firePolicyEndDate,
      burglaryPolicyEndDate: insurance.burglaryPolicyEndDate,
    });
    setShowExtendModal(true);
  };

  // Handle replace expired insurance
  const handleReplaceInsurance = (insurance: InsuranceData) => {
    setSelectedInsuranceForAction(insurance);
    // Pre-populate form with existing data but clear dates and policy numbers
    setFormData({
      ...insurance,
      firePolicyNumber: '',
      firePolicyStartDate: '',
      firePolicyEndDate: '',
      burglaryPolicyNumber: '',
      burglaryPolicyStartDate: '',
      burglaryPolicyEndDate: '',
      firePolicyAmount: '',
      burglaryPolicyAmount: '',
      firePolicyCompanyName: '',
      burglaryPolicyCompanyName: '',
    });
    setShowReplaceModal(true);
  };

  // Column definitions with insurance code
  const insuranceColumns: ColumnDef<InsuranceData>[] = [
    {
      accessorKey: "insuranceCode",
      header: "Insurance Code",
      cell: ({ row }) => <span className="font-bold text-orange-800">{row.getValue("insuranceCode")}</span>
    },
    {
      accessorKey: "warehouseName",
      header: "Warehouse Name",
      cell: ({ row }) => <span className="text-green-700 font-medium">{row.getValue("warehouseName")}</span>
    },
    {
      accessorKey: "warehouseCode",
      header: "Warehouse Code",
      cell: ({ row }) => <span className="text-blue-700">{row.getValue("warehouseCode")}</span>
    },
    {
      accessorKey: "commodityName",
      header: "Commodity",
      cell: ({ row }) => <span className="text-purple-700">{row.getValue("commodityName")}</span>
    },
    {
      accessorKey: "varietyName",
      header: "Variety",
      cell: ({ row }) => <span className="text-purple-600">{row.getValue("varietyName")}</span>
    },
    {
      accessorKey: "insuranceType",
      header: "Insurance Type",
      cell: ({ row }) => {
        const type = row.getValue("insuranceType") as 'bank-funded' | 'client' | 'agrogreen' | 'warehouse-owner';
        const colorMap: Record<string, string> = {
          'bank-funded': 'bg-blue-100 text-blue-800 border-blue-300',
          'client': 'bg-green-100 text-green-800 border-green-300',
          'agrogreen': 'bg-orange-100 text-orange-800 border-orange-300',
          'warehouse-owner': 'bg-purple-100 text-purple-800 border-purple-300'
        };
        return (
          <span className={`px-2 py-1 text-xs rounded-full border ${colorMap[type] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
            {type === 'bank-funded' ? 'Bank Funded' : 
             type === 'warehouse-owner' ? 'Warehouse Owner' : 
             type.charAt(0).toUpperCase() + type.slice(1)}
          </span>
        );
      }
    },
    {
      accessorKey: "clientName",
      header: "Client Name",
      cell: ({ row }) => <span className="text-gray-700">{row.getValue("clientName") || '-'}</span>
    },
    {
      accessorKey: "bankFundedBy",
      header: "Bank Funded By",
      cell: ({ row }) => <span className="text-blue-700">{row.getValue("bankFundedBy") || '-'}</span>
    },
    {
      accessorKey: "firePolicyNumber",
      header: "Fire Policy No.",
      cell: ({ row }) => <span className="text-red-700">{row.getValue("firePolicyNumber")}</span>
    },
    {
      accessorKey: "firePolicyEndDate",
      header: "Fire Policy End",
      cell: ({ row }) => {
        const date = row.getValue("firePolicyEndDate") as string;
        const status = getInsuranceStatus(date);
        try {
          return (
            <div className="flex items-center gap-2">
              {status === 'expiring' ? (
                <div className="bg-red-100 border-2 border-red-500 rounded-lg p-2 animate-pulse">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-ping absolute"></div>
                      <div className="w-3 h-3 bg-red-600 rounded-full relative"></div>
                    </div>
                    <span className="text-red-800 font-bold">{format(parseISO(date), 'dd/MM/yyyy')}</span>
                    <Button
                      size="sm"
                      className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 h-6"
                      onClick={() => handleExtendInsurance(row.original)}
                      title="Insurance expiring soon - Click to extend"
                    >
                      EXTEND
                    </Button>
                  </div>
                </div>
              ) : (
                <span className="text-red-600">{format(parseISO(date), 'dd/MM/yyyy')}</span>
              )}
            </div>
          );
        } catch {
          return (
            <div className="flex items-center gap-2">
              {status === 'expiring' ? (
                <div className="bg-red-100 border-2 border-red-500 rounded-lg p-2 animate-pulse">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-ping absolute"></div>
                      <div className="w-3 h-3 bg-red-600 rounded-full relative"></div>
                    </div>
                    <span className="text-red-800 font-bold">{date}</span>
                    <Button
                      size="sm"
                      className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 h-6"
                      onClick={() => handleExtendInsurance(row.original)}
                      title="Insurance expiring soon - Click to extend"
                    >
                      EXTEND
                    </Button>
                  </div>
                </div>
              ) : (
                <span className="text-red-600">{date}</span>
              )}
            </div>
          );
        }
      }
    },
    {
      accessorKey: "burglaryPolicyNumber",
      header: "Burglary Policy No.",
      cell: ({ row }) => <span className="text-orange-700">{row.getValue("burglaryPolicyNumber")}</span>
    },
    {
      accessorKey: "burglaryPolicyEndDate",
      header: "Burglary Policy End",
      cell: ({ row }) => {
        const date = row.getValue("burglaryPolicyEndDate") as string;
        try {
          return <span className="text-orange-600">{format(parseISO(date), 'dd/MM/yyyy')}</span>;
        } catch {
          return <span className="text-orange-600">{date}</span>;
        }
      }
    },
    {
      accessorKey: "firePolicyRemainingAmount",
      header: "Fire Policy Balance",
      cell: ({ row }) => {
        const totalAmount = parseFloat(row.original.firePolicyAmount || '0');
        const usedAmount = parseFloat(row.original.firePolicyUsedAmount || '0');
        const remainingAmount = totalAmount - usedAmount;
        const percentage = totalAmount > 0 ? (remainingAmount / totalAmount) * 100 : 100;
        
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${remainingAmount <= totalAmount * 0.2 ? 'text-red-600' : 'text-green-600'}`}>
                ₹{remainingAmount.toLocaleString()}
              </span>
              <span className="text-xs text-gray-500">
                ({percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${
                  percentage > 50 ? 'bg-green-500' : 
                  percentage > 20 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.max(percentage, 0)}%` }}
              />
            </div>
          </div>
        );
      }
    },
    {
      accessorKey: "burglaryPolicyRemainingAmount",
      header: "Burglary Policy Balance",
      cell: ({ row }) => {
        const totalAmount = parseFloat(row.original.burglaryPolicyAmount || '0');
        const usedAmount = parseFloat(row.original.burglaryPolicyUsedAmount || '0');
        const remainingAmount = totalAmount - usedAmount;
        const percentage = totalAmount > 0 ? (remainingAmount / totalAmount) * 100 : 100;
        
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${remainingAmount <= totalAmount * 0.2 ? 'text-red-600' : 'text-green-600'}`}>
                ₹{remainingAmount.toLocaleString()}
              </span>
              <span className="text-xs text-gray-500">
                ({percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${
                  percentage > 50 ? 'bg-green-500' : 
                  percentage > 20 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.max(percentage, 0)}%` }}
              />
            </div>
          </div>
        );
      }
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const status = getInsuranceStatus(row.original.firePolicyEndDate);
        return (
          <div className="flex items-center space-x-2">
            {/* Blue Light for Expired Insurance */}
            {status === 'expired' && (
              <Button
                size="sm"
                variant="outline"
                className="border-blue-300 text-blue-600 hover:bg-blue-50 p-2"
                onClick={() => handleReplaceInsurance(row.original)}
                title="Insurance expired - Click to add new insurance"
              >
                <Lightbulb className="w-4 h-4 fill-blue-500 text-blue-500" />
              </Button>
            )}
            
            {/* Regular Action Buttons */}
            <Button
              size="sm"
              variant="outline"
              className="border-orange-300 text-orange-600 hover:bg-orange-50"
              onClick={() => handleEdit(row.original)}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => setDeleteDialog({ open: true, insurance: row.original })}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      },
    }
  ];

  // Fetch all required data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        insuranceSnapshot,
        commoditySnapshot,
        clientSnapshot,
        inspectionSnapshot,
        bankSnapshot
      ] = await Promise.all([
        getDocs(collection(db, 'insurance')),
        getDocs(collection(db, 'commodities')),
        getDocs(collection(db, 'clients')),
        getDocs(collection(db, 'inspections')),
        getDocs(collection(db, 'banks'))
      ]);

      const fetchedInsurance = insuranceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InsuranceData[];
      const fetchedCommodities = commoditySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CommodityData[];
      const fetchedClients = clientSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ClientData[];
      
      // Extract unique warehouses from inspections
      const warehouseSet = new Set<string>();
      const fetchedWarehouses: WarehouseData[] = [];
      
      inspectionSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.warehouseName && !warehouseSet.has(data.warehouseName)) {
          warehouseSet.add(data.warehouseName);
          fetchedWarehouses.push({
            id: doc.id,
            warehouseName: data.warehouseName,
            warehouseCode: data.warehouseCode || 'WH-0001',
            state: data.state || '',
            branch: data.branch || '',
            location: data.location || ''
          });
        }
      });
      
      const fetchedBanks = bankSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          bankId: data.bankId || '',
          bankName: data.bankName || data.branch || data.state || 'Unknown Bank', // Use branch or state as fallback
          state: data.state || '',
          branch: data.branch || '',
          locations: data.locations || []
        };
      }) as BankData[];

      // Debug logging for banks
      console.log('Fetched banks from Firebase:', fetchedBanks);
      console.log('Banks collection size:', bankSnapshot.size);
      console.log('Sample bank data:', fetchedBanks[0]);
      
      // Also get bank names from locations if available
      const enrichedBanks = fetchedBanks.map(bank => {
        if (!bank.bankName || bank.bankName === 'Unknown Bank') {
          // Try to get bank name from locations
          const locations = bank.locations || [];
          if (locations.length > 0 && locations[0].locationName) {
            bank.bankName = locations[0].locationName;
          }
        }
        return bank;
      });

      console.log('✅ Data fetched successfully:', {
        insuranceCount: fetchedInsurance.length,
        commoditiesCount: fetchedCommodities.length,
        clientsCount: fetchedClients.length,
        warehousesCount: fetchedWarehouses.length,
        banksCount: enrichedBanks.length,
        sampleWarehouse: fetchedWarehouses[0],
        sampleInsurance: fetchedInsurance[0]
      });

      setInsuranceData(fetchedInsurance);
      setCommodities(fetchedCommodities);
      setClients(fetchedClients);
      setWarehouses(fetchedWarehouses);
      setBanks(enrichedBanks);

      // Cross-module reflection (requirement: reflect changes across modules)
      window.dispatchEvent(new CustomEvent('insuranceDataUpdated', { 
        detail: { 
          insurance: fetchedInsurance, 
          timestamp: new Date() 
        } 
      }));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter and sort data (requirement: ascending order by insurance code)
  const filteredInsurance = useMemo(() => {
    const filtered = insuranceData.filter(insurance =>
      Object.values(insurance).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
    // Sort by insuranceCode in ascending order
    return filtered.sort((a, b) => a.insuranceCode.localeCompare(b.insuranceCode));
  }, [insuranceData, searchTerm]);

  // CSV data preparation with proper headers
  const csvData = useMemo(() => {
    return filteredInsurance.map(insurance => {
      const fireTotalAmount = parseFloat(insurance.firePolicyAmount || '0');
      const fireUsedAmount = parseFloat(insurance.firePolicyUsedAmount || '0');
      const fireRemainingAmount = fireTotalAmount - fireUsedAmount;
      
      const burglaryTotalAmount = parseFloat(insurance.burglaryPolicyAmount || '0');
      const burglaryUsedAmount = parseFloat(insurance.burglaryPolicyUsedAmount || '0');
      const burglaryRemainingAmount = burglaryTotalAmount - burglaryUsedAmount;
      
      return {
        'Insurance Code': insurance.insuranceCode,
        'Warehouse Name': insurance.warehouseName,
        'Warehouse Code': insurance.warehouseCode,
        'Commodity': insurance.commodityName,
        'Variety Name': insurance.varietyName,
        'Insurance Type': insurance.insuranceType === 'bank-funded' ? 'Bank Funded' : 
                        insurance.insuranceType === 'warehouse-owner' ? 'Warehouse Owner' :
                        insurance.insuranceType.charAt(0).toUpperCase() + insurance.insuranceType.slice(1),
        'Client Name': insurance.clientName || '-',
        'Client Code': insurance.clientCode || '-',
        'Bank Funded By': insurance.bankFundedBy || '-',
        'Fire Policy Company': insurance.firePolicyCompanyName,
        'Fire Policy Number': insurance.firePolicyNumber,
        'Fire Policy Amount': insurance.firePolicyAmount,
        'Fire Policy Used Amount': insurance.firePolicyUsedAmount || '0',
        'Fire Policy Remaining Balance': fireRemainingAmount.toString(),
        'Fire Policy Start Date': insurance.firePolicyStartDate,
        'Fire Policy End Date': insurance.firePolicyEndDate,
        'Burglary Policy Company': insurance.burglaryPolicyCompanyName,
        'Burglary Policy Number': insurance.burglaryPolicyNumber,
        'Burglary Policy Amount': insurance.burglaryPolicyAmount,
        'Burglary Policy Used Amount': insurance.burglaryPolicyUsedAmount || '0',
        'Burglary Policy Remaining Balance': burglaryRemainingAmount.toString(),
        'Burglary Policy Start Date': insurance.burglaryPolicyStartDate,
        'Burglary Policy End Date': insurance.burglaryPolicyEndDate
      };
    });
  }, [filteredInsurance]);

  const csvHeaders = [
    { label: 'Insurance Code', key: 'Insurance Code' },
    { label: 'Warehouse Name', key: 'Warehouse Name' },
    { label: 'Warehouse Code', key: 'Warehouse Code' },
    { label: 'Commodity', key: 'Commodity' },
    { label: 'Variety Name', key: 'Variety Name' },
    { label: 'Insurance Type', key: 'Insurance Type' },
    { label: 'Client Name', key: 'Client Name' },
    { label: 'Client Code', key: 'Client Code' },
    { label: 'Bank Funded By', key: 'Bank Funded By' },
    { label: 'Fire Policy Company', key: 'Fire Policy Company' },
    { label: 'Fire Policy Number', key: 'Fire Policy Number' },
    { label: 'Fire Policy Amount', key: 'Fire Policy Amount' },
    { label: 'Fire Policy Used Amount', key: 'Fire Policy Used Amount' },
    { label: 'Fire Policy Remaining Balance', key: 'Fire Policy Remaining Balance' },
    { label: 'Fire Policy Start Date', key: 'Fire Policy Start Date' },
    { label: 'Fire Policy End Date', key: 'Fire Policy End Date' },
    { label: 'Burglary Policy Company', key: 'Burglary Policy Company' },
    { label: 'Burglary Policy Number', key: 'Burglary Policy Number' },
    { label: 'Burglary Policy Amount', key: 'Burglary Policy Amount' },
    { label: 'Burglary Policy Used Amount', key: 'Burglary Policy Used Amount' },
    { label: 'Burglary Policy Remaining Balance', key: 'Burglary Policy Remaining Balance' },
    { label: 'Burglary Policy Start Date', key: 'Burglary Policy Start Date' },
    { label: 'Burglary Policy End Date', key: 'Burglary Policy End Date' }
  ];

  // Generate unique insurance code
  const generateInsuranceCode = () => {
    if (insuranceData.length === 0) {
      return 'INS-0001';
    }
    
    const existingNumbers = insuranceData
      .map(insurance => insurance.insuranceCode)
      .filter(code => code && code.startsWith('INS-'))
      .map(code => parseInt(code.split('-')[1]))
      .filter(num => !isNaN(num));
    
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;
    
    return `INS-${nextNumber.toString().padStart(4, '0')}`;
  };

  // Get today's date for validation
  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Handle form input changes
  const handleInputChange = (field: keyof InsuranceData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Auto-populate client details when client is selected
    if (field === 'clientName') {
      const selectedClient = clients.find(client => client.firmName === value);
      if (selectedClient) {
        setFormData(prev => ({
          ...prev,
          clientCode: selectedClient.clientId,
          clientAddress: selectedClient.companyAddress,
          warehouseName: selectedClient.warehouseName,
          warehouseCode: selectedClient.warehouseCode,
          commodityName: selectedClient.commodityName,
          varietyName: selectedClient.varietyName
        }));
      }
    }

    // Auto-populate warehouse details when warehouse is selected
    if (field === 'warehouseName') {
      const selectedWarehouse = warehouses.find(warehouse => warehouse.warehouseName === value);
      if (selectedWarehouse) {
        setFormData(prev => ({
          ...prev,
          warehouseCode: selectedWarehouse.warehouseCode,
          state: selectedWarehouse.state,
          branch: selectedWarehouse.branch,
          location: selectedWarehouse.location
        }));
      }
    }

    // Auto-populate bank details when bank is selected
    if (field === 'bankFundedBy') {
      const selectedBank = banks.find(bank => {
        const displayName = bank.bankName || bank.branch || `Bank in ${bank.state}`;
        return displayName === value;
      });
      if (selectedBank) {
        // Bank details are auto-displayed in the UI, no need to set in form data
        // The bank display name is already stored in bankFundedBy field
        console.log('Selected bank details:', {
          displayName: value,
          bankName: selectedBank.bankName,
          bankId: selectedBank.bankId,
          state: selectedBank.state,
          branch: selectedBank.branch,
          locations: selectedBank.locations?.length || 0
        });
      }
    }
  };

  // Handle commodity selection (multiple selection support)
  const handleCommoditySelection = (commodityName: string, varietyName?: string) => {
    const newSelection = { commodityName, varietyName };
    setSelectedCommodities(prev => {
      const existing = prev.find(item => 
        item.commodityName === commodityName && item.varietyName === varietyName
      );
      
      if (existing) {
        // Remove if already selected
        return prev.filter(item => 
          !(item.commodityName === commodityName && item.varietyName === varietyName)
        );
      } else {
        // Add new selection
        return [...prev, newSelection];
      }
    });
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate end dates are not in the past
    const today = getTodayDate();
    if (formData.firePolicyEndDate && formData.firePolicyEndDate < today) {
      toast({
        title: "❌ Invalid Date",
        description: "Fire policy end date cannot be in the past",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    
    if (formData.burglaryPolicyEndDate && formData.burglaryPolicyEndDate < today) {
      toast({
        title: "❌ Invalid Date", 
        description: "Burglary policy end date cannot be in the past",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    // Additional validation for bank-funded insurance
    if (formData.insuranceType === 'bank-funded' && !formData.bankFundedBy) {
      toast({
        title: "❌ Missing Information",
        description: "Please select a bank for bank-funded insurance",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    // Additional validation for client insurance
    if (formData.insuranceType === 'client' && !formData.clientName) {
      toast({
        title: "❌ Missing Information",
        description: "Please select a client for client insurance",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    // Validate policy fields for non-bank-funded insurance
    if (formData.insuranceType !== 'bank-funded') {
      if (!formData.firePolicyCompanyName || !formData.firePolicyNumber || !formData.firePolicyAmount) {
        toast({
          title: "❌ Missing Information",
          description: "Please fill in all fire policy details",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }
      if (!formData.burglaryPolicyCompanyName || !formData.burglaryPolicyNumber || !formData.burglaryPolicyAmount) {
        toast({
          title: "❌ Missing Information",
          description: "Please fill in all burglary policy details",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }
      if (!formData.firePolicyStartDate || !formData.firePolicyEndDate) {
        toast({
          title: "❌ Missing Information",
          description: "Please fill in fire policy start and end dates",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }
      if (!formData.burglaryPolicyStartDate || !formData.burglaryPolicyEndDate) {
        toast({
          title: "❌ Missing Information",
          description: "Please fill in burglary policy start and end dates",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }
    }

    try {
      const insuranceCode = editingInsurance ? editingInsurance.insuranceCode : generateInsuranceCode();
      
      // Prepare data based on insurance type
      let insuranceDataToSave: any = {
        ...formData,
        insuranceCode,
        createdAt: editingInsurance ? editingInsurance.createdAt : new Date().toISOString(),
        selectedCommodities // Save multiple commodity selections
      };

      // For client and agrogreen insurance, set warehouse/commodity fields to universal values
      if (formData.insuranceType === 'client' || formData.insuranceType === 'agrogreen') {
        insuranceDataToSave = {
          ...insuranceDataToSave,
          warehouseName: 'Universal', // Not tied to specific warehouse
          warehouseCode: 'N/A',
          state: 'All States',
          branch: 'All Branches',
          location: 'All Locations',
          commodityName: 'All Commodities', // Not tied to specific commodity
          varietyName: 'All Varieties',
          selectedCommodities: [] // Clear commodity selections for universal insurance
        };
      }

      // For bank-funded insurance, clear policy fields and set them to N/A
      if (formData.insuranceType === 'bank-funded') {
        insuranceDataToSave = {
          ...insuranceDataToSave,
          firePolicyCompanyName: 'N/A - Bank Funded',
          firePolicyNumber: 'N/A - Bank Funded',
          firePolicyAmount: '0',
          firePolicyStartDate: new Date().toISOString().split('T')[0],
          firePolicyEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
          firePolicyUsedAmount: '0',
          firePolicyRemainingAmount: '0',
          burglaryPolicyCompanyName: 'N/A - Bank Funded',
          burglaryPolicyNumber: 'N/A - Bank Funded',
          burglaryPolicyAmount: '0',
          burglaryPolicyStartDate: new Date().toISOString().split('T')[0],
          burglaryPolicyEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
          burglaryPolicyUsedAmount: '0',
          burglaryPolicyRemainingAmount: '0',
        };
      } else {
        // For other insurance types, preserve existing amounts and calculate remaining
        const firePolicyUsed = editingInsurance ? editingInsurance.firePolicyUsedAmount || '0' : '0';
        const burglaryPolicyUsed = editingInsurance ? editingInsurance.burglaryPolicyUsedAmount || '0' : '0';
        
        const fireAmount = parseFloat(insuranceDataToSave.firePolicyAmount || '0');
        const burglaryAmount = parseFloat(insuranceDataToSave.burglaryPolicyAmount || '0');
        const fireUsed = parseFloat(firePolicyUsed);
        const burglaryUsed = parseFloat(burglaryPolicyUsed);
        
        insuranceDataToSave.firePolicyUsedAmount = firePolicyUsed;
        insuranceDataToSave.burglaryPolicyUsedAmount = burglaryPolicyUsed;
        insuranceDataToSave.firePolicyRemainingAmount = (fireAmount - fireUsed).toString();
        insuranceDataToSave.burglaryPolicyRemainingAmount = (burglaryAmount - burglaryUsed).toString();
      }

      // Remove undefined values to prevent Firestore errors
      // Firestore doesn't accept undefined, only null or omitted fields
      const cleanData = Object.entries(insuranceDataToSave).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      console.log('💾 Saving insurance data:', cleanData);

      if (editingInsurance) {
        await updateDoc(doc(db, 'insurance', editingInsurance.id!), cleanData);
        toast({
          title: "✅ Insurance Updated",
          description: "Insurance policy has been updated successfully",
          className: "bg-green-100 border-green-500 text-green-700",
          duration: 3000,
        });
      } else {
        await addDoc(collection(db, 'insurance'), cleanData);
        toast({
          title: "✅ Insurance Added",
          description: `New insurance policy created with code: ${insuranceCode}`,
          className: "bg-green-100 border-green-500 text-green-700",
          duration: 3000,
        });
      }

      // Reset form and close modal
      setFormData({});
      setSelectedCommodities([]);
      setEditingInsurance(null);
      setShowAddModal(false);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('❌ Error saving insurance:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any).code,
        insuranceType: formData.insuranceType,
        formData: formData,
        selectedCommodities: selectedCommodities
      });
      
      toast({
        title: "❌ Error",
        description: `Failed to save insurance policy. ${error instanceof Error ? error.message : 'Please try again.'}`,
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  // Handle edit
  const handleEdit = (insurance: InsuranceData) => {
    console.log('📝 Editing insurance:', insurance);
    console.log('🏢 Available warehouses:', warehouses.length);
    console.log('🌾 Available commodities:', commodities.length);
    console.log('👥 Available clients:', clients.length);
    
    setEditingInsurance(insurance);
    setFormData(insurance);
    
    // Populate selectedCommodities if the insurance has them
    if (insurance.selectedCommodities && Array.isArray(insurance.selectedCommodities)) {
      console.log('📦 Setting multiple commodities:', insurance.selectedCommodities);
      setSelectedCommodities(insurance.selectedCommodities);
    } else if (insurance.commodityName && insurance.varietyName) {
      // If single commodity, create array with one item
      console.log('📦 Setting single commodity:', insurance.commodityName, insurance.varietyName);
      setSelectedCommodities([{
        commodityName: insurance.commodityName,
        varietyName: insurance.varietyName
      }]);
    } else {
      console.log('⚠️ No commodities found in insurance data');
      setSelectedCommodities([]);
    }
    
    setShowAddModal(true);
  };

  // Handle delete
  const handleDelete = async (insurance: InsuranceData) => {
    try {
      await deleteDoc(doc(db, 'insurance', insurance.id!));
      toast({
        title: "✅ Insurance Deleted",
        description: "Insurance policy has been deleted successfully",
        className: "bg-green-100 border-green-500 text-green-700",
        duration: 3000,
      });
      setDeleteDialog({ open: false, insurance: null });
      fetchData(); // Refresh data
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to delete insurance policy. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  // Handle extend insurance submission
  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedInsuranceForAction) return;

    // Validate end dates are not in the past
    const today = getTodayDate();
    if (formData.firePolicyEndDate && formData.firePolicyEndDate < today) {
      toast({
        title: "❌ Invalid Date",
        description: "Fire policy end date cannot be in the past",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    
    if (formData.burglaryPolicyEndDate && formData.burglaryPolicyEndDate < today) {
      toast({
        title: "❌ Invalid Date", 
        description: "Burglary policy end date cannot be in the past",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    try {
      const updateData = {
        firePolicyEndDate: formData.firePolicyEndDate,
        burglaryPolicyEndDate: formData.burglaryPolicyEndDate,
      };

      await updateDoc(doc(db, 'insurance', selectedInsuranceForAction.id!), updateData);
      
      toast({
        title: "✅ Insurance Extended",
        description: "Insurance policy dates have been extended successfully",
        className: "bg-green-100 border-green-500 text-green-700",
        duration: 3000,
      });

      setShowExtendModal(false);
      setSelectedInsuranceForAction(null);
      setFormData({});
      fetchData(); // Refresh data
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to extend insurance policy. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  // Handle replace insurance submission
  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedInsuranceForAction) return;

    // Additional validation for bank-funded insurance
    if (formData.insuranceType === 'bank-funded' && !formData.bankFundedBy) {
      toast({
        title: "❌ Missing Information",
        description: "Please select a bank for bank-funded insurance",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    // Validate end dates are not in the past (only for non-bank-funded)
    const today = getTodayDate();
    if (formData.insuranceType !== 'bank-funded') {
      if (formData.firePolicyEndDate && formData.firePolicyEndDate < today) {
        toast({
          title: "❌ Invalid Date",
          description: "Fire policy end date cannot be in the past",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }
      
      if (formData.burglaryPolicyEndDate && formData.burglaryPolicyEndDate < today) {
        toast({
          title: "❌ Invalid Date", 
          description: "Burglary policy end date cannot be in the past",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }
    }

    try {
      // Prepare data based on insurance type
      let replaceDataToSave = {...formData};

      // For bank-funded insurance, set policy fields to N/A
      if (formData.insuranceType === 'bank-funded') {
        replaceDataToSave = {
          ...replaceDataToSave,
          firePolicyCompanyName: 'N/A - Bank Funded',
          firePolicyNumber: 'N/A - Bank Funded',
          firePolicyAmount: '0',
          firePolicyStartDate: new Date().toISOString().split('T')[0],
          firePolicyEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
          firePolicyUsedAmount: '0',
          firePolicyRemainingAmount: '0',
          burglaryPolicyCompanyName: 'N/A - Bank Funded',
          burglaryPolicyNumber: 'N/A - Bank Funded',
          burglaryPolicyAmount: '0',
          burglaryPolicyStartDate: new Date().toISOString().split('T')[0],
          burglaryPolicyEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
          burglaryPolicyUsedAmount: '0',
          burglaryPolicyRemainingAmount: '0',
        };
      } else {
        // For non-bank-funded insurance, calculate remaining amounts
        // Get the used amounts from the existing insurance record
        const existingFireUsed = parseFloat(selectedInsuranceForAction.firePolicyUsedAmount || '0');
        const existingBurglaryUsed = parseFloat(selectedInsuranceForAction.burglaryPolicyUsedAmount || '0');
        
        // Get the new policy amounts
        const newFireAmount = parseFloat(replaceDataToSave.firePolicyAmount || '0');
        const newBurglaryAmount = parseFloat(replaceDataToSave.burglaryPolicyAmount || '0');
        
        // Calculate remaining amounts: New Amount - Used Amount
        const fireRemaining = Math.max(0, newFireAmount - existingFireUsed).toFixed(2);
        const burglaryRemaining = Math.max(0, newBurglaryAmount - existingBurglaryUsed).toFixed(2);
        
        // Add the calculated remaining amounts to the data
        replaceDataToSave = {
          ...replaceDataToSave,
          firePolicyRemainingAmount: fireRemaining,
          burglaryPolicyRemainingAmount: burglaryRemaining,
          firePolicyUsedAmount: existingFireUsed.toFixed(2),
          burglaryPolicyUsedAmount: existingBurglaryUsed.toFixed(2),
        };
      }

      // Update the existing insurance with new data
      await updateDoc(doc(db, 'insurance', selectedInsuranceForAction.id!), replaceDataToSave);
      
      toast({
        title: "✅ Insurance Replaced",
        description: "New insurance policy has replaced the expired one successfully",
        className: "bg-green-100 border-green-500 text-green-700",
        duration: 3000,
      });

      setShowReplaceModal(false);
      setSelectedInsuranceForAction(null);
      setFormData({});
      fetchData(); // Refresh data
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to replace insurance policy. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  // Close modal and reset form
  const closeModal = () => {
    setShowAddModal(false);
    setEditingInsurance(null);
    setFormData({
      state: '',
      branch: '',
      location: '',
      warehouseName: '',
      warehouseCode: '',
      commodityName: '',
      // varietyName is optional and removed from form
      insuranceType: 'bank-funded',
      clientName: '',
      clientCode: '',
      clientAddress: '',
      bankFundedBy: '',
      firePolicyCompanyName: '',
      firePolicyNumber: '',
      firePolicyAmount: '',
      firePolicyStartDate: '',
      firePolicyEndDate: '',
      firePolicyUsedAmount: '0',
      burglaryPolicyCompanyName: '',
      burglaryPolicyNumber: '',
      burglaryPolicyAmount: '',
      burglaryPolicyStartDate: '',
      burglaryPolicyEndDate: '',
      burglaryPolicyUsedAmount: '0',
    });
    setSelectedCommodities([]);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Button 
               onClick={() => router.push('/master-data')} 
                variant="ghost" 
                className="flex items-center justify-center bg-orange-500 text-white hover:bg-orange-600 w-full sm:w-auto px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base"
                >
                ← Master Data
             </Button>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-center sm:text-left">Insurance Master Module</h1>
          </div>
          {/* Add Insurance button at top right corner */}
          <Button
            onClick={() => {
              // Reset form to initial state when adding new insurance
              setEditingInsurance(null);
              setFormData({
                state: '',
                branch: '',
                location: '',
                warehouseName: '',
                warehouseCode: '',
                commodityName: '',
                // varietyName is optional and removed from form
                insuranceType: 'bank-funded',
                clientName: '',
                clientCode: '',
                clientAddress: '',
                bankFundedBy: '',
                firePolicyCompanyName: '',
                firePolicyNumber: '',
                firePolicyAmount: '',
                firePolicyStartDate: '',
                firePolicyEndDate: '',
                firePolicyUsedAmount: '0',
                burglaryPolicyCompanyName: '',
                burglaryPolicyNumber: '',
                burglaryPolicyAmount: '',
                burglaryPolicyStartDate: '',
                burglaryPolicyEndDate: '',
                burglaryPolicyUsedAmount: '0',
              });
              setSelectedCommodities([]);
              setShowAddModal(true);
            }}
            className="bg-green-500 hover:bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3 shadow-lg text-sm sm:text-base w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Insurance
          </Button>
        </div>

        {/* Status Indicators Description */}
        <Card className="border-blue-300 bg-blue-50">
          <CardContent className="pt-4">
            <div className="text-sm">
              <h3 className="font-semibold text-blue-800 mb-2">📋 Insurance Status Indicators:</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-red-100 border border-red-300 rounded px-2 py-1">
                    <div className="relative">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-ping absolute"></div>
                      <div className="w-2 h-2 bg-red-600 rounded-full relative"></div>
                    </div>
                    <span className="text-red-800 text-xs font-medium">EXPIRING</span>
                  </div>
                  <span className="text-gray-700 text-sm">Fire policy expires within 5 days - Click to extend policy dates</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-blue-100 border border-blue-300 rounded px-2 py-1">
                    <Lightbulb className="w-3 h-3 fill-blue-500 text-blue-500" />
                    <span className="text-blue-800 text-xs font-medium">EXPIRED</span>
                  </div>
                  <span className="text-gray-700 text-sm">Fire policy has expired - Click to add new insurance policy</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search and Export Controls */}
        <Card className="border-green-300">
          <CardHeader className="bg-orange-100">
            <CardTitle className="text-orange-600">Search & Export Options</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search insurance policies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <CSVLink 
                data={csvData} 
                headers={csvHeaders} 
                filename={`insurance_master_${new Date().toISOString().split('T')[0]}.csv`}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 h-10 px-4 py-2"
                target="_blank"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </CSVLink>
            </div>
            
            {/* Entry count display */}
            <div className="flex justify-between items-center mt-3">
              <div className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                <strong>Total Entries: {filteredInsurance.length}</strong>
                {searchTerm && <span className="ml-2">(filtered from {insuranceData.length})</span>}
              </div>
              <div className="text-xs text-gray-500">
                {filteredInsurance.length > 0 && "Showing entries in ascending order by insurance code"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Insurance Data Table */}
        <Card className="border-green-300">
          <CardHeader className="bg-orange-100">
            <CardTitle className="text-orange-600">Insurance Policies</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <DataTable
              columns={insuranceColumns}
              data={filteredInsurance}
              isLoading={loading}
              error={error || undefined}
              wrapperClassName="border-green-300"
              headClassName="bg-orange-100 text-orange-600 font-bold"
              stickyHeader={true} // Freeze top row header
              stickyFirstColumn={true} // Freeze first column
              showGridLines={true} // Grid lines in table
            />
          </CardContent>
        </Card>

        {/* Add/Edit Insurance Modal */}
        <Dialog open={showAddModal} onOpenChange={(open) => {
          if (!open) {
            // Reset form state when modal is closed
            closeModal();
          } else {
            setShowAddModal(open);
          }
        }}>
          <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-orange-700 text-xl">
                {editingInsurance ? '🔄 Edit Insurance Policy' : '📋 Add New Insurance Policy'}
              </DialogTitle>
              <DialogDescription className="text-green-600">
                {editingInsurance ? 'Update insurance policy information' : 'Enter insurance policy details'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Insurance Type Selection */}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-green-600 font-medium">Insurance Type <span className="text-red-500">*</span></Label>
                  <Select
                    value={formData.insuranceType || ''}
                    onValueChange={(value) => handleInputChange('insuranceType', value)}
                    required
                  >
                    <SelectTrigger className="border-orange-300 focus:border-orange-500">
                      <SelectValue placeholder="Select insurance type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank-funded">Bank Funded</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="agrogreen">Agrogreen</SelectItem>
                      <SelectItem value="warehouse-owner">Warehouse Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Information based on insurance type */}
                {formData.insuranceType === 'agrogreen' && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>ℹ️ Agrogreen Insurance:</strong> This insurance is <strong>universal</strong> and can be applied to any warehouse and commodity.
                    </p>
                  </div>
                )}
                
                {formData.insuranceType === 'client' && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-sm text-purple-800">
                      <strong>ℹ️ Client Insurance:</strong> This insurance is <strong>shared</strong> across all warehouses that have the same client.
                    </p>
                  </div>
                )}
              </div>

              {/* Common Fields - Only show for bank-funded and warehouse-owner */}
              {(formData.insuranceType === 'bank-funded' || formData.insuranceType === 'warehouse-owner') && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-green-600 font-medium">Warehouse Name <span className="text-red-500">*</span></Label>
                      <Select
                        value={formData.warehouseName || ''}
                        onValueChange={(value) => handleInputChange('warehouseName', value)}
                        required
                      >
                        <SelectTrigger className="border-orange-300 focus:border-orange-500">
                          <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses.map(warehouse => (
                            <SelectItem key={warehouse.id} value={warehouse.warehouseName}>
                              {warehouse.warehouseName} ({warehouse.warehouseCode})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-green-600 font-medium">Warehouse Code</Label>
                      <Input
                        value={formData.warehouseCode || ''}
                        onChange={(e) => handleInputChange('warehouseCode', e.target.value)}
                        className="border-orange-300 focus:border-orange-500"
                        placeholder="Auto-filled from warehouse"
                        readOnly
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-green-600 font-medium">State</Label>
                      <Input
                        value={formData.state || ''}
                        className="border-orange-300 focus:border-orange-500"
                        placeholder="Auto-filled from warehouse"
                        readOnly
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Commodity Selection (Multiple selection support) - Only show for bank-funded and warehouse-owner */}
              {(formData.insuranceType === 'bank-funded' || formData.insuranceType === 'warehouse-owner') && (
                <div className="space-y-4">
                  <Label className="text-green-600 font-medium text-lg">Commodity & Variety Selection </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-green-600 font-medium">Commodity <span className="text-red-500">*</span></Label>
                      <Select
                        value={formData.commodityName || ''}
                        onValueChange={(value) => handleInputChange('commodityName', value)}
                        required
                      >
                        <SelectTrigger className="border-orange-300 focus:border-orange-500">
                          <SelectValue placeholder="Select commodity" />
                        </SelectTrigger>
                        <SelectContent>
                          {commodities.map(commodity => (
                            <SelectItem key={commodity.id} value={commodity.commodityName}>
                              {commodity.commodityName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Selected commodities display */}
                  {selectedCommodities.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="text-blue-800 font-semibold mb-2">Selected Commodities & Varieties:</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedCommodities.map((item, index) => (
                          <div key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                            <span>{item.commodityName}{item.varietyName ? ` - ${item.varietyName}` : ''}</span>
                            <button
                              type="button"
                              onClick={() => handleCommoditySelection(item.commodityName, item.varietyName)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bank Funded Specific Fields */}
              {formData.insuranceType === 'bank-funded' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Bank Funded By <span className="text-red-500">*</span></Label>
                    <div className="text-xs text-blue-600 mb-2">
                      Available banks: {banks.length} | Debug: Check console for bank data
                    </div>
                    <Select
                      value={formData.bankFundedBy || ''}
                      onValueChange={(value) => handleInputChange('bankFundedBy', value)}
                      required
                    >
                      <SelectTrigger className="border-orange-300 focus:border-orange-500">
                        <SelectValue placeholder="Select bank" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.length === 0 ? (
                          <SelectItem value="no-banks" disabled>
                            No banks available - Check Firebase collection
                          </SelectItem>
                        ) : (
                          banks.map(bank => {
                            console.log('Rendering bank in dropdown:', bank);
                            const displayName = (bank.bankName || bank.branch || `Bank in ${bank.state}`) || 'Unnamed Bank';
                            return (
                              <SelectItem key={bank.id} value={displayName}>
                                {displayName}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Bank Details Display */}
                  {formData.bankFundedBy && (
                    <div className="space-y-2">
                      <Label className="text-green-600 font-medium">Bank Details</Label>
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        {(() => {
                          const selectedBank = banks.find(bank => {
                            const displayName = bank.bankName || bank.branch || `Bank in ${bank.state}`;
                            return displayName === formData.bankFundedBy;
                          });
                          console.log('Looking for bank with name:', formData.bankFundedBy);
                          console.log('Found bank:', selectedBank);
                          return selectedBank ? (
                            <div className="space-y-1 text-sm">
                              <div><strong>Bank Code:</strong> {selectedBank.bankId}</div>
                              <div><strong>Bank Name:</strong> {selectedBank.bankName || selectedBank.branch}</div>
                              <div><strong>State:</strong> {selectedBank.state}</div>
                              <div><strong>Branch:</strong> {selectedBank.branch}</div>
                              {selectedBank.locations && selectedBank.locations.length > 0 && (
                                <div><strong>Locations:</strong> {selectedBank.locations.length} branch(es)</div>
                              )}
                            </div>
                          ) : (
                            <div className="text-gray-500 text-sm">Bank details not available</div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Client Specific Fields */}
              {formData.insuranceType === 'client' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Client Name <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.clientName || ''}
                      onValueChange={(value) => handleInputChange('clientName', value)}
                      required
                    >
                      <SelectTrigger className="border-orange-300 focus:border-orange-500">
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map(client => (
                          <SelectItem key={client.id} value={client.firmName}>
                            {client.firmName} ({client.clientId})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Client Code</Label>
                    <Input
                      value={formData.clientCode || ''}
                      className="border-orange-300 focus:border-orange-500"
                      placeholder="Auto-filled from client"
                      readOnly
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-green-600 font-medium">Client Address</Label>
                    <Input
                      value={formData.clientAddress || ''}
                      className="border-orange-300 focus:border-orange-500"
                      placeholder="Auto-filled from client master"
                      readOnly
                    />
                  </div>
                </div>
              )}

              {/* Fire Policy Details - Hidden for Bank Funded */}
              {formData.insuranceType !== 'bank-funded' && (
              <div className="space-y-4 border border-red-200 rounded-lg p-4 bg-red-50">
                <h3 className="text-red-800 font-semibold text-lg">🔥 Fire Policy Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Company Name <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.firePolicyCompanyName || ''}
                      onChange={(e) => handleInputChange('firePolicyCompanyName', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      placeholder="Fire insurance company name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Policy Number <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.firePolicyNumber || ''}
                      onChange={(e) => handleInputChange('firePolicyNumber', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      placeholder="Fire policy number"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Policy Amount <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      value={formData.firePolicyAmount || ''}
                      onChange={(e) => handleInputChange('firePolicyAmount', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      placeholder="Policy amount"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Start Date <span className="text-red-500">*</span></Label>
                    <Input
                      type="date"
                      value={formData.firePolicyStartDate || ''}
                      onChange={(e) => handleInputChange('firePolicyStartDate', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">End Date <span className="text-red-500">*</span></Label>
                    <Input
                      type="date"
                      value={formData.firePolicyEndDate || ''}
                      onChange={(e) => handleInputChange('firePolicyEndDate', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      min={getTodayDate()} // Cannot select past dates
                      required
                    />
                  </div>
                </div>
              </div>
              )}

              {/* Burglary Policy Details - Hidden for Bank Funded */}
              {formData.insuranceType !== 'bank-funded' && (
              <div className="space-y-4 border border-orange-200 rounded-lg p-4 bg-orange-50">
                <h3 className="text-orange-800 font-semibold text-lg">🛡️ Burglary Policy Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Company Name <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.burglaryPolicyCompanyName || ''}
                      onChange={(e) => handleInputChange('burglaryPolicyCompanyName', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      placeholder="Burglary insurance company name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Policy Number <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.burglaryPolicyNumber || ''}
                      onChange={(e) => handleInputChange('burglaryPolicyNumber', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      placeholder="Burglary policy number"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Policy Amount <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      value={formData.burglaryPolicyAmount || ''}
                      onChange={(e) => handleInputChange('burglaryPolicyAmount', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      placeholder="Policy amount"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Start Date <span className="text-red-500">*</span></Label>
                    <Input
                      type="date"
                      value={formData.burglaryPolicyStartDate || ''}
                      onChange={(e) => handleInputChange('burglaryPolicyStartDate', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">End Date <span className="text-red-500">*</span></Label>
                    <Input
                      type="date"
                      value={formData.burglaryPolicyEndDate || ''}
                      onChange={(e) => handleInputChange('burglaryPolicyEndDate', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      min={getTodayDate()} // Cannot select past dates
                      required
                    />
                  </div>
                </div>
              </div>
              )}

              {/* Modal Footer */}
              <div className="flex justify-end space-x-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  className="border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-green-500 hover:bg-green-600 text-white px-8 py-2 shadow-lg"
                >
                  {editingInsurance ? '🔄 Update Insurance' : '✅ Add Insurance'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, insurance: null })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this insurance policy? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteDialog.insurance && handleDelete(deleteDialog.insurance)}
                className="bg-red-500 hover:bg-red-600"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Extend Insurance Modal */}
        <Dialog open={showExtendModal} onOpenChange={setShowExtendModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-red-700 text-xl flex items-center gap-2">
                <Lightbulb className="w-5 h-5 fill-red-500 text-red-500" />
                🔄 Extend Insurance Policy
              </DialogTitle>
              <DialogDescription className="text-red-600">
                Insurance Code: <strong>{selectedInsuranceForAction?.insuranceCode}</strong>
                <br />
                Extend the fire policy and burglary policy end dates
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleExtendSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-red-600 font-medium">Fire Policy End Date <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={formData.firePolicyEndDate || ''}
                    onChange={(e) => handleInputChange('firePolicyEndDate', e.target.value)}
                    className="border-red-300 focus:border-red-500"
                    min={getTodayDate()}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-orange-600 font-medium">Burglary Policy End Date <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={formData.burglaryPolicyEndDate || ''}
                    onChange={(e) => handleInputChange('burglaryPolicyEndDate', e.target.value)}
                    className="border-orange-300 focus:border-orange-500"
                    min={getTodayDate()}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowExtendModal(false);
                    setSelectedInsuranceForAction(null);
                    setFormData({});
                  }}
                  className="border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-red-500 hover:bg-red-600 text-white px-8 py-2 shadow-lg"
                >
                  🔄 Extend Policies
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Replace Insurance Modal */}
        <Dialog open={showReplaceModal} onOpenChange={setShowReplaceModal}>
          <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-blue-700 text-xl flex items-center gap-2">
                <Lightbulb className="w-5 h-5 fill-blue-500 text-blue-500" />
                🆕 Replace Expired Insurance
              </DialogTitle>
              <DialogDescription className="text-blue-600">
                Insurance Code: <strong>{selectedInsuranceForAction?.insuranceCode}</strong>
                <br />
                Add new insurance to replace the expired policy
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleReplaceSubmit} className="space-y-6">
              {/* Insurance Type Selection */}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-green-600 font-medium">Insurance Type <span className="text-red-500">*</span></Label>
                  <Select
                    value={formData.insuranceType || ''}
                    onValueChange={(value) => handleInputChange('insuranceType', value)}
                    required
                  >
                    <SelectTrigger className="border-orange-300 focus:border-orange-500">
                      <SelectValue placeholder="Select insurance type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank-funded">Bank Funded</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="agrogreen">Agrogreen</SelectItem>
                      <SelectItem value="warehouse-owner">Warehouse Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Information based on insurance type */}
                {formData.insuranceType === 'agrogreen' && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>ℹ️ Agrogreen Insurance:</strong> This insurance is <strong>universal</strong> and can be applied to any warehouse and commodity.
                    </p>
                  </div>
                )}
                
                {formData.insuranceType === 'client' && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-sm text-purple-800">
                      <strong>ℹ️ Client Insurance:</strong> This insurance is <strong>shared</strong> across all warehouses that have the same client.
                    </p>
                  </div>
                )}
              </div>

              {/* Common Fields - Only show for bank-funded and warehouse-owner */}
              {(formData.insuranceType === 'bank-funded' || formData.insuranceType === 'warehouse-owner') && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Warehouse Name <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.warehouseName || ''}
                      onValueChange={(value) => handleInputChange('warehouseName', value)}
                      required
                    >
                      <SelectTrigger className="border-orange-300 focus:border-orange-500">
                        <SelectValue placeholder="Select warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map(warehouse => (
                          <SelectItem key={warehouse.id} value={warehouse.warehouseName}>
                            {warehouse.warehouseName} ({warehouse.warehouseCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Commodity <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.commodityName || ''}
                      onValueChange={(value) => handleInputChange('commodityName', value)}
                      required
                    >
                      <SelectTrigger className="border-orange-300 focus:border-orange-500">
                        <SelectValue placeholder="Select commodity" />
                      </SelectTrigger>
                      <SelectContent>
                        {commodities.map(commodity => (
                          <SelectItem key={commodity.id} value={commodity.commodityName}>
                            {commodity.commodityName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Variety <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.varietyName || ''}
                      onValueChange={(value) => handleInputChange('varietyName', value)}
                      required
                    >
                      <SelectTrigger className="border-orange-300 focus:border-orange-500">
                        <SelectValue placeholder="Select variety" />
                      </SelectTrigger>
                      <SelectContent>
                        {commodities
                          .find(c => c.commodityName === formData.commodityName)
                          ?.varieties?.map(variety => (
                            <SelectItem key={variety.varietyId} value={variety.varietyName}>
                              {variety.varietyName}
                            </SelectItem>
                          )) || []}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Bank Funded Specific Fields */}
              {formData.insuranceType === 'bank-funded' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Bank Funded By <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.bankFundedBy || ''}
                      onValueChange={(value) => handleInputChange('bankFundedBy', value)}
                      required
                    >
                      <SelectTrigger className="border-orange-300 focus:border-orange-500">
                        <SelectValue placeholder="Select bank" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.length === 0 ? (
                          <SelectItem value="no-banks" disabled>
                            No banks available
                          </SelectItem>
                        ) : (
                          banks.map(bank => {
                            const displayName = (bank.bankName || bank.branch || `Bank in ${bank.state}`) || 'Unnamed Bank';
                            return (
                              <SelectItem key={bank.id} value={displayName}>
                                {displayName}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Bank Details Display */}
                  {formData.bankFundedBy && (
                    <div className="space-y-2">
                      <Label className="text-green-600 font-medium">Bank Details</Label>
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        {(() => {
                          const selectedBank = banks.find(bank => {
                            const displayName = bank.bankName || bank.branch || `Bank in ${bank.state}`;
                            return displayName === formData.bankFundedBy;
                          });
                          return selectedBank ? (
                            <div className="space-y-1 text-sm">
                              <div><strong>Bank Code:</strong> {selectedBank.bankId}</div>
                              <div><strong>Bank Name:</strong> {selectedBank.bankName || selectedBank.branch}</div>
                              <div><strong>State:</strong> {selectedBank.state}</div>
                              <div><strong>Branch:</strong> {selectedBank.branch}</div>
                              {selectedBank.locations && selectedBank.locations.length > 0 && (
                                <div><strong>Locations:</strong> {selectedBank.locations.length} branch(es)</div>
                              )}
                            </div>
                          ) : (
                            <div className="text-gray-500 text-sm">Bank details not available</div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Fire Policy Details - Hidden for Bank Funded */}
              {formData.insuranceType !== 'bank-funded' && (
              <div className="space-y-4 border border-red-200 rounded-lg p-4 bg-red-50">
                <h3 className="text-red-800 font-semibold text-lg">🔥 New Fire Policy Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Company Name <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.firePolicyCompanyName || ''}
                      onChange={(e) => handleInputChange('firePolicyCompanyName', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      placeholder="Fire insurance company name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Policy Number <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.firePolicyNumber || ''}
                      onChange={(e) => handleInputChange('firePolicyNumber', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      placeholder="Fire policy number"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Policy Amount <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      value={formData.firePolicyAmount || ''}
                      onChange={(e) => handleInputChange('firePolicyAmount', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      placeholder="Policy amount"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Start Date <span className="text-red-500">*</span></Label>
                    <Input
                      type="date"
                      value={formData.firePolicyStartDate || ''}
                      onChange={(e) => handleInputChange('firePolicyStartDate', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">End Date <span className="text-red-500">*</span></Label>
                    <Input
                      type="date"
                      value={formData.firePolicyEndDate || ''}
                      onChange={(e) => handleInputChange('firePolicyEndDate', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      min={getTodayDate()}
                      required
                    />
                  </div>
                </div>
              </div>
              )}

              {/* Burglary Policy Details - Hidden for Bank Funded */}
              {formData.insuranceType !== 'bank-funded' && (
              <div className="space-y-4 border border-orange-200 rounded-lg p-4 bg-orange-50">
                <h3 className="text-orange-800 font-semibold text-lg">🛡️ New Burglary Policy Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Company Name <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.burglaryPolicyCompanyName || ''}
                      onChange={(e) => handleInputChange('burglaryPolicyCompanyName', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      placeholder="Burglary insurance company name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Policy Number <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.burglaryPolicyNumber || ''}
                      onChange={(e) => handleInputChange('burglaryPolicyNumber', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      placeholder="Burglary policy number"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Policy Amount <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      value={formData.burglaryPolicyAmount || ''}
                      onChange={(e) => handleInputChange('burglaryPolicyAmount', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      placeholder="Policy amount"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">Start Date <span className="text-red-500">*</span></Label>
                    <Input
                      type="date"
                      value={formData.burglaryPolicyStartDate || ''}
                      onChange={(e) => handleInputChange('burglaryPolicyStartDate', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-600 font-medium">End Date <span className="text-red-500">*</span></Label>
                    <Input
                      type="date"
                      value={formData.burglaryPolicyEndDate || ''}
                      onChange={(e) => handleInputChange('burglaryPolicyEndDate', e.target.value)}
                      className="border-orange-300 focus:border-orange-500"
                      min={getTodayDate()}
                      required
                    />
                  </div>
                </div>
              </div>
              )}

              <div className="flex justify-end space-x-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowReplaceModal(false);
                    setSelectedInsuranceForAction(null);
                    setFormData({});
                  }}
                  className="border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-2 shadow-lg"
                >
                  🆕 Replace Insurance
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
