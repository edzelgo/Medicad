import { createFileRoute, redirect } from "@tanstack/react-router";

// Group D #41 — the separate client application-status board has been retired.
// The lead pipeline at /crm/pipeline is now the single, canonical pipeline
// (stage changes there notify the client and assign agents in one place).
export const Route = createFileRoute("/_authenticated/admin/pipeline")({
  beforeLoad: () => { throw redirect({ to: "/crm/pipeline" }); },
});
