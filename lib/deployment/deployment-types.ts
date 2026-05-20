export type CMSProviderId = 'optimizely' | 'contentful' | 'contentstack' | 'strapi' | 'mock';
export type ConnectionStatus = 'connected' | 'disconnected' | 'error';
export type DeploymentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type LogLevel = 'info' | 'warning' | 'error';

export interface CMSProviderConfig {
  apiKey?: string;
  endpoint?: string;
  workspace?: string;
  environment?: string;
  projectId?: string;
  [key: string]: string | undefined;
}

export interface CMSProvider {
  id: CMSProviderId;
  name: string;
  description: string;
  logo: string;
  connectionStatus: ConnectionStatus;
  config: CMSProviderConfig;
  lastConnected?: Date;
  connectionExpiry?: Date;
}

export interface DeploymentLog {
  timestamp: Date;
  level: LogLevel;
  message: string;
  details?: unknown;
}

export interface DeploymentJob {
  id: string;
  providerId: CMSProviderId;
  integrationId?: string;
  integrationDisplayName?: string;
  providerDisplayName?: string;
  websiteId?: string;
  selectedTypes?: string[];
  status: DeploymentStatus;
  progress: number;
  startedAt: Date;
  completedAt?: Date;
  logs: DeploymentLog[];
  error?: string;
  retryCount?: number;
  maxRetries?: number;
  initiatedBy?: string;
  options?: {
    bypassValidation?: boolean;
  };
}

export interface DeploymentMetrics {
  timeTaken: number;
  contentItemsProcessed: number;
  bytesTransferred: number;
  successRate: number;
}

export interface DeploymentResult {
  job: DeploymentJob;
  metrics?: DeploymentMetrics;
  deployedUrl?: string;
}

export interface DeploymentHistory {
  deployments: DeploymentJob[];
  lastUpdated: Date;
}

