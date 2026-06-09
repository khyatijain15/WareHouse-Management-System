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
import { collection, getDocs, query, where, addDoc, doc, updateDoc } from 'firebase/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';

import { DataTable } from '@/components/data-table';
import ROReceipt from '@/components/ROReceipt';

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

export default function ReleaseOrderPage() {
  const { user } = useAuth();
  const userRole = user?.role || 'user';
  const router = useRouter();
  const {
    canCreateReleaseOrder,
    canApproveReleaseOrder,
    canRejectReleaseOrder,
    canResubmitReleaseOrder,
    canViewROPDF,
    showROActionButtons,
    canEditRORemark
  } = useRoleAccess();
  // Placeholder state for search
  const [searchTerm, setSearchTerm] = React.useState('');
  // Pagination states
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage] = React.useState(10);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [inwardOptions, setInwardOptions] = React.useState([] as any[]);
  const [inwardSearch, setInwardSearch] = React.useState('');
  const [selectedInward, setSelectedInward] = React.useState(null as any | null);
  const [releaseBags, setReleaseBags] = React.useState('');
  const [releaseQty, setReleaseQty] = React.useState('');
  const [fileAttachments, setFileAttachments] = React.useState([] as File[]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [formError, setFormError] = React.useState(null as string | null);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);
  const [currentBalanceBags, setCurrentBalanceBags] = React.useState(null as number | null);
  const [currentBalanceQty, setCurrentBalanceQty] = React.useState(null as number | null);
  const [releaseOrders, setReleaseOrders] = React.useState([] as any[]);
  const [previousROs, setPreviousROs] = React.useState([] as any[]);
  const [showRODetails, setShowRODetails] = React.useState(false);
  const [selectedRO, setSelectedRO] = React.useState(null as any | null);
  const [remark, setRemark] = React.useState('');
  const [roStatusUpdating, setROStatusUpdating] = React.useState(false);
  const [dataVersion, setDataVersion] = React.useState(0);
  const [editingRO, setEditingRO] = React.useState(null as any | null);

  // Reset form state
  const resetForm = React.useCallback(() => {
    setSelectedInward(null);
    setReleaseBags('');
    setReleaseQty('');
    setFileAttachments([]);
    setEditingRO(null);
    setFormError(null);
    setSubmitSuccess(false);
    setCurrentBalanceBags(null);
    setCurrentBalanceQty(null);
  }, []);

  // Cross-module reflection - dispatch events when data changes
  const dispatchDataUpdate = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent('roDataUpdated', {
      detail: { timestamp: Date.now() }
    }));
  }, []);

  // Determine what action buttons/status to show based on RO status
  const getROActionElements = React.useCallback((ro: any) => {
    const status = ro.roStatus || 'pending';
    const normalizedStatus = status.toLowerCase();
    
    // For resubmitted ROs, only show status and edit button
    if (normalizedStatus === 'resubmitted' || normalizedStatus === 'resubmit') {
      return {
        showStatus: true,
        showViewButton: false,
        showEditButton: true,
        statusOnly: true
      };
    }
    
    // For rejected ROs, only show status (no action buttons)
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

  // Fetch all releaseOrders for the table
  React.useEffect(() => {
    const fetchROs = async () => {
      const roCol = collection(db, 'releaseOrders');
      const snap = await getDocs(roCol);
  let data = snap.docs.map((doc: any, idx: number) => {
        const d = doc.data();
        // Ensure roCode and roStatus
        return {
          id: doc.id,
          ...d,
          roCode: d.roCode || `RO-${String(idx + 1).padStart(4, '0')}`,
          roStatus: d.roStatus || 'pending',
        };
      });
      // Sort by roCode descending (latest first)
  data.sort((a: any, b: any) => (b.roCode || '').localeCompare(a.roCode || ''));
      setReleaseOrders(data);
    };
    fetchROs();
  }, [submitSuccess, roStatusUpdating, dataVersion]);

  // Helper to get balance from DB if not present in row
  const getBalanceBags = (row: any) => {
    if (typeof row.balanceBags === 'number') return row.balanceBags;
    if (row.balanceBags && !isNaN(Number(row.balanceBags))) return Number(row.balanceBags);
    if (typeof row.totalBags === 'number' && typeof row.releaseBags === 'number') {
      return row.totalBags - row.releaseBags;
    }
    return '';
  };
  const getBalanceQty = (row: any) => {
    if (typeof row.balanceQuantity === 'number') return row.balanceQuantity;
    if (row.balanceQuantity && !isNaN(Number(row.balanceQuantity))) return Number(row.balanceQuantity);
    if (typeof row.totalQuantity === 'number' && typeof row.releaseQuantity === 'number') {
      return row.totalQuantity - row.releaseQuantity;
    }
    return '';
  };

  // Group releaseOrders by srwrNo, show only latest per group
  const [expandedRows, setExpandedRows] = React.useState({} as { [key: string]: boolean });
  const groupedROs: { [key: string]: any[] } = {};
  releaseOrders.forEach((ro: any) => {
    if (!groupedROs[ro.srwrNo]) groupedROs[ro.srwrNo] = [];
    groupedROs[ro.srwrNo].push(ro);
  });
  // Sort each group by createdAt descending
  Object.values(groupedROs).forEach(group => group.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
  // Only show latest per group in main table
  const latestROs = Object.values(groupedROs).map(group => group[0]);
  
  // Filter and sort RO entries with comprehensive search and ascending RO code order
  const filteredROs = React.useMemo(() => {
    let filtered = [...latestROs];
    
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(ro => {
        const roCode = (ro.roCode || '').toLowerCase();
        const srwrNo = (ro.srwrNo || '').toLowerCase();
        const state = (ro.state || '').toLowerCase();
        const branch = (ro.branch || '').toLowerCase();
        const location = (ro.location || '').toLowerCase();
        const warehouseName = (ro.warehouseName || '').toLowerCase();
        const warehouseCode = (ro.warehouseCode || '').toLowerCase();
        const clientName = (ro.client || '').toLowerCase();
        const roStatus = (ro.roStatus || '').toLowerCase();
        
        return roCode.includes(searchLower) ||
               srwrNo.includes(searchLower) ||
               state.includes(searchLower) ||
               branch.includes(searchLower) ||
               location.includes(searchLower) ||
               warehouseName.includes(searchLower) ||
               warehouseCode.includes(searchLower) ||
               clientName.includes(searchLower) ||
               roStatus.includes(searchLower);
      });
    }
    
    // Sort by RO code in ascending order
    filtered.sort((a, b) => {
      const aCode = (a.roCode || '').toString();
      const bCode = (b.roCode || '').toString();
      return aCode.localeCompare(bCode, undefined, { numeric: true, sensitivity: 'base' });
    });
    
    return filtered;
  }, [searchTerm, latestROs]);

  // Pagination logic
  const totalPages = Math.ceil(filteredROs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredROs.slice(startIndex, endIndex);

  // Reset to first page when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Clear expanded rows when page changes
  React.useEffect(() => {
    setExpandedRows({});
  }, [currentPage]);

  // Columns for main table
  const roColumns = [
    {
      accessorKey: 'expand',
      header: '',
      cell: ({ row }: any) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setExpandedRows((prev: { [key: string]: boolean }) => ({ ...prev, [row.original.srwrNo]: !prev[row.original.srwrNo] }));
          }}
        >
          {expandedRows[row.original.srwrNo] ? '▼' : '▶'}
        </Button>
      ),
    },
    { accessorKey: 'roCode', header: 'RO Code', cell: ({ row }: any) => <div>{row.original.roCode || ''}</div> },
    { accessorKey: 'srwrNo', header: 'SR/WR No.', cell: ({ row }: any) => <div style={{ minWidth: 180 }}>{row.original.srwrNo}</div> },
    { accessorKey: 'state', header: 'State' },
    { accessorKey: 'branch', header: 'Branch' },
    { accessorKey: 'warehouseName', header: 'Warehouse Name' },
    { accessorKey: 'warehouseCode', header: 'Warehouse Code' },
    { accessorKey: 'warehouseAddress', header: 'Warehouse Address' },
    { accessorKey: 'clientCode', header: 'Client Code' },
    { accessorKey: 'clientAddress', header: 'Client Address' },
    { accessorKey: 'totalBags', header: 'Inward Bags' },
    { accessorKey: 'totalQuantity', header: 'Inward Quantity (MT)' },
    { accessorKey: 'releaseBags', header: 'Release Bags', cell: ({ row }: any) => <div>{row.original.releaseBags || ''}</div> },
    { accessorKey: 'releaseQuantity', header: 'Release Quantity (MT)', cell: ({ row }: any) => <div>{row.original.releaseQuantity || ''}</div> },
    { accessorKey: 'balanceBags', header: 'Balance Bags', cell: ({ row }: any) => <div>{getBalanceBags(row.original)}</div> },
    { accessorKey: 'balanceQuantity', header: 'Balance Quantity (MT)', cell: ({ row }: any) => <div>{getBalanceQty(row.original)}</div> },
    { accessorKey: 'roStatus', header: 'RO Status', cell: ({ row }: any) => {
      const status = row.original.roStatus || 'pending';
      const statusClass = getStatusStyling(status);
      
      return (
        <div className="flex items-center space-x-2 justify-center">
          <span className={statusClass}>{status}</span>
          <Button
            onClick={() => { setSelectedRO(row.original); setShowRODetails(true); }}
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
      dataToExport = filteredROs;
    } else {
      // If no search, export ALL release orders (including all historical entries)
      dataToExport = releaseOrders;
    }

    if (dataToExport.length === 0) {
      alert('No data to export');
      return;
    }

    // Helper function to calculate balance bags
    const getBalanceBagsForExport = (ro: any) => {
      if (ro.balanceBags !== undefined && ro.balanceBags !== null) {
        return ro.balanceBags;
      }
      // Calculate: inward bags - total released bags
      const inwardBags = Number(ro.totalBags || 0);
      const releasedBags = Number(ro.releaseBags || 0);
      return Math.max(0, inwardBags - releasedBags);
    };

    // Helper function to calculate balance quantity
    const getBalanceQtyForExport = (ro: any) => {
      if (ro.balanceQuantity !== undefined && ro.balanceQuantity !== null) {
        return Number(ro.balanceQuantity).toFixed(3);
      }
      // Calculate: inward quantity - total released quantity
      const inwardQty = Number(ro.totalQuantity || 0);
      const releasedQty = Number(ro.releaseQuantity || 0);
      return Math.max(0, inwardQty - releasedQty).toFixed(3);
    };

    // Define CSV headers (matching the table columns)
    const headers = [
      'RO Code',
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
      'Release Bags',
      'Release Quantity (MT)',
      'Balance Bags',
      'Balance Quantity (MT)',
      'RO Status',
      'Created Date',
      'Created By',
      'Remark'
    ];

    // Convert data to CSV format
  const csvData = dataToExport.map((ro: any) => [
      ro.roCode || '',
      ro.srwrNo || '',
      ro.state || '',
      ro.branch || '',
      ro.location || '',
      ro.warehouseName || '',
      ro.warehouseCode || '',
      ro.warehouseAddress || '',
      ro.client || '',
      ro.clientCode || '',
      ro.clientAddress || '',
      ro.totalBags || '',
      ro.totalQuantity || '',
      ro.releaseBags || '',
      ro.releaseQuantity || '',
      getBalanceBagsForExport(ro),
      getBalanceQtyForExport(ro),
      normalizeStatusText(ro.roStatus || 'pending'),
      ro.createdAt ? new Date(ro.createdAt).toLocaleDateString('en-GB') : '',
      ro.createdBy || '',
      ro.remark || ''
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
    link.setAttribute('download', `release-orders${searchSuffix}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Fetch approved inward entries for SR/WR dropdown
  React.useEffect(() => {
    const fetchInwards = async () => {
      const inwardCol = collection(db, 'inward');
      const q = query(inwardCol, where('status', '==', 'approved'));
      const snap = await getDocs(q);
      const inwardData: any[] = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

      // Fetch all existing release orders to check balances
      const roCol = collection(db, 'releaseOrders');
      const roSnap = await getDocs(roCol);
      const allReleaseOrders = roSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch all inspections once for efficiency
      const inspectionsCol = collection(db, 'inspections');
      const inspectionsSnap = await getDocs(inspectionsCol);
      const inspections = inspectionsSnap.docs.map((doc: any) => doc.data());

      // Group release orders by SR/WR number for balance calculation
      const releaseOrdersBySRWR: Record<string, any[]> = {};
      
      allReleaseOrders.forEach((roItem: any) => {
        const srwrNo = roItem.srwrNo;
        if (srwrNo) {
          if (!releaseOrdersBySRWR[srwrNo]) {
            releaseOrdersBySRWR[srwrNo] = [];
          }
          releaseOrdersBySRWR[srwrNo].push(roItem);
        }
      });

      // Map inward entries to include receiptType and calculate balance
      const merged = inwardData.map((inward: any) => {
        const inspection = inspections.find((ins: any) =>
          ins.warehouseName && inward.warehouseName &&
          ins.warehouseName.toLowerCase().trim() === inward.warehouseName.toLowerCase().trim()
        );
        
        const receiptType = inspection?.receiptType || 'SR';
        const srwrNo = `${receiptType}-${inward.inwardId || ''}-${inward.dateOfInward || ''}`;
        
        // Calculate remaining balance by checking existing release orders
        // Pending and approved ROs should affect balance - rejected/resubmitted ROs don't reduce available inventory
        const existingReleaseOrders = releaseOrdersBySRWR[srwrNo] || [];
        
        // Start with total bags and quantity from inward
        let balanceBags = Number(inward.totalBags || 0);
        let balanceQuantity = Number(inward.totalQuantity || 0);
        
        // Subtract release order quantities from each existing release order
        if (existingReleaseOrders.length > 0) {
          console.log(`Found ${existingReleaseOrders.length} existing release orders for ${srwrNo}`);
          
          existingReleaseOrders.forEach((roItem: any) => {
            // Subtract quantities from pending and approved ROs
            // Only rejected and resubmitted ROs should not affect available balance
            const roStatus = (roItem.roStatus || 'pending').toLowerCase();
            
            if (roStatus === 'pending' || roStatus === 'approved' || roStatus === 'approve') {
              const releaseBags = Number(roItem.releaseBags || 0);
              const releaseQty = Number(roItem.releaseQuantity || 0);
              
              console.log(`Subtracting RO ${roItem.roCode} (${roStatus}): ${releaseBags} bags, ${releaseQty} quantity`);
              
              balanceBags -= releaseBags;
              balanceQuantity -= releaseQty;
            } else {
              console.log(`Skipping rejected/resubmitted RO ${roItem.roCode} with status: ${roItem.roStatus}`);
            }
          });
        }
        
        // Ensure balance doesn't go below zero
        balanceBags = Math.max(0, balanceBags);
        balanceQuantity = Math.max(0, balanceQuantity);
        
        console.log(`Inward ${inward.inwardId}: Final balance ${balanceBags} bags, ${balanceQuantity.toFixed(2)} quantity`);
        
        return {
          ...inward,
          receiptType,
          srwrNo,
          balanceBags,
          balanceQuantity
        };
      })
      // Filter: only show inwards with positive balance AND bank details present
      .filter(inward => {
        const hasPositiveBalance = inward.balanceBags > 0;
        
        // Check specific bank fields from inward collection: bankName, bankBranch, bankFundedBy
        // All three must be present and not empty/default values
        const hasBankName = inward.bankName && inward.bankName.trim() !== '';
        const hasBankBranch = inward.bankBranch && inward.bankBranch.trim() !== '';
        const hasBankFundedBy = inward.bankFundedBy && inward.bankFundedBy.trim() !== '' && inward.bankFundedBy !== '-';
        
        const hasBankDetails = hasBankName || hasBankBranch || hasBankFundedBy;
        
        console.log(`Inward ${inward.inwardId}: balance=${inward.balanceBags}, bankName=${inward.bankName}, bankBranch=${inward.bankBranch}, bankFundedBy=${inward.bankFundedBy}, hasBankDetails=${hasBankDetails}`);
        
        return hasPositiveBalance && hasBankDetails;
      });
      
      console.log(`Found ${merged.length} inward entries with positive balance and bank details`);
      setInwardOptions(merged);
    };
    fetchInwards();
  }, [submitSuccess, roStatusUpdating, dataVersion]);

  // Filtered options for dropdown
  const filteredInwardOptions = React.useMemo(() => {
    if (!inwardSearch) return inwardOptions;
    return inwardOptions.filter((opt: any) => {
      const srwr = `${opt.receiptType || 'SR'}-${opt.inwardId || ''}-${opt.dateOfInward || ''}`.toLowerCase();
      return srwr.includes(inwardSearch.toLowerCase());
    });
  }, [inwardOptions, inwardSearch]);

  // When SR/WR is selected, fetch latest balance from releaseOrders or use inward totals
  React.useEffect(() => {
    const fetchLatestBalance = async () => {
      if (!selectedInward) {
        setCurrentBalanceBags(null);
        setCurrentBalanceQty(null);
        return;
      }
      const srwrNo = `${selectedInward.receiptType || 'SR'}-${selectedInward.inwardId || ''}-${selectedInward.dateOfInward || ''}`;
      const releaseOrdersCol = collection(db, 'releaseOrders');
      const q = query(releaseOrdersCol, where('srwrNo', '==', srwrNo));
      const snap = await getDocs(q);
      
      // Calculate balance based on approved ROs only
      let balanceBags = Number(selectedInward.totalBags) || 0;
      let balanceQuantity = Number(selectedInward.totalQuantity) || 0;
      
      if (!snap.empty) {
        const allROs = snap.docs.map((doc: any) => doc.data());
        
        // Subtract only approved RO quantities
        console.log(`Analyzing ${allROs.length} existing ROs for ${srwrNo}:`);
        allROs.forEach((ro: any) => {
          const roStatus = (ro.roStatus || 'pending').toLowerCase();
          if (roStatus === 'approved' || roStatus === 'approve') {
            console.log(`  - Subtracting APPROVED RO ${ro.roCode}: ${ro.releaseBags} bags, ${ro.releaseQuantity} quantity`);
            balanceBags -= Number(ro.releaseBags || 0);
            balanceQuantity -= Number(ro.releaseQuantity || 0);
          } else {
            console.log(`  - Skipping ${roStatus.toUpperCase()} RO ${ro.roCode}: ${ro.releaseBags} bags, ${ro.releaseQuantity} quantity (NOT affecting balance)`);
          }
        });
        
        // Ensure balance doesn't go below zero
        balanceBags = Math.max(0, balanceBags);
        balanceQuantity = Math.max(0, balanceQuantity);
      }
      
      setCurrentBalanceBags(balanceBags);
      setCurrentBalanceQty(balanceQuantity);
    };
    fetchLatestBalance();
  }, [selectedInward]);

  // Auto-fill when only 1 bag remains
  React.useEffect(() => {
    if (currentBalanceBags === 1 && currentBalanceQty !== null && !editingRO) {
      setReleaseBags('1');
      setReleaseQty(currentBalanceQty.toString());
    }
  }, [currentBalanceBags, currentBalanceQty, editingRO]);

  // Fetch previous ROs for the selected SR/WR
  React.useEffect(() => {
    const fetchPrevROs = async () => {
      if (!selectedInward) {
        setPreviousROs([]);
        return;
      }
      const srwrNo = `${selectedInward.receiptType || 'SR'}-${selectedInward.inwardId || ''}-${selectedInward.dateOfInward || ''}`;
      const releaseOrdersCol = collection(db, 'releaseOrders');
      const q = query(releaseOrdersCol, where('srwrNo', '==', srwrNo));
      const snap = await getDocs(q);
      if (!snap.empty) {
        // Sort by createdAt ascending
        const sorted = snap.docs
          .map((doc: any) => doc.data())
          .sort((a: any, b: any) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        setPreviousROs(sorted);
      } else {
        setPreviousROs([]);
      }
    };
    fetchPrevROs();
  }, [selectedInward, submitSuccess]);

  // Handle file input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const allowedTypes = [
        'image/jpeg', 'image/png', 'application/pdf', 'image/jpg',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      const files = Array.from(e.target.files);
      const validFiles = files.filter(file => allowedTypes.includes(file.type));
      if (validFiles.length !== files.length) {
        setFormError('Please select only JPG, JPEG, PNG, PDF, or DOCX files.');
        setFileAttachments([]);
        e.target.value = '';
      } else {
        setFormError(null);
        setFileAttachments(validFiles);
      }
    }
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitSuccess(false);
    if (!selectedInward) {
      setFormError('Please select a SR/WR No.');
      return;
    }
    if (!releaseBags || !releaseQty) {
      setFormError('Please enter Release Bags and Release Qty.');
      return;
    }
    
    // Validate that release bags is a whole number
    if (!Number.isInteger(Number(releaseBags)) || Number(releaseBags) <= 0) {
      setFormError('Release Bags must be a positive whole number (no decimals allowed).');
      return;
    }
    
    // For editing, we can allow submitting without new files if the RO already has attachments
    if (!editingRO && (!fileAttachments || fileAttachments.length === 0)) {
      setFormError('Please attach at least one file.');
      return;
    }
    
    setIsUploading(true);
    let uploadedFileUrls: string[] = [];
    
    // Handle file uploads (only if new files are provided)
    if (fileAttachments && fileAttachments.length > 0) {
      try {
        for (const file of fileAttachments) {
          const uploadResult = await uploadToCloudinary(file);
          uploadedFileUrls.push(uploadResult.secure_url);
        }
      } catch (error) {
        setFormError('File upload failed.');
        setIsUploading(false);
        return;
      }
    }
    setIsUploading(false);

    // Calculate new balances
    const totalBagsNum = currentBalanceBags !== null ? currentBalanceBags : (Number(selectedInward.totalBags) || 0);
    const totalQtyNum = currentBalanceQty !== null ? currentBalanceQty : (Number(selectedInward.totalQuantity) || 0);
    const releaseBagsNum = Number(releaseBags) || 0;
    const releaseQtyNum = Number(releaseQty) || 0;
    const newBalanceBags = totalBagsNum - releaseBagsNum;
    const newBalanceQty = totalQtyNum - releaseQtyNum;

    const roData = {
      srwrNo: `${selectedInward.receiptType || 'SR'}-${selectedInward.inwardId || ''}-${selectedInward.dateOfInward || ''}`,
      inwardId: selectedInward.inwardId,
      receiptType: selectedInward.receiptType,
      cadNumber: selectedInward.cadNumber,
      state: selectedInward.state,
      branch: selectedInward.branch,
      location: selectedInward.location,
      warehouseName: selectedInward.warehouseName,
      warehouseCode: selectedInward.warehouseCode,
      warehouseAddress: selectedInward.warehouseAddress,
      client: selectedInward.client,
      clientCode: selectedInward.clientCode,
      clientAddress: selectedInward.clientAddress,
      totalBags: totalBagsNum,
      totalQuantity: totalQtyNum,
      balanceBags: newBalanceBags,
      balanceQuantity: newBalanceQty,
      releaseBags: releaseBagsNum,
      releaseQuantity: releaseQtyNum,
      // For editing: keep existing attachments and add new ones, for new RO: use uploaded files
      attachmentUrls: editingRO 
        ? [...(editingRO.attachmentUrls || []), ...uploadedFileUrls]
        : uploadedFileUrls,
      roStatus: 'pending', // Explicitly set roStatus to pending for both new and edited ROs
      updatedAt: new Date().toISOString(),
    };

    try {
      if (editingRO) {
        // Update existing RO
        const roDocRef = doc(db, 'releaseOrders', editingRO.id);
        await updateDoc(roDocRef, {
          ...roData,
          remark: '', // Clear previous remark
        });
        setSubmitSuccess(true);
      } else {
        // Create new RO
        // Generate unique RO code (RO-0001, RO-0002, ...)
        let roCode = '';
        try {
          const releaseOrdersCol = collection(db, 'releaseOrders');
          const allROsSnap = await getDocs(releaseOrdersCol);
          const allROs = allROsSnap.docs.map((doc: any) => doc.data());
          const maxNum = allROs
            .map((ro: any) => {
              const match = typeof ro.roCode === 'string' && ro.roCode.match(/^RO-(\d{4})$/);
              return match ? parseInt(match[1], 10) : 0;
            })
            .reduce((a: number, b: number) => Math.max(a, b), 0);
          roCode = `RO-${String(maxNum + 1).padStart(4, '0')}`;
        } catch (err) {
          roCode = 'RO-0001';
        }
        
        await addDoc(collection(db, 'releaseOrders'), {
          ...roData,
          roCode,
          createdAt: new Date().toISOString()
        });
        setSubmitSuccess(true);
      }
      
      // Reset form and close modal
      setShowAddModal(false);
      resetForm();
      setDataVersion(v => v + 1);
      dispatchDataUpdate();
    } catch (error) {
      console.error('Error saving Release Order:', error);
      setFormError(`Failed to ${editingRO ? 'update' : 'save'} Release Order.`);
    }
  };

  const handleROStatusChange = async (status: string) => {
    if (!selectedRO) return;
    
    // Validate that remark is provided for checker actions
    if (!remark.trim()) {
      alert('Remark is required for checker actions (approve/reject/resubmit).');
      setROStatusUpdating(false);
      return;
    }
    
    setROStatusUpdating(true);
    try {
      // Get a reference to the existing document
      const roDocRef = doc(db, 'releaseOrders', selectedRO.id);
      // Update status and remark on the existing document
      await updateDoc(roDocRef, {
        roStatus: status,
        remark,
        updatedAt: new Date().toISOString(),
      });
      setShowRODetails(false);
      setRemark('');
      setSelectedRO(null);
      setDataVersion(v => v + 1);
      dispatchDataUpdate();
    } catch (err) {
      console.error('Error updating RO status:', err);
      alert('Failed to update RO status');
    }
    setROStatusUpdating(false);
  };

  // Handle editing resubmitted RO
  const handleEditResubmittedRO = React.useCallback(async (ro: any) => {
    try {
      // Find the document ID by querying with roCode
      const releaseOrdersCol = collection(db, 'releaseOrders');
      const q = query(releaseOrdersCol, where('roCode', '==', ro.roCode));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        alert('Could not find the Release Order to edit.');
        return;
      }
      
      const roDoc = querySnapshot.docs[0];
      const roWithId = { ...ro, id: roDoc.id };
    // Pre-fill the form with existing RO data
    setSelectedInward({
      srwrNo: ro.srwrNo,
      cadNumber: ro.cadNumber,
      state: ro.state,
      branch: ro.branch,
      location: ro.location,
      warehouseName: ro.warehouseName,
      warehouseCode: ro.warehouseCode,
      warehouseAddress: ro.warehouseAddress,
      client: ro.client,
      clientCode: ro.clientCode,
      clientAddress: ro.clientAddress,
      totalBags: ro.totalBags,
      totalQuantity: ro.totalQuantity,
      // Add other necessary fields
      receiptType: ro.receiptType || 'SR',
      inwardId: ro.inwardId,
      dateOfInward: ro.dateOfInward
    });
    
    // Set the existing release data
    setReleaseBags(ro.releaseBags?.toString() || '');
    setReleaseQty(ro.releaseQuantity?.toString() || '');
    
    // Calculate and set current balance
    setCurrentBalanceBags(ro.totalBags - (ro.releaseBags || 0));
    setCurrentBalanceQty(ro.totalQuantity - (ro.releaseQuantity || 0));
    
      // Set editing mode flag
      setEditingRO(roWithId);
      
      // Open the modal
      setShowAddModal(true);
    } catch (error) {
      console.error('Error loading RO for editing:', error);
      alert('Failed to load Release Order for editing.');
    }
  }, []);

  // Redirect users who don't have access (remove supervisor check since it doesn't exist)
  useEffect(() => {
    // Add any role-based access control if needed
  }, [userRole, router]);

  return (
    <DashboardLayout>
      {/* Module title and dashboard button row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mt-4 mb-6 lg:mb-10 px-4 lg:px-8 gap-4">
        <Button 
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 lg:px-8 py-3 text-lg lg:text-2xl font-semibold shadow-lg rounded-xl flex items-center justify-center gap-2 w-full lg:w-auto" 
          onClick={() => router.push('/dashboard')}
        >
          <span className="text-lg lg:text-2xl">&#8592;</span> Dashboard
        </Button>
        <div className="flex-1 text-center order-first lg:order-none">
          <h1 className="text-xl lg:text-3xl font-extrabold tracking-tight text-orange-600 inline-block border-b-4 border-[#1aad4b] pb-2 px-4 lg:px-10 py-1 bg-orange-50 rounded-xl shadow" style={{ letterSpacing: '0.02em' }}>
            Release Order
          </h1>
        </div>
        {canCreateReleaseOrder() && (
          <Button 
            className="bg-green-500 hover:bg-green-600 text-white px-4 lg:px-8 py-3 text-sm font-semibold shadow-lg rounded-xl w-full lg:w-auto" 
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="mr-2 h-4 lg:h-5 w-4 lg:w-5" /> Add RO
          </Button>
        )}
      </div>

      {/* Search and Export */}
      <div className="px-4 lg:px-8 mb-4">
        <Card className="bg-green-50 border border-green-200">
          <CardHeader>
            <CardTitle className="text-green-800 text-lg lg:text-xl">Search & Export Options</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
            <div className="flex-grow">
              <div className="flex items-center gap-2 mb-2 lg:mb-0">
                <Search className="text-gray-500 hidden sm:block" />
                <Label htmlFor="search-input" className="font-semibold text-gray-700 hidden sm:block">Search:</Label>
              </div>
              <div className="relative">
                <Input
                  id="search-input"
                  placeholder="Search by RO Code, SR/WR No, State, Branch, Location, Warehouse, Client, Status..."
                  className="w-full pr-8"
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button 
                    type="button" 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title="Clear search"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="mt-2 text-sm text-gray-600 text-center lg:text-left">
                Total Entries: {filteredROs.length}
              </div>
            </div>
            <Button
              onClick={handleExportCSV}
              className="bg-blue-500 hover:bg-blue-600 text-white w-full lg:w-auto flex-shrink-0"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </CardContent>
        </Card>
      </div>
      {/* Add RO Dialog */}
      <Dialog open={showAddModal} onOpenChange={(open) => {
        setShowAddModal(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="w-[95vw] max-w-5xl h-[95vh] p-3 sm:p-4">
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <DialogTitle className="text-lg sm:text-xl">
              {editingRO ? 'Edit Release Order' : 'Add Release Order'}
            </DialogTitle>
          </div>
          
          {editingRO && (
            <div className="mx-2 mb-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-400 rounded-full flex-shrink-0"></div>
                <div>
                  <div className="font-medium text-yellow-800">Editing RO: {editingRO.roCode}</div>
                  <div className="text-sm text-yellow-700">
                    This RO was resubmitted with remark: &quot;{editingRO.remark}&quot;
                  </div>
                  <div className="text-xs text-yellow-600 mt-1">
                    Status will be reset to &quot;Pending&quot; after updating.
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[calc(95vh-120px)] overflow-y-auto p-1 sm:p-2">
            {/* SR/WR No. Dropdown */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="srwr-select" className="text-sm sm:text-base">Storage/ Warehouse Receipt No.</Label>
                <Select 
                  value={selectedInward ? `${selectedInward.receiptType || 'SR'}-${selectedInward.inwardId || ''}-${selectedInward.dateOfInward || ''}` : ''} 
                  onValueChange={editingRO ? undefined : (val: string) => {
                    const found = inwardOptions.find((opt: any) => `${opt.receiptType || 'SR'}-${opt.inwardId || ''}-${opt.dateOfInward || ''}` === val);
                    setSelectedInward(found || null);
                  }}
                  disabled={!!editingRO}
                >
                  <SelectTrigger id="srwr-select" className={`w-full ${editingRO ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <SelectValue placeholder="Select SR/WR No." />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom">
                    <Input
                      placeholder="Type to filter..."
                      value={inwardSearch}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInwardSearch(e.target.value)}
                      className="mb-1"
                    />
                    {filteredInwardOptions.map((opt: any) => (
                      <SelectItem key={opt.inwardId} value={`${opt.receiptType || 'SR'}-${opt.inwardId || ''}-${opt.dateOfInward || ''}`}>
                        {`${opt.receiptType || 'SR'}-${opt.inwardId || ''}-${opt.dateOfInward || ''} (${opt.balanceBags || 0} bags, ${opt.balanceQuantity ? Number(opt.balanceQuantity).toFixed(2) : '0.00'} MT)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Auto fields */}
            {selectedInward && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm sm:text-base">CAD NO</Label>
                  <Input value={selectedInward.cadNumber || ''} readOnly className="text-sm" />
                </div>
                <div>
                  <Label className="text-sm sm:text-base">STATE</Label>
                  <Input value={selectedInward.state || ''} readOnly className="text-sm" />
                </div>
                <div>
                  <Label className="text-sm sm:text-base">BRANCH</Label>
                  <Input value={selectedInward.branch || ''} readOnly className="text-sm" />
                </div>
                <div>
                  <Label className="text-sm sm:text-base">LOCATION</Label>
                  <Input value={selectedInward.location || ''} readOnly className="text-sm" />
                </div>
                <div>
                  <Label className="text-sm sm:text-base">WAREHOUSE NAME</Label>
                  <Input value={selectedInward.warehouseName || ''} readOnly className="text-sm" />
                </div>
                <div>
                  <Label className="text-sm sm:text-base">WAREHOUSE CODE</Label>
                  <Input value={selectedInward.warehouseCode || ''} readOnly className="text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm sm:text-base">WAREHOUSE ADDRESS</Label>
                  <Input value={selectedInward.warehouseAddress || ''} readOnly className="text-sm" />
                </div>
                <div>
                  <Label className="text-sm sm:text-base">CLIENT NAME</Label>
                  <Input value={selectedInward.client || ''} readOnly className="text-sm" />
                </div>
                <div>
                  <Label className="text-sm sm:text-base">CLIENT CODE</Label>
                  <Input value={selectedInward.clientCode || ''} readOnly className="text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm sm:text-base">CLIENT ADDRESS</Label>
                  <Input value={selectedInward.clientAddress || ''} readOnly className="text-sm" />
                </div>
                <div>
                  <Label className="text-sm sm:text-base">INWARD BAGS</Label>
                  <Input value={selectedInward.totalBags || ''} readOnly className="text-sm" />
                </div>
                <div>
                  <Label className="text-sm sm:text-base">INWARD QTY(MT)</Label>
                  <Input value={selectedInward.totalQuantity || ''} readOnly className="text-sm" />
                </div>
                <div>
                  <Label className="text-sm sm:text-base">BALANCE BAGS</Label>
                  <Input value={currentBalanceBags || ''} readOnly className="text-sm" />
                </div>
                <div>
                  <Label className="text-sm sm:text-base">BALANCE QTY (MT)</Label>
                  <Input value={currentBalanceQty || ''} readOnly className="text-sm" />
                </div>
                <div>
                  <Label className="text-sm sm:text-base">RELEASE BAGS</Label>
                  <Input 
                    value={releaseBags} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const newValue = e.target.value;
                      // Only allow whole numbers (no decimals)
                      if (newValue === '' || /^\d+$/.test(newValue)) {
                        setReleaseBags(newValue);
                        // If user entered exactly the remaining balance bags, auto-set quantity too
                        if (Number(newValue) === currentBalanceBags) {
                          setReleaseQty(currentBalanceQty?.toString() || "0");
                        }
                      }
                    }} 
                    type="number" 
                    min="0" 
                    step="1"
                    required 
                    className="text-sm" 
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
                  <Label className="text-sm sm:text-base">RELEASE QTY (MT)</Label>
                  <Input 
                    value={releaseQty} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReleaseQty(e.target.value)} 
                    type="number" 
                    min="0" 
                    step="0.001" 
                    required 
                    className="text-sm"
                    // Auto-set to full remaining quantity if this is the last bag
                    readOnly={Number(releaseBags) === currentBalanceBags}
                  />
                  {Number(releaseBags) === currentBalanceBags && (
                    <div className="text-xs text-blue-600 mt-1">
                      Using full remaining quantity for last bag
                    </div>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm sm:text-base">
                    {editingRO ? 'Additional Attachments (Optional)' : 'Attachments (JPG, JPEG, PNG, PDF, DOCX)'}
                  </Label>
                  {editingRO && (
                    <div className="text-xs text-gray-600 mb-2">
                      Existing files will be preserved. You can optionally add more files.
                    </div>
                  )}
                  <Input 
                    type="file" 
                    accept=".jpg,.jpeg,.png,.pdf,.docx" 
                    multiple 
                    onChange={handleFileChange} 
                    required={!editingRO} 
                    className="text-sm" 
                  />
                </div>
              </div>
            )}
            {formError && <div className="text-red-600 font-semibold text-center">{formError}</div>}

            {/* Previous ROs Table for this SR/WR */}
            {selectedInward && previousROs.length > 0 && (
              <div className="mb-4">
                <div className="font-semibold mb-2 text-green-700 text-sm sm:text-base">Previous Release Orders for this SR/WR</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full border text-xs sm:text-sm">
                    <thead className="bg-orange-100">
                      <tr>
                        <th className="px-1 sm:px-2 py-1 border text-orange-500 text-xs">Date</th>
                        <th className="px-1 sm:px-2 py-1 border text-orange-500 text-xs">RO Code</th>
                        <th className="px-1 sm:px-2 py-1 border text-orange-500 text-xs">Release Bags</th>
                        <th className="px-1 sm:px-2 py-1 border text-orange-500 text-xs">Release Qty</th>
                        <th className="px-1 sm:px-2 py-1 border text-orange-500 text-xs">Balance Bags</th>
                        <th className="px-1 sm:px-2 py-1 border text-orange-500 text-xs">Balance Qty</th>
                        <th className="px-1 sm:px-2 py-1 border text-orange-500 text-xs">Attachment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previousROs.map((ro: any, idx: number) => (
                        <tr key={ro.roCode || idx} className="even:bg-gray-50">
                          <td className="px-1 sm:px-2 py-1 border text-center text-xs">{ro.createdAt ? new Date(ro.createdAt).toLocaleDateString('en-GB') : ''}</td>
                          <td className="px-1 sm:px-2 py-1 border text-center text-xs">{ro.roCode}</td>
                          <td className="px-1 sm:px-2 py-1 border text-center text-xs">{ro.releaseBags}</td>
                          <td className="px-1 sm:px-2 py-1 border text-center text-xs">{ro.releaseQuantity}</td>
                          <td className="px-1 sm:px-2 py-1 border text-center text-xs">{ro.balanceBags}</td>
                          <td className="px-1 sm:px-2 py-1 border text-center text-xs">{ro.balanceQuantity}</td>
                          <td className="px-1 sm:px-2 py-1 border text-center text-xs">
                            {ro.attachmentUrl ? (
                              <a href={ro.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                                View
                              </a>
                            ) : (
                              <span className="text-gray-400">No file</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
              <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto order-2 sm:order-1" disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Submit'}
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="outline" className="w-full sm:w-auto order-1 sm:order-2">Cancel</Button>
              </DialogClose>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* RO table with grouping and expand/collapse */}
      <div className="px-4 lg:px-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <CardTitle className="text-green-700 text-lg lg:text-xl">Release Orders</CardTitle>
              <div className="text-sm text-gray-600 font-medium">
                Total Entries: <span className="font-bold text-green-700">{filteredROs.length}</span>
                {filteredROs.length > itemsPerPage && (
                  <span className="ml-2">
                    (Showing {startIndex + 1}-{Math.min(endIndex, filteredROs.length)} of {filteredROs.length})
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile Card Layout */}
            <div className="block lg:hidden">
              {filteredROs.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  {releaseOrders.length === 0 
                    ? "No release orders found. Click 'Add RO' to create your first entry."
                    : "No release orders match your search criteria. Try adjusting your search terms."
                  }
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  {currentPageData.map((ro: any) => (
                    <Card key={ro.roCode} className="border border-gray-200 bg-white">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-semibold text-lg text-green-700">{ro.roCode}</div>
                            <div className="text-sm text-gray-600">{ro.srwrNo}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={getStatusStyling(ro.roStatus || 'pending')}>{normalizeStatusText(ro.roStatus || 'pending')}</span>
                            {getROActionElements(ro).showViewButton && (
                              <Button variant="ghost" size="sm" className="p-1" title="View Details" onClick={() => { setSelectedRO(ro); setShowRODetails(true); }}>
                                <Eye className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">State:</span>
                            <div className="text-gray-600">{ro.state}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Branch:</span>
                            <div className="text-gray-600">{ro.branch}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Warehouse:</span>
                            <div className="text-gray-600">{ro.warehouseName}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Client:</span>
                            <div className="text-gray-600">{ro.client}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Release Bags:</span>
                            <div className="text-gray-600">{ro.releaseBags !== undefined ? ro.releaseBags : (groupedROs[ro.srwrNo]?.[0]?.releaseBags ?? '')}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Balance Bags:</span>
                            <div className="text-gray-600">{getBalanceBags(ro)}</div>
                          </div>
                        </div>
                        
                        {/* Remark section for resubmitted ROs */}
                        {ro.remark && (
                          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                            <span className="font-medium text-gray-700 text-sm">Checker Remark:</span>
                            <div className="text-gray-600 text-sm mt-1">{ro.remark}</div>
                          </div>
                        )}
                        
                        {/* Edit button for resubmitted ROs */}
                        {(ro.roStatus === 'resubmitted' || ro.roStatus === 'resubmit') && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 w-full bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-300"
                            onClick={() => handleEditResubmittedRO(ro)}
                          >
                            Edit RO
                          </Button>
                        )}
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 w-full"
                          onClick={() => setExpandedRows((prev: { [key: string]: boolean }) => ({ ...prev, [ro.srwrNo]: !prev[ro.srwrNo] }))}
                        >
                          {expandedRows[ro.srwrNo] ? 'Hide Details ▼' : 'Show Details ▶'}
                        </Button>
                        
                        {expandedRows[ro.srwrNo] && (
                          <div className="mt-3 p-3 bg-green-50 border-t">
                            <div className="font-semibold mb-2 text-orange-700 text-sm">All Release Orders for {ro.srwrNo}</div>
                            <div className="space-y-2">
                              {groupedROs[ro.srwrNo].map((entry, idx) => (
                                <div key={entry.roCode || idx} className="bg-white p-3 rounded border text-xs">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div><span className="font-medium">Date:</span> {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('en-GB') : ''}</div>
                                    <div><span className="font-medium">RO Code:</span> {entry.roCode}</div>
                                    <div><span className="font-medium">Release Bags:</span> {entry.releaseBags}</div>
                                    <div><span className="font-medium">Release Qty:</span> {entry.releaseQuantity}</div>
                                    <div><span className="font-medium">Balance Bags:</span> {entry.balanceBags}</div>
                                    <div><span className="font-medium">Balance Qty:</span> {entry.balanceQuantity}</div>
                                  </div>
                                  <div className="mt-2 flex justify-between items-center">
                                    <span className={getStatusStyling(entry.roStatus || 'pending')}>{normalizeStatusText(entry.roStatus || 'pending')}</span>
                                    <Button variant="ghost" size="sm" className="p-1" title="View Details" onClick={() => { setSelectedRO(entry); setShowRODetails(true); }}>
                                      <Eye className="h-3 w-3 text-green-600" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Mobile Pagination */}
              {filteredROs.length > itemsPerPage && (
                <div className="p-4 bg-gray-50 border-t">
                  <div className="flex flex-col gap-4">
                    <div className="text-center text-sm text-gray-600">
                      Showing {startIndex + 1} to {Math.min(endIndex, filteredROs.length)} of {filteredROs.length} entries
                    </div>
                    <div className="flex justify-center items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="text-xs"
                      >
                        ← Prev
                      </Button>
                      
                      <span className="text-sm text-gray-600 px-2">
                        Page {currentPage} of {totalPages}
                      </span>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="text-xs"
                      >
                        Next →
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Desktop Table Layout */}
            <div className="hidden lg:block" style={{ width: '100%', overflowX: 'auto', overflowY: 'auto', maxHeight: '600px' }}>
              <table className="min-w-[1400px] border text-sm">
                <thead className="bg-orange-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-1 border sticky left-0 bg-orange-100 z-20"></th>
                    <th className="px-2 py-1 border sticky left-[40px] bg-orange-100 z-20">RO Code</th>
                    <th className="px-2 py-1 border">SR/WR No.</th>
                    <th className="px-2 py-1 border">State</th>
                    <th className="px-2 py-1 border">Branch</th>
                    <th className="px-2 py-1 border">Location</th>
                    <th className="px-2 py-1 border">Warehouse Name</th>
                    <th className="px-2 py-1 border">Warehouse Code</th>
                    <th className="px-2 py-1 border">Warehouse Address</th>
                    <th className="px-2 py-1 border">Client Name</th>
                    <th className="px-2 py-1 border">Client Code</th>
                    <th className="px-2 py-1 border">Client Address</th>
                    <th className="px-2 py-1 border">Inward Bags</th>
                    <th className="px-2 py-1 border">Inward Quantity (MT)</th>
                    <th className="px-2 py-1 border">Release Bags</th>
                    <th className="px-2 py-1 border">Release Quantity (MT)</th>
                    <th className="px-2 py-1 border">Balance Bags</th>
                    <th className="px-2 py-1 border">Balance Quantity (MT)</th>
                    <th className="px-2 py-1 border">RO Status</th>
                    <th className="px-2 py-1 border">Checker Remark</th>
                    <th className="px-2 py-1 border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredROs.length === 0 ? (
                    <tr>
                      <td colSpan={21} className="px-2 py-8 text-center text-gray-500">
                        {releaseOrders.length === 0 
                          ? "No release orders found. Click 'Add RO' to create your first entry."
                          : "No release orders match your search criteria. Try adjusting your search terms."
                        }
                      </td>
                    </tr>
                  ) : (
                    currentPageData.map((ro: any) => (
                      <React.Fragment key={ro.roCode}>
                        <tr className="even:bg-gray-50">
                        <td className="px-2 py-1 border text-center sticky left-0 bg-white even:bg-gray-50 z-10">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedRows((prev: { [key: string]: boolean }) => ({ ...prev, [ro.srwrNo]: !prev[ro.srwrNo] }))}
                          >
                            {expandedRows[ro.srwrNo] ? '▼' : '▶'}
                          </Button>
                        </td>
                        <td className="px-2 py-1 border text-center sticky left-[40px] bg-white even:bg-gray-50 z-10">{ro.roCode}</td>
                        <td className="px-2 py-1 border text-center">{ro.srwrNo}</td>
                        <td className="px-2 py-1 border text-center">{ro.state}</td>
                        <td className="px-2 py-1 border text-center">{ro.branch}</td>
                        <td className="px-2 py-1 border text-center">{ro.location}</td>
                        <td className="px-2 py-1 border text-center">{ro.warehouseName}</td>
                        <td className="px-2 py-1 border text-center">{ro.warehouseCode}</td>
                        <td className="px-2 py-1 border text-center">{ro.warehouseAddress}</td>
                        <td className="px-2 py-1 border text-center">{ro.client}</td>
                        <td className="px-2 py-1 border text-center">{ro.clientCode}</td>
                        <td className="px-2 py-1 border text-center">{ro.clientAddress}</td>
                        <td className="px-2 py-1 border text-center">{ro.totalBags}</td>
                        <td className="px-2 py-1 border text-center">{ro.totalQuantity}</td>
                        <td className="px-2 py-1 border text-center">{ro.releaseBags !== undefined ? ro.releaseBags : (groupedROs[ro.srwrNo]?.[0]?.releaseBags ?? '')}</td>
                        <td className="px-2 py-1 border text-center">{ro.releaseQuantity !== undefined ? ro.releaseQuantity : (groupedROs[ro.srwrNo]?.[0]?.releaseQuantity ?? '')}</td>
                        <td className="px-2 py-1 border text-center">{getBalanceBags(ro)}</td>
                        <td className="px-2 py-1 border text-center">{getBalanceQty(ro)}</td>
                        <td className="px-2 py-1 border text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className={getStatusStyling(ro.roStatus || 'pending')}>{normalizeStatusText(ro.roStatus || 'pending')}</span>
                            {getROActionElements(ro).showViewButton && (
                              <Button variant="ghost" size="sm" className="p-1" title="View Details" onClick={() => { setSelectedRO(ro); setShowRODetails(true); }}>
                                <Eye className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1 border text-center text-xs max-w-32">
                          {ro.remark ? (
                            <div className="truncate" title={ro.remark}>
                              {ro.remark}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1 border text-center">
                          {ro.roStatus === 'resubmitted' || ro.roStatus === 'resubmit' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-300"
                              onClick={() => handleEditResubmittedRO(ro)}
                            >
                              Edit
                            </Button>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                      {expandedRows[ro.srwrNo] && (
                        <tr>
                          <td colSpan={21} className="p-0">
                            <div className="bg-green-50 border-t">
                              <div className="font-semibold mb-2 text-orange-700 px-4 pt-2">All Release Orders for SR/WR No. - {ro.srwrNo}</div>
                              <div className="overflow-x-auto px-4 pb-2">
                                <table className="min-w-full border border-green-200 rounded-lg text-xs">
                                  <thead className="bg-orange-50">
                                    <tr>
                                      <th className="px-2 py-1 border">Date</th>
                                      <th className="px-2 py-1 border">RO Code</th>
                                      <th className="px-2 py-1 border">Release Bags</th>
                                      <th className="px-2 py-1 border">Release Qty</th>
                                      <th className="px-2 py-1 border">Balance Bags</th>
                                      <th className="px-2 py-1 border">Balance Qty</th>
                                      <th className="px-2 py-1 border">RO Status</th>
                                      <th className="px-2 py-1 border">Attachment</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {groupedROs[ro.srwrNo].map((entry, idx) => (
                                      <tr key={entry.roCode || idx} className="even:bg-gray-100">
                                        <td className="px-2 py-1 border text-center">{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('en-GB') : ''}</td>
                                        <td className="px-2 py-1 border text-center">{entry.roCode}</td>
                                        <td className="px-2 py-1 border text-center">{entry.releaseBags}</td>
                                        <td className="px-2 py-1 border text-center">{entry.releaseQuantity}</td>
                                        <td className="px-2 py-1 border text-center">{entry.balanceBags}</td>
                                        <td className="px-2 py-1 border text-center">{entry.balanceQuantity}</td>
                                        <td className="px-2 py-1 border text-center">
                                          <div className="flex items-center justify-center gap-2">
                                            <span className={getStatusStyling(entry.roStatus || 'pending')}>{normalizeStatusText(entry.roStatus || 'pending')}</span>
                                            <Button variant="ghost" size="sm" className="p-1" title="View Details" onClick={() => { setSelectedRO(entry); setShowRODetails(true); }}>
                                              <Eye className="h-4 w-4 text-green-600" />
                                            </Button>
                                          </div>
                                        </td>
                                        <td className="px-2 py-1 border text-center">
                                          {entry.attachmentUrl ? <a href={entry.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a> : <span className="text-gray-400">No file</span>}
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
            {filteredROs.length > itemsPerPage && (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-gray-50 border-t">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredROs.length)} of {filteredROs.length} entries
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="text-xs"
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="text-xs"
                  >
                    Previous
                  </Button>
                  
                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="text-xs w-8 h-8"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="text-xs"
                  >
                    Next
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="text-xs"
                  >
                    Last
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        {/* RO Details Dialog */}
        <Dialog open={showRODetails} onOpenChange={setShowRODetails}>
          <DialogContent className="w-[95vw] max-w-5xl h-[95vh] p-3 sm:p-4">
            <div className="flex flex-col space-y-1.5 text-center sm:text-left">
              <DialogTitle className="text-lg sm:text-xl">RO Details</DialogTitle>
            </div>
            {selectedRO && (
              <form id="ro-details-form" className="max-h-[calc(95vh-120px)] overflow-y-auto p-1 sm:p-2">
                {/* CIR-style header */}
                <div className="text-center mb-2">
                  <Image src="/Group 86.png" alt="Agrogreen Logo" width={96} height={96} className="w-16 sm:w-20 lg:w-24 h-16 sm:h-20 lg:h-24 rounded-full mx-auto mb-2" />
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-500 tracking-wide mb-1">AGROGREEN WAREHOUSING PRIVATE LTD.</div>
                  <div className="text-sm sm:text-base lg:text-lg font-medium text-green-600 mb-2">603, 6th Floor, Princess Business Skyline, Indore, Madhya Pradesh - 452010</div>
                  <div className="text-base sm:text-lg lg:text-xl font-bold text-orange-500 mt-4 underline">RO Details</div>
                </div>
                {/* Responsive grid for fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 lg:gap-x-6 mt-4">
                  {/* All fields except attachments */}
                  {[
                    { label: 'RO Code', value: selectedRO.roCode },
                    { label: 'SR/WR No.', value: selectedRO.srwrNo },
                    { label: 'CAD Number', value: selectedRO.cadNumber },
                    { label: 'State', value: selectedRO.state },
                    { label: 'Branch', value: selectedRO.branch },
                    { label: 'Location', value: selectedRO.location },
                    { label: 'Warehouse Name', value: selectedRO.warehouseName },
                    { label: 'Warehouse Code', value: selectedRO.warehouseCode },
                    { label: 'Warehouse Address', value: selectedRO.warehouseAddress },
                    { label: 'Client Name', value: selectedRO.client },
                    { label: 'Client Code', value: selectedRO.clientCode },
                    { label: 'Client Address', value: selectedRO.clientAddress },
                    { label: 'Inward Bags', value: selectedRO.totalBags },
                    { label: 'Inward Quantity (MT)', value: selectedRO.totalQuantity },
                    { label: 'Release Bags', value: selectedRO.releaseBags },
                    { label: 'Release Quantity (MT)', value: selectedRO.releaseQuantity },
                    { label: 'Balance Bags', value: getBalanceBags(selectedRO) },
                    { label: 'Balance Quantity (MT)', value: getBalanceQty(selectedRO) },
                    { label: 'Remark', value: selectedRO.remark },
                  ].map((f, idx) => (
                    <div key={idx} className="mb-3">
                      <div className="font-bold text-green-600 text-sm sm:text-base mb-1 mt-2 tracking-wide">{f.label}</div>
                      <div className="font-medium text-gray-800 text-sm sm:text-base bg-green-50 rounded-lg p-2 sm:p-3 border border-green-200">{f.value ?? '-'}</div>
                    </div>
                  ))}
                </div>
                {/* Attachments section below grid */}
                <div className="mt-6">
                  <div className="font-bold text-green-600 text-sm sm:text-base mb-2 mt-2 tracking-wide">Attachment</div>
                  {Array.isArray(selectedRO.attachmentUrls) && selectedRO.attachmentUrls.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {selectedRO.attachmentUrls.map((url: string, idx: number) => {
                        const ext = url.split('.').pop()?.toLowerCase();
                        let label = 'View File';
                        if (ext === 'pdf') label = 'View PDF';
                        else if (ext === 'docx') label = 'View DOCX';
                        else if (["jpg", "jpeg", "png"].includes(ext || '')) label = 'View Image';
                        return (
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">
                            {label} {idx + 1}
                          </a>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-gray-500 text-sm">No file</span>
                  )}
                </div>
                {/* Generate Receipt Button (only if approved and user has PDF permissions) */}
                {selectedRO.roStatus === 'approved' && canViewROPDF() && (
                  <div className="flex justify-center sm:justify-end mt-4">
                    <Button type="button" className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto" onClick={async () => {
                      try {
                        // Import required libraries
                        const html2canvas = (await import('html2canvas')).default;
                        const jsPDF = (await import('jspdf')).default;
                        
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

                        // Create the receipt HTML content
                        tempContainer.innerHTML = `
                          <div id="printable-ro-receipt" style="width: 900px; margin: 0; background: #fff; border-radius: 16px; font-family: Arial, sans-serif; color: #222; padding: 36px;">
                            <!-- Header with logo and address -->
                            <div style="text-align: center; margin-bottom: 8px;">
                              <img src="/Group 86.png" alt="Agrogreen Logo" style="width: 90px; height: 90px; border-radius: 50%; margin: 0 auto 8px;" />
                              <div style="font-size: 28px; font-weight: 700; color: #e67c1f; letter-spacing: 0.5px; margin-bottom: 2px;">AGROGREEN WAREHOUSING PRIVATE LTD.</div>
                              <div style="font-size: 18px; font-weight: 500; color: #1aad4b; margin-bottom: 8px;">603, 6th Floor, Princess Business Skyline, Indore, Madhya Pradesh - 452010</div>
                              <div style="font-size: 20px; font-weight: 700; color: #e67c1f; margin: 24px 0 0 0; text-decoration: underline;">RO Details</div>
                            </div>
                            
                            <!-- Three-column grid for fields -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 24px; margin-top: 32px;">
                              ${[
                                { label: 'RO Code', value: selectedRO.roCode },                                
                                { label: 'SR/WR No.', value: selectedRO.srwrNo },
                                { label: 'CAD Number', value: selectedRO.cadNumber },
                                { label: 'State', value: selectedRO.state },
                                { label: 'Branch', value: selectedRO.branch },
                                { label: 'Location', value: selectedRO.location },
                                { label: 'Warehouse Name', value: selectedRO.warehouseName },
                                { label: 'Warehouse Code', value: selectedRO.warehouseCode },
                                { label: 'Warehouse Address', value: selectedRO.warehouseAddress },
                                { label: 'Client Name', value: selectedRO.client },
                                { label: 'Client Code', value: selectedRO.clientCode },
                                { label: 'Client Address', value: selectedRO.clientAddress },
                                { label: 'Inward Bags', value: selectedRO.totalBags },
                                { label: 'Inward Quantity (MT)', value: selectedRO.totalQuantity },
                                { label: 'Release Bags', value: selectedRO.releaseBags },
                                { label: 'Release Quantity (MT)', value: selectedRO.releaseQuantity },
                                { label: 'Balance Bags', value: getBalanceBags(selectedRO) },
                                { label: 'Balance Quantity (MT)', value: getBalanceQty(selectedRO) },
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
                        
                        // Get the rendered receipt
                        const printableReceipt = tempContainer.querySelector('#printable-ro-receipt');
                        if (!printableReceipt) {
                          throw new Error("Could not find printable receipt element");
                        }
                        
                        // Create canvas with higher scale for better quality
                        const canvas = await html2canvas(printableReceipt as HTMLElement, { 
                          scale: 2, 
                          useCORS: true, 
                          backgroundColor: '#fff',
                          logging: false,
                          allowTaint: true,
                          width: 900,
                          height: printableReceipt.scrollHeight
                        });
                        
                        // Create PDF with proper dimensions
                        const pdf = new jsPDF('p', 'mm', 'a4');
                        const pageWidth = pdf.internal.pageSize.getWidth();
                        const pageHeight = pdf.internal.pageSize.getHeight();
                        
                        // Calculate image dimensions to fit page width
                        const imgWidth = pageWidth;
                        const imgHeight = (canvas.height * imgWidth) / canvas.width;
                        
                        // Split across multiple pages if needed
                        let heightLeft = imgHeight;
                        let position = 0;
                        let pageCount = 0;
                        
                        while (heightLeft > 0) {
                          // Add image to page
                          pdf.addImage(
                            canvas.toDataURL('image/jpeg', 1.0),
                            'JPEG',
                            0,
                            position,
                            imgWidth,
                            imgHeight,
                            `page-${pageCount}`,
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
                        
                        // Save PDF
                        pdf.save(`release-order-receipt-${selectedRO.roCode || ''}.pdf`);
                        
                        // Clean up - remove the temporary element
                        document.body.removeChild(tempContainer);
                        
                      } catch (error: any) {
                        console.error("PDF Generation Error:", error);
                        alert(`Failed to generate PDF: ${error?.message || 'Unknown error'}`);
                      }
                    }}>
                      Generate Receipt
                    </Button>
                  </div>
                )}
                {/* Previous ROs Table for this SR/WR in RO Details Dialog */}
                {selectedRO.srwrNo && groupedROs[selectedRO.srwrNo] && groupedROs[selectedRO.srwrNo].length > 0 && (
                  <div className="mb-4 mt-6">
                    <div className="font-semibold mb-2 text-green-700 text-sm sm:text-base">Previous Release Orders for this SR/WR</div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border text-xs sm:text-sm">
                        <thead className="bg-orange-100">
                          <tr>
                            <th className="px-1 sm:px-2 py-1 border text-orange-500 text-xs">Date</th>
                            <th className="px-1 sm:px-2 py-1 border text-orange-500 text-xs">RO Code</th>
                            <th className="px-1 sm:px-2 py-1 border text-orange-500 text-xs">Release Bags</th>
                            <th className="px-1 sm:px-2 py-1 border text-orange-500 text-xs">Release Qty</th>
                            <th className="px-1 sm:px-2 py-1 border text-orange-500 text-xs">Balance Bags</th>
                            <th className="px-1 sm:px-2 py-1 border text-orange-500 text-xs">Balance Qty</th>
                            <th className="px-1 sm:px-2 py-1 border text-orange-500 text-xs">Attachment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupedROs[selectedRO.srwrNo].map((ro, idx) => (
                            <tr key={ro.roCode || idx} className="even:bg-gray-50">
                              <td className="px-1 sm:px-2 py-1 border text-center text-xs">{ro.createdAt ? new Date(ro.createdAt).toLocaleDateString('en-GB') : ''}</td>
                              <td className="px-1 sm:px-2 py-1 border text-center text-xs">{ro.roCode}</td>
                              <td className="px-1 sm:px-2 py-1 border text-center text-xs">{ro.releaseBags}</td>
                              <td className="px-1 sm:px-2 py-1 border text-center text-xs">{ro.releaseQuantity}</td>
                              <td className="px-1 sm:px-2 py-1 border text-center text-xs">{ro.balanceBags}</td>
                              <td className="px-1 sm:px-2 py-1 border text-center text-xs">{ro.balanceQuantity}</td>
                              <td className="px-1 sm:px-2 py-1 border text-center text-xs">
                                {ro.attachmentUrl ? (
                                  <a href={ro.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                                    View
                                  </a>
                                ) : (
                                  <span className="text-gray-400">No file</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="mt-4">
                  <Label className="text-sm sm:text-base">Remark</Label>
                  <Input 
                    value={remark} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRemark(e.target.value)} 
                    placeholder={canEditRORemark() ? "Enter remark..." : "Read-only"}
                    className="text-sm" 
                    readOnly={!canEditRORemark()}
                  />
                </div>
                {/* Status action buttons - only for checkers and not for approved/rejected ROs */}
                {showROActionButtons() && selectedRO && 
                 selectedRO.roStatus !== 'approved' && selectedRO.roStatus !== 'approve' && 
                 selectedRO.roStatus !== 'rejected' && selectedRO.roStatus !== 'reject' && (
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-4 sm:justify-end">
                    {canApproveReleaseOrder() && (
                      <Button type="button" className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto" onClick={() => handleROStatusChange('approved')} disabled={roStatusUpdating}>Approve</Button>
                    )}
                    {canRejectReleaseOrder() && (
                      <Button type="button" className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto" onClick={() => handleROStatusChange('rejected')} disabled={roStatusUpdating}>Reject</Button>
                    )}
                    {canResubmitReleaseOrder() && (
                     <div></div>
                    )}
                  </div>
                )}
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
