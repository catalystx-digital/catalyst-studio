import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Tabs } from './index';
import { TabsProps } from './tabs.types';
import { ComponentCategory, ComponentType } from '../../_core/types';

const mockContent: TabsProps['content'] = {
  heading: 'Product Features',
  subheading: 'Explore our key features',
  tabs: [
    {
      id: '1',
      label: 'Overview',
      content: 'This is the overview content.',
      icon: '📋'
    },
    {
      id: '2',
      label: 'Features',
      content: 'This is the features content.',
      badge: 'New'
    },
    {
      id: '3',
      label: 'Pricing',
      content: 'This is the pricing content.',
      disabled: false
    },
    {
      id: '4',
      label: 'Support',
      content: 'This is the support content.',
      disabled: true
    }
  ],
  defaultTab: '1'
};

const defaultProps: TabsProps = {
  id: 'tabs-component',
  type: ComponentType.Tabs,
  category: ComponentCategory.Content,
  content: mockContent,
};

describe('CMSComponent: Tabs', () => {
  it('renders with required props', () => {
    render(<Tabs {...defaultProps} />);
    
    expect(screen.getByText('Product Features')).toBeInTheDocument();
    expect(screen.getByText('Explore our key features')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('renders all tab buttons', () => {
    render(<Tabs {...defaultProps} />);
    
    mockContent.tabs.forEach(tab => {
      expect(screen.getByText(tab.label)).toBeInTheDocument();
    });
  });

  it('switches content on tab click', async () => {
    const { container } = render(<Tabs {...defaultProps} />);

    const getRoot = () => container.querySelector('[data-active-tab]');
    expect(getRoot()).toHaveAttribute('data-active-tab', '1');

    const user = userEvent.setup();
    const featuresTab = screen.getByRole('tab', { name: /Features/i });
    await user.click(featuresTab);

    await waitFor(() => {
      expect(getRoot()).toHaveAttribute('data-active-tab', '2');
    });
  });

  it('handles keyboard navigation', async () => {
    const { container } = render(<Tabs {...defaultProps} />);

    const getRoot = () => container.querySelector('[data-active-tab]');
    const overviewTab = screen.getByRole('tab', { name: /Overview/i });
    fireEvent.focus(overviewTab);

    fireEvent.keyDown(overviewTab, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(getRoot()).toHaveAttribute('data-active-tab', '2');
    });

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });

    await waitFor(() => {
      expect(getRoot()).toHaveAttribute('data-active-tab', '1');
    });
  });

  it('handles Home and End keys', async () => {
    const { container } = render(<Tabs {...defaultProps} />);

    const getRoot = () => container.querySelector('[data-active-tab]');
    const overviewTab = screen.getByRole('tab', { name: /Overview/i });
    fireEvent.focus(overviewTab);

    fireEvent.keyDown(overviewTab, { key: 'End' });

    await waitFor(() => {
      expect(getRoot()).toHaveAttribute('data-active-tab', '3');
    });

    fireEvent.keyDown(document.activeElement!, { key: 'Home' });

    await waitFor(() => {
      expect(getRoot()).toHaveAttribute('data-active-tab', '1');
    });
  });

  it('skips disabled tabs in keyboard navigation', async () => {
    const { container } = render(<Tabs {...defaultProps} />);

    const getRoot = () => container.querySelector('[data-active-tab]');
    const user = userEvent.setup();
    const pricingTab = screen.getByRole('tab', { name: /Pricing/i });
    await user.click(pricingTab);

    await waitFor(() => {
      expect(getRoot()).toHaveAttribute('data-active-tab', '3');
    });

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(getRoot()).toHaveAttribute('data-active-tab', '1');
    });
  });

  it('does not switch to disabled tabs', async () => {
    const { container } = render(<Tabs {...defaultProps} />);

    const getRoot = () => container.querySelector('[data-active-tab]');
    const user = userEvent.setup();
    const supportTab = screen.getByRole('tab', { name: /Support/i });
    await user.click(supportTab);

    expect(getRoot()).toHaveAttribute('data-active-tab', '1');
  });

  it('meets accessibility standards', () => {
    render(<Tabs {...defaultProps} />);
    
    const tabList = screen.getByRole('tablist');
    expect(tabList).toBeInTheDocument();
    
    const tabs = screen.getAllByRole('tab');
    tabs.forEach(tab => {
      expect(tab).toHaveAttribute('aria-selected');
      expect(tab).toHaveAttribute('aria-controls');
    });
    
    const tabPanel = screen.getByRole('tabpanel');
    expect(tabPanel).toBeInTheDocument();
    expect(tabPanel).toHaveAttribute('aria-labelledby');
  });

  it('renders with icons and badges', () => {
    render(<Tabs {...defaultProps} />);
    
    expect(screen.getByText('📋')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('calls onTabChange callback', async () => {
    const user = userEvent.setup();
    const onTabChange = jest.fn();
    render(<Tabs {...defaultProps} onTabChange={onTabChange} />);
    
    const featuresTab = screen.getByRole('tab', { name: /Features/i });
    await user.click(featuresTab);
    
    await waitFor(() => {
      expect(onTabChange).toHaveBeenCalledWith(mockContent.tabs[1].id);
    });
  });

  it('applies theme and variant classes', () => {
    const { container } = render(
      <Tabs
        {...defaultProps}
        theme="dark"
        variant="detailed"
        className="custom-class"
      />
    );

    const tabs = container.querySelector('.custom-class');
    expect(tabs).toBeInTheDocument();
    expect(tabs).toHaveClass('variant-detailed');

    const section = container.querySelector('[data-component-type="tabs"]');
    expect(section).toBeInTheDocument();
    expect(section).toHaveAttribute('data-component-id', defaultProps.id);
    expect(section).toHaveAttribute('data-variant', 'detailed');
  });

  it('normalizes legacy CMS tab entries', async () => {
    const legacyContent: TabsProps['content'] = {
      heading: 'Recipes',
      tabs: [
        {
          content: {
            label: 'All',
            active: true
          }
        },
        {
          content: {
            label: 'Breakfast',
            content: 'Morning favourites'
          }
        }
      ],
      defaultActiveTab: 'Breakfast'
    };

    render(<Tabs {...defaultProps} content={legacyContent} />);

    const allTab = screen.getByRole('tab', { name: /All/i });
    const breakfastTab = screen.getByRole('tab', { name: /Breakfast/i });

    expect(allTab).toBeInTheDocument();
    expect(breakfastTab).toBeInTheDocument();
    expect(breakfastTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Morning favourites')).toBeInTheDocument();
  });

  it('handles vertical orientation', () => {
    const verticalContent = { ...mockContent, orientation: 'vertical' as const };
    const { container } = render(<Tabs {...defaultProps} content={verticalContent} />);
    
    const tabList = screen.getByRole('tablist');
    expect(tabList).toHaveAttribute('aria-orientation', 'vertical');
    expect(tabList).toHaveClass('flex-col');
    expect(container.querySelector('.cms-tabs-layout')).toHaveClass('flex-col');
  });

  it('performs within 50ms threshold', async () => {
    const startTime = performance.now();
    render(<Tabs {...defaultProps} />);
    const endTime = performance.now();
    
    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(50);
  });
});
