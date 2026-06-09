"use client";

import DashboardLayout from '@/components/dashboard-layout';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Download, Calendar, Filter, X, ArrowLeft, Eye, EyeOff, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

interface InwardReportData {
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
  bankBranchName: string;
  bankState: string;
  ifscCode: string;
  cadNumber: string;
  inwardDate: string;
  srWrNumber: string;
  srWrDate: string;
  fundingSrWrDate: string;
  srLastValidityDate: string;
  totalBags: string;
  totalQty: string;
  roBags: string;
  roQty: string;
  doBags: string;
  doQty: string;
  balanceBags: string;
  balanceQty: string;
  insuranceManagedBy: string;
  rate: string;
  aum: string;
  databaseLocation: string;
  // Vehicle-related fields
  inwardEntries?: any[] | null; // Array of vehicle entries for multiple vehicle data
  vehicleNumber?: string;
  getpassNumber?: string;
  weightBridge?: string;
  weightBridgeSlipNumber?: string;
  grossWeight?: string;
  tareWeight?: string;
  netWeight?: string;
  averageWeight?: string;
  stacks?: any[];
  [key: string]: any;
}

export default function InwardReportsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [inwardData, setInwardData] = useState<InwardReportData[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Column definitions matching the exact format requested
  const allColumns = [
    { key: 'state', label: 'State', width: 'w-20' },
    { key: 'branch', label: 'Branch', width: 'w-20' },
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
    { key: 'bankName', label: 'Bank Name', width: 'w-28' },
    { key: 'bankBranchName', label: 'Bank Branch Name', width: 'w-32' },
    { key: 'bankState', label: 'Bank State', width: 'w-24' },
    { key: 'ifscCode', label: 'IFSC Code', width: 'w-24' },
    { key: 'cadNumber', label: 'CAD Number', width: 'w-24' },
    { key: 'inwardDate', label: 'Inward Date', width: 'w-28' },
    { key: 'srWrNumber', label: 'SR/WR Number', width: 'w-32' },
    { key: 'srWrDate', label: 'SR/WR Date', width: 'w-28' },
  { key: 'fundingSrWrDate', label: 'Funding SR/WR Date', width: 'w-36' },
  { key: 'srLastValidityDate', label: 'SR/WR Last Validity Date', width: 'w-32' },
    { key: 'totalBags', label: 'Total Bags', width: 'w-24' },
    { key: 'totalQty', label: 'Total Qty(MT)', width: 'w-28' },
    { key: 'roBags', label: 'RO Bags', width: 'w-20' },
    { key: 'roQty', label: 'RO Qty (MT)', width: 'w-24' },
    { key: 'doBags', label: 'DO Bags', width: 'w-20' },
    { key: 'doQty', label: 'DO Qty (MT)', width: 'w-24' },
    { key: 'balanceBags', label: 'Balance Bags', width: 'w-24' },
    { key: 'balanceQty', label: 'Balance Quantity (MT)', width: 'w-28' },
    { key: 'insuranceManagedBy', label: 'Insurance Managed by', width: 'w-32' },
    { key: 'rate', label: 'Rate (Rs/MT)', width: 'w-24' },
    { key: 'aum', label: 'AUM(Rs/MT)', width: 'w-24' }
  ];

  const [visibleColumns, setVisibleColumns] = useState<string[]>(allColumns.map(col => col.key));

  // Set default date range (last 6 months)
  useEffect(() => {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(sixMonthsAgo.toISOString().split('T')[0]);
  }, []);

  // Fetch inward data when component mounts or when date filters change
  useEffect(() => {
    if (startDate && endDate) {
      fetchInwardData();
    }
  }, [startDate, endDate]);

  const fetchInwardData = async () => {
    setLoading(true);
    try {
      console.log('🔍 INWARD REPORT: Starting comprehensive data fetch from multiple collections...');
      
      // Fetch from multiple collections for comprehensive data
      const [inwardSnapshot, inspectionsSnapshot] = await Promise.all([
        // Fetch from main inward collection - get all documents first for reliable date filtering
        (() => {
          const inwardCollection = collection(db, 'inward');
          let inwardQuery = query(inwardCollection, limit(1000));
          
          return getDocs(inwardQuery);
        })(),
        // Fetch from inspections collection for warehouse type and bank details
        getDocs(collection(db, 'inspections'))
      ]);
      
      console.log('📊 Collection query results:', {
        inward: inwardSnapshot.size,
        inspections: inspectionsSnapshot.size
      });
      
      // Create warehouse details map from inspections for comprehensive fallback data
      const warehouseDetailsMap = new Map();
      inspectionsSnapshot.docs.forEach(doc => {
        const docData = doc.data();
        const warehouseName = docData.warehouseName;
        if (warehouseName && (docData.status === 'activated' || docData.status === 'reactivate')) {
          warehouseDetailsMap.set(warehouseName, {
            // Warehouse type with comprehensive fallback chain
            warehouseType: docData.typeOfWarehouse ||
                          docData.typeofwarehouse ||
                          docData.warehouseType ||
                          docData.warehouseInspectionData?.typeOfWarehouse ||
                          docData.warehouseInspectionData?.warehouseType || '',
            // Business type with fallback chain
            businessType: docData.businessType ||
                         docData.typeOfBusiness ||
                         docData.warehouseInspectionData?.businessType ||
                         docData.warehouseInspectionData?.typeOfBusiness || '',
            // Bank details from inspections
            bankName: docData.bankName || docData.warehouseInspectionData?.bankName || '',
            bankBranchName: docData.bankBranch || docData.bankBranchName || docData.warehouseInspectionData?.bankBranch || '',
            bankState: docData.bankState || docData.warehouseInspectionData?.bankState || '',
            ifscCode: docData.ifscCode || docData.warehouseInspectionData?.ifscCode || '',
            // Other warehouse details
            warehouseCode: docData.warehouseCode || '',
            address: docData.address || docData.warehouseInspectionData?.address || '',
            state: docData.state || docData.warehouseInspectionData?.state || '',
            branch: docData.branch || docData.warehouseInspectionData?.branch || '',
            location: docData.location || docData.warehouseInspectionData?.location || '',
            // Insurance data for validity calculation
            insuranceEntries: docData.warehouseInspectionData?.insuranceEntries || []
          });
        }
      });
      
      console.log('✅ Created warehouse details map for', warehouseDetailsMap.size, 'warehouses');

      // Debug: Show sample inward documents
      if (inwardSnapshot.size > 0) {
        console.log('Sample Inward documents (first 3):');
        inwardSnapshot.docs.slice(0, 3).forEach((doc, idx) => {
          const data = doc.data();
          console.log(`Inward Doc ${idx + 1}:`, {
            id: doc.id,
            srwrNo: data.srwrNo,
            srWrNumber: data.srWrNumber,
            inwardId: data.inwardId,
            totalBags: data.totalBags,
            totalQty: data.totalQty,
            totalQuantity: data.totalQuantity,
            quantity: data.quantity,
            marketRate: data.marketRate,
            rate: data.rate,
            quantityFields: Object.keys(data).filter(key => key.toLowerCase().includes('qty') || key.toLowerCase().includes('quantity')),
            rateFields: Object.keys(data).filter(key => key.toLowerCase().includes('rate')),
            availableFields: Object.keys(data).filter(key => key.toLowerCase().includes('sr') || key.toLowerCase().includes('wr') || key.toLowerCase().includes('inward'))
          });
        });
      }

      // Fetch from RO collection (releaseOrders)
      const roCollection = collection(db, 'releaseOrders');
      const roSnapshot = await getDocs(query(roCollection, limit(2000)));
      console.log('Release Orders collection query result:', roSnapshot.size, 'documents');

      // Fetch from DO collection (deliveryOrders)
      const doCollection = collection(db, 'deliveryOrders');
      const doSnapshot = await getDocs(query(doCollection, limit(2000)));
      console.log('Delivery Orders collection query result:', doSnapshot.size, 'documents');

      // Debug: Show sample RO documents
      if (roSnapshot.size > 0) {
        console.log('Sample RO documents (first 3):');
        roSnapshot.docs.slice(0, 3).forEach((doc, idx) => {
          const data = doc.data();
          console.log(`RO Doc ${idx + 1}:`, {
            id: doc.id,
            srwrNo: data.srwrNo,
            roCode: data.roCode,
            releaseBags: data.releaseBags,
            releaseQuantity: data.releaseQuantity,
            roStatus: data.roStatus,
            availableFields: Object.keys(data)
          });
        });
      }

      // Debug: Show sample DO documents
      if (doSnapshot.size > 0) {
        console.log('Sample DO documents (first 3):');
        doSnapshot.docs.slice(0, 3).forEach((doc, idx) => {
          const data = doc.data();
          console.log(`DO Doc ${idx + 1}:`, {
            id: doc.id,
            srwrNo: data.srwrNo,
            doCode: data.doCode,
            doBags: data.doBags,
            doQuantity: data.doQuantity,
            availableFields: Object.keys(data),
            quantityFields: Object.keys(data).filter(key => key.toLowerCase().includes('qty') || key.toLowerCase().includes('quantity') || key.toLowerCase().includes('bags'))
          });
        });
      }

      // Create maps for efficient lookups
      const roDataBySrWr = new Map<string, { totalRoBags: number; totalRoQty: number; roEntries: any[] }>();
      const doDataBySrWr = new Map<string, { totalDoBags: number; totalDoQty: number; doEntries: any[] }>();
      
      // Helper function to extract inward ID from SR/WR number
      const extractInwardId = (srWrNumber: string): string => {
        if (!srWrNumber) return '';
        // Extract INW-XXX from formats like "SR-INW-038-2025-07-13" or "INW-038"
        const match = srWrNumber.match(/INW-\d+/);
        return match ? match[0] : srWrNumber;
      };

      // Process RO data and group by SR/WR number
      roSnapshot.docs.forEach(doc => {
        const roData = doc.data();
        const fullSrWrNumber = roData.srwrNo || roData.srWrNumber || '';
        
        if (fullSrWrNumber) {
          // Extract the inward ID for matching
          const inwardId = extractInwardId(fullSrWrNumber);
          
          // Use correct field names from RO collection
          const roBags = parseFloat(roData.releaseBags || roData.totalBags || '0') || 0;
          const roQty = parseFloat(roData.releaseQuantity || roData.totalQuantity || '0') || 0;
          
          // Store by both full SR/WR number and extracted inward ID for flexible matching
          const keysToStore = [fullSrWrNumber, inwardId].filter(Boolean);
          
          keysToStore.forEach(key => {
            if (!roDataBySrWr.has(key)) {
              roDataBySrWr.set(key, { 
                totalRoBags: 0, 
                totalRoQty: 0, 
                roEntries: [] 
              });
            }
            
            const existing = roDataBySrWr.get(key)!;
            existing.totalRoBags += roBags;
            existing.totalRoQty += roQty;
            existing.roEntries.push({
              id: doc.id,
              roBags,
              roQty,
              roCode: roData.roCode,
              roStatus: roData.roStatus,
              releaseBags: roBags,
              releaseQuantity: roQty,
              fullSrWrNumber,
              extractedInwardId: inwardId,
              ...roData
            });
          });
          
          console.log(`RO aggregation for ${fullSrWrNumber} (${inwardId}):`, {
            roCode: roData.roCode,
            roStatus: roData.roStatus,
            currentRoBags: roBags,
            currentRoQty: roQty,
            extractedInwardId: inwardId,
            fullSrWrNumber: fullSrWrNumber
          });
        }
      });

      // Process DO data and group by SR/WR number
      doSnapshot.docs.forEach(doc => {
        const doData = doc.data();
        const fullSrWrNumber = doData.srwrNo || doData.srWrNumber || '';
        
        if (fullSrWrNumber) {
          // Extract the inward ID for matching (same logic as RO)
          const inwardId = extractInwardId(fullSrWrNumber);
          
          // Use correct field names from DO collection: doBags and doQuantity
          const doBags = parseFloat(doData.doBags || doData.deliveryBags || doData.totalBags || doData.bags || '0') || 0;
          const doQty = parseFloat(doData.doQuantity || doData.deliveryQuantity || doData.totalQuantity || doData.quantity || '0') || 0;
          
          // Store by both full SR/WR number and extracted inward ID for flexible matching
          const keysToStore = [fullSrWrNumber, inwardId].filter(Boolean);
          
          keysToStore.forEach(key => {
            if (!doDataBySrWr.has(key)) {
              doDataBySrWr.set(key, { 
                totalDoBags: 0, 
                totalDoQty: 0, 
                doEntries: [] 
              });
            }
            
            const existing = doDataBySrWr.get(key)!;
            existing.totalDoBags += doBags;
            existing.totalDoQty += doQty;
            existing.doEntries.push({
              id: doc.id,
              doBags,
              doQty,
              doCode: doData.doCode,
              doStatus: doData.doStatus,
              deliveryBags: doBags,
              deliveryQuantity: doQty,
              fullSrWrNumber,
              extractedInwardId: inwardId,
              ...doData
            });
          });
          
          console.log(`DO aggregation for ${fullSrWrNumber} (${inwardId}):`, {
            doCode: doData.doCode,
            doStatus: doData.doStatus,
            originalDoBags: doData.doBags,
            originalDoQuantity: doData.doQuantity,
            currentDoBags: doBags,
            currentDoQty: doQty,
            extractedInwardId: inwardId,
            fullSrWrNumber: fullSrWrNumber,
            fieldSource: doData.doBags ? 'doBags' : (doData.deliveryBags ? 'deliveryBags' : 'fallback')
          });
        }
      });

      if (inwardSnapshot.size > 0) {
        console.log('Applying date filtering for inward report. Date range:', startDate, 'to', endDate);
        
        // Filter documents by date range first
        let filteredDocs = inwardSnapshot.docs;
        
        if (startDate && endDate) {
          const startDateObj = new Date(startDate);
          const endDateObj = new Date(endDate);
          endDateObj.setHours(23, 59, 59, 999); // Include the entire end date
          
          console.log('Filtering by date range:', startDateObj, 'to', endDateObj);
          
          filteredDocs = inwardSnapshot.docs.filter(doc => {
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
            
            // If no createdAt or invalid, try dateOfInward or inwardDate
            if (!docDate || isNaN(docDate.getTime())) {
              if (docData.dateOfInward) {
                docDate = new Date(docData.dateOfInward);
              } else if (docData.inwardDate) {
                docDate = new Date(docData.inwardDate);
              }
            }
            
            // If still no valid date, exclude from results
            if (!docDate || isNaN(docDate.getTime())) {
              console.log('No valid date found for inward document:', doc.id);
              return false;
            }
            
            // Check if date falls within range
            const isInRange = docDate >= startDateObj && docDate <= endDateObj;
            return isInRange;
          });
          
          console.log('Inward report: After date filtering:', filteredDocs.length, 'of', inwardSnapshot.docs.length, 'documents remain');
        }
        
        // Process filtered inward records and merge with RO data
        const processedData = filteredDocs.map((doc, index) => {
          const docData = doc.data();
                
          console.log(`Processing inward document ${index + 1}:`, doc.id);
          
          // Generate SR/WR Number in the same format as inward section
          // Format: {SR/WR}-{inwardId}-{dateWithoutDashes}
          const generateSRWRNumber = (data: any) => {
            // Use stored srNo if available
            if (data.srNo) return data.srNo;
            if (data.srwrNo) return data.srwrNo;
            
            // Otherwise generate it: prefix-inwardId-dateWithoutDashes
            const receiptType = data.receiptType || 'SR';
            const prefix = receiptType === 'WR' ? 'WR' : 'SR';
            const inwardId = data.inwardId || data.id || 'XXX';
            const dateStr = data.dateOfInward || data.inwardDate || '';
            const dateWithoutDashes = dateStr.replace(/-/g, '');
            
            return `${prefix}-${inwardId}-${dateWithoutDashes}`;
          };
          
          const formattedSRWRNumber = generateSRWRNumber(docData);
          
          // Get SR/WR number for this inward entry - check multiple possible field names
          const possibleSrWrNumbers = [
            formattedSRWRNumber,
            docData.srwrNo,
            docData.srWrNumber, 
            docData.inwardId,
            docData.id
          ].filter(Boolean);
          
          // Try to find matching RO data using different keys
          let roData = null;
          let roMatchedKey = '';
          
          for (const key of possibleSrWrNumbers) {
            if (roDataBySrWr.has(key)) {
              roData = roDataBySrWr.get(key);
              roMatchedKey = key;
              break;
            }
          }

          // Try to find matching DO data using different keys
          let doData = null;
          let doMatchedKey = '';
          
          for (const key of possibleSrWrNumbers) {
            if (doDataBySrWr.has(key)) {
              doData = doDataBySrWr.get(key);
              doMatchedKey = key;
              break;
            }
          }
          
          console.log(`Inward document ${index + 1} SR/WR lookup:`, {
            docId: doc.id,
            possibleKeys: possibleSrWrNumbers,
            roMatchedKey: roMatchedKey,
            doMatchedKey: doMatchedKey,
            hasRoData: !!roData,
            hasDoData: !!doData,
            roEntriesCount: roData?.roEntries?.length || 0,
            doEntriesCount: doData?.doEntries?.length || 0,
            availableRoKeys: Array.from(roDataBySrWr.keys()).slice(0, 5), // Show first 5 for debugging
            availableDoKeys: Array.from(doDataBySrWr.keys()).slice(0, 5)  // Show first 5 for debugging
          });
          
          console.log(`SR/WR: ${roMatchedKey || doMatchedKey || possibleSrWrNumbers[0] || 'NO_KEY'}`, {
            inwardTotalBags: docData.totalBags || docData.bags,
            inwardTotalQuantity: docData.totalQuantity,
            inwardTotalQty: docData.totalQty,
            inwardQuantity: docData.quantity,
            finalTotalQty: docData.totalQuantity || docData.totalQty || docData.quantity,
            roTotalBags: roData?.totalRoBags || 0,
            roTotalQty: roData?.totalRoQty || 0,
            roEntriesCount: roData?.roEntries?.length || 0,
            doTotalBags: doData?.totalDoBags || 0,
            doTotalQty: doData?.totalDoQty || 0,
            doEntriesCount: doData?.doEntries?.length || 0
          });
          
          // Format date properly - show only date without timezone
          const formatDate = (dateValue: any) => {
            if (!dateValue) return '';
            
            // Handle Firebase Timestamp objects
            if (dateValue?.toDate) {
              return dateValue.toDate().toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              });
            }
            
            // Handle ISO date strings like "2025-09-27T20:59:34.673Z"
            if (typeof dateValue === 'string') {
              try {
                const date = new Date(dateValue);
                if (!isNaN(date.getTime())) {
                  return date.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  });
                }
                return dateValue; // Return as-is if not a valid date
              } catch (error) {
                return dateValue; // Return as-is if parsing fails
              }
            }
            
            // Handle Date objects
            if (dateValue instanceof Date) {
              return dateValue.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              });
            }
            
            return '';
          };

          // Check if bank details are present
          const hasBankDetails = (data: any) => {
            return !!(data.bankName || data.bankBranchName || data.ifscCode || data.cadNumber);
          };

          // Extract insurance managed by value (handle object case)
          const extractInsuranceValue = (insuranceValue: any) => {
            if (!insuranceValue) return '';
            if (typeof insuranceValue === 'string') return insuranceValue;
            if (typeof insuranceValue === 'object') {
              // Handle case where insurance is an object like {insuranceTakenBy, insuranceId}
              return insuranceValue.insuranceTakenBy || insuranceValue.insuranceId || insuranceValue.name || '';
            }
            return String(insuranceValue);
          };

          // Safe string extraction helper
          const safeString = (value: any) => {
            if (!value) return '';
            if (typeof value === 'string') return value;
            if (typeof value === 'number') return String(value);
            if (typeof value === 'object') return '';
            return String(value);
          };

          // Parse numeric values for calculations
          const parseNumber = (value: any) => {
            const parsed = parseFloat(value || '0');
            return isNaN(parsed) ? 0 : parsed;
          };

          // Get values from inward collection - these are the exact values entered during inward entry
          const inwardTotalBags = parseNumber(docData.totalBags || docData.bags);
          const inwardTotalQty = parseNumber(docData.totalQuantity || docData.totalQty || docData.quantity);
          
          // Enhanced logging to verify we're getting the original inward quantities and rate
          console.log(`📊 Inward data for ${possibleSrWrNumbers[0]}:`, {
            originalTotalQuantity: docData.totalQuantity,
            originalTotalQty: docData.totalQty,
            originalQuantity: docData.quantity,
            finalCalculatedQty: inwardTotalQty,
            quantitySourceField: docData.totalQuantity ? 'totalQuantity' : (docData.totalQty ? 'totalQty' : 'quantity'),
            originalTotalBags: docData.totalBags || docData.bags,
            finalCalculatedBags: inwardTotalBags,
            originalMarketRate: docData.marketRate,
            originalRate: docData.rate,
            finalRate: docData.marketRate || docData.rate,
            rateSourceField: docData.marketRate ? 'marketRate' : 'rate',
            hasBankDetails: hasBankDetails(docData),
            srGenerationDate: docData.srGenerationDate,
            totalValue: docData.totalValue,
            bankName: docData.bankName,
            ifscCode: docData.ifscCode
          });
          
          // Get aggregated RO values
          const aggregatedRoBags = roData?.totalRoBags || 0;
          const aggregatedRoQty = roData?.totalRoQty || 0;

          // Get aggregated DO values
          const aggregatedDoBags = doData?.totalDoBags || 0;
          const aggregatedDoQty = doData?.totalDoQty || 0;

          // Calculate balance with RO taking precedence over DO.
          // If RO is present for this SR/WR, balance = total - RO (ignore DO for balance calculation).
          // If RO is absent, balance = total - DO.
          // Also limit balanceQty to up to 3 decimal places.
          const hasRo = !!(roData && ( (roData.roEntries && roData.roEntries.length > 0) || aggregatedRoBags > 0 || aggregatedRoQty > 0 ));

          let balanceBags = 0;
          let balanceQty = 0;

          if (hasRo) {
            balanceBags = inwardTotalBags - aggregatedRoBags;
            balanceQty = inwardTotalQty - aggregatedRoQty;
          } else {
            balanceBags = inwardTotalBags - aggregatedDoBags;
            balanceQty = inwardTotalQty - aggregatedDoQty;
          }

          // Ensure non-negative and format qty up to 3 decimal places (trim trailing zeros)
          const formatQty = (n: number) => {
            const nonNeg = Math.max(0, n);
            // toFixed(3) gives 3 decimals; parseFloat removes unnecessary trailing zeros
            return parseFloat(nonNeg.toFixed(3)).toString();
          };

          // Get warehouse details from inspections for enhanced data
          const warehouseDetails = warehouseDetailsMap.get(docData.warehouseName) || {};
          
          console.log('=== INWARD DOCUMENT DEBUG ===');
          console.log('Processing inward for warehouse:', docData.warehouseName);
          console.log('Warehouse details from inspections:', warehouseDetails);
          console.log('Inward data warehouse type:', docData.warehouseType);
          console.log('Inward data bank branch name:', docData.bankBranchName);
          console.log('Available insurance entries:', warehouseDetails.insuranceEntries?.length || 0);
          
          // Calculate SR Last Validity Date based on insurance policy end dates
          const calculateSRValidityDate = () => {
            // First try the direct field from inward data
            if (docData.srLastValidityDate) {
              return formatDate(docData.srLastValidityDate);
            }

            // If no direct field, calculate based on warehouse-level insurance policy end dates
            const insuranceEntries = warehouseDetails.insuranceEntries || [];
            if (insuranceEntries.length > 0) {
              // Find the earliest policy end date among all insurance entries
              let earliestEndDate: Date | null = null;

              insuranceEntries.forEach((insurance: any) => {
                const fireEndDate = insurance.firePolicyEndDate ? new Date(insurance.firePolicyEndDate) : null;
                const burglaryEndDate = insurance.burglaryPolicyEndDate ? new Date(insurance.burglaryPolicyEndDate) : null;

                [fireEndDate, burglaryEndDate].forEach((date: Date | null) => {
                  if (date && !isNaN(date.getTime())) {
                    if (!earliestEndDate || date < earliestEndDate) {
                      earliestEndDate = date;
                    }
                  }
                });
              });

              if (earliestEndDate) {
                const validDate = earliestEndDate as Date;
                console.log('Calculated SR validity date from insurance policies:', validDate.toISOString().split('T')[0]);
                return validDate.toISOString().split('T')[0];
              }
            }

            // Fallback: If insurance taken by bank, typically 9 months from inward date
            const inwardDate = docData.inwardDate || docData.dateOfInward;
            if (inwardDate && hasBankDetails(docData)) {
              const date = new Date(inwardDate);
              if (!isNaN(date.getTime())) {
                date.setMonth(date.getMonth() + 9); // Add 9 months for bank-funded storage
                console.log('Calculated SR validity date (9 months from inward):', date.toISOString().split('T')[0]);
                return date.toISOString().split('T')[0];
              }
            }

            return ''; // Empty if cannot calculate
          };

          // Field mapping with comprehensive fallback logic

          return {
            id: doc.id,
            state: docData.state || docData.databaseLocation || warehouseDetails.state || '',
            branch: docData.branch || warehouseDetails.branch || '',
            location: docData.location || warehouseDetails.location || '',
            // Type of Business with fallback to inspections
            typeOfBusiness: docData.typeOfBusiness || docData.businessType || warehouseDetails.businessType || '',
            // Warehouse Type with comprehensive fallback from inspections
            warehouseType: docData.warehouseType || warehouseDetails.warehouseType || '',
            warehouseCode: docData.warehouseCode || warehouseDetails.warehouseCode || '',
            warehouseName: docData.warehouseName || '',
            warehouseAddress: docData.warehouseAddress || warehouseDetails.address || '',
            // Client Code: always show from inward data
            clientCode: docData.clientCode || '',
            // Client Name: always show from inward data
            clientName: docData.clientName || docData.client || '',
            commodity: safeString(docData.commodity || docData.commodityName),
            variety: safeString(docData.variety || docData.varietyName),
            // Bank details with comprehensive fallback from inspections
            bankName: docData.bankName || warehouseDetails.bankName || '',
            bankBranchName: docData.bankBranchName || warehouseDetails.bankBranchName || '',
            bankState: docData.bankState || warehouseDetails.bankState || '',
            ifscCode: docData.ifscCode || warehouseDetails.ifscCode || '',
            cadNumber: docData.cadNumber || '',
            inwardDate: formatDate(docData.inwardDate || docData.dateOfInward || docData.createdAt),
            srWrNumber: possibleSrWrNumbers[0] || '',
            // SR/WR Date - fetch srGenerationDate WITHOUT any bank condition (always show if available)
            // Try multiple possible field names with fallback to inward date
            srWrDate: formatDate(
              docData.srGenerationDate || 
              docData.srwrGenerationDate || 
              docData.dateOfIssue || 
              docData.createdAt
            ),
            // Funding SR/WR Date - show when bank details are present on inward OR from inspections (warehouseDetails)
            // Prefer SR generation fields from inward document, fallback to known alternatives and warehouseDetails
            fundingSrWrDate: (hasBankDetails(docData) || hasBankDetails(warehouseDetails))
              ? formatDate(
                  docData.srGenerationDate ||
                  docData.srwrGenerationDate ||
                  docData.dateOfIssue ||
                  docData.createdAt ||
                  warehouseDetails.srGenerationDate ||
                  warehouseDetails.srwrGenerationDate ||
                  ''
                )
              : '',
            // SR Last Validity Date: prefer stock validity end date from SR/WR UI (if present),
            // otherwise fall back to the calculated SR validity
            srLastValidityDate: (
              // try known stock validity fields on the inward document
              formatDate(
                docData.stockValidityEndDate ||
                docData.stockValidity?.endDate ||
                docData.stockValidityEnd ||
                docData.stockValidity?.end ||
                docData.srStockValidityEndDate
              ) || calculateSRValidityDate()
            ),
            
            // ** PROPERLY SOURCED VALUES AS PER REQUIREMENTS **
            // Total bags & qty from inward collection - ORIGINAL QUANTITIES AT TIME OF INWARD ENTRY
            totalBags: inwardTotalBags.toString(),
            totalQty: inwardTotalQty.toString(), // This shows the exact quantity entered during inward creation
            
            // RO bags & qty aggregated from RO collection for this SR/WR number
            roBags: aggregatedRoBags.toString(),
            roQty: aggregatedRoQty.toString(),
            
            // DO bags & qty aggregated from DO collection for this SR/WR number
            doBags: aggregatedDoBags.toString(),
            doQty: aggregatedDoQty.toString(),
            
            // Balance: if RO present => total - RO, else => total - DO
            balanceBags: Math.max(0, balanceBags).toString(),
            balanceQty: formatQty(balanceQty),
            
            insuranceManagedBy: extractInsuranceValue(docData.insuranceManagedBy || docData.selectedInsurance),
            rate: safeString(docData.marketRate || docData.rate), // Fetch from marketRate field in inward collection
            aum: safeString(docData.totalValue), // Fetch from totalValue field in inward collection
            databaseLocation: docData.databaseLocation || '',
            
            // Vehicle entries for multiple vehicle data - following inward section pattern
            inwardEntries: docData.inwardEntries && Array.isArray(docData.inwardEntries) && docData.inwardEntries.length > 0
              ? docData.inwardEntries
              : null, // Null if no multiple vehicle entries exist
            
            // Single vehicle data (for backward compatibility when no inwardEntries)
            vehicleNumber: docData.vehicleNumber || (docData.inwardEntries?.[0]?.vehicleNumber) || '',
            getpassNumber: docData.getpassNumber || (docData.inwardEntries?.[0]?.getpassNumber) || '',
            weightBridge: docData.weightBridge || (docData.inwardEntries?.[0]?.weightBridge) || '',
            weightBridgeSlipNumber: docData.weightBridgeSlipNumber || (docData.inwardEntries?.[0]?.weightBridgeSlipNumber) || '',
            grossWeight: docData.grossWeight || (docData.inwardEntries?.[0]?.grossWeight) || '',
            tareWeight: docData.tareWeight || (docData.inwardEntries?.[0]?.tareWeight) || '',
            netWeight: docData.netWeight || (docData.inwardEntries?.[0]?.netWeight) || '',
            averageWeight: docData.averageWeight || (docData.inwardEntries?.[0]?.averageWeight) || '',
            stacks: docData.stacks || (docData.inwardEntries?.[0]?.stacks) || [],
            
            // Debug info (can be removed later)
            _debug: {
              roEntriesCount: roData?.roEntries?.length || 0,
              roCodes: roData?.roEntries?.map(entry => entry.roCode).join(', ') || 'None',
              doEntriesCount: doData?.doEntries?.length || 0,
              doCodes: doData?.doEntries?.map(entry => entry.doCode).join(', ') || 'None',
              hasMultipleVehicles: !!(docData.inwardEntries && Array.isArray(docData.inwardEntries) && docData.inwardEntries.length > 0),
              vehicleEntriesCount: docData.inwardEntries?.length || 0
            }
          };
        });
        
        console.log('Successfully processed', processedData.length, 'inward records');
        console.log('RO data aggregation summary:', {
          totalSrWrNumbersWithRoData: roDataBySrWr.size,
          roDataBySrWr: Array.from(roDataBySrWr.entries()).slice(0, 5) // Show first 5 for debugging
        });
        console.log('DO data aggregation summary:', {
          totalSrWrNumbersWithDoData: doDataBySrWr.size,
          doDataBySrWr: Array.from(doDataBySrWr.entries()).slice(0, 5) // Show first 5 for debugging
        });
        setInwardData(processedData);
      } else {
        console.log('No inward data found');
        setInwardData([]);
      }
    } catch (error) {
      console.error('Error fetching inward data:', error);
      setInwardData([]);
    } finally {
      setLoading(false);
    }
  };

  // Get unique filter options
  const uniqueWarehouses = useMemo(() => {
    return Array.from(new Set(inwardData.map(item => item.warehouseName).filter(Boolean)));
  }, [inwardData]);

  const uniqueClients = useMemo(() => {
    return Array.from(new Set(inwardData.map(item => item.clientName).filter(Boolean)));
  }, [inwardData]);

  const uniqueStates = useMemo(() => {
    return Array.from(new Set(inwardData.map(item => item.state).filter(Boolean)));
  }, [inwardData]);

  // Filter data based on search and filters
  const filteredData = useMemo(() => {
    let filtered = inwardData;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item => 
        Object.values(item).some(value => 
          value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply warehouse filter
    if (warehouseFilter !== 'all') {
      filtered = filtered.filter(item => item.warehouseName === warehouseFilter);
    }

    // Apply client filter
    if (clientFilter !== 'all') {
      filtered = filtered.filter(item => item.clientName === clientFilter);
    }
    
    return filtered;
  }, [inwardData, searchTerm, warehouseFilter, clientFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);
  
  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, warehouseFilter, clientFilter, itemsPerPage, startDate, endDate]);

  // Export filtered data to CSV - Following inward section logic for multiple vehicle entries
  const exportToCSV = () => {
    if (filteredData.length === 0) return;
    
    // Define CSV headers - matching the visible columns structure
    const headers = [
      'State', 'Branch', 'Location', 'Type of Business', 'Warehouse Type', 'Warehouse Code',
      'Warehouse Name', 'Warehouse Address', 'Client Code', 'Client Name', 'Commodity', 'Variety',
      'Bank Name', 'Bank Branch Name', 'Bank State', 'IFSC Code', 'CAD Number', 'Inward Date',
  'SR/WR Number', 'SR/WR Date', 'Funding SR/WR Date', 'SR/WR Last Validity Date',
      'Total Bags', 'Total Qty(MT)', 'RO Bags', 'RO Qty (MT)', 'DO Bags', 'DO Qty (MT)',
      'Balance Bags', 'Balance Quantity (MT)', 'Insurance Managed by', 'Rate (Rs/MT)', 'AUM(Rs/MT)',
      // Additional vehicle-specific columns
      'Vehicle Number', 'Gatepass Number', 'Weight Bridge', 'Weight Bridge Slip Number',
      'Gross Weight (MT)', 'Tare Weight (MT)', 'Net Weight (MT)', 'Average Weight (MT)',
      'Stack Details'
    ];
    
    // Helper function to safely escape CSV values
    const escapeCsvValue = (value: any): string => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value).replace(/"/g, '""'); // Escape double quotes
      // Wrap in quotes if contains comma, newline, or double quote
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue}"`;
      }
      return stringValue;
    };
    
    // Function to create rows for multiple vehicle entries (one row per vehicle entry)
    // Following the exact same logic as inward section's handleExportCSV
    const createDetailedRows = (dataToExport: InwardReportData[]) => {
      const detailedRows: string[] = [];
      
      dataToExport.forEach((row) => {
        // Check if we have multiple vehicle entries (inwardEntries array)
        // This follows the same pattern as inward/page.tsx
        const vehicleEntries = row.inwardEntries && Array.isArray(row.inwardEntries) && row.inwardEntries.length > 0
          ? row.inwardEntries
          : [null]; // If no vehicle entries, create one row with main data
        
        vehicleEntries.forEach((vehicleEntry: any) => {
          // Create ONE row per vehicle entry with all details
          const csvRow = [
            // Main warehouse and client data (same for all vehicle entries)
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
            row.bankBranchName || '',
            row.bankState || '',
            row.ifscCode || '',
            row.cadNumber || '',
            row.inwardDate || '',
            row.srWrNumber || '',
            row.srWrDate || '',
            row.fundingSrWrDate || '',
            row.srLastValidityDate || '',
            row.totalBags || '',
            row.totalQty || '',
            row.roBags || '',
            row.roQty || '',
            row.doBags || '',
            row.doQty || '',
            row.balanceBags || '',
            row.balanceQty || '',
            row.insuranceManagedBy || '',
            row.rate || '',
            row.aum || '',
            
            // Vehicle-specific data (from vehicleEntry if available, otherwise from main row)
            vehicleEntry ? (vehicleEntry.vehicleNumber || row.vehicleNumber || '') : (row.vehicleNumber || ''),
            vehicleEntry ? (vehicleEntry.getpassNumber || row.getpassNumber || '') : (row.getpassNumber || ''),
            vehicleEntry ? (vehicleEntry.weightBridge || row.weightBridge || '') : (row.weightBridge || ''),
            vehicleEntry ? (vehicleEntry.weightBridgeSlipNumber || row.weightBridgeSlipNumber || '') : (row.weightBridgeSlipNumber || ''),
            vehicleEntry ? (vehicleEntry.grossWeight || row.grossWeight || '') : (row.grossWeight || ''),
            vehicleEntry ? (vehicleEntry.tareWeight || row.tareWeight || '') : (row.tareWeight || ''),
            vehicleEntry ? (vehicleEntry.netWeight || row.netWeight || '') : (row.netWeight || ''),
            vehicleEntry ? (vehicleEntry.averageWeight || row.averageWeight || '') : (row.averageWeight || ''),
            
            // Stack details - combine all stacks for this vehicle entry
            (() => {
              const stacks = vehicleEntry?.stacks && Array.isArray(vehicleEntry.stacks) && vehicleEntry.stacks.length > 0
                ? vehicleEntry.stacks
                : (row.stacks && Array.isArray(row.stacks) && row.stacks.length > 0 ? row.stacks : []);
              
              if (stacks.length > 0) {
                return stacks.map((stack: any) => 
                  `${stack.stackNumber || stack.stackNo || ''} (${stack.numberOfBags || stack.bags || 0} bags)`
                ).join('; ');
              }
              return '';
            })()
          ].map(escapeCsvValue).join(',');
          
          detailedRows.push(csvRow);
        });
      });
      
      return detailedRows;
    };
    
    // Create CSV content with BOM for Excel UTF-8 support
    const csvContent = [
      headers.join(','),
      ...createDetailedRows(filteredData)
    ].join('\r\n');
    
    // Add BOM (Byte Order Mark) for proper UTF-8 encoding in Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-inward-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const toggleColumn = (columnKey: string) => {
    setVisibleColumns(prev => 
      prev.includes(columnKey) 
        ? prev.filter(key => key !== columnKey)
        : [...prev, columnKey]
    );
  };

  const hasActiveFilters = searchTerm || warehouseFilter !== 'all' || clientFilter !== 'all';
  const visibleColumnsData = allColumns.filter(col => visibleColumns.includes(col.key));

  // Pagination functions
  const goToFirstPage = () => setCurrentPage(1);
  const goToPreviousPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPage = (page: number) => setCurrentPage(page);

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
              Stock Reports
            </h1>
            <p className="text-sm text-gray-600 mt-1">Comprehensive inward data analysis</p>
          </div>
          
          <div className="flex items-center justify-center md:justify-end w-full md:w-48">
            <Button 
              onClick={exportToCSV} 
              disabled={filteredData.length === 0}
              className="bg-orange-500 hover:bg-orange-600 text-white w-full md:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Controls */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Filters & Controls</CardTitle>
              <div className="flex space-x-2">
                <Button
                  onClick={() => setShowFilters(!showFilters)}
                  variant="outline"
                  size="sm"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  {showFilters ? 'Hide' : 'Show'} Filters
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      Columns ({visibleColumns.length})
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 max-h-96 overflow-y-auto">
                    <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {allColumns.map(column => (
                      <DropdownMenuCheckboxItem
                        key={column.key}
                        checked={visibleColumns.includes(column.key)}
                        onCheckedChange={() => toggleColumn(column.key)}
                      >
                        {column.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {/* Search and Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="search"
                    placeholder="Search all fields..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
                  <div>
                <Label htmlFor="start-date">Start Date</Label>
                    <Input
                  id="start-date"
                      type="date"
                      value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                <Label htmlFor="end-date">End Date</Label>
                    <Input
                  id="end-date"
                      type="date"
                      value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                  </div>
              <div>
                <Button 
                  onClick={fetchInwardData} 
                  className="mt-6 w-full"
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Apply Filters'}
                </Button>
              </div>
                  </div>

            {/* Additional Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                  <div>
                  <Label htmlFor="warehouse-filter">Warehouse</Label>
                    <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All warehouses" />
                      </SelectTrigger>
                      <SelectContent>
                      <SelectItem value="all">All warehouses</SelectItem>
                        {uniqueWarehouses.map(warehouse => (
                        <SelectItem key={warehouse} value={warehouse}>
                          {warehouse}
                        </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                  <Label htmlFor="client-filter">Client</Label>
                    <Select value={clientFilter} onValueChange={setClientFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All clients" />
                      </SelectTrigger>
                      <SelectContent>
                      <SelectItem value="all">All clients</SelectItem>
                        {uniqueClients.map(client => (
                        <SelectItem key={client} value={client}>
                          {client}
                        </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                <div className="flex items-end">
                  <Button 
                    onClick={() => {
                      setSearchTerm('');
                      setWarehouseFilter('all');
                      setClientFilter('all');
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
            </div>
            )}
          </CardContent>
        </Card>

        {/* Debug Information Card */}
        {inwardData.length > 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-blue-800">Data Aggregation Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium text-blue-700">Total Inward Records:</span>
                  <div className="text-blue-900">{inwardData.length}</div>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Total Inward Qty:</span>
                  <div className="text-blue-900">
                    {inwardData.reduce((sum, item) => sum + parseFloat(item.totalQty || '0'), 0).toFixed(2)} MT
                  </div>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Records with RO Data:</span>
                  <div className="text-blue-900">
                    {inwardData.filter(item => parseFloat(item.roBags || '0') > 0).length}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Records with DO Data:</span>
                  <div className="text-blue-900">
                    {inwardData.filter(item => parseFloat(item.doBags || '0') > 0).length}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Total RO Bags:</span>
                  <div className="text-blue-900">
                    {inwardData.reduce((sum, item) => sum + parseFloat(item.roBags || '0'), 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Total DO Bags:</span>
                  <div className="text-blue-900">
                    {inwardData.reduce((sum, item) => sum + parseFloat(item.doBags || '0'), 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Records with Bank Details:</span>
                  <div className="text-blue-900">
                    {inwardData.filter(item => item.fundingSrWrDate && item.fundingSrWrDate !== '-').length}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Funding SR/WR Dates:</span>
                  <div className="text-blue-900">
                    {inwardData.filter(item => item.fundingSrWrDate && item.fundingSrWrDate !== '-').length} populated
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-blue-600">
                ✅ Total Bags & Total Qty(MT) from inward collection (original entry quantities)<br/>
                ✅ RO Bags & RO Qty aggregated from releaseOrders collection<br/>
                ✅ DO Bags & DO Qty aggregated from deliveryOrders collection<br/>
                ✅ Balance = Total - RO - DO for each SR/WR number<br/>
                ✅ Funding SR/WR Date populated from srGenerationDate field for records with bank details
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Summary & Active Filters */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {filteredData.length > 0 ? startIndex + 1 : 0} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} records
            {hasActiveFilters && ` (filtered from ${inwardData.length} total)`}
            {startDate && endDate && ` | Date Range: ${startDate} to ${endDate}`}
            {totalPages > 1 && ` | Page ${currentPage} of ${totalPages}`}
          </div>
          
          {/* Active Filter Badges */}
          <div className="flex items-center space-x-2">
            {warehouseFilter !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
                Warehouse: {warehouseFilter}
                <button onClick={() => setWarehouseFilter('all')} className="ml-1">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {clientFilter !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
                Client: {clientFilter}
                <button onClick={() => setClientFilter('all')} className="ml-1">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {searchTerm && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                Search: &ldquo;{searchTerm}&rdquo;
                <button onClick={() => setSearchTerm('')} className="ml-1">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Data Table */}
        <Card>
          <CardContent className="p-0">
            <div className="table-container overflow-x-auto">
              <table className="w-full border-collapse border border-gray-200">
                <thead className="bg-orange-100 sticky-header">
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
                  {paginatedData.map((item, rowIndex) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      {visibleColumnsData.map((column, colIndex) => {
                        const value = item[column.key as keyof InwardReportData] || '-';
                        const isFirstColumn = colIndex === 0;
                        const isNumericColumn = ['totalBags', 'totalQty', 'roBags', 'roQty', 'doBags', 'doQty', 'balanceBags', 'balanceQty', 'rate', 'aum'].includes(column.key);
                        const isFontMedium = ['warehouseName', 'clientName', 'srWrNumber'].includes(column.key);
                        
                        return (
                          <td
                            key={column.key}
                            className={`border border-gray-200 px-4 py-2 ${
                              isNumericColumn ? 'text-right' : ''
                            } ${
                              isFontMedium ? 'font-medium' : ''
                            } ${
                              isFirstColumn ? 'sticky-first-column' : ''
                            }`}
                          >
                            {value}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredData.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {loading ? 'Loading data...' : 'No inward data found matching the current filters'}
                </div>
              )}
            </div>
            
            {/* Pagination Controls */}
            {filteredData.length > 0 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} entries
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToFirstPage}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex items-center space-x-1">
                    {/* Show page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNumber;
                      if (totalPages <= 5) {
                        pageNumber = i + 1;
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i;
                      } else {
                        pageNumber = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNumber}
                          variant={currentPage === pageNumber ? "default" : "outline"}
                          size="sm"
                          onClick={() => goToPage(pageNumber)}
                          className="h-8 w-8 p-0"
                        >
                          {pageNumber}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToLastPage}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}