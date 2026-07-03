// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const supabaseUrl =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://zggucwzagnuxbnyxmciz.supabase.co";

const supabasePublishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnZ3Vjd3phZ251eGJueXhtY2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1ODMzODgsImV4cCI6MjA5NzE1OTM4OH0.Se3_UzOKEN8lg--DHnkq_X0SO-C7ujE-7ykpVcS77eQ";

const cloudEnvDefines = {
  "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
  "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
  "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
    process.env.VITE_SUPABASE_PROJECT_ID || process.env.SUPABASE_PROJECT_ID || "zggucwzagnuxbnyxmciz",
  ),
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: Object.fromEntries(
      Object.entries(cloudEnvDefines).filter(([, value]) => value !== undefined),
    ),
  },
});
