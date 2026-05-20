import { cn } from '@/lib/utils';
import type { WebsiteIconValue, WebsiteMediaReference } from '@/types/api';

interface WebsiteIconProps {
  icon?: WebsiteIconValue | null;
  name: string;
  className?: string;
}

function isUrl(value: string | undefined | null): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function isMediaReference(value: WebsiteIconValue | null | undefined): value is WebsiteMediaReference {
  return Boolean(value && typeof value === 'object' && 'mediaId' in value);
}

function getMediaIconUrl(reference: WebsiteMediaReference): string | undefined {
  const { publicUrl, signedUrl, originalUrl } = reference;
  if (typeof publicUrl === 'string' && publicUrl.length > 0) {
    return publicUrl;
  }
  if (typeof signedUrl === 'string' && signedUrl.length > 0) {
    return signedUrl;
  }
  if (typeof originalUrl === 'string' && originalUrl.length > 0) {
    return originalUrl;
  }
  return undefined;
}

function isEmoji(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }

  // Rough heuristic: one to three glyphs and contains a pictographic character.
  return trimmed.length <= 3 && /\p{Extended_Pictographic}/u.test(trimmed);
}

export function WebsiteIcon({ icon, name, className }: WebsiteIconProps) {
  const containerClass = cn(
    'w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center overflow-hidden',
    className,
  );

  if (typeof icon === 'string' && isUrl(icon)) {
    return (
      <div className={containerClass} aria-hidden="true">
        <img src={icon} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
    );
  }

  if (isMediaReference(icon)) {
    const mediaUrl = getMediaIconUrl(icon);

    if (mediaUrl) {
      return (
        <div className={containerClass} aria-hidden="true">
          <img
            src={mediaUrl}
            alt={typeof icon.altText === 'string' ? icon.altText : ''}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      );
    }
  }

  if (isEmoji(icon)) {
    return (
      <div className={containerClass} aria-hidden="true">
        <span className="text-2xl" role="img" aria-label={`${name} icon`}>
          {icon}
        </span>
      </div>
    );
  }

  const fallback = name.trim().charAt(0).toUpperCase() || 'W';

  return (
    <div className={containerClass} aria-hidden="true">
      <span className="text-lg font-semibold text-primary-foreground/80">
        {fallback}
      </span>
    </div>
  );
}
