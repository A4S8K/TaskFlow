# CI release check

The earlier backend import failure was fixed in main baseline `82b263e`.
The release workflow now creates `anon` and `authenticated` as NOLOGIN roles
only in its disposable PostgreSQL service and fails unless both Data API
role-denial tests execute without skipping. Cloud roles are unaffected.

Local release validation: 115 focused ingress, production security and launcher
tests passed; Ruff lint and formatting passed. The report guard passed five
synthetic scenarios. Docker is unavailable locally, so the complete database
and container suites must pass in hosted CI for the selected release SHA.

The opt-in Render Free adapter requires separate hosted HTTPS, identity-spoofing,
CORS and readiness checks; CI alone cannot confirm a working public deployment.
