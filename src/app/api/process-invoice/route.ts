import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No file provided' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, message: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    // Check file size limit (5MB)
    const maxFileSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxFileSize) {
      return NextResponse.json(
        { success: false, message: 'File size exceeds 5MB limit. Please upload a smaller file.' },
        { status: 400 }
      );
    }

    // Get the backend API URL from environment variable
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    

    
    if (!backendUrl) {
      const errorMessage = `
        Backend API URL not configured! 
        
        Please create a .env.local file in your project root with:
        NEXT_PUBLIC_API_BASE_URL=https://your-render-app-name.onrender.com
        
        Replace 'your-render-app-name' with your actual Render app name.
        Then restart the development server.
        
        The API should support the ULTRA-AGGRESSIVE endpoints:
        - /api/v2/parse-invoice/
        - /api/v2/parse-multiple-invoices/
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

    // Test backend connectivity first with retry logic for Render cold start

    let healthResponse;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {

        healthResponse = await fetch(`${backendUrl}/api/v2/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(30000) // 30 second timeout for health check (Render cold start)
        });
        
        if (healthResponse.ok) {
  
          break;
                 } else {
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
             } catch {
        retryCount++;
        if (retryCount < maxRetries) {
                  await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
    
    if (!healthResponse || !healthResponse.ok) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Backend service is not accessible after multiple attempts.',
          details: 'The backend service is currently unavailable. This could be due to:\n\n1. Render service is in sleep mode (try again in 30-60 seconds)\n2. Backend service is down for maintenance\n3. Network connectivity issues\n\nPlease try uploading again in a few moments. If the problem persists, contact support.',
          setupRequired: false,
          retryAfter: 30
        },
        { status: 503 }
      );
    }

    // Create FormData for the backend API
    const backendFormData = new FormData();
    backendFormData.append('file', file);

    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes timeout (Render cold start + processing)

    try {
  
      // Call the actual FastAPI backend
      const response = await fetch(`${backendUrl}/api/v2/parse-invoice/`, {
        method: 'POST',
        body: backendFormData,
        signal: controller.signal,
        headers: {
          'Connection': 'keep-alive',
          'Keep-Alive': 'timeout=300, max=1000'
        }
      });

      clearTimeout(timeoutId);

         if (!response.ok) {
       const errorText = await response.text();
      
      // Handle specific error codes
      if (response.status === 502) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Backend service temporarily unavailable. Please try again later.',
            details: 'The backend service may be overloaded or experiencing issues.'
          },
          { status: 502 }
        );
      }
      
      if (response.status === 504) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Request timeout. The backend took too long to process the file.',
            details: 'Try uploading a smaller file or check your internet connection.'
          },
          { status: 504 }
        );
      }
      
      return NextResponse.json(
        { success: false, message: `Backend API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Check if the backend returned success
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message || 'Backend processing failed' },
        { status: 400 }
      );
    }

    // Return the structured data from the backend
    return NextResponse.json({
      success: true,
      data: result.data,
      request_id: result.request_id,
      message: result.message || 'Invoice processed successfully'
    });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Request timeout. The backend took too long to process the file.',
            details: 'Try uploading a smaller file or try again later.'
          },
          { status: 408 }
        );
      }
      
      throw fetchError; // Re-throw to be caught by outer catch block
    }

   } catch (error) {
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Network error. Unable to connect to the backend service.',
            details: `Error: ${error.message}. Please check your internet connection and try again.`
          },
          { status: 503 }
        );
      }
      
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Request timeout. The backend took too long to respond.',
            details: 'Try uploading a smaller file.'
          },
          { status: 408 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error. Please try again later.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 