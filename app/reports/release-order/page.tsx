"use client";

import DashboardLayout from '@/components/dashboard-layout';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { FiltersAndControls } from '@/components/reports/FiltersAndControls';

interface ReleaseOrderReportData {
  id: string;
  state: string;
  branch: string;
  location: string;
  typeOfBusiness: string;
  warehouseType: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseAddress: string;
  clientCode: string;
  clientName: string;
  commodity: string;
  variety: string;
  bankName: string;
  bankBranch: string;
  bankState: string;
  ifscCode: string;
  inwardBag: string;
  inwardQty: string;
  roNumber: string;
  roDate: string;
  roBags: string;
  roQty: string;
  roCode: string;
  balanceBag: string;
  balanceQty: string;
  [key: string]: any;
}

export default function ReleaseOrderReportsPage() {
  const router = useRouter();
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [commodityFilter, setCommodityFilter] = useState('all');

  // Data and UI states
  const [loading, setLoading] = useState(false);
  const [roData, setRoData] = useState<ReleaseOrderReportData[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'state', 'branch', 'location', 'typeOfBusiness', 'warehouseType', 'warehouseCode', 'warehouseName',
    'warehouseAddress', 'clientCode', 'clientName', 'commodity', 'variety', 'bankName', 'bankBranch',
    'bankState', 'ifscCode', 'inwardBag', 'inwardQty', 'roNumber', 'roDate', 'roBags', 'roQty',
    'roCode', 'balanceBag', 'balanceQty'
  ]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Column definitions for 25 columns matching the image parameters
  const allColumns = [
    { key: 'state', label: 'State', width: 'w-20' },
    { key: 'branch', label: 'Branch', width: 'w-20' },
    { key: 'location', label: 'Location', width: 'w-24' },
    { key: 'typeOfBusiness', label: 'Type of Business', width: 'w-28' },
    { key: 'warehouseType', label: 'Warehouse Type', width: 'w-28' },
    { key: 'warehouseCode', label: 'Warehouse Code', width: 'w-24' },
    { key: 'warehouseName', label: 'Warehouse Name', width: 'w-32' },
    { key: 'warehouseAddress', label: 'Warehouse Address', width: 'w-32' },
    { key: 'clientCode', label: 'Client Code', width: 'w-24' },
    { key: 'clientName', label: 'Client Name', width: 'w-28' },
    { key: 'commodity', label: 'Commodity', width: 'w-24' },
    { key: 'variety', label: 'Variety', width: 'w-24' },
    { key: 'bankName', label: 'Bank Name', width: 'w-24' },
    { key: 'bankBranch', label: 'Bank Branch', width: 'w-24' },
    { key: 'bankState', label: 'Bank State', width: 'w-20' },
    { key: 'ifscCode', label: 'IFSC Code', width: 'w-24' },
    { key: 'inwardBag', label: 'Inward Bag', width: 'w-20' },
    { key: 'inwardQty', label: 'Inward Qty', width: 'w-20' },
    { key: 'roNumber', label: 'RO Number', width: 'w-24' },
    { key: 'roDate', label: 'RO Date', width: 'w-24' },
    { key: 'roBags', label: 'RO bags', width: 'w-20' },
    { key: 'roQty', label: 'RO Qty (MT)', width: 'w-24' },
    { key: 'roCode', label: 'RO Code', width: 'w-20' },
    { key: 'balanceBag', label: 'Balance Bag', width: 'w-20' },
    { key: 'balanceQty', label: 'Balance Quantity (MT)', width: 'w-20' }
  ];

  // Set default date range (last 6 months)
  useEffect(() => {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(sixMonthsAgo.toISOString().split('T')[0]);
  }, []);

  // (moved) fetch effect placed after fetchROData definition for correct ordering

  const fetchROData = useCallback(async () => {
    setLoading(true);
    try {
      const roCollection = collection(db, 'releaseOrders');
      
      // Fetch all documents first for reliable date filtering
      let q = query(roCollection, limit(1000));
      
      const querySnapshot = await getDocs(q);
      
      console.log('RO collection query result:', querySnapshot.size, 'documents');
      console.log('Applying date filtering for release order report. Date range:', startDate, 'to', endDate);
      
      // Filter documents by date range first
      let filteredDocs = querySnapshot.docs;
      
      if (startDate && endDate) {
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999); // Include the entire end date
        
        console.log('Filtering release orders by date range:', startDateObj, 'to', endDateObj);
        
        filteredDocs = querySnapshot.docs.filter(doc => {
          const docData = doc.data();
          let docDate = null;
          
          // Try to get date from createdAt field first
          if (docData.createdAt) {
            if (docData.createdAt.toDate) {
              // Firestore Timestamp
              docDate = docData.createdAt.toDate();
            } else if (typeof docData.createdAt === 'string') {
              // String date
              docDate = new Date(docData.createdAt);
            }
          }
          
          // If no createdAt or invalid, try other date fields
          if (!docDate || isNaN(docDate.getTime())) {
            if (docData.roDate) {
              docDate = new Date(docData.roDate);
            } else if (docData.dateOfRelease) {
              docDate = new Date(docData.dateOfRelease);
            }
          }
          
          // If still no valid date, exclude from results
          if (!docDate || isNaN(docDate.getTime())) {
            console.log('No valid date found for release order document:', doc.id);
            return false;
          }
          
          // Check if date falls within range
          const isInRange = docDate >= startDateObj && docDate <= endDateObj;
          return isInRange;
        });
        
        console.log('Release order report: After date filtering:', filteredDocs.length, 'of', querySnapshot.docs.length, 'documents remain');
      }
      
      const data = await Promise.all(filteredDocs.map(async (doc, index) => {
        const docData = doc.data();
        
        // Debug: Log available fields in RO data
        console.log('RO document fields for warehouse:', docData.warehouseName, Object.keys(docData));
        console.log('RO document data:', docData);
        console.log('Balance data in RO:', {
          balanceBags: docData.balanceBags,
          balanceQuantity: docData.balanceQuantity,
          totalBags: docData.totalBags,
          totalQuantity: docData.totalQuantity,
          releaseBags: docData.releaseBags,
          releaseQuantity: docData.releaseQuantity
        });
        
        // Fetch warehouse type from inspections collection (same logic as inward report)
        let warehouseType = '';
        let warehouseCode = '';
        let warehouseAddress = '';
        let businessType = '';
        
        if (docData.warehouseName) {
          console.log('Looking for warehouse type for warehouse name:', docData.warehouseName);
          try {
            // Fetch warehouse type from inspections collection where typeOfWarehouse field is present
            try {
              console.log(`Fetching warehouse type from inspections collection for warehouse: ${docData.warehouseName}`);
              
              // Query inspections collection with database location filter if available
              let inspectionsQuery;
              if (docData.databaseLocation) {
                inspectionsQuery = query(
                  collection(db, 'inspections'),
                  where('warehouseName', '==', docData.warehouseName),
                  where('databaseLocation', '==', docData.databaseLocation)
                );
              } else {
                inspectionsQuery = query(
                  collection(db, 'inspections'),
                  where('warehouseName', '==', docData.warehouseName)
                );
              }
              
              const inspectionsSnapshot = await getDocs(inspectionsQuery);
              console.log('Inspections query result:', inspectionsSnapshot.size, 'documents');
              
              if (!inspectionsSnapshot.empty) {
                const inspectionData = inspectionsSnapshot.docs[0].data();
                console.log('Inspections data found:', inspectionData);
                console.log('Available fields in inspections:', Object.keys(inspectionData));
                
                // Get warehouse type from typeOfWarehouse field (correct field name)
                warehouseType = inspectionData.typeOfWarehouse || 
                              inspectionData.typeofwarehouse || 
                              inspectionData.warehouseType || 
                              inspectionData.warehouseInspectionData?.typeOfWarehouse ||
                              inspectionData.warehouseInspectionData?.warehouseType || '';
                
                // Get other warehouse details from inspections
                warehouseCode = inspectionData.warehouseCode || 
                              inspectionData.warehouseInspectionData?.warehouseCode || '';
                warehouseAddress = inspectionData.warehouseAddress || 
                                inspectionData.warehouseInspectionData?.warehouseAddress || '';
                businessType = inspectionData.businessType || 
                             inspectionData.warehouseInspectionData?.businessType || '';
                
                console.log('Extracted warehouse type from inspections:', warehouseType);
                console.log('Warehouse code from inspections:', warehouseCode);
              } else {
                console.log('No inspections data found for warehouse:', docData.warehouseName);
              }
            } catch (error) {
              console.log('Error fetching from inspections collection:', error);
            }
            
            console.log('Final extracted warehouse type:', warehouseType);
            console.log('Warehouse type will be displayed as:', warehouseType || '-');
          } catch (error) {
            console.log('Error fetching warehouse type from warehouse creation:', error);
          }
        }
        
        // Fetch additional data from inward collection using inwardId
        let commodity = '';
        let variety = '';
        let bankFields = {
          bankName: '',
          bankBranch: '',
          bankState: '',
          ifscCode: ''
        };
        
        if (docData.inwardId) {
          try {
            console.log('Fetching additional data from inward collection for inwardId:', docData.inwardId);
            const inwardCollection = collection(db, 'inward');
            const inwardQuery = query(
              inwardCollection,
              where('inwardId', '==', docData.inwardId)
            );
            const inwardSnapshot = await getDocs(inwardQuery);
            
            if (!inwardSnapshot.empty) {
              const inwardData = inwardSnapshot.docs[0].data();
              console.log('Inward data found:', inwardData);
              
              // Extract commodity and variety from inward data
              commodity = inwardData.commodity || '';
              variety = inwardData.varietyName || inwardData.variety || '';
              
              // Extract bank information from inward data (same logic as inward report)
              bankFields = {
                bankName: inwardData.bankName || inwardData.bank || inwardData.selectedBankName || '',
                bankBranch: inwardData.bankBranchName || inwardData.bankBranch || inwardData.branchName || inwardData.selectedBankBranchName || '',
                bankState: inwardData.bankState || inwardData.selectedBankState || '',
                ifscCode: inwardData.ifscCode || inwardData.IFSC || inwardData.ifsc || ''
              };
              
              console.log('Extracted data from inward collection:', {
                commodity,
                variety,
                bankFields
              });
            } else {
              console.log('No inward data found for inwardId:', docData.inwardId);
            }
          } catch (error) {
            console.log('Error fetching inward data:', error);
          }
        }
        
        // If still missing bank information, try to fetch from clients collection
        if ((!bankFields.bankName || !bankFields.bankBranch) && (docData.clientCode || docData.client)) {
          try {
            console.log('Bank information still missing, fetching from clients collection for client:', docData.clientCode || docData.client);
            const clientsCollection = collection(db, 'clients');
            const clientQuery = query(
              clientsCollection,
              where('clientId', '==', docData.clientCode || docData.client)
            );
            const clientSnapshot = await getDocs(clientQuery);
            
            if (!clientSnapshot.empty) {
              const clientData = clientSnapshot.docs[0].data();
              console.log('Client data found:', clientData);
              
              // Update bank fields if they're missing
              if (!bankFields.bankName && clientData.bankName) {
                bankFields.bankName = clientData.bankName;
              }
              if (!bankFields.bankBranch && clientData.bankBranch) {
                bankFields.bankBranch = clientData.bankBranch;
              }
              if (!bankFields.bankState && clientData.bankState) {
                bankFields.bankState = clientData.bankState;
              }
              if (!bankFields.ifscCode && clientData.ifscCode) {
                bankFields.ifscCode = clientData.ifscCode;
              }
              
              console.log('Updated bank fields from client data:', bankFields);
            }
          } catch (error) {
            console.log('Error fetching client data for bank information:', error);
          }
        }
        
        // Calculate balance values if not present
        const calculatedBalanceBags = docData.balanceBags || (docData.totalBags && docData.releaseBags ? (docData.totalBags - docData.releaseBags).toString() : '');
        const calculatedBalanceQty = docData.balanceQuantity || (docData.totalQuantity && docData.releaseQuantity ? (docData.totalQuantity - docData.releaseQuantity).toString() : '');
        
        console.log('Balance calculation for warehouse:', docData.warehouseName, {
          totalBags: docData.totalBags,
          releaseBags: docData.releaseBags,
          calculatedBalanceBags,
          totalQuantity: docData.totalQuantity,
          releaseQuantity: docData.releaseQuantity,
          calculatedBalanceQty
        });
        
        return {
          id: doc.id,
          state: docData.state || '',
          branch: docData.branch || '',
          location: docData.location || '',
          typeOfBusiness: businessType || docData.businessType || docData.typeOfBusiness || '',
          warehouseType: warehouseType,
          warehouseCode: warehouseCode || docData.warehouseCode || '',
          warehouseName: docData.warehouseName || '',
          warehouseAddress: warehouseAddress || docData.warehouseAddress || '',
          clientCode: docData.clientCode || '',
          clientName: docData.client || '',
          commodity: commodity,
          variety: variety,
          bankName: bankFields.bankName,
          bankBranch: bankFields.bankBranch,
          bankState: bankFields.bankState,
          ifscCode: bankFields.ifscCode,
          inwardBag: docData.totalBags || '',
          inwardQty: docData.totalQuantity || '',
          roNumber: docData.roCode || '',
          roDate: docData.createdAt || '',
          roBags: docData.releaseBags || '',
          roQty: docData.releaseQuantity || '',
          roCode: docData.roCode || '',
          balanceBag: calculatedBalanceBags,
          balanceQty: calculatedBalanceQty,
          ...docData
        };
      }));
      
      console.log('Processed RO data:', data.length, 'records');
      setRoData(data);
    } catch (error) {
      console.error('Error fetching RO data:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  // Fetch release order data when component mounts or when date filters change
  useEffect(() => {
    if (startDate && endDate) {
      fetchROData();
    }
  }, [startDate, endDate, fetchROData]);

  // Get unique filter options
  const uniqueStates = useMemo(() => {
    return Array.from(new Set(roData.map(item => item.state).filter(Boolean))).sort();
  }, [roData]);

  const uniqueBranches = useMemo(() => {
    return Array.from(new Set(roData.map(item => item.branch).filter(Boolean))).sort();
  }, [roData]);

  const uniqueWarehouses = useMemo(() => {
    return Array.from(new Set(roData.map(item => item.warehouseName).filter(Boolean))).sort();
  }, [roData]);

  const uniqueClients = useMemo(() => {
    return Array.from(new Set(roData.map(item => item.clientName).filter(Boolean))).sort();
  }, [roData]);

  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(roData.map(item => item.status).filter(Boolean))).sort();
  }, [roData]);

  const uniqueCommodities = useMemo(() => {
    return Array.from(new Set(roData.map(item => item.commodity).filter(Boolean))).sort();
  }, [roData]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, warehouseFilter, clientFilter, stateFilter, branchFilter, commodityFilter, itemsPerPage, startDate, endDate]);

  // Filter data based on search and filters
  const filteredData = useMemo(() => {
    let filtered = roData;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item => 
        Object.values(item).some(value => 
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply all filters
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    if (warehouseFilter && warehouseFilter !== 'all') {
      filtered = filtered.filter(item => item.warehouseName === warehouseFilter);
    }

    if (clientFilter && clientFilter !== 'all') {
      filtered = filtered.filter(item => item.clientName === clientFilter);
    }

    if (stateFilter && stateFilter !== 'all') {
      filtered = filtered.filter(item => item.state === stateFilter);
    }

    if (branchFilter && branchFilter !== 'all') {
      filtered = filtered.filter(item => item.branch === branchFilter);
    }

    if (commodityFilter && commodityFilter !== 'all') {
      filtered = filtered.filter(item => item.commodity === commodityFilter);
    }
    
    return filtered;
  }, [roData, searchTerm, statusFilter, warehouseFilter, clientFilter, stateFilter, branchFilter, commodityFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  // Pagination functions
  const goToFirstPage = () => setCurrentPage(1);
  const goToPreviousPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPage = (page: number) => setCurrentPage(page);

  // Export filtered data to CSV
  const exportToCSV = () => {
    if (filteredData.length === 0) return;
    
    const headers = [
      'State', 'Branch', 'Location', 'Type of Business', 'Warehouse Type', 'Warehouse Code', 'Warehouse Name',
      'Warehouse Address', 'Client Code', 'Client Name', 'Commodity', 'Variety', 'Bank Name', 'Bank Branch',
      'Bank State', 'IFSC Code', 'Inward Bag', 'Inward Qty', 'RO Number', 'RO Date', 'RO bags', 'RO Qty (MT)',
      'RO Code', 'Balance Bag', 'Balance Quantity (MT)'
    ];
    
    const csvContent = [
      headers.join(','),
      ...filteredData.map(row => [
        row.state || '',
        row.branch || '',
        row.location || '',
        row.typeOfBusiness || '',
        row.warehouseType || '',
        row.warehouseCode || '',
        row.warehouseName || '',
        row.warehouseAddress || '',
        row.clientCode || '',
        row.clientName || '',
        row.commodity || '',
        row.variety || '',
        row.bankName || '',
        row.bankBranch || '',
        row.bankState || '',
        row.ifscCode || '',
        row.inwardBag || '',
        row.inwardQty || '',
        row.roNumber || '',
        row.roDate || '',
        row.roBags || '',
        row.roQty || '',
        row.roCode || '',
        row.balanceBag || '',
        row.balanceQty || ''
      ].map(value => typeof value === 'string' && value.includes(',') ? `"${value}"` : value).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `release_order_report_${startDate}_to_${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setWarehouseFilter('all');
    setClientFilter('all');
    setStateFilter('all');
    setBranchFilter('all');
    setCommodityFilter('all');
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || statusFilter !== 'all' || warehouseFilter !== 'all' || 
    clientFilter !== 'all' || stateFilter !== 'all' || branchFilter !== 'all' || commodityFilter !== 'all';

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    const normalizedStatus = status?.toLowerCase() || '';
    if (normalizedStatus.includes('approved') || normalizedStatus.includes('active') || normalizedStatus.includes('completed')) {
      return 'bg-green-100 text-green-800';
    } else if (normalizedStatus.includes('pending')) {
      return 'bg-yellow-100 text-yellow-800';
    } else if (normalizedStatus.includes('rejected') || normalizedStatus.includes('expired') || normalizedStatus.includes('cancelled')) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  // Toggle column visibility
  const toggleColumn = (columnKey: string) => {
    setVisibleColumns(prev => 
      prev.includes(columnKey) 
        ? prev.filter(col => col !== columnKey)
        : [...prev, columnKey]
    );
  };

  // Filter options for the modular component
  const filterOptions = [
    {
      key: 'status',
      label: 'Status',
      value: statusFilter,
      options: uniqueStatuses
    },
    {
      key: 'warehouse',
      label: 'Warehouse',
      value: warehouseFilter,
      options: uniqueWarehouses
    },
    {
      key: 'client',
      label: 'Client',
      value: clientFilter,
      options: uniqueClients
    },
    {
      key: 'state',
      label: 'State',
      value: stateFilter,
      options: uniqueStates
    },
    {
      key: 'branch',
      label: 'Branch',
      value: branchFilter,
      options: uniqueBranches
    },
    {
      key: 'commodity',
      label: 'Commodity',
      value: commodityFilter,
      options: uniqueCommodities
    }
  ];

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    switch (key) {
      case 'status':
        setStatusFilter(value);
        break;
      case 'warehouse':
        setWarehouseFilter(value);
        break;
      case 'client':
        setClientFilter(value);
        break;
      case 'state':
        setStateFilter(value);
        break;
      case 'branch':
        setBranchFilter(value);
        break;
      case 'commodity':
        setCommodityFilter(value);
        break;
    }
  };

  // Active filters for display
  const activeFilters = filterOptions
    .filter(filter => filter.value !== 'all')
    .map(filter => ({
      key: filter.key,
      label: filter.label,
      value: filter.value,
      onRemove: () => handleFilterChange(filter.key, 'all')
    }));

  // Get visible columns data
  const visibleColumnsData = allColumns.filter(col => visibleColumns.includes(col.key));

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => router.push('/reports')}
              className="inline-flex items-center text-base sm:text-lg font-semibold tracking-tight bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 transition-colors w-full md:w-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Reports
            </button>
        
          </div>
          
          <div className="text-center flex flex-col items-center w-full md:w-auto">
            {/* Logo */}
            
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-orange-600 inline-block border-b-4 border-green-500 pb-2 px-4 sm:px-6 py-3 bg-orange-100 rounded-lg w-full md:w-auto">
              Release Order Reports
            </h1>
            <p className="text-muted-foreground">Generate and view release order transaction reports</p>
          </div>
          
          <div className="flex space-x-2 justify-center md:justify-end w-full md:w-auto">
            <Button onClick={exportToCSV} disabled={filteredData.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters & Controls - Modular Component */}
        <FiltersAndControls
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          filterOptions={filterOptions}
          onFilterChange={handleFilterChange}
          loading={loading}
          onApplyFilters={fetchROData}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          allColumns={allColumns}
          visibleColumns={visibleColumns}
          onToggleColumn={toggleColumn}
          onClearFilters={clearFilters}
          activeFilters={activeFilters}
        />

        {/* Results Summary */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredData.length)} of {filteredData.length} entries
            {filteredData.length !== roData.length && ` (filtered from ${roData.length} total)`}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Rows per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Data Table with Sticky Headers */}
        <div className="table-container">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto w-full max-h-[600px]">
                <table className="min-w-full border-collapse border border-gray-200 table-auto md:table-fixed">
                  <thead className="sticky-header bg-orange-100">
                    <tr>
                      {allColumns
                        .filter(col => visibleColumns.includes(col.key))
                        .map(column => (
                          <th key={column.key} className="border border-orange-300 px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm text-orange-800 font-semibold whitespace-nowrap" style={{ minWidth: 120 }}>
                            {column.label}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        {allColumns
                          .filter(col => visibleColumns.includes(col.key))
                          .map(column => (
                            <td key={column.key} className="border border-gray-200 px-4 py-2 whitespace-nowrap">
                              {column.key === 'roDate' ? (
                                formatDate(item[column.key])
                              ) : column.key === 'inwardBag' || column.key === 'inwardQty' || 
                                       column.key === 'roBags' || column.key === 'roQty' || 
                                       column.key === 'balanceBag' || column.key === 'balanceQty' ? (
                                <span className="text-right block">
                                  {item[column.key] || '-'}
                                </span>
                              ) : column.key === 'warehouseCode' || column.key === 'clientCode' || 
                                       column.key === 'roNumber' || column.key === 'roCode' || 
                                       column.key === 'ifscCode' ? (
                                <span className="font-mono text-sm">
                                  {item[column.key] || '-'}
                                </span>
                              ) : (
                                item[column.key] || '-'
                              )}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {filteredData.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    {loading ? 'Loading data...' : 'No release order data found matching the current filters'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pagination Controls */}
        {filteredData.length > 0 && (
          <Card>
            <CardContent className="flex items-center justify-between space-x-2 py-4">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium">
                  Page {currentPage} of {totalPages}
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToFirstPage}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {/* Page Numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                  if (pageNumber <= totalPages) {
                    return (
                      <Button
                        key={pageNumber}
                        variant={currentPage === pageNumber ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(pageNumber)}
                      >
                        {pageNumber}
                      </Button>
                    );
                  }
                  return null;
                })}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToLastPage}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="text-sm text-gray-500">
                {filteredData.length} total entries
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
