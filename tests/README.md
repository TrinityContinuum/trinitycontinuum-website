# TCON offline test suite
Run `node --test tests/tcon-policy.test.mjs` from the repository root (Node 20+).
These tests verify deterministic policy helpers only. They **do not** test Supabase SQL, provider delivery, authentication, concurrency, deployment or full user journeys. Those require a dedicated test project and synthetic test mailboxes after approval.
