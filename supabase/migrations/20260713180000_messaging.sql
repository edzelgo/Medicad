-- Group C #32/#33/#39 — messaging. One flat messages table keyed by a canonical
-- thread_id handles both client<->staff support ("support:{clientUserId}") and
-- staff<->staff DMs ("dm:{userA}:{userB}" sorted). Reads are tracked per user
-- per thread for unread counts. Announcements cover broadcast.
--
-- All access is mediated by server functions (service role), so RLS stays
-- restrictive: enable it, add no permissive policies, and the anon/authenticated
-- roles cannot touch these tables directly. Additive; messaging UI degrades to
-- "unavailable" until this is applied via Lovable.

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text NOT NULL,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_thread_idx ON public.messages (thread_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.message_reads (
  thread_id text NOT NULL,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid,
  audience text NOT NULL DEFAULT 'all',   -- all | staff | clients
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS announcements_created_idx ON public.announcements (created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
-- No permissive policies: only the service role (server functions) may read/write.
