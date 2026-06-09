import React from 'react';

// Helper function to format dates to dd-mm-yyyy
const formatDate = (dateString: string | undefined | null): string => {
  if (!dateString || dateString === '-') return '-';
  
  // If already in dd-mm-yyyy format, return as is
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) {
    return dateString;
  }
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Invalid date, return original
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}-${month}-${year}`;
  } catch (e) {
    return dateString; // Return original if parsing fails
  }
};

interface CIRReceiptProps {
  data: {
    inwardId?: string;
    state?: string;
    branch?: string;
    location?: string;
    warehouseName?: string;
    warehouseCode?: string;
    warehouseAddress?: string;
    businessType?: string;
    client?: string;
    clientCode?: string;
    clientAddress?: string;
    dateOfInward?: string;
    cadNumber?: string;
    bankReceipt?: string;
    commodity?: string;
    varietyName?: string;
    marketRate?: string;
    totalBags?: string;
    totalQuantity?: string;
    totalValue?: string;
    bankName?: string;
    bankBranch?: string;
    bankState?: string;
    ifscCode?: string;
    bankFundedBy?: string;
    billingStatus?: string;
    reservationRate?: string;
    reservationQty?: string;
    reservationStart?: string;
    reservationEnd?: string;
    billingCycle?: string;
    billingType?: string;
    billingRate?: string;
    dateOfSampling?: string;
    dateOfTesting?: string;
    labResults?: any[];
    labParameterNames?: string[];
    attachmentUrl?: string;
    vehicleNumber?: string;
    getpassNumber?: string;
    weightBridge?: string;
    weightBridgeSlipNumber?: string;
    grossWeight?: string;
    tareWeight?: string;
    netWeight?: string;
    stacks?: any[];
    insuranceEntries?: any[];
    inwardEntries?: any[];
    cirStatus?: string;
    remarks?: string;
    date?: string;
    place?: string;
  };
}

const CIRReceipt: React.FC<CIRReceiptProps> = ({ data }) => {
  // Debug log to verify data
  console.log('CIRReceipt - Lab Parameters:', {
    labParameterNames: data.labParameterNames,
    labResults: data.labResults,
    dateOfSampling: data.dateOfSampling,
    dateOfTesting: data.dateOfTesting
  });

  return (
    <div
      style={{
        padding: '20px 20px 40px 20px',
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        lineHeight: '1.6',
        color: '#000',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '15px', borderBottom: '1px solid #000', paddingBottom: '8px' }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>AGROGREEN WAREHOUSING PRIVATE LTD.</div>
        <div style={{ fontSize: '10px' }}>603, 6th Floor, Princess Business Skyline, Indore, Madhya Pradesh - 452010</div>
      </div>
      
      <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 'bold', marginBottom: '15px' }}>
        CIR (COMMODITY INWARD RECEIPT) STATUS FORM
      </div>

      {/* Basic Info */}
      <div style={{ marginBottom: '12px' }}>
        <div><strong>Inward ID:</strong> {data.inwardId || '-'}</div>
        <div><strong>CIR Status:</strong> {data.cirStatus || '-'}</div>
        <div><strong>Date of Inward:</strong> {formatDate(data.dateOfInward)}</div>
        <div><strong>CAD Number:</strong> {data.cadNumber || '-'}</div>
        <div><strong>Base Receipt:</strong> {data.bankReceipt || '-'}</div>
      </div>

      {/* Location Details */}
      <div style={{ marginBottom: '12px', borderTop: '1px solid #000', paddingTop: '8px', pageBreakInside: 'avoid' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>LOCATION DETAILS</div>
        <div><strong>State:</strong> {data.state || '-'}</div>
        <div><strong>Branch:</strong> {data.branch || '-'}</div>
        <div><strong>Location:</strong> {data.location || '-'}</div>
        <div><strong>Warehouse Name:</strong> {data.warehouseName || '-'}</div>
        <div><strong>Warehouse Code:</strong> {data.warehouseCode || '-'}</div>
        <div><strong>Business Type:</strong> {data.businessType || '-'}</div>
      </div>

      {/* Client Details */}
      <div style={{ marginBottom: '12px', borderTop: '1px solid #000', paddingTop: '8px', pageBreakInside: 'avoid' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>CLIENT DETAILS</div>
        <div><strong>Client Name:</strong> {data.client || '-'}</div>
        <div><strong>Client Code:</strong> {data.clientCode || '-'}</div>
        <div><strong>Client Address:</strong> {data.clientAddress || '-'}</div>
      </div>

      {/* Commodity Details */}
      <div style={{ marginBottom: '12px', borderTop: '1px solid #000', paddingTop: '8px', pageBreakInside: 'avoid' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>COMMODITY DETAILS</div>
        <div><strong>Commodity:</strong> {data.commodity || '-'}</div>
        <div><strong>Variety:</strong> {data.varietyName || '-'}</div>
        <div><strong>Total Bags:</strong> {data.totalBags || '-'}</div>
        <div><strong>Total Quantity (MT):</strong> {data.totalQuantity || '-'}</div>
        <div><strong>Market Rate (Rs/MT):</strong> {data.marketRate || '-'}</div>
        <div><strong>Total Value (Rs):</strong> {data.totalValue || '-'}</div>
      </div>

      {/* Vehicle & Weight Details */}
      {data.inwardEntries && data.inwardEntries.length > 0 ? (
        <div style={{ marginBottom: '12px', borderTop: '1px solid #000', paddingTop: '8px', pageBreakInside: 'avoid' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>VEHICLE & WEIGHT DETAILS</div>
          {data.inwardEntries.map((entry: any, index: number) => (
            <div key={index} style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: index < data.inwardEntries!.length - 1 ? '1px dashed #ccc' : 'none' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>Entry {index + 1}</div>
              <div><strong>Vehicle Number:</strong> {entry.vehicleNumber || '-'}</div>
              <div><strong>Gatepass Number:</strong> {entry.getpassNumber || '-'}</div>
              <div><strong>Weight Bridge:</strong> {entry.weightBridge || '-'}</div>
              <div><strong>Weight Bridge Slip No.:</strong> {entry.weightBridgeSlipNumber || '-'}</div>
              <div><strong>Gross Weight (MT):</strong> {entry.grossWeight || '-'}</div>
              <div><strong>Tare Weight (MT):</strong> {entry.tareWeight || '-'}</div>
              <div><strong>Net Weight (MT):</strong> {entry.netWeight || '-'}</div>
              {entry.stacks && entry.stacks.length > 0 && (
                <div style={{ marginTop: '5px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '11px' }}>Stacks:</div>
                  {entry.stacks.map((stack: any, stackIdx: number) => (
                    <div key={stackIdx} style={{ fontSize: '11px', marginLeft: '10px' }}>
                      <strong>Stack {stackIdx + 1}:</strong> {stack.stackNumber || '-'}, <strong>Bags:</strong> {stack.numberOfBags || '-'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginBottom: '12px', borderTop: '1px solid #000', paddingTop: '8px', pageBreakInside: 'avoid' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>VEHICLE & WEIGHT DETAILS</div>
          <div><strong>Vehicle Number:</strong> {data.vehicleNumber || '-'}</div>
          <div><strong>Gatepass Number:</strong> {data.getpassNumber || '-'}</div>
          <div><strong>Weight Bridge:</strong> {data.weightBridge || '-'}</div>
          <div><strong>Weight Bridge Slip No.:</strong> {data.weightBridgeSlipNumber || '-'}</div>
          <div><strong>Gross Weight (MT):</strong> {data.grossWeight || '-'}</div>
          <div><strong>Tare Weight (MT):</strong> {data.tareWeight || '-'}</div>
          <div><strong>Net Weight (MT):</strong> {data.netWeight || '-'}</div>
        </div>
      )}

      {/* Stack Information - Only show if no inwardEntries (old format) */}
      {!data.inwardEntries && data.stacks && data.stacks.length > 0 && (
        <div style={{ marginBottom: '12px', borderTop: '1px solid #000', paddingTop: '8px', pageBreakInside: 'avoid' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>STACK INFORMATION</div>
          {data.stacks.map((stack: any, index: number) => (
            <div key={index}>
              <strong>Stack {index + 1} - Number:</strong> {stack.stackNumber || '-'}, <strong>Bags:</strong> {stack.numberOfBags || '-'}
            </div>
          ))}
        </div>
      )}

      {/* Bank Details */}
      <div style={{ marginBottom: '12px', borderTop: '1px solid #000', paddingTop: '8px', pageBreakInside: 'avoid' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>BANK DETAILS</div>
        <div><strong>Bank Name:</strong> {data.bankName || '-'}</div>
        <div><strong>Bank Branch:</strong> {data.bankBranch || '-'}</div>
        <div><strong>Bank State:</strong> {data.bankState || '-'}</div>
        <div><strong>IFSC Code:</strong> {data.ifscCode || '-'}</div>
        <div><strong>Bank Receipt:</strong> {data.bankReceipt || '-'}</div>
      </div>

      {/* Reservation & Billing Details */}
      {(() => {
        const billingStatusLower = (data.billingStatus || '').trim().toLowerCase();
        return billingStatusLower && billingStatusLower !== '-';
      })() && (
        <div style={{ marginBottom: '12px', borderTop: '1px solid #000', paddingTop: '8px', pageBreakInside: 'avoid' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
            {(() => {
              const bs = (data.billingStatus || '').trim().toLowerCase();
              if (bs === 'reservation') return 'RESERVATION DETAILS';
              if (bs.includes('post')) return 'BILLING DETAILS';
              if (data.reservationRate || data.reservationQty) return 'RESERVATION DETAILS';
              return 'BILLING DETAILS';
            })()}
          </div>
          {(() => {
            const bs = (data.billingStatus || '').trim().toLowerCase();
            return bs === 'reservation';
          })() && (
            <>
              <div><strong>Reservation Rate (Rs/MT):</strong> {data.reservationRate || '-'}</div>
              <div><strong>Reservation Quantity (MT):</strong> {data.reservationQty || '-'}</div>
              <div><strong>Reservation Start Date:</strong> {formatDate(data.reservationStart)}</div>
              <div><strong>Reservation End Date:</strong> {formatDate(data.reservationEnd)}</div>
            </>
          )}
          {(() => {
            const bs = (data.billingStatus || '').trim().toLowerCase();
            return bs.includes('post');
          })() && (
            <>
              <div><strong>Billing Cycle:</strong> {data.billingCycle || '-'}</div>
              <div><strong>Billing Type:</strong> {data.billingType || '-'}</div>
              <div><strong>Billing Rate (Rs/MT):</strong> {data.billingRate || '-'}</div>
            </>
          )}
        </div>
      )}

      {/* Insurance Details */}
      {data.insuranceEntries && data.insuranceEntries.length > 0 && (
        <div style={{ marginBottom: '12px', borderTop: '1px solid #000', paddingTop: '8px', pageBreakInside: 'avoid' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>INSURANCE DETAILS</div>
          {data.insuranceEntries.map((insurance: any, index: number) => {
            const insuranceTakenBy = (insurance.insuranceTakenBy || '').toLowerCase().trim();
            const isBankFunded = insuranceTakenBy === 'bank' || insuranceTakenBy === 'bank-funded' || insuranceTakenBy.includes('bank');
            
            if (isBankFunded) {
              // For bank-funded insurance, show only 3 fields
              return (
                <div key={index} style={{ marginBottom: '8px' }}>
                  <div><strong>Insurance Taken By:</strong> {insurance.insuranceTakenBy || '-'}</div>
                  <div><strong>Commodity:</strong> {insurance.commodityName || '-'}</div>
                  <div><strong>Bank Name:</strong> {data.bankName || data.bankFundedBy || '-'}</div>
                </div>
              );
            }
            
            // For non-bank-funded insurance, show all fields
            return (
              <div key={index} style={{ marginBottom: '8px' }}>
                <div><strong>Insurance ID:</strong> {insurance.insuranceId || '-'}</div>
                <div><strong>Taken By:</strong> {insurance.insuranceTakenBy || '-'}</div>
                <div><strong>Fire Policy No.:</strong> {insurance.firePolicyNumber || '-'}</div>
                <div><strong>Fire Policy Amount:</strong> {insurance.firePolicyAmount || '-'}</div>
                <div><strong>Burglary Policy No.:</strong> {insurance.burglaryPolicyNumber || '-'}</div>
                <div><strong>Burglary Policy Amount:</strong> {insurance.burglaryPolicyAmount || '-'}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lab Parameters - Positioned at the end before footer */}
      {data.labResults && Array.isArray(data.labResults) && data.labResults.length > 0 && (
        <div style={{ marginBottom: '12px', borderTop: '1px solid #000', paddingTop: '8px', pageBreakInside: 'avoid' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>QUALITY PARAMETERS</div>
          <div><strong>Sampling Date:</strong> {formatDate(data.dateOfSampling)}</div>
          <div><strong>Testing Date:</strong> {formatDate(data.dateOfTesting)}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px', border: '1px solid #000', pageBreakInside: 'avoid' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Parameter</th>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Actual Value (%)</th>
              </tr>
            </thead>
            <tbody>
              {data.labResults.map((result: any, idx: number) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #000', padding: '6px' }}>
                    {result.parameterName || result.parameter || '-'}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>
                    {result.value || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '15px', borderTop: '1px solid #000', paddingTop: '8px' }}>
        
      </div>
    </div>
  );
};

export default CIRReceipt;