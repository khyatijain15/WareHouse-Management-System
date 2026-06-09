# Lab Results Data Structure Update

## Changes Made:

### 1. Type Definition Updated
- Changed from `labResults: [] as string[]` to `labResults: [] as Array<{parameterName: string, value: string}>`

### 2. Data Storage Format Changed
- **Old Format**: `["5", "6", "8"]` (just values)
- **New Format**: `[{parameterName: "Foreign", value: "5"}, {parameterName: "moisture", value: "6"}, {parameterName: "oil", value: "8"}]`

### 3. Updated Functions:
- `handleLabResultChange`: Now stores objects instead of strings
- `getCellContent`: Enhanced to handle both formats for CSV export
- `migrateLabResults`: Converts old data to new format
- `getLabResultValue`: Helper to extract values from both formats

### 4. Initialization Updated:
- Variety selection now creates proper object structure with parameter names

### 5. Migration Support:
- Backward compatibility for existing data
- Automatic conversion from old string arrays to new object arrays

## Expected CSV Output:
```
Lab Results
Foreign-5,moisture-6,oil-8
```

## Benefits:
- Parameter names are now stored with values
- No need to reconstruct parameter names from commodity/variety data
- Better data integrity and structure
- Cleaner CSV export with proper parameter names

## Next Steps:
- Test with existing data to ensure migration works
- Update all input field references to use the helper function
- Verify CSV export shows parameter names correctly