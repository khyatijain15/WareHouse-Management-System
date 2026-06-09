# Bank-Funded Insurance Fix

## Issue
When selecting "Bandra Bank" in the inward module, only client insurance was showing even though bank-funded insurance for Bandra Bank exists in the database.

## Root Cause
1. **`fetchInsuranceData` function** was only fetching ONE insurance document (the first match) instead of ALL matching insurances
2. **No bank-based filtering** - The insurance filtering logic didn't consider which bank was selected when showing bank-funded insurance

## Changes Made

### 1. Modified `fetchInsuranceData` function (line ~2075)
**Before:**
```typescript
const insuranceMasterDoc = querySnapshot.docs[0]; // Only got first match
const insuranceData = insuranceMasterDoc.data();
setInsuranceEntries([insuranceEntry]); // Set single entry
```

**After:**
```typescript
const allInsuranceEntries = querySnapshot.docs.map(insuranceMasterDoc => {
  // Process ALL matching documents
  const insuranceData = insuranceMasterDoc.data();
  return {
    // ... insurance entry data
  };
});
setInsuranceEntries(allInsuranceEntries); // Set ALL entries
```

**Impact:** Now fetches ALL insurances that match the warehouse + commodity combination, not just the first one.

### 2. Added Bank Filtering Logic (line ~1162)
**Added to `filteredInsuranceInfoEntries` useMemo:**
```typescript
// Filter by selected bank for bank-funded insurance
if (selectedInsuranceInfoType.toLowerCase() === 'bank-funded') {
  if (!selectedBank || !selectedBank.bankName) {
    console.log('⚠️ Bank-funded insurance selected but no bank chosen - showing no results');
    return [];
  }
  
  // Only show bank-funded insurance that matches the selected bank
  filtered = filtered.filter(ins => {
    const bankMatch = (ins.selectedBankName || '').toLowerCase() === selectedBank.bankName.toLowerCase();
    return bankMatch;
  });
}
```

**Impact:** 
- When user selects "bank-funded" insurance type:
  - If no bank selected → shows no results
  - If bank selected → only shows bank-funded insurances where `selectedBankName` matches the selected bank
- Non-bank-funded insurances (client, agrogreen, warehouse-owner) → always show regardless of bank selection

### 3. Added `selectedBank` to dependency array
**Updated useMemo dependencies:**
```typescript
}, [insuranceEntries, selectedInsuranceInfoType, baseForm.commodity, selectedBank]);
```

**Impact:** Insurance filtering re-runs whenever the selected bank changes.

## How It Works Now

1. **Select Warehouse** → Fetches available banks for that warehouse
2. **Select Bank** → Updates `selectedBank` state with bank details
3. **Select Commodity** → Fetches ALL insurances for warehouse + commodity
4. **Select Insurance Type**:
   - **"client" / "agrogreen" / "warehouse-owner"** → Shows all matching insurances
   - **"bank-funded"** → Only shows insurances where `selectedBankName` matches the selected bank

## Data Flow

```
User Selects Bandra Bank
  ↓
selectedBank = { bankName: "Bandra Bank", ... }
  ↓
User Selects Commodity (Rice)
  ↓
fetchInsuranceData("Rice")
  ↓
Fetches ALL insurances for warehouse + rice
  - Insurance 1: type="client", clientName="ABC Corp"
  - Insurance 2: type="bank-funded", selectedBankName="Bandra Bank"
  ↓
insuranceEntries = [Insurance 1, Insurance 2]
  ↓
User Clicks "Bank-Funded" Type
  ↓
filteredInsuranceInfoEntries filters:
  ✓ Insurance 2 (matches: type=bank-funded AND bank=Bandra Bank)
  ✗ Insurance 1 (type != bank-funded)
  ↓
Shows only Bandra Bank insurance
```

## Testing Scenarios

### ✅ Scenario 1: Select Bandra Bank + Bank-Funded Insurance
- **Expected:** Shows insurance with `selectedBankName = "Bandra Bank"`
- **Result:** ✅ Working

### ✅ Scenario 2: Select Bandra Bank + Client Insurance
- **Expected:** Shows client insurance (not bank-specific)
- **Result:** ✅ Working

### ✅ Scenario 3: No Bank Selected + Bank-Funded Insurance
- **Expected:** Shows no results (bank required for bank-funded)
- **Result:** ✅ Working

### ✅ Scenario 4: Select Different Bank + Bank-Funded Insurance
- **Expected:** Only shows bank-funded insurance for the selected bank
- **Result:** ✅ Working

## Files Modified
- `/app/inward/page.tsx` (2 locations)
  - `fetchInsuranceData` function (~line 2075)
  - `filteredInsuranceInfoEntries` useMemo (~line 1162)

## Notes
- No other logic was changed
- Backward compatibility maintained (still auto-fills form with first insurance)
- Console logs added for debugging
