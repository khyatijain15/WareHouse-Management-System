'use client';

import DashboardLayout from '@/components/dashboard-layout';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleAccess } from '@/hooks/use-role-access';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Download, Plus, AlertTriangle, PlusCircle, Eye, Edit3 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';

import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, addDoc, doc, updateDoc } from 'firebase/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';
import PrintableOutwardReceipt from '@/components/PrintableOutwardReceipt';

// Helper function to normalize status text for display
const normalizeStatusText = (status: string) => {
  const normalizedStatus = status?.toLowerCase().trim() || '';
  
  // Approved status
  if (normalizedStatus === 'approved' || normalizedStatus === 'approve') {
    return 'Approved';
  }
  
  // Rejected status
  if (normalizedStatus === 'rejected' || normalizedStatus === 'reject') {
    return 'Rejected';
  }
  
  // Resubmitted status  
  if (normalizedStatus === 'resubmitted' || normalizedStatus === 'resubmit') {
    return 'Resubmitted';
  }
  
  // Pending status (keep as "Pending" - not past tense)
  if (normalizedStatus === 'pending') {
    return 'Pending';
  }
  
  // Default - capitalize first letter for any other status
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

// Helper function to get status styling
const getStatusStyling = (status: string) => {
  const normalizedStatus = status?.toLowerCase().trim() || '';
  
  // Pending/inactive/closed - yellow background, black font
  if (normalizedStatus === 'pending' || normalizedStatus === 'inactive' || normalizedStatus === 'closed') {
    return 'bg-yellow-100 text-black px-2 py-1 rounded-full text-xs font-medium inline-block';
  }
  
  // Approve/activate/reactive - light green background, dark green font
  if (normalizedStatus === 'approved' || normalizedStatus === 'activate' || normalizedStatus === 'reactivate' || 
      normalizedStatus === 'approve' || normalizedStatus === 'reactive') {
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

// Helpers to sort by outward code (ascending)
const extractOutwardNumber = (code?: string) => {
  if (!code) return Number.POSITIVE_INFINITY; // place empty/invalid codes at the end
  const match = code.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
};

const compareOutwardCodeAsc = (a: any, b: any) => {
  const na = extractOutwardNumber(a?.outwardCode);
  const nb = extractOutwardNumber(b?.outwardCode);
  if (na !== nb) return na - nb;
  return (a?.outwardCode || '').localeCompare(b?.outwardCode || '');
};

export default function OutwardPage() {
  const { user } = useAuth();
  const userRole = user?.role || 'user';
  const router = useRouter();
  const {
    canCreateOutward,
    canApproveOutward,
    canRejectOutward,
    canResubmitOutward,
    canViewOutwardPDF,
    showOutwardActionButtons,
    canEditOutwardRemark
  } = useRoleAccess();
  
  // State variables
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [doOptions, setDoOptions] = React.useState<any[]>([]);
  const [doSearch, setDoSearch] = React.useState('');
  const [selectedDO, setSelectedDO] = React.useState<any>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  
  // Form fields
  const [outwardBags, setOutwardBags] = React.useState(''); // READ-ONLY: AUTO-CALCULATED sum of all vehicle entries' Total Bags Outward
  const [outwardQty, setOutwardQty] = React.useState(''); // INPUT: Single quantity field for entire outward (filled once at end)
  const [vehicleNumber, setVehicleNumber] = React.useState('');
  const [gatepass, setGatepass] = React.useState('');
  const [weighbridgeName, setWeighbridgeName] = React.useState('');
  const [weighbridgeSlipNo, setWeighbridgeSlipNo] = React.useState('');
  const [grossWeight, setGrossWeight] = React.useState('');
  const [tareWeight, setTareWeight] = React.useState('');
  const [netWeight, setNetWeight] = React.useState('');
  const [totalBagsOutward, setTotalBagsOutward] = React.useState(''); // INPUT: Target bags for current vehicle entry (per vehicle)
  const [stackEntries, setStackEntries] = React.useState<any[]>([]);
  const [fileAttachments, setFileAttachments] = React.useState<File[]>([]);
  // Track vehicle entries added in this session (not yet submitted)
  const [vehicleEntries, setVehicleEntries] = React.useState<any[]>([]);
  
  // Status variables
  const [isUploading, setIsUploading] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);
  const [outwardEntries, setOutwardEntries] = React.useState<any[]>([]);
  const [continuousEntry, setContinuousEntry] = React.useState(false);
  const [currentBalanceBags, setCurrentBalanceBags] = React.useState<number | null>(null);
  const [currentBalanceQty, setCurrentBalanceQty] = React.useState<number | null>(null);
  
  // Outward data
  const [showOutwardDetails, setShowOutwardDetails] = React.useState(false);
  const [selectedOutward, setSelectedOutward] = React.useState<any>(null);
  const [remark, setRemark] = React.useState('');
  const [outwardStatusUpdating, setOutwardStatusUpdating] = React.useState(false);
  // Edit mode state
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editingOutward, setEditingOutward] = React.useState<any>(null);
  const [existingAttachmentUrls, setExistingAttachmentUrls] = React.useState<string[]>([]);
  // Additional fields and pagination
  const [warehouseType, setWarehouseType] = React.useState('');
  const [typeOfBusiness, setTypeOfBusiness] = React.useState('');
  const [commodityName, setCommodityName] = React.useState('');
  const [varietyName, setVarietyName] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 10;
  
  // Calculate net weight automatically when gross weight or tare weight changes
  React.useEffect(() => {
    const gross = parseFloat(grossWeight) || 0;
    const tare = parseFloat(tareWeight) || 0;
    const calculated = gross - tare;
    setNetWeight(calculated > 0 ? calculated.toFixed(3) : '0.000');
  }, [grossWeight, tareWeight]);
  
  // Input validation functions
  const handleGrossWeightChange = (value: string) => {
    // Allow only numbers and decimal point, max 3 decimal places
    const regex = /^\d*\.?\d{0,3}$/;
    if (regex.test(value) || value === '') {
      setGrossWeight(value);
    }
  };

  const handleTareWeightChange = (value: string) => {
    // Allow only numbers and decimal point, max 3 decimal places
    const regex = /^\d*\.?\d{0,3}$/;
    if (regex.test(value) || value === '') {
      setTareWeight(value);
    }
  };

  const handleTotalBagsOutwardChange = (value: string) => {
    // Allow only integers
    const regex = /^\d*$/;
    if (regex.test(value) || value === '') {
      setTotalBagsOutward(value);
    }
  };
  
  // Inward entry data for reference
  const [selectedInwardEntry, setSelectedInwardEntry] = React.useState<any>(null);
  
  // Fetch all outward entries for the table
  React.useEffect(() => {
    const fetchOutwards = async () => {
      const outwardCol = collection(db, 'outwards');
      const snap = await getDocs(outwardCol);
      let data = snap.docs.map((doc, idx) => {
        const d = doc.data();
        // Ensure outwardCode and outwardStatus
        return {
          id: doc.id,
          ...d,
          outwardCode: d.outwardCode || `OUT-${String(idx + 1).padStart(4, '0')}`,
          outwardStatus: d.outwardStatus || 'pending',
        };
      });
      // Sort by outwardCode ascending
      data.sort(compareOutwardCodeAsc);
      setOutwardEntries(data);
    };
    fetchOutwards();
  }, [submitSuccess, outwardStatusUpdating]);
  
  // Fetch DOs for the dropdown
  React.useEffect(() => {
    const fetchDOs = async () => {
      try {
        // Fetch approved DOs
        const doCol = collection(db, 'deliveryOrders');
        const doQ = query(doCol, where('doStatus', '==', 'approved'));
        const doSnap = await getDocs(doQ);
        
        // Fetch all existing outwards to check balances
        const outwardCol = collection(db, 'outwards');
        const outwardSnap = await getDocs(outwardCol);
        const allOutwards = outwardSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Group outwards by DO code for balance calculation
        const outwardsByDO: Record<string, any[]> = {};
        
        // Loop through each outward and group by DO code
        allOutwards.forEach((outwardItem: any) => {
          const doCode = outwardItem.doCode;
          if (doCode) {
            if (!outwardsByDO[doCode]) {
              outwardsByDO[doCode] = [];
            }
            outwardsByDO[doCode].push(outwardItem);
          }
        });
        
        // Calculate balances for DOs taking into account existing outwards
        const doData: any[] = doSnap.docs.map(doc => {
          const docData = doc.data() as any;
          const doData = { 
            id: doc.id, 
            ...docData
          };
          
          // Calculate remaining balance by checking existing outwards
          const doCode = doData.doCode as string | undefined;
          const existingOutwards = doCode ? (outwardsByDO[doCode] || []) : [];
          
          // Start with DO bags and quantity
          let balanceBags = Number(doData.doBags || 0);
          let balanceQuantity = Number(doData.doQuantity || 0);
          
          // Subtract outward quantities from each existing outward - BUT ONLY APPROVED OUTWARDS
          if (existingOutwards.length > 0) {
            console.log(`Found ${existingOutwards.length} existing outwards for ${doCode}`);
            
            existingOutwards.forEach((outwardItem: any) => {
              const outwardStatus = (outwardItem.outwardStatus || 'pending').toLowerCase();
              // Subtract quantities from pending and approved outwards
              // Only rejected and resubmitted outwards should not affect available balance
              if (outwardStatus === 'pending' || outwardStatus === 'approved' || outwardStatus === 'approve') {
                const outwardBags = Number(outwardItem.outwardBags || 0);
                const outwardQty = Number(outwardItem.outwardQuantity || 0);
                
                console.log(`Subtracting outward ${outwardItem.outwardCode} (${outwardStatus}): ${outwardBags} bags, ${outwardQty} quantity`);
                
                balanceBags -= outwardBags;
                balanceQuantity -= outwardQty;
              } else {
                console.log(`Skipping rejected/resubmitted outward ${outwardItem.outwardCode} (status: ${outwardStatus})`);
              }
            });
          }
          
          // Ensure balance doesn't go below zero
          balanceBags = Math.max(0, balanceBags);
          balanceQuantity = Math.max(0, balanceQuantity);
          
          console.log(`DO ${doCode}: Final balance ${balanceBags} bags, ${balanceQuantity.toFixed(2)} quantity`);
          
          // Add calculated balances to DO data
          return {
            ...doData,
            balanceBags,
            balanceQuantity
          };
        })
        // Filter out DOs with zero balance
        .filter(doItem => doItem.balanceBags > 0);
        
        console.log(`Found ${doData.length} DOs with positive balance`);
        setDoOptions(doData);
        
      } catch (error) {
        console.error("Error fetching DOs:", error);
      }
    };
    
    fetchDOs();
  }, [submitSuccess, outwardStatusUpdating]);

  // Listen for DO data updates from other modules to refresh options
  React.useEffect(() => {
    const handleDODataUpdate = () => {
      console.log('Outward section: Detected DO data update, refreshing DO options...');
      // Trigger options refresh by updating a local state
      setSubmitSuccess(prev => !prev);
    };

    window.addEventListener('doDataUpdated', handleDODataUpdate);
    
    return () => {
      window.removeEventListener('doDataUpdated', handleDODataUpdate);
    };
  }, []);

  // Clear SR/WR search filter whenever Add Outward dialog opens or closes
  React.useEffect(() => {
    setDoSearch('');
  }, [showAddModal]);

  // Helper to get balance from DO bags/quantity
  const getBalanceBags = (row: any) => {
    if (typeof row.balanceBags === 'number') return row.balanceBags;
    if (row.balanceBags && !isNaN(Number(row.balanceBags))) return Number(row.balanceBags);
    if (typeof row.doBags === 'number' && typeof row.outwardBags === 'number') {
      return row.doBags - row.outwardBags;
    }
    return '';
  };
  
  const getBalanceQty = (row: any) => {
    if (typeof row.balanceQuantity === 'number') return row.balanceQuantity;
    if (row.balanceQuantity && !isNaN(Number(row.balanceQuantity))) return Number(row.balanceQuantity);
    if (typeof row.doQuantity === 'number' && typeof row.outwardQuantity === 'number') {
      return row.doQuantity - row.outwardQuantity;
    }
    return '';
  };
  
  // Helper function to calculate cumulative total bags from all vehicle entries
  const calculateCumulativeBags = React.useCallback(() => {
    const totalBags = vehicleEntries.reduce((sum, entry) => sum + (Number(entry.totalBagsOutward) || 0), 0);
    setOutwardBags(totalBags.toString());
    console.log(`Cumulative Outward Bags: ${totalBags}`);
  }, [vehicleEntries]);
  
  // Update cumulative bags whenever vehicle entries change
  React.useEffect(() => {
    calculateCumulativeBags();
  }, [calculateCumulativeBags]);

  // Add vehicle entry (similar to inward's add entry logic)
  const handleAddVehicleEntry = React.useCallback(async () => {
    setFormError(null);

    // Validate total bags outward (target for this vehicle)
    const targetBags = Number(totalBagsOutward);
    if (isNaN(targetBags) || targetBags <= 0) {
      setFormError('Please enter valid Total Bags Outward for this vehicle');
      return;
    }
    
    if (!Number.isInteger(targetBags)) {
      setFormError('Total Bags Outward must be a whole number');
      return;
    }

    // Validate stack entries sum equals target
    const totalStackBags = stackEntries.reduce((sum, stack) => sum + Number(stack.bags || 0), 0);
    
    for (let i = 0; i < stackEntries.length; i++) {
      const stackBags = Number(stackEntries[i].bags || 0);
      if (!Number.isInteger(stackBags)) {
        setFormError(`Stack ${i + 1} bags must be a whole number`);
        return;
      }
    }
    
    if (totalStackBags !== targetBags) {
      setFormError(`Sum of stack bags (${totalStackBags}) must equal Total Bags Outward (${targetBags})`);
      return;
    }

    // Vehicle fields and attachments are optional - user can add entry with or without them

    try {
      setIsUploading(true);
      
      // Upload attachments for this vehicle entry
      let attachmentUrls: string[] = [];
      if (fileAttachments.length > 0) {
        for (const file of fileAttachments) {
          try {
            const result = await uploadToCloudinary(file);
            if (result && result.secure_url) {
              attachmentUrls.push(result.secure_url);
            }
          } catch (uploadError) {
            console.error('Error uploading file:', uploadError);
          }
        }
      }

      // Create vehicle entry object (WITHOUT outwardQuantity - that's filled at document level)
      const vehicleEntry = {
        entryNumber: vehicleEntries.length + 1,
        vehicleNumber,
        gatepass,
        weighbridgeName,
        weighbridgeSlipNo,
        grossWeight: parseFloat(grossWeight) || 0,
        tareWeight: parseFloat(tareWeight) || 0,
        netWeight: parseFloat(netWeight) || 0,
        totalBagsOutward: targetBags,
        stackEntries: stackEntries.map(stack => ({
          stackNo: stack.stackNo,
          bags: Number(stack.bags),
          commodityName: stack.commodityName,
          varietyName: stack.varietyName
        })),
        attachmentUrls,
        remark: remark || ''
      };

      // Add to vehicle entries list
      setVehicleEntries(prev => [...prev, vehicleEntry]);

      // Update stack balances for next entry
      const updatedStacks = stackEntries.map((stack: any) => {
        const usedBags = Number(stack.bags || 0);
        const currentAvailable = Number(stack.inwardBags || 0);
        const newAvailable = Math.max(0, currentAvailable - usedBags);
        
        return {
          stackNo: stack.stackNo,
          bags: '', // Reset for next entry
          inwardBags: newAvailable, // Updated available
          balanceBags: newAvailable,
          commodityName: stack.commodityName,
          varietyName: stack.varietyName
        };
      });
      setStackEntries(updatedStacks);

      // Update DO balance for next entry (only bags, not quantity yet)
      const newBalanceBags = (currentBalanceBags || 0) - targetBags;
      setCurrentBalanceBags(newBalanceBags);

      // Reset vehicle-specific fields for next entry
      setTotalBagsOutward('');
      setVehicleNumber('');
      setGatepass('');
      setWeighbridgeName('');
      setWeighbridgeSlipNo('');
      setGrossWeight('');
      setTareWeight('');
      setNetWeight('');
      setFileAttachments([]);
      setRemark('');

      setIsUploading(false);
      alert(`✅ Vehicle entry ${vehicleEntry.entryNumber} added! Remaining balance: ${newBalanceBags} bags`);
      
    } catch (error: any) {
      console.error('Error adding vehicle entry:', error);
      setFormError(`Error: ${error?.message || 'Unknown error'}`);
      setIsUploading(false);
    }
  }, [
    totalBagsOutward, stackEntries, vehicleNumber, gatepass, 
    weighbridgeName, weighbridgeSlipNo, grossWeight, tareWeight, netWeight,
    fileAttachments, remark, vehicleEntries, currentBalanceBags
  ]);

  // Centralized submit handler - creates ONE outward document with multiple vehicle entries
  const handleOutwardSubmit = React.useCallback(async () => {
    setFormError(null);

    if (!selectedDO && !isEditMode) {
      setFormError('Please select a DO');
      return;
    }

    // For new outward: Must have at least one vehicle entry
    if (!isEditMode && vehicleEntries.length === 0) {
      setFormError('Please add at least one vehicle entry before submitting');
      return;
    }

    // Validate outward quantity (filled once for entire outward)
    const oQuantity = Number(outwardQty);
    if (isNaN(oQuantity) || oQuantity <= 0) {
      setFormError('Please enter valid Outward Quantity (MT)');
      return;
    }

    // Get cumulative bags from all vehicle entries
    const obBags = Number(outwardBags); // Auto-calculated from vehicle entries
  const balanceQty = currentBalanceQty || 0;

    if (balanceQty <= 0) {
      setFormError('No remaining balance quantity available for this Delivery Order');
      return;
    }
    
    if (oQuantity > balanceQty) {
      setFormError(`Cannot release more than available balance quantity (${balanceQty.toFixed(3)} MT)`);
      return;
    }

    try {
      setIsUploading(true);

      // Get next outward code number
      const outwardCol = collection(db, 'outwards');
      const outwardSnap = await getDocs(outwardCol);
      const outwardCount = outwardSnap.size;
      const newOutwardCode = `OUT-${String(outwardCount + 1).padStart(4, '0')}`;

      // Combine all stack entries from all vehicle entries
      const allStackEntries = vehicleEntries.flatMap(entry => entry.stackEntries);
      
      // Calculate final balance
      // Note: currentBalanceBags is ALREADY updated after each vehicle entry, so just use it directly!
      // Quantity is deducted now at final submit (not per vehicle)
      const finalBalanceBags = currentBalanceBags || 0;
      const finalBalanceQty = (currentBalanceQty || 0) - oQuantity;

      if (isEditMode && editingOutward) {
        // Update existing outward document (edit mode)
        const updatedData = {
          // Keep the same outwardCode and identifiers
          outwardCode: editingOutward.outwardCode,
          srwrNo: editingOutward.srwrNo,
          doCode: editingOutward.doCode,
          cadNumber: editingOutward.cadNumber,
          state: editingOutward.state,
          branch: editingOutward.branch,
          location: editingOutward.location,
          warehouseName: editingOutward.warehouseName,
          warehouseCode: editingOutward.warehouseCode,
          warehouseAddress: editingOutward.warehouseAddress,
          client: editingOutward.client,
          clientCode: editingOutward.clientCode,
          clientAddress: editingOutward.clientAddress,
          // Keep existing or use updated values for new fields
          warehouseType: editingOutward.warehouseType || warehouseType,
          typeOfBusiness: editingOutward.typeOfBusiness || typeOfBusiness,
          commodity: editingOutward.commodity || commodityName,
          variety: editingOutward.variety || varietyName,
          // Inward data (keep existing)
          inwardBags: editingOutward.inwardBags,
          inwardQuantity: editingOutward.inwardQuantity,
          // DO data (unchanged in edit mode)
          doBags: editingOutward.doBags,
          doQuantity: editingOutward.doQuantity,
          // Outward specific data - cumulative from all vehicle entries
          outwardBags: obBags,
          outwardQuantity: oQuantity,
          // Array of vehicle entries
          outwardEntries: vehicleEntries,
          // Combined stack entries from all vehicles
          stackEntries: allStackEntries,
          // Updated balances
          balanceBags: finalBalanceBags,
          balanceQuantity: finalBalanceQty,
          remark,
          // Keep status as resubmitted for review
          outwardStatus: 'resubmitted',
          updatedAt: new Date().toISOString(),
          updatedBy: userRole
        } as any;

        const outwardRef = doc(db, 'outwards', editingOutward.id);
        await updateDoc(outwardRef, updatedData);
        
        alert('✅ Outward updated successfully!');
      } else {
        // Create new outward document with all vehicle entries
        const outwardData = {
          outwardCode: newOutwardCode,
          srwrNo: selectedDO.srwrNo,
          doCode: selectedDO.doCode,
          cadNumber: selectedDO.cadNumber,
          state: selectedDO.state,
          branch: selectedDO.branch,
          location: selectedDO.location,
          warehouseName: selectedDO.warehouseName,
          warehouseCode: selectedDO.warehouseCode,
          warehouseAddress: selectedDO.warehouseAddress,
          client: selectedDO.client,
          clientCode: selectedDO.clientCode,
          clientAddress: selectedDO.clientAddress,
          // New fields from inward and warehouse inspection
          warehouseType: warehouseType,
          typeOfBusiness: typeOfBusiness,
          commodity: commodityName,
          variety: varietyName,
          // Inward data for reference
          inwardBags: selectedDO.totalBags,
          inwardQuantity: selectedDO.totalQuantity,
          // DO data
          doBags: selectedDO.doBags,
          doQuantity: selectedDO.doQuantity,
          // Outward specific data - cumulative from all vehicle entries
          outwardBags: obBags,
          outwardQuantity: oQuantity,
          // Array of vehicle entries (each vehicle's details)
          outwardEntries: vehicleEntries,
          // Combined stack entries from all vehicles
          stackEntries: allStackEntries,
          // Final balance after all vehicles
          balanceBags: finalBalanceBags,
          balanceQuantity: finalBalanceQty,
          remark,
          outwardStatus: 'pending',
          createdAt: new Date().toISOString(),
          createdBy: userRole
        } as any;

        await addDoc(collection(db, 'outwards'), outwardData);
        
        alert(`✅ Outward created successfully with ${vehicleEntries.length} vehicle(s)!`);
      }

      // Update list and close modal
      setSubmitSuccess(true);
      setIsUploading(false);
      
      // Close modal and reset all state
      setShowAddModal(false);
      setSelectedDO(null);
      setOutwardBags('');
      setOutwardQty('');
      setVehicleNumber('');
      setGatepass('');
      setWeighbridgeName('');
      setWeighbridgeSlipNo('');
      setGrossWeight('');
      setTareWeight('');
      setNetWeight('');
      setTotalBagsOutward('');
      setStackEntries([]);
      setFileAttachments([]);
      setExistingAttachmentUrls([]);
      setRemark('');
      setVehicleEntries([]); // Clear vehicle entries
      setWarehouseType('');
      setTypeOfBusiness('');
      setCommodityName('');
      setVarietyName('');
      setIsEditMode(false);
      setEditingOutward(null);
      setCurrentBalanceBags(0);
      setCurrentBalanceQty(0);

      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error submitting outward:', error);
      setFormError(`An error occurred: ${error?.message || 'Unknown error'}. Please try again.`);
      setIsUploading(false);
    }
  }, [selectedDO, isEditMode, editingOutward, vehicleEntries, outwardBags, outwardQty, currentBalanceBags, currentBalanceQty, remark, userRole, warehouseType, typeOfBusiness, commodityName, varietyName, totalBagsOutward, vehicleNumber, gatepass, weighbridgeName, weighbridgeSlipNo]);

  // Note: addNewOutwardEntry removed - now using handleAddVehicleEntry for multiple vehicles

  // Group outward entries by srwrNo, show only latest per group
  const [expandedRows, setExpandedRows] = React.useState<{ [key: string]: boolean }>({});
  const groupedOutwards: { [key: string]: any[] } = {};
  outwardEntries.forEach(outward => {
    if (!groupedOutwards[outward.srwrNo]) groupedOutwards[outward.srwrNo] = [];
    groupedOutwards[outward.srwrNo].push(outward);
  });
  // Sort each group by createdAt descending
  Object.values(groupedOutwards).forEach(group => group.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
  // Only show latest per group in main table
  const latestOutwards = Object.values(groupedOutwards).map(group => group[0]);
  // Ensure table uses ascending Outward Code order
  const latestOutwardsSorted = React.useMemo(() => {
    return [...latestOutwards].sort(compareOutwardCodeAsc);
  }, [latestOutwards]);
  
  // Filter outward entries based on search term
  // CSV Export function
  const exportToCSV = () => {
    // Determine which data to export based on search state
    const baseData = searchTerm.trim() ? filteredOutwards : latestOutwardsSorted;
    const dataToExport = [...baseData].sort(compareOutwardCodeAsc);
    
    if (dataToExport.length === 0) {
      alert('No data to export');
      return;
    }

    // Define CSV headers as requested
    const headers = [
      'Outward Code',
      'SR/WR Receipt Number',
      'Base Receipt',
      'DO Code',
      'CAD Number',
      'State',
      'Branch',
      'Location',
      'Warehouse Name',
      'Warehouse Code',
      'Warehouse Address',
      'Client Name',
      'Client Code',
      'Client Address',
      'Warehouse Type',
      'Type of Business',
      'Commodity',
      'Variety',
      'Inward Bags',
      'Inward Quantity (MT)',
      'DO Bags',
      'DO Quantity (MT)',
      'Outward Bags',
      'Outward Quantity (MT)',
      'Vehicle Number',
      'Gatepass Number',
      'Weighbridge Name',
      'Weighbridge Slip Number',
      'Gross Weight (MT)',
      'Tare Weight (MT)',
      'Net Weight (MT)',
      'Total Outward Bags',
      'Stack Details',
      'Remarks',
      'Status'
    ];

    // Convert data to CSV format (one row per vehicle entry)
    const csvData = dataToExport.flatMap(outward => {
      // Check if we have vehicle entries (outwardEntries)
      const vehicleEntries = Array.isArray(outward.outwardEntries) && outward.outwardEntries.length > 0
        ? outward.outwardEntries
        : [null]; // If no vehicle entries, create one row with main data
      
      return vehicleEntries.map((vehicleEntry: any) => {
        // Format stack details as "stack-value" for each vehicle entry
        let stackDetails = '';
        if (vehicleEntry && Array.isArray(vehicleEntry.stackEntries) && vehicleEntry.stackEntries.length > 0) {
          stackDetails = vehicleEntry.stackEntries
            .map((stack: any) => `${stack.stackNo || ''}-${stack.bags || 0}`)
            .join('; ');
        }
        
        return [
          outward.outwardCode || '',
          outward.srwrNo || '',
          outward.baseReceiptNo || outward.bankReceipt || '-',
          outward.doCode || '',
          outward.cadNumber || '',
          outward.state || '',
          outward.branch || '',
          outward.location || '',
          outward.warehouseName || '',
          outward.warehouseCode || '',
          outward.warehouseAddress || '',
          outward.client || '',
          outward.clientCode || '',
          outward.clientAddress || '',
          outward.warehouseType || outward.typeOfWarehouse || '',
          outward.typeOfBusiness || outward.businessType || '',
          outward.commodity || outward.commodityName || '',
          outward.variety || outward.varietyName || '',
          outward.inwardBags || outward.totalBags || '',
          outward.inwardQuantity || outward.totalQuantity || '',
          outward.doBags || '',
          outward.doQuantity || '',
          outward.outwardBags || '',
          outward.outwardQuantity || '',
          // Vehicle-specific data from vehicleEntry
          vehicleEntry?.vehicleNumber || outward.vehicleNumber || '',
          vehicleEntry?.gatepass || outward.gatepass || '',
          vehicleEntry?.weighbridgeName || outward.weighbridgeName || '',
          vehicleEntry?.weighbridgeSlipNo || outward.weighbridgeSlipNo || '',
          vehicleEntry?.grossWeight || outward.grossWeight || '',
          vehicleEntry?.tareWeight || outward.tareWeight || '',
          vehicleEntry?.netWeight || outward.netWeight || '',
          vehicleEntry?.totalBagsOutward || outward.totalBagsOutward || '',
          // Stack details formatted as "stack-value"
          stackDetails,
          vehicleEntry?.remark || outward.remark || '',
          normalizeStatusText(outward.outwardStatus || 'pending'),
        ];
      });
    });

    // Combine headers and data
    const csvContent = [headers, ...csvData]
      .map((row: any[]) => row.map((field: any) => {
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        const stringField = String(field);
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
          return `"${stringField.replace(/"/g, '""')}"`;
        }
        return stringField;
      }).join(','))
      .join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // Generate filename with search indicator
    const searchSuffix = searchTerm.trim() ? '-filtered' : '';
    const filename = `outward-entries${searchSuffix}-${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredOutwards = React.useMemo(() => {
    if (!searchTerm) return latestOutwardsSorted;
    
    const searchLower = searchTerm.toLowerCase();
    return latestOutwardsSorted.filter(outward => {
      const outwardCode = (outward.outwardCode || '').toLowerCase();
      const srwrNo = (outward.srwrNo || '').toLowerCase();
      const state = (outward.state || '').toLowerCase();
      const branch = (outward.branch || '').toLowerCase();
      const location = (outward.location || '').toLowerCase();
      const warehouseName = (outward.warehouseName || '').toLowerCase();
      const warehouseCode = (outward.warehouseCode || '').toLowerCase();
      const clientName = (outward.client || '').toLowerCase();
      
      return outwardCode.includes(searchLower) ||
             srwrNo.includes(searchLower) ||
             state.includes(searchLower) ||
             branch.includes(searchLower) ||
             location.includes(searchLower) ||
             warehouseName.includes(searchLower) ||
             warehouseCode.includes(searchLower) ||
             clientName.includes(searchLower);
    });
  }, [searchTerm, latestOutwardsSorted]);

  // Calculate paginated data
  const paginatedOutwards = React.useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredOutwards.slice(startIndex, endIndex);
  }, [filteredOutwards, currentPage, pageSize]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);
  
  // Filter DO options based on search input
  const filteredDOOptions = React.useMemo(() => {
    if (!doSearch) return doOptions;
    
    const searchLower = doSearch.toLowerCase();
    return doOptions.filter(option => {
      const srwrNo = (option.srwrNo || '').toLowerCase();
      const doCode = (option.doCode || '').toLowerCase();
      const client = (option.client || '').toLowerCase();
      const warehouseName = (option.warehouseName || '').toLowerCase();
      
      return srwrNo.includes(searchLower) || 
             doCode.includes(searchLower) || 
             client.includes(searchLower) || 
             warehouseName.includes(searchLower);
    });
  }, [doSearch, doOptions]);

  // Group DO options by SR/WR so the selector shows SR/WR headers with their DOs
  const groupedDOOptions = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredDOOptions.forEach(opt => {
      const key = opt.srwrNo || 'Unknown SR/WR';
      if (!groups[key]) groups[key] = [];
      groups[key].push(opt);
    });
    return Object.entries(groups).map(([srwrNo, items]) => ({ srwrNo, items }));
  }, [filteredDOOptions]);
  
  return (
    <DashboardLayout>
      <div className="p-3 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-4 lg:mb-6 gap-4">
          <Button 
            onClick={() => router.push('/dashboard')} 
            variant="ghost" 
            className="flex items-center justify-center bg-orange-500 text-white hover:bg-orange-600 w-full lg:w-auto px-4 py-3"
          >
            ← Dashboard
          </Button>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-600 text-center order-first lg:order-none">Outward Module</h1>
          {canCreateOutward() && (
            <Button 
              onClick={() => setShowAddModal(true)} 
              className="bg-green-500 hover:bg-green-600 text-white w-full lg:w-auto px-4 py-3"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Outward
            </Button>
          )}
        </div>

        {/* Search and Export */}
        <div className="bg-orange-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 border border-orange-200">
          <div className="text-base sm:text-lg font-semibold text-orange-600 mb-3">Search & Export Options</div>
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
              <span className="text-gray-600 text-sm sm:text-base whitespace-nowrap">Search:</span>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Search by Outward Code, SR/WR No, State, Branch, Location..."
                  className="pl-8 pr-8 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button 
                    type="button" 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                    title="Clear search"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-600 text-center sm:text-left whitespace-nowrap">
                Showing {Math.min((currentPage - 1) * pageSize + 1, filteredOutwards.length)}-{Math.min(currentPage * pageSize, filteredOutwards.length)} of {filteredOutwards.length} entries
                {searchTerm && ` (filtered from ${latestOutwardsSorted.length})`}
              </div>
            </div>
            <Button 
              onClick={exportToCSV} 
              className="bg-orange-500 hover:bg-orange-600 text-white w-full lg:w-auto flex-shrink-0"
            >
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="py-3 px-4 bg-orange-50 border-b border-orange-100">
            <div className="flex justify-between items-center">
              <h2 className="text-orange-600 text-lg sm:text-xl font-semibold">Outward Entries</h2>
              <div className="text-sm text-gray-600">
                Total Entries: {filteredOutwards.length}
                {searchTerm && ` (of ${latestOutwardsSorted.length} total)`}
              </div>
            </div>
          </div>
          
          {/* Mobile Card Layout */}
          <div className="block lg:hidden">
            {outwardEntries.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No outward entries found. Click &quot;Add Outward&quot; to create your first entry.
              </div>
            ) : filteredOutwards.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No outward entries match your search criteria. Try adjusting your search terms.
              </div>
            ) : (
              <div className="space-y-3 p-4">
                {paginatedOutwards.map((outward) => (
                  <div key={outward.id} className="border border-gray-200 bg-white rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-semibold text-lg text-orange-600">{outward.outwardCode}</div>
                        <div className="text-sm text-gray-600">{outward.srwrNo}</div>
                        <div className="text-xs text-gray-500">{outward.doCode}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          outward.outwardStatus === 'approved' 
                            ? 'bg-green-100 text-green-800' 
                            : outward.outwardStatus === 'rejected'
                            ? 'bg-red-100 text-red-600'
                            : outward.outwardStatus === 'resubmitted'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {outward.outwardStatus || 'pending'}
                        </span>
                        <button
                          onClick={() => {
                            setSelectedOutward(outward);
                            setShowOutwardDetails(true);
                          }}
                          className="p-2 text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded"
                          title="View Details"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">State:</span>
                        <div className="text-gray-600">{outward.state}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Branch:</span>
                        <div className="text-gray-600">{outward.branch}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Warehouse:</span>
                        <div className="text-gray-600 truncate">{outward.warehouseName}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Client:</span>
                        <div className="text-gray-600 truncate">{outward.client}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Warehouse Type:</span>
                        <div className="text-gray-600 truncate">{outward.warehouseType || outward.typeOfWarehouse || '-'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Business Type:</span>
                        <div className="text-gray-600 truncate">{outward.typeOfBusiness || outward.businessType || '-'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Commodity:</span>
                        <div className="text-gray-600 truncate">{outward.commodity || outward.commodityName || '-'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Variety:</span>
                        <div className="text-gray-600 truncate">{outward.variety || outward.varietyName || '-'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Vehicle:</span>
                        <div className="text-gray-600">{outward.vehicleNumber}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Outward Bags:</span>
                        <div className="text-gray-600">{outward.outwardBags}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Outward Qty:</span>
                        <div className="text-gray-600">{outward.outwardQuantity} MT</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Net Weight:</span>
                        <div className="text-gray-600">{outward.netWeight || '-'} MT</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Desktop Table Layout */}
          <div className="hidden lg:block overflow-x-auto" style={{ maxHeight: '70vh' }}>
            {outwardEntries.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No outward entries found. Click &quot;Add Outward&quot; to create your first entry.
              </div>
            ) : filteredOutwards.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No outward entries match your search criteria. Try adjusting your search terms.
              </div>
            ) : (
              <table className="min-w-[1800px] border text-sm w-full">
                <thead className="bg-orange-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-1 border sticky left-0 bg-orange-100 z-20"></th>
                    <th className="px-2 py-1 border sticky left-[50px] bg-orange-100 z-20">Outward Code</th>
                    <th className="px-2 py-1 border bg-orange-100" style={{ minWidth: '180px' }}>SR/WR No.</th>
                    <th className="px-2 py-1 border bg-orange-100">DO Code</th>
                    <th className="px-2 py-1 border bg-orange-100">CAD Number</th>
                    <th className="px-2 py-1 border bg-orange-100">State</th>
                    <th className="px-2 py-1 border bg-orange-100">Branch</th>
                    <th className="px-2 py-1 border bg-orange-100">Location</th>
                    <th className="px-2 py-1 border bg-orange-100">Warehouse Name</th>
                    <th className="px-2 py-1 border bg-orange-100">Warehouse Code</th>
                    <th className="px-2 py-1 border bg-orange-100">Client Name</th>
                    <th className="px-2 py-1 border bg-orange-100">Client Address</th>
                    <th className="px-2 py-1 border bg-orange-100">Client Code</th>
                    <th className="px-2 py-1 border bg-orange-100">Warehouse Type</th>
                    <th className="px-2 py-1 border bg-orange-100">Type of Business</th>
                    <th className="px-2 py-1 border bg-orange-100">Commodity</th>
                    <th className="px-2 py-1 border bg-orange-100">Variety</th>
                    <th className="px-2 py-1 border bg-orange-100">Vehicle Number</th>
                    <th className="px-2 py-1 border bg-orange-100">GATE PASS</th>
                    <th className="px-2 py-1 border bg-orange-100">WEIGHBRIDGE NAME</th>
                    <th className="px-2 py-1 border bg-orange-100">WEIGHBRIDGE SLIP NO</th>
                    <th className="px-2 py-1 border bg-orange-100">GROSS WEIGHT (MT)</th>
                    <th className="px-2 py-1 border bg-orange-100">TARE WEIGHT (MT)</th>
                    <th className="px-2 py-1 border bg-orange-100">NET WEIGHT (MT)</th> 
                    <th className="px-2 py-1 border bg-orange-100">DO Bags</th>
                    <th className="px-2 py-1 border bg-orange-100">DO Qty (MT)</th>
                    <th className="px-2 py-1 border bg-orange-100">Outward Bags</th>
                    <th className="px-2 py-1 border bg-orange-100">Outward Qty (MT)</th>
                    <th className="px-2 py-1 border bg-orange-100">Balance Bags</th>
                    <th className="px-2 py-1 border bg-orange-100">Balance Qty (MT)</th>
                    <th className="px-2 py-1 border bg-orange-100">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOutwards.map((outward) => (
                    <React.Fragment key={outward.outwardCode}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-2 py-1 border sticky left-0 z-20 bg-white">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1"
                            onClick={() => {
                              setExpandedRows(prev => ({ ...prev, [outward.srwrNo]: !prev[outward.srwrNo] }));
                            }}
                          >
                            {expandedRows[outward.srwrNo] ? '▼' : '▶'}
                          </Button>
                        </td>
                        <td className="px-2 py-1 border sticky left-[50px] bg-white z-20" style={{ minWidth: '100px' }}>
                          {outward.outwardCode}
                        </td>
                        <td className="px-2 py-1 border" style={{ minWidth: '180px' }}>{outward.srwrNo}</td>
                        <td className="px-2 py-1 border">{outward.doCode}</td>
                        <td className="px-2 py-1 border">{outward.cadNumber}</td>
                        <td className="px-2 py-1 border">{outward.state}</td>
                        <td className="px-2 py-1 border">{outward.branch}</td>
                        <td className="px-2 py-1 border">{outward.location}</td>
                        <td className="px-2 py-1 border">{outward.warehouseName}</td>
                        <td className="px-2 py-1 border">{outward.warehouseCode}</td>
                        <td className="px-2 py-1 border">{outward.client}</td>
                        <td className="px-2 py-1 border">{outward.clientAddress}</td>
                        <td className="px-2 py-1 border">{outward.clientCode}</td>
                        <td className="px-2 py-1 border">{outward.warehouseType || outward.typeOfWarehouse || ''}</td>
                        <td className="px-2 py-1 border">{outward.typeOfBusiness || outward.businessType || ''}</td>
                        <td className="px-2 py-1 border">{outward.commodity || outward.commodityName || ''}</td>
                        <td className="px-2 py-1 border">{outward.variety || outward.varietyName || ''}</td>
                        <td className="px-2 py-1 border">{outward.vehicleNumber}</td>
                        <td className="px-2 py-1 border">{outward.gatepass}</td>
                        <td className="px-2 py-1 border">{outward.weighbridgeName}</td>
                        <td className="px-2 py-1 border">{outward.weighbridgeSlipNo}</td>
                        <td className="px-2 py-1 border">{outward.grossWeight}</td>
                        <td className="px-2 py-1 border">{outward.tareWeight}</td>
                        <td className="px-2 py-1 border">{outward.netWeight}</td>
                        <td className="px-2 py-1 border">{outward.doBags}</td>
                        <td className="px-2 py-1 border">{outward.doQuantity}</td>
                        <td className="px-2 py-1 border">{outward.outwardBags}</td>
                        <td className="px-2 py-1 border">{outward.outwardQuantity}</td>
                        <td className="px-2 py-1 border">{getBalanceBags(outward)}</td>
                        <td className="px-2 py-1 border">{getBalanceQty(outward)}</td>
                        <td className="px-2 py-1 border">
                          <div className="flex items-center justify-center gap-2">
                            {(!(groupedOutwards[outward.srwrNo] && groupedOutwards[outward.srwrNo].length > 1)) && (
                              <span className={getStatusStyling(outward.outwardStatus || 'pending')}>
                                {normalizeStatusText(outward.outwardStatus || 'pending')}
                              </span>
                            )}
                            {(outward.outwardStatus === 'resubmitted') && canCreateOutward() && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="p-1" 
                                title="Edit (Resubmitted)" 
                                onClick={() => {
                                  // Open form in edit mode, prefill values
                                  setIsEditMode(true);
                                  setEditingOutward(outward);
                                  setShowAddModal(true);
                                  setSelectedDO(null); // Editing doesn't need DO change
                                  setExistingAttachmentUrls(Array.isArray(outward.attachmentUrls) ? outward.attachmentUrls : []);
                                  setOutwardBags(String(outward.outwardBags || ''));
                                  setOutwardQty(String(outward.outwardQuantity || ''));
                                  setVehicleNumber(outward.vehicleNumber || '');
                                  setGatepass(outward.gatepass || '');
                                  setWeighbridgeName(outward.weighbridgeName || '');
                                  setWeighbridgeSlipNo(outward.weighbridgeSlipNo || '');
                                  setGrossWeight(String(outward.grossWeight ?? ''));
                                  setTareWeight(String(outward.tareWeight ?? ''));
                                  setNetWeight(String(outward.netWeight ?? ''));
                                  setTotalBagsOutward(String(outward.totalBagsOutward ?? ''));
                                  setRemark(outward.remark || '');
                                  // Prefill stacks
                                  const stacks = Array.isArray(outward.stackEntries) ? outward.stackEntries : [];
                                  setStackEntries(stacks.map((s: any) => ({
                                    stackNo: s.stackNo,
                                    bags: String(s.bags ?? ''),
                                    inwardBags: (s.inwardBags !== undefined ? s.inwardBags : (Number(s.bags || 0) + Number(s.balanceBags || 0))) || 0,
                                    balanceBags: s.balanceBags !== undefined ? s.balanceBags : 0,
                                    commodityName: s.commodityName || outward.commodity || outward.commodityName || '',
                                    varietyName: s.varietyName || outward.variety || outward.varietyName || ''
                                  })));

                                  // Set balances for edit context: compute as do minus sum of all approved/pending outwards excluding the current one plus its original
                                  const sumOtherBags = (groupedOutwards[outward.srwrNo] || [])
                                    .filter((e: any) => e.id !== outward.id)
                                    .reduce((sum: number, e: any) => sum + Number(e.outwardBags || 0), 0);
                                  const sumOtherQty = (groupedOutwards[outward.srwrNo] || [])
                                    .filter((e: any) => e.id !== outward.id)
                                    .reduce((sum: number, e: any) => sum + Number(e.outwardQuantity || 0), 0);
                                  const doBags = Number(outward.doBags || 0);
                                  const doQty = Number(outward.doQuantity || 0);
                                  const availableBags = Math.max(0, doBags - sumOtherBags);
                                  const availableQty = Math.max(0, doQty - sumOtherQty);
                                  setCurrentBalanceBags(availableBags);
                                  setCurrentBalanceQty(availableQty);
                                }}
                              >
                                <Edit3 className="h-4 w-4 text-orange-600" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="p-1" 
                              title="View Details" 
                              onClick={() => { 
                                setSelectedOutward(outward); 
                                setShowOutwardDetails(true); 
                              }}
                            >
                              <Eye className="h-4 w-4 text-green-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded row for vehicle-wise entries */}
                      {expandedRows[outward.srwrNo] && outward.outwardEntries && outward.outwardEntries.length > 0 && (
                        <tr>
                          <td colSpan={30} className="p-0">
                            <div className="bg-orange-50 p-4 border-l-4 border-orange-400">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="text-sm font-medium text-orange-700">Vehicle Entries for Outward: {outward.outwardCode}</div>
                                <div className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                                  {outward.outwardEntries.length} vehicle{outward.outwardEntries.length === 1 ? '' : 's'}
                                </div>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-xs bg-white rounded">
                                  <thead className="bg-orange-600 text-white">
                                    <tr>
                                      <th className="border border-orange-700 px-3 py-2 text-left">Entry #</th>
                                      <th className="border border-orange-700 px-3 py-2 text-left">Vehicle Number</th>
                                      <th className="border border-orange-700 px-3 py-2 text-left">Gate Pass</th>
                                      <th className="border border-orange-700 px-3 py-2 text-left">Weighbridge Name</th>
                                      <th className="border border-orange-700 px-3 py-2 text-left">Weighbridge Slip No.</th>
                                      <th className="border border-orange-700 px-3 py-2 text-right">Gross Weight (MT)</th>
                                      <th className="border border-orange-700 px-3 py-2 text-right">Tare Weight (MT)</th>
                                      <th className="border border-orange-700 px-3 py-2 text-right">Net Weight (MT)</th>
                                      <th className="border border-orange-700 px-3 py-2 text-left">Stack Details</th>
                                      <th className="border border-orange-700 px-3 py-2 text-right font-semibold">Outward Bags</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {outward.outwardEntries.map((entry: any, idx: number) => (
                                      <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-orange-25'} hover:bg-orange-50`}>
                                        <td className="border border-orange-300 px-3 py-2 font-medium text-orange-700">{entry.entryNumber}</td>
                                        <td className="border border-orange-300 px-3 py-2 font-medium">{entry.vehicleNumber || '-'}</td>
                                        <td className="border border-orange-300 px-3 py-2">{entry.gatepass || '-'}</td>
                                        <td className="border border-orange-300 px-3 py-2">{entry.weighbridgeName || '-'}</td>
                                        <td className="border border-orange-300 px-3 py-2">{entry.weighbridgeSlipNo || '-'}</td>
                                        <td className="border border-orange-300 px-3 py-2 text-right">{entry.grossWeight?.toFixed(3) || '0.000'}</td>
                                        <td className="border border-orange-300 px-3 py-2 text-right">{entry.tareWeight?.toFixed(3) || '0.000'}</td>
                                        <td className="border border-orange-300 px-3 py-2 text-right">{entry.netWeight?.toFixed(3) || '0.000'}</td>
                                        <td className="border border-orange-300 px-3 py-2">
                                          {entry.stackEntries && entry.stackEntries.length > 0 ? (
                                            entry.stackEntries.map((stack: any, sIdx: number) => (
                                              <span key={sIdx}>
                                                Stack {stack.stackNo} - {stack.bags}
                                                {sIdx < entry.stackEntries.length - 1 ? ', ' : ''}
                                              </span>
                                            ))
                                          ) : '-'}
                                        </td>
                                        <td className="border border-orange-300 px-3 py-2 text-right font-bold text-orange-700">{entry.totalBagsOutward}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot className="bg-gray-100">
                                    <tr>
                                      <td colSpan={9} className="border border-gray-400 px-3 py-2 text-right font-bold text-gray-700">Total Outward Bags:</td>
                                      <td className="border border-gray-400 px-3 py-2 text-right font-bold text-orange-700 text-sm">{outward.outwardBags}</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                              
                              {/* Summary Section */}
                              <div className="mt-3 p-3 bg-orange-100 rounded border border-orange-300">
                                <div className="text-sm font-medium text-orange-700 mb-2">Summary for Outward: {outward.outwardCode}</div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                  <div>
                                    <span className="text-orange-600 font-medium">Total Vehicles:</span>
                                    <div className="font-bold">{outward.outwardEntries.length}</div>
                                  </div>
                                  <div>
                                    <span className="text-orange-600 font-medium">Total Bags Released:</span>
                                    <div className="font-bold">{outward.outwardBags}</div>
                                  </div>
                                  <div>
                                    <span className="text-orange-600 font-medium">Total Quantity Released:</span>
                                    <div className="font-bold">{Number(outward.outwardQuantity || 0).toFixed(3)} MT</div>
                                  </div>
                                  <div>
                                    <span className="text-orange-600 font-medium">Current Balance:</span>
                                    <div className="font-bold text-green-600">{getBalanceBags(outward)} bags / {getBalanceQty(outward)} MT</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Pagination Controls */}
          {filteredOutwards.length > pageSize && (
            <div className="flex justify-between items-center mt-4 px-4">
              <div className="text-sm text-gray-600">
                Showing {Math.min((currentPage - 1) * pageSize + 1, filteredOutwards.length)} to {Math.min(currentPage * pageSize, filteredOutwards.length)} of {filteredOutwards.length} entries
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {Math.ceil(filteredOutwards.length / pageSize)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredOutwards.length / pageSize), prev + 1))}
                  disabled={currentPage === Math.ceil(filteredOutwards.length / pageSize)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Add Outward Dialog (Form) */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="w-[95vw] max-w-4xl h-[95vh] p-3 sm:p-4">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl text-left text-orange-600 font-bold">
              <div className="flex items-center gap-2">
                {isEditMode ? 'Edit Outward Entry (Resubmission)' : 'New Outward Entry'}
                {vehicleEntries.length > 0 && (
                  <div className="bg-green-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                    {vehicleEntries.length} vehicle{vehicleEntries.length === 1 ? '' : 's'} added
                  </div>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={async (e) => { e.preventDefault(); await handleOutwardSubmit(); }} className="max-h-[calc(95vh-120px)] overflow-y-auto p-1 sm:p-2">
            {formError && <div className="bg-red-100 p-2 sm:p-3 mb-4 text-red-600 rounded-md text-center font-medium text-sm sm:text-base">{formError}</div>}
            
            <div className="space-y-4 sm:space-y-5 pt-2 sm:pt-4">
              {/* DO Selection */}
              {!isEditMode && (
              <div className="bg-orange-50 p-3 sm:p-4 rounded-md border border-orange-200">
                <Label htmlFor="do-select" className="text-green-800 font-semibold text-base sm:text-lg mb-2 block">
                  Select Delivery Order
                </Label>
                <div className="relative">
                  <div className="relative mb-1">
                    {/*  */}
                  </div>
                  
                  {/* Filtered options display count */}
                  {doSearch && (
                    <div className="text-xs mb-2">
                      <span className={`${filteredDOOptions.length > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {filteredDOOptions.length} {filteredDOOptions.length === 1 ? 'result' : 'results'} found
                        {filteredDOOptions.length === 0 && doSearch.length > 0 && " - Try partial SR/WR number or DO code"}
                      </span>
                    </div>
                  )}
                  
                  {/* Debug info */}
                  <div className="text-xs mb-2 text-orange-600">
                    Available DOs: {doOptions.length} | 
                    Filtered: {filteredDOOptions.length} | 
                    With positive balance: {filteredDOOptions.filter(opt => 
                      (opt.balanceBags !== undefined ? Number(opt.balanceBags) : 
                        (opt.doBags !== undefined ? Number(opt.doBags) : 0)) > 0
                    ).length}
                  </div>
                  
                  <Select
                    value={selectedDO?.id || ''}
                    onValueChange={(value) => {
                      const selected = doOptions.find(doItem => doItem.id === value);
                      setSelectedDO(selected || null);
                      
                      // When a DO is selected, update current balance values
                      if (selected) {
                        const balanceBags = Number(selected.balanceBags || 0);
                        const balanceQty = Number(selected.balanceQuantity || 0);
                        
                        setCurrentBalanceBags(balanceBags);
                        setCurrentBalanceQty(balanceQty);
                        
                        // Auto-fill if only 1 bag remains
                        if (balanceBags === 1) {
                          setOutwardBags('1');
                          setOutwardQty(balanceQty.toString());
                        } else {
                          // Reset outward values
                          setOutwardBags('');
                          setOutwardQty('');
                        }
                        
                        // Fetch stack information from the inward collection
                        const fetchStackInfo = async () => {
                          try {
                            console.log('=== STARTING INWARD DATA FETCH ===');
                            
                            // Get the SR/WR number from selected DO
                            const srwrNo = selected.srwrNo;
                            console.log('Selected SR/WR No:', srwrNo);
                            
                            if (!srwrNo) {
                              console.log('No SR/WR number found in selected DO');
                              setStackEntries([{
                                stackNo: 'Stack-1',
                                bags: '',
                                inwardBags: 0,
                                balanceBags: 0
                              }]);
                              return;
                            }
                            
                            // Fetch warehouse inspection data for warehouse type and type of business
                            console.log('=== FETCHING WAREHOUSE INSPECTION DATA ===');
                            console.log('Target warehouse name:', selected.warehouseName);
                            const inspectionCol = collection(db, 'inspections');
                            const inspectionSnap = await getDocs(inspectionCol);
                            let warehouseInspectionData = null;
                            
                            // Find matching warehouse inspection with multiple matching strategies
                            const matchingInspection = inspectionSnap.docs.find(doc => {
                              const data = doc.data();
                              
                              // Try multiple ways to get warehouse name
                              const warehouseName1 = data.warehouseName || '';
                              const warehouseName2 = data.warehouseInspectionData?.warehouseName || '';
                              const warehouseName3 = data.warehouseInspectionData?.warehousename || '';
                              const warehouseName4 = data.warehousename || '';
                              
                              const targetName = (selected.warehouseName || '').toLowerCase().trim();
                              
                              console.log('Checking inspection doc:', {
                                warehouseName1,
                                warehouseName2,
                                warehouseName3,
                                warehouseName4,
                                targetName
                              });
                              
                              return targetName && (
                                warehouseName1.toLowerCase().trim() === targetName ||
                                warehouseName2.toLowerCase().trim() === targetName ||
                                warehouseName3.toLowerCase().trim() === targetName ||
                                warehouseName4.toLowerCase().trim() === targetName ||
                                // Partial match for similar names
                                warehouseName1.toLowerCase().includes(targetName) ||
                                warehouseName2.toLowerCase().includes(targetName) ||
                                targetName.includes(warehouseName1.toLowerCase()) ||
                                targetName.includes(warehouseName2.toLowerCase())
                              );
                            });
                            
                            if (matchingInspection) {
                              warehouseInspectionData = matchingInspection.data();
                              console.log('Found warehouse inspection data:', warehouseInspectionData);
                              console.log('Inspection data keys:', Object.keys(warehouseInspectionData));
                              
                              // Extract warehouse type and type of business with multiple fallbacks
                              const wType = warehouseInspectionData.typeOfWarehouse || 
                                          warehouseInspectionData.warehouseType ||
                                          warehouseInspectionData.typeofwarehouse ||
                                          warehouseInspectionData.warehouseInspectionData?.typeOfWarehouse ||
                                          warehouseInspectionData.warehouseInspectionData?.warehouseType || '';
                              
                              const bType = warehouseInspectionData.typeOfBusiness || 
                                          warehouseInspectionData.businessType ||
                                          warehouseInspectionData.typeofbusiness ||
                                          warehouseInspectionData.warehouseInspectionData?.typeOfBusiness ||
                                          warehouseInspectionData.warehouseInspectionData?.businessType || '';
                              
                              setWarehouseType(wType);
                              setTypeOfBusiness(bType);
                              console.log('✅ Set warehouse type:', wType, 'business type:', bType);
                            } else {
                              console.log('❌ No matching warehouse inspection found for:', selected.warehouseName);
                              console.log('Available warehouses in inspections:');
                              inspectionSnap.docs.forEach((doc, index) => {
                                const data = doc.data();
                                const name1 = data.warehouseName || '';
                                const name2 = data.warehouseInspectionData?.warehouseName || '';
                                if (name1 || name2) {
                                  console.log(`${index + 1}. ${name1} / ${name2}`);
                                }
                              });
                              setWarehouseType('');
                              setTypeOfBusiness('');
                            }
                            
                            // Method 1: Try to extract inward ID from SR/WR number
                            let inwardId = '';
                            const parts = srwrNo.split('-');
                            console.log('SR/WR parts:', parts);
                            
                            // Look for INW pattern in the parts
                            const inwardIdPart = parts.find((part: string) => part.startsWith('INW'));
                            if (inwardIdPart) {
                              inwardId = inwardIdPart;
                              console.log('Extracted inward ID from SR/WR:', inwardId);
                            }
                            
                            // Method 2: If no INW pattern, try to reconstruct from SR/WR
                            if (!inwardId && parts.length >= 2) {
                              // Format: "SR-INW-047-2025-07-25" -> parts[1] should be "INW-047"
                              if (parts[1] && parts[1].includes('INW')) {
                                inwardId = parts[1];
                                console.log('Extracted inward ID from parts[1]:', inwardId);
                              }
                            }
                            
                            console.log('Final inward ID to search for:', inwardId);
                            
                            // Fetch inward data
                            const inwardCol = collection(db, 'inward');
                            let inwardData = null;
                            
                            // Method 1: Direct query by inwardId
                            if (inwardId) {
                              console.log('Trying direct query with inwardId:', inwardId);
                              const inwardQuery = query(inwardCol, where('inwardId', '==', inwardId));
                              const inwardSnap = await getDocs(inwardQuery);
                              
                              if (!inwardSnap.empty) {
                                inwardData = inwardSnap.docs[0].data();
                                console.log('Found inward data via direct query');
                              } else {
                                console.log('Direct query failed, trying case-insensitive search');
                                
                                // Method 2: Case-insensitive search
                                const allInwardSnap = await getDocs(inwardCol);
                                const matchingInward = allInwardSnap.docs.find(doc => {
                                  const data = doc.data();
                                  return data.inwardId && data.inwardId.toLowerCase() === inwardId.toLowerCase();
                                });
                                
                                if (matchingInward) {
                                  inwardData = matchingInward.data();
                                  console.log('Found inward data via case-insensitive search');
                                }
                              }
                            }
                            
                            // Method 3: If still not found, try to find by SR/WR pattern reconstruction
                            if (!inwardData) {
                              console.log('Trying robust SR/WR pattern search');
                              const allInwardSnap = await getDocs(inwardCol);
                              
                              const matchingInward = allInwardSnap.docs.find(doc => {
                                const data = doc.data();
                                
                                // Generate the expected SR/WR format for this inward entry
                                if (data.inwardId && data.dateOfInward) {
                                  // Convert date from YYYY-MM-DD to YYYYMMDD format for comparison
                                  const formattedDate = data.dateOfInward.replace(/-/g, '');
                                  
                                  // Try both SR and WR formats since receipt type might vary
                                  const expectedSR = `SR-${data.inwardId}-${formattedDate}`;
                                  const expectedWR = `WR-${data.inwardId}-${formattedDate}`;
                                  
                                  console.log('Comparing SR/WR:', srwrNo, 'with generated:', expectedSR, 'and', expectedWR);
                                  
                                  return srwrNo === expectedSR || srwrNo === expectedWR;
                                }
                                return false;
                              });
                              
                              if (matchingInward) {
                                inwardData = matchingInward.data();
                                console.log('Found inward data via robust SR/WR pattern search');
                              }
                            }
                            
                            // Method 4: Warehouse-based search with date correlation
                            if (!inwardData) {
                              console.log('Trying warehouse-based search with date correlation');
                              const allInwardSnap = await getDocs(inwardCol);
                              
                              // Try to extract date component from SR/WR number  
                              let searchDate = '';
                              const datePart = srwrNo.split('-').find((part: string) => /^\d{8}$/.test(part));
                              if (datePart) {
                                // Convert YYYYMMDD to YYYY-MM-DD for comparison
                                searchDate = datePart.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
                                console.log('Extracted date from SR/WR:', datePart, 'formatted as:', searchDate);
                              }
                              
                              const matchingInwards = allInwardSnap.docs.filter(doc => {
                                const data = doc.data();
                                const warehouseMatch = data.warehouseName === selected.warehouseName;
                                const dateMatch = searchDate && data.dateOfInward === searchDate;
                                
                                console.log('Checking inward:', data.inwardId, 'warehouse match:', warehouseMatch, 'date match:', dateMatch);
                                return warehouseMatch && dateMatch;
                              });
                              
                              if (matchingInwards.length === 1) {
                                inwardData = matchingInwards[0].data();
                                console.log('Found inward data via warehouse+date correlation');
                              } else if (matchingInwards.length > 1) {
                                // Multiple matches, try to pick the best one
                                console.log('Multiple warehouse+date matches found:', matchingInwards.length);
                                inwardData = matchingInwards[0].data(); // Take the first one
                                console.log('Using first match from warehouse+date correlation');
                              }
                            }
                            
                            // Method 5: Last resort - search by partial match
                            if (!inwardData) {
                              console.log('Trying partial match search');
                              const allInwardSnap = await getDocs(inwardCol);
                              
                              // Try to find by inwardId pattern in SR/WR
                              const matchingInward = allInwardSnap.docs.find(doc => {
                                const data = doc.data();
                                if (data.inwardId && srwrNo.includes(data.inwardId)) {
                                  console.log('Found partial match:', data.inwardId, 'in', srwrNo);
                                  return true;
                                }
                                return false;
                              });
                              
                              if (matchingInward) {
                                inwardData = matchingInward.data();
                                console.log('Found inward data via partial match');
                              }
                            }
                            
                            if (inwardData) {
                              console.log('=== INWARD DATA FOUND ===');
                              console.log('Inward data:', inwardData);
                              console.log('Available fields:', Object.keys(inwardData));
                              
                              // Store inward entry data for reference
                              setSelectedInwardEntry(inwardData);
                              
                              // Extract commodity and variety information
                              const commodity = inwardData.commodity || inwardData.commodityName || '';
                              const variety = inwardData.variety || inwardData.varietyName || '';
                              setCommodityName(commodity);
                              setVarietyName(variety);
                              console.log('Set commodity:', commodity, 'variety:', variety);
                              
                              // Auto-populate vehicle number from the first available entry
                              let vehicleNumber = '';
                              if (inwardData.inwardEntries && Array.isArray(inwardData.inwardEntries) && inwardData.inwardEntries.length > 0) {
                                // New structure with inwardEntries array
                                vehicleNumber = inwardData.inwardEntries[0]?.vehicleNumber || '';
                                console.log('Vehicle number from inwardEntries[0]:', vehicleNumber);
                              } else {
                                // Legacy structure 
                                vehicleNumber = inwardData.vehicleNumber || '';
                                console.log('Vehicle number from legacy structure:', vehicleNumber);
                              }
                              
                              if (vehicleNumber) {
                                setVehicleNumber(vehicleNumber);
                                console.log('✅ Auto-populated vehicle number:', vehicleNumber);
                              } else {
                                console.log('⚠️ No vehicle number found in inward data');
                                console.log('Vehicle-related fields:', Object.keys(inwardData).filter(key => key.toLowerCase().includes('vehicle')));
                              }
                              
                              // Auto-populate gate pass from the first available entry
                              let gatePass = '';
                              if (inwardData.inwardEntries && Array.isArray(inwardData.inwardEntries) && inwardData.inwardEntries.length > 0) {
                                // New structure with inwardEntries array
                                gatePass = inwardData.inwardEntries[0]?.getpassNumber || '';
                                console.log('Gate pass from inwardEntries[0]:', gatePass);
                              } else {
                                // Legacy structure
                                gatePass = inwardData.getpassNumber || '';
                                console.log('Gate pass from legacy structure:', gatePass);
                              }
                              
                              if (gatePass) {
                                setGatepass(gatePass);
                                console.log('✅ Auto-populated gate pass:', gatePass);
                              } else {
                                console.log('⚠️ No gate pass found in inward data');
                                console.log('Gate pass-related fields:', Object.keys(inwardData).filter(key => key.toLowerCase().includes('gate') || key.toLowerCase().includes('pass')));
                              }
                              
                              // Extract stack information with enhanced compatibility
                              let stacks: any[] = [];
                              
                              // Try new structure first (inwardEntries array)
                              if (inwardData.inwardEntries && Array.isArray(inwardData.inwardEntries)) {
                                console.log('Processing NEW inward structure with', inwardData.inwardEntries.length, 'entries');
                                
                                // Combine stacks from all entries
                                inwardData.inwardEntries.forEach((entry: any, entryIndex: number) => {
                                  if (entry.stacks && Array.isArray(entry.stacks)) {
                                    entry.stacks.forEach((stack: any, stackIndex: number) => {
                                      stacks.push({
                                        ...stack,
                                        stackNo: stack.stackNumber || stack.stackNo || `Stack-${entryIndex + 1}-${stackIndex + 1}`,
                                        inwardBags: parseInt(stack.numberOfBags) || parseInt(stack.bags) || parseInt(stack.bagCount) || 0,
                                        commodityName: inwardData.commodity || stack.commodityName || stack.commodity || '',
                                        varietyName: inwardData.varietyName || stack.varietyName || stack.variety || ''
                                      });
                                    });
                                  }
                                });
                                
                                console.log('Combined stacks from all entries:', stacks.length, 'stacks total');
                              } 
                              // Fallback to legacy structure
                              else if (inwardData.stacks && Array.isArray(inwardData.stacks)) {
                                console.log('Processing LEGACY inward structure with', inwardData.stacks.length, 'stacks');
                                stacks = inwardData.stacks.map((stack: any, index: number) => ({
                                  stackNo: stack.stackNumber || stack.stackNo || `Stack-${index + 1}`,
                                  inwardBags: parseInt(stack.numberOfBags) || parseInt(stack.bags) || parseInt(stack.bagCount) || 0,
                                  commodityName: inwardData.commodity || stack.commodityName || stack.commodity || '',
                                  varietyName: inwardData.varietyName || stack.varietyName || stack.variety || ''
                                }));
                              }
                              
                              // Process and set stack entries
                              if (stacks.length > 0) {
                                const stackData = stacks.map((stack: any, index: number) => {
                                  console.log(`Processing stack ${index + 1}:`, {
                                    stackNo: stack.stackNo,
                                    inwardBags: stack.inwardBags,
                                    commodityName: stack.commodityName
                                  });
                                  
                                  return {
                                    stackNo: stack.stackNo,
                                    bags: '', // User will input this
                                    inwardBags: stack.inwardBags,
                                    balanceBags: stack.inwardBags, // Initially same as inward bags
                                    commodityName: stack.commodityName,
                                    varietyName: stack.varietyName
                                  };
                                });
                                
                                setStackEntries(stackData);
                                console.log('✅ Set', stackData.length, 'stack entries with comprehensive data');
                              } else {
                                console.log('⚠️ No stacks found in inward data, creating default stack');
                                const totalBags = parseInt(inwardData.totalBags) || 0;
                                setStackEntries([{
                                  stackNo: 'Stack-1',
                                  bags: '',
                                  inwardBags: totalBags,
                                  balanceBags: totalBags, // Initially same as inward bags
                                  commodityName: inwardData.commodity || '',
                                  varietyName: inwardData.varietyName || ''
                                }]);
                              }
                            } else {
                              console.log('=== NO INWARD DATA FOUND ===');
                              console.log('Could not find inward entry for SR/WR:', srwrNo);
                              setSelectedInwardEntry(null);
                              setStackEntries([{
                                stackNo: 'Stack-1',
                                bags: '',
                                inwardBags: 0,
                                balanceBags: 0
                              }]);
                            }
                            
                            console.log('=== INWARD DATA FETCH COMPLETE ===');
                          } catch (error) {
                            console.error('Error in fetchStackInfo:', error);
                            setStackEntries([{
                              stackNo: 'Stack-1',
                              bags: '',
                              inwardBags: 0,
                              balanceBags: 0
                            }]);
                          }
                        };
                        
                        fetchStackInfo();
                      } else {
                        setCurrentBalanceBags(null);
                        setCurrentBalanceQty(null);
                        setStackEntries([]);
                        setSelectedInwardEntry(null);
                        setVehicleNumber('');
                        setGatepass('');
                        setWarehouseType('');
                        setTypeOfBusiness('');
                        setCommodityName('');
                        setVarietyName('');
                      }
                    }}
                  >
                    <SelectTrigger id="do-select" className="bg-white">
                      <SelectValue placeholder="Select Delivery Order" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[320px]">
                      {/* Search Input */}
                      <div className="px-2 py-2 border-b sticky top-0 bg-white z-10">
                        <Input
                          ref={searchInputRef}
                          placeholder="Type to filter..."
                          value={doSearch}
                          onChange={(e) => setDoSearch(e.target.value)}
                          className="h-8 text-sm"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      
                      {/* Empty state when no results */}
                      {groupedDOOptions.length === 0 && doSearch ? (
                        <div className="px-2 py-4 text-center text-sm text-gray-500">
                          No options found matching &quot;{doSearch}&quot;
                        </div>
                      ) : (
                        groupedDOOptions.map(group => {
                        const itemsWithBalance = group.items
                          .filter(option => {
                            const balanceBags = option.balanceBags !== undefined ? Number(option.balanceBags) : (option.doBags !== undefined ? Number(option.doBags) : 0);
                            return balanceBags > 0;
                          });
                        if (itemsWithBalance.length === 0) return null;
                        return (
                          <SelectGroup key={group.srwrNo}>
                            <SelectLabel className="text-orange-700">SR/WR: {group.srwrNo}</SelectLabel>
                            {itemsWithBalance.map(option => {
                              const balanceBags = option.balanceBags !== undefined ? Number(option.balanceBags) : (option.doBags !== undefined ? Number(option.doBags) : 0);
                              const balanceQuantity = option.balanceQuantity !== undefined ? Number(option.balanceQuantity) : (option.doQuantity || 0);
                              return (
                                <SelectItem key={option.id} value={option.id}>
                                  <span>
                                    DO: {option.doCode}
                                    <span className="ml-2 text-green-700">(Balance: {balanceBags} bags, {Number(balanceQuantity).toFixed(2)} QT)</span>
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectGroup>
                        );
                      })
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              )}

              {/* Auto-populated Fields */}
              {((!isEditMode && selectedDO) || (isEditMode && editingOutward)) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 p-3 sm:p-4 bg-white-50 rounded-md border border-orange-200">
                  <div>
                    <Label className="text-green-800 font-medium text-sm sm:text-base">SR/WR NO</Label>
                    <Input value={(isEditMode ? editingOutward?.srwrNo : selectedDO?.srwrNo) || ''} readOnly className="bg-white border-orange-100 text-sm" />
                  </div>
                  <div>
                    <Label className="text-green-800 font-medium text-sm sm:text-base">CAD NUMBER</Label>
                    <Input value={(isEditMode ? editingOutward?.cadNumber : selectedDO?.cadNumber) || ''} readOnly className="bg-white border-orange-100 text-sm" />
                  </div>
                  <div>
                    <Label className="text-green-800 font-medium">STATE</Label>
                    <Input value={(isEditMode ? editingOutward?.state : selectedDO?.state) || ''} readOnly className="bg-white border-orange-100" />
                  </div>
                  <div>
                    <Label className="text-green-800 font-medium">BRANCH</Label>
                    <Input value={(isEditMode ? editingOutward?.branch : selectedDO?.branch) || ''} readOnly className="bg-white border-orange-100" />
                  </div>
                  <div>
                    <Label className="text-green-800 font-medium">LOCATION</Label>
                    <Input value={(isEditMode ? editingOutward?.location : selectedDO?.location) || ''} readOnly className="bg-white border-orange-100" />
                  </div>
                  <div>
                    <Label className="text-green-800 font-medium">WAREHOUSE NAME</Label>
                    <Input value={(isEditMode ? editingOutward?.warehouseName : selectedDO?.warehouseName) || ''} readOnly className="bg-white border-orange-100" />
                  </div>
                  <div>
                    <Label className="text-green-800 font-medium">WAREHOUSE CODE</Label>
                    <Input value={(isEditMode ? editingOutward?.warehouseCode : selectedDO?.warehouseCode) || ''} readOnly className="bg-white border-orange-100" />
                  </div>
                  <div>
                    <Label className="text-green-800 font-medium">WAREHOUSE ADDRESS</Label>
                    <Input value={(isEditMode ? editingOutward?.warehouseAddress : selectedDO?.warehouseAddress) || ''} readOnly className="bg-white border-orange-100" />
                  </div>
                  <div>
                    <Label className="text-green-800 font-medium">CLIENT NAME</Label>
                    <Input value={(isEditMode ? editingOutward?.client : selectedDO?.client) || ''} readOnly className="bg-white border-orange-100" />
                  </div>
                  <div>
                    <Label className="text-green-800 font-medium">CLIENT CODE</Label>
                    <Input value={(isEditMode ? editingOutward?.clientCode : selectedDO?.clientCode) || ''} readOnly className="bg-white border-orange-100" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-green-800 font-medium">CLIENT ADDRESS</Label>
                    <Input value={(isEditMode ? editingOutward?.clientAddress : selectedDO?.clientAddress) || ''} readOnly className="bg-white border-orange-100" />
                  </div>
                  
                  {/* New fields: Warehouse Type, Type of Business, Commodity, Variety */}
                  <div>
                    <Label className="text-green-800 font-medium">WAREHOUSE TYPE</Label>
                    <Input value={(isEditMode ? editingOutward?.warehouseType : selectedDO?.warehouseType) || warehouseType} readOnly className="bg-white border-orange-100" />
                  </div>
                  <div>
                    <Label className="text-green-800 font-medium">TYPE OF BUSINESS</Label>
                    <Input value={(isEditMode ? editingOutward?.typeOfBusiness : selectedDO?.typeOfBusiness) || typeOfBusiness} readOnly className="bg-white border-orange-100" />
                  </div>
                  <div>
                    <Label className="text-green-800 font-medium">COMMODITY</Label>
                    <Input value={(isEditMode ? editingOutward?.commodity : selectedDO?.commodity) || commodityName} readOnly className="bg-white border-orange-100" />
                  </div>
                  <div>
                    <Label className="text-green-800 font-medium">VARIETY</Label>
                    <Input value={(isEditMode ? editingOutward?.variety : selectedDO?.variety) || varietyName} readOnly className="bg-white border-orange-100" />
                  </div>
                  
                  <div>
                    <Label className="text-green-800 font-medium">INWARD BAGS</Label>
                    <Input value={(isEditMode ? (editingOutward?.inwardBags || editingOutward?.totalBags) : selectedDO?.totalBags) || ''} readOnly className="bg-white border-orange-100" />
                  </div>
                  <div>
                    <Label className="text-green-800 font-medium">INWARD QUANTITY (MT)</Label>
                    <Input value={(isEditMode ? (editingOutward?.inwardQuantity || editingOutward?.totalQuantity) : selectedDO?.totalQuantity) || ''} readOnly className="bg-white border-orange-100" />
                  </div>
                  <div>
                    <Label className="text-green-800 font-medium">DO BAGS</Label>
                    <Input value={(isEditMode ? editingOutward?.doBags : selectedDO?.doBags) || ''} readOnly className="bg-white border-orange-100" />
                  </div>
                  <div>
                    <Label className="text-green-800 font-medium">DO QUANTITY (MT)</Label>
                    <Input value={(isEditMode ? editingOutward?.doQuantity : selectedDO?.doQuantity) || ''} readOnly className="bg-white border-orange-100" />
                  </div>

                  {/* Outward entry input fields */}
                  <div>
                    <Label htmlFor="outwardBags" className="text-green-600 font-medium">OUTWARD BAGS (Cumulative)</Label>
                    <Input
                      id="outwardBags"
                      type="text"
                      value={outwardBags}
                      readOnly
                      disabled
                      className="bg-gray-100 border-orange-200 text-gray-700 font-semibold"
                      placeholder="Auto-calculated from vehicle entries"
                      title="This is auto-calculated as sum of all vehicle entries"
                    />
                    {vehicleEntries.length > 0 && (
                      <div className="text-xs text-blue-600 mt-1">
                        Sum of {vehicleEntries.length} vehicle entr{vehicleEntries.length === 1 ? 'y' : 'ies'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="outwardQty" className="text-green-600 font-medium">OUTWARD QUANTITY (MT)</Label>
                    <Input
                      id="outwardQty"
                      type="number"
                      step="0.01"
                      value={outwardQty}
                      onChange={(e) => setOutwardQty(e.target.value)}
                      required
                      className="bg-white border-orange-200"
                      placeholder="e.g. 4.500"
                    />
                    <div className="text-xs text-gray-600 mt-1">
                      Enter total quantity once at the end (not per vehicle)
                    </div>
                  </div>

                  {/* Auto calculated balance fields */}
                  <div>
                    <Label className="text-green-800 font-medium">BALANCE BAGS (Remaining)</Label>
                    <Input 
                      value={currentBalanceBags?.toString() || '0'} 
                      readOnly 
                      className="bg-orange-50 border-orange-100 font-semibold text-green-700"
                      title="Updated after each vehicle entry is added"
                    />
                    <div className="text-xs text-gray-600 mt-1">
                      Initial: {selectedDO?.doBags || 0} | Used: {outwardBags || 0}
                    </div>
                  </div>
                  <div>
                    <Label className="text-green-800 font-medium">BALANCE QUANTITY (MT)</Label>
                    <Input 
                      value={currentBalanceQty !== null ? Number(currentBalanceQty).toFixed(3) : '0.000'} 
                      readOnly 
                      className="bg-orange-50 border-orange-100 font-semibold text-green-700"
                      title="Will be deducted when final outward is submitted"
                    />
                    <div className="text-xs text-gray-600 mt-1">
                      Available for this outward
                    </div>
                  </div>
                  
                  {/* Outward entry details */}
                  <div className="sm:col-span-2 mt-4">
                    <h3 className="text-orange-800 font-semibold mb-3 border-b border-orange-200 pb-1 text-sm sm:text-base">Outward Entry Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <Label htmlFor="vehicleNumber" className="text-green-600 font-medium">VEHICLE NUMBER</Label>
                        <Input
                          id="vehicleNumber"
                          value={vehicleNumber}
                          onChange={(e) => setVehicleNumber(e.target.value)}
                          className="bg-white border-orange-200"
                          placeholder="e.g. MH12AB1234 "
                        />
                      </div>
                      <div>
                        <Label htmlFor="gatepass" className="text-green-600 font-medium">GATE PASS</Label>
                        <Input
                          id="gatepass"
                          value={gatepass}
                          onChange={(e) => setGatepass(e.target.value)}
                          className="bg-white border-orange-200"
                          placeholder="e.g. GP12345 "
                        />
                      </div>
                      <div>
                        <Label htmlFor="weighbridgeName" className="text-green-600 font-medium">WEIGHBRIDGE NAME</Label>
                        <Input
                          id="weighbridgeName"
                          value={weighbridgeName}
                          onChange={(e) => setWeighbridgeName(e.target.value)}
                          className="bg-white border-orange-200"
                          placeholder="e.g. City Weighbridge "
                        />
                      </div>
                      <div>
                        <Label htmlFor="weighbridgeSlipNo" className="text-green-600 font-medium">WEIGHBRIDGE SLIP NO</Label>
                        <Input
                          id="weighbridgeSlipNo"
                          value={weighbridgeSlipNo}
                          onChange={(e) => setWeighbridgeSlipNo(e.target.value)}
                          className="bg-white border-orange-200"
                          placeholder="e.g. WB98765 "
                        />
                      </div>
                      <div>
                        <Label htmlFor="grossWeight" className="text-green-600 font-medium">GROSS WEIGHT (MT)</Label>
                        <Input
                          id="grossWeight"
                          value={grossWeight}
                          onChange={(e) => handleGrossWeightChange(e.target.value)}
                          className="bg-white border-orange-200"
                          placeholder="e.g. 25.500"
                          type="text"
                        />
                      </div>
                      <div>
                        <Label htmlFor="tareWeight" className="text-green-600 font-medium">TARE WEIGHT (MT)</Label>
                        <Input
                          id="tareWeight"
                          value={tareWeight}
                          onChange={(e) => handleTareWeightChange(e.target.value)}
                          className="bg-white border-orange-200"
                          placeholder="e.g. 2.500 "
                          type="text"
                        />
                      </div>
                      <div>
                        <Label htmlFor="netWeight" className="text-green-600 font-medium">NET WEIGHT (MT)</Label>
                        <Input
                          id="netWeight"
                          value={netWeight}
                          readOnly
                          className="bg-gray-100 border-orange-200 text-gray-700"
                          placeholder="Auto calculated"
                          type="text"
                        />
                      </div>
                      <div>
                        <Label htmlFor="totalBagsOutward" className="text-green-600 font-medium">TOTAL BAGS OUTWARD (for this vehicle)</Label>
                        <Input
                          id="totalBagsOutward"
                          type="number"
                          value={totalBagsOutward}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            // Only allow whole numbers (no decimals)
                            if (newValue === '' || /^\d+$/.test(newValue)) {
                              setTotalBagsOutward(newValue);
                            }
                          }}
                          min="0"
                          step="1"
                          className="bg-white border-orange-200"
                          placeholder="e.g. 5"
                          onKeyDown={(e) => {
                            // Prevent decimal point entry
                            if (e.key === '.' || e.key === ',') {
                              e.preventDefault();
                            }
                          }}
                          title="Enter target bags for this vehicle entry"
                        />
                        <div className="text-xs text-gray-600 mt-1">
                          Stack bags below must sum to this value
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Stack-wise Entry Details */}
                  <div className="col-span-2 mt-4">
                    <h3 className="text-orange-800 font-semibold mb-3 border-b border-orange-200 pb-1">Stack-wise Entry Details</h3>
                    
                    {/* Stack entries will be loaded dynamically based on inward data */}
                    <div className="mb-4">
                      {/* Stack-wise entry */}
                      <div className="border p-4 rounded-md bg-gray-50 mb-4">
                        <h3 className="text-md font-semibold mb-3">
                          Stack-wise Entry{gatepass && ` (${gatepass})`}
                        </h3>
                        
                        {stackEntries.length === 0 ? (
                          <p className="text-sm text-gray-500">Select a Delivery Order first to load stack information</p>
                        ) : (
                          <div className="space-y-4">
                            {/* Header */}
                            <div className="grid grid-cols-4 gap-3 text-sm font-medium text-gray-600 mb-1">
                              <div>Stack No.</div>
                              <div>Inward Bags</div>
                              <div>Outward Bags</div>
                              <div>Balance Bags</div>
                            </div>
                            
                            {/* Stack entries */}
                            {stackEntries.map((entry, index) => (
                              <div key={index} className="grid grid-cols-4 gap-3">
                                <div>
                                  <Input 
                                    value={entry.stackNo} 
                                    onChange={(e) => {
                                      const newEntries = [...stackEntries];
                                      newEntries[index].stackNo = e.target.value;
                                      setStackEntries(newEntries);
                                    }}
                                    className="bg-white"
                                  />
                                </div>
                                <div>
                                  <Input 
                                    value={entry.inwardBags || 0} 
                                    readOnly
                                    className="bg-gray-100 border-gray-300 text-gray-600"
                                  />
                                </div>
                                <div>
                                  <Input 
                                    type="number"
                                    value={entry.bags} 
                                    onChange={(e) => {
                                      const newEntries = [...stackEntries];
                                      const newBags = e.target.value;
                                      const inwardBags = entry.inwardBags || 0;
                                      
                                      // Validate that outward bags don't exceed inward bags
                                      if (parseInt(newBags) > inwardBags) {
                                        alert(`Cannot release more bags than available in inward. Max available: ${inwardBags} bags`);
                                        return;
                                      }
                                      
                                      newEntries[index].bags = newBags;
                                      
                                      // Calculate balance bags for this entry
                                      const outwardBags = parseInt(newBags) || 0;
                                      newEntries[index].balanceBags = inwardBags - outwardBags;
                                      
                                      setStackEntries(newEntries);
                                      
                                      // Note: Total bags are now calculated from vehicleEntries, not stack entries
                                    }}
                                    className="bg-white"
                                    placeholder={`Max: ${entry.inwardBags || 0}`}
                                    max={entry.inwardBags || 0}
                                  />
                                </div>
                                <div>
                                  <Input 
                                    type="number"
                                    value={entry.balanceBags !== undefined ? entry.balanceBags : (entry.inwardBags || 0)} 
                                    readOnly
                                    className="bg-orange-50 border-orange-200 text-green-800"
                                    title="Automatically calculated: Inward Bags - Outward Bags"
                                  />
                                </div>
                              </div>
                            ))}
                            
                            {/* Totals */}
                            <div className="grid grid-cols-4 gap-3 pt-3 border-t border-gray-200 mt-4">
                              <div className="font-medium">Totals</div>
                              <div className="font-medium">{stackEntries.reduce((sum, entry) => sum + (entry.inwardBags || 0), 0)}</div>
                              <div className="font-medium">{outwardBags || '0'}</div>
                              <div className="font-medium text-green-800">
                                {stackEntries.reduce((sum, entry) => {
                                  const inwardBags = entry.inwardBags || 0;
                                  const outwardBags = parseInt(entry.bags) || 0;
                                  return sum + (inwardBags - outwardBags);
                                }, 0)}
                              </div>
                            </div>
                            
                            {/* Balance information */}
                            {selectedDO && (
                              <div className="bg-orange-50 p-3 rounded-md mt-2">
                                <div className="text-sm font-medium mb-1">Balance after this outward:</div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="text-sm">
                                    Bags: <span className="font-medium">
                                      {currentBalanceBags !== null && outwardBags
                                        ? Math.max(0, Number(currentBalanceBags) - Number(outwardBags))
                                        : currentBalanceBags || '0'
                                      }
                                    </span>
                                  </div>
                                  <div className="text-sm">
                                    Quantity: <span className="font-medium">
                                      {currentBalanceQty !== null && outwardQty
                                        ? Math.max(0, Number(currentBalanceQty) - Number(outwardQty)).toFixed(3)
                                        : (typeof currentBalanceQty === 'number' ? currentBalanceQty.toFixed(3) : '0.000')
                                      }
                                    </span> MT
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Warning if exceeding balance */}
                            {selectedDO && outwardBags && currentBalanceBags !== null && 
                             Number(outwardBags) > Number(currentBalanceBags) && (
                              <div className="bg-red-50 text-red-800 p-3 rounded-md mt-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 inline mr-2">
                                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                                  <line x1="12" y1="9" x2="12" y2="13"></line>
                                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                </svg>
                                Warning: Outward bags ({outwardBags}) exceed available balance ({currentBalanceBags})
                              </div>
                            )}
                            
                            {selectedDO && outwardQty && currentBalanceQty !== null && 
                             Number(outwardQty) > Number(currentBalanceQty) && (
                              <div className="bg-red-50 text-red-800 p-3 rounded-md mt-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 inline mr-2">
                                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                                  <line x1="12" y1="9" x2="12" y2="13"></line>
                                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                </svg>
                                Warning: Outward quantity ({outwardQty} MT) exceeds available balance ({currentBalanceQty.toFixed(3)} MT)
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Attachment - Mandatory */}
                  <div className="col-span-2">
                    <Label htmlFor="attachment" className="text-green-600 font-medium flex items-center">
                      ATTACHMENT (ALL FILE TYPES ALLOWED) 
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Input
                      id="attachment"
                      type="file"
                      className="cursor-pointer bg-white border-orange-200"
                      onChange={(e) => {
                        if (e.target.files) {
                          const filesArray = Array.from(e.target.files) as File[];
                          setFileAttachments([...fileAttachments, ...filesArray]);
                          // Reset the input to allow selecting the same file again
                          e.target.value = '';
                        }
                      }}
                      required={(fileAttachments.length === 0) && ((existingAttachmentUrls || []).length === 0)}
                      multiple
                    />
                    {(existingAttachmentUrls.length > 0 || fileAttachments.length > 0) && (
                      <div className="mt-3 bg-orange-50 p-3 rounded-md border border-orange-100">
                        <Label className="text-orange-800 font-medium mb-2 block">Selected Files:</Label>
                        <div className="space-y-2">
                          {existingAttachmentUrls.map((url, idx) => (
                            <div key={`exist-${idx}`} className="flex items-center justify-between bg-white p-2 rounded border border-orange-100">
                              <a href={url} target="_blank" className="text-sm truncate text-blue-700 underline" rel="noreferrer">Existing File {idx + 1}</a>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 text-red-500"
                                onClick={() => {
                                  const next = [...existingAttachmentUrls];
                                  next.splice(idx, 1);
                                  setExistingAttachmentUrls(next);
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                          {fileAttachments.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-orange-100">
                              <span className="text-sm truncate">{file.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 text-red-500"
                                onClick={() => {
                                  const newFiles = [...fileAttachments];
                                  newFiles.splice(idx, 1);
                                  setFileAttachments(newFiles);
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Remark */}
                  <div className="col-span-2">
                    <Label htmlFor="remark" className="text-green-800 font-medium">REMARK</Label>
                    <Input
                      id="remark"
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      placeholder="Enter remarks..."
                      className="bg-white border-orange-100"
                    />
                  </div>

                  {/* Vehicle entries preview - Table format */}
                  {vehicleEntries.length > 0 && (
                    <div className="col-span-2 mt-4">
                      <h3 className="text-green-700 font-semibold mb-3 flex items-center gap-2">
                        <span>Vehicle Entries Added ({vehicleEntries.length})</span>
                        <span className="text-sm font-normal text-gray-600">- Total: {outwardBags} bags</span>
                      </h3>
                      <div className="bg-green-50 p-4 rounded border border-green-200 max-h-64 overflow-y-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead className="bg-green-600 text-white sticky top-0">
                            <tr>
                              <th className="border border-green-700 px-2 py-2 text-left">Entry #</th>
                              <th className="border border-green-700 px-2 py-2 text-left">Vehicle Number</th>
                              <th className="border border-green-700 px-2 py-2 text-left">Gate Pass</th>
                              <th className="border border-green-700 px-2 py-2 text-left">Weighbridge Name</th>
                              <th className="border border-green-700 px-2 py-2 text-left">Weighbridge Slip No.</th>
                              <th className="border border-green-700 px-2 py-2 text-right">Gross Weight (MT)</th>
                              <th className="border border-green-700 px-2 py-2 text-right">Tare Weight (MT)</th>
                              <th className="border border-green-700 px-2 py-2 text-right">Net Weight (MT)</th>
                              <th className="border border-green-700 px-2 py-2 text-right font-semibold">Outward Bags</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vehicleEntries.map((entry, idx) => (
                              <tr key={idx} className="bg-white hover:bg-green-50">
                                <td className="border border-green-200 px-2 py-2 font-medium text-green-800">{entry.entryNumber}</td>
                                <td className="border border-green-200 px-2 py-2">{entry.vehicleNumber}</td>
                                <td className="border border-green-200 px-2 py-2">{entry.gatepass}</td>
                                <td className="border border-green-200 px-2 py-2">{entry.weighbridgeName}</td>
                                <td className="border border-green-200 px-2 py-2">{entry.weighbridgeSlipNo}</td>
                                <td className="border border-green-200 px-2 py-2 text-right">{entry.grossWeight.toFixed(3)}</td>
                                <td className="border border-green-200 px-2 py-2 text-right">{entry.tareWeight.toFixed(3)}</td>
                                <td className="border border-green-200 px-2 py-2 text-right">{entry.netWeight.toFixed(3)}</td>
                                <td className="border border-green-200 px-2 py-2 text-right font-semibold text-orange-700">{entry.totalBagsOutward}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-100">
                            <tr>
                              <td colSpan={8} className="border border-gray-300 px-2 py-2 text-right font-semibold">Total Outward Bags:</td>
                              <td className="border border-gray-300 px-2 py-2 text-right font-bold text-orange-700 text-sm">{outwardBags}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0 mt-6 sm:mt-8 pt-4 border-t border-orange-100">
              {/* Add Vehicle Entry button - adds vehicle temporarily and updates stack balances */}
              {!isEditMode && selectedDO && (
                <Button type="button" onClick={handleAddVehicleEntry} className="bg-green-600 hover:bg-green-700 text-white px-4 sm:px-6 w-full sm:w-auto order-1" disabled={isUploading}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Vehicle Entry
                </Button>
              )}
              {/* Submit button - creates final outward document with all vehicle entries */}
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white px-4 sm:px-6 w-full sm:w-auto order-2" disabled={isUploading}>
                {isUploading ? (isEditMode ? 'Updating...' : 'Submitting...') : (isEditMode ? 'UPDATE' : 'SUBMIT OUTWARD')}
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="outline" className="border-orange-200 text-orange-800 hover:bg-orange-50 w-full sm:w-auto order-3">Cancel</Button>
              </DialogClose>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Outward Details Dialog */}
      <Dialog open={showOutwardDetails} onOpenChange={setShowOutwardDetails}>
        <DialogContent className="w-[95vw] max-w-5xl h-[95vh] p-3 sm:p-4">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Outward Details</DialogTitle>
          </DialogHeader>
          {selectedOutward && (
            <form id="outward-details-form" className="max-h-[calc(95vh-120px)] overflow-y-auto p-1 sm:p-2">
              {/* CIR-style header */}
              <div className="text-center mb-2">
                <Image src="/Group 86.png" alt="Agrogreen Logo" width={96} height={96} className="w-16 sm:w-20 lg:w-24 h-16 sm:h-20 lg:h-24 rounded-full mx-auto mb-2" />
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-500 tracking-wide mb-1">AGROGREEN WAREHOUSING PRIVATE LTD.</div>
                <div className="text-sm sm:text-base lg:text-lg font-medium text-green-600 mb-2">603, 6th Floor, Princess Business Skyline, Indore, Madhya Pradesh - 452010</div>
                <div className="text-base sm:text-lg lg:text-xl font-bold text-orange-500 mt-4 underline">Outward Details</div>
              </div>
              {/* Responsive grid for fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 lg:gap-x-6 mt-4">
                {/* All fields except attachments */}
                {[
                  { label: 'Outward Code', value: selectedOutward.outwardCode },
                  { label: 'SR/WR No.', value: selectedOutward.srwrNo },
                  { label: 'DO Code', value: selectedOutward.doCode },
                  { label: 'CAD Number', value: selectedOutward.cadNumber },
                  { label: 'State', value: selectedOutward.state },
                  { label: 'Branch', value: selectedOutward.branch },
                  { label: 'Location', value: selectedOutward.location },
                  { label: 'Warehouse Name', value: selectedOutward.warehouseName },
                  { label: 'Warehouse Code', value: selectedOutward.warehouseCode },
                  { label: 'Warehouse Address', value: selectedOutward.warehouseAddress },
                  { label: 'Client Name', value: selectedOutward.client },
                  { label: 'Client Code', value: selectedOutward.clientCode },
                  { label: 'Client Address', value: selectedOutward.clientAddress },
                  { label: 'Warehouse Type', value: selectedOutward.warehouseType || selectedOutward.typeOfWarehouse },
                  { label: 'Type of Business', value: selectedOutward.typeOfBusiness || selectedOutward.businessType },
                  { label: 'Commodity', value: selectedOutward.commodity || selectedOutward.commodityName },
                  { label: 'Variety', value: selectedOutward.variety || selectedOutward.varietyName },
                  { label: 'Inward Bags', value: selectedOutward.inwardBags || selectedOutward.totalBags },
                  { label: 'Inward Quantity (MT)', value: selectedOutward.inwardQuantity || selectedOutward.totalQuantity },
                  { label: 'DO Bags', value: selectedOutward.doBags },
                  { label: 'DO Quantity (MT)', value: selectedOutward.doQuantity },
                  { label: 'Outward Bags', value: selectedOutward.outwardBags },
                  { label: 'Outward Quantity (MT)', value: selectedOutward.outwardQuantity },
                  { label: 'Balance Bags', value: selectedOutward.balanceBags },
                  { label: 'Balance Quantity (MT)', value: selectedOutward.balanceQuantity },
                ].map((f, idx) => (
                  <div key={idx} className="mb-3">
                    <div className="font-bold text-green-600 text-sm sm:text-base mb-1 mt-2 tracking-wide">{f.label}</div>
                    <div className="font-medium text-gray-800 text-sm sm:text-base bg-green-50 rounded-lg p-2 sm:p-3 border border-green-200">{f.value ?? '-'}</div>
                  </div>
                ))}
              </div>
              {/* Vehicle Entries Table - Shows all vehicles under this outward code */}
              {selectedOutward.outwardEntries && selectedOutward.outwardEntries.length > 0 && (
                <div className="mt-6 col-span-full">
                  <div className="font-bold text-orange-600 text-lg mb-3 border-b border-orange-200 pb-2">
                    Vehicle Entries ({selectedOutward.outwardEntries.length})
                  </div>
                  <div className="overflow-x-auto bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <table className="w-full border-collapse text-xs">
                      <thead className="bg-orange-600 text-white">
                        <tr>
                          <th className="border border-orange-700 px-3 py-2 text-left">Entry #</th>
                          <th className="border border-orange-700 px-3 py-2 text-left">Vehicle Number</th>
                          <th className="border border-orange-700 px-3 py-2 text-left">Gate Pass</th>
                          <th className="border border-orange-700 px-3 py-2 text-left">Weighbridge Name</th>
                          <th className="border border-orange-700 px-3 py-2 text-left">Weighbridge Slip No.</th>
                          <th className="border border-orange-700 px-3 py-2 text-right">Gross Weight (MT)</th>
                          <th className="border border-orange-700 px-3 py-2 text-right">Tare Weight (MT)</th>
                          <th className="border border-orange-700 px-3 py-2 text-right">Net Weight (MT)</th>
                          <th className="border border-orange-700 px-3 py-2 text-left">Stack Details</th>
                          <th className="border border-orange-700 px-3 py-2 text-right font-semibold">Outward Bags</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOutward.outwardEntries.map((entry: any, idx: number) => (
                          <tr key={idx} className="bg-white hover:bg-orange-50">
                            <td className="border border-orange-300 px-3 py-2 font-medium text-orange-700">{entry.entryNumber}</td>
                            <td className="border border-orange-300 px-3 py-2">{entry.vehicleNumber || '-'}</td>
                            <td className="border border-orange-300 px-3 py-2">{entry.gatepass || '-'}</td>
                            <td className="border border-orange-300 px-3 py-2">{entry.weighbridgeName || '-'}</td>
                            <td className="border border-orange-300 px-3 py-2">{entry.weighbridgeSlipNo || '-'}</td>
                            <td className="border border-orange-300 px-3 py-2 text-right">{entry.grossWeight?.toFixed(3) || '0.000'}</td>
                            <td className="border border-orange-300 px-3 py-2 text-right">{entry.tareWeight?.toFixed(3) || '0.000'}</td>
                            <td className="border border-orange-300 px-3 py-2 text-right">{entry.netWeight?.toFixed(3) || '0.000'}</td>
                            <td className="border border-orange-300 px-3 py-2">
                              {entry.stackEntries && entry.stackEntries.length > 0 ? (
                                entry.stackEntries.map((stack: any, sIdx: number) => (
                                  <span key={sIdx}>
                                    Stack {stack.stackNo} - {stack.bags}
                                    {sIdx < entry.stackEntries.length - 1 ? ', ' : ''}
                                  </span>
                                ))
                              ) : '-'}
                            </td>
                            <td className="border border-orange-300 px-3 py-2 text-right font-bold text-orange-700">{entry.totalBagsOutward}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-100">
                        <tr>
                          <td colSpan={9} className="border border-gray-400 px-3 py-2 text-right font-bold text-gray-700">Total Outward Bags:</td>
                          <td className="border border-gray-400 px-3 py-2 text-right font-bold text-orange-700 text-base">{selectedOutward.outwardBags}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
              {/* Stack Entries */}

              {/* Attachments row below grid */}
              <div style={{ marginTop: 24 }}>
                <div style={{ fontWeight: 700, color: '#1aad4b', fontSize: 16, marginBottom: 4, marginTop: 12, letterSpacing: 0.2 }}>Attachments</div>
                {(() => {
                  // Collect all attachments from vehicle entries
                  const allAttachments: { url: string; vehicleNumber: string; entryNumber: number }[] = [];
                  if (selectedOutward.outwardEntries && selectedOutward.outwardEntries.length > 0) {
                    selectedOutward.outwardEntries.forEach((entry: any) => {
                      if (entry.attachmentUrls && entry.attachmentUrls.length > 0) {
                        entry.attachmentUrls.forEach((url: string) => {
                          allAttachments.push({
                            url,
                            vehicleNumber: entry.vehicleNumber || 'N/A',
                            entryNumber: entry.entryNumber
                          });
                        });
                      }
                    });
                  }
                  
                  return allAttachments.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {allAttachments.map((attachment, idx) => {
                        const ext = attachment.url.split('.').pop()?.toLowerCase();
                        let label = 'View File';
                        if (ext === 'pdf') label = 'View PDF';
                        else if (ext === 'docx') label = 'View DOCX';
                        else if (["jpg", "jpeg", "png"].includes(ext || '')) label = 'View Image';
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: '#666', fontSize: 14 }}>
                              Vehicle Entry #{attachment.entryNumber} ({attachment.vehicleNumber}):
                            </span>
                            <a href={attachment.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1a56db', textDecoration: 'underline', fontSize: 15 }}>
                              {label}
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span style={{ color: '#888', fontSize: 15 }}>No attachments</span>
                  );
                })()}
              </div>
              {/* Remark section - positioned in left bottom corner */}
              <div style={{ marginTop: 24 }}>
                <div style={{ fontWeight: 700, color: '#1aad4b', fontSize: 16, marginBottom: 4, marginTop: 12, letterSpacing: 0.2 }}>Remark</div>
                <div style={{ fontWeight: 500, color: '#222', fontSize: 16, marginBottom: 8, background: '#f6fef9', borderRadius: 8, padding: '6px 12px', border: '1px solid #e0f2e9', minHeight: '40px' }}>
                  {selectedOutward.remark || '-'}
                </div>
              </div>
              {/* Action buttons at bottom right */}
              <div className="flex flex-col sm:flex-row justify-center sm:justify-end gap-3 sm:gap-4 mt-6 pt-4 border-t border-gray-200">
                {/* Show all buttons when pending or resubmitted */}
                {(selectedOutward.outwardStatus === 'pending' || selectedOutward.outwardStatus === 'resubmitted') && showOutwardActionButtons() && (
                  <>
                    <Button 
                      onClick={async () => {
                        const remarkInput = prompt('Enter approval remark (required):');
                        if (!remarkInput || !remarkInput.trim()) {
                          alert('Approval remark is required.');
                          return;
                        }
                        setOutwardStatusUpdating(true);
                        try {
                          const outwardRef = doc(db, 'outwards', selectedOutward.id);
                          await updateDoc(outwardRef, {
                            outwardStatus: 'approved',
                            statusRemark: remarkInput.trim(),
                            statusUpdatedBy: userRole,
                            statusUpdatedAt: new Date().toISOString()
                          });
                          setShowOutwardDetails(false);
                          
                          // Reload list after status change
                          const outwardCol = collection(db, 'outwards');
                          const snap = await getDocs(outwardCol);
                          const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                          setOutwardEntries(data);
                          setOutwardStatusUpdating(false);
                        } catch (error) {
                          console.error('Error updating outward status:', error);
                          setOutwardStatusUpdating(false);
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 sm:px-6 w-full sm:w-auto"
                      disabled={outwardStatusUpdating}
                    >
                      Approve
                    </Button>
                    <Button 
                      onClick={async () => {
                        const remarkInput = prompt('Enter rejection reason (required):');
                        if (!remarkInput || !remarkInput.trim()) {
                          alert('Rejection remark is required.');
                          return;
                        }
                        
                        setOutwardStatusUpdating(true);
                        try {
                          const outwardRef = doc(db, 'outwards', selectedOutward.id);
                          await updateDoc(outwardRef, {
                            outwardStatus: 'rejected',
                            statusRemark: remarkInput.trim(),
                            statusUpdatedBy: userRole,
                            statusUpdatedAt: new Date().toISOString()
                          });
                          setShowOutwardDetails(false);
                          
                          // Reload list after status change
                          const outwardCol = collection(db, 'outwards');
                          const snap = await getDocs(outwardCol);
                          const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                          setOutwardEntries(data);
                          setOutwardStatusUpdating(false);
                        } catch (error) {
                          console.error('Error updating outward status:', error);
                          setOutwardStatusUpdating(false);
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-6"
                      disabled={outwardStatusUpdating}
                    >
                      Reject
                    </Button>
                  <div></div>
                  </>
                )}
                
                {/* Generate Receipt button - only show when approved */}
                {selectedOutward.outwardStatus === 'approved' && canViewOutwardPDF() && (
                  <Button 
                    type="button" 
                    className="bg-orange-600 hover:bg-orange-700 text-white px-4 sm:px-6 w-full sm:w-auto"
                    onClick={async () => {
                      try {
                        // Import required libraries
                        const html2canvas = (await import('html2canvas')).default;
                        const jsPDF = (await import('jspdf')).default;
                        const entriesForSR = groupedOutwards[selectedOutward.srwrNo] || [selectedOutward];
                        
                        // Create a temporary container for the receipt
                        const tempContainer = document.createElement('div');
                        tempContainer.style.position = 'absolute';
                        tempContainer.style.top = '-9999px';
                        tempContainer.style.left = '-9999px';
                        tempContainer.style.width = '900px';
                        tempContainer.style.background = '#fff';
                        tempContainer.style.fontFamily = 'Arial, sans-serif';
                        tempContainer.style.color = '#222';
                        tempContainer.style.padding = '36px';
                        document.body.appendChild(tempContainer);

                        // Create the receipt HTML content for Page 1
                        tempContainer.innerHTML = `
                          <div id="printable-outward-receipt-page1" style="width: 900px; margin: 0; background: #fff; border-radius: 16px; font-family: Arial, sans-serif; color: #222; padding: 36px;">
                            <!-- Header with logo and address -->
                            <div style="text-align: center; margin-bottom: 8px;">
                              <img src="/Group 86.png" alt="Agrogreen Logo" style="width: 90px; height: 90px; border-radius: 50%; margin: 0 auto 8px;" />
                              <div style="font-size: 28px; font-weight: 700; color: #e67c1f; letter-spacing: 0.5px; margin-bottom: 2px;">AGROGREEN WAREHOUSING PRIVATE LTD.</div>
                              <div style="font-size: 18px; font-weight: 500; color: #1aad4b; margin-bottom: 8px;">603, 6th Floor, Princess Business Skyline, Indore, Madhya Pradesh - 452010</div>
                              <div style="font-size: 20px; font-weight: 700; color: #e67c1f; margin: 24px 0 0 0; text-decoration: underline;">Outward Details</div>
                            </div>
                            
                            <!-- Three-column grid for fields -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 24px; margin-top: 32px;">
                              ${[
                                { label: 'Outward Code', value: selectedOutward.outwardCode },
                                { label: 'SR/WR No.', value: selectedOutward.srwrNo },
                                { label: 'DO Code', value: selectedOutward.doCode },
                                { label: 'CAD Number', value: selectedOutward.cadNumber },
                                { label: 'State', value: selectedOutward.state },
                                { label: 'Branch', value: selectedOutward.branch },
                                { label: 'Location', value: selectedOutward.location },
                                { label: 'Warehouse Name', value: selectedOutward.warehouseName },
                                { label: 'Warehouse Code', value: selectedOutward.warehouseCode },
                                { label: 'Warehouse Address', value: selectedOutward.warehouseAddress },
                                { label: 'Client Name', value: selectedOutward.client },
                                { label: 'Client Code', value: selectedOutward.clientCode },
                                { label: 'Client Address', value: selectedOutward.clientAddress },
                                // Newly added fields next to client address
                                { label: 'Warehouse Type', value: selectedOutward.warehouseType || selectedOutward.typeOfWarehouse || '' },
                                { label: 'Type of Business', value: selectedOutward.typeOfBusiness || selectedOutward.businessType || '' },
                                { label: 'Commodity', value: selectedOutward.commodity || selectedOutward.commodityName || '' },
                                { label: 'Variety', value: selectedOutward.variety || selectedOutward.varietyName || '' },
                                { label: 'Inward Bags', value: selectedOutward.inwardBags || selectedOutward.totalBags || '' },
                                { label: 'Inward Quantity (MT)', value: selectedOutward.inwardQuantity || selectedOutward.totalQuantity || '' },
                                { label: 'DO Bags', value: selectedOutward.doBags },
                                { label: 'DO Quantity (MT)', value: selectedOutward.doQuantity },
                                { label: 'Total Bags Outward', value: selectedOutward.totalBagsOutward },
                                { label: 'Balance Bags', value: selectedOutward.balanceBags },
                                { label: 'Balance Quantity (MT)', value: selectedOutward.balanceQuantity },
                              ].map((f) => `
                                <div style="margin-bottom: 12px;">
                                  <div style="font-weight: 700; color: #1aad4b; font-size: 16px; margin-bottom: 4px; margin-top: 12px; letter-spacing: 0.2px;">${f.label}</div>
                                  <div style="font-weight: 500; color: #222; font-size: 16px; margin-bottom: 8px; background: #f6fef9; border-radius: 8px; padding: 6px 12px; border: 1px solid #e0f2e9;">${f.value ?? '-'}</div>
                                </div>
                              `).join('')}
                            </div>
                            
                            <div style="font-size: 13px; color: #555; text-align: right; margin-top: 24px;">
                              <b>Generated on:</b> ${new Date().toLocaleString()}
                            </div>
                          </div>
                        `;

                        // Wait for images to load
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        // Get the rendered receipt for page 1
                        const printableReceipt = tempContainer.querySelector('#printable-outward-receipt-page1');
                        if (!printableReceipt) {
                          throw new Error("Could not find printable receipt element");
                        }
                        
                        // Create PDF
                        const pdf = new jsPDF('p', 'mm', 'a4');
                        const pageWidth = pdf.internal.pageSize.getWidth();
                        const pageHeight = pdf.internal.pageSize.getHeight();
                        
                        // Create canvas for page 1 with higher scale for better quality
                        const canvas1 = await html2canvas(printableReceipt as HTMLElement, { 
                          scale: 2, 
                          useCORS: true, 
                          backgroundColor: '#fff',
                          logging: false,
                          allowTaint: true,
                          width: 900,
                          height: printableReceipt.scrollHeight
                        });
                        
                        // Calculate image dimensions to fit page width
                        const imgWidth = pageWidth;
                        const imgHeight1 = (canvas1.height * imgWidth) / canvas1.width;
                        
                        // Split page 1 across multiple pages if needed
                        let heightLeft = imgHeight1;
                        let position = 0;
                        let pageCount = 0;
                        
                        while (heightLeft > 0) {
                          // Add image to page
                          pdf.addImage(
                            canvas1.toDataURL('image/jpeg', 1.0),
                            'JPEG',
                            0,
                            position,
                            imgWidth,
                            imgHeight1,
                            `page1-${pageCount}`,
                            'FAST'
                          );
                          
                          heightLeft -= pageHeight;
                          position -= pageHeight;
                          
                          // Add new page if there's more content
                          if (heightLeft > 0) {
                            pdf.addPage();
                            pageCount++;
                          }
                        }
                        
                        // If there are vehicle entries, create page 2
                        if (selectedOutward.outwardEntries && selectedOutward.outwardEntries.length > 0) {
                          // Create page 2 content
                          const tempContainer2 = document.createElement('div');
                          tempContainer2.style.position = 'absolute';
                          tempContainer2.style.top = '-9999px';
                          tempContainer2.style.left = '-9999px';
                          tempContainer2.style.width = '900px';
                          tempContainer2.style.background = '#fff';
                          document.body.appendChild(tempContainer2);
                          
                          tempContainer2.innerHTML = `
                            <div id="printable-outward-receipt-page2" style="width: 900px; margin: 0; background: #fff; border-radius: 16px; font-family: Arial, sans-serif; color: #222; padding: 36px;">
                              <!-- Header with logo and address -->
                              <div style="text-align: center; margin-bottom: 24px;">
                                <img src="/Group 86.png" alt="Agrogreen Logo" style="width: 90px; height: 90px; border-radius: 50%; margin: 0 auto 8px;" />
                                <div style="font-size: 28px; font-weight: 700; color: #e67c1f; letter-spacing: 0.5px; margin-bottom: 2px;">AGROGREEN WAREHOUSING PRIVATE LTD.</div>
                                <div style="font-size: 18px; font-weight: 500; color: #1aad4b; margin-bottom: 8px;">603, 6th Floor, Princess Business Skyline, Indore, Madhya Pradesh - 452010</div>
                                <div style="font-size: 20px; font-weight: 700; color: #e67c1f; margin: 24px 0 16px 0; text-decoration: underline;">Vehicle-wise Outward Entries</div>
                                <div style="font-size: 16px; color: #666; margin-bottom: 24px;">Outward Code: ${selectedOutward.outwardCode}</div>
                              </div>
                              
                              <table style="width: 100%; border-collapse: collapse; border: 1px solid #fde7d2; margin-bottom: 16px;">
                                <thead>
                                  <tr style="background-color: #fff7ed;">
                                    <th style="border: 1px solid #fde7d2; padding: 8px; color: #e67c1f; font-weight: 700; font-size: 13px;">Entry #</th>
                                    <th style="border: 1px solid #fde7d2; padding: 8px; color: #e67c1f; font-weight: 700; font-size: 13px;">Vehicle Number</th>
                                    <th style="border: 1px solid #fde7d2; padding: 8px; color: #e67c1f; font-weight: 700; font-size: 13px;">Gate Pass</th>
                                    <th style="border: 1px solid #fde7d2; padding: 8px; color: #e67c1f; font-weight: 700; font-size: 13px;">Weighbridge Name</th>
                                    <th style="border: 1px solid #fde7d2; padding: 8px; color: #e67c1f; font-weight: 700; font-size: 13px;">Weighbridge Slip No.</th>
                                    <th style="border: 1px solid #fde7d2; padding: 8px; color: #e67c1f; font-weight: 700; font-size: 13px;">Gross Weight (MT)</th>
                                    <th style="border: 1px solid #fde7d2; padding: 8px; color: #e67c1f; font-weight: 700; font-size: 13px;">Net Weight (MT)</th>
                                    <th style="border: 1px solid #fde7d2; padding: 8px; color: #e67c1f; font-weight: 700; font-size: 13px;">Tare Weight (MT)</th>
                                    <th style="border: 1px solid #fde7d2; padding: 8px; color: #e67c1f; font-weight: 700; font-size: 13px;">Stack Details</th>
                                    <th style="border: 1px solid #fde7d2; padding: 8px; color: #e67c1f; font-weight: 700; font-size: 13px;">Outward Bags</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${selectedOutward.outwardEntries.map((entry: any, idx: number) => `
                                    <tr style="background-color: ${idx % 2 === 0 ? '#fff' : '#f9fafb'};">
                                      <td style="border: 1px solid #fde7d2; padding: 8px; text-align: center; font-size: 12px;">${entry.entryNumber || (idx + 1)}</td>
                                      <td style="border: 1px solid #fde7d2; padding: 8px; text-align: center; font-size: 12px;">${entry.vehicleNumber || '-'}</td>
                                      <td style="border: 1px solid #fde7d2; padding: 8px; text-align: center; font-size: 12px;">${entry.gatepass || '-'}</td>
                                      <td style="border: 1px solid #fde7d2; padding: 8px; text-align: center; font-size: 12px;">${entry.weighbridgeName || '-'}</td>
                                      <td style="border: 1px solid #fde7d2; padding: 8px; text-align: center; font-size: 12px;">${entry.weighbridgeSlipNo || '-'}</td>
                                      <td style="border: 1px solid #fde7d2; padding: 8px; text-align: center; font-size: 12px;">${entry.grossWeight ? entry.grossWeight.toFixed(3) : '-'}</td>
                                      <td style="border: 1px solid #fde7d2; padding: 8px; text-align: center; font-size: 12px;">${entry.netWeight ? entry.netWeight.toFixed(3) : '-'}</td>
                                      <td style="border: 1px solid #fde7d2; padding: 8px; text-align: center; font-size: 12px;">${entry.tareWeight ? entry.tareWeight.toFixed(3) : '-'}</td>
                                      <td style="border: 1px solid #fde7d2; padding: 8px; text-align: center; font-size: 12px;">
                                        ${entry.stackEntries && entry.stackEntries.length > 0 
                                          ? entry.stackEntries.map((stack: any, sIdx: number) => 
                                              `Stack ${stack.stackNo} - ${stack.bags}${sIdx < entry.stackEntries.length - 1 ? ', ' : ''}`
                                            ).join('') 
                                          : '-'
                                        }
                                      </td>
                                      <td style="border: 1px solid #fde7d2; padding: 8px; text-align: center; font-size: 12px; font-weight: 700;">${entry.totalBagsOutward || '-'}</td>
                                    </tr>
                                  `).join('')}
                                </tbody>
                                <tfoot>
                                  <tr style="background-color: #f3f4f6;">
                                    <td colspan="9" style="border: 1px solid #fde7d2; padding: 8px; text-align: right; font-weight: 700; font-size: 13px;">Total Outward Bags:</td>
                                    <td style="border: 1px solid #fde7d2; padding: 8px; text-align: center; font-weight: 700; font-size: 14px; color: #e67c1f;">${selectedOutward.outwardBags}</td>
                                  </tr>
                                </tfoot>
                              </table>
                              
                              <div style="font-size: 13px; color: #555; text-align: right; margin-top: 24px;">
                                <b>Generated on:</b> ${new Date().toLocaleString()}
                              </div>
                            </div>
                          `;
                          
                          // Wait for images to load
                          await new Promise(resolve => setTimeout(resolve, 1000));
                          
                          const printableReceipt2 = tempContainer2.querySelector('#printable-outward-receipt-page2');
                          if (printableReceipt2) {
                            // Create canvas for page 2
                            const canvas2 = await html2canvas(printableReceipt2 as HTMLElement, { 
                              scale: 2, 
                              useCORS: true, 
                              backgroundColor: '#fff',
                              logging: false,
                              allowTaint: true,
                              width: 900,
                              height: printableReceipt2.scrollHeight
                            });
                            
                            // Add new page to PDF
                            pdf.addPage();
                            
                            const imgHeight2 = (canvas2.height * imgWidth) / canvas2.width;
                            let heightLeft2 = imgHeight2;
                            let position2 = 0;
                            let page2Count = 0;
                            
                            while (heightLeft2 > 0) {
                              if (page2Count > 0) {
                                pdf.addPage();
                              }
                              
                              pdf.addImage(
                                canvas2.toDataURL('image/jpeg', 1.0),
                                'JPEG',
                                0,
                                position2,
                                imgWidth,
                                imgHeight2,
                                `page2-${page2Count}`,
                                'FAST'
                              );
                              
                              heightLeft2 -= pageHeight;
                              position2 -= pageHeight;
                              page2Count++;
                            }
                          }
                          
                          // Clean up page 2 container
                          document.body.removeChild(tempContainer2);
                        }
                        
                        // Save PDF
                        pdf.save(`outward-receipt-${selectedOutward.outwardCode || ''}.pdf`);
                        
                        // Clean up - remove the temporary element
                        document.body.removeChild(tempContainer);
                        
                      } catch (error: any) {
                        console.error("PDF Generation Error:", error);
                        alert(`Failed to generate PDF: ${error?.message || 'Unknown error'}`);
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2">
                      <polyline points="6 9 6 2 18 2 18 9"></polyline>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2 2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                      <rect x="6" y="14" width="12" height="8"></rect>
                    </svg>
                    Generate Receipt
                  </Button>
                )}
              </div>
            </form>
          )}
          
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="w-full sm:w-auto">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}