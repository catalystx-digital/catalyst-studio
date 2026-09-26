import React from 'react';
import { render } from '@testing-library/react';
import { resolveCmsIcon } from './icon-resolver';

test('unknown icon words render nothing without a fallback', () => {
  const { container } = render(<>{resolveCmsIcon('icon-embed-x')}</>);
  expect(container).toBeEmptyDOMElement();
});

test('known Lucide icon names still render an icon', () => {
  const { container } = render(<>{resolveCmsIcon('check')}</>);
  expect(container.querySelector('svg')).toBeInTheDocument();
});
