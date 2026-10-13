# Core modules

Each folder is one job. They talk to each other only through the types in `types.ts`.

| Folder | Job | Built in |
|---|---|---|
| `detect/` | Decide which links deserve the LinkPeek icon | Part 03 |
| `retrieve/` | Fetch a destination safely (no cookies, timeouts, size limits) and diagnose failures | Part 04 |
| `extract/` | Turn fetched HTML or PDF into article text and metadata | Part 04 |
| `summary/` | Word counting, the 20-word limit, summary providers | Part 05 |
| `clickbait/` | Headline tick / cross / neutral | Part 07 |
| `source/` | Source card facts with their evidence | Part 08 |
| `security/` | Link protector | Part 11 |
| `feedback/` | Thumbs up / down, stored on the device | Part 02 (basic), Part 09 |
| `storage/` | Settings and caches | Part 01 |

`../adapters/` holds platform-specific code (Reddit, YouTube...). Part 13. The general engine never depends on an adapter.
