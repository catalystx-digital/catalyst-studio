import { NextRequest, NextResponse } from 'next/server';
import { redirectService } from '@/lib/services/redirect-service';
import { ErrorCode, StandardResponse } from '@/lib/services/types';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: 'Unauthorized'
        }
      } as StandardResponse<null>, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('websiteId');
    const isActive = searchParams.get('isActive');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    if (!websiteId) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'websiteId is required'
        }
      } as StandardResponse<null>, { status: 400 });
    }

    // Verify ownership
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);

    const result = await redirectService.listRedirects(websiteId, {
      isActive: isActive !== null ? isActive === 'true' : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing redirects:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to list redirects',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    } as StandardResponse<null>, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: 'Unauthorized'
        }
      } as StandardResponse<null>, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.websiteId || !body.sourcePath || !body.targetPath || !body.redirectType) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Missing required fields',
          details: {
            required: ['websiteId', 'sourcePath', 'targetPath', 'redirectType'],
            received: Object.keys(body)
          }
        }
      } as StandardResponse<null>, { status: 400 });
    }

    // Verify ownership
    await assertWebsiteOwnership(prisma as any, auth.accountId, body.websiteId);

    // Validate redirect type
    if (body.redirectType !== 301 && body.redirectType !== 302) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'redirectType must be either 301 or 302',
          details: { redirectType: body.redirectType }
        }
      } as StandardResponse<null>, { status: 400 });
    }

    const result = await redirectService.createRedirect({
      websiteId: body.websiteId,
      sourcePath: body.sourcePath,
      targetPath: body.targetPath,
      redirectType: body.redirectType,
      isActive: body.isActive
    });

    if (!result.success) {
      const statusCode = result.error?.code === ErrorCode.CONFLICT ? 409 : 400;
      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating redirect:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to create redirect',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    } as StandardResponse<null>, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: 'Unauthorized'
        }
      } as StandardResponse<null>, { status: 401 });
    }

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'id is required'
        }
      } as StandardResponse<null>, { status: 400 });
    }

    // Look up the redirect to find its websiteId for ownership check
    const redirect = await prisma.websiteRedirect.findUnique({
      where: { id: body.id },
      select: { websiteId: true }
    });
    if (!redirect) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'Redirect not found'
        }
      } as StandardResponse<null>, { status: 404 });
    }
    await assertWebsiteOwnership(prisma as any, auth.accountId, redirect.websiteId);

    // Validate redirect type if provided
    if (body.redirectType && body.redirectType !== 301 && body.redirectType !== 302) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'redirectType must be either 301 or 302',
          details: { redirectType: body.redirectType }
        }
      } as StandardResponse<null>, { status: 400 });
    }

    const result = await redirectService.updateRedirect({
      id: body.id,
      sourcePath: body.sourcePath,
      targetPath: body.targetPath,
      redirectType: body.redirectType,
      isActive: body.isActive
    });

    if (!result.success) {
      const statusCode = result.error?.code === ErrorCode.NOT_FOUND ? 404 : 400;
      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating redirect:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to update redirect',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    } as StandardResponse<null>, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: 'Unauthorized'
        }
      } as StandardResponse<null>, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'id is required'
        }
      } as StandardResponse<null>, { status: 400 });
    }

    // Look up the redirect to find its websiteId for ownership check
    const redirect = await prisma.websiteRedirect.findUnique({
      where: { id },
      select: { websiteId: true }
    });
    if (!redirect) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'Redirect not found'
        }
      } as StandardResponse<null>, { status: 404 });
    }
    await assertWebsiteOwnership(prisma as any, auth.accountId, redirect.websiteId);

    const result = await redirectService.deleteRedirect(id);

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error deleting redirect:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to delete redirect',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    } as StandardResponse<null>, { status: 500 });
  }
}