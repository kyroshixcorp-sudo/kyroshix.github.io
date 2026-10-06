import { createHandler } from './core.js';
Deno.serve(createHandler({
 SITE_ORIGIN: Deno.env.get('SITE_ORIGIN'),
 SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
 SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
 CODE_HASH_SECRET: Deno.env.get('CODE_HASH_SECRET'),
 RESEND_API_KEY: Deno.env.get('RESEND_API_KEY'),
 EMAIL_FROM: Deno.env.get('EMAIL_FROM'),
}));
