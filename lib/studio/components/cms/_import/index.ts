// Import Integration API Module
export { DetectionAPI, detectionAPI, type ComponentPattern, type DetectionFilter } from './detection-api'
export { 
  BatchImportAPI, 
  batchImportAPI, 
  type BatchImportItem, 
  type BatchImportResult, 
  type BatchImportError,
  type BatchImportOptions,
  type BatchImportProgress 
} from './batch-import-api'

// Import singleton instances
import { detectionAPI } from './detection-api'
import { batchImportAPI } from './batch-import-api'

// Re-export unified API interface
export const importIntegrationAPI = {
  detection: detectionAPI,
  batch: batchImportAPI
}
