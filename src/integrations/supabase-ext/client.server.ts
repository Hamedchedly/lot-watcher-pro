// Server-only Supabase client pointing at the external project
// (https://zpkfwsczrtadrhcounof.supabase.co). Bypasses RLS via service role.
// Load inside server handlers only:
//   const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createExternalAdminClient() {
  const url = process.env['EXT_SUPABASE_URL'];
  const key = process.env['EXT_SUPABASE_SERVICE_ROLE_KEY'];

  if (!url || !key) {
    const missing = [
      ...(!url ? ['EXT_SUPABASE_URL'] : []),
      ...(!key ? ['EXT_SUPABASE_SERVICE_ROLE_KEY'] : []),
    ];
    throw new Error(`Variable(s) d'environnement manquante(s): ${missing.join(', ')}`);
  }

  return createClient<Database>(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

let _client: ReturnType<typeof createExternalAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createExternalAdminClient>, {
  get(_, prop, receiver) {
    if (!_client) _client = createExternalAdminClient();
    return Reflect.get(_client, prop, receiver);
  },
});
