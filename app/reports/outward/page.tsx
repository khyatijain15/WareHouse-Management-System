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

interface OutwardReportData {
  id: string;
  outwardDate: string;
  outwardCode: string;
  srWrNumber: string;
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
  weighbridgeSlipNumber: string;
  grossWeight: string | number;
  tareWeight: string | number;
  netWeight: string | number;
  totalOutwardBags: string | number;
  stackNumber: string;
  stackOutwardBags: string;
  doCode: string;
  outwardEntries?: any[]; // Array of vehicle entries from Firebase
  [key: string]: any;
}

export default function OutwardReportsPage() {
  const router = useRouter();
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [commodityFilter, setCommodityFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  
  // Data and UI states
  const [loading, setLoading] = useState(false);
  const [outwardData, setOutwardData] = useState<OutwardReportData[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'outwardDate', 'outwardCode', 'srWrNumber', 'state', 'branch', 'location', 'typeOfBusiness', 
    'warehouseType', 'warehouseCode', 'warehouseName', 'clientCode', 'clientName', 'commodity', 
    'variety', 'vehicleNumber', 'cadNumber', 'gatepassNumber', 'weighbridgeName', 'weighbridgeSlipNumber',
    'grossWeight', 'tareWeight', 'netWeight', 'totalOutwardBags', 'stackNumber', 'stackOutwardBags', 'doCode'
  ]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Enhanced column definitions matching parameter specifications
  const allColumns = [
    { key: 'outwardDate', label: 'Outward Date', width: 'w-28' },
    { key: 'outwardCode', label: 'Outward Code', width: 'w-24' },
    { key: 'srWrNumber', label: 'SR/WR Number', width: 'w-24' },
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
    { key: 'vehicleNumber', label: 'Vehicle Number', width: 'w-28' },
    { key: 'cadNumber', label: 'CAD Number', width: 'w-24' },
    { key: 'gatepassNumber', label: 'Gatepass Number', width: 'w-28' },
    { key: 'weighbridgeName', label: 'Weighbridge Name', width: 'w-32' },
    { key: 'weighbridgeSlipNumber', label: 'Weighbridge Slip Number', width: 'w-36' },
    { key: 'grossWeight', label: 'Gross Weight (MT)', width: 'w-32' },
    { key: 'tareWeight', label: 'Tare Weight (MT)', width: 'w-32' },
    { key: 'netWeight', label: 'Net Weight (MT)', width: 'w-32' },
    { key: 'totalOutwardBags', label: 'Total Outward Bags', width: 'w-32' },
    { key: 'stackNumber', label: 'Stack Number', width: 'w-24' },
    { key: 'stackOutwardBags', label: 'Stack Outward Bags', width: 'w-32' },
    { key: 'doCode', label: 'DO Code', width: 'w-24' }
  ];

  const fetchOutwardData = useCallback(async () => {
    console.log('Starting fetchOutwardData...', { startDate, endDate });
    setLoading(true);
    try {
      const outwardCollection = collection(db, 'outwards');
      console.log('Created outward collection reference');
      
      // Test collection connectivity first
      console.log('Testing collection connectivity...');
      const testQuery = query(outwardCollection, limit(1));
      const testSnapshot = await getDocs(testQuery);
      console.log('Collection test:', {
        exists: testSnapshot.size > 0,
        size: testSnapshot.size,
        collectionPath: 'outwards',
        firstDoc: testSnapshot.docs[0]?.id
      });
      
      // Fetch all documents first for reliable date filtering
      let q = query(outwardCollection, limit(1000));
      console.log('Built query to fetch all documents');
      
      const querySnapshot = await getDocs(q);
      
      console.log('Outward collection query result:', querySnapshot.size, 'documents');
      console.log('Applying date filtering for outward report. Date range:', startDate, 'to', endDate);
      
      // Filter documents by date range first
      let filteredDocs = querySnapshot.docs;
      
      if (startDate && endDate) {
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999); // Include the entire end date
        
        console.log('Filtering outward by date range:', startDateObj, 'to', endDateObj);
        
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
          
          // If no createdAt or invalid, try outwardDate
          if (!docDate || isNaN(docDate.getTime())) {
            if (docData.outwardDate) {
              docDate = new Date(docData.outwardDate);
            } else if (docData.dateOfOutward) {
              docDate = new Date(docData.dateOfOutward);
            }
          }
          
          // If still no valid date, exclude from results
          if (!docDate || isNaN(docDate.getTime())) {
            console.log('No valid date found for outward document:', doc.id);
            return false;
          }
          
          // Check if date falls within range
          const isInRange = docDate >= startDateObj && docDate <= endDateObj;
          return isInRange;
        });
        
        console.log('Outward report: After date filtering:', filteredDocs.length, 'of', querySnapshot.docs.length, 'documents remain');
      }
      
      const data = await Promise.all(filteredDocs.map(async (doc, index) => {
        const docData = doc.data();
        
        // Debug: Log available fields in outward data
        console.log('=== OUTWARD DOCUMENT DEBUG ===');
        console.log('Outward document fields for warehouse:', docData.warehouseName, Object.keys(docData));
        console.log('Outward document data:', docData);
        
        // Specific debugging for problematic fields
        console.log('Problematic fields debug:', {
          gatepass: docData.gatepass,
          weighbridgeSlipNo: docData.weighbridgeSlipNo,
          stackEntries: docData.stackEntries,
          doCode: docData.doCode,
          deliveryOrderCode: docData.deliveryOrderCode,
          stackEntriesLength: docData.stackEntries ? docData.stackEntries.length : 0,
          stackEntriesType: typeof docData.stackEntries
        });
        
        // Fetch warehouse type from inspections collection with enhanced logic
        // Initialize with outward collection data as base values
        let warehouseType = docData.warehouseType || docData.typeOfWarehouse || '';
        let warehouseCode = docData.warehouseCode || '';
        let warehouseAddress = docData.warehouseAddress || '';
        let businessType = docData.typeOfBusiness || docData.businessType || '';
        
        if (docData.warehouseName) {
          console.log('Looking for warehouse type for warehouse name:', docData.warehouseName);
          try {
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
              
              // Get warehouse type with multiple fallback options
              warehouseType = inspectionData.typeOfWarehouse || 
                            inspectionData.typeofwarehouse || 
                            inspectionData.warehouseType || 
                            inspectionData.warehouseInspectionData?.typeOfWarehouse ||
                            inspectionData.warehouseInspectionData?.warehouseType ||
                            inspectionData.warehouseInspectionData?.typeofwarehouse || '';
              
              // Get other warehouse details
              warehouseCode = inspectionData.warehouseCode || 
                            inspectionData.warehouseInspectionData?.warehouseCode || '';
              warehouseAddress = inspectionData.warehouseAddress || 
                               inspectionData.warehouseInspectionData?.warehouseAddress || '';
              businessType = inspectionData.businessType || 
                           inspectionData.typeOfBusiness ||
                           inspectionData.warehouseInspectionData?.businessType ||
                           inspectionData.warehouseInspectionData?.typeOfBusiness || '';
              
              console.log('Extracted warehouse type from inspections:', warehouseType);
            } else {
              console.log('No inspections data found for warehouse:', docData.warehouseName);
            }
          } catch (error) {
            console.log('Error fetching warehouse type from inspections:', error);
          }
        }
        
        // Initialize inward data variables
        let inwardData: any = {};
        let commodity = '';
        let variety = '';
        let clientCode = '';
        let clientName = '';
        let inwardWarehouseCode = '';
        let inwardWarehouseName = '';
        let inwardWarehouseAddress = '';
        let inwardTypeOfBusiness = '';
        let srWrNumberFromInward = '';
        
        // Fetch comprehensive inward data for the SR/WR number
        const srwrNo = docData.srwrNo || docData.inwardId || docData.receiptNumber || '';
        if (srwrNo) {
          try {
            console.log('Fetching inward data for SR/WR:', srwrNo);
            const inwardCollection = collection(db, 'inward');
            
            // Try multiple search strategies for inward data
            let inwardSnapshot = await getDocs(query(inwardCollection, where('srwrNo', '==', srwrNo)));
            
            if (inwardSnapshot.empty) {
              inwardSnapshot = await getDocs(query(inwardCollection, where('inwardId', '==', srwrNo)));
            }
            
            if (inwardSnapshot.empty && docData.inwardId) {
              inwardSnapshot = await getDocs(query(inwardCollection, where('inwardId', '==', docData.inwardId)));
            }
            
            if (!inwardSnapshot.empty) {
              inwardData = inwardSnapshot.docs[0].data();
              console.log('Found inward data:', inwardData);
              
              // Extract data from inward collection
              commodity = inwardData.commodity || inwardData.commodityName || '';
              variety = inwardData.varietyName || inwardData.variety || '';
              clientCode = inwardData.clientCode || inwardData.clientId || '';
              clientName = inwardData.clientName || inwardData.client || '';
              inwardWarehouseCode = inwardData.warehouseCode || '';
              inwardWarehouseName = inwardData.warehouseName || '';
              inwardWarehouseAddress = inwardData.warehouseAddress || '';
              inwardTypeOfBusiness = inwardData.typeOfBusiness || inwardData.businessType || '';
              
              // SR/WR number from inward section
              srWrNumberFromInward = inwardData.srwrNo || inwardData.receiptNumber || inwardData.inwardId || '';
              
              console.log('Extracted inward data:', {
                commodity, variety, clientCode, clientName,
                warehouseCode: inwardWarehouseCode, warehouseName: inwardWarehouseName
              });
            } else {
              console.log('No inward data found for SR/WR:', srwrNo);
            }
          } catch (error) {
            console.log('Error fetching inward data:', error);
          }
        }
        
        // Debug Type of Business and Warehouse Type sources
        console.log('Business/Warehouse Type debug for warehouse:', docData.warehouseName, {
          inspectionWarehouseType: warehouseType,
          inspectionBusinessType: businessType,
          inwardTypeOfBusiness: inwardData.typeOfBusiness,
          inwardBusinessType: inwardData.businessType,
          outwardTypeOfBusiness: docData.typeOfBusiness,
          outwardBusinessType: docData.businessType,
          outwardWarehouseType: docData.warehouseType,
          outwardTypeOfWarehouse: docData.typeOfWarehouse
        });
        
        // Debug Commodity, Variety, and Weight fields
        console.log('Commodity/Variety/Weight debug for SR/WR:', srwrNo, {
          inwardCommodity: commodity,
          inwardVariety: variety,
          outwardCommodity: docData.commodity,
          outwardCommodityName: docData.commodityName,
          outwardVariety: docData.variety,
          outwardVarietyName: docData.varietyName,
          grossWeight: docData.grossWeight,
          tareWeight: docData.tareWeight,
          netWeight: docData.netWeight,
          quantity: docData.quantity,
          outwardQuantity: docData.outwardQuantity
        });
        
        // Format date for consistent ISO display (YYYY-MM-DD)
        const formatDateForISO = (dateValue: any) => {
          if (!dateValue) return '';
          
          if (dateValue?.toDate) {
            return dateValue.toDate().toISOString().split('T')[0]; // Format as YYYY-MM-DD
          }
          
          if (typeof dateValue === 'string') {
            // If already in correct format, return as is
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
              return dateValue;
            }
            const date = new Date(dateValue);
            return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
          }
          
          return '';
        };
        
        return {
          id: doc.id,
          
          // Outward Date – picked from outward section module
          outwardDate: formatDateForISO(docData.createdAt || docData.dateOfOutward || docData.outwardDate),
          
          // Outward code – picked from outward section module with parameter name outward code
          outwardCode: docData.outwardCode || docData.outwardId || doc.id || '',
          
          // SR/WR number – picked from inward section module with parameter name SR number for SR, WR number for WR
          srWrNumber: srWrNumberFromInward || docData.srwrNo || docData.inwardId || '',
          
          // State – picked from outward section for a particular sr/wr number
          state: docData.state || docData.bankState || docData.selectedState || '',
          
          // Branch - picked from outward section for a particular sr/wr number
          branch: docData.branch || docData.bankBranch || docData.branchName || '',
          
          // Location – picked from outward section for a particular sr/wr number
          location: docData.location || docData.warehouseAddress || docData.address || '',
          
          // Type of Business - picked from inward section for a particular sr/wr number
          typeOfBusiness: inwardTypeOfBusiness || businessType || docData.typeOfBusiness || docData.businessType || inwardData.typeOfBusiness || inwardData.businessType || '',
          
          // Warehouse type – picked from warehouse inspection survey form with parameter name \"TYPE OF WAREHOUSE\"
          warehouseType: warehouseType || docData.warehouseType || docData.typeOfWarehouse || inwardData.warehouseType || inwardData.typeOfWarehouse || '',
          
          // Warehouse code - picked from inward section for a particular sr/wr number
          warehouseCode: inwardWarehouseCode || warehouseCode || docData.warehouseCode || '',
          
          // Warehouse name - picked from inward section for a particular sr/wr number
          warehouseName: inwardWarehouseName || docData.warehouseName || '',
          
          // Warehouse address - picked from inward section for a particular sr/wr number
          warehouseAddress: inwardWarehouseAddress || warehouseAddress || docData.warehouseAddress || '',
          
          // Client code - picked from inward section for a particular sr/wr number
          clientCode: clientCode || docData.clientCode || docData.clientId || '',
          
          // Client name - picked from inward section for a particular sr/wr number
          clientName: clientName || docData.client || docData.clientName || '',
          
          // Commodity - picked from inward section for a particular sr/wr number
          commodity: commodity || docData.commodity || docData.commodityName || inwardData.commodity || inwardData.commodityName || '',
          
          // Variety - picked from inward section for a particular sr/wr number
          variety: variety || docData.variety || docData.varietyName || inwardData.variety || inwardData.varietyName || '',
          
          // Vehicle number - picked from outward section for a particular sr/wr number
          vehicleNumber: docData.vehicleNumber || docData.truckNumber || '',
          
          // Log for debugging multiple vehicles
          _debug_vehicle: {
            docId: doc.id,
            vehicleNumber: docData.vehicleNumber,
            truckNumber: docData.truckNumber,
            srwrNo: docData.srwrNo,
            doCode: docData.doCode
          },
          
          // CAD number - picked from outward section for a particular sr/wr number
          cadNumber: docData.cadNumber || docData.cad || '',
          
          // Gatepass number - picked from outward section for a particular sr/wr number
          gatepassNumber: docData.gatepass || docData.gatepassNumber || docData.gatePassNumber || docData.gatePassNo || docData.gatepassNo || '',
          
          // Weighbridge name - picked from outward section for a particular sr/wr number
          weighbridgeName: docData.weighbridgeName || docData.weighBridgeName || '',
          
          // Weighbridge slip number - picked from outward section for a particular sr/wr number
          weighbridgeSlipNumber: docData.weighbridgeSlipNo || docData.weighbridgeSlipNumber || docData.weighBridgeSlipNumber || docData.slipNumber || docData.slipNo || '',
          
          // Gross Weight (MT) - picked from outward section for a particular sr/wr number
          grossWeight: (docData.grossWeight !== null && docData.grossWeight !== undefined && String(docData.grossWeight).trim() !== '') 
            ? String(docData.grossWeight)
            : (docData.grossWeightMT !== null && docData.grossWeightMT !== undefined && String(docData.grossWeightMT).trim() !== '') 
              ? String(docData.grossWeightMT)
              : '',
          
          // Tare Weight (MT) - picked from outward section for a particular sr/wr number
          tareWeight: (docData.tareWeight !== null && docData.tareWeight !== undefined && String(docData.tareWeight).trim() !== '') 
            ? String(docData.tareWeight)
            : (docData.tareWeightMT !== null && docData.tareWeightMT !== undefined && String(docData.tareWeightMT).trim() !== '') 
              ? String(docData.tareWeightMT)
              : '',
          
          // Net Weight (MT) - picked from outward section for a particular sr/wr number
          netWeight: (docData.netWeight !== null && docData.netWeight !== undefined && String(docData.netWeight).trim() !== '') 
            ? String(docData.netWeight)
            : (docData.netWeightMT !== null && docData.netWeightMT !== undefined && String(docData.netWeightMT).trim() !== '') 
              ? String(docData.netWeightMT)
              : (docData.quantity !== null && docData.quantity !== undefined && String(docData.quantity).trim() !== '') 
                ? String(docData.quantity)
                : (docData.outwardQuantity !== null && docData.outwardQuantity !== undefined && String(docData.outwardQuantity).trim() !== '') 
                  ? String(docData.outwardQuantity)
                  : '',
          
          // Total Outward Bags - picked from outward section for a particular sr/wr number
          totalOutwardBags: docData.totalBagsOutward || docData.totalOutwardBags || docData.outwardBags || docData.bags || docData.totalBags || '',
          
          // Stack Number- picked from outward section for a particular sr/wr number
          stackNumber: (() => {
            if (docData.stackEntries && Array.isArray(docData.stackEntries) && docData.stackEntries.length > 0) {
              const stackNos = docData.stackEntries
                .filter((stack: any) => stack && (stack.stackNo || stack.stackNumber))
                .map((stack: any) => stack.stackNo || stack.stackNumber || stack.stack)
                .filter(Boolean);
              return stackNos.length > 0 ? stackNos.join(', ') : '';
            }
            return docData.stackNumber || docData.stackNo || '';
          })(),
          
          // Stack Outward Bags- picked from outward section for a particular sr/wr number
          stackOutwardBags: (() => {
            if (docData.stackEntries && Array.isArray(docData.stackEntries) && docData.stackEntries.length > 0) {
              const stackBags = docData.stackEntries
                .filter((stack: any) => stack && (stack.bags !== undefined && stack.bags !== null))
                .map((stack: any) => stack.bags || stack.outwardBags || 0);
              return stackBags.length > 0 ? stackBags.join(', ') : '';
            }
            return docData.stackOutwardBags || docData.stackBags || '';
          })(),
          
          // DO code - picked from outward section for a particular sr/wr number
          doCode: docData.doCode || docData.deliveryOrderCode || docData.doNumber || '',
          
          // Outward entries array - contains vehicle-specific data for multiple vehicles
          outwardEntries: docData.outwardEntries && Array.isArray(docData.outwardEntries) && docData.outwardEntries.length > 0
            ? docData.outwardEntries
            : undefined,
          
          // Keep original fields for backward compatibility and debugging
          _originalData: {
            outwardSection: {
              createdAt: docData.createdAt,
              outwardCode: docData.outwardCode,
              srwrNo: docData.srwrNo,
              state: docData.state,
              branch: docData.branch
            },
            inwardSection: inwardData,
            inspectionSection: {
              warehouseType,
              warehouseCode,
              warehouseAddress,
              businessType
            }
          }
        };
      }));
      
      console.log('Processed outward data:', data.length, 'records');
      console.log('Sample processed data:', data.slice(0, 2));
      
      // Log vehicle grouping information for debugging
      const vehiclesByDO = data.reduce((acc: any, record: any) => {
        const doCode = record.doCode || 'NO_DO';
        if (!acc[doCode]) acc[doCode] = [];
        acc[doCode].push({
          vehicle: record.vehicleNumber,
          srwr: record.srWrNumber,
          docId: record._debug_vehicle?.docId
        });
        return acc;
      }, {});
      console.log('🚛 Vehicles grouped by DO Code:', vehiclesByDO);
      console.log('📊 Total unique DO codes:', Object.keys(vehiclesByDO).length);
      
      // If no data found with date filters, try without filters
      if (data.length === 0 && startDate && endDate) {
        console.log('No data found with date filters, trying without filters...');
        const fallbackQuery = query(outwardCollection, orderBy('createdAt', 'desc'), limit(100));
        const fallbackSnapshot = await getDocs(fallbackQuery);
        console.log('Fallback query result:', fallbackSnapshot.size, 'documents');
        
        if (fallbackSnapshot.size > 0) {
          console.log('Found data without date filters. The date field might be named differently.');
          // Process fallback data
          const fallbackData = await Promise.all(fallbackSnapshot.docs.map(async (doc) => {
            const docData = doc.data();
            console.log('Sample document fields:', Object.keys(docData));
            console.log('Sample document createdAt:', docData.createdAt);
            console.log('Sample document date fields:', {
              createdAt: docData.createdAt,
              dateOfOutward: docData.dateOfOutward,
              outwardDate: docData.outwardDate,
              date: docData.date
            });
            
            // Return simplified data for debugging
            return {
              id: doc.id,
              outwardDate: docData.createdAt?.toDate?.()?.toISOString()?.split('T')[0] || docData.dateOfOutward || docData.outwardDate || docData.date || '',
              outwardCode: docData.outwardCode || docData.outwardId || doc.id || '',
              srWrNumber: docData.srwrNo || docData.inwardId || '',
              state: docData.state || '',
              branch: docData.branch || '',
              location: docData.location || '',
              typeOfBusiness: docData.typeOfBusiness || '',
              warehouseType: 'N/A',
              warehouseCode: docData.warehouseCode || '',
              warehouseName: docData.warehouseName || '',
              warehouseAddress: docData.warehouseAddress || '',
              clientCode: docData.clientCode || '',
              clientName: docData.client || docData.clientName || '',
              commodity: docData.commodity || '',
              variety: docData.varietyName || docData.variety || '',
              vehicleNumber: docData.vehicleNumber || '',
              cadNumber: docData.cadNumber || '',
              gatepassNumber: docData.gatepassNumber || '',
              weighbridgeName: docData.weighbridgeName || '',
              weighbridgeSlipNumber: docData.weighbridgeSlipNumber || '',
              grossWeight: docData.grossWeight || '',
              tareWeight: docData.tareWeight || '',
              netWeight: docData.netWeight || '',
              totalOutwardBags: docData.totalOutwardBags || docData.outwardBags || '',
              stackNumber: docData.stackNumber || '',
              stackOutwardBags: docData.stackOutwardBags || '',
              doCode: docData.doCode || ''
            };
          }));
          setOutwardData(fallbackData);
          console.log('Set fallback outward data in state:', fallbackData.length, 'records');
        } else {
          setOutwardData([]);
          console.log('No outward data found in collection');
        }
      } else {
        setOutwardData(data);
        console.log('Set outward data in state');
      }
    } catch (error) {
      console.error('Error fetching outward data:', error);
      setOutwardData([]);
    } finally {
      setLoading(false);
      console.log('Finished fetchOutwardData');
    }
  }, [startDate, endDate]);

  // Set default date range (last 6 months)
  useEffect(() => {
    console.log('Setting default date range...');
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    
    const endDateStr = today.toISOString().split('T')[0];
    const startDateStr = sixMonthsAgo.toISOString().split('T')[0];
    
    console.log('Default date range:', { startDate: startDateStr, endDate: endDateStr });
    setEndDate(endDateStr);
    setStartDate(startDateStr);
  }, []);

  // Fetch outward data when component mounts or when date filters change
  useEffect(() => {
    if (startDate && endDate) {
      fetchOutwardData();
    }
  }, [startDate, endDate, fetchOutwardData]);

  // Get unique filter options
  const uniqueWarehouses = useMemo(() => {
    return Array.from(new Set(outwardData.map(item => item.warehouseName).filter(Boolean))).sort();
  }, [outwardData]);

  const uniqueClients = useMemo(() => {
    return Array.from(new Set(outwardData.map(item => item.clientName).filter(Boolean))).sort();
  }, [outwardData]);

  const uniqueCommodities = useMemo(() => {
    return Array.from(new Set(outwardData.map(item => item.commodity).filter(Boolean))).sort();
  }, [outwardData]);

  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(outwardData.map(item => item.status).filter(Boolean))).sort();
  }, [outwardData]);

  const uniqueStates = useMemo(() => {
    return Array.from(new Set(outwardData.map(item => item.state).filter(Boolean))).sort();
  }, [outwardData]);

  const uniqueBranches = useMemo(() => {
    return Array.from(new Set(outwardData.map(item => item.branch).filter(Boolean))).sort();
  }, [outwardData]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, warehouseFilter, clientFilter, commodityFilter, stateFilter, branchFilter, itemsPerPage, startDate, endDate]);

  // Filter data based on search and filters
  const filteredData = useMemo(() => {
    let filtered = outwardData;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item => 
        Object.values(item).some(value => 
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply status filter - Note: status field might not exist in new structure
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    // Apply warehouse filter using correct field name
    if (warehouseFilter && warehouseFilter !== 'all') {
      filtered = filtered.filter(item => item.warehouseName === warehouseFilter);
    }

    // Apply client filter using correct field name
    if (clientFilter && clientFilter !== 'all') {
      filtered = filtered.filter(item => item.clientName === clientFilter);
    }

    // Apply commodity filter using correct field name
    if (commodityFilter && commodityFilter !== 'all') {
      filtered = filtered.filter(item => item.commodity === commodityFilter);
    }

    // Apply state filter
    if (stateFilter && stateFilter !== 'all') {
      filtered = filtered.filter(item => item.state === stateFilter);
    }

    // Apply branch filter
    if (branchFilter && branchFilter !== 'all') {
      filtered = filtered.filter(item => item.branch === branchFilter);
    }
    
    // Sort by outward code in ascending sequential order (OUT-0001, OUT-0002, OUT-0003, etc.)
    filtered = filtered.sort((a, b) => {
      const codeA = a.outwardCode || '';
      const codeB = b.outwardCode || '';
      
      // Extract numeric part from outward code (e.g., "OUT-0001" -> 1)
      const extractNumber = (code: string): number => {
        const match = code.match(/OUT-(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      };
      
      const numA = extractNumber(codeA);
      const numB = extractNumber(codeB);
      
      // Sort by numeric value
      if (numA !== numB) {
        return numA - numB;
      }
      
      // If numeric values are same or extraction failed, fall back to string comparison
      return codeA.localeCompare(codeB);
    });
    
    return filtered;
  }, [outwardData, searchTerm, statusFilter, warehouseFilter, clientFilter, commodityFilter, branchFilter, stateFilter]);

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

  // Export filtered data to CSV - Following inward section logic for multiple vehicle entries
  const exportToCSV = () => {
    console.log('CSV Export Debug:');
    console.log('- outwardData length:', outwardData.length);
    console.log('- filteredData length:', filteredData.length);
    console.log('- loading state:', loading);
    
    if (filteredData.length === 0) {
      console.log('No filtered data to export');
      if (outwardData.length > 0) {
        console.log('But outwardData has', outwardData.length, 'items - using that instead');
        return exportDataArray(outwardData);
      }
      return;
    }
    
    exportDataArray(filteredData);
  };

  const exportDataArray = (dataArray: OutwardReportData[]) => {
    console.log('Exporting data array with', dataArray.length, 'items');
    
    // Define CSV headers
    const headers = [
      'Outward Date', 'Outward Code', 'SR/WR Number', 'State', 'Branch', 'Location',
      'Type of Business', 'Warehouse Type', 'Warehouse Code', 'Warehouse Name', 'Warehouse Address',
      'Client Code', 'Client Name', 'Commodity', 'Variety', 'DO Code',
      // Vehicle-specific columns
      'Vehicle Number', 'CAD Number', 'Gatepass Number', 'Weighbridge Name', 'Weighbridge Slip Number',
      'Gross Weight (MT)', 'Tare Weight (MT)', 'Net Weight (MT)', 'Total Outward Bags',
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
    
    // Function to create rows for multiple vehicle entries (following inward pattern)
    // Each outward document may have multiple vehicles in outwardEntries array
    const createDetailedRows = (dataToExport: OutwardReportData[]) => {
      const detailedRows: string[] = [];
      
      dataToExport.forEach((row) => {
        // Check if we have multiple vehicle entries (outwardEntries array)
        // This follows the same pattern as inward's inwardEntries
        const vehicleEntries = row.outwardEntries && Array.isArray(row.outwardEntries) && row.outwardEntries.length > 0
          ? row.outwardEntries
          : [null]; // If no vehicle entries, create one row with main data
        
        vehicleEntries.forEach((vehicleEntry: any) => {
          // Combine stack entries into a single field
          const stackDetails = (() => {
            // Try to get stacks from vehicleEntry first, then fall back to row-level data
            const stackEntries = vehicleEntry?.stackEntries && Array.isArray(vehicleEntry.stackEntries) && vehicleEntry.stackEntries.length > 0
              ? vehicleEntry.stackEntries
              : (row.stackNumber && row.stackOutwardBags ? null : null);
            
            if (stackEntries && stackEntries.length > 0) {
              return stackEntries.map((stack: any) => 
                `${stack.stackNo || stack.stackNumber || ''} - ${stack.bags || stack.outwardBags || 0}`
              ).join(' , ');
            }
            
            // Fallback to row-level data if no vehicle-specific stacks
            if (row.stackNumber && row.stackOutwardBags) {
              const stackNos = row.stackNumber.split(',').map(s => s.trim());
              const stackBags = row.stackOutwardBags.toString().split(',').map(s => s.trim());
              
              if (stackNos.length === stackBags.length) {
                return stackNos.map((stackNo, idx) => 
                  `${stackNo} - ${stackBags[idx]}`
                ).join(' , ');
              }
            }
            return row.stackNumber ? `${row.stackNumber} - ${row.stackOutwardBags || 0}` : '';
          })();
          
          const csvRow = [
            // Common warehouse and client data (same for all entries in this outward document)
            row.outwardDate || '',
            row.outwardCode || '',
            row.srWrNumber || '',
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
            row.doCode || '',
            
            // Vehicle-specific data (from vehicleEntry if available, otherwise from main row)
            vehicleEntry ? (vehicleEntry.vehicleNumber || row.vehicleNumber || '') : (row.vehicleNumber || ''),
            vehicleEntry ? (vehicleEntry.cadNumber || row.cadNumber || '') : (row.cadNumber || ''),
            vehicleEntry ? (vehicleEntry.gatepass || vehicleEntry.gatepassNumber || row.gatepassNumber || '') : (row.gatepassNumber || ''),
            vehicleEntry ? (vehicleEntry.weighbridgeName || row.weighbridgeName || '') : (row.weighbridgeName || ''),
            vehicleEntry ? (vehicleEntry.weighbridgeSlipNo || vehicleEntry.weighbridgeSlipNumber || row.weighbridgeSlipNumber || '') : (row.weighbridgeSlipNumber || ''),
            vehicleEntry ? (vehicleEntry.grossWeight || row.grossWeight || '') : (row.grossWeight || ''),
            vehicleEntry ? (vehicleEntry.tareWeight || row.tareWeight || '') : (row.tareWeight || ''),
            vehicleEntry ? (vehicleEntry.netWeight || row.netWeight || '') : (row.netWeight || ''),
            vehicleEntry ? (vehicleEntry.totalBagsOutward || vehicleEntry.bags || row.totalOutwardBags || '') : (row.totalOutwardBags || ''),
            stackDetails
          ].map(escapeCsvValue).join(',');
          
          detailedRows.push(csvRow);
        });
      });
      
      return detailedRows;
    };
    
    // Create CSV content with BOM for Excel UTF-8 support
    const csvContent = [
      headers.join(','),
      ...createDetailedRows(dataArray)
    ].join('\r\n');
    
    console.log('Final CSV content preview:', csvContent.substring(0, 200) + '...');
    
    // Add BOM (Byte Order Mark) for proper UTF-8 encoding in Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `outward-report-${startDate}_to_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    console.log('CSV file download initiated');
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setWarehouseFilter('all');
    setClientFilter('all');
    setCommodityFilter('all');
    setStateFilter('all');
    setBranchFilter('all');
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || statusFilter !== 'all' || warehouseFilter !== 'all' || 
    clientFilter !== 'all' || commodityFilter !== 'all' || stateFilter !== 'all' || branchFilter !== 'all';

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
              Outward Reports
            </h1>
            <p className="text-muted-foreground">Generate and view outward transaction reports</p>
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
          onStartDateChange={(date) => {
            console.log('Start date changed to:', date);
            setStartDate(date);
          }}
          onEndDateChange={(date) => {
            console.log('End date changed to:', date);
            setEndDate(date);
          }}
          filterOptions={filterOptions}
          onFilterChange={handleFilterChange}
          loading={loading}
          onApplyFilters={fetchOutwardData}
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
            {filteredData.length !== outwardData.length && ` (filtered from ${outwardData.length} total)`}
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
                              {column.key === 'outwardDate' ? (
                                formatDate(item[column.key])
                              ) : column.key === 'grossWeight' || column.key === 'tareWeight' || 
                                       column.key === 'netWeight' || column.key === 'totalOutwardBags' || 
                                       column.key === 'stackOutwardBags' ? (
                                <span className="text-right block">
                                  {(item[column.key] !== null && item[column.key] !== undefined && item[column.key] !== '') 
                                    ? item[column.key] 
                                    : '-'}
                                </span>
                              ) : column.key === 'outwardCode' || column.key === 'srWrNumber' || 
                                       column.key === 'warehouseCode' || column.key === 'clientCode' || 
                                       column.key === 'vehicleNumber' || column.key === 'cadNumber' ||
                                       column.key === 'gatepassNumber' || column.key === 'weighbridgeSlipNumber' ||
                                       column.key === 'stackNumber' || column.key === 'doCode' ? (
                                <span className="font-mono text-sm">
                                  {(item[column.key] !== null && item[column.key] !== undefined && item[column.key] !== '') 
                                    ? item[column.key] 
                                    : '-'}
                                </span>
                              ) : (
                                (item[column.key] !== null && item[column.key] !== undefined && item[column.key] !== '') 
                                  ? item[column.key] 
                                  : '-'
                              )}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {filteredData.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    {loading ? 'Loading data...' : 'No outward data found matching the current filters'}
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
