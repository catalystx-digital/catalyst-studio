import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LocationMap from './index';
import { LocationMapProps } from './location-map.types';
import { ComponentType, ComponentCategory } from '@/lib/studio/components/cms/_core/types';

// Mock Google Maps
const mockGoogleMaps = {
  maps: {
    Map: jest.fn().mockImplementation(() => ({
      setCenter: jest.fn(),
      setZoom: jest.fn(),
    })),
    Marker: jest.fn().mockImplementation(() => ({
      setMap: jest.fn(),
      addListener: jest.fn(),
    })),
    InfoWindow: jest.fn().mockImplementation(() => ({
      open: jest.fn(),
      close: jest.fn(),
    })),
    Geocoder: jest.fn().mockImplementation(() => ({
      geocode: jest.fn((request, callback) => {
        callback([
          {
            geometry: {
              location: {
                lat: () => 37.7749,
                lng: () => -122.4194,
              },
            },
          },
        ], 'OK');
      }),
    })),
  },
};

// Set up global google object
(global as any).google = mockGoogleMaps;

let originalEnv: NodeJS.ProcessEnv;

const mockProps: LocationMapProps = {
  id: 'test-location-map',
  type: ComponentType.LocationMap,
  category: ComponentCategory.Contact,
  content: {
    address: '123 Main St, Anytown, CA 12345',
    zoom: 15,
    mapType: 'roadmap',
    markerTitle: 'Our Office',
    infoWindow: {
      title: 'Main Office',
      description: 'Visit us at our main location',
      showDirections: true,
    },
    width: '100%',
    height: 400,
    borderRadius: '8px',
    enableControls: true,
    apiKey: 'test-api-key',
  },
};

describe('LocationMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = process.env;
    process.env = { ...originalEnv };
    (global as any).google = mockGoogleMaps;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('renders map card with correct dimensions', () => {
    const { container } = render(<LocationMap {...mockProps} />);

    const card = container.querySelector('.cms-location-map') as HTMLElement | null;
    expect(card).toBeInTheDocument();
    expect(card).toHaveStyle({ width: '100%', borderRadius: '8px' });

    const aspectRatio = container.querySelector('.location-map-container') as HTMLElement | null;
    expect(aspectRatio).toBeInTheDocument();
    expect(aspectRatio).toHaveStyle({ minHeight: '400px' });
  });

  it('shows loading state initially', () => {
    render(<LocationMap {...mockProps} />);
    
    expect(screen.getByText('Loading map...')).toBeInTheDocument();
  });

  it('initializes Google Maps with correct options', async () => {
    render(<LocationMap {...mockProps} />);

    await waitFor(() => {
      expect(mockGoogleMaps.maps.Map).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          zoom: 15,
          mapTypeId: 'roadmap',
          disableDefaultUI: false,
        })
      );
    });
  });

  it('creates marker with correct title', async () => {
    render(<LocationMap {...mockProps} />);

    await waitFor(() => {
      expect(mockGoogleMaps.maps.Marker).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Our Office',
        })
      );
    });
  });

  it('uses coordinates when provided instead of address', async () => {
    const propsWithCoords: LocationMapProps = {
      ...mockProps,
      content: {
        ...mockProps.content,
        coordinates: { lat: 40.7128, lng: -74.0060 },
        address: undefined,
      },
    };

    render(<LocationMap {...propsWithCoords} />);

    await waitFor(() => {
      expect(mockGoogleMaps.maps.Map).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          center: { lat: 40.7128, lng: -74.0060 },
        })
      );
    });
  });

  it('geocodes address when coordinates not provided', async () => {
    render(<LocationMap {...mockProps} />);

    await waitFor(() => {
      expect(mockGoogleMaps.maps.Geocoder).toHaveBeenCalled();
    });
  });

  it('creates info window with correct content', async () => {
    render(<LocationMap {...mockProps} />);

    await waitFor(() => {
      expect(mockGoogleMaps.maps.InfoWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Main Office'),
        })
      );
    });
  });

  it('shows placeholder when no API key is configured', () => {
    const propsNoApiKey: LocationMapProps = {
      ...mockProps,
      content: {
        ...mockProps.content,
        apiKey: undefined,
        address: undefined,
        coordinates: undefined,
      },
    };

    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    render(<LocationMap {...propsNoApiKey} />);
    
    expect(screen.getByText('Map configuration required')).toBeInTheDocument();
    expect(
      screen.getByText('Provide a Google Maps API key and either an address or coordinates to render the map.'),
    ).toBeInTheDocument();
  });

  it('uses environment variable for API key when not provided in props', () => {
    const propsNoApiKey: LocationMapProps = {
      ...mockProps,
      content: {
        ...mockProps.content,
        apiKey: undefined,
      },
    };

    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'env-api-key';

    render(<LocationMap {...propsNoApiKey} />);

    expect(screen.queryByText('Map configuration required')).not.toBeInTheDocument();
  });

  it('renders iframe embed as fallback', () => {
    const { container } = render(<LocationMap {...mockProps} />);
    
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', expect.stringContaining('google.com/maps/embed'));
    expect(iframe).toHaveAttribute('allowFullScreen');
    expect(iframe).toHaveAttribute('loading', 'lazy');
  });

  it('shows error message on map load failure', async () => {
    const originalGoogle = (global as any).google;
    delete (global as any).google;

    // Mock script load error
    const originalCreateElement = document.createElement;
    document.createElement = jest.fn().mockImplementation((tagName) => {
      if (tagName === 'script') {
        const script = originalCreateElement.call(document, tagName);
        setTimeout(() => {
          script.dispatchEvent(new Event('error'));
        }, 0);
        return script;
      }
      return originalCreateElement.call(document, tagName);
    });

    jest.useFakeTimers();

    render(<LocationMap {...mockProps} />);

    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getAllByText('Failed to load map')[0]).toBeInTheDocument();
    });

    document.createElement = originalCreateElement;
    (global as any).google = originalGoogle;
    jest.useRealTimers();
  });

  it('renders static fallback image when provided', () => {
    const propsWithFallback: LocationMapProps = {
      ...mockProps,
      content: {
        ...mockProps.content,
        apiKey: undefined,
        fallbackImage: 'https://example.com/map.png',
      },
    };

    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    render(<LocationMap {...propsWithFallback} />);
    
    const img = screen.getByAltText('Our Office');
    expect(img).toHaveAttribute('src', 'https://example.com/map.png');
  });

  it('includes get directions link when configured', () => {
    const propsWithFallback: LocationMapProps = {
      ...mockProps,
      content: {
        ...mockProps.content,
        apiKey: undefined,
        fallbackImage: 'https://example.com/map.png',
      },
    };

    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    render(<LocationMap {...propsWithFallback} />);
    
    const directionsLink = screen.getByRole('link', { name: /get directions/i });
    expect(directionsLink).toHaveAttribute('href', expect.stringContaining('google.com/maps/dir'));
    expect(directionsLink).toHaveAttribute('target', '_blank');
  });

  it('handles different map types correctly', async () => {
    const propsWithSatellite: LocationMapProps = {
      ...mockProps,
      content: {
        ...mockProps.content,
        mapType: 'satellite',
      },
    };

    render(<LocationMap {...propsWithSatellite} />);

    await waitFor(() => {
      expect(mockGoogleMaps.maps.Map).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          mapTypeId: 'satellite',
        })
      );
    });
  });

  it('applies custom map styles when provided', async () => {
    const customStyles = [
      {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#e9e9e9' }],
      },
    ];

    const propsWithStyles: LocationMapProps = {
      ...mockProps,
      content: {
        ...mockProps.content,
        customStyles,
      },
    };

    render(<LocationMap {...propsWithStyles} />);

    await waitFor(() => {
      expect(mockGoogleMaps.maps.Map).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          styles: customStyles,
        })
      );
    });
  });
});
