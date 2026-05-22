import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PricingCard from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('PricingCard Component', () => {
  const defaultProps = {
    id: 'pricing-card-test',
    type: ComponentType.PricingCard,
    category: ComponentCategory.Pricing,
    content: {
      name: 'Professional Plan',
      description: 'Perfect for growing teams',
      price: 49.99,
      originalPrice: 69.99,
      currency: 'USD',
      period: 'monthly' as const,
      features: [
        { text: 'Unlimited projects', included: true },
        { text: '24/7 Support', included: true },
        { text: 'Advanced analytics', included: true, tooltip: 'Real-time insights' },
        { text: 'Custom integrations', included: false },
        { text: 'White-label options', included: false }
      ],
      ctaText: 'Get Started',
      ctaUrl: '/signup/pro',
      badge: { text: 'Best Value' },
      highlighted: true
    }
  };

  it('renders without crashing', () => {
    render(<PricingCard {...defaultProps} />);
    expect(screen.getByText('Professional Plan')).toBeInTheDocument();
  });

  it('displays plan name and description', () => {
    render(<PricingCard {...defaultProps} />);
    expect(screen.getByText('Professional Plan')).toBeInTheDocument();
    expect(screen.getByText('Perfect for growing teams')).toBeInTheDocument();
  });

  it('shows formatted price with currency', () => {
    render(<PricingCard {...defaultProps} />);
    expect(screen.getByText('$49.99')).toBeInTheDocument();
    expect(screen.getByText('/month')).toBeInTheDocument();
  });

  it('displays original price with discount percentage', () => {
    render(<PricingCard {...defaultProps} />);
    expect(screen.getByText('$69.99')).toBeInTheDocument();
    expect(screen.getByText(/Save 29%/)).toBeInTheDocument();
  });

  it('shows badge when provided', () => {
    render(<PricingCard {...defaultProps} />);
    expect(screen.getByText('Best Value')).toBeInTheDocument();
  });

  it('renders a configured badge icon', () => {
    const propsWithBadgeIcon = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        badge: { text: 'Best Value', icon: 'Star' }
      }
    };

    render(<PricingCard {...propsWithBadgeIcon} />);
    expect(screen.getByText('Best Value')).toBeInTheDocument();
    expect(document.querySelector('.lucide-star')).toBeInTheDocument();
  });

  it('renders included features with checkmarks', () => {
    render(<PricingCard {...defaultProps} />);
    expect(screen.getByText('Unlimited projects')).toBeInTheDocument();
    expect(screen.getByText('24/7 Support')).toBeInTheDocument();
    expect(screen.getByText('Advanced analytics')).toBeInTheDocument();
  });

  it('renders excluded features with X marks', () => {
    render(<PricingCard {...defaultProps} />);
    expect(screen.getByText('Custom integrations')).toBeInTheDocument();
    expect(screen.getByText('White-label options')).toBeInTheDocument();
  });

  it('handles annual billing period correctly', () => {
    const annualProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        period: 'annual' as const
      }
    };
    render(<PricingCard {...annualProps} />);
    expect(screen.getByText('/year')).toBeInTheDocument();
  });

  it('handles one-time payment correctly', () => {
    const oneTimeProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        period: 'one-time' as const
      }
    };
    render(<PricingCard {...oneTimeProps} />);
    expect(screen.queryByText('/month')).not.toBeInTheDocument();
    expect(screen.queryByText('/year')).not.toBeInTheDocument();
  });

  it('navigates to correct URL on CTA click', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null as unknown as Window);
    render(<PricingCard {...defaultProps} />);
    const ctaButton = screen.getByRole('button', { name: 'Get Started' });
    fireEvent.click(ctaButton);
    expect(openSpy).toHaveBeenCalledWith('/signup/pro', '_self');
    openSpy.mockRestore();
  });

  it('applies disabled state correctly', () => {
    const disabledProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        disabled: true
      }
    };
    render(<PricingCard {...disabledProps} />);
    const button = screen.getByRole('button', { name: 'Get Started' });
    expect(button).toBeDisabled();
  });

  it('applies highlighted styling', () => {
    render(<PricingCard {...defaultProps} />);
    const card = screen.getByTestId('pricing-card');
    expect(card.dataset.highlighted).toBe('true');
    expect(card.className).toContain('ring-primary');
  });

  it('renders different variants correctly', () => {
    const outlinedProps = {
      ...defaultProps,
      variant: 'outlined' as const
    };
    render(<PricingCard {...outlinedProps} />);
    const card = screen.getByTestId('pricing-card');
    expect(card.className).toContain('border-2');
  });

  it('meets accessibility standards', async () => {
    const { container } = render(<PricingCard {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('sanitizes user content', () => {
    const propsWithXSS = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        name: '<script>alert("XSS")</script>Pro Plan',
        description: '<img src=x onerror=alert("XSS")>Description'
      }
    };
    render(<PricingCard {...propsWithXSS} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(/Pro Plan/)).toBeInTheDocument();
  });

  it('renders within performance threshold', () => {
    const startTime = performance.now();
    render(<PricingCard {...defaultProps} />);
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(50); // 50ms threshold
  });
});
