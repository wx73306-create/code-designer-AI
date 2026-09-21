# Git Recovery Incident — 2026-09-21

> Concise recovery record. For the full forensic trail (hashes, messages, timeline),
> see [`incident-2026-09-21-git-object-loss.md`](./incident-2026-09-21-git-object-loss.md).

## Impact

Local git object database corruption. `git log` / `git status` / `git commit` all failed with
`fatal: not a git repository`, even though the `.git` directory still existed.
No source files were lost.

## Lost

18 local commits (never pushed), covering:

- Sprint A — layout-ground-truth
- Sprint B — reconstruction-diff

The two local tags `v0.9.0-layout-ground-truth` and `v0.10.0-reconstruction-diff`
pointed into that lost commit graph and are gone.

## Preserved

Source state recovered into commit **`2ccd8a3`** — content-equivalent to the lost tip,
single commit instead of 18. No history was fabricated to replace them.

The recovery is marked by tag **`v0.10.1-recovery-20260921`**
(not `v0.10.0` — a recovery snapshot must not impersonate a feature release).

## Cause

Missing / deleted git internals, discovered 2026-09-21 after the last write at 23:55:

- `refs/heads/main`, `refs/tags/*` and `packed-refs` — the entire `refs/` directory gone
- `objects/pack/*.pack` — both pack files gone, `.idx` files left behind
- only 7 loose objects remained (`count-objects`: `in-pack: 0`)

Most consistent with an interrupted `git gc`/`repack`, or an external cleaner;
root cause not proven.

## Recovery

1. Recovered the lost tip hash from `.git/logs/refs/heads/main` (reflog survived).
2. Moved the broken local branch pointer aside so it stopped poisoning `fetch`.
3. `git fetch origin` — remote had only 3 README-only commits, so it could not restore the 18.
4. Removed stale `index` / `multi-pack-index` / orphan `.idx` (all backed up),
   rebuilt the index from `9b11f4c` with **zero changes to the working tree**.
5. Committed the entire delta (128 files) as `2ccd8a3`, pushed to `origin/main`.

## Prevention

1. Push after every sprint checkpoint — everything lost here was local-only.
2. Push annotated tags so release markers never live only on one machine.
3. Avoid long local-only development chains.
4. On `fatal: not a git repository` with `.git` present, check `refs/` and
   `objects/pack/*.pack` **before** ever running `git init`.
