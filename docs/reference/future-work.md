# Future work

For currently supported workflows, start with the
[User Guide](../user-guide.md).

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

## Cross-origin crawl comparison

`compare.mjs` matches pages by absolute URL, so two crawls of different origins
report every page as new or removed. It currently warns when the origins differ.
Matching on path and query instead would enable the common staging-versus-
production diff.

Before implementation, define:

- the page-matching key, and how far query strings are normalized;
- whether origin-relative matching is opt-in or becomes the default;
- the resulting `compare.json` contract change and any consumer migration;
- how two origins are presented in the report header and run metadata.

## Structured self-test runner

Move the localhost regression suite onto `node:test`, which is built into Node
18+ and so adds no dependency, for named subtests, failure isolation, and
standard CI reporting. Today the suite is one sequential script, so the first
assertion failure aborts the run and every later section goes unexercised.

The suite is deliberately order-dependent, which is the bulk of the work: the
fixture server mutates a `variant` flag mid-run so one server yields both a
baseline and a current crawl, `compare.mjs` consumes the baseline's artifacts,
and the resume check depends on interrupt timing.

Before implementation, define:

- how shared fixture state and ordering are expressed (shared setup versus
  serial subtests), given that a single serial test gains little;
- whether the env-gated modes (`TEST_BROWSER`, `EXECUTE_GENERATED_TEST`,
  `EXECUTE_GENERATED_PYTHON_TEST`) become subtests or stay environment flags;
- retention of the retained-work-directory diagnostic on failure;
- that the restructure lands with no behavior changes beside it, so a green run
  demonstrates the port is faithful rather than masking a regression.

## CLI argument parsing edge cases

`parseArgs` in `lib/util.mjs` coerces every numeric-looking value to a Number
and treats any token starting with `--` as the next flag. Both are latent rather
than currently reported, but each has a silent failure mode:

- `--exclude 0` yields the number `0`, which is falsy, so `crawl.mjs`'s
  `args.exclude ? new RegExp(args.exclude) : null` guard drops the filter
  without a warning;
- `--include 1e3` becomes `/1000/`, quietly matching something other than what
  was typed;
- `--user-agent 12345` reaches Playwright as a Number rather than a string;
- `--include --foo` loses the value, sets `include` to `true`, and additionally
  invents a `foo` flag.

Before implementation, define:

- per-option typing versus the current global coercion, and which options must
  stay strings;
- the escape hatch for values that look numeric. Note that `--key=value` is not
  one: the coercion runs after the `=` split, so `--exclude=0` still yields `0`.
  It does already handle values beginning with `--`, giving `--include=--foo`
  the string `"--foo"`;
- backward compatibility for invocations documented in
  `docs/reference/cli.md`.
