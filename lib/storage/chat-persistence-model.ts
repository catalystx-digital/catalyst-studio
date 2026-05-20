import { z } from 'zod';

// Zod schemas for validation
export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional()
});

export const ChatSnapshotSchema = z.object({
  id: z.string(),
  messages: z.array(MessageSchema),
  timestamp: z.string().datetime(),
  checksum: z.string().optional()
});

export const StorageMetadataSchema = z.object({
  version: z.string(),
  lastSaved: z.string().datetime(),
  saveCount: z.number(),
  strategy: z.string(),
  sizeBytes: z.number().optional()
});

export const PersistedChatSchema = z.object({
  messages: z.array(MessageSchema),
  timestamp: z.string().datetime(),
  version: z.string(),
  metadata: z.object({
    sessionId: z.string(),
    userId: z.string().optional(),
    projectId: z.string().optional()
  })
});

// TypeScript interfaces
export type Message = z.infer<typeof MessageSchema>;
export type ChatSnapshot = z.infer<typeof ChatSnapshotSchema>;
export type StorageMetadata = z.infer<typeof StorageMetadataSchema>;
export type PersistedChat = z.infer<typeof PersistedChatSchema>;

// Storage key patterns
export const STORAGE_KEYS = {
  CHAT_PREFIX: 'catalyst:chat:',
  METADATA_PREFIX: 'catalyst:metadata:',
  SNAPSHOT_PREFIX: 'catalyst:snapshot:',
  
  chatKey: (sessionId: string) => `${STORAGE_KEYS.CHAT_PREFIX}${sessionId}`,
  metadataKey: (sessionId: string) => `${STORAGE_KEYS.METADATA_PREFIX}${sessionId}`,
  snapshotKey: (sessionId: string, snapshotId: string) => 
    `${STORAGE_KEYS.SNAPSHOT_PREFIX}${sessionId}:${snapshotId}`
} as const;

// Current version for migration support
export const CURRENT_SCHEMA_VERSION = '1.0.0';

// Migration strategies for future schema changes
export interface MigrationStrategy {
  fromVersion: string;
  toVersion: string;
  migrate: (data: unknown) => unknown;
}

export class ChatDataMigrator {
  private migrations: MigrationStrategy[] = [
    // Future migrations will be added here
    // Example:
    // {
    //   fromVersion: '1.0.0',
    //   toVersion: '1.1.0',
    //   migrate: (data) => ({
    //     ...data,
    //     newField: 'defaultValue'
    //   })
    // }
  ];

  migrate(data: unknown, fromVersion: string, toVersion: string = CURRENT_SCHEMA_VERSION): unknown {
    let currentData = data;
    let currentVersion = fromVersion;

    while (currentVersion !== toVersion) {
      const migration = this.migrations.find(
        m => m.fromVersion === currentVersion && m.toVersion <= toVersion
      );

      if (!migration) {
        console.warn(`No migration path from ${currentVersion} to ${toVersion}`);
        break;
      }

      currentData = migration.migrate(currentData);
      currentVersion = migration.toVersion;
    }

    return currentData;
  }

  needsMigration(version: string): boolean {
    return version !== CURRENT_SCHEMA_VERSION;
  }
}

// Helper functions for data validation and transformation
export class ChatPersistenceHelper {
  private migrator = new ChatDataMigrator();

  validatePersistedChat(data: unknown): PersistedChat | null {
    try {
      return PersistedChatSchema.parse(data);
    } catch (error) {
      console.error('Invalid persisted chat data:', error);
      return null;
    }
  }

  validateMessage(data: unknown): Message | null {
    try {
      return MessageSchema.parse(data);
    } catch (error) {
      console.error('Invalid message data:', error);
      return null;
    }
  }

  createPersistedChat(
    messages: Message[],
    sessionId: string,
    userId?: string,
    projectId?: string
  ): PersistedChat {
    return {
      messages,
      timestamp: new Date().toISOString(),
      version: CURRENT_SCHEMA_VERSION,
      metadata: {
        sessionId,
        userId,
        projectId
      }
    };
  }

  createSnapshot(
    id: string,
    messages: Message[]
  ): ChatSnapshot {
    return {
      id,
      messages,
      timestamp: new Date().toISOString(),
      checksum: this.generateChecksum(messages)
    };
  }

  createStorageMetadata(
    strategy: string,
    saveCount: number = 0,
    sizeBytes?: number
  ): StorageMetadata {
    return {
      version: CURRENT_SCHEMA_VERSION,
      lastSaved: new Date().toISOString(),
      saveCount,
      strategy,
      sizeBytes
    };
  }

  private generateChecksum(messages: Message[]): string {
    // Simple checksum for data integrity
    const content = JSON.stringify(messages);
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  migrateIfNeeded(data: PersistedChat): PersistedChat {
    if (this.migrator.needsMigration(data.version)) {
      const migrated = this.migrator.migrate(data, data.version);
      return {
        ...(migrated as PersistedChat),
        version: CURRENT_SCHEMA_VERSION
      };
    }
    return data;
  }

  // Sanitize messages before storage
  sanitizeMessages(messages: Message[]): Message[] {
    return messages.map(msg => ({
      ...msg,
      content: this.sanitizeContent(msg.content),
      timestamp: msg.timestamp || new Date().toISOString()
    }));
  }

  private sanitizeContent(content: string): string {
    // Remove any potentially sensitive data patterns
    // This is a basic implementation - enhance based on requirements
    return content
      .replace(/api[_-]?key[\s]*[:=][\s]*["']?[\w-]+["']?/gi, 'API_KEY_REDACTED')
      .replace(/password[\s]*[:=][\s]*["']?[\w-]+["']?/gi, 'PASSWORD_REDACTED')
      .replace(/token[\s]*[:=][\s]*["']?[\w-]+["']?/gi, 'TOKEN_REDACTED');
  }
}

export const chatPersistenceHelper = new ChatPersistenceHelper();