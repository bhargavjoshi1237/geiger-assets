// Workflow abilities — pluggable condition/action sets the engine consults for
// any step type it doesn't implement itself.
//
// An ability module contributes:
//   loadSubject(db, event) -> extra run fields (e.g. { order }) for events it owns
//   context(run)           -> values merged into the run's recorded context
//   payload(run)           -> fields merged into the http.webhook payload
//   conditions             -> { [type]: (step, run) => { pass, note } }
//   actions                -> { [type]: async (db, step, run, options) => note }
// Actions throw AbilitySkip to record a Skipped step, any other error to fail
// the run. Adding a domain means writing one module and listing it here; the
// builder's catalogue (components/.../workflows/constants.js) lists the same
// step types for the UI.

import {
  AbilitySkip,
  commerceActions,
  commerceConditions,
  commerceContext,
  commercePayload,
  loadCommerceSubject,
} from "./commerce";

const MODULES = [
  {
    name: "commerce",
    loadSubject: loadCommerceSubject,
    context: commerceContext,
    payload: commercePayload,
    conditions: commerceConditions,
    actions: commerceActions,
  },
];

export { AbilitySkip };

export function abilityCondition(type) {
  for (const m of MODULES) if (m.conditions?.[type]) return m.conditions[type];
  return null;
}

export function abilityAction(type) {
  for (const m of MODULES) if (m.actions?.[type]) return m.actions[type];
  return null;
}

/** Every module's subject fields for one event, merged. Never throws. */
export async function loadAbilitySubjects(db, event) {
  const fields = {};
  for (const m of MODULES) {
    if (!m.loadSubject) continue;
    try {
      Object.assign(fields, await m.loadSubject(db, event));
    } catch (e) {
      console.error(`[workflows.abilities.${m.name}]`, e?.message || e);
    }
  }
  return fields;
}

export function abilityContext(run) {
  return Object.assign({}, ...MODULES.map((m) => m.context?.(run) || {}));
}

export function abilityPayload(run) {
  return Object.assign({}, ...MODULES.map((m) => m.payload?.(run) || {}));
}
