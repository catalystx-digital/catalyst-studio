import type { UniversalMediaService } from '@/lib/cms-export/universal/types';

type LoaderFactory = () => Promise<UniversalMediaService | null>;

let cachedInstance: UniversalMediaService | null = null;
let loadPromise: Promise<UniversalMediaService | null> | null = null;
let registeredLoader: LoaderFactory | null = null;

const defaultLoader: LoaderFactory = async () => {
  try {
    // Dynamic import of the studio media service
    // Let webpack handle the path resolution (don't use webpackIgnore)
    const module = await import('@/lib/studio/media/universal-media-service');
    const ServiceCtor = module?.UniversalMediaService as (new () => unknown) | undefined;

    if (typeof ServiceCtor !== 'function') {
      return null;
    }

    return new ServiceCtor() as UniversalMediaService;
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('UniversalMediaService unavailable', error);
    }
    return null;
  }
};

export const registerUniversalMediaServiceLoader = (factory: LoaderFactory | null): void => {
  registeredLoader = factory;
  cachedInstance = null;
  loadPromise = null;
};

export const resolveUniversalMediaService = async (
  provided?: UniversalMediaService | null
): Promise<UniversalMediaService | null> => {
  if (provided) {
    cachedInstance = provided;
    return provided;
  }

  if (cachedInstance) {
    return cachedInstance;
  }

  const loader = registeredLoader ?? defaultLoader;

  if (!loadPromise) {
    loadPromise = loader()
      .then((instance) => {
        if (instance) {
          cachedInstance = instance;
          return instance;
        }
        return null;
      })
      .catch((error) => {
        if (process.env.NODE_ENV !== 'test') {
          console.warn('UniversalMediaService loader failed', error);
        }
        return null;
      });
  }

  const instance = await loadPromise;

  if (!instance) {
    loadPromise = null;
  }

  return instance;
};

export const resetUniversalMediaServiceCache = (): void => {
  cachedInstance = null;
  loadPromise = null;
};

export type { UniversalMediaService };
