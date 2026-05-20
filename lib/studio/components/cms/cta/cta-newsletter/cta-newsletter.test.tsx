import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import CTANewsletter from './index';
import {
  ComponentCategory,
  ComponentType,
} from '../../_core/types';

describe('CTANewsletter Component', () => {
  const baseProps = {
    id: 'cta-newsletter-test',
    type: ComponentType.CTAWithForm,
    category: ComponentCategory.CTA,
    content: {
      heading: 'Stay in the loop',
      subheading:
        'Subscribe to receive product updates and launch news.',
      placeholder: 'you@example.com',
      buttonText: 'Notify me',
      successMessage: 'Check your inbox for a confirmation.',
      errorMessage: 'Unable to process your request.',
      privacyText: 'We respect your privacy.',
      privacyLink: 'https://example.com/privacy',
    },
  };

  const originalFetch = global.fetch;

  afterEach(() => {
    jest.clearAllMocks();
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (global as unknown as { fetch?: typeof fetch }).fetch;
    }
  });

  it('renders heading and subheading copy', () => {
    render(<CTANewsletter {...baseProps} />);

    expect(
      screen.getByText('Stay in the loop'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Subscribe to receive product updates and launch news.',
      ),
    ).toBeInTheDocument();
  });

  it('renders subheadingHtml with inline links when provided', () => {
    render(
      <CTANewsletter
        {...baseProps}
        content={{
          ...baseProps.content,
          subheadingHtml:
            'I agree to the <a href="https://example.com/privacy">privacy policy</a> and center updates.',
        }}
      />,
    );

    const link = screen.getByRole('link', { name: 'privacy policy' });
    expect(link).toHaveAttribute('href', 'https://example.com/privacy');
  });

  it('shows validation feedback for invalid email input', async () => {
    render(<CTANewsletter {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Notify me' }));

    await waitFor(() => {
      expect(
        screen.getByText('Email is required.'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Please enter a valid email before submitting.'),
      ).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByPlaceholderText('you@example.com'),
      { target: { value: 'invalid' } },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Notify me' }));

    await waitFor(() =>
      expect(
        screen.getByText('Enter a valid email address.'),
      ).toBeInTheDocument(),
    );
  });

  it('submits successfully without remote form action', async () => {
    const onInteraction = jest.fn();
    render(
      <CTANewsletter
        {...baseProps}
        onInteraction={onInteraction}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText('you@example.com'),
      { target: { value: 'user@example.com' } },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Notify me' }));

    await waitFor(() =>
      expect(
        screen.getByTestId('newsletter-status'),
      ).toHaveTextContent(
        'Check your inbox for a confirmation.',
      ),
    );

    expect(onInteraction).toHaveBeenCalledWith(
      'newsletter-submit',
      { email: 'user@example.com' },
    );
    expect(onInteraction).toHaveBeenCalledTimes(1);
    expect(global.fetch).toBe(originalFetch);
  });

  it('surfaces errors from remote form submission', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Server error',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const onInteraction = jest.fn();
    render(
      <CTANewsletter
        {...baseProps}
        onInteraction={onInteraction}
        content={{
          ...baseProps.content,
          formAction: 'https://example.com/subscribe',
          emailFieldName: 'subscriber[email]',
        }}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText('you@example.com'),
      { target: { value: 'user@example.com' } },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Notify me' }));

    await waitFor(() =>
      expect(
        screen.getByTestId('newsletter-status'),
      ).toHaveTextContent('Server error'),
    );

    expect(onInteraction).toHaveBeenCalledWith(
      'newsletter-submit',
      { email: 'user@example.com' },
    );
    expect(onInteraction).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/subscribe',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    const fetchBody = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit)
        .body as string,
    );
    expect(fetchBody).toMatchObject({
      email: 'user@example.com',
      'subscriber[email]': 'user@example.com',
    });
  });

  it('suppresses submissions flagged by the honeypot field', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const onInteraction = jest.fn();

    const { container } = render(
      <CTANewsletter
        {...baseProps}
        onInteraction={onInteraction}
        content={{
          ...baseProps.content,
          honeypot: true,
        }}
      />,
    );

    const emailInput = screen.getByPlaceholderText('you@example.com');
    fireEvent.change(emailInput, {
      target: { value: 'bot@example.com' },
    });

    const honeypotInput = container.querySelector<HTMLInputElement>(
      'input[name="_honeypot"]',
    );
    expect(honeypotInput).toBeTruthy();

    if (honeypotInput) {
      fireEvent.change(honeypotInput, {
        target: { value: 'spam-link' },
      });
    }

    fireEvent.click(screen.getByRole('button', { name: 'Notify me' }));

    await waitFor(() =>
      expect(
        screen.getByTestId('newsletter-status'),
      ).toHaveTextContent('Check your inbox for a confirmation.'),
    );

    expect(onInteraction).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
