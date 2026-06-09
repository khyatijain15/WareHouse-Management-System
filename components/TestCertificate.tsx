import React from 'react';

interface QualityParameter {
  name: string;
  minPercentage: string;
  maxPercentage: string;
  actual: string;
}

interface TestCertificateProps {
  client: string;
  clientAddress?: string;
  commodity: string;
  varietyName?: string;
  warehouseName: string;
  warehouseAddress: string;
  totalBags: string;
  dateOfSampling: string;
  dateOfTesting: string;
  qualityParameters: QualityParameter[];
}

const borderColor = '#e67c1f';
const headerBg = '#fff7ed';

const TestCertificate: React.FC<TestCertificateProps> = ({
  client,
  clientAddress = '',
  commodity,
  varietyName = '',
  warehouseName,
  warehouseAddress,
  totalBags,
  dateOfSampling,
  dateOfTesting,
  qualityParameters,
}) => {
  return (
    <div
      style={{
        width: 900,
        margin: '24px auto',
        background: '#fff',
        border: `2.5px solid #e67c1f`,
        borderRadius: 16,
        fontFamily: 'Arial, sans-serif',
        color: '#222',
        boxShadow: '0 4px 24px #e0f2e9',
        padding: 36,
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <img src="/Group 86.png" alt="Agrogreen Logo" style={{ width: 90, height: 90, borderRadius: '50%', margin: '0 auto 8px' }} />
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1aad4b', letterSpacing: 0.5, marginBottom: 2 }}>AGROGREEN WAREHOUSING PRIVATE LTD.</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#e67c1f', marginBottom: 8 }}>603, 6th Floor, Princess Business Skyline, Indore, Madhya Pradesh - 452010</div>
      </div>
      {/* Centered TEST CERTIFICATE title with margin */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '36px auto 36px auto' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#e67c1f', textAlign: 'center' }}>
          TEST CERTIFICATE
        </span>
      </div>
      {/* Info Table - match StorageReceipt style */}
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={{ fontWeight: 700, color: '#e67c1f', background: headerBg, padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle', border: `1.5px solid #f3c892` }}>Client Name</td>
            <td style={{ fontWeight: 500, color: '#222', padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle', border: `1.5px solid #f3c892` }}>{client}</td>
            <td style={{ fontWeight: 700, color: '#e67c1f', background: headerBg, padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle', border: `1.5px solid #f3c892` }}>Client Address</td>
            <td style={{ fontWeight: 500, color: '#222', padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle', border: `1.5px solid #f3c892` }}>{clientAddress}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 700, color: '#e67c1f', background: headerBg, padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle', border: `1.5px solid #f3c892` }}>Commodity</td>
            <td style={{ fontWeight: 500, color: '#222', padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle', border: `1.5px solid #f3c892` }}>{commodity}</td>
            <td style={{ fontWeight: 700, color: '#e67c1f', background: headerBg, padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle', border: `1.5px solid #f3c892` }}>Commodity Variety Name</td>
            <td style={{ fontWeight: 500, color: '#222', padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle', border: `1.5px solid #f3c892` }}>{varietyName}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 700, color: '#e67c1f', background: headerBg, padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle', border: `1.5px solid #f3c892` }}>Warehouse Name</td>
            <td style={{ fontWeight: 500, color: '#222', padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle', border: `1.5px solid #f3c892` }}>{warehouseName}</td>
            <td style={{ fontWeight: 700, color: '#e67c1f', background: headerBg, padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle', border: `1.5px solid #f3c892` }}>Warehouse Address</td>
            <td style={{ fontWeight: 500, color: '#222', padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle', border: `1.5px solid #f3c892` }}>{warehouseAddress}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 700, color: '#e67c1f', background: headerBg, padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle', border: `1.5px solid #f3c892` }}>Total Bags</td>
            <td style={{ fontWeight: 500, color: '#222', padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle', border: `1.5px solid #f3c892` }}>{totalBags}</td>
            <td style={{ fontWeight: 700, color: '#e67c1f', background: headerBg, padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle', border: `1.5px solid #f3c892` }}>Date of Sampling</td>
            <td style={{ fontWeight: 500, color: '#222', padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle', border: `1.5px solid #f3c892` }}>{dateOfSampling}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 700, color: '#e67c1f', background: headerBg, padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle', border: `1.5px solid #f3c892` }}>Date of Testing</td>
            <td style={{ fontWeight: 500, color: '#222', padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle', border: `1.5px solid #f3c892` }}>{dateOfTesting}</td>
            <td style={{ background: headerBg, border: `1.5px solid #f3c892` }}></td>
            <td style={{ border: `1.5px solid #f3c892` }}></td>
          </tr>
        </tbody>
      </table>
      {/* Quality Parameters Table - centered heading, match StorageReceipt table style */}
      <div style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, color: '#1aad4b', fontSize: 15, marginBottom: 8, textAlign: 'center' }}>Quality Parameters (from Commodity & Variety)</div>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, marginBottom: 10 }}>
          <thead style={{ background: headerBg }}>
            <tr>
              <th style={{ border: `1.5px solid #f3c892`, padding: '10px 8px', color: '#e67c1f', fontWeight: 700, textAlign: 'center', verticalAlign: 'middle' }}>Parameter</th>
              <th style={{ border: `1.5px solid #f3c892`, padding: '10px 8px', color: '#e67c1f', fontWeight: 700, textAlign: 'center', verticalAlign: 'middle' }}>Min %</th>
              <th style={{ border: `1.5px solid #f3c892`, padding: '10px 8px', color: '#e67c1f', fontWeight: 700, textAlign: 'center', verticalAlign: 'middle' }}>Max %</th>
              <th style={{ border: `1.5px solid #f3c892`, padding: '10px 8px', color: '#e67c1f', fontWeight: 700, textAlign: 'center', verticalAlign: 'middle' }}>Actual (%)</th>
            </tr>
          </thead>
          <tbody>
            {qualityParameters.length > 0 ? (
              qualityParameters.map((p, idx) => (
                <tr key={idx}>
                  <td style={{ border: `1.5px solid #f3c892`, padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle' }}>{p.name}</td>
                  <td style={{ border: `1.5px solid #f3c892`, padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle' }}>{p.minPercentage}</td>
                  <td style={{ border: `1.5px solid #f3c892`, padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle' }}>{p.maxPercentage}</td>
                  <td style={{ border: `1.5px solid #f3c892`, padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle' }}>{p.actual}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: '#888', padding: '8px' }}>No quality parameters found for this variety.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Footer Section - matches StorageReceipt */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 44, marginBottom: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: borderColor, textAlign: 'left' }}>
          Signature &amp; stamp of authorized signatory
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1aad4b', marginBottom: 4 }}>AGROGREEN WAREHOUSING PRIVATE LIMITED</div>
          <div style={{ width: 220, height: 90, border: '2.5px dashed #fff', margin: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1aad4b', marginTop: 4 }}>AUTHORIZED SIGNATORY</div>
        </div>
      </div>
      {/* Orange line above disclaimer */}
      <div style={{ borderTop: `1.5px solid ${borderColor}`, margin: '18px 0 0 0' }} />
      {/* Footer/Disclaimer */}
      <div style={{ marginTop: 10, fontSize: 12, color: '#888', textAlign: 'center' }}>
        This certificate is computer generated and does not require a physical signature. Please verify all details. For any discrepancy, contact Agrogreen Warehousing Pvt. Ltd. within 48 hours.
      </div>
    </div>
  );
};

export default TestCertificate; 