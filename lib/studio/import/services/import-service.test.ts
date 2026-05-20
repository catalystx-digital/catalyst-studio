import { TextEncoder, TextDecoder } from 'util'
import type { ImportJobRepository } from '../repositories/import-job.repository'

jest.mock('@/lib/prisma', () => {
  const importJob = {
    count: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  }
  return {
    prisma: {
      importJob,
      $transaction: jest.fn(),
    },
  }
})

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}))

const { prisma: mockPrisma } = require('@/lib/prisma') as { prisma: any }

const ImportServiceModule = require('./import-service') as typeof import('./import-service')
const ImportJobTypes = require('../types/import-job.types') as typeof import('../types/import-job.types')
const { ImportService } = ImportServiceModule
const { ImportJobStatus } = ImportJobTypes

if (typeof globalThis.TextEncoder === 'undefined') {
  ;(globalThis as any).TextEncoder = TextEncoder
}
if (typeof globalThis.TextDecoder === 'undefined') {
  ;(globalThis as any).TextDecoder = TextDecoder as any
}

jest.mock('../repositories/import-job.repository')

describe('ImportService', () => {
  let importService: ImportService
  let mockRepository: jest.Mocked<ImportJobRepository>
  let transactionClient: {
    importJob: { count: jest.Mock; update: jest.Mock }
    importRun: { upsert: jest.Mock }
    importPageStage: { upsert: jest.Mock }
    importRunEvent: { create: jest.Mock }
  }

  beforeEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()

    transactionClient = {
      importJob: {
        count: jest.fn(),
        update: jest.fn(),
      },
      importRun: {
        upsert: jest.fn().mockResolvedValue({
          id: 'run-1',
          importJobId: 'job-active',
          websiteId: 'site-123',
          totalPages: 1,
        }),
      },
      importPageStage: {
        upsert: jest.fn().mockResolvedValue({ id: 'stage-1' }),
      },
      importRunEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
    }

    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(transactionClient))

    importService = new ImportService()
    mockRepository = (importService as any).repository

    mockRepository.create.mockReset()
    mockRepository.update.mockReset()
    mockRepository.findById.mockReset()
  })

  describe('startImport', () => {
    it('creates pending job and returns job info', async () => {
      const pendingJob = {
        id: 'job-active',
        websiteId: 'site-123',
        url: 'https://example.com',
        status: ImportJobStatus.PENDING,
      } as any

      transactionClient.importJob.update.mockResolvedValue(undefined)
      mockRepository.create.mockResolvedValueOnce(pendingJob)

      const expandSpy = jest
        .spyOn((importService as any).sitemapDiscovery, 'expandUrlsForImport')
        .mockResolvedValue({ urls: ['https://example.com/about'], sitemapMetaByUrl: new Map() })
      const patchSpy = jest
        .spyOn((importService as any).progressManager, 'patchDetectionResults')
        .mockResolvedValue({})

      const result = await importService.startImport({
        accountId: 'acct-1',
        websiteId: 'site-123',
        url: 'https://example.com',
      })

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2)
      expect(mockRepository.create).toHaveBeenCalledWith(
        {
          websiteId: 'site-123',
          url: 'https://example.com',
          status: ImportJobStatus.PENDING,
        },
        transactionClient,
      )
      expect(transactionClient.importJob.update).toHaveBeenCalledTimes(1)
      expect(transactionClient.importRun.upsert).toHaveBeenCalledTimes(1)
      expect(transactionClient.importPageStage.upsert).toHaveBeenCalledTimes(1)
      expect(expandSpy).toHaveBeenCalled()
      expect(patchSpy).toHaveBeenCalled()

      expect(result).toEqual({
        job: pendingJob,
        message: 'Preparing import (strategy: sitemap)...',
        initialSitemap: [
          {
            url: 'https://example.com/about',
            order: 0,
            status: 'pending',
          },
        ],
      })
    })

    it('throws error when accountId is not provided', async () => {
      await expect(
        importService.startImport({
          accountId: '',
          websiteId: 'site-123',
          url: 'https://example.com',
        })
      ).rejects.toThrow('accountId is required')
    })

    it('handles sitemap discovery failure gracefully', async () => {
      const pendingJob = {
        id: 'job-active',
        websiteId: 'site-123',
        url: 'https://example.com',
        status: ImportJobStatus.PENDING,
      } as any

      transactionClient.importJob.update.mockResolvedValue(undefined)
      mockRepository.create.mockResolvedValueOnce(pendingJob)

      // Simulate sitemap discovery failure
      jest
        .spyOn((importService as any).sitemapDiscovery, 'expandUrlsForImport')
        .mockRejectedValue(new Error('Network error'))

      const result = await importService.startImport({
        accountId: 'acct-1',
        websiteId: 'site-123',
        url: 'https://example.com',
      })

      // Should still return successfully with the planned URL staged for workflow processing.
      expect(result).toEqual({
        job: pendingJob,
        message: 'Preparing import (strategy: sitemap)...',
        initialSitemap: [
          {
            url: 'https://example.com',
            order: 0,
            status: 'pending',
          },
        ],
      })
    })
  })

  describe('getJobProgress', () => {
    it('returns progress with mapped stage', async () => {
      const mockJob = {
        id: 'job-123',
        status: ImportJobStatus.PROCESSING,
        websiteId: 'website-456',
        detectionResults: {
          progress: 45,
          lastProgressMessage: 'Analyzing components',
        },
      } as any

      mockRepository.findById.mockResolvedValue(mockJob)

      const result = await importService.getJobProgress('job-123')

      expect(result).toEqual({
        status: ImportJobStatus.PROCESSING,
        progress: 45,
        message: 'Analyzing components',
        stage: 'analyzing',
        websiteId: 'website-456',
        metadata: undefined,
      })
    })

    it('maps stage for different progress ranges', async () => {
      const cases = [
        { progress: 0, expectedStage: 'initializing' },
        { progress: 15, expectedStage: 'fetching' },
        { progress: 45, expectedStage: 'analyzing' },
        { progress: 75, expectedStage: 'generating' },
        { progress: 95, expectedStage: 'creating' },
      ]

      for (const { progress, expectedStage } of cases) {
        mockRepository.findById.mockResolvedValue({
          id: 'job-123',
          status: ImportJobStatus.PROCESSING,
          websiteId: 'website-456',
          detectionResults: { progress },
        } as any)

        const result = await importService.getJobProgress('job-123')
        expect(result.stage).toBe(expectedStage)
      }
    })

    it('returns completed stage for completed jobs', async () => {
      mockRepository.findById.mockResolvedValue({
        id: 'job-123',
        status: ImportJobStatus.COMPLETED,
        websiteId: 'website-456',
        detectionResults: { progress: 100 },
      } as any)

      const result = await importService.getJobProgress('job-123')
      expect(result.stage).toBe('completed')
      expect(result.progress).toBe(100)
    })

    it('returns failed stage for failed jobs', async () => {
      mockRepository.findById.mockResolvedValue({
        id: 'job-123',
        status: ImportJobStatus.FAILED,
        websiteId: 'website-456',
        detectionResults: { progress: 50 },
      } as any)

      const result = await importService.getJobProgress('job-123')
      expect(result.stage).toBe('failed')
    })

    it('throws when job is missing', async () => {
      mockRepository.findById.mockResolvedValue(null)

      await expect(importService.getJobProgress('missing')).rejects.toThrow('Import job not found')
    })
  })

  describe('cancelImport', () => {
    it('marks job as cancelled', async () => {
      const mockJob = {
        id: 'job-123',
        status: ImportJobStatus.PROCESSING,
        websiteId: 'website-456',
      } as any

      mockRepository.findById.mockResolvedValue(mockJob)
      mockRepository.update.mockResolvedValue(undefined)

      await importService.cancelImport('job-123')

      expect(mockRepository.update).toHaveBeenCalledWith('job-123', {
        status: ImportJobStatus.CANCELLED,
        errorMessage: 'Import cancelled by user',
        completedAt: expect.any(Date),
      })
    })

    it('throws when job is not found', async () => {
      mockRepository.findById.mockResolvedValue(null)

      await expect(importService.cancelImport('missing')).rejects.toThrow('Import job not found')
    })
  })

  describe('updateProgress', () => {
    it('delegates to progress manager', async () => {
      const updateSpy = jest
        .spyOn((importService as any).progressManager, 'updateProgress')
        .mockResolvedValue(undefined)

      await importService.updateProgress('job-123', ImportJobStatus.PROCESSING, 50, 'Processing...')

      expect(updateSpy).toHaveBeenCalledWith(
        'job-123',
        ImportJobStatus.PROCESSING,
        50,
        'Processing...',
        undefined,
      )
    })
  })
})
