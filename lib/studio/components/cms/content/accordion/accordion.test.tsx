import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Accordion } from './index';
import { AccordionProps } from './accordion.types';
import { ComponentCategory, ComponentType } from '../../_core/types';

const mockContent: AccordionProps['content'] = {
  heading: 'Frequently Asked Questions',
  subheading: 'Find answers to common questions',
  items: [
    {
      id: '1',
      title: 'What is React?',
      content: 'React is a JavaScript library for building user interfaces.',
      defaultOpen: true
    },
    {
      id: '2',
      title: 'How does it work?',
      content: 'React uses a virtual DOM to efficiently update the UI.'
    },
    {
      id: '3',
      title: 'Why use React?',
      content: 'React makes it easy to create interactive UIs.'
    }
  ],
  allowMultiple: true
};

const defaultProps: AccordionProps = {
  id: 'accordion-component',
  type: ComponentType.Accordion,
  category: ComponentCategory.Content,
  content: mockContent,
};

describe('CMSComponent: Accordion', () => {
  it('renders with required props', () => {
    render(<Accordion {...defaultProps} />);
    
    expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
    expect(screen.getByText('Find answers to common questions')).toBeInTheDocument();
    expect(screen.getByText('What is React?')).toBeInTheDocument();
  });

  it('renders accordion items correctly', () => {
    render(<Accordion {...defaultProps} />);
    
    mockContent.items.forEach(item => {
      expect(screen.getByText(item.title)).toBeInTheDocument();
    });
  });

  it('expands/collapses on click', async () => {
    render(<Accordion {...defaultProps} />);
    
    const secondItem = screen.getByRole('button', { name: 'How does it work?' });
    const secondItemContent = 'React uses a virtual DOM to efficiently update the UI.';
    
    expect(screen.queryByText(secondItemContent)).not.toBeInTheDocument();
    
    fireEvent.click(secondItem);
    
    await waitFor(() => {
      expect(screen.getByText(secondItemContent)).toBeVisible();
    });
    
    fireEvent.click(secondItem);
    
    await waitFor(() => {
      expect(screen.queryByText(secondItemContent)).not.toBeInTheDocument();
    });
  });

  it('handles keyboard navigation', async () => {
    render(<Accordion {...defaultProps} />);
    
    const secondItem = screen.getByRole('button', { name: 'How does it work?' });
    const secondItemContent = 'React uses a virtual DOM to efficiently update the UI.';
    const user = userEvent.setup();

    secondItem.focus();
    await user.keyboard('{Enter}');
    
    await waitFor(() => {
      expect(screen.getByText(secondItemContent)).toBeVisible();
    });
    
    await user.keyboard('{Enter}');
    
    await waitFor(() => {
      expect(screen.queryByText(secondItemContent)).not.toBeInTheDocument();
    });
  });

  it('respects allowMultiple setting', async () => {
    const singleContent = { ...mockContent, allowMultiple: false };
    render(<Accordion {...defaultProps} content={singleContent} />);
    
    const firstItem = screen.getByRole('button', { name: 'What is React?' });
    const secondItem = screen.getByRole('button', { name: 'How does it work?' });
    
    fireEvent.click(secondItem);
    
    await waitFor(() => {
      expect(screen.getByText('React uses a virtual DOM to efficiently update the UI.')).toBeVisible();
      expect(screen.queryByText('React is a JavaScript library for building user interfaces.')).not.toBeInTheDocument();
    });
  });

  it('meets accessibility standards', () => {
    render(<Accordion {...defaultProps} />);
    
    const accordionRegion = screen.getByRole('region', { name: 'Accordion' });
    expect(accordionRegion).toBeInTheDocument();
    
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toHaveAttribute('aria-expanded');
      expect(button).toHaveAttribute('aria-controls');
    });
  });

  it('handles defaultOpen items', () => {
    render(<Accordion {...defaultProps} />);
    
    expect(screen.getByText('React is a JavaScript library for building user interfaces.')).toBeVisible();
  });

  it('calls onItemToggle callback', async () => {
    const onItemToggle = jest.fn();
    render(<Accordion {...defaultProps} onItemToggle={onItemToggle} />);
    
    const secondItem = screen.getByRole('button', { name: 'How does it work?' });
    fireEvent.click(secondItem);
    
    await waitFor(() => {
      expect(onItemToggle).toHaveBeenCalledWith('2', true);
    });
  });

  it('applies theme and variant classes', () => {
    const { container } = render(
      <Accordion
        {...defaultProps}
        theme="dark"
        variant="detailed"
        className="custom-class"
      />
    );

    const accordion = container.querySelector('.custom-class');
    expect(accordion).toBeInTheDocument();

    const section = container.querySelector('[data-component-type="accordion"]');
    expect(section).toBeInTheDocument();
    expect(section).toHaveAttribute('data-component-id', defaultProps.id);
    expect(section).toHaveAttribute('data-variant', 'detailed');
  });

  it('performs within 50ms threshold', async () => {
    const startTime = performance.now();
    render(<Accordion {...defaultProps} />);
    const endTime = performance.now();
    
    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(50);
  });

  it('handles items with icons', () => {
    const contentWithIcons = {
      ...mockContent,
      items: mockContent.items.map(item => ({
        ...item,
        icon: '❓'
      }))
    };
    
    render(<Accordion {...defaultProps} content={contentWithIcons} />);
    
    const icons = screen.getAllByText('❓');
    expect(icons).toHaveLength(3);
  });

  it('handles custom expand/collapse icons', () => {
    const contentWithCustomIcons = {
      ...mockContent,
      items: mockContent.items.map(item => ({
        ...item,
        defaultOpen: false
      })),
      expandIcon: '+',
      collapseIcon: '-'
    };
    
    render(<Accordion {...defaultProps} content={contentWithCustomIcons} />);
    
    // Initially all items are collapsed, so we should see expand icons
    const expandIcons = screen.getAllByText('+');
    expect(expandIcons.length).toBe(mockContent.items.length);
    
    // Click the first item to expand it
    fireEvent.click(screen.getByRole('button', { name: 'What is React?' }));
    
    // Now we should see a collapse icon for the expanded item
    expect(screen.getByText('-')).toBeInTheDocument();
  });
});
