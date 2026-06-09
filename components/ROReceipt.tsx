

import React from 'react';

export default function ROReceipt({ data }: { data: any }) {
  // CIR-style layout
  const labelStyle = {
    fontWeight: 700,
    color: '#1aad4b',
    fontSize: 16,
    marginBottom: 4,
    marginTop: 12,
    letterSpacing: 0.2,
  };
  const valueStyle = {
    fontWeight: 500,
    color: '#222',
    fontSize: 16,
    marginBottom: 8,
    background: '#f6fef9',
    borderRadius: 8,
    padding: '6px 12px',
    border: '1px solid #e0f2e9',
  };

  // All fields in two-column grid
  const fields = [
    { label: 'RO Code', value: data.roCode },
    { label: 'Status', value: data.roStatus },
    { label: 'SR/WR No.', value: data.srwrNo },
    { label: 'CAD Number', value: data.cadNumber },
    { label: 'State', value: data.state },
    { label: 'Branch', value: data.branch },
    { label: 'Location', value: data.location },
    { label: 'Warehouse Name', value: data.warehouseName },
    { label: 'Warehouse Code', value: data.warehouseCode },
    { label: 'Warehouse Address', value: data.warehouseAddress },
    { label: 'Client Name', value: data.client },
    { label: 'Client Code', value: data.clientCode },
    { label: 'Client Address', value: data.clientAddress },
    { label: 'Inward Bags', value: data.totalBags },
    { label: 'Inward Quantity (MT)', value: data.totalQuantity },
    { label: 'Release Bags', value: data.releaseBags },
    { label: 'Release Quantity (MT)', value: data.releaseQuantity },
    { label: 'Balance Bags', value: data.balanceBags },
    { label: 'Balance Quantity (MT)', value: data.balanceQuantity },
    { label: 'Remark', value: data.remark },
  ];

  return (
    <div
      style={{
        width: 900,
        margin: '24px auto',
        background: '#fff',
        borderRadius: 16,
        fontFamily: 'Arial, sans-serif',
        color: '#222',
        boxShadow: '0 4px 24px #e0f2e9',
        padding: 36,
      }}
    >
      {/* Header with logo and address */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <img src="/Group 86.png" alt="Agrogreen Logo" style={{ width: 90, height: 90, borderRadius: '50%', margin: '0 auto 8px' }} />
        <div style={{ fontSize: 28, fontWeight: 700, color: '#e67c1f', letterSpacing: 0.5, marginBottom: 2 }}>AGROGREEN WAREHOUSING PRIVATE LTD.</div>
        <div style={{ fontSize: 18, fontWeight: 500, color: '#1aad4b', marginBottom: 8 }}>603, 6th Floor, Princess Business Skyline, Indore, Madhya Pradesh - 452010</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#e67c1f', margin: '24px 0 0 0', textDecoration: 'underline' }}>RO Details</div>
      </div>
      {/* Two-column grid for fields */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0 32px',
          marginTop: 32,
        }}
      >
        {fields.map((f, idx) => (
          <div key={idx} style={{ marginBottom: 12 }}>
            <div style={labelStyle}>{f.label}</div>
            <div style={valueStyle}>{f.value ?? '-'}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 13, color: '#555', textAlign: 'right', marginTop: 24 }}>
        <b>Generated on:</b> {new Date().toLocaleString()}
      </div>
    </div>
  );
}
