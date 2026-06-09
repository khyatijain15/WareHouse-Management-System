"use client";

import DashboardLayout from '@/components/dashboard-layout';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit, where, getDoc, doc, Timestamp } from 'firebase/firestore';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { FiltersAndControls } from '@/components/reports/FiltersAndControls';

interface DetailedInwardReportData {
  id: string;
  dateOfInward: string;
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
  vehicleNumber: string;
  cadNumber: string;
  gatepassNumber: string;
  weighbridgeName: string;
  weighbridgeNumber: string;
  stackNumber: string;
  grossWeight: string;
  tareWeight: string;
  netWeight: string;
  bags: string;
  [key: string]: any;
}

export default function DetailedInwardReportsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [clientFilter, setClientFilter] = useState('all');
  const [commodityFilter, setCommodityFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [inwardData, setInwardData] = useState<DetailedInwardReportData[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  
  // 23 columns - matching all parameters from the table
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'dateOfInward', 'state', 'branch', 'location', 'typeOfBusiness', 'warehouseType', 
    'warehouseCode', 'warehouseName', 'warehouseAddress', 'clientCode', 'clientName', 
    'commodity', 'variety', 'vehicleNumber', 'cadNumber', 'gatepassNumber', 
    'weighbridgeName', 'weighbridgeNumber', 'stackNumber', 'grossWeight', 
    'tareWeight', 'netWeight', 'bags'
  ]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Column definitions for 23 columns - matching all parameters from the table
  const allColumns = [
    { key: 'dateOfInward', label: 'Date of Inward', width: 'w-28' },
    { key: 'state', label: 'State', width: 'w-24' },
    { key: 'branch', label: 'Branch', width: 'w-24' },
    { key: 'location', label: 'Location', width: 'w-24' },
    { key: 'typeOfBusiness', label: 'Type of Business', width: 'w-32' },
    { key: 'warehouseType', label: 'Warehouse Type', width: 'w-28' },
    { key: 'warehouseCode', label: 'Warehouse Code', width: 'w-28' },
    { key: 'warehouseName', label: 'Warehouse Name', width: 'w-32' },
    { key: 'warehouseAddress', label: 'Warehouse Address', width: 'w-36' },
    { key: 'clientCode', label: 'Client Code', width: 'w-24' },
    { key: 'clientName', label: 'Client Name', width: 'w-28' },
    { key: 'commodity', label: 'Commodity', width: 'w-24' },
    { key: 'variety', label: 'Variety', width: 'w-24' },
    { key: 'vehicleNumber', label: 'Vehicle Number', width: 'w-28' },
    { key: 'cadNumber', label: 'CAD Number', width: 'w-24' },
    { key: 'gatepassNumber', label: 'Gatepass Number', width: 'w-28' },
    { key: 'weighbridgeName', label: 'Weighbridge Name', width: 'w-28' },
    { key: 'weighbridgeNumber', label: 'Weighbridge Number', width: 'w-32' },
    { key: 'stackNumber', label: 'Stack Number', width: 'w-24' },
    { key: 'grossWeight', label: 'Gross Weight (MT)', width: 'w-32' },
    { key: 'tareWeight', label: 'Tare Weight (MT)', width: 'w-28' },
    { key: 'netWeight', label: 'Net Weight (MT)', width: 'w-28' },
    { key: 'bags', label: 'Bags', width: 'w-20' }
  ];

  // Get all column keys for visibility toggle
  const allColumnKeys = allColumns.map(col => col.key);

  // Set default date range (last 6 months)
  useEffect(() => {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(sixMonthsAgo.toISOString().split('T')[0]);
  }, []);

  // (moved) fetch effect placed after fetchInwardData definition for correct ordering

  const fetchInwardData = useCallback(async () => {
    setLoading(true);
    try {
      console.log('Fetching inward data with date range:', startDate, 'to', endDate);
      
      // Fetch from inward collection (main dashboard collection)
      const inwardCollection = collection(db, 'inward');
          
      // Build query - fetch all documents first, then filter in memory for more reliable date filtering
      let q = query(inwardCollection, limit(1000));
          
      const querySnapshot = await getDocs(q);
      console.log('Inward collection query result:', querySnapshot.size, 'documents');
          
          if (querySnapshot.size > 0) {
            console.log('Sample document data:', querySnapshot.docs[0].data());
            console.log('Sample document ID:', querySnapshot.docs[0].id);
            console.log('All document IDs:', querySnapshot.docs.map(doc => doc.id));
            
            // Filter documents by date range first
            let filteredDocs = querySnapshot.docs;
            
            if (startDate && endDate) {
              const startDateObj = new Date(startDate);
              const endDateObj = new Date(endDate);
              endDateObj.setHours(23, 59, 59, 999); // Include the entire end date
              
              console.log('Filtering by date range:', startDateObj, 'to', endDateObj);
              
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
                
                // If no createdAt or invalid, try dateOfInward
                if (!docDate || isNaN(docDate.getTime())) {
                  if (docData.dateOfInward) {
                    docDate = new Date(docData.dateOfInward);
                  }
                }
                
                // If still no valid date, exclude from results
                if (!docDate || isNaN(docDate.getTime())) {
                  console.log('No valid date found for document:', doc.id, 'createdAt:', docData.createdAt, 'dateOfInward:', docData.dateOfInward);
                  return false;
                }
                
                // Check if date falls within range
                const isInRange = docDate >= startDateObj && docDate <= endDateObj;
                if (!isInRange) {
                  console.log('Document', doc.id, 'date', docDate, 'is outside range');
                }
                return isInRange;
              });
              
              console.log('After date filtering:', filteredDocs.length, 'of', querySnapshot.docs.length, 'documents remain');
            }
            
            // Process each filtered inward record
            const processedData = await Promise.all(
              filteredDocs.map(async (doc, index) => {
                const docData = doc.data();
                
                // Get warehouse type from warehouse creation survey section for activated warehouses
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
                
                // Extract and format the date properly
                let formattedDate = '';
                if (docData.createdAt) {
                  if (docData.createdAt.toDate) {
                    // Firestore Timestamp
                    formattedDate = docData.createdAt.toDate().toISOString().split('T')[0];
                  } else if (typeof docData.createdAt === 'string') {
                    // String date
                    formattedDate = new Date(docData.createdAt).toISOString().split('T')[0];
                  }
                } else if (docData.dateOfInward) {
                  formattedDate = new Date(docData.dateOfInward).toISOString().split('T')[0];
                }
                
                // Collect all vehicle numbers, gatepass numbers, weighbridge info, and stack numbers from inwardEntries array
                let vehicleNumbers = '';
                let gatepassNumbers = '';
                let weighbridgeNames = '';
                let weighbridgeNumbers = '';
                let stackNumbers = '';
                let totalGrossWeight = 0;
                let totalTareWeight = 0;
                let totalNetWeight = 0;
                let totalBags = 0;
                
                if (docData.inwardEntries && Array.isArray(docData.inwardEntries)) {
                  console.log(`Document ${doc.id}: Found ${docData.inwardEntries.length} inward entries`);
                  console.log(`inwardEntries sample:`, docData.inwardEntries.map((e: any) => ({
                    vehicleNumber: e.vehicleNumber,
                    getpassNumber: e.getpassNumber,
                    weightBridge: e.weightBridge
                  })));
                  
                  // Extract vehicle numbers from all entries
                  vehicleNumbers = docData.inwardEntries
                    .map((entry: any) => entry.vehicleNumber)
                    .filter(Boolean)
                    .join(', ');
                  
                  console.log(`Vehicle numbers extracted:`, vehicleNumbers);
                  
                  // Extract gatepass numbers from all entries
                  gatepassNumbers = docData.inwardEntries
                    .map((entry: any) => entry.getpassNumber)
                    .filter(Boolean)
                    .join(', ');
                  
                  // Extract weighbridge names from all entries
                  weighbridgeNames = docData.inwardEntries
                    .map((entry: any) => entry.weightBridge)
                    .filter(Boolean)
                    .join(', ');
                  
                  // Extract weighbridge numbers from all entries
                  weighbridgeNumbers = docData.inwardEntries
                    .map((entry: any) => entry.weightBridgeSlipNumber)
                    .filter(Boolean)
                    .join(', ');
                  
                  // Extract stack numbers from all entries (handling both direct stackNumber and stacks array)
                  stackNumbers = docData.inwardEntries
                    .map((entry: any) => {
                      if (entry.stacks && Array.isArray(entry.stacks)) {
                        return entry.stacks.map((s: any) => s.stackNumber).filter(Boolean).join(', ');
                      }
                      return entry.stackNumber || '';
                    })
                    .filter(Boolean)
                    .join(', ');
                  
                  // Calculate total weights and bags from all entries
                  docData.inwardEntries.forEach((entry: any) => {
                    totalGrossWeight += parseFloat(entry.grossWeight) || 0;
                    totalTareWeight += parseFloat(entry.tareWeight) || 0;
                    totalNetWeight += parseFloat(entry.netWeight) || 0;
                    totalBags += parseInt(entry.totalBags) || 0;
                  });
                } else {
                  // Fallback to single field values for backward compatibility
                  vehicleNumbers = docData.vehicleNumber || '';
                  gatepassNumbers = docData.getpassNumber || '';
                  weighbridgeNames = docData.weightBridge || '';
                  weighbridgeNumbers = docData.weightBridgeSlipNumber || '';
                  stackNumbers = docData.stacks && Array.isArray(docData.stacks) 
                    ? docData.stacks.map((s: any) => s.stackNumber).filter(Boolean).join(', ') 
                    : docData.stackNumber || '';
                  totalGrossWeight = parseFloat(docData.grossWeight) || 0;
                  totalTareWeight = parseFloat(docData.tareWeight) || 0;
                  totalNetWeight = parseFloat(docData.netWeight) || 0;
                  totalBags = parseInt(docData.totalBags) || 0;
                }
                
                return {
                  id: doc.id,
                  dateOfInward: formattedDate || docData.dateOfInward || '',
                  state: docData.state || '',
                  branch: docData.branch || '',
                  location: docData.location || '',
                  typeOfBusiness: businessType || docData.businessType || '',
                  warehouseType: warehouseType || docData.warehouseType || '',
                  warehouseCode: warehouseCode || docData.warehouseCode || '',
                  warehouseName: docData.warehouseName || '',
                  warehouseAddress: warehouseAddress || docData.warehouseAddress || '',
                  clientCode: docData.clientCode || '',
                  clientName: docData.client || docData.clientName || '',
                  commodity: docData.commodity || '',
                  variety: docData.varietyName || '',
                  vehicleNumber: vehicleNumbers || '',
                  cadNumber: docData.cadNumber || '',
                  gatepassNumber: gatepassNumbers || '',
                  weighbridgeName: weighbridgeNames || '',
                  weighbridgeNumber: weighbridgeNumbers || '',
                  stackNumber: stackNumbers || '',
                  grossWeight: totalGrossWeight.toString(),
                  tareWeight: totalTareWeight.toString(),
                  netWeight: totalNetWeight.toString(),
                  bags: totalBags.toString(),
                  // Preserve inwardEntries and stacks arrays for CSV export
                  inwardEntries: docData.inwardEntries || [],
                  stacks: docData.stacks || []
                };
              })
            );
            
            setInwardData(processedData);
            console.log('Total processed inward data:', processedData.length, 'records');
            console.log('Date range applied:', startDate, 'to', endDate);
            console.log('Sample processed data:', processedData[0]);
            
            // Log date distribution for debugging
            const dateCount = processedData.reduce((acc: any, item) => {
              const date = item.dateOfInward;
              acc[date] = (acc[date] || 0) + 1;
              return acc;
            }, {});
            console.log('Date distribution in results:', dateCount);
          } else {
            setInwardData([]);
            console.log('No inward data found');
          }
    } catch (error) {
      console.error('Error fetching inward data:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  // Fetch inward data when component mounts or when date filters change
  useEffect(() => {
    if (startDate && endDate) {
      fetchInwardData();
    }
  }, [startDate, endDate, fetchInwardData]);

  // Get unique filter options
  const uniqueClients = useMemo(() => {
    return Array.from(new Set(inwardData.map(item => item.clientName).filter(Boolean)));
  }, [inwardData]);

  const uniqueCommodities = useMemo(() => {
    return Array.from(new Set(inwardData.map(item => item.commodity).filter(Boolean)));
  }, [inwardData]);

  const uniqueStates = useMemo(() => {
    return Array.from(new Set(inwardData.map(item => item.state).filter(Boolean)));
  }, [inwardData]);

  const uniqueBranches = useMemo(() => {
    return Array.from(new Set(inwardData.map(item => item.branch).filter(Boolean)));
  }, [inwardData]);

  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(inwardData.map(item => item.status).filter(Boolean)));
  }, [inwardData]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, clientFilter, commodityFilter, stateFilter, branchFilter, itemsPerPage, startDate, endDate]);

  // Filter data based on search and filters
  const filteredData = useMemo(() => {
    let filtered = inwardData;
    
    console.log('Filtering data. Total records:', inwardData.length);
    console.log('Date range for client-side filtering:', startDate, 'to', endDate);
    console.log('Search term:', searchTerm);
    console.log('Status filter:', statusFilter);
    console.log('Client filter:', clientFilter);
    console.log('Commodity filter:', commodityFilter);
    console.log('State filter:', stateFilter);
    console.log('Branch filter:', branchFilter);
    
    // Apply additional date filtering on client side as backup
    if (startDate && endDate) {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);
      
      filtered = filtered.filter(item => {
        if (!item.dateOfInward) return false;
        
        const itemDate = new Date(item.dateOfInward);
        if (isNaN(itemDate.getTime())) return false;
        
        return itemDate >= startDateObj && itemDate <= endDateObj;
      });
      
      console.log('After client-side date filter:', filtered.length, 'records');
    }
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item => 
        Object.values(item).some(value => 
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
      console.log('After search filter:', filtered.length, 'records');
    }

    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
      console.log('After status filter:', filtered.length, 'records');
    }



    // Apply client filter
    if (clientFilter && clientFilter !== 'all') {
      filtered = filtered.filter(item => item.clientName === clientFilter);
      console.log('After client filter:', filtered.length, 'records');
    }

    // Apply commodity filter
    if (commodityFilter && commodityFilter !== 'all') {
      filtered = filtered.filter(item => item.commodity === commodityFilter);
      console.log('After commodity filter:', filtered.length, 'records');
    }

    // Apply state filter
    if (stateFilter && stateFilter !== 'all') {
      filtered = filtered.filter(item => item.state === stateFilter);
      console.log('After state filter:', filtered.length, 'records');
    }

    // Apply branch filter
    if (branchFilter && branchFilter !== 'all') {
      filtered = filtered.filter(item => item.branch === branchFilter);
      console.log('After branch filter:', filtered.length, 'records');
    }
    
    console.log('Final filtered data:', filtered.length, 'records');
    return filtered;
  }, [inwardData, searchTerm, statusFilter, clientFilter, commodityFilter, stateFilter, branchFilter, startDate, endDate]);

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
      'Date of Inward', 'State', 'Branch', 'Location', 'Type of Business', 'Warehouse Type', 'Warehouse Code', 'Warehouse Name', 'Warehouse Address', 'Client Code', 'Client Name',
      'Commodity', 'Variety', 'Vehicle Number', 'CAD Number', 'Gatepass Number', 'Weighbridge Name', 'Weighbridge Number', 'Stack Number', 'Gross Weight (MT)', 'Tare Weight (MT)', 'Net Weight (MT)', 'Bags'
    ];
    
    // Function to create rows for multiple vehicle entries (one row per vehicle with combined stack info)
    const createDetailedRows = (dataToExport: DetailedInwardReportData[]) => {
      const detailedRows: string[] = [];
      
      dataToExport.forEach((row) => {
        // Parse inwardEntries if it exists in the row data
        const inwardEntries = (row as any).inwardEntries;
        
        // Check if we have multiple vehicle entries
        const vehicleEntries = inwardEntries && Array.isArray(inwardEntries) && inwardEntries.length > 0
          ? inwardEntries
          : [null]; // If no vehicle entries, create one row with main data
        
        vehicleEntries.forEach((vehicleEntry: any) => {
          const rowData = [
            row.dateOfInward || '',
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
            // Vehicle-specific data (if available)
            vehicleEntry ? (vehicleEntry.vehicleNumber || row.vehicleNumber || '') : (row.vehicleNumber || ''),
            row.cadNumber || '',
            vehicleEntry ? (vehicleEntry.getpassNumber || row.gatepassNumber || '') : (row.gatepassNumber || ''),
            vehicleEntry ? (vehicleEntry.weightBridge || row.weighbridgeName || '') : (row.weighbridgeName || ''),
            vehicleEntry ? (vehicleEntry.weightBridgeSlipNumber || row.weighbridgeNumber || '') : (row.weighbridgeNumber || ''),
            // Stack-specific data - combine all stacks for this vehicle
            (() => {
              const stacks = vehicleEntry?.stacks && Array.isArray(vehicleEntry.stacks) && vehicleEntry.stacks.length > 0
                ? vehicleEntry.stacks
                : ((row as any).stacks && Array.isArray((row as any).stacks) && (row as any).stacks.length > 0 ? (row as any).stacks : []);
              
              if (stacks.length > 0) {
                return stacks.map((stack: any) => `${stack.stackNumber || ''} (${stack.numberOfBags || 0} bags)`).join('; ');
              }
              return row.stackNumber || '';
            })(),
            vehicleEntry ? (vehicleEntry.grossWeight || row.grossWeight || '') : (row.grossWeight || ''),
            vehicleEntry ? (vehicleEntry.tareWeight || row.tareWeight || '') : (row.tareWeight || ''),
            vehicleEntry ? (vehicleEntry.netWeight || row.netWeight || '') : (row.netWeight || ''),
            vehicleEntry ? (vehicleEntry.totalBags || row.bags || '') : (row.bags || '')
          ];
          
          // Escape values with commas or quotes
          const csvRow = rowData.map(value => {
            const stringValue = String(value).replace(/"/g, '""');
            return typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n')) 
              ? `"${stringValue}"` 
              : stringValue;
          }).join(',');
          
          detailedRows.push(csvRow);
        });
      });
      
      return detailedRows;
    };
    
    const csvHeaders = headers.join(',');
    const detailedRows = createDetailedRows(filteredData);
    const csvRows = detailedRows.join('\r\n');
    
    const csvContent = `\uFEFF${csvHeaders}\r\n${csvRows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'detailed_inward_report.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');

    setClientFilter('all');
    setCommodityFilter('all');
    setStateFilter('all');
    setBranchFilter('all');
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || statusFilter !== 'all' || clientFilter !== 'all' || commodityFilter !== 'all' || stateFilter !== 'all' || branchFilter !== 'all';

  // Handle date change with validation
  const handleDateChange = (field: 'start' | 'end', value: string) => {
    if (field === 'start') {
      setStartDate(value);
      // Ensure end date is not more than 6 months after start date
      if (value && endDate) {
        const start = new Date(value);
        const end = new Date(endDate);
        const sixMonthsLater = new Date(start);
        sixMonthsLater.setMonth(start.getMonth() + 6);
        
        if (end > sixMonthsLater) {
          setEndDate(sixMonthsLater.toISOString().split('T')[0]);
        }
      }
    } else {
      setEndDate(value);
      // Ensure start date is not more than 6 months before end date
      if (value && startDate) {
        const start = new Date(startDate);
        const end = new Date(value);
        const sixMonthsBefore = new Date(end);
        sixMonthsBefore.setMonth(end.getMonth() - 6);
        
        if (start < sixMonthsBefore) {
          setStartDate(sixMonthsBefore.toISOString().split('T')[0]);
        }
      }
    }
  };

  // Toggle column visibility
  const toggleColumn = (columnKey: string) => {
    setVisibleColumns(prev => 
      prev.includes(columnKey) 
        ? prev.filter(col => col !== columnKey)
        : [...prev, columnKey]
    );
  };

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
              className="inline-flex items-center text-base sm:text-lg font-semibold tracking-tight bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors w-full md:w-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Reports
            </button>
          </div>
          
          <div className="text-center flex flex-col items-center w-full md:w-auto">
            {/* Logo */}
            <div className="w-36 h-10 relative mb-3 bg-white rounded-lg px-2 py-1">
              {/* <Image 
                src="/AGlogo.webp" 
                alt="AgroGreen Logo" 
                fill
                className="object-contain"
                priority
              /> */}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-orange-600 inline-block border-b-4 border-green-500 pb-2 px-4 sm:px-6 py-3 bg-orange-100 rounded-lg w-full md:w-auto">
              Detailed Inward Report
            </h1>
            <p className="text-sm text-gray-600 mt-1">Comprehensive detailed inward transaction analysis</p>
          </div>
          
          <div className="flex items-center justify-center md:justify-end w-full md:w-48">
            <Button 
              onClick={exportToCSV} 
              disabled={filteredData.length === 0}
              className="bg-blue-500 hover:bg-blue-600 text-white w-full md:w-auto"
            >
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
          onStartDateChange={(value) => handleDateChange('start', value)}
          onEndDateChange={(value) => handleDateChange('end', value)}
          filterOptions={[
            {
              key: 'status',
              label: 'Status',
              value: statusFilter,
              options: uniqueStatuses
            },
            {
              key: 'client',
              label: 'Client',
              value: clientFilter,
              options: uniqueClients
            },
            {
              key: 'commodity',
              label: 'Commodity',
              value: commodityFilter,
              options: uniqueCommodities
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
            }
          ]}
          onFilterChange={(key, value) => {
            switch (key) {
              case 'status':
                setStatusFilter(value);
                break;
              case 'client':
                setClientFilter(value);
                break;
              case 'commodity':
                setCommodityFilter(value);
                break;
              case 'state':
                setStateFilter(value);
                break;
              case 'branch':
                setBranchFilter(value);
                break;
            }
          }}
          loading={loading}
          onApplyFilters={fetchInwardData}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          allColumns={allColumns}
          visibleColumns={visibleColumns}
          onToggleColumn={toggleColumn}
          onClearFilters={clearFilters}
          activeFilters={[
            ...(statusFilter !== 'all' ? [{
              key: 'status',
              label: 'Status',
              value: statusFilter,
              onRemove: () => setStatusFilter('all')
            }] : []),
            ...(clientFilter !== 'all' ? [{
              key: 'client',
              label: 'Client',
              value: clientFilter,
              onRemove: () => setClientFilter('all')
            }] : []),
            ...(commodityFilter !== 'all' ? [{
              key: 'commodity',
              label: 'Commodity',
              value: commodityFilter,
              onRemove: () => setCommodityFilter('all')
            }] : []),
            ...(stateFilter !== 'all' ? [{
              key: 'state',
              label: 'State',
              value: stateFilter,
              onRemove: () => setStateFilter('all')
            }] : []),
            ...(branchFilter !== 'all' ? [{
              key: 'branch',
              label: 'Branch',
              value: branchFilter,
              onRemove: () => setBranchFilter('all')
            }] : [])
          ]}
        />

        {/* Results Summary */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredData.length)} of {filteredData.length} entries
            {filteredData.length !== inwardData.length && ` (filtered from ${inwardData.length} total)`}
            {hasActiveFilters && ` (filtered)`}
            {startDate && endDate && ` | Date Range: ${startDate} to ${endDate}`}
          </div>
        </div>



        {/* Data Table */}
        <Card>
          <CardContent className="p-0">
            <div className="table-container">
              <table className="w-full border-collapse border border-gray-200">
                <thead className="bg-orange-100">
                  <tr>
                    {visibleColumnsData.map((column, index) => (
                      <th 
                        key={column.key} 
                        className={`border border-orange-300 px-4 py-2 text-left text-orange-800 font-semibold ${column.width} ${
                          index === 0 ? 'sticky-first-column header' : ''
                        }`}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumnsData.length} className="border border-gray-200 px-4 py-8 text-center text-gray-500">
                        No data available
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        {visibleColumnsData.map((column, colIndex) => {
                          const value = item[column.key as keyof DetailedInwardReportData] || '-';
                          const isFirstColumn = colIndex === 0;
                          const isNumericColumn = ['grossWeight', 'tareWeight', 'netWeight', 'bags'].includes(column.key);
                          const isFontMedium = ['warehouseName', 'clientName', 'vehicleNumber'].includes(column.key);
                          
                          return (
                            <td
                              key={column.key}
                              className={`border border-gray-200 px-4 py-2 ${
                                isNumericColumn ? 'text-right' : ''
                              } ${
                                isFontMedium ? 'font-medium' : ''
                              } ${
                                column.key === 'dateOfInward' ? 'font-mono text-sm' : ''
                              } ${
                                isFirstColumn ? 'sticky-first-column' : ''
                              }`}
                            >
                              {value}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              
              {filteredData.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">
                  <p>No inward data found matching the current filters</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>



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
