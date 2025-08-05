/**
 * Data utilities for standardizing vendor names and invoice numbers
 * to prevent duplication and improve data quality in visualizations
 */

export interface VendorStandardization {
  original: string;
  standardized: string;
  confidence: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  vendor: string;
  amount: number;
  date: string;
  [key: string]: any;
}

/**
 * Standardizes vendor names by removing common inconsistencies
 */
export function standardizeVendorName(vendorName: string): string {
  if (!vendorName || typeof vendorName !== 'string') {
    return '';
  }
  return vendorName
    .normalize('NFKC') // Unicode normalization
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width chars
    .replace(/\./g, '') // Remove periods to prevent duplication (e.g., "Ga." vs "Ga")
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/[^a-zA-Z0-9& -]/g, '') // Remove all but basic chars (removed . from allowed chars)
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Groups similar vendor names together using fuzzy matching
 */
export function groupSimilarVendors(vendors: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  const standardized = new Map<string, string>();

  // First pass: standardize all vendor names
  vendors.forEach(vendor => {
    const standard = standardizeVendorName(vendor);
    standardized.set(vendor, standard);
  });

  // Second pass: group by standardized names
  vendors.forEach(vendor => {
    const standard = standardized.get(vendor)!;
    if (!groups.has(standard)) {
      groups.set(standard, []);
    }
    groups.get(standard)!.push(vendor);
  });

  return groups;
}

/**
 * Calculates similarity between two vendor names using Levenshtein distance
 */
export function calculateVendorSimilarity(name1: string, name2: string): number {
  const std1 = standardizeVendorName(name1);
  const std2 = standardizeVendorName(name2);
  
  if (std1 === std2) return 1;
  
  const distance = levenshteinDistance(std1, std2);
  const maxLength = Math.max(std1.length, std2.length);
  
  return maxLength === 0 ? 1 : 1 - (distance / maxLength);
}

/**
 * Levenshtein distance algorithm for string similarity
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }
  
  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Standardizes invoice numbers to ensure consistent formatting
 */
export function standardizeInvoiceNumber(invoiceNumber: string | number): string {
  if (typeof invoiceNumber === 'number') {
    return invoiceNumber.toString();
  }
  
  if (!invoiceNumber || typeof invoiceNumber !== 'string') {
    return '';
  }
  
  // Remove all non-alphanumeric characters except hyphens and periods
  const standardized = invoiceNumber
    .trim()
    .replace(/[^\w.-]/g, '')
    .toUpperCase();
  
  return standardized;
}

/**
 * Validates if an invoice number has a valid format
 */
export function validateInvoiceNumber(invoiceNumber: string): boolean {
  const standardized = standardizeInvoiceNumber(invoiceNumber);
  // Check if it's not empty and contains at least one digit
  return standardized.length > 0 && /\d/.test(standardized);
}

/**
 * Processes invoice data to clean and standardize vendor names and invoice numbers
 */
export function processInvoiceData(invoices: InvoiceData[]): InvoiceData[] {
  return invoices.map(invoice => ({
    ...invoice,
    vendor: standardizeVendorName(invoice.vendor),
    invoiceNumber: standardizeInvoiceNumber(invoice.invoiceNumber)
  }));
}

/**
 * Generates a vendor mapping report for data quality analysis
 */
export function generateVendorMappingReport(vendors: string[]): VendorStandardization[] {
  const report: VendorStandardization[] = [];
  const groups = groupSimilarVendors(vendors);
  
  groups.forEach((originalNames, standardized) => {
    originalNames.forEach(original => {
      const confidence = calculateVendorSimilarity(original, standardized);
      report.push({
        original,
        standardized,
        confidence
      });
    });
  });
  
  return report.sort((a, b) => a.confidence - b.confidence);
}

/**
 * Creates a search-friendly version of invoice numbers for filtering
 */
export function createSearchableInvoiceNumber(invoiceNumber: string): string {
  const standardized = standardizeInvoiceNumber(invoiceNumber);
  // Create variations that might be searched
  const variations = [
    standardized,
    standardized.replace(/[.-]/g, ''),
    standardized.replace(/[.-]/g, ' '),
    standardized.toLowerCase()
  ];
  
  return variations.join(' ');
}

/**
 * Filters invoices by number with flexible matching
 */
export function filterInvoicesByNumber(
  invoices: InvoiceData[], 
  searchTerm: string
): InvoiceData[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return invoices;
  }
  
  const normalizedSearch = searchTerm.trim().toLowerCase();
  
  return invoices.filter(invoice => {
    const searchableNumber = createSearchableInvoiceNumber(invoice.invoiceNumber);
    return searchableNumber.toLowerCase().includes(normalizedSearch);
  });
}

/**
 * Export utility for Power BI/Tableau with cleaned data
 */
export function exportCleanedDataForVisualization(invoices: InvoiceData[]): InvoiceData[] {
  const cleaned = processInvoiceData(invoices);
  
  // Add additional fields for better visualization
  return cleaned.map(invoice => ({
    ...invoice,
    vendor_standardized: standardizeVendorName(invoice.vendor),
    invoice_number_standardized: standardizeInvoiceNumber(invoice.invoiceNumber),
    vendor_length: invoice.vendor.length,
    has_special_chars: /[^\w\s.-]/.test(invoice.vendor),
    vendor_word_count: invoice.vendor.split(' ').length
  }));
} 