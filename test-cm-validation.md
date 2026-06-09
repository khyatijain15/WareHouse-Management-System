# CM Type Warehouse Validation Test

## Changes Made
1. Added "CM" as an option in the warehouse type dropdown
2. Updated the `validateForm()` function to require bank details for CM type warehouses
3. Added bank detail fields (bankState, bankBranch, bankName, ifscCode) to the field mapping in `scrollToField()`
4. Added a visual indicator in the bank details section when CM type is selected

## Validation Logic
When `typeOfWarehouse` is "CM" or "cm", or when `customWarehouseType` is "cm" (case-insensitive), the following fields become required:
- Bank State
- Bank Branch  
- Bank Name
- IFSC Code

## Test Scenarios

### Test 1: Create CM warehouse without bank details
1. Open warehouse creation form
2. Select "CM" as warehouse type
3. Fill all other required fields but leave bank details empty
4. Try to submit
5. **Expected**: Form should not submit and show validation error for missing bank details

### Test 2: Create CM warehouse with bank details
1. Open warehouse creation form  
2. Select "CM" as warehouse type
3. Fill all required fields including bank details
4. Try to submit
5. **Expected**: Form should submit successfully

### Test 3: Create non-CM warehouse without bank details  
1. Open warehouse creation form
2. Select "Dry Warehouse" as warehouse type
3. Fill all other required fields but leave bank details empty
4. Try to submit
5. **Expected**: Form should submit successfully (bank details not required for non-CM warehouses)

### Test 4: Custom warehouse type "CM"
1. Open warehouse creation form
2. Select "Others" as warehouse type  
3. Enter "CM" as custom warehouse type
4. Fill all other required fields but leave bank details empty
5. Try to submit
6. **Expected**: Form should not submit and show validation error for missing bank details

## Implementation Details
- The validation is case-insensitive for "CM"
- Bank details are only required for CM type, all other warehouse types work as before
- The validation message will guide users to fill the required bank details
- Visual indicator shows when bank details are mandatory
