import React from 'react';

// Define interface for field structure
interface Field {
  label: string;
  value: string | number | null | undefined;
  highlightStyle?: {
    background?: string;
    borderColor?: string;
    color?: string;
    fontWeight?: number;
  };
}

export default function PrintableDOReceipt({ data }: { data: any }) {
  // Helper functions for calculations
  const getBalanceBags = (data: any) => {
    const inward = parseFloat(data.totalBags) || 0;
    const release = parseFloat(data.releaseBags) || 0;
    const doQty = parseFloat(data.doBags) || 0;
    return (inward - release - doQty).toString();
  };

  const getBalanceQty = (data: any) => {
    const inward = parseFloat(data.totalQuantity) || 0;
    const release = parseFloat(data.releaseQuantity) || 0;
    const doQty = parseFloat(data.doQuantity) || 0;
    return (inward - release - doQty).toFixed(2);
  };

  const normalizeStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  // CIR-style layout
  const labelStyle = {
    fontWeight: 700,
    color: '#e67c1f',
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
    background: '#fff7f0',
    borderRadius: 8,
    padding: '6px 12px',
    border: '1px solid #fed7aa',
  };

  // All fields in three-column grid (excluding remark field)
  const fields: Field[] = [
    { label: 'DO Code', value: data.doCode },
    { label: 'Status', value: normalizeStatusText(data.doStatus || 'pending') },
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
    { label: 'Release RO Bags', value: data.releaseBags },
    { label: 'Release RO Quantity (MT)', value: data.releaseQuantity },
    { 
      label: 'DO Bags', 
      value: data.doBags, 
      highlightStyle: { 
        background: '#fff3e6', 
        borderColor: '#ffe0c0',
        color: '#e67c1f', 
        fontWeight: 700 
      } 
    },
    { 
      label: 'DO Quantity (MT)', 
      value: data.doQuantity,
      highlightStyle: { 
        background: '#fff3e6', 
        borderColor: '#ffe0c0',
        color: '#e67c1f', 
        fontWeight: 700 
      }
    },
    { label: 'Balance Bags', value: getBalanceBags(data) },
    { label: 'Balance Quantity (MT)', value: getBalanceQty(data) },
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
      id="printable-do-receipt"
    >
      {/* Header with logo and address */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <img src="/Group 86.png" alt="Agrogreen Logo" style={{ width: 90, height: 90, borderRadius: '50%', margin: '0 auto 8px' }} />
        <div style={{ fontSize: 28, fontWeight: 700, color: '#e67c1f', letterSpacing: 0.5, marginBottom: 2 }}>AGROGREEN WAREHOUSING PRIVATE LTD.</div>
        <div style={{ fontSize: 18, fontWeight: 500, color: '#1aad4b', marginBottom: 8 }}>603, 6th Floor, Princess Business Skyline, Indore, Madhya Pradesh - 452010</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#e67c1f', margin: '24px 0 0 0', textDecoration: 'underline' }}>DO RECEIPT</div>
      </div>
      
      {/* Three-column grid for fields */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '0 24px',
          marginTop: 32,
        }}
      >
        {fields.map((f, idx) => (
          <div key={idx} style={{ marginBottom: 12 }}>
            <div style={{
              ...labelStyle,
              ...(f.highlightStyle ? { color: f.highlightStyle.color } : {})
            }}>{f.label}</div>
            <div style={{
              ...valueStyle,
              ...(f.highlightStyle || {})
            }}>{f.value ?? '-'}</div>
          </div>
        ))}
      </div>

      {/* Attachments section */}
      {Array.isArray(data.attachmentUrls) && data.attachmentUrls.length > 0 && (
        <div style={{ marginTop: 24, marginBottom: 12 }}>
          <div style={labelStyle}>Attachments</div>
          <div style={{ ...valueStyle, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {data.attachmentUrls.map((url: string, idx: number) => {
              const ext = url.split('.').pop()?.toLowerCase();
              let label = 'View File';
              if (ext === 'pdf') label = 'View PDF';
              else if (ext === 'docx') label = 'View DOCX';  
              else if (["jpg", "jpeg", "png"].includes(ext || '')) label = 'View Image';
              return (
                <span key={idx} style={{ color: '#1a56db' }}>
                  {label} {idx + 1}
                </span>
              );
            })}
          </div>
        </div>
      )}
      
      <div style={{ fontSize: 13, color: '#555', textAlign: 'right', marginTop: 24 }}>
        <b>Generated on:</b> {new Date().toLocaleString()}
      </div>
    </div>
  );
}
