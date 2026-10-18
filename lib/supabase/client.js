import { createBrowserClient } from '@supabase/ssr';
import { playgroundHandler } from '@/lib/playground/mode';

export function createClient() {
  // The landing-page playground swaps in an in-memory, seeded client.
  const playground = playgroundHandler('createClient');
  if (playground) return playground();

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
