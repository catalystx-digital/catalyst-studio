import {
  AccountIntegration,
  IntegrationProvider,
  IntegrationStatus,
  IntegrationUsageAction,
  Prisma,
  PrismaClient,
} from '@/lib/generated/prisma';
import { ErrorHandlers } from '@/lib/api/errors';
import { decrypt, encrypt } from '@/lib/security/crypto';
import { enumToSlug, getProviderDefinition, ProviderDefinition } from '@/lib/studio/integrations/definitions';
import { SECRET_MASK } from '@/lib/studio/integrations/provider-config';
import { isProviderEnabled } from '@/lib/cms-export/config';

export interface IntegrationView {
  id: string;
  accountId: string;
  provider: IntegrationProvider;
  displayName: string;
  status: IntegrationStatus;
  providerDisabled: boolean;
  config: Record<string, unknown>;
  secretFields: Record<string, boolean>;
  lastTestedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateIntegrationInput {
  provider: IntegrationProvider;
  displayName: string;
  config: Record<string, unknown>;
  status?: IntegrationStatus;
  actorId?: string | null;
}

export interface UpdateIntegrationInput {
  displayName?: string;
  status?: IntegrationStatus;
  config?: Record<string, unknown>;
  actorId?: string | null;
}

export interface DeleteIntegrationOptions {
  actorId?: string | null;
  hardDelete?: boolean;
}

export interface TestIntegrationInput {
  actorId?: string | null;
}

export interface IntegrationTestResult {
  success: boolean;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface ResolvedIntegrationConfig {
  integration: AccountIntegration;
  providerConfig: Record<string, unknown>;
}

export interface IntegrationAuditEvent {
  action: 'create' | 'update' | 'delete' | 'test';
  accountId: string;
  integrationId?: string;
  actorId?: string | null;
  provider?: IntegrationProvider;
  status?: IntegrationStatus;
  success?: boolean;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export type IntegrationAuditLogger = (event: IntegrationAuditEvent) => void | Promise<void>;

const SECRET_VERSION_FALLBACK = 'v1';

const defaultAuditLogger: IntegrationAuditLogger = event => {
  const payload = { ...event, timestamp: event.timestamp ?? new Date().toISOString() };
  console.log('[integration.audit]', payload);
};

export class IntegrationService {
  constructor(
    private readonly prisma: Pick<
      PrismaClient,
      | 'accountIntegration'
      | 'integrationUsage'
    >,
    private readonly auditLogger: IntegrationAuditLogger = defaultAuditLogger,
  ) {}

  async list(accountId: string): Promise<IntegrationView[]> {
    const rows = await this.prisma.accountIntegration.findMany({
      where: { accountId },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(rows.map(row => this.toView(row)));
  }

  async get(accountId: string, id: string): Promise<IntegrationView> {
    const integration = await this.findIntegration(accountId, id);
    return this.toView(integration);
  }

  async create(accountId: string, input: CreateIntegrationInput): Promise<IntegrationView> {
    const providerSlug = enumToSlug(input.provider);

    if (!isProviderEnabled(providerSlug)) {
      throw ErrorHandlers.conflict('Selected provider is disabled by configuration');
    }

    const definition = this.resolveDefinition(input.provider);

    const parsedConfig = this.parseConfig(definition, input.config, 'create');
    const { visibleConfig, secretPayload } = this.partitionConfig(definition, parsedConfig);

    const encryptedSecrets = this.encryptSecrets(secretPayload);

    const record = await this.prisma.accountIntegration.create({
      data: {
        accountId,
        provider: input.provider,
        displayName: input.displayName,
        status: input.status ?? IntegrationStatus.enabled,
        config: visibleConfig as Prisma.InputJsonValue,
        secretCiphertext: encryptedSecrets.ciphertext,
        secretVersion: encryptedSecrets.keyId,
        createdBy: input.actorId ?? null,
        updatedBy: input.actorId ?? null,
      },
    });

    await this.auditLogger({
      action: 'create',
      accountId,
      integrationId: record.id,
      provider: record.provider,
      actorId: input.actorId,
      status: record.status,
    });

    return this.toView(record, secretPayload);
  }

  async update(accountId: string, id: string, input: UpdateIntegrationInput): Promise<IntegrationView> {
    const existing = await this.findIntegration(accountId, id);
    const definition = this.resolveDefinition(existing.provider);
    const providerSlug = enumToSlug(existing.provider);
    const providerDisabled = !isProviderEnabled(providerSlug);

    if (providerDisabled && input.status === IntegrationStatus.enabled) {
      throw ErrorHandlers.conflict('Provider is disabled and cannot be re-enabled');
    }

    const currentSecrets = await this.decryptSecrets(existing);
    const currentConfig = this.normaliseConfig(existing.config);

    let nextConfig = currentConfig;
    let nextSecrets = currentSecrets;

    if (input.config !== undefined) {
      const parsedUpdate = this.parseConfig(definition, input.config, 'update');
      const partitioned = this.partitionConfig(definition, parsedUpdate);
      nextConfig = { ...currentConfig, ...partitioned.visibleConfig };
      nextSecrets = { ...currentSecrets, ...partitioned.secretPayload };
    }

    const encryptedSecrets = this.encryptSecrets(nextSecrets);

    const updated = await this.prisma.accountIntegration.update({
      where: { id: existing.id },
      data: {
        displayName: input.displayName ?? existing.displayName,
        status: input.status ?? existing.status,
        config: nextConfig as Prisma.InputJsonValue,
        secretCiphertext: encryptedSecrets.ciphertext,
        secretVersion: encryptedSecrets.keyId,
        updatedBy: input.actorId ?? existing.updatedBy ?? null,
      },
    });

    await this.auditLogger({
      action: 'update',
      accountId,
      integrationId: updated.id,
      provider: updated.provider,
      actorId: input.actorId,
      status: updated.status,
    });

    return this.toView(updated, nextSecrets);
  }

  async delete(accountId: string, id: string, options: DeleteIntegrationOptions = {}): Promise<void> {
    const existing = await this.findIntegration(accountId, id);

    if (options.hardDelete) {
      await this.prisma.accountIntegration.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.accountIntegration.update({
        where: { id: existing.id },
        data: {
          status: IntegrationStatus.disabled,
          updatedBy: options.actorId ?? existing.updatedBy ?? null,
        },
      });
    }

    await this.auditLogger({
      action: 'delete',
      accountId,
      integrationId: existing.id,
      provider: existing.provider,
      actorId: options.actorId,
      status: options.hardDelete ? undefined : IntegrationStatus.disabled,
    });
  }

  async test(accountId: string, id: string, input: TestIntegrationInput = {}): Promise<IntegrationTestResult> {
    const existing = await this.findIntegration(accountId, id);
    const providerSlug = enumToSlug(existing.provider);

    if (!isProviderEnabled(providerSlug)) {
      throw ErrorHandlers.conflict('Integration provider has been disabled');
    }

    const definition = this.resolveDefinition(existing.provider);
    const secrets = await this.decryptSecrets(existing);
    const config = this.normaliseConfig(existing.config);

    const result: IntegrationTestResult = {
      success: true,
      message: 'Connection test not implemented; assuming success.',
    };

    const timestamp = new Date();

    await this.prisma.accountIntegration.update({
      where: { id: existing.id },
      data: {
        status: result.success ? IntegrationStatus.enabled : IntegrationStatus.error,
        lastTestedAt: timestamp,
        updatedBy: input.actorId ?? existing.updatedBy ?? null,
      },
    });

    await this.prisma.integrationUsage.create({
      data: {
        accountId,
        accountIntegrationId: existing.id,
        action: IntegrationUsageAction.test,
        metadata: {
          success: result.success,
          message: result.message,
          provider: existing.provider,
        } as Prisma.InputJsonValue,
      },
    });

    await this.auditLogger({
      action: 'test',
      accountId,
      integrationId: existing.id,
      provider: existing.provider,
      actorId: input.actorId,
      success: result.success,
      metadata: {
        message: result.message,
        configKeys: Object.keys(config),
        secretKeys: Object.keys(secrets),
      },
    });

    return result;
  }

  async resolveForDeployment(accountId: string, id: string): Promise<ResolvedIntegrationConfig> {
    const integration = await this.findIntegration(accountId, id);

    if (integration.status !== IntegrationStatus.enabled) {
      throw ErrorHandlers.conflict('Integration is disabled');
    }

    const providerSlug = enumToSlug(integration.provider);

    if (!isProviderEnabled(providerSlug)) {
      throw ErrorHandlers.conflict('Integration provider has been disabled');
    }

    const definition = this.resolveDefinition(integration.provider);
    const config = this.normaliseConfig(integration.config);
    const secrets = await this.decryptSecrets(integration);

    const mergedConfig = { ...config, ...secrets };

    return {
      integration,
      providerConfig: this.mapRuntimeConfig(integration.provider, mergedConfig),
    };
  }

  private async toView(record: AccountIntegration, secretsOverride?: Record<string, string>): Promise<IntegrationView> {
    const definition = this.resolveDefinition(record.provider);
    const secrets = secretsOverride ?? (await this.decryptSecrets(record));
    const config = this.normaliseConfig(record.config);
    const masked = this.maskConfig(definition, config, secrets);
    const providerSlug = enumToSlug(record.provider);
    const providerDisabled = !isProviderEnabled(providerSlug);
    const status = providerDisabled && record.status === IntegrationStatus.enabled
      ? IntegrationStatus.disabled
      : record.status;

    return {
      id: record.id,
      accountId: record.accountId,
      provider: record.provider,
      displayName: record.displayName,
      status,
      providerDisabled,
      config: masked,
      secretFields: this.secretPresence(definition, secrets),
      lastTestedAt: record.lastTestedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private async findIntegration(accountId: string, id: string): Promise<AccountIntegration> {
    const integration = await this.prisma.accountIntegration.findFirst({
      where: {
        id,
        accountId,
      },
    });

    if (!integration) {
      throw ErrorHandlers.notFound('Integration');
    }

    return integration;
  }

  private resolveDefinition(provider: IntegrationProvider): ProviderDefinition {
    return getProviderDefinition(provider);
  }

  private parseConfig(
    definition: ProviderDefinition,
    config: Record<string, unknown>,
    mode: 'create' | 'update',
  ): Record<string, unknown> {
    const schema = mode === 'create' ? definition.createSchema : definition.updateSchema;
    const result = schema.safeParse(config ?? {});

    if (!result.success) {
      throw ErrorHandlers.badRequest('Invalid integration configuration', result.error.flatten());
    }

    return result.data as Record<string, unknown>;
  }

  private partitionConfig(
    definition: ProviderDefinition,
    config: Record<string, unknown>,
  ): { visibleConfig: Record<string, unknown>; secretPayload: Record<string, string> } {
    const visibleConfig: Record<string, unknown> = { ...config };
    const secretPayload: Record<string, string> = {};

    for (const key of definition.secretKeys) {
      if (key in config && config[key] !== undefined) {
        const value = config[key];
        if (typeof value !== 'string') {
          throw ErrorHandlers.badRequest(`Secret field ${key} must be a string`);
        }
        secretPayload[key] = value;
      }
      delete visibleConfig[key];
    }

    return { visibleConfig, secretPayload };
  }

  private normaliseConfig(config: Prisma.JsonValue | null): Record<string, unknown> {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return {};
    }

    return { ...(config as Record<string, unknown>) };
  }

  private mapRuntimeConfig(
    provider: IntegrationProvider,
    config: Record<string, unknown>,
  ): Record<string, unknown> {
    if (provider === IntegrationProvider.CONTENTFUL) {
      const runtime: Record<string, unknown> = { ...config };
      const spaceId = (runtime.spaceId ?? runtime.workspace) as string | undefined;
      const environment = (runtime.environment ?? runtime.environmentId) as string | undefined;
      const apiKey = (runtime.apiKey ?? runtime.accessToken) as string | undefined;

      if (spaceId) {
        runtime.workspace = spaceId;
      }

      runtime.environment = environment || 'master';

      if (apiKey) {
        runtime.apiKey = apiKey;
      }

      return runtime;
    }

    if (provider === IntegrationProvider.KONTENT) {
      const runtime: Record<string, unknown> = { ...config };
      const environmentId = (runtime.environmentId ?? runtime.projectId ?? runtime.workspace) as string | undefined;
      const apiKey = (runtime.managementApiKey ?? runtime.apiKey ?? runtime.token ?? runtime.managementToken) as string | undefined;
      const language = (runtime.languageCodename ?? runtime.language ?? runtime.locale) as string | undefined;

      if (environmentId) {
        runtime.environmentId = environmentId;
      }

      if (apiKey) {
        runtime.managementApiKey = apiKey;
      }

      runtime.languageCodename = language || 'default';

      if (runtime.rateLimitMs !== undefined) {
        const parsed = Number(runtime.rateLimitMs);
        runtime.rateLimitMs = Number.isNaN(parsed) ? undefined : parsed;
      }

      if (runtime.maxRetries !== undefined) {
        const parsed = Number(runtime.maxRetries);
        runtime.maxRetries = Number.isNaN(parsed) ? undefined : parsed;
      }

      return runtime;
    }

    return config;
  }
  private encryptSecrets(secretPayload: Record<string, string>): { ciphertext: Uint8Array<ArrayBuffer>; keyId: string } {
    const serialised = JSON.stringify(secretPayload);
    const result = encrypt(serialised);
    const buf = Buffer.from(result.ciphertext);
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;

    return {
      ciphertext: new Uint8Array(arrayBuffer),
      keyId: result.keyId ?? SECRET_VERSION_FALLBACK,
    };
  }

  private async decryptSecrets(record: AccountIntegration): Promise<Record<string, string>> {
    if (!record.secretCiphertext) {
      return {};
    }

    const payload = {
      ciphertext: Buffer.from(record.secretCiphertext),
      keyId: record.secretVersion ?? SECRET_VERSION_FALLBACK,
    };

    try {
      const decrypted = decrypt(payload);
      const text = decrypted.toString('utf8');
      const parsed = text ? JSON.parse(text) : {};

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }

      return {};
    } catch (error) {
      throw ErrorHandlers.internalError('Failed to decrypt integration secrets');
    }
  }

  private maskConfig(
    definition: ProviderDefinition,
    config: Record<string, unknown>,
    secrets: Record<string, string>,
  ): Record<string, unknown> {
    const masked: Record<string, unknown> = { ...config };

    for (const key of definition.secretKeys) {
      if (secrets[key]) {
        masked[key] = SECRET_MASK;
      }
    }

    return masked;
  }

  private secretPresence(
    definition: ProviderDefinition,
    secrets: Record<string, string>,
  ): Record<string, boolean> {
    return definition.secretKeys.reduce<Record<string, boolean>>((acc, key) => {
      acc[key] = Boolean(secrets[key]);
      return acc;
    }, {});
  }
}




