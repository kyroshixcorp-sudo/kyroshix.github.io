# Private chat: security review and release gates

Status: review document only. The direct-message migration is not approved for production until the checks below pass against a disposable Supabase project configured with the same Firebase third-party JWT validation as production.

## Current integration boundary

- The web app obtains a Firebase ID token in `dist/auth.js`; `dist/data-client.js` sends it as a Bearer token to Supabase RPC/PostgREST.
- The existing client has no chat methods, no chat route, and no Realtime subscription. The SQL migration alone does not create a working UI.
- `backend/02-chat-direct.sql` depends on `public.krs_uid()` and the profile table from `backend/01-instalar.sql`. Do not run it before verifying those objects and Firebase JWT validation.
- No production migration or deployment is performed by this review.

## Security review of the proposed migration

### Controls present

- RLS is enabled for conversations, members, and messages.
- Read policies require membership through `krs_chat_is_member`.
- Message inserts bind `sender_id` to `krs_uid()` and require membership.
- Clients are not granted direct insert/delete/update privileges on conversations or membership rows; starting a direct conversation is routed through a definer RPC.
- Definer functions set an empty `search_path`, and most exposed function privileges are explicitly revoked from `public`.

### Required checks before approval

1. **Identity trust:** confirm Supabase's gateway validates the Firebase token signature, issuer and audience before PostgREST evaluates `auth.jwt()`. SQL claim checks alone do not validate a JWT signature.
2. **Function grants:** inspect all effective grants on every `SECURITY DEFINER` function, including inherited/default privileges. Verify each callable function has a narrow purpose and cannot return other users' private data.
3. **Membership isolation:** with two verified test users, prove user A cannot select conversations, membership rows or messages for a conversation where A is not a member. Repeat with no token, an expired token, an unverified-email token and a forged `sub` claim.
4. **Sender spoofing:** attempt an insert with `sender_id` set to user B while authenticated as user A; it must fail. Attempt whitespace-only messages and messages over 4,000 characters; both must fail.
5. **Membership escalation:** attempt direct INSERT/UPDATE/DELETE against `krs_conversations` and `krs_conversation_members` as the client role; all must fail. Verify the start-chat RPC creates exactly the caller and the intended recipient, and rejects self-chat or nonexistent profiles.
6. **Receipt tampering:** user A must not update user B's `last_read_at`, nor move a member row to another conversation.
7. **Concurrency:** start the same direct conversation concurrently from both accounts; confirm only one two-member conversation exists.
8. **Realtime:** do not enable subscriptions until the same membership authorization is demonstrated for the Realtime channel. Postgres RLS checks alone should not be treated as proof of Realtime authorization.
9. **Abuse limits:** add server-side rate limiting or an equivalent abuse control before public launch. RLS does not prevent a valid user from sending many messages.
10. **Data lifecycle:** define edit/delete behavior, blocking/reporting, retention, and whether deleted message bodies are physically removed or soft-deleted before launch.

## Minimal two-user acceptance matrix

| Test | Expected result |
|---|---|
| A starts a chat with B | One conversation with exactly A and B |
| A reads that conversation | Allowed |
| B reads that conversation | Allowed |
| C reads that conversation | No rows returned |
| A reads messages from an unrelated conversation | No rows returned |
| A inserts a message as A into A/B conversation | Allowed |
| A inserts a message claiming sender B | Rejected |
| A directly adds C as a member | Permission denied |
| Anonymous request reads private messages | No rows returned |
| Invalid or expired Firebase token | Request rejected by auth gateway |
| Concurrent duplicate start-chat calls | One conversation, not two |

## Release sequence

1. Run the migration on a disposable Supabase project configured like production.
2. Execute the two-user matrix with real Firebase test accounts and inspect effective grants/RLS policies.
3. Add and test the browser chat module and route; verify loading, empty, error, send, refresh and mobile states.
4. Add Realtime only after authorization checks pass; retain a manual refresh fallback.
5. Review the resulting PR, then apply the migration intentionally. Deploy separately and smoke-test with two test accounts.

**Do not merge or execute the migration solely because it parses or because the tables already exist.**