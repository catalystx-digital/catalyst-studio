import { NextRequest, NextResponse } from 'next/server';
import { redirectService } from '@/lib/services/redirect-service';
import { ErrorCode, StandardResponse } from '@/lib/services/types';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

export async function POST(request: NextRequest) {
  // Auth check - always required
  let auth;
  try {
    auth = await getAuthContext(request);
  } catch {
    return NextResponse.json({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Unauthorized'
      }
    } as StandardResponse<null>, { status: 401 });
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.websiteId || !Array.isArray(body.redirects)) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'websiteId and redirects array are required',
          details: { 
            required: ['websiteId', 'redirects'],
            received: Object.keys(body)
          }
        }
      } as StandardResponse<null>, { status: 400 });
    }

    // Validate each redirect
    for (const redirect of body.redirects) {
      if (!redirect.sourcePath || !redirect.targetPath || !redirect.redirectType) {
        return NextResponse.json({
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Each redirect must have sourcePath, targetPath, and redirectType',
            details: { invalid: redirect }
          }
        } as StandardResponse<null>, { status: 400 });
      }

      if (redirect.redirectType !== 301 && redirect.redirectType !== 302) {
        return NextResponse.json({
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'redirectType must be either 301 or 302',
            details: { invalid: redirect }
          }
        } as StandardResponse<null>, { status: 400 });
      }
    }

    // Verify ownership
    await assertWebsiteOwnership(prisma as any, auth.accountId, body.websiteId);

    const result = await redirectService.bulkImportRedirects(body.websiteId, body.redirects);

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    // Return 207 Multi-Status if there were partial failures
    const statusCode = result.data?.failed && result.data.failed > 0 ? 207 : 201;
    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    console.error('Error bulk importing redirects:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to bulk import redirects',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    } as StandardResponse<null>, { status: 500 });
  }
}