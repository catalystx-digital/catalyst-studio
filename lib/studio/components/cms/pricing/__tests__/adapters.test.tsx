import React from 'react';
import { render } from '@testing-library/react';

import { PricingTableAdapter, PricingCardAdapter } from '../adapters';
import { ComponentCategory, ComponentType } from '../../_core/types';

jest.mock('../pricing-table', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock('../pricing-card', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const PricingTableMock = require('../pricing-table').default as jest.Mock;
const PricingCardMock = require('../pricing-card').default as jest.Mock;

describe('Pricing adapters', () => {
  beforeEach(() => {
    PricingTableMock.mockClear();
    PricingCardMock.mockClear();
  });

  it('maps pricing table variant tokens', () => {
    render(
      <PricingTableAdapter
        id="pricing-table"
        type={ComponentType.PricingTable}
        category={ComponentCategory.Pricing}
        variant="expanded"
        theme="dark"
        content={{
          title: 'Plans',
          plans: [],
        }}
      />,
    );

    expect(PricingTableMock).toHaveBeenCalledTimes(1);
    const props = PricingTableMock.mock.calls[0][0];
    expect(props.variant).toBe('detailed');
    expect(props.theme).toBe('dark');
  });

  it('translates component variants for pricing cards', () => {
    render(
      <PricingCardAdapter
        id="pricing-card"
        type={ComponentType.PricingCard}
        category={ComponentCategory.Pricing}
        variant="minimal"
        content={{
          name: 'Starter',
          price: 9,
          currency: 'USD',
          period: 'monthly',
          features: [],
        }}
      />,
    );

    expect(PricingCardMock).toHaveBeenCalledTimes(1);
    const props = PricingCardMock.mock.calls[0][0];
    expect(props.variant).toBe('outlined');
  });

  it('falls back to filled variant for detailed cards', () => {
    render(
      <PricingCardAdapter
        id="pricing-card-detailed"
        type={ComponentType.PricingCard}
        category={ComponentCategory.Pricing}
        variant="detailed"
        content={{
          name: 'Enterprise',
          price: 199,
          currency: 'USD',
          period: 'monthly',
          features: [],
        }}
      />,
    );

    expect(PricingCardMock).toHaveBeenCalledTimes(1);
    const props = PricingCardMock.mock.calls[0][0];
    expect(props.variant).toBe('filled');
  });
});
