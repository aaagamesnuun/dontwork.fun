# Rankings and community board

The trophy opens normal clear-time and 30-minute asset leaderboards. Each supports daily, weekly, and all-time views plus an independent app-version filter. Daily means today in Japan time; weekly starts Monday at 00:00 JST. Records belong to the period of their first server registration, including delayed offline submissions. Bounds are half-open and accept both ISO timestamps and legacy SQLite timestamp strings.

The mean uses every record matching the selected period, version, and scoring rule, not just the visible 50-record page. An empty population shows `—`; zero assets remains a valid record. Legacy cash-only 30-minute scores stay separate from current cash-plus-upgrade scores. Result cards and board badges continue to show all-time ranks.

The header speech bubble opens one board with posts and one level of replies. `server/board.js` stores messages in D1 through migration `0012_community.sql`. On the official site, `/api/board` uses the shared ranking service so rank joins and messages use the same database. Self-hosted forks use their own service origin and database; online services remain opt-in.

Posts contain a nickname and plain text only. When a browser retains a registered score's private ID and the nickname matches that score, the server derives the current rank from its records. Normal and 30-minute badges are separate. The client cannot supply a rank number; public board responses exclude score IDs, submission IDs, and rate-limit identifiers. This is a local score link, not an authenticated account system. Clearing browser storage or using another device can remove that link.

`boardIdentity.ts` preserves local references to named, ranked results across game resets. `boardDraft.ts` stores per-thread drafts and uncertain submissions, including their UUID, before any request. Retrying after a timeout or closing the board reuses that UUID. Server uniqueness and payload checks make retries idempotent. A changed message uses a new UUID. Replies are paginated chronologically, and a successful reply opens the page containing that reply.

Names are limited to 16 code points and bodies to 1,000. Requests are size-bounded. D1 atomically limits posts to one per three seconds and ten per minute per browser identity, plus sixty per minute per network hash. These limits do not provide account authentication. Messages render as React text, with no HTML execution or file upload.

Tests: `server/community.test.js` exercises SQLite migrations, JST boundaries, population averages, scoring separation, pagination, rank changes, validation, retries, and private-field exclusion. `src/community.test.tsx` checks filters, bilingual rendering, escaped post text, score-reference retention, persistent retries, and fork/creator links.

Manual release checks:

- Open normal and 30-minute rankings. Switch daily, weekly, all-time, and app version; confirm average, count, and rows update together.
- Post from the header board, open a post, reply, and refresh. Check the rank badge with a registered nickname and check that a different nickname has no badge.
- Close and reopen a draft, and retry after a connection failure. Confirm the text remains and a retry does not duplicate the post.
- On a narrow phone display, check the new header icon and board form. From the menu, verify the GitHub and `@realnuun` links.
