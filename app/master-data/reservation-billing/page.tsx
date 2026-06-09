"use client";

import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Search, Download, Plus, Pencil, Trash2, Calendar, AlertTriangle, Clock } from "lucide-react";
import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, DocumentReference } from 'firebase/firestore';
import { parseISO, differenceInCalendarDays, format, isBefore, isAfter } from 'date-fns';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import React from 'react';
import { CSVLink } from 'react-csv';
import BlinkingSirenIcon from '@/components/BlinkingSirenIcon';

const indianStates = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
  "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", 
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", 
  "Ladakh", "Lakshadweep", "Puducherry"
];

type Location = {
  locationId: string;
  locationName: string;
};

type Branch = {
  id: string;
  state: string;
  branch: string;
  locations: Location[];
  [key: string]: any;
};

const reservationFields = [
  'reservationId', 'state', 'branch', 'location', 'warehouse', 'client', 'clientId', 
  'reservationStatus', 'billingStatus', 'reservationRate', 'reservationQty', 'reservationStart', 'reservationEnd',
  'billingCycle', 'billingType', 'billingRate'
];

type Reservation = {
  id?: string;
  reservationId: string;
  state: string;
  branch: string;
  location: string;
  warehouse: string;
  warehouseCode?: string; // Unique warehouse identifier
  client: string;
  clientId: string;
  commodity?: string; // Commodity name (third unique factor)
  commodityId?: string; // Commodity ID
  reservationStatus: 'reservation' | 'post-reservation';
  billingStatus: 'processing' | 'unpaid' | 'complete';
  reservationRate: string;
  reservationQty: string;
  reservationStart: string;
  reservationEnd: string;
  billingCycle: string;
  billingType: string;
  billingRate: string;
  [key: string]: any;
};

export default function ReservationBillingPage() {
  const router = useRouter();
  const { toast } = useToast();

  // State management
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [commodities, setCommodities] = useState<any[]>([]);
  const [showCustomError, setShowCustomError] = useState(false);
  
  // Dialog states
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; row: Reservation | null }>({ open: false, row: null });
  const [editDialog, setEditDialog] = useState<{ open: boolean; row: Reservation | null }>({ open: false, row: null });
  const [addDialog, setAddDialog] = useState<{ open: boolean; row: Reservation | null }>({ open: false, row: null });
  const [addReservationDialog, setAddReservationDialog] = useState(false);
  const [alertModal, setAlertModal] = useState<{ open: boolean; type: 'alert' | 'update'; row: Reservation | null }>({ open: false, type: 'alert', row: null });
  
  // Form states
  const [newReservation, setNewReservation] = useState<Partial<Reservation>>({
    state: '', branch: '', location: '', warehouse: '', warehouseCode: '', client: '', clientId: '', 
    commodity: '', commodityId: '',
    reservationStatus: 'reservation', billingStatus: 'processing',
    reservationRate: '', reservationQty: '', reservationStart: '', reservationEnd: '',
    billingCycle: '-', billingType: '-', billingRate: '-'
  });
  const [editBillingForm, setEditBillingForm] = useState({ billingCycle: '', billingType: '', billingRate: '' });
  const [addBillingForm, setAddBillingForm] = useState({ billingCycle: '', billingType: '', billingRate: '' });
  const [extendReservationForm, setExtendReservationForm] = useState({ reservationEnd: '' });
  const [updateBillingForm, setUpdateBillingForm] = useState({ billingCycle: '', billingType: '', billingRate: '' });

  // Fetch data function
  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      
      const [reservationSnapshot, branchSnapshot, clientSnapshot, inspectionSnapshot, commoditySnapshot] = await Promise.all([
        getDocs(collection(db, 'reservation')),
        getDocs(collection(db, 'branches')),
        getDocs(collection(db, 'clients')),
        getDocs(collection(db, 'inspections')),
        getDocs(collection(db, 'commodities'))
      ]);

      const fetchedReservations = reservationSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Reservation[];
      const fetchedBranches = branchSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Branch[];
      const fetchedClients = clientSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const fetchedCommodities = commoditySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Extract unique warehouses from inspections - ONLY ACTIVATED WAREHOUSES (excluding CM type)
      const warehouseSet = new Set<string>();
      const fetchedWarehouses: any[] = [];
      
      inspectionSnapshot.docs.forEach(doc => {
        const data = doc.data();
        // Only include warehouses with status 'activated' and exclude CM (Collateral Management) business type warehouses
        const isCMType = data.businessType?.toUpperCase() === 'CM';
        
        if (data.warehouseName && !warehouseSet.has(data.warehouseName) && data.status === 'activated' && !isCMType) {
          warehouseSet.add(data.warehouseName);
          fetchedWarehouses.push({
            id: doc.id,
            warehouseName: data.warehouseName,
            warehouseCode: data.warehouseCode || 'WH-0001',
            state: data.state || '',
            branch: data.branch || '',
            location: data.location || '',
            warehouseStatus: data.status || '',
            businessType: data.businessType || ''
          });
        }
      });

      // If no warehouses found from inspections, try to fetch from warehouses collection
      if (fetchedWarehouses.length === 0) {
        try {
          const warehouseSnapshot = await getDocs(collection(db, 'warehouses'));
          const directWarehouses = warehouseSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            warehouseName: doc.data().warehouseName || doc.data().name || 'Unknown Warehouse'
          }));
          fetchedWarehouses.push(...directWarehouses);
        } catch (warehouseError) {
          console.log('No warehouses collection found, using inspection data only');
        }
      }

      // If still no warehouses, add some sample ones for testing
      if (fetchedWarehouses.length === 0) {
        const sampleWarehouses: any[] = [
         
        ];
        fetchedWarehouses.push(...sampleWarehouses);
      }

      console.log('Final warehouses:', fetchedWarehouses); // Debug log

      setReservations(fetchedReservations);
      setBranches(fetchedBranches);
      setClients(fetchedClients);
      setWarehouses(fetchedWarehouses);
      setCommodities(fetchedCommodities);
      
      // Cross-module reflection (requirement: reflect changes across modules)
      window.dispatchEvent(new CustomEvent('reservationDataUpdated', { detail: fetchedReservations }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();

    // Listen for warehouse status updates from other modules
    const handleWarehouseStatusUpdate = () => {
      console.log('Warehouse status updated, refreshing data...');
      fetchData();
    };

    window.addEventListener('warehouseStatusUpdated', handleWarehouseStatusUpdate);

    return () => {
      window.removeEventListener('warehouseStatusUpdated', handleWarehouseStatusUpdate);
    };
  }, []);

  // Populate extend reservation form when modal opens
  useEffect(() => {
    if (alertModal.open && alertModal.type === 'alert' && alertModal.row) {
      setExtendReservationForm({
        reservationEnd: alertModal.row.reservationEnd || ''
      });
    }
  }, [alertModal.open, alertModal.type, alertModal.row]);

  // Populate update billing form when modal opens
  useEffect(() => {
    if (alertModal.open && alertModal.type === 'update' && alertModal.row) {
      setUpdateBillingForm({
        billingCycle: alertModal.row.billingCycle || '',
        billingType: alertModal.row.billingType || '',
        billingRate: alertModal.row.billingRate || ''
      });
    }
  }, [alertModal.open, alertModal.type, alertModal.row]);

  // Filter and sort data (requirement: ascending order by reservation code)
  const filteredReservations = useMemo(() => {
    const filtered = reservations.filter(r => 
      Object.values(r).some(value => 
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
    // Sort by reservationId in ascending order
    return filtered.sort((a, b) => a.reservationId.localeCompare(b.reservationId));
  }, [reservations, searchTerm]);

  // CSV data preparation with Rs. formatting
  const csvData = useMemo(() => {
    return filteredReservations.map(reservation => ({
      ...reservation,
      reservationRate: `Rs. ${reservation.reservationRate}`,
      billingRate: reservation.billingRate !== '-' ? `Rs. ${reservation.billingRate}` : '-'
    }));
  }, [filteredReservations]);

  const csvHeaders = reservationFields.map(field => ({ label: field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), key: field }));

  // Column definitions with Rs. formatting
  const reservationColumns: ColumnDef<Reservation>[] = [
    {
      accessorKey: "reservationId",
      header: "Reservation ID",
      cell: ({ row }) => <span className="font-medium">{row.original.reservationId}</span>
    },
    {
      accessorKey: "state",
      header: "State",
    },
    {
      accessorKey: "branch",
      header: "Branch",
    },
    {
      accessorKey: "location",
      header: "Location",
    },
    {
      accessorKey: "warehouse",
      header: "Warehouse",
    },
    {
      accessorKey: "client",
      header: "Client",
    },
    {
      accessorKey: "clientId",
      header: "Client ID",
    },
    {
      accessorKey: "commodity",
      header: "Commodity",
      cell: ({ row }) => <span className="font-medium">{row.original.commodity || '-'}</span>
    },
    {
      accessorKey: "reservationStatus",
      header: "Reservation Status",
      cell: ({ row }) => {
        const status = row.original.reservationStatus;
        const colorMap = {
          'reservation': 'bg-blue-100 text-blue-800 border-blue-300',
          'post-reservation': 'bg-green-100 text-green-800 border-green-300'
        };
        return (
          <span className={`px-2 py-1 text-xs rounded-full border ${colorMap[status] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
            {status === 'post-reservation' ? 'Post-reservation' : 'Reservation'}
          </span>
        );
      }
    },
    // {
    //   accessorKey: "billingStatus",
    //   header: "Billing Status",
    //   cell: ({ row }) => {
    //     const status = row.original.billingStatus;
    //     const colorMap = {
    //       'processing': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    //       'unpaid': 'bg-red-100 text-red-800 border-red-300',
    //       'complete': 'bg-green-100 text-green-800 border-green-300'
    //     };
    //     return (
    //       <span className={`px-2 py-1 text-xs rounded-full border ${colorMap[status] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
    //         {status}
    //       </span>
    //     );
    //   }
    // },
    {
      accessorKey: "reservationRate",
      header: "Reservation Rate",
      cell: ({ getValue }) => `Rs. ${getValue() as string}`
    },
    {
      accessorKey: "reservationQty",
      header: "Reservation Qty",
    },
    {
      accessorKey: "reservationStart",
      header: "Reservation Start",
      cell: ({ getValue }) => {
        const date = getValue() as string;
        try {
          return format(parseISO(date), 'dd/MM/yyyy');
        } catch {
          return date;
        }
      }
    },
    {
      accessorKey: "reservationEnd",
      header: "Reservation End",
      cell: ({ row }) => renderReservationEndCell(row.original)
    },
    {
      accessorKey: "billingCycle",
      header: "Billing Cycle",
    },
    {
      accessorKey: "billingType",
      header: "Billing Type",
    },
    {
      accessorKey: "billingRate",
      header: "Billing Rate",
      cell: ({ getValue }) => {
        const value = getValue() as string;
        return value !== '-' ? `Rs. ${value}` : '-';
      }
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          {canEditBilling(row.original) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditBillingForm({
                  billingCycle: row.original.billingCycle,
                  billingType: row.original.billingType,
                  billingRate: row.original.billingRate
                });
                setEditDialog({ open: true, row: row.original });
              }}
            >
              <Pencil className="w-4 h-4" />
            </Button>
          )}
          {canAddBilling(row.original) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAddBillingForm({ billingCycle: '', billingType: '', billingRate: '' });
                setAddDialog({ open: true, row: row.original });
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-800"
            onClick={() => setDeleteDialog({ open: true, row: row.original })}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    }
  ];

  // Helper functions for date validation and alerts
  function renderReservationEndCell(d: Reservation) {
    const today = new Date();
    const endDate = parseISO(d.reservationEnd);
    const daysRemaining = differenceInCalendarDays(endDate, today);

    // Red alert: less than 5 days remaining
    if (daysRemaining >= 0 && daysRemaining < 5) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-red-700">{String(d.reservationEnd)}</span>
          <button
            className="p-0 m-0 bg-transparent border-none focus:outline-none"
            title="Less than 5 days remaining"
            onClick={() => setAlertModal({ open: true, type: 'alert', row: d })}
            type="button"
          >
            <BlinkingSirenIcon color="red" size={24} />
          </button>
        </div>
      );
    } else if (daysRemaining < 0) {
      // Blue alert: expired dates
      if (d.billingCycle && d.billingCycle !== '-' && d.billingType && d.billingType !== '-' && d.billingRate && d.billingRate !== '-') {
        return (
          <div className="flex items-center gap-2">
            <span className="text-blue-700">{String(d.reservationEnd)}</span>
            <button
              className="p-0 m-0 bg-transparent border-none focus:outline-none"
              title="Expired with billing details"
              onClick={() => setAlertModal({ open: true, type: 'update', row: d })}
              type="button"
            >
              <BlinkingSirenIcon color="blue" size={24} />
            </button>
          </div>
        );
      } else {
        return (
          <div className="flex items-center gap-2">
            <span className="text-green-700">{String(d.reservationEnd)}</span>
            <button
              className="p-0 m-0 bg-transparent border-none focus:outline-none"
              title="Update"
              onClick={() => setAlertModal({ open: true, type: 'update', row: d })}
              type="button"
            >
              <BlinkingSirenIcon color="blue" size={24} />
            </button>
          </div>
        );
      }
    }
    return <span className="text-green-700">{String(d.reservationEnd)}</span>;
  }

  function canEditBilling(row: Reservation) {
    return row.billingCycle && row.billingCycle !== '-' && row.billingType && row.billingType !== '-' && row.billingRate && row.billingRate !== '-';
  }

  function canAddBilling(row: Reservation) {
    // Only show plus button for post-reservation status AND when billing fields are empty
    return row.reservationStatus === 'post-reservation' && 
           (!row.billingCycle || row.billingCycle === '-') && 
           (!row.billingType || row.billingType === '-') && 
           (!row.billingRate || row.billingRate === '-');
  }

  // Function to update related inward entries when reservation data changes
  async function updateRelatedInwardEntries(updatedReservation: Reservation) {
    try {
      console.log('🔄 Updating related inward entries for reservation:', updatedReservation.reservationId);
      console.log('Looking for: warehouse=' + updatedReservation.warehouseCode + ', client=' + updatedReservation.client + ', commodity=' + updatedReservation.commodity);
      
      const inwardCollection = collection(db, 'inward');
      const inwardSnapshot = await getDocs(inwardCollection);
      
      console.log(`📊 Total inward documents to check: ${inwardSnapshot.size}`);
      
      let updatedCount = 0;
      const updatePromises: Promise<void>[] = [];
      
      inwardSnapshot.forEach((inwardDoc) => {
        const inwardData = inwardDoc.data();
        
        // Check if this inward entry matches the updated reservation
        // Using 3-factor match: warehouseCode + client + commodity
        if (
          inwardData.warehouseCode === updatedReservation.warehouseCode &&
          inwardData.client === updatedReservation.client &&
          inwardData.commodity === updatedReservation.commodity
        ) {
          console.log(`✅ Found matching inward entry: ${inwardData.inwardId}`);
          
          // Prepare the reservation data update
          const reservationUpdateData = {
            reservationStatus: updatedReservation.reservationStatus || '',
            billingStatus: updatedReservation.billingStatus || '',
            reservationRate: updatedReservation.reservationRate || '',
            reservationQty: updatedReservation.reservationQty || '',
            reservationStart: updatedReservation.reservationStart || '',
            reservationEnd: updatedReservation.reservationEnd || '',
            billingCycle: updatedReservation.billingCycle || '',
            billingType: updatedReservation.billingType || '',
            billingRate: updatedReservation.billingRate || '',
          };
          
          // Also update the nested inwardEntries array if it exists
          let updatedInwardEntries = inwardData.inwardEntries;
          if (Array.isArray(inwardData.inwardEntries)) {
            updatedInwardEntries = inwardData.inwardEntries.map((entry: any) => ({
              ...entry,
              ...reservationUpdateData
            }));
          }
          
          // Update the reservation fields in this inward entry (both root level and nested array)
          const updatePromise = updateDoc(doc(db, 'inward', inwardDoc.id), {
            ...reservationUpdateData,
            inwardEntries: updatedInwardEntries,
            updatedAt: new Date().toISOString()
          });
          
          updatePromises.push(updatePromise);
          updatedCount++;
        }
      });
      
      // Wait for all updates to complete
      await Promise.all(updatePromises);
      
      console.log(`✅ Successfully updated ${updatedCount} inward entries with latest reservation data`);
      
      if (updatedCount === 0) {
        console.warn('⚠️ No matching inward entries found for this reservation');
      }
    } catch (error) {
      console.error('❌ Error updating related inward entries:', error);
    }
  }

  // Handler functions
  async function handleDeleteReservation(row: Reservation) {
    if (!row.id) {
      toast({ title: 'Delete Failed', description: 'No document ID found.', variant: 'destructive' });
      return;
    }
    try {
      await deleteDoc(doc(db, 'reservation', row.id));
      const updatedReservations = reservations.filter(r => r.id !== row.id);
      setReservations(updatedReservations);
      
      // Dispatch event to notify other modules of reservation data change
      window.dispatchEvent(new CustomEvent('reservationDataUpdated', { detail: updatedReservations }));
      
      toast({ title: 'Reservation deleted successfully!', variant: 'default' });
    } catch (err) {
      toast({ title: 'Delete Failed', description: String(err), variant: 'destructive' });
    }
    setDeleteDialog({ open: false, row: null });
  }

  async function handleEditBillingSubmit() {
    if (!editDialog.row?.id) return;
    try {
      await updateDoc(doc(db, 'reservation', editDialog.row.id), editBillingForm);
      const updatedReservations = reservations.map(r => r.id === editDialog.row?.id ? { ...r, ...editBillingForm } : r);
      setReservations(updatedReservations);
      
      // Update related inward entries with new reservation data
      const updatedReservation = updatedReservations.find(r => r.id === editDialog.row?.id);
      if (updatedReservation) {
        await updateRelatedInwardEntries(updatedReservation);
      }
      
      // Dispatch event to notify other modules of reservation data change
      window.dispatchEvent(new CustomEvent('reservationDataUpdated', { detail: updatedReservations }));
      
      toast({ title: 'Billing details updated!', variant: 'default' });
      setEditDialog({ open: false, row: null });
    } catch (err) {
      toast({ title: 'Update Failed', description: String(err), variant: 'destructive' });
    }
  }

  // Handle extending reservation end date (red siren)
  async function handleExtendReservation() {
    if (!alertModal.row?.id || !extendReservationForm.reservationEnd) return;
    try {
      await updateDoc(doc(db, 'reservation', alertModal.row.id), {
        reservationEnd: extendReservationForm.reservationEnd
      });
      const updatedReservations = reservations.map(r => 
        r.id === alertModal.row?.id 
          ? { ...r, reservationEnd: extendReservationForm.reservationEnd } 
          : r
      );
      setReservations(updatedReservations);
      
      // Update related inward entries with new reservation data
      const updatedReservation = updatedReservations.find(r => r.id === alertModal.row?.id);
      if (updatedReservation) {
        await updateRelatedInwardEntries(updatedReservation);
      }
      
      // Dispatch event to notify other modules of reservation data change
      window.dispatchEvent(new CustomEvent('reservationDataUpdated', { detail: updatedReservations }));
      
      toast({ title: 'Reservation Extended!', description: 'Reservation end date has been updated.', variant: 'default' });
      setAlertModal({ open: false, type: 'alert', row: null });
      setExtendReservationForm({ reservationEnd: '' });
    } catch (err) {
      toast({ title: 'Extension Failed', description: String(err), variant: 'destructive' });
    }
  }

  // Handle updating billing details for expired reservation (blue siren)
  async function handleUpdateBilling() {
    if (!alertModal.row?.id) return;
    try {
      const updateData = {
        ...updateBillingForm,
        billingStatus: 'complete' as const,
        // Set reservation fields to "-" as per requirements
        reservationRate: '-',
        reservationQty: '-',
        reservationStart: '-',
        reservationEnd: '-'
      };
      await updateDoc(doc(db, 'reservation', alertModal.row.id), updateData);
      const updatedReservations = reservations.map(r => 
        r.id === alertModal.row?.id 
          ? { ...r, ...updateData }
          : r
      );
      setReservations(updatedReservations);
      
      // Update related inward entries with new billing data
      const updatedReservation = updatedReservations.find(r => r.id === alertModal.row?.id);
      if (updatedReservation) {
        await updateRelatedInwardEntries(updatedReservation);
      }
      
      // Dispatch event to notify other modules of reservation data change
      window.dispatchEvent(new CustomEvent('reservationDataUpdated', { detail: updatedReservations }));
      
      toast({ title: 'Billing Updated!', description: 'Billing details updated, reservation fields set to "-", and status set to complete.', variant: 'default' });
      setAlertModal({ open: false, type: 'update', row: null });
      setUpdateBillingForm({ billingCycle: '', billingType: '', billingRate: '' });
    } catch (err) {
      toast({ title: 'Update Failed', description: String(err), variant: 'destructive' });
    }
  }

  // Handle adding new reservation
  async function handleAddReservation() {
    // Only validate dates for 'reservation' status, skip for 'post-reservation'
    if (newReservation.reservationStatus === 'reservation' && !validateDates(newReservation.reservationStart!, newReservation.reservationEnd!)) {
      toast({ title: "Invalid Date Range", description: "Reservation start date must be before end date.", variant: "destructive" });
      return;
    }

    // Check for duplicate reservation (same warehouse code + client + commodity) ONLY for 'reservation' status
    // Allow multiple entries for 'post-reservation' status
    if (newReservation.reservationStatus === 'reservation') {
      const duplicateCheck = checkDuplicateReservation(newReservation.warehouseCode!, newReservation.client!, newReservation.commodity!);
      if (duplicateCheck.isDuplicate) {
        toast({ 
          title: "Duplicate Reservation", 
          description: duplicateCheck.message, 
          variant: "destructive" 
        });
        return;
      }
    }

    // For post-reservation, check if billing cycle + billing type combination already exists
    if (newReservation.reservationStatus === 'post-reservation') {
      const duplicateBilling = reservations.find(res => 
        res.warehouseCode?.trim().toLowerCase() === newReservation.warehouseCode?.trim().toLowerCase() &&
        res.client?.trim().toLowerCase() === newReservation.client?.trim().toLowerCase() &&
        res.commodity?.trim().toLowerCase() === newReservation.commodity?.trim().toLowerCase() &&
        res.billingCycle === newReservation.billingCycle &&
        res.billingType === newReservation.billingType
      );

      if (duplicateBilling) {
        toast({ 
          title: "Duplicate Billing Entry", 
          description: `A post-reservation entry with Billing Cycle "${newReservation.billingCycle}" and Billing Type "${newReservation.billingType}" already exists for this warehouse, client, and commodity combination. Please select a different combination.`, 
          variant: "destructive" 
        });
        return;
      }
    }

    try {
      const reservationId = generateReservationId();
      const reservationData = {
        ...newReservation,
        reservationId,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'reservation'), reservationData);
      setReservations(prev => [...prev, { ...reservationData, id: reservationId } as Reservation]);
      setAddReservationDialog(false);
      setNewReservation({
        state: '', branch: '', location: '', warehouse: '', warehouseCode: '', client: '', clientId: '', 
        commodity: '', commodityId: '',
        reservationStatus: 'reservation', billingStatus: 'processing',
        reservationRate: '', reservationQty: '', reservationStart: '', reservationEnd: '',
        billingCycle: '-', billingType: '-', billingRate: '-'
      });
      toast({ title: "Reservation Added", description: `New reservation created with ID: ${reservationId}`, className: "bg-green-100 border-green-500 text-green-700" });
      fetchData(); // Refresh data
    } catch (error) {
      toast({ title: "Error", description: "Failed to add reservation.", variant: "destructive" });
    }
  }

  // Generate unique reservation ID
  function generateReservationId() {
    if (reservations.length === 0) {
      return 'RES-0001';
    }
    
    const existingNumbers = reservations
      .map(r => r.reservationId)
      .filter(id => id && id.startsWith('RES-'))
      .map(id => parseInt(id.split('-')[1]))
      .filter(num => !isNaN(num));
    
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;
    
    return `RES-${nextNumber.toString().padStart(4, '0')}`;
  }

  async function handleAddBillingSubmit() {
    if (!addDialog.row?.id) return;
    
    // Validate that billing cycle and type are not the same as previous entry for same warehouse + client + commodity
    const hasDuplicate = reservations.some(r => 
      r.id !== addDialog.row?.id && 
      r.billingCycle === addBillingForm.billingCycle && 
      r.billingType === addBillingForm.billingType &&
      r.warehouse === addDialog.row?.warehouse &&
      r.client === addDialog.row?.client &&
      r.commodity === addDialog.row?.commodity
    );
    
    if (hasDuplicate) {
      setShowCustomError(true);
      setTimeout(() => setShowCustomError(false), 3000);
      return;
    }

    try {
      await updateDoc(doc(db, 'reservation', addDialog.row.id), addBillingForm);
      const updatedReservations = reservations.map(r => r.id === addDialog.row?.id ? { ...r, ...addBillingForm } : r);
      setReservations(updatedReservations);
      
      // Update related inward entries with new billing data
      const updatedReservation = updatedReservations.find(r => r.id === addDialog.row?.id);
      if (updatedReservation) {
        await updateRelatedInwardEntries(updatedReservation);
      }
      
      // Dispatch event to notify other modules of reservation data change
      window.dispatchEvent(new CustomEvent('reservationDataUpdated', { detail: updatedReservations }));
      
      toast({ title: 'Billing details added!', variant: 'default' });
      setAddDialog({ open: false, row: null });
    } catch (err) {
      toast({ title: 'Add Failed', description: String(err), variant: 'destructive' });
    }
  }

  // Date validation helper
  function validateDates(startDate: string, endDate: string) {
    if (!startDate || !endDate) return true;
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      return isBefore(start, end);
    } catch {
      return true;
    }
  }

  // Check for duplicate reservation (same warehouse + client)
  function checkDuplicateReservation(warehouseCode: string, client: string, commodity: string): { isDuplicate: boolean; message: string } {
    const today = new Date();
    
    // Normalize inputs for case-insensitive comparison
    const normalizedWarehouseCode = warehouseCode?.trim().toLowerCase();
    const normalizedClient = client?.trim().toLowerCase();
    const normalizedCommodity = commodity?.trim().toLowerCase();
    
    // Find existing reservations with same warehouse code, client AND commodity (case-insensitive)
    const existingReservation = reservations.find(res => 
      res.warehouseCode?.trim().toLowerCase() === normalizedWarehouseCode && 
      res.client?.trim().toLowerCase() === normalizedClient &&
      res.commodity?.trim().toLowerCase() === normalizedCommodity
    );

    if (!existingReservation) {
      return { isDuplicate: false, message: '' };
    }

    // Check if existing reservation is expired
    if (existingReservation.reservationEnd && existingReservation.reservationEnd !== '-') {
      try {
        const endDate = parseISO(existingReservation.reservationEnd);
        const isExpired = isBefore(endDate, today);
        
        if (isExpired) {
          // Expired reservation - allow new reservation
          return { isDuplicate: false, message: '' };
        }
      } catch {
        // If date parsing fails, treat as active reservation
      }
    }

    // Active reservation exists - block duplicate
    return { 
      isDuplicate: true, 
      message: `A reservation already exists for warehouse code "${warehouseCode}", client "${client}", and commodity "${commodity}". The existing reservation expires on ${existingReservation.reservationEnd || 'N/A'}.` 
    };
  }

  // Get filtered states, branches, locations, warehouses based on selections
  const getAvailableStates = () => {
    if (warehouses.length === 0) {
      // If no warehouses loaded yet, show all states as fallback
      return indianStates;
    }
    const warehouseStates = Array.from(new Set(warehouses.map(w => w.state).filter(Boolean)));
    // If no states found in warehouses, show all states as fallback
    return warehouseStates.length > 0 ? indianStates.filter(state => warehouseStates.includes(state)) : indianStates;
  };
  
  const getFilteredBranches = () => {
    if (warehouses.length === 0) {
      // If no warehouses loaded, show all branches for the selected state
      return branches.filter(b => b.state === newReservation.state);
    }
    const warehouseBranches = warehouses
      .filter(w => w.state === newReservation.state)
      .map(w => w.branch)
      .filter(Boolean);
    
    if (warehouseBranches.length === 0) {
      // If no warehouse branches found, show all branches for the state
      return branches.filter(b => b.state === newReservation.state);
    }
    return branches.filter(b => b.state === newReservation.state && warehouseBranches.includes(b.branch));
  };
  
  const getFilteredLocations = () => {
    const selectedBranch = branches.find(b => b.branch === newReservation.branch && b.state === newReservation.state);
    
    if (warehouses.length === 0 || !selectedBranch?.locations) {
      // If no warehouses or no locations, return all locations for the branch
      return selectedBranch?.locations || [];
    }
    
    const warehouseLocations = warehouses
      .filter(w => w.state === newReservation.state && w.branch === newReservation.branch)
      .map(w => w.location)
      .filter(Boolean);
    
    if (warehouseLocations.length === 0) {
      // If no warehouse locations found, show all locations for the branch
      return selectedBranch?.locations || [];
    }
    
    return selectedBranch?.locations?.filter(loc => warehouseLocations.includes(loc.locationName)) || [];
  };
  
  const getFilteredWarehouses = () => {
    if (warehouses.length === 0) {
      return [];
    }
    
    // First filter: Exclude closed and rejected warehouses, include activated and others
    const availableWarehouses = warehouses.filter(w => {
      const status = w.warehouseStatus?.trim().toLowerCase();
      // Explicitly exclude closed, rejected warehouses
      // Include activated, pending, submitted, or warehouses without status
      const excludedStatuses = ['closed', 'rejected'];
      return !status || !excludedStatuses.includes(status);
    });
    
    console.log('All warehouses:', warehouses);
    console.log('Filtering warehouses with:', { state: newReservation.state, branch: newReservation.branch, location: newReservation.location });
    console.log('Available warehouses (excluding closed/rejected):', availableWarehouses);
    
    // If no state/branch/location selected yet, return all available warehouses
    if (!newReservation.state || !newReservation.branch || !newReservation.location) {
      console.log('Returning all available warehouses - incomplete selection');
      return availableWarehouses;
    }
    
    // Try exact match first (from available warehouses only)
    let filtered = availableWarehouses.filter(w => 
      w.state === newReservation.state && 
      w.branch === newReservation.branch && 
      w.location === newReservation.location
    );
    
    console.log('Exact match results:', filtered);
    
    // If no exact match, try state and branch only
    if (filtered.length === 0) {
      filtered = availableWarehouses.filter(w => 
        w.state === newReservation.state && 
        w.branch === newReservation.branch
      );
      console.log('State+Branch match results:', filtered);
    }
    
    // If still no match, try state only
    if (filtered.length === 0) {
      filtered = availableWarehouses.filter(w => 
        w.state === newReservation.state
      );
      console.log('State only match results:', filtered);
    }
    
    // If still no match, return all available warehouses as fallback
    if (filtered.length === 0) {
      console.log('No matches found, returning all available warehouses');
      return availableWarehouses;
    }
    
    return filtered;
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Button
              onClick={() => router.push('/master-data')}
              variant="outline"
              className="border-orange-300 text-orange-600 hover:bg-orange-50 w-full sm:w-auto px-3 sm:px-4 py-2 text-sm sm:text-base"
            >
              ← Dashboard
            </Button>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-center sm:text-left">Reservation & Billing Management</h1>
          </div>
          {/* Add Reservation button */}
          <Button
            onClick={() => setAddReservationDialog(true)}
            className="bg-green-500 hover:bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3 shadow-lg text-sm sm:text-base w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Reservation
          </Button>
        </div>

        {/* Search and Controls */}
        <Card className="border-green-300">
          <CardHeader className="bg-orange-100 p-3 sm:p-4">
            <CardTitle className="text-base sm:text-lg text-orange-600">Search & Filters</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 sm:pt-6 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reservations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <CSVLink data={csvData} headers={csvHeaders} filename={"reservation_billing_export.csv"} className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 h-10 px-4 py-2" target="_blank">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </CSVLink>
            </div>
            
            {/* Entry count display (requirement: count below search bar) */}
            <div className="flex justify-between items-center mt-3">
              <div className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                <strong>Total Entries: {filteredReservations.length}</strong> 
                {searchTerm && <span className="ml-2">(filtered from {reservations.length})</span>}
              </div>
              <div className="text-xs text-gray-500">
                {filteredReservations.length > 0 && "Showing entries in ascending order by reservation code"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex justify-end">
          <div className="border p-2 rounded-md bg-gray-50 text-sm max-w-xs">
            <div className="flex items-center space-x-2">
              <span className="h-3 w-3 bg-red-500 rounded-full"></span>
              <span>- Expired and updated billing details</span>
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <span className="h-3 w-3 bg-blue-500 rounded-full"></span>
              <span>- Expired with billing details</span>
            </div>
          </div>
        </div>

        <CardContent>
          <DataTable
            columns={reservationColumns}
            data={filteredReservations}
            isLoading={loading}
            error={error || undefined}
            wrapperClassName="border-green-300"
            headClassName="bg-orange-100 text-orange-600 font-bold"
            stickyHeader={true} // requirement: freeze top row header
            stickyFirstColumn={true} // requirement: freeze first column  
            showGridLines={true} // requirement: grid lines in table
          />
        </CardContent>

        {/* Delete confirmation dialog */}
        <AlertDialog open={deleteDialog.open} onOpenChange={isOpen => setDeleteDialog({ open: isOpen, row: null })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this reservation? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDeleteReservation(deleteDialog.row!)} className="bg-red-500 hover:bg-red-600">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit billing details modal */}
        <Dialog open={editDialog.open} onOpenChange={isOpen => setEditDialog({ open: isOpen, row: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Billing</DialogTitle>
              <DialogDescription>Update billing details for this reservation.</DialogDescription>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); handleEditBillingSubmit(); }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label>Billing Cycle</Label>
                  <Select value={editBillingForm.billingCycle} onValueChange={v => setEditBillingForm(f => ({ ...f, billingCycle: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Daily">Daily</SelectItem>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                      <SelectItem value="Fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Billing Type</Label>
                  <Select value={editBillingForm.billingType} onValueChange={v => setEditBillingForm(f => ({ ...f, billingType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Big bag">Big bag</SelectItem>
                      <SelectItem value="Small bag">Small bag</SelectItem>
                      <SelectItem value="Qty">Qty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Billing Rate (Rs/MT)</Label>
                  <Input type="number" min="0" value={editBillingForm.billingRate} onChange={e => setEditBillingForm(f => ({ ...f, billingRate: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-2 shadow-lg">Update</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add billing modal */}
        <Dialog open={addDialog.open} onOpenChange={isOpen => setAddDialog({ open: isOpen, row: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Billing</DialogTitle>
              <DialogDescription>Add billing details for this reservation.</DialogDescription>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); handleAddBillingSubmit(); }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label>Billing Cycle</Label>
                  <Select value={addBillingForm.billingCycle} onValueChange={v => setAddBillingForm(f => ({ ...f, billingCycle: v }))} required>
                    <SelectTrigger><SelectValue placeholder="Select billing cycle" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Daily">Daily</SelectItem>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                      <SelectItem value="Fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Billing Type</Label>
                  <Select value={addBillingForm.billingType} onValueChange={v => setAddBillingForm(f => ({ ...f, billingType: v }))} required>
                    <SelectTrigger><SelectValue placeholder="Select billing type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Big bag">Big bag</SelectItem>
                      <SelectItem value="Small bag">Small bag</SelectItem>
                      <SelectItem value="Qty">Qty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Billing Rate (Rs/MT)</Label>
                  <Input type="number" min="0" value={addBillingForm.billingRate} onChange={e => setAddBillingForm(f => ({ ...f, billingRate: e.target.value }))} required />
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit" className="bg-green-500 hover:bg-green-600 text-white px-8 py-2 shadow-lg">Add Row</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add New Reservation Modal */}
        <Dialog open={addReservationDialog} onOpenChange={setAddReservationDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-green-700 text-xl">📋 Add New Reservation</DialogTitle>
              <DialogDescription>Create a new reservation entry with all required details.</DialogDescription>
            </DialogHeader>
            
            <form onSubmit={e => { e.preventDefault(); handleAddReservation(); }} className="space-y-6">
              {/* Location Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-green-600 font-medium">State <span className="text-red-500">*</span></Label>
                  <Select value={newReservation.state} onValueChange={v => setNewReservation(f => ({ ...f, state: v, branch: '', location: '' }))} required>
                    <SelectTrigger className="border-orange-300 focus:border-orange-500">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableStates().map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-green-600 font-medium">Branch <span className="text-red-500">*</span></Label>
                  <Select value={newReservation.branch} onValueChange={v => setNewReservation(f => ({ ...f, branch: v, location: '' }))} required>
                    <SelectTrigger className="border-orange-300 focus:border-orange-500">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {getFilteredBranches().map(branch => (
                        <SelectItem key={branch.id} value={branch.branch}>{branch.branch}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-green-600 font-medium">Location <span className="text-red-500">*</span></Label>
                  <Select value={newReservation.location} onValueChange={v => setNewReservation(f => ({ ...f, location: v }))} required>
                    <SelectTrigger className="border-orange-300 focus:border-orange-500">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {getFilteredLocations().map(location => (
                        <SelectItem key={location.locationId} value={location.locationName}>{location.locationName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Warehouse and Client Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-green-600 font-medium">Warehouse <span className="text-red-500">*</span></Label>
                  <Select value={newReservation.warehouse} onValueChange={v => {
                    const selectedWarehouse = getFilteredWarehouses().find(w => w.warehouseName === v);
                    setNewReservation(f => ({ ...f, warehouse: v, warehouseCode: selectedWarehouse?.warehouseCode || '' }));
                  }} required>
                    <SelectTrigger className="border-orange-300 focus:border-orange-500">
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const filteredWarehouses = getFilteredWarehouses();
                        console.log('All warehouses:', warehouses);
                        console.log('Filtered warehouses for dropdown:', filteredWarehouses);
                        console.log('Current selection:', { state: newReservation.state, branch: newReservation.branch, location: newReservation.location });
                        
                        // Only show filtered activated warehouses (no fallback to all warehouses)
                        return filteredWarehouses.map(warehouse => (
                          <SelectItem key={warehouse.id} value={warehouse.warehouseName}>
                            {warehouse.warehouseName} ({warehouse.warehouseCode})
                          </SelectItem>
                        ));
                      })()}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-green-600 font-medium">Client <span className="text-red-500">*</span></Label>
                  <Select value={newReservation.client} onValueChange={v => {
                    const selectedClient = clients.find(c => c.firmName === v);
                    setNewReservation(f => ({ ...f, client: v, clientId: selectedClient?.clientId || '' }));
                  }} required>
                    <SelectTrigger className="border-orange-300 focus:border-orange-500">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.firmName}>{client.firmName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Commodity Selection */}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-green-600 font-medium">Commodity <span className="text-red-500">*</span></Label>
                  <Select value={newReservation.commodity} onValueChange={v => {
                    const selectedCommodity = commodities.find(c => c.commodityName === v);
                    setNewReservation(f => ({ ...f, commodity: v, commodityId: selectedCommodity?.commodityId || '' }));
                  }} required>
                    <SelectTrigger className="border-orange-300 focus:border-orange-500">
                      <SelectValue placeholder="Select commodity" />
                    </SelectTrigger>
                    <SelectContent>
                      {commodities.map(commodity => (
                        <SelectItem key={commodity.id} value={commodity.commodityName}>
                          {commodity.commodityName} ({commodity.commodityId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Reservation Status Dropdown */}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-green-600 font-medium">Reservation Status <span className="text-red-500">*</span></Label>
                  <Select 
                    value={newReservation.reservationStatus || 'reservation'} 
                    onValueChange={v => {
                      setNewReservation(f => ({ 
                        ...f, 
                        reservationStatus: v,
                        // Reset fields based on selection
                        ...(v === 'reservation' ? {
                          billingCycle: '-',
                          billingType: '-', 
                          billingRate: '-'
                        } : {
                          reservationRate: '-',
                          reservationQty: '-',
                          reservationStart: '-',
                          reservationEnd: '-'
                        })
                      }));
                    }}
                    required
                  >
                    <SelectTrigger className="border-orange-300 focus:border-orange-500">
                      <SelectValue placeholder="Select reservation status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reservation">Reservation</SelectItem>
                      <SelectItem value="post-reservation">Post-reservation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Conditional Fields Based on Reservation Status */}
              {newReservation.reservationStatus === 'reservation' && (
                <>
                  {/* Reservation Details */}
                  <div className="space-y-4 border border-blue-200 rounded-lg p-4 bg-blue-50">
                    <h3 className="text-blue-800 font-semibold text-lg">📋 Reservation Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-green-600 font-medium">Reservation Rate (Rs/MT) <span className="text-red-500">*</span></Label>
                        <Input
                          type="number"
                          min="0"
                          value={newReservation.reservationRate}
                          onChange={e => setNewReservation(f => ({ ...f, reservationRate: e.target.value }))}
                          className="border-orange-300 focus:border-orange-500"
                          placeholder="Enter rate"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-green-600 font-medium">Reservation Quantity (MT) <span className="text-red-500">*</span></Label>
                        <Input
                          type="number"
                          min="0"
                          value={newReservation.reservationQty}
                          onChange={e => setNewReservation(f => ({ ...f, reservationQty: e.target.value }))}
                          className="border-orange-300 focus:border-orange-500"
                          placeholder="Enter quantity"
                          required
                        />
                      </div>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-green-600 font-medium">Reservation Start Date <span className="text-red-500">*</span></Label>
                        <Input
                          type="date"
                          value={newReservation.reservationStart}
                          onChange={e => setNewReservation(f => ({ ...f, reservationStart: e.target.value }))}
                          className="border-orange-300 focus:border-orange-500"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-green-600 font-medium">Reservation End Date <span className="text-red-500">*</span></Label>
                        <Input
                          type="date"
                          value={newReservation.reservationEnd}
                          onChange={e => setNewReservation(f => ({ ...f, reservationEnd: e.target.value }))}
                          className="border-orange-300 focus:border-orange-500"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {newReservation.reservationStatus === 'post-reservation' && (
                <>
                  {/* Billing Details */}
                  <div className="space-y-4 border border-green-200 rounded-lg p-4 bg-green-50">
                    <h3 className="text-green-800 font-semibold text-lg">💰 Billing Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-green-600 font-medium">Billing Cycle <span className="text-red-500">*</span></Label>
                        <Select 
                          value={newReservation.billingCycle} 
                          onValueChange={v => setNewReservation(f => ({ ...f, billingCycle: v }))} 
                          required
                        >
                          <SelectTrigger className="border-orange-300 focus:border-orange-500">
                            <SelectValue placeholder="Select billing cycle" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Daily">Daily</SelectItem>
                            <SelectItem value="Weekly">Weekly</SelectItem>
                            <SelectItem value="Fortnightly">Fortnightly</SelectItem>
                            <SelectItem value="Monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-green-600 font-medium">Billing Type <span className="text-red-500">*</span></Label>
                        <Select 
                          value={newReservation.billingType} 
                          onValueChange={v => setNewReservation(f => ({ ...f, billingType: v }))} 
                          required
                        >
                          <SelectTrigger className="border-orange-300 focus:border-orange-500">
                            <SelectValue placeholder="Select billing type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Big bag">Big bag</SelectItem>
                            <SelectItem value="Small bag">Small bag</SelectItem>
                            <SelectItem value="Qty">Qty</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-green-600 font-medium">Billing Rate (Rs/MT) <span className="text-red-500">*</span></Label>
                        <Input
                          type="number"
                          min="0"
                          value={newReservation.billingRate}
                          onChange={e => setNewReservation(f => ({ ...f, billingRate: e.target.value }))}
                          className="border-orange-300 focus:border-orange-500"
                          placeholder="Enter billing rate"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Billing Status */}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                 
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end space-x-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddReservationDialog(false)}
                  className="border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-green-500 hover:bg-green-600 text-white px-8 py-2 shadow-lg"
                >
                  ✅ Add Reservation
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Alert Modal - Extend Reservation (Red Siren) */}
        <Dialog open={alertModal.open && alertModal.type === 'alert'} onOpenChange={isOpen => setAlertModal({ open: isOpen, type: 'alert', row: alertModal.row })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-600">🚨 Extend Reservation</DialogTitle>
              <DialogDescription>This reservation expires in less than 5 days. Extend the end date.</DialogDescription>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); handleExtendReservation(); }}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Current End Date: <span className="text-red-600 font-semibold">{alertModal.row?.reservationEnd}</span></Label>
                </div>
                <div className="space-y-2">
                  <Label>New Reservation End Date <span className="text-red-500">*</span></Label>
                  <Input 
                    type="date" 
                    value={extendReservationForm.reservationEnd} 
                    onChange={e => setExtendReservationForm(f => ({ ...f, reservationEnd: e.target.value }))} 
                    min={new Date().toISOString().split('T')[0]}
                    required 
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAlertModal({ open: false, type: 'alert', row: null })}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-red-500 hover:bg-red-600 text-white">
                  🔄 Extend Reservation
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Update Modal - Update Billing (Blue Siren) */}
        <Dialog open={alertModal.open && alertModal.type === 'update'} onOpenChange={isOpen => setAlertModal({ open: isOpen, type: 'update', row: alertModal.row })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-blue-600">💙 Update Billing Details</DialogTitle>
              <DialogDescription>This reservation has expired. Update billing details and set status to complete.</DialogDescription>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); handleUpdateBilling(); }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label>Current End Date: <span className="text-blue-600 font-semibold">{alertModal.row?.reservationEnd}</span></Label>
                  <p className="text-sm text-gray-600">Reservation has expired and needs billing update</p>
                </div>
                <div className="space-y-2">
                  <Label>Billing Cycle <span className="text-red-500">*</span></Label>
                  <Select value={updateBillingForm.billingCycle} onValueChange={v => setUpdateBillingForm(f => ({ ...f, billingCycle: v }))} required>
                    <SelectTrigger><SelectValue placeholder="Select billing cycle" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Daily">Daily</SelectItem>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                      <SelectItem value="Fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Billing Type <span className="text-red-500">*</span></Label>
                  <Select value={updateBillingForm.billingType} onValueChange={v => setUpdateBillingForm(f => ({ ...f, billingType: v }))} required>
                    <SelectTrigger><SelectValue placeholder="Select billing type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Big bag">Big bag</SelectItem>
                      <SelectItem value="Small bag">Small bag</SelectItem>
                      <SelectItem value="Qty">Qty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Billing Rate (Rs/MT) <span className="text-red-500">*</span></Label>
                  <Input 
                    type="number" 
                    min="0" 
                    value={updateBillingForm.billingRate} 
                    onChange={e => setUpdateBillingForm(f => ({ ...f, billingRate: e.target.value }))} 
                    placeholder="Enter billing rate"
                    required 
                  />
                </div>
                
                <div className="md:col-span-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> After updating, the following will be set to "-":
                    <br />• Reservation Rate • Reservation Qty • Reservation Start • Reservation End
                    <br />• Billing Status will be set to "complete"
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAlertModal({ open: false, type: 'update', row: null })}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white">
                  ✅ Update & Complete
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {showCustomError && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-lg shadow-lg z-[9999]">
            <p className="text-red-600">Billing Cycle and Billing Type cannot be the same as the previous entry.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
