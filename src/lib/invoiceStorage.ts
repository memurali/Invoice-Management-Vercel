import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  Timestamp,
  FieldValue,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { getFirebaseDB } from './firebase';

export interface StoredInvoiceData {
  id: string;
  userId: string;
  filename: string;
  originalFilename: string;
  fileUrl?: string; // Firebase Storage download URL for the PDF
  fileSize?: number; // File size in bytes
  invoiceNumber?: string;
  totalAmount?: number;
  invoiceDate?: string;
  vendorName?: string;
  processingMetadata?: any;
  extractedData: any;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}

export class InvoiceStorageService {
  private static readonly COLLECTION_NAME = 'invoices';

  /**
   * Save or update invoice data in Firestore with optional file upload
   */
  static async saveInvoiceData(
    userId: string,
    filename: string,
    extractedData: any,
    fileUrl?: string,
    fileSize?: number
  ): Promise<{ success: boolean; message: string; documentId?: string }> {
    try {
      // Extract key information for duplicate detection and indexing
      const invoiceNumber = extractedData.invoice_metadata?.invoice_number;
      const totalAmount = extractedData.financial_summary?.total_amount;
      const invoiceDate = extractedData.invoice_metadata?.invoice_date;
      // Normalize vendor name for consistent grouping using standardizeVendorName
      const { standardizeVendorName } = await import('./dataUtils');
      const vendorName = standardizeVendorName(extractedData.vendor_information?.company_name) || 'Unknown';

      // Check for existing invoice with same filename or invoice number
      const existingInvoice = await this.findExistingInvoice(
        userId, 
        filename, 
        invoiceNumber
      );

      const documentId = existingInvoice?.id || this.generateDocumentId(userId, filename);
      
      const invoiceData: StoredInvoiceData = {
        id: documentId,
        userId,
        filename: filename.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        originalFilename: filename,
        fileUrl,
        fileSize,
        invoiceNumber,
        totalAmount,
        invoiceDate,
        vendorName,
        processingMetadata: extractedData.processing_metadata,
        extractedData,
        createdAt: existingInvoice?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Save to Firestore
      const db = getFirebaseDB();
      if (!db) {
        throw new Error('Firebase Firestore not initialized');
      }
      const docRef = doc(db, this.COLLECTION_NAME, documentId);
      await setDoc(docRef, invoiceData, { merge: true });

      const isUpdate = !!existingInvoice;
      return {
        success: true,
        message: isUpdate 
          ? `Invoice "${filename}" updated successfully in database`
          : `Invoice "${filename}" saved successfully to database`,
        documentId
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to save invoice data: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Find existing invoice by invoice number first, then filename
   * Enhanced to prioritize invoice number matching for better duplicate detection
   */
  static async findExistingInvoice(
    userId: string,
    filename: string,
    invoiceNumber?: string
  ): Promise<StoredInvoiceData | null> {
    try {
      const db = getFirebaseDB();
      if (!db) {
        throw new Error('Firebase Firestore not initialized');
      }
      const invoicesRef = collection(db, this.COLLECTION_NAME);
      
      // First, try to find by invoice number (highest priority)
      if (invoiceNumber && invoiceNumber.trim()) {
    
        
        // Try exact match first
        const exactInvoiceQuery = query(
          invoicesRef,
          where('userId', '==', userId),
          where('invoiceNumber', '==', invoiceNumber.trim()),
          limit(1)
        );

        const exactSnapshot = await getDocs(exactInvoiceQuery);
        if (!exactSnapshot.empty) {
          return exactSnapshot.docs[0].data() as StoredInvoiceData;
        }

        // Try case-insensitive match for invoice number
        const allInvoicesQuery = query(
          invoicesRef,
          where('userId', '==', userId)
        );

        const allSnapshot = await getDocs(allInvoicesQuery);
        for (const doc of allSnapshot.docs) {
          const data = doc.data() as StoredInvoiceData;
          if (data.invoiceNumber && 
              data.invoiceNumber.toLowerCase().trim() === invoiceNumber.toLowerCase().trim()) {
            return data;
          }
        }
      }

      // If no invoice number match, try filename as fallback
      const filenameQuery = query(
        invoicesRef,
        where('userId', '==', userId),
        where('originalFilename', '==', filename),
        limit(1)
      );

      const filenameSnapshot = await getDocs(filenameQuery);
      if (!filenameSnapshot.empty) {
        return filenameSnapshot.docs[0].data() as StoredInvoiceData;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Generate a unique document ID
   */
  private static generateDocumentId(userId: string, filename: string): string {
    const cleanFilename = filename.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const timestamp = Date.now();
    return `${userId}_${cleanFilename}_${timestamp}`;
  }

  /**
   * Get all invoices for all users (public access)
   */
  static async getAllInvoices(limitCount: number = 50): Promise<StoredInvoiceData[]> {
    try {

      
      const db = getFirebaseDB();
      if (!db) {
        throw new Error('Firebase Firestore not initialized');
      }
      
      const invoicesRef = collection(db, this.COLLECTION_NAME);
      const q = query(
        invoicesRef,
        orderBy('updatedAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // Let's try a simpler query without orderBy to see if there's an indexing issue
        const simpleQuery = query(
          invoicesRef,
          limit(limitCount)
        );
        
        const simpleSnapshot = await getDocs(simpleQuery);
        
        if (simpleSnapshot.empty) {
          return [];
        }
        
        // If simple query works, return those results
        const simpleResults = simpleSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StoredInvoiceData[];
        
        return simpleResults;
      }

      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StoredInvoiceData[];

      return results;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get invoices for a specific user
   */
  static async getUserInvoices(userId: string, limitCount: number = 50): Promise<StoredInvoiceData[]> {
    try {

      
      const db = getFirebaseDB();
      if (!db) {
        throw new Error('Firebase Firestore not initialized');
      }
      
      const invoicesRef = collection(db, this.COLLECTION_NAME);
      const q = query(
        invoicesRef,
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return [];
      }

      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StoredInvoiceData[];

      return results;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user invoice statistics
   */
  static async getUserInvoiceStats(userId: string): Promise<{
    totalInvoices: number;
    totalAmount: number;
    lastProcessedDate: string | null;
  }> {
    try {

      
      const db = getFirebaseDB();
      if (!db) {
        throw new Error('Firebase Firestore not initialized');
      }
      
      const invoicesRef = collection(db, this.COLLECTION_NAME);
      const q = query(
        invoicesRef,
        where('userId', '==', userId)
      );

      const snapshot = await getDocs(q);
      
      let totalAmount = 0;
      let lastProcessedDate: string | null = null;

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.totalAmount && typeof data.totalAmount === 'number') {
          totalAmount += data.totalAmount;
        }
        
        if (data.updatedAt) {
          const updatedAt = data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt;
          if (!lastProcessedDate || updatedAt > lastProcessedDate) {
            lastProcessedDate = updatedAt;
          }
        }
      });

      const stats = {
        totalInvoices: snapshot.size,
        totalAmount,
        lastProcessedDate
      };

      return stats;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Debug function to get all documents (for development only)
   */
  static async debugGetAllDocuments(): Promise<any[]> {
    try {

      
      const db = getFirebaseDB();
      if (!db) {
        throw new Error('Firebase Firestore not initialized');
      }
      
      const invoicesRef = collection(db, this.COLLECTION_NAME);
      const snapshot = await getDocs(invoicesRef);
      
      const documents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return documents;
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete invoice data from Firestore
   */
  static async deleteInvoiceData(documentId: string): Promise<{ success: boolean; message: string }> {
    try {

      
      const db = getFirebaseDB();
      if (!db) {
        throw new Error('Firebase Firestore not initialized');
      }
      
      const docRef = doc(db, this.COLLECTION_NAME, documentId);
      await deleteDoc(docRef);
      
      return {
        success: true,
        message: `Invoice deleted successfully`
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete invoice: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Update existing invoice data in Firestore
   */
  static async updateInvoiceData(
    documentId: string,
    userId: string,
    extractedData: any
  ): Promise<{ success: boolean; message: string; documentId?: string }> {
    try {

      
      const db = getFirebaseDB();
      if (!db) {
        throw new Error('Firebase Firestore not initialized');
      }
      
      // Extract key information for indexing
      const invoiceNumber = extractedData.invoice_metadata?.invoice_number;
      const totalAmount = extractedData.financial_summary?.total_amount;
      const invoiceDate = extractedData.invoice_metadata?.invoice_date;
      const { standardizeVendorName } = await import('./dataUtils');
      const vendorName = standardizeVendorName(extractedData.vendor_information?.company_name) || 'Unknown';

      const docRef = doc(db, this.COLLECTION_NAME, documentId);
      await updateDoc(docRef, {
        invoiceNumber,
        totalAmount,
        invoiceDate,
        vendorName,
        extractedData,
        updatedAt: serverTimestamp()
      });

      return {
        success: true,
        message: `Invoice "${invoiceNumber}" updated successfully in database`,
        documentId
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Failed to update invoice data: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get invoice by document ID
   */
  static async getInvoiceById(documentId: string): Promise<StoredInvoiceData | null> {
    try {

      
      const db = getFirebaseDB();
      if (!db) {
        throw new Error('Firebase Firestore not initialized');
      }
      
      const docRef = doc(db, this.COLLECTION_NAME, documentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as StoredInvoiceData;
        return {
          ...data,
          id: docSnap.id
        };
      }
      
      return null;
      
    } catch {
      return null;
    }
  }
} 