Before Implementing any Changes Read the Project and its files, Take a good look around related Files and Folder Structure to gather Context and resulting in better,cleaner and more suiting code.
Carefully plan actions and steps to achive the objective, and then clearly and cleanly go throug that plan. 
This is a Next JS 16 Project
We are wokring with app router and mainly focuesd on SSR and SSG
We are mainly focusing on using shadcn ui for the ui components
We are using tailwind css for the styling
We are using lucide icons for the icons
When ever imlpementing any kind of UI make sure to take a good look at the other compnoents/screens/pages and try to implement the same style and structure. Its should be visualy simmiler and consistent.
DO NOT LEAVE ANY COMMENTS IN ANY FILES
Study and Follow the Existing File/Folder Structure, And Implement Followingly.

Global Input Box Standard (Applied Project-Wide)
- Use shared Input component from components/ui/input.jsx for all text-like input boxes.
- Core input box metrics:
	- Border radius: 6px
	- Horizontal padding: 14px
	- Vertical padding: 10px
	- Icon gap inside input groups: 8px
	- Label to input spacing target: 10px
- Tokens are defined in app/globals.css:
	- --input-box-radius
	- --input-box-padding-x
	- --input-box-padding-y
	- --input-box-icon-gap
	- --input-box-label-gap
- Implementation notes:
	- Base Input primitive enforces these metrics globally for all Input usages.
	- Search input icon offsets and inner paddings are tokenized from these variables.
	- Custom email input-group in vault access control is also token-aligned.
- Exception: range sliders (type="range") are not treated as input boxes and keep their own sizing/styling.

# Add-on System

Add-ons extend project functionality by adding new sidebar nav items and screens.
They are toggled on/off per-project from Settings > Add-ons.

## Folder Structure

addons/
  registry.js          # Core registry: loadAddon(), getInstalledAddons(), getAddonScreens(), getAddonNavItems(), AddonRegistryProvider, useAddonRegistry
  sql/                  # SQL Explorer add-on (reference implementation)
    index.js            # Entry point — imports manifest and calls loadAddon()
    manifest.js         # Exports addon definition object
    screens/
      sql_screen.jsx    # Main screen component rendered when nav item is clicked
    components/
      query_editor.jsx  # Addon-specific UI components
      results_viewer.jsx
      table_browser.jsx
      schema_view.jsx
  <future-addon>/       # Follow the same structure as sql/
    index.js
    manifest.js
    screens/
    components/

## How It Works

1. `app/project/[id]/page.js` imports each addon's index.js (e.g. `import "@/addons/sql"`)
2. Each addon's index.js calls `loadAddon(addonDefinition)` from the registry
3. `AddonRegistryProvider` wraps the project layout and manages enabled state
4. The sidebar reads `getAddonNavItems(enabledAddons)` and renders them after main nav
5. The page router reads `getAddonScreens(enabledAddons)` and renders the matching component

## Creating a New Add-on

Follow these steps to create a new add-on:

1. **Create the folder**: `addons/<addon-id>/`
2. **Create `manifest.js`** — export an object with this shape:
   ```
   id          — unique string identifier (matches folder name)
   name        — display name
   description — short description
   version     — semver string
   category    — category label
   icon        — lucide-react icon component
   color       — hex color for UI accents
   features    — string[] of feature labels
   navItem     — { title: string, icon: LucideIcon }
   screens     — [{ id: string (must match navItem.title), component: ReactComponent }]
   ```
3. **Create `screens/`** — add the main screen component for the addon
4. **Create `components/`** — add sub-components used by the screens
5. **Create `index.js`** — import manifest and call `loadAddon()`
6. **Register in page.js** — add `import "@/addons/<addon-id>"` in `app/project/[id]/page.js`
7. **Add to settings nav** — the addon appears automatically in Settings > Add-ons if registered

Key rules:
- The screen `id` in the screens array MUST match the `navItem.title` exactly
- Screen components must be default-exported or named-exported React components
- Use MainScreenWrapper or SecondaryScreenWrapper from shared/ for consistent layout
- Follow existing UI patterns (dark theme tokens, card styles, spacing)