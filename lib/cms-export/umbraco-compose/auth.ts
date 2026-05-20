/**
 * Umbraco Compose Authentication Manager
 *
 * Handles dual authentication for Umbraco Compose:
 * - Management API: OAuth 2.0 Client Credentials flow
 * - Ingestion API: Personal Access Token (PAT)
 *
 * Features:
 * - Token caching with automatic refresh
 * - 60-second buffer before expiry for proactive refresh
 */

import {
  UMBRACO_MANAGEMENT_URL,
  AUTH_TOKEN_PATH,
  TOKEN_REFRESH_BUFFER_MS,
  ENV_VARS,
} from './constants';
import type {
  UmbracoComposeClientConfig,
  UmbracoAuthTokenResponse,
  UmbracoCachedToken,
} from './types';
import { UmbracoAuthError } from './types';

export class UmbracoAuthManager {
  private clientId: string = '';
  private clientSecret: string = '';
  private personalAccessToken: string = '';
  private cachedManagementToken: UmbracoCachedToken | null = null;

  /**
   * Configure authentication credentials
   */
  configure(config: UmbracoComposeClientConfig): void {
    if (config.clientId) this.clientId = config.clientId;
    if (config.clientSecret) this.clientSecret = config.clientSecret;
    if (config.personalAccessToken) this.personalAccessToken = config.personalAccessToken;
  }

  /**
   * Configure from environment variables
   */
  configureFromEnv(): void {
    this.clientId = process.env[ENV_VARS.CLIENT_ID] || '';
    this.clientSecret = process.env[ENV_VARS.CLIENT_SECRET] || '';
    this.personalAccessToken = process.env[ENV_VARS.PAT] || '';
  }

  /**
   * Check if Management API credentials are configured
   */
  hasManagementCredentials(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Check if Ingestion API credentials are configured
   */
  hasIngestionCredentials(): boolean {
    return Boolean(this.personalAccessToken);
  }

  /**
   * Check if any credentials are configured
   */
  hasAnyCredentials(): boolean {
    return this.hasManagementCredentials() || this.hasIngestionCredentials();
  }

  /**
   * Get Management API token (OAuth 2.0 Client Credentials)
   * Automatically handles caching and refresh
   */
  async getManagementToken(): Promise<string> {
    if (!this.hasManagementCredentials()) {
      throw new UmbracoAuthError(
        'Management API credentials not configured. Set UMBRACO_CLIENT_ID and UMBRACO_CLIENT_SECRET.'
      );
    }

    // Check if cached token is still valid (with buffer)
    const now = Date.now();
    if (this.cachedManagementToken && this.cachedManagementToken.expiresAt > now + TOKEN_REFRESH_BUFFER_MS) {
      return this.cachedManagementToken.token;
    }

    // Acquire new token
    const token = await this.acquireManagementToken();
    return token;
  }

  /**
   * Get Ingestion API token (Personal Access Token)
   */
  getIngestionToken(): string {
    if (!this.hasIngestionCredentials()) {
      throw new UmbracoAuthError(
        'Ingestion API credentials not configured. Set UMBRACO_PAT.'
      );
    }
    return this.personalAccessToken;
  }

  /**
   * Invalidate cached Management token (force refresh on next request)
   */
  invalidateManagementToken(): void {
    this.cachedManagementToken = null;
  }

  /**
   * Acquire new Management API token via OAuth 2.0 Client Credentials flow
   */
  private async acquireManagementToken(): Promise<string> {
    const url = `${UMBRACO_MANAGEMENT_URL}${AUTH_TOKEN_PATH}`;

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    }).toString();

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
    } catch (error) {
      throw new UmbracoAuthError(
        `Failed to connect to Umbraco auth server: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new UmbracoAuthError(
        `Authentication failed: ${response.status} ${errorText.substring(0, 200)}`,
        response.status
      );
    }

    let data: UmbracoAuthTokenResponse;
    try {
      data = await response.json() as UmbracoAuthTokenResponse;
    } catch {
      throw new UmbracoAuthError('Invalid response from auth server');
    }

    if (!data.access_token) {
      throw new UmbracoAuthError('No access token in auth response');
    }

    // Cache the token
    this.cachedManagementToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };

    return data.access_token;
  }

  /**
   * Test connection by acquiring a token
   */
  async testConnection(): Promise<boolean> {
    try {
      if (this.hasManagementCredentials()) {
        await this.acquireManagementToken();
        return true;
      }
      if (this.hasIngestionCredentials()) {
        // PAT doesn't require validation, just check it exists
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
