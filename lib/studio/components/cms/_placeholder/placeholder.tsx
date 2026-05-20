/**
 * Placeholder Component for CMS System
 * 
 * This component is used as a temporary placeholder for CMS components
 * that are not yet implemented. It will be replaced with actual components
 * as they are developed in Story 10.3.
 */

import React from 'react';
import { CMSComponentProps } from '../_core/types';

export const PlaceholderComponent: React.FC<CMSComponentProps> = ({ 
  id,
  type,
  className = '',
  ...props 
}) => {
  return (
    <div
      id={id}
      className={`cms-placeholder ${className}`}
      style={{
        padding: '2rem',
        border: '2px dashed hsl(var(--border))',
        borderRadius: '0.75rem',
        backgroundColor: 'hsl(var(--muted))',
        textAlign: 'center',
        color: 'hsl(var(--muted-foreground))',
        minHeight: '100px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column'
      }}
    >
      <p style={{ margin: 0, fontWeight: 'bold', color: 'hsl(var(--foreground))' }}>
        Component: {type}
      </p>
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem' }}>
        This component will be implemented in Story 10.3
      </p>
      {process.env.NODE_ENV === 'development' && (
        <pre style={{ 
          marginTop: '1rem', 
          fontSize: '0.75rem', 
          opacity: 0.7,
          maxWidth: '100%',
          overflow: 'auto',
          color: 'hsl(var(--muted-foreground))'
        }}>
          {JSON.stringify(props, null, 2)}
        </pre>
      )}
    </div>
  );
};

// Named exports for all component variations
export const NavBar = PlaceholderComponent;
export const SideMenu = PlaceholderComponent;
export const Breadcrumb = PlaceholderComponent;
export const HeroSimple = PlaceholderComponent;
export const HeroWithImage = PlaceholderComponent;
export const HeroCarousel = PlaceholderComponent;
export const TextBlock = PlaceholderComponent;
export const ImageGallery = PlaceholderComponent;
export const FeatureGrid = PlaceholderComponent;
export const FeatureList = PlaceholderComponent;
export const CTASimple = PlaceholderComponent;
export const CTAWithForm = PlaceholderComponent;
export const Testimonials = PlaceholderComponent;
export const StatsSection = PlaceholderComponent;
export const PricingTable = PlaceholderComponent;
export const TeamGrid = PlaceholderComponent;
export const ContactForm = PlaceholderComponent;
export const Newsletter = PlaceholderComponent;
export const Footer = PlaceholderComponent;
export const FooterMinimal = PlaceholderComponent;
export const Header = PlaceholderComponent;
export const HeroBanner = PlaceholderComponent;
export const VideoEmbed = PlaceholderComponent;
export const Accordion = PlaceholderComponent;

export default PlaceholderComponent;
