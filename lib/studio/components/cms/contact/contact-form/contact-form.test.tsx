import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContactForm from './index';
import { ContactFormProps } from './contact-form.types';
import { ComponentType, ComponentCategory } from '@/lib/studio/components/cms/_core/types';

// Mock fetch
global.fetch = jest.fn();

const mockProps: ContactFormProps = {
  id: 'test-contact-form',
  type: ComponentType.ContactForm,
  category: ComponentCategory.Contact,
  content: {
    title: 'Contact Us',
    description: 'Get in touch with our team',
    fields: [
      {
        name: 'name',
        type: 'text',
        label: 'Name',
        placeholder: 'Your name',
        required: true,
        validation: {
          minLength: 2,
          maxLength: 50,
        }
      },
      {
        name: 'email',
        type: 'email',
        label: 'Email',
        placeholder: 'your@email.com',
        required: true,
      },
      {
        name: 'phone',
        type: 'tel',
        label: 'Phone',
        placeholder: '+1 234 567 8900',
        required: false,
      },
      {
        name: 'message',
        type: 'textarea',
        label: 'Message',
        placeholder: 'Your message',
        required: true,
        validation: {
          minLength: 10,
          maxLength: 500,
        }
      },
    ],
    submitButton: {
      text: 'Send Message',
      loadingText: 'Sending…',
    },
    successMessage: 'Message sent successfully!',
    errorMessage: 'Failed to send message.',
    endpoint: '/api/contact',
    honeypot: true,
    resetOnSuccess: true,
    consent: {
      label: 'I agree to the Catalyst privacy policy.',
      link: {
        label: 'Read the privacy policy',
        href: '/privacy',
      },
    },
  },
};

const acceptConsent = () => {
  const consentCheckbox = screen.getByRole('checkbox', {
    name: /privacy policy/i,
  });
  fireEvent.click(consentCheckbox);
};

describe('ContactForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all form fields correctly', () => {
    render(<ContactForm {...mockProps} />);

    expect(screen.getByText('Contact Us')).toBeInTheDocument();
    expect(screen.getByText('Get in touch with our team')).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Message/)).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /privacy policy/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('0 / 500')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Send Message/i }),
    ).toBeInTheDocument();
  });

  it('requires privacy consent before enabling submission', async () => {
    jest.useFakeTimers();
    try {
      render(<ContactForm {...mockProps} />);

      const submitButton = screen.getByRole('button', { name: /Send Message/i });
      const consentCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i });

      expect(submitButton).toBeDisabled();

      fireEvent.click(consentCheckbox);
      expect(submitButton).not.toBeDisabled();

      fireEvent.click(consentCheckbox);
      expect(submitButton).toBeDisabled();

      act(() => {
        jest.advanceTimersByTime(320);
      });

      await waitFor(() =>
        expect(
          screen.getByText('Please accept the consent terms to continue.'),
        ).toBeInTheDocument(),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('validates required fields', async () => {
    render(<ContactForm {...mockProps} />);

    const submitButton = screen.getByRole('button', { name: /Send Message/i });
    expect(submitButton).toBeDisabled();
    acceptConsent();
    expect(submitButton).not.toBeDisabled();
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Message is required')).toBeInTheDocument();
      expect(screen.getByText('Please fix the highlighted fields and try again.')).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    render(<ContactForm {...mockProps} />);

    const emailInput = screen.getByLabelText(/Email/);
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    acceptConsent();
    const submitButton = screen.getByRole('button', { name: /Send Message/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
  });

  it('validates phone format', async () => {
    render(<ContactForm {...mockProps} />);

    const phoneInput = screen.getByLabelText(/Phone/);
    fireEvent.change(phoneInput, { target: { value: '123' } });

    acceptConsent();
    const submitButton = screen.getByRole('button', { name: /Send Message/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid phone number')).toBeInTheDocument();
    });
  });

  it('validates min and max length', async () => {
    render(<ContactForm {...mockProps} />);

    const nameInput = screen.getByLabelText(/Name/);
    const messageInput = screen.getByLabelText(/Message/);

    fireEvent.change(nameInput, { target: { value: 'a' } });
    fireEvent.change(messageInput, { target: { value: 'short' } });

    acceptConsent();
    const submitButton = screen.getByRole('button', { name: /Send Message/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
      expect(screen.getByText('Message must be at least 10 characters')).toBeInTheDocument();
    });
  });

  it('submits form successfully', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ success: true }),
    });

    render(<ContactForm {...mockProps} />);

    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/Message/), { target: { value: 'This is a test message' } });

    acceptConsent();
    const submitButton = screen.getByRole('button', { name: /Send Message/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Sending…')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Message sent successfully!')).toBeInTheDocument();
    });

    expect(screen.getByRole('status')).toHaveTextContent('Message sent successfully!');

    expect(fetch).toHaveBeenCalledWith('/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'This is a test message',
        consentAccepted: true,
      }),
    });
  });

  it('handles submission errors', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new TypeError('Network error'));

    render(<ContactForm {...mockProps} />);

    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/Message/), { target: { value: 'This is a test message' } });

    acceptConsent();
    const submitButton = screen.getByRole('button', { name: /Send Message/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to send message.')).toBeInTheDocument();
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to send message.');
  });

  it('honeypot field silently rejects spam submissions', async () => {
    render(<ContactForm {...mockProps} />);

    // Fill in form fields
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Spam Bot' } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'spam@bot.com' } });
    fireEvent.change(screen.getByLabelText(/Message/), { target: { value: 'Spam message' } });

    // Fill honeypot field (should be hidden from users)
    const honeypotField = document.querySelector('input[name="_honeypot"]') as HTMLInputElement;
    expect(honeypotField).toBeInTheDocument();
    expect(honeypotField.className).toContain('sr-only');
    expect(honeypotField).toHaveAttribute('tabIndex', '-1');
    
    // Simulate bot filling the honeypot
    fireEvent.change(honeypotField, { target: { value: 'bot-filled-this' } });

    acceptConsent();
    const submitButton = screen.getByRole('button', { name: /Send Message/i });
    fireEvent.click(submitButton);

    // Should show success message but not actually submit
    await waitFor(() => {
      expect(screen.getByText('Message sent successfully!')).toBeInTheDocument();
    });

    // Fetch should NOT have been called
    expect(fetch).not.toHaveBeenCalled();
  });

  it('resets form after successful submission when resetOnSuccess is true', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ success: true }),
    });

    render(<ContactForm {...mockProps} />);

    const nameInput = screen.getByLabelText(/Name/) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/Message/), { target: { value: 'Test message here' } });

    acceptConsent();
    const submitButton = screen.getByRole('button', { name: /Send Message/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Message sent successfully!')).toBeInTheDocument();
    });

    expect(nameInput.value).toBe('');
  });

  it('includes honeypot field when enabled', () => {
    render(<ContactForm {...mockProps} />);
    
    const honeypotField = document.querySelector('input[name="_honeypot"]');
    expect(honeypotField).toBeInTheDocument();
    expect((honeypotField as HTMLInputElement).className).toContain('sr-only');
  });

  it('handles select field correctly', async () => {
    const propsWithSelect: ContactFormProps = {
      ...mockProps,
      content: {
        ...mockProps.content,
        fields: [
          {
            name: 'subject',
            type: 'select',
            label: 'Subject',
            required: true,
            options: [
              { value: 'general', label: 'General Inquiry' },
              { value: 'support', label: 'Support' },
            ],
          },
        ],
      },
    };

    render(<ContactForm {...propsWithSelect} />);
    
    const selectField = screen.getByRole('combobox');
    expect(selectField).toBeInTheDocument();

    fireEvent.mouseDown(selectField);

    await waitFor(() => {
      expect(screen.getByText('General Inquiry')).toBeInTheDocument();
      expect(screen.getByText('Support')).toBeInTheDocument();
    });
  });

  it('handles checkbox field correctly', () => {
    const propsWithCheckbox: ContactFormProps = {
      ...mockProps,
      content: {
        ...mockProps.content,
        fields: [
          {
            name: 'consent',
            type: 'checkbox',
            label: 'I agree to the terms',
            required: true,
          },
        ],
      },
    };

    render(<ContactForm {...propsWithCheckbox} />);
    
    const checkboxField = screen.getByRole('checkbox');
    expect(checkboxField).toBeInTheDocument();
    expect(screen.getByText('I agree to the terms')).toBeInTheDocument();
  });

  it('debounces field validation after changes', async () => {
    jest.useFakeTimers();
    try {
      render(<ContactForm {...mockProps} />);

      const emailInput = screen.getByLabelText(/Email/);
      act(() => {
        fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      });

      act(() => {
        jest.advanceTimersByTime(320);
      });

      await waitFor(() =>
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument(),
      );
    } finally {
      jest.useRealTimers();
    }
  });

});
