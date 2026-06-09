import { NextRequest, NextResponse } from 'next/server';

// This route reads request.nextUrl and sends emails; mark it dynamic
export const dynamic = 'force-dynamic';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
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

    // Get user data
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

    // Check if user is already verified
    if (userData.isVerified) {
      return new NextResponse(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Already Approved</title>
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
            .info-icon { font-size: 60px; margin-bottom: 20px; }
            h1 { color: #ffc107; margin-bottom: 20px; }
            .user-info { 
              background: #f8f9fa; 
              padding: 20px; 
              border-radius: 5px; 
              margin: 20px 0; 
              text-align: left; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="info-icon">ℹ️</div>
            <h1>User Already Approved</h1>
            <p>This user has already been approved and can access the system.</p>
            <div class="user-info">
              <strong>User Details:</strong><br>
              Username: ${userData.username}<br>
              Email: ${userData.email}<br>
              Role: ${userData.role?.toUpperCase()}<br>
              Status: ✅ Approved
            </div>
            <p><em>No further action is required.</em></p>
          </div>
        </body>
        </html>
      `, { 
        status: 200, 
        headers: { 'Content-Type': 'text/html' } 
      });
    }

    // Update user verification status
    await updateDoc(userRef, {
      isVerified: true,
      approvedAt: new Date().toISOString(),
      approvedBy: 'admin'
    });

    // Send approval notification to user
    try {
      const response = await fetch(`${request.nextUrl.origin}/api/send-approval-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          action: 'approved',
          userData: {
            username: userData.username,
            email: userData.email,
            role: userData.role
          }
        })
      });

      if (!response.ok) {
        console.error('Failed to send approval notification email');
      }
    } catch (emailError) {
      console.error('Error sending approval notification:', emailError);
    }

    // Return success page
    return new NextResponse(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>User Approved Successfully</title>
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
          .success-icon { font-size: 60px; margin-bottom: 20px; }
          h1 { color: #28a745; margin-bottom: 20px; }
          .user-info { 
            background: #d4edda; 
            border: 1px solid #c3e6cb; 
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
          <div class="success-icon">✅</div>
          <h1>User Approved Successfully!</h1>
          <p>The user has been approved and can now access the Warehouse Management System.</p>
          
          <div class="user-info">
            <strong>Approved User Details:</strong><br>
            Username: ${userData.username}<br>
            Email: ${userData.email}<br>
            Role: ${userData.role?.toUpperCase()}<br>
            Approved At: ${new Date().toLocaleString()}
          </div>
          
          <div class="next-steps">
            <strong>What happens next:</strong>
            <ul style="text-align: left; margin-top: 10px;">
              <li>The user will receive an approval notification email</li>
              <li>They can now log in to the system immediately</li>
              <li>Full access to their assigned role features is granted</li>
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
    console.error('Error approving user:', error);
    
    return new NextResponse(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Approval Error</title>
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
          <h1>Approval Failed</h1>
          <p>There was an error processing the user approval.</p>
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