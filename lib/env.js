export function appUrl() {
  const u =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
    'http://localhost:3000';
  return u.replace(/\/$/, '');
}

export const has = {
  supabase: () => !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  admin: () => !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  encryption: () => !!process.env.APP_ENCRYPTION_KEY,
  google: () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  billing: () => !!process.env.MP_PLATFORM_ACCESS_TOKEN,
  whatsapp: () => !!process.env.WHATSAPP_VERIFY_TOKEN,
};
