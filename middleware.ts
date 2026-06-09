import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Add paths that don't require authentication
const publicPaths = new Set([
  '/login',
  '/register',
  '/_next',               // Next.js assets
  '/favicon.ico',         // Favicon
]);

// Define role-based route access
const roleBasedRoutes: Record<string, Set<string>> = {
  maker: new Set([
    '/dashboard',
    '/surveys',              // Added surveys access for makers
    '/surveys/inspection-creation',
    '/surveys/warehouse-creation',
    '/inward',
    '/outward',
    '/delivery-order',
    '/ro',
    '/reports',
    '/commodity-summary',
    '/aum-summary'
  ]),
  checker: new Set([
    '/dashboard',
    '/surveys',
    '/surveys/inspection-creation',
    '/surveys/warehouse-creation',
    '/inward',
    '/outward',
    '/reports',
    '/delivery-order',
    '/ro',
    '/master-data',
    '/master-data/clients',
    '/master-data/commodities',
    '/master-data/banks',
    '/master-data/branches',
    '/commodity-summary',
    '/aum-summary'
  ]),
  admin: new Set([
    '/dashboard',
    '/master-data',
    '/master-data/clients',
    '/master-data/commodities',
    '/master-data/banks',
    '/master-data/branches',
    '/reports',
    '/surveys',
    '/surveys/inspection-creation',
    '/surveys/warehouse-creation',
    '/inward',
    '/outward',
    '/ro',
    '/commodity-summary',
    '/aum-summary',
    '/admin',
    '/admin/users'
  ]),
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the path is public
  if (publicPaths.has(pathname) || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  // Check for user in localStorage (this will be handled client-side)
  return NextResponse.next();
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
