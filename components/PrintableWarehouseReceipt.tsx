import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PrintableWarehouseReceiptProps {
  selectedRowForSR: any;
  hologramNumber: string;
  srGenerationDate: string;
  getSelectedVarietyParticulars: () => any[];
  inspectionInsuranceData?: any[];
}

const PrintableWarehouseReceipt: React.FC<PrintableWarehouseReceiptProps> = ({
  selectedRowForSR,
  hologramNumber,
  srGenerationDate,
  getSelectedVarietyParticulars,
  inspectionInsuranceData = []
}) => {
  const particulars = getSelectedVarietyParticulars();
  
  // Get clientAddress from matched insurance entry
  const getClientAddress = () => {
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
  };

  // Resolve matched insurance item once for reuse
  const getMatchedInsurance = () => {
    const sel = selectedRowForSR?.selectedInsurance;
    let matched: any = null;
    try {
      if (sel && inspectionInsuranceData && inspectionInsuranceData.length) {
        matched =
          inspectionInsuranceData.find(
            (i: any) =>
              i.insuranceId === sel.insuranceId &&
              i.insuranceTakenBy === sel.insuranceTakenBy
          ) || null;
      }
    } catch (e) {
      matched = null;
    }
    return matched || inspectionInsuranceData[0] || null;
  };

  // Helper to find actual lab result by parameter name or index
  const getActualLabResult = (name: string, index: number) => {
    const list: any[] = selectedRowForSR?.labResults || [];
    if (!list?.length) return '';
    const byName = list.find((lr: any) => lr?.parameterName === name);
    if (byName) return byName?.actual ?? byName?.value ?? '';
    const byIndex = list[index];
    return byIndex?.actual ?? byIndex?.value ?? '';
};
  const matchedInsurance = getMatchedInsurance();

  // Calculate Validity End Date based on insurance data
  const getValidityEndDate = () => {
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
      }
    }
    
    if (insurance) {
      // If insurance taken by bank, Fire Policy End Date + 9 months
      if (insurance.insuranceTakenBy === 'bank' || insurance.insuranceTakenBy === 'bank-funded') {
        if (insurance.firePolicyEndDate) {
          const fireEndDate = new Date(insurance.firePolicyEndDate);
          fireEndDate.setMonth(fireEndDate.getMonth() + 9);
          return fireEndDate.toISOString().slice(0, 10);
        }
      } else {
        // For all other insurance types, use fire policy end date
        if (insurance.firePolicyEndDate) {
          // Normalize date
          let dateStr = insurance.firePolicyEndDate;
          if (typeof dateStr === 'string' && dateStr.includes('T')) {
            dateStr = dateStr.slice(0, 10);
          } else if (dateStr instanceof Date) {
            dateStr = dateStr.toISOString().slice(0, 10);
          } else if (dateStr && typeof dateStr.toDate === 'function') {
            dateStr = dateStr.toDate().toISOString().slice(0, 10);
          }
          return typeof dateStr === 'string' ? dateStr : String(dateStr);
        }
      }
    }
    
    // If no insurance found, return empty string
    return '';
  };

  // Common input style: slightly more top bias and tighter line height to avoid clipping in PDF
  const inputBaseStyle: React.CSSProperties = {
    backgroundColor: '#f9f9f9',
    border: '1px solid #d1d5db',
    padding: '6px 12px 4px 12px',
    lineHeight: 1.1,
  };

  // Robust number-to-words (Indian system) helper
  const numberToWordsIndian = (num: number) => {
    if (isNaN(num as any)) return '';
    if (num === 0) return 'zero';
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
      'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const toWordsBelowThousand = (n: number) => {
      let s = '';
      const hundred = Math.floor(n / 100);
      const rest = n % 100;
      if (hundred) s += ones[hundred] + ' hundred';
      if (rest) {
        if (s) s += ' ';
        if (rest < 20) s += ones[rest];
        else {
          s += tens[Math.floor(rest / 10)];
          if (rest % 10) s += '-' + ones[rest % 10];
        }
      }
      return s.trim();
    };
    // Indian groups: crore, lakh, thousand, hundred
    const crore = Math.floor(num / 10000000);
    num %= 10000000;
    const lakh = Math.floor(num / 100000);
    num %= 100000;
    const thousand = Math.floor(num / 1000);
    num %= 1000;
    const rest = Math.floor(num);
    const parts: string[] = [];
    if (crore) parts.push(toWordsBelowThousand(crore) + ' crore');
    if (lakh) parts.push(toWordsBelowThousand(lakh) + ' lakh');
    if (thousand) parts.push(toWordsBelowThousand(thousand) + ' thousand');
    if (rest) parts.push(toWordsBelowThousand(rest));
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  };

  // Compute Value of Commodities (in words)
  const parseNum = (x: any) => {
    if (x === null || x === undefined) return NaN;
    const n = typeof x === 'string' ? x.replace(/[^0-9.\-]/g, '') : x;
    return parseFloat(n as any);
  };
  const qty = parseNum(selectedRowForSR?.totalQuantity);
  const rate = parseNum(selectedRowForSR?.marketRate);
  const explicitValue = parseNum((selectedRowForSR as any)?.valueOfCommodities ?? (selectedRowForSR as any)?.totalValue);
  const computedValue = !isNaN(explicitValue) ? explicitValue : (!isNaN(qty) && !isNaN(rate) ? qty * rate : NaN);
  const valueWords = !isNaN(computedValue)
    ? `Rupees ${numberToWordsIndian(Math.round(computedValue))} only`
    : '';

  return (
    <div style={{ 
      width: '794px',
      maxWidth: '794px', 
      margin: '0 auto',
      backgroundColor: 'white',
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      lineHeight: '1.4'
    }}>
      {/* Header Section */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '32px',
        marginTop: '8px'
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src="/Group 86.png" 
          alt="Agrogreen Logo" 
          style={{ 
            width: '120px', 
            height: '100px', 
            marginBottom: '8px', 
            borderRadius: '30%', 
            objectFit: 'cover' 
          }} 
        />
        <div style={{
          fontSize: '18px',
          fontWeight: '800',
          color: '#ea580c',
          marginTop: '8px',
          marginBottom: '8px',
          textAlign: 'center',
          letterSpacing: '0.02em'
        }}>
          AGROGREEN WAREHOUSING PRIVATE LTD.
        </div>
        <div style={{
          fontSize: '16px',
          fontWeight: '600',
          color: '#16a34a',
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          603, 6th Floor, Princess Business Skyline, Indore, Madhya Pradesh - 452010
        </div>
        <div style={{
          fontSize: '14px',
          fontWeight: '700',
          color: '#ea580c',
          textDecoration: 'underline',
          textAlign: 'center',
          marginBottom: '8px',
          letterSpacing: '0.01em'
        }}>
          {selectedRowForSR?.receiptType === 'WR' ? 'Warehouse Receipt' : 'Storage Receipt'}
        </div>
      </div>

      {/* Form Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* First Row */}
        <div style={{ display: 'flex', gap: '16px', breakInside: 'avoid' }}>
          <div style={{ flex: 1 }}>
            <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
              {selectedRowForSR?.receiptType === 'WR' ? 'WR No' : 'SR No'}
            </Label>
            <Input 
              value={selectedRowForSR?.srNo || `${selectedRowForSR?.receiptType === 'WR' ? 'WR' : 'SR'}-${selectedRowForSR?.inwardId || 'XXX'}-${selectedRowForSR?.dateOfInward ? selectedRowForSR.dateOfInward.replace(/-/g, '') : ''}`}
              readOnly 
              style={inputBaseStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
              {selectedRowForSR?.receiptType === 'WR' ? 'WR Generation Date' : 'SR Generation Date'}
            </Label>
            <Input 
              value={srGenerationDate || ''} 
              readOnly
              style={inputBaseStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>CAD No</Label>
            <Input 
              value={selectedRowForSR?.cadNumber || ''} 
              readOnly
              style={inputBaseStyle}
            />
          </div>
        </div>

        {/* Date of Deposit */}
  <div style={{ breakInside: 'avoid' }}>
          <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Date of deposite</Label>
          <Input 
            value={selectedRowForSR?.dateOfInward || ''} 
            readOnly
            style={{ ...inputBaseStyle, width: '300px' }}
          />
        </div>

        {/* Bank Details Section */}
  <div style={{ breakInside: 'avoid' }}>
          <h3 style={{ color: '#16a34a', fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            Bank Details
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Bank Name</Label>
              <Input 
                value={selectedRowForSR?.bankName || selectedRowForSR?.bankFundedBy || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Bank Branch</Label>
              <Input 
                value={selectedRowForSR?.bankBranch || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>IFSC Code</Label>
              <Input 
                value={selectedRowForSR?.ifscCode || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
          </div>
        </div>

        {/* Warehouse Details Section */}
  <div style={{ breakInside: 'avoid' }}>
          <h3 style={{ color: '#ea580c', fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            Warehouse Details
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Warehouse Name</Label>
              <Input 
                value={selectedRowForSR?.warehouseName || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Warehouse Code</Label>
              <Input 
                value={selectedRowForSR?.warehouseCode || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Warehouse Address</Label>
              <Input 
                value={selectedRowForSR?.warehouseAddress || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
          </div>
        </div>

        {/* Client Details Section */}
  <div style={{ breakInside: 'avoid' }}>
          <h3 style={{ color: '#16a34a', fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            Client Details
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Client Name</Label>
              <Input 
                value={selectedRowForSR?.client || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Client Code</Label>
              <Input 
                value={selectedRowForSR?.clientCode || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Client Address</Label>
              <Input 
                value={getClientAddress()} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
          </div>
        </div>

        {/* Commodity Details Section */}
        <div>
          <h3 style={{ color: '#ea580c', fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            Commodity Details
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Commodity</Label>
              <Input 
                value={selectedRowForSR?.commodity || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Variety</Label>
              <Input 
                value={selectedRowForSR?.varietyName || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>No. of Bags/Bales</Label>
              <Input 
                value={selectedRowForSR?.totalBags || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Total Quantity (MT)</Label>
              <Input 
                value={selectedRowForSR?.totalQuantity || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Total Value (Rs/MT)</Label>
              <Input 
                value={selectedRowForSR?.totalValue || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Market Rate (Rs/MT)</Label>
              <Input 
                value={selectedRowForSR?.marketRate || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Base Receipt Number</Label>
              <Input 
                value={selectedRowForSR?.bankReceipt || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Value of Commodities (in words)</Label>
              <Input 
                value={valueWords} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
          </div>
        </div>

        {/* Stock Validity Section */}
        <div>
          <h3 style={{ color: '#ea580c', fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            Stock Validity
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Validity Start Date</Label>
              <Input 
                value={srGenerationDate || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Validity End Date</Label>
              <Input 
                value={getValidityEndDate()} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Hologram No</Label>
            <Input 
              value={hologramNumber || ''} 
              readOnly
              style={{ ...inputBaseStyle, width: '300px' }}
            />
          </div>
        </div>

        {/* QR Sticker Space */}
        <div style={{ 
          border: '2px dashed #d1d5db', 
          width: '200px', 
          height: '100px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: '#6b7280', 
          fontSize: '12px',
          margin: '20px auto'
        }}>
          QR Sticker Space
        </div>

        {/* Reservation & Billing Details Section */}
        {selectedRowForSR?.billingStatus && selectedRowForSR.billingStatus !== '-' && (
          <div style={{ marginTop: '30px' }}>
            <h3 style={{ color: '#ea580c', fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
              {selectedRowForSR.billingStatus === 'Reservation' ? 'Reservation Details' : 'Billing Details'}
            </h3>
            {selectedRowForSR.billingStatus === 'Reservation' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', breakInside: 'avoid' }}>
                <div>
                  <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Reservation Rate (Rs/MT)</Label>
                  <Input value={selectedRowForSR.reservationRate || '-'} readOnly style={inputBaseStyle} />
                </div>
                <div>
                  <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Reservation Quantity (MT)</Label>
                  <Input value={selectedRowForSR.reservationQty || '-'} readOnly style={inputBaseStyle} />
                </div>
                <div>
                  <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Reservation Start Date</Label>
                  <Input value={selectedRowForSR.reservationStart || '-'} readOnly style={inputBaseStyle} />
                </div>
                <div>
                  <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Reservation End Date</Label>
                  <Input value={selectedRowForSR.reservationEnd || '-'} readOnly style={inputBaseStyle} />
                </div>
              </div>
            )}
            {selectedRowForSR.billingStatus === 'Post Reservation' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', breakInside: 'avoid' }}>
                <div>
                  <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Billing Cycle</Label>
                  <Input value={selectedRowForSR.billingCycle || '-'} readOnly style={inputBaseStyle} />
                </div>
                <div>
                  <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Billing Type</Label>
                  <Input value={selectedRowForSR.billingType || '-'} readOnly style={inputBaseStyle} />
                </div>
                <div>
                  <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Billing Rate (Rs/MT)</Label>
                  <Input value={selectedRowForSR.billingRate || '-'} readOnly style={inputBaseStyle} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Insurance Details Section */}
        <div style={{ marginTop: '30px', breakInside: 'avoid' }}>
          <h3 style={{ color: '#ea580c', fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            Insurance Details
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', breakInside: 'avoid' }}>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Insurance Taken By</Label>
              <Input value={matchedInsurance?.insuranceTakenBy || selectedRowForSR?.selectedInsurance?.insuranceTakenBy || selectedRowForSR?.insuranceTakenBy || '-'} readOnly style={inputBaseStyle} />
            </div>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Commodity</Label>
              <Input value={matchedInsurance?.commodityName || selectedRowForSR?.commodity || ''} readOnly style={inputBaseStyle} />
            </div>
          </div>
          {/* Show Bank Name if insurance taken by bank-funded or bank */}
          {(matchedInsurance?.insuranceTakenBy === 'bank-funded' || matchedInsurance?.insuranceTakenBy === 'bank' || 
            selectedRowForSR?.selectedInsurance?.insuranceTakenBy === 'bank-funded' || selectedRowForSR?.selectedInsurance?.insuranceTakenBy === 'bank') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', breakInside: 'avoid' }}>
              <div>
                <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Bank Name</Label>
                <Input value={selectedRowForSR?.bankName || selectedRowForSR?.bankFundedBy || matchedInsurance?.bankFundedBy || matchedInsurance?.selectedBankName || matchedInsurance?.bankName || selectedRowForSR?.selectedBankName || '-'} readOnly style={inputBaseStyle} />
              </div>
              <div></div>
            </div>
          )}
        </div>

        {/* Removed signature area - no longer shown in printable receipt */}
        
        {/* Spacer to push content and ensure page break before test certificate */}
        <div style={{ 
          height: '340px',
          pageBreakAfter: 'always'
        }}></div>
      </div>

      {/* Test Certificate on completely new page */}
      <div style={{ pageBreakBefore: 'always', pageBreakInside: 'avoid' }}>
        {/* Test Certificate Section - Everything on new page */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '32px',
          marginTop: '20px'
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/Group 86.png" 
            alt="Agrogreen Logo" 
            style={{ 
              width: '120px', 
              height: '100px', 
              marginBottom: '8px', 
              borderRadius: '30%', 
              objectFit: 'cover' 
            }} 
          />
          <div style={{
            fontSize: '18px',
            fontWeight: '800',
            color: '#ea580c',
            marginTop: '8px',
            marginBottom: '8px',
            textAlign: 'center',
            letterSpacing: '0.02em'
          }}>
            AGROGREEN WAREHOUSING PRIVATE LTD.
          </div>
          <div style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#16a34a',
            marginBottom: '8px',
            textAlign: 'center'
          }}>
            603, 6th Floor, Princess Business Skyline, Indore, Madhya Pradesh - 452010
          </div>
          <div style={{
            fontSize: '14px',
            fontWeight: '700',
            color: '#ea580c',
            textDecoration: 'underline',
            textAlign: 'center',
            marginBottom: '8px',
            letterSpacing: '0.01em'
          }}>
            TEST CERTIFICATE
          </div>
        </div>

          {/* Test Certificate Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', breakInside: 'avoid' }}>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Client Name</Label>
              <Input 
                value={selectedRowForSR?.client || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Commodity Name</Label>
              <Input 
                value={selectedRowForSR?.commodity || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', breakInside: 'avoid' }}>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Commodity Variety Name</Label>
              <Input 
                value={selectedRowForSR?.varietyName || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Client Address</Label>
              <Input 
                value={getClientAddress()} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', breakInside: 'avoid' }}>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Warehouse Name</Label>
              <Input 
                value={selectedRowForSR?.warehouseName || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Warehouse Address</Label>
              <Input 
                value={selectedRowForSR?.warehouseAddress || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', breakInside: 'avoid' }}>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Total Number of Bags</Label>
              <Input 
                value={selectedRowForSR?.totalBags || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>CAD No</Label>
              <Input 
                value={selectedRowForSR?.cadNumber || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', breakInside: 'avoid' }}>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Date of Sampling</Label>
              <Input 
                value={selectedRowForSR?.dateOfSampling || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
            <div>
              <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Date of Testing</Label>
              <Input 
                value={selectedRowForSR?.dateOfTesting || ''} 
                readOnly
                style={inputBaseStyle}
              />
            </div>
          </div>

          {/* Remarks Section */}
          <div style={{ marginBottom: '16px' }}>
            <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Remarks</Label>
            <div style={{ 
              backgroundColor: '#f9f9f9',
              border: '1px solid #d1d5db',
              padding: '8px 12px',
              minHeight: '60px',
              borderRadius: '6px'
            }}>
              Enter remarks here
            </div>
          </div>

          {/* Quality Parameters Table */}
          <div>
            <Label style={{ fontWeight: '600', marginBottom: '8px', display: 'block', color: '#16a34a' }}>
              Quality Parameters (from Commodity & Variety)
            </Label>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
              <thead>
                <tr style={{ backgroundColor: '#fef3e2' }}>
                  <th style={{ 
                    border: '1px solid #ea580c', 
                    padding: '8px', 
                    textAlign: 'center', 
                    fontWeight: '600',
                    color: '#ea580c'
                  }}>
                    Parameter
                  </th>
                  <th style={{ 
                    border: '1px solid #ea580c', 
                    padding: '8px', 
                    textAlign: 'center', 
                    fontWeight: '600',
                    color: '#ea580c'
                  }}>
                    Min %
                  </th>
                  <th style={{ 
                    border: '1px solid #ea580c', 
                    padding: '8px', 
                    textAlign: 'center', 
                    fontWeight: '600',
                    color: '#ea580c'
                  }}>
                    Max %
                  </th>
                  <th style={{ 
                    border: '1px solid #ea580c', 
                    padding: '8px', 
                    textAlign: 'center', 
                    fontWeight: '600',
                    color: '#ea580c'
                  }}>
                    Actual (%)
                  </th>
                </tr>
              </thead>
              <tbody>
                {(particulars || []).map((p: any, idx: number) => {
                  const pname = p?.particularName || p?.name || `Parameter ${idx + 1}`;
                  const min = p?.minPercent ?? p?.minPercentage ?? p?.minValue ?? p?.min ?? '';
                  const max = p?.maxPercent ?? p?.maxPercentage ?? p?.maxValue ?? p?.max ?? '';
                  const actual = getActualLabResult(pname, idx);
                  return (
                    <tr key={`${pname}-${idx}`}>
                      <td style={{ 
                        border: '1px solid #ea580c', 
                        padding: '8px', 
                        textAlign: 'center' 
                      }}>
                        {pname}
                      </td>
                      <td style={{ 
                        border: '1px solid #ea580c', 
                        padding: '8px', 
                        textAlign: 'center' 
                      }}>
                        {min}
                      </td>
                      <td style={{ 
                        border: '1px solid #ea580c', 
                        padding: '8px', 
                        textAlign: 'center' 
                      }}>
                        {max}
                      </td>
                      <td style={{ 
                        border: '1px solid #ea580c', 
                        padding: '8px', 
                        textAlign: 'center' 
                      }}>
                        {actual}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Quality Status */}
          <div style={{ 
            textAlign: 'center', 
            color: '#16a34a', 
            fontWeight: '600', 
            marginBottom: '40px' 
          }}>
            THE QUALITY OF GOODS IS AVERAGE
          </div>

          {/* Footer - Removed signature section */}
          <div style={{ 
            pageBreakInside: 'avoid', 
            breakInside: 'avoid',
            marginTop: '20px',
            display: 'block'
          }}>
            {/* Footer Disclaimer */}
            <div style={{ 
              marginTop: '20px', 
              padding: '10px', 
              fontSize: '11px', 
              color: '#6b7280', 
              textAlign: 'center',
              borderTop: '1px solid #d1d5db'
            }}>
              This Report is given to you on the base of best testing ability. Any discrepancy found in the report should be brought to 
              our notice within 48 hours of Receipt of the report. The above results are valid for the date and time of sampling and 
              testing only. Total liability or any claim arising out of this report is limited to the invoiced amount only.
            </div>
          </div>
      </div>
    </div>
  );
};

export default PrintableWarehouseReceipt; 