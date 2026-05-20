# CMS Components Troubleshooting Guide

## Common Issues and Solutions

### 🔴 Build Errors

#### Component Not Found
**Error**: `Module not found: Can't resolve '@/lib/studio/components/cms/...`

**Solution**:
1. Check file exists at specified path
2. Verify import path is correct
3. Ensure TypeScript paths are configured in `tsconfig.json`
4. Clear Next.js cache: `rm -rf .next`

#### TypeScript Errors
**Error**: `Type 'X' is not assignable to type 'Y'`

**Solution**:
1. Check component implements `CMSComponentProps` interface
2. Verify all required props are provided
3. Update type definitions if interface changed
4. Run `npm run cms:build` to check types

#### Bundle Size Exceeded
**Error**: `Warning: Bundle size exceeds 10KB limit`

**Solution**:
1. Check for unnecessary dependencies
2. Use dynamic imports for large libraries
3. Enable tree shaking in webpack config
4. Run `npm run cms:analyze` to identify large modules

### 🟡 Runtime Errors

#### Component Not Rendering
**Issue**: Component doesn't appear on page

**Checklist**:
- [ ] Component registered in factory?
- [ ] Props passed correctly?
- [ ] No errors in console?
- [ ] Component exported from index file?

**Debug**:
```typescript
console.log('Component props:', props);
console.log('Component rendered:', document.querySelector('.cms-component'));
```

#### Performance Issues
**Issue**: Component renders slowly

**Solutions**:
1. Profile with React DevTools
2. Check for unnecessary re-renders
3. Implement memoization
4. Use lazy loading for heavy components

**Code**:
```typescript
const MemoizedComponent = React.memo(Component, (prev, next) => {
  return prev.id === next.id && prev.content === next.content;
});
```

#### Hydration Mismatch
**Error**: `Warning: Text content did not match`

**Solutions**:
1. Ensure server and client render same content
2. Avoid using `Math.random()` or `Date.now()` in render
3. Use `useEffect` for client-only code
4. Check for conditional rendering based on `window`

### 🔵 Testing Issues

#### Tests Failing
**Error**: `Test suite failed to run`

**Solutions**:
1. Ensure setup file is configured: `setupFilesAfterEnv`
2. Check all mocks are properly defined
3. Verify test environment is `jsdom`
4. Clear Jest cache: `jest --clearCache`

#### Coverage Not Met
**Issue**: Coverage below 85% threshold

**Solutions**:
1. Add missing test cases
2. Test error boundaries
3. Cover edge cases
4. Test all component variants

**Example**:
```typescript
describe('Component', () => {
  it('handles null content', () => {
    render(<Component content={null} />);
    // Assertions
  });
  
  it('handles error state', () => {
    // Test error boundary
  });
});
```

#### Visual Regression Failures
**Issue**: Visual tests detecting differences

**Solutions**:
1. Review diff images in `test-results/`
2. Update baselines if changes intended: `--update-snapshots`
3. Check for font loading issues
4. Verify animations are disabled in tests

### 🟢 Development Issues

#### Storybook Not Loading
**Issue**: Storybook shows blank page

**Solutions**:
1. Check for build errors: `npm run build-storybook`
2. Clear Storybook cache: `rm -rf node_modules/.cache/storybook`
3. Verify story file exports default meta
4. Check browser console for errors

#### Hot Reload Not Working
**Issue**: Changes not reflected immediately

**Solutions**:
1. Check file is in watched directory
2. Restart dev server: `npm run dev`
3. Clear Next.js cache
4. Verify no syntax errors blocking compilation

#### Git Hooks Failing
**Issue**: Pre-commit hooks blocking commits

**Solutions**:
1. Run hooks manually to see errors: `.husky/pre-commit`
2. Fix placement/import violations
3. Bypass temporarily (not recommended): `git commit --no-verify`
4. Update hook permissions: `chmod +x .husky/*`

### 🟣 Import/Export Issues

#### Circular Dependencies
**Error**: `Circular dependency detected`

**Solutions**:
1. Identify cycle with webpack analyzer
2. Extract shared code to separate module
3. Use dynamic imports to break cycle
4. Refactor component structure

#### Import Path Violations
**Error**: `Studio components should not import from common`

**Solutions**:
1. Use studio paths: `@/lib/studio/components/cms/`
2. Only import from `@/components/ui/` for common UI
3. Check ESLint rules in `.eslintrc.js`
4. Run `npm run lint` to find violations

### ⚫ Performance Issues

#### Slow Component Load
**Issue**: Component takes long to appear

**Diagnosis**:
```typescript
// Add performance logging
useEffect(() => {
  performance.mark('component-mount');
  console.log('Mount time:', performance.now());
}, []);
```

**Solutions**:
1. Implement lazy loading
2. Optimize bundle size
3. Use React.Suspense with fallback
4. Preload critical components

#### Memory Leaks
**Issue**: Memory usage increases over time

**Solutions**:
1. Clean up event listeners in useEffect
2. Cancel async operations on unmount
3. Clear timers and intervals
4. Unsubscribe from observables

**Pattern**:
```typescript
useEffect(() => {
  const timer = setTimeout(() => {}, 1000);
  
  return () => {
    clearTimeout(timer);
  };
}, []);
```

### 🔧 Configuration Issues

#### ESLint Errors
**Issue**: Linting failures

**Solutions**:
1. Run autofix: `npx eslint --fix`
2. Check rule configuration
3. Add rule exceptions if justified
4. Update ESLint config for new patterns

#### TypeScript Config
**Issue**: Path aliases not working

**Solutions**:
1. Verify `tsconfig.json` paths configuration
2. Restart TypeScript service in IDE
3. Clear TypeScript cache
4. Check baseUrl is set correctly

### 📱 Responsive Issues

#### Component Breaking on Mobile
**Issue**: Layout broken on small screens

**Solutions**:
1. Use responsive utilities: `sm:`, `md:`, `lg:`
2. Test in Storybook viewport addon
3. Avoid fixed widths
4. Use flexbox/grid for layouts

**Example**:
```tsx
<div className="
  flex flex-col sm:flex-row
  gap-2 sm:gap-4
  p-2 sm:p-4
">
```

### 🎨 Styling Issues

#### Styles Not Applied
**Issue**: Tailwind classes not working

**Solutions**:
1. Check class names are spelled correctly
2. Verify Tailwind config includes component path
3. Ensure PostCSS is configured
4. Check for CSS purging in production

#### Dark Mode Issues
**Issue**: Component doesn't respect dark mode

**Solutions**:
1. Use `dark:` variant for dark styles
2. Check theme prop is passed
3. Verify `dark` class on root element
4. Test in Storybook with theme switcher

### 🚀 Deployment Issues

#### Production Build Fails
**Issue**: Build works locally but fails in CI

**Solutions**:
1. Check environment variables
2. Ensure all dependencies in `package.json`
3. Verify Node.js version matches
4. Clear cache in CI pipeline

#### Component Not Working in Production
**Issue**: Works in dev but not production

**Solutions**:
1. Check for dev-only code
2. Verify environment variables
3. Test production build locally: `npm run build && npm start`
4. Check for console errors in production

## Debug Commands

### Useful Commands
```bash
# Check types
npm run cms:build

# Analyze bundle
npm run cms:analyze

# Run specific test
npm run cms:test -- --testNamePattern="ComponentName"

# Debug Storybook
npm run cms:storybook -- --debug-webpack

# Check for circular dependencies
npx madge --circular lib/studio/components/cms

# Find large modules
npx webpack-bundle-analyzer .next/stats.json
```

### Environment Variables
```bash
# Enable debug logging
DEBUG=cms:* npm run dev

# Disable performance monitoring
DISABLE_PERF_MONITORING=true npm run dev

# Force development mode
NODE_ENV=development npm run build
```

## Getting Help

### Internal Resources
- Check [DEVELOPMENT.md](./DEVELOPMENT.md) for guidelines
- Review [README.md](./README.md) for setup
- Look at existing components for patterns

### External Resources
- [Next.js Debugging](https://nextjs.org/docs/debugging)
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [TypeScript Errors](https://typescript.tv/errors/)
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

### Reporting Issues
1. Check existing issues first
2. Provide minimal reproduction
3. Include error messages
4. Specify environment details
5. Attach relevant code snippets