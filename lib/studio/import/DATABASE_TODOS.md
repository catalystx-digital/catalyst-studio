# Database Integration TODOs for Story 11.4

## Overview
The Review & Customization Interface (Story 11.4) currently uses mock implementations for database operations. This document outlines the required database integrations that need to be completed when the Prisma schema is ready.

## Priority: Medium
These TODOs do not block current functionality but are required for production deployment.

## Database Schema Required

The following tables/models need to be added to the Prisma schema:

```prisma
// Import Jobs table
model ImportJob {
  id              String   @id @default(uuid())
  userId          String
  originalUrl     String
  status          String   // 'pending' | 'processing' | 'completed' | 'failed'
  detectedStructure Json    // Store DetectedStructure as JSON
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user            User     @relation(fields: [userId], references: [id])
  reviewSessions  ImportReviewSession[]
  components      ComponentInstance[]
}

// Component Instances with review status
model ComponentInstance {
  id              String   @id @default(uuid())
  importJobId     String
  type            String
  originalHtml    String?  @db.Text
  detectedProps   Json
  confidence      Float
  location        Json
  suggestedMapping String
  userOverride    String?
  reviewStatus    String   @default("pending") // 'pending' | 'approved' | 'rejected' | 'modified'
  userNotes       String?  @db.Text
  reviewedAt      DateTime?
  reviewedBy      String?
  
  importJob       ImportJob @relation(fields: [importJobId], references: [id])
  reviewer        User?     @relation(fields: [reviewedBy], references: [id])
}

// Review Sessions tracking
model ImportReviewSession {
  id              String   @id @default(uuid())
  importJobId     String
  userId          String
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  totalComponents Int
  approvedCount   Int      @default(0)
  rejectedCount   Int      @default(0)
  modifiedCount   Int      @default(0)
  sessionData     Json?
  
  importJob       ImportJob @relation(fields: [importJobId], references: [id])
  user            User      @relation(fields: [userId], references: [id])
}
```

## Implementation Tasks

### 1. ReviewService.loadImportJob() - Line 241
**Current**: Returns mock data
**Required**: 
```typescript
async loadImportJob(jobId: string): Promise<ImportJob> {
  const job = await prisma.importJob.findUnique({
    where: { id: jobId },
    include: {
      components: true,
      reviewSessions: {
        where: { userId: currentUserId },
        orderBy: { startedAt: 'desc' },
        take: 1
      }
    }
  })
  
  if (!job) {
    throw new Error(`Import job ${jobId} not found`)
  }
  
  return this.mapToImportJob(job)
}
```

### 2. ReviewService.updateComponentMapping() - Line 254
**Current**: Console.log only
**Required**:
```typescript
async updateComponentMapping(
  jobId: string,
  componentId: string,
  mapping: ComponentMapping
): Promise<void> {
  await prisma.componentInstance.update({
    where: { 
      id: componentId,
      importJobId: jobId 
    },
    data: {
      userOverride: mapping.userOverride,
      reviewStatus: mapping.status,
      userNotes: mapping.notes,
      reviewedAt: new Date(),
      reviewedBy: currentUserId
    }
  })
}
```

### 3. ReviewService.bulkApprove() - Line 277
**Current**: Console.log only
**Required**:
```typescript
async bulkApprove(
  jobId: string,
  componentIds: string[],
  options: BulkApproveOptions
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Update all components
    await tx.componentInstance.updateMany({
      where: {
        id: { in: componentIds },
        importJobId: jobId
      },
      data: {
        reviewStatus: 'approved',
        reviewedAt: new Date(),
        reviewedBy: currentUserId
      }
    })
    
    // Update session statistics
    await this.updateSessionStats(tx, jobId, currentUserId)
    
    // Auto-approve similar if requested
    if (options.autoApproveSimilar) {
      await this.autoApproveSimilarComponents(tx, jobId, componentIds)
    }
  })
}
```

### 4. ReviewService.saveAsTemplates() - Line 312
**Current**: Returns generated templates without persistence
**Required**:
```typescript
async saveAsTemplates(
  jobId: string,
  approved: ComponentDetection[]
): Promise<CMSTemplate[]> {
  const templates = await this.generateTemplates(approved)
  
  // Save templates to CMS database
  const savedTemplates = await prisma.$transaction(async (tx) => {
    const results = []
    
    for (const template of templates) {
      const saved = await tx.cmsTemplate.create({
        data: {
          id: template.id,
          name: template.name,
          key: template.key,
          category: template.category,
          fields: template.fields,
          metadata: {
            ...template.metadata,
            importJobId: jobId,
            generatedAt: new Date()
          },
          createdBy: currentUserId
        }
      })
      results.push(saved)
    }
    
    // Mark job as completed
    await tx.importJob.update({
      where: { id: jobId },
      data: { 
        status: 'completed',
        updatedAt: new Date()
      }
    })
    
    return results
  })
  
  return savedTemplates
}
```

### 5. ReviewService.createReviewSession() - Line 338
**Current**: Returns mock session
**Required**:
```typescript
async createReviewSession(
  jobId: string,
  userId: string
): Promise<ImportReviewSession> {
  // Get component counts
  const components = await prisma.componentInstance.count({
    where: { importJobId: jobId }
  })
  
  const session = await prisma.importReviewSession.create({
    data: {
      importJobId: jobId,
      userId,
      totalComponents: components,
      approvedCount: 0,
      rejectedCount: 0,
      modifiedCount: 0,
      sessionData: {}
    }
  })
  
  return session
}
```

### 6. ReviewService.updateReviewSession() - Line 350
**Current**: Console.log only
**Required**:
```typescript
async updateReviewSession(
  sessionId: string,
  updates: Partial<ImportReviewSession>
): Promise<void> {
  await prisma.importReviewSession.update({
    where: { id: sessionId },
    data: {
      ...updates,
      updatedAt: new Date()
    }
  })
}
```

## Migration Strategy

1. **Phase 1**: Create Prisma schema and generate client
2. **Phase 2**: Run migrations to create database tables
3. **Phase 3**: Update ReviewService methods one by one
4. **Phase 4**: Add transaction support for atomic operations
5. **Phase 5**: Add proper error handling and retry logic
6. **Phase 6**: Performance optimization with indexes

## Testing Requirements

- Unit tests for each database operation
- Integration tests for transaction scenarios
- Load tests with 1000+ components
- Error recovery tests
- Concurrent session tests

## Performance Considerations

### Indexes Required
```sql
CREATE INDEX idx_components_job_id ON component_instances(import_job_id);
CREATE INDEX idx_components_status ON component_instances(review_status);
CREATE INDEX idx_sessions_job_user ON import_review_sessions(import_job_id, user_id);
CREATE INDEX idx_jobs_user_status ON import_jobs(user_id, status);
```

### Query Optimizations
- Use pagination for large component lists
- Implement cursor-based pagination for better performance
- Consider caching frequently accessed import jobs
- Use database views for complex statistics queries

## Error Handling

All database operations should include:
- Retry logic for transient failures
- Proper error messages for user feedback
- Rollback mechanisms for failed transactions
- Audit logging for all state changes

## Security Considerations

- Validate user permissions before any updates
- Implement row-level security for multi-tenant scenarios
- Sanitize all user inputs before database operations
- Log all review actions for audit trail

## Monitoring & Observability

Add metrics for:
- Database query performance
- Transaction success/failure rates
- Review session duration
- Component approval rates
- Template generation success rates

## Dependencies

- Prisma ORM (already in project)
- PostgreSQL database
- User authentication system
- CMS template storage system

## Timeline Estimate

- Schema creation: 2 hours
- Migration implementation: 4 hours
- Testing: 4 hours
- Performance optimization: 2 hours
- **Total: ~2 days of work**

## Notes

- All mock implementations are functional and can be used for testing
- The interface is designed to work with both mock and real data
- Database integration can be done incrementally
- Consider using feature flags to toggle between mock and real implementations

---

**Created**: 2025-01-30
**Author**: James (Dev Agent)
**Story**: 11.4 - Review & Customization Interface
**Priority**: Medium (not blocking current functionality)