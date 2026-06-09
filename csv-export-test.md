# CSV Export Enhancement Documentation

## ✅ Latest Updates Applied

### 1. Base Receipt Field Added
- **INWARD Module**: Added Base Receipt column using `bankReceipt` accessor
- **OUTWARD Module**: Added Base Receipt column and data field
- **Data Source**: Uses `baseReceiptNo` or falls back to `bankReceipt` field

### 2. Enhanced Lab Parameters Display  
- **INWARD Module**: Lab results now show parameter names with values
- **Format**: `Foreign-5,moisture-6,oil-8` instead of just `5,6,8`
- **Logic**: Retrieves parameter names from `variety.particulars` array
- **Fallback**: Uses `Parameter1`, `Parameter2` if names not found

## Current Implementation Status

### INWARD Module ✅ ENHANCED
- **Structure**: Single inward record can contain multiple vehicle entries (`inwardEntries` array)
- **CSV Export Logic**: 
  - Creates ONE row per vehicle entry
  - All stack details for that vehicle are combined in the `stacks` column
  - Lab results show parameter names: `Foreign-5,moisture-6,oil-8`
  - Base Receipt field included
  - Each vehicle gets a separate row with repeated main data + vehicle specific data

### OUTWARD Module ✅ ENHANCED
- **Structure**: Each vehicle creates a separate outward record
- **CSV Export Logic**: 
  - Uses `flatMap` to create one row per stack entry
  - Each stack gets its own row with repeated main data
  - Base Receipt field added to headers and data

## Expected CSV Output

### INWARD Example:
```
Inward Code, Base Receipt, Vehicle Number, Stacks, Lab Results, ... (other columns)
INW-001, SR-001-240930, MH01AB1234, Stack1 (50 bags); Stack2 (30 bags), Foreign-5,moisture-6,oil-8, ...
INW-001, SR-001-240930, MH02CD5678, Stack3 (40 bags); Stack4 (25 bags), Foreign-4,moisture-7,oil-9, ...
```

### OUTWARD Example:
```
Outward Code, Base Receipt, Vehicle Number, Stack Number, Stack Outward Bags, ... (other columns)
OUT-001, SR-001-240930, MH01AB1234, Stack1, 30, ...
OUT-001, SR-001-240930, MH01AB1234, Stack2, 20, ...
OUT-002, SR-002-240930, MH02CD5678, Stack1, 25, ...
```

## Key Enhancements Applied

### Lab Results Enhancement:
- **Before**: `5, 6, 8` (just values)
- **After**: `Foreign-5,moisture-6,oil-8` (parameter names with values)

### Base Receipt Addition:
- **Added Column**: Base Receipt field in both INWARD and OUTWARD CSVs
- **Data Source**: `baseReceiptNo` field with fallback to `bankReceipt`

### Vehicle Entry Handling:
- **INWARD**: One row per vehicle entry with combined stack info
- **OUTWARD**: One row per stack entry with repeated main data

## Testing Checklist

- [ ] INWARD with single vehicle, single stack, lab results
- [ ] INWARD with single vehicle, multiple stacks, lab results
- [ ] INWARD with multiple vehicles, each with single stack
- [ ] INWARD with multiple vehicles, each with multiple stacks
- [ ] INWARD with lab results showing parameter names (Foreign-5,moisture-6,oil-8)
- [ ] INWARD with Base Receipt field populated
- [ ] OUTWARD with single vehicle, multiple stacks
- [ ] OUTWARD with Base Receipt field populated
- [ ] OUTWARD with multiple separate records (different vehicles)