import { NextRequest, NextResponse } from 'next/server';

// Configuration
const BATCH_SIZE = 3; // Process 3 files concurrently
const MAX_CONCURRENT_BATCHES = 2; // Maximum 2 batches running at once
const TIMEOUT_PER_FILE = 300000; // 5 minutes per file

interface BatchResult {
  filename: string;
  success: boolean;
  data?: any;
  error?: string;
  processingTime?: number;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No files provided' },
        { status: 400 }
      );
    }

    // Validate all files are PDFs and check file size
    const maxFileSize = 5 * 1024 * 1024; // 5MB in bytes
    for (const file of files) {
      if (file.type !== 'application/pdf') {
        return NextResponse.json(
          { success: false, message: 'Only PDF files are supported' },
          { status: 400 }
        );
      }
      
      if (file.size > maxFileSize) {
        return NextResponse.json(
          { success: false, message: `File "${file.name}" exceeds 5MB limit. Please upload smaller files.` },
          { status: 400 }
        );
      }
    }

    // Get the backend API URL from environment variable
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    
    if (!backendUrl) {
      const errorMessage = `
        Backend API URL not configured! 
        
        Please create a .env.local file in your project root with:
        NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8003
        
        Then restart the development server.
      `;
      
      return NextResponse.json(
        { 
          success: false, 
          message: 'Backend API URL not configured',
          details: errorMessage.trim(),
          setupRequired: true
        },
        { status: 500 }
      );
    }

    // Test backend connectivity first

    try {
      const healthResponse = await fetch(`${backendUrl}/api/v2/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000) // 10 second timeout for health check
      });
      
             if (!healthResponse.ok) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Backend service is not responding properly.',
            details: `Health check failed with status: ${healthResponse.status}`
          },
          { status: 503 }
        );
      }
      
      
         } catch (healthError) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Backend service is not accessible.',
          details: `Health check failed: ${healthError instanceof Error ? healthError.message : 'Unknown error'}`
        },
        { status: 503 }
      );
    }

    // Process files in batches
    const results: BatchResult[] = [];
    const batches: File[][] = [];
    
    // Create batches
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      batches.push(files.slice(i, i + BATCH_SIZE));
    }



    // Process batches with limited concurrency
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += MAX_CONCURRENT_BATCHES) {
      const currentBatches = batches.slice(batchIndex, batchIndex + MAX_CONCURRENT_BATCHES);
      
      // Process current batches concurrently
      const batchPromises = currentBatches.map(async (batch) => {
        return await processBatch(batch, backendUrl);
      });

      // Wait for current batches to complete
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Collect results from all batches
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
                 } else {
          // Add error results for files in failed batch
          const failedBatch = batches[batchIndex + index];
          failedBatch.forEach(file => {
            results.push({
              filename: file.name,
              success: false,
              error: `Batch processing failed: ${result.reason}`
            });
          });
        }
      });
    }

    // Calculate statistics
    const successfulFiles = results.filter(r => r.success);
    const failedFiles = results.filter(r => !r.success);
    const totalProcessingTime = results.reduce((sum, r) => sum + (r.processingTime || 0), 0);
    const averageProcessingTime = results.length > 0 ? totalProcessingTime / results.length : 0;

    return NextResponse.json({
      success: true,
      message: `Batch processing completed. ${successfulFiles.length} successful, ${failedFiles.length} failed.`,
      data: {
        results: results,
        statistics: {
          totalFiles: files.length,
          successfulFiles: successfulFiles.length,
          failedFiles: failedFiles.length,
          totalProcessingTime: totalProcessingTime,
          averageProcessingTime: averageProcessingTime,
          batchesProcessed: batches.length,
          batchSize: BATCH_SIZE,
          concurrentBatches: MAX_CONCURRENT_BATCHES
        }
      }
    });

        } catch (error) {
      
      return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error during batch processing.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function processBatch(files: File[], backendUrl: string): Promise<BatchResult[]> {
  const results: BatchResult[] = [];
  
  try {
    // Create FormData for multiple files
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_PER_FILE * files.length);

    try {
  
      
      // Call the ULTRA-AGGRESSIVE multiple invoices processing endpoint
      const response = await fetch(`${backendUrl}/api/v2/parse-multiple-invoices/`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: {
          'Connection': 'keep-alive',
          'Keep-Alive': 'timeout=120, max=1000'
        }
      });

      clearTimeout(timeoutId);

             if (!response.ok) {
         const errorText = await response.text();
        
        // Return error for all files in this batch
        files.forEach(file => {
          results.push({
            filename: file.name,
            success: false,
            error: `HTTP ${response.status}: ${errorText}`,
            processingTime: 0
          });
        });
        return results;
      }

      const result = await response.json();
      

      if (result.success && result.results) {
        // Map the results to our format
        result.results.forEach((fileResult: any) => {
          results.push({
            filename: fileResult.filename || 'unknown',
            success: fileResult.success || false,
            data: fileResult.data,
            error: fileResult.error_details || fileResult.error,
            processingTime: fileResult.processing_time_seconds ? fileResult.processing_time_seconds * 1000 : 0
          });
        });
      } else {
        // If the response format is different, try to handle it

        files.forEach(file => {
          results.push({
            filename: file.name,
            success: false,
            error: 'Unexpected response format from backend',
            processingTime: 0
          });
        });
      }

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        files.forEach(file => {
          results.push({
            filename: file.name,
            success: false,
            error: 'Request timeout',
            processingTime: 0
          });
        });
      } else {
        files.forEach(file => {
          results.push({
            filename: file.name,
            success: false,
            error: fetchError instanceof Error ? fetchError.message : 'Unknown error',
            processingTime: 0
          });
        });
      }
    }

           } catch (error) {
      
      files.forEach(file => {
      results.push({
        filename: file.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: 0
      });
    });
  }

  return results;
} 