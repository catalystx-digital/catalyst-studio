type SupabaseConfig = {
  url: string;
  anonKey: string;
};

let cachedConfig: SupabaseConfig | null = null;

function readSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }

  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured');
  }

  return { url, anonKey };
}

export function getSupabaseConfig(): SupabaseConfig {
  if (!cachedConfig) {
    cachedConfig = readSupabaseConfig();
  }
  return cachedConfig;
}
