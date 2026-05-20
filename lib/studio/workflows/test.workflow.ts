import { sleep } from "workflow";

/**
 * Test workflow to verify Vercel Workflow SDK setup.
 * This is a simple POC that demonstrates the basic workflow structure.
 */
export async function testWorkflow(message: string) {
  "use workflow";

  const result = await testStep(message);
  await sleep("1s");

  return { success: true, message: result };
}

async function testStep(message: string) {
  "use step";
  return `Processed: ${message}`;
}
