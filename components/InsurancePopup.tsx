"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";

// Helper function to safely create dates
function safeCreateDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const date = new Date(val);
    return isNaN(date.getTime()) ? null : date;
  }
  if (val.seconds) {
    return new Date(val.seconds * 1000);
  }
  return null;
}

// Helper function to format dates
function formatDateDDMMYYYY(date: Date | null | undefined): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

interface ClientData {
  id?: string;
  clientId: string;
  firmName: string;
  authorizedPersonName: string;
  firmType: string;
  companyAddress: string;
  contactNumber: string;
  panNumber: string;
  gstNumber: string;
  aadharNumber?: string;
  email?: string;
  landline?: string;
  alternateNumber?: string;
  panCardImage?: string;
  aadharCardImage?: string;
  documentUrls?: string[];
  createdAt?: string;
}

interface BankData {
  id: string;
  bankName: string;
  state: string;
  locations: {
    locationName: string;
    branchName: string;
    ifscCode: string;
  }[];
}

interface InsuranceData {
  insuranceTakenBy: string;
  insuranceCommodity: string;
  clientName: string;
  clientAddress: string;
  selectedBankName: string;
  firePolicyCompanyName: string;
  firePolicyNumber: string;
  firePolicyAmount: string;
  firePolicyStartDate: Date | null;
  firePolicyEndDate: Date | null;
  burglaryPolicyCompanyName: string;
  burglaryPolicyNumber: string;
  burglaryPolicyAmount: string;
  burglaryPolicyStartDate: Date | null;
  burglaryPolicyEndDate: Date | null;
}

interface InsurancePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (insuranceData: InsuranceData) => void;
  initialData?: Partial<InsuranceData>;
  action: 'activate' | 'close' | 'reactivate';
}

export default function InsurancePopup({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData, 
  action 
}: InsurancePopupProps) {
  const { toast } = useToast();

  const [insuranceData, setInsuranceData] = useState<InsuranceData>({
    insuranceTakenBy: '',
    insuranceCommodity: '',
    clientName: '',
    clientAddress: '',
    selectedBankName: '',
    firePolicyCompanyName: '',
    firePolicyNumber: '',
    firePolicyAmount: '',
    firePolicyStartDate: null,
    firePolicyEndDate: null,
    burglaryPolicyCompanyName: '',
    burglaryPolicyNumber: '',
    burglaryPolicyAmount: '',
    burglaryPolicyStartDate: null,
    burglaryPolicyEndDate: null,
  });

  const [clientsData, setClientsData] = useState<ClientData[]>([]);
  const [banksData, setBanksData] = useState<BankData[]>([]);
  const [insuranceBanks, setInsuranceBanks] = useState<{name: string, ifsc: string}[]>([]);
  
  // Insurance selection state
  const [clientInsuranceData, setClientInsuranceData] = useState<any[]>([]);
  const [agrogreenInsuranceData, setAgrogreenInsuranceData] = useState<any[]>([]);
  const [selectedClientInsurances, setSelectedClientInsurances] = useState<any[]>([]);
  const [selectedAgrogreenInsurances, setSelectedAgrogreenInsurances] = useState<any[]>([]);
  const [additionalInsuranceSections, setAdditionalInsuranceSections] = useState<any[]>([]);
  const [availableCommodities, setAvailableCommodities] = useState<string[]>([]);
  const [selectedInsurancePolicy, setSelectedInsurancePolicy] = useState<string>('');

  // Load initial data when popup opens
  useEffect(() => {
    if (isOpen && initialData) {
      setInsuranceData(prev => ({
        ...prev,
        ...initialData,
        firePolicyStartDate: initialData.firePolicyStartDate || null,
        firePolicyEndDate: initialData.firePolicyEndDate || null,
        burglaryPolicyStartDate: initialData.burglaryPolicyStartDate || null,
        burglaryPolicyEndDate: initialData.burglaryPolicyEndDate || null,
      }));
      
      // Restore selected insurance states if they exist in initial data
      if ((initialData as any).selectedClientInsurances && Array.isArray((initialData as any).selectedClientInsurances)) {
        setSelectedClientInsurances((initialData as any).selectedClientInsurances);
      }
      
      if ((initialData as any).selectedAgrogreenInsurances && Array.isArray((initialData as any).selectedAgrogreenInsurances)) {
        setSelectedAgrogreenInsurances((initialData as any).selectedAgrogreenInsurances);
      }
      
      if ((initialData as any).additionalInsuranceSections && Array.isArray((initialData as any).additionalInsuranceSections)) {
        setAdditionalInsuranceSections((initialData as any).additionalInsuranceSections);
      }
    }
  }, [isOpen, initialData]);

  // Load clients and banks data
  useEffect(() => {
    if (isOpen) {
      loadClientsData();
      loadBanksData();
      loadInsuranceData();
      loadCommoditiesData();
    }
  }, [isOpen]);
  
  // Load insurance data when client or insurance taken by changes
  useEffect(() => {
    if (isOpen && insuranceData.insuranceTakenBy) {
      if (insuranceData.insuranceTakenBy === 'client') {
        loadClientInsuranceData();
      } else if (insuranceData.insuranceTakenBy === 'agrogreen') {
        loadAgrogreenInsuranceData();
      }
    }
  }, [isOpen, insuranceData.insuranceTakenBy, insuranceData.clientName, insuranceData.insuranceCommodity]);

  const loadClientsData = async () => {
    try {
      const clientsSnapshot = await getDocs(collection(db, 'clients'));
      const clientsArray = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ClientData[];
      setClientsData(clientsArray);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadBanksData = async () => {
    try {
      const banksSnapshot = await getDocs(collection(db, 'banks'));
      const banksArray = banksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BankData[];
      setBanksData(banksArray);

      // Create insurance banks list
      const allInsuranceBanks: {name: string, ifsc: string}[] = [];
      banksArray.forEach(bank => {
        bank.locations?.forEach(location => {
          allInsuranceBanks.push({
            name: location.locationName || bank.bankName,
            ifsc: location.ifscCode
          });
        });
      });
      setInsuranceBanks(allInsuranceBanks);
    } catch (error) {
      console.error('Error loading banks:', error);
    }
  };

  const loadInsuranceData = async () => {
    try {
      const insuranceSnapshot = await getDocs(collection(db, 'insurance-master'));
      const insuranceArray = insuranceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      
      // Separate insurance data by type
      const clientInsurance = insuranceArray.filter((ins: any) => ins.insuranceTakenBy === 'client');
      const agrogreenInsurance = insuranceArray.filter((ins: any) => ins.insuranceTakenBy === 'agrogreen');
      
      // Extract unique commodities from all insurance data
      const commodities = Array.from(new Set(insuranceArray.map((ins: any) => ins.commodity).filter(Boolean))).sort();
      
      setClientInsuranceData(clientInsurance);
      setAgrogreenInsuranceData(agrogreenInsurance);
      setAvailableCommodities(commodities);
    } catch (error) {
      console.error('Error loading insurance data:', error);
    }
  };

  const loadClientInsuranceData = async () => {
    try {
      const insuranceSnapshot = await getDocs(collection(db, 'insurance-master'));
      const insuranceArray = insuranceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      
      // Filter for client insurance, optionally match with selected client and commodity
      const clientInsurance = insuranceArray.filter((ins: any) => 
        ins.insuranceTakenBy === 'client' && 
        (insuranceData.clientName ? ins.clientName === insuranceData.clientName : true) &&
        (insuranceData.insuranceCommodity ? ins.commodity === insuranceData.insuranceCommodity : true)
      );
      
      setClientInsuranceData(clientInsurance);
    } catch (error) {
      console.error('Error loading client insurance data:', error);
    }
  };

  const loadAgrogreenInsuranceData = async () => {
    try {
      const insuranceSnapshot = await getDocs(collection(db, 'insurance-master'));
      const insuranceArray = insuranceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      
      // Filter for agrogreen insurance
      const agrogreenInsurance = insuranceArray.filter((ins: any) => 
        ins.insuranceTakenBy === 'agrogreen' &&
        (insuranceData.insuranceCommodity ? ins.commodity === insuranceData.insuranceCommodity : true)
      );
      
      setAgrogreenInsuranceData(agrogreenInsurance);
    } catch (error) {
      console.error('Error loading agrogreen insurance data:', error);
    }
  };

  const fetchClientInsurances = async (clientName: string) => {
    try {
      // Get insurance data from multiple sources
      const [insuranceMasterSnapshot, clientInsuranceSnapshot] = await Promise.all([
        getDocs(collection(db, 'insurance-master')),
        getDocs(collection(db, 'client-insurance'))
      ]);

      // Process insurance-master data
      const insuranceMasterData = insuranceMasterSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((ins: any) => ins.clientName === clientName);

      // Process client-insurance data  
      const clientInsuranceData = clientInsuranceSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((ins: any) => ins.clientName === clientName);

      // Combine both sources
      const combinedInsurances = [...insuranceMasterData, ...clientInsuranceData];
      
      return combinedInsurances;
    } catch (error) {
      console.error('Error fetching client insurances:', error);
      return [];
    }
  };

  const loadCommoditiesData = async () => {
    try {
      const commoditiesSnapshot = await getDocs(collection(db, 'commodities'));
      const commoditiesArray = commoditiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setAvailableCommodities(commoditiesArray);
    } catch (error) {
      console.error('Error loading commodities:', error);
    }
  };

  const scrollToInsuranceField = (fieldName: string) => {
    // Create a mapping of field names to element IDs for insurance popup
    const fieldMap: { [key: string]: string } = {
      'insuranceTakenBy': 'insuranceTakenBy',
      'clientName': 'clientName',
      'clientAddress': 'clientAddress',
      'selectedBankName': 'selectedBankName',
      'firePolicyCompanyName': 'firePolicyCompanyName',
      'firePolicyNumber': 'firePolicyNumber',
      'firePolicyAmount': 'firePolicyAmount',
      'burglaryPolicyCompanyName': 'burglaryPolicyCompanyName',
      'burglaryPolicyNumber': 'burglaryPolicyNumber',
      'burglaryPolicyAmount': 'burglaryPolicyAmount',
    };

    const elementId = fieldMap[fieldName];
    if (elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Focus on the element if it's an input/select
        if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
          setTimeout(() => element.focus(), 500);
        }
      }
    }
  };

  const validateInsurance = () => {
    const missingFields: string[] = [];
    const missingFieldsRaw: string[] = [];

    // Insurance Taken By is required for activation/reactivation
    if (!insuranceData.insuranceTakenBy) {
      missingFieldsRaw.push('insuranceTakenBy');
      missingFields.push('Insurance Taken By');
    }

    // If insurance is taken by someone other than bank, validate policy details
    if (insuranceData.insuranceTakenBy && insuranceData.insuranceTakenBy !== 'bank') {
      // Fire policy validation
      if (!insuranceData.firePolicyCompanyName) {
        missingFieldsRaw.push('firePolicyCompanyName');
        missingFields.push('Fire Policy Company Name');
      }
      if (!insuranceData.firePolicyNumber) {
        missingFieldsRaw.push('firePolicyNumber');
        missingFields.push('Fire Policy Number');
      }
      if (!insuranceData.firePolicyAmount) {
        missingFieldsRaw.push('firePolicyAmount');
        missingFields.push('Fire Policy Amount');
      }
      if (!insuranceData.firePolicyStartDate) missingFields.push('Fire Policy Start Date');
      if (!insuranceData.firePolicyEndDate) missingFields.push('Fire Policy End Date');

      // Burglary policy validation
      if (!insuranceData.burglaryPolicyCompanyName) {
        missingFieldsRaw.push('burglaryPolicyCompanyName');
        missingFields.push('Burglary Policy Company Name');
      }
      if (!insuranceData.burglaryPolicyNumber) {
        missingFieldsRaw.push('burglaryPolicyNumber');
        missingFields.push('Burglary Policy Number');
      }
      if (!insuranceData.burglaryPolicyAmount) {
        missingFieldsRaw.push('burglaryPolicyAmount');
        missingFields.push('Burglary Policy Amount');
      }
      if (!insuranceData.burglaryPolicyStartDate) missingFields.push('Burglary Policy Start Date');
      if (!insuranceData.burglaryPolicyEndDate) missingFields.push('Burglary Policy End Date');

      // Client specific validation
      if (insuranceData.insuranceTakenBy === 'client') {
        if (!insuranceData.clientName) {
          missingFieldsRaw.push('clientName');
          missingFields.push('Client Name');
        }
        if (!insuranceData.clientAddress) {
          missingFieldsRaw.push('clientAddress');
          missingFields.push('Client Address');
        }
      }
    }

    // Bank specific validation
    if (insuranceData.insuranceTakenBy === 'bank' && !insuranceData.selectedBankName) {
      missingFieldsRaw.push('selectedBankName');
      missingFields.push('Bank Name');
    }

    // If there are missing fields, scroll to the first one
    if (missingFieldsRaw.length > 0) {
      scrollToInsuranceField(missingFieldsRaw[0]);
    }

    return missingFields;
  };

  const handleSave = () => {
    // Only validate for activation and reactivation actions
    if (action === 'activate' || action === 'reactivate') {
      const missingFields = validateInsurance();
      if (missingFields.length > 0) {
        toast({
          title: `Cannot ${action === 'activate' ? 'Activate' : 'Reactivate'} Warehouse`,
          description: `Please complete insurance details: ${missingFields.join(', ')}`,
          variant: "destructive",
        });
        return;
      }
    }

    // Include selected insurance data in the save
    const dataToSave = {
      ...insuranceData,
      selectedClientInsurances,
      selectedAgrogreenInsurances,
      additionalInsuranceSections
    };

    onSave(dataToSave);
  };

  const handleCancel = () => {
    // For activation/reactivation, check if existing data is complete
    if (action === 'activate' || action === 'reactivate') {
      const missingFields = validateInsurance();
      if (missingFields.length > 0) {
        toast({
          title: `Insurance Required for ${action === 'activate' ? 'Activation' : 'Reactivation'}`,
          description: "Please complete all insurance details to proceed.",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Reset insurance selection states when cancelling
    setSelectedClientInsurances([]);
    setSelectedAgrogreenInsurances([]);
    setAdditionalInsuranceSections([]);
    
    onClose();
  };

  const getActionTitle = () => {
    switch (action) {
      case 'activate': return 'Complete Insurance Details for Activation';
      case 'reactivate': return 'Complete Insurance Details for Reactivation';
      case 'close': return 'Update Insurance Details';
      default: return 'Insurance Details';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-green-700 text-xl">{getActionTitle()}</DialogTitle>
          <DialogDescription>
            Provide insurance details for the warehouse before proceeding with the {action} action.
          </DialogDescription>
        </DialogHeader>

        <Card className="border-green-300">
          <CardHeader className="bg-green-50">
            <CardTitle className="text-green-700">Insurance of Stock</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4 transition-all duration-200 ease-in-out">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="insuranceTakenBy">Insurance Taken By</Label>
                <Select 
                  value={insuranceData.insuranceTakenBy} 
                  onValueChange={(value) => {
                    setInsuranceData(prev => ({ 
                      ...prev, 
                      insuranceTakenBy: value, 
                      clientName: '', 
                      clientAddress: '', 
                      selectedBankName: '',
                      // Clear insurance policy details when changing insurance taken by
                      firePolicyCompanyName: '',
                      firePolicyNumber: '',
                      firePolicyAmount: '',
                      firePolicyStartDate: null,
                      firePolicyEndDate: null,
                      burglaryPolicyCompanyName: '',
                      burglaryPolicyNumber: '',
                      burglaryPolicyAmount: '',
                      burglaryPolicyStartDate: null,
                      burglaryPolicyEndDate: null,
                    }));
                    
                    // Clear selections and additional sections
                    setSelectedClientInsurances([]);
                    setSelectedAgrogreenInsurances([]);
                    setAdditionalInsuranceSections([]);
                  }}
                >
                  <SelectTrigger className="text-orange-600">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warehouse owner">Warehouse Owner</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="agrogreen">Agrogreen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="insuranceCommodity">Commodity</Label>
                <Select 
                  value={insuranceData.insuranceCommodity} 
                  onValueChange={(value) => {
                    setInsuranceData(prev => ({ ...prev, insuranceCommodity: value }));
                    
                    // Clear selections when commodity changes
                    setSelectedClientInsurances([]);
                    setSelectedAgrogreenInsurances([]);
                    setAdditionalInsuranceSections([]);
                  }}
                >
                  <SelectTrigger className="text-orange-600">
                    <SelectValue placeholder="Select commodity" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCommodities.map((commodity: any) => (
                      <SelectItem key={commodity.id} value={commodity.commodityName}>
                        {commodity.commodityName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>



            {/* Insurance Selection Section */}
            {(insuranceData.insuranceTakenBy === 'client' || insuranceData.insuranceTakenBy === 'agrogreen') && (
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-green-600 font-medium text-lg">
                    Select {insuranceData.insuranceTakenBy === 'client' ? 'Client' : 'Agrogreen'} Insurance Policies
                  </Label>
                  {((insuranceData.insuranceTakenBy === 'client' && selectedClientInsurances.length > 0) ||
                    (insuranceData.insuranceTakenBy === 'agrogreen' && selectedAgrogreenInsurances.length > 0)) && (
                    <div className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                      {insuranceData.insuranceTakenBy === 'client' ? selectedClientInsurances.length : selectedAgrogreenInsurances.length} selected
                    </div>
                  )}
                </div>
                
                <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                  {((insuranceData.insuranceTakenBy === 'client' && selectedClientInsurances.length === 0) ||
                    (insuranceData.insuranceTakenBy === 'agrogreen' && selectedAgrogreenInsurances.length === 0)) && (
                    <div className="text-xs text-green-600 mb-3 p-2 bg-green-100 rounded">
                      💡 <strong>Tip:</strong> Select insurance policies below to automatically fill the Fire Policy and Burglary Policy details sections.
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(insuranceData.insuranceTakenBy === 'client' ? clientInsuranceData : agrogreenInsuranceData).length === 0 ? (
                      <div className="col-span-full text-center py-8 text-gray-500">
                        {insuranceData.insuranceCommodity ? 
                          `No ${insuranceData.insuranceTakenBy} insurance policies found for "${insuranceData.insuranceCommodity}" commodity.` :
                          `Loading ${insuranceData.insuranceTakenBy} insurance policies...`
                        }
                      </div>
                    ) : (
                      (insuranceData.insuranceTakenBy === 'client' ? clientInsuranceData : agrogreenInsuranceData).map((insurance, index) => (
                      <div key={index} className="border border-green-300 rounded p-3 bg-white">
                        <div className="flex items-center space-x-2 mb-2">
                          <input
                            type="checkbox"
                            id={`insurance-popup-${index}`}
                            checked={
                              insuranceData.insuranceTakenBy === 'client' 
                                ? selectedClientInsurances.some(selected => 
                                    selected.firePolicyNumber === insurance.firePolicyNumber && 
                                    selected.burglaryPolicyNumber === insurance.burglaryPolicyNumber
                                  )
                                : selectedAgrogreenInsurances.some(selected => 
                                    selected.firePolicyNumber === insurance.firePolicyNumber && 
                                    selected.burglaryPolicyNumber === insurance.burglaryPolicyNumber
                                  )
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (insuranceData.insuranceTakenBy === 'client') {
                                  setSelectedClientInsurances(prev => [...prev, insurance]);
                                  // Auto-fill if first selection
                                  if (selectedClientInsurances.length === 0) {
                                    setInsuranceData(prev => ({
                                      ...prev,
                                      firePolicyCompanyName: insurance.firePolicyCompanyName || '',
                                      firePolicyNumber: insurance.firePolicyNumber || '',
                                      firePolicyAmount: insurance.firePolicyAmount || '',
                                      firePolicyStartDate: safeCreateDate(insurance.firePolicyStartDate),
                                      firePolicyEndDate: safeCreateDate(insurance.firePolicyEndDate),
                                      burglaryPolicyCompanyName: insurance.burglaryPolicyCompanyName || '',
                                      burglaryPolicyNumber: insurance.burglaryPolicyNumber || '',
                                      burglaryPolicyAmount: insurance.burglaryPolicyAmount || '',
                                      burglaryPolicyStartDate: safeCreateDate(insurance.burglaryPolicyStartDate),
                                      burglaryPolicyEndDate: safeCreateDate(insurance.burglaryPolicyEndDate),
                                    }));
                                  } else {
                                    setAdditionalInsuranceSections(prev => [...prev, {
                                      id: `additional-${Date.now()}-${Math.random()}`,
                                      insurance: insurance,
                                      sectionNumber: prev.length + 2
                                    }]);
                                  }
                                } else {
                                  setSelectedAgrogreenInsurances(prev => [...prev, insurance]);
                                  // Auto-fill if first selection
                                  if (selectedAgrogreenInsurances.length === 0) {
                                    setInsuranceData(prev => ({
                                      ...prev,
                                      firePolicyCompanyName: insurance.firePolicyCompanyName || '',
                                      firePolicyNumber: insurance.firePolicyNumber || '',
                                      firePolicyAmount: insurance.firePolicyAmount || '',
                                      firePolicyStartDate: safeCreateDate(insurance.firePolicyStartDate),
                                      firePolicyEndDate: safeCreateDate(insurance.firePolicyEndDate),
                                      burglaryPolicyCompanyName: insurance.burglaryPolicyCompanyName || '',
                                      burglaryPolicyNumber: insurance.burglaryPolicyNumber || '',
                                      burglaryPolicyAmount: insurance.burglaryPolicyAmount || '',
                                      burglaryPolicyStartDate: safeCreateDate(insurance.burglaryPolicyStartDate),
                                      burglaryPolicyEndDate: safeCreateDate(insurance.burglaryPolicyEndDate),
                                    }));
                                  } else {
                                    setAdditionalInsuranceSections(prev => [...prev, {
                                      id: `additional-${Date.now()}-${Math.random()}`,
                                      insurance: insurance,
                                      sectionNumber: prev.length + 2
                                    }]);
                                  }
                                }
                              } else {
                                // Handle unchecking
                                if (insuranceData.insuranceTakenBy === 'client') {
                                  setSelectedClientInsurances(prev => 
                                    prev.filter(selected => 
                                      !(selected.firePolicyNumber === insurance.firePolicyNumber && 
                                        selected.burglaryPolicyNumber === insurance.burglaryPolicyNumber)
                                    )
                                  );
                                  
                                  // Clear form if this was the main insurance
                                  if (insuranceData.firePolicyNumber === insurance.firePolicyNumber && 
                                      insuranceData.burglaryPolicyNumber === insurance.burglaryPolicyNumber) {
                                    // Clear and refill with next available
                                    const remaining = selectedClientInsurances.filter(selected => 
                                      !(selected.firePolicyNumber === insurance.firePolicyNumber && 
                                        selected.burglaryPolicyNumber === insurance.burglaryPolicyNumber)
                                    );
                                    
                                    if (remaining.length > 0) {
                                      const first = remaining[0];
                                      setInsuranceData(prev => ({
                                        ...prev,
                                        firePolicyCompanyName: first.firePolicyCompanyName || '',
                                        firePolicyNumber: first.firePolicyNumber || '',
                                        firePolicyAmount: first.firePolicyAmount || '',
                                        firePolicyStartDate: safeCreateDate(first.firePolicyStartDate),
                                        firePolicyEndDate: safeCreateDate(first.firePolicyEndDate),
                                        burglaryPolicyCompanyName: first.burglaryPolicyCompanyName || '',
                                        burglaryPolicyNumber: first.burglaryPolicyNumber || '',
                                        burglaryPolicyAmount: first.burglaryPolicyAmount || '',
                                        burglaryPolicyStartDate: safeCreateDate(first.burglaryPolicyStartDate),
                                        burglaryPolicyEndDate: safeCreateDate(first.burglaryPolicyEndDate),
                                      }));
                                    } else {
                                      // Clear all fields
                                      setInsuranceData(prev => ({
                                        ...prev,
                                        firePolicyCompanyName: '',
                                        firePolicyNumber: '',
                                        firePolicyAmount: '',
                                        firePolicyStartDate: null,
                                        firePolicyEndDate: null,
                                        burglaryPolicyCompanyName: '',
                                        burglaryPolicyNumber: '',
                                        burglaryPolicyAmount: '',
                                        burglaryPolicyStartDate: null,
                                        burglaryPolicyEndDate: null,
                                      }));
                                    }
                                  }
                                } else {
                                  // Similar logic for agrogreen
                                  setSelectedAgrogreenInsurances(prev => 
                                    prev.filter(selected => 
                                      !(selected.firePolicyNumber === insurance.firePolicyNumber && 
                                        selected.burglaryPolicyNumber === insurance.burglaryPolicyNumber)
                                    )
                                  );
                                }
                                
                                // Remove from additional sections
                                setAdditionalInsuranceSections(prev => 
                                  prev.filter(section => 
                                    !(section.insurance.firePolicyNumber === insurance.firePolicyNumber && 
                                      section.insurance.burglaryPolicyNumber === insurance.burglaryPolicyNumber)
                                  )
                                );
                              }
                            }}
                            className="text-green-600"
                          />
                          <label htmlFor={`insurance-popup-${index}`} className="text-sm font-medium text-green-700">
                            Insurance {index + 1}
                          </label>
                        </div>
                        <div className="text-xs text-green-600 space-y-1">
                          <div><strong>Insurance ID:</strong> {insurance.insuranceId || 'N/A'}</div>
                          <div><strong>Commodity:</strong> {insurance.commodity}</div>
                          <div><strong>Fire Policy:</strong> {insurance.firePolicyNumber}</div>
                          <div><strong>Burglary Policy:</strong> {insurance.burglaryPolicyNumber}</div>
                          <div><strong>Fire Amount:</strong> ₹{insurance.firePolicyAmount}</div>
                          <div><strong>Burglary Amount:</strong> ₹{insurance.burglaryPolicyAmount}</div>
                          {insurance.firePolicyEndDate && (
                            <div><strong>Fire Policy Expires:</strong> {formatDateDDMMYYYY(safeCreateDate(insurance.firePolicyEndDate))}</div>
                          )}
                        </div>
                      </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Client Name and Address dropdowns for Client selection */}
              {insuranceData.insuranceTakenBy === 'client' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Client Name</Label>
                    <Select 
                      value={insuranceData.clientName} 
                      onValueChange={(value) => {
                        const selectedClient = clientsData.find(client => client.firmName === value);
                        setInsuranceData(prev => ({ 
                          ...prev, 
                          clientName: value,
                          clientAddress: selectedClient?.companyAddress || ''
                        }));
                      }}
                    >
                      <SelectTrigger className="text-orange-600">
                        <SelectValue placeholder="Select Client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientsData.map(client => (
                          <SelectItem key={client.id} value={client.firmName}>
                            {client.firmName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clientAddress">Client Address</Label>
                    <Select 
                      value={insuranceData.clientAddress} 
                      onValueChange={(value) => setInsuranceData(prev => ({ ...prev, clientAddress: value }))}
                    >
                      <SelectTrigger className="text-orange-600">
                        <SelectValue placeholder="Select Address" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientsData
                          .filter(client => insuranceData.clientName ? client.firmName === insuranceData.clientName : true)
                          .map(client => (
                            <SelectItem key={client.id} value={client.companyAddress}>
                              {client.companyAddress}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Bank Name dropdown for Bank selection */}
              {insuranceData.insuranceTakenBy === 'bank' && (
                <div className="space-y-2">
                  <Label htmlFor="selectedBankName">Bank Name</Label>
                  <Select 
                    value={insuranceData.selectedBankName} 
                    onValueChange={(value) => setInsuranceData(prev => ({ ...prev, selectedBankName: value }))}
                  >
                    <SelectTrigger className="text-orange-600">
                      <SelectValue placeholder="Select Bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {insuranceBanks.map((bank, index) => (
                        <SelectItem key={index} value={bank.name}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Fire Policy Section - Show for all except bank */}
            {insuranceData.insuranceTakenBy && insuranceData.insuranceTakenBy !== '' && insuranceData.insuranceTakenBy !== 'bank' && (
              <>
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-medium text-green-700">Fire Policy Details</h4>
                    {insuranceData.firePolicyNumber && 
                     ((insuranceData.insuranceTakenBy === 'client' && selectedClientInsurances.length > 0) ||
                      (insuranceData.insuranceTakenBy === 'agrogreen' && selectedAgrogreenInsurances.length > 0)) && (
                      <div className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                        Auto-filled from selected insurance
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firePolicyCompanyName">Fire Policy Company Name</Label>
                      <Input
                        id="firePolicyCompanyName"
                        value={insuranceData.firePolicyCompanyName}
                        onChange={(e) => setInsuranceData(prev => ({ ...prev, firePolicyCompanyName: e.target.value }))}
                        className="text-orange-600"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="firePolicyNumber">Fire Policy Number</Label>
                      <Input
                        id="firePolicyNumber"
                        value={insuranceData.firePolicyNumber}
                        onChange={(e) => setInsuranceData(prev => ({ ...prev, firePolicyNumber: e.target.value }))}
                        className="text-orange-600"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="firePolicyAmount">Fire Policy Amount</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                        <Input
                          id="firePolicyAmount"
                          type="number"
                          className="pl-10 text-orange-600"
                          value={insuranceData.firePolicyAmount}
                          onChange={(e) => setInsuranceData(prev => ({ ...prev, firePolicyAmount: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Fire Policy Start Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {insuranceData.firePolicyStartDate && insuranceData.firePolicyStartDate instanceof Date && !isNaN(insuranceData.firePolicyStartDate.getTime()) ? format(insuranceData.firePolicyStartDate, "PPP") : "Pick start date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={insuranceData.firePolicyStartDate || undefined}
                            onSelect={(date) => setInsuranceData(prev => ({ ...prev, firePolicyStartDate: date || null }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>Fire Policy End Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {insuranceData.firePolicyEndDate && insuranceData.firePolicyEndDate instanceof Date && !isNaN(insuranceData.firePolicyEndDate.getTime()) ? format(insuranceData.firePolicyEndDate, "PPP") : "Pick end date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={insuranceData.firePolicyEndDate || undefined}
                            onSelect={(date) => setInsuranceData(prev => ({ ...prev, firePolicyEndDate: date || null }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-medium text-green-700">Burglary Policy Details</h4>
                    {insuranceData.burglaryPolicyNumber && 
                     ((insuranceData.insuranceTakenBy === 'client' && selectedClientInsurances.length > 0) ||
                      (insuranceData.insuranceTakenBy === 'agrogreen' && selectedAgrogreenInsurances.length > 0)) && (
                      <div className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                        Auto-filled from selected insurance
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="burglaryPolicyCompanyName">Burglary Policy Company Name</Label>
                      <Input
                        id="burglaryPolicyCompanyName"
                        value={insuranceData.burglaryPolicyCompanyName}
                        onChange={(e) => setInsuranceData(prev => ({ ...prev, burglaryPolicyCompanyName: e.target.value }))}
                        className="text-orange-600"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="burglaryPolicyNumber">Burglary Policy Number</Label>
                      <Input
                        id="burglaryPolicyNumber"
                        value={insuranceData.burglaryPolicyNumber}
                        onChange={(e) => setInsuranceData(prev => ({ ...prev, burglaryPolicyNumber: e.target.value }))}
                        className="text-orange-600"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="burglaryPolicyAmount">Burglary Policy Amount</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                        <Input
                          id="burglaryPolicyAmount"
                          type="number"
                          className="pl-10 text-orange-600"
                          value={insuranceData.burglaryPolicyAmount}
                          onChange={(e) => setInsuranceData(prev => ({ ...prev, burglaryPolicyAmount: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Burglary Policy Start Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {insuranceData.burglaryPolicyStartDate && insuranceData.burglaryPolicyStartDate instanceof Date && !isNaN(insuranceData.burglaryPolicyStartDate.getTime()) ? format(insuranceData.burglaryPolicyStartDate, "PPP") : "Pick start date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={insuranceData.burglaryPolicyStartDate || undefined}
                            onSelect={(date) => setInsuranceData(prev => ({ ...prev, burglaryPolicyStartDate: date || null }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>Burglary Policy End Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {insuranceData.burglaryPolicyEndDate && insuranceData.burglaryPolicyEndDate instanceof Date && !isNaN(insuranceData.burglaryPolicyEndDate.getTime()) ? format(insuranceData.burglaryPolicyEndDate, "PPP") : "Pick end date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={insuranceData.burglaryPolicyEndDate || undefined}
                            onSelect={(date) => setInsuranceData(prev => ({ ...prev, burglaryPolicyEndDate: date || null }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

                {/* Additional Insurance Sections */}
                {additionalInsuranceSections.map((section) => (
                  <div key={section.id}>
                    {/* Fire Policy Details - Additional Section */}
                    <div className="border-t pt-4 mt-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-medium text-green-700">
                          Fire Policy Details {section.sectionNumber}
                        </h4>
                        <div className="flex items-center gap-2">
                          <div className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                            Auto-filled from: {section.insurance.insuranceId}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              // Remove this section and uncheck the insurance
                              setAdditionalInsuranceSections(prev => {
                                const newSections = prev.filter(s => s.id !== section.id);
                                // Renumber sections to maintain sequential numbering
                                return newSections.map((s, index) => ({
                                  ...s,
                                  sectionNumber: index + 2
                                }));
                              });
                              
                              // Remove from appropriate selection array
                              if (insuranceData.insuranceTakenBy === 'client') {
                                setSelectedClientInsurances(prev => 
                                  prev.filter(selected => 
                                    !(selected.firePolicyNumber === section.insurance.firePolicyNumber && 
                                      selected.burglaryPolicyNumber === section.insurance.burglaryPolicyNumber)
                                  )
                                );
                              } else {
                                setSelectedAgrogreenInsurances(prev => 
                                  prev.filter(selected => 
                                    !(selected.firePolicyNumber === section.insurance.firePolicyNumber && 
                                      selected.burglaryPolicyNumber === section.insurance.burglaryPolicyNumber)
                                  )
                                );
                              }
                            }}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            Remove Section
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Fire Policy Company Name</Label>
                          <div className="p-2 bg-gray-50 rounded border text-green-700">
                            {section.insurance.firePolicyCompanyName || 'N/A'}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Fire Policy Number</Label>
                          <div className="p-2 bg-gray-50 rounded border text-green-700">
                            {section.insurance.firePolicyNumber || 'N/A'}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Fire Policy Amount</Label>
                          <div className="p-2 bg-gray-50 rounded border text-green-700">
                            ₹{section.insurance.firePolicyAmount || 'N/A'}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Fire Policy Start Date</Label>
                          <div className="p-2 bg-gray-50 rounded border text-green-700">
                            {section.insurance.firePolicyStartDate ? formatDateDDMMYYYY(safeCreateDate(section.insurance.firePolicyStartDate) || new Date()) : 'N/A'}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Fire Policy End Date</Label>
                          <div className="p-2 bg-gray-50 rounded border text-green-700">
                            {section.insurance.firePolicyEndDate ? formatDateDDMMYYYY(safeCreateDate(section.insurance.firePolicyEndDate) || new Date()) : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Burglary Policy Details - Additional Section */}
                    <div className="border-t pt-4 mt-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-medium text-green-700">
                          Burglary Policy Details {section.sectionNumber}
                        </h4>
                        <div className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                          Auto-filled from: {section.insurance.insuranceId}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Burglary Policy Company Name</Label>
                          <div className="p-2 bg-gray-50 rounded border text-green-700">
                            {section.insurance.burglaryPolicyCompanyName || 'N/A'}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Burglary Policy Number</Label>
                          <div className="p-2 bg-gray-50 rounded border text-green-700">
                            {section.insurance.burglaryPolicyNumber || 'N/A'}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Burglary Policy Amount</Label>
                          <div className="p-2 bg-gray-50 rounded border text-green-700">
                            ₹{section.insurance.burglaryPolicyAmount || 'N/A'}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Burglary Policy Start Date</Label>
                          <div className="p-2 bg-gray-50 rounded border text-green-700">
                            {section.insurance.burglaryPolicyStartDate ? formatDateDDMMYYYY(safeCreateDate(section.insurance.burglaryPolicyStartDate) || new Date()) : 'N/A'}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Burglary Policy End Date</Label>
                          <div className="p-2 bg-gray-50 rounded border text-green-700">
                            {section.insurance.burglaryPolicyEndDate ? formatDateDDMMYYYY(safeCreateDate(section.insurance.burglaryPolicyEndDate) || new Date()) : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={handleCancel}
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Save & Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
} 