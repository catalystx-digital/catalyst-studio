import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DeploymentResults } from './deployment-results';
import { DeploymentJob, CMSProvider, DeploymentMetrics } from '@/lib/deployment/deployment-types';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
  },
}));

describe('DeploymentResults', () => {
  const mockJob: DeploymentJob = {
    id: 'deploy-123',
    providerId: 'optimizely',
    status: 'completed',
    progress: 100,
    startedAt: new Date('2024-01-01T10:00:00'),
    completedAt: new Date('2024-01-01T10:01:30'),
    logs: [
      { timestamp: new Date(), level: 'info', message: 'Deployment started' },
      { timestamp: new Date(), level: 'info', message: 'Deployment completed' },
    ],
  };

  const mockProvider: CMSProvider = {
    id: 'optimizely',
    name: 'Optimizely',
    description: 'Test provider',
    logo: '/test.svg',
    connectionStatus: 'connected',
    config: {},
  };

  const mockMetrics: DeploymentMetrics = {
    timeTaken: 90000,
    contentItemsProcessed: 25,
    bytesTransferred: 5242880,
    successRate: 1.0,
  };

  const mockOnRetry = jest.fn();
  const mockOnViewDetails = jest.fn();
  const mockOnExportLogs = jest.fn();

  beforeEach(() => {
    mockOnRetry.mockClear();
    mockOnViewDetails.mockClear();
    mockOnExportLogs.mockClear();
  });

  it('renders successful deployment results', () => {
    render(
      <DeploymentResults
        job={mockJob}
        provider={mockProvider}
        metrics={mockMetrics}
        onRetry={mockOnRetry}
        onViewDetails={mockOnViewDetails}
        onExportLogs={mockOnExportLogs}
      />
    );

    expect(screen.getByText('Deployment Successful')).toBeInTheDocument();
    expect(screen.getByText('Deployment to Optimizely completed')).toBeInTheDocument();
  });

  it('displays deployment summary information', () => {
    render(
      <DeploymentResults
        job={mockJob}
        provider={mockProvider}
        metrics={mockMetrics}
      />
    );

    expect(screen.getByText('deploy-123')).toBeInTheDocument();
    expect(screen.getByText('Optimizely')).toBeInTheDocument();
    expect(screen.getByText('1m 30s')).toBeInTheDocument(); // Duration
  });

  it('shows performance metrics for successful deployment', () => {
    render(
      <DeploymentResults
        job={mockJob}
        provider={mockProvider}
        metrics={mockMetrics}
      />
    );

    expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument(); // Content items
    expect(screen.getByText('100.0%')).toBeInTheDocument(); // Success rate
    expect(screen.getByText('5.00 MB')).toBeInTheDocument(); // Data transferred
  });

  it('displays deployment URL for successful deployment', () => {
    render(
      <DeploymentResults
        job={mockJob}
        provider={mockProvider}
        metrics={mockMetrics}
      />
    );

    const deploymentUrl = screen.getByText(/optimizely-preview\.example\.com/);
    expect(deploymentUrl).toBeInTheDocument();
    expect(deploymentUrl.closest('a')).toHaveAttribute('target', '_blank');
  });

  it('shows error details for failed deployment', () => {
    const failedJob: DeploymentJob = {
      ...mockJob,
      status: 'failed',
      error: 'Connection timeout',
      retryCount: 2,
      maxRetries: 3,
    };

    render(
      <DeploymentResults
        job={failedJob}
        provider={mockProvider}
        onRetry={mockOnRetry}
      />
    );

    expect(screen.getByText('Deployment Failed')).toBeInTheDocument();
    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
    expect(screen.getByText('Failed after 2 retry attempts')).toBeInTheDocument();
  });

  it('shows retry button for failed deployment', () => {
    const failedJob: DeploymentJob = {
      ...mockJob,
      status: 'failed',
      error: 'Connection timeout',
    };

    render(
      <DeploymentResults
        job={failedJob}
        provider={mockProvider}
        onRetry={mockOnRetry}
      />
    );

    const retryButton = screen.getByText('Retry Deployment');
    expect(retryButton).toBeInTheDocument();
    
    fireEvent.click(retryButton);
    expect(mockOnRetry).toHaveBeenCalled();
  });

  it('shows cancelled status correctly', () => {
    const cancelledJob: DeploymentJob = {
      ...mockJob,
      status: 'cancelled',
    };

    render(
      <DeploymentResults
        job={cancelledJob}
        provider={mockProvider}
      />
    );

    expect(screen.getByText('Deployment Cancelled')).toBeInTheDocument();
    expect(screen.getByText('Deployment to Optimizely ended')).toBeInTheDocument();
  });

  it('displays recent logs', () => {
    const jobWithLogs: DeploymentJob = {
      ...mockJob,
      logs: [
        { timestamp: new Date(), level: 'info', message: 'Starting deployment' },
        { timestamp: new Date(), level: 'warning', message: 'Retrying connection' },
        { timestamp: new Date(), level: 'error', message: 'Failed to connect' },
        { timestamp: new Date(), level: 'info', message: 'Rollback initiated' },
        { timestamp: new Date(), level: 'info', message: 'Rollback completed' },
      ],
    };

    render(
      <DeploymentResults
        job={jobWithLogs}
        provider={mockProvider}
      />
    );

    expect(screen.getByText('Recent Logs')).toBeInTheDocument();
    // Should show last 5 logs
    expect(screen.getByText('Starting deployment')).toBeInTheDocument();
    expect(screen.getByText('Rollback completed')).toBeInTheDocument();
  });

  it('calls onExportLogs when export button is clicked', () => {
    render(
      <DeploymentResults
        job={mockJob}
        provider={mockProvider}
        onExportLogs={mockOnExportLogs}
      />
    );

    const exportButton = screen.getByText('Export Logs');
    fireEvent.click(exportButton);
    
    expect(mockOnExportLogs).toHaveBeenCalled();
  });

  it('calls onViewDetails when view details button is clicked', () => {
    render(
      <DeploymentResults
        job={mockJob}
        provider={mockProvider}
        onViewDetails={mockOnViewDetails}
      />
    );

    const detailsButton = screen.getByText('View Details');
    fireEvent.click(detailsButton);
    
    expect(mockOnViewDetails).toHaveBeenCalled();
  });

  it('opens deployed content in new tab', () => {
    const mockOpen = jest.fn();
    window.open = mockOpen;

    render(
      <DeploymentResults
        job={mockJob}
        provider={mockProvider}
      />
    );

    const viewButton = screen.getByText('View Deployed Content');
    fireEvent.click(viewButton);
    
    expect(mockOpen).toHaveBeenCalledWith(
      expect.stringContaining('optimizely-preview.example.com'),
      '_blank'
    );
  });

  it('handles undefined completedAt gracefully', () => {
    const runningJob: DeploymentJob = {
      ...mockJob,
      status: 'running',
      completedAt: undefined,
    };

    render(
      <DeploymentResults
        job={runningJob}
        provider={mockProvider}
      />
    );

    expect(screen.getByText('N/A')).toBeInTheDocument(); // Duration shows N/A
  });

  it('calculates average processing time correctly', () => {
    render(
      <DeploymentResults
        job={mockJob}
        provider={mockProvider}
        metrics={mockMetrics}
      />
    );

    // 90000ms / 25 items = 3600ms = 3.60s per item
    expect(screen.getByText('3600.00s per item')).toBeInTheDocument();
  });
});