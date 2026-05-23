/**
 * Component Factory Initialization
 * 
 * This file handles the initialization and registration of all CMS components.
 * Separated from the factory to avoid circular dependencies.
 */

import { loadAllDefinitions } from '../_core/definition-loader';

// Import registration functions that will register components with the factory
export async function initializeCMSComponents(): Promise<void> {
  // Load all *.def.ts component definitions first
  await loadAllDefinitions();

  // Dynamically import registration modules to register components
  // These imports are intentionally async to avoid circular dependency issues
  await Promise.all([
    import('../content/register'),
    import('../navigation/register'),
    import('../heroes/register'),
    import('../features/register'),
    import('../cta/register'),
    import('../social-proof/register'),
    import('../about/register'),
    import('../blog/register'),
    import('../contact/register'),
    import('../data/register'),
    import('../pricing/register')
  ]);
}

// Auto-initialize only in browser context and not during build
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  initializeCMSComponents().catch(error => {
    if (process.env.NODE_ENV === 'development') {
    console.error('Failed to initialize CMS components:', error);
    }
  });
}
