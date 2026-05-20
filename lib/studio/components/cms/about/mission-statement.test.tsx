import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import MissionStatement, {
  MissionStatementProps,
} from './mission-statement';
import { ComponentCategory, ComponentType } from '../_core/types';

jest.mock('../_core/monitoring', () => ({
  withPerformanceTracking: (Component: any) => Component,
}));

describe('MissionStatement', () => {
  const defaultProps: MissionStatementProps = {
    id: 'mission-1',
    type: ComponentType.Mission,
    category: ComponentCategory.About,
    content: {
      title: 'Our Mission',
      mission:
        'To deliver exceptional value and innovation to our community partners.',
      vision:
        'A future where technology empowers everyone to participate and thrive.',
      values: ['Integrity', 'Collaboration', 'Innovation'],
    },
  };

  it('renders title, mission, vision, and values with design tokens', () => {
    render(<MissionStatement {...defaultProps} />);

    expect(
      screen.getByRole('heading', { name: 'Our Mission' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'To deliver exceptional value and innovation to our community partners.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Our Vision' }),
    ).toBeInTheDocument();

    const values = screen.getAllByRole('listitem');
    expect(values).toHaveLength(3);
    values.forEach((value) => {
      expect(value.querySelector('.cms-badge')).toBeInTheDocument();
    });
  });

  it('normalizes value strings from multiple shapes', () => {
    const props: MissionStatementProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        values: [
          'Integrity',
          { label: 'Empathy' },
          { title: 'Inclusivity' },
          { value: 'Transparency' },
          { text: 'Sustainability' },
          123 as unknown as string,
        ],
      },
    };

    render(<MissionStatement {...props} />);

    expect(screen.getByText('Empathy')).toBeInTheDocument();
    expect(screen.getByText('Inclusivity')).toBeInTheDocument();
    expect(screen.getByText('Transparency')).toBeInTheDocument();
    expect(screen.getByText('Sustainability')).toBeInTheDocument();
    expect(screen.queryByText('123')).not.toBeInTheDocument();
  });

  it('sanitizes user-provided copy', () => {
    const props: MissionStatementProps = {
      ...defaultProps,
      content: {
        title: '<script>alert("x")</script>Mission',
        mission: '<b>Secure mission</b>',
        vision: 'A <em>trusted</em> future',
        values: ['<img src=x onerror=alert(1)>'],
      },
    };

    render(<MissionStatement {...props} />);

    expect(screen.getByRole('heading', { name: 'Mission' })).toBeInTheDocument();
    expect(screen.queryByText('alert("x")')).not.toBeInTheDocument();
    expect(screen.getByText('Secure mission')).toBeInTheDocument();
    expect(screen.getByText('A trusted future')).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('invokes onInteraction when a value badge is clicked', () => {
    const onInteraction = jest.fn();
    render(
      <MissionStatement
        {...defaultProps}
        onInteraction={onInteraction}
      />,
    );

    fireEvent.click(screen.getByText('Integrity'));

    expect(onInteraction).toHaveBeenCalledWith('value-click', {
      value: 'Integrity',
    });
  });

  it('applies theme and variant classes', () => {
    const { container } = render(
      <MissionStatement
        {...defaultProps}
        theme="dark"
        variant="minimal"
      />,
    );

    const section = container.querySelector('section');
    expect(section).toHaveClass('theme-dark');
    expect(section).toHaveClass('variant-minimal');
  });
});
