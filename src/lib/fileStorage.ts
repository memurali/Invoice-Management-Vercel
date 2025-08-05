import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebaseStorage } from './firebase';

export class FileStorageService {
  private static readonly STORAGE_PATH = 'invoices';

  /**
   * Upload a PDF file to Firebase Storage
   */
  static async uploadPDF(
    userId: string,
    file: File,
    invoiceId: string
  ): Promise<{ success: boolean; downloadURL?: string; error?: string }> {
    try {
  
      
      // Create a unique file path
      const fileName = `${invoiceId}_${file.name}`;
      const filePath = `${this.STORAGE_PATH}/${userId}/${fileName}`;
      
      // Create a storage reference
      const storage = getFirebaseStorage();
      if (!storage) {
        throw new Error('Firebase Storage not initialized');
      }
      const storageRef = ref(storage, filePath);
      
      // Upload the file
      const snapshot = await uploadBytes(storageRef, file);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return {
        success: true,
        downloadURL
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error'
      };
    }
  }

  /**
   * Delete a PDF file from Firebase Storage
   */
  static async deletePDF(downloadURL: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Create a reference from the URL
      const storage = getFirebaseStorage();
      if (!storage) {
        throw new Error('Firebase Storage not initialized');
      }
      const storageRef = ref(storage, downloadURL);
      
      // Delete the file
      await deleteObject(storageRef);
      
      return { success: true };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown deletion error'
      };
    }
  }

  /**
   * Generate a preview URL for a PDF (same as download URL in this case)
   */
  static generatePreviewURL(downloadURL: string): string {
    // For PDFs, we can use the same download URL
    // Browsers will typically display PDFs inline
    return downloadURL;
  }

  /**
   * Check if a file is a valid PDF
   */
  static isValidPDF(file: File): boolean {
    return file.type === 'application/pdf' && file.size > 0;
  }

  /**
   * Get file size in a human-readable format
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
} 