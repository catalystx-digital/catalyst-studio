import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SimpleForm from './index';
import { SimpleFormProps } from './simple-form.types';
import { ComponentType, ComponentCategory } from '@/lib/studio/components/cms/_core/types';

// Mock fetch
global.fetch = jest.fn();

const mockProps: SimpleFormProps = {
  id: 'test-simple-form',
  type: ComponentType.SimpleForm,
  category: ComponentCategory.Contact,
  content: {
    title: 'Quick Contact',
    description: 'Send us a message',
    fields: [
      {
        name: 'name',
        type: 'text',
        placeholder: 'Your name',
        required: true,
      },
      {
        name: 'email',
        type: 'email',
        placeholder: 'Your email',
        required: true,
      },
    ],
    submitButton: {
      text: 'Send Message',
      loadingText: 'Sending…',
    },
    successMessage: 'Message sent!',
    errorMessage: 'Failed to send.',
    layout: 'stacked',
    endpoint: '/api/contact',
    resetOnSuccess: true,
  },
};

describe('SimpleForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders form with title and description', () => {
    render(<SimpleForm {...mockProps} />);
    
    expect(screen.getByText('Quick Contact')).toBeInTheDocument();
    expect(screen.getByText('Send us a message')).toBeInTheDocument();
  });

  it('renders all form fields', () => {
    render(<SimpleForm {...mockProps} />);
    
    expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your email')).toBeInTheDocument();
    expect(screen.getByText('Send Message')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<SimpleForm {...mockProps} />);

    const submitButton = screen.getByText('Send Message');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Your name.*is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Your email.*is required/i)).toBeInTheDocument();
      expect(screen.getByText('Please fix the highlighted fields and try again.')).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    render(<SimpleForm {...mockProps} />);

    const emailInput = screen.getByPlaceholderText('Your email');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    const submitButton = screen.getByText('Send Message');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
  });

  it('submits form successfully', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: 'Submitted!' }),
    });

    render(<SimpleForm {...mockProps} />);

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByPlaceholderText('Your email'), { target: { value: 'john@example.com' } });

    const submitButton = screen.getByText('Send Message');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Sending…')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Submitted!')).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith('/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
        consent: false,
      }),
    });
  });

  it('handles submission errors', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new TypeError('Network error'));

    render(<SimpleForm {...mockProps} />);

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByPlaceholderText('Your email'), { target: { value: 'john@example.com' } });

    const submitButton = screen.getByText('Send Message');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to send.')).toBeInTheDocument();
    });
  });

  it('resets form after successful submission when resetOnSuccess is true', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<SimpleForm {...mockProps} />);

    const nameInput = screen.getByPlaceholderText('Your name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByPlaceholderText('Your email'), { target: { value: 'john@example.com' } });

    const submitButton = screen.getByText('Send Message');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Message sent!')).toBeInTheDocument();
    });

    expect(nameInput.value).toBe('');
  });

  it('renders newsletter template correctly', () => {
    const newsletterProps: SimpleFormProps = {
      ...mockProps,
      content: {
        template: 'newsletter',
        fields: [],
        submitButton: {
          text: 'Subscribe',
        },
      },
    };

    render(<SimpleForm {...newsletterProps} />);
    
    expect(screen.getByText('Subscribe to Newsletter')).toBeInTheDocument();
    expect(screen.getByText('Get the latest updates delivered to your inbox')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
    expect(screen.getByText('I agree to receive marketing emails')).toBeInTheDocument();
  });

  it('renders callback template correctly', () => {
    const callbackProps: SimpleFormProps = {
      ...mockProps,
      content: {
        template: 'callback',
        fields: [],
        submitButton: {
          text: 'Request Callback',
        },
      },
    };

    render(<SimpleForm {...callbackProps} />);
    
    expect(screen.getByText('Request a Callback')).toBeInTheDocument();
    expect(screen.getByText("We'll call you back as soon as possible")).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your phone number')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument(); // Select field
  });

  it('handles consent checkbox', async () => {
    const propsWithConsent: SimpleFormProps = {
      ...mockProps,
      content: {
        ...mockProps.content,
        consentText: 'I agree to the terms',
      },
    };

    render(<SimpleForm {...propsWithConsent} />);
    
    const consentCheckbox = screen.getByRole('checkbox');
    expect(consentCheckbox).toBeInTheDocument();
    expect(screen.getByText('I agree to the terms')).toBeInTheDocument();

    // Try to submit without consent
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'John' } });
    fireEvent.change(screen.getByPlaceholderText('Your email'), { target: { value: 'john@test.com' } });
    fireEvent.click(screen.getByText('Send Message'));

    await waitFor(() => {
      expect(screen.getByText('You must agree to continue')).toBeInTheDocument();
    });

    // Check consent and submit
    fireEvent.click(consentCheckbox);
    fireEvent.click(screen.getByText('Send Message'));

    await waitFor(() => {
      expect(screen.queryByText('You must agree to continue')).not.toBeInTheDocument();
    });
  });

  it('limits fields to maximum 3', () => {
    const propsWithManyFields: SimpleFormProps = {
      ...mockProps,
      content: {
        ...mockProps.content,
        fields: [
          { name: 'field1', type: 'text', placeholder: 'Field 1' },
          { name: 'field2', type: 'text', placeholder: 'Field 2' },
          { name: 'field3', type: 'text', placeholder: 'Field 3' },
          { name: 'field4', type: 'text', placeholder: 'Field 4' },
        ],
      },
    };

    render(<SimpleForm {...propsWithManyFields} />);
    
    expect(screen.getByPlaceholderText('Field 1')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Field 2')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Field 3')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Field 4')).not.toBeInTheDocument();
  });

  it('renders inline layout correctly', () => {
    const inlineProps: SimpleFormProps = {
      ...mockProps,
      content: {
        ...mockProps.content,
        layout: 'inline',
      },
    };

    const { container } = render(<SimpleForm {...inlineProps} />);

    const formElement = container.querySelector('form');
    expect(formElement).not.toBeNull();
    expect(formElement).toHaveClass('simple-form-form');
    expect(formElement).toHaveClass('gap-4');
    expect(formElement).toHaveClass('md:flex');
    expect(formElement).toHaveClass('md:flex-wrap');
  });

  it('applies max width correctly', () => {
    const { container } = render(<SimpleForm {...mockProps} />);

    const section = container.querySelector('.simple-form');
    expect(section).not.toBeNull();
    expect(section).toHaveStyle({ maxWidth: '500px' });
  });

  it('validates phone number format', async () => {
    const phoneProps: SimpleFormProps = {
      ...mockProps,
      content: {
        ...mockProps.content,
        fields: [
          {
            name: 'phone',
            type: 'tel',
            placeholder: 'Your phone',
            required: true,
          },
        ],
      },
    };

    render(<SimpleForm {...phoneProps} />);

    const phoneInput = screen.getByPlaceholderText('Your phone');
    fireEvent.change(phoneInput, { target: { value: '123' } });

    const submitButton = screen.getByText('Send Message');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid phone number')).toBeInTheDocument();
    });
  });

  it('handles select field correctly', () => {
    const selectProps: SimpleFormProps = {
      ...mockProps,
      content: {
        ...mockProps.content,
        fields: [
          {
            name: 'reason',
            type: 'select',
            label: 'Reason',
            options: [
              { value: 'general', label: 'General Inquiry' },
              { value: 'support', label: 'Support' },
            ],
          },
        ],
      },
    };

    render(<SimpleForm {...selectProps} />);
    
    const selectField = screen.getByRole('combobox');
    expect(selectField).toBeInTheDocument();
    expect(screen.getByText('General Inquiry')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
  });

  it('provides accessible names for inputs without explicit labels', () => {
    const propsWithoutLabels: SimpleFormProps = {
      ...mockProps,
      content: {
        title: undefined,
        description: undefined,
        fields: [
          {
            name: 'email',
            type: 'email',
            placeholder: 'Preferred email',
            required: true,
          },
        ],
        submitButton: {
          text: 'Submit Form',
          loadingText: 'Submitting…',
        },
      },
    };

    render(<SimpleForm {...propsWithoutLabels} />);

    const emailInput = screen.getByRole('textbox', { name: 'Preferred email' });
    expect(emailInput).toHaveAttribute('aria-label', 'Preferred email');
  });

  it('debounces validation feedback after field changes', async () => {
    jest.useFakeTimers();
    try {
      render(<SimpleForm {...mockProps} />);

      const emailInput = screen.getByPlaceholderText('Your email');
      act(() => {
        fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() =>
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument(),
      );
    } finally {
      jest.useRealTimers();
    }
  });

});
