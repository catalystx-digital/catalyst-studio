/**
 * Simple test to debug tool imports
 */

describe('Tool Import Debug', () => {
  it('should import tools module', () => {
    const toolsModule = require('@/lib/ai-tools/tools/index');
    console.log('Module exports:', Object.keys(toolsModule));
    expect(toolsModule).toBeDefined();
  });

  it('should have tools and allTools exports', () => {
    const { tools, allTools } = require('@/lib/ai-tools/tools/index');
    console.log('tools:', tools);
    console.log('allTools:', allTools);
    expect(tools || allTools).toBeDefined();
  });

  it('should import individual tool modules', () => {
    const websiteTools = require('@/lib/ai-tools/tools/website/index');
    console.log('Website tools:', Object.keys(websiteTools));
    expect(websiteTools).toBeDefined();
  });

  it('should import a specific tool file', () => {
    const { getWebsiteContext } = require('@/lib/ai-tools/tools/website/get-website-context');
    console.log('getWebsiteContext type:', typeof getWebsiteContext);
    expect(getWebsiteContext).toBeDefined();
  });
});