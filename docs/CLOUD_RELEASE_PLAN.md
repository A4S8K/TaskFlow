# First cloud release — approval proposal

Prepared 18 October 2026 for https://github.com/A4S8K/TaskFlow.

## Confirmed accounts and prepared resources

- GitHub: A4S8K/TaskFlow. Main baseline `82b263e98b571d39654c861f6aedbc9d1904ed9f`; hosted TaskFlow CI and dependency/secret checks passed.
- Supabase: confirmed organization `A4S8K's Org` (`hyhmblsyebtabxwzwcuf`), Free. A fresh project `TaskFlow` (`bokebdpjchntvukdlyxy`) was created at a quoted $0/month in Singapore. It is healthy and has no public-schema application tables. The existing paused project is untouched.
- Vercel: confirmed Hobby team `omenarslan4-5575s-projects` (`team_MTZ2wa2tTofLdB1LZbfZQToP`). Project `taskflow` (`prj_zdm1VULowJHRfgl62mr2J6SadmgA`) is configured for `frontend`, Vite, Node 22, `npm ci`, `npm run build`, and `dist`. It has no deployment. No Git auto-deployment was connected.
- Render: confirmed workspace `TaskFlow` (`tea-db9pvinavr4c73f0eeng`), currently no services. Proposed new API name `taskflow-api-a4s8k`, Singapore, explicit Free compute plan, one worker/instance, automatic deployments off. The actual hostname will be taken from the created service response.

## Proposed approved actions

1. Create one dedicated, randomly generated TaskFlow PostgreSQL LOGIN in the fresh database. Grant only database connection and schema creation/use needed to own TaskFlow tables. Do not reset the user's master password or change the paused project.
2. Use the observed Session Pooler `aws-0-ap-southeast-1.pooler.supabase.com:5432`, verified TLS with hostname validation, and the official Supabase root CA. Never select transaction pooler port 6543 or disable TLS verification.
3. Apply the existing Alembic chain `0001 -> 0002` to the fresh project, verify revision/schema/RLS/Data API-role denial, and make a protected first-release backup.
4. Store generated DB/JWT secrets in Render's protected environment settings. Keep credentials out of Git, frontend builds, printed logs and chat. The frontend receives only the public API URL and mode.
5. Publish the reviewed/tested FastAPI release on Render Free and React release on Vercel Hobby, using provider HTTPS domains. Configure exact CORS/hosts, readiness, TLS, the verified ingress handling and one-worker connection limits. Preserve deployment protection for nonproduction previews where supported; make the production application publicly reachable.
6. Run public HTTPS, CORS, authorization, database and browser smoke tests using only disposable test accounts/projects/tasks created for this release. Remove those test-owned records where appropriate. Do not change existing customer data.

## Cost and approval boundary

Select only the existing Free/Hobby allowances. Do not add payment methods, buy domains, enable paid compute/add-ons, upgrade plans or change billing. Stop and request a separate approval if the providers require any paid operation. Render Free sleeps on idle and its resource/usage limits apply; this is a portfolio deployment without an uptime SLA.

Creation of a Render web service can immediately trigger a publicly reachable deployment. On 18 October 2026, the user explicitly approved the free public release, the dedicated login, Alembic initialization of this new empty project, and disposable test records. No application is claimed live or tested in production yet.

## Additional local release fixes

The CI role-denial tests previously skipped when Supabase-style roles were absent. The workflow creates NOLOGIN roles only in its disposable CI database and requires both tests to execute. The opt-in Render Free ingress adapter has 115 passing focused security/launcher tests, including multilingual error envelopes; hosted proxy-header verification is still required. Node is bounded to major 22 in both package metadata and Vercel settings so the provider cannot select a different major through the engines range. Release any application changes only after relevant checks and hosted CI pass.
