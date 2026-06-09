"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useRoleAccess } from '@/hooks/use-role-access';
import { useEffect } from 'react';
import Image from 'next/image';
import DashboardLayout from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Search, Download, Plus, Eye } from 'lucide-react';
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, addDoc, updateDoc } from 'firebase/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';

import { DataTable } from '@/components/data-table';

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

export default function DeliveryOrderPage() {
  const { user } = useAuth();
  const router = useRouter();
  const {
    canCreateDeliveryOrder,
    canApproveDeliveryOrder,
    canRejectDeliveryOrder,
    canResubmitDeliveryOrder,
    canViewDOPDF,
    showDOActionButtons,
    canEditDORemark
  } = useRoleAccess();
  
  // Extract user role from user object
  const userRole = user?.role || 'admin'; // Default to admin if user or role is undefined
  
  // Log user role to debug
  React.useEffect(() => {
    console.log('Current user:', user);
    console.log('Current userRole:', userRole);
  }, [user, userRole]);
  
  // Placeholder state for search
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [roOptions, setRoOptions] = React.useState([] as any[]);
  const [roSearch, setRoSearch] = React.useState('');
  const [selectedRO, setSelectedRO] = React.useState(null as any);
  const searchInputRef = React.useRef(null as HTMLInputElement | null);
  const [doBags, setDoBags] = React.useState('');
  const [doQty, setDoQty] = React.useState('');
  const [fileAttachments, setFileAttachments] = React.useState([] as File[]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [formError, setFormError] = React.useState(null as string | null);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);
  const [currentBalanceBags, setCurrentBalanceBags] = React.useState(null as number | null);
  const [currentBalanceQty, setCurrentBalanceQty] = React.useState(null as number | null);
  const [deliveryOrders, setDeliveryOrders] = React.useState([] as any[]);
  const [showDODetails, setShowDODetails] = React.useState(false);
  const [selectedDO, setSelectedDO] = React.useState(null as any);
  const [remark, setRemark] = React.useState('');
  const [doStatusUpdating, setDOStatusUpdating] = React.useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 10;

  // Fetch all deliveryOrders for the table
  React.useEffect(() => {
    const fetchDOs = async () => {
      const doCol = collection(db, 'deliveryOrders');
      const snap = await getDocs(doCol);
  let data = snap.docs.map((doc: any, idx: number) => {
        const d = doc.data();
        // Ensure doCode and doStatus
        return {
          id: doc.id,
          ...d,
          doCode: d.doCode || `DO-${String(idx + 1).padStart(4, '0')}`,
          doStatus: d.doStatus || 'pending',
        };
      });
      // Sort by doCode ascending (DO-0001, DO-0002, etc.)
  data.sort((a: any, b: any) => (a.doCode || '').localeCompare(b.doCode || ''));
      setDeliveryOrders(data);
    };
    fetchDOs();
  }, [submitSuccess, doStatusUpdating]);

  // Helper to get balance from DB if not present in row
  const getBalanceBags = (row: any) => {
    if (typeof row.balanceBags === 'number') return row.balanceBags;
    if (row.balanceBags && !isNaN(Number(row.balanceBags))) return Number(row.balanceBags);
    // Use releaseBags instead of totalBags for balance calculation
    if (typeof row.releaseBags === 'number' && typeof row.doBags === 'number') {
      return row.releaseBags - row.doBags;
    }
    return '';
  };
  
  const getBalanceQty = (row: any) => {
    let balance;
    if (typeof row.balanceQuantity === 'number') {
      balance = row.balanceQuantity;
    } else if (row.balanceQuantity && !isNaN(Number(row.balanceQuantity))) {
      balance = Number(row.balanceQuantity);
    } else if (typeof row.releaseQuantity === 'number' && typeof row.doQuantity === 'number') {
      // Use releaseQuantity instead of totalQuantity for balance calculation
      balance = row.releaseQuantity - row.doQuantity;
    } else {
      return '';
    }
    return typeof balance === 'number' ? balance.toFixed(3) : balance;
  };

  // Group deliveryOrders by srwrNo, show only latest per group
  const [expandedRows, setExpandedRows] = React.useState({} as { [key: string]: boolean });
  const groupedDOs: { [key: string]: any[] } = {};
  deliveryOrders.forEach((ro: any) => {
    if (!groupedDOs[ro.srwrNo]) groupedDOs[ro.srwrNo] = [];
    groupedDOs[ro.srwrNo].push(ro);
  });
  // Sort each group by createdAt descending
  Object.values(groupedDOs).forEach(group => group.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
  // Only show latest per group in main table
  const latestDOs = Object.values(groupedDOs).map(group => group[0]);
  
  // Filter DO entries based on search term
  const filteredDOs = React.useMemo(() => {
    if (!searchTerm) return latestDOs;
    
    const searchLower = searchTerm.toLowerCase();
    return latestDOs.filter(deliveryOrder => {
      const doCode = (deliveryOrder.doCode || '').toLowerCase();
      const srwrNo = (deliveryOrder.srwrNo || '').toLowerCase();
      const state = (deliveryOrder.state || '').toLowerCase();
      const branch = (deliveryOrder.branch || '').toLowerCase();
      const location = (deliveryOrder.location || '').toLowerCase();
      const warehouseName = (deliveryOrder.warehouseName || '').toLowerCase();
      const warehouseCode = (deliveryOrder.warehouseCode || '').toLowerCase();
      const clientName = (deliveryOrder.client || '').toLowerCase();
      
      return doCode.includes(searchLower) ||
             srwrNo.includes(searchLower) ||
             state.includes(searchLower) ||
             branch.includes(searchLower) ||
             location.includes(searchLower) ||
             warehouseName.includes(searchLower) ||
             warehouseCode.includes(searchLower) ||
             clientName.includes(searchLower);
    });
  }, [searchTerm, latestDOs]);

  // Calculate paginated data
  const currentPageData = React.useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredDOs.slice(startIndex, endIndex);
  }, [filteredDOs, currentPage, pageSize]);

  // Reset to first page when search term changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Determine what action buttons/status to show based on DO status
  const getDOActionElements = React.useCallback((doItem: any) => {
    const status = doItem.doStatus || 'pending';
    const normalizedStatus = status.toLowerCase();
    
    // For resubmitted DOs, only show status and edit button
    if (normalizedStatus === 'resubmitted' || normalizedStatus === 'resubmit') {
      return {
        showStatus: true,
        showViewButton: false,
        showEditButton: true,
        statusOnly: true
      };
    }
    
    // For rejected DOs, only show status (no action buttons)
    if (normalizedStatus === 'rejected' || normalizedStatus === 'reject') {
      return {
        showStatus: true,
        showViewButton: false,
        showEditButton: false,
        statusOnly: true
      };
    }
    
    // For other statuses, show status and view button
    return {
      showStatus: true,
      showViewButton: true,
      showEditButton: false,
      statusOnly: false
    };
  }, []);

  // Reset form to initial state
  const resetForm = React.useCallback(() => {
    setRoSearch('');
    setSelectedRO(null);
    setSelectedDO(null);
    setDoBags('');
    setDoQty('');
    setFileAttachments([]);
    setFormError(null);
    setRemark('');
    setCurrentBalanceBags(null);
    setCurrentBalanceQty(null);
  }, []);

  // Handle editing resubmitted DO
  const handleEditResubmittedDO = React.useCallback((doItem: any) => {
    // Find the original RO/inward entry this DO was based on
    const originalEntry = roOptions.find((opt: any) => opt.srwrNo === doItem.srwrNo);
    
    if (!originalEntry) {
      alert('Cannot find original RO/Inward entry for this DO. Please refresh and try again.');
      return;
    }

    // Pre-populate the form with existing DO data
    setSelectedRO(originalEntry);
    setDoBags(doItem.doBags?.toString() || '');
    setDoQty(doItem.doQuantity?.toString() || '');
    setRemark(doItem.remark || '');
    
    // Set file attachments if they exist
    if (doItem.attachmentUrls && Array.isArray(doItem.attachmentUrls)) {
      // For existing attachments, we'll show them as URLs since we can't recreate File objects
      // The form will need to handle this case
      setFileAttachments([]);
    }
    
    // Clear any previous errors
    setFormError(null);
    
    // Open the modal for editing
    setShowAddModal(true);
    
    // Store the DO being edited for update instead of creation
    setSelectedDO(doItem);
  }, [roOptions]);

  // Columns for main table
  const doColumns = [
    {
      accessorKey: 'expand',
      header: '',
      cell: ({ row }: any) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setExpandedRows((prev: any) => ({ ...prev, [row.original.srwrNo]: !prev[row.original.srwrNo] }));
          }}
        >
          {expandedRows[row.original.srwrNo] ? '▼' : '▶'}
        </Button>
      ),
    },
    { accessorKey: 'doCode', header: 'DO Code', cell: ({ row }: any) => <div>{row.original.doCode || ''}</div> },
    { accessorKey: 'srwrNo', header: 'SR/WR No.', cell: ({ row }: any) => (
      <div style={{ minWidth: 180 }} className="flex items-center">
        {row.original.isDirectDO ? (
          <span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-2" title="Direct DO (No Bank Details)"></span>
        ) : (
          <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-2" title="Regular DO (From Release Order)"></span>
        )}
        {row.original.srwrNo}
        {row.original.isDirectDO && (
          <span className="ml-2 text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">Direct</span>
        )}
      </div>
    ) },
    { accessorKey: 'state', header: 'State' },
    { accessorKey: 'branch', header: 'Branch' },
    { accessorKey: 'warehouseName', header: 'Warehouse Name' },
    { accessorKey: 'warehouseCode', header: 'Warehouse Code' },
    { accessorKey: 'warehouseAddress', header: 'Warehouse Address' },
    { accessorKey: 'clientCode', header: 'Client Code' },
    { accessorKey: 'clientAddress', header: 'Client Address' },
    { accessorKey: 'totalBags', header: 'Inward Bags' },
    { accessorKey: 'totalQuantity', header: 'Inward Quantity' },
    { accessorKey: 'releaseBags', header: 'Release RO Bags' },
    { accessorKey: 'releaseQuantity', header: 'Release RO Quantity' },
    { accessorKey: 'doBags', header: 'DO Bags', cell: ({ row }: any) => <div>{row.original.doBags || ''}</div> },
    { accessorKey: 'doQuantity', header: 'DO Quantity', cell: ({ row }: any) => <div>{row.original.doQuantity || ''}</div> },
    { accessorKey: 'balanceBags', header: 'Balance Bags', cell: ({ row }: any) => <div>{getBalanceBags(row.original)}</div> },
    { accessorKey: 'balanceQuantity', header: 'Balance Quantity', cell: ({ row }: any) => <div>{getBalanceQty(row.original)}</div> },
    { accessorKey: 'doStatus', header: 'DO Status', cell: ({ row }: any) => {
      const status = row.original.doStatus || 'pending';
      const statusClass = getStatusStyling(status);
      
      return (
        <div className="flex items-center space-x-2 justify-center">
          <span className={statusClass}>{status}</span>
          <Button
            onClick={() => { setSelectedDO(row.original); setShowDODetails(true); }}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-green-600 hover:text-green-800 hover:bg-green-50"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      );
    }},
  ];

  // Placeholder handler for export
  const handleExportCSV = () => {
    // Determine what data to export based on current view
    let dataToExport;
    
    if (searchTerm) {
      // If search is active, export only what's shown in the filtered table (latest per group that match search)
      dataToExport = filteredDOs;
    } else {
      // If no search, export ALL delivery orders (including all historical entries)
      dataToExport = deliveryOrders;
    }

    if (dataToExport.length === 0) {
      alert('No data to export');
      return;
    }

    // Define CSV headers (matching the table columns)
    const headers = [
      'DO Code',
      'SR/WR No.',
      'State',
      'Branch',
      'Location',
      'Warehouse Name',
      'Warehouse Code',
      'Warehouse Address',
      'Client Name',
      'Client Code',
      'Client Address',
      'Inward Bags',
      'Inward Quantity (MT)',
      'Release RO Bags',
      'Release RO Quantity (MT)',
      'DO Bags',
      'DO Quantity (MT)',
      'Balance Bags',
      'Balance Quantity (MT)',
      'DO Status',
      'Is Direct DO',
      'Created Date',
      'Created By',
      'Remark'
    ];

    // Convert data to CSV format
  const csvData = dataToExport.map((do_item: any) => [
      do_item.doCode || '',
      do_item.srwrNo || '',
      do_item.state || '',
      do_item.branch || '',
      do_item.location || '',
      do_item.warehouseName || '',
      do_item.warehouseCode || '',
      do_item.warehouseAddress || '',
      do_item.client || '',
      do_item.clientCode || '',
      do_item.clientAddress || '',
      do_item.totalBags || '',
      typeof do_item.totalQuantity === 'number' ? do_item.totalQuantity.toFixed(3) : (do_item.totalQuantity || ''),
      do_item.isDirectDO ? '-' : (do_item.releaseBags || ''),
      do_item.isDirectDO ? '-' : (typeof do_item.releaseQuantity === 'number' ? do_item.releaseQuantity.toFixed(3) : (do_item.releaseQuantity || '')),
      do_item.doBags || '',
      typeof do_item.doQuantity === 'number' ? do_item.doQuantity.toFixed(3) : (do_item.doQuantity || ''),
      getBalanceBags(do_item),
      getBalanceQty(do_item),
      normalizeStatusText(do_item.doStatus || 'pending'),
      do_item.isDirectDO ? 'Yes' : 'No',
      do_item.createdAt ? new Date(do_item.createdAt).toLocaleDateString('en-GB') : '',
      do_item.createdBy || '',
      do_item.remark || ''
    ]);

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
    
    // Include search info in filename if search is active
    const searchSuffix = searchTerm ? `-filtered-${searchTerm.replace(/[^a-zA-Z0-9]/g, '')}` : '';
    link.setAttribute('href', url);
    link.setAttribute('download', `delivery-orders${searchSuffix}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Fetch both approved ROs and inward entries without bank details for dropdown
  React.useEffect(() => {
    const fetchOptions = async () => {
      // Fetch approved ROs
      const roCol = collection(db, 'releaseOrders');
      const roQ = query(roCol, where('roStatus', '==', 'approved'));
      const roSnap = await getDocs(roQ);
      
      // Fetch all existing DOs to check balances
      const doCol = collection(db, 'deliveryOrders');
      const doSnap = await getDocs(doCol);
  const allDOs = doSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      
      // Fetch all outwards to detect SR/WR with rejected outward entries
      const outwardCol = collection(db, 'outwards');
      const outwardSnap = await getDocs(outwardCol);
      const allOutwards = outwardSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      const srwrWithRejectedOutward = new Set<string>();
      allOutwards.forEach((o: any) => {
        const status = (o.outwardStatus || '').toString().toLowerCase().trim();
        if ((status === 'rejected' || status === 'reject') && o.srwrNo) {
          srwrWithRejectedOutward.add(o.srwrNo);
        }
      });
      
      // Group DOs by SR/WR number for balance calculation
      const dosBySRWR: Record<string, any[]> = {};
      
      // Loop through each DO and group by SR/WR number
      allDOs.forEach((doItem: any) => {
        const srwrNo = doItem.srwrNo;
        if (srwrNo) {
          if (!dosBySRWR[srwrNo]) {
            dosBySRWR[srwrNo] = [];
          }
          dosBySRWR[srwrNo].push(doItem);
        }
      });
      
      // Calculate balances for ROs taking into account existing DOs
  const roData: any[] = roSnap.docs.map((doc: any) => {
        // Get the document data properly typed as 'any' to avoid TypeScript errors
        const docData = doc.data() as any;
        const roData = { 
          id: doc.id, 
          ...docData,
          source: 'ro' // Mark as coming from RO collection
        };
        
        // Calculate remaining balance by checking existing DOs
        const srwrNo = roData.srwrNo as string | undefined;
        const existingDOs = srwrNo ? (dosBySRWR[srwrNo] || []) : [];
        
        // Start with releaseBags and releaseQuantity (same as RO bags/quantity initially)
        let balanceBags = Number(roData.releaseBags || 0);
        let balanceQuantity = Number(roData.releaseQuantity || 0);
        
        // Log for debugging
        console.log(`RO ${srwrNo}: Starting with ${balanceBags} bags, ${balanceQuantity} quantity`);
        
        // Subtract DO quantities from each existing DO - BUT ONLY APPROVED DOs
        if (existingDOs.length > 0) {
          console.log(`Found ${existingDOs.length} existing DOs for ${srwrNo}`);
          
          existingDOs.forEach((doItem: any) => {
            const doStatus = (doItem.doStatus || '').toString().toLowerCase().trim();
            // Subtract quantities from pending and approved DOs
            // Only rejected and resubmitted DOs should not affect available balance
            if (doStatus === 'pending' || doStatus === 'approved' || doStatus === 'approve') {
              const doBags = Number(doItem.doBags || 0);
              const doQty = Number(doItem.doQuantity || 0);
              
              console.log(`Subtracting DO ${doItem.doCode} (${doStatus}): ${doBags} bags, ${doQty} quantity`);
              
              balanceBags -= doBags;
              balanceQuantity -= doQty;
            } else {
              console.log(`Skipping rejected/resubmitted DO ${doItem.doCode} (status: ${doStatus})`);
            }
          });
        }
        
        // Ensure balance doesn't go below zero
        balanceBags = Math.max(0, balanceBags);
        balanceQuantity = Math.max(0, balanceQuantity);
        
        console.log(`RO ${srwrNo}: Final balance ${balanceBags} bags, ${balanceQuantity.toFixed(2)} quantity`);
        
        // Flags for inclusion due to rejections
        const hasRejectedDO = allDOs.some((d: any) => 
          d.srwrNo === srwrNo && (d.doStatus === 'rejected' || d.doStatus === 'reject')
        );
        const hasRejectedOutward = srwrNo ? srwrWithRejectedOutward.has(srwrNo) : false;
        
        // Add calculated balances and flags to RO data
        return {
          ...roData,
          balanceBags,
          balanceQuantity,
          hasRejectedDO,
          hasRejectedOutward
        };
      })
      // Filter out ROs with zero balance - only show positive balance entries
      .filter((ro: any) => {
        // Only include if balance is positive
        return ro.balanceBags > 0;
      });
      
      console.log(`Found ${roData.length} ROs with positive balance`);
      
      // Fetch all inward entries first - ONLY APPROVED entries for Direct DO
      // Note: using 'status' field (not 'srwrStatus') to check for approved entries
      const inwardCol = collection(db, 'inward');
      const inwardQ = query(inwardCol, where('status', '==', 'approved'));
      const inwardSnap = await getDocs(inwardQ);
  const allInwardEntries: any[] = inwardSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      
      // Fetch all inspection entries to check for bank details
      const inspectionCol = collection(db, 'inspections');
      const inspectionSnap = await getDocs(inspectionCol);
  const inspectionEntries: any[] = inspectionSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      
      // Fetch warehouse survey data for bank details information - only active warehouses
      const warehouseCol = collection(db, 'warehouseCreation');
      const warehouseQ = query(warehouseCol, where('status', '==', 'activated'));  // Only get active warehouses
      const warehouseSnap = await getDocs(warehouseQ);
  const warehouseEntries: any[] = warehouseSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      
      console.log("Active warehouses count:", warehouseEntries.length);
      
      // Log all active warehouses to see their structure
      warehouseEntries.forEach((wh, idx) => {
        console.log(`[${idx}] Active warehouse: ${wh.warehouseName} (${wh.warehouseCode})`);
        console.log(`Bank details object:`, JSON.stringify(wh.bankDetails || {}));
        
        // Check for specific bank fields at root level
        const bankFields = ['bankName', 'bankBranch', 'bankState', 'ifscCode'];
        const foundBankFields = bankFields.filter(field => wh[field] && wh[field].trim() !== '');
        
        if (foundBankFields.length > 0) {
          console.log(`⚠️ WARNING: Direct bank fields found for ${wh.warehouseName}:`, 
            foundBankFields.map(field => `${field}=${wh[field]}`).join(', '));
        }
      });
      
      // IMPROVED: Filter inward entries to only show those EXPLICITLY CONFIRMED to have no bank details
      const inwardData: any[] = allInwardEntries
        .filter(entry => {
          // Get warehouse name and code for this entry
          const warehouseName = entry.warehouseName?.toLowerCase().trim() || '';
          const warehouseCode = entry.warehouseCode?.toLowerCase().trim() || '';
          
          console.log(`\nChecking inward entry: ${warehouseName} (${warehouseCode})`);
          
          // Special check for wh-6 (WH-0007) which we know has bank details
          if ((warehouseCode === 'wh-0007' || warehouseName === 'wh-6')) {
            console.log(`⚠️ BLOCKING: This is warehouse wh-6 (WH-0007) which has SBI bank details (SBIN0123456)`);
            return false;
          }
          
          // Enhanced logging for debugging
          console.log(`🔍 DETAILED CHECK FOR: ${entry.warehouseName} (${entry.warehouseCode})`);
          
          // FIRST CHECK: Does this warehouse exist in the active warehouses list?
          const matchingWarehouse = warehouseEntries.find(
            wh => (wh.warehouseName?.toLowerCase().trim() === warehouseName ||
                  wh.warehouseCode?.toLowerCase().trim() === warehouseCode) &&
                  wh.status === 'activated'
          );
          
          // If we found an active warehouse, check its bank details
          if (matchingWarehouse) {
            console.log(`Found matching active warehouse in surveys: ${matchingWarehouse.warehouseName}`);
            console.log(`Full warehouse data: ${JSON.stringify(matchingWarehouse, null, 2)}`);
            
            // Direct bank fields check - some warehouses might have these at root level
            const directBankFields = ['bankName', 'bankBranch', 'bankState', 'ifscCode'];
            for (const field of directBankFields) {
              if (matchingWarehouse[field] && typeof matchingWarehouse[field] === 'string' && matchingWarehouse[field].trim() !== '') {
                console.log(`⚠️ Warehouse has direct bank field: ${field} = ${matchingWarehouse[field]}`);
                return false;
              }
            }
            
            // Check if bank details exist and have content
            if (matchingWarehouse.bankDetails) {
              // Check various bank detail fields
              if (matchingWarehouse.bankDetails.name && matchingWarehouse.bankDetails.name.trim() !== '') {
                console.log(`⚠️ Warehouse has bank name: ${matchingWarehouse.bankDetails.name}`);
                return false;
              }
              if (matchingWarehouse.bankDetails.accountNumber && matchingWarehouse.bankDetails.accountNumber.trim() !== '') {
                console.log(`⚠️ Warehouse has account number`);
                return false;
              }
              if (matchingWarehouse.bankDetails.ifscCode && matchingWarehouse.bankDetails.ifscCode.trim() !== '') {
                console.log(`⚠️ Warehouse has IFSC code: ${matchingWarehouse.bankDetails.ifscCode}`);
                return false;
              }
              
              // Check if the bankDetails object has any properties at all
              if (Object.keys(matchingWarehouse.bankDetails).length > 0) {
                for (const key in matchingWarehouse.bankDetails) {
                  const value = matchingWarehouse.bankDetails[key];
                  if (value && typeof value === 'string' && value.trim() !== '') {
                    console.log(`⚠️ Warehouse has bank details: ${key} = ${value}`);
                    return false;
                  }
                }
              }
            }
            
            console.log(`No bank details found in active warehouse survey`);
          } else {
            console.log(`No matching active warehouse found in surveys`);
          }
          
          // SECOND CHECK: Does it have bank details in inspection?
          const matchingInspections = inspectionEntries.filter(
            insp => insp.warehouseName?.toLowerCase().trim() === warehouseName || 
                    insp.warehouseCode?.toLowerCase().trim() === warehouseCode
          );
          
          console.log(`Found ${matchingInspections.length} matching inspection records for ${warehouseName} (${warehouseCode})`);
          
          // Check ALL matching inspections for bank details
          for (const matchingInspection of matchingInspections) {
            console.log(`Checking inspection record: ${matchingInspection.id} - ${matchingInspection.warehouseName}`);
            
            // Check for bankName directly (sometimes used instead of bankDetails.name)
            if (matchingInspection.bankName && matchingInspection.bankName.trim() !== '') {
              console.log(`⚠️ Inspection has bank name (direct property): ${matchingInspection.bankName}`);
              return false;
            }
            
            // Check for ifscCode directly (sometimes used instead of bankDetails.ifscCode)
            if (matchingInspection.ifscCode && matchingInspection.ifscCode.trim() !== '') {
              console.log(`⚠️ Inspection has IFSC code (direct property): ${matchingInspection.ifscCode}`);
              return false;
            }
            
            // Check bankDetails object if present
            if (matchingInspection.bankDetails) {
              console.log(`Inspection has bankDetails object: ${JSON.stringify(matchingInspection.bankDetails)}`);
              
              // Check various bank detail fields
              if (matchingInspection.bankDetails.name && matchingInspection.bankDetails.name.trim() !== '') {
                console.log(`⚠️ Inspection has bank name: ${matchingInspection.bankDetails.name}`);
                return false;
              }
              if (matchingInspection.bankDetails.accountNumber && matchingInspection.bankDetails.accountNumber.trim() !== '') {
                console.log(`⚠️ Inspection has account number`);
                return false;
              }
              if (matchingInspection.bankDetails.ifscCode && matchingInspection.bankDetails.ifscCode.trim() !== '') {
                console.log(`⚠️ Inspection has IFSC code: ${matchingInspection.bankDetails.ifscCode}`);
                return false;
              }
              
              // Check if the bankDetails object has any properties at all
              if (Object.keys(matchingInspection.bankDetails).length > 0) {
                for (const key in matchingInspection.bankDetails) {
                  const value = matchingInspection.bankDetails[key];
                  if (value && typeof value === 'string' && value.trim() !== '') {
                    console.log(`⚠️ Inspection has bank details: ${key} = ${value}`);
                    return false;
                  }
                }
              }
            }
          }
          
          // THIRD CHECK: Does the inward entry itself have bank details?
          // Check specific bank fields from inward collection: bankName, bankBranch, bankFundedBy
          const hasBankName = entry.bankName && entry.bankName.trim() !== '';
          const hasBankBranch = entry.bankBranch && entry.bankBranch.trim() !== '';
          const hasBankFundedBy = entry.bankFundedBy && entry.bankFundedBy.trim() !== '' && entry.bankFundedBy !== '-';
          
          if (hasBankName || hasBankBranch || hasBankFundedBy) {
            console.log(`⚠️ Inward has bank details - bankName: ${entry.bankName}, bankBranch: ${entry.bankBranch}, bankFundedBy: ${entry.bankFundedBy}`);
            return false;
          }
          
          // If we got here, no bank details were found (all 3 fields are empty or default values)
          console.log(`✅ NO BANK DETAILS FOUND - allowing for Direct DO (bankName: "${entry.bankName}", bankBranch: "${entry.bankBranch}", bankFundedBy: "${entry.bankFundedBy}")`);
          return true;
        })
        .map(entry => {
          // Debug info with clearly visible marker to find in console
          console.log(`============================`);
          console.log(`🔶 ALLOWING DIRECT DO for warehouse: ${entry.warehouseName} (${entry.warehouseCode}) - NO BANK DETAILS FOUND`);
          console.log(`============================`);
          
          // Format similar to RO entries
          return {
            id: entry.id,
            srwrNo: `${entry.receiptType || 'SR'}-${entry.inwardId || ''}-${entry.dateOfInward || ''}`,
            cadNumber: entry.cadNumber,
            state: entry.state,
            branch: entry.branch,
            location: entry.location,
            warehouseName: entry.warehouseName,
            warehouseCode: entry.warehouseCode,
            warehouseAddress: entry.warehouseAddress,
            client: entry.client,
            clientCode: entry.clientCode,
            clientAddress: entry.clientAddress,
            totalBags: entry.totalBags,
            totalQuantity: entry.totalQuantity,
            // These direct inwards don't have release values, so we use total as release
            releaseBags: entry.totalBags,
            releaseQuantity: entry.totalQuantity,
            source: 'inward', // Mark as coming from inward collection
            directDO: true // Flag that this is for direct DO creation
          };
        })
        .map(inwardEntry => {
          // Calculate remaining balance by checking existing DOs - same logic as for ROs
          const srwrNo = inwardEntry.srwrNo as string;
          const existingDOs = srwrNo ? (dosBySRWR[srwrNo] || []) : [];
          
          // Start with releaseBags and releaseQuantity
          let balanceBags = Number(inwardEntry.releaseBags || 0);
          let balanceQuantity = Number(inwardEntry.releaseQuantity || 0);
          
          // Log for debugging
          console.log(`Inward ${srwrNo}: Starting with ${balanceBags} bags, ${balanceQuantity} quantity`);
          
          // Subtract DO quantities from each existing DO - BUT ONLY APPROVED DOs
          if (existingDOs.length > 0) {
            console.log(`Found ${existingDOs.length} existing DOs for inward ${srwrNo}`);
            
            existingDOs.forEach((doItem: any) => {
              const doStatus = (doItem.doStatus || '').toString().toLowerCase().trim();
              // Only subtract quantities from approved DOs
              if (doStatus === 'approved' || doStatus === 'approve') {
                const doBags = Number(doItem.doBags || 0);
                const doQty = Number(doItem.doQuantity || 0);
                
                console.log(`Subtracting approved DO ${doItem.doCode}: ${doBags} bags, ${doQty} quantity`);
                
                balanceBags -= doBags;
                balanceQuantity -= doQty;
              } else {
                console.log(`Skipping non-approved DO ${doItem.doCode} (status: ${doStatus})`);
              }
            });
          }
          
          // Ensure balance doesn't go below zero
          balanceBags = Math.max(0, balanceBags);
          balanceQuantity = Math.max(0, balanceQuantity);
          
          // Flags for inclusion due to rejections
            const hasRejectedDO = allDOs.some((d: any) => 
              d.srwrNo === srwrNo && (d.doStatus === 'rejected' || d.doStatus === 'reject')
            );
            const hasRejectedOutward = srwrNo ? srwrWithRejectedOutward.has(srwrNo) : false;

            // Add calculated balances and flags to inward data
            return {
              ...inwardEntry,
              balanceBags,
              balanceQuantity,
              hasRejectedDO,
              hasRejectedOutward
            };
        })
        // Filter out inward entries with zero balance - only show positive balance entries
          .filter(entry => {
          // Only include if balance is positive
          return entry.balanceBags > 0;
        });
      
      console.log(`Found ${inwardData.length} inward entries with positive balance`);
      
      // Combine both sets of options
      const combinedOptions = [...roData, ...inwardData];
      console.log(`Total of ${combinedOptions.length} options available for DO creation`);
      setRoOptions(combinedOptions);
    };
    fetchOptions();
  }, [submitSuccess, doStatusUpdating]);

  // Listen for RO data updates from other modules to refresh options
  React.useEffect(() => {
    const handleRODataUpdate = () => {
      console.log('DO section: Detected RO data update, refreshing options...');
      // Trigger options refresh by updating a local state
      setSubmitSuccess(prev => !prev);
    };

    window.addEventListener('roDataUpdated', handleRODataUpdate);
    
    return () => {
      window.removeEventListener('roDataUpdated', handleRODataUpdate);
    };
  }, []);

  // Filtered options for dropdown - Enhanced search functionality focusing on SR/WR numbers
  const filteredROOptions = React.useMemo(() => {
    // If search is empty, show all options
    if (!roSearch || roSearch.trim() === '') return roOptions;
    
    const searchLower = roSearch.toLowerCase().trim();
    
    // DEBUG - Log the search term to console to help with troubleshooting
    console.log('Searching for:', searchLower);
  console.log('Available options:', roOptions.map((opt: any) => opt.srwrNo));
    
    // First try to find exact matches on SR/WR No
  const exactMatches = roOptions.filter((opt: any) => {
      const srwr = `${opt.srwrNo || ''}`.toLowerCase();
      return srwr === searchLower;
    });
    
    // If we have exact matches, just return those
    if (exactMatches.length > 0) {
  console.log('Found exact matches:', exactMatches.map((opt: any) => opt.srwrNo));
      return exactMatches;
    }
    
    // Otherwise, look for partial matches prioritizing SR/WR numbers
  const partialMatches = roOptions.filter((opt: any) => {
      // Start with SR/WR No as primary search field
      const srwr = `${opt.srwrNo || ''}`.toLowerCase();
      
      // Check if SR/WR contains the search term
      if (srwr.includes(searchLower)) {
        return true;
      }
      
      // Secondary fields for broader search
      const warehouseName = `${opt.warehouseName || ''}`.toLowerCase();
      const warehouseCode = `${opt.warehouseCode || ''}`.toLowerCase();
      const clientCode = `${opt.clientCode || ''}`.toLowerCase();
      
      // Include "no bank" as a search term for direct DO entries
      const source = opt.source === 'inward' 
        ? 'no bank details direct do without bank' 
        : opt.roCode?.toLowerCase() || '';
      
      // Return true if any of these fields contain the search term
      return warehouseName.includes(searchLower) || 
             warehouseCode.includes(searchLower) || 
             clientCode.includes(searchLower) ||
             source.includes(searchLower);
    });
    
  console.log('Found partial matches:', partialMatches.map((opt: any) => opt.srwrNo));
    return partialMatches;
  }, [roOptions, roSearch]);

  // When RO is selected, update form fields
  React.useEffect(() => {
    const updateFormFields = () => {
      if (!selectedRO) {
        setCurrentBalanceBags(null);
        setCurrentBalanceQty(null);
        return;
      }
      
      // Calculate balance bags and quantity
      let balanceBags = 0;
      let balanceQty = 0;
      
      // If balanceBags is already in the data, use it
      if (selectedRO.balanceBags !== undefined && selectedRO.balanceBags !== null) {
        balanceBags = Number(selectedRO.balanceBags);
      } 
      // Otherwise calculate from releaseBags
      else if (selectedRO.releaseBags !== undefined && selectedRO.releaseBags !== null) {
        balanceBags = Number(selectedRO.releaseBags);
      }
      
      // If balanceQuantity is already in the data, use it
      if (selectedRO.balanceQuantity !== undefined && selectedRO.balanceQuantity !== null) {
        balanceQty = Number(selectedRO.balanceQuantity);
      }
      // Otherwise calculate from releaseQuantity
      else if (selectedRO.releaseQuantity !== undefined && selectedRO.releaseQuantity !== null) {
        balanceQty = Number(selectedRO.releaseQuantity);
      }
      
      setCurrentBalanceBags(balanceBags);
      setCurrentBalanceQty(balanceQty);
    };
    updateFormFields();
  }, [selectedRO]);

  // Auto-fill when only 1 bag remains
  React.useEffect(() => {
    if (currentBalanceBags === 1 && currentBalanceQty !== null && !selectedDO) {
      setDoBags('1');
      setDoQty(currentBalanceQty.toString());
    }
  }, [currentBalanceBags, currentBalanceQty, selectedDO]);
  
  // Reset search and focus the search input when modal opens
  React.useEffect(() => {
    if (showAddModal) {
      // Clear previous search when opening the modal
      setRoSearch('');
      // Focus the search input after a short delay to ensure the modal is fully rendered
      setTimeout(() => {
        const searchInput = document.querySelector('input[placeholder="Type to search by SR/WR No..."]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }, 100);
    }
  }, [showAddModal]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedRO) {
      setFormError('Please select an RO');
      return;
    }

    // Check if this is an edit operation
    const isEditMode = !!selectedDO;
    
    // Check for mandatory attachment (only for new DOs)
    if (!isEditMode && fileAttachments.length === 0) {
      setFormError('Please upload at least one attachment');
      return;
    }

    // Validate DO bags and quantity
    let dbBags = Number(doBags);
    let dQuantity = Number(doQty);
    const balanceBags = currentBalanceBags || 0;
    const balanceQty = currentBalanceQty || 0;

    // Check if balance is zero - if so, prevent creation
    if (balanceBags <= 0 || balanceQty <= 0) {
      setFormError('No remaining balance available for this Release Order');
      return;
    }

    if (isNaN(dbBags) || dbBags <= 0) {
      setFormError('Please enter valid number of bags');
      return;
    }
    
    // Validate that DO bags is a whole number
    if (!Number.isInteger(dbBags)) {
      setFormError('DO Bags must be a whole number (no decimals allowed).');
      return;
    }
    if (isNaN(dQuantity) || dQuantity <= 0) {
      setFormError('Please enter valid quantity');
      return;
    }
    
    // If this is the last bag, automatically adjust to use all remaining quantity
    if (dbBags === balanceBags) {
      dQuantity = balanceQty;
      setDoQty(balanceQty.toString());
    }
    
    if (dbBags > balanceBags) {
      setFormError(`Cannot release more than available balance bags (${balanceBags})`);
      return;
    }
    if (dQuantity > balanceQty) {
      setFormError(`Cannot release more than available balance quantity (${balanceQty})`);
      return;
    }

    try {
      setIsUploading(true);
      let attachmentUrls: string[] = [];
      let hasUploadErrors = false;

      // Upload attachments if any
      if (fileAttachments.length > 0) {
        for (const file of fileAttachments) {
          try {
            console.log(`Uploading file: ${file.name}, type: ${file.type}, size: ${file.size}`);
            const result = await uploadToCloudinary(file);
            if (result && result.secure_url) {
              console.log(`Upload successful: ${result.secure_url}`);
              attachmentUrls.push(result.secure_url);
            }
          } catch (uploadError) {
            hasUploadErrors = true;
            console.error(`Error uploading file ${file.name}:`, uploadError);
            // Continue with next file even if this one fails
          }
        }
        
        // Show warning if some uploads failed
        if (hasUploadErrors && attachmentUrls.length < fileAttachments.length) {
          alert(`Some files failed to upload. ${attachmentUrls.length} of ${fileAttachments.length} were successful.`);
        }
      }

      // Prepare DO data
      const newBalanceBags = balanceBags - dbBags;
      const newBalanceQty = balanceQty - dQuantity;

      if (isEditMode) {
        // Update existing DO
        const deliveryOrdersCol = collection(db, 'deliveryOrders');
        const q = query(deliveryOrdersCol, where('doCode', '==', selectedDO.doCode));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const docRef = snap.docs[0].ref;
          const updateData = {
            doBags: dbBags,
            doQuantity: dQuantity,
            balanceBags: newBalanceBags,
            balanceQuantity: newBalanceQty,
            remark: remark,
            doStatus: 'pending', // Reset status to pending after edit
            updatedAt: new Date().toISOString(),
            updatedBy: userRole,
            // Update attachments if new ones were provided
            ...(attachmentUrls.length > 0 && { attachmentUrls })
          };
          
          await updateDoc(docRef, updateData);
        }
      } else {
        // Get next DO code number
        const doCol = collection(db, 'deliveryOrders');
        const doSnap = await getDocs(doCol);
        const doCount = doSnap.size;
        const newDOCode = `DO-${String(doCount + 1).padStart(4, '0')}`;

        // Create new DO record
        const doData = {
          doCode: newDOCode,
          srwrNo: selectedRO.srwrNo,
          cadNumber: selectedRO.cadNumber,
          state: selectedRO.state,
          branch: selectedRO.branch,
          location: selectedRO.location,
          warehouseName: selectedRO.warehouseName,
          warehouseCode: selectedRO.warehouseCode,
          warehouseAddress: selectedRO.warehouseAddress,
          client: selectedRO.client,
          clientCode: selectedRO.clientCode,
          clientAddress: selectedRO.clientAddress,
          totalBags: selectedRO.totalBags,
          totalQuantity: selectedRO.totalQuantity,
          releaseBags: selectedRO.releaseBags,
          releaseQuantity: selectedRO.releaseQuantity,
          doBags: dbBags,
          doQuantity: dQuantity,
          balanceBags: newBalanceBags,
          balanceQuantity: newBalanceQty,
          attachmentUrls,
          remark: remark,
          doStatus: 'pending',
          createdAt: new Date().toISOString(),
          createdBy: userRole, // Already has a default value
          // Add source information
          isDirectDO: selectedRO.source === 'inward',
          source: selectedRO.source || 'ro'
        };

        await addDoc(collection(db, 'deliveryOrders'), doData);
      }
      
      setSubmitSuccess(true);
      setIsUploading(false);
      setShowAddModal(false);
      resetForm();

      // Reset success flag after a delay
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error('Error submitting DO:', error);
      // Display a more specific error message if available
      if (error?.message?.includes('Cloudinary')) {
        setFormError(`File upload error: ${error.message}. Please try again with different files or formats.`);
      } else {
        setFormError(`An error occurred: ${error?.message || 'Unknown error'}. Please try again.`);
      }
      setIsUploading(false);
    }
  };

  // Handle DO status change
  const handleDOStatusChange = async (newStatus: string) => {
    if (!selectedDO) return;
    
    // Validate that remark is provided for checker actions
    if (!remark.trim()) {
      alert('Remark is required for checker actions (approve/reject/resubmit).');
      return;
    }
    
    try {
      setDOStatusUpdating(true);
      
      // Update the status in Firestore
      const deliveryOrdersCol = collection(db, 'deliveryOrders');
      const q = query(deliveryOrdersCol, where('doCode', '==', selectedDO.doCode));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const docRef = snap.docs[0].ref;
        await updateDoc(docRef, { 
          doStatus: newStatus,
          statusUpdatedAt: new Date().toISOString(),
          statusUpdatedBy: userRole, // Already has a default value
          statusRemark: remark || '' // Ensure remark is not undefined
        });
      }
      
      setShowDODetails(false);
      setSelectedDO(null);
      setRemark('');
      setDOStatusUpdating(false);
      
      // Dispatch event to notify other modules of DO data update
      window.dispatchEvent(new CustomEvent('doDataUpdated', {
        detail: { timestamp: Date.now() }
      }));
    } catch (error) {
      console.error('Error updating DO status:', error);
      setDOStatusUpdating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
          <Button onClick={() => router.push('/dashboard')} variant="ghost" className="flex items-center bg-orange-500 text-white hover:bg-orange-600 w-full sm:w-auto text-sm sm:text-base px-3 py-2 sm:px-4">
            ← Dashboard
          </Button>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-orange-600 text-center flex-1">Delivery Order</h1>
          {canCreateDeliveryOrder() && (
            <Button onClick={() => {
              resetForm();
              setShowAddModal(true);
            }} className="bg-green-500 hover:bg-green-600 text-white w-full sm:w-auto text-sm sm:text-base px-3 py-2 sm:px-4">
              <Plus className="h-4 w-4 mr-2" /> Add DO
            </Button>
          )}
        </div>

        {/* Search and Export */}
        <div className="bg-green-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 border border-green-200">
          <div className="text-base sm:text-lg font-semibold text-green-800 mb-2 sm:mb-3">Search & Export Options</div>
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1">
              <span className="text-gray-600 text-xs sm:text-sm whitespace-nowrap">Search:</span>
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Search by DO Code, SR/WR No, State..."
                  className="pl-8 pr-8 w-full sm:w-[300px] md:w-[400px] text-sm"
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
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
              <div className="text-xs sm:text-sm text-gray-600">
                Showing {Math.min((currentPage - 1) * pageSize + 1, filteredDOs.length)}-{Math.min(currentPage * pageSize, filteredDOs.length)} of {filteredDOs.length}
                {searchTerm && ` (filtered from ${latestDOs.length})`}
              </div>
            </div>
            <Button onClick={handleExportCSV} className="bg-blue-500 hover:bg-blue-600 text-white text-sm w-full sm:w-auto px-3 py-2 sm:px-4">
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="py-2 sm:py-3 px-3 sm:px-4 bg-green-50 border-b border-green-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
              <h2 className="text-green-700 text-base sm:text-xl font-semibold">Delivery Orders</h2>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-6">
                <div className="flex items-center">
                  <span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-2"></span>
                  <span className="text-xs sm:text-sm text-gray-700">Direct DO (No Bank)</span>
                </div>
                <div className="flex items-center">
                  <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
                  <span className="text-xs sm:text-sm text-gray-700">Regular DO (From RO)</span>
                </div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto -mx-2 sm:mx-0" style={{ maxHeight: '70vh' }}>
            <table className="min-w-[1400px] border text-xs sm:text-sm w-full">
              <thead className="bg-orange-100 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-1 border sticky left-0 bg-orange-100 z-20 text-xs"></th>
                  <th className="px-2 py-1 border sticky left-[60px] bg-orange-100 z-20 text-xs">DO Code</th>
                  <th className="px-2 py-1 border text-xs">SR/WR No.</th>
                  <th className="px-2 py-1 border text-xs">State</th>
                  <th className="px-2 py-1 border text-xs">Branch</th>
                  <th className="px-2 py-1 border text-xs">Location</th>
                  <th className="px-2 py-1 border text-xs">Warehouse Name</th>
                  <th className="px-2 py-1 border text-xs">Warehouse Code</th>
                  <th className="px-2 py-1 border text-xs">Warehouse Address</th>
                  <th className="px-2 py-1 border text-xs">Client Name</th>
                  <th className="px-2 py-1 border text-xs">Client Code</th>
                  <th className="px-2 py-1 border text-xs">Client Address</th>
                  <th className="px-2 py-1 border text-xs">Inward Bags</th>
                  <th className="px-2 py-1 border text-xs">Inward Quantity (MT)</th>
                  <th className="px-2 py-1 border text-xs">Release RO Bags</th>
                  <th className="px-2 py-1 border text-xs">Release RO Quantity (MT)</th>
                  <th className="px-2 py-1 border text-xs">DO Bags</th>
                  <th className="px-2 py-1 border text-xs">DO Quantity (MT)</th>
                  <th className="px-2 py-1 border text-xs">Balance Bags</th>
                  <th className="px-2 py-1 border text-xs">Balance Quantity (MT)</th>
                  <th className="px-2 py-1 border text-xs">DO Status</th>
                  <th className="px-2 py-1 border text-xs">Remark</th>
                </tr>
              </thead>
              <tbody>
                {currentPageData.length === 0 ? (
                  <tr>
                    <td colSpan={22} className="px-2 py-8 text-center text-gray-500">
                      {deliveryOrders.length === 0 
                        ? "No delivery orders found. Click 'Add DO' to create your first entry."
                        : "No delivery orders match your search criteria. Try adjusting your search terms."
                      }
                    </td>
                  </tr>
                ) : (
                  currentPageData.map((do_item: any) => (
                  <React.Fragment key={do_item.doCode}>
                    <tr className="even:bg-gray-50">
                      <td className="px-2 py-1 border sticky left-0 bg-white z-10">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1"
                          onClick={() => {
                            setExpandedRows((prev: any) => ({ ...prev, [do_item.srwrNo]: !prev[do_item.srwrNo] }));
                          }}
                        >
                          {expandedRows[do_item.srwrNo] ? '▼' : '▶'}
                        </Button>
                      </td>
                      <td className="px-2 py-1 border sticky left-[60px] bg-white z-10" style={{ minWidth: '100px' }}>
                        <div className="flex items-center justify-start">
                          {do_item.isDirectDO ? (
                            <span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-2" title="Direct DO (No Bank Details)"></span>
                          ) : (
                            <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-2" title="Regular DO (From Release Order)"></span>
                          )}
                          {do_item.doCode || ''}
                        </div>
                      </td>
                      <td className="px-2 py-1 border" style={{ minWidth: '180px' }}>
                        <div className="flex items-center justify-start">
                          {do_item.isDirectDO ? (
                            <span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-2" title="Direct DO (No Bank Details)"></span>
                          ) : (
                            <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-2" title="Regular DO (From Release Order)"></span>
                          )}
                          {do_item.srwrNo}
                          {do_item.isDirectDO && (
                            <span className="ml-2 text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">Direct</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1 border">{do_item.state}</td>
                      <td className="px-2 py-1 border">{do_item.branch}</td>
                      <td className="px-2 py-1 border">{do_item.location}</td>
                      <td className="px-2 py-1 border">{do_item.warehouseName}</td>
                      <td className="px-2 py-1 border">{do_item.warehouseCode}</td>
                      <td className="px-2 py-1 border">{do_item.warehouseAddress}</td>
                      <td className="px-2 py-1 border">{do_item.client}</td>
                      <td className="px-2 py-1 border">{do_item.clientCode}</td>
                      <td className="px-2 py-1 border">{do_item.clientAddress}</td>
                      <td className="px-2 py-1 border">{do_item.totalBags}</td>
                      <td className="px-2 py-1 border">{typeof do_item.totalQuantity === 'number' ? do_item.totalQuantity.toFixed(3) : do_item.totalQuantity}</td>
                      <td className="px-2 py-1 border">{do_item.isDirectDO ? '-' : do_item.releaseBags}</td>
                      <td className="px-2 py-1 border">{do_item.isDirectDO ? '-' : (typeof do_item.releaseQuantity === 'number' ? do_item.releaseQuantity.toFixed(3) : do_item.releaseQuantity)}</td>
                      <td className="px-2 py-1 border">{do_item.doBags || ''}</td>
                      <td className="px-2 py-1 border">{typeof do_item.doQuantity === 'number' ? do_item.doQuantity.toFixed(3) : (do_item.doQuantity || '')}</td>
                      <td className="px-2 py-1 border">{getBalanceBags(do_item)}</td>
                      <td className="px-2 py-1 border">{getBalanceQty(do_item)}</td>
                      <td className="px-2 py-1 border">
                        {(() => {
                          const actionElements = getDOActionElements(do_item);
                          return (
                            <div className="flex items-center justify-center gap-2">
                              {actionElements.showStatus && (
                                <span className={getStatusStyling(do_item.doStatus || 'pending')}>
                                  {normalizeStatusText(do_item.doStatus || 'pending')}
                                </span>
                              )}
                              {actionElements.showViewButton && (
                                <Button
                                  onClick={() => { setSelectedDO(do_item); setShowDODetails(true); }}
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-800 hover:bg-green-50"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                              {actionElements.showEditButton && (
                                <Button
                                  onClick={() => handleEditResubmittedDO(do_item)}
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                  title="Edit Resubmitted DO"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </Button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-2 py-1 border">
                        <div className="text-xs text-gray-600">
                          {do_item.statusRemark || do_item.remark || '-'}
                        </div>
                      </td>
                    </tr>
                    {expandedRows[do_item.srwrNo] && groupedDOs[do_item.srwrNo] && groupedDOs[do_item.srwrNo].length > 0 && (
                      <tr>
                        <td colSpan={22} className="p-0">
                          <div className="bg-gray-50 p-4">
                            <div className="text-sm font-medium mb-2">Previous Delivery Orders for this SR/WR</div>
                            <div className="overflow-x-auto">
                              <table className="w-full border text-xs">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-2 py-1 border">Date</th>
                                    <th className="px-2 py-1 border">DO Code</th>
                                    <th className="px-2 py-1 border">DO Bags</th>
                                    <th className="px-2 py-1 border">DO Qty</th>
                                    <th className="px-2 py-1 border">Balance Bags</th>
                                    <th className="px-2 py-1 border">Balance Qty</th>
                                    <th className="px-2 py-1 border">DO Status</th>
                                    <th className="px-2 py-1 border">Attachment</th>
                                    <th className="px-2 py-1 border">Remark</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {groupedDOs[do_item.srwrNo].map((entry, idx) => (
                                    <tr key={entry.doCode || idx} className="even:bg-gray-100">
                                      <td className="px-2 py-1 border text-center">{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('en-GB') : ''}</td>
                                      <td className="px-2 py-1 border text-center">{entry.doCode}</td>
                                      <td className="px-2 py-1 border text-center">{entry.doBags}</td>
                                      <td className="px-2 py-1 border text-center">{entry.doQuantity}</td>
                                      <td className="px-2 py-1 border text-center">{entry.balanceBags}</td>
                                      <td className="px-2 py-1 border text-center">{entry.balanceQuantity}</td>
                                      <td className="px-2 py-1 border text-center">
                                        {(() => {
                                          const actionElements = getDOActionElements(entry);
                                          return (
                                            <div className="flex items-center justify-center gap-2">
                                              {actionElements.showStatus && (
                                                <span className={getStatusStyling(entry.doStatus || 'pending')}>
                                                  {normalizeStatusText(entry.doStatus || 'pending')}
                                                </span>
                                              )}
                                              {actionElements.showViewButton && (
                                                <Button variant="ghost" size="sm" className="p-1" title="View Details" onClick={() => { setSelectedDO(entry); setShowDODetails(true); }}>
                                                  <Eye className="h-4 w-4 text-green-600" />
                                                </Button>
                                              )}
                                              {actionElements.showEditButton && (
                                                <Button
                                                  variant="ghost"
                                                  size="sm" 
                                                  className="p-1"
                                                  title="Edit Resubmitted DO"
                                                  onClick={() => handleEditResubmittedDO(entry)}
                                                >
                                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                  </svg>
                                                </Button>
                                              )}
                                            </div>
                                          );
                                        })()}
                                      </td>
                                      <td className="px-2 py-1 border text-center">
                                        {Array.isArray(entry.attachmentUrls) && entry.attachmentUrls.length > 0 ? 
                                          <a href={entry.attachmentUrls[0]} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a> : 
                                          <span className="text-gray-400">No file</span>
                                        }
                                      </td>
                                      <td className="px-2 py-1 border text-center">
                                        <div className="text-xs text-gray-600">
                                          {entry.statusRemark || entry.remark || '-'}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {filteredDOs.length > pageSize && (
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-0 mt-4 px-3 sm:px-4">
              <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                Showing {Math.min((currentPage - 1) * pageSize + 1, filteredDOs.length)} to {Math.min(currentPage * pageSize, filteredDOs.length)} of {filteredDOs.length} entries
              </div>
              <div className="flex items-center justify-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="px-2 py-1 text-xs sm:px-3 sm:text-sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-xs sm:text-sm text-gray-600">
                  Page {currentPage} of {Math.ceil(filteredDOs.length / pageSize)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="px-2 py-1 text-xs sm:px-3 sm:text-sm"
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredDOs.length / pageSize), prev + 1))}
                  disabled={currentPage === Math.ceil(filteredDOs.length / pageSize)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Add DO Dialog */}
        <Dialog open={showAddModal} onOpenChange={(open) => {
          setShowAddModal(open);
          // Clear form when closing the modal
          if (!open) {
            resetForm();
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
            <div>
              <DialogTitle className="text-base sm:text-xl text-center text-orange-600 font-bold">
                {selectedDO ? 'EDIT DELIVERY ORDER (DO)' : 'DELIVERY ORDER (DO) / DIRECT DO'}
                <div className="mt-1 text-sm font-normal text-gray-600">
                  {selectedDO 
                    ? `Edit resubmitted Delivery Order: ${selectedDO.doCode}`
                    : 'Create a Delivery Order based on a Release Order or directly for entries without bank details'
                  }
                </div>
              </DialogTitle>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto pr-1">
              {formError && <div className="bg-red-100 p-3 mb-4 text-red-600 rounded-md text-center font-medium">{formError}</div>}
              
              <div className="space-y-3 sm:space-y-5 pt-3 sm:pt-4">
                {/* RO Selection */}
                <div className="bg-green-50 p-3 sm:p-4 rounded-md border border-green-200">
                  <Label htmlFor="ro-select" className="text-green-800 font-semibold text-sm sm:text-lg mb-2 block">
                    Select Release Order (RO) or Entry Without Bank Details
                  </Label>
                  {filteredROOptions.some((opt: any) => opt.source === 'inward') && (
                    <div className="mb-2 px-3 py-2 bg-orange-100 text-orange-800 rounded-md text-sm flex items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <strong>Direct DO Entries:</strong> Items with <span className="inline-block w-2 h-2 rounded-full bg-orange-500 mx-1"></span> orange indicator are warehouses with NO bank details. The system strictly checks active warehouses from the survey section and only allows direct DO for those specifically confirmed to have no bank details. Check browser console logs for detailed bank details verification.
                      </div>
                    </div>
                  )}
                  <div className="relative">
                    {/*  */}
                    {roSearch && (
                      <div className="text-xs mb-2">
                        <span className={`${filteredROOptions.length > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {filteredROOptions.length} {filteredROOptions.length === 1 ? 'result' : 'results'} found
                          {filteredROOptions.length === 0 && roSearch.length > 0 && " - Try partial SR/WR number"}
                        </span>
                      </div>
                    )}
                    
                    {/* Debug info */}
                    <div className="text-xs mb-2 text-blue-600">
                      Available options: {roOptions.length} | 
                      Filtered: {filteredROOptions.length} | 
                      Showing only entries with positive balance (0 balance entries hidden)
                    </div>
                    
                    <Select
                      value={selectedRO?.id || ''}
                      onValueChange={(value: string) => {
                        const selected = roOptions.find((ro: any) => ro.id === value);
                        setSelectedRO(selected || null);
                      }}
                    >
                      <SelectTrigger id="ro-select" className="bg-white">
                        <SelectValue placeholder="Select RO or Direct SR/WR" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        <Input
                          ref={searchInputRef}
                          placeholder="Type to filter..."
                          value={roSearch}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRoSearch(e.target.value)}
                          className="mb-2 sticky top-0 z-10"
                        />
                        {filteredROOptions
                          .filter((option: any) => {
                            // Only show entries with positive balance (hide 0 balance entries)
                            const balanceBags = option.balanceBags !== undefined ? 
                              Number(option.balanceBags) : 
                              (option.releaseBags !== undefined ? Number(option.releaseBags) : 0);
                            return balanceBags > 0;
                          })
                          .length === 0 ? (
                          <div className="px-2 py-4 text-center text-sm text-gray-500">
                            No options found matching &quot;{roSearch}&quot;
                          </div>
                        ) : (
                          filteredROOptions
                          .filter((option: any) => {
                            // Only show entries with positive balance (hide 0 balance entries)
                            const balanceBags = option.balanceBags !== undefined ? 
                              Number(option.balanceBags) : 
                              (option.releaseBags !== undefined ? Number(option.releaseBags) : 0);
                            return balanceBags > 0;
                          })
                          .map((option: any) => {
                            // Get the balance for display
                            const balanceBags = option.balanceBags !== undefined ? 
                              Number(option.balanceBags) : 
                              (option.releaseBags !== undefined ? Number(option.releaseBags) : 0);
                          
                          return (
                            <SelectItem 
                              key={option.id} 
                              value={option.id} 
                              className={option.source === 'inward' ? "bg-orange-50 text-orange-800 font-medium" : ""}
                            >
                              {option.source === 'inward' ? (
                                <span className="flex items-center">
                                  <span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-2"></span>
                                  {option.srwrNo} <span className="ml-1 font-semibold">(No Bank Details - Direct DO)</span>
                                </span>
                              ) : (
                                <span>
                                  {option.srwrNo} - {option.roCode}
                                  <span className="ml-2 text-green-700">
                                    (Balance: {balanceBags} bags, {option.balanceQuantity ? Number(option.balanceQuantity).toFixed(2) : '0.00'} MT)
                                  </span>
                                  {option.hasRejectedDO && (
                                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-pink-100 text-red-600 align-middle">
                                      Rejected DO
                                    </span>
                                  )}
                                </span>
                              )}
                            </SelectItem>
                          );
                        })
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Auto-populated Fields */}
                {selectedRO && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 p-3 sm:p-4 bg-green-50 rounded-md border border-green-200">
                    <div>
                      <Label className="text-green-800 font-medium">CAD NUMBER</Label>
                      <Input value={selectedRO.cadNumber || ''} readOnly className="bg-white border-green-100" />
                    </div>
                    <div>
                      <Label className="text-green-800 font-medium">STATE</Label>
                      <Input value={selectedRO.state || ''} readOnly className="bg-white border-green-100" />
                    </div>
                    <div>
                      <Label className="text-green-800 font-medium">BRANCH</Label>
                      <Input value={selectedRO.branch || ''} readOnly className="bg-white border-green-100" />
                    </div>
                    <div>
                      <Label className="text-green-800 font-medium">LOCATION</Label>
                      <Input value={selectedRO.location || ''} readOnly className="bg-white border-green-100" />
                    </div>
                    <div>
                      <Label className="text-green-800 font-medium">WAREHOUSE NAME</Label>
                      <Input value={selectedRO.warehouseName || ''} readOnly className="bg-white border-green-100" />
                    </div>
                    <div>
                      <Label className="text-green-800 font-medium">WAREHOUSE CODE</Label>
                      <Input value={selectedRO.warehouseCode || ''} readOnly className="bg-white border-green-100" />
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <Label className="text-green-800 font-medium">WAREHOUSE ADDRESS</Label>
                      <Input value={selectedRO.warehouseAddress || ''} readOnly className="bg-white border-green-100" />
                    </div>
                    <div>
                      <Label className="text-green-800 font-medium">CLIENT NAME</Label>
                      <Input value={selectedRO.client || ''} readOnly className="bg-white border-green-100" />
                    </div>
                    <div>
                      <Label className="text-green-800 font-medium">CLIENT CODE</Label>
                      <Input value={selectedRO.clientCode || ''} readOnly className="bg-white border-green-100" />
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <Label className="text-green-800 font-medium">CLIENT ADDRESS</Label>
                      <Input value={selectedRO.clientAddress || ''} readOnly className="bg-white border-green-100" />
                    </div>
                    
                    <div>
                      <Label className="text-green-800 font-medium">INWARD BAGS</Label>
                      <Input value={selectedRO.totalBags || ''} readOnly className="bg-white border-green-100" />
                    </div>
                    <div>
                      <Label className="text-green-800 font-medium">INWARD QUANTITY (MT)</Label>
                      <Input value={typeof selectedRO.totalQuantity === 'number' ? selectedRO.totalQuantity.toFixed(3) : (selectedRO.totalQuantity || '')} readOnly className="bg-white border-green-100" />
                    </div>
                    <div>
                      <Label className="text-green-800 font-medium">RELEASE RO BAGS</Label>
                      <Input value={selectedRO.isDirectDO ? '-' : (selectedRO.releaseBags || '')} readOnly className="bg-white border-green-100" />
                    </div>
                    <div>
                      <Label className="text-green-800 font-medium">RELEASE RO QUANTITY (MT)</Label>
                      <Input value={selectedRO.isDirectDO ? '-' : (typeof selectedRO.releaseQuantity === 'number' ? selectedRO.releaseQuantity.toFixed(3) : (selectedRO.releaseQuantity || ''))} readOnly className="bg-white border-green-100" />
                    </div>

                    {/* Input fields */}
                    <div>
                      <Label htmlFor="doBags" className="text-orange-600 font-medium">DO BAGS</Label>
                      <Input
                        id="doBags"
                        type="number"
                        value={doBags}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const newValue = e.target.value;
                          // Only allow whole numbers (no decimals)
                          if (newValue === '' || /^\d+$/.test(newValue)) {
                            setDoBags(newValue);
                            // If user entered exactly the remaining balance bags, auto-set quantity too
                            if (Number(newValue) === currentBalanceBags) {
                              setDoQty(currentBalanceQty?.toString() || "0");
                            }
                          }
                        }}
                        min="0"
                        step="1"
                        required
                        className="bg-white border-orange-200"
                        onKeyDown={(e) => {
                          // Prevent decimal point entry
                          if (e.key === '.' || e.key === ',') {
                            e.preventDefault();
                          }
                        }}
                      />
                      {currentBalanceBags === 1 && (
                        <div className="text-xs text-blue-600 mt-1">
                          This is the last bag - full remaining quantity will be used
                        </div>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="doQty" className="text-orange-600 font-medium">DO QUANTITY (MT)</Label>
                      <Input
                        id="doQty"
                        type="number"
                        step="0.001"
                        value={doQty}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDoQty(e.target.value)}
                        required
                        className="bg-white border-orange-200"
                        // Auto-set to full remaining quantity if this is the last bag
                        readOnly={Number(doBags) === currentBalanceBags}
                      />
                      {Number(doBags) === currentBalanceBags && (
                        <div className="text-xs text-blue-600 mt-1">
                          Using full remaining quantity for last bag
                        </div>
                      )}
                    </div>

                    {/* Auto calculated balance fields */}
                    <div>
                      <Label className="text-green-800 font-medium">BALANCE BAGS</Label>
                      <Input 
                        value={currentBalanceBags !== null && doBags ? 
                          Math.max(0, Number(currentBalanceBags) - Number(doBags || 0)).toString() : 
                          currentBalanceBags?.toString() || ''} 
                        readOnly 
                        className="bg-green-50 border-green-100"
                      />
                    </div>
                    <div>
                      <Label className="text-green-800 font-medium">BALANCE QUANTITY (MT)</Label>
                      <Input 
                        value={currentBalanceQty !== null && doQty ? 
                          Math.max(0, Number(currentBalanceQty) - Number(doQty || 0)).toFixed(2) : 
                          currentBalanceQty?.toString() || ''} 
                        readOnly 
                        className="bg-green-50 border-green-100"
                      />
                    </div>

                    {/* Existing Attachments (for edit mode) */}
                    {selectedDO && selectedDO.attachmentUrls && Array.isArray(selectedDO.attachmentUrls) && selectedDO.attachmentUrls.length > 0 && (
                      <div className="col-span-1 sm:col-span-2">
                        <Label className="text-blue-600 font-medium">CURRENT ATTACHMENTS</Label>
                        <div className="mt-2 bg-blue-50 p-3 rounded-md border border-blue-100">
                          <div className="space-y-2">
                            {selectedDO.attachmentUrls.map((url: string, idx: number) => {
                              const ext = url.split('.').pop()?.toLowerCase();
                              let label = 'View File';
                              if (ext === 'pdf') label = 'View PDF';
                              else if (ext === 'docx') label = 'View DOCX';
                              else if (["jpg", "jpeg", "png"].includes(ext || '')) label = 'View Image';
                              return (
                                <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-blue-100">
                                  <a 
                                    href={url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-blue-600 underline text-sm truncate"
                                  >
                                    {label} {idx + 1}
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Attachment - Now Mandatory */}
                    <div className="col-span-1 sm:col-span-2">
                      <Label htmlFor="attachment" className="text-orange-600 font-medium flex items-center">
                        {selectedDO ? 'NEW ATTACHMENTS (OPTIONAL)' : 'ATTACHMENT (ALL FILE TYPES ALLOWED)'}
                        {!selectedDO && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                      <Input
                        id="attachment"
                        type="file"
                        className="cursor-pointer bg-white border-orange-200"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          if (e.target.files) {
                            const filesArray = Array.from(e.target.files);
                            setFileAttachments([...fileAttachments, ...filesArray]);
                            // Reset the input to allow selecting the same file again
                            e.target.value = '';
                          }
                        }}
                        required={!selectedDO && fileAttachments.length === 0}
                        multiple
                      />
                      {fileAttachments.length > 0 && (
                        <div className="mt-3 bg-green-50 p-3 rounded-md border border-green-100">
                          <Label className="text-green-800 font-medium mb-2 block">Selected Files:</Label>
                          <div className="space-y-2">
                            {fileAttachments.map((file: File, idx: number) => (
                              <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-green-100">
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
                    <div className="col-span-1 sm:col-span-2">
                      <Label htmlFor="remark" className="text-green-800 font-medium">REMARK</Label>
                      <Input
                        id="remark"
                        value={remark}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRemark(e.target.value)}
                        placeholder="Enter remarks..."
                        className="bg-white border-green-100"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 sm:mt-8 pt-3 sm:pt-4 border-t border-green-100 flex flex-col sm:flex-row gap-2 sm:gap-4 justify-end">
                <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 text-xs sm:px-6 sm:text-sm w-full sm:w-auto" disabled={isUploading}>
                  {isUploading ? (selectedDO ? 'Updating...' : 'Submitting...') : (selectedDO ? 'UPDATE' : 'SUBMIT')}
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="border-green-200 text-green-800 hover:bg-green-50 px-3 py-2 text-xs sm:px-4 sm:text-sm w-full sm:w-auto">Cancel</Button>
                </DialogClose>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* DO Details Dialog */}
        <Dialog open={showDODetails} onOpenChange={setShowDODetails}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
            <div className="border-b border-green-100 pb-4">
           
            </div>
            {selectedDO && (
              <div className="max-h-[80vh] overflow-y-auto p-2">
                {/* Agrogreen Logo and DO Details Header */}
                <div className="flex flex-col items-center justify-center mb-6 sm:mb-8 mt-2">
                  <Image src="/Group 86.png" alt="Agrogreen Logo" width={100} height={80} className="sm:w-[120px] sm:h-[100px] mb-2 rounded-[30%] object-cover" />
                  <div className="text-sm sm:text-lg font-extrabold text-orange-600 mt-2 mb-1 text-center" style={{ letterSpacing: '0.02em' }}>
                    AGROGREEN WAREHOUSING PRIVATE LTD.
                  </div>
                  <div className="text-xs sm:text-base font-semibold text-green-600 mb-2 text-center px-2">
                    603, 6th Floor, Princess Business Skyline, Indore, Madhya Pradesh - 452010
                  </div>
                  <div className="text-sm sm:text-md font-bold text-orange-600 underline text-center mb-2" style={{ letterSpacing: '0.01em' }}>
                    DELIVERY ORDER (DO) DETAILS
                  </div>
                </div>
                
                {/* Removed duplicate header - using the React component header above instead */}
                
                {/* Three-column grid for fields */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '0 24px',
                    marginTop: 32,
                  }}
                >
                  {/* All fields except attachments and remarks */}
                  {[
                    { label: 'DO Code', value: selectedDO.doCode },
                    { label: 'SR/WR No.', value: selectedDO.srwrNo },
                    { label: 'CAD Number', value: selectedDO.cadNumber },
                    { label: 'State', value: selectedDO.state },
                    { label: 'Branch', value: selectedDO.branch },
                    { label: 'Location', value: selectedDO.location },
                    { label: 'Warehouse Name', value: selectedDO.warehouseName },
                    { label: 'Warehouse Code', value: selectedDO.warehouseCode },
                    { label: 'Warehouse Address', value: selectedDO.warehouseAddress },
                    { label: 'Client Name', value: selectedDO.client },
                    { label: 'Client Code', value: selectedDO.clientCode },
                    { label: 'Client Address', value: selectedDO.clientAddress },
                    { label: 'Inward Bags', value: selectedDO.totalBags },
                    { label: 'Inward Quantity (MT)', value: typeof selectedDO.totalQuantity === 'number' ? selectedDO.totalQuantity.toFixed(3) : selectedDO.totalQuantity },
                    { label: 'Release RO Bags', value: selectedDO.isDirectDO ? '-' : selectedDO.releaseBags },
                    { label: 'Release RO Quantity (MT)', value: selectedDO.isDirectDO ? '-' : (typeof selectedDO.releaseQuantity === 'number' ? selectedDO.releaseQuantity.toFixed(3) : selectedDO.releaseQuantity) },
                    { label: 'DO Bags', value: selectedDO.doBags },
                    { label: 'DO Quantity (MT)', value: typeof selectedDO.doQuantity === 'number' ? selectedDO.doQuantity.toFixed(3) : selectedDO.doQuantity },
                    { label: 'Balance Bags', value: getBalanceBags(selectedDO) },
                    { label: 'Balance Quantity (MT)', value: getBalanceQty(selectedDO) },
                  ].map((f, idx) => (
                    <div key={idx} style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, color: '#1aad4b', fontSize: 16, marginBottom: 4, marginTop: 12, letterSpacing: 0.2 }}>{f.label}</div>
                      <div style={{ fontWeight: 500, color: '#222', fontSize: 16, marginBottom: 8, background: '#f6fef9', borderRadius: 8, padding: '6px 12px', border: '1px solid #e0f2e9' }}>{f.value ?? '-'}</div>
                    </div>
                  ))}
                </div>
                
                {/* Attachments row below grid */}
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontWeight: 700, color: '#1aad4b', fontSize: 16, marginBottom: 4, marginTop: 12, letterSpacing: 0.2 }}>Attachment</div>
                  {Array.isArray(selectedDO.attachmentUrls) && selectedDO.attachmentUrls.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {selectedDO.attachmentUrls.map((url: string, idx: number) => {
                        const ext = url.split('.').pop()?.toLowerCase();
                        let label = 'View File';
                        if (ext === 'pdf') label = 'View PDF';
                        else if (ext === 'docx') label = 'View DOCX';
                        else if (["jpg", "jpeg", "png"].includes(ext || '')) label = 'View Image';
                        return (
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#1a56db', textDecoration: 'underline', fontSize: 15 }}>
                            {label} {idx + 1}
                          </a>
                        );
                      })}
                    </div>
                  ) : (
                    <span style={{ color: '#888', fontSize: 15 }}>No file</span>
                  )}
                </div>
                
                {/* Remark section - positioned in left bottom corner */}
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontWeight: 700, color: '#1aad4b', fontSize: 16, marginBottom: 4, marginTop: 12, letterSpacing: 0.2 }}>Remark</div>
                  <div style={{ fontWeight: 500, color: '#222', fontSize: 16, marginBottom: 8, background: '#f6fef9', borderRadius: 8, padding: '6px 12px', border: '1px solid #e0f2e9', minHeight: '40px' }}>
                    {selectedDO.remark || '-'}
                  </div>
                </div>
                

                {/* Generate Receipt Button (only if approved and user has permission) */}
                {selectedDO.doStatus === 'approved' && canViewDOPDF() && (
                  <div className="flex justify-center sm:justify-end mt-2">
                    <Button type="button" className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 text-xs sm:px-4 sm:text-sm w-full sm:w-auto" onClick={async () => {
                      try {
                        // Import required libraries dynamically (following RO pattern)
                        const html2canvas = (await import('html2canvas')).default;
                        const jsPDF = (await import('jspdf')).default;
                        
                        // Create temporary container with 900px width (following RO pattern)
                        const tempContainer = document.createElement('div');
                        tempContainer.style.width = '900px';
                        tempContainer.style.position = 'absolute';
                        tempContainer.style.top = '-9999px';
                        tempContainer.style.left = '0';
                        tempContainer.style.backgroundColor = 'white';
                        tempContainer.style.padding = '40px';
                        tempContainer.style.fontFamily = 'Arial, sans-serif';
                        
                        // Build HTML structure with inline styles (following RO pattern exactly)
                        tempContainer.innerHTML = `
                          <div id="printable-do-receipt">
                            <!-- Header with logo and company details -->
                            <div style="text-align: center; margin-bottom: 30px;">
                              <img src="/Group 86.png" alt="Agrogreen Logo" style="width: 90px; height: 90px; border-radius: 50%; margin: 0 auto 8px;">
                              <div style="font-size: 28px; font-weight: 700; color: #e67c1f; letter-spacing: 0.5px; margin-bottom: 2px;">AGROGREEN WAREHOUSING PRIVATE LTD.</div>
                              <div style="font-size: 18px; font-weight: 500; color: #1aad4b; margin-bottom: 8px;">603, 6th Floor, Princess Business Skyline, Indore, Madhya Pradesh - 452010</div>
                              <div style="font-size: 20px; font-weight: 700; color: #e67c1f; margin: 24px 0 0 0; text-decoration: underline;">DELIVERY ORDER (DO) RECEIPT</div>
                            </div>

                            <!-- Three-column grid for DO data fields -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 24px; margin-top: 32px;">
                              ${[
                                { label: 'DO Code', value: selectedDO.doCode },
                                { label: 'SR/WR No.', value: selectedDO.srwrNo },
                                { label: 'CAD Number', value: selectedDO.cadNumber },
                                { label: 'State', value: selectedDO.state },
                                { label: 'Branch', value: selectedDO.branch },
                                { label: 'Location', value: selectedDO.location },
                                { label: 'Warehouse Name', value: selectedDO.warehouseName },
                                { label: 'Warehouse Code', value: selectedDO.warehouseCode },
                                { label: 'Warehouse Address', value: selectedDO.warehouseAddress },
                                { label: 'Client Name', value: selectedDO.client },
                                { label: 'Client Code', value: selectedDO.clientCode },
                                { label: 'Client Address', value: selectedDO.clientAddress },
                                { label: 'Inward Bags', value: selectedDO.totalBags },
                                { label: 'Inward Quantity (MT)', value: typeof selectedDO.totalQuantity === 'number' ? selectedDO.totalQuantity.toFixed(3) : selectedDO.totalQuantity },
                                { label: 'Release RO Bags', value: selectedDO.isDirectDO ? '-' : selectedDO.releaseBags },
                                { label: 'Release RO Quantity (MT)', value: selectedDO.isDirectDO ? '-' : (typeof selectedDO.releaseQuantity === 'number' ? selectedDO.releaseQuantity.toFixed(3) : selectedDO.releaseQuantity) },
                                { label: 'DO Bags', value: selectedDO.doBags },
                                { label: 'DO Quantity (MT)', value: typeof selectedDO.doQuantity === 'number' ? selectedDO.doQuantity.toFixed(3) : selectedDO.doQuantity },
                                { label: 'Balance Bags', value: getBalanceBags(selectedDO) },
                                { label: 'Balance Quantity (MT)', value: getBalanceQty(selectedDO) }
                              ].map(field => `
                                <div style="margin-bottom: 12px;">
                                  <div style="font-weight: 700; color: #1aad4b; font-size: 16px; margin-bottom: 4px; margin-top: 12px; letter-spacing: 0.2px;">${field.label}</div>
                                  <div style="font-weight: 500; color: #222; font-size: 16px; margin-bottom: 8px; background: #f6fef9; border-radius: 8px; padding: 6px 12px; border: 1px solid #e0f2e9;">${field.value ?? '-'}</div>
                                </div>
                              `).join('')}
                            </div>
                          </div>
                        `;
                        
                        // Append to body (off-screen)
                        document.body.appendChild(tempContainer);
                        
                        // Get the printable element
                        const printableReceipt = document.getElementById('printable-do-receipt');
                        if (!printableReceipt) throw new Error('Printable receipt element not found');
                        
                        // Render to canvas with high quality settings (following RO pattern)
                        const canvas = await html2canvas(printableReceipt, {
                          scale: 2,
                          useCORS: true,
                          backgroundColor: '#ffffff'
                        });
                        
                        // Generate PDF (following RO pattern with multi-page support)
                        const pdf = new jsPDF('p', 'mm', 'a4');
                        const pdfWidth = pdf.internal.pageSize.getWidth();
                        const pdfHeight = pdf.internal.pageSize.getHeight();
                        const imgWidth = canvas.width;
                        const imgHeight = canvas.height;
                        
                        // Calculate scaling to fit page width
                        const ratio = pdfWidth / imgWidth;
                        const scaledHeight = imgHeight * ratio;
                        
                        // Handle multi-page if content exceeds A4 height
                        let heightLeft = scaledHeight;
                        let position = 0;
                        
                        // Add first page
                        pdf.addImage(
                          canvas.toDataURL('image/jpeg', 1.0),
                          'JPEG',
                          0,
                          position,
                          pdfWidth,
                          scaledHeight
                        );
                        heightLeft -= pdfHeight;
                        
                        // Add additional pages if needed
                        while (heightLeft > 0) {
                          position = heightLeft - scaledHeight;
                          pdf.addPage();
                          pdf.addImage(
                            canvas.toDataURL('image/jpeg', 1.0),
                            'JPEG',
                            0,
                            position,
                            pdfWidth,
                            scaledHeight
                          );
                          heightLeft -= pdfHeight;
                        }
                        
                        // Save PDF with DO code in filename
                        pdf.save(`delivery-order-receipt-${selectedDO.doCode}.pdf`);
                        
                        // Cleanup: remove temporary container
                        document.body.removeChild(tempContainer);
                        
                        alert("PDF generated successfully!");
                      } catch (error: any) {
                        console.error("PDF generation error:", error);
                        alert(`Error generating PDF: ${error?.message || 'Unknown error'}`);
                      }
                    }}>
                      Generate Receipt
                    </Button>
                  </div>
                )}
                {/* DO Status Workflow Implementation */}
                {(() => {
                  const status = selectedDO.doStatus;
                  
                  if (status === 'approved') {
                    return (
                      <div className="mt-6 pt-4 border-t border-green-200">
                        {/* Show checker's remark */}
                        {selectedDO.statusRemark && (
                          <div className="mb-4 p-3 bg-green-50 rounded-md border border-green-200">
                            <Label className="text-green-800 font-medium">Checker&apos;s Remark:</Label>
                            <div className="text-green-700 mt-1">{selectedDO.statusRemark}</div>
                          </div>
                        )}
                        
                        {/* Only show generate receipt button */}
                       
                      </div>
                    );
                  } else if (status === 'rejected') {
                    return (
                      <div className="mt-6 pt-4 border-t border-red-200">
                        <div className="p-3 bg-red-50 rounded-md border border-red-200 text-center">
                          <div className="text-red-700 font-medium mb-2">DO Status: REJECTED</div>
                          {selectedDO.statusRemark && (
                            <div>
                              <Label className="text-red-800 font-medium">Checker&apos;s Remark:</Label>
                              <div className="text-red-700 mt-1">{selectedDO.statusRemark}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  } else if (status === 'resubmitted') {
                    return (
                      <div className="mt-6 pt-4 border-t border-orange-200">
                        <div className="p-3 bg-orange-50 rounded-md border border-orange-200">
                          <div className="text-orange-700 font-medium mb-2 text-center">DO Status: RESUBMITTED</div>
                          {selectedDO.statusRemark && (
                            <div className="mb-3">
                              <Label className="text-orange-800 font-medium">Checker&apos;s Remark:</Label>
                              <div className="text-orange-700 mt-1">{selectedDO.statusRemark}</div>
                            </div>
                          )}
                          <div className="text-center">
                            <Button 
                              className="bg-orange-600 hover:bg-orange-700 text-white"
                              onClick={() => {
                                // TODO: Implement edit functionality for resubmitted DO
                                alert('Edit functionality for resubmitted DO will be implemented');
                              }}
                            >
                              Edit DO
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    // Pending status - show approve/reject/resubmit buttons based on permissions
                    return (
                      <div className="mt-6 pt-4 border-t border-green-200">
                        <Label className="text-green-800 font-medium">
                          {canEditDORemark() ? "Update Status with Remark" : "Remark (Read-only)"}
                        </Label>
                        <Input 
                          value={remark} 
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRemark(e.target.value)} 
                          placeholder={canEditDORemark() ? "Enter remark..." : "Read-only"}
                          className="mt-2 border-green-100" 
                          readOnly={!canEditDORemark()}
                        />
                        {/* Status action buttons - only for checkers */}
                        {showDOActionButtons() && (
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-4 justify-end">
                            {canApproveDeliveryOrder() && (
                              <Button 
                                type="button" 
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 text-xs sm:px-4 sm:text-sm w-full sm:w-auto" 
                                onClick={() => handleDOStatusChange('approved')} 
                                disabled={doStatusUpdating}
                              >
                                Approve
                              </Button>
                            )}
                            {canRejectDeliveryOrder() && (
                              <Button 
                                type="button" 
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-xs sm:px-4 sm:text-sm w-full sm:w-auto" 
                                onClick={() => handleDOStatusChange('rejected')} 
                                disabled={doStatusUpdating}
                              >
                                Reject
                              </Button>
                            )}
                            {canResubmitDeliveryOrder() && (
                              <div></div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }
                })()}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}