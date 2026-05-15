/**
 * Runtime config populated from Cloudflare Worker env in fetch().
 * Modules import this object rather than threading env through every call.
 */
export const askCyborgConfig = {
  apiBase: "https://askcyborg.com",
  supabaseUrl: "",
  supabaseAnonKey: "",
};
