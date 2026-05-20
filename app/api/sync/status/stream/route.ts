import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth/context';

export async function GET(request: NextRequest) {
  // Auth check - always required
  try {
    await getAuthContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const deploymentId = searchParams.get('deploymentId');

  if (!deploymentId) {
    return NextResponse.json(
      { error: 'Deployment ID required for streaming' },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  
  // Create a new readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      let previousState: Record<string, unknown> | null = null;
      
      // Function to send SSE event
      const sendEvent = (event: string, data: Record<string, unknown>) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };
      
      // Send initial connection message
      sendEvent('connected', { message: 'Connected to deployment stream' });
      
      // Function to check deployment status
      const checkStatus = async () => {
        try {
          const deployment = await prisma.deployment.findUnique({
            where: { id: deploymentId }
          });
          
          if (!deployment) {
            sendEvent('error', { message: 'Deployment not found' });
            clearInterval(intervalId);
            controller.close();
            return;
          }
          
          const deploymentData = deployment.deploymentData as Record<string, unknown> || {};
          
          // Check if state has changed
          const currentState = {
            status: deployment.status,
            progress: (typeof deploymentData.progress === 'number' ? deploymentData.progress : 0) || 0,
            currentStep: (typeof deploymentData.currentStep === 'string' ? deploymentData.currentStep : '') || '',
            totalSteps: (typeof deploymentData.totalSteps === 'number' ? deploymentData.totalSteps : 0) || 0,
            itemsProcessed: deploymentData.itemsProcessed,
            totalItems: deploymentData.totalItems
          };
          
          // Only send update if state has changed
          if (JSON.stringify(currentState) !== JSON.stringify(previousState)) {
            sendEvent('update', currentState);
            previousState = currentState;
            
            // Check if deployment is complete
            if (deployment.status === 'completed') {
              sendEvent('complete', { 
                message: 'Deployment completed successfully',
                finalProgress: currentState.progress 
              });
              clearInterval(intervalId);
              controller.close();
            } else if (deployment.status === 'failed') {
              sendEvent('error', { 
                message: deployment.errorMessage || 'Deployment failed',
                finalProgress: currentState.progress 
              });
              clearInterval(intervalId);
              controller.close();
            }
          }
        } catch (error) {
          console.error('Error checking deployment status:', error);
          sendEvent('error', { message: 'Failed to check status' });
          clearInterval(intervalId);
          controller.close();
        }
      };
      
      // Send initial status
      await checkStatus();
      
      // Poll every 1 second
      const intervalId = setInterval(checkStatus, 1000);
      
      // Setup heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30000);
      
      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        clearInterval(heartbeatInterval);
        controller.close();
      });
    }
  });

  // Return SSE response with proper headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
}