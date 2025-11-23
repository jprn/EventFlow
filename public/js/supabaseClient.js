const SUPABASE_URL = "https://jitpabmfvzfsvwajpaqx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppdHBhYm1mdnpmc3Z3YWpwYXF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MDAxNTYsImV4cCI6MjA3OTQ3NjE1Nn0.SUer4JzC7ekbmaRMqmfX8wsn2gG796STJQJbZNvnuw8";

if (!window.supabase) {
  console.error(
    "Supabase JS n'est pas chargé. Vérifiez le script CDN @supabase/supabase-js dans la page HTML."
  );
}

window.supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

