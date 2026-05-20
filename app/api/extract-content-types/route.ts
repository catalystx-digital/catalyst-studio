import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

export async function GET(request: NextRequest) {
  // Auth check - always required
  let auth;
  try {
    auth = await getAuthContext(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get websiteId from query parameters
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('websiteId');

    // Verify ownership if websiteId is provided
    if (websiteId) {
      await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);
    }

    // Query both content types and component types in parallel
    const [contentTypes, componentTypes] = await Promise.all([
      prisma.contentType.findMany({
        where: websiteId ? { websiteId } : undefined,
        include: {
          website: true
        }
      }),
      prisma.websiteComponentType.findMany({
        where: websiteId ? { websiteId } : undefined
      })
    ]);
    
    // Transform page content types
    const pageTypes = contentTypes.map((type) => ({
      id: type.id || type.name.toLowerCase().replace(/\s+/g, '_'),
      name: type.name,
      fields: type.fields || []
    }));

    // Transform component types
    const componentTypeResults = componentTypes.map((wct) => ({
      id: wct.id || wct.type.toLowerCase().replace(/\s+/g, '_'),
      name: wct.type, // Use component type (e.g., "navbar", "hero-banner")
      fields: {
        defaultConfig: wct.defaultConfig,
        placeholderData: wct.placeholderData,
        styles: wct.styles,
        aiMetadata: wct.aiMetadata,
        version: wct.version,
        isGlobal: wct.isGlobal
      }
    }));

    // Combine both types
    const types = [...pageTypes, ...componentTypeResults];
    
    return NextResponse.json({ success: true, data: types });
  } catch (error) {
    // Log error for monitoring in production
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to extract content types:', error);
    }
    
    // Return proper error message to client
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to extract content types from database';
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: 'Unable to retrieve content types. Please ensure the database is connected and contains valid data.'
      },
      { status: 500 }
    );
  }
}