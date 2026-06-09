import { NextRequest, NextResponse } from 'next/server';

// This route reads request.nextUrl and sends emails; mark it dynamic
export const dynamic = 'force-dynamic';
import { doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { verifySecureToken } from '@/lib/server-token-utils';

export async function GET(request: NextRequest) {
  try {
    // Use Next.js provided parsed URL to avoid static generation bailouts
    const { searchParams } = request.nextUrl;
    const userId = searchParams.get('userId');
    const token = searchParams.get('token');

    if (!userId || !token) {
      return NextResponse.json(
        { error: 'Missing userId or token' },
        { status: 400 }
      );
    }

    // Verify the token
    if (!verifySecureToken(userId, token)) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get user data before deletion
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

    // Send rejection notification to user before deleting
    try {
      const response = await fetch(`${request.nextUrl.origin}/api/send-approval-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          action: 'rejected',
          userData: {
            username: userData.username,
            email: userData.email,
            role: userData.role
          }
        })
      });

      if (!response.ok) {
        console.error('Failed to send rejection notification email');
      }
    } catch (emailError) {
      console.error('Error sending rejection notification:', emailError);
    }

    // Delete the user document
    await deleteDoc(userRef);

    // Return success page
    return new NextResponse(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>User Registration Rejected</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            max-width: 600px; 
            margin: 50px auto; 
            padding: 20px; 
            background-color: #f8f9fa; 
          }
          .container { 
            background: white; 
            padding: 30px; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            text-align: center; 
          }
          .warning-icon { font-size: 60px; margin-bottom: 20px; }
          h1 { color: #dc3545; margin-bottom: 20px; }
          .user-info { 
            background: #f8d7da; 
            border: 1px solid #f5c6cb; 
            padding: 20px; 
            border-radius: 5px; 
            margin: 20px 0; 
            text-align: left; 
          }
          .next-steps { 
            background: #f8f9fa; 
            padding: 15px; 
            border-radius: 5px; 
            margin: 20px 0; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="warning-icon">🚫</div>
          <h1>User Registration Rejected</h1>
          <p>The user registration has been rejected and their account has been removed from the system.</p>
          
          <div class="user-info">
            <strong>Rejected User Details:</strong><br>
            Username: ${userData.username}<br>
            Email: ${userData.email}<br>
            Role: ${userData.role?.toUpperCase()}<br>
            Rejected At: ${new Date().toLocaleString()}
          </div>
          
          <div class="next-steps">
            <strong>What happens next:</strong>
            <ul style="text-align: left; margin-top: 10px;">
              <li>The user will receive a rejection notification email</li>
              <li>Their account has been removed from the system</li>
              <li>They can re-register if they wish to try again</li>
              <li>No further action is required from you</li>
            </ul>
          </div>
          
          <p><em>Thank you for reviewing this registration!</em></p>
        </div>
      </body>
      </html>
    `, { 
      status: 200, 
      headers: { 'Content-Type': 'text/html' } 
    });

  } catch (error) {
    console.error('Error rejecting user:', error);
    
    return new NextResponse(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Rejection Error</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            max-width: 600px; 
            margin: 50px auto; 
            padding: 20px; 
            background-color: #f8f9fa; 
          }
          .container { 
            background: white; 
            padding: 30px; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            text-align: center; 
          }
          .error-icon { font-size: 60px; margin-bottom: 20px; }
          h1 { color: #dc3545; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">❌</div>
          <h1>Rejection Failed</h1>
          <p>There was an error processing the user rejection.</p>
          <p>Please try again or contact the system administrator.</p>
          <p><strong>Error:</strong> ${error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </body>
      </html>
    `, { 
      status: 500, 
      headers: { 'Content-Type': 'text/html' } 
    });
  }
}