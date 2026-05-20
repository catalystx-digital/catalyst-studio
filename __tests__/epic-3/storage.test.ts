// This test file is deprecated as we've moved from localStorage/IndexedDB to API-only approach
// The WebsiteStorageService has been removed in favor of React Query hooks (useWebsites, useWebsite, etc.)

describe.skip('WebsiteStorageService - REMOVED (migrated to API-only approach)', () => {
  // WebsiteStorageService has been completely removed
  // All tests below are preserved for historical reference only
  
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset mock
    jest.clearAllMocks();
    service = new WebsiteStorageService();
  });
  
  afterEach(() => {
    // Clean up after tests
    localStorage.clear();
  });
  
  describe('Multi-Website Operations', () => {
    test('should create multiple websites with unique IDs', async () => {
      const website1 = await service.createWebsite({ name: 'Site 1' });
      const website2 = await service.createWebsite({ name: 'Site 2' });
      
      expect(website1).not.toBe(website2);
      
      const websites = await service.listWebsites();
      expect(websites).toHaveLength(2);
      expect(websites[0].name).toBe('Site 1');
      expect(websites[1].name).toBe('Site 2');
    });
    
    test('should isolate data between websites', async () => {
      const id1 = await service.createWebsite({ name: 'Site 1' });
      const id2 = await service.createWebsite({ name: 'Site 2' });
      
      await service.saveWebsiteData(id1, { content: 'Content 1' });
      await service.saveWebsiteData(id2, { content: 'Content 2' });
      
      const data1 = await service.getWebsiteData(id1);
      const data2 = await service.getWebsiteData(id2);
      
      expect(data1.content).toBe('Content 1');
      expect(data2.content).toBe('Content 2');
    });
    
    test('should handle storage quota warnings', async () => {
      const quotaStatus = await service.checkStorageQuota();
      expect(quotaStatus).toHaveProperty('usage');
      expect(quotaStatus).toHaveProperty('quota');
      expect(quotaStatus).toHaveProperty('percentage');
      expect(typeof quotaStatus.usage).toBe('number');
      expect(typeof quotaStatus.quota).toBe('number');
      expect(typeof quotaStatus.percentage).toBe('number');
    });
    
    test('should update website metadata', async () => {
      const id = await service.createWebsite({ name: 'Test Site' });
      
      await service.updateWebsiteMetadata(id, {
        name: 'Updated Site',
        description: 'Updated description'
      });
      
      const websites = await service.listWebsites();
      const website = websites.find(w => w.id === id);
      
      expect(website?.name).toBe('Updated Site');
      expect(website?.description).toBe('Updated description');
    });
    
    test('should delete websites correctly', async () => {
      const id1 = await service.createWebsite({ name: 'Site 1' });
      const id2 = await service.createWebsite({ name: 'Site 2' });
      
      let websites = await service.listWebsites();
      expect(websites).toHaveLength(2);
      
      await service.deleteWebsite(id1);
      
      websites = await service.listWebsites();
      expect(websites).toHaveLength(1);
      expect(websites[0].id).toBe(id2);
    });
    
    test('should handle website not found errors', async () => {
      await expect(service.getWebsiteData('non-existent-id')).rejects.toThrow('Website not found');
      await expect(service.deleteWebsite('non-existent-id')).rejects.toThrow('Website not found');
    });
  });
  
  describe('Migration', () => {
    test('should migrate single-website data', async () => {
      // Setup legacy data
      localStorage.setItem('catalyst_website', JSON.stringify({
        name: 'Legacy Site',
        content: 'Legacy Content',
        theme: 'dark',
        settings: {
          autoSave: true
        }
      }));
      
      await service.migrateFromSingleWebsite();
      
      const websites = await service.listWebsites();
      expect(websites).toHaveLength(1);
      expect(websites[0].id).toBe('default');
      expect(websites[0].name).toBe('Legacy Site');
      
      const data = await service.getWebsiteData('default');
      expect(data.content).toBe('Legacy Content');
      expect(data.theme).toBe('dark');
      expect(data.settings?.autoSave).toBe(true);
    });
    
    test('should not migrate if multi-website data already exists', async () => {
      // Create a website first
      await service.createWebsite({ name: 'Existing Site' });
      
      // Add legacy data
      localStorage.setItem('catalyst_website', JSON.stringify({
        name: 'Legacy Site',
        content: 'Legacy Content'
      }));
      
      await service.migrateFromSingleWebsite();
      
      // Should still have only one website (no migration occurred)
      const websites = await service.listWebsites();
      expect(websites).toHaveLength(1);
      expect(websites[0].name).toBe('Existing Site');
    });
    
    test('should handle missing legacy data gracefully', async () => {
      // No legacy data present
      await service.migrateFromSingleWebsite();
      
      const websites = await service.listWebsites();
      expect(websites).toHaveLength(0);
    });
  });
  
  describe('Storage Management', () => {
    test('should calculate storage usage correctly', async () => {
      const id1 = await service.createWebsite({ name: 'Site 1' });
      const id2 = await service.createWebsite({ name: 'Site 2' });
      
      // Add some data
      await service.saveWebsiteData(id1, { 
        content: 'A'.repeat(1000) // 1KB of data
      });
      await service.saveWebsiteData(id2, { 
        content: 'B'.repeat(2000) // 2KB of data
      });
      
      const quotaStatus = await service.checkStorageQuota();
      expect(quotaStatus.usage).toBeGreaterThan(0);
    });
    
    test('should export and import website data', async () => {
      const id = await service.createWebsite({ 
        name: 'Export Test',
        description: 'Test website for export'
      });
      
      await service.saveWebsiteData(id, {
        content: 'Test content',
        settings: { theme: 'light' }
      });
      
      // Export
      const exportedData = await service.export(id);
      expect(exportedData).toHaveProperty('metadata');
      expect(exportedData).toHaveProperty('data');
      expect(exportedData.metadata.name).toBe('Export Test');
      
      // Clear and import
      await service.deleteWebsite(id);
      const newId = await service.importWebsite(exportedData);
      
      const websites = await service.listWebsites();
      const imported = websites.find(w => w.id === newId);
      expect(imported?.name).toBe('Export Test');
      
      const data = await service.getWebsiteData(newId);
      expect(data.content).toBe('Test content');
    });
  });
  
  describe('Search and Filter', () => {
    test('should search websites by name', async () => {
      await service.createWebsite({ name: 'Portfolio Site' });
      await service.createWebsite({ name: 'E-commerce Store' });
      await service.createWebsite({ name: 'Blog Platform' });
      
      const results = await service.searchWebsites('port');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Portfolio Site');
    });
    
    test('should filter websites by date', async () => {
      const id1 = await service.createWebsite({ name: 'Old Site' });
      
      // Simulate time passing
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      
      const id2 = await service.createWebsite({ name: 'New Site' });
      
      const recentWebsites = await service.getRecentWebsites(1);
      expect(recentWebsites).toHaveLength(1);
      expect(recentWebsites[0].name).toBe('New Site');
    });
  });
});