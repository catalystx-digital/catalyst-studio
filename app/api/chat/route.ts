import { createAIModel } from '@/lib/studio/ai/ai-sdk-provider';
import { streamText, UIMessage, stepCountIs, convertToModelMessages } from 'ai';
import { tools as baseTools } from '@/lib/ai-tools/tools';
import { loadWebsiteContext, generateSystemPrompt } from '@/lib/ai-tools/context/context-provider';
import { getAuthContext } from '@/lib/auth/context';
import { prisma } from '@/lib/prisma';
import { checkAndRecordUsage, QuotaExceededError } from '@/lib/usage/limits';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, websiteId, selectedPageId, selectedPageLabel }: {
    messages: UIMessage[];
    websiteId?: string;
    selectedPageId?: string;
    selectedPageLabel?: string;
  } = await req.json();

  // Require auth
  let auth;
  try {
    auth = await getAuthContext(req as any);
  } catch (error) {
    console.error('[/api/chat] Auth error:', error);
    return new Response(JSON.stringify({ error: { message: 'Sign in required' } }), { status: 401 });
  }

  // TKT-088: Use helper that respects OPENROUTER_BASE_URL for xAI direct API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = createAIModel() as any;

  // Load context if websiteId is provided
  let system: string | undefined;
  try {
    if (websiteId) {
      const site = await prisma.website.findUnique({
        where: { id: websiteId },
        select: { accountId: true }
      });
      if (!site?.accountId || site.accountId !== auth.accountId) {
        return new Response(JSON.stringify({ error: { message: 'Forbidden' } }), { status: 403 });
      }

      const context = await loadWebsiteContext(websiteId, {
        includeComponentLibrary: true
      });
      system = await generateSystemPrompt(context);
      // Enhance system prompt to include websiteId
      system = `${system}\n\nIMPORTANT: When using tools that require a websiteId parameter, use: ${websiteId}`;

      // If a page is selected, look up its site structure to provide parent context
      // Note: selectedPageId is actually the WebsiteStructure.id (node ID in React Flow)
      if (selectedPageId) {
        const websiteStructure = await prisma.websiteStructure.findFirst({
          where: {
            id: selectedPageId,
            websiteId
          },
          select: { id: true, fullPath: true }
        });
        if (websiteStructure) {
          // Add selected page context to system prompt
          system = `${system}\n\n=== SELECTED PAGE CONTEXT ===\nThe user has selected the page "${selectedPageLabel || 'Untitled'}" (siteStructureId: ${websiteStructure.id}, path: ${websiteStructure.fullPath}).\n\nCRITICAL: When the user asks to "add a child page" or "create a page under this one" or similar, you MUST use parentId: "${websiteStructure.id}" in the createPage tool call. This ensures the new page is created as a CHILD of the selected page, not as a sibling at the root level.\n\nExample: If user says "add a contact page as a child", call createPage with parentId: "${websiteStructure.id}"\n=== END SELECTED PAGE CONTEXT ===`;
        }
      }
    }
  } catch (error) {
    console.error('Failed to load website context:', error);
    // Continue without context rather than failing the request
  }

  // Wrap tools to inject websiteId when needed
  const tools = Object.entries(baseTools).reduce((acc, [key, tool]) => {
    // Create a wrapped version of the tool that automatically includes websiteId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolAny = tool as any;
    (acc as any)[key] = {
      ...tool,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: async (args: any, context?: any) => {
        // If the tool has a websiteId parameter and it's not provided, inject it
        // Check both 'parameters' (old SDK) and 'inputSchema' (new SDK)
        const schema = toolAny.parameters || toolAny.inputSchema;
        if (websiteId && schema && schema.shape && 'websiteId' in schema.shape && !args.websiteId) {
          args = { ...args, websiteId };
        }
        return toolAny.execute(args, context);
      }
    };
    return acc;
  }, {} as typeof baseTools);

  // Rate limit chat sessions (record session count before API call)
  try {
    await checkAndRecordUsage(prisma, auth.accountId, 'chat_sessions', 1, {
      metadata: {
        websiteId: websiteId ?? null,
        messageCount: (messages || []).length,
      },
    });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return new Response(
        JSON.stringify({ error: { message: error.message, code: error.code, details: error.details } }),
        { status: error.statusCode }
      );
    }
    return new Response(JSON.stringify({ error: { message: 'Chat usage limit reached' } }), { status: 429 });
  }

  console.log('[chat] Starting streamText with', messages.length, 'messages');
  console.log('[chat] System prompt length:', system?.length ?? 0);
  console.log('[chat] Tools count:', Object.keys(tools).length);

  const result = streamText({
    model,
    // AI SDK v5: Convert UIMessages from client to ModelMessages for streamText
    messages: convertToModelMessages(messages),
    system,
    tools: tools,
    toolChoice: 'auto',
    // Enable multi-step tool use: model can call tools and continue generating
    // until it produces a text response (or hits maxSteps limit).
    // AI SDK v5 defaults stopWhen to stepCountIs(1), so we must explicitly
    // set it to allow multiple steps for tool execution -> response flow.
    stopWhen: stepCountIs(5),
    onStepFinish: ({ text, finishReason, usage, toolCalls }) => {
      console.log('[chat] Step finished:', {
        textLength: text?.length ?? 0,
        finishReason,
        toolCallsCount: toolCalls?.length ?? 0,
        usage
      });
    },
    onFinish: async ({ text, finishReason, usage, steps }) => {
      console.log('[chat] Stream finished:', {
        textLength: text?.length ?? 0,
        finishReason,
        usage,
        stepsCount: steps?.length ?? 0
      });

      // Record actual token usage from LLM response
      if (usage && typeof usage.totalTokens === 'number' && usage.totalTokens > 0) {
        try {
          await checkAndRecordUsage(prisma, auth.accountId, 'chat_tokens', usage.totalTokens, {
            metadata: {
              websiteId: websiteId ?? null,
              inputTokens: usage.inputTokens ?? 0,
              outputTokens: usage.outputTokens ?? 0,
              totalTokens: usage.totalTokens,
            },
          });
        } catch (error) {
          console.error('[chat] Failed to record token usage:', error);
          // Don't fail the request if usage recording fails
        }
      }
    },
  });

  console.log('[chat] Returning streaming response');
  // Use toUIMessageStreamResponse for full message parts support including reasoning
  // This is compatible with @ai-sdk/react v1.x using default data stream protocol
  // sendReasoning: true allows frontend to optionally display reasoning in collapsible UI
  return result.toUIMessageStreamResponse({
    sendReasoning: true,  // Send reasoning as separate message parts for optional UI display
  });
}
