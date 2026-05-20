import {
  getJSONSizeInBytes,
  validateJSONSize,
  validateJSONDepth,
  validateJSON,
  formatBytes,
  MAX_JSON_SIZE,
  MAX_JSON_DEPTH
} from '../validation'

describe('JSON Validation Utils', () => {
  describe('getJSONSizeInBytes', () => {
    it('should calculate size of simple object', () => {
      const data = { name: 'test', value: 123 }
      const size = getJSONSizeInBytes(data)
      expect(size).toBeGreaterThan(0)
      expect(size).toBeLessThan(100)
    })
    
    it('should calculate size of array', () => {
      const data = [1, 2, 3, 4, 5]
      const size = getJSONSizeInBytes(data)
      expect(size).toBeGreaterThan(0)
      expect(size).toBeLessThan(50)
    })
    
    it('should handle unicode characters correctly', () => {
      const data = { text: '你好世界' }
      const size = getJSONSizeInBytes(data)
      expect(size).toBeGreaterThan(15) // Unicode chars take more bytes
    })
  })
  
  describe('validateJSONSize', () => {
    it('should accept small JSON', () => {
      const data = { test: 'data' }
      expect(validateJSONSize(data)).toBe(true)
    })
    
    it('should accept JSON at size limit', () => {
      // Create data close to but under the limit
      const data = { content: 'x'.repeat(MAX_JSON_SIZE - 100) }
      expect(validateJSONSize(data)).toBe(true)
    })
    
    it('should reject oversized JSON', () => {
      // Create data over the limit
      const data = { content: 'x'.repeat(MAX_JSON_SIZE + 1000) }
      expect(validateJSONSize(data)).toBe(false)
    })
  })
  
  describe('validateJSONDepth', () => {
    it('should accept flat object', () => {
      const data = { a: 1, b: 2, c: 3 }
      expect(validateJSONDepth(data)).toBe(true)
    })
    
    it('should accept object at max depth', () => {
      let data: any = { level: 0 }
      let current = data
      for (let i = 1; i < MAX_JSON_DEPTH; i++) {
        current.nested = { level: i }
        current = current.nested
      }
      expect(validateJSONDepth(data)).toBe(true)
    })
    
    it('should reject object exceeding max depth', () => {
      let data: any = { level: 0 }
      let current = data
      for (let i = 1; i <= MAX_JSON_DEPTH + 1; i++) {
        current.nested = { level: i }
        current = current.nested
      }
      expect(validateJSONDepth(data)).toBe(false)
    })
    
    it('should handle arrays correctly', () => {
      const data = {
        items: [
          { nested: { deep: { deeper: { deepest: { value: 1 } } } } },
          { nested: { deep: { deeper: { deepest: { value: 2 } } } } }
        ]
      }
      expect(validateJSONDepth(data)).toBe(true)
    })
    
    it('should reject deeply nested arrays', () => {
      let data: any = []
      let current = data
      for (let i = 0; i <= MAX_JSON_DEPTH + 1; i++) {
        current.push([])
        current = current[0]
      }
      expect(validateJSONDepth(data)).toBe(false)
    })
  })
  
  describe('validateJSON', () => {
    it('should validate valid JSON', () => {
      const data = {
        templates: [
          { id: '1', name: 'Template 1' },
          { id: '2', name: 'Template 2' }
        ],
        metadata: { version: '1.0' }
      }
      
      const result = validateJSON(data)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })
    
    it('should reject oversized JSON with error message', () => {
      const data = { content: 'x'.repeat(MAX_JSON_SIZE + 1000) }
      const result = validateJSON(data)
      
      expect(result.valid).toBe(false)
      expect(result.error).toContain('exceeds maximum allowed size')
      expect(result.error).toContain(MAX_JSON_SIZE.toString())
    })
    
    it('should reject deeply nested JSON with error message', () => {
      let data: any = { level: 0 }
      let current = data
      for (let i = 1; i <= MAX_JSON_DEPTH + 2; i++) {
        current.nested = { level: i }
        current = current.nested
      }
      
      const result = validateJSON(data)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('exceeds maximum allowed depth')
      expect(result.error).toContain(MAX_JSON_DEPTH.toString())
    })
  })
  
  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 Bytes')
    })
    
    it('should format bytes', () => {
      expect(formatBytes(512)).toBe('512 Bytes')
    })
    
    it('should format KB', () => {
      expect(formatBytes(1024)).toBe('1 KB')
      expect(formatBytes(2048)).toBe('2 KB')
      expect(formatBytes(1536)).toBe('1.5 KB')
    })
    
    it('should format MB', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB')
      expect(formatBytes(1024 * 1024 * 5.5)).toBe('5.5 MB')
    })
    
    it('should format GB', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
    })
    
    it('should respect decimal places', () => {
      expect(formatBytes(1536, 0)).toBe('2 KB')
      expect(formatBytes(1536, 1)).toBe('1.5 KB')
      expect(formatBytes(1536, 3)).toBe('1.5 KB')
    })
  })
})