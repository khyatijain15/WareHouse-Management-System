import React from 'react';
import Image from 'next/image';

interface CIRStatusFormProps {
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
    cirStatus?: string;
    date?: string;
    place?: string;
    reservationStatus?: string;
  };
}

const borderColor = '#e67c1f';
const borderLight = '#f3c892';
const headerBg = '#fff7ed';
const labelStyle = { fontWeight: 700, color: borderColor, fontSize: 14, letterSpacing: 0.5 };
const valueStyle = { fontWeight: 500, color: '#222', fontSize: 14, letterSpacing: 0.2 };
const sectionTitleStyle = { fontSize: 16, fontWeight: 700, color: borderColor, marginBottom: 12, textAlign: 'center' as const };
const cellPad = 12;

const CIRStatusForm: React.FC<CIRStatusFormProps> = ({ data }) => {
  return (
    <div
      style={{
        width: 900,
        margin: '0 auto',
        background: '#ffffff',
        borderRadius: 12,
        fontFamily: 'Arial, sans-serif',
        color: '#222',
        padding: 32,
        border: `2px solid ${borderColor}`,
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Image src="/Group 86.png" alt="Agrogreen Logo" width={80} height={80} style={{ borderRadius: '50%', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1aad4b', letterSpacing: 0.5, marginBottom: 4 }}>AGROGREEN WAREHOUSING PRIVATE LTD.</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#e67c1f', marginBottom: 20 }}>603, 6th Floor, Princess Business Skyline, Indore, Madhya Pradesh - 452010</div>
        
        {/* CIR Form Title */}
        <div style={{ 
          fontSize: 16, 
          fontWeight: 700, 
          color: borderColor, 
          textAlign: 'center',
          backgroundColor: headerBg,
          padding: '12px 24px',
          border: `2px solid ${borderColor}`,
          borderRadius: 8,
          margin: '0 auto 24px',
          display: 'inline-block'
        }}>
          CIR (COMMODITY INWARD RECEIPT) STATUS FORM
        </div>
      </div>

      {/* Basic Information */}
      <div style={sectionTitleStyle}>BASIC INFORMATION</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <tbody>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad, width: '25%' }}>Inward ID</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad, width: '25%' }}>{data.inwardId || '-'}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad, width: '25%' }}>CIR Status</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad, width: '25%' }}>{data.cirStatus || '-'}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Date of Inward</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.dateOfInward || '-'}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>CAD Number</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.cadNumber || '-'}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Base Receipt</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }} colSpan={3}>{data.bankReceipt || '-'}</td>
          </tr>
        </tbody>
      </table>

      {/* Location Details */}
      <div style={sectionTitleStyle}>LOCATION DETAILS</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <tbody>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>State</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.state || '-'}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Branch</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.branch || '-'}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Location</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.location || '-'}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Warehouse Name</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.warehouseName || '-'}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Warehouse Code</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.warehouseCode || '-'}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Business Type</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.businessType || '-'}</td>
          </tr>
          {data.warehouseAddress && (
            <tr>
              <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Warehouse Address</td>
              <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }} colSpan={3}>{data.warehouseAddress}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Client Details */}
      <div style={sectionTitleStyle}>CLIENT DETAILS</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <tbody>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Client Name</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.client || '-'}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Client Code</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.clientCode || '-'}</td>
          </tr>
          {data.clientAddress && (
            <tr>
              <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Client Address</td>
              <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }} colSpan={3}>{data.clientAddress}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Commodity Details */}
      <div style={sectionTitleStyle}>COMMODITY DETAILS</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <tbody>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Commodity</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.commodity || '-'}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Variety</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.varietyName || '-'}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Total Bags</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.totalBags || '-'}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Total Quantity (MT)</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.totalQuantity || '-'}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Market Rate (Rs/MT)</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.marketRate || '-'}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Total Value (Rs)</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.totalValue || '-'}</td>
          </tr>
        </tbody>
      </table>

      {/* Vehicle & Weight Details */}
      <div style={sectionTitleStyle}>VEHICLE & WEIGHT DETAILS</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <tbody>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Vehicle Number</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.vehicleNumber || '-'}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Gatepass Number</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.getpassNumber || '-'}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Weight Bridge</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.weightBridge || '-'}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Weight Bridge Slip No.</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.weightBridgeSlipNumber || '-'}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Gross Weight (MT)</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.grossWeight || '-'}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Tare Weight (MT)</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.tareWeight || '-'}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Net Weight (MT)</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }} colSpan={3}>{data.netWeight || '-'}</td>
          </tr>
        </tbody>
      </table>

      {/* Stack Information */}
      {data.stacks && data.stacks.length > 0 && (
        <>
          <div style={sectionTitleStyle}>STACK INFORMATION</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
            <thead>
              <tr>
                <th style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Stack Number</th>
                <th style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Number of Bags</th>
              </tr>
            </thead>
            <tbody>
              {data.stacks.map((stack: any, index: number) => (
                <tr key={index}>
                  <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad, textAlign: 'center' }}>{stack.stackNumber || '-'}</td>
                  <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad, textAlign: 'center' }}>{stack.numberOfBags || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Quality Parameters */}
      {data.labParameterNames && data.labParameterNames.length > 0 && (
        <>
          <div style={sectionTitleStyle}>QUALITY PARAMETERS</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
            <tbody>
              <tr>
                <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Sampling Date</td>
                <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.dateOfSampling || '-'}</td>
                <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Testing Date</td>
                <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.dateOfTesting || '-'}</td>
              </tr>
            </tbody>
          </table>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
            <thead>
              <tr>
                <th style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Parameter</th>
                <th style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Actual Value (%)</th>
              </tr>
            </thead>
            <tbody>
              {data.labParameterNames.map((name: string, idx: number) => (
                <tr key={idx}>
                  <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{name}</td>
                  <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad, textAlign: 'center' }}>
                    {typeof data.labResults?.[idx] === 'object' && data.labResults[idx]?.value ? 
                      data.labResults[idx].value : 
                      (data.labResults?.[idx] || '-')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Bank Details */}
      <div style={sectionTitleStyle}>BANK DETAILS</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <tbody>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Bank Name</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.bankName || '-'}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Bank Branch</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.bankBranch || '-'}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Bank State</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.bankState || '-'}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>IFSC Code</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.ifscCode || '-'}</td>
          </tr>
        </tbody>
      </table>

      {/* Reservation & Billing Information (if applicable) */}
      {data.businessType !== 'cm' && data.billingStatus && (
        <>
          <div style={sectionTitleStyle}>RESERVATION & BILLING INFORMATION</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
            <tbody>
              <tr>
                <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Billing Status</td>
                <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }} colSpan={3}>{data.billingStatus || '-'}</td>
              </tr>
              {data.reservationStatus === 'reservation' && (
                <>
                  <tr>
                    <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Reservation Rate (Rs/MT)</td>
                    <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.reservationRate || '-'}</td>
                    <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Reservation Quantity (MT)</td>
                    <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.reservationQty || '-'}</td>
                  </tr>
                  <tr>
                    <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Reservation Start Date</td>
                    <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.reservationStart || '-'}</td>
                    <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Reservation End Date</td>
                    <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.reservationEnd || '-'}</td>
                  </tr>
                </>
              )}
              {data.reservationStatus === 'post-reservation' && (
                <>
                  <tr>
                    <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Billing Cycle</td>
                    <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.billingCycle || '-'}</td>
                    <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Billing Type</td>
                    <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{data.billingType || '-'}</td>
                  </tr>
                  <tr>
                    <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Billing Rate (Rs/MT)</td>
                    <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }} colSpan={3}>{data.billingRate || '-'}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </>
      )}

      {/* Insurance Details */}
      {data.insuranceEntries && data.insuranceEntries.length > 0 && (
        <>
          <div style={sectionTitleStyle}>INSURANCE DETAILS</div>
          {data.insuranceEntries.map((insurance: any, index: number) => (
            <table key={index} style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
              <tbody>
                <tr>
                  <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Insurance ID</td>
                  <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{insurance.insuranceId || '-'}</td>
                  <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Taken By</td>
                  <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{insurance.insuranceTakenBy || '-'}</td>
                </tr>
                <tr>
                  <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Fire Policy No.</td>
                  <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{insurance.firePolicyNumber || '-'}</td>
                  <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Fire Policy Amount</td>
                  <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{insurance.firePolicyAmount || '-'}</td>
                </tr>
                <tr>
                  <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Burglary Policy No.</td>
                  <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{insurance.burglaryPolicyNumber || '-'}</td>
                  <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: cellPad }}>Burglary Policy Amount</td>
                  <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: cellPad }}>{insurance.burglaryPolicyAmount || '-'}</td>
                </tr>
              </tbody>
            </table>
          ))}
        </>
      )}

      {/* Footer */}
      <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: borderColor, marginBottom: 4 }}>Place: {data.place || 'Indore'}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: borderColor }}>Date: {data.date || new Date().toLocaleDateString('en-IN')}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: `2px solid ${borderColor}`, width: 200, paddingTop: 8, fontSize: 14, fontWeight: 600, color: borderColor }}>
            Authorized Signature
          </div>
        </div>
      </div>
    </div>
  );
};

export default CIRStatusForm;