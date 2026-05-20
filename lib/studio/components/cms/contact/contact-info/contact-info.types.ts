import { CMSComponentProps, ComponentType, ComponentCategory } from '@/lib/studio/components/cms/_core/types';
import { type PhoneNumber, type Address, type SocialLink, type Image } from '@/lib/studio/components/cms/_core/value-objects';

export interface EmailAddress {
  label?: string; // e.g., "General", "Support", "Sales"
  email: string;
}

export interface BusinessHours {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
  holidays?: string;
}

export interface ContactInfoContent {
  businessName?: string;
  logoUrl?: Image | string;
  address?: Address;
  phoneNumbers?: PhoneNumber[];
  emailAddresses?: EmailAddress[];
  businessHours?: BusinessHours;
  socialLinks?: SocialLink[];
  showCopyButtons?: boolean;
  cardStyle?: 'bordered' | 'shadow' | 'none';
}

export interface ContactInfoProps extends CMSComponentProps {
  type: ComponentType.ContactInfo;
  category: ComponentCategory;
  content: ContactInfoContent;
}