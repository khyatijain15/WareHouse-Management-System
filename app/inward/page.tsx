// @ts-nocheck
"use client";

import DashboardLayout from '@/components/dashboard-layout';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, addDoc, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Download, Plus, Edit, Trash2, Eye, AlertTriangle, Lightbulb, Info } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useRoleAccess } from '@/hooks/use-role-access';
import { DataTable } from '@/components/data-table';
import { uploadToCloudinary } from '@/lib/cloudinary';
import React from 'react';
import StorageReceipt from '@/components/StorageReceipt';
import TestCertificate from '@/components/TestCertificate';
import PrintableWarehouseReceipt from '@/components/PrintableWarehouseReceipt';
import CIRReceipt from '@/components/CIRReceipt';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

// Move normalizeDate to top-level scope (before export default function InwardPage)
function normalizeDate(val: any) {
  if (!val) return '';
  let date: Date | null = null;

  // Firestore Timestamp object
  if (val.seconds) date = new Date(val.seconds * 1000);
  // Milliseconds number
  else if (typeof val === 'number' && val > 1000000000000) date = new Date(val);
  // String that looks like a number with .000000000 (e.g. '063888114600.000000000')
  else if (typeof val === 'string' && /^\d{10,}(\.\d+)?$/.test(val.replace(/^0+/, ''))) {
    const num = val.replace(/^0+/, '').split('.')[0];
    const ts = num.length > 10 ? parseInt(num) : parseInt(num) * 1000;
    if (!isNaN(ts)) date = new Date(ts);
  }
  // String that looks like a number
  else if (!isNaN(val) && val.length > 10) date = new Date(Number(val));
  // ISO string or yyyy-mm-dd or Firestore string
  else if (typeof val === 'string' && val.length >= 10) {
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) date = new Date(parsed);
    else {
      const match = val.match(/([A-Za-z]+ \d{1,2}, \d{4})/);
      if (match) {
        const d = new Date(match[1]);
        if (!isNaN(d.getTime())) date = d;
      }
    }
  }

  if (date && !isNaN(date.getTime())) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }
  return '';
}

// Get today's date in YYYY-MM-DD (local) to store the SR Generation Date as the day of approval
function todayYYYYMMDD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

// Add this helper at the top-level scope:
function parseDDMMYYYY(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const [day, month, year] = dateStr.split('-').map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

// Helper function to safely parse and validate insurance amounts
function validateInsuranceAmount(amount: any): string {
  if (amount === null || amount === undefined || amount === '') return '-';
  if (typeof amount === 'string' && (amount === '-' || amount === 'N/A' || amount === 'null' || amount === 'undefined')) return '-';
  const parsed = parseFloat(String(amount).replace(/[^\d.-]/g, ''));
  return isNaN(parsed) ? '-' : parsed.toString();
}

// Helper function to validate insurance entry structure
function validateInsuranceEntry(insurance: any): boolean {
  if (!insurance) return false;
  
  // Check if it has the required properties for source collection updates
  const hasSourceProperties = insurance.sourceDocumentId && insurance.sourceCollection && insurance.insuranceId;
  
  // Check if it has basic insurance properties
  const hasBasicProperties = insurance.firePolicyNumber || insurance.burglaryPolicyNumber;
  
  return hasBasicProperties; // Return true if it has at least basic properties
}

// 1. Add helper functions at the top-level scope:
function isDateExpired(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  let d: Date | null = null;
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    d = parseDDMMYYYY(dateStr);
  } else {
    d = new Date(dateStr);
  }
  if (!d || isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0,0,0,0);
  // Debug log
  console.log('EXPIRED CHECK:', { dateStr, parsed: d, parsedISO: d.toISOString(), today, expired: d < today });
  return d < today;
}
function isDateWithinDays(dateStr: string, days: number): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  let d: Date | null = null;
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    d = parseDDMMYYYY(dateStr);
  } else {
    d = new Date(dateStr);
  }
  if (!d || isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0,0,0,0);
  const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

// Add this above the InwardPage component:
function AlertCell({ row }: { row: any }) {
  const [insuranceEndDates, setInsuranceEndDates] = React.useState<{fire: string, burglary: string}>({fire: '', burglary: ''});
  // Always prefer selectedInsurance fields if present
  const insuranceTakenBy = (row.original.selectedInsurance && row.original.selectedInsurance.insuranceTakenBy) || row.original.insuranceManagedBy || row.original.insuranceTakenBy;
  const insuranceId = (row.original.selectedInsurance && row.original.selectedInsurance.insuranceId) || row.original.insuranceId;
  React.useEffect(() => {
    async function fetchInsuranceEndDates() {
      const warehouseName = row.original.warehouseName;
      if (!warehouseName || !insuranceTakenBy || !insuranceId) {
        setInsuranceEndDates({
          fire: row.original.firePolicyEnd || '',
          burglary: row.original.burglaryPolicyEnd || ''
        });
        return;
      }
      try {
        const inspectionsCollection = collection(db, 'inspections');
        const q = query(inspectionsCollection, where('warehouseName', '==', warehouseName));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const inspectionData = querySnapshot.docs[0].data();
          let insuranceEntries = inspectionData.insuranceEntries || [];
          if (!Array.isArray(insuranceEntries) && inspectionData.warehouseInspectionData?.insuranceEntries) {
            insuranceEntries = inspectionData.warehouseInspectionData.insuranceEntries;
          }
          // Debug: log all insurance entries for this warehouse
          console.log('INSURANCE ENTRIES for', warehouseName, insuranceEntries);
          const match = insuranceEntries.find((ins: any) => ins.insuranceTakenBy === insuranceTakenBy && ins.insuranceId === insuranceId);
          if (match) {
            setInsuranceEndDates({
              fire: match.firePolicyEndDate || '',
              burglary: match.burglaryPolicyEndDate || ''
            });
            return;
          }
        }
      } catch (e) { /* ignore */ }
      setInsuranceEndDates({
        fire: row.original.firePolicyEnd || '',
        burglary: row.original.burglaryPolicyEnd || ''
      });
    }
    fetchInsuranceEndDates();
  }, [row.original, insuranceTakenBy, insuranceId]);
  const fireEnd = normalizeDate(insuranceEndDates.fire);
  const burglaryEnd = normalizeDate(insuranceEndDates.burglary);
  const isExpired = isDateExpired(fireEnd) || isDateExpired(burglaryEnd);
  const isWithin10 = !isExpired && (isDateWithinDays(fireEnd, 10) || isDateWithinDays(burglaryEnd, 10));
  // Debug log
  console.log('ALERT CHECK:', {
    warehouse: row.original.warehouseName,
    insuranceTakenBy,
    insuranceId,
    fireEnd,
    burglaryEnd,
    isExpired,
    isWithin10
  });
  if (isWithin10) {
    // Blinking red SVG star icon
    return (
      <svg className="blinking-red" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="16" cy="28" rx="10" ry="4" fill="#B0BEC5"/>
        <polygon points="16,4 18.5,13 28,13 20,18 22.5,27 16,21.5 9.5,27 12,18 4,13 13.5,13" fill="#FF5252" stroke="#FF8A65" strokeWidth="1.5"/>
        <polygon points="16,7 17.5,13 23,13 18,16 19.5,22 16,18.5 12.5,22 14,16 9,13 14.5,13" fill="#FFE0B2"/>
      </svg>
    );
  }
  if (isExpired) {
    // Blinking orange SVG star icon
    return (
      <svg className="blinking-orange" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="16" cy="28" rx="10" ry="4" fill="#B0BEC5"/>
        <polygon points="16,4 18.5,13 28,13 20,18 22.5,27 16,21.5 9.5,27 12,18 4,13 13.5,13" fill="#FF9800" stroke="#FFB300" strokeWidth="1.5"/>
        <polygon points="16,7 17.5,13 23,13 18,16 19.5,22 16,18.5 12.5,22 14,16 9,13 14.5,13" fill="#FFE0B2"/>
      </svg>
    );
  }
  return null;
}

export default function InwardPage() {
  const router = useRouter();
  const { 
    canCreateInwardEntry, 
    canEditInwardEntry, 
    canViewCIR, 
    canApproveCIR, 
    canRejectCIR, 
    canResubmitCIR,
    canViewStorageReceipt,
    canGenerateStorageReceipt,
    canPrintStorageReceipt,
    canViewWarehouseReceipt,
    canGenerateWarehouseReceipt,
    canPrintWarehouseReceipt,
    showCIRActionButtons,
    getInwardEntryMode,
    userRole
  } = useRoleAccess();
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inwardData, setInwardData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [states, setStates] = useState<string[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [availableReservations, setAvailableReservations] = useState<any[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [commodities, setCommodities] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [insuranceData, setInsuranceData] = useState<any[]>([]);
  const [inwardEntries, setInwardEntries] = useState<any[]>([]);
  const [currentEntryIndex, setCurrentEntryIndex] = useState(0);
  const [insuranceEntries, setInsuranceEntries] = useState<any[]>([]);
  const [agrogreenInsurance, setAgrogreenInsurance] = useState<any>(null);
  const [actualBankBranch, setActualBankBranch] = useState<string>('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingRow, setEditingRow] = useState<any>(null);
  const [showSRForm, setShowSRForm] = useState(false);
  const [selectedRowForSR, setSelectedRowForSR] = useState<any>(null);
  const [inspectionInsuranceData, setInspectionInsuranceData] = useState<any[]>([]);
  // Alert / prevention states for insurance/reservation expiry
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  // Inline rectangular alert (used in-page to match other alert boxes)
  const [inlineAlert, setInlineAlert] = useState<null | { title: string; message: string; severity: 'error' | 'warning' }>(null);
  const [preventInward, setPreventInward] = useState(false);
  
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [dataVersion, setDataVersion] = useState(0);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isUploading, setIsUploading] = useState(false);
  const [fileAttachment, setFileAttachment] = useState<File | null>(null);
  const [selectedInsuranceIndex, setSelectedInsuranceIndex] = useState<number | null>(null);
  const [remainingFirePolicy, setRemainingFirePolicy] = useState('');
  const [remainingBurglaryPolicy, setRemainingBurglaryPolicy] = useState('');
  const [hologramNumber, setHologramNumber] = useState('');
  const [isFormApproved, setIsFormApproved] = useState(false);
  const [srGenerationDate, setSrGenerationDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const printRef = useRef<HTMLDivElement>(null);
  const testCertRef = useRef<HTMLDivElement>(null);
  const printableReceiptRef = useRef<HTMLDivElement>(null);
  const cirReceiptRef = useRef<HTMLDivElement>(null);
  const cirModalContentRef = useRef<HTMLDivElement>(null);
  // Add state for initial remaining values from Firestore
  const [initialRemainingFire, setInitialRemainingFire] = useState('');
  const [initialRemainingBurglary, setInitialRemainingBurglary] = useState('');
  // Track whether the initial values came from REMAINING fields (true) vs ORIGINAL policy amounts (false)
  const [isFireRemainingSource, setIsFireRemainingSource] = useState(false);
  const [isBurglaryRemainingSource, setIsBurglaryRemainingSource] = useState(false);
  // Add state for selected insurance type
  const [selectedInsuranceType, setSelectedInsuranceType] = useState<string>('all');

  // Add state for insurance information section
  const [insuranceReadOnly, setInsuranceReadOnly] = useState(false);
  const [selectedInsuranceForInward, setSelectedInsuranceForInward] = useState<any>(null);

  // In the InwardPage component, add state for 'your insurance' data
  const [yourInsurance, setYourInsurance] = useState<any>(null);
  const [hasPendingEntries, setHasPendingEntries] = useState(false);
  
  // Total Value validation state
  const [totalValueExceedsInsurance, setTotalValueExceedsInsurance] = useState(false);
  
  // Track if selected insurance is bank-funded (no amount validation needed)
  const [isBankFundedInsurance, setIsBankFundedInsurance] = useState(false);
  
  // Bank selection states (similar to insurance selection)
  const [availableBanks, setAvailableBanks] = useState<any[]>([]);
  const [selectedBank, setSelectedBank] = useState<any>(null);

  // Filter and sort inward data
  const filteredData = useMemo(() => {
    let filtered = [...inwardData];
    
    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        (item.state || '').toLowerCase().includes(searchLower) ||
        (item.branch || '').toLowerCase().includes(searchLower) ||
        (item.location || '').toLowerCase().includes(searchLower) ||
        (item.warehouseName || '').toLowerCase().includes(searchLower) ||
        (item.clientName || '').toLowerCase().includes(searchLower) ||
        (item.receiptType || '').toLowerCase().includes(searchLower) ||
        (item.inwardCode || '').toLowerCase().includes(searchLower) ||
        (item.commodity || '').toLowerCase().includes(searchLower) ||
        (item.srWrNumber || '').toLowerCase().includes(searchLower)
      );
    }
    
    // Sort by inward code in ascending order (default) or descending
    filtered.sort((a, b) => {
      const aCode = (a.inwardId || '').toString();
      const bCode = (b.inwardId || '').toString();
      
      if (sortDirection === 'asc') {
        return aCode.localeCompare(bCode, undefined, { numeric: true, sensitivity: 'base' });
      } else {
        return bCode.localeCompare(aCode, undefined, { numeric: true, sensitivity: 'base' });
      }
    });
    
    return filtered;
  }, [inwardData, searchTerm, sortDirection]);

  // Function to get receipt type from inspection collection
  const getReceiptTypeFromInspection = async (warehouseName: string): Promise<string> => {
    try {
      console.log('Fetching receipt type for warehouse:', warehouseName);
      
      if (!warehouseName || warehouseName.trim() === '') {
        console.log('No warehouse name provided, returning N/A');
        return 'N/A';
      }

      const inspectionsCollection = collection(db, 'inspections');
      
      // First try exact match
      let q = query(inspectionsCollection, where('warehouseName', '==', warehouseName));
      let querySnapshot = await getDocs(q);
      
      console.log('Exact match query result for warehouse', warehouseName, ':', querySnapshot.size, 'documents found');
      
      // If no exact match, try case-insensitive search by fetching all and filtering
      if (querySnapshot.empty) {
        console.log('No exact match found, trying case-insensitive search...');
        const allInspections = await getDocs(inspectionsCollection);
        console.log('Total inspections in collection:', allInspections.docs.length);
        
        // Log all available warehouse names for debugging
        const allWarehouseNames = allInspections.docs.map(doc => doc.data().warehouseName).filter(Boolean);
        console.log('Available warehouse names in inspections:', allWarehouseNames);
        
        const matchingInspection = allInspections.docs.find(doc => {
          const data = doc.data();
          return data.warehouseName && 
                 data.warehouseName.toLowerCase().trim() === warehouseName.toLowerCase().trim();
        });
        
        if (matchingInspection) {
          const inspectionData = matchingInspection.data();
          console.log('Case-insensitive match found for warehouse', warehouseName, ':', inspectionData);
          console.log('Receipt type found:', inspectionData.receiptType);
          return inspectionData.receiptType || 'N/A';
        }
      } else {
        const inspectionData = querySnapshot.docs[0].data();
        console.log('Exact match found for warehouse', warehouseName, ':', inspectionData);
        console.log('Receipt type found:', inspectionData.receiptType);
        return inspectionData.receiptType || 'N/A';
      }
      
      console.log('No inspection found for warehouse:', warehouseName);
      return 'N/A';
    } catch (error) {
      console.error('Error fetching receipt type for warehouse', warehouseName, ':', error);
      return 'N/A';
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch inward data for the table
      const inwardCollection = collection(db, 'inward');
      const inwardSnap = await getDocs(inwardCollection);
      console.log('Total inward entries found:', inwardSnap.docs.length);
      
      const inwardDataWithReceiptType = await Promise.all(
        inwardSnap.docs
          .filter(docSnapshot => {
          const data = docSnapshot.data();
            // Only process documents that have an inwardId
            if (!data.inwardId) {
              console.log('Skipping document without inwardId:', docSnapshot.id);
              return false;
            }
            return true;
          })
          .map(async (docSnapshot) => {
            const data = docSnapshot.data();
            console.log('Processing inward entry:', data.inwardId, 'for warehouse:', data.warehouseName || 'NO_WAREHOUSE');
          
          // Fetch receipt type from inspection collection
          const receiptType = await getReceiptTypeFromInspection(data.warehouseName);
          console.log('Receipt type for inward', data.inwardId, ':', receiptType);
          
          // Fetch insurance data for this inward entry from inspection collection based on selectedInsurance
          let insuranceData = {
            firePolicyAmount: '-',
            burglaryPolicyAmount: '-',
            firePolicyStartDate: '-',
            firePolicyEndDate: '-',
            burglaryPolicyStartDate: '-',
            burglaryPolicyEndDate: '-',
            firePolicyName: '-',
            burglaryPolicyName: '-',
            bankFundedBy: '-'
          };

          // Helper function to safely parse amounts and return actual values
          const safeParseAmount = (amount: any): string => {
            if (amount === null || amount === undefined || amount === '') return '';
            const parsed = parseFloat(String(amount));
            return isNaN(parsed) ? '' : parsed.toString();
          };

          // Check if this inward entry has selectedInsurance data
          if (data.selectedInsurance && data.selectedInsurance.insuranceId && data.selectedInsurance.insuranceTakenBy) {
            console.log('Processing selectedInsurance for inward:', data.inwardId, data.selectedInsurance);
            
            try {
              // First try to find insurance data in inspection collection
              if (data.warehouseName) {
                const inspectionsCollection = collection(db, 'inspections');
                const q = query(inspectionsCollection, where('warehouseName', '==', data.warehouseName));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                  const inspectionData = querySnapshot.docs[0].data();
                  let insuranceEntries: any[] = [];
                  
                  // Check multiple possible locations for insurance data
                  if (inspectionData.insuranceEntries && Array.isArray(inspectionData.insuranceEntries)) {
                    insuranceEntries = inspectionData.insuranceEntries;
                  } else if (inspectionData.warehouseInspectionData?.insuranceEntries && Array.isArray(inspectionData.warehouseInspectionData.insuranceEntries)) {
                    insuranceEntries = inspectionData.warehouseInspectionData.insuranceEntries;
                  } else if (inspectionData.warehouseInspectionData) {
                    // Legacy format - convert to new format
                    const legacyData = inspectionData.warehouseInspectionData;
                    if (legacyData.firePolicyNumber || legacyData.burglaryPolicyNumber) {
                      insuranceEntries = [{
                        id: `legacy_${Date.now()}`,
                        insuranceTakenBy: legacyData.insuranceTakenBy || '',
                        insuranceCommodity: legacyData.insuranceCommodity || '',
                        clientName: legacyData.clientName || '',
                        clientAddress: legacyData.clientAddress || '',
                        selectedBankName: legacyData.selectedBankName || '',
                        firePolicyCompanyName: legacyData.firePolicyCompanyName || '',
                        firePolicyNumber: legacyData.firePolicyNumber || '',
                        firePolicyAmount: legacyData.firePolicyAmount || '',
                        firePolicyStartDate: legacyData.firePolicyStartDate || null,
                        firePolicyEndDate: legacyData.firePolicyEndDate || null,
                        burglaryPolicyCompanyName: legacyData.burglaryPolicyCompanyName || '',
                        burglaryPolicyNumber: legacyData.burglaryPolicyNumber || '',
                        burglaryPolicyAmount: legacyData.burglaryPolicyAmount || '',
                        burglaryPolicyStartDate: legacyData.burglaryPolicyStartDate || null,
                        burglaryPolicyEndDate: legacyData.burglaryPolicyEndDate || null,
                        createdAt: new Date(legacyData.createdAt || Date.now())
                      }];
                    }
                  }

                  // Find matching insurance entry based on selectedInsurance
                  const matchingInsurance = insuranceEntries.find((ins: any) => 
                    ins.insuranceId === data.selectedInsurance.insuranceId &&
                    ins.insuranceTakenBy === data.selectedInsurance.insuranceTakenBy
                  );

                  if (matchingInsurance) {
                    console.log('Found matching insurance for inward:', data.inwardId, matchingInsurance);
                    console.log('Extracting insurance data from inspection collection for inward:', data.inwardId);
                    console.log('Policy amounts from matching insurance:', {
                      firePolicyAmount: matchingInsurance.firePolicyAmount,
                      burglaryPolicyAmount: matchingInsurance.burglaryPolicyAmount
                    });
                    console.log('Policy amounts from inward data:', {
                      firePolicyAmount: data.firePolicyAmount,
                      burglaryPolicyAmount: data.burglaryPolicyAmount
                    });
                    console.log('Raw date values from matchingInsurance:', {
                      firePolicyStartDate: matchingInsurance.firePolicyStartDate,
                      firePolicyEndDate: matchingInsurance.firePolicyEndDate,
                      burglaryPolicyStartDate: matchingInsurance.burglaryPolicyStartDate,
                      burglaryPolicyEndDate: matchingInsurance.burglaryPolicyEndDate,
                      firePolicyStartDateType: typeof matchingInsurance.firePolicyStartDate,
                      firePolicyEndDateType: typeof matchingInsurance.firePolicyEndDate,
                      burglaryPolicyStartDateType: typeof matchingInsurance.burglaryPolicyStartDate,
                      burglaryPolicyEndDateType: typeof matchingInsurance.burglaryPolicyEndDate
                    });
                    
                    // Try to fetch actual amounts from source collections if inspection data is missing
                    let actualFireAmount = safeParseAmount(matchingInsurance.firePolicyAmount);
                    let actualBurglaryAmount = safeParseAmount(matchingInsurance.burglaryPolicyAmount);
                    
                    // If amounts are missing from inspection, try to fetch from source collections
                    if (!actualFireAmount || !actualBurglaryAmount) {
                      console.log('Insurance amounts missing from inspection, fetching from source collections...');
                      
                      if (matchingInsurance.sourceDocumentId && matchingInsurance.insuranceId && matchingInsurance.sourceCollection) {
                        try {
                          if (matchingInsurance.sourceCollection === 'clients') {
                            // Fetch from clients collection
                            const clientDocRef = doc(db, 'clients', matchingInsurance.sourceDocumentId);
                            const clientDocSnap = await getDoc(clientDocRef);
                            
                            if (clientDocSnap.exists()) {
                              const clientData = clientDocSnap.data() as any;
                              const insurances = clientData.insurances || [];
                              const sourceInsurance = insurances.find((ins: any) => ins.insuranceId === matchingInsurance.insuranceId);
                              
                              if (sourceInsurance) {
                                console.log('Found source insurance in clients collection:', sourceInsurance);
                                actualFireAmount = safeParseAmount(sourceInsurance.firePolicyAmount) || actualFireAmount;
                                actualBurglaryAmount = safeParseAmount(sourceInsurance.burglaryPolicyAmount) || actualBurglaryAmount;
                              }
                            }
                          } else if (matchingInsurance.sourceCollection === 'agrogreen') {
                            // Fetch from agrogreen collection
                            const agrogreenDocRef = doc(db, 'agrogreen', matchingInsurance.sourceDocumentId);
                            const agrogreenDocSnap = await getDoc(agrogreenDocRef);
                            
                            if (agrogreenDocSnap.exists()) {
                              const agrogreenData = agrogreenDocSnap.data() as any;
                              console.log('Found source insurance in agrogreen collection:', agrogreenData);
                              actualFireAmount = safeParseAmount(agrogreenData.firePolicyAmount) || actualFireAmount;
                              actualBurglaryAmount = safeParseAmount(agrogreenData.burglaryPolicyAmount) || actualBurglaryAmount;
                            }
                          }
                        } catch (error) {
                          console.error('Error fetching from source collections:', error);
                        }
                      }
                    }
                    
                    console.log('Final insurance amounts after source collection fetch:', {
                      firePolicyAmount: actualFireAmount,
                      burglaryPolicyAmount: actualBurglaryAmount
                    });
                    
                    // Extract all required insurance fields from inspection collection
                    insuranceData = {
                      firePolicyAmount: actualFireAmount || safeParseAmount(data.firePolicyAmount) || '-',
                      burglaryPolicyAmount: actualBurglaryAmount || safeParseAmount(data.burglaryPolicyAmount) || '-',
                      firePolicyStartDate: (() => {
                        const date = matchingInsurance.firePolicyStartDate;
                        console.log('Processing firePolicyStartDate:', date, 'type:', typeof date);
                        if (date) {
                          if (typeof date === 'string' || typeof date === 'number') {
                            const formatted = new Date(date).toLocaleDateString();
                            console.log('Formatted firePolicyStartDate:', formatted);
                            return formatted;
                          } else if (date instanceof Date) {
                            const formatted = date.toLocaleDateString();
                            console.log('Formatted firePolicyStartDate (Date object):', formatted);
                            return formatted;
                          } else if (date && typeof date === 'object' && date.toDate) {
                            // Handle Firestore Timestamp
                            const formatted = date.toDate().toLocaleDateString();
                            console.log('Formatted firePolicyStartDate (Firestore Timestamp):', formatted);
                            return formatted;
                          }
                        }
                        console.log('FirePolicyStartDate returning "-"');
                        return '-';
                      })(),  // From inspection collection
                      firePolicyEndDate: (() => {
                        const date = matchingInsurance.firePolicyEndDate;
                        console.log('Processing firePolicyEndDate:', date, 'type:', typeof date);
                        if (date) {
                          if (typeof date === 'string' || typeof date === 'number') {
                            const formatted = new Date(date).toLocaleDateString();
                            console.log('Formatted firePolicyEndDate:', formatted);
                            return formatted;
                          } else if (date instanceof Date) {
                            const formatted = date.toLocaleDateString();
                            console.log('Formatted firePolicyEndDate (Date object):', formatted);
                            return formatted;
                          } else if (date && typeof date === 'object' && date.toDate) {
                            // Handle Firestore Timestamp
                            const formatted = date.toDate().toLocaleDateString();
                            console.log('Formatted firePolicyEndDate (Firestore Timestamp):', formatted);
                            return formatted;
                          }
                        }
                        console.log('FirePolicyEndDate returning "-"');
                        return '-';
                      })(),    // From inspection collection
                      burglaryPolicyStartDate: (() => {
                        const date = matchingInsurance.burglaryPolicyStartDate;
                        console.log('Processing burglaryPolicyStartDate:', date, 'type:', typeof date);
                        if (date) {
                          if (typeof date === 'string' || typeof date === 'number') {
                            const formatted = new Date(date).toLocaleDateString();
                            console.log('Formatted burglaryPolicyStartDate:', formatted);
                            return formatted;
                          } else if (date instanceof Date) {
                            const formatted = date.toLocaleDateString();
                            console.log('Formatted burglaryPolicyStartDate (Date object):', formatted);
                            return formatted;
                          } else if (date && typeof date === 'object' && date.toDate) {
                            // Handle Firestore Timestamp
                            const formatted = date.toDate().toLocaleDateString();
                            console.log('Formatted burglaryPolicyStartDate (Firestore Timestamp):', formatted);
                            return formatted;
                          }
                        }
                        console.log('BurglaryPolicyStartDate returning "-"');
                        return '-';
                      })(),  // From inspection collection
                      burglaryPolicyEndDate: (() => {
                        const date = matchingInsurance.burglaryPolicyEndDate;
                        console.log('Processing burglaryPolicyEndDate:', date, 'type:', typeof date);
                        if (date) {
                          if (typeof date === 'string' || typeof date === 'number') {
                            const formatted = new Date(date).toLocaleDateString();
                            console.log('Formatted burglaryPolicyEndDate:', formatted);
                            return formatted;
                          } else if (date instanceof Date) {
                            const formatted = date.toLocaleDateString();
                            console.log('Formatted burglaryPolicyEndDate (Date object):', formatted);
                            return formatted;
                          } else if (date && typeof date === 'object' && date.toDate) {
                            // Handle Firestore Timestamp
                            const formatted = date.toDate().toLocaleDateString();
                            console.log('Formatted burglaryPolicyEndDate (Firestore Timestamp):', formatted);
                            return formatted;
                          }
                        }
                        console.log('BurglaryPolicyEndDate returning "-"');
                        return '-';
                      })(),    // From inspection collection
                      firePolicyName: matchingInsurance.firePolicyCompanyName || '-',        // From inspection collection
                      burglaryPolicyName: matchingInsurance.burglaryPolicyCompanyName || '-', // From inspection collection
                      bankFundedBy: matchingInsurance.selectedBankName || '-'                // From inspection collection
                    };
                    
                    console.log('Insurance data extracted from inspection collection for inward:', data.inwardId, {
                      firePolicyAmount: insuranceData.firePolicyAmount,
                      burglaryPolicyAmount: insuranceData.burglaryPolicyAmount,
                      firePolicyStartDate: insuranceData.firePolicyStartDate,
                      firePolicyEndDate: insuranceData.firePolicyEndDate,
                      burglaryPolicyStartDate: insuranceData.burglaryPolicyStartDate,
                      burglaryPolicyEndDate: insuranceData.burglaryPolicyEndDate,
                      firePolicyName: insuranceData.firePolicyName,
                      burglaryPolicyName: insuranceData.burglaryPolicyName,
                      bankFundedBy: insuranceData.bankFundedBy
                    });
                  } else {
                    console.log('No matching insurance found in inspection for inward:', data.inwardId, 'selectedInsurance:', data.selectedInsurance);
                    console.log('Available insurance entries in inspection:', insuranceEntries.map(ins => ({
                      insuranceId: ins.insuranceId,
                      insuranceTakenBy: ins.insuranceTakenBy
                    })));
                    
                    // Try to fetch from insurance master collection (for universal insurances)
                    console.log('Attempting to fetch from insurance master collection with insuranceCode:', data.selectedInsurance.insuranceId);
                    
                    try {
                      const insuranceMasterCollection = collection(db, 'insurance');
                      const masterQuery = query(
                        insuranceMasterCollection,
                        where('insuranceCode', '==', data.selectedInsurance.insuranceId)
                      );
                      const masterSnapshot = await getDocs(masterQuery);
                      
                      if (!masterSnapshot.empty) {
                        const masterInsurance = masterSnapshot.docs[0].data();
                        console.log('✅ Found insurance in master collection:', masterInsurance);
                        
                        insuranceData = {
                          firePolicyAmount: safeParseAmount(masterInsurance.firePolicyAmount) || '-',
                          burglaryPolicyAmount: safeParseAmount(masterInsurance.burglaryPolicyAmount) || '-',
                          firePolicyStartDate: masterInsurance.firePolicyStartDate || '-',
                          firePolicyEndDate: masterInsurance.firePolicyEndDate || '-',
                          burglaryPolicyStartDate: masterInsurance.burglaryPolicyStartDate || '-',
                          burglaryPolicyEndDate: masterInsurance.burglaryPolicyEndDate || '-',
                          firePolicyName: masterInsurance.firePolicyCompanyName || '-',
                          burglaryPolicyName: masterInsurance.burglaryPolicyCompanyName || '-',
                          bankFundedBy: masterInsurance.selectedBankName || '-'
                        };
                        
                        console.log('Insurance data from master collection:', insuranceData);
                      } else {
                        console.log('⚠️ Insurance not found in master collection either, using fallback from inward document');
                        // Fallback: use data from inward document if no matching insurance found
                        insuranceData = {
                          firePolicyAmount: safeParseAmount(data.firePolicyAmount) || '-',
                          burglaryPolicyAmount: safeParseAmount(data.burglaryPolicyAmount) || '-',
                          firePolicyStartDate: data.firePolicyStart || '-',
                          firePolicyEndDate: data.firePolicyEnd || '-',
                          burglaryPolicyStartDate: data.burglaryPolicyStart || '-',
                          burglaryPolicyEndDate: data.burglaryPolicyEnd || '-',
                          firePolicyName: data.firePolicyCompanyName || '-',
                          burglaryPolicyName: data.burglaryPolicyCompanyName || '-',
                          bankFundedBy: data.bankFundedBy || '-'
                        };
                      }
                    } catch (masterError) {
                      console.error('Error fetching from insurance master collection:', masterError);
                      // Fallback: use data from inward document
                      insuranceData = {
                        firePolicyAmount: safeParseAmount(data.firePolicyAmount) || '-',
                        burglaryPolicyAmount: safeParseAmount(data.burglaryPolicyAmount) || '-',
                        firePolicyStartDate: data.firePolicyStart || '-',
                        firePolicyEndDate: data.firePolicyEnd || '-',
                        burglaryPolicyStartDate: data.burglaryPolicyStart || '-',
                        burglaryPolicyEndDate: data.burglaryPolicyEnd || '-',
                        firePolicyName: data.firePolicyCompanyName || '-',
                        burglaryPolicyName: data.burglaryPolicyCompanyName || '-',
                        bankFundedBy: data.bankFundedBy || '-'
                      };
                    }
                  }
                }
              }
            } catch (error) {
              console.error('Error fetching insurance data for inward entry:', data.inwardId, error);
            }
          } else {
            console.log('No selectedInsurance data for inward:', data.inwardId);
            
            // Fallback: use data from inward document if no selectedInsurance
            insuranceData = {
              firePolicyAmount: safeParseAmount(data.firePolicyAmount),
              burglaryPolicyAmount: safeParseAmount(data.burglaryPolicyAmount),
              firePolicyStartDate: data.firePolicyStart || '-',
              firePolicyEndDate: data.firePolicyEnd || '-',
              burglaryPolicyStartDate: data.burglaryPolicyStart || '-',
              burglaryPolicyEndDate: data.burglaryPolicyEnd || '-',
              firePolicyName: data.firePolicyCompanyName || '-',
              burglaryPolicyName: data.burglaryPolicyCompanyName || '-',
              bankFundedBy: data.bankFundedBy || '-'
            };
          }
          
          // Handle new structure with inwardEntries array
          if (data.inwardEntries && Array.isArray(data.inwardEntries)) {
            console.log('Found new structure with inwardEntries array, length:', data.inwardEntries.length);
            
            // Combine all entries into one row with combined data
            const combinedEntry = {
            id: docSnapshot.id, 
              docId: docSnapshot.id,
              inwardId: data.inwardId,
              // Base form data
              state: data.state,
              branch: data.branch,
              location: data.location,
              warehouseName: data.warehouseName,
              warehouseCode: data.warehouseCode,
              warehouseAddress: data.warehouseAddress,
              businessType: data.businessType,
              client: data.client,
              clientCode: data.clientCode,
              clientAddress: data.clientAddress,
              dateOfInward: data.dateOfInward,
              cadNumber: data.cadNumber,
              commodity: data.commodity,
              varietyName: data.varietyName,
              marketRate: data.marketRate,
              bankName: data.bankName,
              bankBranch: data.bankBranch,
              bankState: data.bankState,
              ifscCode: data.ifscCode,
              bankReceipt: data.bankReceipt,
              billingStatus: data.billingStatus,
              reservationRate: data.reservationRate,
              reservationQty: data.reservationQty,
              reservationStart: data.reservationStart,
              reservationEnd: data.reservationEnd,
              billingCycle: data.billingCycle,
              billingType: data.billingType,
              billingRate: data.billingRate,
              insuranceManagedBy: data.insuranceManagedBy,
              firePolicyNumber: data.firePolicyNumber,
              firePolicyAmount: insuranceData.firePolicyAmount,
              firePolicyStart: data.firePolicyStart,
              firePolicyEnd: data.firePolicyEnd,
              burglaryPolicyNumber: data.burglaryPolicyNumber,
              burglaryPolicyAmount: insuranceData.burglaryPolicyAmount,
              burglaryPolicyStart: data.burglaryPolicyStart,
              burglaryPolicyEnd: data.burglaryPolicyEnd,
              firePolicyCompanyName: data.firePolicyCompanyName,
              burglaryPolicyCompanyName: data.burglaryPolicyCompanyName,
              firePolicyBalance: data.firePolicyBalance,
              burglaryPolicyBalance: data.burglaryPolicyBalance,
              bankFundedBy: data.bankFundedBy,
              attachmentUrl: data.attachmentUrl,
              createdAt: data.createdAt,
              selectedInsurance: data.selectedInsurance,
              status: data.status,
              cirStatus: data.cirStatus || 'Pending',
              // Persisted approval metadata
              hologramNumber: data.hologramNumber || '',
              srGenerationDate: data.srGenerationDate || '',
              srGenerationDateISO: data.srGenerationDateISO || '',
              
              // Combined entry data - show first entry's data as primary
              vehicleNumber: data.inwardEntries[0]?.vehicleNumber || '-',
              getpassNumber: data.inwardEntries[0]?.getpassNumber || '-',
              weightBridge: data.inwardEntries[0]?.weightBridge || '-',
              weightBridgeSlipNumber: data.inwardEntries[0]?.weightBridgeSlipNumber || '-',
              grossWeight: data.inwardEntries[0]?.grossWeight || '-',
              tareWeight: data.inwardEntries[0]?.tareWeight || '-',
              netWeight: data.inwardEntries[0]?.netWeight || '-',
              averageWeight: data.inwardEntries[0]?.averageWeight || '-',
              totalBags: data.totalBagsFromEntries || data.totalBags || '-',
              totalQuantity: data.totalQuantityFromEntries || data.totalQuantity || '-',
              totalValue: data.totalValue || '-',
              // Lab parameters from document level
              dateOfSampling: data.dateOfSampling || '-',
              dateOfTesting: data.dateOfTesting || '-',
              labResults: migrateLabResults(data.labResults || [], data.commodity, data.variety),
              stacks: data.inwardEntries[0]?.stacks || [],
              
              // Additional fields for multiple entries
              totalEntries: data.inwardEntries.length,
              inwardEntries: data.inwardEntries, // Keep the full array for reference
              
              // Insurance and receipt data
            receiptType,
            // Only include insurance fields that are not already defined above
            firePolicyStartDate: insuranceData.firePolicyStartDate,
            firePolicyEndDate: insuranceData.firePolicyEndDate,
            burglaryPolicyStartDate: insuranceData.burglaryPolicyStartDate,
            burglaryPolicyEndDate: insuranceData.burglaryPolicyEndDate,
            firePolicyName: insuranceData.firePolicyName,
            burglaryPolicyName: insuranceData.burglaryPolicyName,
          };
            
            return [combinedEntry];
          } else {
            // Handle old structure (single entry per document)
            console.log('Found old structure (single entry per document)');
            return [{
              ...data, 
              id: docSnapshot.id, 
              receiptType,
              cirStatus: data.cirStatus || 'Pending',
              // Use insurance data for policy amounts and other fields
              firePolicyAmount: (insuranceData.firePolicyAmount || '-').toString(),
              burglaryPolicyAmount: (insuranceData.burglaryPolicyAmount || '-').toString(),
              firePolicyStartDate: insuranceData.firePolicyStartDate,
              firePolicyEndDate: insuranceData.firePolicyEndDate,
              burglaryPolicyStartDate: insuranceData.burglaryPolicyStartDate,
              burglaryPolicyEndDate: insuranceData.burglaryPolicyEndDate,
              firePolicyName: insuranceData.firePolicyName,
              burglaryPolicyName: insuranceData.burglaryPolicyName,
            }];
          }
        })
      );
      
      // Flatten the array since some documents now return multiple entries
              const flattenedData = inwardDataWithReceiptType.flat();
        
        // Calculate remaining amounts for each entry
        const dataWithRemainingAmounts = flattenedData.map(entry => {
          // Helper function to safely parse amounts
          const parseAmount = (amount: any): number => {
            if (!amount || amount === '' || amount === '-' || amount === 'N/A') return 0;
            const parsed = parseFloat(String(amount).replace(/[^\d.-]/g, ''));
            return isNaN(parsed) ? 0 : parsed;
          };

          const firePolicyAmount = parseAmount(entry.firePolicyAmount);
          const burglaryPolicyAmount = parseAmount(entry.burglaryPolicyAmount);
          const totalValue = parseAmount((entry as any).totalValue || '0');

          const fireBalance = firePolicyAmount - totalValue;
          const burglaryBalance = burglaryPolicyAmount - totalValue;

          return {
            ...entry,
            firePolicyBalance: fireBalance >= 0 ? fireBalance.toString() : '0',
            burglaryPolicyBalance: burglaryBalance >= 0 ? burglaryBalance.toString() : '0',
          };
        });
        
        console.log('Final inward data with remaining amounts:', dataWithRemainingAmounts);
        setInwardData(dataWithRemainingAmounts);

      // States from branches
      const branchSnap = await getDocs(collection(db, 'branches'));
      const branchArr = branchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBranches(branchArr);
      setStates(Array.from(new Set(branchArr.map((b: any) => b.state))));
      
      // Clients
      const clientSnap = await getDocs(collection(db, 'clients'));
      setClients(clientSnap.docs.map(doc => doc.data()));
      
      // Warehouses from inspections - ensure unique warehouses
      const inspectionsSnap = await getDocs(collection(db, 'inspections'));
      const warehouseMap = new Map();
      inspectionsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.warehouseName && (data.status === 'activated'||data.status === 'reactivate')) {
          // Use warehouse name as key to ensure uniqueness
          if (!warehouseMap.has(data.warehouseName)) {
            // ENHANCED DEBUGGING: Log the entire data structure for this warehouse
            console.log('=== DEBUGGING WAREHOUSE DATA ===');
            console.log('Warehouse:', data.warehouseName);
            console.log('Status:', data.status);
            console.log('Has top-level insuranceEntries:', !!(data.insuranceEntries && Array.isArray(data.insuranceEntries)));
            console.log('Has nested insuranceEntries:', !!(data.warehouseInspectionData?.insuranceEntries && Array.isArray(data.warehouseInspectionData.insuranceEntries)));
            console.log('Has warehouseInspectionData:', !!data.warehouseInspectionData);
            
            if (data.warehouseInspectionData) {
              const warehouseData = data.warehouseInspectionData;
              console.log('warehouseInspectionData keys:', Object.keys(warehouseData));
              console.log('insuranceTakenBy:', warehouseData.insuranceTakenBy);
              console.log('firePolicyNumber:', warehouseData.firePolicyNumber);
              console.log('burglaryPolicyNumber:', warehouseData.burglaryPolicyNumber);
              console.log('firePolicyCompanyName:', warehouseData.firePolicyCompanyName);
              console.log('burglaryPolicyCompanyName:', warehouseData.burglaryPolicyCompanyName);
            }
            console.log('=== END DEBUGGING ===');
            
            // Extract insurance data from the inspection
            let insuranceEntries: any[] = [];
            
            // Check multiple possible locations for insurance data
            if (data.insuranceEntries && Array.isArray(data.insuranceEntries)) {
              console.log('✅ Found top-level insurance entries for warehouse:', data.warehouseName, data.insuranceEntries.length);
              insuranceEntries = data.insuranceEntries;
            } else if (data.warehouseInspectionData?.insuranceEntries && Array.isArray(data.warehouseInspectionData.insuranceEntries)) {
              console.log('✅ Found nested insurance entries for warehouse:', data.warehouseName, data.warehouseInspectionData.insuranceEntries.length);
              insuranceEntries = data.warehouseInspectionData.insuranceEntries;
            } else if (data.warehouseInspectionData) {
              // Check for current insurance format (from the recent validation changes)
              const warehouseData = data.warehouseInspectionData;
              if (warehouseData.insuranceTakenBy && (warehouseData.firePolicyNumber || warehouseData.burglaryPolicyNumber)) {
                console.log('✅ Found current insurance format for warehouse:', data.warehouseName);
                insuranceEntries = [{
                  id: `current_${Date.now()}`,
                  insuranceId: `INS_${data.warehouseName}_${Date.now()}`,
                  insuranceTakenBy: warehouseData.insuranceTakenBy || '',
                  insuranceCommodity: warehouseData.insuranceCommodity || '',
                  clientName: warehouseData.clientName || '',
                  clientAddress: warehouseData.clientAddress || '',
                  selectedBankName: warehouseData.selectedBankName || '',
                  firePolicyCompanyName: warehouseData.firePolicyCompanyName || '',
                  firePolicyNumber: warehouseData.firePolicyNumber || '',
                  firePolicyAmount: warehouseData.firePolicyAmount || '0',
                  firePolicyStartDate: warehouseData.firePolicyStartDate || null,
                  firePolicyEndDate: warehouseData.firePolicyEndDate || null,
                  burglaryPolicyCompanyName: warehouseData.burglaryPolicyCompanyName || '',
                  burglaryPolicyNumber: warehouseData.burglaryPolicyNumber || '',
                  burglaryPolicyAmount: warehouseData.burglaryPolicyAmount || '0',
                  burglaryPolicyStartDate: warehouseData.burglaryPolicyStartDate || null,
                  burglaryPolicyEndDate: warehouseData.burglaryPolicyEndDate || null,
                  remainingFirePolicyAmount: warehouseData.firePolicyAmount || '0',
                  remainingBurglaryPolicyAmount: warehouseData.burglaryPolicyAmount || '0',
                  createdAt: new Date(warehouseData.createdAt || Date.now())
                }];
              } else {
                console.log('❌ No insurance data found for warehouse:', data.warehouseName);
                console.log('   - insuranceTakenBy:', warehouseData.insuranceTakenBy);
                console.log('   - firePolicyNumber:', warehouseData.firePolicyNumber);
                console.log('   - burglaryPolicyNumber:', warehouseData.burglaryPolicyNumber);
              }
            } else {
              console.log('❌ No warehouseInspectionData found for warehouse:', data.warehouseName);
            }
            
            // Store warehouse data with insurance entries
            console.log(`📦 Storing warehouse "${data.warehouseName}" with ${insuranceEntries.length} insurance entries`);
            warehouseMap.set(data.warehouseName, {
              ...data,
              insuranceEntries: insuranceEntries
            });
          }
        }
      });
      setWarehouses(Array.from(warehouseMap.values()));
      console.log('🏁 Final warehouses count:', warehouseMap.size);
      console.log('🏁 Warehouses with insurance data:', Array.from(warehouseMap.values()).filter(w => w.insuranceEntries && w.insuranceEntries.length > 0).length);
      console.log('🏁 All warehouses:', Array.from(warehouseMap.values()).map(w => ({ 
        name: w.warehouseName, 
        insuranceCount: w.insuranceEntries ? w.insuranceEntries.length : 0 
      })));
      
      // Reservations
      const reservationSnap = await getDocs(collection(db, 'reservation'));
      setReservations(reservationSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      // Commodities
      const commoditySnap = await getDocs(collection(db, 'commodities'));
      setCommodities(commoditySnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      // Banks
      const bankSnap = await getDocs(collection(db, 'banks'));
      setBanks(bankSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      // Insurance data
      const insuranceSnap = await getDocs(collection(db, 'insurance'));
      setInsuranceData(insuranceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      setError('Failed to load data. Please try again.');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Helper function to check if reservation has expired
  const isReservationExpired = (reservationEnd: string) => {
    if (!reservationEnd || reservationEnd === '' || reservationEnd === '-') return false;
    
    try {
      const endDate = new Date(reservationEnd);
      const today = new Date();
      // Set time to start of day for accurate comparison
      today.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      
      return endDate < today;
    } catch (error) {
      console.error('Error parsing reservation end date:', error);
      return false;
    }
  };

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

  // Form state
  const [baseForm, setBaseForm] = useState<any>({
    state: '',
    branch: '',
    location: '',
    warehouseName: '',
    warehouseCode: '',
    warehouseAddress: '',
    businessType: '',
    client: '',
    clientCode: '',
    clientAddress: '',
    dateOfInward: '',
    cadNumber: '',
    attachmentUrl: '',
    commodity: '',
    varietyName: '',
    marketRate: '',
    totalBags: '',
    totalQuantity: '',
    totalValue: '',
    bankName: '',
    bankBranch: '',
    bankState: '',
    ifscCode: '',
    bankReceipt: '',
    reservationStatus: '',
    billingStatus: '',
    reservationRate: '',
    reservationQty: '',
    reservationStart: '',
    reservationEnd: '',
    billingCycle: '',
    billingType: '',
    billingRate: '',
    insuranceManagedBy: '',
    firePolicyNumber: '',
    firePolicyAmount: '',
    firePolicyStart: '',
    firePolicyEnd: '',
    burglaryPolicyNumber: '',
    burglaryPolicyAmount: '',
    burglaryPolicyStart: '',
    burglaryPolicyEnd: '',
    firePolicyCompanyName: '',
    burglaryPolicyCompanyName: '',
    firePolicyBalance: '',
    burglaryPolicyBalance: '',
    bankFundedBy: '',
    selectedInsurance: null,
    // Lab Parameters - Form level (not per entry)
    dateOfSampling: '',
    dateOfTesting: '',
  });

  // Current entry form (for inward entry details)
  const [currentEntryForm, setCurrentEntryForm] = useState({
    vehicleNumber: '',
    getpassNumber: '',
    weightBridge: '',
    weightBridgeSlipNumber: '',
    grossWeight: '',
    tareWeight: '',
    netWeight: '',
    averageWeight: '',
    totalBags: '',
    totalQuantity: '',
    labResults: [] as Array<{parameterName: string, value: string}>,
    labResultsValidation: [] as boolean[],
    stacks: [
      {
        stackNumber: '',
        numberOfBags: ''
      }
    ],
  });

  // Combined form for display
  const form = { 
    ...baseForm, 
    ...currentEntryForm, 
    totalValue: baseForm.totalValue,
    // Ensure lab parameters always come from baseForm (not overwritten by currentEntryForm)
    dateOfSampling: baseForm.dateOfSampling,
    dateOfTesting: baseForm.dateOfTesting
  };

  // Filter insurance entries based on selected type and commodity
  const filteredInsuranceEntries = useMemo(() => {
    let filtered = insuranceEntries;
    
    // Filter by insurance type (case-insensitive)
    if (selectedInsuranceType && selectedInsuranceType !== 'all') {
      filtered = filtered.filter(ins => (ins.insuranceTakenBy || '').toLowerCase() === selectedInsuranceType.toLowerCase());
    }
    
    // Further filter by commodity if commodity is selected (case-insensitive)
    if (baseForm.commodity) {
      filtered = filtered.filter(ins => {
        const insuranceCommodities = (ins.insuranceCommodity || ins.commodityName || '').split(',').map((c: string) => c.trim().toLowerCase());
        return insuranceCommodities.includes(baseForm.commodity.toLowerCase());
      });
    }
    
    return filtered;
  }, [insuranceEntries, selectedInsuranceType, baseForm.commodity]);

  // Fetch universal insurances (client and agrogreen) from insurance master collection
  useEffect(() => {
    const fetchUniversalInsurances = async () => {
      if (!form.warehouseName && !form.client) return;
      
      try {
        console.log('🌍 Fetching universal insurances from insurance master...');
        const universalInsurances: any[] = [];
        
        // Fetch agrogreen insurances (universal - no warehouse/commodity filter)
        const agrogreenQuery = query(
          collection(db, 'insurance'),
          where('insuranceType', '==', 'agrogreen')
        );
        const agrogreenDocs = await getDocs(agrogreenQuery);
        agrogreenDocs.forEach(doc => {
          const data = doc.data();
          universalInsurances.push({
            id: doc.id,
            insuranceId: data.insuranceCode || doc.id,
            insuranceTakenBy: 'agrogreen',
            insuranceCommodity: data.commodityName || 'All Commodities',
            commodityName: data.commodityName || 'All Commodities',
            firePolicyCompanyName: data.firePolicyCompanyName || '',
            firePolicyNumber: data.firePolicyNumber || '',
            firePolicyAmount: data.firePolicyAmount || '0',
            firePolicyStartDate: data.firePolicyStartDate || null,
            firePolicyEndDate: data.firePolicyEndDate || null,
            burglaryPolicyCompanyName: data.burglaryPolicyCompanyName || '',
            burglaryPolicyNumber: data.burglaryPolicyNumber || '',
            burglaryPolicyAmount: data.burglaryPolicyAmount || '0',
            burglaryPolicyStartDate: data.burglaryPolicyStartDate || null,
            burglaryPolicyEndDate: data.burglaryPolicyEndDate || null,
            firePolicyRemainingAmount: data.firePolicyRemainingAmount || data.firePolicyAmount || '0',
            burglaryPolicyRemainingAmount: data.burglaryPolicyRemainingAmount || data.burglaryPolicyAmount || '0',
            remainingFirePolicyAmount: data.firePolicyRemainingAmount || data.firePolicyAmount || '0',
            remainingBurglaryPolicyAmount: data.burglaryPolicyRemainingAmount || data.burglaryPolicyAmount || '0',
            createdAt: data.createdAt || new Date(),
            isUniversal: true  // Mark as universal
          });
        });
        console.log('✅ Found agrogreen insurances:', agrogreenDocs.size);
        
        // Fetch client insurances (filtered by client name)
        if (form.client) {
          const clientQuery = query(
            collection(db, 'insurance'),
            where('insuranceType', '==', 'client'),
            where('clientName', '==', form.client)
          );
          const clientDocs = await getDocs(clientQuery);
          clientDocs.forEach(doc => {
            const data = doc.data();
            universalInsurances.push({
              id: doc.id,
              insuranceId: data.insuranceCode || doc.id,
              insuranceTakenBy: 'client',
              insuranceCommodity: data.commodityName || 'All Commodities',
              commodityName: data.commodityName || 'All Commodities',
              clientName: data.clientName || '',
              clientAddress: data.clientAddress || '',
              firePolicyCompanyName: data.firePolicyCompanyName || '',
              firePolicyNumber: data.firePolicyNumber || '',
              firePolicyAmount: data.firePolicyAmount || '0',
              firePolicyStartDate: data.firePolicyStartDate || null,
              firePolicyEndDate: data.firePolicyEndDate || null,
              burglaryPolicyCompanyName: data.burglaryPolicyCompanyName || '',
              burglaryPolicyNumber: data.burglaryPolicyNumber || '',
              burglaryPolicyAmount: data.burglaryPolicyAmount || '0',
              burglaryPolicyStartDate: data.burglaryPolicyStartDate || null,
              burglaryPolicyEndDate: data.burglaryPolicyEndDate || null,
              firePolicyRemainingAmount: data.firePolicyRemainingAmount || data.firePolicyAmount || '0',
              burglaryPolicyRemainingAmount: data.burglaryPolicyRemainingAmount || data.burglaryPolicyAmount || '0',
              remainingFirePolicyAmount: data.firePolicyRemainingAmount || data.firePolicyAmount || '0',
              remainingBurglaryPolicyAmount: data.burglaryPolicyRemainingAmount || data.burglaryPolicyAmount || '0',
              createdAt: data.createdAt || new Date(),
              isUniversal: true  // Mark as universal
            });
          });
          console.log('✅ Found client insurances:', clientDocs.size);
        }
        
        // Fetch bank-funded insurances (filtered by warehouse)
        if (form.warehouseName) {
          const bankFundedQuery = query(
            collection(db, 'insurance'),
            where('insuranceType', '==', 'bank-funded'),
            where('warehouseName', '==', form.warehouseName)
          );
          const bankFundedDocs = await getDocs(bankFundedQuery);
          console.log('🏦 Searching for bank-funded insurance for warehouse:', form.warehouseName);
          console.log('🏦 Found bank-funded insurances:', bankFundedDocs.size);
          
          bankFundedDocs.forEach(doc => {
            const data = doc.data();
            console.log('🏦 Bank-funded insurance data:', {
              insuranceCode: data.insuranceCode,
              commodityName: data.commodityName,
              selectedBankName: data.selectedBankName,
              warehouseName: data.warehouseName
            });
            universalInsurances.push({
              id: doc.id,
              insuranceId: data.insuranceCode || doc.id,
              insuranceTakenBy: 'bank-funded',
              insuranceCommodity: data.commodityName || '',
              commodityName: data.commodityName || '',
              selectedBankName: data.selectedBankName || '', // CRITICAL for matching
              firePolicyCompanyName: data.firePolicyCompanyName || '',
              firePolicyNumber: data.firePolicyNumber || '',
              firePolicyAmount: data.firePolicyAmount || '0',
              firePolicyStartDate: data.firePolicyStartDate || null,
              firePolicyEndDate: data.firePolicyEndDate || null,
              burglaryPolicyCompanyName: data.burglaryPolicyCompanyName || '',
              burglaryPolicyNumber: data.burglaryPolicyNumber || '',
              burglaryPolicyAmount: data.burglaryPolicyAmount || '0',
              burglaryPolicyStartDate: data.burglaryPolicyStartDate || null,
              burglaryPolicyEndDate: data.burglaryPolicyEndDate || null,
              firePolicyRemainingAmount: data.firePolicyRemainingAmount || data.firePolicyAmount || '0',
              burglaryPolicyRemainingAmount: data.burglaryPolicyRemainingAmount || data.burglaryPolicyAmount || '0',
              remainingFirePolicyAmount: data.firePolicyRemainingAmount || data.firePolicyAmount || '0',
              remainingBurglaryPolicyAmount: data.burglaryPolicyRemainingAmount || data.burglaryPolicyAmount || '0',
              createdAt: data.createdAt || new Date(),
              isUniversal: false  // NOT universal - warehouse-specific!
            });
          });
        }
        
        // Fetch warehouse-owner insurances (filtered by warehouse)
        if (form.warehouseName) {
          const warehouseOwnerQuery = query(
            collection(db, 'insurance'),
            where('insuranceType', '==', 'warehouse-owner'),
            where('warehouseName', '==', form.warehouseName)
          );
          const warehouseOwnerDocs = await getDocs(warehouseOwnerQuery);
          console.log('🏢 Searching for warehouse-owner insurance for warehouse:', form.warehouseName);
          console.log('🏢 Found warehouse-owner insurances:', warehouseOwnerDocs.size);
          
          warehouseOwnerDocs.forEach(doc => {
            const data = doc.data();
            console.log('🏢 Warehouse-owner insurance data:', {
              insuranceCode: data.insuranceCode,
              commodityName: data.commodityName,
              warehouseName: data.warehouseName
            });
            universalInsurances.push({
              id: doc.id,
              insuranceId: data.insuranceCode || doc.id,
              insuranceTakenBy: 'warehouse-owner',
              insuranceCommodity: data.commodityName || '',
              commodityName: data.commodityName || '',
              firePolicyCompanyName: data.firePolicyCompanyName || '',
              firePolicyNumber: data.firePolicyNumber || '',
              firePolicyAmount: data.firePolicyAmount || '0',
              firePolicyStartDate: data.firePolicyStartDate || null,
              firePolicyEndDate: data.firePolicyEndDate || null,
              burglaryPolicyCompanyName: data.burglaryPolicyCompanyName || '',
              burglaryPolicyNumber: data.burglaryPolicyNumber || '',
              burglaryPolicyAmount: data.burglaryPolicyAmount || '0',
              burglaryPolicyStartDate: data.burglaryPolicyStartDate || null,
              burglaryPolicyEndDate: data.burglaryPolicyEndDate || null,
              firePolicyRemainingAmount: data.firePolicyRemainingAmount || data.firePolicyAmount || '0',
              burglaryPolicyRemainingAmount: data.burglaryPolicyRemainingAmount || data.burglaryPolicyAmount || '0',
              remainingFirePolicyAmount: data.firePolicyRemainingAmount || data.firePolicyAmount || '0',
              remainingBurglaryPolicyAmount: data.burglaryPolicyRemainingAmount || data.burglaryPolicyAmount || '0',
              createdAt: data.createdAt || new Date(),
              isUniversal: false  // NOT universal - warehouse-specific!
            });
          });
        }
        
        // Merge universal insurances with existing inspection insurances
        if (universalInsurances.length > 0) {
          setInsuranceEntries(prev => {
            // Remove existing universal insurances first (to avoid duplicates on re-fetch)
            const nonUniversal = prev.filter(ins => !ins.isUniversal);
            // Merge: non-universal + new universal insurances
            const merged = [...nonUniversal, ...universalInsurances];
            console.log('✅ Total insurances after merging:', merged.length, '(', nonUniversal.length, 'non-universal +', universalInsurances.length, 'universal)');
            return merged;
          });
        }
      } catch (error) {
        console.error('❌ Error fetching universal insurances:', error);
      }
    };
    
    fetchUniversalInsurances();
  }, [form.warehouseName, form.client, selectedBank]); // Re-run when warehouse, client, OR bank changes

  // Filter insurance entries - NO LONGER USED (replaced with checkbox system)
  // Kept for backward compatibility with old code paths that won't be executed
  const filteredInsuranceInfoEntries = useMemo(() => {
    return [];
    console.log('🏦 Selected bank:', selectedBank?.bankName || 'None');
    console.log('� Form client:', form.client);
    console.log('�📦 Base form commodity:', baseForm.commodity);
    console.log('📋 Total insurance entries available:', insuranceEntries.length);
    console.log('📋 All insurance entries:', insuranceEntries.map(ins => ({
      insuranceTakenBy: ins.insuranceTakenBy,
      insuranceId: ins.insuranceId,
      insuranceCommodity: ins.insuranceCommodity,
      commodityName: ins.commodityName,
      clientName: ins.clientName,
      selectedBankName: ins.selectedBankName
    })));
    
    let filtered = insuranceEntries.filter(ins => {
      const insuranceType = (ins.insuranceTakenBy || '').toLowerCase().replace(/\s+/g, '-'); // Normalize: convert spaces to hyphens
      const selectedType = selectedInsuranceInfoType.toLowerCase().replace(/\s+/g, '-'); // Normalize: convert spaces to hyphens
      const match = insuranceType === selectedType;
      
      console.log('🔎 Type comparison:', {
        originalInsuranceTakenBy: ins.insuranceTakenBy,
        normalizedInsuranceType: insuranceType,
        originalSelectedType: selectedInsuranceInfoType,
        normalizedSelectedType: selectedType,
        match: match
      });
      return match;
    });
    
    console.log('✅ After type filter:', filtered.length, 'entries');
    console.log('✅ Filtered entries:', filtered.map(ins => ({
      insuranceTakenBy: ins.insuranceTakenBy,
      insuranceId: ins.insuranceId,
      clientName: ins.clientName,
      selectedBankName: ins.selectedBankName
    })));
    
    const normalizedSelectedType = selectedInsuranceInfoType.toLowerCase().replace(/\s+/g, '-');
    
    // For CLIENT insurance: Only filter by client name (universal - no warehouse/commodity filtering)
    if (normalizedSelectedType === 'client') {
      console.log('👤 Client insurance selected - filtering by client name only...');
      if (!form.client) {
        console.log('⚠️ No client selected in form - showing no results');
        return [];
      }
      
      filtered = filtered.filter(ins => {
        const insuranceClientName = (ins.clientName || '').toLowerCase().trim();
        const formClientName = (form.client || '').toLowerCase().trim();
        const clientMatch = insuranceClientName === formClientName;
        
        console.log('👤 Client comparison:', {
          insuranceClientName: ins.clientName,
          formClientName: form.client,
          match: clientMatch
        });
        return clientMatch;
      });
      console.log('✅ After client filter:', filtered.length, 'entries');
      console.log('🏁 FINAL RESULT (CLIENT):', filtered.length, 'entries');
      console.log('🔍 ========== END FILTERING DEBUG ==========');
      return filtered;
    }
    
    // For AGROGREEN insurance: Show all agrogreen insurances from insurance master
    if (normalizedSelectedType === 'agrogreen') {
      console.log('🌱 Agrogreen insurance selected - showing universal insurances from insurance master');
      console.log('✅ Agrogreen entries:', filtered.length);
      console.log('🏁 FINAL RESULT (AGROGREEN):', filtered.length, 'entries');
      console.log('🔍 ========== END FILTERING DEBUG ==========');
      return filtered;
    }
    
    // Further filter by commodity for warehouse-owner and bank-funded insurance
    if (baseForm.commodity) {
      filtered = filtered.filter(ins => {
        const insuranceCommodities = (ins.insuranceCommodity || ins.commodityName || '').split(',').map((c: string) => c.trim().toLowerCase());
        const commodityMatch = insuranceCommodities.includes(baseForm.commodity.toLowerCase());
        console.log('🌾 Commodity filter:', {
          insuranceCommodity: ins.insuranceCommodity,
          commodityName: ins.commodityName,
          insuranceCommodities,
          searchCommodity: baseForm.commodity,
          match: commodityMatch
        });
        return commodityMatch;
      });
      console.log('✅ After commodity filter:', filtered.length, 'entries');
    }
    
    // Filter by selected bank for bank-funded insurance
    if (normalizedSelectedType === 'bank-funded') {
      console.log('🏦 Bank-funded insurance selected - applying bank filter...');
      if (!selectedBank || !selectedBank.bankName) {
        console.log('⚠️ Bank-funded insurance selected but no bank chosen - showing no results');
        return [];
      }
      
      // Only show bank-funded insurance that matches the selected bank
      // Use flexible matching: check if bank names match or if one contains the other
      filtered = filtered.filter(ins => {
        const insuranceBankName = (ins.selectedBankName || '').toLowerCase().trim();
        const selectedBankName = selectedBank.bankName.toLowerCase().trim();
        
        // Check for exact match OR if one contains the other
        const exactMatch = insuranceBankName === selectedBankName;
        const insuranceContainsSelected = insuranceBankName.includes(selectedBankName);
        const selectedContainsInsurance = selectedBankName.includes(insuranceBankName);
        const bankMatch = exactMatch || insuranceContainsSelected || selectedContainsInsurance;
        
        console.log('🏦 Bank comparison:', {
          insuranceBankName: ins.selectedBankName,
          selectedBankName: selectedBank.bankName,
          exactMatch,
          insuranceContainsSelected,
          selectedContainsInsurance,
          finalMatch: bankMatch
        });
        return bankMatch;
      });
      console.log('✅ After bank filter:', filtered.length, 'entries');
    }
    
    console.log('🏁 FINAL RESULT:', filtered.length, 'entries');
    console.log('🔍 ========== END FILTERING DEBUG ==========');
  }, []);

  // Cross-module reflection - dispatch events when data changes
  const dispatchDataUpdate = useCallback(() => {
    window.dispatchEvent(new CustomEvent('inwardDataUpdated', {
      detail: { timestamp: Date.now() }
    }));
  }, []);

  // Handle SR/WR approval
  const handleApproveSR = async (row: any) => {
    if (!row || !hologramNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter hologram number before approving.",
        variant: "destructive",
      });
      return;
    }

    try {
      const srDateOnly = todayYYYYMMDD();
      const srDateISO = new Date().toISOString();
      const docRef = doc(db, 'inward', row.id);
      await updateDoc(docRef, {
        status: 'approved',
        hologramNumber: hologramNumber,
        // Store the SR Generation Date as the approval day (YYYY-MM-DD) and keep ISO for auditing
        srGenerationDate: srDateOnly,
        srGenerationDateISO: srDateISO,
        approvedAt: srDateISO,
        updatedAt: srDateISO
      });

      setIsFormApproved(true);
      // Reflect immediately in UI using normalized DD-MM-YYYY
      setSrGenerationDate(normalizeDate(srDateOnly));
      
      toast({
        title: "Success",
        description: `${row.receiptType} approved successfully.`,
        variant: "default",
      });

      // Refresh data and dispatch update
      setDataVersion(v => v + 1);
      dispatchDataUpdate();
    } catch (error) {
      console.error('Error approving SR/WR:', error);
      toast({
        title: "Error",
        description: "Failed to approve. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle SR/WR rejection
  const handleRejectSR = async (row: any) => {
    const reason = prompt("Please enter reason for rejection:");
    if (!reason) return;

    try {
      const docRef = doc(db, 'inward', row.id);
      await updateDoc(docRef, {
        status: 'rejected',
        rejectionReason: reason,
        rejectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      toast({
        title: "Success",
        description: `${row.receiptType} rejected successfully.`,
        variant: "default",
      });

      // Refresh data and close modal
      setDataVersion(v => v + 1);
      setShowSRForm(false);
      dispatchDataUpdate();
    } catch (error) {
      console.error('Error rejecting SR/WR:', error);
      toast({
        title: "Error",
        description: "Failed to reject. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle SR/WR resubmission
  const handleResubmitSR = async (row: any) => {
    const reason = prompt("Please enter reason for resubmission:");
    if (!reason) return;

    try {
      const docRef = doc(db, 'inward', row.id);
      await updateDoc(docRef, {
        status: 'resubmited',
        resubmissionReason: reason,
        resubmittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      toast({
        title: "Success",
        description: `${row.receiptType} marked for resubmission.`,
        variant: "default",
      });

      // Refresh data and close modal
      setDataVersion(v => v + 1);
      setShowSRForm(false);
      dispatchDataUpdate();
    } catch (error) {
      console.error('Error marking for resubmission:', error);
      toast({
        title: "Error",
        description: "Failed to mark for resubmission. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Fetch available reservations based on warehouse and client
  const fetchAvailableReservations = useCallback(async (warehouseName: string, clientName: string, state?: string, branch?: string, location?: string) => {
    if (!warehouseName || !clientName) {
      console.log('❌ fetchAvailableReservations: Missing warehouse or client', { warehouseName, clientName });
      setAvailableReservations([]);
      setSelectedReservation(null);
      return;
    }

    console.log('🔍 Fetching reservations for:', { warehouseName, clientName, state, branch, location });

    try {
      const reservationCollection = collection(db, 'reservation');
      const snapshot = await getDocs(reservationCollection);
      const reservations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      console.log('📋 Total reservations found:', reservations.length);
      console.log('📋 Sample reservation structure:', reservations[0]);
      
      // Filter reservations for the selected warehouse and client (with location matching if provided)
      const matchingReservations = reservations.filter(res => {
        const basicMatch = res.warehouse === warehouseName && res.client === clientName;
        
        // If location details are provided, use them for filtering, otherwise just basic match
        if (state && branch && location) {
          return basicMatch && res.state === state && res.branch === branch && res.location === location;
        }
        
        return basicMatch;
      });
      
      console.log('✅ Matching reservations:', matchingReservations.length);
      console.log('✅ Matching reservations data:', matchingReservations);
      
      setAvailableReservations(matchingReservations);
      
      // Auto-select if only one reservation is available
      if (matchingReservations.length === 1) {
        console.log('🎯 Auto-selecting single reservation:', matchingReservations[0]);
        setSelectedReservation(matchingReservations[0]);
      } else {
        setSelectedReservation(null);
      }
    } catch (error) {
      console.error('❌ Error fetching reservations:', error);
      setAvailableReservations([]);
      setSelectedReservation(null);
    }
  }, []);

  // Fetch available banks for a warehouse from inspections collection
  const fetchAvailableBanks = useCallback(async (warehouseCode: string) => {
    if (!warehouseCode) {
      console.log('❌ fetchAvailableBanks: Missing warehouse code');
      setAvailableBanks([]);
      setSelectedBank(null);
      return;
    }

    console.log('🏦 Fetching banks for warehouse code:', warehouseCode);

    try {
      const inspectionsCollection = collection(db, 'inspections');
      const q = query(inspectionsCollection, where('warehouseCode', '==', warehouseCode));
      const querySnapshot = await getDocs(q);
      
      const banksSet = new Map<string, any>();
      
      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // SWAP: bankBranch <-> bankName when reading from DB
        // DB has them swapped, so we correct them here
        const correctBankName = data.bankBranch || ''; // DB's bankBranch → actual bank name
        const correctBankBranch = data.bankName || ''; // DB's bankName → actual branch name
        
        // Create a unique key combining bankName + IFSC to avoid duplicates
        const bankKey = `${correctBankName}_${data.ifscCode || ''}`;
        
        if (correctBankName && !banksSet.has(bankKey)) {
          banksSet.set(bankKey, {
            bankName: correctBankName,      // Now correct: "Main bank"
            bankBranch: correctBankBranch,  // Now correct: "Main branch"
            bankState: data.bankState || '',
            ifscCode: data.ifscCode || ''
          });
        }
      });
      
      const banksArray = Array.from(banksSet.values());
      console.log('✅ Found banks for warehouse:', banksArray.length);
      console.log('📋 Banks data:', banksArray);
      
      setAvailableBanks(banksArray);
      
      // Auto-select if only one bank is available
      if (banksArray.length === 1) {
        console.log('🎯 Auto-selecting single bank:', banksArray[0]);
        setSelectedBank(banksArray[0]);
        // Auto-fill bank details
        setBaseForm(f => ({
          ...f,
          bankName: banksArray[0].bankName,
          bankBranch: banksArray[0].bankBranch,
          bankState: banksArray[0].bankState,
          ifscCode: banksArray[0].ifscCode
        }));
      } else if (banksArray.length === 0) {
        // No banks found
        console.log('⚠️ No banks found for warehouse');
        setSelectedBank(null);
        setBaseForm(f => ({
          ...f,
          bankName: '',
          bankBranch: '',
          bankState: '',
          ifscCode: ''
        }));
      } else {
        // Multiple banks - user needs to select
        setSelectedBank(null);
      }
    } catch (error) {
      console.error('❌ Error fetching banks:', error);
      setAvailableBanks([]);
      setSelectedBank(null);
    }
  }, []);

  // Helper to format a JS Date or date string to DD-MM-YYYY
  const formatToDDMMYYYY = (d: Date | string | null) => {
    if (!d) return '';
    const dt = typeof d === 'string' ? new Date(d) : d;
    if (!(dt instanceof Date) || isNaN(dt.getTime())) return '';
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  // Async check for reservation and insurance expiry based on selected warehouse & client
  const checkReservationAndInsurance = useCallback(async (warehouseName: string, clientName: string) => {
  setAlertOpen(false);
  setPreventInward(false);
  setInlineAlert(null);

    if (!warehouseName || !clientName) return;

    // Check reservation expiry from reservations state
    try {
      const warehouseReservations = reservations.filter((r: any) => 
        r.warehouse === warehouseName && r.state === baseForm.state && r.branch === baseForm.branch && r.location === baseForm.location
      );

      if (warehouseReservations.length > 0) {
        for (const reservation of warehouseReservations) {
          // Only check expiry for reservations with 'reservation' status
          if (reservation.reservationStatus === 'reservation' && reservation.reservationEnd) {
            const resEnd = new Date(reservation.reservationEnd);
            if (resEnd instanceof Date && !isNaN(resEnd.getTime())) {
              const today = new Date();
              today.setHours(0,0,0,0);
              if (resEnd < today) {
                // Check if billing parameters are available to replace reservation
                const hasBillingParams = reservation.billingCycle && reservation.billingCycle !== '-' &&
                                       reservation.billingType && reservation.billingType !== '-' &&
                                       reservation.billingRate && reservation.billingRate !== '-';
                
                if (hasBillingParams) {
                  // Billing params available - show informational alert
                  const msg = `Reservation has expired on ${formatToDDMMYYYY(resEnd)}. Billing parameters are now active for this warehouse.`;
                  setInlineAlert({ title: 'Reservation Expired - Billing Active', message: msg, severity: 'warning' });
                } else {
                  // No billing params - prevent inward entry
                  const msg = `Reservation Expired - The reservation end date (${formatToDDMMYYYY(resEnd)}) has expired. You must first update the reservation status of this warehouse with billing parameters in the Reservation Master before inward entry can be processed.`;
                  setInlineAlert({ title: 'Reservation Expired', message: msg, severity: 'error' });
                  setPreventInward(true);
                  return;
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error checking reservation:', err);
    }

    // Check insurance coverage for the warehouse - prioritize insurance master collection
    try {
      if (warehouseName) {
        let insuranceEntries: any[] = [];
        
        // First check insurance master collection for current coverage
        console.log('🔍 Checking insurance coverage for warehouse:', warehouseName);
        const insuranceMasterCollection = collection(db, 'insurance');
        const masterQuery = query(
          insuranceMasterCollection,
          where('warehouseName', '==', warehouseName),
          where('state', '==', baseForm.state),
          where('branch', '==', baseForm.branch),
          where('location', '==', baseForm.location)
        );
        
        const masterSnapshot = await getDocs(masterQuery);
        if (!masterSnapshot.empty) {
          console.log('✅ Found insurance in master collection:', masterSnapshot.docs.length, 'policies');
          insuranceEntries = masterSnapshot.docs.map(doc => {
            const data = doc.data();
            console.log('📋 Insurance entry data:', {
              commodityName: data.commodityName,
              clientName: data.clientName,
              selectedCommodities: data.selectedCommodities,
              insuranceType: data.insuranceType,
              selectedBankName: data.selectedBankName
            });
            return {
              insuranceId: data.insuranceCode || doc.id,
              insuranceTakenBy: data.insuranceType || 'client',
              firePolicyEndDate: data.firePolicyEndDate,
              burglaryPolicyEndDate: data.burglaryPolicyEndDate,
              firePolicyRemainingAmount: data.firePolicyRemainingAmount,
              burglaryPolicyRemainingAmount: data.burglaryPolicyRemainingAmount,
              commodityName: data.commodityName,
              insuranceCommodity: data.commodityName, // Also set this for consistency
              clientName: data.clientName,
              selectedCommodities: data.selectedCommodities,
              selectedBankName: data.selectedBankName, // CRITICAL: Include bank name for bank-funded insurance!
              // Include all insurance policy fields
              firePolicyCompanyName: data.firePolicyCompanyName,
              firePolicyNumber: data.firePolicyNumber,
              firePolicyAmount: data.firePolicyAmount,
              remainingFirePolicyAmount: data.firePolicyRemainingAmount,
              firePolicyStartDate: data.firePolicyStartDate,
              burglaryPolicyCompanyName: data.burglaryPolicyCompanyName,
              burglaryPolicyNumber: data.burglaryPolicyNumber,
              burglaryPolicyAmount: data.burglaryPolicyAmount,
              remainingBurglaryPolicyAmount: data.burglaryPolicyRemainingAmount,
              burglaryPolicyStartDate: data.burglaryPolicyStartDate
            };
          });
        } else {
          console.log('⚠️ No insurance found in master collection, checking inspections as fallback...');
          // Fallback to inspections collection
          const inspectionsCollection = collection(db, 'inspections');
          const q = query(inspectionsCollection, where('warehouseName', '==', warehouseName));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const inspectionData = querySnapshot.docs[0].data();
            if (inspectionData.insuranceEntries && Array.isArray(inspectionData.insuranceEntries)) {
              insuranceEntries = inspectionData.insuranceEntries;
            } else if (inspectionData.warehouseInspectionData?.insuranceEntries && Array.isArray(inspectionData.warehouseInspectionData.insuranceEntries)) {
              insuranceEntries = inspectionData.warehouseInspectionData.insuranceEntries;
            }
          }
        }

        // Check if insurance exists at all - block inward if no insurance found
        if (!insuranceEntries || insuranceEntries.length === 0) {
          const msg = `No Insurance Found - This warehouse does not have any insurance coverage. Insurance is required to process inward entries.`;
          setInlineAlert({ title: 'No Insurance Coverage', message: msg, severity: 'error' });
          setPreventInward(true);
          return;
        }

        // If there are insurance entries, prefer checking the specifically selected insurance (when adding inward).
        const today = new Date();
        today.setHours(0,0,0,0);

        // If a specific insurance is selected on the form, only validate that one entry.
        if (baseForm.selectedInsurance && baseForm.selectedInsurance.insuranceId && baseForm.selectedInsurance.insuranceTakenBy) {
          const sel = baseForm.selectedInsurance;
          const match = insuranceEntries.find((ins: any) =>
            ins.insuranceId === sel.insuranceId && ins.insuranceTakenBy === sel.insuranceTakenBy
          );
          if (match) {
            const fireEnd = match.firePolicyEndDate ? new Date(match.firePolicyEndDate) : (match.firePolicyEnd ? new Date(match.firePolicyEnd) : null);
            const burglaryEnd = match.burglaryPolicyEndDate ? new Date(match.burglaryPolicyEndDate) : (match.burglaryPolicyEnd ? new Date(match.burglaryPolicyEnd) : null);
            if (fireEnd instanceof Date && !isNaN(fireEnd.getTime()) && fireEnd < today) {
              const msg = `Insurance Expired - The fire insurance end date (${formatToDDMMYYYY(fireEnd)}) has expired. You must first update the insurance data for this warehouse in both Insurance Master and Survey before inward entry can be processed.`;
              setInlineAlert({ title: 'Insurance Expired', message: msg, severity: 'error' });
              setPreventInward(true);
              return;
            }
            if (burglaryEnd instanceof Date && !isNaN(burglaryEnd.getTime()) && burglaryEnd < today) {
              const msg = `Insurance Expired - The burglary insurance end date (${formatToDDMMYYYY(burglaryEnd)}) has expired. You must first update the insurance data for this warehouse in both Insurance Master and Survey before inward entry can be processed.`;
              setInlineAlert({ title: 'Insurance Expired', message: msg, severity: 'error' });
              setPreventInward(true);
              return;
            }
          } else {
            // No matching inspection entry found for the selected insurance. Fall back to baseForm dates (if any).
            // (Do not scan other insurance entries when the user chose a specific insurance.)
            // continue to fallback checks below
          }
        } else {
          // No specific insurance selected - preserve previous behaviour: if any policy expired block inward
          for (const ins of insuranceEntries) {
            const fireEnd = ins.firePolicyEndDate ? new Date(ins.firePolicyEndDate) : (ins.firePolicyEnd ? new Date(ins.firePolicyEnd) : null);
            const burglaryEnd = ins.burglaryPolicyEndDate ? new Date(ins.burglaryPolicyEndDate) : (ins.burglaryPolicyEnd ? new Date(ins.burglaryPolicyEnd) : null);
            if (fireEnd instanceof Date && !isNaN(fireEnd.getTime()) && fireEnd < today) {
              const msg = `Insurance Expired - The fire insurance end date (${formatToDDMMYYYY(fireEnd)}) has expired. You must first update the insurance data for this warehouse in both Insurance Master and Survey before inward entry can be processed.`;
              setInlineAlert({ title: 'Insurance Expired', message: msg, severity: 'error' });
              setPreventInward(true);
              return;
            }
            if (burglaryEnd instanceof Date && !isNaN(burglaryEnd.getTime()) && burglaryEnd < today) {
              const msg = `Insurance Expired - The burglary insurance end date (${formatToDDMMYYYY(burglaryEnd)}) has expired. You must first update the insurance data for this warehouse in both Insurance Master and Survey before inward entry can be processed.`;
              setInlineAlert({ title: 'Insurance Expired', message: msg, severity: 'error' });
              setPreventInward(true);
              return;
            }
          }
        }
      }
    } catch (err) {
      console.error('Error checking inspection insurance:', err);
    }

    // Fallback: check any insurance fields in baseForm
    try {
      const fireEnd = baseForm.firePolicyEnd ? new Date(baseForm.firePolicyEnd) : null;
      const burglaryEnd = baseForm.burglaryPolicyEnd ? new Date(baseForm.burglaryPolicyEnd) : null;
      const today = new Date();
      today.setHours(0,0,0,0);
      if (fireEnd instanceof Date && !isNaN(fireEnd.getTime()) && fireEnd < today) {
        const msg = `Insurance Expired - The fire insurance end date (${formatToDDMMYYYY(fireEnd)}) has expired. You must first update the insurance data for this warehouse in both Insurance Master and Survey before inward entry can be processed.`;
        setInlineAlert({ title: 'Insurance Expired', message: msg, severity: 'error' });
        setPreventInward(true);
        return;
      }
      if (burglaryEnd instanceof Date && !isNaN(burglaryEnd.getTime()) && burglaryEnd < today) {
        const msg = `Insurance Expired - The burglary insurance end date (${formatToDDMMYYYY(burglaryEnd)}) has expired. You must first update the insurance data for this warehouse in both Insurance Master and Survey before inward entry can be processed.`;
        setInlineAlert({ title: 'Insurance Expired', message: msg, severity: 'error' });
        setPreventInward(true);
        return;
      }
    } catch (err) {
      console.error('Error checking baseForm insurance dates:', err);
    }

    // If all checks pass, ensure the modal is closed and allow inward
    setAlertOpen(false);
    setPreventInward(false);
  }, [reservations, baseForm.state, baseForm.branch, baseForm.location, baseForm.firePolicyEnd, baseForm.burglaryPolicyEnd, baseForm.selectedInsurance]);

  // Run check when warehouse or client is selected
  useEffect(() => {
    checkReservationAndInsurance(baseForm.warehouseName, baseForm.client).catch(err => console.error(err));
  }, [baseForm.warehouseName, baseForm.client, checkReservationAndInsurance]);

  // Calculate insurance balance amounts
  useEffect(() => {
    // Safely parse amounts, handling empty strings, null, undefined, and non-numeric values
    const parseAmount = (amount: any): number => {
      if (!amount || amount === '' || amount === '-' || amount === 'N/A') return 0;
      const parsed = parseFloat(String(amount).replace(/[^\d.-]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    };

    const fireAmount = parseAmount(baseForm.firePolicyAmount);
    const burglaryAmount = parseAmount(baseForm.burglaryPolicyAmount);
    const totalValue = parseAmount(baseForm.totalValue);

    // Debug logging to track NaN issues
    if (isNaN(fireAmount) || isNaN(burglaryAmount) || isNaN(totalValue)) {
      console.warn('NaN detected in insurance balance calculation:', {
        firePolicyAmount: baseForm.firePolicyAmount,
        burglaryPolicyAmount: baseForm.burglaryPolicyAmount,
        totalValue: baseForm.totalValue,
        parsedFireAmount: fireAmount,
        parsedBurglaryAmount: burglaryAmount,
        parsedTotalValue: totalValue
      });
    }

    const fireBalance = fireAmount - totalValue;
    const burglaryBalance = burglaryAmount - totalValue;

    setBaseForm(f => ({
      ...f,
      firePolicyBalance: fireBalance >= 0 ? fireBalance.toFixed(2) : '0.00',
      burglaryPolicyBalance: burglaryBalance >= 0 ? burglaryBalance.toFixed(2) : '0.00',
    }));
  }, [baseForm.firePolicyAmount, baseForm.burglaryPolicyAmount, baseForm.totalValue]);

  // Auto-calculate total bags and quantity from all entries (saved and current)
  useEffect(() => {
    if (isEditMode) {
      // In edit mode, calculate only from visible inward entries
      const savedBagsSum = inwardEntries.reduce((sum, entry) => sum + (parseInt(entry.totalBags, 10) || 0), 0);
      const savedQuantitySum = inwardEntries.reduce((sum, entry) => sum + (parseFloat(entry.totalQuantity) || 0), 0);

      setBaseForm(f => ({
        ...f,
        totalBags: savedBagsSum > 0 ? savedBagsSum.toString() : '',
        totalQuantity: savedQuantitySum > 0 ? savedQuantitySum.toFixed(3) : '',
      }));
    } else {
      // For new entries, sum from already saved entries + current entry form
      const savedBagsSum = inwardEntries.reduce((sum, entry) => sum + (parseInt(entry.totalBags, 10) || 0), 0);
      const savedQuantitySum = inwardEntries.reduce((sum, entry) => sum + (parseFloat(entry.totalQuantity) || 0), 0);

      // Get values from the current, unsaved entry form
      const currentBags = parseInt(currentEntryForm.totalBags, 10) || 0;
      const currentQuantity = parseFloat(currentEntryForm.totalQuantity) || 0;

      // Calculate the grand total - Total Bags in Commodity Information should always be sum of all entries
      const totalBagsSum = savedBagsSum + currentBags;
      const totalQuantitySum = savedQuantitySum + currentQuantity;

      setBaseForm(f => ({
        ...f,
        totalBags: totalBagsSum > 0 ? totalBagsSum.toString() : '',
        totalQuantity: totalQuantitySum > 0 ? totalQuantitySum.toFixed(3) : '',
      }));
    }
  }, [inwardEntries, currentEntryForm.totalBags, currentEntryForm.totalQuantity, isEditMode]);

  // Fetch all data on mount
  useEffect(() => {
    fetchData();
  }, [dataVersion, fetchData]);

  // Listen for reservation data updates from reservation-billing module
  useEffect(() => {
    const handleReservationUpdate = async (event: any) => {
      console.log('📢 Reservation data updated event received in inward module');
      const updatedReservations = event.detail;
      
      if (Array.isArray(updatedReservations)) {
        setReservations(updatedReservations);
        console.log('✅ Inward module: Reservations state updated with latest data');
        
        // If we have a currently selected reservation, update it with the latest data
        if (selectedReservation?.reservationId) {
          const updatedSelected = updatedReservations.find((r: any) => 
            r.reservationId === selectedReservation.reservationId
          );
          if (updatedSelected) {
            setSelectedReservation(updatedSelected);
            console.log('✅ Selected reservation updated with latest data');
          }
        }
        
        // Update CIR modal data if it exists (using functional update to access current state)
        setCIRModalData((prevModalData: any) => {
          // Check if modal is showing data
          if (!prevModalData) return prevModalData;
          
          console.log('🔄 Updating CIR modal data with latest reservation info');
          
          // Find matching reservation for this inward entry
          const matchingReservation = updatedReservations.find((r: any) => 
            r.warehouseCode === prevModalData.warehouseCode && 
            r.client === prevModalData.client &&
            r.commodity === prevModalData.commodity
          );
          
          if (matchingReservation) {
            console.log('✅ Found matching reservation, updating CIR modal data');
            return {
              ...prevModalData,
              reservationStatus: matchingReservation.reservationStatus || '',
              billingStatus: matchingReservation.billingStatus || '',
              reservationRate: matchingReservation.reservationRate || '',
              reservationQty: matchingReservation.reservationQty || '',
              reservationStart: matchingReservation.reservationStart || '',
              reservationEnd: matchingReservation.reservationEnd || '',
              billingCycle: matchingReservation.billingCycle || '',
              billingType: matchingReservation.billingType || '',
              billingRate: matchingReservation.billingRate || '',
            };
          }
          
          return prevModalData;
        });
        
        // Refresh the inward data to ensure future CIR modals show updated reservation info
        fetchData();
      }
    };

    window.addEventListener('reservationDataUpdated', handleReservationUpdate);
    
    return () => {
      window.removeEventListener('reservationDataUpdated', handleReservationUpdate);
    };
  }, [selectedReservation, fetchData]);

  // Filter branches by state
  const filteredBranches = branches.filter((b: any) => b.state === form.state);
  // Filter locations by branch
  const filteredLocations = filteredBranches.find((b: any) => b.branch === form.branch)?.locations || [];
  // Filter warehouses by location - ensure unique warehouses
  const filteredWarehouses = useMemo(() => {
    const fw = warehouses.filter((w: any) => 
      w.location?.trim().toLowerCase() === form.location.trim().toLowerCase()
    );
    console.log('Filtered Warehouses:', fw, 'location:', form.location);
    return fw;
  }, [warehouses, form.location]);

  // Check for Agrogreen insurance in inspections collection
  useEffect(() => {
    const checkAgrogreenInsurance = async () => {
      if (!form.warehouseName) {
        setAgrogreenInsurance(null);
        setActualBankBranch('');
        return;
      }
      try {
        console.log('🌱 Checking Agrogreen insurance for warehouse:', form.warehouseName);
        const inspectionsCollection = collection(db, 'inspections');
        const inspectionQuery = query(
          inspectionsCollection,
          where('warehouseName', '==', form.warehouseName),
          where('status', 'in', ['activated', 'reactivate'])
        );
        const inspectionSnapshot = await getDocs(inspectionQuery);
        console.log('🌱 Found inspections:', inspectionSnapshot.docs.length);
        let foundAgrogreen: any = null;
        let foundBankBranch: string = '';
        
        inspectionSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const warehouseData = data.warehouseInspectionData;
          console.log('🌱 Inspection data:', {
            warehouseName: data.warehouseName,
            hasInspectionData: !!warehouseData,
            insuranceTakenBy: warehouseData?.insuranceTakenBy,
            bankBranch: warehouseData?.bankBranch
          });
          
          // Extract actual bank branch name from inspections
          if (warehouseData && warehouseData.bankBranch) {
            foundBankBranch = warehouseData.bankBranch;
            console.log('✅ Found actual bank branch from inspections:', foundBankBranch);
          }
          
          // Check if insuranceTakenBy is 'agrogreen'
          if (warehouseData && warehouseData.insuranceTakenBy?.toLowerCase() === 'agrogreen') {
            console.log('✅ Inspection shows Agrogreen insurance for warehouse:', form.warehouseName);
            // Mark that we should show Agrogreen insurance (data comes from universal fetch)
            foundAgrogreen = { shouldShow: true };
          }
        });
        
        // Set the extracted bank branch for matching bank-funded insurance
        if (foundBankBranch) {
          setActualBankBranch(foundBankBranch);
        }
        
        // Set agrogreen flag - actual insurance data is fetched in the universal insurances useEffect
        console.log('🌱 Setting agrogreenInsurance state:', foundAgrogreen);
        setAgrogreenInsurance(foundAgrogreen);
      } catch (error) {
        console.error('Error checking Agrogreen insurance:', error);
        setAgrogreenInsurance(null);
        setActualBankBranch('');
      }
    };
    checkAgrogreenInsurance();
  }, [form.warehouseName]);

  // Auto-fill warehouse code/address and business type
  useEffect(() => {
    if (form.warehouseName) {
      const wh = filteredWarehouses.find((w: any) => w.warehouseName === form.warehouseName);
      if (wh) {
        // Prefer address from warehouseInspectionData if available
        const address = wh.warehouseInspectionData?.address || wh.warehouseAddress || '';
        setBaseForm(f => ({ 
          ...f, 
          warehouseCode: wh.warehouseCode || '', 
          warehouseAddress: address,
          businessType: wh.businessType || ''
        }));
        
        // Fetch reservation data for this warehouse only if it's not CM type
        if (wh.businessType !== 'cm') {
          // Filter reservations using 3-factor combination: warehouseCode + client + commodity
          // This ensures we get the exact matching reservation for this inward entry
          const warehouseReservations = reservations.filter((r: any) => {
            const warehouseMatch = r.warehouseCode === wh.warehouseCode;
            const clientMatch = form.client ? r.client === form.client : true;
            const commodityMatch = form.commodity ? r.commodity === form.commodity : true;
            
            console.log('🔍 Filtering reservation:', {
              reservationId: r.reservationId,
              warehouseMatch,
              clientMatch,
              commodityMatch,
              rWarehouse: r.warehouseCode,
              rClient: r.client,
              rCommodity: r.commodity,
              formWarehouse: wh.warehouseCode,
              formClient: form.client,
              formCommodity: form.commodity
            });
            
            return warehouseMatch && clientMatch && commodityMatch;
          });
          
          console.log('📊 Found matching reservations:', warehouseReservations.length);
          
          if (warehouseReservations.length > 0) {
            setAvailableReservations(warehouseReservations);
            
            // Auto-select the first reservation if only one exists
            if (warehouseReservations.length === 1) {
              const reservation = warehouseReservations[0];
              setSelectedReservation(reservation);
              
              console.log('✅ Auto-selected reservation:', {
                reservationId: reservation.reservationId,
                reservationEnd: reservation.reservationEnd,
                billingCycle: reservation.billingCycle
              });
              
              setBaseForm(f => ({
                ...f,
                reservationStatus: reservation.reservationStatus || 'reservation',
                billingStatus: reservation.billingStatus || '',
                reservationRate: reservation.reservationRate || '',
                reservationQty: reservation.reservationQty || '',
                reservationStart: reservation.reservationStart || '',
                reservationEnd: reservation.reservationEnd || '',
                billingCycle: reservation.billingCycle || '',
                billingType: reservation.billingType || '',
                billingRate: reservation.billingRate || '',
              }));
            } else {
              // Multiple reservations available - user needs to select
              console.log('⚠️ Multiple reservations found, user must select');
              setSelectedReservation(null);
            }
          } else {
            // Clear reservation fields if no reservation found
            setAvailableReservations([]);
            setSelectedReservation(null);
            setBaseForm(f => ({
              ...f,
              reservationStatus: '',
              billingStatus: '',
              reservationRate: '',
              reservationQty: '',
              reservationStart: '',
              reservationEnd: '',
              billingCycle: '',
              billingType: '',
              billingRate: '',
            }));
          }
        } else {
          // Clear reservation fields for CM type warehouses
          setBaseForm(f => ({
            ...f,
            billingStatus: '',
            reservationRate: '',
            reservationQty: '',
            reservationStart: '',
            reservationEnd: '',
            billingCycle: '',
            billingType: '',
            billingRate: '',
          }));
          // Clear reservation state
          setAvailableReservations([]);
          setSelectedReservation(null);
        }
      } else {
        // Clear all warehouse-related fields if warehouse not found
        setBaseForm(f => ({ 
          ...f, 
          warehouseCode: '', 
          warehouseAddress: '', 
          businessType: '',
          billingStatus: '',
          reservationRate: '',
          reservationQty: '',
          reservationStart: '',
          reservationEnd: '',
          billingCycle: '',
          billingType: '',
          billingRate: '',
        }));
      }
    } else {
      setBaseForm(f => ({ 
        ...f, 
        warehouseCode: '', 
        warehouseAddress: '', 
        businessType: '',
        billingStatus: '',
        reservationRate: '',
        reservationQty: '',
        reservationStart: '',
        reservationEnd: '',
        billingCycle: '',
        billingType: '',
        billingRate: '',
      }));
    }
    // eslint-disable-next-line
  }, [form.warehouseName, form.client, form.commodity, reservations, filteredWarehouses]);

  // Auto-fill client ID and address
  useEffect(() => {
    if (form.client) {
      const selectedClient = clients.find(c => c.firmName === form.client);
      if (selectedClient) {
        setBaseForm(f => ({ 
          ...f, 
          clientCode: selectedClient.clientId,
          clientAddress: selectedClient.companyAddress || ''
        }));
      }
    } else {
      setBaseForm(f => ({ 
        ...f, 
        clientCode: '',
        clientAddress: ''
      }));
    }
  }, [form.client, clients]);

  const getBusinessTypeLabel = (type: string) => {
    switch (type) {
      case 'cm': return 'Collateral Management (CM)';
      case 'pwh': return 'Professional Warehousing (PWH)';
      case 'ncdex': return 'NCDEX';
      default: return type;
    }
  };

  // Get varieties for selected commodity
  const getCommodityVarieties = (commodityName: string) => {
    const commodity = commodities.find((c: any) => c.commodityName === commodityName);
    return commodity?.varieties || [];
  };

  // Get bank details for selected bank
  const getBankDetails = (bankName: string) => {
    const bank = banks.find((b: any) => b.bankName === bankName);
    return bank || null;
  };

  // Handle commodity selection
  const handleCommodityChange = (commodityName: string) => {
    const selectedCommodity = commodities.find((c: any) => c.commodityName === commodityName);
    console.log('Selected commodity:', selectedCommodity);
    console.log('Commodity rate:', selectedCommodity?.rate);
    
    setBaseForm(f => ({ 
      ...f, 
      commodity: commodityName,
      varietyName: '',
      marketRate: selectedCommodity?.rate ? selectedCommodity.rate.toString() : ''
    }));
    
    // DON'T fetch insurance again - it was already fetched for the warehouse
    // Insurance filtering by commodity happens in the UI display logic
  };

  // Function to refresh insurance data after submission
  const refreshInsuranceData = async () => {
    if (form.commodity && form.warehouseName) {
      await fetchInsuranceData(form.commodity);
    }
  };

  // Fetch insurance data directly from Insurance Master collection (latest amounts)
  const fetchInsuranceData = async (commodityName: string) => {
    if (!form.state || !form.branch || !form.location || !form.warehouseName || !commodityName) {
      console.log('❌ Missing required filters for insurance fetch');
      return;
    }

    console.log('🔍 FETCHING INSURANCE FROM MASTER - Filters:', {
      warehouseName: form.warehouseName,
      state: form.state,
      branch: form.branch,
      location: form.location,
      commodity: commodityName,
      variety: form.varietyName
    });

    try {
      // Fetch ALL insurance documents matching warehouse
      // NOTE: We fetch by warehouse only (no commodity filter) because CLIENT insurance is universal
      const insuranceMasterCollection = collection(db, 'insurance');
      const simpleQuery = query(
        insuranceMasterCollection,
        where('warehouseName', '==', form.warehouseName)
      );
      
      console.log('📊 Executing query to fetch ALL insurances for warehouse...');
      const querySnapshot = await getDocs(simpleQuery);
      console.log('📊 Query result - Documents found:', querySnapshot.docs.length);
      
      if (!querySnapshot.empty) {
        // Create insurance entries for ALL matching documents
        const allInsuranceEntries = querySnapshot.docs.map(insuranceMasterDoc => {
          const insuranceData = insuranceMasterDoc.data();
          
          console.log('✅ RAW INSURANCE DOCUMENT DATA:', {
            docId: insuranceMasterDoc.id,
            FULL_DATA: insuranceData,
            insuranceType: insuranceData.insuranceType,
            insuranceTakenBy: insuranceData.insuranceTakenBy,
            bankFundedBy: insuranceData.bankFundedBy,
            clientName: insuranceData.clientName,
            commodityName: insuranceData.commodityName,
            firePolicyAmount: insuranceData.firePolicyAmount,
            burglaryPolicyAmount: insuranceData.burglaryPolicyAmount
          });
          
          const entry = {
            id: `ins_master_${insuranceMasterDoc.id}`,
            insuranceId: insuranceData.insuranceCode || `INS_${form.warehouseName}_${Date.now()}`,
            warehouseName: form.warehouseName,
            state: form.state,
            branch: form.branch,
            location: form.location,
            insuranceCommodity: insuranceData.commodityName || commodityName,
            commodityName: insuranceData.commodityName || commodityName,
            varietyName: form.varietyName,
            insuranceTakenBy: insuranceData.insuranceTakenBy || insuranceData.insuranceType || '',
            clientName: insuranceData.clientName || '',
            selectedBankName: insuranceData.bankFundedBy || insuranceData.selectedBankName || '',
            firePolicyCompanyName: insuranceData.firePolicyCompanyName || '',
            firePolicyNumber: insuranceData.firePolicyNumber || '',
            firePolicyAmount: insuranceData.firePolicyAmount || '0',
            firePolicyStartDate: insuranceData.firePolicyStartDate || null,
            firePolicyEndDate: insuranceData.firePolicyEndDate || null,
            burglaryPolicyCompanyName: insuranceData.burglaryPolicyCompanyName || '',
            burglaryPolicyNumber: insuranceData.burglaryPolicyNumber || '',
            burglaryPolicyAmount: insuranceData.burglaryPolicyAmount || '0',
            burglaryPolicyStartDate: insuranceData.burglaryPolicyStartDate || null,
            burglaryPolicyEndDate: insuranceData.burglaryPolicyEndDate || null,
            // Use remaining amounts from master collection (most up-to-date)
            remainingFirePolicyAmount: insuranceData.firePolicyRemainingAmount || insuranceData.firePolicyAmount || '0',
            remainingBurglaryPolicyAmount: insuranceData.burglaryPolicyRemainingAmount || insuranceData.burglaryPolicyAmount || '0'
          };
          
          console.log('📦 Created insurance entry:', {
            insuranceTakenBy: entry.insuranceTakenBy,
            selectedBankName: entry.selectedBankName,
            insuranceCommodity: entry.insuranceCommodity
          });
          
          return entry;
        });

        console.log(`✅ Total insurance entries created: ${allInsuranceEntries.length}`);
        allInsuranceEntries.forEach((entry, idx) => {
          console.log(`  ${idx + 1}. ${entry.insuranceTakenBy} - Bank: ${entry.selectedBankName || 'N/A'} - Commodity: ${entry.insuranceCommodity}`);
        });
        
        setInsuranceEntries(allInsuranceEntries);
        
        // Auto-fill form fields with the first insurance entry (for backward compatibility)
        if (allInsuranceEntries.length > 0) {
          const firstInsurance = allInsuranceEntries[0];
          setBaseForm(f => ({
            ...f,
            insuranceManagedBy: firstInsurance.insuranceTakenBy || '',
            firePolicyNumber: firstInsurance.firePolicyNumber || '',
            firePolicyAmount: firstInsurance.remainingFirePolicyAmount || '',
            firePolicyStart: firstInsurance.firePolicyStartDate || '',
            firePolicyEnd: firstInsurance.firePolicyEndDate || '',
            burglaryPolicyNumber: firstInsurance.burglaryPolicyNumber || '',
            burglaryPolicyAmount: firstInsurance.remainingBurglaryPolicyAmount || '',
            burglaryPolicyStart: firstInsurance.burglaryPolicyStartDate || '',
            burglaryPolicyEnd: firstInsurance.burglaryPolicyEndDate || '',
            firePolicyCompanyName: firstInsurance.firePolicyCompanyName || '',
            burglaryPolicyCompanyName: firstInsurance.burglaryPolicyCompanyName || '',
            bankFundedBy: firstInsurance.selectedBankName || '',
          }));
        }
      } else {
        console.log('❌ No insurance data found in master collection, trying inspections as fallback...');
        
        // Fallback to inspections collection if not found in master
        const inspectionsCollection = collection(db, 'inspections');
        const inspectionQuery = query(
          inspectionsCollection,
          where('warehouseName', '==', form.warehouseName),
          where('status', 'in', ['activated', 'reactivate'])
        );
        
        const inspectionSnapshot = await getDocs(inspectionQuery);
        let foundInsurance: any = null;

        inspectionSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const warehouseData = data.warehouseInspectionData;
          
          if (warehouseData && warehouseData.insuranceTakenBy && 
              (warehouseData.firePolicyNumber || warehouseData.burglaryPolicyNumber)) {
            foundInsurance = warehouseData;
            console.log('✅ Found insurance data in inspections (fallback):', foundInsurance);
          }
        });

        if (foundInsurance) {
          const insuranceEntry = {
            id: `ins_fallback_${Date.now()}`,
            insuranceId: `INS_${form.warehouseName}_${Date.now()}`,
            warehouseName: form.warehouseName,
            state: form.state,
            branch: form.branch,
            location: form.location,
            insuranceCommodity: commodityName,
            varietyName: form.varietyName,
            insuranceTakenBy: foundInsurance.insuranceTakenBy || '',
            clientName: foundInsurance.clientName || '',
            selectedBankName: foundInsurance.selectedBankName || '',
            firePolicyCompanyName: foundInsurance.firePolicyCompanyName || '',
            firePolicyNumber: foundInsurance.firePolicyNumber || '',
            firePolicyAmount: foundInsurance.firePolicyAmount || '0',
            firePolicyStartDate: foundInsurance.firePolicyStartDate || null,
            firePolicyEndDate: foundInsurance.firePolicyEndDate || null,
            burglaryPolicyCompanyName: foundInsurance.burglaryPolicyCompanyName || '',
            burglaryPolicyNumber: foundInsurance.burglaryPolicyNumber || '',
            burglaryPolicyAmount: foundInsurance.burglaryPolicyAmount || '0',
            burglaryPolicyStartDate: foundInsurance.burglaryPolicyStartDate || null,
            burglaryPolicyEndDate: foundInsurance.burglaryPolicyEndDate || null,
            remainingFirePolicyAmount: foundInsurance.firePolicyAmount || '0',
            remainingBurglaryPolicyAmount: foundInsurance.burglaryPolicyAmount || '0'
          };

          setInsuranceEntries([insuranceEntry]);
          setBaseForm(f => ({
            ...f,
            insuranceManagedBy: foundInsurance.insuranceTakenBy || '',
            firePolicyNumber: foundInsurance.firePolicyNumber || '',
            firePolicyAmount: foundInsurance.firePolicyAmount || '',
            firePolicyStart: foundInsurance.firePolicyStartDate || '',
            firePolicyEnd: foundInsurance.firePolicyEndDate || '',
            burglaryPolicyNumber: foundInsurance.burglaryPolicyNumber || '',
            burglaryPolicyAmount: foundInsurance.burglaryPolicyAmount || '',
            burglaryPolicyStart: foundInsurance.burglaryPolicyStartDate || '',
            burglaryPolicyEnd: foundInsurance.burglaryPolicyEndDate || '',
            firePolicyCompanyName: foundInsurance.firePolicyCompanyName || '',
            burglaryPolicyCompanyName: foundInsurance.burglaryPolicyCompanyName || '',
            bankFundedBy: foundInsurance.selectedBankName || '',
          }));
        } else {
          console.log('❌ No insurance data found in either collection');
          setInsuranceEntries([]);
          setBaseForm(f => ({
            ...f,
            insuranceManagedBy: '',
            firePolicyNumber: '',
            firePolicyAmount: '',
            firePolicyStart: '',
            firePolicyEnd: '',
            burglaryPolicyNumber: '',
            burglaryPolicyAmount: '',
            burglaryPolicyStart: '',
            burglaryPolicyEnd: '',
            firePolicyCompanyName: '',
            burglaryPolicyCompanyName: '',
            bankFundedBy: '',
          }));
        }
      }
    } catch (error) {
      console.error('❌ Error fetching insurance:', error);
      setInsuranceEntries([]);
    }
  };

  // Handle variety selection
  const handleVarietyChange = (varietyName: string) => {
    const commodity = commodities.find((c: any) => c.commodityName === form.commodity);
    const variety = commodity?.varieties?.find((v: any) => v.varietyName === varietyName);
    
    setBaseForm(f => ({ 
      ...f, 
      varietyName: varietyName,
      // Keep existing marketRate if already set from commodity, otherwise use variety rate
      marketRate: f.marketRate || (variety?.rate ? `${variety.rate} ` : '')
    }));

    const particulars = variety?.particulars || [];
    setCurrentEntryForm(f => ({
      ...f,
      labResults: particulars.map((particular: any, idx: number) => ({
        // Ensure a non-empty name gets stored (fallback to common alt field or generic label)
        parameterName: particular?.particularName || particular?.name || `Parameter${idx + 1}`,
        value: ''
      })),
      labResultsValidation: Array(particulars.length).fill(true)
    }));
  };

  // Handle bank selection
  const handleBankChange = (bankName: string) => {
    const bank = banks.find((b: any) => b.bankName === bankName);
    
    if (bank) {
      setBaseForm(f => ({ 
        ...f, 
        bankName: bankName,
        bankBranch: bank.locations?.[0]?.branchName || '',
        bankState: bank.state || '',
        ifscCode: bank.locations?.[0]?.ifscCode || ''
      }));
    } else {
      setBaseForm(f => ({ 
        ...f, 
        bankName: bankName,
        bankBranch: '',
        bankState: '',
        ifscCode: ''
      }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: "Please select a JPG, PNG, PDF, or Excel file.",
          variant: "destructive",
        });
        setFileAttachment(null);
        e.target.value = ''; // Clear the input
      } else {
        setFileAttachment(file);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
    // Prevent submit if reservation or insurance expired
    if (preventInward) {
      // Prefer inlineAlert content when present (matches inline rectangular alert)
      const tTitle = inlineAlert?.title || alertTitle || 'Action Blocked';
      const tDesc = inlineAlert?.message || alertMessage || 'Cannot proceed due to expired reservation or insurance.';
      toast({
        title: tTitle,
        description: tDesc,
        variant: 'destructive'
      });
      return;
    }
    
    // Prevent submit if Total Value exceeds insurance coverage
    if (totalValueExceedsInsurance) {
      const totalValue = parseFloat(baseForm.totalValue) || 0;
      const fireRemaining = parseFloat(initialRemainingFire) || 0;
      const burglaryRemaining = parseFloat(initialRemainingBurglary) || 0;
      
      toast({
        title: "❌ Cannot Submit - Insurance Coverage Exceeded",
        description: `Total Value (₹${totalValue.toLocaleString()}) exceeds the available insurance coverage. Fire Policy: ₹${fireRemaining.toLocaleString()} remaining, Burglary Policy: ₹${burglaryRemaining.toLocaleString()} remaining. Please reduce the quantity or market rate before submitting.`,
        variant: 'destructive'
      });
      return;
    }
    
    // Validate insurance amounts for non-bank-funded insurance
    // Check if total value exceeds EITHER fire OR burglary policy remaining balance
    if (selectedInsuranceForInward) {
      const insuranceType = (selectedInsuranceForInward.insuranceType || selectedInsuranceForInward.insuranceTakenBy || '').toLowerCase();
      const isBankFunded = insuranceType.includes('bank');
      
      console.log('🔍 INSURANCE VALIDATION CHECK:');
      console.log('Insurance Type:', insuranceType);
      console.log('Is Bank Funded:', isBankFunded);
      console.log('Selected Insurance Object:', selectedInsuranceForInward);
      
      if (!isBankFunded) {
        const totalValue = parseFloat(baseForm.totalValue) || 0;
        
        // Use firePolicyRemainingAmount and burglaryPolicyRemainingAmount from insurance master
        const fireRemainingAmount = parseFloat(
          selectedInsuranceForInward.firePolicyRemainingAmount || 
          selectedInsuranceForInward.remainingFirePolicyAmount || 
          selectedInsuranceForInward.firePolicyAmount || 
          '0'
        );
        const burglaryRemainingAmount = parseFloat(
          selectedInsuranceForInward.burglaryPolicyRemainingAmount || 
          selectedInsuranceForInward.remainingBurglaryPolicyAmount || 
          selectedInsuranceForInward.burglaryPolicyAmount || 
          '0'
        );
        
        console.log('Total Value:', totalValue);
        console.log('Fire Remaining Amount:', fireRemainingAmount);
        console.log('Burglary Remaining Amount:', burglaryRemainingAmount);
        console.log('Fire Check (totalValue > fireRemaining):', totalValue > fireRemainingAmount);
        console.log('Burglary Check (totalValue > burglaryRemaining):', totalValue > burglaryRemainingAmount);
        
        // Check if total value exceeds EITHER fire OR burglary policy remaining amount
        if (totalValue > fireRemainingAmount || totalValue > burglaryRemainingAmount) {
          const exceededPolicies = [];
          if (totalValue > fireRemainingAmount) {
            exceededPolicies.push(`Fire Policy Balance (₹${fireRemainingAmount.toLocaleString()})`);
          }
          if (totalValue > burglaryRemainingAmount) {
            exceededPolicies.push(`Burglary Policy Balance (₹${burglaryRemainingAmount.toLocaleString()})`);
          }
          
          console.log('❌ VALIDATION FAILED - Exceeded policies:', exceededPolicies);
          
          toast({
            title: "❌ Cannot Submit - Insurance Balance Exceeded",
            description: `Total Value (₹${totalValue.toLocaleString()}) exceeds ${exceededPolicies.join(' and ')} remaining. Please reduce the quantity or market rate before submitting.`,
            variant: 'destructive',
            duration: 6000
          });
          return;
        } else {
          console.log('✅ VALIDATION PASSED - Total value within limits');
        }
      }
    }
    
    if (!fileAttachment && !isEditMode) {
      alert('Please attach a file.');
      return;
    }

    // Base form validations
    console.log('Validating base form fields:', {
      state: form.state,
      branch: form.branch,
      location: form.location,
      warehouseName: form.warehouseName,
      client: form.client,
      dateOfInward: form.dateOfInward,
      cadNumber: form.cadNumber,
      commodity: form.commodity,
      varietyName: form.varietyName,
      marketRate: form.marketRate,
      totalBags: form.totalBags,
      totalQuantity: form.totalQuantity
    });
    console.log('Base form object:', baseForm);
    console.log('Form object:', form);
    
    const missingBaseFields = [];
    if (!form.state) missingBaseFields.push('State');
    if (!form.branch) missingBaseFields.push('Branch');
    if (!form.location) missingBaseFields.push('Location');
    if (!form.warehouseName) missingBaseFields.push('Warehouse Name');
    if (!form.client) missingBaseFields.push('Client Name');
    if (!form.dateOfInward) missingBaseFields.push('Date of Inward');
    if (!form.cadNumber) missingBaseFields.push('CAD Number');
    if (!form.commodity) missingBaseFields.push('Commodity');
    if (!form.varietyName) missingBaseFields.push('Variety Name');
    if (!form.marketRate) missingBaseFields.push('Market Rate');
    if (!form.totalBags) missingBaseFields.push('Total Bags (in Commodity Info)');
    if (!form.totalQuantity) missingBaseFields.push('Total Quantity (in Commodity Info)');
    // Lab Parameters - Check at whole inward form level
    if (!form.dateOfSampling) missingBaseFields.push('Date of Sampling');
    if (!form.dateOfTesting) missingBaseFields.push('Date of Testing');

    if (missingBaseFields.length > 0) {
      console.log('Missing base fields:', missingBaseFields);
      alert(`Please fill in the following required base fields:\n\n${missingBaseFields.join('\n')}`);
      return;
    }
    
    // Validate reservation selection for non-CM warehouses
    if (form.businessType !== 'cm' && availableReservations.length > 0 && !selectedReservation) {
      alert('Please select a reservation from the available options.');
      return;
    }
    
    // Validate CAD number uniqueness across all inward entries (only for new entries, not edit mode)
    if (!isEditMode && form.cadNumber) {
      const isDuplicateCAD = inwardData.some(entry => 
        entry.cadNumber && entry.cadNumber.toLowerCase() === form.cadNumber.toLowerCase()
      );
      
      if (isDuplicateCAD) {
        alert(`CAD Number "${form.cadNumber}" already exists. Please use a unique CAD number.`);
        return;
      }
    }
    
    console.log('All base form fields are valid');
    
    setIsUploading(true);
    let uploadedFileUrl = '';
    
    try {
      if (fileAttachment) {
        const uploadResult = await uploadToCloudinary(fileAttachment);
        uploadedFileUrl = uploadResult.secure_url;
      } else if (isEditMode && editingRow) {
        uploadedFileUrl = editingRow.attachmentUrl || '';
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('File upload failed. Please try again.');
      setIsUploading(false);
      return;
    }
    setIsUploading(false);

    let allEntries = [...inwardEntries];
    console.log('Current inwardEntries:', inwardEntries.length);
    console.log('Current entry form has data:', !!(currentEntryForm.vehicleNumber || currentEntryForm.getpassNumber));
    console.log('Is edit mode:', isEditMode);
    
    // For edit mode, use ONLY the entries visible in the UI (inwardEntries array)
    if (isEditMode) {
      console.log('Edit mode: Using ONLY visible entries from UI');
      console.log('Base form data:', baseForm);
      console.log('Visible inward entries:', inwardEntries);
      
      // Only use the entries that are visible in the UI (inwardEntries array)
      allEntries = inwardEntries.map((entry, index) => {
        // Create base form data without totalBags and totalQuantity to avoid double counting
        const { totalBags, totalQuantity, ...baseFormWithoutTotals } = baseForm;
        
        // Check if this entry is the currently selected entry being edited
        const isCurrentlyEditing = currentEntryForm.vehicleNumber && 
                                  currentEntryForm.getpassNumber && 
                                  entry.getpassNumber === currentEntryForm.getpassNumber;
        
        let updatedEntry;
        if (isCurrentlyEditing) {
          // Merge current entry form data with existing entry data
          updatedEntry = {
          ...entry,
            ...baseFormWithoutTotals, // Include base form data except totals
            ...currentEntryForm, // Include current entry form data (overwrites existing entry data)
            entryNumber: index + 1
          };
          console.log(`Entry ${index + 1} (currently editing) after merging current form data:`, updatedEntry);
        } else {
          // Just apply base form data to existing entry
          updatedEntry = {
            ...entry,
            ...baseFormWithoutTotals, // Include base form data except totals
          entryNumber: index + 1
        };
        console.log(`Entry ${index + 1} after applying base form:`, updatedEntry);
        }
        
        return updatedEntry;
      });
      
      // In edit mode, ONLY add current entry form if it's a completely NEW entry (not visible in UI)
      // This should be rare in edit mode, but handle it just in case
      const isNewEntry = currentEntryForm.vehicleNumber && 
                        currentEntryForm.getpassNumber && 
                        !inwardEntries.some(entry => entry.getpassNumber === currentEntryForm.getpassNumber) &&
                        !inwardEntries.some(entry => entry.vehicleNumber === currentEntryForm.vehicleNumber);
      
      if (isNewEntry) {
        // Create base form data without totalBags and totalQuantity to avoid double counting
        const { totalBags, totalQuantity, ...baseFormWithoutTotals } = baseForm;
        
        const currentEntry = {
          id: Date.now(),
          ...baseFormWithoutTotals,
          ...currentEntryForm,
          entryNumber: allEntries.length + 1
        };
        console.log('Adding NEW entry form to allEntries in edit mode:', currentEntry);
        allEntries.push(currentEntry);
      } else if (currentEntryForm.vehicleNumber || currentEntryForm.getpassNumber) {
        console.log('Current entry form represents existing entry visible in UI, not adding to allEntries');
      }
    } else {
      // For new entries, add current entry form if it has data
      if (currentEntryForm.vehicleNumber || currentEntryForm.getpassNumber) {
        // Create base form data without totalBags and totalQuantity to avoid double counting
        const { totalBags, totalQuantity, ...baseFormWithoutTotals } = baseForm;
        
        const newEntry = { 
          id: Date.now(), 
          ...baseFormWithoutTotals, 
          ...currentEntryForm, 
          entryNumber: inwardEntries.length + 1 
        };
        console.log('Adding current entry form to allEntries:', newEntry);
        allEntries.push(newEntry);
      }
    }
    
    console.log('Total entries to save:', allEntries.length);
    console.log('Entries before validation:', allEntries.map(entry => ({
      entryNumber: entry.entryNumber,
      totalBags: entry.totalBags,
      vehicleNumber: entry.vehicleNumber,
      getpassNumber: entry.getpassNumber,
      hasBaseFormData: !!(entry.state && entry.branch && entry.location)
    })));
    
    // Enforce in-form uniqueness for Gatepass Number and Weighbridge Slip Number across all entries
    const normalizeKey = (s: any) => (s ?? '').toString().trim().toLowerCase();
    const gatepassCounts = new Map<string, number>();
    const slipCounts = new Map<string, number>();
    
    for (const entry of allEntries) {
      const g = normalizeKey(entry.getpassNumber);
      if (g) gatepassCounts.set(g, (gatepassCounts.get(g) || 0) + 1);
      const s = normalizeKey(entry.weightBridgeSlipNumber);
      if (s) slipCounts.set(s, (slipCounts.get(s) || 0) + 1);
    }
    
    const duplicateGatepasses = Array.from(gatepassCounts.entries()).filter(([, c]) => c > 1).map(([k]) => k);
    const duplicateSlips = Array.from(slipCounts.entries()).filter(([, c]) => c > 1).map(([k]) => k);
    
    if (duplicateGatepasses.length > 0 || duplicateSlips.length > 0) {
      const lines: string[] = [];
      if (duplicateGatepasses.length > 0) {
        lines.push(`Duplicate Gatepass Numbers: ${duplicateGatepasses.join(', ')}`);
      }
      if (duplicateSlips.length > 0) {
        lines.push(`Duplicate Weighbridge Slip Numbers: ${duplicateSlips.join(', ')}`);
      }
      alert(`Duplicate values detected across entries. Please resolve before submitting.\n\n${lines.join('\n')}`);
      return;
    }
    
    // Ensure all entries have their totalBags calculated from their stacks
    allEntries = allEntries.map(entry => {
      if (entry.stacks && Array.isArray(entry.stacks)) {
        const stackBagsSum = entry.stacks.reduce((total: number, stack: { numberOfBags: string }) => {
          return total + (parseInt(stack.numberOfBags) || 0);
        }, 0);
        
        // Only update if the calculated sum differs from current totalBags
        if (stackBagsSum !== (parseInt(entry.totalBags) || 0)) {
          console.log(`Updating entry ${entry.entryNumber} totalBags from ${entry.totalBags} to ${stackBagsSum} based on stacks`);
          return {
            ...entry,
            totalBags: stackBagsSum.toString()
          };
        }
      }
      return entry;
    });
    
    if (allEntries.length === 0 && !isEditMode) {
      alert('Please add at least one inward entry before saving.\n\nClick "Add New Entry" to add your first entry, then click "Submit" when all entries are complete.');
      return;
    }

    // Validate that all entries have the required base form data (after applying base form in edit mode)
    console.log('Validating entries for base form data:', allEntries.length, 'entries');
    for (const entry of allEntries) {
      console.log('Checking entry:', {
        entryNumber: entry.entryNumber,
        state: entry.state,
        branch: entry.branch,
        location: entry.location,
        warehouseName: entry.warehouseName,
        client: entry.client,
        commodity: entry.commodity
      });
      
      if (!entry.state || !entry.branch || !entry.location || !entry.warehouseName || !entry.client || !entry.commodity) {
        console.error('Entry missing base form data:', entry);
        alert('One or more entries are missing required base form data. Please ensure all entries have complete information.');
        return;
      }
    }
    console.log('All entries have required base form data');

    // --- Insurance selection validation ---
    let selectedInsuranceMeta = null;
    let debugSelectedInsurance = null;
    if (selectedInsuranceForInward) {
      debugSelectedInsurance = selectedInsuranceForInward;
      selectedInsuranceMeta = {
        insuranceTakenBy: selectedInsuranceForInward?.insuranceTakenBy,
        insuranceId: selectedInsuranceForInward?.insuranceId,
      };
      console.log('🎯 INSURANCE META (from selectedInsuranceForInward):', {
        insuranceTakenBy: selectedInsuranceForInward?.insuranceTakenBy,
        insuranceId: selectedInsuranceForInward?.insuranceId,
        fullInsurance: selectedInsuranceForInward
      });
    } else if (selectedInsuranceIndex !== null) {
      const ins = insuranceEntries[selectedInsuranceIndex];
      debugSelectedInsurance = ins;
      selectedInsuranceMeta = {
        insuranceTakenBy: ins?.insuranceTakenBy,
        insuranceId: ins?.insuranceId,
      };
      console.log('🎯 INSURANCE META (from insuranceEntries):', {
        index: selectedInsuranceIndex,
        insuranceTakenBy: ins?.insuranceTakenBy,
        insuranceId: ins?.insuranceId,
        fullInsurance: ins
      });
    }
    
    console.log('📋 FINAL selectedInsuranceMeta:', selectedInsuranceMeta);
    console.log('📋 baseForm.insuranceManagedBy:', baseForm.insuranceManagedBy);
    console.log('📋 baseForm.selectedInsurance:', baseForm.selectedInsurance);
    
    // Debug log
    console.log('DEBUG: Selected insurance entry:', debugSelectedInsurance);
    // Insurance validation removed - allowing updates without insurance selection

    // --- Ensure all date fields are strings ---
    allEntries = allEntries.map(entry => ({
      ...entry,
      firePolicyStart: entry.firePolicyStart ? String(entry.firePolicyStart) : '',
      firePolicyEnd: entry.firePolicyEnd ? String(entry.firePolicyEnd) : '',
      burglaryPolicyStart: entry.burglaryPolicyStart ? String(entry.burglaryPolicyStart) : '',
      burglaryPolicyEnd: entry.burglaryPolicyEnd ? String(entry.burglaryPolicyEnd) : '',
    }));

    // Final validation loop for all entries
    console.log('Validating', allEntries.length, 'entries...');
    

    
    for (const entry of allEntries) {
      console.log('Validating entry:', {
        entryNumber: entry.entryNumber,
        vehicleNumber: entry.vehicleNumber,
        getpassNumber: entry.getpassNumber,
        totalBags: entry.totalBags,
        stacks: entry.stacks
      });
      
      const missingFields = [];
      
      // Vehicle and Transport Information
      if (!entry.vehicleNumber) missingFields.push('Vehicle Number');
      if (!entry.getpassNumber) missingFields.push('Gatepass Number');
      
      // Weight Bridge Information
      if (!entry.weightBridge) missingFields.push('Weighbridge Name');
      if (!entry.weightBridgeSlipNumber) missingFields.push('Weighbridge Slip Number');
      
      // Weight Information
      if (!entry.grossWeight) missingFields.push('Gross Weight');
      if (!entry.tareWeight) missingFields.push('Tare Weight');
      if (!entry.netWeight) missingFields.push('Net Weight');
      if (!entry.averageWeight) missingFields.push('Average Weight');
      
      // Quantity Information
      if (!entry.totalBags) missingFields.push('Total Bags (in Inward Entry)');
      if (!entry.totalQuantity) missingFields.push('Total Quantity');
      
      // Note: Base Receipt is intentionally not required as per user requirements
      // Note: Date of Sampling and Date of Testing are now validated at the whole inward form level, not per entry
      
      if (missingFields.length > 0) {
        alert(`Validation Error in Entry #${entry.entryNumber}:\nPlease fill in these required fields: ${missingFields.join(', ')}`);
        return;
      }

      // Validate stacks structure
      if (!entry.stacks || !Array.isArray(entry.stacks)) {
        alert(`Validation Error in Entry #${entry.entryNumber}:\nStacks data is missing or invalid.`);
        return;
      }
    }
    
    // Validate that sum of total bags from all entries matches total bags in Commodity Information
    if (isEditMode) {
      console.log('=== VALIDATION DEBUG ===');
      console.log('Number of visible entries being validated:', allEntries.length);
      console.log('Edit mode: Only validating entries visible in UI');
      
      // Calculate total bags from all entries using their totalBags field
      const entriesTotalBagsSum = allEntries.reduce((sum, entry) => {
        const entryTotalBags = parseInt(entry.totalBags) || 0;
        console.log(`Entry ${entry.entryNumber} (${entry.vehicleNumber}) totalBags:`, entryTotalBags);
        return sum + entryTotalBags;
      }, 0);
      
      const commodityInfoTotalBags = parseInt(baseForm.totalBags) || 0;
      
      console.log('Validation: Visible entries total bags sum:', entriesTotalBagsSum, 'Commodity info total bags:', commodityInfoTotalBags);
      console.log('Visible entries for validation:', allEntries.map(entry => ({
        entryNumber: entry.entryNumber,
        totalBags: entry.totalBags,
        vehicleNumber: entry.vehicleNumber,
        getpassNumber: entry.getpassNumber
      })));
      
      if (entriesTotalBagsSum !== commodityInfoTotalBags) {
        alert(`Validation Error: Total Bags mismatch!\n\nSum of Total Bags from visible entries: ${entriesTotalBagsSum}\nTotal Bags in Commodity Information: ${commodityInfoTotalBags}\n\nPlease ensure these values match.`);
        return;
      }
      
      console.log('=== VALIDATION PASSED ===');
    }
    
    console.log('All entries validated successfully');

    // Save to Firebase
    console.log('Initializing Firebase collection...');
    const inwardCollection = collection(db, 'inward');
    console.log('Firebase collection initialized:', inwardCollection);

    // Normalize Lab Results to always store fetched parameter names (no generic Parameter1...)
  const buildNormalizedLabResults = () => {
      try {
        const commodityObj = commodities.find((c: any) => c.commodityName === baseForm.commodity);
        const varietyObj = commodityObj?.varieties?.find((v: any) => v.varietyName === baseForm.varietyName);
  const particulars = varietyObj?.particulars || [];
        const valuesArray = Array.isArray(currentEntryForm.labResults) ? currentEntryForm.labResults : [];

        // Map by index to ensure the name comes from fetched particulars
        return particulars.map((p: any, idx: number) => {
          const src = valuesArray[idx];
          const value = typeof src === 'object' && src !== null ? (src.value ?? '') : (src ?? '');
          return {
            // prefer explicit particularName, then common alt field 'name', then a generic label
            parameterName: p?.particularName || p?.name || `Parameter${idx + 1}`,
            value: value || ''
          };
        });
      } catch (e) {
        // Fallback to existing shape if anything unexpected occurs
        return currentEntryForm.labResults || [];
      }
    };
    const normalizedLabResults = buildNormalizedLabResults();
    
    if (isEditMode && editingRow) {
        // Update existing document
        console.log('Starting update for editingRow:', editingRow.inwardId);
        const q = query(inwardCollection, where('inwardId', '==', editingRow.inwardId));
        const querySnapshot = await getDocs(q);
        
        console.log('Query result:', querySnapshot.empty ? 'No documents found' : `${querySnapshot.docs.length} documents found`);
        
        if (!querySnapshot.empty) {
          const docRef = doc(db, 'inward', querySnapshot.docs[0].id);
          console.log('Document reference:', docRef.path);
          
          // Check if document exists before updating
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) {
            throw new Error(`Document with ID ${querySnapshot.docs[0].id} does not exist`);
          }
          console.log('Document exists, proceeding with update');
          
          // Process all entries for update
          const processedEntries = allEntries.map((entry, index) => {
            const { id, labResultsValidation, ...entryData } = entry; // remove client-side id and validation state

          // Replace empty string fields with a hyphen
            const sanitizedEntryData = Object.fromEntries(
            Object.entries(entryData).map(([key, value]) => [
              key,
              typeof value === 'string' && value === '' ? '-' : value,
            ])
          );

            // Ensure total bags are calculated from stacks for each entry
            let finalTotalBags = sanitizedEntryData.totalBags;
            if (sanitizedEntryData.stacks && Array.isArray(sanitizedEntryData.stacks)) {
              const stackBagsSum = sanitizedEntryData.stacks.reduce((total: number, stack: { numberOfBags: string }) => {
                return total + (parseInt(stack.numberOfBags) || 0);
              }, 0);
              finalTotalBags = stackBagsSum.toString();
              console.log(`Entry ${index + 1} total bags calculated from stacks:`, finalTotalBags);
            }
            
            return {
              ...sanitizedEntryData,
              entryNumber: index + 1,
              totalBags: finalTotalBags
            };
          });

          console.log('Processed entries for update:', processedEntries);
          console.log('Selected insurance meta:', selectedInsuranceMeta);

          // Clean selectedInsurance to remove undefined values
          const cleanSelectedInsurance = selectedInsuranceMeta ? {
            insuranceTakenBy: selectedInsuranceMeta.insuranceTakenBy || null,
            insuranceId: selectedInsuranceMeta.insuranceId || null,
          } : null;

          // Recalculate total bags and quantities from all entries before saving
          const finalTotalBags = processedEntries.reduce((sum, entry: any) => {
            return sum + (parseInt(entry.totalBags) || 0);
          }, 0);
          
          const finalTotalQuantity = processedEntries.reduce((sum, entry: any) => {
            return sum + (parseFloat(entry.totalQuantity) || 0);
          }, 0);
          
          console.log('Recalculated totals from entries - Total Bags:', finalTotalBags, 'Total Quantity:', finalTotalQuantity);

          // Get the base form data (commodity information) from the baseForm with updated totals
          const baseFormData = {
            state: baseForm.state,
            branch: baseForm.branch,
            location: baseForm.location,
            warehouseName: baseForm.warehouseName,
            warehouseCode: baseForm.warehouseCode,
            warehouseAddress: baseForm.warehouseAddress,
            businessType: baseForm.businessType,
            client: baseForm.client,
            clientCode: baseForm.clientCode,
            clientAddress: baseForm.clientAddress,
            dateOfInward: baseForm.dateOfInward,
            cadNumber: baseForm.cadNumber,
            commodity: baseForm.commodity,
            varietyName: baseForm.varietyName,
            marketRate: baseForm.marketRate,
            // Use the recalculated totals instead of the old baseForm values
            totalBags: finalTotalBags.toString(),
            totalQuantity: finalTotalQuantity.toFixed(3),
            totalValue: baseForm.totalValue,
            // Include insurance fields to prevent them from becoming NaN
            firePolicyAmount: (baseForm.firePolicyAmount || editingRow.firePolicyAmount || '-').toString(),
            burglaryPolicyAmount: (baseForm.burglaryPolicyAmount || editingRow.burglaryPolicyAmount || '-').toString(),
            firePolicyNumber: baseForm.firePolicyNumber || editingRow.firePolicyNumber || '-',
            burglaryPolicyNumber: baseForm.burglaryPolicyNumber || editingRow.burglaryPolicyNumber || '-',
            firePolicyStart: baseForm.firePolicyStart || editingRow.firePolicyStart || '-',
            firePolicyEnd: baseForm.firePolicyEnd || editingRow.firePolicyEnd || '-',
            burglaryPolicyStart: baseForm.burglaryPolicyStart || editingRow.burglaryPolicyStart || '-',
            burglaryPolicyEnd: baseForm.burglaryPolicyEnd || editingRow.burglaryPolicyEnd || '-',
            firePolicyCompanyName: baseForm.firePolicyCompanyName || editingRow.firePolicyCompanyName || '-',
            burglaryPolicyCompanyName: baseForm.burglaryPolicyCompanyName || editingRow.burglaryPolicyCompanyName || '-',
            firePolicyBalance: baseForm.firePolicyBalance || editingRow.firePolicyBalance || '-',
            burglaryPolicyBalance: baseForm.burglaryPolicyBalance || editingRow.burglaryPolicyBalance || '-',
            insuranceManagedBy: baseForm.insuranceManagedBy || editingRow.insuranceManagedBy || '-',
            bankFundedBy: baseForm.bankFundedBy || editingRow.bankFundedBy || '-',
          };

          const updateData = {
            // Base form data (commodity information) with updated totals
            ...baseFormData,
            // All entries as an array
            inwardEntries: processedEntries,
            // Document-level fields
            attachmentUrl: uploadedFileUrl,
            updatedAt: new Date().toISOString(),
            // When updating an inward entry, reset CIR status to Pending so it follows the normal approval flow
            cirStatus: 'Pending',
            // Lab Parameters - stored at document level
            dateOfSampling: baseForm.dateOfSampling || '',
            dateOfTesting: baseForm.dateOfTesting || '',
            labResults: normalizedLabResults,
            // Keep the existing selectedInsurance without changes
            selectedInsurance: editingRow.selectedInsurance || null,
          };

          // Update the baseForm state to reflect the new totals in the UI
          setBaseForm(f => ({
            ...f,
            totalBags: finalTotalBags.toString(),
            totalQuantity: finalTotalQuantity.toFixed(3)
          }));

          console.log('About to update document with data:', updateData);
          console.log('Number of entries being saved:', processedEntries.length);
          console.log('Base form data being saved:', baseFormData);
          console.log('Insurance amounts being saved:', {
            firePolicyAmount: baseFormData.firePolicyAmount,
            burglaryPolicyAmount: baseFormData.burglaryPolicyAmount
          });
          console.log('Final total bags being saved:', finalTotalBags);
          console.log('Final total quantity being saved:', finalTotalQuantity);
          
          await updateDoc(docRef, updateData);
          console.log('Document updated successfully');
          
          toast({
            title: "Success",
            description: "Inward entry updated successfully.",
            variant: "default",
          });
        } else {
          throw new Error(`No document found with inwardId: ${editingRow.inwardId}`);
        }
      } else {
          // Create single document with all entries combined
          console.log('Starting to save', allEntries.length, 'entries as single document to Firebase...');
          
          try {
            let inwardId;
            try {
              inwardId = await generateInwardId();
              console.log('Generated single inward ID:', inwardId);
              
              // Validate the generated inward ID
              if (!inwardId || typeof inwardId !== 'string') {
                throw new Error('Generated inward ID is invalid');
              }
            } catch (idError) {
              console.error('Error generating inward ID, using fallback:', idError);
              inwardId = `INW-${Date.now().toString().slice(-3)}`;
              console.log('Using fallback inward ID:', inwardId);
              
              // Validate the fallback inward ID
              if (!inwardId || typeof inwardId !== 'string') {
                throw new Error('Fallback inward ID generation failed');
              }
            }
            
            // Combine all entries into one document
            const combinedData = {
              // Base form data (same for all entries)
              state: baseForm.state,
              branch: baseForm.branch,
              location: baseForm.location,
              warehouseName: baseForm.warehouseName,
              warehouseCode: baseForm.warehouseCode,
              warehouseAddress: baseForm.warehouseAddress,
              businessType: baseForm.businessType,
              client: baseForm.client,
              clientCode: baseForm.clientCode,
              clientAddress: baseForm.clientAddress,
              dateOfInward: baseForm.dateOfInward,
              cadNumber: baseForm.cadNumber,
              commodity: baseForm.commodity,
              varietyName: baseForm.varietyName,
              marketRate: baseForm.marketRate,
              totalBags: baseForm.totalBags,
              totalQuantity: baseForm.totalQuantity,
              totalValue: baseForm.totalValue,
              bankName: baseForm.bankName,
              bankBranch: baseForm.bankBranch,
              bankState: baseForm.bankState,
              ifscCode: baseForm.ifscCode,
              bankReceipt: baseForm.bankReceipt,
              billingStatus: baseForm.billingStatus,
              reservationRate: baseForm.reservationRate,
              reservationQty: baseForm.reservationQty,
              reservationStart: baseForm.reservationStart,
              reservationEnd: baseForm.reservationEnd,
              billingCycle: baseForm.billingCycle,
              billingType: baseForm.billingType,
              billingRate: baseForm.billingRate,
              insuranceManagedBy: baseForm.insuranceManagedBy,
              firePolicyNumber: baseForm.firePolicyNumber,
              firePolicyAmount: baseForm.firePolicyAmount,
              firePolicyStart: baseForm.firePolicyStart,
              firePolicyEnd: baseForm.firePolicyEnd,
              burglaryPolicyNumber: baseForm.burglaryPolicyNumber,
              burglaryPolicyAmount: baseForm.burglaryPolicyAmount,
              burglaryPolicyStart: baseForm.burglaryPolicyStart,
              burglaryPolicyEnd: baseForm.burglaryPolicyEnd,
              firePolicyCompanyName: baseForm.firePolicyCompanyName,
              burglaryPolicyCompanyName: baseForm.burglaryPolicyCompanyName,
              firePolicyBalance: baseForm.firePolicyBalance,
              burglaryPolicyBalance: baseForm.burglaryPolicyBalance,
              bankFundedBy: baseForm.bankFundedBy,
              
              // Lab Parameters - stored at document level
              dateOfSampling: baseForm.dateOfSampling || '',
              dateOfTesting: baseForm.dateOfTesting || '',
              labResults: normalizedLabResults,
              
              // Combined entries data (without lab parameters)
              inwardEntries: allEntries.map((entry, index) => {
                const { id, labResultsValidation, dateOfSampling, dateOfTesting, labResults, ...entryData } = entry;
                return {
                  entryNumber: index + 1,
                  vehicleNumber: entryData.vehicleNumber,
                  getpassNumber: entryData.getpassNumber,
                  weightBridge: entryData.weightBridge,
                  weightBridgeSlipNumber: entryData.weightBridgeSlipNumber,
                  grossWeight: entryData.grossWeight,
                  tareWeight: entryData.tareWeight,
                  netWeight: entryData.netWeight,
                  averageWeight: entryData.averageWeight,
                  totalBags: entryData.totalBags,
                  totalQuantity: entryData.totalQuantity,
                  stacks: entryData.stacks || [],
                };
              }),
              
              // Document metadata
            attachmentUrl: uploadedFileUrl,
            inwardId,
            createdAt: new Date().toISOString(),
              selectedInsurance: selectedInsuranceMeta ? {
                insuranceTakenBy: selectedInsuranceMeta.insuranceTakenBy || null,
                insuranceId: selectedInsuranceMeta.insuranceId || null,
              } : null,
              status: 'pending',
              
              // Calculate totals from all entries
              totalEntries: allEntries.length,
              totalBagsFromEntries: allEntries.reduce((sum, entry) => sum + (parseInt(entry.totalBags) || 0), 0),
              totalQuantityFromEntries: allEntries.reduce((sum, entry) => sum + (parseFloat(entry.totalQuantity) || 0), 0),
            };

            // Validate that inwardId is properly set
            if (!combinedData.inwardId) {
              throw new Error('Inward ID is not defined. Please try again.');
            }

            console.log('Saving combined document with data:', {
              inwardId: combinedData.inwardId,
              totalEntries: combinedData.totalEntries,
              totalBags: combinedData.totalBagsFromEntries,
              totalQuantity: combinedData.totalQuantityFromEntries
            });

            await addDoc(inwardCollection, combinedData);
            console.log('Successfully saved combined document');
        
        toast({
          title: "Success",
              description: `Successfully saved inward entry with ${allEntries.length} sub-entries and inward ID: ${combinedData.inwardId}`,
          variant: "default",
        });
            setHasPendingEntries(false);
          } catch (saveError: any) {
            console.error('Error during save process:', saveError);
            throw new Error(`Failed to save inward entries: ${saveError.message}`);
          }
      }
      
      // After saving inward entry, update inspection insurance entry (moved inside try-catch)
      try {
    if (selectedInsuranceIndex !== null) {
      const ins = insuranceEntries[selectedInsuranceIndex];
      
      // Check if this is bank-funded insurance - skip amount updates
      const insuranceType = (ins.insuranceTakenBy || '').toLowerCase();
      const isBankFunded = insuranceType === 'bank' || insuranceType === 'bank-funded';
      
      if (!isBankFunded) {
        // Only update amounts for non-bank-funded insurance
        
        // Safely parse amounts to avoid NaN
        const safeParseAmount = (amount: any): string => {
          if (amount === null || amount === undefined || amount === '') return '0.00';
          if (typeof amount === 'string' && (amount === '-' || amount === 'N/A' || amount === 'null' || amount === 'undefined')) return '0.00';
          const parsed = parseFloat(String(amount).replace(/[^\d.-]/g, ''));
          return isNaN(parsed) ? '0.00' : parsed.toFixed(2);
        };
        
        // Get the current total value being processed
        const currentTotalValue = parseFloat(baseForm.totalValue) || 0;
        
    // Get the original (prefer remaining) insurance amounts from the insurance entry
    // If a remaining amount exists on the inspection entry, use that. Otherwise fall back to the full policy amount.
    const originalFireAmount = safeParseAmount(ins.remainingFirePolicyAmount ?? ins.firePolicyAmount);
    const originalBurglaryAmount = safeParseAmount(ins.remainingBurglaryPolicyAmount ?? ins.burglaryPolicyAmount);
        
        // Calculate new remaining amounts
        const newRemainingFire = Math.max(0, parseFloat(originalFireAmount) - currentTotalValue).toFixed(2);
        const newRemainingBurglary = Math.max(0, parseFloat(originalBurglaryAmount) - currentTotalValue).toFixed(2);
      
      console.log('=== FIRST INSURANCE UPDATE DEBUG ===');
      console.log('Original fire amount:', originalFireAmount);
      console.log('Original burglary amount:', originalBurglaryAmount);
      console.log('Current total value:', currentTotalValue);
      console.log('New remaining fire:', newRemainingFire);
      console.log('New remaining burglary:', newRemainingBurglary);
      console.log('=== END FIRST INSURANCE UPDATE DEBUG ===');
      
      // Update Firestore
      const inspectionsCollection = collection(db, 'inspections');
      const q = query(inspectionsCollection, where('warehouseName', '==', form.warehouseName));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const docRef = doc(db, 'inspections', querySnapshot.docs[0].id);
        const inspectionData = querySnapshot.docs[0].data();
        let insuranceList = inspectionData.insuranceEntries || [];
        if (!Array.isArray(insuranceList) && inspectionData.warehouseInspectionData?.insuranceEntries) {
          insuranceList = inspectionData.warehouseInspectionData.insuranceEntries;
        }
        const updatedList = insuranceList.map((i: any) => {
          if (i.firePolicyNumber === ins.firePolicyNumber && i.burglaryPolicyNumber === ins.burglaryPolicyNumber) {
            // Preserve original amounts, only update remaining amounts
            return {
              ...i,
              remainingFirePolicyAmount: newRemainingFire,
              remainingBurglaryPolicyAmount: newRemainingBurglary,
            };
          }
          return i;
        });
        await updateDoc(docRef, { insuranceEntries: updatedList });
      }
      
      // ✅ UPDATE INSURANCE MASTER COLLECTION (for selectedInsuranceIndex path)
      try {
        console.log('🔧 UPDATING INSURANCE MASTER COLLECTION (selectedInsuranceIndex path)');
        
        // Get the selected insurance info
        const selectedInsurance = insuranceEntries[selectedInsuranceIndex];
        const selectedInsuranceId = selectedInsurance?.insuranceId;
        const selectedInsuranceType = (selectedInsurance?.insuranceTakenBy || '').toLowerCase().replace(/\s+/g, '-');
        
        console.log('🔍 Selected insurance:', {
          insuranceId: selectedInsuranceId,
          insuranceTakenBy: selectedInsurance?.insuranceTakenBy,
          insuranceType: selectedInsuranceType
        });
        
        if (!selectedInsuranceId) {
          console.log('⚠️ No insurance ID found, skipping insurance master update');
          // Don't return - just skip this section and continue
        } else {
          const insuranceMasterCollection = collection(db, 'insurance');
          
          // Query by insuranceCode (which matches insuranceId) instead of warehouse/commodity
          const insuranceMasterQuery = query(
            insuranceMasterCollection,
            where('insuranceCode', '==', selectedInsuranceId)
          );
          
          const insuranceMasterSnapshot = await getDocs(insuranceMasterQuery);
          
          console.log('📊 Found insurance records by insuranceCode:', insuranceMasterSnapshot.size);
          
          if (!insuranceMasterSnapshot.empty) {
            const matchingDoc = insuranceMasterSnapshot.docs[0]; // Should be only one with unique insuranceCode
            const insuranceMasterData = matchingDoc.data();
            
            console.log('✅ Found matching insurance:', {
              id: matchingDoc.id,
              insuranceCode: insuranceMasterData.insuranceCode,
              insuranceType: insuranceMasterData.insuranceType,
              clientName: insuranceMasterData.clientName
            });
            
            // Get current used amounts (add to existing used amounts)
            const currentFireUsed = parseFloat(insuranceMasterData.firePolicyUsedAmount || '0');
            const currentBurglaryUsed = parseFloat(insuranceMasterData.burglaryPolicyUsedAmount || '0');
            
            const newFireUsed = currentFireUsed + currentTotalValue;
            const newBurglaryUsed = currentBurglaryUsed + currentTotalValue;
            
            // Calculate remaining amounts
            const totalFireAmount = parseFloat(insuranceMasterData.firePolicyAmount || '0');
            const totalBurglaryAmount = parseFloat(insuranceMasterData.burglaryPolicyAmount || '0');
            
            const newFireRemaining = Math.max(0, totalFireAmount - newFireUsed);
            const newBurglaryRemaining = Math.max(0, totalBurglaryAmount - newBurglaryUsed);
            
            console.log('💰 INSURANCE MASTER DEDUCTION (selectedInsuranceIndex):', {
              insuranceCode: selectedInsuranceId,
              insuranceType: insuranceMasterData.insuranceType,
              totalValueToDeduct: currentTotalValue,
              variety: form.varietyName,
              totalValueToDeduct: currentTotalValue,
              fire: {
                totalAmount: totalFireAmount,
                previousUsed: currentFireUsed,
                newUsed: newFireUsed,
                newRemaining: newFireRemaining
              },
              burglary: {
                totalAmount: totalBurglaryAmount,
                previousUsed: currentBurglaryUsed,
                newUsed: newBurglaryUsed,
                newRemaining: newBurglaryRemaining
              }
            });
            
            // Update the insurance master document
            await updateDoc(doc(db, 'insurance', matchingDoc.id), {
              firePolicyUsedAmount: newFireUsed.toFixed(2),
              firePolicyRemainingAmount: newFireRemaining.toFixed(2),
              burglaryPolicyUsedAmount: newBurglaryUsed.toFixed(2),
              burglaryPolicyRemainingAmount: newBurglaryRemaining.toFixed(2),
              lastUpdated: new Date().toISOString()
            });
            
            console.log('✅ Insurance master collection updated successfully (selectedInsuranceIndex)');
          } else {
            console.log('⚠️ No insurance records found for insuranceCode:', selectedInsuranceId);
          }
        }
      } catch (insuranceMasterError: any) {
        console.error('❌ Error updating insurance master collection:', insuranceMasterError);
        // Don't throw - continue with the rest of the flow
      }
      } // End of if (!isBankFunded) check
    }

    // Also update if insurance is selected in information section
    if (selectedInsuranceForInward) {
      const ins = selectedInsuranceForInward;
      
      // Check if this is bank-funded insurance - skip amount updates
      const insuranceType = (ins.insuranceTakenBy || '').toLowerCase();
      const isBankFunded = insuranceType === 'bank' || insuranceType === 'bank-funded';
      
      if (!isBankFunded) {
        // Only update amounts for non-bank-funded insurance
        
        // Debug logging to understand the insurance structure
        console.log('=== INSURANCE UPDATE DEBUG ===');
        console.log('Selected insurance entry:', ins);
        console.log('Insurance properties:', {
          sourceDocumentId: ins?.sourceDocumentId,
          sourceCollection: ins?.sourceCollection,
          insuranceId: ins?.insuranceId,
          firePolicyNumber: ins?.firePolicyNumber,
          burglaryPolicyNumber: ins?.burglaryPolicyNumber
        });
        console.log('=== END INSURANCE UPDATE DEBUG ===');
        
        // Safely get the remaining amounts from state, with fallback to calculated values
        const safeParseAmount = (amount: any): string => {
          if (amount === null || amount === undefined || amount === '') return '0.00';
          if (typeof amount === 'string' && (amount === '-' || amount === 'N/A' || amount === 'null' || amount === 'undefined')) return '0.00';
          const parsed = parseFloat(String(amount).replace(/[^\d.-]/g, ''));
          return isNaN(parsed) ? '0.00' : parsed.toFixed(2);
        };
        
        // Get the current total value being processed
        const currentTotalValue = parseFloat(baseForm.totalValue) || 0;
        
    // Get the original (prefer remaining) insurance amounts from the insurance entry
    // If a remaining amount exists on the source insurance entry, use that. Otherwise fall back to the full policy amount.
    const originalFireAmount = safeParseAmount(ins.remainingFirePolicyAmount ?? ins.firePolicyAmount);
    const originalBurglaryAmount = safeParseAmount(ins.remainingBurglaryPolicyAmount ?? ins.burglaryPolicyAmount);
        
        // Calculate new remaining amounts
        const newRemainingFire = Math.max(0, parseFloat(originalFireAmount) - currentTotalValue).toFixed(2);
        const newRemainingBurglary = Math.max(0, parseFloat(originalBurglaryAmount) - currentTotalValue).toFixed(2);
      
      console.log('=== INSURANCE AMOUNT CALCULATION DEBUG ===');
      console.log('Original fire amount:', originalFireAmount);
      console.log('Original burglary amount:', originalBurglaryAmount);
      console.log('Current total value:', currentTotalValue);
      console.log('New remaining fire:', newRemainingFire);
      console.log('New remaining burglary:', newRemainingBurglary);
      console.log('=== END INSURANCE AMOUNT CALCULATION DEBUG ===');
      
      // Update source collections (clients or agrogreen) based on sourceDocumentId and insuranceId
      if (ins && validateInsuranceEntry(ins) && ins.sourceDocumentId && ins.insuranceId && ins.sourceCollection) {
          if (ins.sourceCollection === 'clients') {
            // Update client insurance
              const clientDocRef = doc(db, 'clients', ins.sourceDocumentId);
              const clientDocSnap = await getDoc(clientDocRef);
              
              if (clientDocSnap.exists()) {
                const clientData = clientDocSnap.data() as any;
                const insurances = clientData.insurances || [];
                
                // Find and update the specific insurance
                const updatedInsurances = insurances.map((insurance: any) => {
                  if (insurance.insuranceId === ins.insuranceId) {
                    return {
                      ...insurance,
                      // Preserve original amounts, only update remaining amounts
                      remainingFirePolicyAmount: newRemainingFire,
                      remainingBurglaryPolicyAmount: newRemainingBurglary,
                    };
                  }
                  return insurance;
                });
                
                await updateDoc(clientDocRef, {
                  insurances: updatedInsurances
                });
            }
          } else if (ins.sourceCollection === 'agrogreen') {
            // Update Agrogreen insurance
              const agrogreenDocRef = doc(db, 'agrogreen', ins.sourceDocumentId);
              const agrogreenDocSnap = await getDoc(agrogreenDocRef);
              
              if (agrogreenDocSnap.exists()) {
                await updateDoc(agrogreenDocRef, {
                  // Preserve original amounts, only update remaining amounts
                  remainingFirePolicyAmount: newRemainingFire,
                  remainingBurglaryPolicyAmount: newRemainingBurglary,
                });
              }
        }
      } else {
        // Fallback: If no sourceDocumentId or sourceCollection, only update the inspection entry
        console.log('No sourceDocumentId or sourceCollection found, updating only inspection entry');
        console.log('Insurance entry validation failed:', {
          hasInsurance: !!ins,
          hasSourceProperties: ins ? !!(ins.sourceDocumentId && ins.insuranceId && ins.sourceCollection) : false,
          sourceDocumentId: ins?.sourceDocumentId,
          sourceCollection: ins?.sourceCollection,
          insuranceId: ins?.insuranceId
        });
      }
      
      // Update Firestore inspection entry as well (always do this)
      if (ins) {
        const inspectionsCollection = collection(db, 'inspections');
        const q = query(inspectionsCollection, where('warehouseName', '==', form.warehouseName));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docRef = doc(db, 'inspections', querySnapshot.docs[0].id);
          const inspectionData = querySnapshot.docs[0].data();
          let insuranceList = inspectionData.insuranceEntries || [];
          if (!Array.isArray(insuranceList) && inspectionData.warehouseInspectionData?.insuranceEntries) {
            insuranceList = inspectionData.warehouseInspectionData.insuranceEntries;
          }
          const updatedList = insuranceList.map((i: any) => {
            if (i.firePolicyNumber === ins.firePolicyNumber && i.burglaryPolicyNumber === ins.burglaryPolicyNumber) {
              return {
                ...i,
                remainingFirePolicyAmount: newRemainingFire,
                remainingBurglaryPolicyAmount: newRemainingBurglary,
              };
            }
            return i;
          });
          await updateDoc(docRef, { insuranceEntries: updatedList });
        }
      }

      // ✅ UPDATE INSURANCE MASTER COLLECTION
      // Update the insurance master collection with deducted amounts
      try {
        console.log('🔧 UPDATING INSURANCE MASTER COLLECTION (selectedInsuranceForInward path)');
        
        // Get the selected insurance info
        const selectedInsurance = selectedInsuranceForInward;
        const selectedInsuranceId = selectedInsurance?.insuranceId;
        const selectedInsuranceType = (selectedInsurance?.insuranceTakenBy || '').toLowerCase().replace(/\s+/g, '-');
        
        console.log('🔍 Selected insurance:', {
          insuranceId: selectedInsuranceId,
          insuranceTakenBy: selectedInsurance?.insuranceTakenBy,
          insuranceType: selectedInsuranceType
        });
        
        if (!selectedInsuranceId) {
          console.log('⚠️ No insurance ID found, skipping insurance master update');
          // Don't return - just skip this section and continue
        } else {
          const insuranceMasterCollection = collection(db, 'insurance');
          
          // Query by insuranceCode (which matches insuranceId) instead of warehouse/commodity
          const insuranceMasterQuery = query(
            insuranceMasterCollection,
            where('insuranceCode', '==', selectedInsuranceId)
          );
          
          const insuranceMasterSnapshot = await getDocs(insuranceMasterQuery);
          
          console.log('📊 Found insurance records by insuranceCode:', insuranceMasterSnapshot.size);
          
          if (!insuranceMasterSnapshot.empty) {
            const matchingDoc = insuranceMasterSnapshot.docs[0]; // Should be only one with unique insuranceCode
            const insuranceMasterData = matchingDoc.data();
            
            console.log('✅ Found matching insurance:', {
              id: matchingDoc.id,
              insuranceCode: insuranceMasterData.insuranceCode,
              insuranceType: insuranceMasterData.insuranceType,
              clientName: insuranceMasterData.clientName
            });
            
            // Get current total value to deduct
            const totalValueToDeduct = parseFloat(baseForm.totalValue) || 0;
            
            // Calculate current used amounts (add to existing used amounts)
            const currentFireUsed = parseFloat(insuranceMasterData.firePolicyUsedAmount || '0');
            const currentBurglaryUsed = parseFloat(insuranceMasterData.burglaryPolicyUsedAmount || '0');
            
            const newFireUsed = currentFireUsed + totalValueToDeduct;
            const newBurglaryUsed = currentBurglaryUsed + totalValueToDeduct;
            
            // Calculate remaining amounts
            const totalFireAmount = parseFloat(insuranceMasterData.firePolicyAmount || '0');
            const totalBurglaryAmount = parseFloat(insuranceMasterData.burglaryPolicyAmount || '0');
            
            const newFireRemaining = Math.max(0, totalFireAmount - newFireUsed);
            const newBurglaryRemaining = Math.max(0, totalBurglaryAmount - newBurglaryUsed);
            
            console.log('💰 INSURANCE MASTER DEDUCTION (selectedInsuranceInfoIndex):', {
              insuranceCode: selectedInsuranceId,
              insuranceType: insuranceMasterData.insuranceType,
              totalValueToDeduct,
            firePolicyAmounts: {
              total: totalFireAmount,
              previousUsed: currentFireUsed,
              newUsed: newFireUsed,
              newRemaining: newFireRemaining
            },
            burglaryPolicyAmounts: {
              total: totalBurglaryAmount,
              previousUsed: currentBurglaryUsed,
              newUsed: newBurglaryUsed,
              newRemaining: newBurglaryRemaining
            }
          });
          
          // Update the insurance master record with new amounts
          await updateDoc(doc(db, 'insurance', matchingDoc.id), {
            firePolicyUsedAmount: newFireUsed.toString(),
            firePolicyRemainingAmount: newFireRemaining.toString(),
            burglaryPolicyUsedAmount: newBurglaryUsed.toString(),
            burglaryPolicyRemainingAmount: newBurglaryRemaining.toString(),
            updatedAt: new Date().toISOString()
          });
          
          console.log('✅ Successfully updated insurance master record');
          } else {
            console.log('❌ No matching insurance record found');
          }
        }
      } catch (error) {
        console.error('❌ Error updating insurance master collection:', error);
      }
      } // End of if (!isBankFunded) check for selectedInsuranceInfoIndex
    }
      
      handleModalClose();
      setDataVersion(v => v + 1);
      dispatchDataUpdate(); // Notify other modules of data changes
      
      // Refresh insurance data to show updated amounts
      await refreshInsuranceData();
    } catch (saveError) {
      // If save operations fail, rethrow to outer catch
      throw saveError;
    }
    } catch (error: any) {
      console.error('Error saving inward entries to Firebase:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack
      });
      
      // More specific error messages based on error type
      let errorMessage = "Error saving inward entries to Firebase. Please try again.";
      
      if (error?.code === 'permission-denied') {
        errorMessage = "Permission denied. Please check your authentication.";
      } else if (error?.code === 'unavailable') {
        errorMessage = "Firebase service is temporarily unavailable. Please try again.";
      } else if (error?.code === 'not-found') {
        errorMessage = "Document not found. Please refresh and try again.";
      } else if (error?.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setBaseForm({
      state: '',
      branch: '',
      location: '',
      warehouseName: '',
      warehouseCode: '',
      warehouseAddress: '',
      businessType: '',
      client: '',
      clientCode: '',
      clientAddress: '',
      dateOfInward: '',
      cadNumber: '',
      attachmentUrl: '',
      commodity: '',
      varietyName: '',
      marketRate: '',
      totalBags: '',
      totalQuantity: '',
      totalValue: '',
      bankName: '',
      bankBranch: '',
      bankState: '',
      ifscCode: '',
      bankReceipt: '',
      billingStatus: '',
      reservationRate: '',
      reservationQty: '',
      reservationStart: '',
      reservationEnd: '',
      billingCycle: '',
      billingType: '',
      billingRate: '',
      insuranceManagedBy: '',
      firePolicyNumber: '',
      firePolicyAmount: '',
      firePolicyStart: '',
      firePolicyEnd: '',
      burglaryPolicyNumber: '',
      burglaryPolicyAmount: '',
      burglaryPolicyStart: '',
      burglaryPolicyEnd: '',
      firePolicyCompanyName: '',
      burglaryPolicyCompanyName: '',
      firePolicyBalance: '',
      burglaryPolicyBalance: '',
      bankFundedBy: '',
    });
    
    setCurrentEntryForm({
      vehicleNumber: '',
      getpassNumber: '',
      weightBridge: '',
      weightBridgeSlipNumber: '',
      grossWeight: '',
      tareWeight: '',
      netWeight: '',
      averageWeight: '',
      totalBags: '',
      totalQuantity: '',
      dateOfSampling: '',
      dateOfTesting: '',
      labResults: [],
      labResultsValidation: [],
      stacks: [
        {
          stackNumber: '',
          numberOfBags: ''
        }
      ],
    });
    setFileAttachment(null);
    setSelectedInsuranceType('all');
    setSelectedInsuranceIndex(null);
    setSelectedInsuranceForInward(null);
    setRemainingFirePolicy('');
    setRemainingBurglaryPolicy('');
    setInitialRemainingFire('');
    setInitialRemainingBurglary('');
    setInsuranceEntries([]);
    setInwardEntries([]);
    setCurrentEntryIndex(0);
    setIsUploading(false);
    setHasPendingEntries(false);
    setRemarks('');
    // Clear reservation-related state
    setAvailableReservations([]);
    setSelectedReservation(null);
  };

  const handleModalClose = () => {
    setShowAddModal(false);
    setIsEditMode(false);
    setEditingRow(null);
    resetForm();
    setRemarks('');
    setHologramNumber('');
    setSrGenerationDate('');
    setIsFormApproved(false);
  };

  // Calculate net weight when gross or tare weight changes
  const calculateNetWeight = (gross: string, tare: string) => {
    const grossNum = parseFloat(gross) || 0;
    const tareNum = parseFloat(tare) || 0;
    const net = grossNum - tareNum;
    return net >= 0 ? net.toFixed(3) : '0.000';
  };

  // Auto-calculate Average Weight for the current inward entry
  useEffect(() => {
    const netWeight = parseFloat(currentEntryForm.netWeight) || 0;
    const totalBags = parseInt(currentEntryForm.totalBags, 10) || 0;

    if (netWeight > 0 && totalBags > 0) {
      const avgWeight = (netWeight / totalBags) * 1000; // Convert MT/bag to Kg/bag
      setCurrentEntryForm(f => ({ ...f, averageWeight: avgWeight.toFixed(2) }));
    } else {
      setCurrentEntryForm(f => ({ ...f, averageWeight: '' }));
    }
  }, [currentEntryForm.netWeight, currentEntryForm.totalBags]);

  // Handle gross weight change
  const handleGrossWeightChange = (value: string) => {
    setCurrentEntryForm(f => ({
      ...f,
      grossWeight: value,
      netWeight: calculateNetWeight(value, f.tareWeight)
    }));
  };

  // Handle tare weight change
  const handleTareWeightChange = (value: string) => {
    // Allow empty value
    if (value === '') {
      setCurrentEntryForm(f => ({
        ...f,
        tareWeight: '',
        netWeight: calculateNetWeight(f.grossWeight, '')
      }));
      return;
    }

    // Parse numbers and clamp tare to gross if necessary
    const parsedValue = parseFloat(value);
    const grossNum = parseFloat(currentEntryForm.grossWeight) || 0;

    if (isNaN(parsedValue)) {
      // If not a number, ignore the change
      return;
    }

    const clamped = parsedValue > grossNum ? grossNum : parsedValue;
    const clampedStr = clamped.toString();

    setCurrentEntryForm(f => ({
      ...f,
      tareWeight: clampedStr,
      netWeight: calculateNetWeight(f.grossWeight, clampedStr)
    }));
  };

  // Handle net weight change (for manual updates)
  const handleNetWeightChange = (value: string) => {
    setCurrentEntryForm(f => ({
      ...f,
      netWeight: value,
      averageWeight: calculateAverageWeight(value, f.totalBags)
    }));
  };

  // Handle total bags change (for manual updates)
  const handleTotalBagsChange = (value: string) => {
    setCurrentEntryForm(f => ({
      ...f,
      totalBags: value,
      averageWeight: calculateAverageWeight(f.netWeight, value)
    }));
    
    // Recalculate total bags in Commodity Information when current entry form changes
    setTimeout(() => {
      recalculateTotalBags();
    }, 0);
  };

  // Add new stack
  const addStack = () => {
    setCurrentEntryForm(f => {
      const updatedStacks = [...f.stacks, { stackNumber: '', numberOfBags: '' }];
      
      return {
        ...f,
        stacks: updatedStacks
        // Don't auto-update totalBags - let user enter it manually
      };
    });
    
    // Recalculate total bags in Commodity Information when current entry form changes
    setTimeout(() => {
      recalculateTotalBags();
    }, 0);
  };

  // Update stack
  const updateStack = (index: number, field: string, value: string) => {
    setCurrentEntryForm(f => {
      const updatedStacks = f.stacks.map((stack, i) => 
        i === index ? { ...stack, [field]: value } : stack
      );
      
      return {
        ...f,
        stacks: updatedStacks
        // Don't auto-update totalBags - let user enter it manually
      };
    });
  };

  // Remove stack
  const removeStack = (index: number) => {
    setCurrentEntryForm(f => {
      const updatedStacks = f.stacks.filter((_, i) => i !== index);
      
      return {
        ...f,
        stacks: updatedStacks
        // Don't auto-update totalBags - let user enter it manually
      };
    });
  };

  // Calculate total bags from stacks
  const calculateTotalBagsFromStacks = () => {
    return currentEntryForm.stacks.reduce((total: number, stack: { numberOfBags: string }) => {
      return total + (parseInt(stack.numberOfBags) || 0);
    }, 0);
  };

  // Validate stack bags match total bags for current entry form
  const validateStackBags = () => {
    const stackTotal = calculateTotalBagsFromStacks();
    return stackTotal === (parseInt(currentEntryForm.totalBags) || 0);
  };

  // Validate stack bags match total bags for a specific entry in edit mode
  const validateEntryStackBags = (entry: any) => {
    if (!entry.stacks || !Array.isArray(entry.stacks)) return false;
    const stackTotal = entry.stacks.reduce((total: number, stack: { numberOfBags: string }) => {
      return total + (parseInt(stack.numberOfBags) || 0);
    }, 0);
    return stackTotal === (parseInt(entry.totalBags) || 0);
  };

  // Simple function to recalculate total bags in Commodity Information
  const recalculateTotalBags = () => {
    if (isEditMode) {
      // In edit mode, calculate total bags only from visible inward entries
      let totalBagsSum = inwardEntries.reduce((sum, entry) => {
        return sum + (parseInt(entry.totalBags) || 0);
      }, 0);
      
      console.log('Edit mode - Recalculated total bags sum from visible entries:', totalBagsSum);
      
      setBaseForm(f => ({
        ...f,
        totalBags: totalBagsSum.toString()
      }));
    } else {
      // For new entries, sum from already saved entries + current entry form
      let totalBagsSum = inwardEntries.reduce((sum, entry) => {
        return sum + (parseInt(entry.totalBags) || 0);
      }, 0);
      
      // Add current entry form data if it has a valid total bags value
      if (currentEntryForm.totalBags && parseInt(currentEntryForm.totalBags) > 0) {
        totalBagsSum += parseInt(currentEntryForm.totalBags) || 0;
        console.log('Adding current entry form totalBags to sum:', currentEntryForm.totalBags);
      }
      
      console.log('New entry mode - Recalculated total bags sum:', totalBagsSum);
      
      setBaseForm(f => ({
        ...f,
        totalBags: totalBagsSum.toString()
      }));
    }
  };

  // Add new inward entry
  const addNewInwardEntry = () => {
    // Check if inward is prevented due to expired reservation or insurance
    if (preventInward) {
      const tTitle = inlineAlert?.title || alertTitle || 'Action Blocked';
      const tDesc = inlineAlert?.message || alertMessage || 'Cannot proceed due to expired reservation or insurance.';
      toast({
        title: tTitle,
        description: tDesc,
        variant: 'destructive'
      });
      return;
    }

    if (!validateStackBags()) {
      alert('Total bags must equal the sum of all stack bags. Please check your entries.');
      return;
    }
    
    // Validate required fields for current entry and collect missing fields
    const missingFields = [];
    if (!currentEntryForm.vehicleNumber) missingFields.push('Vehicle Number');
    if (!currentEntryForm.getpassNumber) missingFields.push('Gatepass Number');
    if (!currentEntryForm.weightBridge) missingFields.push('Weight Bridge');
    if (!currentEntryForm.weightBridgeSlipNumber) missingFields.push('Weight Bridge Slip Number');
    if (!currentEntryForm.grossWeight) missingFields.push('Gross Weight');
    if (!currentEntryForm.tareWeight) missingFields.push('Tare Weight');

    if (missingFields.length > 0) {
      alert(`Please fill in the following required fields:\n\n${missingFields.join('\n')}`);
      return;
    }

    // Normalize comparison for duplicates (trim + case-insensitive)
    const normalizeKey = (s: any) => (s ?? '').toString().trim().toLowerCase();

    // Validate getpass number uniqueness across in-form entries
    const isGetpassDuplicate = inwardEntries.some(entry => 
      normalizeKey(entry.getpassNumber) === normalizeKey(currentEntryForm.getpassNumber)
    );
    
    if (isGetpassDuplicate) {
      alert('Gatepass number must be unique. This gatepass number has already been used in a previous entry.');
      return;
    }

    // Validate Weighbridge Slip Number uniqueness across in-form entries
    const isSlipDuplicate = inwardEntries.some(entry => 
      normalizeKey(entry.weightBridgeSlipNumber) === normalizeKey(currentEntryForm.weightBridgeSlipNumber)
    );

    if (isSlipDuplicate) {
      alert('Weighbridge slip number must be unique across all entries. This slip number is already used in a previous entry.');
      return;
    }

    // Validate stack entries
    const missingStackFields = [];
    for (let i = 0; i < currentEntryForm.stacks.length; i++) {
      const stack = currentEntryForm.stacks[i];
      if (!stack.stackNumber) missingStackFields.push(`Stack ${i + 1} - Stack Number`);
      if (!stack.numberOfBags) missingStackFields.push(`Stack ${i + 1} - Number of Bags`);
    }
    
    if (missingStackFields.length > 0) {
      alert(`Please fill in the following stack fields:\n\n${missingStackFields.join('\n')}`);
      return;
    }
    
    // Add current entry to inwardEntries array (without generating inward ID yet)
    const { dateOfSampling, dateOfTesting, labResults, labResultsValidation, ...entryData } = currentEntryForm;
    
    // Create base form data without totalBags and totalQuantity to avoid double counting
    const { totalBags, totalQuantity, ...baseFormWithoutTotals } = baseForm;
    
    const newEntry = {
      id: Date.now(),
      ...baseFormWithoutTotals,
      ...entryData,
      entryNumber: inwardEntries.length + 1
    };

    const updatedEntries = [...inwardEntries, newEntry];
    
    setInwardEntries(updatedEntries);
    
    // Recalculate total bags in Commodity Information
    setTimeout(() => {
      recalculateTotalBags();
    }, 0);
    setHasPendingEntries(true);
    
    // Reset only the current entry form for new entry (lab parameters now in baseForm)
    setCurrentEntryForm({
      vehicleNumber: '',
      getpassNumber: '',
      weightBridge: '',
      weightBridgeSlipNumber: '',
      grossWeight: '',
      tareWeight: '',
      netWeight: '',
      averageWeight: '',
      totalBags: '',
      totalQuantity: '',
      // Lab parameters moved to baseForm, only keep labResults per entry
      labResults: currentEntryForm.labResults || [],
      labResultsValidation: currentEntryForm.labResultsValidation || [],
      stacks: [
        {
          stackNumber: '',
          numberOfBags: ''
        }
      ],
    });
    
    toast({
      title: "Entry Saved Successfully",
      description: `Entry ${newEntry.entryNumber} has been saved. You can now add a new entry or click Submit when all entries are complete.`,
      variant: "default",
    });
  };

  // Auto-calculate Total Value
  useEffect(() => {
    if (baseForm.totalQuantity && baseForm.marketRate) {
      const totalValue = (parseFloat(baseForm.totalQuantity) * parseFloat(baseForm.marketRate)).toFixed(2);
      setBaseForm(f => ({ ...f, totalValue }));
    } else {
      setBaseForm(f => ({ ...f, totalValue: '' }));
    }
  }, [baseForm.totalQuantity, baseForm.marketRate]);

  // Validate Total Value against insurance remaining amounts (real-time)
  useEffect(() => {
    const totalValue = parseFloat(baseForm.totalValue) || 0;
    
    // Skip validation for bank-funded insurance (no fixed amount limit)
    if (isBankFundedInsurance) {
      setTotalValueExceedsInsurance(false);
      return;
    }
    
    // Only validate if total value exists and insurance is selected
    if (totalValue > 0 && (initialRemainingFire || initialRemainingBurglary)) {
      const fireRemaining = parseFloat(initialRemainingFire) || 0;
      const burglaryRemaining = parseFloat(initialRemainingBurglary) || 0;

      // Validate: Total Value must be <= remaining Fire AND <= remaining Burglary
      if (totalValue > fireRemaining || totalValue > burglaryRemaining) {
        setTotalValueExceedsInsurance(true);
        
        // Show toast error
        const exceededPolicies = [];
        if (totalValue > fireRemaining) {
          exceededPolicies.push(`Fire Policy (₹${fireRemaining.toLocaleString()} remaining)`);
        }
        if (totalValue > burglaryRemaining) {
          exceededPolicies.push(`Burglary Policy (₹${burglaryRemaining.toLocaleString()} remaining)`);
        }
        
        toast({
          title: "⚠️ Total Value Exceeds Insurance Coverage",
          description: `Total Value (₹${totalValue.toLocaleString()}) exceeds the remaining amount in: ${exceededPolicies.join(' and ')}. Please reduce the quantity or market rate.`,
          variant: "destructive",
        });
      } else {
        setTotalValueExceedsInsurance(false);
      }
    } else {
      setTotalValueExceedsInsurance(false);
    }
  }, [baseForm.totalValue, initialRemainingFire, initialRemainingBurglary, isBankFundedInsurance]);

  const calculateAverageWeight = (netWeight: string, totalBags: string) => {
    const net = parseFloat(netWeight) || 0;
    const bags = parseInt(totalBags) || 0;
    if (bags > 0) {
      return ((net / bags) * 1000).toFixed(2);
    }
    return '0.00';
  };

  // Columns are static for this table; the cell renderers call handlers that are defined later in
  // the component. The handlers are declared as function declarations (hoisted) so it's safe to
  // include them in the dependency list — include them so ESLint won't warn.
  const columns = useMemo(() => [
    { accessorKey: "inwardId", header: "Inward Code" },
    { accessorKey: "dateOfInward", header: "Date of Inward" },
    { accessorKey: "state", header: "State" },
    { accessorKey: "branch", header: "Branch" },
    { accessorKey: "location", header: "Location" },
    { accessorKey: "warehouseName", header: "Warehouse Name" },
    { accessorKey: "warehouseCode", header: "Warehouse Code" },
    { accessorKey: "warehouseAddress", header: "Warehouse Address" },
    { accessorKey: "receiptType", header: "Receipt Type" },
    { accessorKey: "client", header: "Client" },
    { accessorKey: "clientCode", header: "Client Code" },
    { accessorKey: "clientAddress", header: "Client Address" },
    { accessorKey: "commodity", header: "Commodity" },
    { accessorKey: "varietyName", header: "Variety" },
    { accessorKey: "totalBags", header: "Total Bags" },
    { accessorKey: "totalQuantity", header: "Total Quantity (MT)" },
    { accessorKey: "marketRate", header: "Market Rate" },
    { accessorKey: "totalValue", header: "Total Value" },
    { accessorKey: "grossWeight", header: "Gross Weight" },
    { accessorKey: "tareWeight", header: "Tare Weight" },
    { accessorKey: "netWeight", header: "Net Weight" },
    { accessorKey: "averageWeight", header: "Avg. Weight" },
    { accessorKey: "vehicleNumber", header: "Vehicle No." },
    { accessorKey: "getpassNumber", header: "Gatepass No." },
    { accessorKey: "weightBridge", header: "Weight Bridge" },
    { accessorKey: "weightBridgeSlipNumber", header: "Slip No." },
    { accessorKey: "cadNumber", header: "CAD Number" },
    { 
      accessorKey: "stacks",
      header: "Stack No(s)",
      cell: ({ row }: any) => {
        const stacks = row.original.stacks;
        return Array.isArray(stacks) ? stacks.map((s: any) => s.stackNumber).join(', ') : '';
      }
    },
    // Lab details
    { accessorKey: "dateOfSampling", header: "Sampling Date" },
    { accessorKey: "dateOfTesting", header: "Testing Date" },
    { 
      accessorKey: "labResults",
      header: "Lab Results (%)",
      cell: ({ row }: any) => {
        const results = row.original.labResults;
        if (Array.isArray(results)) {
          return results.map((result: any) => {
            if (typeof result === 'object' && result.parameterName && result.value) {
              return `${result.parameterName}-${result.value}`;
            }
            return typeof result === 'object' ? JSON.stringify(result) : String(result);
          }).join(', ');
        }
        return '';
      }
    },
    // Business and Billing
    { accessorKey: "businessType", header: "Business Type" },
    { accessorKey: "billingCycle", header: "Billing Cycle" },
    { accessorKey: "billingType", header: "Billing Type" },
    { accessorKey: "billingRate", header: "Billing Rate" },
    { accessorKey: "reservationRate", header: "Reservation Rate" },
    { accessorKey: "reservationQty", header: "Reservation Qty" },
    { accessorKey: "reservationStart", header: "Reservation Start" },
    { accessorKey: "reservationEnd", header: "Reservation End" },
    // Bank details
    { accessorKey: "bankName", header: "Bank Name" },
    { accessorKey: "bankBranch", header: "Bank Branch" },
    { accessorKey: "bankState", header: "Bank State" },
    { accessorKey: "ifscCode", header: "IFSC Code" },
    { accessorKey: "bankReceipt", header: "Base Receipt" },
    // Insurance details
    { 
      accessorKey: "selectedInsurance", 
      header: "Insurance Managed By",
      cell: ({ row }: any) => {
        const selectedInsurance = row.original.selectedInsurance;
        if (selectedInsurance && selectedInsurance.insuranceTakenBy) {
          return selectedInsurance.insuranceTakenBy;
        }
        return row.original.insuranceManagedBy || '-';
      }
    },
    { accessorKey: "firePolicyAmount", header: "Fire Policy Amount" },
    { accessorKey: "burglaryPolicyAmount", header: "Burglary Policy Amount" },
    { accessorKey: "firePolicyStartDate", header: "Fire Policy Start Date" },
    { accessorKey: "firePolicyEndDate", header: "Fire Policy End Date" },
    { accessorKey: "burglaryPolicyStartDate", header: "Burglary Policy Start Date" },
    { accessorKey: "burglaryPolicyEndDate", header: "Burglary Policy End Date" },
    { accessorKey: "firePolicyName", header: "Fire Policy Name" },
    { accessorKey: "burglaryPolicyName", header: "Burglary Policy Name" },
    { 
      accessorKey: "bankFundedBy", 
      header: "Bank Funded By",
      cell: ({ row }: any) => {
        const insuranceTakenBy = row.original.selectedInsurance?.insuranceTakenBy || row.original.insuranceManagedBy || '';
        const isBankFunded = insuranceTakenBy.toLowerCase() === 'bank' || insuranceTakenBy.toLowerCase() === 'bank-funded';
        
        if (isBankFunded) {
          return row.original.bankName || row.original.bankFundedBy || '-';
        }
        return '-';
      }
    },
    // Add CIR Status column
    {
      accessorKey: 'cirStatus',
      header: 'CIR Status',
      cell: ({ row }: any) => {
        const cirStatus = row.original.cirStatus || 'Pending';
        const normalizedStatusText = normalizeStatusText(cirStatus);
        const statusClass = getStatusStyling(cirStatus);
        
        return (
          <div className="flex items-center space-x-2 justify-center">
            <span className={statusClass}>{normalizedStatusText}</span>
            <Button
              onClick={() => handleCIRView(row.original)}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-green-600 hover:text-green-800 hover:bg-green-50"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        );
      }
    },
    {
      accessorKey: 'srwrStatus',
      header: 'SR/WR Status',
      cell: ({ row }: any) => {
        const cirStatus = row.original.cirStatus || 'Pending';
        
        // If CIR is not approved, show "-"
        if (normalizeStatusText(cirStatus) !== 'Approved') {
          return <span>-</span>;
        }
        
        // If CIR is approved, show the SR/WR status
        const status = row.original.status || 'pending';
        const normalizedStatusText = normalizeStatusText(status);
        const statusClass = getStatusStyling(status);
        
        return (
          <div className="flex items-center space-x-2 justify-center">
            <span className={statusClass}>{normalizedStatusText}</span>
            <Button
              onClick={() => handleViewSR(row.original)}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-green-600 hover:text-green-800 hover:bg-green-50"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        );
      }
    },
    { 
      accessorKey: "expand", 
      header: "Expand",
      cell: ({ row }: any) => {
        const totalEntries = row.original.totalEntries;
        if (totalEntries && totalEntries > 1) {
          return (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExpandEntries(row.original)}
              className="text-blue-600 border-blue-300 hover:bg-blue-50"
            >
              View {totalEntries} Entries
            </Button>
          );
        }
        return '-';
      }
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: ({ row }: any) => (
        <div className="flex space-x-2">
          <Button
            onClick={() => handleViewAttachment(row.original)}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-amber-600 hover:text-amber-800 hover:bg-amber-50"
            title="View uploaded attachment"
          >
            <Info className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => handleViewSR(row.original)}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-green-600 hover:text-green-800 hover:bg-green-50"
            title={canViewStorageReceipt() ? "View Storage/Warehouse Receipt" : "No permission to view receipts"}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {canEditInwardEntry() ? (
            <Button
              onClick={() => handleEdit(row.original)}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
              title="Edit inward entry"
            >
              <Edit className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-gray-400 cursor-not-allowed opacity-50"
              disabled
              title={userRole === 'checker' ? "Checkers cannot edit inward entries" : "No permission to edit entries"}
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {canEditInwardEntry() ? (
            <Button
              onClick={() => handleDelete(row.original)}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
              title="Delete inward entry"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-gray-400 cursor-not-allowed opacity-50"
              disabled
              title={userRole === 'checker' ? "Checkers cannot delete inward entries" : "No permission to delete entries"}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ], []); // eslint-disable-line react-hooks/exhaustive-deps

  // Note: Sorting state and filteredData are defined earlier in the file; avoid duplicate declarations.

  const handleExportCSV = () => {
    const dataToExport = filteredData;
    if (dataToExport.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There is no data available to export.",
        variant: "destructive",
      });
      return;
    }
  
    const getCellContent = (row: any, column: any): string => {
      const { accessorKey } = column;
      const value = row[accessorKey];
  
      if (accessorKey === 'stacks' && Array.isArray(value)) {
        return value.map((s: any) => `${s.stackNumber} (${s.numberOfBags} bags)`).join('; ');
      }
      if (accessorKey === 'labResults' && Array.isArray(value)) {
        // Enhanced lab results with parameter names - now using stored objects
        if (value.length > 0) {
          return value.map((result: any) => {
            // Handle both new object format and legacy string format
            if (typeof result === 'object' && result.parameterName && result.value) {
              return `${result.parameterName}-${result.value}`;
            } else if (typeof result === 'string') {
              // Legacy fallback - try to get parameter names from commodity/variety
              const commodity = commodities.find(c => c.commodityName === row.commodity);
              const variety = commodity?.varieties?.find(v => v.varietyName === row.variety);
              const particulars = variety?.particulars || [];
              const index = value.indexOf(result);
              const paramName = particulars[index]?.particularName || particulars[index]?.name || `Parameter${index + 1}`;
              return `${paramName}-${result}`;
            }
            // Convert any remaining object to string to prevent React rendering error
            return typeof result === 'object' ? JSON.stringify(result) : String(result);
          }).join(',');
        }
        return '';
      }
      // Handle Base Receipt field
      if (accessorKey === 'bankReceipt' || accessorKey === 'baseReceiptNo') {
        return row.baseReceiptNo || row.bankReceipt || '-';
      }
      // Handle insurance data that might be undefined
      if (accessorKey === 'firePolicyAmount' || accessorKey === 'burglaryPolicyAmount' || 
          accessorKey === 'firePolicyStartDate' || accessorKey === 'firePolicyEndDate' ||
          accessorKey === 'burglaryPolicyStartDate' || accessorKey === 'burglaryPolicyEndDate' ||
          accessorKey === 'firePolicyName' || accessorKey === 'burglaryPolicyName' ||
          accessorKey === 'bankFundedBy') {
        return value ?? '-';
      }
      // Handle selectedInsurance column
      if (accessorKey === 'selectedInsurance') {
        const selectedInsurance = row.selectedInsurance;
        if (selectedInsurance && selectedInsurance.insuranceTakenBy) {
          return selectedInsurance.insuranceTakenBy;
        }
        return row.insuranceManagedBy || '-';
      }
      return value ?? '';
    };

    // Function to create rows for multiple vehicle entries (one row per vehicle with combined stack info)
    const createDetailedRows = (dataToExport: any[]) => {
      const detailedRows: any[] = [];
      
      dataToExport.forEach((row) => {
        // Check if we have multiple vehicle entries (inwardEntries)
        const vehicleEntries = row.inwardEntries && Array.isArray(row.inwardEntries) && row.inwardEntries.length > 0
          ? row.inwardEntries
          : [null]; // If no vehicle entries, create one row with main data
        
        vehicleEntries.forEach((vehicleEntry: any, vehicleIndex: number) => {
          // Create ONE row per vehicle entry with all stack details combined
          const csvRow = columns.map(col => {
            const { accessorKey } = col;
            let value;
            
            // Vehicle-specific data (if available)
            if (vehicleEntry && accessorKey === 'vehicleNumber') {
              value = vehicleEntry.vehicleNumber || row.vehicleNumber || '';
            } else if (vehicleEntry && accessorKey === 'getpassNumber') {
              value = vehicleEntry.getpassNumber || row.getpassNumber || '';
            } else if (vehicleEntry && accessorKey === 'weightBridge') {
              value = vehicleEntry.weightBridge || row.weightBridge || '';
            } else if (vehicleEntry && accessorKey === 'weightBridgeSlipNumber') {
              value = vehicleEntry.weightBridgeSlipNumber || row.weightBridgeSlipNumber || '';
            } else if (vehicleEntry && accessorKey === 'grossWeight') {
              value = vehicleEntry.grossWeight || row.grossWeight || '';
            } else if (vehicleEntry && accessorKey === 'tareWeight') {
              value = vehicleEntry.tareWeight || row.tareWeight || '';
            } else if (vehicleEntry && accessorKey === 'netWeight') {
              value = vehicleEntry.netWeight || row.netWeight || '';
            } else if (vehicleEntry && accessorKey === 'averageWeight') {
              value = vehicleEntry.averageWeight || row.averageWeight || '';
            } 
            // Stack-specific data - combine all stacks for this vehicle
            else if (accessorKey === 'stacks') {
              const stacks = vehicleEntry?.stacks && Array.isArray(vehicleEntry.stacks) && vehicleEntry.stacks.length > 0
                ? vehicleEntry.stacks
                : (row.stacks && Array.isArray(row.stacks) && row.stacks.length > 0 ? row.stacks : []);
              
              if (stacks.length > 0) {
                value = stacks.map((stack: any) => `${stack.stackNumber || ''} (${stack.numberOfBags || 0} bags)`).join('; ');
              } else {
                value = '';
              }
            }
            // Main row data for all other columns
            else {
              value = getCellContent(row, col);
            }
            
            const stringValue = String(value).replace(/"/g, '""');
            return `"${stringValue}"`;
          }).join(',');
          
          detailedRows.push(csvRow);
        });
      });
      
      return detailedRows;
    };
  
  const csvHeaders = columns.map(c => (typeof c.header === 'string' ? c.header : c.accessorKey) || '').join(',');
    const detailedRows = createDetailedRows(dataToExport);
    const csvRows = detailedRows.join('\r\n');
  
    const csvContent = `\uFEFF${csvHeaders}\r\n${csvRows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'inward-data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Generate sequential inward ID
  const generateInwardId = async () => {
    try {
      console.log('Starting generateInwardId...');
      
      // Check if Firebase is available
      if (!db) {
        throw new Error('Firebase database not available');
      }
      
      const inwardCollection = collection(db, 'inward');
      console.log('Collection reference created');
      
      const snapshot = await getDocs(inwardCollection);
      console.log('Snapshot retrieved, docs count:', snapshot.docs.length);
      
      // Extract existing inward IDs and find the highest number
      const existingIds = snapshot.docs
        .map(doc => {
          const data = doc.data();
          console.log('Document data:', data);
          return data.inwardId;
        })
        .filter(id => id && id.startsWith('INW-'))
        .map(id => {
          const match = id.match(/INW-(\d{3})/);
          return match ? parseInt(match[1], 10) : 0;
        });
      
      console.log('Existing IDs found:', existingIds);
      const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
      const nextId = maxId + 1;
      const generatedId = `INW-${nextId.toString().padStart(3, '0')}`;
      
      console.log('Generated inward ID:', generatedId);
      
      // Validate the generated ID
      if (!generatedId || typeof generatedId !== 'string') {
        throw new Error('Generated inward ID is invalid');
      }
      
      return generatedId;
    } catch (error) {
      console.error('Error generating inward ID:', error);
      // Fallback to timestamp-based ID if there's an error
      const timestamp = Date.now();
      const fallbackId = `INW-${timestamp.toString().slice(-3)}`;
      console.log('Using fallback ID:', fallbackId);
      
      // Validate fallback ID
      if (!fallbackId || typeof fallbackId !== 'string') {
        throw new Error('Fallback inward ID generation failed');
      }
      
      return fallbackId;
    }
  };

  // Generate multiple inward IDs at once to prevent race conditions
  const generateMultipleInwardIds = async (count: number) => {
    try {
      const inwardCollection = collection(db, 'inward');
      const snapshot = await getDocs(inwardCollection);
      
      // Extract existing inward IDs and find the highest number
      const existingIds = snapshot.docs
        .map(doc => doc.data().inwardId)
        .filter(id => id && id.startsWith('INW-'))
        .map(id => {
          const match = id.match(/INW-(\d{3})/);
          return match ? parseInt(match[1], 10) : 0;
        });
      
      const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
      const ids = [];
      
      for (let i = 1; i <= count; i++) {
        const nextId = maxId + i;
        ids.push(`INW-${nextId.toString().padStart(3, '0')}`);
      }
      
      return ids;
    } catch (error) {
      console.error('Error generating multiple inward IDs:', error);
      // Fallback to timestamp-based IDs if there's an error
      const ids = [];
      for (let i = 0; i < count; i++) {
        const timestamp = Date.now() + i;
        ids.push(`INW-${timestamp.toString().slice(-3)}`);
      }
      return ids;
    }
  };

  // Helper function to extract lab result value (handles both object and string formats)
  const getLabResultValue = (labResults: any[], index: number): string => {
    if (!labResults || !labResults[index]) return '';
    const result = labResults[index];
    return typeof result === 'object' ? result.value || '' : result || '';
  };

  // Migration function to convert old string arrays to new object arrays
  const migrateLabResults = (labResults: any[], commodityName?: string, varietyName?: string): Array<{parameterName: string, value: string}> => {
    if (!labResults || labResults.length === 0) return [];
    
    // If already in new format, return as is
    if (labResults.length > 0 && typeof labResults[0] === 'object' && labResults[0].parameterName) {
      return labResults;
    }
    
    // Migration from old string array format
    const commodity = commodities.find(c => c.commodityName === commodityName);
    const variety = commodity?.varieties?.find(v => v.varietyName === varietyName);
    const particulars = variety?.particulars || [];
    
    return labResults.map((value: string, index: number) => ({
      parameterName: particulars[index]?.particularName || particulars[index]?.name || `Parameter${index + 1}`,
      value: value || ''
    }));
  };

  // Helper to get particulars for selected commodity and variety
  const getSelectedVarietyParticulars = () => {
    // Use selectedRowForSR if available (for PDF generation), otherwise use form data
    const commodityName = selectedRowForSR?.commodity || form.commodity;
    const varietyName = selectedRowForSR?.varietyName || form.varietyName;
    
    console.log('getSelectedVarietyParticulars called with:', { 
      commodity: commodityName, 
      varietyName: varietyName,
      commoditiesCount: commodities.length 
    });
    
    const commodity = commodities.find((c: any) => c.commodityName === commodityName);
    console.log('Found commodity:', commodity);
    
    const variety = commodity?.varieties?.find((v: any) => v.varietyName === varietyName);
    console.log('Found variety:', variety);
    
    const particulars = variety?.particulars || [];
    console.log('Returning particulars:', particulars);
    
    return particulars;
  };

  // Add handler for lab result input changes
  const handleLabResultChange = (index: number, value: string) => {
    const particulars = getSelectedVarietyParticulars();
    const particular = particulars[index];
    if (!particular) return;

    const { minPercentage, maxPercentage } = particular;
    const numericValue = parseFloat(value);
    let isValid = true;

    if (!isNaN(numericValue)) {
      if (numericValue < minPercentage || numericValue > maxPercentage) {
        isValid = false;
        toast({
          title: "Invalid Value",
          description: `Value for ${particular.particularName || particular.name || `Parameter${index + 1}`}` +
            ` must be between ${minPercentage}% and ${maxPercentage}%.`,
          variant: "destructive",
        });
      }
    }

    setCurrentEntryForm(f => {
      const updatedResults = [...(f.labResults || [])];
      updatedResults[index] = {
        parameterName: particular.particularName || particular.name || `Parameter${index + 1}`,
        value: value
      };
      
      const updatedValidation = [...(f.labResultsValidation || [])];
      updatedValidation[index] = isValid;

      return { ...f, labResults: updatedResults, labResultsValidation: updatedValidation };
    });
  };

  // Function to switch between multiple entries in edit mode
  const handleEntrySwitch = (entryIndex: number) => {
    if (inwardEntries && inwardEntries.length > entryIndex) {
      const selectedEntry = inwardEntries[entryIndex];
      setCurrentEntryIndex(entryIndex);
      
      // Update current entry form with selected entry data (lab parameters now at baseForm level)
      setCurrentEntryForm({
        vehicleNumber: selectedEntry.vehicleNumber || '',
        getpassNumber: selectedEntry.getpassNumber || '',
        weightBridge: selectedEntry.weightBridge || '',
        weightBridgeSlipNumber: selectedEntry.weightBridgeSlipNumber || '',
        grossWeight: selectedEntry.grossWeight || '',
        tareWeight: selectedEntry.tareWeight || '',
        netWeight: selectedEntry.netWeight || '',
        averageWeight: selectedEntry.averageWeight || '',
        totalBags: selectedEntry.totalBags || '',
        totalQuantity: selectedEntry.totalQuantity || '',
        // Lab results are still per entry, but dates are now at document level
        labResults: currentEntryForm.labResults || [],
        labResultsValidation: currentEntryForm.labResultsValidation || [],
        stacks: selectedEntry.stacks || [{ stackNumber: '', numberOfBags: '' }],
      });
    }
  };

  // Function to update an individual entry in the inwardEntries array
  const handleEntryUpdate = (entryIndex: number, field: string, value: any) => {
    if (inwardEntries && inwardEntries.length > entryIndex) {
      const updatedEntries = [...inwardEntries];
      const entry = updatedEntries[entryIndex];
      
      // Update the field
      entry[field] = value;
      
      // Auto-calculate net weight when gross or tare weight changes
      if (field === 'grossWeight' || field === 'tareWeight') {
        const grossNum = parseFloat(entry.grossWeight) || 0;
        const tareNum = parseFloat(entry.tareWeight) || 0;
        const net = grossNum - tareNum;
        entry.netWeight = net >= 0 ? net.toFixed(3) : '0.000';
        
        // Auto-calculate average weight
        const totalBags = parseInt(entry.totalBags) || 0;
        if (net > 0 && totalBags > 0) {
          const avgWeight = (net / totalBags) * 1000; // Convert MT/bag to Kg/bag
          entry.averageWeight = avgWeight.toFixed(2);
        } else {
          entry.averageWeight = '';
        }
      }
      
      // Auto-calculate average weight when net weight changes
      if (field === 'netWeight') {
        const netWeight = parseFloat(value) || 0;
        const totalBags = parseInt(entry.totalBags) || 0;
        if (netWeight > 0 && totalBags > 0) {
          const avgWeight = (netWeight / totalBags) * 1000; // Convert MT/bag to Kg/bag
          entry.averageWeight = avgWeight.toFixed(2);
        } else {
          entry.averageWeight = '';
        }
      }
      
      // Auto-calculate average weight when total bags changes
      if (field === 'totalBags') {
        const netWeight = parseFloat(entry.netWeight) || 0;
        const totalBags = parseInt(value) || 0;
        if (netWeight > 0 && totalBags > 0) {
          const avgWeight = (netWeight / totalBags) * 1000; // Convert MT/bag to Kg/bag
          entry.averageWeight = avgWeight.toFixed(2);
        } else {
          entry.averageWeight = '';
        }
        
        // Validate that total bags match stack bags
        if (entry.stacks && Array.isArray(entry.stacks)) {
          const stackBagsSum = entry.stacks.reduce((total: number, stack: { numberOfBags: string }) => {
            return total + (parseInt(stack.numberOfBags) || 0);
          }, 0);
          
          if (totalBags !== stackBagsSum) {
            console.log(`Validation warning: Entry ${entryIndex + 1} total bags (${totalBags}) don't match stack bags (${stackBagsSum})`);
          }
        }
      }
      
      setInwardEntries(updatedEntries);
      
      // Recalculate total bags in Commodity Information
      setTimeout(() => {
        recalculateTotalBags();
      }, 0);
    }
  };

  // Function to update stack information for a specific entry
  const handleEntryStackUpdate = (entryIndex: number, stackIndex: number, field: string, value: string) => {
    if (inwardEntries && inwardEntries.length > entryIndex) {
      const updatedEntries = [...inwardEntries];
      if (updatedEntries[entryIndex].stacks && updatedEntries[entryIndex].stacks.length > stackIndex) {
        updatedEntries[entryIndex].stacks[stackIndex] = {
          ...updatedEntries[entryIndex].stacks[stackIndex],
          [field]: value
        };
        
        // Auto-calculate total bags from stacks if numberOfBags was updated
        if (field === 'numberOfBags') {
          const stackBagsSum = updatedEntries[entryIndex].stacks.reduce((total: number, stack: { numberOfBags: string }) => {
            return total + (parseInt(stack.numberOfBags) || 0);
          }, 0);
          updatedEntries[entryIndex].totalBags = stackBagsSum.toString();
        }
        
        setInwardEntries(updatedEntries);
        
        // Recalculate total bags in Commodity Information
        setTimeout(() => {
          recalculateTotalBags();
        }, 0);
      }
    }
  };

  // Function to add a new stack to a specific entry
  const handleEntryAddStack = (entryIndex: number) => {
    if (inwardEntries && inwardEntries.length > entryIndex) {
      const updatedEntries = [...inwardEntries];
      if (!updatedEntries[entryIndex].stacks) {
        updatedEntries[entryIndex].stacks = [];
      }
      updatedEntries[entryIndex].stacks.push({ stackNumber: '', numberOfBags: '' });
      
      // Recalculate total bags from stacks
      const stackBagsSum = updatedEntries[entryIndex].stacks.reduce((total: number, stack: { numberOfBags: string }) => {
        return total + (parseInt(stack.numberOfBags) || 0);
      }, 0);
      updatedEntries[entryIndex].totalBags = stackBagsSum.toString();
      
      setInwardEntries(updatedEntries);
      
      // Recalculate total bags in Commodity Information
      setTimeout(() => {
        recalculateTotalBags();
      }, 0);
    }
  };

  // Function to remove a stack from a specific entry
  const handleEntryRemoveStack = (entryIndex: number, stackIndex: number) => {
    if (inwardEntries && inwardEntries.length > entryIndex) {
      const updatedEntries = [...inwardEntries];
      if (updatedEntries[entryIndex].stacks && updatedEntries[entryIndex].stacks.length > stackIndex) {
        updatedEntries[entryIndex].stacks.splice(stackIndex, 1);
        
        // Recalculate total bags from stacks
        const stackBagsSum = updatedEntries[entryIndex].stacks.reduce((total: number, stack: { numberOfBags: string }) => {
          return total + (parseInt(stack.numberOfBags) || 0);
        }, 0);
        updatedEntries[entryIndex].totalBags = stackBagsSum.toString();
        
        setInwardEntries(updatedEntries);
        
        // Recalculate total bags in Commodity Information
        setTimeout(() => {
          recalculateTotalBags();
        }, 0);
      }
    }
  };

  // Handle edit button click
  async function handleEdit(row: any) {
    setIsEditMode(true);
    setEditingRow(row);
    
    // Debug logging for insurance data being loaded
    console.log('=== EDIT MODE INSURANCE DATA DEBUG ===');
    console.log('Row insurance data:', {
      firePolicyAmount: row.firePolicyAmount,
      firePolicyAmountType: typeof row.firePolicyAmount,
      burglaryPolicyAmount: row.burglaryPolicyAmount,
      burglaryPolicyAmountType: typeof row.burglaryPolicyAmount,
      firePolicyBalance: row.firePolicyBalance,
      burglaryPolicyBalance: row.burglaryPolicyBalance
    });
    console.log('=== END EDIT MODE INSURANCE DATA DEBUG ===');

    // Populate form with row data
    setBaseForm({
      state: row.state || '',
      branch: row.branch || '',
      location: row.location || '',
      warehouseName: row.warehouseName || '',
      warehouseCode: row.warehouseCode || '',
      warehouseAddress: row.warehouseAddress || '',
      businessType: row.businessType || '',
      client: row.client || '',
      clientCode: row.clientCode || '',
      clientAddress: row.clientAddress || '',
      dateOfInward: row.dateOfInward || '',
      cadNumber: row.cadNumber || '',
      attachmentUrl: row.attachmentUrl || '',
      commodity: row.commodity || '',
      varietyName: row.varietyName || '',
      marketRate: row.marketRate || '',
      totalBags: row.totalBags || '',
      totalQuantity: row.totalQuantity || '',
      totalValue: row.totalValue || '',
      bankName: row.bankName || '',
      bankBranch: row.bankBranch || '',
      bankState: row.bankState || '',
      ifscCode: row.ifscCode || '',
      bankReceipt: row.bankReceipt || '',
  selectedInsurance: row.selectedInsurance || null,
      billingStatus: row.billingStatus || '',
      reservationRate: row.reservationRate || '',
      reservationQty: row.reservationQty || '',
      reservationStart: row.reservationStart || '',
      reservationEnd: row.reservationEnd || '',
      billingCycle: row.billingCycle || '',
      billingType: row.billingType || '',
      billingRate: row.billingRate || '',
      insuranceManagedBy: row.insuranceManagedBy || '',
      firePolicyNumber: row.firePolicyNumber || '',
      firePolicyAmount: row.firePolicyAmount || row.firePolicyAmount === 0 ? String(row.firePolicyAmount) : '',
      firePolicyStart: row.firePolicyStart || '',
      firePolicyEnd: row.firePolicyEnd || '',
      burglaryPolicyNumber: row.burglaryPolicyNumber || '',
      burglaryPolicyAmount: row.burglaryPolicyAmount || row.burglaryPolicyAmount === 0 ? String(row.burglaryPolicyAmount) : '',
      burglaryPolicyStart: row.burglaryPolicyStart || '',
      burglaryPolicyEnd: row.burglaryPolicyEnd || '',
      firePolicyCompanyName: row.firePolicyCompanyName || '',
      burglaryPolicyCompanyName: row.burglaryPolicyCompanyName || '',
      firePolicyBalance: row.firePolicyBalance || row.firePolicyBalance === 0 ? String(row.firePolicyBalance) : '',
      burglaryPolicyBalance: row.burglaryPolicyBalance || row.burglaryPolicyBalance === 0 ? String(row.burglaryPolicyBalance) : '',
      bankFundedBy: row.bankFundedBy || '',
      // Lab Parameters - moved to form level
      dateOfSampling: row.dateOfSampling || '',
      dateOfTesting: row.dateOfTesting || '',
    });

    // Handle multiple inward entries for edit mode
    let inwardEntries = [];
    if (row.inwardEntries && Array.isArray(row.inwardEntries) && row.inwardEntries.length > 0) {
      // If the row has inwardEntries array, use it
      inwardEntries = row.inwardEntries.map((entry: any, index: number) => {
        // Calculate total bags from stacks for each entry
        let calculatedTotalBags = entry.totalBags;
        if (entry.stacks && Array.isArray(entry.stacks)) {
          const stackBagsSum = entry.stacks.reduce((total: number, stack: { numberOfBags: string }) => {
            return total + (parseInt(stack.numberOfBags) || 0);
          }, 0);
          calculatedTotalBags = stackBagsSum.toString();
          console.log(`Entry ${index + 1} total bags calculated from stacks:`, calculatedTotalBags);
        }
        
        return {
        ...entry,
        entryNumber: index + 1,
        id: Date.now() + index, // Generate unique ID for each entry
          totalBags: calculatedTotalBags
        };
      });
    } else {
      // If no inwardEntries array, create a single entry from the row data
      let calculatedTotalBags = row.totalBags;
      if (row.stacks && Array.isArray(row.stacks)) {
        const stackBagsSum = row.stacks.reduce((total: number, stack: { numberOfBags: string }) => {
          return total + (parseInt(stack.numberOfBags) || 0);
        }, 0);
        calculatedTotalBags = stackBagsSum.toString();
        console.log('Single entry total bags calculated from stacks:', calculatedTotalBags);
      }
      
      inwardEntries = [{
        id: Date.now(),
        entryNumber: 1,
      vehicleNumber: row.vehicleNumber || '',
      getpassNumber: row.getpassNumber || '',
      weightBridge: row.weightBridge || '',
      weightBridgeSlipNumber: row.weightBridgeSlipNumber || '',
      grossWeight: row.grossWeight || '',
      tareWeight: row.tareWeight || '',
      netWeight: row.netWeight || '',
      averageWeight: row.averageWeight || '',
        totalBags: calculatedTotalBags || '',
      totalQuantity: row.totalQuantity || '',
      stacks: row.stacks || [{ stackNumber: '', numberOfBags: '' }],
      }];
    }

    // Set the inward entries
    setInwardEntries(inwardEntries);

    // Recalculate total bags from entries to ensure consistency
    if (inwardEntries.length > 0) {
      const calculatedTotalBags = inwardEntries.reduce((sum: number, entry: any) => {
        return sum + (parseInt(entry.totalBags) || 0);
      }, 0);
      
      const calculatedTotalQuantity = inwardEntries.reduce((sum: number, entry: any) => {
        return sum + (parseFloat(entry.totalQuantity) || 0);
      }, 0);
      
      console.log('Recalculated totals when loading for edit - Total Bags:', calculatedTotalBags, 'Total Quantity:', calculatedTotalQuantity);
      
      // Update baseForm with calculated totals
      setBaseForm(f => ({
        ...f,
        totalBags: calculatedTotalBags.toString(),
        totalQuantity: calculatedTotalQuantity.toFixed(3)
      }));
    }

    // Populate current entry form with the first entry data
    const firstEntry = inwardEntries[0] || {};
    
    // Debug logging for edit mode data
    console.log('=== EDIT MODE DATA DEBUG ===');
    console.log('Row data:', {
      totalBags: row.totalBags,
      totalQuantity: row.totalQuantity,
      dateOfSampling: row.dateOfSampling,
      dateOfTesting: row.dateOfTesting,
      labResults: row.labResults
    });
    console.log('First entry data:', firstEntry);
    
    const currentEntryFormData = {
      vehicleNumber: firstEntry.vehicleNumber || '',
      getpassNumber: firstEntry.getpassNumber || '',
      weightBridge: firstEntry.weightBridge || '',
      weightBridgeSlipNumber: firstEntry.weightBridgeSlipNumber || '',
      grossWeight: firstEntry.grossWeight || '',
      tareWeight: firstEntry.tareWeight || '',
      netWeight: firstEntry.netWeight || '',
      averageWeight: firstEntry.averageWeight || '',
      // Use document-level totalBags and totalQuantity instead of entry-level
      totalBags: row.totalBags || '',
      totalQuantity: row.totalQuantity || '',
      // Lab parameters from document level
      dateOfSampling: row.dateOfSampling ? (typeof row.dateOfSampling === 'string' ? row.dateOfSampling : new Date(row.dateOfSampling).toISOString().split('T')[0]) : '',
      dateOfTesting: row.dateOfTesting ? (typeof row.dateOfTesting === 'string' ? row.dateOfTesting : new Date(row.dateOfTesting).toISOString().split('T')[0]) : '',
      labResults: row.labResults || [],
      labResultsValidation: Array.isArray(row.labResults) ? row.labResults.map(() => true) : [],
      stacks: firstEntry.stacks || [{ stackNumber: '', numberOfBags: '' }],
    };
    
    console.log('Current entry form data to be set:', currentEntryFormData);
    console.log('=== END EDIT MODE DATA DEBUG ===');
    
    setCurrentEntryForm(currentEntryFormData);

    // Fetch insurance entries from inspection collection AND insurance master collection
    let inspectionInsuranceEntries = [];
    if (row.warehouseName) {
      console.log('🔍 Fetching insurance for warehouse:', row.warehouseName);
      
      // First, try to fetch from insurance master collection
      const insuranceMasterCollection = collection(db, 'insurance');
      const masterQuery = query(
        insuranceMasterCollection,
        where('warehouseName', '==', row.warehouseName),
        where('state', '==', row.state),
        where('branch', '==', row.branch),
        where('location', '==', row.location)
      );
      
      const masterSnapshot = await getDocs(masterQuery);
      if (!masterSnapshot.empty) {
        console.log('✅ Found insurance in master collection:', masterSnapshot.docs.length, 'policies');
        inspectionInsuranceEntries = masterSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            insuranceId: data.insuranceCode || doc.id,
            insuranceTakenBy: data.insuranceType || 'client',
            firePolicyEndDate: data.firePolicyEndDate,
            burglaryPolicyEndDate: data.burglaryPolicyEndDate,
            // These are the CURRENT remaining amounts - use these for display
            remainingFirePolicyAmount: data.firePolicyRemainingAmount,
            remainingBurglaryPolicyAmount: data.burglaryPolicyRemainingAmount,
            firePolicyRemainingAmount: data.firePolicyRemainingAmount,
            burglaryPolicyRemainingAmount: data.burglaryPolicyRemainingAmount,
            commodityName: data.commodityName,
            clientName: data.clientName,
            selectedCommodities: data.selectedCommodities,
            // Use remaining amounts for display (these are the current available amounts)
            firePolicyAmount: data.firePolicyRemainingAmount || data.firePolicyAmount,
            burglaryPolicyAmount: data.burglaryPolicyRemainingAmount || data.burglaryPolicyAmount,
            // Store original total amounts separately
            firePolicyTotalAmount: data.firePolicyAmount,
            burglaryPolicyTotalAmount: data.burglaryPolicyAmount,
            firePolicyStartDate: data.firePolicyStartDate,
            burglaryPolicyStartDate: data.burglaryPolicyStartDate,
            firePolicyNumber: data.firePolicyNumber,
            burglaryPolicyNumber: data.burglaryPolicyNumber,
            firePolicyCompanyName: data.firePolicyCompanyName,
            burglaryPolicyCompanyName: data.burglaryPolicyCompanyName,
            insuranceCommodity: data.commodityName,
            bankFundedBy: data.bankFundedBy
          };
        });
      } else {
        console.log('⚠️ No insurance in master collection, checking inspections as fallback...');
        // Fallback: Fetch from Firestore inspections collection
        const inspectionsCollection = collection(db, 'inspections');
        const q = query(inspectionsCollection, where('warehouseName', '==', row.warehouseName));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const inspectionData = querySnapshot.docs[0].data();
          if (inspectionData.insuranceEntries && Array.isArray(inspectionData.insuranceEntries)) {
            inspectionInsuranceEntries = inspectionData.insuranceEntries;
          } else if (inspectionData.warehouseInspectionData?.insuranceEntries && Array.isArray(inspectionData.warehouseInspectionData.insuranceEntries)) {
            inspectionInsuranceEntries = inspectionData.warehouseInspectionData.insuranceEntries;
          } else if (inspectionData.warehouseInspectionData) {
          // Check for current insurance format (from recent validation changes)
          const warehouseData = inspectionData.warehouseInspectionData;
          if (warehouseData.insuranceTakenBy && (warehouseData.firePolicyNumber || warehouseData.burglaryPolicyNumber)) {
            console.log('Found current insurance format in edit mode, converting to entry format for warehouse:', row.warehouseName);
            inspectionInsuranceEntries = [{
              id: `current_${Date.now()}`,
              insuranceId: `INS_${row.warehouseName}_${Date.now()}`,
              insuranceTakenBy: warehouseData.insuranceTakenBy || '',
              insuranceCommodity: warehouseData.insuranceCommodity || '',
              clientName: warehouseData.clientName || '',
              clientAddress: warehouseData.clientAddress || '',
              selectedBankName: warehouseData.selectedBankName || '',
              firePolicyCompanyName: warehouseData.firePolicyCompanyName || '',
              firePolicyNumber: warehouseData.firePolicyNumber || '',
              firePolicyAmount: warehouseData.firePolicyAmount || '0',
              firePolicyStartDate: warehouseData.firePolicyStartDate || null,
              firePolicyEndDate: warehouseData.firePolicyEndDate || null,
              burglaryPolicyCompanyName: warehouseData.burglaryPolicyCompanyName || '',
              burglaryPolicyNumber: warehouseData.burglaryPolicyNumber || '',
              burglaryPolicyAmount: warehouseData.burglaryPolicyAmount || '0',
              burglaryPolicyStartDate: warehouseData.burglaryPolicyStartDate || null,
              burglaryPolicyEndDate: warehouseData.burglaryPolicyEndDate || null,
              remainingFirePolicyAmount: warehouseData.firePolicyAmount || '0',
              remainingBurglaryPolicyAmount: warehouseData.burglaryPolicyAmount || '0',
              createdAt: new Date(warehouseData.createdAt || Date.now())
            }];
          }
          }
        }
      }
    }
    setInsuranceEntries(inspectionInsuranceEntries);

    setShowAddModal(true);

    // Auto-select insurance by insuranceTakenBy and insuranceId
    if (row.selectedInsurance) {
      const idx = inspectionInsuranceEntries.findIndex(
        (ins: any) => ins.insuranceId === row.selectedInsurance.insuranceId &&
                      ins.insuranceTakenBy === row.selectedInsurance.insuranceTakenBy
      );
      if (idx !== -1) {
        setSelectedInsuranceForInward(inspectionInsuranceEntries[idx]);
        setSelectedInsuranceIndex(idx);
        // Ensure baseForm.selectedInsurance reflects the auto-selected policy
        const matched = inspectionInsuranceEntries[idx];
        setBaseForm(f => ({
          ...f,
          selectedInsurance: {
            insuranceTakenBy: matched?.insuranceTakenBy || null,
            insuranceId: matched?.insuranceId || null,
          }
        }));
        
        // Check if this is bank-funded insurance - skip amount validation
        const insuranceType = (matched?.insuranceTakenBy || '').toLowerCase();
        const isBankFunded = insuranceType === 'bank' || insuranceType === 'bank-funded';
        setIsBankFundedInsurance(isBankFunded);
        
        if (isBankFunded) {
          console.log('🏦 Bank-funded insurance detected in edit mode - skipping amount validation');
          setInitialRemainingFire('0');
          setInitialRemainingBurglary('0');
          setIsFireRemainingSource(false);
          setIsBurglaryRemainingSource(false);
        }
      }
      setInsuranceReadOnly(true);
    } else {
      setInsuranceReadOnly(false);
    }

    // In handleEdit, after setting insuranceEntries and before setShowAddModal(true):
    if (row.selectedInsurance && inspectionInsuranceEntries.length > 0) {
      const match = inspectionInsuranceEntries.find(
        (ins: any) =>
          ins.insuranceId === row.selectedInsurance.insuranceId &&
          ins.insuranceTakenBy === row.selectedInsurance.insuranceTakenBy
      );
      
      console.log('=== EDIT MODE INSURANCE DEBUG ===');
      console.log('Row selectedInsurance:', row.selectedInsurance);
      console.log('Found insurance match:', match);
      console.log('Insurance data types:', {
        firePolicyAmount: match?.firePolicyAmount,
        firePolicyAmountType: typeof match?.firePolicyAmount,
        burglaryPolicyAmount: match?.burglaryPolicyAmount,
        burglaryPolicyAmountType: typeof match?.burglaryPolicyAmount
      });
      
      // Check if this is bank-funded insurance
      if (match) {
        const insuranceType = (match.insuranceTakenBy || '').toLowerCase();
        const isBankFunded = insuranceType === 'bank' || insuranceType === 'bank-funded';
        
        if (isBankFunded) {
          console.log('🏦 Bank-funded insurance in edit mode - skipping amount fetching');
          setYourInsurance(match);
          console.log('=== END EDIT MODE INSURANCE DEBUG ===');
          return; // Skip the amount fetching logic below
        }
      }
      
      // If match found but amounts are missing, try to fetch from source collections
      if (match) {
        let enhancedMatch = { ...match };
        
        // Check if amounts are missing or invalid
        const hasValidFireAmount = match.firePolicyAmount && match.firePolicyAmount !== '0' && match.firePolicyAmount !== '0.00' && match.firePolicyAmount !== '-';
        const hasValidBurglaryAmount = match.burglaryPolicyAmount && match.burglaryPolicyAmount !== '0' && match.burglaryPolicyAmount !== '0.00' && match.burglaryPolicyAmount !== '-';
        
        if (!hasValidFireAmount || !hasValidBurglaryAmount) {
          console.log('Insurance amounts missing from inspection, fetching from source collections...');
          
          if (match.sourceDocumentId && match.insuranceId && match.sourceCollection) {
            try {
              if (match.sourceCollection === 'clients') {
                // Fetch from clients collection
                const clientDocRef = doc(db, 'clients', match.sourceDocumentId);
                const clientDocSnap = await getDoc(clientDocRef);
                
                if (clientDocSnap.exists()) {
                  const clientData = clientDocSnap.data() as any;
                  const insurances = clientData.insurances || [];
                  const sourceInsurance = insurances.find((ins: any) => ins.insuranceId === match.insuranceId);
                  
                  if (sourceInsurance) {
                    console.log('Found source insurance in clients collection:', sourceInsurance);
                    if (!hasValidFireAmount && sourceInsurance.firePolicyAmount) {
                      enhancedMatch.firePolicyAmount = sourceInsurance.firePolicyAmount;
                    }
                    if (!hasValidBurglaryAmount && sourceInsurance.burglaryPolicyAmount) {
                      enhancedMatch.burglaryPolicyAmount = sourceInsurance.burglaryPolicyAmount;
                    }
                  }
                }
              } else if (match.sourceCollection === 'agrogreen') {
                // Fetch from agrogreen collection
                const agrogreenDocRef = doc(db, 'agrogreen', match.sourceDocumentId);
                const agrogreenDocSnap = await getDoc(agrogreenDocRef);
                
                if (agrogreenDocSnap.exists()) {
                  const agrogreenData = agrogreenDocSnap.data() as any;
                  console.log('Found source insurance in agrogreen collection:', agrogreenData);
                  if (!hasValidFireAmount && agrogreenData.firePolicyAmount) {
                    enhancedMatch.firePolicyAmount = agrogreenData.firePolicyAmount;
                  }
                  if (!hasValidBurglaryAmount && agrogreenData.burglaryPolicyAmount) {
                    enhancedMatch.burglaryPolicyAmount = agrogreenData.burglaryPolicyAmount;
                  }
                }
              }
            } catch (error) {
              console.error('Error fetching from source collections in edit mode:', error);
            }
          }
        }
        
        console.log('Enhanced insurance match with actual amounts:', enhancedMatch);
        console.log('=== END EDIT MODE INSURANCE DEBUG ===');
        
        setYourInsurance(enhancedMatch);
      } else {
        setYourInsurance(null);
      }
    } else {
      setYourInsurance(null);
    }
  };

  // Handle delete button click
  async function handleDelete(row: any) {
    if (confirm('Are you sure you want to delete this inward entry? This action cannot be undone.')) {
      try {
        // Delete from Firebase
        const inwardCollection = collection(db, 'inward');
        const q = query(inwardCollection, where('inwardId', '==', row.inwardId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const docRef = doc(db, 'inward', querySnapshot.docs[0].id);
          await deleteDoc(docRef);

          toast({
            title: "Success",
            description: "Inward entry deleted successfully.",
            variant: "default",
          });

          // Refresh data
          setDataVersion(v => v + 1);
        }
      } catch (error) {
        console.error('Error deleting inward entry:', error);
        toast({
          title: "Error",
          description: "Failed to delete inward entry. Please try again.",
          variant: "destructive",
        });
      }
    }
  }

  // Handle view SR button click
  async function handleViewSR(row: any) {
    setSelectedRowForSR(row);
    setShowSRForm(true);
    setRemarks(row.remarks || '');
    setHologramNumber(row.hologramNumber || '');
    if (row.srGenerationDate) {
      setSrGenerationDate(row.srGenerationDate);
    } else {
      setSrGenerationDate('');
    }
    setIsFormApproved(row.status === 'approved');
    
    // Fetch insurance data from insurance master collection (single source of truth)
    try {
      console.log('🔍 SR/WR: Fetching insurance from master collection for:', row.warehouseName);
      let insuranceEntries: any[] = [];
      
      // First check insurance master collection
      if (row.warehouseName && row.state && row.branch && row.location) {
        const insuranceMasterCollection = collection(db, 'insurance');
        const masterQuery = query(
          insuranceMasterCollection,
          where('warehouseName', '==', row.warehouseName),
          where('state', '==', row.state),
          where('branch', '==', row.branch),
          where('location', '==', row.location)
        );
        
        const masterSnapshot = await getDocs(masterQuery);
        if (!masterSnapshot.empty) {
          console.log('✅ SR/WR: Found insurance in master collection:', masterSnapshot.docs.length);
          insuranceEntries = masterSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              insuranceId: data.insuranceCode || doc.id,
              insuranceTakenBy: data.insuranceType || 'client',
              insuranceCommodity: data.commodityName,
              commodityName: data.commodityName,
              clientName: data.clientName,
              clientAddress: data.clientAddress || '',
              firePolicyCompanyName: data.firePolicyCompanyName,
              firePolicyNumber: data.firePolicyNumber,
              firePolicyAmount: data.firePolicyAmount,
              firePolicyStartDate: data.firePolicyStartDate,
              firePolicyEndDate: data.firePolicyEndDate,
              firePolicyRemainingAmount: data.firePolicyRemainingAmount,
              burglaryPolicyCompanyName: data.burglaryPolicyCompanyName,
              burglaryPolicyNumber: data.burglaryPolicyNumber,
              burglaryPolicyAmount: data.burglaryPolicyAmount,
              burglaryPolicyStartDate: data.burglaryPolicyStartDate,
              burglaryPolicyEndDate: data.burglaryPolicyEndDate,
              burglaryPolicyRemainingAmount: data.burglaryPolicyRemainingAmount,
              createdAt: data.createdAt || new Date()
            };
          });
        } else {
          console.log('⚠️ SR/WR: No insurance in master, checking inspections as fallback...');
          
          // Fallback to inspections collection
          const inspectionsCollection = collection(db, 'inspections');
          const q = query(inspectionsCollection, where('warehouseName', '==', row.warehouseName));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const inspectionData = querySnapshot.docs[0].data();
            
            // Check multiple possible locations for insurance data
            if (inspectionData.insuranceEntries && Array.isArray(inspectionData.insuranceEntries)) {
              console.log('Found top-level insurance entries:', inspectionData.insuranceEntries.length);
              insuranceEntries = inspectionData.insuranceEntries;
            } else if (inspectionData.warehouseInspectionData?.insuranceEntries && Array.isArray(inspectionData.warehouseInspectionData.insuranceEntries)) {
              console.log('Found nested insurance entries:', inspectionData.warehouseInspectionData.insuranceEntries.length);
              insuranceEntries = inspectionData.warehouseInspectionData.insuranceEntries;
            } else if (inspectionData.warehouseInspectionData) {
              // Legacy format - convert to new format
              const legacyData = inspectionData.warehouseInspectionData;
              if (legacyData.firePolicyNumber || legacyData.burglaryPolicyNumber) {
                console.log('Found legacy insurance format, converting to new format');
                insuranceEntries = [{
                  id: `legacy_${Date.now()}`,
                  insuranceTakenBy: legacyData.insuranceTakenBy || '',
                  insuranceCommodity: legacyData.insuranceCommodity || '',
                  clientName: legacyData.clientName || '',
                  clientAddress: legacyData.clientAddress || '',
                  selectedBankName: legacyData.selectedBankName || '',
                  firePolicyCompanyName: legacyData.firePolicyCompanyName || '',
                  firePolicyNumber: legacyData.firePolicyNumber || '',
                  firePolicyAmount: legacyData.firePolicyAmount || '',
                  firePolicyStartDate: legacyData.firePolicyStartDate || null,
                  firePolicyEndDate: legacyData.firePolicyEndDate || null,
                  burglaryPolicyCompanyName: legacyData.burglaryPolicyCompanyName || '',
                  burglaryPolicyNumber: legacyData.burglaryPolicyNumber || '',
                  burglaryPolicyAmount: legacyData.burglaryPolicyAmount || '',
                  burglaryPolicyStartDate: legacyData.burglaryPolicyStartDate || null,
                  burglaryPolicyEndDate: legacyData.burglaryPolicyEndDate || null,
                  createdAt: new Date(legacyData.createdAt || Date.now())
                }];
              }
            }
          }
        }
        
        console.log('✅ SR/WR: Insurance entries loaded:', insuranceEntries.length, insuranceEntries);
        setInspectionInsuranceData(insuranceEntries);
      } else {
        console.log('⚠️ SR/WR: Missing warehouse location data, cannot fetch insurance');
        setInspectionInsuranceData([]);
      }
    } catch (error) {
      console.error('❌ SR/WR: Error fetching insurance data:', error);
      setInspectionInsuranceData([]);
    }
  };

  // SR/WR View Modal


  const isInsuranceExpired = (sr: any) => {
    const today = new Date();

    // If a specific insurance was selected for this SR, validate only that policy
    const selected = sr?.selectedInsurance || (sr && sr.insuranceSelected) || null;
    if (selected && Array.isArray(inspectionInsuranceData) && inspectionInsuranceData.length > 0) {
      // Try to find a matching inspection entry. Match by insuranceId when available, else by policy numbers / takenBy
      const match = inspectionInsuranceData.find((ins: any) => {
        if (!ins) return false;
        if (selected.insuranceId && ins.insuranceId && ins.insuranceId === selected.insuranceId) return true;
        if (selected.firePolicyNumber && ins.firePolicyNumber && ins.firePolicyNumber === selected.firePolicyNumber) return true;
        if (selected.burglaryPolicyNumber && ins.burglaryPolicyNumber && ins.burglaryPolicyNumber === selected.burglaryPolicyNumber) return true;
        // last resort: match by who took the insurance and commodity
        if (selected.insuranceTakenBy && ins.insuranceTakenBy && ins.insuranceTakenBy === selected.insuranceTakenBy) return true;
        return false;
      });

      if (match) {
        const fireEndDate = match.firePolicyEndDate ? new Date(match.firePolicyEndDate) : match.firePolicyEnd ? new Date(match.firePolicyEnd) : null;
        const burglaryEndDate = match.burglaryPolicyEndDate ? new Date(match.burglaryPolicyEndDate) : match.burglaryPolicyEnd ? new Date(match.burglaryPolicyEnd) : null;
        if (fireEndDate instanceof Date && !isNaN(fireEndDate.getTime()) && fireEndDate < today) return true;
        if (burglaryEndDate instanceof Date && !isNaN(burglaryEndDate.getTime()) && burglaryEndDate < today) return true;
        return false;
      }

      // If selected but not found in inspection entries, fall through to check sr fields below
    }

    // If no specific selection exists, preserve previous behaviour: if any inspection entry for the warehouse is expired, treat as expired
    if ((!sr?.selectedInsurance || !inspectionInsuranceData || inspectionInsuranceData.length === 0) && Array.isArray(inspectionInsuranceData)) {
      for (const insurance of inspectionInsuranceData) {
        const fireEndDate = insurance.firePolicyEndDate ? new Date(insurance.firePolicyEndDate) : insurance.firePolicyEnd ? new Date(insurance.firePolicyEnd) : null;
        const burglaryEndDate = insurance.burglaryPolicyEndDate ? new Date(insurance.burglaryPolicyEndDate) : insurance.burglaryPolicyEnd ? new Date(insurance.burglaryPolicyEnd) : null;
        if (fireEndDate instanceof Date && !isNaN(fireEndDate.getTime()) && fireEndDate < today) return true;
        if (burglaryEndDate instanceof Date && !isNaN(burglaryEndDate.getTime()) && burglaryEndDate < today) return true;
      }
    }

    // Fallback to inward/sr stored fields
    const fireEndDate = sr?.firePolicyEnd ? new Date(sr.firePolicyEnd) : sr?.firePolicyEndDate ? new Date(sr.firePolicyEndDate) : null;
    const burglaryEndDate = sr?.burglaryPolicyEnd ? new Date(sr.burglaryPolicyEnd) : sr?.burglaryPolicyEndDate ? new Date(sr.burglaryPolicyEndDate) : null;
    if (fireEndDate instanceof Date && !isNaN(fireEndDate.getTime()) && fireEndDate < today) return true;
    if (burglaryEndDate instanceof Date && !isNaN(burglaryEndDate.getTime()) && burglaryEndDate < today) return true;

    return false;
  };

  // Generate a unique SR/WR No based on inwardId, date, and receiptType
  const generateSRNo = (row: any) => {
    if (!row) return '';
    const date = row.dateOfInward ? row.dateOfInward.replace(/-/g, '') : '';
    const prefix = row.receiptType === 'WR' ? 'WR' : 'SR';
    return `${prefix}-${row.inwardId || 'XXX'}-${date}`;
  };

  // In the insurance selection section, update the calculation:
  const calculateRemainingAmounts = (ins: any) => {
    // Sum totalValue from all inward entries for this insurance
    const totalInwardValue = inwardData.filter((entry: any) =>
      entry.warehouseName === form.warehouseName &&
      entry.firePolicyNumber === ins.firePolicyNumber &&
      entry.burglaryPolicyNumber === ins.burglaryPolicyNumber
    ).reduce((sum: number, entry: any) => sum + (parseFloat(entry.totalValue) || 0), 0);
    const firePolicyAmt = parseFloat(ins.firePolicyAmount) || 0;
    const burglaryPolicyAmt = parseFloat(ins.burglaryPolicyAmount) || 0;
    setRemainingFirePolicy((firePolicyAmt - totalInwardValue).toFixed(2));
    setRemainingBurglaryPolicy((burglaryPolicyAmt - totalInwardValue).toFixed(2));
  };

  // Print handler using html2canvas and jsPDF with new layout
  const handlePrint = async () => {
    console.log('Print button clicked');
    
    // Check if this is a CIR print (when CIR modal is open and approved)
    const isCIRPrint = showCIRModal && cirModalData?.cirStatus === 'Approved';
    
    let targetRef: React.RefObject<HTMLDivElement>;
    let documentType: string;
    let fileName: string;
    
    if (isCIRPrint) {
      console.log('CIR Print: Using CIRReceipt component');
      console.log('CIR Print: Receipt ref:', cirReceiptRef.current);
      
      if (!cirReceiptRef.current) {
        console.error('CIR receipt ref is not available');
        toast({ title: 'Error', description: 'CIR receipt not available. Please wait and try again.', variant: 'destructive' });
        return;
      }
      targetRef = cirReceiptRef;
      documentType = 'CIR status form';
      fileName = `cir-status-form-${cirModalData?.inwardId || 'document'}.pdf`;
    } else {
      if (!printableReceiptRef.current) {
        toast({ title: 'Error', description: 'Print ref not available. Please try again.', variant: 'destructive' });
        return;
      }
      targetRef = printableReceiptRef;
      const receiptType = selectedRowForSR?.receiptType === 'WR' ? 'warehouse' : 'storage';
      documentType = `${receiptType} receipt`;
      fileName = `${receiptType}-receipt-${selectedRowForSR?.inwardId || 'document'}.pdf`;
    }
    
    setIsPrinting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      
      // Wait a moment for the component to render
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      const canvas = await html2canvas(targetRef.current!, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#fff',
        logging: false,
        allowTaint: false,
        height: targetRef.current!.scrollHeight,
        width: targetRef.current!.scrollWidth
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;
      
      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(fileName);
      
      toast({ 
        title: 'PDF Generated', 
        description: `The ${documentType} PDF has been downloaded successfully.`, 
        variant: 'default' 
      });
    } catch (err) {
      console.error('PDF generation error:', err);
      toast({ title: 'Error', description: 'Failed to generate PDF. See console for details.', variant: 'destructive' });
    } finally {
      setIsPrinting(false);
    }
  };



  // Update insurance selection logic to fetch and display remaining values from Firestore
  const handleInsuranceSelect = async (idx: number) => {
    setSelectedInsuranceIndex(idx);
    const ins = insuranceEntries[idx];
    
    // Check if this is bank-funded insurance
    const insuranceType = (ins.insuranceTakenBy || '').toLowerCase();
    const isBankFunded = insuranceType === 'bank' || insuranceType === 'bank-funded';
    setIsBankFundedInsurance(isBankFunded);
    
    setBaseForm(f => ({
      ...f,
      selectedInsurance: {
        insuranceTakenBy: ins.insuranceTakenBy || null,
        insuranceId: ins.insuranceId || null,
      },
      insuranceManagedBy: ins.insuranceTakenBy || '',
      firePolicyNumber: ins.firePolicyNumber || '',
      firePolicyAmount: ins.firePolicyAmount || '',
      firePolicyStart: ins.firePolicyStartDate || '',
      firePolicyEnd: ins.firePolicyEndDate || '',
      burglaryPolicyNumber: ins.burglaryPolicyNumber || '',
      burglaryPolicyAmount: ins.burglaryPolicyAmount || '',
      burglaryPolicyStart: ins.burglaryPolicyStartDate || '',
      burglaryPolicyEnd: ins.burglaryPolicyEndDate || '',
      firePolicyCompanyName: ins.firePolicyCompanyName || '',
      burglaryPolicyCompanyName: ins.burglaryPolicyCompanyName || '',
      bankFundedBy: ins.selectedBankName || '',
    }));
    
    // Skip amount tracking for bank-funded insurance (no fixed limit)
    if (isBankFunded) {
      setInitialRemainingFire('0');
      setInitialRemainingBurglary('0');
      setIsFireRemainingSource(false);
      setIsBurglaryRemainingSource(false);
      return;
    }
    
    // Fetch latest remaining values from Firestore
    const inspectionsCollection = collection(db, 'inspections');
    const q = query(inspectionsCollection, where('warehouseName', '==', form.warehouseName));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const inspectionData = querySnapshot.docs[0].data();
      let insuranceList = inspectionData.insuranceEntries || [];
      if (!Array.isArray(insuranceList) && inspectionData.warehouseInspectionData?.insuranceEntries) {
        insuranceList = inspectionData.warehouseInspectionData.insuranceEntries;
      }
      const firestoreIns = insuranceList.find((i: any) => i.firePolicyNumber === ins.firePolicyNumber && i.burglaryPolicyNumber === ins.burglaryPolicyNumber);
      // Set original policy amounts from Firestore if available (fallback to entry values)
      const originalFire = firestoreIns?.firePolicyAmount ?? ins.firePolicyAmount ?? '';
      const originalBurglary = firestoreIns?.burglaryPolicyAmount ?? ins.burglaryPolicyAmount ?? '';
      setBaseForm(f => ({
        ...f,
        firePolicyAmount: originalFire !== undefined && originalFire !== null ? String(originalFire) : '',
        burglaryPolicyAmount: originalBurglary !== undefined && originalBurglary !== null ? String(originalBurglary) : '',
      }));
      // Normalize possible field names for remaining values
      const fireRemain = firestoreIns?.remainingFirePolicyAmount ?? firestoreIns?.firePolicyRemainingAmount;
      const burgRemain = firestoreIns?.remainingBurglaryPolicyAmount ?? firestoreIns?.burglaryPolicyRemainingAmount;
      if (fireRemain != null || burgRemain != null) {
        setInitialRemainingFire((fireRemain ?? '').toString());
        setInitialRemainingBurglary((burgRemain ?? '').toString());
        setIsFireRemainingSource(true);
        setIsBurglaryRemainingSource(true);
      } else {
        // Fallback to provided entry's remaining fields if present
        const entryFireRemain = ins.firePolicyRemainingAmount ?? ins.remainingFirePolicyAmount;
        const entryBurgRemain = ins.burglaryPolicyRemainingAmount ?? ins.remainingBurglaryPolicyAmount;
        if (entryFireRemain != null || entryBurgRemain != null) {
          setInitialRemainingFire((entryFireRemain ?? '').toString());
          setInitialRemainingBurglary((entryBurgRemain ?? '').toString());
          setIsFireRemainingSource(true);
          setIsBurglaryRemainingSource(true);
        } else {
          // As a last resort, use original amounts but mark as NOT remaining source
          setInitialRemainingFire(ins.firePolicyAmount || '');
          setInitialRemainingBurglary(ins.burglaryPolicyAmount || '');
          setIsFireRemainingSource(false);
          setIsBurglaryRemainingSource(false);
        }
      }
    } else {
      // Fallback to entry's remaining fields if present
      const entryFireRemain = ins.firePolicyRemainingAmount ?? ins.remainingFirePolicyAmount;
      const entryBurgRemain = ins.burglaryPolicyRemainingAmount ?? ins.remainingBurglaryPolicyAmount;
      // Ensure base form has original amounts from selected entry
      setBaseForm(f => ({
        ...f,
        firePolicyAmount: ins.firePolicyAmount ? String(ins.firePolicyAmount) : '',
        burglaryPolicyAmount: ins.burglaryPolicyAmount ? String(ins.burglaryPolicyAmount) : '',
      }));
      if (entryFireRemain != null || entryBurgRemain != null) {
        setInitialRemainingFire((entryFireRemain ?? '').toString());
        setInitialRemainingBurglary((entryBurgRemain ?? '').toString());
        setIsFireRemainingSource(true);
        setIsBurglaryRemainingSource(true);
      } else {
        // As a last resort, use original amounts but mark as NOT remaining source
        setInitialRemainingFire(ins.firePolicyAmount || '');
        setInitialRemainingBurglary(ins.burglaryPolicyAmount || '');
        setIsFireRemainingSource(false);
        setIsBurglaryRemainingSource(false);
      }
    }
  };

  // Handle insurance selection in information section
  const handleInsuranceInfoSelect = async (idx: number) => {
    if (idx < 0 || idx >= filteredInsuranceInfoEntries.length) {
      console.error('Invalid insurance index:', idx, 'Array length:', filteredInsuranceInfoEntries.length);
      return;
    }
    
    // This function is no longer used with the new checkbox system
    // Keeping for backward compatibility but it won't be called
    return;
    
    // Also set selectedInsurance on the base form so checks use the selected entry
    setBaseForm(f => ({
      ...f,
      selectedInsurance: {
        insuranceTakenBy: ins.insuranceTakenBy || null,
        insuranceId: ins.insuranceId || null,
      }
    }));
    
    console.log('=== INSURANCE SELECTION DEBUG ===');
    console.log('Selected insurance index:', idx);
    console.log('Selected insurance data:', ins);
    console.log('Fire Policy Amount (raw):', ins?.firePolicyAmount, 'Type:', typeof ins?.firePolicyAmount);
    console.log('Burglary Policy Amount (raw):', ins?.burglaryPolicyAmount, 'Type:', typeof ins?.burglaryPolicyAmount);
    
    // Skip amount fetching for bank-funded insurance
    if (isBankFunded) {
      console.log('🏦 Bank-funded insurance detected - skipping amount validation');
      setInitialRemainingFire('0');
      setInitialRemainingBurglary('0');
      setIsFireRemainingSource(false);
      setIsBurglaryRemainingSource(false);
      return;
    }
    
    try {
      let foundInsurance = null;
      
      // Find insurance based on sourceDocumentId and insuranceId
      if (ins.sourceDocumentId && ins.insuranceId) {
        if (ins.sourceCollection === 'clients') {
          // Find insurance in clients collection by sourceDocumentId and insuranceId
          try {
            const clientDocRef = doc(db, 'clients', ins.sourceDocumentId);
            const clientDocSnap = await getDoc(clientDocRef);
            
            if (clientDocSnap.exists()) {
              const clientData = clientDocSnap.data() as any;
              const insurances = clientData.insurances || [];
              console.log('Client insurances found:', insurances.length);
              console.log('Looking for insuranceId:', ins.insuranceId);
              
              foundInsurance = insurances.find((insurance: any) => {
                console.log('Checking insurance:', insurance.insuranceId, 'against:', ins.insuranceId);
                return insurance.insuranceId === ins.insuranceId;
              });
              
              if (foundInsurance) {
                console.log('Found client insurance:', foundInsurance);
                // Use remaining amounts from client insurance if available, otherwise use policy amounts
                const initialFire = (foundInsurance.remainingFirePolicyAmount ?? foundInsurance.firePolicyRemainingAmount);
                const initialBurglary = (foundInsurance.remainingBurglaryPolicyAmount ?? foundInsurance.burglaryPolicyRemainingAmount);
                
                console.log('Client insurance - Initial Fire:', initialFire, 'Type:', typeof initialFire);
                console.log('Client insurance - Initial Burglary:', initialBurglary, 'Type:', typeof initialBurglary);
                // Set base form original amounts from client insurance if present
                setBaseForm(f => ({
                  ...f,
                  firePolicyAmount: foundInsurance.firePolicyAmount ? String(foundInsurance.firePolicyAmount) : (ins.firePolicyAmount ? String(ins.firePolicyAmount) : ''),
                  burglaryPolicyAmount: foundInsurance.burglaryPolicyAmount ? String(foundInsurance.burglaryPolicyAmount) : (ins.burglaryPolicyAmount ? String(ins.burglaryPolicyAmount) : ''),
                }));
                if (initialFire != null || initialBurglary != null) {
                  setInitialRemainingFire((initialFire ?? '').toString());
                  setInitialRemainingBurglary((initialBurglary ?? '').toString());
                  setIsFireRemainingSource(true);
                  setIsBurglaryRemainingSource(true);
                } else {
                  // fallback to original if remaining not available
                  setInitialRemainingFire(foundInsurance.firePolicyAmount || '');
                  setInitialRemainingBurglary(foundInsurance.burglaryPolicyAmount || '');
                  setIsFireRemainingSource(false);
                  setIsBurglaryRemainingSource(false);
                }
              } else {
                console.log('Insurance not found in client data');
              }
            } else {
              console.log('Client document not found with ID:', ins.sourceDocumentId);
            }
          } catch (error) {
            console.error('Error finding client insurance:', error);
          }
        } else if (ins.sourceCollection === 'agrogreen') {
          // Find insurance in agrogreen collection by sourceDocumentId (which is the document ID)
          try {
            const agrogreenDocRef = doc(db, 'agrogreen', ins.sourceDocumentId);
            const agrogreenDocSnap = await getDoc(agrogreenDocRef);
            
            if (agrogreenDocSnap.exists()) {
              foundInsurance = agrogreenDocSnap.data();
              
              if (foundInsurance) {
                console.log('Found Agrogreen insurance:', foundInsurance);
                // Use remaining amounts from Agrogreen insurance if available, otherwise use policy amounts
                const initialFire = (foundInsurance.remainingFirePolicyAmount ?? foundInsurance.firePolicyRemainingAmount);
                const initialBurglary = (foundInsurance.remainingBurglaryPolicyAmount ?? foundInsurance.burglaryPolicyRemainingAmount);
                
                console.log('Agrogreen insurance - Initial Fire:', initialFire, 'Type:', typeof initialFire);
                console.log('Agrogreen insurance - Initial Burglary:', initialBurglary, 'Type:', typeof initialBurglary);
                // Set base form original amounts from agrogreen insurance if present
                setBaseForm(f => ({
                  ...f,
                  firePolicyAmount: foundInsurance.firePolicyAmount ? String(foundInsurance.firePolicyAmount) : (ins.firePolicyAmount ? String(ins.firePolicyAmount) : ''),
                  burglaryPolicyAmount: foundInsurance.burglaryPolicyAmount ? String(foundInsurance.burglaryPolicyAmount) : (ins.burglaryPolicyAmount ? String(ins.burglaryPolicyAmount) : ''),
                }));
                
                if (initialFire != null || initialBurglary != null) {
                  setInitialRemainingFire((initialFire ?? '').toString());
                  setInitialRemainingBurglary((initialBurglary ?? '').toString());
                  setIsFireRemainingSource(true);
                  setIsBurglaryRemainingSource(true);
                } else {
                  setInitialRemainingFire(foundInsurance.firePolicyAmount || '');
                  setInitialRemainingBurglary(foundInsurance.burglaryPolicyAmount || '');
                  setIsFireRemainingSource(false);
                  setIsBurglaryRemainingSource(false);
                }
              }
            } else {
              console.log('Agrogreen document not found with ID:', ins.sourceDocumentId);
            }
          } catch (error) {
            console.error('Error finding Agrogreen insurance:', error);
          }
        }
      }
      
      // Fallback: If no sourceDocumentId or insuranceId, use the existing logic
      if (!foundInsurance) {
        console.log('No sourceDocumentId or insuranceId found, using fallback logic');
        // Fetch latest remaining values from Firestore
        const inspectionsCollection = collection(db, 'inspections');
        const q = query(inspectionsCollection, where('warehouseName', '==', form.warehouseName));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const inspectionData = querySnapshot.docs[0].data();
          let insuranceList = inspectionData.insuranceEntries || [];
          if (!Array.isArray(insuranceList) && inspectionData.warehouseInspectionData?.insuranceEntries) {
            insuranceList = inspectionData.warehouseInspectionData.insuranceEntries;
          }
          const firestoreIns = insuranceList.find((i: any) => i.firePolicyNumber === ins.firePolicyNumber && i.burglaryPolicyNumber === ins.burglaryPolicyNumber);
          
          console.log('Found Firestore insurance:', firestoreIns);
          
          const fireRemain = firestoreIns?.remainingFirePolicyAmount ?? firestoreIns?.firePolicyRemainingAmount;
          const burgRemain = firestoreIns?.remainingBurglaryPolicyAmount ?? firestoreIns?.burglaryPolicyRemainingAmount;
          // Prefer original amounts from Firestore if present
          const originalFire2 = firestoreIns?.firePolicyAmount ?? ins.firePolicyAmount ?? '';
          const originalBurglary2 = firestoreIns?.burglaryPolicyAmount ?? ins.burglaryPolicyAmount ?? '';
          setBaseForm(f => ({
            ...f,
            firePolicyAmount: originalFire2 !== undefined && originalFire2 !== null ? String(originalFire2) : '',
            burglaryPolicyAmount: originalBurglary2 !== undefined && originalBurglary2 !== null ? String(originalBurglary2) : '',
          }));
          if (fireRemain != null || burgRemain != null) {
            setInitialRemainingFire((fireRemain ?? '').toString());
            setInitialRemainingBurglary((burgRemain ?? '').toString());
            setIsFireRemainingSource(true);
            setIsBurglaryRemainingSource(true);
          } else {
            // Fallback to entry's remaining fields if present
            const entryFireRemain = ins.firePolicyRemainingAmount ?? ins.remainingFirePolicyAmount;
            const entryBurgRemain = ins.burglaryPolicyRemainingAmount ?? ins.remainingBurglaryPolicyAmount;
            if (entryFireRemain != null || entryBurgRemain != null) {
              setInitialRemainingFire((entryFireRemain ?? '').toString());
              setInitialRemainingBurglary((entryBurgRemain ?? '').toString());
              setIsFireRemainingSource(true);
              setIsBurglaryRemainingSource(true);
            } else {
              // Last resort original amounts (marked as non-remaining source)
              setInitialRemainingFire(ins.firePolicyAmount || '');
              setInitialRemainingBurglary(ins.burglaryPolicyAmount || '');
              setIsFireRemainingSource(false);
              setIsBurglaryRemainingSource(false);
            }
          }
        } else {
          // If no Firestore data, use policy amounts
          const entryFireRemain = ins.firePolicyRemainingAmount ?? ins.remainingFirePolicyAmount;
          const entryBurgRemain = ins.burglaryPolicyRemainingAmount ?? ins.remainingBurglaryPolicyAmount;
          // Ensure base form has original amounts from selected entry
          setBaseForm(f => ({
            ...f,
            firePolicyAmount: ins.firePolicyAmount ? String(ins.firePolicyAmount) : '',
            burglaryPolicyAmount: ins.burglaryPolicyAmount ? String(ins.burglaryPolicyAmount) : '',
          }));
          if (entryFireRemain != null || entryBurgRemain != null) {
            setInitialRemainingFire((entryFireRemain ?? '').toString());
            setInitialRemainingBurglary((entryBurgRemain ?? '').toString());
            setIsFireRemainingSource(true);
            setIsBurglaryRemainingSource(true);
          } else {
            const initialFire = ins.firePolicyAmount || '';
            const initialBurglary = ins.burglaryPolicyAmount || '';
            setInitialRemainingFire(initialFire);
            setInitialRemainingBurglary(initialBurglary);
            setIsFireRemainingSource(false);
            setIsBurglaryRemainingSource(false);
          }
          
          console.log('No Firestore data - Remaining/Original selection applied');
        }
      }
    } catch (error) {
      console.error('Error finding insurance:', error);
      // Fallback to policy amounts on error
      const entryFireRemain = ins.firePolicyRemainingAmount ?? ins.remainingFirePolicyAmount;
      const entryBurgRemain = ins.burglaryPolicyRemainingAmount ?? ins.remainingBurglaryPolicyAmount;
      // Ensure base form has original amounts from selected entry on error
      setBaseForm(f => ({
        ...f,
        firePolicyAmount: ins.firePolicyAmount ? String(ins.firePolicyAmount) : '',
        burglaryPolicyAmount: ins.burglaryPolicyAmount ? String(ins.burglaryPolicyAmount) : '',
      }));
      if (entryFireRemain != null || entryBurgRemain != null) {
        setInitialRemainingFire((entryFireRemain ?? '').toString());
        setInitialRemainingBurglary((entryBurgRemain ?? '').toString());
        setIsFireRemainingSource(true);
        setIsBurglaryRemainingSource(true);
      } else {
        const initialFire = ins.firePolicyAmount || '';
        const initialBurglary = ins.burglaryPolicyAmount || '';
        
        console.log('Error fallback - Using original amounts');
        
        setInitialRemainingFire(initialFire);
        setInitialRemainingBurglary(initialBurglary);
        setIsFireRemainingSource(false);
        setIsBurglaryRemainingSource(false);
      }
    }
    console.log('=== END INSURANCE SELECTION DEBUG ===');
  };

  // Debug function to examine client insurance data structure
  const debugClientInsuranceData = async (clientId: string, insuranceId: string) => {
    try {
      console.log('=== DEBUGGING CLIENT INSURANCE DATA ===');
      console.log('Client ID:', clientId);
      console.log('Insurance ID:', insuranceId);
      
      const clientDocRef = doc(db, 'clients', clientId);
      const clientDocSnap = await getDoc(clientDocRef);
      
      if (clientDocSnap.exists()) {
        const clientData = clientDocSnap.data() as any;
        console.log('Client data structure:', Object.keys(clientData));
        
        const insurances = clientData.insurances || [];
        console.log('Number of insurances:', insurances.length);
        
        insurances.forEach((insurance: any, index: number) => {
          console.log(`Insurance ${index + 1}:`, {
            insuranceId: insurance.insuranceId,
            firePolicyAmount: insurance.firePolicyAmount,
            burglaryPolicyAmount: insurance.burglaryPolicyAmount,
            remainingFirePolicyAmount: insurance.remainingFirePolicyAmount,
            remainingBurglaryPolicyAmount: insurance.remainingBurglaryPolicyAmount,
            firePolicyNumber: insurance.firePolicyNumber,
            burglaryPolicyNumber: insurance.burglaryPolicyNumber
          });
        });
        
        const targetInsurance = insurances.find((insurance: any) => insurance.insuranceId === insuranceId);
        if (targetInsurance) {
          console.log('Target insurance found:', targetInsurance);
        } else {
          console.log('Target insurance not found');
        }
      } else {
        console.log('Client document does not exist');
      }
      console.log('=== END DEBUGGING ===');
    } catch (error) {
      console.error('Error debugging client insurance data:', error);
    }
  };

  // Helper function to format amount values
  const formatAmount = (amount: any): string => {
    if (amount === null || amount === undefined || amount === '') {
      return '0.00';
    }
    
    // Convert to number if it's a string
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    
    // Check if it's a valid number
    if (isNaN(numAmount)) {
      console.warn('Invalid amount value:', amount, 'Type:', typeof amount);
      return '0.00';
    }
    
    // If the amount is 0 or very small, check if it's actually a valid amount
    if (numAmount === 0 || numAmount < 0.01) {
      console.warn('Amount is 0 or very small, might be missing data:', amount);
      return '0.00';
    }
    
    return numAmount.toFixed(2);
  };

  // Recalculate remaining amounts when total value or initial amounts change
  useEffect(() => {
    if (selectedInsuranceForInward && (initialRemainingFire || initialRemainingBurglary)) {
      const totalValue = parseFloat(baseForm.totalValue) || 0;
      const initialFire = parseFloat(initialRemainingFire) || 0;
      const initialBurglary = parseFloat(initialRemainingBurglary) || 0;
      
      const remainingFire = isFireRemainingSource ? (initialFire - totalValue) : initialFire;
      const remainingBurglary = isBurglaryRemainingSource ? (initialBurglary - totalValue) : initialBurglary;
      
      setRemainingFirePolicy(remainingFire >= 0 ? remainingFire.toFixed(2) : '0.00');
      setRemainingBurglaryPolicy(remainingBurglary >= 0 ? remainingBurglary.toFixed(2) : '0.00');
    }
  }, [selectedInsuranceForInward, initialRemainingFire, initialRemainingBurglary, baseForm.totalValue, isFireRemainingSource, isBurglaryRemainingSource]);

  // Check for Agrogreen insurance when warehouse changes
  useEffect(() => {
    const checkAgrogreenInsurance = async () => {
      if (!form.warehouseName) {
        setAgrogreenInsurance(null);
        return;
      }
      try {
        const inspectionsCollection = collection(db, 'inspections');
        const inspectionQuery = query(
          inspectionsCollection,
          where('warehouseName', '==', form.warehouseName),
          where('status', 'in', ['activated', 'reactivate'])
        );
        const inspectionSnapshot = await getDocs(inspectionQuery);
        let foundAgrogreen: any = null;
        inspectionSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const warehouseData = data.warehouseInspectionData;
          if (warehouseData && warehouseData.insuranceTakenBy?.toLowerCase() === 'agrogreen') {
            foundAgrogreen = {
              id: `agrogreen_${doc.id}`,
              insuranceId: `AGROGREEN_${form.warehouseName}`,
              insuranceTakenBy: 'Agrogreen',
              firePolicyCompanyName: warehouseData.firePolicyCompanyName || '',
              firePolicyNumber: warehouseData.firePolicyNumber || '',
              firePolicyAmount: warehouseData.firePolicyAmount || '0',
              remainingFirePolicyAmount: warehouseData.firePolicyAmount || '0',
              firePolicyStartDate: warehouseData.firePolicyStartDate || null,
              firePolicyEndDate: warehouseData.firePolicyEndDate || null,
              burglaryPolicyCompanyName: warehouseData.burglaryPolicyCompanyName || '',
              burglaryPolicyNumber: warehouseData.burglaryPolicyNumber || '',
              burglaryPolicyAmount: warehouseData.burglaryPolicyAmount || '0',
              remainingBurglaryPolicyAmount: warehouseData.burglaryPolicyAmount || '0',
              burglaryPolicyStartDate: warehouseData.burglaryPolicyStartDate || null,
              burglaryPolicyEndDate: warehouseData.burglaryPolicyEndDate || null,
            };
          }
        });
        setAgrogreenInsurance(foundAgrogreen);
      } catch (error) {
        console.error('Error checking Agrogreen insurance:', error);
        setAgrogreenInsurance(null);
      }
    };
    checkAgrogreenInsurance();
  }, [form.warehouseName]);

  // ... inside InwardPage component, after other useState hooks ...
  const [isPrinting, setIsPrinting] = useState(false);
  // ... rest of the code unchanged ...

  // ... inside InwardPage component, after other useState hooks ...
  const [showPrintDebug, setShowPrintDebug] = useState(false);
  // ...
  // Add a toggle button for debug mode above the DialogContent/modal rendering:
  <div className="flex justify-end mb-2">
    <Button onClick={() => setShowPrintDebug(v => !v)} className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-1 text-xs">
      {showPrintDebug ? 'Hide Print Debug' : 'Show Print Debug'}
    </Button>
  </div>
  // ...
  // Render the print area visibly if debug is on, otherwise keep it hidden as before:
  {(isFormApproved || selectedRowForSR?.status === 'approved') && (
    <div style={showPrintDebug ? { position: 'static', margin: '32px 0', zIndex: 1000, background: '#fff' } : { position: 'absolute', left: '-9999px', top: 0, zIndex: -1 }}>
      <div ref={printRef}>
        <StorageReceipt
          data={{
            srNo: generateSRNo(selectedRowForSR),
            srGenerationDate: (selectedRowForSR?.srGenerationDate ? normalizeDate(selectedRowForSR.srGenerationDate) : (srGenerationDate || '-')),
            dateOfIssue: selectedRowForSR?.dateOfInward || '',
            baseReceiptNo: selectedRowForSR?.baseReceiptNo || selectedRowForSR?.bankReceipt || '-',
            cadNo: selectedRowForSR?.cadNo || selectedRowForSR?.cadNumber || '',
            dateOfDeposit: selectedRowForSR?.dateOfInward || '',
            branch: selectedRowForSR?.branch || '-',
            warehouseName: selectedRowForSR?.warehouseName || '',
            warehouseAddress: selectedRowForSR?.warehouseAddress || '',
            client: selectedRowForSR?.client || '',
            clientAddress: (() => {
              // Get clientAddress from matched insurance entry
              const sel = selectedRowForSR?.selectedInsurance;
              let matched: any = null;
              try {
                if (sel && inspectionInsuranceData && inspectionInsuranceData.length) {
                  matched = inspectionInsuranceData.find((i: any) => i.insuranceId === sel.insuranceId && i.insuranceTakenBy === sel.insuranceTakenBy) || null;
                }
              } catch (e) {
                matched = null;
              }
              matched = matched || inspectionInsuranceData[0] || null;
              return matched?.clientAddress || selectedRowForSR?.clientAddress || '';
            })(),
            commodity: selectedRowForSR?.commodity || '',
            totalBags: selectedRowForSR?.totalBags || '',
            netWeight: selectedRowForSR?.totalQuantity || '',
            grade: selectedRowForSR?.grade || '-',
            remarks: selectedRowForSR?.remarks || '-',
            marketRate: selectedRowForSR?.marketRate || '',
            valueOfCommodity: selectedRowForSR?.totalValue || '',
            hologramNumber: selectedRowForSR?.hologramNumber || hologramNumber || '',
            insuranceDetails: (() => {
              // Collect client, agrogreen, bank funded policies for display
              const filtered = (inspectionInsuranceData || []).filter((ins: any) => {
                const t = (ins.insuranceTakenBy || '').toLowerCase();
                return ['client','agrogreen','bank','bank-funded'].includes(t);
              });
              const base = filtered.length ? filtered : (inspectionInsuranceData[0] ? [inspectionInsuranceData[0]] : []);
              return base.map((matched: any) => ({
                policyNo: matched?.firePolicyNumber || '-',
                company: matched?.firePolicyCompanyName || '-',
                validFrom: matched?.firePolicyStartDate ? normalizeDate(matched.firePolicyStartDate) : '-',
                validTo: matched?.firePolicyEndDate ? normalizeDate(matched.firePolicyEndDate) : '-',
                sumInsured: matched?.firePolicyAmount || '-',
                insuranceTakenBy: matched?.insuranceTakenBy || ''
              }));
            })(),
            bankName: selectedRowForSR?.bankName || '',
            date: selectedRowForSR?.dateOfInward || '',
            place: selectedRowForSR?.branch || '',
            stockInwardDate: selectedRowForSR?.dateOfInward || '-',
            receiptType: selectedRowForSR?.receiptType || 'SR',
            varietyName: selectedRowForSR?.varietyName || '',
            dateOfSampling: selectedRowForSR?.dateOfSampling || '',
            dateOfTesting: selectedRowForSR?.dateOfTesting || '',
          }}
        />
      </div>
      <div ref={testCertRef}>
        <TestCertificate
          client={selectedRowForSR?.client || ''}
          clientAddress={selectedRowForSR?.clientAddress || ''}
          commodity={selectedRowForSR?.commodity || ''}
          varietyName={selectedRowForSR?.varietyName || ''}
          warehouseName={selectedRowForSR?.warehouseName || ''}
          warehouseAddress={selectedRowForSR?.warehouseAddress || ''}
          totalBags={selectedRowForSR?.totalBags || ''}
          dateOfSampling={selectedRowForSR?.dateOfSampling || ''}
          dateOfTesting={selectedRowForSR?.dateOfTesting || ''}
          qualityParameters={(() => {
            const commodity = commodities.find((c: any) => c.commodityName === selectedRowForSR?.commodity);
            const variety = commodity?.varieties?.find((v: any) => v.varietyName === selectedRowForSR?.varietyName);
            const particulars = variety?.particulars || [];
            return particulars.map((p: any, idx: number) => ({
              name: p.name,
              minPercentage: p.minPercentage,
              maxPercentage: p.maxPercentage,
              actual: typeof selectedRowForSR?.labResults?.[idx] === 'object' && selectedRowForSR.labResults[idx]?.value ? selectedRowForSR.labResults[idx].value : (selectedRowForSR?.labResults?.[idx] || ''),
            }));
          })()}
        />
      </div>
    </div>
  )}
  // ... rest unchanged ...

  // Columns to hide from the UI table but keep in CSV export
  const hiddenUIColumnKeys = useMemo(
    () => new Set([
      "grossWeight",
      "tareWeight",
      "netWeight",
      "averageWeight",
      "vehicleNumber",
      "getpassNumber",
      "weightBridge",
      "weightBridgeSlipNumber",
    ]),
    []
  );

  // Columns used for UI (excluded hidden ones)
  const uiColumns = useMemo(
    () => columns.filter(col => !hiddenUIColumnKeys.has(col.accessorKey)),
    [columns, hiddenUIColumnKeys]
  );

  const [visibleColumnKeys, setVisibleColumnKeys] = useState(() => uiColumns.map(col => col.accessorKey));

  // Helper to get all column keys for UI toggle
  const allColumnKeys = useMemo(() => uiColumns.map(col => col.accessorKey), [uiColumns]);

  // Filter UI columns based on visibleColumnKeys
  const visibleColumns = useMemo(() => {
    return uiColumns.filter(col => visibleColumnKeys.includes(col.accessorKey));
  }, [uiColumns, visibleColumnKeys]);

  // Add state for CIR modal and logic for Approve, Reject, Resubmit
  const [showCIRModal, setShowCIRModal] = useState(false);
  const [cirModalData, setCIRModalData] = useState<any>(null);
  const [cirReadOnly, setCIRReadOnly] = useState(true);
  const [cirRemarks, setCIRRemarks] = useState(''); // <-- CIR remarks state
  
  // Add state for expand entries modal
  const [showExpandModal, setShowExpandModal] = useState(false);
  const [expandModalData, setExpandModalData] = useState<any>(null);
  const [isExpandingEntries, setIsExpandingEntries] = useState(false);

  async function handleExpandEntries(row: any) {
    try {
      setIsExpandingEntries(true);
      console.log('Expanding entries for row:', row);

      // Fetch complete inward entries data from the database
      let inwardEntries = row.inwardEntries || [];

      // If inwardEntries is missing or empty, fetch from database
      if ((!inwardEntries || inwardEntries.length === 0) && row.inwardId) {
        console.log('Fetching inward entries from database for inwardId:', row.inwardId);
        const inwardCollection = collection(db, 'inward');
        const q = query(inwardCollection, where('inwardId', '==', row.inwardId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const docData = querySnapshot.docs[0].data();
          inwardEntries = docData.inwardEntries || [];
          console.log('Fetched inward entries from database:', inwardEntries);
        }
      }

      // Calculate total entries count
      const totalEntries = inwardEntries.length;

      // Prepare the expand modal data with complete information
      const expandData = {
        ...row,
        inwardEntries: inwardEntries,
        totalEntries: totalEntries
      };

      console.log('Setting expand modal data:', expandData);
      setExpandModalData(expandData);
      setShowExpandModal(true);

    } catch (error) {
      console.error('Error expanding entries:', error);
      toast({
        title: "Error",
        description: "Failed to load inward entries data.",
        variant: "destructive",
      });
    } finally {
      setIsExpandingEntries(false);
    }
  }

  // Handle viewing uploaded attachment for an inward row
  function handleViewAttachment(row: any) {
    try {
      const attachment = row?.attachmentUrl;
      if (!attachment || (Array.isArray(attachment) && attachment.length === 0)) {
        toast({
          title: 'No Attachment',
          description: 'No uploaded attachment found for this inward entry.',
          variant: 'destructive'
        });
        return;
      }

      if (Array.isArray(attachment)) {
        // If multiple, open the first and inform the user
        const first = attachment[0];
        if (first) {
          window.open(first, '_blank');
          toast({
            title: 'Opening Attachment',
            description: `Multiple attachments detected (${attachment.length}). Opened the first one.`,
          });
        }
        return;
      }

      // Single URL string
      if (typeof attachment === 'string') {
        window.open(attachment, '_blank');
        return;
      }

      // Unknown structure
      toast({
        title: 'Attachment Unavailable',
        description: 'Could not open the attachment due to an unsupported format.',
        variant: 'destructive'
      });
    } catch (e) {
      console.error('Error opening attachment:', e);
      toast({
        title: 'Error',
        description: 'Failed to open attachment. Please try again.',
        variant: 'destructive'
      });
    }
  }

  async function handleCIRView(row: any) {
    setCIRReadOnly(true);
    setShowCIRModal(true);

    // Fetch insurance entries from insurance master collection (single source of truth)
    let insuranceEntries = [];
    if (row.warehouseName && row.state && row.branch && row.location) {
      console.log('🔍 CIR: Fetching insurance from master collection for:', row.warehouseName);
      
      // First check insurance master collection
      const insuranceMasterCollection = collection(db, 'insurance');
      const masterQuery = query(
        insuranceMasterCollection,
        where('warehouseName', '==', row.warehouseName),
        where('state', '==', row.state),
        where('branch', '==', row.branch),
        where('location', '==', row.location)
      );
      
      const masterSnapshot = await getDocs(masterQuery);
      if (!masterSnapshot.empty) {
        console.log('✅ CIR: Found insurance in master collection:', masterSnapshot.docs.length);
        insuranceEntries = masterSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            insuranceId: data.insuranceCode || doc.id,
            insuranceTakenBy: data.insuranceType || 'client',
            firePolicyEndDate: data.firePolicyEndDate,
            burglaryPolicyEndDate: data.burglaryPolicyEndDate,
            firePolicyAmount: data.firePolicyAmount,
            burglaryPolicyAmount: data.burglaryPolicyAmount,
            firePolicyRemainingAmount: data.firePolicyRemainingAmount,
            burglaryPolicyRemainingAmount: data.burglaryPolicyRemainingAmount,
            firePolicyCompanyName: data.firePolicyCompanyName,
            burglaryPolicyCompanyName: data.burglaryPolicyCompanyName,
            firePolicyNumber: data.firePolicyNumber,
            burglaryPolicyNumber: data.burglaryPolicyNumber,
            firePolicyStartDate: data.firePolicyStartDate,
            burglaryPolicyStartDate: data.burglaryPolicyStartDate,
            commodityName: data.commodityName,
            clientName: data.clientName,
            clientAddress: data.clientAddress || ''
          };
        });
      } else {
        console.log('⚠️ CIR: No insurance in master, checking inspections as fallback...');
        // Fallback to inspections collection
        const inspectionsCollection = collection(db, 'inspections');
        const q = query(inspectionsCollection, where('warehouseName', '==', row.warehouseName));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const inspectionData = querySnapshot.docs[0].data();
          if (inspectionData.insuranceEntries && Array.isArray(inspectionData.insuranceEntries)) {
            insuranceEntries = inspectionData.insuranceEntries;
          } else if (inspectionData.warehouseInspectionData?.insuranceEntries && Array.isArray(inspectionData.warehouseInspectionData.insuranceEntries)) {
            insuranceEntries = inspectionData.warehouseInspectionData.insuranceEntries;
          }
        }
      }
    }

    // Find the correct insurance entry from master collection
    let yourInsurance = null;
    let selectedInsuranceEntries = [];
    
    if (row.selectedInsurance && insuranceEntries.length > 0) {
      const sel = row.selectedInsurance;
      const matchDirect = insuranceEntries.find(
        (ins: any) =>
          (ins.insuranceId === sel.insuranceId || ins.insuranceId === sel.insuranceId?.trim()) &&
          (ins.insuranceTakenBy?.toLowerCase() === sel.insuranceTakenBy?.toLowerCase())
      ) || null;

      // Fallback: try by takenBy only (Agrogreen / Client) if id mismatch
      const matchByTakenBy = matchDirect || insuranceEntries.find(
        (ins: any) => ins.insuranceTakenBy?.toLowerCase() === sel.insuranceTakenBy?.toLowerCase()
      ) || null;

      // Normalizer to guarantee fields present for CIRReceipt
      const normalizeInsurance = (ins: any) => ({
        insuranceId: ins?.insuranceId || ins?.id || sel.insuranceId || '-',
        insuranceTakenBy: ins?.insuranceTakenBy || sel.insuranceTakenBy || '-',
        firePolicyNumber: ins?.firePolicyNumber || ins?.firePolicyNo || '-',
        firePolicyAmount: ins?.firePolicyAmount || ins?.firePolicySumInsured || ins?.remainingFirePolicyAmount || '-',
        firePolicyStartDate: ins?.firePolicyStartDate || ins?.firePolicyStart || null,
        firePolicyEndDate: ins?.firePolicyEndDate || ins?.firePolicyEnd || null,
        burglaryPolicyNumber: ins?.burglaryPolicyNumber || ins?.burglaryPolicyNo || '-',
        burglaryPolicyAmount: ins?.burglaryPolicyAmount || ins?.burglaryPolicySumInsured || ins?.remainingBurglaryPolicyAmount || '-',
        burglaryPolicyStartDate: ins?.burglaryPolicyStartDate || ins?.burglaryPolicyStart || null,
        burglaryPolicyEndDate: ins?.burglaryPolicyEndDate || ins?.burglaryPolicyEnd || null,
        firePolicyCompanyName: ins?.firePolicyCompanyName || '-',
        burglaryPolicyCompanyName: ins?.burglaryPolicyCompanyName || '-',
        clientName: ins?.clientName || row.client || '-',
        clientAddress: ins?.clientAddress || row.clientAddress || '',
        selectedBankName: ins?.selectedBankName || ins?.bankName || '-',
        // Add commodity mapping (multiple possible keys) used by CIRReceipt for bank-funded display
        commodityName: ins?.commodityName || ins?.insuranceCommodity || ins?.commodity || row.commodity || '-',
        varietyName: ins?.varietyName || row.varietyName || '',
      });

      yourInsurance = matchByTakenBy ? normalizeInsurance(matchByTakenBy) : null;

      // If still not found and takenBy agrogreen/client, attempt inspection collection fresh fetch
      if (!yourInsurance && sel.insuranceTakenBy) {
        const takenByLower = sel.insuranceTakenBy.toLowerCase();
        if ((takenByLower === 'agrogreen' || takenByLower === 'client') && row.warehouseName) {
          try {
            const inspectionsCollection = collection(db, 'inspections');
            const q = query(inspectionsCollection, where('warehouseName', '==', row.warehouseName));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const inspectionData = snap.docs[0].data();
              let entries: any[] = [];
              if (Array.isArray(inspectionData.insuranceEntries)) entries = inspectionData.insuranceEntries;
              else if (inspectionData.warehouseInspectionData?.insuranceEntries && Array.isArray(inspectionData.warehouseInspectionData.insuranceEntries)) entries = inspectionData.warehouseInspectionData.insuranceEntries;
              const fallback = entries.find((e: any) => e.insuranceTakenBy?.toLowerCase() === takenByLower);
              if (fallback) {
                yourInsurance = normalizeInsurance(fallback);
                console.log('🔄 CIR: Fallback fetched insurance from inspections for', takenByLower);
              }
            }
          } catch (e) {
            console.warn('CIR: Fallback inspection fetch failed', e);
          }
        }
      }

      if (yourInsurance) {
        selectedInsuranceEntries = [yourInsurance];
        console.log('✅ CIR: Using ONLY selected insurance for display:', yourInsurance.insuranceId, yourInsurance.insuranceTakenBy);
      } else {
        selectedInsuranceEntries = [];
        console.log('⚠️ CIR: Selected insurance not resolved; insurance section will be empty');
      }
    } else {
      selectedInsuranceEntries = [];
      console.log('ℹ️ CIR: No selectedInsurance present; insurance section will be empty');
    }

    // Prepare lab parameter names from commodity/variety
    let labParameterNames = [];
    if (row.commodity && row.varietyName && typeof getCommodityVarieties === 'function') {
      const varieties = getCommodityVarieties(row.commodity);
      const variety = varieties.find((v: any) => v.varietyName === row.varietyName);
      if (variety && Array.isArray(variety.qualityParameters)) {
        labParameterNames = variety.qualityParameters.map((p: any) => p.parameterName);
      }
    }

    // If inwardEntries missing, fetch all entries for this inwardId from the inward collection
    let inwardEntries = row.inwardEntries || [];
    if ((!inwardEntries || inwardEntries.length === 0) && row.inwardId) {
      const inwardCollection = collection(db, 'inward');
      const q = query(inwardCollection, where('inwardId', '==', row.inwardId));
      const querySnapshot = await getDocs(q);
      inwardEntries = querySnapshot.docs.map(doc => doc.data());
    }

    // Patch: Always prefer main row's fields, then inwardEntries[0] if missing
    let patchFields: Record<string, any> = {};
    const keys = [
      'vehicleNumber', 'getpassNumber', 'weightBridge', 'weightBridgeSlipNumber',
      'grossWeight', 'tareWeight', 'netWeight', 'averageWeight', 'totalBags', 'totalQuantity',
      'stacks'
    ];
    
    // First try to get data from the main row
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        patchFields[key] = row[key];
      }
    }
    
    // If we still have missing data, try to get it from inwardEntries
    if (inwardEntries && inwardEntries.length > 0) {
      for (const key of keys) {
        if ((patchFields[key] === undefined || patchFields[key] === null || patchFields[key] === '') && 
            inwardEntries[0][key] !== undefined && inwardEntries[0][key] !== null && inwardEntries[0][key] !== '') {
          patchFields[key] = inwardEntries[0][key];
        }
      }
    }
    
    // Lab parameters are now stored at document level, so get them directly from row
    patchFields.dateOfSampling = row.dateOfSampling || '';
    patchFields.dateOfTesting = row.dateOfTesting || '';
    patchFields.labResults = row.labResults || [];
    
    // Include reservation/billing fields from row
    patchFields.reservationStatus = row.reservationStatus || '';
    patchFields.billingStatus = row.billingStatus || '';
    patchFields.reservationRate = row.reservationRate || '';
    patchFields.reservationQty = row.reservationQty || '';
    patchFields.reservationStart = row.reservationStart || '';
    patchFields.reservationEnd = row.reservationEnd || '';
    patchFields.billingCycle = row.billingCycle || '';
    patchFields.billingType = row.billingType || '';
    patchFields.billingRate = row.billingRate || '';

    // Set CIR modal data with ONLY the selected insurance entry
    const modalData = {
      ...row,
      ...patchFields,
      yourInsurance,
      inwardEntries,
      labParameterNames,
      insuranceEntries: selectedInsuranceEntries, // Only show the selected insurance
      clientAddress: yourInsurance?.clientAddress || row.clientAddress || '', // Get from insurance or row
    };
    
    console.log('=== CIR Modal Data Debug ===');
    console.log('reservationStatus:', modalData.reservationStatus);
    console.log('reservationRate:', modalData.reservationRate);
    console.log('reservationQty:', modalData.reservationQty);
    console.log('billingCycle:', modalData.billingCycle);
    console.log('billingStatus:', modalData.billingStatus);
    console.log('businessType:', modalData.businessType);
    console.log('Full modalData:', modalData);
    
    setCIRModalData(modalData);
    // Auto-fetch last saved remarks from collection so it appears next time automatically
    try {
      if (row?.inwardId) {
        const inwardCollection = collection(db, 'inward');
        const q = query(inwardCollection, where('inwardId', '==', row.inwardId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const data = querySnapshot.docs[0].data() as any;
          // Prefer explicit remarks field if present, fallback to any older key variants
          const savedRemarks = data?.remarks || data?.cirRemarks || '';
          setCIRRemarks(savedRemarks || row.remarks || '');
        } else {
          setCIRRemarks(row.remarks || '');
        }
      } else {
        setCIRRemarks(row.remarks || '');
      }
    } catch (e) {
      // In case of any read issue, keep existing (row) remarks
      setCIRRemarks(row.remarks || '');
    }
  };

  const handleCIRApprove = async () => {
    if (cirModalData) {
      try {
        console.log('🔄 CIR: Approving entry with ID:', cirModalData.inwardId);
        // Update cirStatus in Firestore
        const inwardCollection = collection(db, 'inward');
        const q = query(inwardCollection, where('inwardId', '==', cirModalData.inwardId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docRef = doc(db, 'inward', querySnapshot.docs[0].id);
          await updateDoc(docRef, { cirStatus: 'Approved', remarks: cirRemarks });
          console.log('✅ CIR: Successfully approved entry');
          
          // Refresh the data to show updated status
          await fetchData();
          console.log('✅ CIR: Data refreshed after approval');
        } else {
          console.error('❌ CIR: No document found with inwardId:', cirModalData.inwardId);
        }
        setShowCIRModal(false);
      } catch (error) {
        console.error('❌ CIR: Error approving entry:', error);
      }
    }
  };

  // Helper: adjust insurance remaining/used amounts when CIR status changes
  // delta > 0 means add back (e.g., Reject/Resubmit). delta < 0 would deduct.
  const adjustInsuranceForCIR = async (delta: number) => {
    try {
      if (!cirModalData) return;
      const amount = parseFloat(cirModalData.totalValue) || 0;
      if (amount <= 0) return;

      // Use selected insurance entry shown in the CIR modal when available
      const selectedIns = Array.isArray(cirModalData.insuranceEntries) && cirModalData.insuranceEntries.length > 0
        ? cirModalData.insuranceEntries[0]
        : null;

      // 1) Update Insurance Master collection
      try {
        const insuranceMasterCollection = collection(db, 'insurance');
        // Prefer matching by warehouse + policy numbers when available
        const masterQuery = query(
          insuranceMasterCollection,
          where('warehouseName', '==', cirModalData.warehouseName)
        );
        const masterSnap = await getDocs(masterQuery);
        if (!masterSnap.empty) {
          // Filter to matching doc using policy numbers if we have them; otherwise fallback to commodity/variety
          const matchedDoc = masterSnap.docs.find(doc => {
            const data: any = doc.data();
            if (selectedIns?.firePolicyNumber && selectedIns?.burglaryPolicyNumber) {
              return (
                (data.firePolicyNumber === selectedIns.firePolicyNumber) &&
                (data.burglaryPolicyNumber === selectedIns.burglaryPolicyNumber)
              );
            }
            // Fallback by commodity/variety
            return (
              (data.commodityName?.toLowerCase().trim() === (cirModalData.commodity || '').toLowerCase().trim()) &&
              (data.varietyName?.toLowerCase().trim() === (cirModalData.varietyName || '').toLowerCase().trim())
            );
          });

          if (matchedDoc) {
            const data: any = matchedDoc.data();
            const totalFire = parseFloat(data.firePolicyAmount || '0');
            const totalBurg = parseFloat(data.burglaryPolicyAmount || '0');
            const usedFire = parseFloat(data.firePolicyUsedAmount || '0');
            const usedBurg = parseFloat(data.burglaryPolicyUsedAmount || '0');
            const remainFire = parseFloat(data.firePolicyRemainingAmount || '0');
            const remainBurg = parseFloat(data.burglaryPolicyRemainingAmount || '0');

            // Add back on Reject/Resubmit (delta > 0)
            const newUsedFire = Math.max(0, usedFire - amount);
            const newUsedBurg = Math.max(0, usedBurg - amount);
            const newRemainFire = Math.min(totalFire, remainFire + amount);
            const newRemainBurg = Math.min(totalBurg, remainBurg + amount);

            await updateDoc(doc(db, 'insurance', matchedDoc.id), {
              firePolicyUsedAmount: newUsedFire.toFixed(2),
              firePolicyRemainingAmount: newRemainFire.toFixed(2),
              burglaryPolicyUsedAmount: newUsedBurg.toFixed(2),
              burglaryPolicyRemainingAmount: newRemainBurg.toFixed(2),
              lastUpdated: new Date().toISOString()
            });
          }
        }
      } catch (e) {
        console.warn('CIR insurance master adjust warning:', e);
      }

      // 2) Update inspections collection remaining fields
      try {
        const inspectionsCollection = collection(db, 'inspections');
        const q = query(inspectionsCollection, where('warehouseName', '==', cirModalData.warehouseName));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docRef = doc(db, 'inspections', snap.docs[0].id);
          const inspectionData: any = snap.docs[0].data();
          let insuranceList = inspectionData.insuranceEntries || [];
          if (!Array.isArray(insuranceList) && inspectionData.warehouseInspectionData?.insuranceEntries) {
            insuranceList = inspectionData.warehouseInspectionData.insuranceEntries;
          }

          const updated = insuranceList.map((i: any) => {
            const isMatch = selectedIns?.firePolicyNumber && selectedIns?.burglaryPolicyNumber
              ? (i.firePolicyNumber === selectedIns.firePolicyNumber && i.burglaryPolicyNumber === selectedIns.burglaryPolicyNumber)
              : false;
            if (!isMatch) return i;

            const origFire = parseFloat(i.firePolicyAmount || '0');
            const origBurg = parseFloat(i.burglaryPolicyAmount || '0');
            const curRemainFire = parseFloat(i.remainingFirePolicyAmount ?? i.firePolicyRemainingAmount ?? '0');
            const curRemainBurg = parseFloat(i.remainingBurglaryPolicyAmount ?? i.burglaryPolicyRemainingAmount ?? '0');
            const newRemainFire = Math.min(origFire, curRemainFire + amount);
            const newRemainBurg = Math.min(origBurg, curRemainBurg + amount);

            return {
              ...i,
              remainingFirePolicyAmount: newRemainFire.toFixed(2),
              remainingBurglaryPolicyAmount: newRemainBurg.toFixed(2)
            };
          });

          await updateDoc(docRef, { insuranceEntries: updated });
        }
      } catch (e) {
        console.warn('CIR inspections adjust warning:', e);
      }
    } catch (err) {
      console.error('CIR insurance adjust error:', err);
    }
  };

  const handleCIRReject = async () => {
    if (cirModalData) {
      try {
        console.log('🔄 CIR: Rejecting entry with ID:', cirModalData.inwardId);
        const inwardCollection = collection(db, 'inward');
        const q = query(inwardCollection, where('inwardId', '==', cirModalData.inwardId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docRef = doc(db, 'inward', querySnapshot.docs[0].id);
          await updateDoc(docRef, { cirStatus: 'Rejected', remarks: cirRemarks });
          console.log('✅ CIR: Successfully rejected entry');

          // Add back the total value to insurance remaining amounts
          await adjustInsuranceForCIR(+1);
          
          // Refresh the data to show updated status
          await fetchData();
          console.log('✅ CIR: Data refreshed after rejection');
        }
        setShowCIRModal(false);
      } catch (error) {
        console.error('❌ CIR: Error rejecting entry:', error);
      }
    }
  };

  const handleCIRResubmit = async () => {
    if (cirModalData) {
      try {
        console.log('🔄 CIR: Resubmitting entry with ID:', cirModalData.inwardId);
        const inwardCollection = collection(db, 'inward');
        const q = query(inwardCollection, where('inwardId', '==', cirModalData.inwardId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docRef = doc(db, 'inward', querySnapshot.docs[0].id);
          await updateDoc(docRef, { cirStatus: 'Resubmitted', remarks: cirRemarks });
          console.log('✅ CIR: Successfully resubmitted entry');

          // Add back the total value to insurance remaining amounts
          await adjustInsuranceForCIR(+1);
          
          // Refresh the data to show updated status
          await fetchData();
          console.log('✅ CIR: Data refreshed after resubmission');
        }
        setShowCIRModal(false);
        
        // Open edit inward modal for this entry
        handleEdit(cirModalData);
      } catch (error) {
        console.error('❌ CIR: Error resubmitting entry:', error);
      }
    }
  };

  const handleCIRSave = () => {
    // Save changes and set status to Resubmitted
    if (cirModalData) {
      cirModalData.cirStatus = 'Resubmitted';
      setCIRReadOnly(true);
      setShowCIRModal(false);
      // Optionally trigger a re-fetch or state update
    }
  };

  // Render CIR Modal (add this near your modals or at the bottom of the component)
  {showCIRModal && (
    <Dialog open={showCIRModal} onOpenChange={setShowCIRModal}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        {/* Logo and company info header (copied from SR/WR receipt) */}
        <div className="flex flex-col items-center justify-center mb-4 sm:mb-8 mt-2">
          <Image src="/Group 86.png" alt="Agrogreen Logo" width={100} height={85} style={{ marginBottom: 6, borderRadius: '30%', objectFit: 'cover' }} className="sm:w-[120px] sm:h-[100px]" />
          <div className="text-base sm:text-lg font-extrabold text-orange-600 mt-2 mb-1 text-center" style={{ letterSpacing: '0.02em' }}>
            AGROGREEN WAREHOUSING PRIVATE LTD.
          </div>
          <div className="text-sm sm:text-base font-semibold text-green-600 mb-2 text-center px-2">
            603, 6th Floor, Princess Business Skyline, Indore, Madhya Pradesh - 452010
          </div>
        </div>
        <DialogHeader>
          <DialogTitle className="text-orange-700 text-lg sm:text-xl">
            CIR Inward Details
          </DialogTitle>
        </DialogHeader>
        <form className="space-y-3 sm:space-y-4">
          {/* State, Branch, Location, Warehouse Name, Warehouse Code, Business Type, Warehouse Address, Client Name, Client Code, Client Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <Label className="block font-semibold mb-1">State</Label>
              <Input value={cirModalData?.state || ''} readOnly disabled />
            </div>
            <div>
              <Label className="block font-semibold mb-1">Branch</Label>
              <Input value={cirModalData?.branch || ''} readOnly disabled />
            </div>
            <div>
              <Label className="block font-semibold mb-1">Location</Label>
              <Input value={cirModalData?.location || ''} readOnly disabled />
            </div>
            <div>
              <Label className="block font-semibold mb-1">Warehouse Name</Label>
              <Input value={cirModalData?.warehouseName || ''} readOnly disabled />
            </div>
            <div>
              <Label className="block font-semibold mb-1">Warehouse Code</Label>
              <Input value={cirModalData?.warehouseCode || ''} readOnly disabled />
            </div>
            <div>
              <Label className="block font-semibold mb-1">Business Type</Label>
              <Input value={cirModalData?.businessType || ''} readOnly disabled />
            </div>
            <div>
              <Label className="block font-semibold mb-1">Warehouse Address</Label>
              <Input value={cirModalData?.warehouseAddress || ''} readOnly disabled />
            </div>
            <div>
              <Label className="block font-semibold mb-1">Client Name</Label>
              <Input value={cirModalData?.client || ''} readOnly disabled />
            </div>
            <div>
              <Label className="block font-semibold mb-1">Client Code</Label>
              <Input value={cirModalData?.clientCode || ''} readOnly disabled />
            </div>
            <div>
              <Label className="block font-semibold mb-1">Client Address</Label>
              <Input value={cirModalData?.clientAddress || ''} readOnly disabled />
            </div>
          </div>
          {/* Inward Details */}
          <div className="border-t pt-3 sm:pt-4">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-orange-700">Inward Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div>
                <Label className="block font-semibold mb-1">Date of Inward</Label>
                <Input value={cirModalData?.dateOfInward || ''} readOnly disabled />
              </div>
              <div>
                <Label className="block font-semibold mb-1">CAD Number</Label>
                <Input value={cirModalData?.cadNumber || ''} readOnly disabled />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="block font-semibold mb-1 text-sm sm:text-base">Base Receipt</Label>
                <Input value={cirModalData?.bankReceipt || ''} readOnly disabled />
              </div>
            </div>
          </div>
          {/* Commodity Information */}
          <div className="border-t pt-4 sm:pt-6">
            <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 text-orange-700">Commodity Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
              <div>
                <Label className="block font-semibold mb-2">Commodity</Label>
                <Input value={cirModalData?.commodity || ''} readOnly disabled />
              </div>
              <div>
                <Label className="block font-semibold mb-2">Variety Name</Label>
                <Input value={cirModalData?.varietyName || ''} readOnly disabled />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <Label className="block font-semibold mb-2">Market Rate (Rs/MT)</Label>
                <Input value={cirModalData?.marketRate || ''} readOnly disabled />
              </div>
              <div>
                <Label className="block font-semibold mb-2">Total Bags</Label>
                <Input value={cirModalData?.totalBags || ''} readOnly disabled />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="block font-semibold mb-2">Total Quantity (MT)</Label>
                <Input value={cirModalData?.totalQuantity || ''} readOnly disabled />
              </div>
              <div>
                <Label className="block font-semibold mb-2">Total Value (Rs/MT)</Label>
                <Input value={cirModalData?.totalValue || ''} readOnly disabled />
              </div>
            </div>
          </div>
          {/* Bank Information */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-6 text-orange-700">Bank Information (Auto-filled from Inspection)</h3>
            <div className="mb-6">
              <Label className="block font-semibold mb-2">Bank Name</Label>
              <Input value={cirModalData?.bankName || ''} readOnly disabled />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <Label className="block font-semibold mb-2">Bank Branch</Label>
                <Input value={cirModalData?.bankBranch || ''} readOnly disabled />
              </div>
              <div>
                <Label className="block font-semibold mb-2">Bank State</Label>
                <Input value={cirModalData?.bankState || ''} readOnly disabled />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="block font-semibold mb-2">IFSC Code</Label>
                <Input value={cirModalData?.ifscCode || ''} readOnly disabled />
              </div>
            </div>
          </div>
          {/* Reservation/Billing Information */}
          {cirModalData?.businessType !== 'cm' && (cirModalData?.reservationRate || cirModalData?.billingCycle) && (
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4 text-orange-700">Reservation & Billing Information</h3>
              
              {/* Show reservation fields if reservationStatus is 'reservation' OR if reservation data exists and billing doesn't */}
              {(cirModalData?.reservationStatus === 'reservation' || (cirModalData?.reservationRate && (!cirModalData?.billingCycle || cirModalData?.billingCycle === '-'))) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="block font-semibold mb-1">Reservation Rate (Rs/MT)</Label>
                    <Input value={cirModalData?.reservationRate || ''} readOnly disabled />
                  </div>
                  <div>
                    <Label className="block font-semibold mb-1">Reservation Quantity (MT)</Label>
                    <Input value={cirModalData?.reservationQty || ''} readOnly disabled />
                  </div>
                  <div>
                    <Label className="block font-semibold mb-1">Reservation Start Date</Label>
                    <Input value={cirModalData?.reservationStart || ''} readOnly disabled />
                  </div>
                  <div>
                    <Label className="block font-semibold mb-1">Reservation End Date</Label>
                    <Input value={cirModalData?.reservationEnd || ''} readOnly disabled />
                  </div>
                </div>
              )}

              {/* Expired Reservation Alert in CIR Modal */}
              {(cirModalData?.reservationStatus === 'reservation' || cirModalData?.reservationRate) && isReservationExpired(cirModalData?.reservationEnd || '') && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Reservation Expired</h3>
                      <p className="mt-1 text-sm text-red-700">
                        The reservation end date ({cirModalData?.reservationEnd}) has expired. Please update the reservation details in the <strong>Reservation & Billing</strong> section.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {/* Show billing fields if reservationStatus is 'post-reservation' OR if billing data exists and it's meaningful */}
              {(cirModalData?.reservationStatus === 'post-reservation' || (cirModalData?.billingCycle && cirModalData?.billingCycle !== '-' && !cirModalData?.reservationRate)) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="block font-semibold mb-1">Billing Cycle</Label>
                    <Input value={cirModalData?.billingCycle || ''} readOnly disabled />
                  </div>
                  <div>
                    <Label className="block font-semibold mb-1">Billing Type</Label>
                    <Input value={cirModalData?.billingType || ''} readOnly disabled />
                  </div>
                  <div>
                    <Label className="block font-semibold mb-1">Billing Rate (Rs/MT)</Label>
                    <Input value={cirModalData?.billingRate || ''} readOnly disabled />
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Add more fields as needed, following the Add/Edit Inward modal structure */}
          {/* Insurance Section - From Master Collection */}
          {cirModalData?.insuranceEntries && Array.isArray(cirModalData.insuranceEntries) && cirModalData.insuranceEntries.length > 0 && (
            <div className="border-t pt-6 mb-6">
              <h3 className="text-xl font-semibold mb-4 text-blue-700">Insurance Details</h3>
              {cirModalData.insuranceEntries.map((insurance: any, index: number) => {
                const insuranceTakenBy = (insurance.insuranceTakenBy || '').toLowerCase().trim();
                const isBankFunded = insuranceTakenBy === 'bank' || insuranceTakenBy === 'bank-funded' || insuranceTakenBy.includes('bank');
                
                return (
                  <div key={index} className="border border-blue-200 rounded-lg p-6 bg-blue-50 mb-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-medium text-blue-700">Insurance ID: {insurance.insuranceId}</h4>
                      <div className="text-sm text-blue-600 font-medium">
                        {insurance.insuranceTakenBy} - {insurance.commodityName}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label className="block font-semibold mb-1">Insurance Taken By</Label>
                        <Input value={insurance.insuranceTakenBy || ''} readOnly />
                      </div>
                      <div>
                        <Label className="block font-semibold mb-1">Commodity</Label>
                        <Input value={insurance.commodityName || ''} readOnly />
                      </div>
                      {/* Show Bank Name if insurance is bank-funded or bank */}
                      {isBankFunded && (
                        <div>
                          <Label className="block font-semibold mb-1">Bank Name</Label>
                          <Input value={cirModalData?.bankName || cirModalData?.bankFundedBy || ''} readOnly />
                        </div>
                      )}
                      {/* Show all other fields only for non-bank-funded insurance */}
                      {!isBankFunded && (
                        <>
                          <div>
                            <Label className="block font-semibold mb-1">Client Name</Label>
                            <Input value={insurance.clientName || ''} readOnly />
                          </div>
                          <div>
                            <Label className="block font-semibold mb-1">Fire Policy Number</Label>
                            <Input value={insurance.firePolicyNumber || ''} readOnly />
                          </div>
                          <div>
                            <Label className="block font-semibold mb-1">Fire Policy Amount (Original)</Label>
                            <Input value={formatAmount(insurance.firePolicyAmount)} readOnly />
                          </div>
                          <div>
                            <Label className="block font-semibold mb-1">Fire Policy Remaining Amount</Label>
                            <Input value={formatAmount(insurance.firePolicyRemainingAmount)} readOnly className="bg-green-50" />
                          </div>
                          <div>
                            <Label className="block font-semibold mb-1">Fire Policy Start Date</Label>
                            <Input value={normalizeDate(insurance.firePolicyStartDate)} readOnly />
                          </div>
                          <div>
                            <Label className="block font-semibold mb-1">Fire Policy End Date</Label>
                            <Input value={normalizeDate(insurance.firePolicyEndDate)} readOnly />
                          </div>
                          <div>
                            <Label className="block font-semibold mb-1">Burglary Policy Number</Label>
                            <Input value={insurance.burglaryPolicyNumber || ''} readOnly />
                          </div>
                          <div>
                            <Label className="block font-semibold mb-1">Burglary Policy Amount (Original)</Label>
                            <Input value={formatAmount(insurance.burglaryPolicyAmount)} readOnly />
                          </div>
                          <div>
                            <Label className="block font-semibold mb-1">Burglary Policy Remaining Amount</Label>
                            <Input value={formatAmount(insurance.burglaryPolicyRemainingAmount)} readOnly className="bg-green-50" />
                          </div>
                          <div>
                            <Label className="block font-semibold mb-1">Burglary Policy Start Date</Label>
                            <Input value={normalizeDate(insurance.burglaryPolicyStartDate)} readOnly />
                          </div>
                          <div>
                            <Label className="block font-semibold mb-1">Burglary Policy End Date</Label>
                            <Input value={normalizeDate(insurance.burglaryPolicyEndDate)} readOnly />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Saved Inward Entries Section */}
          {Array.isArray(cirModalData?.inwardEntries) && cirModalData.inwardEntries.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4 text-green-700">Saved Inward Entries</h3>
              <div className="space-y-6">
                {cirModalData.inwardEntries.map((entry: any, index: number) => (
                  <div key={entry.id || index} className="border border-green-300 rounded-lg p-6 bg-green-50">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-green-800">Entry #{entry.entryNumber}</h4>
                      <div className="text-sm text-green-600 font-medium">
                        Vehicle: {entry.vehicleNumber} | Gatepass: {entry.getpassNumber}
                      </div>
                    </div>
                    {/* Inward ID */}
                    <div className="mb-4">
                      <h5 className="text-md font-semibold mb-2 text-green-700">Inward Information</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="block font-medium mb-1 text-green-600">Inward ID</Label>
                          <Input value={entry.inwardId || 'Pending'} readOnly className="bg-white border-green-300 font-mono" />
                        </div>
                      </div>
                    </div>
                    {/* Vehicle Information */}
                    <div className="mb-4">
                      <h5 className="text-md font-semibold mb-2 text-green-700">Vehicle Information</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="block font-medium mb-1 text-green-600">Vehicle Number</Label>
                          <Input value={entry.vehicleNumber} readOnly className="bg-white border-green-300" />
                        </div>
                        <div>
                          <Label className="block font-medium mb-1 text-green-600">Gatepass Number</Label>
                          <Input value={entry.getpassNumber} readOnly className="bg-white border-green-300" />
                        </div>
                      </div>
                    </div>
                    {/* Weight Bridge Information */}
                    <div className="mb-4">
                      <h5 className="text-md font-semibold mb-2 text-green-700">Weight Bridge Information</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="block font-medium mb-1 text-green-600">Weight Bridge</Label>
                          <Input value={entry.weightBridge} readOnly className="bg-white border-green-300" />
                        </div>
                        <div>
                          <Label className="block font-medium mb-1 text-green-600">Weight Bridge Slip Number</Label>
                          <Input value={entry.weightBridgeSlipNumber} readOnly className="bg-white border-green-300" />
                        </div>
                      </div>
                    </div>
                    {/* Weight Information */}
                    <div className="mb-4">
                      <h5 className="text-md font-semibold mb-2 text-green-700">Weight Information</h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="block font-medium mb-1 text-green-600">Gross Weight (MT)</Label>
                          <Input value={entry.grossWeight} readOnly className="bg-white border-green-300" />
                        </div>
                        <div>
                          <Label className="block font-medium mb-1 text-green-600">Tare Weight (MT)</Label>
                          <Input value={entry.tareWeight} readOnly className="bg-white border-green-300" />
                        </div>
                        <div>
                          <Label className="block font-medium mb-1 text-green-600">Net Weight (MT)</Label>
                          <Input value={entry.netWeight} readOnly className="bg-white border-green-300" />
                        </div>
                      </div>
                    </div>
                    {/* Stack Information */}
                    <div>
                      <h5 className="text-md font-semibold mb-2 text-green-700">Stack Information</h5>
                      <div className="space-y-3">
                        {entry.stacks && entry.stacks.map((stack: any, stackIndex: number) => (
                          <div key={stackIndex} className="border border-green-200 rounded-lg p-3 bg-white">
                            <div className="flex items-center justify-between mb-2">
                              <h6 className="font-medium text-green-700">Stack {stackIndex + 1}</h6>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Label className="block font-medium mb-1 text-green-600">Stack Number</Label>
                                <Input value={stack.stackNumber} readOnly className="bg-gray-50 border-green-300" />
                              </div>
                              <div>
                                <Label className="block font-medium mb-1 text-green-600">Number of Bags</Label>
                                <Input value={stack.numberOfBags} readOnly className="bg-gray-50 border-green-300" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Lab Parameter Section */}
          {cirModalData?.labResults && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-orange-700">Lab Parameter</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="block font-semibold mb-1">Sampling Date</Label>
                  <Input value={cirModalData.dateOfSampling || ''} readOnly />
                </div>
                <div>
                  <Label className="block font-semibold mb-1">Testing Date</Label>
                  <Input value={cirModalData.dateOfTesting || ''} readOnly />
                </div>
              </div>
              <div>
                <Label className="block font-semibold mb-1">Quality Parameters</Label>
                <div className="space-y-2">
                  {Array.isArray(cirModalData.labParameterNames) && cirModalData.labParameterNames.length > 0 ? (
                    cirModalData.labParameterNames.map((name: string, idx: number) => (
                      <div key={name} className="flex items-center space-x-2">
                        <span className="font-medium w-48">{name}</span>
                        <Input value={typeof cirModalData.labResults?.[idx] === 'object' && cirModalData.labResults[idx]?.value ? cirModalData.labResults[idx].value : (cirModalData.labResults?.[idx] || '')} readOnly className="w-32" />
                      </div>
                    ))
                  ) : (
                    <Input value={Array.isArray(cirModalData.labResults) ? cirModalData.labResults.map(result => typeof result === 'object' && result.value ? result.value : result).join(', ') : ''} readOnly />
                  )}
                </div>
              </div>
            </div>
          )}
          {/* File Attachment Section */}
          {cirModalData?.attachmentUrl && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-orange-700 mb-4">File Attachment</h3>
              <a href={cirModalData.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                View Attached File
              </a>
            </div>
          )}
          {/* In the CIR modal Lab Parameter section, use the Input component for the Actual (%) column, matching the Edit Inward modal: */}
          {cirModalData?.labParameterNames && cirModalData.labParameterNames.length > 0 && cirModalData?.commodity && cirModalData?.varietyName ? (
            <div className="w-full max-w-2xl mb-8" style={{ maxWidth: '900px' }}>
              <Label className="block font-semibold mb-2 text-green-700 text-left">Quality Parameters (from Commodity & Variety)</Label>
              <div className="overflow-x-auto max-w-lg">
                <table className="min-w-full border border-green-300 rounded-lg">
                  <thead className="bg-orange-100 text-orange-600 font-bold">
                    <tr>
                      <th className="px-4 py-2 border-green-300 border">Parameter</th>
                      <th className="px-4 py-2 border-green-300 border">Min %</th>
                      <th className="px-4 py-2 border-green-300 border">Max %</th>
                      <th className="px-4 py-2 border-green-300 border">Actual (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const commodity = commodities.find((c: any) => c.commodityName === cirModalData.commodity);
                      const variety = commodity?.varieties?.find((v: any) => v.varietyName === cirModalData.varietyName);
                      const particulars = variety?.particulars || [];
                      return particulars.length > 0 ? (
                        particulars.map((p: any, idx: number) => (
                          <tr key={idx} className="text-green-800">
                            <td className="px-4 py-2 border-green-300 border">{p.name}</td>
                            <td className="px-4 py-2 border-green-300 border">{p.minPercentage}</td>
                            <td className="px-4 py-2 border-green-300 border">{p.maxPercentage}</td>
                            <td className="px-4 py-2 border-green-300 border">
                              <Input
                                type="number"
                                value={typeof cirModalData.labResults?.[idx] === 'object' && cirModalData.labResults[idx]?.value ? cirModalData.labResults[idx].value : (cirModalData.labResults?.[idx] || '')}
                                readOnly
                                className="w-24 bg-white border border-green-300 text-center"
                              />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={4} className="text-center text-gray-400 py-2">No quality parameters found for this variety.</td></tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          {/* Inward Entry Details (match edit inward form) */}
          {(() => {
            // Prefer cirModalData fields, fallback to inwardEntries[0] if missing
            const entry = cirModalData || (Array.isArray(cirModalData?.inwardEntries) && cirModalData.inwardEntries.length > 0 ? cirModalData.inwardEntries[0] : {});
            if (!entry) return null;
            return (
              <div className="border-t pt-6 mb-6">
                <h3 className="text-lg font-semibold mb-6 text-orange-700">Inward Entry Details</h3>
                {/* Inward ID */}
                <div className="mb-4">
                  <h5 className="text-md font-semibold mb-2 text-green-700">Inward Information</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="block font-medium mb-1 text-green-600">Inward ID</Label>
                      <Input value={entry.inwardId || 'Pending'} readOnly className="bg-white border-green-300 font-mono" />
                    </div>
                  </div>
                </div>
                {/* Vehicle Information */}
                <div className="mb-4">
                  <h5 className="text-md font-semibold mb-2 text-green-700">Vehicle Information</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="block font-medium mb-1 text-green-600">Vehicle Number</Label>
                      <Input value={entry.vehicleNumber || ''} readOnly className="bg-white border-green-300" />
                    </div>
                    <div>
                      <Label className="block font-medium mb-1 text-green-600">Gatepass Number</Label>
                      <Input value={entry.getpassNumber || ''} readOnly className="bg-white border-green-300" />
                    </div>
                  </div>
                </div>
                {/* Weight Bridge Information */}
                <div className="mb-4">
                  <h5 className="text-md font-semibold mb-2 text-green-700">Weight Bridge Information</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="block font-medium mb-1 text-green-600">Weight Bridge</Label>
                      <Input value={entry.weightBridge || ''} readOnly className="bg-white border-green-300" />
                    </div>
                    <div>
                      <Label className="block font-medium mb-1 text-green-600">Weight Bridge Slip Number</Label>
                      <Input value={entry.weightBridgeSlipNumber || ''} readOnly className="bg-white border-green-300" />
                    </div>
                  </div>
                </div>
                {/* Weight Information */}
                <div className="mb-4">
                  <h5 className="text-md font-semibold mb-2 text-green-700">Weight Information</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="block font-medium mb-1 text-green-600">Gross Weight (MT)</Label>
                      <Input value={entry.grossWeight || ''} readOnly className="bg-white border-green-300" />
                    </div>
                    <div>
                      <Label className="block font-medium mb-1 text-green-600">Tare Weight (MT)</Label>
                      <Input value={entry.tareWeight || ''} readOnly className="bg-white border-green-300" />
                    </div>
                    <div>
                      <Label className="block font-medium mb-1 text-green-600">Net Weight (MT)</Label>
                      <Input value={entry.netWeight || ''} readOnly className="bg-white border-green-300" />
                    </div>
                  </div>
                </div>
                {/* Stack Information */}
                <div>
                  <h5 className="text-md font-semibold mb-2 text-green-700">Stack Information</h5>
                  <div className="space-y-3">
                    {Array.isArray(entry.stacks) && entry.stacks.length > 0 ? entry.stacks.map((stack: any, stackIndex: number) => (
                      <div key={stackIndex} className="border border-green-200 rounded-lg p-3 bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <h6 className="font-medium text-green-700">Stack {stackIndex + 1}</h6>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Stack Number</Label>
                            <Input value={stack.stackNumber} readOnly className="bg-gray-50 border-green-300" />
                          </div>
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Number of Bags</Label>
                            <Input value={stack.numberOfBags} readOnly className="bg-gray-50 border-green-300" />
                          </div>
                        </div>
                      </div>
                    )) : <div className="text-gray-500">No stack information available.</div>}
                  </div>
                </div>
              </div>
            );
          })()}
        </form>
        {/* Mandatory Remarks input at the bottom */}
        <div className="mt-6">
          <Label className="block font-semibold mb-2 text-orange-700">Remarks / Approval Note <span className="text-red-500">*</span></Label>
          <Input
            value={cirRemarks}
            onChange={e => setCIRRemarks(e.target.value)}
            placeholder="Enter remarks or approval note"
            required
            readOnly={cirModalData?.cirStatus === 'Approved'}
            disabled={cirModalData?.cirStatus === 'Approved'}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2 mt-3 sm:mt-4">
          {cirModalData?.cirStatus === 'Approved' ? (
            <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-xs sm:px-4 sm:text-sm" disabled={isPrinting}>
              {isPrinting ? 'Generating PDF...' : 'Print'}
            </Button>
          ) : cirModalData?.cirStatus === 'Resubmitted' ? null : cirModalData?.cirStatus === 'Rejected' ? null : (
            cirReadOnly ? (
              showCIRActionButtons() ? (
                <>
                  {canApproveCIR() && (
                    <Button onClick={handleCIRApprove} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 text-xs sm:px-4 sm:text-sm" disabled={!cirRemarks.trim()}>
                      Approve
                    </Button>
                  )}
                  {canRejectCIR() && (
                    <Button onClick={handleCIRReject} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-xs sm:px-4 sm:text-sm" disabled={!cirRemarks.trim()}>
                      Reject
                    </Button>
                  )}
                  {canResubmitCIR() && (
                    <Button onClick={handleCIRResubmit} className="bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-2 text-xs sm:px-4 sm:text-sm" disabled={!cirRemarks.trim()}>
                      Resubmit
                    </Button>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center text-gray-500">
                  <span className="text-sm">CIR Actions (Read Only)</span>
                  <span className="text-xs">
                    {userRole === 'maker' ? 'Makers can only view CIR reports' : 'No permission for CIR actions'}
                  </span>
                </div>
              )
            ) : (
              <Button onClick={handleCIRSave} color="primary">Save</Button>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  )}

  return (
    <DashboardLayout>
      <div className="min-h-screen flex flex-col">
        {/* Module title and dashboard button row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mt-3 sm:mt-4 mb-6 sm:mb-10 px-4 sm:px-8">
        <Button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-base sm:px-8 sm:py-3 sm:text-2xl font-semibold shadow-lg rounded-xl flex items-center gap-2 w-full sm:w-auto justify-center" onClick={() => router.push('/dashboard')}>
          <span className="text-xl sm:text-2xl">&#8592;</span> Dashboard
        </Button>
        <div className="flex-1 text-center w-full sm:w-auto">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-orange-600 inline-block border-b-4 border-[#1aad4b] pb-2 px-6 sm:px-10 py-1 bg-orange-50 rounded-xl shadow" style={{ letterSpacing: '0.02em' }}>
            Inward Module
          </h1>
        </div>
        <div className="flex flex-col items-end w-full sm:w-auto">
          {canCreateInwardEntry() ? (
            <Button className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 text-sm sm:px-8 sm:py-3 sm:text-lg font-semibold shadow-lg rounded-xl w-full sm:w-auto" onClick={() => {
              setIsEditMode(false);
              setEditingRow(null);
              resetForm();
              // Clear any previous validation states
              setPreventInward(false);
              setInlineAlert(null);
              setShowAddModal(true);
            }}>
              + Add Inward
            </Button>
          ) : (
            <div className="flex flex-col items-end w-full sm:w-auto">
              <Button 
                className="bg-gray-400 cursor-not-allowed text-white px-4 py-2 sm:px-8 sm:py-3 text-sm sm:text-lg font-semibold shadow-lg rounded-xl opacity-50 w-full sm:w-auto" 
                disabled
                title="You don't have permission to create inward entries"
              >
                + Add Inward (Read Only)
              </Button>
              <span className="text-xs text-gray-500 mt-1 text-center sm:text-right">
                {userRole === 'checker' ? 'Checkers can only view/approve entries' : 'No permission to create entries'}
              </span>
            </div>
          )}
        </div>
        {/* Alert dialog for expired reservation/insurance */}
        <Dialog open={alertOpen} onOpenChange={(open) => setAlertOpen(open)}>
          <DialogContent className="max-w-lg w-[90vw] sm:w-full">
            <DialogHeader>
              <DialogTitle className="text-red-700 text-base sm:text-lg">{alertTitle}</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-gray-700">{alertMessage}</DialogDescription>
            </DialogHeader>
            <div className="mt-3 sm:mt-4 flex justify-end">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm px-3 py-2 sm:px-4" onClick={() => setAlertOpen(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
        {/* Main content area - flex-1 to push footer down */}
        <div className="flex-1 overflow-auto">
          {/* Search and Export */}
          <div className="px-4 sm:px-8 mb-3 sm:mb-4">
        <Card className="bg-green-50 border border-green-200">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-green-800 text-base sm:text-lg">Search & Export Options</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 p-3 sm:p-6">
            <div className="flex-grow flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <div className="flex items-center gap-2">
                <Search className="text-gray-500 h-4 w-4 flex-shrink-0" />
                <Label htmlFor="search-input" className="font-semibold text-gray-700 text-xs sm:text-sm whitespace-nowrap">Search:</Label>
              </div>
              <Input
                id="search-input"
                placeholder="Search by state, branch, location, warehouse name, client, or receipt type..."
                className="w-full text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button
              onClick={handleExportCSV}
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm w-full sm:w-auto"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Entry Count Display */}
      <div className="px-4 sm:px-8 mb-3 sm:mb-4">
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 p-2 rounded">
          <span className="text-blue-700 font-medium text-xs sm:text-sm">
            {searchTerm ? `Showing ${filteredData.length} of ${inwardData.length} entries` : `Total entries: ${filteredData.length}`}
          </span>
        </div>
      </div>
      
      {/* Data Table */}
      <div className="px-4 sm:px-8">
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-green-700 text-lg sm:text-xl">Inward Entries</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-2">
              <div className="flex items-center gap-2">
                <label className="font-semibold text-xs sm:text-sm">Sort by Inward Code:</label>
                <button
                  onClick={() => setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'))}
                  className="ml-1 px-2 py-1 border rounded text-base sm:text-lg"
                  title={sortDirection === 'asc' ? 'Sort Descending' : 'Sort Ascending'}
                  type="button"
                >
                  {sortDirection === 'asc' ? '▲' : '▼'}
                </button>
              </div>
              {/* Column Visibility Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="ml-0 sm:ml-2 text-xs sm:text-sm">Columns</Button>
                </DropdownMenuTrigger>
+                <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
                  <DropdownMenuLabel>Show/Hide Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={visibleColumnKeys.length === allColumnKeys.length}
                    onCheckedChange={checked => {
                      if (checked) setVisibleColumnKeys(allColumnKeys);
                      else setVisibleColumnKeys([]);
                    }}
                  >
                    Select All
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {uiColumns.map(col => (
                    <DropdownMenuCheckboxItem
                      key={col.accessorKey}
                      checked={visibleColumnKeys.includes(col.accessorKey)}
                      onCheckedChange={checked => {
                        setVisibleColumnKeys(prev =>
                          checked
                            ? [...prev, col.accessorKey]
                            : prev.filter(k => k !== col.accessorKey)
                        );
                      }}
                    >
                      {typeof col.header === 'string' ? col.header : col.accessorKey}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <DataTable
                columns={visibleColumns}
                data={filteredData}
                isLoading={loading}
                error={error || undefined}
                wrapperClassName="border-green-300"
                headClassName="text-center bg-orange-100 text-orange-600 font-bold text-xs sm:text-sm"
                cellClassName="text-center text-xs sm:text-sm"
                stickyHeader={true}
                stickyFirstColumn={true}
                showGridLines={true}
                pageSize={25}
                showPagination={true}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Inward Modal */}
      <Dialog open={showAddModal} onOpenChange={handleModalClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="text-orange-700 text-lg sm:text-xl">
              {isEditMode ? 'Edit Inward' : 'Add Inward'}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-3 sm:space-y-4" onSubmit={handleSubmit}>
            {!canCreateInwardEntry && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4">
                <div className="flex items-center text-blue-800">
                  <Info className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-medium">Read-Only Mode: You can view inward details but cannot modify entry fields. Use CIR, SR, and WR sections for approvals.</span>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="block font-semibold mb-1">State</Label>
                <Select 
                  value={form.state} 
                  onValueChange={v => setBaseForm(f => ({ ...f, state: v, branch: '', location: '', warehouseName: '', warehouseCode: '', warehouseAddress: '', businessType: '' }))}
                  disabled={!canCreateInwardEntry}
                >
                  <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
                  <SelectContent>
                    {states.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="block font-semibold mb-1">Branch</Label>
                <Select 
                  value={form.branch} 
                  onValueChange={v => setBaseForm(f => ({ ...f, branch: v, location: '', warehouseName: '', warehouseCode: '', warehouseAddress: '', businessType: '' }))} 
                  disabled={!form.state || !canCreateInwardEntry}
                >
                  <SelectTrigger><SelectValue placeholder="Select Branch" /></SelectTrigger>
                  <SelectContent>
                    {filteredBranches.map((b: any) => <SelectItem key={b.branch} value={b.branch}>{b.branch}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="block font-semibold mb-1">Location</Label>
                <Select 
                  value={form.location} 
                  onValueChange={v => setBaseForm(f => ({ ...f, location: v, warehouseName: '', warehouseCode: '', warehouseAddress: '', businessType: '' }))} 
                  disabled={!form.branch || !canCreateInwardEntry}
                >
                  <SelectTrigger><SelectValue placeholder="Select Location" /></SelectTrigger>
                  <SelectContent>
                    {filteredLocations.map((loc: any) => <SelectItem key={loc.locationName} value={loc.locationName}>{loc.locationName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="block font-semibold mb-1">Warehouse Name</Label>
                <Select 
                  value={form.warehouseName} 
                  onValueChange={async (warehouseName) => {
                    console.log('🏭 Warehouse selected:', warehouseName);
                    console.log('👤 Current client:', form.client);
                    
                    // Fetch available reservations when warehouse changes
                    if (warehouseName && form.client) {
                      console.log('🔄 Fetching reservations for warehouse and client...');
                      fetchAvailableReservations(warehouseName, form.client, form.state, form.branch, form.location);
                    } else {
                      console.log('⚠️ Cannot fetch reservations - missing warehouse or client');
                    }
                    
                    const selectedWarehouse = filteredWarehouses.find((w: any) => w.warehouseName === warehouseName);
                    
                    // Fetch available banks for this warehouse
                    if (selectedWarehouse?.warehouseCode) {
                      console.log('🔄 Fetching banks for warehouse code:', selectedWarehouse.warehouseCode);
                      fetchAvailableBanks(selectedWarehouse.warehouseCode);
                    } else {
                      setAvailableBanks([]);
                      setSelectedBank(null);
                    }
                    
                    setBaseForm(f => ({ 
                      ...f, 
                      warehouseName: warehouseName,
                      warehouseCode: selectedWarehouse?.warehouseCode || '',
                      warehouseAddress: selectedWarehouse?.warehouseInspectionData?.address || selectedWarehouse?.warehouseAddress || '',
                      businessType: selectedWarehouse?.businessType || '',
                      // Don't auto-fill bank details here - they will be filled when user selects a bank
                      bankName: '',
                      bankBranch: '',
                      bankState: '',
                      ifscCode: '',
                      // Clear insurance data when warehouse changes
                      insuranceManagedBy: '',
                      firePolicyNumber: '',
                      firePolicyAmount: '',
                      firePolicyStart: '',
                      firePolicyEnd: '',
                      burglaryPolicyNumber: '',
                      burglaryPolicyAmount: '',
                      burglaryPolicyStart: '',
                      burglaryPolicyEnd: '',
                      firePolicyCompanyName: '',
                      burglaryPolicyCompanyName: '',
                      bankFundedBy: '',
                      selectedInsurance: null,
                    }));
                    
                    // Reset insurance selections
                    setSelectedInsuranceType('all');
                    setSelectedInsuranceIndex(null);
                    setSelectedInsuranceForInward(null);
                    setInsuranceEntries([]);
                    
                    console.log('✅ Warehouse selected:', warehouseName);
                    console.log('� Insurance will be fetched when commodity is selected');
                  }} 
                  disabled={!form.location || !canCreateInwardEntry}
                >
                  <SelectTrigger><SelectValue placeholder="Select Warehouse" /></SelectTrigger>
                  <SelectContent>
                    {filteredWarehouses.map((w: any) => (
                      <SelectItem 
                        key={`${w.warehouseName}-${w.warehouseCode || 'no-code'}`} 
                        value={w.warehouseName}
                      >
                        {w.warehouseName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="block font-semibold mb-1">Warehouse Code</Label>
                <Input value={form.warehouseCode} readOnly placeholder="Auto-filled" />
              </div>
              <div>
                <Label className="block font-semibold mb-1">Business Type</Label>
                <Input value={form.businessType ? getBusinessTypeLabel(form.businessType) : 'Auto-filled from survey'} readOnly placeholder="Auto-filled from survey" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="block font-semibold mb-1">Warehouse Address</Label>
              <Input value={form.warehouseAddress} readOnly placeholder="Auto-filled from warehouse data" />
            </div>
              <div>
                <Label className="block font-semibold mb-1">Client Name</Label>
                <Select 
                  value={form.client} 
                  onValueChange={v => {
                    console.log('👤 Client selected:', v);
                    console.log('🏭 Current warehouse:', form.warehouseName);
                    
                    setBaseForm(f => ({ ...f, client: v }));
                    // Fetch available reservations when client changes
                    if (form.warehouseName && v) {
                      console.log('🔄 Fetching reservations for client and warehouse...');
                      fetchAvailableReservations(form.warehouseName, v, form.state, form.branch, form.location);
                    } else {
                      console.log('⚠️ Cannot fetch reservations - missing warehouse or client');
                    }
                  }}
                  disabled={!canCreateInwardEntry}
                >
                  <SelectTrigger><SelectValue placeholder="Select Client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c: any) => <SelectItem key={c.firmName} value={c.firmName}>{c.firmName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="block font-semibold mb-1">Client Code</Label>
                <Input value={form.clientCode} readOnly placeholder="Auto-filled" />
              </div>
              <div>
                <Label className="block font-semibold mb-1">Client Address</Label>
                <Input 
                  value={form.clientAddress} 
                  readOnly
                  disabled
                  placeholder="Auto-filled from client master"
                />
              </div>
            </div>

            {/* Inward Details */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4 text-orange-700">Inward Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="block font-semibold mb-1">Date of Inward <span className="text-red-500">*</span></Label>
                  <Input 
                    type="date" 
                    value={form.dateOfInward} 
                    onChange={e => setBaseForm(f => ({ ...f, dateOfInward: e.target.value }))} 
                    placeholder="Select date"
                    disabled={!canCreateInwardEntry}
                  />
                </div>
                <div>
                  <Label className="block font-semibold mb-1">CAD Number <span className="text-red-500">*</span></Label>
                  <Input 
                    value={form.cadNumber} 
                    onChange={e => setBaseForm(f => ({ ...f, cadNumber: e.target.value }))} 
                    placeholder="Enter CAD Number"
                    disabled={!canCreateInwardEntry}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                <div>
                  <Label className="block font-semibold mb-1">Base Receipt</Label>
                  <Input 
                    value={form.bankReceipt} 
                    onChange={e => setBaseForm(f => ({ ...f, bankReceipt: e.target.value }))} 
                    placeholder="Enter Base Receipt Number"
                    disabled={!canCreateInwardEntry}
                  />
                </div>
              </div>
            </div>

            {/* Commodity Information */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-6 text-orange-700">Commodity Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <Label className="block font-semibold mb-2">Commodity <span className="text-red-500">*</span></Label>
                  <Select 
                    value={form.commodity} 
                    onValueChange={handleCommodityChange}
                    disabled={!canCreateInwardEntry}
                  >
                    <SelectTrigger><SelectValue placeholder="Select Commodity" /></SelectTrigger>
                    <SelectContent>
                      {commodities.map((c: any) => (
                        <SelectItem key={c.commodityName} value={c.commodityName}>
                          {c.commodityName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="block font-semibold mb-2">Variety Name <span className="text-red-500">*</span></Label>
                  <Select 
                    value={form.varietyName} 
                    onValueChange={handleVarietyChange}
                    disabled={!form.commodity || !canCreateInwardEntry}
                  >
                    <SelectTrigger><SelectValue placeholder="Select Variety" /></SelectTrigger>
                    <SelectContent>
                      {getCommodityVarieties(form.commodity).map((v: any) => (
                        <SelectItem key={v.varietyName} value={v.varietyName}>
                          {v.varietyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                  <Label className="block font-semibold mb-2">Market Rate (Rs/MT) <span className="text-red-500">*</span></Label>
                <Input 
                    type="text"
                    value={form.marketRate} 
                    onChange={e => setBaseForm(f => ({ ...f, marketRate: e.target.value }))} 
                    placeholder="Enter Market Rate"
                    disabled={!canCreateInwardEntry}
                  />
                </div>
                <div>
                  <Label className="block font-semibold mb-2">Total Bags <span className="text-red-500">*</span></Label>
                  <Input 
                    type="number"
                    value={baseForm.totalBags}
                    readOnly
                    placeholder="Auto-calculated from entries"
                    className="bg-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="block font-semibold mb-2">Total Quantity (MT) <span className="text-red-500">*</span></Label>
                  <Input 
                    type="number"
                    step="0.001"
                    min="0"
                    value={baseForm.totalQuantity}
                    readOnly
                    placeholder="Auto-calculated from entries"
                    className="bg-gray-100"
                  />
                </div>
                <div>
                  <Label className="block font-semibold mb-2">Total Value (Rs/MT)</Label>
                  <Input 
                    value={baseForm.totalValue}
                  readOnly 
                    placeholder="Auto-calculated"
                    className={totalValueExceedsInsurance ? "bg-red-50 border-red-500" : "bg-gray-50"}
                />
                  {/* Insurance Validation Error */}
                  {totalValueExceedsInsurance && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-500 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-semibold text-red-800">⚠️ Exceeds Insurance Coverage!</span>
                      </div>
                      <div className="text-xs text-red-700 space-y-1">
                        <div>💰 Total Value: <span className="font-semibold">₹{parseFloat(baseForm.totalValue).toLocaleString()}</span></div>
                        <div>🔥 Fire Policy Remaining: <span className="font-semibold">₹{parseFloat(initialRemainingFire || '0').toLocaleString()}</span></div>
                        <div>🛡️ Burglary Policy Remaining: <span className="font-semibold">₹{parseFloat(initialRemainingBurglary || '0').toLocaleString()}</span></div>
                        <div className="text-red-600 font-semibold italic mt-2">❌ Cannot submit - Please reduce quantity or market rate!</div>
                      </div>
                    </div>
                  )}
                  {/* Insurance Deduction Preview */}
                  {baseForm.totalValue && parseFloat(baseForm.totalValue) > 0 && insuranceEntries.length > 0 && !totalValueExceedsInsurance && !isBankFundedInsurance && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-semibold text-blue-800">Insurance Deduction Preview</span>
                      </div>
                      <div className="text-xs text-blue-700 space-y-1">
                        <div>💰 Amount to be deducted: <span className="font-semibold">₹{parseFloat(baseForm.totalValue).toLocaleString()}</span></div>
                        <div>🔥 Fire Policy: <span className="font-semibold">₹{parseFloat(baseForm.totalValue).toLocaleString()}</span> will be deducted</div>
                        <div>🛡️ Burglary Policy: <span className="font-semibold">₹{parseFloat(baseForm.totalValue).toLocaleString()}</span> will be deducted</div>
                        <div className="text-blue-600 italic">Note: This amount will be deducted from both policies when you submit the form.</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bank Information */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-6 text-orange-700">Bank Information (Select from Available Banks)</h3>
              
              {/* Available Banks Selection Box */}
              {availableBanks.length > 0 ? (
                <div className="mb-6 p-4 border-2 border-blue-400 rounded-lg bg-blue-50 shadow-lg">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-lg font-bold text-blue-800 flex items-center gap-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Select Bank for this Warehouse
                      <span className="text-sm font-normal text-blue-600">(Click a box to select)</span>
                    </h4>
                  </div>
                  <div className="text-sm space-y-2">
                    <div className="grid grid-cols-2 gap-2 mb-3 p-2 bg-white rounded border border-blue-200">
                      <div><span className="font-medium text-blue-700">Warehouse Code:</span> <span className="text-orange-600">{form.warehouseCode || 'N/A'}</span></div>
                      <div><span className="font-medium text-blue-700">Warehouse Name:</span> <span className="text-orange-600">{form.warehouseName || 'N/A'}</span></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {availableBanks.map((bank, index) => {
                        const isSelected = selectedBank && 
                                         selectedBank.bankName === bank.bankName && 
                                         selectedBank.ifscCode === bank.ifscCode;
                        return (
                          <div
                            key={`${bank.bankName}-${bank.ifscCode}-${index}`}
                            className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                              isSelected
                                ? 'border-green-500 bg-green-50 shadow-md'
                                : 'border-blue-200 bg-white hover:border-blue-400'
                            }`}
                            onClick={() => {
                              console.log('🏦 Bank selected:', bank);
                              setSelectedBank(bank);
                              // Auto-fill bank details
                              setBaseForm(f => ({
                                ...f,
                                bankName: bank.bankName,
                                bankBranch: bank.bankBranch,
                                bankState: bank.bankState,
                                ifscCode: bank.ifscCode
                              }));
                              toast({
                                title: "Bank Selected",
                                description: `${bank.bankName} - ${bank.bankBranch} has been selected`,
                                variant: "default",
                              });
                            }}
                          >
                            <div className="flex items-start justify-between mb-1">
                              <div className="font-semibold text-blue-600 flex items-center gap-2">
                                🏦 {bank.bankName}
                                {isSelected && (
                                  <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">✓ Selected</span>
                                )}
                              </div>
                            </div>
                            <div className="text-xs space-y-1 mt-2">
                              <div><strong>Branch:</strong> {bank.bankBranch || 'N/A'}</div>
                              <div><strong>State:</strong> {bank.bankState || 'N/A'}</div>
                              <div><strong>IFSC:</strong> {bank.ifscCode || 'N/A'}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {selectedBank && (
                      <div className="mt-3 p-2 bg-green-100 rounded border border-green-300">
                        <p className="text-xs text-green-800 font-semibold">
                          ✅ Selected Bank: {selectedBank.bankName} - {selectedBank.bankBranch}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mb-6 p-4 border-2 border-gray-300 rounded-lg bg-gray-50">
                  <p className="text-sm text-gray-600 text-center">
                    ℹ️ No bank information available for this warehouse. Please select a warehouse first.
                  </p>
                </div>
              )}
              
              {/* Bank Details Display (Read-only after selection) */}
              <div className="mb-6">
                <Label className="block font-semibold mb-2">Bank Name</Label>
                <Input value={form.bankName} readOnly placeholder="Select a bank above" className="bg-gray-100" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <Label className="block font-semibold mb-2">Bank Branch</Label>
                  <Input value={form.bankBranch} readOnly placeholder="Auto-filled from selection" className="bg-gray-100" />
                </div>
                <div>
                  <Label className="block font-semibold mb-2">Bank State</Label>
                  <Input value={form.bankState} readOnly placeholder="Auto-filled from selection" className="bg-gray-100" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="block font-semibold mb-2">IFSC Code</Label>
                  <Input value={form.ifscCode} readOnly placeholder="Auto-filled from selection" className="bg-gray-100" />
                </div>
              </div>
            </div>

            {/* Reservation/Billing Information */}
            {form.businessType !== 'cm' && availableReservations.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-4 text-orange-700">Reservation & Billing Information</h3>
                
                {/* Reservation Selection */}
                {availableReservations.length > 1 && (
                  <div className="mb-4">
                    <Label className="block font-semibold mb-2">Select Reservation</Label>
                    <Select 
                      value={selectedReservation?.id || ''} 
                      onValueChange={reservationId => {
                        const selected = availableReservations.find(res => res.id === reservationId);
                        console.log('🎯 Reservation selected:', selected);
                        console.log('📋 Billing Status:', selected?.billingStatus);
                        console.log('💰 Billing Data:', {
                          billingCycle: selected?.billingCycle,
                          billingType: selected?.billingType,
                          billingRate: selected?.billingRate,
                          reservationRate: selected?.reservationRate
                        });
                        setSelectedReservation(selected);
                      }}
                      disabled={!canCreateInwardEntry}
                    >
                      <SelectTrigger><SelectValue placeholder="Choose from available reservations" /></SelectTrigger>
                      <SelectContent>
                        {availableReservations.map((res: any) => (
                          <SelectItem key={res.id} value={res.id}>
                            {res.reservationId} - {res.billingStatus} - Rate: {res.reservationRate}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label className="block font-semibold mb-1">Reservation Status</Label>
                    <Input value={selectedReservation?.reservationStatus || ''} readOnly placeholder="Auto-filled" />
                  </div>
                </div>

                {/* Check if reservation has expired but has billing parameters */}
                {(() => {
                  const hasExpiredWithBilling = selectedReservation?.reservationStatus === 'reservation' && 
                    selectedReservation?.reservationEnd && 
                    new Date(selectedReservation.reservationEnd) < new Date() &&
                    selectedReservation?.billingCycle && selectedReservation?.billingCycle !== '-' &&
                    selectedReservation?.billingType && selectedReservation?.billingType !== '-' &&
                    selectedReservation?.billingRate && selectedReservation?.billingRate !== '-';
                  
                  return hasExpiredWithBilling;
                })() ? (
                  /* Show billing fields when reservation expired but billing is active */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="block font-semibold mb-1">Billing Cycle</Label>
                      <Input value={selectedReservation?.billingCycle || ''} readOnly placeholder="Auto-filled" />
                    </div>
                    <div>
                      <Label className="block font-semibold mb-1">Billing Type</Label>
                      <Input value={selectedReservation?.billingType || ''} readOnly placeholder="Auto-filled" />
                    </div>
                    <div>
                      <Label className="block font-semibold mb-1">Billing Rate (Rs/MT)</Label>
                      <Input value={selectedReservation?.billingRate || ''} readOnly placeholder="Auto-filled" />
                    </div>
                  </div>
                ) : selectedReservation?.reservationStatus === 'reservation' ? (
                  /* Show reservation fields for active reservations */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="block font-semibold mb-1">Reservation Rate (Rs/MT) *</Label>
                      <Input value={selectedReservation?.reservationRate || ''} readOnly placeholder="Auto-filled" />
                    </div>
                    <div>
                      <Label className="block font-semibold mb-1">Reservation Quantity (MT) *</Label>
                      <Input value={selectedReservation?.reservationQty || ''} readOnly placeholder="Auto-filled" />
                    </div>
                    <div>
                      <Label className="block font-semibold mb-1">Reservation Start Date *</Label>
                      <Input value={selectedReservation?.reservationStart || ''} readOnly placeholder="Auto-filled" />
                    </div>
                    <div>
                      <Label className="block font-semibold mb-1">Reservation End Date *</Label>
                      <Input value={selectedReservation?.reservationEnd || ''} readOnly placeholder="Auto-filled" />
                    </div>
                  </div>
                ) : selectedReservation?.reservationStatus === 'post-reservation' ? (
                  /* Show billing fields for post-reservation status */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="block font-semibold mb-1">Billing Cycle</Label>
                      <Input value={selectedReservation?.billingCycle || ''} readOnly placeholder="Auto-filled" />
                    </div>
                    <div>
                      <Label className="block font-semibold mb-1">Billing Type</Label>
                      <Input value={selectedReservation?.billingType || ''} readOnly placeholder="Auto-filled" />
                    </div>
                    <div>
                      <Label className="block font-semibold mb-1">Billing Rate (Rs/MT)</Label>
                      <Input value={selectedReservation?.billingRate || ''} readOnly placeholder="Auto-filled" />
                    </div>
                  </div>
                ) : null}

                {/* Inline rectangular alert: shows reservation/insurance expiry messages */}
                {inlineAlert && (
                  <div className="mt-4" role="alert">
                    <div className={`${inlineAlert.severity === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-yellow-50 border-yellow-200 text-yellow-800'} border rounded-lg p-4`}>
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          {inlineAlert.severity === 'error' ? (
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92z" />
                            </svg>
                          )}
                        </div>
                        <div className="ml-3">
                          <h3 className={`text-sm font-medium ${inlineAlert.severity === 'error' ? 'text-red-800' : 'text-yellow-800'}`}>{inlineAlert.title}</h3>
                          <p className={`mt-1 text-sm ${inlineAlert.severity === 'error' ? 'text-red-700' : 'text-yellow-700'}`}>
                            {inlineAlert.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Debug section - remove after fixing */}
            {form.warehouseName && form.client && (
              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 mb-4">
                <h3 className="font-semibold text-blue-800 mb-2">Debug Information</h3>
                <p className="text-sm text-blue-700">Warehouse: {form.warehouseName}</p>
                <p className="text-sm text-blue-700">Client: {form.client}</p>
                <p className="text-sm text-blue-700">Available Reservations: {availableReservations.length}</p>
                <p className="text-sm text-blue-700">Selected Reservation: {selectedReservation?.reservationId || 'None'}</p>
                <Button 
                  onClick={() => fetchAvailableReservations(form.warehouseName, form.client, form.state, form.branch, form.location)} 
                  className="mt-2 bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  🔄 Refresh Reservations
                </Button>
              </div>
            )}

            {form.warehouseName && form.businessType !== 'cm' && availableReservations.length === 0 && (
              <div className="border-t pt-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 text-sm">
                    <strong>Note:</strong> No reservation data found for this warehouse. 
                    Please ensure a reservation exists in the Reservation + Billing section.
                  </p>
                </div>
              </div>
            )}

            {/* Insurance Information (From Inspection Module) */}
            {!isEditMode && insuranceEntries.length > 0 && (
              <div className="border-t pt-6">
                <h3 className="text-xl font-semibold mb-6 text-orange-700">Insurance Information (From Inspection Module)</h3>
                
                {/* Debug Insurance Data */}
                <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded text-xs">
                  <p className="font-semibold text-purple-800">Insurance Debug:</p>
                  <p>Total Insurances: {insuranceEntries.length}</p>
                  <p>Client: {form.client}</p>
                  <p>Commodity: {baseForm.commodity}</p>
                  <p>Selected Bank: {selectedBank?.bankName || 'None selected'}</p>
                  <p>Insurances: {insuranceEntries.map((e: any) => `${e.insuranceTakenBy} (${e.clientName || e.commodityName || e.selectedBankName})`).join(', ')}</p>
                </div>
                
                {/* Insurance Summary with Checkboxes */}
                {insuranceEntries.length > 0 && (() => {
                  console.log('🔍 FILTERING INSURANCES:', {
                    total: insuranceEntries.length,
                    client: form.client,
                    commodity: baseForm.commodity,
                    selectedBank: selectedBank,
                    selectedBankName: selectedBank?.bankName,
                    allInsurances: insuranceEntries
                  });
                  
                  console.log('📋 ALL INSURANCE ENTRIES:');
                  insuranceEntries.forEach((entry: any, index: number) => {
                    console.log(`  [${index}] Type: ${entry.insuranceTakenBy}, Bank: ${entry.selectedBankName}, Commodity: ${entry.insuranceCommodity || entry.commodityName}, Client: ${entry.clientName}`);
                  });
                  
                  // Categorize insurances by type - NO COMMODITY FILTERING FOR CLIENT
                  const clientInsurance = insuranceEntries.find(entry => {
                    const insuranceType = (entry.insuranceTakenBy || '').toLowerCase().trim();
                    console.log(`Checking entry: ${entry.insuranceTakenBy}, type: ${insuranceType}, clientName: ${entry.clientName}`);
                    // Check if it's client insurance (exact match or contains "client")
                    if (insuranceType !== 'client' && !insuranceType.includes('client')) return false;
                    // Match by client name only (universal - NO commodity check)
                    const insuranceClientName = (entry.clientName || '').toLowerCase().trim();
                    const formClientName = (form.client || '').toLowerCase().trim();
                    const match = insuranceClientName === formClientName;
                    console.log(`Client match: ${insuranceClientName} === ${formClientName} = ${match}`);
                    return match;
                  });
                  
                  const warehouseOwnerInsurance = insuranceEntries.find(entry => {
                    const insuranceType = (entry.insuranceTakenBy || '').toLowerCase().trim();
                    console.log(`Checking warehouse-owner: ${entry.insuranceTakenBy}, type: ${insuranceType}, commodity: ${entry.insuranceCommodity || entry.commodityName}`);
                    // Check if it's warehouse-owner (exact match or contains)
                    if (insuranceType !== 'warehouse-owner' && insuranceType !== 'warehouse owner' && !insuranceType.includes('warehouse')) return false;
                    // Match by commodity
                    if (!baseForm.commodity) return false;
                    const entryCommodity = (entry.insuranceCommodity || entry.commodityName || '').toLowerCase().trim();
                    const formCommodity = baseForm.commodity.toLowerCase().trim();
                    const commodityMatch = entryCommodity === formCommodity || entryCommodity.includes(formCommodity) || formCommodity.includes(entryCommodity);
                    console.log(`Warehouse-owner commodity match: ${entryCommodity} vs ${formCommodity} = ${commodityMatch}`);
                    return commodityMatch;
                  });
                  
                  const bankFundedInsurance = insuranceEntries.find(entry => {
                    const insuranceType = (entry.insuranceTakenBy || '').toLowerCase().trim();
                    console.log(`\n🏦 Checking bank-funded insurance:`);
                    console.log(`   Type: "${entry.insuranceTakenBy}" (normalized: "${insuranceType}")`);
                    console.log(`   Insurance Bank: "${entry.selectedBankName}"`);
                    console.log(`   Insurance Commodity: "${entry.insuranceCommodity || entry.commodityName}"`);
                    
                    // Check if it's bank-funded (exact match or contains "bank")
                    if (insuranceType !== 'bank-funded' && insuranceType !== 'bank funded' && !insuranceType.includes('bank')) {
                      console.log(`   ❌ Not bank-funded type`);
                      return false;
                    }
                    console.log(`   ✅ Is bank-funded type`);
                    
                    // Match by commodity first
                    if (!baseForm.commodity) {
                      console.log('   ❌ No commodity selected in form');
                      return false;
                    }
                    const entryCommodity = (entry.insuranceCommodity || entry.commodityName || '').toLowerCase().trim();
                    const formCommodity = baseForm.commodity.toLowerCase().trim();
                    const commodityMatch = entryCommodity === formCommodity || entryCommodity.includes(formCommodity) || formCommodity.includes(entryCommodity);
                    console.log(`   Commodity: "${entryCommodity}" vs form "${formCommodity}" = ${commodityMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
                    if (!commodityMatch) return false;
                    
                    // Match with the selected bank from "Select Bank for this Warehouse"
                    if (!selectedBank) {
                      console.log('   ❌ No bank selected in "Select Bank for this Warehouse"');
                      return false;
                    }
                    console.log(`   Selected Bank Object:`, selectedBank);
                    
                    const insuranceBankName = (entry.selectedBankName || '').toLowerCase().trim();
                    const selectedBankName = selectedBank.bankName.toLowerCase().trim();
                    console.log(`   Insurance bank name (lowercase): "${insuranceBankName}"`);
                    console.log(`   Selected bank name (lowercase): "${selectedBankName}"`);
                    
                    // Direct match: insurance's bank name should match the selected bank's name
                    const exactMatch = insuranceBankName === selectedBankName;
                    const insuranceIncludesSelected = insuranceBankName.includes(selectedBankName);
                    const selectedIncludesInsurance = selectedBankName.includes(insuranceBankName);
                    const bankMatch = exactMatch || insuranceIncludesSelected || selectedIncludesInsurance;
                    
                    console.log(`   Exact match: ${exactMatch}`);
                    console.log(`   Insurance includes selected: ${insuranceIncludesSelected}`);
                    console.log(`   Selected includes insurance: ${selectedIncludesInsurance}`);
                    console.log(`   FINAL BANK MATCH: ${bankMatch ? '✅ YES' : '❌ NO'}`);
                    
                    return bankMatch;
                  });
                  
                  console.log('🌱 AGROGREEN CHECK:');
                  console.log('   agrogreenInsurance state:', agrogreenInsurance);
                  console.log('   agrogreenInsurance type:', typeof agrogreenInsurance);
                  console.log('   agrogreenInsurance truthiness:', !!agrogreenInsurance);
                  console.log('   agrogreenInsurance.shouldShow:', agrogreenInsurance?.shouldShow);
                  
                  // SIMPLIFIED: Just look for Agrogreen in insuranceEntries directly
                  // No need to check inspections flag - if it's in the list, show it
                  const agrogreenData = insuranceEntries.find(entry => {
                    const type = (entry.insuranceTakenBy || '').toLowerCase();
                    const isAgrogreen = type === 'agrogreen';
                    console.log('   Checking entry:', entry.insuranceTakenBy, 'isAgrogreen:', isAgrogreen);
                    return isAgrogreen;
                  });
                  console.log('   🌱 Found Agrogreen in insuranceEntries:', agrogreenData);
                  
                  const availableInsurances = [
                    clientInsurance && { type: 'client', data: clientInsurance },
                    warehouseOwnerInsurance && { type: 'warehouse-owner', data: warehouseOwnerInsurance },
                    bankFundedInsurance && { type: 'bank-funded', data: bankFundedInsurance },
                    agrogreenData && { type: 'agrogreen', data: agrogreenData }
                  ].filter(Boolean);
                  
                  console.log('✅ Available insurances:', availableInsurances);
                  console.log('Client insurance found:', !!clientInsurance);
                  console.log('Warehouse-owner insurance found:', !!warehouseOwnerInsurance);
                  console.log('Bank-funded insurance found:', !!bankFundedInsurance);
                  console.log('Agrogreen insurance found:', !!agrogreenData);
                  
                  if (availableInsurances.length === 0) {
                    return (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-yellow-800">No matching insurance found. Please check the insurance data.</p>
                      </div>
                    );
                  }
                  
                  const handleInsuranceSelect = (insurance: any) => {
                    console.log('🎯 SELECTED INSURANCE FULL OBJECT:', insurance);
                    console.log('📊 INSURANCE FIELDS:');
                    console.log('  - firePolicyRemainingAmount:', insurance.firePolicyRemainingAmount);
                    console.log('  - burglaryPolicyRemainingAmount:', insurance.burglaryPolicyRemainingAmount);
                    console.log('  - remainingFirePolicyAmount:', insurance.remainingFirePolicyAmount);
                    console.log('  - remainingBurglaryPolicyAmount:', insurance.remainingBurglaryPolicyAmount);
                    console.log('  - firePolicyAmount:', insurance.firePolicyAmount);
                    console.log('  - burglaryPolicyAmount:', insurance.burglaryPolicyAmount);
                    
                    setSelectedInsuranceForInward(insurance);
                    // Auto-fill form fields
                    setBaseForm(f => ({
                      ...f,
                      insuranceManagedBy: insurance.insuranceTakenBy || '',
                      firePolicyNumber: insurance.firePolicyNumber || '',
                      firePolicyAmount: insurance.remainingFirePolicyAmount || insurance.firePolicyAmount || '',
                      firePolicyStart: insurance.firePolicyStartDate || '',
                      firePolicyEnd: insurance.firePolicyEndDate || '',
                      burglaryPolicyNumber: insurance.burglaryPolicyNumber || '',
                      burglaryPolicyAmount: insurance.remainingBurglaryPolicyAmount || insurance.burglaryPolicyAmount || '',
                      burglaryPolicyStart: insurance.burglaryPolicyStartDate || '',
                      burglaryPolicyEnd: insurance.burglaryPolicyEndDate || '',
                      firePolicyCompanyName: insurance.firePolicyCompanyName || '',
                      burglaryPolicyCompanyName: insurance.burglaryPolicyCompanyName || '',
                      bankFundedBy: insurance.selectedBankName || '',
                    }));
                  };
                  
                  return (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Insurance Coverage Summary - Select One
                      </h4>
                      <div className="space-y-4">
                        {availableInsurances.map((item: any, index) => {
                          const insurance = item.data;
                          const isSelected = selectedInsuranceForInward?.id === insurance.id;
                          return (
                            <div 
                              key={index} 
                              className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                isSelected 
                                  ? 'border-green-600 bg-green-100' 
                                  : 'border-green-300 bg-white hover:border-green-500'
                              }`}
                              onClick={() => handleInsuranceSelect(insurance)}
                            >
                              <div className="flex items-start gap-3">
                                <input 
                                  type="radio" 
                                  checked={isSelected}
                                  onChange={() => handleInsuranceSelect(insurance)}
                                  className="mt-1"
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-green-700 mb-2">
                                    {insurance.insuranceTakenBy} Insurance
                                    {insurance.selectedBankName && (
                                      <span className="ml-2 text-xs text-green-600">({insurance.selectedBankName})</span>
                                    )}
                                    {insurance.clientName && (
                                      <span className="ml-2 text-xs text-green-600">({insurance.clientName})</span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-sm text-green-600">
                                    <div>🔥 Fire Policy: ₹{parseFloat(insurance.remainingFirePolicyAmount || insurance.firePolicyAmount || '0').toLocaleString()} remaining</div>
                                    <div>🛡️ Burglary Policy: ₹{parseFloat(insurance.remainingBurglaryPolicyAmount || insurance.burglaryPolicyAmount || '0').toLocaleString()} remaining</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                

              </div>
            )}

            {!isEditMode && form.commodity && insuranceEntries.length === 0 && (
              <div className="border-t pt-4">
                { /*
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-yellow-800 text-sm">
                      <strong>Note:</strong> No insurance data found for this warehouse in the inspection module. 
                      Please ensure insurance data exists in the Warehouse Inspection section.
                    </p>
                  </div>
                */ }
              </div>
            )}

            {/* Your Insurance Section */}
            {isEditMode && (
              <div className="border-t pt-6 mb-6">
                <h3 className="text-xl font-semibold mb-4 text-blue-700">Your Insurance</h3>
                {yourInsurance ? (
                  <div className="border border-blue-200 rounded-lg p-6 bg-blue-50">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-medium text-blue-700">Insurance ID: {yourInsurance.insuranceId}</h4>
                      <div className="text-sm text-blue-600 font-medium">
                        {yourInsurance.insuranceTakenBy} - {yourInsurance.insuranceCommodity}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label className="block font-semibold mb-1">Insurance Taken By</Label>
                        <Input value={yourInsurance.insuranceTakenBy || ''} readOnly />
                      </div>
                      <div>
                        <Label className="block font-semibold mb-1">Commodity</Label>
                        <Input value={yourInsurance.insuranceCommodity || ''} readOnly />
                      </div>
                      <div>
                        <Label className="block font-semibold mb-1">Fire Policy Number</Label>
                        <Input value={yourInsurance.firePolicyNumber || ''} readOnly />
                      </div>
                      <div>
                        <Label className="block font-semibold mb-1">Fire Policy Amount</Label>
                        <Input value={formatAmount(yourInsurance.firePolicyAmount)} readOnly />
                      </div>
                      <div>
                        <Label className="block font-semibold mb-1">Fire Policy Start Date</Label>
                        <Input value={normalizeDate(yourInsurance.firePolicyStartDate)} readOnly />
                      </div>
                      <div>
                        <Label className="block font-semibold mb-1">Fire Policy End Date</Label>
                        <Input value={normalizeDate(yourInsurance.firePolicyEndDate)} readOnly />
                      </div>
                      <div>
                        <Label className="block font-semibold mb-1">Burglary Policy Number</Label>
                        <Input value={yourInsurance.burglaryPolicyNumber || ''} readOnly />
                      </div>
                      <div>
                        <Label className="block font-semibold mb-1">Burglary Policy Amount</Label>
                        <Input value={formatAmount(yourInsurance.burglaryPolicyAmount)} readOnly />
                      </div>
                      <div>
                        <Label className="block font-semibold mb-1">Burglary Policy Start Date</Label>
                        <Input value={normalizeDate(yourInsurance.burglaryPolicyStartDate)} readOnly />
                      </div>
                      <div>
                        <Label className="block font-semibold mb-1">Burglary Policy End Date</Label>
                        <Input value={normalizeDate(yourInsurance.burglaryPolicyEndDate)} readOnly />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">No insurance found for this inward entry.</div>
                )}
              </div>
            )}



            {(() => {
              console.log('🚨 INSURANCE CHECK DEBUG:');
              console.log('form.commodity:', form.commodity);
              console.log('insuranceEntries:', insuranceEntries);
              console.log('insuranceEntries.length:', insuranceEntries.length);
              console.log('Should show "No insurance data found" message:', !!(form.commodity && insuranceEntries.length === 0));
              return form.commodity && insuranceEntries.length === 0;
            })() && (
              <div className="border-t pt-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 text-sm">
                    <strong>Note:</strong> No insurance data found for this warehouse in the inspection module. 
                    Please ensure insurance data exists in the Warehouse Inspection section.
                  </p>
                </div>
              </div>
            )}

            {/* Editable Inward Entries */}
            {isEditMode && inwardEntries.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-4 text-green-700">Inward Entries (Editable)</h3>
      <div className="space-y-6">
                  {inwardEntries.map((entry, index) => (
                    <div key={entry.id} className="border border-green-300 rounded-lg p-6 bg-green-50">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-green-800">Entry #{entry.entryNumber}</h4>
                        <div className="text-sm text-green-600 font-medium">
                          Vehicle: {entry.vehicleNumber} | Gatepass: {entry.getpassNumber}
                        </div>
                      </div>

                      {/* Vehicle Information */}
                      <div className="mb-4">
                        <h5 className="text-md font-semibold mb-2 text-green-700">Vehicle Information</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Vehicle Number</Label>
                            <Input 
                              value={entry.vehicleNumber || ''} 
                              onChange={(e) => handleEntryUpdate(index, 'vehicleNumber', e.target.value)}
                              className="bg-white border-green-300" 
                              disabled={!canCreateInwardEntry}
                            />
                          </div>
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Gatepass Number</Label>
                            <Input 
                              value={entry.getpassNumber || ''} 
                              onChange={(e) => handleEntryUpdate(index, 'getpassNumber', e.target.value)}
                              className="bg-white border-green-300" 
                              disabled={!canCreateInwardEntry}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Weight Bridge Information */}
                      <div className="mb-4">
                        <h5 className="text-md font-semibold mb-2 text-green-700">Weight Bridge Information</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Weight Bridge</Label>
                            <Input 
                              value={entry.weightBridge || ''} 
                              onChange={(e) => handleEntryUpdate(index, 'weightBridge', e.target.value)}
                              className="bg-white border-green-300" 
                              disabled={!canCreateInwardEntry}
                            />
                          </div>
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Weight Bridge Slip Number</Label>
                            <Input 
                              value={entry.weightBridgeSlipNumber || ''} 
                              onChange={(e) => handleEntryUpdate(index, 'weightBridgeSlipNumber', e.target.value)}
                              className="bg-white border-green-300" 
                              disabled={!canCreateInwardEntry}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Weight Information */}
                      <div className="mb-4">
                        <h5 className="text-md font-semibold mb-2 text-green-700">Weight Information</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Gross Weight (MT)</Label>
                            <Input 
                              value={entry.grossWeight || ''} 
                              onChange={(e) => handleEntryUpdate(index, 'grossWeight', e.target.value)}
                              className="bg-white border-green-300" 
                              disabled={!canCreateInwardEntry}
                            />
                          </div>
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Tare Weight (MT)</Label>
                            <Input 
                              value={entry.tareWeight || ''} 
                              onChange={(e) => handleEntryUpdate(index, 'tareWeight', e.target.value)}
                              className="bg-white border-green-300" 
                              disabled={!canCreateInwardEntry}
                            />
                          </div>
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Net Weight (MT)</Label>
                            <Input 
                              value={entry.netWeight || ''} 
                              onChange={(e) => handleEntryUpdate(index, 'netWeight', e.target.value)}
                              className="bg-white border-green-300" 
                              disabled={!canCreateInwardEntry}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Total Bags</Label>
                            <Input 
                              value={entry.totalBags || ''} 
                              onChange={(e) => handleEntryUpdate(index, 'totalBags', e.target.value)}
                              className={`bg-white ${
                                entry.totalBags && !validateEntryStackBags(entry) 
                                  ? 'border-red-500 bg-red-50' 
                                  : 'border-green-300'
                              }`}
                              disabled={!canCreateInwardEntry}
                            />
                            {entry.totalBags && !validateEntryStackBags(entry) && (
                              <p className="text-xs text-red-600 mt-1">
                                ⚠️ Total bags must equal sum of stack bags
                              </p>
                            )}
                          </div>
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Total Quantity (MT)</Label>
                            <Input 
                              value={entry.totalQuantity || ''} 
                              onChange={(e) => handleEntryUpdate(index, 'totalQuantity', e.target.value)}
                              className="bg-white border-green-300" 
                              disabled={!canCreateInwardEntry}
                            />
                          </div>
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Average Weight (Kg/Bag)</Label>
                            <Input 
                              value={entry.averageWeight || ''} 
                              readOnly
                              className="bg-gray-100 border-green-300" 
                            />
                          </div>
                        </div>
                      </div>



                      {/* Stack Information */}
                      <div>

                        <div className="space-y-3">
                          {entry.stacks && entry.stacks.map((stack: any, stackIndex: number) => (
                            <div key={stackIndex} className="border border-green-200 rounded-lg p-3 bg-white">
                              <div className="flex items-center justify-between mb-2">
                                <h6 className="font-medium text-green-700">Stack {stackIndex + 1}</h6>
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleEntryRemoveStack(index, stackIndex)}
                                  className="text-red-600 border-red-300 hover:bg-red-50"
                                  disabled={!canCreateInwardEntry}
                                >
                                  Remove
                                </Button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <Label className="block font-medium mb-1 text-green-600">Stack Number</Label>
                                  <Input 
                                    value={stack.stackNumber || ''} 
                                    onChange={(e) => handleEntryStackUpdate(index, stackIndex, 'stackNumber', e.target.value)}
                                    className="bg-white border-green-300" 
                                    disabled={!canCreateInwardEntry}
                                  />
                                </div>
                                <div>
                                  <Label className="block font-medium mb-1 text-green-600">Number of Bags</Label>
                                  <Input 
                                    value={stack.numberOfBags || ''} 
                                    onChange={(e) => handleEntryStackUpdate(index, stackIndex, 'numberOfBags', e.target.value)}
                                    className="bg-white border-green-300" 
                                    disabled={!canCreateInwardEntry}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Stack Validation Section */}
                        {entry.totalBags && (
                          <div className="mt-4 p-3 rounded-lg border border-green-200 bg-green-50">
                            <div className="flex items-center justify-between">
                              <div className="text-sm">
                                <span className="font-medium text-green-700">Stack Validation:</span>
                                <span className={`ml-2 ${validateEntryStackBags(entry) ? 'text-green-600' : 'text-red-600'}`}>
                                  {validateEntryStackBags(entry) ? '✓ Valid' : '✗ Invalid'}
                                </span>
                              </div>
                              <div className="text-xs text-green-600">
                                Total Bags: {entry.totalBags} | Stack Bags: {
                                  entry.stacks ? entry.stacks.reduce((total: number, stack: { numberOfBags: string }) => {
                                    return total + (parseInt(stack.numberOfBags) || 0);
                                  }, 0) : 0
                                }
                              </div>
                            </div>
                            {!validateEntryStackBags(entry) && (
                              <p className="text-xs text-red-600 mt-1">
                                Total bags must equal the sum of all stack bags
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Saved Inward Entries Section (Non-Edit Mode) */}
            {!isEditMode && inwardEntries.length > 0 && (
              <div className="border-t pt-6 mb-6">
                <h3 className="text-lg font-semibold mb-4 text-green-700">Saved Inward Entries</h3>
                <div className="space-y-6">
                  {inwardEntries.map((entry, index) => (
                    <div key={entry.id} className="border border-green-300 rounded-lg p-6 bg-green-50">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-green-800">Entry #{entry.entryNumber}</h4>
                        <div className="text-sm text-green-600 font-medium">
                          Vehicle: {entry.vehicleNumber} | Gatepass: {entry.getpassNumber}
                        </div>
                      </div>
                      
                      {/* Vehicle Information */}
                      <div className="mb-4">
                        <h5 className="text-md font-semibold mb-2 text-green-700">Vehicle Information</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Vehicle Number</Label>
                            <Input value={entry.vehicleNumber || '-'} readOnly className="bg-white border-green-300" />
                          </div>
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Gatepass Number</Label>
                            <Input value={entry.getpassNumber || '-'} readOnly className="bg-white border-green-300" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Weight Bridge Information */}
                      <div className="mb-4">
                        <h5 className="text-md font-semibold mb-2 text-green-700">Weight Bridge Information</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Weight Bridge</Label>
                            <Input value={entry.weightBridge || '-'} readOnly className="bg-white border-green-300" />
                          </div>
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Weight Bridge Slip Number</Label>
                            <Input value={entry.weightBridgeSlipNumber || '-'} readOnly className="bg-white border-green-300" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Weight Information */}
                      <div className="mb-4">
                        <h5 className="text-md font-semibold mb-2 text-green-700">Weight Information</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Gross Weight (MT)</Label>
                            <Input value={entry.grossWeight || '-'} readOnly className="bg-white border-green-300" />
                          </div>
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Tare Weight (MT)</Label>
                            <Input value={entry.tareWeight || '-'} readOnly className="bg-white border-green-300" />
                          </div>
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Net Weight (MT)</Label>
                            <Input value={entry.netWeight || '-'} readOnly className="bg-white border-green-300" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Additional Information */}
                      <div className="mb-4">
                        <h5 className="text-md font-semibold mb-2 text-green-700">Additional Information</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Average Weight</Label>
                            <Input value={entry.averageWeight || '-'} readOnly className="bg-white border-green-300" />
                          </div>
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Total Bags</Label>
                            <Input value={entry.totalBags || '-'} readOnly className="bg-white border-green-300" />
                          </div>
                          <div>
                            <Label className="block font-medium mb-1 text-green-600">Total Quantity</Label>
                            <Input value={entry.totalQuantity || '-'} readOnly className="bg-white border-green-300" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Stack Information */}
                      <div>
                        <h5 className="text-md font-semibold mb-2 text-green-700">Stack Information</h5>
                        <div className="space-y-3">
                          {entry.stacks && Array.isArray(entry.stacks) && entry.stacks.length > 0 ? (
                            entry.stacks.map((stack: any, stackIndex: number) => (
                              <div key={stackIndex} className="border border-green-200 rounded-lg p-3 bg-white">
                                <div className="flex items-center justify-between mb-2">
                                  <h6 className="font-medium text-green-700">Stack {stackIndex + 1}</h6>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <Label className="block font-medium mb-1 text-green-600">Stack Number</Label>
                                    <Input value={stack.stackNumber || '-'} readOnly className="bg-gray-50 border-green-300" />
                                  </div>
                                  <div>
                                    <Label className="block font-medium mb-1 text-green-600">Number of Bags</Label>
                                    <Input value={stack.numberOfBags || '-'} readOnly className="bg-gray-50 border-green-300" />
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-4 text-green-600">
                              No stack information available
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inward Entry Section */}
            {!isEditMode && (
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-orange-700">Inward Entry</h3>
                    {hasPendingEntries && (
                      <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-medium">
                        {inwardEntries.length} pending entr{inwardEntries.length === 1 ? 'y' : 'ies'}
                      </div>
                    )}
                  </div>
                <Button 
                  type="button" 
                  onClick={addNewInwardEntry}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm"
                  disabled={!canCreateInwardEntry}
                >
                  Add New Entry
                </Button>
              </div>

              {/* Vehicle Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <Label className="block font-semibold mb-2">Vehicle Number <span className="text-red-500">*</span></Label>
                  <Input 
                    value={form.vehicleNumber} 
                    onChange={e => setCurrentEntryForm(f => ({ ...f, vehicleNumber: e.target.value }))} 
                    placeholder="Enter Vehicle Number"
                    disabled={!canCreateInwardEntry}
                  />
                </div>
                <div>
                  <Label className="block font-semibold mb-2">Gatepass Number <span className="text-red-500">*</span></Label>
                  <Input 
                    value={form.getpassNumber} 
                    onChange={e => setCurrentEntryForm(f => ({ ...f, getpassNumber: e.target.value }))} 
                    placeholder="Enter Gatepass Number"
                    disabled={!canCreateInwardEntry}
                  />
                  <p className="text-xs text-orange-600 mt-1">Gatepass number must be unique across all entries</p>
                </div>
              </div>

              {/* Weight Bridge Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <Label className="block font-semibold mb-2">Weighbridge Name<span className="text-red-500">*</span></Label>
                  <Input 
                    value={form.weightBridge} 
                    onChange={e => setCurrentEntryForm(f => ({ ...f, weightBridge: e.target.value }))} 
                    placeholder="Enter Weighbridge Name"
                    disabled={!canCreateInwardEntry}
                  />
                </div>
                <div>
                  <Label className="block font-semibold mb-2">Weighbridge Slip Number <span className="text-red-500">*</span></Label>
                  <Input 
                    value={form.weightBridgeSlipNumber} 
                    onChange={e => setCurrentEntryForm(f => ({ ...f, weightBridgeSlipNumber: e.target.value }))} 
                    placeholder="Enter Slip Number"
                    disabled={!canCreateInwardEntry}
                  />
                  <p className="text-xs text-orange-600 mt-1">Weighbridge slip number must be unique across all entries</p>
                </div>
              </div>

              {/* Weight Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <Label className="block font-semibold mb-2">Gross Weight (MT) <span className="text-red-500">*</span></Label>
                  <Input 
                    type="number"
                    step="0.001"
                    min="0"
                    value={form.grossWeight} 
                    onChange={e => handleGrossWeightChange(e.target.value)} 
                    placeholder="0.000"
                    disabled={!canCreateInwardEntry}
                  />
                </div>
                <div>
                  <Label className="block font-semibold mb-2">Tare Weight (MT) <span className="text-red-500">*</span></Label>
                  <Input 
                    type="number"
                    step="0.001"
                    min="0"
                    value={form.tareWeight} 
                    onChange={e => handleTareWeightChange(e.target.value)} 
                    placeholder="0.000"
                    disabled={!canCreateInwardEntry}
                  />
                </div>
                <div>
                  <Label className="block font-semibold mb-2">Net Weight (MT)</Label>
                  <Input 
                    type="number"
                    step="0.001"
                    value={form.netWeight} 
                    onChange={e => handleNetWeightChange(e.target.value)} 
                    placeholder="Auto-calculated"
                    className="bg-gray-50"
                    disabled={!canCreateInwardEntry}
                  />
                </div>
              </div>

              {/* Quantity and Value Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <Label className="block font-semibold mb-2">Total Bags <span className="text-red-500">*</span></Label>
                  <Input 
                    type="number"
                    min="1"
                    value={currentEntryForm.totalBags}
                    onChange={e => handleTotalBagsChange(e.target.value)}
                    placeholder="0"
                    className={currentEntryForm.totalBags && !validateStackBags() ? 'border-red-500 bg-red-50' : ''}
                    disabled={!canCreateInwardEntry}
                  />
                  {currentEntryForm.totalBags && !validateStackBags() && (
                    <p className="text-xs text-red-600 mt-1">
                      ⚠️ Total bags must equal sum of stack bags. Update stack bags to match your entered total.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="block font-semibold mb-2">Total Quantity (MT) <span className="text-red-500">*</span></Label>
                  <Input 
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={currentEntryForm.totalQuantity}
                    onChange={e => setCurrentEntryForm(f => ({ ...f, totalQuantity: e.target.value }))} 
                    placeholder="0.000"
                    disabled={!canCreateInwardEntry}
                  />
                </div>
                <div>
                  <Label className="block font-semibold mb-2">Average Weight (MT)</Label>
                  <Input 
                    value={form.averageWeight} 
                    readOnly 
                    placeholder="Auto-calculated"
                    className="bg-gray-50"
                  />
                </div>
              </div>

              {/* Stack Information */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="text-md font-semibold text-orange-600">Stack Entry</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Add stacks and ensure the sum of stack bags matches your manually entered total bags
                    </p>
                  </div>
                  <Button 
                    type="button" 
                    onClick={addStack}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                    disabled={!canCreateInwardEntry}
                  >
                    + Add Stack
                  </Button>
                </div>

                {form.stacks.map((stack, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h5 className="font-medium text-gray-700">Stack {index + 1}</h5>
                      {form.stacks.length > 1 && (
                        <Button 
                          type="button" 
                          onClick={() => removeStack(index)}
                          className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
                          disabled={!canCreateInwardEntry}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label className="block font-semibold mb-2">Stack Number <span className="text-red-500">*</span></Label>
                        <Input 
                          value={stack.stackNumber} 
                          onChange={e => updateStack(index, 'stackNumber', e.target.value)} 
                          placeholder="Enter Stack Number"
                          disabled={!canCreateInwardEntry}
                        />
                      </div>
                      <div>
                        <Label className="block font-semibold mb-2">Number of Bags <span className="text-red-500">*</span></Label>
                        <Input 
                          type="number"
                          min="1"
                          value={stack.numberOfBags} 
                          onChange={e => updateStack(index, 'numberOfBags', e.target.value)} 
                          placeholder="0"
                          disabled={!canCreateInwardEntry}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Stack Validation */}
                {form.totalBags && (
                  <div className={`p-4 rounded-lg mb-6 ${
                    validateStackBags() 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <p className={`text-sm ${
                      validateStackBags() ? 'text-green-700' : 'text-red-700'
                    }`}>
                      <strong>Stack Validation:</strong> 
                      Total Bags: {form.totalBags} | 
                      Stack Bags: {calculateTotalBagsFromStacks()} | 
                      {validateStackBags() ? ' ✓ Valid' : ' ✗ Mismatch'}
                    </p>
                  </div>
                )}
              </div>

              {/* Lab Parameter Section */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-6 text-orange-700">Lab Parameter</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <Label className="block font-semibold mb-2">Date of Sampling <span className="text-red-500">*</span></Label>
                    <Input 
                      type="date"
                      value={baseForm.dateOfSampling}
                      onChange={e => setBaseForm(f => ({ ...f, dateOfSampling: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="block font-semibold mb-2">Date of Testing <span className="text-red-500">*</span></Label>
                    <Input 
                      type="date"
                      value={baseForm.dateOfTesting}
                      onChange={e => setBaseForm(f => ({ ...f, dateOfTesting: e.target.value }))}
                      disabled={!baseForm.dateOfSampling}
                      min={baseForm.dateOfSampling}
                    />
                  </div>
                </div>
                <div>
                  <Label className="block font-semibold mb-2">Quality Parameters (from Commodity & Variety)</Label>
                  <div className="overflow-x-auto max-w-lg">
                    <table className="min-w-full border border-green-300 rounded-lg">
                      <thead className="bg-orange-100 text-orange-600 font-bold">
                        <tr>
                          <th className="px-4 py-2 border-green-300 border">Parameter</th>
                          <th className="px-4 py-2 border-green-300 border">Min %</th>
                          <th className="px-4 py-2 border-green-300 border">Max %</th>
                          <th className="px-4 py-2 border-green-300 border">Actual (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Find particulars for the current form's commodity and variety
                          console.log('Quality Parameters table rendering with:', {
                            formCommodity: form.commodity,
                            formVariety: form.varietyName,
                            commoditiesCount: commodities.length
                          });
                          
                          const commodity = commodities.find((c: any) => c.commodityName === form.commodity);
                          const variety = commodity?.varieties?.find((v: any) => v.varietyName === form.varietyName);
                          const particulars = variety?.particulars || [];
                          
                          console.log('Quality Parameters found:', {
                            commodity: commodity?.commodityName,
                            variety: variety?.varietyName,
                            particularsCount: particulars.length,
                            particulars: particulars
                          });
                          
                          return particulars.length > 0 ? (
                            particulars.map((p: any, idx: number) => (
                          <tr key={idx} className="text-green-800">
                            <td className="px-4 py-2 border-green-300 border">{p.name}</td>
                            <td className="px-4 py-2 border-green-300 border">{p.minPercentage}</td>
                            <td className="px-4 py-2 border-green-300 border">{p.maxPercentage}</td>
                            <td className="px-4 py-2 border-green-300 border">
                              <Input
                                type="number"
                                value={currentEntryForm.labResults?.[idx]?.value || ''}
                                onChange={(e) => handleLabResultChange(idx, e.target.value)}
                                className="w-24 bg-white border border-green-300 text-center"
                                placeholder="Enter value"
                              />
                            </td>
                          </tr>
                            ))
                          ) : (
                          <tr><td colSpan={4} className="text-center text-gray-400 py-2">No quality parameters found for this variety.</td></tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Lab Parameters Section */}
            {isEditMode && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-6 text-green-700">Lab Parameters</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <Label className="block font-semibold mb-2">Date of Sampling <span className="text-red-500">*</span></Label>
                    <Input 
                      type="date"
                      value={baseForm.dateOfSampling}
                      onChange={e => setBaseForm(f => ({ ...f, dateOfSampling: e.target.value }))}
                      className="bg-white border-green-300"
                    />
                  </div>
                  <div>
                    <Label className="block font-semibold mb-2">Date of Testing <span className="text-red-500">*</span></Label>
                    <Input 
                      type="date"
                      value={baseForm.dateOfTesting}
                      onChange={e => setBaseForm(f => ({ ...f, dateOfTesting: e.target.value }))}
                      disabled={!baseForm.dateOfSampling}
                      min={baseForm.dateOfSampling}
                      className="bg-white border-green-300"
                    />
                  </div>
                </div>
                <div>
                  <Label className="block font-semibold mb-2 text-green-600">Quality Parameters (from Commodity & Variety)</Label>
                  <div className="overflow-x-auto max-w-lg">
                    <table className="min-w-full border border-green-300 rounded-lg">
                      <thead className="bg-green-100 text-green-600 font-bold">
                        <tr>
                          <th className="px-4 py-2 border-green-300 border">Parameter</th>
                          <th className="px-4 py-2 border-green-300 border">Min %</th>
                          <th className="px-4 py-2 border-green-300 border">Max %</th>
                          <th className="px-4 py-2 border-green-300 border">Actual (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Find particulars for the current form's commodity and variety
                          console.log('Quality Parameters table rendering with:', {
                            formCommodity: form.commodity,
                            formVariety: form.varietyName,
                            commoditiesCount: commodities.length
                          });
                          
                          const commodity = commodities.find((c: any) => c.commodityName === form.commodity);
                          const variety = commodity?.varieties?.find((v: any) => v.varietyName === form.varietyName);
                          const particulars = variety?.particulars || [];
                          
                          console.log('Quality Parameters found:', {
                            commodity: commodity?.commodityName,
                            variety: variety?.varietyName,
                            particularsCount: particulars.length,
                            particulars: particulars
                          });
                          
                          return particulars.length > 0 ? (
                            particulars.map((p: any, idx: number) => (
                          <tr key={idx} className="text-green-800">
                            <td className="px-4 py-2 border-green-300 border">{p.name}</td>
                            <td className="px-4 py-2 border-green-300 border">{p.minPercentage}</td>
                            <td className="px-4 py-2 border-green-300 border">{p.maxPercentage}</td>
                            <td className="px-4 py-2 border-green-300 border">
                              <Input
                                type="number"
                                value={currentEntryForm.labResults?.[idx]?.value || ''}
                                onChange={(e) => handleLabResultChange(idx, e.target.value)}
                                className="w-24 bg-white border border-green-300 text-center"
                                placeholder="Enter value"
                              />
                            </td>
                          </tr>
                            ))
                          ) : (
                          <tr><td colSpan={4} className="text-center text-gray-400 py-2">No quality parameters found for this variety.</td></tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* File Attachment Section */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-orange-700">File Attachment</h3>
              <div>
                <Label className="block font-semibold mb-2">Attach File <span className="text-red-500">*</span></Label>
                <Input 
                  type="file"
                  onChange={handleFileChange}
                  accept=".jpg,.jpeg,.png,.pdf,.xls,.xlsx"
                  className="pt-1.5"
                />
                {fileAttachment && <p className="text-sm text-gray-500 mt-1">Selected: {fileAttachment.name}</p>}
              </div>
            </div>



            <div className="flex justify-end pt-6 sm:pt-8">
              <Button 
                type="submit" 
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 text-sm sm:py-3 sm:text-base w-full sm:w-auto" 
                disabled={isUploading || !canCreateInwardEntry}
              >
                {!canCreateInwardEntry 
                  ? 'Read-Only Mode - Cannot Submit' 
                  : isUploading 
                    ? 'Uploading & Saving...' 
                    : (isEditMode ? 'Update Inward Entry' : 'Submit')
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <div className="space-y-6 px-8">
        {loading && (
          <div className="border rounded-lg p-8 flex items-center justify-center">
            <p className="text-muted-foreground">Loading data...</p>
          </div>
        )}
        
        {error && (
          <div className="border border-red-200 rounded-lg p-8 flex items-center justify-center">
            <p className="text-red-600">{error}</p>
          </div>
        )}
        
        {!loading && !error && (
        <div className="border rounded-lg p-8 flex items-center justify-center">
          <p className="text-muted-foreground">Inward management will be implemented here.</p>
        </div>
        )}
      </div>

      {/* SR/WR View Modal */}
      <Dialog open={showSRForm} onOpenChange={setShowSRForm}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          {/* Custom Header Section */}
          <div className="flex flex-col items-center justify-center mb-4 sm:mb-8 mt-2">
            <Image src="/Group 86.png" alt="Agrogreen Logo" width={100} height={85} style={{ marginBottom: 6, borderRadius: '30%', objectFit: 'cover' }} className="sm:w-[120px] sm:h-[100px]" />
            <div className="text-base sm:text-lg font-extrabold text-orange-600 mt-2 mb-1 text-center" style={{ letterSpacing: '0.02em' }}>
              AGROGREEN WAREHOUSING PRIVATE LTD.
            </div>
            <div className="text-sm sm:text-base font-semibold text-green-600 mb-2 text-center px-2">
              603, 6th Floor, Princess Business Skyline, Indore, Madhya Pradesh - 452010
            </div>
            <div className="text-sm sm:text-md font-bold text-orange-600 underline text-center mb-2" style={{ letterSpacing: '0.01em' }}>
              {selectedRowForSR?.receiptType === 'WR' ? 'Warehouse Receipt' : 'Storage Receipt'}
            </div>
          </div>
          <DialogHeader>
            <DialogTitle className="text-green-700 text-lg sm:text-xl">
              {/* {selectedRowForSR?.receiptType === 'WR' ? 'Warehouse Receipt View' : 'Storage Receipt View'} */}
            </DialogTitle>
          </DialogHeader>
          {selectedRowForSR && (
            <div className="space-y-3 sm:space-y-4">
              {/* CAD No and SR/WR No */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="flex-1">
                  <Label className="font-semibold text-sm sm:text-base">{selectedRowForSR.receiptType === 'WR' ? 'WR No' : 'SR No'}</Label>
                  <Input value={selectedRowForSR.srNo || `${selectedRowForSR.receiptType === 'WR' ? 'WR' : 'SR'}-${selectedRowForSR.inwardId || 'XXX'}-${selectedRowForSR.dateOfInward ? selectedRowForSR.dateOfInward.replace(/-/g, '') : ''}`} readOnly />
                </div>
                <div className="flex-1">
                  <Label className="font-semibold">{selectedRowForSR.receiptType === 'WR' ? 'WR Generation Date' : 'SR Generation Date'}</Label>
                  <Input
                    value={selectedRowForSR?.srGenerationDate ? normalizeDate(selectedRowForSR.srGenerationDate) : (srGenerationDate || '')}
                    readOnly
                    placeholder="Auto-set on Approve"
                  />
                </div>
                <div className="flex-1">
                  <Label className="font-semibold">CAD No</Label>
                  <Input value={selectedRowForSR.cadNumber || ''} readOnly />
                </div>
              </div>
              {/* Stock Inward Date */}
              <div>
                <Label className="font-semibold">Date of deposit</Label>
                <Input value={selectedRowForSR.dateOfInward || ''} readOnly />
              </div>
              {/* Bank, Warehouse, Client, Commodity Details */}
              <div className="mt-4 sm:mt-6">
                <Label className="font-semibold text-orange-500 text-sm sm:text-base">Bank Details</Label>
                <div className="border border-gray-200 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4 bg-gray-50">
                <div className="flex flex-wrap gap-4 items-center">
                <div>
                    <Label className="text-sm font-medium">Bank Name</Label>
                    <Input value={selectedRowForSR?.bankName || selectedRowForSR?.bankFundedBy || ''} readOnly className="text-sm mt-1 bg-white w-48" />
                </div>
                <div>
                    <Label className="text-sm font-medium">Bank Branch</Label>
                    <Input value={selectedRowForSR?.bankBranch || ''} readOnly className="text-sm mt-1 bg-white w-48" />
                </div>
                <div>
                    <Label className="text-sm font-medium">IFSC Code</Label>
                    <Input value={selectedRowForSR?.ifscCode || ''} readOnly className="text-sm mt-1 bg-white w-48" />
                </div>
                </div>
                </div>
              </div>
              <div className="mt-6">
                <Label className="font-semibold text-orange-500">Warehouse Details</Label>
                <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
                <div className="flex flex-wrap gap-4 items-center">
                <div>
                    <Label className="text-sm font-medium">Warehouse Name</Label>
                    <Input value={selectedRowForSR?.warehouseName || ''} readOnly className="text-sm mt-1 bg-white w-48" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Warehouse Code</Label>
                    <Input value={selectedRowForSR?.warehouseCode || ''} readOnly className="text-sm mt-1 bg-white w-48" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Warehouse Address</Label>
                    <Input value={selectedRowForSR?.warehouseAddress || ''} readOnly className="text-sm mt-1 bg-white w-48" />
                  </div>
                </div>
                </div>
              </div>
              <div className="mt-6">
                <Label className="font-semibold text-orange-500">Client Details</Label>
                <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
                <div className="flex flex-wrap gap-4 items-center">
                  <div>
                    <Label className="text-sm font-medium">Client Name</Label>
                    <Input value={selectedRowForSR?.client || ''} readOnly className="text-sm mt-1 bg-white w-48" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Client Code</Label>
                    <Input value={selectedRowForSR?.clientCode || ''} readOnly className="text-sm mt-1 bg-white w-48" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Client Address</Label>
                    <Input value={selectedRowForSR?.clientAddress || ''} readOnly className="text-sm mt-1 bg-white w-48" />
                  </div>
                </div>
                </div>
              </div>
              <div className="mt-4 sm:mt-6">
                <Label className="font-semibold text-orange-500 text-sm sm:text-base">Commodity Details</Label>
                <div className="border border-gray-200 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4 bg-gray-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label className="text-sm font-medium">Commodity</Label>
                      <Input value={selectedRowForSR?.commodity || ''} readOnly className="text-sm mt-1 bg-white w-72" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Variety</Label>
                      <Input value={selectedRowForSR?.varietyName || ''} readOnly className="text-sm mt-1 bg-white w-72" />
                    </div>
                    <div>
                      <Label className="font-semibold">No. of Bags/Bales</Label>
                      <Input value={selectedRowForSR.totalBags || ''} readOnly />
                    </div>
                    <div>
                      <Label className="font-semibold">Total Quantity (MT)</Label>
                      <Input value={selectedRowForSR.totalQuantity || ''} readOnly />
                    </div>
                    <div>
                      <Label className="font-semibold">Total Value (Rs/MT)</Label>
                      <Input value={`${selectedRowForSR.totalValue || ''}`} readOnly />
                    </div>
                    <div>
                      <Label className="font-semibold">Market Rate (Rs/MT)</Label>
                      <Input value={`${selectedRowForSR.marketRate || ''}`} readOnly />
                    </div>
                    <div>
                      <Label className="font-semibold">Base Receipt Number</Label>
                      <Input value={selectedRowForSR.bankReceipt || ''} readOnly />
                                  </div>
                    <div>
                      <Label className="font-semibold">Value of Commodities (in words)</Label>
                      <Input value={numberToWords(selectedRowForSR.totalValue)} readOnly />
                    </div>
                  </div>
                </div>
              </div>
              {/* Bags and Quantity */}

              {/* Validity Dates */}
             
              
              <div className="mt-4"></div>
              <Label className="font-semibold text-orange-500">Stock Validity</Label>
              <div className="grid grid-cols-2 gap-4">
                
                <div>
                  <Label className="font-semibold">Validity Start Date</Label>
                  <Input 
                    value={(() => {
                      // Use SR Generation Date if available
                      const startDate = srGenerationDate || selectedRowForSR?.srGenerationDate;
                      if (startDate) {
                        return formatToDDMMYYYY(new Date(startDate));
                      }
                      // Return empty string to show placeholder
                      return '';
                    })()}
                    readOnly 
                    placeholder="Auto-set on Approve"
                  />
                </div>
                <div>
                  <Label className="font-semibold">Validity End Date</Label>
                  <Input
                    value={(() => {
                      console.log('🔍 Calculating Validity End Date...');
                      console.log('Selected Row Insurance:', selectedRowForSR?.selectedInsurance);
                      console.log('Available Insurance Data:', inspectionInsuranceData);
                      
                      // Find insurance match
                      let insurance = null;
                      
                      // If no selected insurance but have insurance data, use the first one
                      if (inspectionInsuranceData && inspectionInsuranceData.length > 0) {
                        if (selectedRowForSR?.selectedInsurance) {
                          insurance = inspectionInsuranceData.find(
                            (ins: any) =>
                              ins.insuranceId === selectedRowForSR.selectedInsurance.insuranceId &&
                              ins.insuranceTakenBy === selectedRowForSR.selectedInsurance.insuranceTakenBy
                          );
                        }
                        
                        // Fallback to first insurance if no match found
                        if (!insurance) {
                          insurance = inspectionInsuranceData[0];
                          console.log('🔄 Using first available insurance:', insurance);
                        }
                      }
                      
                      if (insurance && insurance.firePolicyEndDate) {
                        console.log('✅ Found insurance:', insurance.insuranceTakenBy, insurance.firePolicyEndDate);
                        
                        // For all insurance types, use fire policy end date as-is (stock validity end date = fire policy end date)
                        const result = formatToDDMMYYYY(new Date(normalizeDate(insurance.firePolicyEndDate)));
                        console.log('📅 Stock validity end date (fire policy end date):', result);
                        return result;
                      }
                      
                      console.log('⚠️ No valid insurance or date found');
                      return '';
                    })()}
                    readOnly
                    placeholder="From Fire Policy End Date"
                  />
                </div>
              </div>
              {/* Insurance Expiry Check */}
              {isInsuranceExpired(selectedRowForSR) && (
                <div className="bg-red-100 text-red-700 p-2 rounded font-semibold">
                  Insurance is expired. Please update the end date before approval.
                </div>
              )}
                 
            
              {/* Hologram No and QR space */}
              <div className="flex items-center gap-4">
                <div className="flex-1 max-w-xs">
                  <Label className="font-semibold">Hologram No</Label>
                  <Input 
                    placeholder="Enter Hologram No"
                    value={hologramNumber}
                    onChange={e => setHologramNumber(e.target.value)}
                    readOnly={isFormApproved}
                    className="w-32"
                  />
                </div>
                <div className="w-64 h-32 border-2 border-dashed border-gray-400 flex items-center justify-center ml-4">
                  <span className="text-xs text-gray-400">QR Sticker Space</span>
                </div>
              </div>
              {/* Insurance Details */}
              <div>
                <Label className="font-semibold text-orange-500">Insurance Details </Label>
                {(() => {
                  // Robust match: case-insensitive and fallback by takenBy for Client/Agrogreen
                  if (!selectedRowForSR?.selectedInsurance) {
                    return <div className="text-gray-500 text-sm">No insurance data found in inspection</div>;
                  }
                  const sel = selectedRowForSR.selectedInsurance;
                  const entries = inspectionInsuranceData || [];
                  if (!entries.length) {
                    return <div className="text-gray-500 text-sm">No insurance data found in inspection</div>;
                  }
                  let match = entries.find((ins: any) =>
                    (ins.insuranceId === sel.insuranceId || (ins.insuranceId||'').trim() === (sel.insuranceId||'').trim()) &&
                    (ins.insuranceTakenBy||'').toLowerCase() === (sel.insuranceTakenBy||'').toLowerCase()
                  );
                  if (!match) {
                    match = entries.find((ins: any) => (ins.insuranceTakenBy||'').toLowerCase() === (sel.insuranceTakenBy||'').toLowerCase()) || null;
                  }
                  if (!match) {
                    return <div className="text-gray-500 text-sm">No insurance data found in inspection</div>;
                  }
                  // Normalize fields for safe display
                  const norm = {
                    insuranceTakenBy: match.insuranceTakenBy,
                    insuranceCommodity: match.insuranceCommodity || match.commodityName || selectedRowForSR?.commodity || '',
                    clientName: match.clientName || selectedRowForSR?.client || '',
                    clientAddress: match.clientAddress || selectedRowForSR?.clientAddress || '',
                    bankFundedBy: match.bankFundedBy || match.selectedBankName || selectedRowForSR?.bankFundedBy || selectedRowForSR?.bankName || '',
                    firePolicyCompanyName: match.firePolicyCompanyName || '',
                    firePolicyNumber: match.firePolicyNumber || '',
                    firePolicyAmount: match.firePolicyAmount || match.firePolicyRemainingAmount || '',
                    firePolicyEndDate: match.firePolicyEndDate || '',
                    burglaryPolicyCompanyName: match.burglaryPolicyCompanyName || '',
                    burglaryPolicyNumber: match.burglaryPolicyNumber || '',
                    burglaryPolicyAmount: match.burglaryPolicyAmount || match.burglaryPolicyRemainingAmount || '',
                    burglaryPolicyEndDate: match.burglaryPolicyEndDate || ''
                  };
                  return (
                    <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
                      {/* <h6 className="font-medium text-blue-600 mb-2">Insurance Entry</h6> */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Insurance Taken By</Label>
                          <Input value={norm.insuranceTakenBy || ''} readOnly className="text-sm" />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Commodity</Label>
                          <Input value={norm.insuranceCommodity || ''} readOnly className="text-sm" />
                        </div>
                        {(norm.insuranceTakenBy||'').toLowerCase() === 'client' && (
                          <>
                            <div>
                              <Label className="text-sm font-medium">Client Name</Label>
                              <Input value={norm.clientName || ''} readOnly className="text-sm" />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Client Address</Label>
                              <Input value={norm.clientAddress || ''} readOnly className="text-sm" />
                            </div>
                          </>
                        )}
                        {((norm.insuranceTakenBy||'').toLowerCase() === 'bank' || (norm.insuranceTakenBy||'').toLowerCase() === 'bank-funded') && (
                          <div>
                            <Label className="text-sm font-medium">Bank Name</Label>
                            <Input value={norm.bankFundedBy} readOnly className="text-sm" />
                          </div>
                        )}
                        {norm.insuranceTakenBy && (norm.insuranceTakenBy||'').toLowerCase() !== 'bank' && (norm.insuranceTakenBy||'').toLowerCase() !== 'bank-funded' && (
                          <>
                            <div>
                              <Label className="text-sm font-medium">Fire Policy Company</Label>
                              <Input value={norm.firePolicyCompanyName || ''} readOnly className="text-sm" />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Fire Policy Number</Label>
                              <Input value={norm.firePolicyNumber || ''} readOnly className="text-sm" />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Fire Policy Amount</Label>
                              <Input value={norm.firePolicyAmount ? `₹${norm.firePolicyAmount}` : ''} readOnly className="text-sm" />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Fire Policy End Date</Label>
                              <Input value={normalizeDate(norm.firePolicyEndDate)} readOnly className="text-sm" />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Burglary Policy Company</Label>
                              <Input value={norm.burglaryPolicyCompanyName || ''} readOnly className="text-sm" />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Burglary Policy Number</Label>
                              <Input value={norm.burglaryPolicyNumber || ''} readOnly className="text-sm" />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Burglary Policy Amount</Label>
                              <Input value={norm.burglaryPolicyAmount ? `₹${norm.burglaryPolicyAmount}` : ''} readOnly className="text-sm" />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Burglary Policy End Date</Label>
                              <Input value={normalizeDate(norm.burglaryPolicyEndDate)} readOnly className="text-sm" />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {/* Removed signature block - no longer shown in SR/WR receipt */}
              </div>
              {/* Margin and Dotted Line */}
              <div className="my-6">
                <hr className="border-t-2 border-dotted border-gray-400" />
              </div>
              {/* Agrogreen Logo and Test Certificate (Modal View) */}
              <div className="relative flex flex-col items-center justify-center my-6">
              <div className="flex flex-col items-center justify-center mb-6 mt-2">
            <Image src="/Group 86.png" alt="Agrogreen Logo" width={100} height={85} style={{ marginBottom: 6, borderRadius: '30%', objectFit: 'cover' }} />
            <div className="text-lg font-extrabold text-orange-600 mt-2 mb-1 text-center" style={{ letterSpacing: '0.02em' }}>
              AGROGREEN WAREHOUSING PRIVATE LTD.
            </div>
            <div className="text-sm font-semibold text-green-600 mb-2 text-center">
              603, 6th Floor, Princess Business Skyline, Indore, Madhya Pradesh - 452010
            </div>
            <div className="text-md font-bold text-orange-600 underline text-center mb-2" style={{ letterSpacing: '0.01em' }}>
              TEST CERTIFICATE
            </div>
          </div>
                {/* FROM SECTION */}
                <div className="w-full max-w-2xl mt-6 mb-4 border border-gray-200 rounded-lg p-4 bg-gray-50" style={{ maxWidth: '900px' }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="font-semibold mb-1">Client Name</Label>
                      <Input readOnly value={selectedRowForSR?.client || ''} className="w-full bg-white border-green-300 text-green-800" />
                    </div>
                    <div>
                      <Label className="font-semibold mb-1">Commodity Name</Label>
                      <Input readOnly value={selectedRowForSR?.commodity || ''} className="w-full bg-white border-green-300 text-green-800" />
                    </div>
                    <div>
                      <Label className="font-semibold mb-1">Commodity Variety Name</Label>
                      <Input readOnly value={selectedRowForSR?.varietyName || ''} className="w-full bg-white border-green-300 text-green-800" />
                    </div>
                    <div>
                      <Label className="font-semibold mb-1">Client Address</Label>
                      <Input readOnly value={selectedRowForSR?.clientAddress || ''} className="w-full bg-white border-green-300 text-green-800" />
                    </div>
                    <div>
                      <Label className="font-semibold mb-1">Warehouse Name</Label>
                      <Input readOnly value={selectedRowForSR?.warehouseName || ''} className="w-full bg-white border-green-300 text-green-800" />
                    </div>
                    <div>
                      <Label className="font-semibold mb-1">Warehouse Address</Label>
                      <Input readOnly value={selectedRowForSR?.warehouseAddress || ''} className="w-full bg-white border-green-300 text-green-800" />
                    </div>
                    <div>
                      <Label className="font-semibold mb-1">Total Number of Bags</Label>
                      <Input readOnly value={selectedRowForSR?.totalBags || ''} className="w-full bg-white border-green-300 text-green-800" />
                    </div>
                    <div>
                      <Label className="font-semibold mb-1">CAD No</Label>
                      <Input readOnly value={selectedRowForSR?.cadNumber || ''} className="w-full bg-white border-green-300 text-green-800" />
                    </div>
                    <div>
                      <Label className="font-semibold mb-1">Date of Sampling</Label>
                      <Input readOnly value={selectedRowForSR?.dateOfSampling || ''} className="w-full bg-white border-green-300 text-green-800" />
                    </div>
                    <div>
                      <Label className="font-semibold mb-1">Date of Testing</Label>
                      <Input readOnly value={selectedRowForSR?.dateOfTesting || ''} className="w-full bg-white border-green-300 text-green-800" />
                    </div>
                  </div>
                </div>
                {/* Remarks input - left aligned */}
                <div className="w-full max-w-2xl mb-4 flex flex-col items-start" style={{ maxWidth: '900px' }}>
                  <Label className="font-semibold mb-1">Remarks</Label>
                  <Input
                    type="text"
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="Enter remarks here"
                    className="w-full bg-white border-green-300 text-green-800"
                    readOnly={selectedRowForSR?.status === 'approved' || selectedRowForSR?.status === 'Approved'}
                    disabled={selectedRowForSR?.status === 'approved' || selectedRowForSR?.status === 'Approved'}
                  />
                </div>
                {/* Quality Parameters Table - left aligned */}
                <div className="w-full max-w-2xl mb-6" style={{ maxWidth: '900px' }}>
                  <Label className="block font-semibold mb-2 text-green-700 text-left">Quality Parameters (from Commodity & Variety)</Label>
                  <div className="overflow-x-auto max-w-lg">
                    <table className="min-w-full border border-green-300 rounded-lg">
                      <thead className="bg-orange-100 text-orange-600 font-bold">
                        <tr>
                          <th className="px-4 py-2 border-green-300 border">Parameter</th>
                          <th className="px-4 py-2 border-green-300 border">Min %</th>
                          <th className="px-4 py-2 border-green-300 border">Max %</th>
                          <th className="px-4 py-2 border-green-300 border">Actual (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Find particulars for the selectedRowForSR
                          const commodity = commodities.find((c: any) => c.commodityName === selectedRowForSR?.commodity);
                          const variety = commodity?.varieties?.find((v: any) => v.varietyName === selectedRowForSR?.varietyName);
                          const particulars = variety?.particulars || [];
                          return particulars.length > 0 ? (
                            particulars.map((p: any, idx: number) => (
                              <tr key={idx} className="text-green-800">
                                <td className="px-4 py-2 border-green-300 border">{p.name}</td>
                                <td className="px-4 py-2 border-green-300 border">{p.minPercentage}</td>
                                <td className="px-4 py-2 border-green-300 border">{p.maxPercentage}</td>
                                <td className="px-4 py-2 border-green-300 border">
                                  <Input
                                    type="number"
                                    value={typeof selectedRowForSR?.labResults?.[idx] === 'object' && selectedRowForSR.labResults[idx]?.value ? selectedRowForSR.labResults[idx].value : (selectedRowForSR?.labResults?.[idx] || '')}
                                    readOnly
                                    className="w-24 bg-white border border-green-300 text-center"
                              />
                            </td>
                          </tr>
                            ))
                          ) : (
                          <tr><td colSpan={4} className="text-center text-gray-400 py-2">No quality parameters found for this variety.</td></tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* Footer Section - simplified without signature */}
                <div className="w-full max-w-2xl flex justify-start items-end mt-6 mb-2" style={{ maxWidth: '900px' }}>
                  <div className="text-xs font-semibold text-left">THE QUALITY OF GOODS IS AVERAGE</div>
                </div>
              </div>
              {/* Approve/Reject/Resubmit Buttons and Print Button */}
              {(() => {
                const status = selectedRowForSR?.status;
                if (isFormApproved || status === 'approved') {
                  return (
                    <div className="flex justify-end mt-3 sm:mt-4">
                      {(canPrintStorageReceipt() || canPrintWarehouseReceipt()) ? (
                        <Button
                          onClick={handlePrint}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-xs sm:px-4 sm:text-sm"
                          disabled={isPrinting}
                        >
                          {isPrinting ? 'Generating PDF...' : 'Print Receipt'}
                        </Button>
                      ) : (
                        <div className="text-gray-500 text-sm">
                          Print access restricted for your role
                        </div>
                      )}
                    </div>
                  );
                } else if (status === 'rejected') {
                  return (
                    <div className="flex justify-end mt-3 sm:mt-4">
                      <Button disabled className="bg-red-600 text-white px-3 py-2 text-xs sm:px-4 sm:text-sm opacity-70 cursor-not-allowed">
                        Rejected
                      </Button>
                    </div>
                  );
                } else if (status === 'resubmited') {
                  return (
                    <div className="flex justify-end mt-3 sm:mt-4">
                      <Button className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 text-xs sm:px-4 sm:text-sm">
                        Your {selectedRowForSR?.receiptType === 'WR' ? 'WR' : 'SR'} needs to be updated
                      </Button>
                    </div>
                  );
                } else {
                  return (
                    <div className="flex flex-wrap gap-2 sm:gap-4 mt-3 sm:mt-4 justify-end">
                      {canGenerateStorageReceipt() || canGenerateWarehouseReceipt() ? (
                        <>
                          <Button
                            onClick={() => handleApproveSR(selectedRowForSR)}
                            disabled={isInsuranceExpired(selectedRowForSR)}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 text-xs sm:px-4 sm:text-sm"
                          >
                            {selectedRowForSR.receiptType === 'WR' ? 'Proceed to WR' : 'Proceed to SR'}
                          </Button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-gray-500">
                          <span className="text-sm">{selectedRowForSR?.receiptType === 'WR' ? 'WR' : 'SR'} Actions (Read Only)</span>
                          <span className="text-xs">
                            {userRole === 'maker' ? 'Makers can only view receipts' : 'No permission for receipt actions'}
                          </span>
                          {(canPrintStorageReceipt() || canPrintWarehouseReceipt()) && (
                            <Button
                              onClick={handlePrint}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-xs sm:px-4 sm:text-sm mt-2"
                              disabled={isPrinting}
                            >
                              {isPrinting ? 'Generating PDF...' : 'Print Receipt'}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }
              })()}
              {/* Hidden printRef for PDF export - New Layout */}
              {(isFormApproved || selectedRowForSR?.status === 'approved') && (
                <div style={showPrintDebug ? { position: 'static', margin: '32px 0', zIndex: 1000, background: '#fff' } : { position: 'absolute', left: '-9999px', top: 0, zIndex: -1 }}>
                  <div ref={printableReceiptRef}>
                    <PrintableWarehouseReceipt
                      selectedRowForSR={selectedRowForSR}
                      hologramNumber={selectedRowForSR?.hologramNumber || hologramNumber}
                      srGenerationDate={selectedRowForSR?.srGenerationDate ? normalizeDate(selectedRowForSR.srGenerationDate) : srGenerationDate}
                      getSelectedVarietyParticulars={getSelectedVarietyParticulars}
                      inspectionInsuranceData={inspectionInsuranceData}
                    />
                  </div>
                  {/* Keep original components for backward compatibility */}
                  <div ref={printRef} style={{ display: 'none' }}>
                    <StorageReceipt
                      data={{
                        srNo: generateSRNo(selectedRowForSR),
                        srGenerationDate: (selectedRowForSR?.srGenerationDate ? normalizeDate(selectedRowForSR.srGenerationDate) : (srGenerationDate || '-')),
                        dateOfIssue: selectedRowForSR?.dateOfInward || '',
                        baseReceiptNo: selectedRowForSR?.baseReceiptNo || selectedRowForSR?.bankReceipt || '-',
                        cadNo: selectedRowForSR?.cadNo || selectedRowForSR?.cadNumber || '',
                        dateOfDeposit: selectedRowForSR?.dateOfInward || '',
                        branch: selectedRowForSR?.branch || '-',
                        warehouseName: selectedRowForSR?.warehouseName || '',
                        warehouseAddress: selectedRowForSR?.warehouseAddress || '',
                        client: selectedRowForSR?.client || '',
                        clientAddress: (() => {
                          // Get clientAddress from matched insurance entry
                          const sel = selectedRowForSR?.selectedInsurance;
                          let matched: any = null;
                          try {
                            if (sel && inspectionInsuranceData && inspectionInsuranceData.length) {
                              matched = inspectionInsuranceData.find((i: any) => i.insuranceId === sel.insuranceId && i.insuranceTakenBy === sel.insuranceTakenBy) || null;
                            }
                          } catch (e) {
                            matched = null;
                          }
                          matched = matched || inspectionInsuranceData[0] || null;
                          return matched?.clientAddress || selectedRowForSR?.clientAddress || '';
                        })(),
                        commodity: selectedRowForSR?.commodity || '',
                        totalBags: selectedRowForSR?.totalBags || '',
                        netWeight: selectedRowForSR?.totalQuantity || '',
                        grade: selectedRowForSR?.grade || '-',
                        remarks: selectedRowForSR?.remarks || '-',
                        marketRate: selectedRowForSR?.marketRate || '',
                        valueOfCommodity: selectedRowForSR?.totalValue || '',
                        hologramNumber: selectedRowForSR?.hologramNumber || hologramNumber || '',
                        insuranceDetails: (() => {
                          const candidates = (inspectionInsuranceData || []).filter((ins: any) => {
                            const t = (ins.insuranceTakenBy || '').toLowerCase();
                            return ['client','agrogreen','bank','bank-funded'].includes(t);
                          });
                          const list = candidates.length ? candidates : (inspectionInsuranceData[0] ? [inspectionInsuranceData[0]] : []);
                          return list.map((matched: any) => ({
                            policyNo: matched?.firePolicyNumber || '-',
                            company: matched?.firePolicyCompanyName || '-',
                            validFrom: matched?.firePolicyStartDate ? normalizeDate(matched.firePolicyStartDate) : '-',
                            validTo: matched?.firePolicyEndDate ? normalizeDate(matched.firePolicyEndDate) : '-',
                            sumInsured: matched?.firePolicyAmount || '-',
                            insuranceTakenBy: matched?.insuranceTakenBy || ''
                          }));
                        })(),
                        bankName: selectedRowForSR?.bankName || selectedRowForSR?.bankFundedBy || '',
                        bankFundedBy: selectedRowForSR?.bankFundedBy || '',
                        date: selectedRowForSR?.dateOfInward || '',
                        place: selectedRowForSR?.branch || '',
                        stockInwardDate: selectedRowForSR?.dateOfInward || '-',
                        receiptType: selectedRowForSR?.receiptType || 'SR',
                        varietyName: selectedRowForSR?.varietyName || '',
                        dateOfSampling: selectedRowForSR?.dateOfSampling || '',
                        dateOfTesting: selectedRowForSR?.dateOfTesting || '',
                      }}
                    />
                  </div>
                  <div ref={testCertRef} style={{ display: 'none' }}>
                    <TestCertificate
                      client={selectedRowForSR?.client || ''}
                      clientAddress={selectedRowForSR?.clientAddress || ''}
                      commodity={selectedRowForSR?.commodity || ''}
                      varietyName={selectedRowForSR?.varietyName || ''}
                      warehouseName={selectedRowForSR?.warehouseName || ''}
                      warehouseAddress={selectedRowForSR?.warehouseAddress || ''}
                      totalBags={selectedRowForSR?.totalBags || ''}
                      dateOfSampling={selectedRowForSR?.dateOfSampling || ''}
                      dateOfTesting={selectedRowForSR?.dateOfTesting || ''}
                      qualityParameters={(() => {
                        const commodity = commodities.find((c: any) => c.commodityName === selectedRowForSR?.commodity);
                        const variety = commodity?.varieties?.find((v: any) => v.varietyName === selectedRowForSR?.varietyName);
                        const particulars = variety?.particulars || [];
                        return particulars.map((p: any, idx: number) => ({
                          name: p.name,
                          minPercentage: p.minPercentage,
                          maxPercentage: p.maxPercentage,
                          actual: typeof selectedRowForSR?.labResults?.[idx] === 'object' && selectedRowForSR.labResults[idx]?.value ? selectedRowForSR.labResults[idx].value : (selectedRowForSR?.labResults?.[idx] || ''),
                        }));
                      })()}
                    />
                  </div>
                </div>
              )}



              {/* Insurance Seal/Stamp and Company Info */}
              <div className="flex justify-between items-end mt-8">
                <div>
                  {/* <div className="font-bold text-lg">TEST certificate</div> */}
                </div>
                <div className="flex flex-col items-end">
                  
                  {/* <div className="text-sm font-semibold">{process.env.NEXT_PUBLIC_COMPANY_NAME || 'Company Name'}</div> */}
                  {/* <div className="text-xs text-gray-500">{process.env.NEXT_PUBLIC_COMPANY_LOCATION || 'Location'}</div> */}
                  </div>
                </div>
              {/* Disclaimer at the very end */}
              <div className="w-full max-w-2xl mx-auto text-xs text-gray-600 mt-8 mb-2 text-justify border-t pt-4">
                This Report is given to you on the base of best tesing ability. Any discrepancy found in the report should be brought to our notice within 48 hours of Receipt of the report. The above results are valid for the date and time of sampling and testing only. Total liability or any claim arising out of this report is limited to the invoiced amount only.
              </div>
              {/* Stock Validity section */}
              {/* <div className="mt-4">
                <Label className="font-semibold text-orange-500">Stock Validity</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="font-semibold">Validity Start Date</Label>
                    <Input value={selectedRowForSR.dateOfInward || ''} readOnly />
                  </div>
                  <div>
                    <Label className="font-semibold">Validity End Date</Label>
                    <Input value={(() => {
                      // If insurance taken by bank, 9 months after start date
                      if (selectedRowForSR.selectedInsurance?.insuranceTakenBy === 'bank' || selectedRowForSR.selectedInsurance?.insuranceTakenBy === 'bank-funded') {
                        const start = selectedRowForSR.dateOfInward ? new Date(selectedRowForSR.dateOfInward) : null;
                        if (start && !isNaN(start.getTime())) {
                          start.setMonth(start.getMonth() + 9);
                          return start.toISOString().slice(0, 10);
                        }
                      }
                      // Otherwise, use Fire Policy End Date
                      const fireEnd = selectedRowForSR.firePolicyEnd || (inspectionInsuranceData.find(i => i.insuranceTakenBy !== 'bank')?.firePolicyEndDate);
                      return fireEnd || '';
                    })()} readOnly />
                  </div>
                </div>
              </div> */}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {showCIRModal && (
        <Dialog open={showCIRModal} onOpenChange={setShowCIRModal}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <div ref={cirModalContentRef}>
              {/* Logo and company info header (copied from SR/WR receipt) */}
              <div className="flex flex-col items-center justify-center mb-8 mt-2">
              <Image src="/Group 86.png" alt="Agrogreen Logo" width={120} height={100} style={{ marginBottom: 8, borderRadius: '30%', objectFit: 'cover' }} />
              <div className="text-lg font-extrabold text-orange-600 mt-2 mb-1 text-center" style={{ letterSpacing: '0.02em' }}>
                AGROGREEN WAREHOUSING PRIVATE LTD.
              </div>
              <div className="text-base font-semibold text-green-600 mb-2 text-center">
                603, 6th Floor, Princess Business Skyline, Indore, Madhya Pradesh - 452010
              </div>
               <div className="text-md font-bold text-orange-600 underline text-center mb-2" style={{ letterSpacing: '0.01em' }}>
              Commodity Inward Report
            </div>
            </div>
            <DialogHeader>
              
            </DialogHeader>
            <form className="space-y-4">
              {/* State, Branch, Location, Warehouse Name, Warehouse Code, Business Type, Warehouse Address, Client Name, Client Code, Client Address */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="block font-semibold mb-1">State</Label>
                  <Input value={cirModalData?.state || ''} readOnly disabled />
                </div>
                <div>
                  <Label className="block font-semibold mb-1">Branch</Label>
                  <Input value={cirModalData?.branch || ''} readOnly disabled />
                </div>
                <div>
                  <Label className="block font-semibold mb-1">Location</Label>
                  <Input value={cirModalData?.location || ''} readOnly disabled />
                </div>
                <div>
                  <Label className="block font-semibold mb-1">Warehouse Name</Label>
                  <Input value={cirModalData?.warehouseName || ''} readOnly disabled />
                </div>
                <div>
                  <Label className="block font-semibold mb-1">Warehouse Code</Label>
                  <Input value={cirModalData?.warehouseCode || ''} readOnly disabled />
                </div>
                <div>
                  <Label className="block font-semibold mb-1">Business Type</Label>
                  <Input value={cirModalData?.businessType || ''} readOnly disabled />
                </div>
                <div>
                  <Label className="block font-semibold mb-1">Warehouse Address</Label>
                  <Input value={cirModalData?.warehouseAddress || ''} readOnly disabled />
                </div>
                <div>
                  <Label className="block font-semibold mb-1">Client Name</Label>
                  <Input value={cirModalData?.client || ''} readOnly disabled />
                </div>
                <div>
                  <Label className="block font-semibold mb-1">Client Code</Label>
                  <Input value={cirModalData?.clientCode || ''} readOnly disabled />
                </div>
                <div>
                  <Label className="block font-semibold mb-1">Client Address</Label>
                  <Input value={cirModalData?.clientAddress || ''} readOnly disabled />
                </div>
              </div>
              {/* Inward Details */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-4 text-orange-700">Inward Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label className="block font-semibold mb-1">Date of Inward</Label>
                    <Input value={cirModalData?.dateOfInward || ''} readOnly disabled />
                  </div>
                  <div>
                    <Label className="block font-semibold mb-1">CAD Number</Label>
                    <Input value={cirModalData?.cadNumber || ''} readOnly disabled />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="block font-semibold mb-1">Base Receipt</Label>
                    <Input value={cirModalData?.bankReceipt || ''} readOnly disabled />
                  </div>
                </div>
              </div>
              {/* Commodity Information */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-6 text-orange-700">Commodity Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <Label className="block font-semibold mb-2">Commodity</Label>
                    <Input value={cirModalData?.commodity || ''} readOnly disabled />
                  </div>
                  <div>
                    <Label className="block font-semibold mb-2">Variety Name</Label>
                    <Input value={cirModalData?.varietyName || ''} readOnly disabled />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <Label className="block font-semibold mb-2">Market Rate (Rs/MT)</Label>
                    <Input value={cirModalData?.marketRate || ''} readOnly disabled />
                  </div>
                  <div>
                    <Label className="block font-semibold mb-2">Total Bags</Label>
                    <Input value={cirModalData?.totalBags || ''} readOnly disabled />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="block font-semibold mb-2">Total Quantity (MT)</Label>
                    <Input value={cirModalData?.totalQuantity || ''} readOnly disabled />
                  </div>
                  <div>
                    <Label className="block font-semibold mb-2">Total Value (Rs/MT)</Label>
                    <Input value={cirModalData?.totalValue || ''} readOnly disabled />
                  </div>
                </div>
              </div>
              {/* Bank Information */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-6 text-orange-700">Bank Information (Auto-filled from Inspection)</h3>
                <div className="mb-6">
                  <Label className="block font-semibold mb-2">Bank Name</Label>
                  <Input value={cirModalData?.bankName || ''} readOnly disabled />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <Label className="block font-semibold mb-2">Bank Branch</Label>
                    <Input value={cirModalData?.bankBranch || ''} readOnly disabled />
                  </div>
                  <div>
                    <Label className="block font-semibold mb-2">Bank State</Label>
                    <Input value={cirModalData?.bankState || ''} readOnly disabled />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="block font-semibold mb-2">IFSC Code</Label>
                    <Input value={cirModalData?.ifscCode || ''} readOnly disabled />
                  </div>
                </div>
              </div>
              {/* Reservation/Billing Information */}
              {cirModalData?.businessType !== 'cm' && (cirModalData?.reservationRate || cirModalData?.billingCycle) && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-4 text-orange-700">Reservation & Billing Information</h3>
                  
                  {/* Show reservation fields if reservationStatus is 'reservation' OR if reservation data exists and billing doesn't */}
                  {(cirModalData?.reservationStatus === 'reservation' || (cirModalData?.reservationRate && (!cirModalData?.billingCycle || cirModalData?.billingCycle === '-'))) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="block font-semibold mb-1">Reservation Rate (Rs/MT)</Label>
                        <Input value={cirModalData?.reservationRate || ''} readOnly disabled />
                      </div>
                      <div>
                        <Label className="block font-semibold mb-1">Reservation Quantity (MT)</Label>
                        <Input value={cirModalData?.reservationQty || ''} readOnly disabled />
                      </div>
                      <div>
                        <Label className="block font-semibold mb-1">Reservation Start Date</Label>
                        <Input value={cirModalData?.reservationStart || ''} readOnly disabled />
                      </div>
                      <div>
                        <Label className="block font-semibold mb-1">Reservation End Date</Label>
                        <Input value={cirModalData?.reservationEnd || ''} readOnly disabled />
                      </div>
                    </div>
                  )}

                  {/* Expired Reservation Alert in Second CIR Modal */}
                  {(cirModalData?.reservationStatus === 'reservation' || cirModalData?.reservationRate) && isReservationExpired(cirModalData?.reservationEnd || '') && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">Reservation Expired</h3>
                          <p className="mt-1 text-sm text-red-700">
                            The reservation end date ({cirModalData?.reservationEnd}) has expired. Please update the reservation details in the <strong>Reservation & Billing</strong> section.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Show billing fields if reservationStatus is 'post-reservation' OR if billing data exists and it's meaningful */}
                  {(cirModalData?.reservationStatus === 'post-reservation' || (cirModalData?.billingCycle && cirModalData?.billingCycle !== '-' && !cirModalData?.reservationRate)) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="block font-semibold mb-1">Billing Cycle</Label>
                        <Input value={cirModalData?.billingCycle || ''} readOnly disabled />
                      </div>
                      <div>
                        <Label className="block font-semibold mb-1">Billing Type</Label>
                        <Input value={cirModalData?.billingType || ''} readOnly disabled />
                      </div>
                      <div>
                        <Label className="block font-semibold mb-1">Billing Rate (Rs/MT)</Label>
                        <Input value={cirModalData?.billingRate || ''} readOnly disabled />
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Add more fields as needed, following the Add/Edit Inward modal structure */}
              {/* Insurance Section - From Master Collection */}
              {cirModalData?.insuranceEntries && Array.isArray(cirModalData.insuranceEntries) && cirModalData.insuranceEntries.length > 0 && (
                <div className="border-t pt-6 mb-6">
                  <h3 className="text-xl font-semibold mb-4 text-blue-700">Insurance Details</h3>
                  {cirModalData.insuranceEntries.map((insurance: any, index: number) => (
                    <div key={index} className="border border-blue-200 rounded-lg p-6 bg-blue-50 mb-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-medium text-blue-700">Insurance ID: {insurance.insuranceId}</h4>
                        <div className="text-sm text-blue-600 font-medium">
                          {insurance.insuranceTakenBy} - {insurance.commodityName}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <Label className="block font-semibold mb-1">Insurance Taken By</Label>
                          <Input value={insurance.insuranceTakenBy || ''} readOnly />
                        </div>
                        <div>
                          <Label className="block font-semibold mb-1">Commodity</Label>
                          <Input value={insurance.commodityName || ''} readOnly />
                        </div>
                        <div>
                          <Label className="block font-semibold mb-1">Client Name</Label>
                          <Input value={insurance.clientName || ''} readOnly />
                        </div>
                        <div>
                          <Label className="block font-semibold mb-1">Fire Policy Number</Label>
                          <Input value={insurance.firePolicyNumber || ''} readOnly />
                        </div>
                        <div>
                          <Label className="block font-semibold mb-1">Fire Policy Amount (Original)</Label>
                          <Input value={formatAmount(insurance.firePolicyAmount)} readOnly />
                        </div>
                        <div>
                          <Label className="block font-semibold mb-1">Fire Policy Remaining Amount</Label>
                          <Input value={formatAmount(insurance.firePolicyRemainingAmount)} readOnly className="bg-green-50" />
                        </div>
                        <div>
                          <Label className="block font-semibold mb-1">Fire Policy Start Date</Label>
                          <Input value={normalizeDate(insurance.firePolicyStartDate)} readOnly />
                        </div>
                        <div>
                          <Label className="block font-semibold mb-1">Fire Policy End Date</Label>
                          <Input value={normalizeDate(insurance.firePolicyEndDate)} readOnly />
                        </div>
                        <div>
                          <Label className="block font-semibold mb-1">Burglary Policy Number</Label>
                          <Input value={insurance.burglaryPolicyNumber || ''} readOnly />
                        </div>
                        <div>
                          <Label className="block font-semibold mb-1">Burglary Policy Amount (Original)</Label>
                          <Input value={formatAmount(insurance.burglaryPolicyAmount)} readOnly />
                        </div>
                        <div>
                          <Label className="block font-semibold mb-1">Burglary Policy Remaining Amount</Label>
                          <Input value={formatAmount(insurance.burglaryPolicyRemainingAmount)} readOnly className="bg-green-50" />
                        </div>
                        <div>
                          <Label className="block font-semibold mb-1">Burglary Policy Start Date</Label>
                          <Input value={normalizeDate(insurance.burglaryPolicyStartDate)} readOnly />
                        </div>
                        <div>
                          <Label className="block font-semibold mb-1">Burglary Policy End Date</Label>
                          <Input value={normalizeDate(insurance.burglaryPolicyEndDate)} readOnly />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Saved Inward Entries Section */}
              {Array.isArray(cirModalData?.inwardEntries) && cirModalData.inwardEntries.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-4 text-green-700">Saved Inward Entries</h3>
                  <div className="space-y-6">
                    {cirModalData.inwardEntries.map((entry: any, index: number) => (
                      <div key={entry.id || index} className="border border-green-300 rounded-lg p-6 bg-green-50">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-semibold text-green-800">Entry  {entry.entryNumber}</h4>
                          <div className="text-sm text-green-600 font-medium">
                            Vehicle: {entry.vehicleNumber} | Gatepass: {entry.getpassNumber}
                          </div>
                        </div>
                        {/* Inward ID */}
                        <div className="mb-4">
                          <h5 className="text-md font-semibold mb-2 text-green-700">Inward Information</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label className="block font-medium mb-1 text-green-600">Inward ID</Label>
                              <Input value={entry.inwardId || 'Pending'} readOnly className="bg-white border-green-300 font-mono" />
                            </div>
                          </div>
                        </div>
                        {/* Vehicle Information */}
                        <div className="mb-4">
                          <h5 className="text-md font-semibold mb-2 text-green-700">Vehicle Information</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label className="block font-medium mb-1 text-green-600">Vehicle Number</Label>
                              <Input value={entry.vehicleNumber} readOnly className="bg-white border-green-300" />
                            </div>
                            <div>
                              <Label className="block font-medium mb-1 text-green-600">Gatepass Number</Label>
                              <Input value={entry.getpassNumber} readOnly className="bg-white border-green-300" />
                            </div>
                          </div>
                        </div>
                        {/* Weight Bridge Information */}
                        <div className="mb-4">
                          <h5 className="text-md font-semibold mb-2 text-green-700">Weight Bridge Information</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label className="block font-medium mb-1 text-green-600">Weight Bridge</Label>
                              <Input value={entry.weightBridge} readOnly className="bg-white border-green-300" />
                            </div>
                            <div>
                              <Label className="block font-medium mb-1 text-green-600">Weight Bridge Slip Number</Label>
                              <Input value={entry.weightBridgeSlipNumber} readOnly className="bg-white border-green-300" />
                            </div>
                          </div>
                        </div>
                        {/* Weight Information */}
                        <div className="mb-4">
                          <h5 className="text-md font-semibold mb-2 text-green-700">Weight Information</h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label className="block font-medium mb-1 text-green-600">Gross Weight (MT)</Label>
                              <Input value={entry.grossWeight} readOnly className="bg-white border-green-300" />
                            </div>
                            <div>
                              <Label className="block font-medium mb-1 text-green-600">Tare Weight (MT)</Label>
                              <Input value={entry.tareWeight} readOnly className="bg-white border-green-300" />
                            </div>
                            <div>
                              <Label className="block font-medium mb-1 text-green-600">Net Weight (MT)</Label>
                              <Input value={entry.netWeight} readOnly className="bg-white border-green-300" />
                            </div>
                          </div>
                        </div>
                        {/* Stack Information */}
                        <div>
                          <h5 className="text-md font-semibold mb-2 text-green-700">Stack Information</h5>
                          <div className="space-y-3">
                            {entry.stacks && entry.stacks.map((stack: any, stackIndex: number) => (
                              <div key={stackIndex} className="border border-green-200 rounded-lg p-3 bg-white">
                                <div className="flex items-center justify-between mb-2">
                                  <h6 className="font-medium text-green-700">Stack {stackIndex + 1}</h6>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <Label className="block font-medium mb-1 text-green-600">Stack Number</Label>
                                    <Input value={stack.stackNumber} readOnly className="bg-gray-50 border-green-300" />
                                  </div>
                                  <div>
                                    <Label className="block font-medium mb-1 text-green-600">Number of Bags</Label>
                                    <Input value={stack.numberOfBags} readOnly className="bg-gray-50 border-green-300" />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Lab Parameter Section */}
              {cirModalData?.labResults && (
                <div className="border-t pt-6 mb-6">
                  <h3 className="text-lg font-semibold mb-6 text-orange-700">Lab Parameter</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <Label className="block  mb-2">Date of Sampling <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        value={cirModalData.dateOfSampling || ''}
                        readOnly
                        className="w-full rounded-lg border-green-300 text-green-800 text-sm px-4 py-2"
                      />
                    </div>
                    <div>
                      <Label className="block  mb-2">Date of Testing <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        value={cirModalData.dateOfTesting || ''}
                        readOnly
                        className="w-full rounded-lg border-green-300 text-green-800 text-sm px-4 py-2"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="block font-semibold mb-2">Quality Parameters (from Commodity & Variety)</Label>
                    <div className="overflow-x-auto max-w-lg">
                      <table className="min-w-full border border-green-300 rounded-lg">
                        <thead className="bg-orange-100 text-orange-600 font-bold">
                          <tr>
                            <th className="px-4 py-2 border-green-300 border">Parameter</th>
                            <th className="px-4 py-2 border-green-300 border">Min %</th>
                            <th className="px-4 py-2 border-green-300 border">Max %</th>
                            <th className="px-4 py-2 border-green-300 border">Actual (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const commodity = commodities.find((c: any) => c.commodityName === cirModalData.commodity);
                            const variety = commodity?.varieties?.find((v: any) => v.varietyName === cirModalData.varietyName);
                            const particulars = variety?.particulars || [];
                            return particulars.length > 0 ? (
                              particulars.map((p: any, idx: number) => (
                                <tr key={idx} className="text-green-800">
                                  <td className="px-4 py-2 border-green-300 border">{p.name}</td>
                                  <td className="px-4 py-2 border-green-300 border">{p.minPercentage}</td>
                                  <td className="px-4 py-2 border-green-300 border">{p.maxPercentage}</td>
                                  <td className="px-4 py-2 border-green-300 border">
                                    <Input
                                      type="number"
                                      value={typeof cirModalData.labResults?.[idx] === 'object' && cirModalData.labResults[idx]?.value ? cirModalData.labResults[idx].value : (cirModalData.labResults?.[idx] || '')}
                                      readOnly
                                      className="w-24 bg-white border border-green-300 text-center"
                                      placeholder="Enter value"
                                    />
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr><td colSpan={4} className="text-center text-gray-400 py-2">No quality parameters found for this variety.</td></tr>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              {/* File Attachment Section */}
              {cirModalData?.attachmentUrl && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-orange-700 mb-4">File Attachment</h3>
                  <a href={cirModalData.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                    View Attached File
                  </a>
                </div>
              )}
              {/* In the CIR modal Lab Parameter section, use the Input component for the Actual (%) column, matching the Edit Inward modal: */}
              {cirModalData?.labParameterNames && cirModalData.labParameterNames.length > 0 && cirModalData?.commodity && cirModalData?.varietyName ? (
                <div className="w-full max-w-2xl mb-8" style={{ maxWidth: '900px' }}>
                  <Label className="block font-semibold mb-2 text-green-700 text-left">Quality Parameters (from Commodity & Variety)</Label>
                  <div className="overflow-x-auto max-w-lg">
                    <table className="min-w-full border border-green-300 rounded-lg">
                      <thead className="bg-orange-100 text-orange-600 font-bold">
                        <tr>
                          <th className="px-4 py-2 border-green-300 border">Parameter</th>
                          <th className="px-4 py-2 border-green-300 border">Min %</th>
                          <th className="px-4 py-2 border-green-300 border">Max %</th>
                          <th className="px-4 py-2 border-green-300 border">Actual (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const commodity = commodities.find((c: any) => c.commodityName === cirModalData.commodity);
                          const variety = commodity?.varieties?.find((v: any) => v.varietyName === cirModalData.varietyName);
                          const particulars = variety?.particulars || [];
                          return particulars.length > 0 ? (
                            particulars.map((p: any, idx: number) => (
                              <tr key={idx} className="text-green-800">
                                <td className="px-4 py-2 border-green-300 border">{p.name}</td>
                                <td className="px-4 py-2 border-green-300 border">{p.minPercentage}</td>
                                <td className="px-4 py-2 border-green-300 border">{p.maxPercentage}</td>
                                <td className="px-4 py-2 border-green-300 border">
                                  <Input
                                    type="number"
                                    value={typeof cirModalData.labResults?.[idx] === 'object' && cirModalData.labResults[idx]?.value ? cirModalData.labResults[idx].value : (cirModalData.labResults?.[idx] || '')}
                                    readOnly
                                    className="w-24 bg-white border border-green-300 text-center"
                                  />
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan={4} className="text-center text-gray-400 py-2">No quality parameters found for this variety.</td></tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </form>
            {/* Mandatory Remarks input at the bottom */}
            <div className="mt-6">
              <Label className="block font-semibold mb-2 text-orange-700">Remarks / Approval Note <span className="text-red-500">*</span></Label>
              <Input
                value={cirRemarks}
                onChange={e => setCIRRemarks(e.target.value)}
                placeholder="Enter remarks or approval note"
                required
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2 sm:space-x-2 mt-3 sm:mt-4">
              {cirModalData?.cirStatus === 'Approved' ? (
                <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm">
                  Print
                </Button>
              ) : cirModalData?.cirStatus === 'Resubmitted' ? null : cirModalData?.cirStatus === 'Rejected' ? null : (
                cirReadOnly ? (
                  showCIRActionButtons() ? (
                    <>
                      {canApproveCIR() && (
                        <Button onClick={handleCIRApprove} className="bg-green-600 hover:bg-green-700 text-white" disabled={!cirRemarks.trim()}>Approve</Button>
                      )}
                      {canRejectCIR() && (
                        <Button onClick={handleCIRReject} className="bg-red-600 hover:bg-red-700 text-white" disabled={!cirRemarks.trim()}>Reject</Button>
                      )}
                      {/* {canResubmitCIR() && (
                        <Button onClick={handleCIRResubmit} className="bg-yellow-400 hover:bg-yellow-500 text-white" disabled={!cirRemarks.trim()}>Resubmit</Button>
                      )} */}
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-gray-500">
                      <Eye className="h-5 w-5 mb-1" />
                      <span className="text-xs">Read-Only Access</span>
                    </div>
                  )
                ) : (
                  <Button onClick={handleCIRSave} color="primary">Save</Button>
                )
              )}
            </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Hidden CIRReceipt for PDF generation */}
      {cirModalData && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div ref={cirReceiptRef}>
            <CIRReceipt data={cirModalData} />
          </div>
        </div>
      )}

      {/* Expand Entries Modal */}
      {showExpandModal && (
        <Dialog open={showExpandModal} onOpenChange={setShowExpandModal}>
          <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-green-700 text-xl">
                Saved Inward Entries - {expandModalData?.inwardId}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Base Information */}
              <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                <h3 className="text-lg font-semibold mb-4 text-green-700">Base Information</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <Label className="block font-medium mb-1 text-green-600">Inward ID</Label>
                    <Input value={expandModalData?.inwardId || 'Pending'} readOnly className="bg-white border-green-300 font-mono" />
                  </div>
                  <div>
                    <Label className="block font-medium mb-1 text-green-600">Client</Label>
                    <Input value={expandModalData?.client || '-'} readOnly className="bg-white border-green-300" />
                  </div>
                  <div>
                    <Label className="block font-medium mb-1 text-green-600">Commodity</Label>
                    <Input value={expandModalData?.commodity || '-'} readOnly className="bg-white border-green-300" />
                  </div>
                  <div>
                    <Label className="block font-medium mb-1 text-green-600">Total Entries</Label>
                    <Input value={expandModalData?.totalEntries || '0'} readOnly className="bg-white border-green-300" />
                  </div>
                </div>
              </div>

              {/* Entries Display */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-green-700">Saved Inward Entries</h3>
                {isExpandingEntries ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    <span className="ml-2 text-green-600">Loading entries...</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {expandModalData?.inwardEntries?.map((entry: any, index: number) => (
                      <div key={entry.id || index} className="border border-green-300 rounded-lg p-6 bg-green-50">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-semibold text-green-800">Entry #{entry.entryNumber || index + 1}</h4>
                          <div className="text-sm text-green-600 font-medium">
                            Vehicle: {entry.vehicleNumber || '-'} | Gatepass: {entry.getpassNumber || '-'}
                          </div>
                        </div>
                        
                        {/* Inward ID */}
                        <div className="mb-4">
                          <h5 className="text-md font-semibold mb-2 text-green-700">Inward Information</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label className="block font-medium mb-1 text-green-600">Inward ID</Label>
                              <Input value={entry.inwardId || expandModalData?.inwardId || 'Pending'} readOnly className="bg-white border-green-300 font-mono" />
                            </div>
                          </div>
                        </div>
                        
                        {/* Vehicle Information */}
                        <div className="mb-4">
                          <h5 className="text-md font-semibold mb-2 text-green-700">Vehicle Information</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label className="block font-medium mb-1 text-green-600">Vehicle Number</Label>
                              <Input value={entry.vehicleNumber || '-'} readOnly className="bg-white border-green-300" />
                            </div>
                            <div>
                              <Label className="block font-medium mb-1 text-green-600">Gatepass Number</Label>
                              <Input value={entry.getpassNumber || '-'} readOnly className="bg-white border-green-300" />
                            </div>
                          </div>
                        </div>
                        
                        {/* Weight Bridge Information */}
                        <div className="mb-4">
                          <h5 className="text-md font-semibold mb-2 text-green-700">Weight Bridge Information</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label className="block font-medium mb-1 text-green-600">Weight Bridge</Label>
                              <Input value={entry.weightBridge || '-'} readOnly className="bg-white border-green-300" />
                            </div>
                            <div>
                              <Label className="block font-medium mb-1 text-green-600">Weight Bridge Slip Number</Label>
                              <Input value={entry.weightBridgeSlipNumber || '-'} readOnly className="bg-white border-green-300" />
                            </div>
                          </div>
                        </div>
                        
                        {/* Weight Information */}
                        <div className="mb-4">
                          <h5 className="text-md font-semibold mb-2 text-green-700">Weight Information</h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label className="block font-medium mb-1 text-green-600">Gross Weight (MT)</Label>
                              <Input value={entry.grossWeight || '-'} readOnly className="bg-white border-green-300" />
                            </div>
                            <div>
                              <Label className="block font-medium mb-1 text-green-600">Tare Weight (MT)</Label>
                              <Input value={entry.tareWeight || '-'} readOnly className="bg-white border-green-300" />
                            </div>
                            <div>
                              <Label className="block font-medium mb-1 text-green-600">Net Weight (MT)</Label>
                              <Input value={entry.netWeight || '-'} readOnly className="bg-white border-green-300" />
                            </div>
                          </div>
                        </div>
                        
                        {/* Additional Weight Information */}
                        <div className="mb-4">
                          <h5 className="text-md font-semibold mb-2 text-green-700">Additional Information</h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label className="block font-medium mb-1 text-green-600">Average Weight</Label>
                              <Input value={entry.averageWeight || '-'} readOnly className="bg-white border-green-300" />
                            </div>
                            <div>
                              <Label className="block font-medium mb-1 text-green-600">Total Bags</Label>
                              <Input value={entry.totalBags || '-'} readOnly className="bg-white border-green-300" />
                            </div>
                            <div>
                              <Label className="block font-medium mb-1 text-green-600">Total Quantity</Label>
                              <Input value={entry.totalQuantity || '-'} readOnly className="bg-white border-green-300" />
                            </div>
                          </div>
                        </div>
                        
                        {/* Stack Information */}
                        <div>
                          <h5 className="text-md font-semibold mb-2 text-green-700">Stack Information</h5>
                          <div className="space-y-3">
                            {entry.stacks && Array.isArray(entry.stacks) && entry.stacks.length > 0 ? (
                              entry.stacks.map((stack: any, stackIndex: number) => (
                                <div key={stackIndex} className="border border-green-200 rounded-lg p-3 bg-white">
                                  <div className="flex items-center justify-between mb-2">
                                    <h6 className="font-medium text-green-700">Stack {stackIndex + 1}</h6>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <Label className="block font-medium mb-1 text-green-600">Stack Number</Label>
                                      <Input value={stack.stackNumber || '-'} readOnly className="bg-gray-50 border-green-300" />
                                    </div>
                                    <div>
                                      <Label className="block font-medium mb-1 text-green-600">Number of Bags</Label>
                                      <Input value={stack.numberOfBags || '-'} readOnly className="bg-gray-50 border-green-300" />
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-4 text-green-600">
                                No stack information available
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={() => setShowExpandModal(false)} variant="outline" className="border-green-300 text-green-700 hover:bg-green-50">
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// Add numberToWords helper at the top of the file
function numberToWords(num: string | number): string {
  if (!num) return '';
  const n = parseInt(num.toString().replace(/,/g, ''));
  if (isNaN(n)) return '';
  if (n === 0) return 'zero';
  const a = [
    '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'
  ];
  const b = [
    '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'
  ];
  const g = [
    '', 'thousand', 'million', 'billion', 'trillion'
  ];
  function chunk(num: number): number[] {
    let arr: number[] = [];
    while (num > 0) {
      arr.push(num % 1000);
      num = Math.floor(num / 1000);
    }
    return arr;
  }
  function inWords(num: number): string {
    if (num === 0) return '';
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num / 10)] + (num % 10 ? ' ' + a[num % 10] : '');
    return a[Math.floor(num / 100)] + ' hundred' + (num % 100 ? ' ' + inWords(num % 100) : '');
  }
  const chunks = chunk(n);
  let str = '';
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i]) {
      str = inWords(chunks[i]) + (g[i] ? ' ' + g[i] : '') + (str ? ' ' + str : '');
    }
  }
  return str.trim() + ' only';
}