"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileImage, Trash2, Edit, CheckCircle, AlertCircle, X, Download, Search, Eye, ExternalLink } from "lucide-react";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadToCloudinary, CloudinaryUploadResult } from '@/lib/cloudinary';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DataTable } from '@/components/data-table';
import type { Row } from '@tanstack/react-table';

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

// Define columns for DataTable
const clientColumns = [
  {
    accessorKey: "clientId",
    header: "Client ID",
    cell: ({ row }: { row: Row<any> }) => <span className="font-bold text-orange-800 w-full flex justify-center">{row.getValue("clientId")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "firmName", 
    header: "Firm Name",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 font-medium w-full flex justify-center">{row.getValue("firmName")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "authorizedPersonName",
    header: "Authorized Person", 
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("authorizedPersonName")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "firmType",
    header: "Firm Type",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("firmType")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "companyAddress", 
    header: "Company Address",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 w-full flex justify-center truncate max-w-40" title={row.getValue("companyAddress")}>{row.getValue("companyAddress")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "contactNumber",
    header: "Contact Number",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 font-mono w-full flex justify-center">{row.getValue("contactNumber")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "panNumber",
    header: "PAN Number", 
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 font-mono w-full flex justify-center">{row.getValue("panNumber")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "gstNumber",
    header: "GST Number",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 font-mono w-full flex justify-center">{row.getValue("gstNumber")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "aadharNumber",
    header: "Aadhar Number", 
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("aadharNumber") || '-'}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("email") || '-'}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "landline", 
    header: "Landline",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("landline") || '-'}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "alternateNumber",
    header: "Alternate Number",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("alternateNumber") || '-'}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "createdAt",
    header: "Created Date",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-700 w-full flex justify-center">{row.getValue("createdAt") ? new Date(row.getValue("createdAt")).toLocaleDateString() : '-'}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "documentUrls",
    header: "Documents",
    cell: ({ row }: { row: Row<any> }) => {
      const documentUrls = row.getValue("documentUrls") as string[] | undefined;
      const client = row.original;
      
      return (
        <div className="flex items-center justify-center">
          {documentUrls && documentUrls.length > 0 ? (
            <div className="flex items-center justify-center space-x-1">
              <span className="text-green-600 text-sm">{documentUrls.length} file{documentUrls.length > 1 ? 's' : ''}</span>
              <Button
                size="sm"
                variant="outline"
                className="border-blue-300 text-blue-600 hover:bg-blue-50 h-7 w-7 p-0"
                onClick={() => {
                  const urls = documentUrls.map((url, index) => 
                    `Document ${index + 1}: ${url}`
                  ).join('\n\n');
                  
                  if (confirm(`View Documents for ${client.firmName}?\n\n${urls}\n\nClick OK to open first document in new tab.`)) {
                    window.open(documentUrls[0], '_blank');
                  }
                }}
                title="View Documents"
              >
                <Eye className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <span className="text-gray-400 text-sm">No documents</span>
          )}
        </div>
      );
    },
    meta: { align: 'center' },
  },
  {
    accessorKey: "actions",
    header: "Actions",
    cell: ({ row }: { row: Row<any> }) => {
      const client = row.original;
      return (
        <div className="flex space-x-2 justify-center">
          <Button
            size="sm"
            variant="outline"
            className="border-orange-300 text-orange-600 hover:bg-orange-50"
            onClick={() => {
              // This will be handled by the parent component
              const event = new CustomEvent('editClient', { detail: client });
              document.dispatchEvent(event);
            }}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            size="sm" 
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
            onClick={() => {
              if (confirm(`Are you sure you want to delete ${client.firmName}? This action cannot be undone.`)) {
                const event = new CustomEvent('deleteClient', { detail: client.id });
                document.dispatchEvent(event);
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      );
    },
    meta: { align: 'center' },
  },
];

export default function ClientModulePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [clients, setClients] = useState<ClientData[]>([]);
  const [filteredClients, setFilteredClients] = useState<ClientData[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ClientData>({
    clientId: '',
    firmName: '',
    authorizedPersonName: '',
    firmType: '',
    companyAddress: '',
    contactNumber: '',
    panNumber: '',
    gstNumber: '',
    aadharNumber: '',
    email: '',
    landline: '',
    alternateNumber: '',
  });
  const [uploadedFiles, setUploadedFiles] = useState<{name: string, type: string, url?: string}[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [viewFileUrl, setViewFileUrl] = useState<string | null>(null);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Check if user has access (admin and checker can access)
  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'checker') {
      router.push('/dashboard');
    }
  }, [user?.role, router]);

  // Load clients data
  useEffect(() => {
    loadClients();
  }, []);

  // Filter clients based on search term
  useEffect(() => {
    filterClientsBySearch();
  }, [clients, searchTerm]);

  // Event listeners for table actions
  useEffect(() => {
    const handleEditClient = (event: any) => {
      handleEdit(event.detail);
    };
    
    const handleDeleteClient = (event: any) => {
      handleDelete(event.detail);
    };
    
    document.addEventListener('editClient', handleEditClient);
    document.addEventListener('deleteClient', handleDeleteClient);
    
    return () => {
      document.removeEventListener('editClient', handleEditClient);
      document.removeEventListener('deleteClient', handleDeleteClient);
    };
  }, []);

  const loadClients = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'clients'));
      const clientsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ClientData[];
      setClients(clientsData);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const filterClientsBySearch = () => {
    if (!searchTerm.trim()) {
      setFilteredClients(clients);
      return;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    const filtered = clients.filter(client => 
      client.firmName.toLowerCase().includes(searchLower) ||
      client.panNumber.toLowerCase().includes(searchLower) ||
      client.clientId.toLowerCase().includes(searchLower)
    );

    setFilteredClients(filtered);
  };

  // Prepare table data sorted by Client ID in ascending order
  const tableData = useMemo(() => {
    const dataToDisplay = filteredClients.length > 0 || searchTerm ? filteredClients : clients;
    return [...dataToDisplay].sort((a, b) => a.clientId.localeCompare(b.clientId));
  }, [clients, filteredClients, searchTerm]);

  const exportToExcel = () => {
    // Sort data by Client ID in ascending order before export
    const sortedData = [...(filteredClients.length > 0 ? filteredClients : clients)].sort((a, b) => 
      a.clientId.localeCompare(b.clientId)
    );
    
    if (sortedData.length === 0) {
      toast({
        title: "❌ No Data to Export",
        description: "There are no clients to export.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    const headers = [
      'Client ID', 'Firm Name', 'Authorized Person', 'Firm Type', 'Company Address',
      'Contact Number', 'PAN Number', 'GST Number', 'Aadhar Number', 'Email',
      'Landline', 'Alternate Number', 'Created Date'
    ];

    // Create CSV content with proper Excel formatting
    const csvData = [
      headers,
      ...sortedData.map(client => [
        client.clientId,
        client.firmName,
        client.authorizedPersonName,
        client.firmType,
        client.companyAddress,
        client.contactNumber,
        client.panNumber,
        client.gstNumber,
        client.aadharNumber || '',
        client.email || '',
        client.landline || '',
        client.alternateNumber || '',
        client.createdAt ? new Date(client.createdAt).toLocaleDateString() : ''
      ])
    ];

    // Convert to proper CSV format
    const csvContent = csvData.map(row => 
      row.map(cell => {
        // Escape cells that contain commas, quotes, or line breaks
        const cellString = String(cell || '');
        if (cellString.includes(',') || cellString.includes('"') || cellString.includes('\n') || cellString.includes('\r')) {
          return `"${cellString.replace(/"/g, '""')}"`;
        }
        return cellString;
      }).join(',')
    ).join('\r\n');

    // Add BOM for proper Excel UTF-8 handling
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "✅ Export Successful",
      description: `${sortedData.length} clients exported to CSV file (Excel compatible).`,
      className: "bg-green-100 border-green-500 text-green-700",
      duration: 3000,
    });
  };

  // Generate unique client ID
  const generateClientId = () => {
    if (clients.length === 0) {
      return 'CC-0001';
    }
    
    // Extract numbers from existing client IDs and find the highest
    const existingNumbers = clients
      .map(client => client.clientId)
      .filter(id => id && id.startsWith('CC-'))
      .map(id => parseInt(id.split('-')[1]))
      .filter(num => !isNaN(num));
    
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;
    
    return `CC-${nextNumber.toString().padStart(4, '0')}`;
  };

  // Check if PAN number is unique
  const isPanNumberUnique = (panNumber: string, excludeId?: string) => {
    const panLower = panNumber.toLowerCase().trim();
    return !clients.some(client => 
      client.panNumber.toLowerCase() === panLower && client.id !== excludeId
    );
  };

  const isGstNumberUnique = (gstNumber: string, excludeId?: string) => {
    const gstLower = gstNumber.toLowerCase().trim();
    return !clients.some(client => 
      client.gstNumber.toLowerCase() === gstLower && client.id !== excludeId
    );
  };

  const handleInputChange = (field: keyof ClientData, value: string) => {
    // Contact Number Validation - Indian mobile number
    if (field === 'contactNumber') {
      // Allow only digits
      const digitsOnly = value.replace(/\D/g, '');
      
      // Limit to 10 digits
      const limitedDigits = digitsOnly.slice(0, 10);
      
      // Validate Indian mobile number format (starts with 6, 7, 8, or 9)
      if (limitedDigits.length > 0 && !/^[6-9]/.test(limitedDigits)) {
        toast({
          title: "❌ Invalid Mobile Number",
          description: "Indian mobile numbers should start with 6, 7, 8, or 9",
          variant: "destructive",
          duration: 2000,
        });
        return;
      }
      
      setFormData(prev => ({ ...prev, [field]: limitedDigits }));
      return;
    }
    
    // PAN Number Validation
    if (field === 'panNumber') {
      const upperValue = value.toUpperCase();
      
      // Allow only alphanumeric characters and limit to 10
      const cleanValue = upperValue.replace(/[^A-Z0-9]/g, '').slice(0, 10);
      
      // Real-time format validation
      if (cleanValue.length > 0) {
        // First 5 characters should be letters
        if (cleanValue.length <= 5 && !/^[A-Z]*$/.test(cleanValue)) {
          toast({
            title: "💡 PAN Format Tip",
            description: "First 5 characters should be letters (e.g., ABCDE)",
            variant: "default",
            duration: 2000,
          });
        }
        
        // Characters 6-9 should be digits
        if (cleanValue.length > 5 && cleanValue.length <= 9) {
          const digitsPart = cleanValue.slice(5);
          if (!/^\d*$/.test(digitsPart)) {
            toast({
              title: "💡 PAN Format Tip",
              description: "Characters 6-9 should be digits (e.g., 1234)",
              variant: "default",
              duration: 2000,
            });
          }
        }
        
        // 10th character should be a letter
        if (cleanValue.length === 10 && !/^[A-Z]{5}\d{4}[A-Z]$/.test(cleanValue)) {
          toast({
            title: "💡 PAN Format Tip",
            description: "Last character should be a letter (e.g., F)",
            variant: "default",
            duration: 2000,
          });
        }
        
        // Check uniqueness when PAN is complete and valid
        if (cleanValue.length === 10 && /^[A-Z]{5}\d{4}[A-Z]$/.test(cleanValue)) {
          if (!isPanNumberUnique(cleanValue, editingId ?? undefined)) {
            toast({
              title: "⚠️ PAN Already Exists",
              description: "This PAN number is already registered with another firm",
              variant: "destructive",
              duration: 3000,
            });
          }
        }
      }
      
      setFormData(prev => ({ ...prev, [field]: cleanValue }));
      return;
    }
    
    // GST Number Validation
    if (field === 'gstNumber') {
      const upperValue = value.toUpperCase();
      
      // Allow only alphanumeric characters and limit to 15
      const cleanValue = upperValue.replace(/[^A-Z0-9]/g, '').slice(0, 15);
      
      // Real-time format validation for GST
      if (cleanValue.length > 0) {
        // First 2 digits should be state code (numbers)
        if (cleanValue.length <= 2 && !/^\d*$/.test(cleanValue)) {
          toast({
            title: "💡 GST Format Tip",
            description: "First 2 characters should be state code digits (e.g., 27)",
            variant: "default",
            duration: 2000,
          });
        }
        
        // Characters 3-12 should be PAN format
        if (cleanValue.length > 2 && cleanValue.length <= 12) {
          const panPart = cleanValue.slice(2);
          if (panPart.length === 10 && !/^[A-Z]{5}\d{4}[A-Z]$/.test(panPart)) {
            toast({
              title: "💡 GST Format Tip",
              description: "Characters 3-12 should follow PAN format",
              variant: "default",
              duration: 2000,
            });
          }
        }
        
        // Check uniqueness when GST is complete and valid
        if (cleanValue.length === 15 && /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]{3}$/.test(cleanValue)) {
          if (!isGstNumberUnique(cleanValue, editingId ?? undefined)) {
            toast({
              title: "⚠️ GST Already Exists",
              description: "This GST number is already registered with another firm",
              variant: "destructive",
              duration: 3000,
            });
          }
        }
      }
      
      setFormData(prev => ({ ...prev, [field]: cleanValue }));
      return;
    }
    
    // Aadhar Number Validation (optional field)
    if (field === 'aadharNumber') {
      // Allow only digits
      const digitsOnly = value.replace(/\D/g, '');
      
      // Limit to 12 digits
      const limitedDigits = digitsOnly.slice(0, 12);
      
      setFormData(prev => ({ ...prev, [field]: limitedDigits }));
      return;
    }
    
    // Landline validation
    if (field === 'landline') {
      // Allow digits, spaces, hyphens, and parentheses for landline format
      const cleanValue = value.replace(/[^\d\s\-\(\)]/g, '');
      setFormData(prev => ({ ...prev, [field]: cleanValue }));
      return;
    }
    
    // Alternate number validation (same as contact number)
    if (field === 'alternateNumber') {
      // Allow only digits
      const digitsOnly = value.replace(/\D/g, '');
      
      // Limit to 10 digits
      const limitedDigits = digitsOnly.slice(0, 10);
      
      // Validate Indian mobile number format if not empty
      if (limitedDigits.length > 0 && limitedDigits.length === 10 && !/^[6-9]/.test(limitedDigits)) {
        toast({
          title: "❌ Invalid Mobile Number",
          description: "Indian mobile numbers should start with 6, 7, 8, or 9",
          variant: "destructive",
          duration: 2000,
        });
        return;
      }
      
      setFormData(prev => ({ ...prev, [field]: limitedDigits }));
      return;
    }
    
    // Default behavior for other fields
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (files: FileList) => {
    setIsUploading(true);
    const newUploadedFiles: {name: string, type: string, url?: string}[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        // Show uploading toast
        toast({
          title: "📤 Uploading...",
          description: `Uploading ${file.name} to cloud storage...`,
          className: "bg-blue-100 border-blue-500 text-blue-700",
          duration: 3000,
        });

        // Upload to Cloudinary
        const uploadResult = await uploadToCloudinary(file);
        
        const fileInfo = {
          name: file.name,
          type: file.type.includes('image') ? 'Document Image' : 'Document',
          url: uploadResult.secure_url
        };
        
        newUploadedFiles.push(fileInfo);
        
        // Show individual file upload success popup
        toast({
          title: "✅ File Uploaded!",
          description: `${file.name} has been successfully uploaded to cloud storage.`,
          className: "bg-green-100 border-green-500 text-green-700",
          duration: 2000,
        });
        
        // Small delay between file notifications
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error('Upload error:', error);
        toast({
          title: "❌ Upload Failed",
          description: `Failed to upload ${file.name}. Please check your connection and try again.`,
          variant: "destructive",
          duration: 4000,
        });
      }
    }
    
    setUploadedFiles(prev => [...prev, ...newUploadedFiles]);
    setIsUploading(false);
  };

  const handleRemoveFile = (index: number) => {
    const fileToRemove = uploadedFiles[index];
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    
    toast({
      title: "🗑️ File Removed",
      description: `${fileToRemove.name} has been removed from attachments.`,
      className: "bg-orange-100 border-orange-500 text-orange-700",
      duration: 2000,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Comprehensive field validations before submission
    
    // Contact Number validation
    if (!formData.contactNumber || formData.contactNumber.length !== 10) {
      toast({
        title: "❌ Invalid Contact Number",
        description: "Please enter a valid 10-digit Indian mobile number",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    
    if (!/^[6-9]\d{9}$/.test(formData.contactNumber)) {
      toast({
        title: "❌ Invalid Contact Number Format",
        description: "Contact number should be 10 digits starting with 6, 7, 8, or 9",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    
    // PAN Number validation
    if (!formData.panNumber || formData.panNumber.length !== 10) {
      toast({
        title: "❌ Invalid PAN Number",
        description: "PAN number must be exactly 10 characters long",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    
    if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(formData.panNumber)) {
      toast({
        title: "❌ Invalid PAN Number Format",
        description: "PAN format should be: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }
    
    // GST Number validation
    if (!formData.gstNumber || formData.gstNumber.length !== 15) {
      toast({
        title: "❌ Invalid GST Number",
        description: "GST number must be exactly 15 characters long",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]{3}$/.test(formData.gstNumber)) {
      toast({
        title: "❌ Invalid GST Number Format",
        description: "GST format should be: 2 state digits + 10 PAN characters + 3 additional characters",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }
    
    // Aadhar validation (if provided)
    if (formData.aadharNumber && formData.aadharNumber.length > 0) {
      if (formData.aadharNumber.length !== 12 || !/^\d{12}$/.test(formData.aadharNumber)) {
        toast({
          title: "❌ Invalid Aadhar Number",
          description: "Aadhar number should be exactly 12 digits",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }
    }
    
    // Alternate number validation (if provided)
    if (formData.alternateNumber && formData.alternateNumber.length > 0) {
      if (formData.alternateNumber.length !== 10 || !/^[6-9]\d{9}$/.test(formData.alternateNumber)) {
        toast({
          title: "❌ Invalid Alternate Number",
          description: "Alternate number should be a valid 10-digit Indian mobile number",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }
    }
    
    // Enhanced validation for file upload requirement
    if (uploadedFiles.length === 0) {
      toast({
        title: "❌ Document Required",
        description: "At least one document must be uploaded before submitting. Please attach PAN card, Aadhar card, or other relevant documents.",
        variant: "destructive",
        duration: 5000,
      });
      
      // Scroll to file upload section
      const fileSection = document.querySelector('#document-upload-section');
      if (fileSection) {
        fileSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Ensure all uploaded files have valid URLs
    const validFiles = uploadedFiles.filter(file => file.url);
    if (validFiles.length === 0) {
      toast({
        title: "❌ File Upload Incomplete",
        description: "Some files failed to upload properly. Please remove and re-upload the documents.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    // Validate PAN uniqueness - each firm must have unique PAN
    if (!isPanNumberUnique(formData.panNumber, editingId ?? undefined)) {
      toast({
        title: "❌ PAN Number Already Exists",
        description: "This PAN number is already registered with another firm. Each firm must have a unique PAN number.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }
    
    // Validate GST uniqueness - each firm must have unique GST
    if (!isGstNumberUnique(formData.gstNumber, editingId ?? undefined)) {
      toast({
        title: "❌ GST Number Already Exists",
        description: "This GST number is already registered with another firm. Each firm must have a unique GST number.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const clientData = {
        ...formData,
        documentUrls: validFiles.map(file => file.url),
        createdAt: isEditing ? formData.createdAt : new Date().toISOString(),
      };

      if (isEditing && editingId) {
        await updateDoc(doc(db, 'clients', editingId), clientData);
        setSuccessMessage({
          title: "Client Updated Successfully! 🎉",
          description: `${formData.firmName} (${formData.clientId}) has been updated in the system. All information has been saved and is now available in the client database.`
        });
      } else {
        // Generate unique client ID for new clients
        const newClientId = generateClientId();
        const newClientData = { ...clientData, clientId: newClientId };
        
        await addDoc(collection(db, 'clients'), newClientData);
        setSuccessMessage({
          title: "New Client Added Successfully! 🎉",
          description: `${formData.firmName} has been registered with Client ID: ${newClientId}. The client information is now saved and can be accessed from the client database.`
        });
      }

      // Show success modal
      setShowSuccessModal(true);

      // Close the add client modal and reset form
      setShowAddClientModal(false);
      setFormData({
        clientId: '',
        firmName: '',
        authorizedPersonName: '',
        firmType: '',
        companyAddress: '',
        contactNumber: '',
        panNumber: '',
        gstNumber: '',
        aadharNumber: '',
        email: '',
        landline: '',
        alternateNumber: '',
      });
      setIsEditing(false);
      setEditingId(null);
      setUploadedFiles([]);
      loadClients();
      
      // Auto close modal after 4 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 4000);
      
    } catch (error) {
      toast({
        title: "❌ Error Occurred",
        description: "Failed to save client information. Please check your connection and try again.",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (client: ClientData) => {
    setFormData(client);
    setIsEditing(true);
    setEditingId(client.id || null);
    
    // Load existing documents for editing
    if (client.documentUrls && client.documentUrls.length > 0) {
      const existingFiles = client.documentUrls.map((url, index) => ({
        name: `Document ${index + 1}`,
        type: 'Existing Document',
        url: url
      }));
      setUploadedFiles(existingFiles);
    }
    
    setShowAddClientModal(true);
  };

  const handleAddNewClient = () => {
    // Reset form for new client
    setFormData({
      clientId: '',
      firmName: '',
      authorizedPersonName: '',
      firmType: '',
      companyAddress: '',
      contactNumber: '',
      panNumber: '',
      gstNumber: '',
      aadharNumber: '',
      email: '',
      landline: '',
      alternateNumber: '',
    });
    setIsEditing(false);
    setEditingId(null);
    setUploadedFiles([]);
    setShowAddClientModal(true);
  };

  const handleCloseModal = () => {
    setShowAddClientModal(false);
    setIsEditing(false);
    setEditingId(null);
    setUploadedFiles([]);
    setFormData({
      clientId: '',
      firmName: '',
      authorizedPersonName: '',
      firmType: '',
      companyAddress: '',
      contactNumber: '',
      panNumber: '',
      gstNumber: '',
      aadharNumber: '',
      email: '',
      landline: '',
      alternateNumber: '',
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'clients', id));
      setSuccessMessage({
        title: "Client Deleted Successfully! 🗑️",
        description: "The client has been permanently removed from the database. This action cannot be undone."
      });
      setShowSuccessModal(true);
      setDeleteId(null);
      loadClients();
      
      // Auto close modal after 3 seconds for delete
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 3000);
      
    } catch (error) {
      toast({
        title: "❌ Delete Failed",
        description: "Failed to delete client. Please check your connection and try again.",
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  // Allow both admin and checker roles to access this page
  if (user?.role !== 'admin' && user?.role !== 'checker') return null;

  const displayClients = filteredClients.length > 0 || searchTerm ? filteredClients : clients;

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-8">
        {/* Header with Back Button and Centered Title */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <button 
            onClick={() => router.back()}
            className="text-base sm:text-lg font-semibold tracking-tight bg-orange-500 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-orange-600 transition-colors whitespace-nowrap w-full sm:w-auto"
          >
            ← Dashboard
          </button>
          
          {/* Centered Title with Light Orange Background */}
          <div className="flex-1 text-center w-full sm:w-auto">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-orange-600 inline-block border-b-4 border-green-500 pb-2 px-4 sm:px-6 py-2 sm:py-3 bg-orange-100 rounded-lg">
              Client Module
            </h1>
          </div>
          
          {/* Add Client Button */}
          <Button
            onClick={handleAddNewClient}
            className="bg-green-500 hover:bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3 shadow-lg text-sm sm:text-base w-full sm:w-auto"
          >
            ✅ Add New Client
          </Button>
        </div>

        {/* Search and Export Section */}
        <Card className="border-green-300">
          <CardHeader className="bg-green-50 p-3 sm:p-4">
            <CardTitle className="text-base sm:text-lg text-green-700">Search & Export Options</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center space-x-2 flex-1 min-w-[300px]">
                <Search className="w-4 h-4 text-green-600" />
                <Label htmlFor="searchTerm" className="text-green-600 font-medium whitespace-nowrap">Search:</Label>
                <Input
                  id="searchTerm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by firm name, PAN number, or Client ID..."
                  className="border-green-300 focus:border-green-500 flex-1"
                />
                {searchTerm && (
                  <Button
                    onClick={() => setSearchTerm('')}
                    variant="outline"
                    size="sm"
                    className="border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              
              <Button
                onClick={exportToExcel}
                className="bg-blue-500 hover:bg-blue-600 text-white whitespace-nowrap"
              >
                <Download className="w-4 h-4 mr-2" />
                EXPORT CSV
              </Button>
            </div>
            
            {searchTerm && (
              <div className="mt-3 text-sm text-green-600">
                {filteredClients.length} clients found for "{searchTerm}"
              </div>
            )}
          </CardContent>
        </Card>

        {/* Entry Count Display */}
        <div className="w-full py-2">
          <div className="flex justify-start">
            <div className="bg-blue-50 border-2 border-blue-500 px-4 py-2 rounded-lg shadow-sm">
              <span className="text-lg font-semibold text-blue-800">
                📊 Total Clients: {tableData?.length || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Client Table with DataTable */}
        <Card className="border-green-300">
          <CardHeader className="bg-green-50">
            <CardTitle className="text-green-700 text-xl text-left">Client Module Table</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <DataTable
              columns={clientColumns}
              data={tableData}
              isLoading={false}
              wrapperClassName="border-green-300"
              headClassName="bg-orange-100 text-orange-600 font-bold text-center text-xs sm:text-sm"
              cellClassName="text-green-800 text-center text-xs sm:text-sm"
              stickyHeader={true}
              stickyFirstColumn={true}
              showGridLines={true}
            />
          </CardContent>
        </Card>

        {/* Add/Edit Client Modal */}
        <Dialog open={showAddClientModal} onOpenChange={setShowAddClientModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-orange-300">
            <DialogHeader>
              <DialogTitle className="text-orange-700 text-xl flex items-center gap-2">
                {isEditing ? '🔄 Edit Client' : '✅ Add New Client'}
              </DialogTitle>
              <DialogDescription className="text-green-600">
                {isEditing ? 'Update client information and documentation' : 'Enter client information '}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Required Fields */}
                <div className="space-y-2">
                  <Label htmlFor="firmName" className="text-green-600 font-medium">
                    Name of Firm <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="firmName"
                    value={formData.firmName}
                    onChange={(e) => handleInputChange('firmName', e.target.value)}
                    className="border-orange-300 focus:border-orange-500 text-orange-700"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="authorizedPersonName" className="text-green-600 font-medium">
                    Authorized Person Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="authorizedPersonName"
                    value={formData.authorizedPersonName}
                    onChange={(e) => handleInputChange('authorizedPersonName', e.target.value)}
                    className="border-orange-300 focus:border-orange-500 text-orange-700"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="firmType" className="text-green-600 font-medium">
                    Type of Firm <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.firmType}
                    onValueChange={(value) => handleInputChange('firmType', value)}
                    required
                  >
                    <SelectTrigger className="border-orange-300 focus:border-orange-500 text-orange-700 [&>span]:text-orange-700">
                      <SelectValue 
                        placeholder="Select firm type" 
                        className="text-orange-700"
                      />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem 
                        value="Sole Proprietorship" 
                        className="!text-orange-700 hover:!bg-orange-50 focus:!bg-orange-50 hover:!text-orange-700 focus:!text-orange-700 data-[highlighted]:!text-orange-700 data-[highlighted]:!bg-orange-50"
                        style={{ color: '#c2410c !important' }}
                      >
                        Sole Proprietorship
                      </SelectItem>
                      <SelectItem 
                        value="Partnership" 
                        className="!text-orange-700 hover:!bg-orange-50 focus:!bg-orange-50 hover:!text-orange-700 focus:!text-orange-700 data-[highlighted]:!text-orange-700 data-[highlighted]:!bg-orange-50"
                        style={{ color: '#c2410c !important' }}
                      >
                        Partnership
                      </SelectItem>
                      <SelectItem 
                        value="Hindu Undivided Family (HUF)" 
                        className="!text-orange-700 hover:!bg-orange-50 focus:!bg-orange-50 hover:!text-orange-700 focus:!text-orange-700 data-[highlighted]:!text-orange-700 data-[highlighted]:!bg-orange-50"
                        style={{ color: '#c2410c !important' }}
                      >
                        Hindu Undivided Family (HUF)
                      </SelectItem>
                      <SelectItem 
                        value="Company" 
                        className="!text-orange-700 hover:!bg-orange-50 focus:!bg-orange-50 hover:!text-orange-700 focus:!text-orange-700 data-[highlighted]:!text-orange-700 data-[highlighted]:!bg-orange-50"
                        style={{ color: '#c2410c !important' }}
                      >
                        Company
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="companyAddress" className="text-green-600 font-medium">
                    Company Address <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="companyAddress"
                    value={formData.companyAddress}
                    onChange={(e) => handleInputChange('companyAddress', e.target.value)}
                    className="border-orange-300 focus:border-orange-500 text-orange-700"
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactNumber" className="text-green-600 font-medium">
                    Contact Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="contactNumber"
                    value={formData.contactNumber}
                    onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                    className="border-orange-300 focus:border-orange-500 text-orange-700"
                    placeholder="e.g., 9876543210"
                    maxLength={10}
                    required
                  />
                  <p className="text-xs text-orange-600 mt-1">
                    10-digit Indian mobile number starting with 6, 7, 8, or 9 (can be shared between firms)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="panNumber" className="text-green-600 font-medium">
                    PAN Card Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="panNumber"
                    value={formData.panNumber}
                    onChange={(e) => handleInputChange('panNumber', e.target.value)}
                    className="border-orange-300 focus:border-orange-500 text-orange-700"
                    placeholder="e.g., ABCDE1234F"
                    maxLength={10}
                    required
                  />
                  <p className="text-xs text-orange-600 mt-1">
                    Format: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F) - Must be unique per firm
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gstNumber" className="text-green-600 font-medium">
                    GST Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="gstNumber"
                    value={formData.gstNumber}
                    onChange={(e) => handleInputChange('gstNumber', e.target.value)}
                    className="border-orange-300 focus:border-orange-500 text-orange-700"
                    placeholder="e.g., 27ABCDE1234F1Z5"
                    maxLength={15}
                    required
                  />
                  <p className="text-xs text-orange-600 mt-1">
                    Format: 2 state digits + 10 PAN chars + 3 additional chars - Must be unique per firm
                  </p>
                </div>

                {/* Optional Fields */}
                <div className="space-y-2">
                  <Label htmlFor="aadharNumber" className="text-green-600 font-medium">
                    Aadhar Card No (Optional)
                  </Label>
                  <Input
                    id="aadharNumber"
                    value={formData.aadharNumber}
                    onChange={(e) => handleInputChange('aadharNumber', e.target.value)}
                    className="border-green-300 focus:border-green-500 text-orange-700"
                    placeholder="e.g., 123456789012"
                    maxLength={12}
                  />
                  <p className="text-xs text-green-600 mt-1">
                    12-digit Aadhar number (if provided)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-green-600 font-medium">
                    Email (Optional)
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="border-green-300 focus:border-green-500 text-orange-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="landline" className="text-green-600 font-medium">
                    Landline (Optional)
                  </Label>
                  <Input
                    id="landline"
                    value={formData.landline}
                    onChange={(e) => handleInputChange('landline', e.target.value)}
                    className="border-green-300 focus:border-green-500 text-orange-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alternateNumber" className="text-green-600 font-medium">
                    Alternate Number (Optional)
                  </Label>
                  <Input
                    id="alternateNumber"
                    value={formData.alternateNumber}
                    onChange={(e) => handleInputChange('alternateNumber', e.target.value)}
                    className="border-green-300 focus:border-green-500 text-orange-700"
                    placeholder="e.g., 9876543210"
                    maxLength={10}
                  />
                  <p className="text-xs text-green-600 mt-1">
                    10-digit mobile number (if provided, can be shared between firms)
                  </p>
                </div>
              </div>

              {/* File Upload Section */}
              <div id="document-upload-section" className="space-y-4">
                <h3 className="text-lg font-semibold text-orange-600">Document Upload <span className="text-red-500">*</span></h3>
                <div className="space-y-3">
                  <div className="flex flex-col space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-orange-300 text-orange-600 hover:bg-orange-50 w-fit"
                      onClick={() => document.getElementById('fileUpload')?.click()}
                      disabled={isUploading}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {isUploading ? 'Uploading...' : 'Attach Documents'}
                    </Button>
                    <input
                      id="fileUpload"
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) {
                          handleFileUpload(files);
                        }
                      }}
                    />
                    {uploadedFiles.length === 0 && !isUploading && (
                      <div className="text-sm">
                        <span className="text-green-600">
                          You can attach PAN card, Aadhar card, or other relevant documents
                        </span>
                        <br />
                        <span className="text-red-600 font-medium">
                          ⚠️ At least one file is required to proceed
                        </span>
                      </div>
                    )}
                    {isUploading && (
                      <span className="text-sm text-blue-600">
                        📤 Uploading files to cloud storage...
                      </span>
                    )}
                  </div>
                  
                  {/* Show uploaded files */}
                  {uploadedFiles.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <h4 className="text-sm font-medium text-green-700 mb-2">Attached Files:</h4>
                      <div className="space-y-1">
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between space-x-2 text-sm text-green-600">
                            <div className="flex items-center space-x-2 flex-1">
                              <FileImage className="w-4 h-4" />
                              <span className="truncate">{file.name}</span>
                              <span className="text-xs text-green-500">({file.type})</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              {file.url && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="border-blue-300 text-blue-600 hover:bg-blue-50 h-6 w-6 p-0"
                                  onClick={() => window.open(file.url, '_blank')}
                                  title="View Document"
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-red-300 text-red-600 hover:bg-red-50 h-6 w-6 p-0"
                                onClick={() => handleRemoveFile(index)}
                                title="Remove Document"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer with Buttons */}
              <div className="flex justify-end space-x-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-300 text-gray-600 hover:bg-gray-50"
                  onClick={handleCloseModal}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting 
                    ? (isEditing ? '🔄 Updating...' : '⏳ Adding Client...') 
                    : (isEditing ? '🔄 Update Client' : '✅ Add Client')
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Success Modal */}
        <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
          <DialogContent className="border-green-300 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-green-700 flex items-center gap-3 text-xl">
                <CheckCircle className="w-6 h-6 text-green-500" />
                {successMessage.title}
              </DialogTitle>
              <DialogDescription className="text-gray-700 mt-3 text-base leading-relaxed">
                {successMessage.description}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end mt-6">
              <Button 
                onClick={() => setShowSuccessModal(false)}
                className="bg-green-500 hover:bg-green-600 text-white px-6"
              >
                ✅ Got it!
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
} 