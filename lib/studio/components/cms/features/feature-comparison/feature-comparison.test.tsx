import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FeatureComparison } from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';
import type { FeatureComparisonProps } from './feature-comparison.types';

describe('Component: FeatureComparison', () => {
  const mockProps: FeatureComparisonProps = {
    id: 'feature-comparison-1',
    type: ComponentType.PricingTable,
    category: ComponentCategory.Features,
    content: {
      heading: 'Compare Plans',
      subheading: 'Choose the right plan for your needs',
      products: [
        {
          name: 'Basic',
          price: '$9/mo',
          cta: { text: 'Get Started', url: '/signup/basic' }
        },
        {
          name: 'Pro',
          price: '$29/mo',
          recommended: true,
          cta: { text: 'Get Started', url: '/signup/pro' }
        },
        {
          name: 'Enterprise',
          price: 'Custom',
          cta: { text: 'Contact Us', url: '/contact' }
        }
      ],
      features: [
        {
          name: 'Users',
          description: 'Number of users',
          values: ['5', '25', 'Unlimited']
        },
        {
          name: 'Storage',
          values: ['10GB', '100GB', '1TB']
        },
        {
          name: 'API Access',
          values: [false, true, true]
        },
        {
          name: 'Priority Support',
          values: [false, false, true]
        }
      ]
    }
  };

  it('renders with required props', () => {
    render(<FeatureComparison {...mockProps} />);
    expect(screen.getByText('Compare Plans')).toBeInTheDocument();
    expect(screen.getByText('Choose the right plan for your needs')).toBeInTheDocument();
  });

  it('displays all products', () => {
    render(<FeatureComparison {...mockProps} />);
    expect(screen.getAllByText('Basic')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Pro')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Enterprise')[0]).toBeInTheDocument();
  });

  it('displays prices correctly', () => {
    render(<FeatureComparison {...mockProps} />);
    expect(screen.getAllByText('$9/mo')[0]).toBeInTheDocument();
    expect(screen.getAllByText('$29/mo')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Custom')[0]).toBeInTheDocument();
  });

  it('shows recommended badge', () => {
    render(<FeatureComparison {...mockProps} />);
    const recommendedElements = screen.getAllByText('Recommended');
    expect(recommendedElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders feature values correctly', () => {
    render(<FeatureComparison {...mockProps} />);
    expect(screen.getAllByText('5')[0]).toBeInTheDocument();
    expect(screen.getAllByText('25')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Unlimited')[0]).toBeInTheDocument();
  });

  it('renders boolean values with accessible indicators', () => {
    const { container } = render(<FeatureComparison {...mockProps} />);
    const positives = container.querySelectorAll('[data-cms-value="true"]');
    const negatives = container.querySelectorAll('[data-cms-value="false"]');
    expect(positives.length).toBeGreaterThan(0);
    expect(negatives.length).toBeGreaterThan(0);
  });

  it('handles missing optional props gracefully', () => {
    const minimalProps: FeatureComparisonProps = {
      ...mockProps,
      content: {
        products: [
          { name: 'Plan A' },
          { name: 'Plan B' }
        ],
        features: [
          { name: 'Feature 1', values: ['Yes', 'No'] }
        ]
      }
    };
    render(<FeatureComparison {...minimalProps} />);
    const planAElements = screen.getAllByText('Plan A');
    expect(planAElements.length).toBeGreaterThanOrEqual(1);
    const feature1Elements = screen.getAllByText('Feature 1');
    expect(feature1Elements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders CTA buttons', () => {
    render(<FeatureComparison {...mockProps} />);
    const getStartedButtons = screen.getAllByText('Get Started');
    expect(getStartedButtons.length).toBeGreaterThanOrEqual(2); // At least 2 for desktop or mobile
    const contactButtons = screen.getAllByText('Contact Us');
    expect(contactButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('handles keyboard navigation', () => {
    render(<FeatureComparison {...mockProps} />);
    const firstCTA = screen.getAllByText('Get Started')[0];
    firstCTA.focus();
    expect(firstCTA).toHaveFocus();
  });

  it('meets accessibility standards', () => {
    const { container } = render(<FeatureComparison {...mockProps} />);
    const section = container.querySelector('section');
    expect(section).toHaveAttribute('aria-label', 'Feature comparison');
    expect(section).toHaveAttribute('data-component-type');
  });

  it('handles interaction tracking', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    render(<FeatureComparison {...mockProps} />);
    
    const ctaButton = screen.getAllByText('Get Started')[0];
    fireEvent.click(ctaButton);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      'Interaction:',
      'comparison-cta-click',
      '/signup/basic'
    );
    consoleSpy.mockRestore();
  });

  it('renders feature descriptions when provided', () => {
    render(<FeatureComparison {...mockProps} />);
    expect(screen.getAllByText('Number of users')[0]).toBeInTheDocument();
  });
});
