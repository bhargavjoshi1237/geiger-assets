// The playground's in-memory database: every seeded table, built lazily the
// first time the playground queries it and kept for the rest of the page
// session, so edits survive tab switches but a reload starts fresh.
//
// Tables are keyed by their bare names: the data layer reaches them through
// `createClient().schema("assets")`, and the memory client falls back from
// "assets.<table>" to "<table>".

import { createMemoryDb } from "./memory_client.js";
import { PLAYGROUND_PROJECT } from "./mode.js";
import { PLAYGROUND_PERSON } from "./cast.js";
import { daysAgo } from "./seed/helpers.js";
import { librarySeed } from "./seed/library.js";
import { collaborationSeed } from "./seed/collaboration.js";
import { licensingSeed } from "./seed/licensing.js";
import { galleriesSeed } from "./seed/galleries.js";
import { deliverySeed } from "./seed/delivery.js";
import { creatorSeed } from "./seed/creator.js";
import { workspaceSeed } from "./seed/workspace.js";
import { governanceSeed } from "./seed/governance.js";
import { commerceSeed } from "./seed/commerce.js";
import { insightsSeed } from "./seed/insights.js";

// Shaped like a Supabase auth user so parseSession() in lib/supabase/user.js
// reads it unchanged.
export const PLAYGROUND_USER = {
  id: PLAYGROUND_PERSON.id,
  email: PLAYGROUND_PERSON.email,
  user_metadata: { full_name: PLAYGROUND_PERSON.name, avatar_url: PLAYGROUND_PERSON.avatar_url },
  app_metadata: {},
  aud: "authenticated",
  role: "authenticated",
};

export const getPlaygroundDb = createMemoryDb(() => ({
  projects: [
    {
      ...PLAYGROUND_PROJECT,
      created_by: PLAYGROUND_PERSON.id,
      created_at: daysAgo(400),
      updated_at: daysAgo(0),
      deleted_at: null,
    },
  ],
  ...librarySeed(),
  ...collaborationSeed(),
  ...licensingSeed(),
  ...galleriesSeed(),
  ...deliverySeed(),
  ...creatorSeed(),
  ...workspaceSeed(),
  ...governanceSeed(),
  ...commerceSeed(),
  ...insightsSeed(),
}));
