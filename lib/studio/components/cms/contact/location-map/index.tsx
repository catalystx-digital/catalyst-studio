'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { sanitizeText } from '../../_core/security';
import type { ComponentTheme } from '../../_core/types';
import { validateImageUrl, validateUrl } from '../../_utils/url-validation';
import {
  CmsAlert,
  CmsAlertDescription,
  CmsAlertTitle,
  CmsSection,
  CARD_TONES,
  cmsBody,
  dsSpacing,
  themeClass,
} from '../../_ui';
import type { CmsCardTone } from '../../_ui';
import type { LocationMapProps } from './location-map.types';

// Google Maps type declarations
declare global {
  interface Window {
    google: {
      maps: {
        Map: new (element: HTMLElement, options: GoogleMapOptions) => GoogleMap;
        Marker: new (options: GoogleMarkerOptions) => GoogleMarker;
        InfoWindow: new (options: { content: string }) => GoogleInfoWindow;
        Geocoder: new () => GoogleGeocoder;
        MapTypeId: {
          ROADMAP: string;
          SATELLITE: string;
          HYBRID: string;
          TERRAIN: string;
        };
      };
    };
  }
}

interface GoogleMapOptions {
  center: { lat: number; lng: number };
  zoom: number;
  mapTypeId: string;
  disableDefaultUI?: boolean;
  styles?: Array<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface GoogleMarkerOptions {
  position: { lat: number; lng: number };
  map: GoogleMap;
  title?: string;
}

interface GoogleMap {}

interface GoogleMarker {
  setMap(map: GoogleMap | null): void;
  addListener(event: string, handler: () => void): void;
}

interface GoogleInfoWindow {
  open(map: GoogleMap, marker: GoogleMarker): void;
}

interface GoogleGeocoder {
  geocode(
    request: { address: string },
    callback: (results: GoogleGeocoderResult[] | null, status: string) => void,
  ): void;
}

interface GoogleGeocoderResult {
  geometry: {
    location: {
      lat(): number;
      lng(): number;
    };
  };
}

const DEFAULT_RATIO = 16 / 9;

const LocationMap: React.FC<LocationMapProps> = ({
  id,
  content,
  className,
  theme = 'auto',
  onInteraction,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<GoogleMap | null>(null);
  const markerRef = useRef<GoogleMarker | null>(null);

  const cmsTheme = (typeof theme === 'string' ? theme : undefined) as
    | ComponentTheme
    | undefined;

  const sanitize = useCallback((value?: string) => sanitizeText(value ?? ''), []);

  const apiKey = content.apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const resolvedWidth = useMemo(() => {
    if (typeof content.width === 'number') {
      return `${content.width}px`;
    }
    if (typeof content.width === 'string' && content.width.trim().length > 0) {
      return content.width;
    }
    return '100%';
  }, [content.width]);

  const resolvedHeight = useMemo(() => {
    if (typeof content.height === 'number') {
      return `${content.height}px`;
    }
    if (typeof content.height === 'string' && content.height.trim().length > 0) {
      return content.height;
    }
    return '400px';
  }, [content.height]);

  const resolvedRatio = useMemo(() => {
    if (
      typeof content.width === 'number' &&
      typeof content.height === 'number' &&
      content.height !== 0
    ) {
      return content.width / content.height;
    }
    return DEFAULT_RATIO;
  }, [content.width, content.height]);

  const sanitizedMarkerTitle = useMemo(
    () => sanitize(content.markerTitle || 'Map location'),
    [content.markerTitle, sanitize],
  );

  const hasLocationDetails =
    Boolean(content.coordinates) || Boolean(content.address?.trim().length);

  const canRenderMap = Boolean(apiKey && hasLocationDetails);

  const directionsUrl = useMemo(() => {
    if (content.coordinates) {
      const rawUrl = `https://www.google.com/maps/dir/?api=1&destination=${content.coordinates.lat},${content.coordinates.lng}`;
      return validateUrl(rawUrl, { fallback: '' });
    }
    if (content.address) {
      const rawUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(content.address)}`;
      return validateUrl(rawUrl, { fallback: '' });
    }
    return '';
  }, [content.address, content.coordinates]);

  const fallbackImageUrl = useMemo(
    () => validateImageUrl(content.fallbackImage, ''),
    [content.fallbackImage],
  );

  const infoWindowContent = useMemo(() => {
    if (!content.infoWindow) {
      return '';
    }

    const title = sanitize(content.infoWindow.title);
    const description = sanitize(content.infoWindow.description);
    const showDirections =
      Boolean(content.infoWindow.showDirections) && Boolean(directionsUrl);

    return `
      <div class="cms-map-info-window" style="font-family: var(--font-sans, sans-serif);">
        ${
          title
            ? `<h3 style="margin: 0 0 8px 0; font-weight: 600; font-size: 16px;">${title}</h3>`
            : ''
        }
        ${
          description
            ? `<p style="margin: 0 0 8px 0; font-size: 14px; line-height: 1.45;">${description}</p>`
            : ''
        }
        ${
          showDirections
            ? `<a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" style="color: hsl(var(--primary)); text-decoration: none; font-size: 14px;">Get Directions</a>`
            : ''
        }
      </div>
    `;
  }, [content.infoWindow, directionsUrl, sanitize]);

  const getEmbedUrl = useCallback(() => {
    if (!apiKey || !hasLocationDetails) {
      return null;
    }

    const baseUrl = 'https://www.google.com/maps/embed/v1/place';
    const params = new URLSearchParams({
      key: apiKey,
      zoom: String(content.zoom || 15),
      maptype: content.mapType || 'roadmap',
    });

    if (content.coordinates) {
      params.set('center', `${content.coordinates.lat},${content.coordinates.lng}`);
      params.set('q', `${content.coordinates.lat},${content.coordinates.lng}`);
    } else if (content.address) {
      params.set('q', content.address);
    }

    return `${baseUrl}?${params.toString()}`;
  }, [apiKey, content.address, content.coordinates, content.mapType, content.zoom, hasLocationDetails]);

  const initializeMap = useCallback(async () => {
    if (!canRenderMap || typeof window === 'undefined' || !mapRef.current) {
      return;
    }

    if (!window.google || !window.google.maps) {
      return;
    }

    try {
      setError(null);

      let mapCenter: { lat: number; lng: number };

      if (content.coordinates) {
        mapCenter = {
          lat: content.coordinates.lat,
          lng: content.coordinates.lng,
        };
      } else if (content.address) {
        const geocoder = new window.google.maps.Geocoder();
        const result = await new Promise<GoogleGeocoderResult[]>((resolve, reject) => {
          geocoder.geocode({ address: content.address || '' }, (results, status) => {
            if (status === 'OK' && results) {
              resolve(results);
            } else {
              reject(new Error('Geocoding failed'));
            }
          });
        });

        const location = result[0].geometry.location;
        mapCenter = { lat: location.lat(), lng: location.lng() };
      } else {
        mapCenter = { lat: 37.7749, lng: -122.4194 };
      }

      const mapOptions: GoogleMapOptions = {
        center: mapCenter,
        zoom: content.zoom || 15,
        mapTypeId: content.mapType || 'roadmap',
        disableDefaultUI: !content.enableControls,
        styles: content.customStyles,
      };

      googleMapRef.current = new window.google.maps.Map(mapRef.current, mapOptions);

      markerRef.current = new window.google.maps.Marker({
        position: mapCenter,
        map: googleMapRef.current,
        title: sanitizedMarkerTitle,
      });

      if (infoWindowContent) {
        const infoWindow = new window.google.maps.InfoWindow({
          content: infoWindowContent,
        });

        markerRef.current.addListener('click', () => {
          infoWindow.open(
            googleMapRef.current as GoogleMap,
            markerRef.current as GoogleMarker,
          );
        });
      }

      setIsLoading(false);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Map initialization error:', err);
      }
      setError('Failed to initialize map');
      setIsLoading(false);
    }
  }, [
    canRenderMap,
    content.address,
    content.coordinates,
    content.customStyles,
    content.enableControls,
    content.mapType,
    content.zoom,
    infoWindowContent,
    sanitizedMarkerTitle,
  ]);

  useEffect(() => {
    if (!canRenderMap) {
      setIsLoading(false);
      return;
    }

    if (typeof window === 'undefined' || !mapRef.current) {
      return;
    }

    if (window.google && window.google.maps) {
      initializeMap();
      return;
    }

    const handleError = () => {
      setError('Failed to load map');
      setIsLoading(false);
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-cms-google-maps="true"]',
    );

    if (existingScript) {
      existingScript.addEventListener('load', initializeMap);
      existingScript.addEventListener('error', handleError);
      return () => {
        existingScript.removeEventListener('load', initializeMap);
        existingScript.removeEventListener('error', handleError);
      };
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.cmsGoogleMaps = 'true';
    script.addEventListener('load', initializeMap);
    script.addEventListener('error', handleError);
    document.head.appendChild(script);

    return () => {
      script.removeEventListener('load', initializeMap);
      script.removeEventListener('error', handleError);
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
    };
  }, [apiKey, canRenderMap, initializeMap]);

  const staticMapUrl = useMemo(() => {
    if (fallbackImageUrl) {
      return fallbackImageUrl;
    }
    if (!hasLocationDetails) {
      return '';
    }

    const base = 'https://maps.googleapis.com/maps/api/staticmap';
    const params = new URLSearchParams({
      size: '800x530',
      zoom: String(content.zoom || 15),
    });

    if (content.coordinates) {
      params.append(
        'markers',
        `${content.coordinates.lat},${content.coordinates.lng}`,
      );
    } else if (content.address) {
      params.append('markers', encodeURIComponent(content.address));
    }

    if (apiKey) {
      params.append('key', apiKey);
    }

    return `${base}?${params.toString()}`;
  }, [apiKey, content.address, content.coordinates, content.zoom, fallbackImageUrl, hasLocationDetails]);

  const showPlaceholder = !hasLocationDetails && !apiKey;

  const cardStyle: React.CSSProperties = {
    width: resolvedWidth,
    borderRadius: content.borderRadius,
    border: content.border,
  };

  const directionsButton = directionsUrl ? (
    <Button
      variant="default"
      asChild
      className="w-full sm:w-auto"
      onClick={() => onInteraction?.('directions-click', { href: directionsUrl })}
    >
      <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
        Get Directions
      </a>
    </Button>
  ) : null;

  const tone: CmsCardTone = 'minimal';

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      className={cn('cms-location-map', className)}
      containerClassName={cn('items-center', dsSpacing.gap('xl'))}
      data-component-type="location-map"
    >
      <Card
        className={cn('flex w-full flex-col', CARD_TONES[tone], themeClass(cmsTheme))}
        style={cardStyle}
      >
      {(content.markerTitle || content.address) && (
        <CardHeader className={cn('flex flex-col gap-2 p-[var(--component-padding)] pb-0', themeClass(cmsTheme))}>
          {content.markerTitle && (
            <CardTitle className="text-xl">
              {sanitizedMarkerTitle}
            </CardTitle>
          )}
          {content.address && (
            <p className={cmsBody('sm', cmsTheme, 'text-muted-foreground')}>
              {sanitize(content.address)}
            </p>
          )}
        </CardHeader>
      )}

      <CardContent className={cn('p-[var(--component-padding)] pt-0 p-0', themeClass(cmsTheme))}>
        <div className={cn('flex flex-col', dsSpacing.gap('lg'))}>
          {showPlaceholder ? (
            <CmsAlert
              variant="default"
              theme={cmsTheme}
              className={cn(
                'flex max-w-xl flex-col',
                dsSpacing.margin('lg'),
                dsSpacing.gap('sm'),
              )}
              role="alert"
            >
              <CmsAlertTitle theme={cmsTheme}>Map configuration required</CmsAlertTitle>
              <CmsAlertDescription theme={cmsTheme}>
                Provide a Google Maps API key and either an address or coordinates to render the
                map.
              </CmsAlertDescription>
            </CmsAlert>
          ) : (
            <AspectRatio
              ratio={resolvedRatio}
              className={cn(
                'location-map-container group',
                'overflow-hidden rounded-lg border border-border/30 bg-muted/40 shadow-sm transition-shadow hover:shadow-md',
              )}
              style={{ minHeight: resolvedHeight }}
            >
              <div
                ref={mapRef}
                className="absolute inset-0 h-full w-full rounded-[inherit]"
                data-testid="google-map-container"
              />

              {!googleMapRef.current && canRenderMap && (
                <iframe
                  src={getEmbedUrl() || undefined}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={sanitizedMarkerTitle}
                  className={cn(
                    'absolute inset-0 h-full w-full rounded-[inherit] border-0 transition-opacity',
                    googleMapRef.current ? 'opacity-0' : 'opacity-100',
                  )}
                />
              )}

              {/* Static map fallback - explicit dimensions prevent layout shift (CLS) */}
              {!canRenderMap && staticMapUrl && (
                <img
                  src={staticMapUrl}
                  alt={sanitizedMarkerTitle}
                  width={800}
                  height={530}
                  className="absolute inset-0 h-full w-full rounded-[inherit] object-cover"
                />
              )}

              {isLoading && canRenderMap && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/90 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent shadow-lg" />
                    <p className={cmsBody('sm', cmsTheme, 'font-medium text-foreground')}>
                      Loading map...
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 z-10 flex h-full w-full items-center justify-center bg-background/90 p-6">
                  <CmsAlert variant="destructive" theme={cmsTheme} className="max-w-sm">
                    <CmsAlertTitle theme={cmsTheme}>Failed to load map</CmsAlertTitle>
                    <CmsAlertDescription theme={cmsTheme}>
                      {error}
                    </CmsAlertDescription>
                  </CmsAlert>
                </div>
              )}
            </AspectRatio>
          )}
        </div>
      </CardContent>

      {directionsButton && (
        <CardFooter
          className={cn(
            'flex items-center gap-3 p-[var(--component-padding)] pt-0 flex-col items-start border-t border-border/40 sm:flex-row sm:justify-between',
            themeClass(cmsTheme),
            dsSpacing.gap('sm'),
            dsSpacing.pt('md'),
            `sm:${dsSpacing.pt('lg')}`,
          )}
        >
          <p className={cmsBody('sm', cmsTheme, 'text-muted-foreground')}>
            Open in Google Maps to view directions.
          </p>
          {directionsButton}
        </CardFooter>
      )}
      </Card>
    </CmsSection>
  );
};

export default React.memo(LocationMap);
