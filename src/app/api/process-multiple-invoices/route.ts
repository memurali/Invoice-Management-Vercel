import { NextRequest, NextResponse } from 'next/server';

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



    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    
    if (!backendUrl) {

      return NextResponse.json(
        { 
          success: false, 
          message: 'Backend API URL not configured',
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
            details: `The backend service is currently unavailable. This could be due to:\n\n1. Render service is in sleep mode (try again in 30-60 seconds)\n2. Backend service is down for maintenance\n3. Network connectivity issues\n\nPlease try uploading again in a few moments. If the problem persists, contact support.`,
            setupRequired: false,
            retryAfter: 30
          },
          { status: 503 }
        );
      }
      
    } catch {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Backend service is not accessible.',
          details: `The backend service is currently unavailable. This could be due to:\n\n1. Render service is in sleep mode (try again in 30-60 seconds)\n2. Backend service is down for maintenance\n3. Network connectivity issues\n\nPlease try uploading again in a few moments. If the problem persists, contact support.`,
          setupRequired: false,
          retryAfter: 30
        },
        { status: 503 }
      );
    }


    // Create FormData for the backend API
    const backendFormData = new FormData();
    files.forEach(file => {
      backendFormData.append('files', file);
    });


    
    // Call the backend API
    const response = await fetch(`${backendUrl}/api/v2/parse-multiple-invoices/`, {
      method: 'POST',
      body: backendFormData,
      signal: AbortSignal.timeout(60000) // 60 second timeout
    });



         if (!response.ok) {
       const errorText = await response.text();
      
      return NextResponse.json(
        { 
          success: false, 
          message: `Backend API error: ${response.status}`,
          details: errorText
        },
        { status: response.status }
      );
    }

    const result = await response.json();


    return NextResponse.json({
      success: true,
      message: 'Batch processing completed successfully',
      data: result
    });

     } catch (error) {
    console.error('Process multiple invoices error:', error);
    
    // Determine the specific error type
    let errorMessage = 'Internal server error';
    let errorDetails = 'Unknown error';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack || 'No stack trace available';
    }
    
    // Check if it's a network error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      errorMessage = 'Network error - unable to connect to backend service';
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 