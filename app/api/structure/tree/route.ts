import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { StructureService } from '@/lib/services/structure-service';
import { StructureNode } from '@/lib/services/interfaces/structure-service.interface';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

// GET /api/structure/tree - Get full hierarchy tree
export async function GET(request: NextRequest) {
  // Auth check - always required
  let auth;
  try {
    auth = await getAuthContext(request);
  } catch {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('websiteId');
    const rootId = searchParams.get('rootId');
    const maxDepth = parseInt(searchParams.get('maxDepth') || '10');

    if (!websiteId) {
      return NextResponse.json(
        { error: { message: 'websiteId is required' } },
        { status: 400 }
      );
    }

    // Verify ownership
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);

    const structureService = new StructureService(prisma);
    
    // Get the tree structure (getStructureTree only takes websiteId)
    const tree = await structureService.getStructureTree(websiteId);
    
    // Helper function to limit tree depth
    const limitDepth = (node: StructureNode, currentDepth: number = 0): StructureNode => {
      if (currentDepth >= maxDepth) {
        return { ...node, children: [] };
      }
      
      return {
        ...node,
        children: node.children?.map((child: StructureNode) => 
          limitDepth(child, currentDepth + 1)
        ) || []
      };
    };

    const limitedTree = tree.map(node => limitDepth(node));

    return NextResponse.json({
      data: limitedTree,
      websiteId,
      rootId,
      maxDepth
    });
  } catch (error) {
    console.error('[API Error] GET /api/structure/tree:', error);
    
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}