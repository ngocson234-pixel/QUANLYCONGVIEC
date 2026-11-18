# SOHO Security Specification (Phase 0)

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every document under `/users/{userId}/...` belongs solely to `request.auth.uid == userId` with `request.auth.token.email_verified == true`.
2. **No Cross-User Reads or Queries**: A user can never read, list, create, update, or delete another user's tasks, reminders, income ledger, notes, mindmaps, preferences, or private profile.
3. **Referential Integrity**:
   - An `IncomeItem` cannot be created unless its referenced `colId` exists (or is created in the same batch via `existsAfter`) under `/users/{userId}/incomeColumns/{colId}`.
   - A `MindmapNode` cannot be created or updated unless its parent `Mindmap` exists (or is created in the same batch via `existsAfter`) under `/users/{userId}/mindmaps/{mapId}`.
4. **Temporal & Identity Immutability**: `ownerId` / `uid` and `createdAt` are immutable after creation; `createdAt` and `updatedAt` must equal `request.time`.
5. **Volumetric & Schema Bounds**: Every string has strict `.size()` bounds, IDs match `^[a-zA-Z0-9_\-]+$`, enums are strictly enforced, and `hasOnly()` blocks ghost/shadow fields.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Cross-Tenant Read**: User B (`uid: "userB"`) attempts `get(/users/userA/tasks/task1)`.
2. **Unverified Email Bypass**: Authenticated token with `email_verified: false` attempts write to `/users/userA/tasks/task1`.
3. **Identity Spoofing on Create**: User A attempts to create `/users/userA/tasks/task1` with `ownerId: "userB"`.
4. **Shadow/Ghost Field Injection**: User A creates a task with an unexpected extra key `isAdmin: true`.
5. **Immutable Owner Mutation**: User A updates `/users/userA/tasks/task1` attempting to change `ownerId` or `createdAt`.
6. **Client Timestamp Forgery**: User A creates a task with `createdAt` set to a past timestamp instead of `request.time`.
7. **ID Poisoning**: User A attempts to write `/users/userA/tasks/bad$id..with/spaces` or a >128 char ID.
8. **Resource Exhaustion (1MB String)**: User A attempts to create a `Task` with a 5,000-char `title` (limit 300).
9. **Type Confusion on Update**: User A updates `Task` setting `done: "yes"` (string instead of bool) or `IncomeItem` setting `amount: -500`.
10. **Orphaned Mindmap Node**: User A attempts to create `/users/userA/mindmaps/nonexistent/nodes/n1` without a parent mindmap document.
11. **Unbounded Array Attack**: User A attempts to set `IncomeColumn.hiddenMonths` to an array of 100 entries or non-month strings.
12. **PII Leak Attempt**: User B attempts to `get` or `list` `/users/userA/private/profile`.
