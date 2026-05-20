import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

import {
  AccountApiKey as AccountApiKeyModel,
  AccountApiKeyEventType,
  AccountApiKeyScope,
  AccountApiKeyStatus,
  Prisma,
  PrismaClient,
} from '@/lib/generated/prisma';
import { ApiError } from '@/lib/api/errors';
import { digestApiKey } from '@/lib/ucs/auth/api-key-digest';

const scrypt = promisify(scryptCallback);

const SECRET_BYTES = Number(process.env.UCS_API_KEY_BYTES ?? 32);
const SALT_BYTES = Number(process.env.UCS_API_KEY_SALT_BYTES ?? 16);
const EVENT_RETENTION_DAYS = Number(process.env.UCS_API_KEY_EVENT_RETENTION_DAYS ?? 90);
const ROTATION_METADATA_WINDOW_MS = 15_000;

export interface CreateAccountApiKeyInput {
  label: string;
  websiteId?: string | null;
  scopes?: AccountApiKeyScope[];
  expiresAt?: Date | null;
  actorId?: string | null;
}

export interface RotateAccountApiKeyInput {
  actorId?: string | null;
  note?: string;
}

export interface RevokeAccountApiKeyInput {
  actorId?: string | null;
  reason?: string;
}

export interface UpdateAccountApiKeyInput {
  label?: string;
  expiresAt?: Date | null;
  actorId?: string | null;
}

export interface SanitizedAccountApiKey {
  id: string;
  accountId: string;
  websiteId: string | null;
  label: string;
  scopes: AccountApiKeyScope[];
  status: AccountApiKeyStatus;
  issuedAt: Date;
  issuedBy: string | null;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  keyPreview: string;
  hasSecondaryKey: boolean;
}

export interface AccountApiKeyEventSummary {
  id: string;
  apiKeyId: string;
  accountId: string;
  websiteId: string | null;
  action: AccountApiKeyEventType;
  actorId: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: Date;
}

export class ApiKeyService {
  private readonly eventRetentionMs = EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1_000;

  constructor(private readonly prisma: PrismaClient) {}

  async list(accountId: string, websiteId?: string | null): Promise<SanitizedAccountApiKey[]> {
    const where: Prisma.AccountApiKeyWhereInput = { accountId };

    if (websiteId) {
      where.OR = [{ websiteId }, { websiteId: null }];
    }

    const records = await this.prisma.accountApiKey.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return records.map(record => this.toPublicRecord(record));
  }

  async create(accountId: string, input: CreateAccountApiKeyInput): Promise<{ key: SanitizedAccountApiKey; plaintextKey: string }> {
    const websiteId = input.websiteId?.trim() || null;
    const scopes = this.normalizeScopes(input.scopes, websiteId);
    await this.assertWebsiteOwnership(accountId, websiteId);

    if (!input.label?.trim()) {
      throw new ApiError(400, 'Label is required', 'VALIDATION_ERROR');
    }

    const expiresAt = input.expiresAt ?? null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new ApiError(400, 'Expiration must be in the future', 'VALIDATION_ERROR');
    }

    const plaintextKey = this.generatePlaintextKey(accountId);
    const salt = this.generateSalt();
    const hash = await this.hashSecret(plaintextKey, salt);
    const digest = digestApiKey(plaintextKey);

    const record = await this.prisma.accountApiKey.create({
      data: {
        accountId,
        websiteId,
        label: input.label.trim(),
        hashedSecret: hash,
        salt,
        scopes,
        issuedBy: input.actorId ?? null,
        expiresAt,
        primaryKeyHash: digest,
        secondaryKeyHash: null,
      },
    });

    await this.recordEvent(record, AccountApiKeyEventType.issued, input.actorId, {
      label: record.label,
      scopes,
      websiteId,
    });

    return {
      key: this.toPublicRecord(record),
      plaintextKey,
    };
  }

  async rotate(accountId: string, keyId: string, input: RotateAccountApiKeyInput = {}): Promise<{ key: SanitizedAccountApiKey; plaintextKey: string }> {
    const record = await this.requireKey(accountId, keyId);
    this.ensureActive(record);

    const plaintextKey = this.generatePlaintextKey(accountId);
    const salt = this.generateSalt();
    const hash = await this.hashSecret(plaintextKey, salt);
    const digest = digestApiKey(plaintextKey);

    const updated = await this.prisma.accountApiKey.update({
      where: { id: record.id },
      data: {
        hashedSecret: hash,
        salt,
        primaryKeyHash: digest,
        secondaryKeyHash: record.primaryKeyHash,
      },
    });

    await this.recordEvent(updated, AccountApiKeyEventType.rotated, input.actorId, {
      note: input.note ?? null,
      rotatedAt: new Date().toISOString(),
    });

    return {
      key: this.toPublicRecord(updated),
      plaintextKey,
    };
  }

  async revoke(accountId: string, keyId: string, input: RevokeAccountApiKeyInput = {}): Promise<SanitizedAccountApiKey> {
    const record = await this.requireKey(accountId, keyId);
    if (record.status === AccountApiKeyStatus.revoked) {
      return this.toPublicRecord(record);
    }

    const updated = await this.prisma.accountApiKey.update({
      where: { id: record.id },
      data: {
        status: AccountApiKeyStatus.revoked,
        secondaryKeyHash: null,
      },
    });

    await this.recordEvent(updated, AccountApiKeyEventType.revoked, input.actorId, {
      reason: input.reason ?? null,
    });

    return this.toPublicRecord(updated);
  }

  async update(accountId: string, keyId: string, input: UpdateAccountApiKeyInput): Promise<SanitizedAccountApiKey> {
    const record = await this.requireKey(accountId, keyId);

    const data: Prisma.AccountApiKeyUpdateInput = {};

    if (input.label !== undefined) {
      const trimmed = input.label.trim();
      if (!trimmed) {
        throw new ApiError(400, 'Label cannot be empty', 'VALIDATION_ERROR');
      }
      data.label = trimmed;
    }

    if (input.expiresAt !== undefined) {
      if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) {
        throw new ApiError(400, 'Expiration must be in the future', 'VALIDATION_ERROR');
      }
      data.expiresAt = input.expiresAt;
    }

    if (Object.keys(data).length === 0) {
      return this.toPublicRecord(record);
    }

    const updated = await this.prisma.accountApiKey.update({
      where: { id: record.id },
      data,
    });

    await this.recordEvent(updated, AccountApiKeyEventType.usage, input.actorId, {
      reason: 'metadata-update',
    });

    return this.toPublicRecord(updated);
  }

  async getEvents(accountId: string, keyId: string, options?: { limit?: number }): Promise<AccountApiKeyEventSummary[]> {
    await this.requireKey(accountId, keyId);
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    const cutoff = this.buildCutoff();

    const events = await this.prisma.accountApiKeyEvent.findMany({
      where: {
        accountId,
        apiKeyId: keyId,
        occurredAt: { gte: cutoff },
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });

    return events.map(event => ({
      id: event.id,
      apiKeyId: event.apiKeyId,
      accountId: event.accountId,
      websiteId: event.websiteId ?? null,
      action: event.action,
      actorId: event.actorId ?? null,
      metadata: (event.metadata as Record<string, unknown> | null) ?? null,
      occurredAt: event.occurredAt,
    }));
  }

  async recordUsage(accountId: string, keyId: string, metadata?: Record<string, unknown>): Promise<void> {
    const record = await this.requireKey(accountId, keyId);
    await this.prisma.accountApiKey.update({
      where: { id: record.id },
      data: {
        lastUsedAt: new Date(),
      },
    });

    await this.recordEvent(record, AccountApiKeyEventType.usage, null, metadata ?? { reason: 'usage' });
  }

  private async requireKey(accountId: string, keyId: string): Promise<AccountApiKeyModel> {
    const record = await this.prisma.accountApiKey.findFirst({
      where: { id: keyId, accountId },
    });

    if (!record) {
      throw new ApiError(404, 'API key not found', 'NOT_FOUND');
    }

    return record;
  }

  private ensureActive(record: AccountApiKeyModel) {
    if (record.status !== AccountApiKeyStatus.active) {
      throw new ApiError(400, 'API key is not active', 'KEY_INACTIVE');
    }
  }

  private async assertWebsiteOwnership(accountId: string, websiteId: string | null): Promise<void> {
    if (!websiteId) {
      return;
    }

    const website = await this.prisma.website.findFirst({
      where: { id: websiteId, accountId },
      select: { id: true },
    });

    if (!website) {
      throw new ApiError(404, 'Website not found for this account', 'NOT_FOUND');
    }
  }

  private normalizeScopes(scopes: AccountApiKeyScope[] | undefined, websiteId: string | null): AccountApiKeyScope[] {
    if (!scopes || scopes.length === 0) {
      return websiteId ? [AccountApiKeyScope.WEBSITE_READ] : [AccountApiKeyScope.ACCOUNT_READ];
    }

    const uniqueScopes = Array.from(new Set(scopes));
    const invalidWebsiteScope = !websiteId && uniqueScopes.includes(AccountApiKeyScope.WEBSITE_READ);
    if (invalidWebsiteScope) {
      throw new ApiError(400, 'Website scope requires a websiteId', 'VALIDATION_ERROR');
    }

    const invalidAccountScope = Boolean(websiteId) && uniqueScopes.includes(AccountApiKeyScope.ACCOUNT_READ);
    if (invalidAccountScope) {
      throw new ApiError(400, 'Account scope keys must omit websiteId', 'VALIDATION_ERROR');
    }

    return uniqueScopes;
  }

  private toPublicRecord(record: AccountApiKeyModel): SanitizedAccountApiKey {
    return {
      id: record.id,
      accountId: record.accountId,
      websiteId: record.websiteId ?? null,
      label: record.label,
      scopes: [...record.scopes],
      status: record.status,
      issuedAt: record.issuedAt,
      issuedBy: record.issuedBy ?? null,
      expiresAt: record.expiresAt ?? null,
      lastUsedAt: record.lastUsedAt ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      keyPreview: this.buildKeyPreview(record),
      hasSecondaryKey: Boolean(record.secondaryKeyHash),
    };
  }

  private buildKeyPreview(record: AccountApiKeyModel): string {
    const digest = record.primaryKeyHash ?? digestApiKey(record.id);
    return `${digest.slice(0, 4)}-${digest.slice(4, 8)}-${digest.slice(-4)}`;
  }

  private generatePlaintextKey(accountId: string): string {
    const randomPart = randomBytes(SECRET_BYTES).toString('base64url');
    return `ucs_${accountId.slice(0, 6)}_${randomPart}`;
  }

  private generateSalt(): string {
    return randomBytes(SALT_BYTES).toString('hex');
  }

  private async hashSecret(secret: string, salt: string): Promise<string> {
    const buffer = (await scrypt(secret, salt, 64)) as Buffer;
    return buffer.toString('hex');
  }

  private buildCutoff(): Date {
    return new Date(Date.now() - this.eventRetentionMs);
  }

  private async recordEvent(
    record: AccountApiKeyModel,
    action: AccountApiKeyEventType,
    actorId?: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.accountApiKeyEvent.create({
      data: {
        accountId: record.accountId,
        websiteId: record.websiteId,
        apiKeyId: record.id,
        action,
        actorId: actorId ?? null,
        metadata: (metadata ?? undefined) as any,
      },
    });

    await this.maybePruneEvents(record.accountId);
  }

  private async maybePruneEvents(accountId: string) {
    if (Math.random() > 0.1) {
      return;
    }

    const cutoff = this.buildCutoff();
    await this.prisma.accountApiKeyEvent.deleteMany({
      where: {
        accountId,
        occurredAt: { lt: cutoff },
      },
    });
  }
}
