import type { IFileAttachment } from '../types/chat';

export interface FileConversionResult {
  name: string;
  dataUri: string;
  mimeType: string;
  sizeBytes: number;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * Validate if a file is a supported image type and within size limits.
 * 
 * @param file - File to validate
 * @returns true if file is valid, false otherwise
 */
export function validateImageFile(file: File): boolean {
  return file.type.startsWith('image/') && file.size <= MAX_FILE_SIZE;
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
    if (!file.type.startsWith('image/')) {
      throw new Error(`File "${file.name}" is not an image`);
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`Image "${file.name}" exceeds 20MB limit`);
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
