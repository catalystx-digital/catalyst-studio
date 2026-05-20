
import { isStudioDeployment, getStudioEntryRoute, getStudioWebsiteRoute } from '../deployment';

describe('deployment config', () => {
  it('always returns true for isStudioDeployment (legacy routes removed)', () => {
    expect(isStudioDeployment()).toBe(true);
  });

  it('returns studio site-builder route for entry', () => {
    expect(getStudioEntryRoute()).toBe('/studio/site-builder');
  });

  it('returns studio route with websiteId query param', () => {
    expect(getStudioWebsiteRoute('site-123')).toBe('/studio/site-builder?websiteId=site-123');
  });

  it('returns entry route when websiteId is empty', () => {
    expect(getStudioWebsiteRoute('')).toBe('/studio/site-builder');
  });

  it('includes additional query params when provided', () => {
    const result = getStudioWebsiteRoute('site-123', {
      query: { importJobId: 'job-456', tab: 'content' }
    });
    expect(result).toBe('/studio/site-builder?websiteId=site-123&importJobId=job-456&tab=content');
  });
});
