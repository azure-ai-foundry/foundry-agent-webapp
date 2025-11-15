import type { IFileAttachment } from '../types/chat';

export interface FileConversionResult {
  name: string;
  dataUri: string;
  mimeType: string;
  sizeBytes: number;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILE_COUNT = 5;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

/**
 * Validate if a file is a supported image type and within size limits.
 * 
 * @param file - File to validate
 * @returns Validation result with error message if invalid
 */
export function validateImageFile(file: File): FileValidationResult {
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: `"${file.name}" is not an image file` };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
    return { valid: false, error: `"${file.name}" format not supported. Use PNG, JPEG, GIF, or WebP` };
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `"${file.name}" is ${sizeMB}MB. Maximum file size is 5MB` };
  }

  return { valid: true };
}

/**
 * Validate multiple files for count and individual file requirements.
 * 
 * @param files - Files to validate
 * @param currentFileCount - Number of files already attached
 * @returns Validation result with error message if invalid
 */
export function validateFileCount(files: File[], currentFileCount: number = 0): FileValidationResult {
  const totalCount = currentFileCount + files.length;
  
  if (totalCount > MAX_FILE_COUNT) {
    return { 
      valid: false, 
      error: `Maximum ${MAX_FILE_COUNT} files allowed. You have ${currentFileCount} attached and are trying to add ${files.length} more` 
    };
  }

  return { valid: true };
}

/**
 * Convert a single file to base64 data URI.
 * 
 * @param file - File to convert
 * @returns Promise resolving to data URI string
 * @throws {Error} If file reading fails
 */
async function convertFileToDataUri(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Convert multiple files to base64 data URIs with metadata.
 * 
 * @param files - Array of File objects to convert
 * @returns Array of conversion results with file metadata
 * @throws {Error} If any file is invalid or conversion fails
 */
export async function convertFilesToDataUris(
  files: File[]
): Promise<FileConversionResult[]> {
  const results: FileConversionResult[] = [];

  for (const file of files) {
    // Validate each file before conversion
    const validation = validateImageFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const dataUri = await convertFileToDataUri(file);

    results.push({
      name: file.name,
      dataUri,
      mimeType: file.type,
      sizeBytes: file.size,
    });
  }

  return results;
}

/**
 * Create chat attachment metadata from file conversion results.
 * 
 * @param results - File conversion results
 * @returns Array of attachment objects for chat UI
 */
export function createAttachmentMetadata(
  results: FileConversionResult[]
): IFileAttachment[] {
  return results.map((result) => ({
    fileName: result.name,
    fileSizeBytes: result.sizeBytes,
    dataUri: result.dataUri,
  }));
}
