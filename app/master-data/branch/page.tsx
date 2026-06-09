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
import { Trash2, Edit, CheckCircle, AlertCircle, X, Download, Search, Plus, MapPin, Building2 } from "lucide-react";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DataTable } from '@/components/data-table';
import type { Row } from '@tanstack/react-table';

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

// Define columns for DataTable
const branchColumns = [
  {
    accessorKey: "branchId",
    header: "Branch Code",
    cell: ({ row }: { row: Row<any> }) => <span className="font-bold text-orange-800 w-full flex justify-center">{row.getValue("branchId")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "state",
    header: "State",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 font-medium w-full flex justify-center">{row.getValue("state")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "branch",
    header: "Branch Name", 
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 font-medium w-full flex justify-center">{row.getValue("branch")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "locationId",
    header: "Location ID",
    cell: ({ row }: { row: Row<any> }) => <span className="text-blue-700 w-full flex justify-center">{row.getValue("locationId") || '-'}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "locationName",
    header: "Location Name",
    cell: ({ row }: { row: Row<any> }) => <span className="text-blue-700 w-full flex justify-center">{row.getValue("locationName") || '-'}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "address",
    header: "Address",
    cell: ({ row }: { row: Row<any> }) => <span className="text-gray-600 w-full flex justify-center">{row.getValue("address") || '-'}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "pincode",
    header: "Pincode",
    cell: ({ row }: { row: Row<any> }) => <span className="text-gray-600 w-full flex justify-center">{row.getValue("pincode") || '-'}</span>,
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
      const isBranchRow = rowData.isBranch;
      const isLocationRow = rowData.isLocation;
      
      return (
        <div className="flex space-x-2 justify-center">
          {isBranchRow && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
                onClick={() => {
                  const event = new CustomEvent('addLocation', { detail: rowData });
                  document.dispatchEvent(event);
                }}
                title="Add Location"
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-orange-300 text-orange-600 hover:bg-orange-50"
                onClick={() => {
                  const event = new CustomEvent('editBranch', { detail: rowData });
                  document.dispatchEvent(event);
                }}
                title="Edit Branch"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                size="sm" 
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete ${rowData.branch} and all its locations? This action cannot be undone.`)) {
                    const event = new CustomEvent('deleteBranch', { detail: rowData.id });
                    document.dispatchEvent(event);
                  }
                }}
                title="Delete Branch"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
          {isLocationRow && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="border-orange-300 text-orange-600 hover:bg-orange-50"
                onClick={() => {
                  const event = new CustomEvent('editLocation', { 
                    detail: { 
                      branch: rowData.parentBranch,
                      locationId: rowData.locationId 
                    } 
                  });
                  document.dispatchEvent(event);
                }}
                title="Edit Location"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                size="sm" 
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete ${rowData.locationName}? This action cannot be undone.`)) {
                    const event = new CustomEvent('deleteLocation', { 
                      detail: { 
                        branchId: rowData.parentBranch.id,
                        locationId: rowData.locationId 
                      } 
                    });
                    document.dispatchEvent(event);
                  }
                }}
                title="Delete Location"
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

export default function BranchModulePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [branches, setBranches] = useState<BranchData[]>([]);
  const [filteredBranches, setFilteredBranches] = useState<BranchData[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<BranchData>({
    branchId: '',
    name: '',
    state: '',
    branch: '',
    locations: [],
  });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<BranchData | null>(null);
  const [locationFormData, setLocationFormData] = useState<BranchLocation>({
    locationId: '',
    locationName: '',
    address: '',
    pincode: '',
  });
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Indian states list
  const indianStates = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
    "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", 
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", 
    "Ladakh", "Lakshadweep", "Puducherry"
  ];

  // Check if user has access (admin and checker can access)
  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'checker') {
      router.push('/dashboard');
    }
  }, [user?.role, router]);

  // Load branches data
  useEffect(() => {
    loadBranches();
  }, []);

  // Filter branches based on search term
  useEffect(() => {
    filterBranchesBySearch();
  }, [branches, searchTerm]);

  // Event listeners for table actions
  useEffect(() => {
    const handleAddLocation = (event: any) => {
      handleAddLocationAction(event.detail);
    };
    
    const handleEditBranch = (event: any) => {
      handleEdit(event.detail);
    };
    
    const handleDeleteBranch = (event: any) => {
      handleDelete(event.detail);
    };
    
    const handleEditLocation = (event: any) => {
      handleEditLocationAction(event.detail);
    };
    
    const handleDeleteLocation = (event: any) => {
      handleDeleteLocationAction(event.detail);
    };
    
    document.addEventListener('addLocation', handleAddLocation);
    document.addEventListener('editBranch', handleEditBranch);
    document.addEventListener('deleteBranch', handleDeleteBranch);
    document.addEventListener('editLocation', handleEditLocation);
    document.addEventListener('deleteLocation', handleDeleteLocation);
    
    return () => {
      document.removeEventListener('addLocation', handleAddLocation);
      document.removeEventListener('editBranch', handleEditBranch);
      document.removeEventListener('deleteBranch', handleDeleteBranch);
      document.removeEventListener('editLocation', handleEditLocation);
      document.removeEventListener('deleteLocation', handleDeleteLocation);
    };
  }, []);

  // Prepare table data - flatten branch-location pairs and sort by branch code
  const tableData = useMemo(() => {
    const dataToDisplay = filteredBranches.length > 0 || searchTerm ? filteredBranches : branches;
    const flattened: any[] = [];
    
    // Sort branches by branchId first (requirement #1: ascending order by branch code)
    const sortedBranches = [...dataToDisplay].sort((a, b) => a.branchId.localeCompare(b.branchId));
    
    sortedBranches.forEach(branch => {
      if (branch.locations.length === 0) {
        // Branch without locations
        flattened.push({
          id: branch.id,
          branchId: branch.branchId,
          state: branch.state,
          branch: branch.branch,
          locationId: '',
          locationName: '',
          address: '',
          pincode: '',
          createdAt: branch.createdAt,
          isBranch: true,
          isLocation: false
        });
      } else {
        // First add the branch row
        flattened.push({
          id: branch.id,
          branchId: branch.branchId,
          state: branch.state,
          branch: branch.branch,
          locationId: '',
          locationName: `${branch.locations.length} locations`,
          address: '',
          pincode: '',
          createdAt: branch.createdAt,
          isBranch: true,
          isLocation: false,
          locationsCount: branch.locations.length
        });
        
        // Then add location rows sorted by location ID
        const sortedLocations = [...branch.locations].sort((a, b) => a.locationId.localeCompare(b.locationId));
        sortedLocations.forEach(location => {
          flattened.push({
            id: `${branch.id}-${location.locationId}`,
            branchId: '',
            state: branch.state,
            branch: branch.branch,
            locationId: location.locationId,
            locationName: location.locationName,
            address: location.address,
            pincode: location.pincode,
            createdAt: location.createdAt,
            isBranch: false,
            isLocation: true,
            parentBranch: branch
          });
        });
      }
    });
    
    return flattened;
  }, [branches, filteredBranches, searchTerm]);

  // Action handlers for table events
  const handleAddLocationAction = (branch: BranchData) => {
    console.log('Adding location for:', branch.branch);
    setSelectedBranch(branch);
    setLocationFormData({
      locationId: '',
      locationName: '',
      address: '',
      pincode: '',
    });
    setIsEditingLocation(false);
    setEditingLocationId(null);
    setShowAddLocationModal(true);
  };

  const handleEditLocationAction = (detail: { branch: BranchData; locationId: string }) => {
    console.log('Editing location:', detail.locationId, 'in branch:', detail.branch.branch);
    const locationToEdit = detail.branch.locations.find(loc => loc.locationId === detail.locationId);
    if (locationToEdit) {
      setSelectedBranch(detail.branch);
      setLocationFormData({
        locationId: locationToEdit.locationId,
        locationName: locationToEdit.locationName,
        address: locationToEdit.address || '',
        pincode: locationToEdit.pincode || '',
      });
      setIsEditingLocation(true);
      setEditingLocationId(detail.locationId);
      setShowAddLocationModal(true);
    }
  };

  const handleDeleteLocationAction = async (detail: { branchId: string; locationId: string }) => {
    console.log('Deleting location:', detail.locationId, 'from branch:', detail.branchId);
    try {
      // Get the current branch data
      const branchDocRef = doc(db, 'branches', detail.branchId);
      const branchDocSnap = await getDoc(branchDocRef);
      
      if (!branchDocSnap.exists()) {
        throw new Error('Branch not found');
      }
      
      const branchData = branchDocSnap.data() as BranchData;
      const existingLocations = Array.isArray(branchData.locations) ? branchData.locations : [];
      
      // Filter out the location to delete
      const updatedLocations = existingLocations.filter(loc => loc.locationId !== detail.locationId);
      
      console.log('Existing locations:', existingLocations);
      console.log('Updated locations after deletion:', updatedLocations);
      
      // Update the branch with the new locations array
      await updateDoc(branchDocRef, { locations: updatedLocations });
      
      setSuccessMessage({
        title: "Location Deleted Successfully! 🗑️",
        description: "The location has been permanently removed from the branch."
      });
      setShowSuccessModal(true);
      
      // Reload branches to get updated data
      await loadBranches();
      
      // Auto close modal after 3 seconds for delete
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error deleting location:', error);
      toast({
        title: "❌ Delete Failed",
        description: `Failed to delete location. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  const handleEdit = (branch: BranchData) => {
    console.log('Editing branch:', branch.branch);
    setFormData(branch);
    setEditingId(branch.id || null);
    setIsEditing(true);
    setShowAddBranchModal(true);
  };

  const handleDelete = async (branchId: string) => {
    console.log('Deleting branch ID:', branchId);
    try {
      await deleteDoc(doc(db, 'branches', branchId));
      setSuccessMessage({
        title: "Branch Deleted Successfully! 🗑️",
        description: "The branch and all its locations have been permanently removed from the database."
      });
      setShowSuccessModal(true);
      loadBranches();
      
      // Auto close modal after 3 seconds for delete
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 3000);
      
    } catch (error) {
      toast({
        title: "❌ Delete Failed",
        description: "Failed to delete branch. Please check your connection and try again.",
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  const loadBranches = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'branches'));
      const branchesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        locations: doc.data().locations || []
      })) as BranchData[];
      setBranches(branchesData);
      
      // Trigger cross-module reflection (requirement #7)
      // Dispatch custom event to notify other modules about branch data changes
      const branchUpdateEvent = new CustomEvent('branchDataUpdated', {
        detail: { branches: branchesData, timestamp: new Date() }
      });
      window.dispatchEvent(branchUpdateEvent);
      
    } catch (error) {
      console.error('Error loading branches:', error);
      toast({
        title: "❌ Loading Failed", 
        description: "Failed to load branches. Please refresh the page.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const filterBranchesBySearch = () => {
    if (!searchTerm.trim()) {
      setFilteredBranches(branches);
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = branches.filter(branch =>
      branch.name.toLowerCase().includes(searchLower) ||
      branch.branch.toLowerCase().includes(searchLower) ||
      branch.state.toLowerCase().includes(searchLower) ||
      branch.branchId.toLowerCase().includes(searchLower) ||
      branch.locations.some(location => 
        location.locationName.toLowerCase().includes(searchLower) ||
        location.address?.toLowerCase().includes(searchLower) ||
        location.pincode?.toLowerCase().includes(searchLower)
      )
    );

    setFilteredBranches(filtered);
  };

  const exportToCSV = () => {
    const dataToExport = searchTerm.trim() ? filteredBranches : branches;
    
    if (dataToExport.length === 0) {
      toast({
        title: "❌ No Data to Export",
        description: "There are no branches to export.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    // Fixed headers - removed extra "Name" column (requirement #4)
    const headers = [
      'Branch ID', 'State', 'Branch', 'Location ID', 'Location Name', 'Address', 'Pincode', 'Branch Created Date', 'Location Created Date'
    ];

    const csvData = [headers];
    
    // Sort branches by branch code in ascending order for CSV (requirement #1)
    const sortedBranches = [...dataToExport].sort((a, b) => (a.branchId || '').localeCompare(b.branchId || ''));
    
    sortedBranches.forEach(branch => {
      if (branch.locations.length === 0) {
        // Branch without locations
        csvData.push([
          branch.branchId || '-',
          branch.state || '',
          branch.branch || '',
          '',
          '',
          '',
          '',
          branch.createdAt ? new Date(branch.createdAt).toLocaleDateString() : '',
          ''
        ]);
      } else {
        // Sort locations within each branch by locationId
        const sortedLocations = [...branch.locations].sort((a, b) => 
          (a.locationId || '').localeCompare(b.locationId || '')
        );
        
        sortedLocations.forEach(location => {
          csvData.push([
            branch.branchId || '-',
            branch.state || '',
            branch.branch || '',
            location.locationId || '',
            location.locationName || '',
            location.address || '',
            location.pincode || '',
            branch.createdAt ? new Date(branch.createdAt).toLocaleDateString() : '',
            location.createdAt ? new Date(location.createdAt).toLocaleDateString() : ''
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
    a.download = `branches_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "✅ Export Successful",
      description: `${dataToExport.length} branches exported to CSV file.`,
      className: "bg-green-100 border-green-500 text-green-700",
      duration: 3000,
    });
  };

  // Generate unique branch ID
  const generateBranchId = () => {
    if (branches.length === 0) {
      return 'BR-0001';
    }
    
    // Extract numbers from existing branch IDs and find the highest
    const existingNumbers = branches
      .map(branch => branch.branchId)
      .filter(id => id && id.startsWith('BR-'))
      .map(id => parseInt(id.split('-')[1]))
      .filter(num => !isNaN(num));
    
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;
    
    return `BR-${nextNumber.toString().padStart(4, '0')}`;
  };

  // Generate unique location ID 
  const generateLocationId = () => {
    // Get all existing location IDs from all branches
    const allLocationIds: string[] = [];
    branches.forEach(branch => {
      const locations = Array.isArray(branch.locations) ? branch.locations : [];
      locations.forEach(location => {
        if (location.locationId) {
          allLocationIds.push(location.locationId);
        }
      });
    });

    // Use LOC- prefix for locations (different from BR- for branches)
    const existingNumbers = allLocationIds
      .filter(id => id && id.startsWith('LOC-'))
      .map(id => parseInt(id.split('-')[1]))
      .filter(num => !isNaN(num));
    
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;
    
    return `LOC-${nextNumber.toString().padStart(4, '0')}`;
  };

  const handleInputChange = (field: keyof BranchData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLocationInputChange = (field: keyof BranchLocation, value: string) => {
    setLocationFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const branchData = {
        ...formData,
        createdAt: isEditing ? formData.createdAt : new Date().toISOString(),
      };

      if (isEditing && editingId) {
        // Update existing branch
        await updateDoc(doc(db, 'branches', editingId), branchData);
        setSuccessMessage({
          title: "Branch Updated Successfully! 🎉",
          description: `${formData.name} has been updated in the system.`
        });
      } else {
        // Add new branch
        const newBranchId = generateBranchId();
        const newBranchData = { ...branchData, branchId: newBranchId };
        
        await addDoc(collection(db, 'branches'), newBranchData);
        setSuccessMessage({
          title: "New Branch Added Successfully! 🎉",
          description: `${formData.name} has been registered with Branch ID: ${newBranchId}. You can now add locations to this branch.`
        });
      }

      setShowSuccessModal(true);
      
      // Close the add branch modal and reset form
      setShowAddBranchModal(false);
      setFormData({
        branchId: '',
        name: '',
        state: '',
        branch: '',
        locations: [],
      });
      setIsEditing(false);
      setEditingId(null);
      loadBranches();
      
      // Auto close modal after 4 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 4000);
      
    } catch (error) {
      toast({
        title: "❌ Error Occurred",
        description: "Failed to save branch information. Please check your connection and try again.",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBranch) {
      console.error('No branch selected');
      toast({
        title: "❌ Error",
        description: "No branch selected. Please try again.",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }
    
    if (!selectedBranch.id) {
      console.error('Selected branch has no ID:', selectedBranch);
      toast({
        title: "❌ Error",
        description: "Invalid branch data. Please refresh and try again.",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Get the latest branch data from Firestore to avoid overwriting recent changes
      const branchDocRef = doc(db, 'branches', selectedBranch.id);
      const branchDocSnap = await getDoc(branchDocRef);
      
      if (!branchDocSnap.exists()) {
        throw new Error('Branch not found');
      }
      
      const latestBranchData = branchDocSnap.data() as BranchData;
      const existingLocations = Array.isArray(latestBranchData.locations) ? latestBranchData.locations : [];
      
      let updatedLocations;
      let successMsg;
      
      if (isEditingLocation && editingLocationId) {
        // Edit existing location
        updatedLocations = existingLocations.map(location =>
          location.locationId === editingLocationId
            ? { ...locationFormData, createdAt: location.createdAt }
            : location
        );
        successMsg = {
          title: "Location Updated Successfully! ✅",
          description: `${locationFormData.locationName} has been updated in ${selectedBranch.branch}`
        };
      } else {
        // Add new location
        const newLocationId = generateLocationId();
        const newLocation: BranchLocation = {
          ...locationFormData,
          locationId: newLocationId,
          createdAt: new Date().toISOString(),
        };
        updatedLocations = [...existingLocations, newLocation];
        successMsg = {
          title: "Location Added Successfully! 📍",
          description: `${locationFormData.locationName} has been added to ${selectedBranch.branch} with Location ID: ${newLocationId}`
        };
      }
      
      console.log('Updating branch:', selectedBranch.id);
      console.log('Existing locations:', existingLocations);
      console.log('Updated locations:', updatedLocations);
      
      // Update only the locations field
      await updateDoc(branchDocRef, { locations: updatedLocations });
      
      setSuccessMessage(successMsg);
      setShowSuccessModal(true);
      setShowAddLocationModal(false);
      setLocationFormData({
        locationId: '',
        locationName: '',
        address: '',
        pincode: '',
      });
      setSelectedBranch(null);
      setIsEditingLocation(false);
      setEditingLocationId(null);
      
      // Reload branches to get updated data
      await loadBranches();
      
      // Auto close modal after 4 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 4000);
      
    } catch (error) {
      console.error('Error adding/updating location:', error);
      toast({
        title: "❌ Error Occurred",
        description: `Failed to ${isEditingLocation ? 'update' : 'add'} location. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNewBranch = () => {
    // Reset form for new branch
    setFormData({
      branchId: '',
      name: '',
      state: '',
      branch: '',
      locations: [],
    });
    setIsEditing(false);
    setEditingId(null);
    setShowAddBranchModal(true);
  };

  const handleAddLocation = (branch: BranchData) => {
    setSelectedBranch(branch);
    setLocationFormData({
      locationId: '',
      locationName: '',
      address: '',
      pincode: '',
    });
    setIsEditingLocation(false);
    setEditingLocationId(null);
    setShowAddLocationModal(true);
  };

  const handleEditLocation = (branch: BranchData, location: BranchLocation) => {
    setSelectedBranch(branch);
    setLocationFormData({
      locationId: location.locationId,
      locationName: location.locationName,
      address: location.address || '',
      pincode: location.pincode || '',
    });
    setIsEditingLocation(true);
    setEditingLocationId(location.locationId);
    setShowAddLocationModal(true);
  };

  const handleCloseModal = () => {
    setShowAddBranchModal(false);
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      branchId: '',
      name: '',
      state: '',
      branch: '',
      locations: [],
    });
  };

  const handleCloseLocationModal = () => {
    setShowAddLocationModal(false);
    setSelectedBranch(null);
    setLocationFormData({
      locationId: '',
      locationName: '',
      address: '',
      pincode: '',
    });
    setIsEditingLocation(false);
    setEditingLocationId(null);
  };

  const toggleBranchExpansion = (branchId: string) => {
    const newExpanded = new Set(expandedBranches);
    if (newExpanded.has(branchId)) {
      newExpanded.delete(branchId);
    } else {
      newExpanded.add(branchId);
    }
    setExpandedBranches(newExpanded);
  };

  // Allow both admin and checker roles to access this page
  if (user?.role !== 'admin' && user?.role !== 'checker') return null;

  const displayBranches = searchTerm.trim() ? filteredBranches : branches;

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
              Branch & Location Module
            </h1>
          </div>
          
          {/* Add Branch Button */}
          <Button
            onClick={handleAddNewBranch}
            className="bg-green-500 hover:bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3 shadow-lg text-sm sm:text-base w-full sm:w-auto"
          >
            ✅ Add New Branch
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
                  placeholder="Search by state, branch, location..."
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
                {filteredBranches.length} branches found for "{searchTerm}"
              </div>
            )}
          </CardContent>
        </Card>

        {/* Branches Table with Enhanced DataTable */}
        <Card className="border-green-300">
          <CardHeader className="bg-green-50">
            <CardTitle className="text-green-700">Registered Branches & Locations</CardTitle>
            {/* Entry count display (requirement #2: count below search bar) */}
            <div className="flex justify-between items-center mt-3">
              <div className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                <strong>Total Entries: {tableData.length}</strong> 
                {searchTerm && <span className="ml-2">(filtered from {branches.length})</span>}
              </div>
              <div className="text-xs text-gray-500">
                {tableData.length > 0 && "Showing entries in ascending order by branch code"}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {/* DataTable with sticky features and pagination */}
            <DataTable
              columns={branchColumns}
              data={tableData}
              stickyHeader={true} // requirement #5: freeze top row header
              stickyFirstColumn={true} // requirement #6: freeze first column
              showGridLines={true}
              wrapperClassName="branch-datatable"
            />
          </CardContent>
        </Card>

        {/* Add/Edit Branch Modal */}
        <Dialog open={showAddBranchModal} onOpenChange={setShowAddBranchModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-orange-300">
            <DialogHeader>
              <DialogTitle className="text-orange-700 text-xl flex items-center gap-2">
                {isEditing ? '🔄 Edit Branch' : '✅ Add New Branch'}
              </DialogTitle>
              <DialogDescription className="text-green-600">
                {isEditing ? 'Update branch information' : 'Enter branch basic information (locations can be added separately)'}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Branch */}
                <div className="space-y-2">
                  <Label htmlFor="branch" className="text-green-600 font-medium">
                    Branch <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="branch"
                    value={formData.branch}
                    onChange={(e) => handleInputChange('branch', e.target.value)}
                    className="border-orange-300 focus:border-orange-500 text-orange-700"
                    placeholder="e.g., Mumbai, Delhi, Pune"
                    required
                  />
                </div>

                {/* State Dropdown */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="state" className="text-green-600 font-medium">
                    State <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) => handleInputChange('state', value)}
                    required
                  >
                    <SelectTrigger className="border-orange-300 focus:border-orange-500 text-orange-700 [&>span]:text-orange-700">
                      <SelectValue 
                        placeholder="Select state" 
                        className="text-orange-700"
                      />
                    </SelectTrigger>
                    <SelectContent className="bg-white max-h-60">
                      {indianStates.map(state => (
                        <SelectItem 
                          key={state} 
                          value={state} 
                          className="!text-orange-700 hover:!bg-orange-50 focus:!bg-orange-50 hover:!text-orange-700 focus:!text-orange-700 data-[highlighted]:!text-orange-700 data-[highlighted]:!bg-orange-50"
                          style={{ color: '#c2410c !important' }}
                        >
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Important Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-blue-800 font-semibold mb-2">📝 Important Note:</h4>
                <p className="text-blue-700 text-sm">
                  After adding the branch, you can add multiple locations with different addresses and pincodes. 
                  Each location will inherit the branch name, state, and branch information.
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
                    ? (isEditing ? '🔄 Updating...' : '⏳ Adding Branch...') 
                    : (isEditing ? '🔄 Update Branch' : '✅ Add Branch')
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Location Modal */}
        <Dialog open={showAddLocationModal} onOpenChange={setShowAddLocationModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-blue-300">
            <DialogHeader>
              <DialogTitle className="text-blue-700 text-xl flex items-center gap-2">
                {isEditingLocation ? '🔄 Edit Location' : '📍 Add New Location'}
              </DialogTitle>
              <DialogDescription className="text-green-600">
                {isEditingLocation ? 'Editing location in' : 'Adding location to'}: <strong>{selectedBranch?.branch}</strong> ({selectedBranch?.state})
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleLocationSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Location Name - Fixed heading from "Branch" to "Location" (requirement #3) */}
                <div className="space-y-2">
                  <Label htmlFor="locationName" className="text-green-600 font-medium">
                    Location <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="locationName"
                    value={locationFormData.locationName}
                    onChange={(e) => handleLocationInputChange('locationName', e.target.value)}
                    className="border-blue-300 focus:border-blue-500 text-blue-700"
                    placeholder="e.g., Mumbai Main, Delhi Central, Pune West"
                    required
                  />
                </div>

                {/* Pincode */}
                <div className="space-y-2">
                  <Label htmlFor="pincode" className="text-green-600 font-medium">
                    Pincode (Optional)
                  </Label>
                  <Input
                    id="pincode"
                    value={locationFormData.pincode}
                    onChange={(e) => handleLocationInputChange('pincode', e.target.value)}
                    className="border-blue-300 focus:border-blue-500 text-blue-700"
                    maxLength={6}
                    placeholder="e.g., 400001"
                  />
                </div>

                {/* Address (Optional) */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address" className="text-green-600 font-medium">
                    Address (Optional)
                  </Label>
                  <Input
                    id="address"
                    value={locationFormData.address}
                    onChange={(e) => handleLocationInputChange('address', e.target.value)}
                    className="border-blue-300 focus:border-blue-500 text-blue-700"
                    placeholder="e.g., 123 Main Street, Near City Mall"
                  />
                </div>
              </div>

              {/* Branch Info Display */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-green-800 font-semibold mb-2">🏢 Branch Information (Inherited):</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-green-700">Name:</span>
                    <p className="text-green-600">{selectedBranch?.name}</p>
                  </div>
                  <div>
                    <span className="font-medium text-green-700">State:</span>
                    <p className="text-green-600">{selectedBranch?.state}</p>
                  </div>
                  <div>
                    <span className="font-medium text-green-700">Branch:</span>
                    <p className="text-green-600">{selectedBranch?.branch}</p>
                  </div>
                </div>
              </div>

              {/* Modal Footer with Buttons */}
              <div className="flex justify-end space-x-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-300 text-gray-600 hover:bg-gray-50"
                  onClick={handleCloseLocationModal}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting 
                    ? (isEditingLocation ? '⏳ Updating Location...' : '⏳ Adding Location...') 
                    : (isEditingLocation ? '🔄 Update Location' : '📍 Add Location')
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