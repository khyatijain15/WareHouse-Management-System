import React from 'react';

interface InsuranceDetail {
  policyNo: string;
  company: string;
  validFrom: string;
  validTo: string;
  sumInsured: string;
  insuranceTakenBy?: string; // Added to distinguish source (Client / Agrogreen / Bank)
}

interface StorageReceiptProps {
  data: {
    srNo: string;
    inwardId?: string;
    srGenerationDate?: string;
    dateOfIssue: string;
    baseReceiptNo: string;
    cadNo?: string;
    cadNumber?: string;
    dateOfDeposit: string;
    branch: string;
    warehouseName: string;
    warehouseAddress: string;
    client: string;
    clientAddress: string;
    commodity: string;
    totalBags: string;
    netWeight: string;
    grade: string;
    remarks: string;
    marketRate: string;
    valueOfCommodity: string;
    hologramNumber: string;
    insuranceDetails: InsuranceDetail[];
    bankName: string;
    bankFundedBy?: string;
    date: string;
    place: string;
    stockInwardDate?: string;
    receiptType?: string; // 'SR' or 'WR'
    varietyName?: string;
    dateOfSampling?: string;
    dateOfTesting?: string;
  };
}

const borderColor = '#e67c1f';
const borderLight = '#f3c892';
const headerBg = '#fff7ed';
const labelStyle = { fontWeight: 700, color: borderColor, fontSize: 15, letterSpacing: 0.5 };
const valueStyle = { fontWeight: 500, color: '#222', fontSize: 15, letterSpacing: 0.2 };
const cellPad = 14;

const StorageReceipt: React.FC<StorageReceiptProps> = ({ data }) => {
  // Fallbacks for SR/WR No and CAD No
  const srNo = data.srNo || data.inwardId || '-';
  const cadNo = data.cadNo || data.cadNumber || '-';
  const srGenerationDate = data.srGenerationDate || '-';
  const insuranceList: InsuranceDetail[] = Array.isArray(data.insuranceDetails) ? data.insuranceDetails : [];
  const insurance = insuranceList[0] || null; // fallback for legacy single display
  const receiptType = (data.receiptType || 'SR').toUpperCase();
  const isWR = receiptType === 'WR';

  // Dynamic labels
  const receiptTitle = isWR ? 'WAREHOUSE RECEIPT (WR)' : 'STORAGE RECEIPT (SR)';
  const noLabel = isWR ? 'WR No.' : 'SR No.';
  const genDateLabel = isWR ? 'WR Generation Date' : 'SR Generation Date';

  return (
    <div
      style={{
        width: '210mm', // A4 width for proper PDF rendering
        maxWidth: '100%',
        margin: '0 auto',
        background: '#f6fef9', // faint green
        borderRadius: 16,
        fontFamily: 'Arial, sans-serif',
        color: '#222',
        boxShadow: '0 4px 24px #e0f2e9',
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <img src="/Group 86.png" alt="Agrogreen Logo" style={{ width: 90, height: 90, borderRadius: '50%', margin: '0 auto 8px' }} />
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1aad4b', letterSpacing: 0.5, marginBottom: 2 }}>AGROGREEN WAREHOUSING PRIVATE LTD.</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#e67c1f', marginBottom: 8 }}>603, 6th Floor, Princess Business Skyline, Indore, Madhya Pradesh - 452010</div>
      </div>
      {/* Centered STORAGE RECEIPT/WAREHOUSE RECEIPT title with margin */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '36px auto 36px auto' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: borderColor, textAlign: 'center' }}>
          {receiptTitle}
        </span>
      </div>
      {/* Info Table - two column, bordered, orange style */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18, tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{noLabel}</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{srNo}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Generation Date</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{srGenerationDate}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Client Name</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.client}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Client Address</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.clientAddress}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Commodity</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.commodity}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Variety Name</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.varietyName}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Warehouse Name</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.warehouseName}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Warehouse Address</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.warehouseAddress}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Total Bags</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.totalBags}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Net Weight</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.netWeight}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Total Value (Rs/MT)</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.valueOfCommodity}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Date of Issue</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.dateOfIssue}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Date of Deposit</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.dateOfDeposit}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Branch Name</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.branch}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Base Receipt/Licenses No.</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.baseReceiptNo}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Market Rate</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.marketRate}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Hologram Number</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.hologramNumber}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Bank Name</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.bankName || data.bankFundedBy || ''}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Place</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.place}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Date of Deposit</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.dateOfDeposit}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Receipt Type</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.receiptType}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>CAD No</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{cadNo}</td>
          </tr>
          <tr>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Date of Sampling</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.dateOfSampling}</td>
            <td style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>Date of Testing</td>
            <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, textAlign: 'center', padding: 10, width: '25%', wordWrap: 'break-word' }}>{data.dateOfTesting}</td>
          </tr>
        </tbody>
      </table>
      {/* Insurance block (multi-source support) */}
      <div style={{ marginTop: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: borderColor, marginBottom: 6 }}>Insurance Details</div>
        {insuranceList.length === 0 && (
          <div style={{ ...valueStyle }}>No insurance details available.</div>
        )}
        {insuranceList.length === 1 && insurance && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
            {insurance.insuranceTakenBy && (
              <div style={{ ...valueStyle }}>Taken By: {insurance.insuranceTakenBy}</div>
            )}
            <div style={{ ...valueStyle }}>Policy No: {insurance.policyNo || '-'}</div>
            <div style={{ ...valueStyle }}>Company: {insurance.company || '-'}</div>
            <div style={{ ...valueStyle }}>Valid From: {insurance.validFrom || '-'}</div>
            <div style={{ ...valueStyle }}>Valid To: {insurance.validTo || '-'}</div>
            <div style={{ ...valueStyle }}>Sum Insured: {insurance.sumInsured || '-'}</div>
          </div>
        )}
        {insuranceList.length > 1 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
            <thead>
              <tr>
                <th style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: 8 }}>Taken By</th>
                <th style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: 8 }}>Policy No</th>
                <th style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: 8 }}>Company</th>
                <th style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: 8 }}>Valid From</th>
                <th style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: 8 }}>Valid To</th>
                <th style={{ ...labelStyle, border: `2px solid ${borderColor}`, background: headerBg, padding: 8 }}>Sum Insured</th>
              </tr>
            </thead>
            <tbody>
              {insuranceList.map((ins, idx) => (
                <tr key={idx}>
                  <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: 8 }}>{ins.insuranceTakenBy || '-'}</td>
                  <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: 8 }}>{ins.policyNo || '-'}</td>
                  <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: 8 }}>{ins.company || '-'}</td>
                  <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: 8 }}>{ins.validFrom || '-'}</td>
                  <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: 8 }}>{ins.validTo || '-'}</td>
                  <td style={{ ...valueStyle, border: `2px solid ${borderColor}`, padding: 8 }}>{ins.sumInsured || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {/* Footer Section - matches uploaded image, with sticker/stamp box in bottom left */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 44, marginBottom: 0, position: 'relative' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: borderColor, textAlign: 'left', position: 'relative' }}>
                   <div style={{ width: 190, height: 100, border: '2.5px dashed #fff', marginTop: 8, marginBottom: 4 }} />

          Signature &amp; stamp of authorized signatory
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1aad4b', marginBottom: 4 }}>AGROGREEN WAREHOUSING PRIVATE LIMITED</div>
          <div style={{ width: 190, height: 100, border: '2.5px dashed #fff', marginTop: 8, marginBottom: 4 }} />

          <div style={{ fontSize: 15, fontWeight: 700, color: '#1aad4b', marginTop: 4 }}>AUTHORIZED SIGNATORY</div>
        </div>
      </div>
      <div style={{ borderTop: `1.5px solid ${borderColor}`, margin: '18px 0 0 0' }} />
      {/* Footer/Disclaimer */}
      <div style={{ marginTop: 10, fontSize: 12, color: '#888', textAlign: 'center' }}>
        This certificate is computer generated and does not require a physical signature. Please verify all details. For any discrepancy, contact Agrogreen Warehousing Pvt. Ltd. within 48 hours.
      </div>
    </div>
  );
};

export default StorageReceipt;