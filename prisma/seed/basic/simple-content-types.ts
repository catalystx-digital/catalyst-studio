import { PrismaClient } from '../../../lib/generated/prisma'

/**
 * Creates simple content types with primitive fields
 * Tests basic content type creation and field definitions
 */
export async function createSimpleContentTypes(
  prisma: PrismaClient,
  websiteId: string
): Promise<number> {
  const contentTypes = []
  
  // Test Case 1: Minimal content type (only required fields)
  contentTypes.push(await prisma.contentType.create({
    data: {
      key: 'basic_minimal',
      name: 'Minimal Type',
      pluralName: 'Minimal Types',
      category: 'page',
      websiteId,
        
      fields: [
        { name: 'title', type: 'text', required: true, label: 'Title' }
      ]
    }
  }))
  
  // Test Case 2: Text fields only
  contentTypes.push(await prisma.contentType.create({
    data: {
      key: 'basic_text_only',
      name: 'Text Only Type',
      pluralName: 'Text Only Types',
      category: 'page',
      displayField: 'heading',
      websiteId,
        
      fields: [
        { name: 'heading', type: 'text', required: true, label: 'Heading' },
        { name: 'subheading', type: 'text', required: false, label: 'Subheading' },
        { name: 'description', type: 'textarea', required: false, label: 'Description' }
      ]
    }
  }))
  
  // Test Case 3: Number fields
  contentTypes.push(await prisma.contentType.create({
    data: {
      key: 'basic_numbers',
      name: 'Number Type',
      pluralName: 'Number Types',
      category: 'component',
      websiteId,
        
      fields: [
        { name: 'price', type: 'number', required: true, label: 'Price' },
        { name: 'quantity', type: 'number', required: false, label: 'Quantity' },
        { name: 'rating', type: 'number', required: false, label: 'Rating', min: 0, max: 5 }
      ]
    }
  }))
  
  // Test Case 4: Boolean fields
  contentTypes.push(await prisma.contentType.create({
    data: {
      key: 'basic_boolean',
      name: 'Boolean Type',
      pluralName: 'Boolean Types',
      category: 'component',
      websiteId,
        
      fields: [
        { name: 'isActive', type: 'boolean', required: true, label: 'Active', default: true },
        { name: 'isFeatured', type: 'boolean', required: false, label: 'Featured' },
        { name: 'isPublished', type: 'boolean', required: false, label: 'Published' }
      ]
    }
  }))
  
  // Test Case 5: Date fields
  contentTypes.push(await prisma.contentType.create({
    data: {
      key: 'basic_dates',
      name: 'Date Type',
      pluralName: 'Date Types',
      category: 'page',
      websiteId,
        
      fields: [
        { name: 'publishDate', type: 'date', required: true, label: 'Publish Date' },
        { name: 'expiryDate', type: 'date', required: false, label: 'Expiry Date' },
        { name: 'createdAt', type: 'datetime', required: true, label: 'Created At' }
      ]
    }
  }))
  
  // Test Case 6: Media fields
  contentTypes.push(await prisma.contentType.create({
    data: {
      key: 'basic_media',
      name: 'Media Type',
      pluralName: 'Media Types',
      category: 'component',
      websiteId,
        
      fields: [
        { name: 'image', type: 'media', required: true, label: 'Main Image' },
        { name: 'thumbnail', type: 'media', required: false, label: 'Thumbnail' },
        { name: 'video', type: 'media', required: false, label: 'Video', accept: 'video/*' }
      ]
    }
  }))
  
  // Test Case 7: Folder category type
  contentTypes.push(await prisma.contentType.create({
    data: {
      key: 'basic_folder',
      name: 'Basic Folder',
      pluralName: 'Basic Folders',
      category: 'folder',
      displayField: 'name',
      websiteId,
        
      fields: [
        { name: 'name', type: 'text', required: true, label: 'Folder Name' },
        { name: 'description', type: 'text', required: false, label: 'Description' },
        { name: 'sortOrder', type: 'number', required: false, label: 'Sort Order' }
      ]
    }
  }))
  
  return contentTypes.length
}