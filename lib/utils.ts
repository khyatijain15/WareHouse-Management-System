import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utility function to format dates properly
export function formatDate(dateValue: any): string {
  if (!dateValue) return '-';
  
  try {
    let date: Date;
    
    // Handle different date formats
    if (typeof dateValue === 'string') {
      // If it's already a formatted date string, return as is
      if (dateValue.match(/^\d{2}-\d{2}-\d{4}$/)) {
        return dateValue;
      }
      // If it's a timestamp string, parse it
      date = new Date(dateValue);
    } else if (typeof dateValue === 'number') {
      // If it's a timestamp number
      date = new Date(dateValue);
    } else if (dateValue instanceof Date) {
      // If it's already a Date object
      date = dateValue;
    } else if (dateValue && typeof dateValue.toDate === 'function') {
      // If it's a Firestore timestamp
      date = dateValue.toDate();
    } else {
      return '-';
    }
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return '-';
    }
    
    // Format as DD-MM-YYYY
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error('Error formatting date:', error, dateValue);
    return '-';
  }
}
