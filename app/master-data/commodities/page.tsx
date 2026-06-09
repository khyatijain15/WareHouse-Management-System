"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit, CheckCircle, AlertCircle, X, Download, Search, Plus, Package, Minus } from "lucide-react";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DataTable } from '@/components/data-table';
import type { Row } from '@tanstack/react-table';

interface Particular {
  name: string;
  minPercentage: number;
  maxPercentage: number;
}

interface CommodityVariety {
  id?: string;
  varietyId: string;
  varietyName: string;
  locationId: string;
  locationName: string;
  branchName: string;
  rate: number;
  particulars: Particular[];
  createdAt?: string;
  commodityName?: string; // Added for table display
}

interface CommodityData {
  id?: string;
  commodityId: string;
  commodityName: string;
  varieties: CommodityVariety[];
  createdAt?: string;
}

interface BranchLocation {
  locationId: string;
  locationName: string;
  branchName: string;
  state: string;
  branch: string;
}

// Define columns for DataTable
const commodityColumns = [
  {
    accessorKey: "commodityId",
    header: "Commodity ID",
    cell: ({ row }: { row: Row<any> }) => <span className="font-bold text-orange-800 w-full flex justify-center">{row.getValue("commodityId")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "commodityName", 
    header: "Commodity Name",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 font-medium w-full flex justify-center">{row.getValue("commodityName")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "varietyId",
    header: "Variety ID", 
    cell: ({ row }: { row: Row<any> }) => <span className="text-blue-700 w-full flex justify-center">{row.getValue("varietyId") || '-'}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "varietyName",
    header: "Variety Name",
    cell: ({ row }: { row: Row<any> }) => <span className="text-blue-700 w-full flex justify-center">{row.getValue("varietyName") || '-'}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "locationName", 
    header: "Location",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("locationName") || '-'}</span>,
    meta: { align: 'center' },
  },
  // {
  //   accessorKey: "branchName",
  //   header: "Branch",
  //   cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("branchName") || '-'}</span>,
  //   meta: { align: 'center' },
  // },
  {
    accessorKey: "rate",
    header: "Rate (Rs.)", 
    cell: ({ row }: { row: Row<any> }) => {
      const rate = row.getValue("rate") as number;
      return <span className="text-green-700 font-mono w-full flex justify-center">{rate ? `Rs.${rate.toLocaleString()}` : '-'}</span>;
    },
    meta: { align: 'center' },
  },
  {
    accessorKey: "particulars",
    header: "Particulars",
    cell: ({ row }: { row: Row<any> }) => {
      const particulars = row.getValue("particulars") as Particular[] | undefined;
      return (
        <div className="w-full flex justify-center">
          {particulars && particulars.length > 0 ? (
            <div className="space-y-1 text-xs text-center">
              {particulars.map((p, index) => (
                <div key={index} className="bg-blue-100 px-2 py-1 rounded border">
                  <span className="font-medium text-blue-800">{p.name}: {p.minPercentage}%-{p.maxPercentage}%</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-gray-400 text-xs">-</span>
          )}
        </div>
      );
    },
    meta: { align: 'center' },
  },
  {
    accessorKey: "createdAt",
    header: "Created Date",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("createdAt") ? new Date(row.getValue("createdAt")).toLocaleDateString() : '-'}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "actions",
    header: "Actions",
    cell: ({ row }: { row: Row<any> }) => {
      const rowData = row.original;
      const isCommodityRow = !rowData.isVariety;
      const isVarietyRow = rowData.isVariety;
      
      return (
        <div className="flex space-x-2 justify-center">
          {isCommodityRow && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
                onClick={() => {
                  const event = new CustomEvent('addVariety', { detail: rowData });
                  document.dispatchEvent(event);
                }}
                title="Add Variety"
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-orange-300 text-orange-600 hover:bg-orange-50"
                onClick={() => {
                  const event = new CustomEvent('editCommodity', { detail: rowData });
                  document.dispatchEvent(event);
                }}
                title="Edit Commodity"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                size="sm" 
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete ${rowData.commodityName} and all its varieties? This action cannot be undone.`)) {
                    const event = new CustomEvent('deleteCommodity', { detail: rowData.id });
                    document.dispatchEvent(event);
                  }
                }}
                title="Delete Commodity"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
          {isVarietyRow && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="border-orange-300 text-orange-600 hover:bg-orange-50"
                onClick={() => {
                  const event = new CustomEvent('editVariety', { 
                    detail: { 
                      commodity: rowData.parentCommodity,
                      varietyId: rowData.varietyId 
                    } 
                  });
                  document.dispatchEvent(event);
                }}
                title="Edit Variety"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                size="sm" 
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete ${rowData.varietyName}? This action cannot be undone.`)) {
                    const event = new CustomEvent('deleteVariety', { 
                      detail: { 
                        commodityId: rowData.parentCommodity.id,
                        varietyId: rowData.varietyId 
                      } 
                    });
                    document.dispatchEvent(event);
                  }
                }}
                title="Delete Variety"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      );
    },
    meta: { align: 'center' },
  },
];

export default function CommodityModulePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [commodities, setCommodities] = useState<CommodityData[]>([]);
  const [branchLocations, setBranchLocations] = useState<BranchLocation[]>([]);
  const [filteredCommodities, setFilteredCommodities] = useState<CommodityData[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CommodityData>({
    commodityId: '',
    commodityName: '',
    varieties: [],
  });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAddCommodityModal, setShowAddCommodityModal] = useState(false);
  const [showAddVarietyModal, setShowAddVarietyModal] = useState(false);
  const [selectedCommodity, setSelectedCommodity] = useState<CommodityData | null>(null);
  const [varietyFormData, setVarietyFormData] = useState<CommodityVariety>({
    varietyId: '',
    varietyName: '',
    locationId: '',
    locationName: '',
    branchName: '',
    rate: 0,
    particulars: [{ name: 'Moisture', minPercentage: 0, maxPercentage: 15 }],
  });
  const [isEditingVariety, setIsEditingVariety] = useState(false);
  const [editingVarietyId, setEditingVarietyId] = useState<string | null>(null);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Check if user has access (admin and checker can access)
  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'checker') {
      router.push('/dashboard');
    }
  }, [user?.role, router]);

  // Load commodities and branch locations data
  useEffect(() => {
    loadCommodities();
    loadBranchLocations();
  }, []);

  // Filter commodities based on search term
  useEffect(() => {
    filterCommoditiesBySearch();
  }, [commodities, searchTerm]);

  // Event listeners for table actions
  useEffect(() => {
    const handleAddVariety = (event: any) => {
      handleAddVarietyAction(event.detail);
    };
    
    const handleEditCommodity = (event: any) => {
      handleEdit(event.detail);
    };
    
    const handleDeleteCommodity = (event: any) => {
      handleDelete(event.detail);
    };
    
    const handleEditVariety = (event: any) => {
      handleEditVarietyAction(event.detail);
    };
    
    const handleDeleteVariety = (event: any) => {
      handleDeleteVarietyAction(event.detail);
    };
    
    document.addEventListener('addVariety', handleAddVariety);
    document.addEventListener('editCommodity', handleEditCommodity);
    document.addEventListener('deleteCommodity', handleDeleteCommodity);
    document.addEventListener('editVariety', handleEditVariety);
    document.addEventListener('deleteVariety', handleDeleteVariety);
    
    return () => {
      document.removeEventListener('addVariety', handleAddVariety);
      document.removeEventListener('editCommodity', handleEditCommodity);
      document.removeEventListener('deleteCommodity', handleDeleteCommodity);
      document.removeEventListener('editVariety', handleEditVariety);
      document.removeEventListener('deleteVariety', handleDeleteVariety);
    };
  }, [commodities]); // Add commodities dependency so handlers update when data loads

  // Real-time validation for commodity name uniqueness
  useEffect(() => {
    if (formData.commodityName.trim().length >= 3) {
      const timeoutId = setTimeout(() => {
        if (!isCommodityNameUnique(formData.commodityName, editingId ?? undefined)) {
          console.log('🚫 DUPLICATE DETECTED - Showing toast for:', formData.commodityName);
          
          toast({
            title: "⚠️ Duplicate Commodity Name",
            description: `"${formData.commodityName}" already exists (case-insensitive). Please choose a different name.`,
            variant: "destructive",
            duration: 4000,
          });
        }
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [formData.commodityName, commodities, editingId]);

  // Prepare table data - flatten commodity-variety pairs and sort by commodity ID
  const tableData = useMemo(() => {
    const dataToDisplay = filteredCommodities.length > 0 || searchTerm ? filteredCommodities : commodities;
    const flattened: any[] = [];
    
    // Sort commodities by commodityId first
    const sortedCommodities = [...dataToDisplay].sort((a, b) => a.commodityId.localeCompare(b.commodityId));
    
    sortedCommodities.forEach(commodity => {
      if (commodity.varieties.length === 0) {
        // Commodity without varieties
        flattened.push({
          id: commodity.id,
          commodityId: commodity.commodityId,
          commodityName: commodity.commodityName,
          varietyId: '',
          varietyName: '',
          locationName: '',
          branchName: '',
          rate: null,
          particulars: [],
          createdAt: commodity.createdAt,
          isVariety: false
        });
      } else {
        // First add the commodity row
        flattened.push({
          id: commodity.id,
          commodityId: commodity.commodityId,
          commodityName: commodity.commodityName,
          varietyId: '',
          varietyName: `${commodity.varieties.length} varieties`,
          locationName: '',
          branchName: '',
          rate: null,
          particulars: [],
          createdAt: commodity.createdAt,
          isVariety: false,
          varietiesCount: commodity.varieties.length
        });
        
        // Then add variety rows sorted by variety ID
        const sortedVarieties = [...commodity.varieties].sort((a, b) => a.varietyId.localeCompare(b.varietyId));
        sortedVarieties.forEach(variety => {
          flattened.push({
            id: `${commodity.id}-${variety.varietyId}`,
            commodityId: '',
            commodityName: commodity.commodityName,
            varietyId: variety.varietyId,
            varietyName: variety.varietyName,
            locationName: variety.locationName,
            branchName: variety.branchName,
            rate: variety.rate,
            particulars: variety.particulars,
            createdAt: variety.createdAt,
            isVariety: true,
            parentCommodity: commodity
          });
        });
      }
    });
    
    return flattened;
  }, [commodities, filteredCommodities, searchTerm]);

  // Action handlers for table events
  const handleAddVarietyAction = (rowData: any) => {
    console.log('Adding variety for row:', rowData);
    
    // Find the original commodity from the commodities array
    let originalCommodity: CommodityData | null = null;
    
    if (rowData.isVariety && rowData.parentCommodity) {
      // If it's a variety row, use the parent commodity
      originalCommodity = rowData.parentCommodity;
    } else {
      // If it's a commodity row, find it by ID or commodityId
      originalCommodity = commodities.find(c => 
        c.id === rowData.id || c.commodityId === rowData.commodityId
      ) || null;
      
      // If still not found, try searching in both commodityName as last resort
      if (!originalCommodity) {
        originalCommodity = commodities.find(c => 
          c.commodityName === rowData.commodityName
        ) || null;
      }
    }
    
    if (!originalCommodity) {
      console.error('❌ Could not find original commodity');
      console.error('Row data:', rowData);
      console.error('Available commodities:', commodities.map(c => ({ id: c.id, commodityId: c.commodityId, name: c.commodityName })));
      toast({
        title: "❌ Error",
        description: "Could not find commodity data. Please refresh the page and try again.",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }
    
    console.log('✅ Found original commodity:', originalCommodity);
    
    // Ensure varieties array exists
    const commodityWithVarieties = {
      ...originalCommodity,
      varieties: originalCommodity.varieties || []
    };
    
    setSelectedCommodity(commodityWithVarieties);
    setVarietyFormData({
      varietyId: '',
      varietyName: '',
      locationId: '',
      locationName: '',
      branchName: '',
      rate: 0,
      particulars: [{ name: 'Moisture', minPercentage: 0, maxPercentage: 15 }],
    });
    setShowAddVarietyModal(true);
  };

  const handleEdit = (rowData: any) => {
    console.log('Editing commodity for row:', rowData);
    
    // Find the original commodity from the commodities array
    let originalCommodity: CommodityData | null = null;
    
    if (rowData.isVariety && rowData.parentCommodity) {
      // If it's a variety row, use the parent commodity
      originalCommodity = rowData.parentCommodity;
    } else {
      // If it's a commodity row, find it by ID or commodityId
      originalCommodity = commodities.find(c => 
        c.id === rowData.id || c.commodityId === rowData.commodityId
      ) || null;
      
      // If still not found, try searching by commodityName as last resort
      if (!originalCommodity) {
        originalCommodity = commodities.find(c => 
          c.commodityName === rowData.commodityName
        ) || null;
      }
    }
    
    if (!originalCommodity) {
      console.error('❌ Could not find original commodity for editing');
      console.error('Row data:', rowData);
      console.error('Available commodities:', commodities.map(c => ({ id: c.id, commodityId: c.commodityId, name: c.commodityName })));
      toast({
        title: "❌ Error",
        description: "Could not find commodity data. Please refresh the page and try again.",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }
    
    console.log('✅ Found original commodity for editing:', originalCommodity);
    setFormData(originalCommodity);
    setEditingId(originalCommodity.id || null);
    setIsEditing(true);
    setShowAddCommodityModal(true);
  };

  const handleDelete = async (commodityId: string) => {
    console.log('Deleting commodity with ID:', commodityId);
    try {
      await deleteDoc(doc(db, 'commodities', commodityId));
      setSuccessMessage({
        title: "Commodity Deleted Successfully! 🗑️",
        description: "The commodity and all its varieties have been permanently removed from the database."
      });
      setShowSuccessModal(true);
      loadCommodities();
      
      // Auto close modal after 3 seconds for delete
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error deleting commodity:', error);
      toast({
        title: "❌ Delete Failed",
        description: "Failed to delete commodity. Please check your connection and try again.",
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  const handleEditVarietyAction = (detail: { commodity: CommodityData; varietyId: string }) => {
    console.log('Editing variety:', detail.varietyId, 'in commodity:', detail.commodity.commodityName);
    const varietyToEdit = detail.commodity.varieties.find(v => v.varietyId === detail.varietyId);
    if (varietyToEdit) {
      setSelectedCommodity(detail.commodity);
      setVarietyFormData({
        varietyId: varietyToEdit.varietyId,
        varietyName: varietyToEdit.varietyName,
        locationId: varietyToEdit.locationId,
        locationName: varietyToEdit.locationName,
        branchName: varietyToEdit.branchName,
        rate: varietyToEdit.rate,
        particulars: varietyToEdit.particulars || [{ name: 'Moisture', minPercentage: 0, maxPercentage: 15 }],
      });
      setIsEditingVariety(true);
      setEditingVarietyId(detail.varietyId);
      setShowAddVarietyModal(true);
    }
  };

  const handleDeleteVarietyAction = async (detail: { commodityId: string; varietyId: string }) => {
    console.log('Deleting variety:', detail.varietyId, 'from commodity:', detail.commodityId);
    try {
      // Get the current commodity data
      const commodityDocRef = doc(db, 'commodities', detail.commodityId);
      const commodityDocSnap = await getDoc(commodityDocRef);
      
      if (!commodityDocSnap.exists()) {
        throw new Error('Commodity not found');
      }
      
      const commodityData = commodityDocSnap.data() as CommodityData;
      const existingVarieties = Array.isArray(commodityData.varieties) ? commodityData.varieties : [];
      
      // Filter out the variety to delete
      const updatedVarieties = existingVarieties.filter(v => v.varietyId !== detail.varietyId);
      
      console.log('Existing varieties:', existingVarieties);
      console.log('Updated varieties after deletion:', updatedVarieties);
      
      // Update the commodity with the new varieties array
      await updateDoc(commodityDocRef, { varieties: updatedVarieties });
      
      setSuccessMessage({
        title: "Variety Deleted Successfully! 🗑️",
        description: "The variety has been permanently removed from the commodity."
      });
      setShowSuccessModal(true);
      
      // Reload commodities to get updated data
      await loadCommodities();
      
      // Auto close modal after 3 seconds for delete
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error deleting variety:', error);
      toast({
        title: "❌ Delete Failed",
        description: `Failed to delete variety. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  const loadCommodities = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'commodities'));
      const commoditiesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        varieties: doc.data().varieties || []
      })) as CommodityData[];
      setCommodities(commoditiesData);
    } catch (error) {
      console.error('Error loading commodities:', error);
    }
  };

  const loadBranchLocations = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'branches'));
      const branchesData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          state: data.state,
          branch: data.branch,
          locations: data.locations || []
        };
      });
      
      // Flatten all locations from all branches
      const allLocations: BranchLocation[] = [];
      branchesData.forEach(branchData => {
        if (branchData.locations && branchData.locations.length > 0) {
          branchData.locations.forEach((location: any) => {
            allLocations.push({
              locationId: location.locationId,
              locationName: location.locationName,
              branchName: branchData.name, // This should contain the branch name
              state: branchData.state,
              branch: branchData.branch
            });
          });
        }
      });
      
      console.log('🏢 Branch locations loaded:', allLocations.slice(0, 2)); // Debug log first 2 items
      setBranchLocations(allLocations);
    } catch (error) {
      console.error('Error loading branch locations:', error);
    }
  };

  const filterCommoditiesBySearch = () => {
    if (!searchTerm.trim()) {
      setFilteredCommodities(commodities);
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = commodities.filter(commodity =>
      commodity.commodityName.toLowerCase().includes(searchLower) ||
      commodity.commodityId.toLowerCase().includes(searchLower) ||
      commodity.varieties.some(variety => 
        variety.varietyName.toLowerCase().includes(searchLower) ||
        variety.locationName.toLowerCase().includes(searchLower) ||
        variety.branchName.toLowerCase().includes(searchLower)
      )
    );

    setFilteredCommodities(filtered);
  };

  const exportToCSV = () => {
    const dataToExport = searchTerm.trim() ? filteredCommodities : commodities;
    
    if (dataToExport.length === 0) {
      toast({
        title: "❌ No Data to Export",
        description: "There are no commodities to export.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    // Sort commodities by commodityId in ascending order
    const sortedData = [...dataToExport].sort((a, b) => a.commodityId.localeCompare(b.commodityId));

    const headers = [
      'Commodity ID', 'Commodity Name', 'Variety ID', 'Variety Name', 'Location', 'Rate (Rs.)', 'Particulars', 'Commodity Created Date', 'Variety Created Date'
    ];

    const csvData = [headers];
    
    sortedData.forEach(commodity => {
      if (commodity.varieties.length === 0) {
        // Commodity without varieties
        csvData.push([
          commodity.commodityId,
          commodity.commodityName,
          '',
          '',
          '',
          '',
          '',
          commodity.createdAt ? new Date(commodity.createdAt).toLocaleDateString() : '',
          ''
        ]);
      } else {
        // Sort varieties by variety ID for consistent export
        const sortedVarieties = [...commodity.varieties].sort((a, b) => a.varietyId.localeCompare(b.varietyId));
        
        // Commodity with varieties
        sortedVarieties.forEach(variety => {
          csvData.push([
            commodity.commodityId,
            commodity.commodityName,
            variety.varietyId,
            variety.varietyName,
            variety.locationName || '',
            variety.rate ? `Rs. ${variety.rate}` : '',
            variety.particulars?.map(p => `${p.name}: ${p.minPercentage}%-${p.maxPercentage}%`).join('; ') || '',
            commodity.createdAt ? new Date(commodity.createdAt).toLocaleDateString() : '',
            variety.createdAt ? new Date(variety.createdAt).toLocaleDateString() : ''
          ]);
        });
      }
    });

    const csvContent = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;
    
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Use proper filename with search context
    const filename = searchTerm.trim() 
      ? `commodities-filtered-${new Date().toISOString().split('T')[0]}.csv`
      : `commodities-complete-${new Date().toISOString().split('T')[0]}.csv`;
    a.download = filename;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "✅ Export Successful",
      description: `${csvData.length - 1} records exported to ${filename}`,
      className: "bg-green-100 border-green-500 text-green-700",
      duration: 3000,
    });
  };

  // Generate unique commodity ID
  const generateCommodityId = () => {
    if (commodities.length === 0) {
      return 'CM-0001';
    }
    
    // Extract numbers from existing commodity IDs and find the highest
    const existingNumbers = commodities
      .map(commodity => commodity.commodityId)
      .filter(id => id && id.startsWith('CM-'))
      .map(id => parseInt(id.split('-')[1]))
      .filter(num => !isNaN(num));
    
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;
    
    return `CM-${nextNumber.toString().padStart(4, '0')}`;
  };

  // Generate unique variety ID 
  const generateVarietyId = () => {
    // Get all existing variety IDs from all commodities
    const allVarietyIds: string[] = [];
    commodities.forEach(commodity => {
      commodity.varieties.forEach(variety => {
        if (variety.varietyId) {
          allVarietyIds.push(variety.varietyId);
        }
      });
    });

    const existingNumbers = allVarietyIds
      .filter(id => id && id.startsWith('CV-'))
      .map(id => parseInt(id.split('-')[1]))
      .filter(num => !isNaN(num));
    
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;
    
    return `CV-${nextNumber.toString().padStart(4, '0')}`;
  };

  // Check if commodity name is unique (case-insensitive)
  const isCommodityNameUnique = (commodityName: string, excludeId?: string) => {
    const nameLower = commodityName.toLowerCase().trim();
    const isDuplicate = commodities.some(commodity => 
      commodity.commodityName.toLowerCase().trim() === nameLower && commodity.id !== excludeId
    );
    
    return !isDuplicate;
  };

  const handleInputChange = (field: keyof CommodityData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleVarietyInputChange = (field: keyof CommodityVariety, value: string | number | Particular[]) => {
    setVarietyFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleParticularChange = (index: number, field: keyof Particular, value: string | number) => {
    const updatedParticulars = [...varietyFormData.particulars];
    updatedParticulars[index] = { ...updatedParticulars[index], [field]: value };
    setVarietyFormData(prev => ({ ...prev, particulars: updatedParticulars }));
  };

  const addParticular = () => {
    setVarietyFormData(prev => ({
      ...prev,
      particulars: [...prev.particulars, { name: '', minPercentage: 0, maxPercentage: 0 }]
    }));
  };

  const removeParticular = (index: number) => {
    if (varietyFormData.particulars.length > 1) {
      const updatedParticulars = varietyFormData.particulars.filter((_, i) => i !== index);
      setVarietyFormData(prev => ({ ...prev, particulars: updatedParticulars }));
    }
  };

  const handleLocationSelect = (locationId: string) => {
    const selectedLocation = branchLocations.find(loc => loc.locationId === locationId);
    console.log('🔍 Selected location:', selectedLocation); // Debug log
    if (selectedLocation) {
      setVarietyFormData(prev => ({
        ...prev,
        locationId: selectedLocation.locationId,
        locationName: selectedLocation.locationName,
        branchName: selectedLocation.branchName
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate commodity name uniqueness
    if (!isCommodityNameUnique(formData.commodityName, editingId ?? undefined)) {
      console.log('🚫 SUBMIT BLOCKED - Duplicate commodity name:', formData.commodityName);
      
      toast({
        title: "🚫 Cannot Save - Duplicate Commodity Name",
        description: `"${formData.commodityName}" is already registered. Commodity names must be unique (case-insensitive). Please choose a different name.`,
        variant: "destructive",
        duration: 5000,
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const commodityData = {
        ...formData,
        createdAt: isEditing ? formData.createdAt : new Date().toISOString(),
      };

      if (isEditing && editingId) {
        // Update existing commodity
        await updateDoc(doc(db, 'commodities', editingId), commodityData);
        setSuccessMessage({
          title: "Commodity Updated Successfully! 🎉",
          description: `${formData.commodityName} has been updated in the system.`
        });
      } else {
        // Add new commodity
        const newCommodityId = generateCommodityId();
        const newCommodityData = { ...commodityData, commodityId: newCommodityId };
        
        await addDoc(collection(db, 'commodities'), newCommodityData);
        setSuccessMessage({
          title: "New Commodity Added Successfully! 🎉",
          description: `${formData.commodityName} has been registered with Commodity ID: ${newCommodityId}. You can now add varieties to this commodity.`
        });
      }

      setShowSuccessModal(true);
      
      // Close the add commodity modal and reset form
      setShowAddCommodityModal(false);
      setFormData({
        commodityId: '',
        commodityName: '',
        varieties: [],
      });
      setIsEditing(false);
      setEditingId(null);
      loadCommodities();
      
      // Auto close modal after 4 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 4000);
      
    } catch (error) {
      toast({
        title: "❌ Error Occurred",
        description: "Failed to save commodity information. Please check your connection and try again.",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVarietySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCommodity) {
      console.error('❌ No selected commodity');
      toast({
        title: "❌ Error",
        description: "No commodity selected. Please try again.",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }
    
    // Validate required fields
    const validationErrors: string[] = [];
    
    if (!varietyFormData.varietyName?.trim()) {
      validationErrors.push("Variety name is required");
    }
    
    if (!varietyFormData.locationId?.trim()) {
      validationErrors.push("Branch location must be selected");
    }
    
    if (!varietyFormData.rate || varietyFormData.rate <= 0) {
      validationErrors.push("Rate must be greater than 0");
    }
    
    // Validate particulars
    if (!varietyFormData.particulars || varietyFormData.particulars.length === 0) {
      validationErrors.push("At least one parameter is required");
    } else {
      varietyFormData.particulars.forEach((particular, index) => {
        if (!particular.name?.trim()) {
          validationErrors.push(`Parameter ${index + 1}: Name is required`);
        }
        if (particular.minPercentage < 0 || particular.minPercentage > 100) {
          validationErrors.push(`Parameter ${index + 1}: Min percentage must be between 0-100`);
        }
        if (particular.maxPercentage < 0 || particular.maxPercentage > 100) {
          validationErrors.push(`Parameter ${index + 1}: Max percentage must be between 0-100`);
        }
        if (particular.minPercentage >= particular.maxPercentage) {
          validationErrors.push(`Parameter ${index + 1}: Min percentage must be less than max percentage`);
        }
      });
    }
    
    if (validationErrors.length > 0) {
      console.error('❌ Validation errors:', validationErrors);
      toast({
        title: "❌ Validation Error",
        description: validationErrors.join(". "),
        variant: "destructive",
        duration: 6000,
      });
      return;
    }
    
    console.log('✅ Starting variety submission...', {
      selectedCommodity: selectedCommodity.commodityName,
      varietyData: varietyFormData,
      isEditing: isEditingVariety
    });
    
    setIsSubmitting(true);
    
    try {
      let updatedVarieties;
      let successMsg;
      
      // Ensure varieties array exists and is iterable
      const existingVarieties = selectedCommodity.varieties || [];
      console.log('🔍 Existing varieties:', existingVarieties);
      
      if (isEditingVariety && editingVarietyId) {
        // Edit existing variety
        updatedVarieties = existingVarieties.map(variety =>
          variety.varietyId === editingVarietyId
            ? { ...varietyFormData, createdAt: variety.createdAt }
            : variety
        );
        successMsg = {
          title: "Variety Updated Successfully! ✅",
          description: `${varietyFormData.varietyName} has been updated in ${selectedCommodity.commodityName}`
        };
      } else {
        // Add new variety
        const newVarietyId = generateVarietyId();
        const newVariety: CommodityVariety = {
          ...varietyFormData,
          varietyId: newVarietyId,
          createdAt: new Date().toISOString(),
        };
        updatedVarieties = [...existingVarieties, newVariety];
        successMsg = {
          title: "Variety Added Successfully! 📍",
          description: `${varietyFormData.varietyName} has been added to ${selectedCommodity.commodityName} with Variety ID: ${newVarietyId}`
        };
        
        console.log('✅ New variety created:', newVariety);
      }
      
      const updatedCommodity = { ...selectedCommodity, varieties: updatedVarieties };
      
      console.log('🔄 Updating commodity in Firebase...', {
        commodityId: selectedCommodity.id,
        varietiesCount: updatedVarieties.length
      });
      
      await updateDoc(doc(db, 'commodities', selectedCommodity.id!), updatedCommodity);
      
      console.log('✅ Variety submission successful!');
      
      setSuccessMessage(successMsg);
      setShowSuccessModal(true);
      setShowAddVarietyModal(false);
      setVarietyFormData({
        varietyId: '',
        varietyName: '',
        locationId: '',
        locationName: '',
        branchName: '',
        rate: 0,
        particulars: [{ name: 'Moisture', minPercentage: 0, maxPercentage: 15 }],
      });
      setSelectedCommodity(null);
      setIsEditingVariety(false);
      setEditingVarietyId(null);
      loadCommodities();
      
      // Auto close modal after 4 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 4000);
      
    } catch (error: any) {
      console.error('❌ Error in variety submission:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack
      });
      
      let errorMessage = `Failed to ${isEditingVariety ? 'update' : 'add'} variety. Please check your connection and try again.`;
      
      if (error?.code === 'permission-denied') {
        errorMessage = "Permission denied. Please check your authentication and try again.";
      } else if (error?.code === 'unavailable') {
        errorMessage = "Firebase service is temporarily unavailable. Please try again later.";
      } else if (error?.code === 'not-found') {
        errorMessage = "Commodity not found. Please refresh the page and try again.";
      } else if (error?.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      toast({
        title: "❌ Error Occurred",
        description: errorMessage,
        variant: "destructive",
        duration: 6000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNewCommodity = () => {
    // Reset form for new commodity
    setFormData({
      commodityId: '',
      commodityName: '',
      varieties: [],
    });
    setIsEditing(false);
    setEditingId(null);
    setShowAddCommodityModal(true);
  };

  const handleAddVariety = (commodity: CommodityData) => {
    setSelectedCommodity(commodity);
    setVarietyFormData({
      varietyId: '',
      varietyName: '',
      locationId: '',
      locationName: '',
      branchName: '',
      rate: 0,
      particulars: [{ name: 'Moisture', minPercentage: 0, maxPercentage: 15 }],
    });
    setIsEditingVariety(false);
    setEditingVarietyId(null);
    setShowAddVarietyModal(true);
  };

  const handleEditVariety = (commodity: CommodityData, variety: CommodityVariety) => {
    setSelectedCommodity(commodity);
    setVarietyFormData({
      varietyId: variety.varietyId,
      varietyName: variety.varietyName,
      locationId: variety.locationId,
      locationName: variety.locationName,
      branchName: variety.branchName,
      rate: variety.rate,
      particulars: variety.particulars || [{ name: 'Moisture', minPercentage: 0, maxPercentage: 15 }],
    });
    setIsEditingVariety(true);
    setEditingVarietyId(variety.varietyId);
    setShowAddVarietyModal(true);
  };

  const handleDeleteVariety = async (varietyId: string, commodity: CommodityData) => {
    try {
      const updatedVarieties = commodity.varieties.filter(v => v.varietyId !== varietyId);
      const commodityRef = doc(db, 'commodities', commodity.id!);
      await updateDoc(commodityRef, {
        varieties: updatedVarieties,
      });
      
      setSuccessMessage({
        title: "Variety Deleted Successfully! 🗑️",
        description: `The variety "${varietyId}" has been removed from "${commodity.commodityName}".`
      });
      setShowSuccessModal(true);
      loadCommodities();
      
      // Auto close modal after 3 seconds for delete
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 3000);
      
    } catch (error) {
      toast({
        title: "❌ Delete Failed",
        description: "Failed to delete variety. Please check your connection and try again.",
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  const handleCloseModal = () => {
    setShowAddCommodityModal(false);
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      commodityId: '',
      commodityName: '',
      varieties: [],
    });
  };

  const handleCloseVarietyModal = () => {
    setShowAddVarietyModal(false);
    setSelectedCommodity(null);
    setVarietyFormData({
      varietyId: '',
      varietyName: '',
      locationId: '',
      locationName: '',
      branchName: '',
      rate: 0,
      particulars: [{ name: 'Moisture', minPercentage: 0, maxPercentage: 15 }],
    });
    setIsEditingVariety(false);
    setEditingVarietyId(null);
  };

  // Allow both admin and checker roles to access this page
  if (user?.role !== 'admin' && user?.role !== 'checker') return null;

  const displayCommodities = searchTerm.trim() ? filteredCommodities : commodities;

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-8">
        {/* Header with Back Button and Centered Title */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <button 
            onClick={() => router.back()}
            className="text-base sm:text-lg font-semibold tracking-tight bg-orange-500 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-orange-600 transition-colors whitespace-nowrap w-full sm:w-auto"
          >
            ← Dashboard
          </button>
          
          {/* Centered Title with Light Orange Background */}
          <div className="flex-1 text-center w-full sm:w-auto">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-orange-600 inline-block border-b-4 border-green-500 pb-2 px-4 sm:px-6 py-2 sm:py-3 bg-orange-100 rounded-lg">
              Commodity & Variety Module
            </h1>
          </div>
          
          {/* Add Commodity Button */}
          <Button
            onClick={handleAddNewCommodity}
            className="bg-green-500 hover:bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3 shadow-lg text-sm sm:text-base w-full sm:w-auto"
          >
            ✅ Add New Commodity
          </Button>
        </div>

        {/* Search and Export Section */}
        <Card className="border-green-300">
          <CardHeader className="bg-green-50 p-3 sm:p-4">
            <CardTitle className="text-base sm:text-lg text-green-700">Search & Export Options</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center space-x-2 flex-1 min-w-[300px]">
                <Search className="w-4 h-4 text-green-600" />
                <Label htmlFor="searchTerm" className="text-green-600 font-medium whitespace-nowrap">Search:</Label>
                <Input
                  id="searchTerm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by commodity name, variety, or branch..."
                  className="border-green-300 focus:border-green-500 flex-1"
                />
                {searchTerm && (
                  <Button
                    onClick={() => setSearchTerm('')}
                    variant="outline"
                    size="sm"
                    className="border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              
              <Button
                onClick={exportToCSV}
                className="bg-blue-500 hover:bg-blue-600 text-white whitespace-nowrap"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
            
            {searchTerm && (
              <div className="mt-3 text-sm text-green-600">
                {filteredCommodities.length} commodities found for "{searchTerm}"
              </div>
            )}
          </CardContent>
        </Card>

        {/* Commodities Table with Hierarchical Structure */}
        <Card className="border-green-300">
          <CardHeader className="bg-green-50">
            <CardTitle className="text-green-700">Registered Commodities & Varieties</CardTitle>
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
              {/* Entry Count Display */}
              {tableData.length > 0 && (
                <div className="mb-4 text-sm text-gray-600 bg-orange-50 px-3 py-2 rounded-lg border border-orange-200">
                  <span className="font-medium">
                    📊 Total Entries: <span className="text-orange-700 font-bold">{tableData.length}</span>
                    {searchTerm && (
                      <span className="ml-2 text-green-600">
                        (filtered from {commodities.reduce((sum, c) => sum + (c.varieties.length > 0 ? c.varieties.length + 1 : 1), 0)} total)
                      </span>
                    )}
                  </span>
                </div>
              )}

              <DataTable
                columns={commodityColumns}
                data={tableData}
                showGridLines={true}
                stickyHeader={true}
                stickyFirstColumn={true}
              />
            </div>
          </CardContent>
        </Card>

        {/* Add/Edit Commodity Modal */}
        <Dialog open={showAddCommodityModal} onOpenChange={setShowAddCommodityModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-orange-300">
            <DialogHeader>
              <DialogTitle className="text-orange-700 text-xl flex items-center gap-2">
                {isEditing ? '🔄 Edit Commodity' : '✅ Add New Commodity'}
              </DialogTitle>
              <DialogDescription className="text-green-600">
                {isEditing ? 'Update commodity information' : 'Enter commodity basic information (varieties can be added separately)'}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                {/* Commodity Name */}
                <div className="space-y-2">
                  <Label htmlFor="commodityName" className="text-green-600 font-medium">
                    Commodity Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="commodityName"
                    value={formData.commodityName}
                    onChange={(e) => handleInputChange('commodityName', e.target.value)}
                    className="border-orange-300 focus:border-orange-500 text-orange-700"
                    placeholder="e.g., Wheat, Rice, Corn"
                    required
                  />
                  <p className="text-xs text-orange-600 mt-1">
                    Commodity name must be unique (case-insensitive). "Wheat", "WHEAT", and "wheat" are considered the same.
                  </p>
                </div>
              </div>

              {/* Important Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-blue-800 font-semibold mb-2">📝 Important Note:</h4>
                <p className="text-blue-700 text-sm">
                  After adding the commodity, you can add multiple varieties with different rates for different branch locations. 
                  Each variety will be linked to a specific location from the branch module.
                </p>
              </div>

              {/* Modal Footer with Buttons */}
              <div className="flex justify-end space-x-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-300 text-gray-600 hover:bg-gray-50"
                  onClick={handleCloseModal}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting 
                    ? (isEditing ? '🔄 Updating...' : '⏳ Adding Commodity...') 
                    : (isEditing ? '🔄 Update Commodity' : '✅ Add Commodity')
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add/Edit Variety Modal */}
        <Dialog open={showAddVarietyModal} onOpenChange={setShowAddVarietyModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-blue-300">
            <DialogHeader>
              <DialogTitle className="text-blue-700 text-xl flex items-center gap-2">
                {isEditingVariety ? '🔄 Edit Variety' : '📍 Add New Variety'}
              </DialogTitle>
              <DialogDescription className="text-green-600">
                {isEditingVariety ? 'Editing variety in' : 'Adding variety to'}: <strong>{selectedCommodity?.commodityName}</strong>
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleVarietySubmit} className="space-y-6" noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Variety Name */}
                <div className="space-y-2">
                  <Label htmlFor="varietyName" className="text-green-600 font-medium">
                    Variety Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="varietyName"
                    value={varietyFormData.varietyName}
                    onChange={(e) => handleVarietyInputChange('varietyName', e.target.value)}
                    className="border-blue-300 focus:border-blue-500 text-blue-700"
                    placeholder="e.g., Basmati, Durum, Sweet Corn"
                    required
                  />
                </div>

                {/* Rate */}
                <div className="space-y-2">
                  <Label htmlFor="rate" className="text-green-600 font-medium">
                    Rate (₹) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={varietyFormData.rate || ''}
                    onChange={(e) => handleVarietyInputChange('rate', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                    className="border-blue-300 focus:border-blue-500 text-blue-700"
                    placeholder="Enter rate (e.g., 2500.00)"
                    required
                  />
                </div>

                {/* Location Selection */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="location" className="text-green-600 font-medium">Branch <span className="text-red-500">*</span></Label>
                  <Select
                    value={varietyFormData.locationId}
                    onValueChange={handleLocationSelect}
                    required
                  >
                    <SelectTrigger className="border-blue-300 focus:border-blue-500 text-blue-700 [&>span]:text-blue-700">
                      <SelectValue placeholder="Select branch" className="text-blue-700" />
                    </SelectTrigger>
                    <SelectContent className="bg-white max-h-60">
                      {branchLocations.map(location => (
                        <SelectItem 
                          key={location.locationId} 
                          value={location.locationId} 
                          className="!text-blue-700 hover:!bg-blue-50 focus:!bg-blue-50 hover:!text-blue-700 focus:!text-blue-700 data-[highlighted]:!text-blue-700 data-[highlighted]:!bg-blue-50"
                          style={{ color: '#1d4ed8 !important' }}
                        >
                          {location.locationName} - {location.branchName} ({location.state})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Selected Location Info Display */}
              {varietyFormData.locationId && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="text-green-800 font-semibold mb-2">📍 Selected Location Information:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-green-700">Location Name:</span>
                      <p className="text-green-600">{varietyFormData.locationName || 'Not specified'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-green-700">Location ID:</span>
                      <p className="text-green-600">{varietyFormData.locationId}</p>
                    </div>
                  </div>
                
                </div>
              )}

              {/* Particulars Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-blue-600">Particulars (Parameters) <span className="text-red-500">*</span></h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-green-300 text-green-600 hover:bg-green-50"
                    onClick={addParticular}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Parameter
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {varietyFormData.particulars.map((particular, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="space-y-2">
                        <Label className="text-green-600 font-medium text-sm">
                          Parameter Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          value={particular.name}
                          onChange={(e) => handleParticularChange(index, 'name', e.target.value)}
                          className="border-blue-300 focus:border-blue-500 text-blue-700"
                          placeholder="e.g., Moisture, Protein"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-green-600 font-medium text-sm">
                          Min Percentage <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          type="number"
                          value={particular.minPercentage || ''}
                          onChange={(e) => handleParticularChange(index, 'minPercentage', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          className="border-blue-300 focus:border-blue-500 text-blue-700"
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="Min %"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-green-600 font-medium text-sm">
                          Max Percentage <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          type="number"
                          value={particular.maxPercentage || ''}
                          onChange={(e) => handleParticularChange(index, 'maxPercentage', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          className="border-blue-300 focus:border-blue-500 text-blue-700"
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="Max %"
                          required
                        />
                      </div>

                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-red-300 text-red-600 hover:bg-red-50 w-full"
                          onClick={() => removeParticular(index)}
                          disabled={varietyFormData.particulars.length === 1}
                        >
                          <Minus className="w-4 h-4 mr-2" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer with Buttons */}
              <div className="flex justify-end space-x-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-300 text-gray-600 hover:bg-gray-50"
                  onClick={handleCloseVarietyModal}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    console.log('🔘 Add Variety button clicked', {
                      isSubmitting,
                      varietyFormData,
                      selectedCommodity: selectedCommodity?.commodityName
                    });
                  }}
                >
                  {isSubmitting 
                    ? (isEditingVariety ? '⏳ Updating Variety...' : '⏳ Adding Variety...') 
                    : (isEditingVariety ? '🔄 Update Variety' : '📍 Add Variety')
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Success Modal */}
        <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
          <DialogContent className="border-green-300 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-green-700 flex items-center gap-3 text-xl">
                <CheckCircle className="w-6 h-6 text-green-500" />
                {successMessage.title}
              </DialogTitle>
              <DialogDescription className="text-gray-700 mt-3 text-base leading-relaxed">
                {successMessage.description}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end mt-6">
              <Button 
                onClick={() => setShowSuccessModal(false)}
                className="bg-green-500 hover:bg-green-600 text-white px-6"
              >
                ✅ Got it!
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
} 