import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CTAButtonGroup from './index';
import {
  ComponentCategory,
  ComponentType,
} from '../../_core/types';

describe('CTAButtonGroup Component', () => {
  const baseProps = {
    id: 'cta-button-group-test',
    type: ComponentType.CTAButtonGroup,
    category: ComponentCategory.CTA,
    content: {
      heading: 'Choose your next step',
      subheading: 'Select the call to action that fits your workflow.',
      buttons: [
        { text: 'Start Trial', url: '/trial', variant: 'primary' as const },
        { text: 'Contact Sales', url: '/contact', variant: 'secondary' as const },
      ],
      alignment: 'center' as const,
      spacing: 'normal' as const,
    },
  };

  it('renders heading and subheading content', () => {
    render(<CTAButtonGroup {...baseProps} />);

    expect(screen.getByText('Choose your next step')).toBeInTheDocument();
    expect(
      screen.getByText('Select the call to action that fits your workflow.'),
    ).toBeInTheDocument();
  });

  it('fires interaction events when buttons are clicked', () => {
    const onInteraction = jest.fn();
    render(
      <CTAButtonGroup
        {...baseProps}
        onInteraction={onInteraction}
      />,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Start Trial' }));
    fireEvent.click(screen.getByRole('link', { name: 'Contact Sales' }));

    expect(onInteraction).toHaveBeenCalledWith('button-click', {
      index: 0,
      text: 'Start Trial',
      url: '/trial',
    });
    expect(onInteraction).toHaveBeenCalledWith('button-click', {
      index: 1,
      text: 'Contact Sales',
      url: '/contact',
    });
    expect(onInteraction).toHaveBeenCalledTimes(2);
  });

  it('renders fallback alert when no buttons are provided', () => {
    render(
      <CTAButtonGroup
        {...baseProps}
        content={{
          ...baseProps.content,
          buttons: [],
        }}
      />,
    );

    expect(
      screen.getByText('Add one or more CTA buttons to display this component.'),
    ).toBeInTheDocument();
  });

  it('stacks buttons vertically when orientation is set to vertical', () => {
    const { container } = render(
      <CTAButtonGroup
        {...baseProps}
        content={{
          ...baseProps.content,
          orientation: 'vertical' as const,
          fullWidthOnMobile: true,
        }}
      />,
    );

    const group = container.querySelector('.cms-button-group');
    expect(group).toHaveClass('sm:!flex-col');

    const buttons = screen.getAllByRole('link');
    buttons.forEach((element) => {
      expect(element).toHaveClass('w-full');
    });
  });
});
