import { existsSync, readFileSync, writeFileSync } from "node:fs";

const statePath = process.argv[2];
const previous = existsSync(statePath) ? Number(readFileSync(statePath, "utf8")) : 0;
const run = previous + 1;
writeFileSync(statePath, String(run));
if (run % 2 === 1) {
  console.error("Timeout waiting for locator('[data-testid=save]')");
  process.exit(1);
}
console.log("passed");
