import { AIPromptProcessor } from '../ai-prompt-processor';

describe('AIPromptProcessor', () => {
  let processor: AIPromptProcessor;
  
  beforeEach(() => {
    processor = new AIPromptProcessor();
    
    // Reset all mocks
    jest.clearAllMocks();
  });
  
  describe('processPrompt', () => {
    it('should extract website name from prompt', async () => {
      const prompt = 'Create a CRM for small businesses with lead tracking';
      const result = await processor.processPrompt(prompt);
      
      expect(result.websiteName).toBeTruthy();
      expect(result.websiteName).not.toBe('My Website');
      expect(result.websiteName).not.toBe('Untitled Website');
    });
    
    it('should classify component-focused prompts as component', async () => {
      const prompt = 'Create a reusable hero component with a CTA button and background image';
      const result = await processor.processPrompt(prompt);

      expect(result.category).toBe('component');
    });

    it('should classify full page prompts as page', async () => {
      const prompt = 'Build a complete website for a coffee shop with menu and contact information';
      const result = await processor.processPrompt(prompt);

      expect(result.category).toBe('page');
    });
    
    it('should extract authentication feature', async () => {
      const prompt = 'A platform with user login and authentication';
      const result = await processor.processPrompt(prompt);
      
      expect(result.suggestedFeatures).toContain('authentication');
    });
    
    it('should extract payment feature', async () => {
      const prompt = 'An app with subscription billing and payment processing';
      const result = await processor.processPrompt(prompt);
      
      expect(result.suggestedFeatures).toContain('payments');
    });
    
    it('should extract multiple features', async () => {
      const prompt = 'A SaaS platform with user authentication, payment processing, analytics dashboard, and email notifications';
      const result = await processor.processPrompt(prompt);
      
      expect(result.suggestedFeatures).toContain('authentication');
      expect(result.suggestedFeatures).toContain('payments');
      expect(result.suggestedFeatures).toContain('analytics');
      expect(result.suggestedFeatures).toContain('notifications');
    });
    
    it('should identify target audience for small businesses', async () => {
      const prompt = 'CRM for small businesses and startups';
      const result = await processor.processPrompt(prompt);
      
      expect(result.targetAudience).toBe('small businesses');
    });
    
    it('should identify developer audience', async () => {
      const prompt = 'Developer productivity tools with code snippets';
      const result = await processor.processPrompt(prompt);
      
      expect(result.targetAudience).toBe('developers');
    });
    
    it('should extract technical requirements', async () => {
      const prompt = 'Real-time chat app with offline support and fast performance';
      const result = await processor.processPrompt(prompt);
      
      expect(result.technicalRequirements).toContain('real-time');
      expect(result.technicalRequirements).toContain('offline');
      expect(result.technicalRequirements).toContain('performance');
    });
    
    it('should handle empty prompt gracefully', async () => {
      const prompt = '';
      const result = await processor.processPrompt(prompt);
      
      expect(result.websiteName).toBe('Untitled Website');
      expect(result.category).toBe('page');
      expect(result.suggestedFeatures).toEqual([]);
    });

    it('derives website name from URL prompt', async () => {
      const prompt = 'Import https://parra.catholic.edu.au';
      const result = await processor.processPrompt(prompt);

      expect(result.websiteName).toBe('Parra Catholic');
    });

    it('derives website name from bare domain prompt', async () => {
      const prompt = 'Please import bathurstcitycentre.qicre.com';
      const result = await processor.processPrompt(prompt);

      expect(result.websiteName).toBe('Bathurstcitycentre Qicre');
    });
    
    it('should handle very long prompts', async () => {
      const longPrompt = 'A '.repeat(500) + 'website with features';
      const result = await processor.processPrompt(longPrompt);
      
      expect(result).toBeDefined();
      expect(result.websiteName).toBeTruthy();
    });
  });
  
  describe('createWebsiteFromPrompt', () => {
    beforeEach(() => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { pagesCreated: 3, populatedPages: 2, fallbackApplied: false } }),
      }) as jest.Mock;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'test-website-id' } }),
      });

      global.fetch = fetchMock;
    });

    it('should create import job when prompt contains a URL', async () => {
      const fetchMock = global.fetch as jest.Mock;
      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: 'job-123',
          websiteId: 'site-456',
          mode: 'new',
          state: 'active',
          message: 'Preparing import...',
          queuePosition: null,
          estimatedStartSeconds: null,
        }),
      });

      const result = await processor.createWebsiteFromPrompt('Import https://example.com now');

      expect(result.type).toBe('import');
      expect(result.job.id).toBe('job-123');
      expect(result.job.websiteId).toBe('site-456');
      expect(result.job.state).toBe('active');
      expect(result.job.status).toBe('pending');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/studio/import/start',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const [requestUrl, requestInit] = (global.fetch as jest.Mock).mock.calls[0];
      expect(requestUrl).toBe('/api/studio/import/start');
      const payload = JSON.parse((requestInit?.body as string) ?? '{}');
      expect(payload.websiteName).toBe('Example');
    });

    it('marks import jobs as queued when API responds with queued state', async () => {
      const fetchMock = global.fetch as jest.Mock;
      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: 'job-queue',
          websiteId: 'site-queue',
          mode: 'new',
          state: 'queued',
          message: 'Queued - position 2 in line',
          queuePosition: 2,
          estimatedStartSeconds: 240,
        }),
      });

      const result = await processor.createWebsiteFromPrompt('Import https://queued.example.com');

      expect(result.type).toBe('import');
      expect(result.job.status).toBe('queued');
      expect(result.job.state).toBe('queued');
      expect(result.job.queuePosition).toBe(2);
      expect(result.job.estimatedStartSeconds).toBe(240);
    });

    it('should create website with processed prompt data', async () => {
      const prompt = 'Create a CRM for small businesses';
      const result = await processor.createWebsiteFromPrompt(prompt);

      expect(result.type).toBe('ai');
      expect(result.websiteId).toBe('test-website-id');
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('/api/websites');
      expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe('/api/studio/site-builder/bootstrap');
    });

    it('should call API to create website', async () => {
      const prompt = 'Test website';
      await processor.createWebsiteFromPrompt(prompt);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('/api/websites');
      expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe('/api/studio/site-builder/bootstrap');
    });

    it('should save AI context with initial prompt', async () => {
      const prompt = 'E-commerce store with payment processing';
      await processor.createWebsiteFromPrompt(prompt);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);

      expect(body.metadata).toBeDefined();
      expect(body.metadata.createdViaAI).toBe(true);
      expect(body.metadata.originalPrompt).toBe(prompt);
    });

    it('should invoke bootstrap endpoint even when creation succeeds', async () => {
      const prompt = 'Photography portfolio site';
      await processor.createWebsiteFromPrompt(prompt);

      const calls = (global.fetch as jest.Mock).mock.calls;
      const bootstrapCall = calls.find(call => call[0] === '/api/studio/site-builder/bootstrap');
      expect(bootstrapCall).toBeDefined();
      expect(JSON.parse(bootstrapCall![1].body as string)).toMatchObject({
        websiteId: 'test-website-id',
        originalPrompt: prompt,
      });
    });

    it('should set appropriate theme based on category', async () => {
      const crmPrompt = 'CRM system for sales teams';
      await processor.createWebsiteFromPrompt(crmPrompt);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);

      expect(body.settings.theme).toBeDefined();
      expect(body.settings.theme.primary).toBe('#3B82F6');
    });

    it('should suggest appropriate tech stack', async () => {
      const prompt = 'Platform with user authentication and payment processing';
      await processor.createWebsiteFromPrompt(prompt);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);

      expect(body.settings.techStack).toContain('NextAuth.js');
      expect(body.settings.techStack).toContain('Stripe');
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: 'Failed to create website' } }),
      }) as jest.Mock;

      await expect(processor.createWebsiteFromPrompt('Test')).rejects.toThrow('Failed to create website');
    });
  });
  describe('Category Detection', () => {
    it('should classify prompts as page or component based on keywords', async () => {
      const testCases = [
        { prompt: 'Build a responsive marketing website for an analytics startup', expected: 'page' },
        { prompt: 'Reusable pricing table component with monthly and annual toggle', expected: 'component' },
        { prompt: 'Create a blog home page with featured posts and categories', expected: 'page' },
        { prompt: 'Navigation header component with dropdown menus', expected: 'component' },
      ];

      for (const testCase of testCases) {
        const result = await processor.processPrompt(testCase.prompt);
        expect(result.category).toBe(testCase.expected);
      }
    });
  });
  
  describe('Feature Extraction', () => {
    it('should extract all supported features', async () => {
      const featureMap = {
        'user authentication system': ['authentication'],
        'payment and billing': ['payments'],
        'email notifications': ['notifications'],
        'analytics and metrics': ['analytics'],
        'API integration': ['api'],
        'search functionality': ['search'],
        'chat messaging': ['messaging'],
        'image and video upload': ['media'],
        'contact forms': ['forms'],
        'calendar scheduling': ['calendar'],
        'map and location': ['maps'],
        'social sharing': ['social']
      };
      
      for (const [prompt, expectedFeatures] of Object.entries(featureMap)) {
        const result = await processor.processPrompt(prompt);
        for (const feature of expectedFeatures) {
          expect(result.suggestedFeatures).toContain(feature);
        }
      }
    });
  });
});


