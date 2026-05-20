import type { AccountIntegrationRecord } from '@/lib/studio/types/integration';
import {
  SECRET_MASK,
  getEnabledIntegrationProviderSlugs,
  getProviderMetadata,
  IntegrationProviderSlug,
} from '@/lib/studio/integrations/provider-config';

export type FormFieldState = Record<string, string | boolean>;

export const ENABLED_PROVIDER_SLUGS = getEnabledIntegrationProviderSlugs();
export const FALLBACK_PROVIDER: IntegrationProviderSlug = (ENABLED_PROVIDER_SLUGS[0] ?? 'mock');

export function createInitialFieldValues(
  provider: IntegrationProviderSlug,
  integration?: AccountIntegrationRecord,
): FormFieldState {
  const metadata = getProviderMetadata(provider);
  const values: FormFieldState = {};

  metadata.fields.forEach(field => {
    if (field.inputType === 'checkbox') {
      const current = integration?.config[field.name];
      values[field.name] = typeof current === 'boolean' ? current : Boolean(current);
      return;
    }

    if (field.inputType === 'number') {
      const current = integration?.config[field.name];
      if (typeof current === 'number') {
        values[field.name] = `${current}`;
      } else if (typeof current === 'string' && current !== SECRET_MASK) {
        values[field.name] = current;
      } else {
        values[field.name] = '';
      }
      return;
    }

    const current = integration?.config[field.name];
    if (typeof current === 'string' && current !== SECRET_MASK) {
      values[field.name] = current;
    } else {
      values[field.name] = '';
    }
  });

  return values;
}

export function buildConfigPayload(
  provider: IntegrationProviderSlug,
  values: FormFieldState,
  mode: 'create' | 'edit',
): Record<string, unknown> {
  const metadata = getProviderMetadata(provider);
  const config: Record<string, unknown> = {};

  metadata.fields.forEach(field => {
    const raw = values[field.name];

    if (field.inputType === 'checkbox') {
      config[field.name] = Boolean(raw);
      return;
    }

    if (field.inputType === 'number') {
      const str = typeof raw === 'string' ? raw.trim() : '';
      if (!str) {
        return;
      }

      const numeric = Number(str);
      if (Number.isNaN(numeric)) {
        return;
      }

      config[field.name] = field.integer ? Math.trunc(numeric) : numeric;
      return;
    }

    const text = typeof raw === 'string' ? raw.trim() : '';

    if (!text) {
      if (field.secret && mode === 'edit') {
        return;
      }
      return;
    }

    config[field.name] = text;
  });

  return config;
}

export function validateForm(
  provider: IntegrationProviderSlug,
  values: FormFieldState,
  mode: 'create' | 'edit',
  displayName: string,
  integration?: AccountIntegrationRecord,
): string[] {
  const errors: string[] = [];

  if (!displayName.trim()) {
    errors.push('Display name is required.');
  }

  const metadata = getProviderMetadata(provider);

  metadata.fields.forEach(field => {
    const raw = values[field.name];

    if (field.inputType === 'checkbox') {
      return;
    }

    if (field.inputType === 'number') {
      const existing = integration?.config[field.name];
      const str = typeof raw === 'string' ? raw.trim() : '';

      if (!str) {
        if (field.required && (mode === 'create' || existing === undefined)) {
          errors.push(`${field.label} is required.`);
        }
        return;
      }

      if (Number.isNaN(Number(str))) {
        errors.push(`${field.label} must be a number.`);
      }
      return;
    }

    const text = typeof raw === 'string' ? raw.trim() : '';

    if (!text) {
      if (field.secret && mode === 'edit' && integration?.secretFields?.[field.name]) {
        return;
      }

      if (field.required) {
        errors.push(`${field.label} is required.`);
      }
    }
  });

  return errors;
}
