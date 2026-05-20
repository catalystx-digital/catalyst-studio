import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContactInfo from './index';
import { ContactInfoProps } from './contact-info.types';
import { ComponentType, ComponentCategory } from '@/lib/studio/components/cms/_core/types';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

const mockProps: ContactInfoProps = {
  id: 'test-contact-info',
  type: ComponentType.ContactInfo,
  category: ComponentCategory.Contact,
  content: {
    businessName: 'Test Company',
    logoUrl: 'https://example.com/logo.png',
    address: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '12345',
      country: 'USA'
    },
    phoneNumbers: [
      { label: 'Main', number: '+1 234 567 8900' },
      { label: 'Support', number: '+1 234 567 8901' }
    ],
    emailAddresses: [
      { label: 'General', email: 'info@example.com' },
      { label: 'Support', email: 'support@example.com' }
    ],
    businessHours: {
      monday: '9:00 AM - 5:00 PM',
      tuesday: '9:00 AM - 5:00 PM',
      wednesday: '9:00 AM - 5:00 PM',
      thursday: '9:00 AM - 5:00 PM',
      friday: '9:00 AM - 5:00 PM',
      saturday: '10:00 AM - 2:00 PM',
      sunday: 'Closed',
      holidays: 'Closed'
    },
    socialLinks: [
      { platform: 'facebook', url: 'https://facebook.com/testcompany' },
      { platform: 'twitter', url: 'https://twitter.com/testcompany' },
      { platform: 'linkedin', url: 'https://linkedin.com/company/testcompany' }
    ],
    showCopyButtons: true,
    cardStyle: 'shadow'
  }
};

describe('ContactInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders business name and logo', () => {
    render(<ContactInfo {...mockProps} />);
    
    expect(screen.getByText('Test Company')).toBeInTheDocument();
    const logo = screen.getByAltText('Test Company');
    expect(logo).toHaveAttribute('src', 'https://example.com/logo.png');
  });

  it('renders formatted address with Google Maps link', () => {
    render(<ContactInfo {...mockProps} />);
    
    const addressLink = screen.getByRole('link', { name: /123 Main St.*Anytown.*CA/i });
    expect(addressLink).toBeInTheDocument();
    expect(addressLink).toHaveAttribute('href', expect.stringContaining('google.com/maps'));
    expect(addressLink).toHaveAttribute('target', '_blank');
  });

  it('renders phone numbers with tel links', () => {
    render(<ContactInfo {...mockProps} />);

    expect(screen.getByText('Main')).toBeInTheDocument();
    
    const phoneLinks = screen.getAllByRole('link', { name: /\+1 234 567/i });
    expect(phoneLinks).toHaveLength(2);
    expect(phoneLinks[0]).toHaveAttribute('href', 'tel:+1 234 567 8900');
    expect(phoneLinks[1]).toHaveAttribute('href', 'tel:+1 234 567 8901');
  });

  it('renders email addresses with mailto links', () => {
    render(<ContactInfo {...mockProps} />);

    expect(screen.getByText('General')).toBeInTheDocument();

    const emailLinks = screen.getAllByRole('link', { name: /@example.com/i });
    expect(emailLinks).toHaveLength(2);
    expect(emailLinks[0]).toHaveAttribute('href', 'mailto:info@example.com');
    expect(emailLinks[1]).toHaveAttribute('href', 'mailto:support@example.com');
  });

  it('renders business hours correctly', () => {
    render(<ContactInfo {...mockProps} />);
    
    expect(screen.getByText(/business hours/i)).toBeInTheDocument();
    expect(screen.getByText('Monday:')).toBeInTheDocument();
    expect(screen.getAllByText('9:00 AM - 5:00 PM')).toHaveLength(5);
    expect(screen.getByText('Sunday:')).toBeInTheDocument();
    expect(screen.getAllByText('Closed')).toHaveLength(2);
    expect(screen.getByText('Holidays:')).toBeInTheDocument();
  });

  it('renders social media links', () => {
    render(<ContactInfo {...mockProps} />);
    
    expect(screen.getByText('Follow Us')).toBeInTheDocument();
    
    const facebookLink = screen.getByLabelText(/facebook/i);
    expect(facebookLink).toHaveAttribute('href', 'https://facebook.com/testcompany');
    
    const twitterLink = screen.getByLabelText(/twitter/i);
    expect(twitterLink).toHaveAttribute('href', 'https://twitter.com/testcompany');
    
    const linkedinLink = screen.getByLabelText(/linkedin/i);
    expect(linkedinLink).toHaveAttribute('href', 'https://linkedin.com/company/testcompany');
  });

  it('handles copy functionality for address', async () => {
    (navigator.clipboard.writeText as jest.Mock).mockResolvedValueOnce(undefined);
    
    render(<ContactInfo {...mockProps} />);
    
    const copyButton = screen.getByRole('button', { name: /copy address/i });
    fireEvent.click(copyButton);
    
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        '123 Main St, Anytown, CA 12345, USA'
      );
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('handles copy functionality for phone numbers', async () => {
    (navigator.clipboard.writeText as jest.Mock).mockResolvedValueOnce(undefined);
    
    render(<ContactInfo {...mockProps} />);
    
    const phoneCopyButton = screen.getByRole('button', { name: /copy main number/i });
    fireEvent.click(phoneCopyButton);
    
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('+1 234 567 8900');
    });
  });

  it('handles copy functionality for email addresses', async () => {
    (navigator.clipboard.writeText as jest.Mock).mockResolvedValueOnce(undefined);
    
    render(<ContactInfo {...mockProps} />);
    
    const emailCopyButton = screen.getByRole('button', { name: /copy general address/i });
    fireEvent.click(emailCopyButton);
    
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('info@example.com');
    });
  });

  it('does not render copy buttons when showCopyButtons is false', () => {
    const propsWithoutCopy: ContactInfoProps = {
      ...mockProps,
      content: {
        ...mockProps.content,
        showCopyButtons: false
      }
    };
    
    render(<ContactInfo {...propsWithoutCopy} />);
    
    const copyButtons = screen.queryAllByRole('button', { name: /copy/i });
    expect(copyButtons).toHaveLength(0);
  });

  it('applies correct card styling', () => {
    const { container } = render(<ContactInfo {...mockProps} />);
    
    const card = container.firstChild as HTMLElement | null;
    expect(card).toHaveClass('shadow-lg');
  });

  it('handles bordered card style', () => {
    const propsWithBorder: ContactInfoProps = {
      ...mockProps,
      content: {
        ...mockProps.content,
        cardStyle: 'bordered'
      }
    };
    
    const { container } = render(<ContactInfo {...propsWithBorder} />);
    
    const card = container.firstChild as HTMLElement | null;
    expect(card).toHaveClass('border');
    expect(card).toHaveClass('border-border');
  });

  it('handles missing optional fields gracefully', () => {
    const minimalProps: ContactInfoProps = {
      ...mockProps,
      content: {
        businessName: 'Minimal Company',
        phoneNumbers: [{ number: '+1 234 567 8900' }]
      }
    };
    
    render(<ContactInfo {...minimalProps} />);
    
    expect(screen.getByText('Minimal Company')).toBeInTheDocument();
    expect(screen.getByText('+1 234 567 8900')).toBeInTheDocument();
    
    // Should not render missing sections
    expect(screen.queryByText('Address')).not.toBeInTheDocument();
    expect(screen.queryByText('Email')).not.toBeInTheDocument();
    expect(screen.queryByText('Business Hours')).not.toBeInTheDocument();
    expect(screen.queryByText('Follow Us')).not.toBeInTheDocument();
  });
});
