import { renderHook, act } from '@testing-library/react';
import { useContentStore } from '../content-store';
import type { ContentItem } from '@/lib/content-types/types';

describe('useContentStore', () => {
  beforeEach(() => {
    // Clear the store before each test
    const { result } = renderHook(() => useContentStore());
    act(() => {
      result.current.clearContent();
    });
    jest.clearAllMocks();
  });

  it('initializes with empty content items', () => {
    const { result } = renderHook(() => useContentStore());
    expect(result.current.contentItems).toEqual([]);
  });

  it('adds a new content item', () => {
    const { result } = renderHook(() => useContentStore());
    
    act(() => {
      result.current.addContent('ct1', { title: 'Test Content' });
    });
    
    expect(result.current.contentItems).toHaveLength(1);
    expect(result.current.contentItems[0]).toMatchObject({
      contentTypeId: 'ct1',
      data: { title: 'Test Content' },
    });
    expect(result.current.contentItems[0].id).toBeDefined();
    expect(result.current.contentItems[0].createdAt).toBeInstanceOf(Date);
    expect(result.current.contentItems[0].updatedAt).toBeInstanceOf(Date);
  });

  it('updates an existing content item', () => {
    const { result } = renderHook(() => useContentStore());
    
    // Add an item first
    act(() => {
      result.current.addContent('ct1', { title: 'Original Title' });
    });
    
    const itemId = result.current.contentItems[0].id;
    const originalCreatedAt = result.current.contentItems[0].createdAt;
    
    // Update the item
    act(() => {
      result.current.updateContent(itemId, { title: 'Updated Title' });
    });
    
    expect(result.current.contentItems[0]).toMatchObject({
      id: itemId,
      data: { title: 'Updated Title' },
      createdAt: originalCreatedAt,
    });
    expect(result.current.contentItems[0].updatedAt.getTime()).toBeGreaterThan(
      originalCreatedAt.getTime()
    );
  });

  it('deletes a content item', () => {
    const { result } = renderHook(() => useContentStore());
    
    // Add two items
    act(() => {
      result.current.addContent('ct1', { title: 'Item 1' });
      result.current.addContent('ct1', { title: 'Item 2' });
    });
    
    expect(result.current.contentItems).toHaveLength(2);
    const firstItemId = result.current.contentItems[0].id;
    
    // Delete the first item
    act(() => {
      result.current.deleteContent(firstItemId);
    });
    
    expect(result.current.contentItems).toHaveLength(1);
    expect(result.current.contentItems[0].data.title).toBe('Item 2');
  });

  it('duplicates a content item', () => {
    const { result } = renderHook(() => useContentStore());
    
    // Add an item
    act(() => {
      result.current.addContent('ct1', { title: 'Original Item' });
    });
    
    const originalId = result.current.contentItems[0].id;
    
    // Duplicate the item
    let duplicatedItem: ContentItem | undefined;
    act(() => {
      duplicatedItem = result.current.duplicateContent(originalId);
    });
    
    expect(result.current.contentItems).toHaveLength(2);
    expect(duplicatedItem).toBeDefined();
    expect(duplicatedItem?.id).not.toBe(originalId);
    expect(duplicatedItem?.data).toEqual({ title: 'Original Item' });
    expect(duplicatedItem?.contentTypeId).toBe('ct1');
  });

  it('returns undefined when duplicating non-existent item', () => {
    const { result } = renderHook(() => useContentStore());
    
    let duplicatedItem: ContentItem | undefined;
    act(() => {
      duplicatedItem = result.current.duplicateContent('non-existent-id');
    });
    
    expect(duplicatedItem).toBeUndefined();
    expect(result.current.contentItems).toHaveLength(0);
  });

  it('gets content items by content type', () => {
    const { result } = renderHook(() => useContentStore());
    
    // Add items of different content types
    act(() => {
      result.current.addContent('ct1', { title: 'Article 1' });
      result.current.addContent('ct2', { title: 'Product 1' });
      result.current.addContent('ct1', { title: 'Article 2' });
      result.current.addContent('ct2', { title: 'Product 2' });
    });
    
    const ct1Items = result.current.getContentByType('ct1');
    const ct2Items = result.current.getContentByType('ct2');
    
    expect(ct1Items).toHaveLength(2);
    expect(ct2Items).toHaveLength(2);
    expect(ct1Items[0].data.title).toBe('Article 1');
    expect(ct1Items[1].data.title).toBe('Article 2');
    expect(ct2Items[0].data.title).toBe('Product 1');
    expect(ct2Items[1].data.title).toBe('Product 2');
  });

  it('clears all content items', () => {
    const { result } = renderHook(() => useContentStore());
    
    // Add multiple items
    act(() => {
      result.current.addContent('ct1', { title: 'Item 1' });
      result.current.addContent('ct2', { title: 'Item 2' });
      result.current.addContent('ct3', { title: 'Item 3' });
    });
    
    expect(result.current.contentItems).toHaveLength(3);
    
    // Clear all items
    act(() => {
      result.current.clearContent();
    });
    
    expect(result.current.contentItems).toHaveLength(0);
  });

  it.skip('persists data to localStorage - no longer using localStorage', () => {
    // This test is skipped because we removed localStorage persistence
    // All data is now stored in the database via API
  });

  it('generates unique IDs for new content items', () => {
    const { result } = renderHook(() => useContentStore());
    
    // Add multiple items
    act(() => {
      result.current.addContent('ct1', { title: 'Item 1' });
      result.current.addContent('ct1', { title: 'Item 2' });
      result.current.addContent('ct1', { title: 'Item 3' });
    });
    
    const ids = result.current.contentItems.map(item => item.id);
    const uniqueIds = new Set(ids);
    
    // All IDs should be unique
    expect(uniqueIds.size).toBe(3);
  });

  it('maintains content item integrity when updating', () => {
    const { result } = renderHook(() => useContentStore());
    
    // Add an item with multiple fields
    act(() => {
      result.current.addContent('ct1', {
        title: 'Original Title',
        content: 'Original Content',
        published: true,
      });
    });
    
    const itemId = result.current.contentItems[0].id;
    
    // Update only one field
    act(() => {
      result.current.updateContent(itemId, {
        ...result.current.contentItems[0].data,
        title: 'Updated Title',
      });
    });
    
    // Other fields should remain unchanged
    expect(result.current.contentItems[0].data).toEqual({
      title: 'Updated Title',
      content: 'Original Content',
      published: true,
    });
  });

  it('handles concurrent operations correctly', () => {
    const { result } = renderHook(() => useContentStore());
    
    // Add initial items
    let item1Id: string;
    let item2Id: string;
    
    act(() => {
      const { item: item1 } = result.current.addContent('ct1', { title: 'Item 1' });
      const { item: item2 } = result.current.addContent('ct2', { title: 'Item 2' });
      item1Id = item1.id;
      item2Id = item2.id;
    });
    
    // Perform multiple operations
    act(() => {
      result.current.updateContent(item1Id!, { title: 'Updated Item 1' });
      result.current.deleteContent(item2Id!);
      result.current.addContent('ct3', { title: 'Item 3' });
    });
    
    expect(result.current.contentItems).toHaveLength(2);
    expect(result.current.contentItems[0].data.title).toBe('Updated Item 1');
    expect(result.current.contentItems[1].data.title).toBe('Item 3');
  });
});