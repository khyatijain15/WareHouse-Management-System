# Status Color Testing for CIR Status and SR/WR Status Columns

## Implementation Summary

Added color-coded status styling to the CIR Status and SR/WR Status columns in the inward table with the following specifications:

### Color Scheme

1. **Pending/Inactive/Closed**
   - Background: Yellow (`bg-yellow-100`)
   - Font: Black (`text-black`)
   - Style: `px-2 py-1 rounded-full text-xs font-medium inline-block`

2. **Approve/Activate/Reactive**
   - Background: Light Green (`bg-green-100`)
   - Font: Dark Green (`text-green-800`)
   - Style: `px-2 py-1 rounded-full text-xs font-medium inline-block`

3. **Resubmit/Reject**
   - Background: Baby Pink (`bg-pink-100`)
   - Font: Red (`text-red-600`)
   - Style: `px-2 py-1 rounded-full text-xs font-medium inline-block`

### Implementation Details

1. **Helper Function**: `getStatusStyling(status: string)`
   - Normalizes status to lowercase for comparison
   - Maps various status variations to appropriate styling
   - Returns complete CSS class string for styling

2. **CIR Status Column**
   - Uses `getStatusStyling()` to apply appropriate colors
   - Maintains existing Eye button for viewing CIR details
   - Status badge is contained within its own scope

3. **SR/WR Status Column**
   - Uses same `getStatusStyling()` function
   - Only shows status when CIR is approved
   - Shows "-" when CIR is not approved
   - Maintains existing Eye button for viewing SR details

### Status Mappings

**Pending Category (Yellow background, black text):**
- pending
- inactive 
- closed

**Approved Category (Light green background, dark green text):**
- approved
- activate
- reactivate
- approve
- reactive

**Rejected Category (Baby pink background, red text):**
- resubmit
- reject
- rejected
- resubmitted

### Visual Features

- **Rounded pill shape**: Uses `rounded-full` for modern badge appearance
- **Proper spacing**: `px-2 py-1` for comfortable padding
- **Consistent size**: `text-xs font-medium` for uniform appearance
- **Scoped styling**: Background colors only affect the status text, not the entire cell
- **Inline display**: `inline-block` ensures proper sizing around text content

## Testing Scenarios

To test the implementation:

1. **CIR Status Column**: Check that different CIR statuses display with correct colors
2. **SR/WR Status Column**: Verify that SR/WR statuses only show when CIR is "Approved"
3. **Color Accuracy**: Confirm the background and text colors match the requirements
4. **Button Functionality**: Ensure Eye buttons still work for viewing details

## Browser Compatibility

The implementation uses standard Tailwind CSS classes that are compatible with all modern browsers.
