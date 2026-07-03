#!/usr/bin/env node
// Regression guard for security findings:
//   - raw_db_err_authed
//   - raw_db_err_public
//
// Server functions and public API routes MUST NOT re-throw raw
// Supabase/PostgREST errors. They MUST log server-side and throw a
// generic client-facing message instead.
//
// This script scans src/lib/**.functions.ts, src/lib/**.server.ts and
// src/routes/api/**/*.ts for two forbidden patterns:
//
//   1. `throw error;`     (re-throws the raw Supabase error object)
//   2. `throw new Error(error.message)` / `throw new Error(<err>.message)`
//   3. Any `throw` that references `.message` from a destructured DB error
//
// Files can opt out per-line with the marker: // audit-ok:raw-error
//
// Fails with exit code 1 when any offender is found. Wire into CI /
// pre-deploy: `node scripts/check-raw-db-errors.mjs`.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["src/lib", "src/routes/api"];
const INCLUDE = /\.(functions\.ts|server\.ts|ts)$/;
const OPT_OUT = /audit-ok:raw-error/;

// Patterns we consider a raw DB error escaping to the client.
const PATTERNS = [
  /throw\s+error\b/,
  /throw\s+new\s+Error\s*\(\s*\w*[Ee]rror\.message/,
  /throw\s+new\s+Error\s*\(\s*[a-zA-Z_$][\w$]*Err\.message/,
];

function walk(dir) {
  const out = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (INCLUDE.test(name)) out.push(p);
  }
  return out;
}

const offenders = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = readFileSync(file, "utf8").split("\n");
    src.forEach((line, i) => {
      if (OPT_OUT.test(line)) return;
      if (PATTERNS.some((rx) => rx.test(line))) {
        offenders.push({ file: relative(process.cwd(), file), line: i + 1, snippet: line.trim() });
      }
    });
  }
}

if (offenders.length) {
  console.error("\n❌ Raw database errors are being re-thrown to clients:\n");
  for (const o of offenders) console.error(`  ${o.file}:${o.line}  ${o.snippet}`);
  console.error(
    "\nReplace with a generic message + server-side log, e.g.:\n" +
    "  if (error) { console.error('[db]', error.message); throw new Error('Operation failed. Please try again.'); }\n",
  );
  process.exit(1);
}
console.log(`✅ raw-db-error guard: scanned ${ROOTS.join(", ")} — 0 offenders.`);