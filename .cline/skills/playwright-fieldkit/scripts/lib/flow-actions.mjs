export const FLOW_ACTIONS = new Set([
  "mockResponse", "mockAbort", "goto", "click", "fill", "type", "select",
  "check", "uncheck", "press", "hover", "scrollTo", "waitFor", "waitForUrl",
  "wait", "expectText", "expectUrl", "expectVisible", "expectNotVisible",
  "expectValue", "expectCount", "auditA11y", "screenshot",
]);

export function flowAction(step) {
  if (!step || typeof step !== "object" || Array.isArray(step)) {
    throw new Error(`flow step must be an object: ${JSON.stringify(step)}`);
  }
  const actions = Object.keys(step).filter((key) => FLOW_ACTIONS.has(key));
  if (actions.length !== 1) {
    throw new Error(`flow step must contain exactly one supported action; found ${actions.length}: ${JSON.stringify(step)}`);
  }
  return actions[0];
}
