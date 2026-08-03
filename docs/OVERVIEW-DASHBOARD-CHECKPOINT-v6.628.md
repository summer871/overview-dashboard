# Executive Overview Dashboard - v6.628 Working Checkpoint

**Date:** 2026-08-03
**Branch:** `agent/v6.544-shared-table-platform-5118`
**UI:** `v6.628`
**Build:** `STABLE-GRID-LIFECYCLE-69`

## Decision

Summer reviewed the real Apps Script `/dev` dashboard and selected v6.628 as a good working stopping point. No major visual twitching was observed during the latest review. This checkpoint is being preserved in GitHub before future feature work.

## What this checkpoint improved

- Sorting preserves column resize and context-menu controls.
- Table headers remain stable while rows are sorted or rerendered.
- Column width state uses stable table and column identities.
- Manual widths remain authoritative across sizing modes.
- Compact, viewport, and visible-content sizing are separate operations.
- Adjacent divider dragging changes only the neighboring pair.
- Tab activation has one coordinating owner.
- Warm tab switches reuse prepared surfaces.
- Global body hiding was removed.
- Ordinary row/chart mutations no longer trigger broad width rescans.
- TAT cache rendering was consolidated.
- Saved expanded card heights respect shared visual minimums.

## Validation completed before the real-data review

- Exact-source package validation.
- HTML/script syntax validation.
- v6.628 targeted lifecycle validator.
- Dashboard runtime contracts.
- Dashboard platform validator.
- TAT product contracts.
- Browser lifecycle fixture covering sort/edit controls, persistence, sizing modes, switching, and mutation filtering.

## Real-data review result

- Accepted as a good working development checkpoint.
- No major twitching observed during the latest review.
- Loading performance remains an area to monitor rather than a closed performance claim.

## Deployment state

- Apps Script head: v6.628 candidate pushed and reviewed.
- GitHub: this checkpoint commit records the accumulated local source and cleanup.
- Production: not deployed as part of this checkpoint.

## Documentation added

- Feature catalog and regression checklist.
- Architecture and ownership guide.
- Generated named-function inventory.

## Next time work resumes

1. Read the feature catalog and ownership guide first.
2. Confirm the `/dev` footer before testing.
3. Preserve the single-owner architecture.
4. Use the acceptance checklist for every platform-level change.
5. Treat real-data `/dev` behavior as the final acceptance result.
