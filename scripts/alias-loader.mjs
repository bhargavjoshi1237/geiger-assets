// Resolves the project's `@/` root alias for plain `node` processes.
//
// jsconfig.json maps `@/*` to the repo root, which Next understands and Node
// does not. The CLI scripts import real app modules (lib/storage/*), and those
// modules import each other through the alias, so without this hook a script
// can only reach the handful of files that happen to use relative imports.
//
// Registered by the scripts themselves via module.register(); it is never part
// of the Next build.

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The alias is written without a file extension throughout the codebase
// ("@/lib/s3/config"), so the same candidate list Next's resolver walks has to
// be walked here.
function resolveAlias(rest) {
  const base = path.join(ROOT, rest);
  const candidates = [base, `${base}.js`, `${base}.mjs`, `${base}.json`, path.join(base, "index.js")];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const url = resolveAlias(specifier.slice(2));
    if (url) return { url, format: undefined, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
