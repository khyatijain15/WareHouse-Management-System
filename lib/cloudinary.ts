// Cloudinary upload utility
export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  original_filename: string;
  format: string;
  resource_type?: string;
}

export const uploadToCloudinary = async (file: File): Promise<CloudinaryUploadResult> => {
  // Validate required environment variables
  if (!process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
    console.error('Missing Cloudinary configuration: Check your environment variables');
    throw new Error('Cloudinary configuration missing. Please contact administrator.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', 'wms/client-documents');
  
  // Determine resource_type based on file type
  let resourceType = 'auto'; // Use 'auto' to let Cloudinary determine the type
  
  // For PDF files, use 'raw' delivery to ensure direct access
  const nameLower = (file as any).name ? String((file as any).name).toLowerCase() : '';
  if (file.type === 'application/pdf' || nameLower.endsWith('.pdf')) {
    resourceType = 'raw';
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    // Try to get more detailed error information from the response
    try {
      const errorData = await response.json();
      throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorData.error?.message || JSON.stringify(errorData)}`);
    } catch (parseError) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }
  }

  const result = await response.json();
  return result;
}; 