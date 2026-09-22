// Installs every bundled addon by importing it for its side effect: each
// addon's index.js calls loadAddon() as it evaluates, filling the registry.
//
// Import this ONE module rather than the addons individually. Both hosts that
// render project screens — the real route and the landing playground — pull it
// in, so an addon added here appears in both and the two can never drift apart.
//
// The catalog is empty until the bundled add-ons land (brand-kit, watermark,
// contact-sheets); each adds one side-effect import below.
import "./brand-kit";
import "./watermark";
import "./contact-sheets";
