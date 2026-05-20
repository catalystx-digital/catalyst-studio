'use client';

import { useParams, useSearchParams } from 'next/navigation';

/**
 * Validates website ID format to prevent injection attacks
 * Allows alphanumeric, hyphen, underscore; max 50 chars
 */
const isValidWebsiteId = (id: string | null | undefined): id is string => {
  if (!id) return false;
  return /^[a-zA-Z0-9-_]+$/.test(id) && id.length <= 50;
};

/**
 * Custom hook to extract and validate website ID from route params or query params
 * Priority: 1) Route params (useParams) 2) Query param 'websiteId' (useSearchParams)
 * Returns 'default' if no valid ID is found in either source
 */
export const useWebsiteId = (): string => {
  const params = useParams();
  const searchParams = useSearchParams();

  // First: Try route params
  const routeId = params?.id as string;
  if (isValidWebsiteId(routeId)) {
    return routeId;
  }

  // Second: Try query param 'websiteId'
  const queryId = searchParams?.get('websiteId');
  if (isValidWebsiteId(queryId)) {
    return queryId;
  }

  // Fallback: Default
  return 'default';
};