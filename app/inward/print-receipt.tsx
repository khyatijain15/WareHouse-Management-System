import React, { useRef } from 'react';
import StorageReceipt from '@/components/StorageReceipt';
import TestCertificate from '@/components/TestCertificate';
import { Button } from '@/components/ui/button';

// Mock data for demonstration; replace with real data fetching as needed
const mockData = {
  srNo: 'SR-001',
  srGenerationDate: '01-07-2024',
  dateOfIssue: '01-07-2024',
  baseReceiptNo: 'BR-123',
  cadNo: 'CAD-456',
  dateOfDeposit: '01-07-2024',
  branch: 'Main Branch',
  warehouseName: 'Agrogreen Warehouse',
  warehouseAddress: '123 Main St, Indore',
  client: 'John Doe',
  clientAddress: '456 Client Rd, Indore',
  commodity: 'Wheat',
  totalBags: '100',
  netWeight: '5000',
  grade: 'A',
  remarks: 'No remarks',
  marketRate: '2000',
  valueOfCommodity: '10000000',
  hologramNumber: 'H123456',
  insuranceDetails: [
    {
      policyNo: 'P-789',
      company: 'ABC Insurance',
      validFrom: '01-07-2024',
      validTo: '01-07-2025',
      sumInsured: '1000000',
    },
  ],
  bankName: 'SBI',
  date: '01-07-2024',
  place: 'Indore',
  stockInwardDate: '01-07-2024',
  receiptType: 'SR',
  varietyName: 'Lokwan',
  dateOfSampling: '01-07-2024',
  dateOfTesting: '02-07-2024',
};

const mockQualityParameters = [
  { name: 'Moisture', minPercentage: '10', maxPercentage: '12', actual: '11' },
  { name: 'Protein', minPercentage: '8', maxPercentage: '10', actual: '9' },
];

export default function PrintReceiptPage() {
  const printRef = useRef<HTMLDivElement | null>(null);
  const testCertRef = useRef<HTMLDivElement | null>(null);

  const handlePrint = async () => {
    if (!printRef.current || !testCertRef.current) return;
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;
    await new Promise((resolve) => setTimeout(resolve, 300));
    const canvas1 = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#fff' });
    const imgData1 = canvas1.toDataURL('image/png');
    const canvas2 = await html2canvas(testCertRef.current, { scale: 2, useCORS: true, backgroundColor: '#fff' });
    const imgData2 = canvas2.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const pageHeight = 295;
    const imgHeight1 = (canvas1.height * imgWidth) / canvas1.width;
    pdf.addImage(imgData1, 'PNG', 0, 0, imgWidth, imgHeight1 > pageHeight ? pageHeight : imgHeight1);
    pdf.addPage();
    const imgHeight2 = (canvas2.height * imgWidth) / canvas2.width;
    pdf.addImage(imgData2, 'PNG', 0, 0, imgWidth, imgHeight2 > pageHeight ? pageHeight : imgHeight2);
    pdf.save('storage-receipt-and-test-certificate.pdf');
  };

  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="flex justify-end mb-4">
        <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2">
          Print Receipt
        </Button>
      </div>
      <div className="space-y-8">
        <div ref={printRef}>
          <StorageReceipt data={mockData} />
        </div>
        <div ref={testCertRef}>
          <TestCertificate
            client={mockData.client}
            clientAddress={mockData.clientAddress}
            commodity={mockData.commodity}
            varietyName={mockData.varietyName}
            warehouseName={mockData.warehouseName}
            warehouseAddress={mockData.warehouseAddress}
            totalBags={mockData.totalBags}
            dateOfSampling={mockData.dateOfSampling}
            dateOfTesting={mockData.dateOfTesting}
            qualityParameters={mockQualityParameters}
          />
        </div>
      </div>
    </div>
  );
} 