# Balance Filtering Enhancement

## Issue Fixed
Previously, the Release Order (RO) form was showing all approved inward entries regardless of whether they had any remaining balance. This meant users could see and select Storage/Warehouse Receipt Numbers that were already fully utilized (zero balance), which doesn't make sense for creating new release orders.

## Solution Implemented

### 1. **Release Order (RO) Form Enhancement**
- **File**: `d:\WMS\app\ro\page.tsx`
- **Function**: `fetchInwards()` 
- **Changes**:
  - Added balance calculation logic similar to the outward form
  - Fetches all existing release orders to calculate used quantities
  - Groups release orders by SR/WR number for efficient calculation
  - Calculates remaining balance: `totalBags - releasedBags`
  - **Filters out inwards with zero balance**: `.filter(inward => inward.balanceBags > 0)`
  - Added comprehensive logging for debugging

### 2. **Outward Form - Already Correct**
- **File**: `d:\WMS\app\outward\page.tsx` 
- **Function**: `fetchDOs()`
- **Status**: ✅ Already implemented correctly
- **Logic**: Filters DOs with positive balance: `.filter(doItem => doItem.balanceBags > 0)`

## Expected Behavior

### **Before Fix:**
```
RO Form shows:
- SR-INW-001-20250101 (Balance: 100 bags) ✓ Valid
- SR-INW-002-20250102 (Balance: 0 bags) ❌ Should be hidden
- SR-INW-003-20250103 (Balance: 50 bags) ✓ Valid
```

### **After Fix:**
```
RO Form shows:
- SR-INW-001-20250101 (Balance: 100 bags) ✓ Valid
- SR-INW-003-20250103 (Balance: 50 bags) ✓ Valid
```

## Technical Details

### Balance Calculation Logic:
```typescript
// For each inward entry:
balanceBags = totalBags - totalReleasedBags
balanceQuantity = totalQuantity - totalReleasedQuantity

// Only show if balance > 0
.filter(inward => inward.balanceBags > 0)
```

### Data Flow:
1. Fetch all approved inward entries
2. Fetch all existing release orders
3. Group release orders by SR/WR number
4. Calculate remaining balance for each inward
5. Filter out zero-balance entries
6. Display only positive-balance entries in dropdown

## Benefits:
- ✅ Users only see relevant receipt numbers with available stock
- ✅ Prevents confusion from zero-balance entries
- ✅ Improves user experience and data accuracy
- ✅ Consistent behavior between RO and Outward forms
- ✅ Better performance (fewer irrelevant options)

## Testing:
- [x] RO form now filters zero-balance inwards
- [x] Outward form maintains existing balance filtering
- [x] Console logging added for debugging
- [x] Balance calculations work correctly