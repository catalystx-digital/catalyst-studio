import { ImportJobRepository } from '../import-job.repository'
import { ImportJobStatus } from '../../types/import-job.types'
import { PrismaClient } from '@/lib/generated/prisma'

// Mock Prisma client
const mockPrismaClient = {
  importJob: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn()
  }
} as unknown as PrismaClient

describe('ImportJobRepository', () => {
  let repository: ImportJobRepository
  
  beforeEach(() => {
    repository = new ImportJobRepository(mockPrismaClient)
    jest.clearAllMocks()
  })
  
  describe('create', () => {
    it('should create a new import job', async () => {
      const mockJob = {
        id: 'job-1',
        websiteId: 'website-1',
        url: 'https://example.com',
        status: ImportJobStatus.PENDING,
        templatesGenerated: [],
        detectionResults: {},
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      ;(mockPrismaClient.importJob.create as jest.Mock).mockResolvedValue(mockJob)
      
      const result = await repository.create({
        websiteId: 'website-1',
        url: 'https://example.com'
      })
      
      expect(mockPrismaClient.importJob.create).toHaveBeenCalledWith({
        data: {
          websiteId: 'website-1',
          url: 'https://example.com',
          status: ImportJobStatus.PENDING
        }
      })
      expect(result).toEqual(mockJob)
    })
    
    it('should create with custom status', async () => {
      const mockJob = {
        id: 'job-1',
        websiteId: 'website-1',
        url: 'https://example.com',
        status: ImportJobStatus.PROCESSING,
        templatesGenerated: [],
        detectionResults: {},
        errorMessage: null,
        startedAt: new Date(),
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      ;(mockPrismaClient.importJob.create as jest.Mock).mockResolvedValue(mockJob)
      
      await repository.create({
        websiteId: 'website-1',
        url: 'https://example.com',
        status: ImportJobStatus.PROCESSING
      })
      
      expect(mockPrismaClient.importJob.create).toHaveBeenCalledWith({
        data: {
          websiteId: 'website-1',
          url: 'https://example.com',
          status: ImportJobStatus.PROCESSING
        }
      })
    })
  })
  
  describe('update', () => {
    it('should update an import job', async () => {
      const mockJob = {
        id: 'job-1',
        websiteId: 'website-1',
        url: 'https://example.com',
        status: ImportJobStatus.COMPLETED,
        templatesGenerated: [{ id: 'template-1' }],
        detectionResults: { framework: 'react' },
        errorMessage: null,
        startedAt: new Date(),
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      ;(mockPrismaClient.importJob.update as jest.Mock).mockResolvedValue(mockJob)
      
      const result = await repository.update('job-1', {
        status: ImportJobStatus.COMPLETED,
        templatesGenerated: [{ id: 'template-1' }],
        detectionResults: { framework: 'react' }
      })
      
      expect(mockPrismaClient.importJob.update).toHaveBeenCalled()
      expect(result).toEqual(mockJob)
    })
    
    it('should throw error for oversized JSON', async () => {
      const oversizedData = { data: 'x'.repeat(11 * 1024 * 1024) } // 11MB string
      
      await expect(
        repository.update('job-1', {
          templatesGenerated: oversizedData
        })
      ).rejects.toThrow('Templates validation failed')
    })
    
    it('should throw error for deeply nested JSON', async () => {
      let deeplyNested: any = { level: 0 }
      let current = deeplyNested
      for (let i = 1; i <= 10; i++) {
        current.nested = { level: i }
        current = current.nested
      }
      
      await expect(
        repository.update('job-1', {
          detectionResults: deeplyNested
        })
      ).rejects.toThrow('Detection results validation failed')
    })
  })
  
  describe('findById', () => {
    it('should find import job by ID', async () => {
      const mockJob = {
        id: 'job-1',
        websiteId: 'website-1',
        url: 'https://example.com',
        status: ImportJobStatus.PENDING,
        website: { id: 'website-1', name: 'Test Website' }
      }
      
      ;(mockPrismaClient.importJob.findUnique as jest.Mock).mockResolvedValue(mockJob)
      
      const result = await repository.findById('job-1')
      
      expect(mockPrismaClient.importJob.findUnique).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        include: { website: true }
      })
      expect(result).toEqual(mockJob)
    })
    
    it('should return null for non-existent job', async () => {
      ;(mockPrismaClient.importJob.findUnique as jest.Mock).mockResolvedValue(null)
      
      const result = await repository.findById('non-existent')
      
      expect(result).toBeNull()
    })
  })
  
  describe('findByWebsiteId', () => {
    it('should find all jobs for a website', async () => {
      const mockJobs = [
        { id: 'job-1', websiteId: 'website-1', status: ImportJobStatus.COMPLETED },
        { id: 'job-2', websiteId: 'website-1', status: ImportJobStatus.PENDING }
      ]
      
      ;(mockPrismaClient.importJob.findMany as jest.Mock).mockResolvedValue(mockJobs)
      
      const result = await repository.findByWebsiteId('website-1')
      
      expect(mockPrismaClient.importJob.findMany).toHaveBeenCalledWith({
        where: { websiteId: 'website-1' },
        orderBy: { createdAt: 'desc' }
      })
      expect(result).toEqual(mockJobs)
    })
  })
  
  describe('updateStatus', () => {
    it('should update status to processing with startedAt', async () => {
      ;(mockPrismaClient.importJob.update as jest.Mock).mockResolvedValue({})
      
      await repository.updateStatus('job-1', ImportJobStatus.PROCESSING)
      
      const updateCall = (mockPrismaClient.importJob.update as jest.Mock).mock.calls[0][0]
      expect(updateCall.where).toEqual({ id: 'job-1' })
      expect(updateCall.data.status).toEqual(ImportJobStatus.PROCESSING)
      expect(updateCall.data.startedAt).toBeInstanceOf(Date)
    })
    
    it('should update status to completed with completedAt', async () => {
      ;(mockPrismaClient.importJob.update as jest.Mock).mockResolvedValue({})
      
      await repository.updateStatus('job-1', ImportJobStatus.COMPLETED)
      
      const updateCall = (mockPrismaClient.importJob.update as jest.Mock).mock.calls[0][0]
      expect(updateCall.where).toEqual({ id: 'job-1' })
      expect(updateCall.data.status).toEqual(ImportJobStatus.COMPLETED)
      expect(updateCall.data.completedAt).toBeInstanceOf(Date)
    })
    
    it('should update status to failed with completedAt', async () => {
      ;(mockPrismaClient.importJob.update as jest.Mock).mockResolvedValue({})
      
      await repository.updateStatus('job-1', ImportJobStatus.FAILED)
      
      const updateCall = (mockPrismaClient.importJob.update as jest.Mock).mock.calls[0][0]
      expect(updateCall.where).toEqual({ id: 'job-1' })
      expect(updateCall.data.status).toEqual(ImportJobStatus.FAILED)
      expect(updateCall.data.completedAt).toBeInstanceOf(Date)
    })
  })
  
  describe('updateTemplates', () => {
    it('should update templates with validation', async () => {
      const templates = [
        { id: 'template-1', name: 'Hero', type: 'hero' },
        { id: 'template-2', name: 'Nav', type: 'nav' }
      ]
      
      const mockJob = {
        id: 'job-1',
        templatesGenerated: templates
      }
      
      ;(mockPrismaClient.importJob.update as jest.Mock).mockResolvedValue(mockJob)
      
      const result = await repository.updateTemplates('job-1', templates)
      
      expect(mockPrismaClient.importJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { templatesGenerated: templates }
      })
      expect(result).toEqual(mockJob)
    })
    
    it('should throw error for oversized templates', async () => {
      const oversizedTemplates = Array(10000).fill({
        id: 'template',
        name: 'x'.repeat(1000),
        props: { data: 'x'.repeat(1000) }
      })
      
      await expect(
        repository.updateTemplates('job-1', oversizedTemplates)
      ).rejects.toThrow('Templates validation failed')
    })
  })
})