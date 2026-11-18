# Daily

Invite-only daily games leaderboard. Next.js App Router, TypeScript, Supabase Auth/Postgres/Storage, Vercel serverless functions and a daily cron job.

## Run locally

Requires Node 22 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Without Supabase credentials, development starts with sample players and browser-local score submissions. Paste a supported game share, edit/remove today's scores, and upload an optional profile photo. History shows submitted scores immediately, with Elo pending until daily settlement in the connected app. Demo data stays in this browser; clear site data to reset it. Accounts and invitations require Supabase.

Production never silently falls back to the demo. `DEMO_MODE=true` explicitly enables the same isolated preview if desired. Leave it unset or false on the real deployment.

## Connect Supabase

1. Create a Supabase project. Run `supabase/migrations/001_daily.sql`, then `supabase/migrations/002_krillion.sql`, in order in the SQL editor once. It creates the private tables, invitation logic, transactional submission and settlement functions, and a private `avatars` bucket.
2. Copy `.env.example` to `.env.local`. Set the project URL, anon/publishable key, service role key, and app URL. The service key stays server-side; never use a `NEXT_PUBLIC_` name for it.
3. Under Authentication, disable public signups. Set your Site URL and allow `/auth/confirm` on your local and production app origins. Configure your own SMTP provider so invitations and password resets are deliverable.
4. Set these email template links (replace the existing confirmation URL link):

   Invite user:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite"
     >Accept invitation</a
   >
   ```

   Reset password:

   ```html
   <a
     href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery"
     >Reset password</a
   >
   ```

   Set the Site URL to whichever environment should receive emails. Token-hash links work across browsers; no browser-local PKCE verifier is required for these templates. Expired or revoked links cannot activate a membership. Pending invitations can be resent from the Invite Member dialog.

5. Invite the first owner yourself:
   ```sh
   node --env-file=.env.local scripts/invite-owner.mjs you@example.com
   ```
   This command sends an email. Accept it, set a display name and password, then invite friends from the leaderboard. It refuses to bootstrap a second owner.

All data access is through server functions which verify the authenticated user and active membership. Owner actions separately require the owner role. Browser database access is denied, including for authenticated users; no service keys or private member emails are sent to normal member clients. Uploads accept PNG/JPEG/WebP up to 2 MB and use expiring signed read URLs. Omitted photos render no placeholder.

## Deploy to Vercel

1. Push this directory to your Git repository and import it as a Next.js project in Vercel, or deploy it with the Vercel CLI from this directory.
2. Set every variable from `.env.example` in Vercel. Use the production origin for `NEXT_PUBLIC_APP_URL`. Keep `DEMO_MODE=false`.
3. Generate a random `CRON_SECRET` (for example `openssl rand -hex 32`) and add it to Vercel. Do not put it in source control. Vercel includes it in the Authorization header for the scheduled endpoint.
4. Update the Supabase Site URL and redirect allowlist for your deployed domain. Redeploy after adding environment variables.
5. Smoke-test invitation acceptance, login, logout, password reset, photo upload/removal, submitting all three games from two accounts, owner access restrictions, and scheduled settlement.

`vercel.json` schedules `/api/cron/settle` at **06:05 UTC daily**, after Indianapolis midnight in both winter and summer. Submissions close at midnight independently of when the job executes. This schedule deliberately does not promise settlement at exactly midnight. The next successful invocation catches up all missed dates chronologically. To settle closer to midnight, use a suitably frequent supported schedule; the handler only processes closed days. If you change the group timezone, update the schedule accordingly.

## Games

| Game    | Identity                                                       | Score                       | Better |
| ------- | -------------------------------------------------------------- | --------------------------- | ------ |
| Krillion | `Krillion #126` | `390` on the following line | Higher |
| MapTap  | Share month/day resolved against the currently open group date | `Final score: 959`          | Higher |
| Chainle | `Chainle #91`                                                  | `3,457` from the first line | Higher |

MapTap round scores/emojis and Chainle percentile/colored squares are ignored. Validation allows MapTap 0–1,000, Chainle 0–5,000, and Krillion 0–700. Krillion #126 is anchored to November 18, 2026; change `settings.krillion_anchor_date` / `krillion_anchor_number` if required. Only today's puzzle can be submitted; one score per member/game/date, replaceable until cutoff. Copies containing multiple results are rejected. Scores remain an honor system.

**Chainle date assumption:** the supplied #91 example is anchored to November 18, 2026. This mapping was not independently confirmed with Chainle's live puzzle calendar. Before using live scores, verify one puzzle/date pair and update `settings.chainle_anchor_date` / `chainle_anchor_number` if needed. All subsequent puzzle IDs are computed from that pair, not from a user's submission date. Archived puzzles cannot enter today's contest. The group day is initially `America/Indiana/Indianapolis`; the group must use this shared day convention even when traveling.

Add future game parsers in `lib/games.ts` and extend database score validation and the supported-game UI. Require representative shares and a deliberate tie/ranking rule before enabling a new game.

## Elo

Start at 1,000. Within each game/date, compare every pair. Actual result is 1/0.5/0 for win/tie/loss. Expected result is `1 / (1 + 10 ** ((opponentRating - rating) / 400))`. Per-game change is `32 / (participants - 1) * sum(actual - expected)`; a singleton gets zero. Same-day games all use the opening rating, and deltas are summed before any player's rating updates. No missing-game penalty; more games mean more opportunities to gain or lose. Score margin is ignored. Ratings retain decimals; the interface rounds them.

A transaction-level advisory lock serializes submission/deletion/settlement. Unique keys prevent duplicate contests and events. A settlement and its rating updates commit together. Historical scores are immutable in the app. Rating events preserve opening rating, game score, delta, and the total closing rating for the day. Current-day raw text is only returned for the signed-in player's own submissions.

## Verification

```sh
npm test          # Parser, date/timezone, and Elo tests
npm run test:db   # Real PostgreSQL semantics via isolated in-memory PGlite
npm run typecheck
npm run build
```

The database harness mocks only Supabase's auth/storage table surfaces; it runs the actual migration and stored procedures. It checks invitation gating, private table/function permissions, duplicate submission handling, replacement/deletion, cutoff rejection, cross-game opening snapshots, singleton behavior, chronological catch-up, and retry idempotency. It does not contact a live Supabase project or send emails. Live email delivery, real Supabase storage, concurrent hosted requests, and Vercel scheduling need the deployment smoke test above.
