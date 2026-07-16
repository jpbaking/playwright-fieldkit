# Future work

Only unimplemented candidates are listed here. These are ideas, not committed
release promises.

## Visual pixel diffing

Add optional screenshot comparison to `compare.mjs` for layout and styling
regressions that accessibility-tree diffs cannot detect.

Before implementation, define:

- the image-diff dependency and supported image format;
- configurable pixel and anti-aliasing tolerances;
- handling for viewport, browser, animation, font, and dynamic-content drift;
- baseline storage and report artifact conventions.

## Parallel crawling

Add a bounded worker pool to improve crawl speed while retaining deterministic
output, per-host rate limits, authorization enforcement, page caps, and reliable
checkpoint/resume behavior.

## HAR capture

Add an opt-in `inspect.mjs --har` mode for deep network debugging. Keep HAR files
out of normal reports, document their potentially sensitive contents, and apply
the same artifact-handling warnings used for authentication state.

## Deeper accessibility analysis

Optionally integrate a dedicated accessibility engine such as axe-core for WCAG
checks beyond the current deterministic heuristics. Keep the lightweight audit
available without the extra dependency.

## Large-crawl storage

Consider JSONL or another append-friendly page store so very large crawls do not
need to rewrite the complete checkpoint after each checkpoint interval. Preserve
compatibility with the existing final `crawl.json` report format.
