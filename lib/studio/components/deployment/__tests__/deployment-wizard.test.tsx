import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { DeploymentWizard } from '../deployment-wizard';
import type { AccountIntegrationRecord } from '@/lib/studio/types/integration';

jest.mock('../integration-selector', () => {
  const React = require('react');
  const mockIntegration: AccountIntegrationRecord = {
    id: 'int-1',
    accountId: 'acc-1',
    provider: 'optimizely',
    displayName: 'Optimizely Prod',
    status: 'enabled',
    providerDisabled: false,
    config: {},
    secretFields: {},
    lastTestedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    IntegrationSelector: ({ onSelect }: { onSelect: (integration: AccountIntegrationRecord) => void }) => (
      <button data-testid="mock-integration-selector" onClick={() => onSelect(mockIntegration)}>
        Select Integration
      </button>
    ),
  };
});

jest.mock('@/components/deployment/content-mapping', () => {
  const React = require('react');
  return {
    ContentMapping: ({ onMappingComplete }: { onMappingComplete?: (types: Array<{ id: string }>) => void }) => {
      React.useEffect(() => {
        onMappingComplete?.([{ id: 'type-1' }]);
      }, [onMappingComplete]);

      return <div data-testid="mock-content-mapping">Content mapping</div>;
    },
  };
});

jest.mock('@/lib/studio/components/deployment/deployment-progress', () => {
  const React = require('react');
  return {
    DeploymentProgress: ({ job, onComplete }: { job: any; onComplete: (job: any) => void }) => {
      React.useEffect(() => {
        onComplete({
          ...job,
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
        });
      }, [job, onComplete]);

      return <div data-testid="mock-deployment-progress">Deploying…</div>;
    },
  };
});

describe('DeploymentWizard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('disables Next button until an integration is selected', () => {
    render(<DeploymentWizard websiteId="web-1" />);

    const nextButton = screen.getByRole('button', { name: /Next/i });
    expect(nextButton).toBeDisabled();

    fireEvent.click(screen.getByTestId('mock-integration-selector'));
    expect(nextButton).toBeEnabled();
  });

  it('advances through mapping and completes deployment', async () => {
    const onComplete = jest.fn();
    render(<DeploymentWizard websiteId="web-1" onComplete={onComplete} />);

    fireEvent.click(screen.getByTestId('mock-integration-selector'));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    await waitFor(() => {
      expect(screen.getByTestId('mock-content-mapping')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Start deployment/i }));

    await waitFor(() => {
      expect(screen.getByText(/Deployment successful/i)).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it('calls onCancel when close is pressed after completion', async () => {
    const onCancel = jest.fn();
    render(<DeploymentWizard websiteId="web-1" onCancel={onCancel} />);

    fireEvent.click(screen.getByTestId('mock-integration-selector'));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    await waitFor(() => {
      expect(screen.getByTestId('mock-content-mapping')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Start deployment/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
    expect(onCancel).toHaveBeenCalled();
  });

});

