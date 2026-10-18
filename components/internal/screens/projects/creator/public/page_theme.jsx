// The creator's theme for their public pages. It re-points the suite's semantic
// tokens (--background, --surface-*, --primary…) at the creator's palette, so
// every shared primitive — buttons, inputs, dialogs portalled to <body> —
// follows it, and adds a few page-only classes (cp-*) for cards, headings and
// the backdrop. Scoped to the public creator routes: it unmounts with them.

import React from "react";
import { fontHref, themeTokens } from "@/lib/creator/page_config";

function declarations(vars) {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join("");
}

const CARD_RULES = {
  flat: "background:var(--surface-subtle);border:1px solid transparent;",
  outline: "background:transparent;border:1px solid var(--border);",
  elevated:
    "background:var(--surface-subtle);border:1px solid var(--border);box-shadow:0 1px 2px rgb(0 0 0 / .06),0 12px 32px -12px rgb(0 0 0 / .28);",
  glass:
    "background:color-mix(in oklab,var(--surface-subtle) 62%,transparent);border:1px solid color-mix(in oklab,var(--foreground) 10%,transparent);backdrop-filter:blur(18px) saturate(1.3);-webkit-backdrop-filter:blur(18px) saturate(1.3);",
};

function backdropRule(theme, backdropUrl) {
  switch (theme.backdrop) {
    case "glow":
      return "background:radial-gradient(1200px 520px at 50% -140px,color-mix(in oklab,var(--cp-accent) 26%,transparent),transparent 70%),var(--background);";
    case "gradient":
      return "background:linear-gradient(180deg,color-mix(in oklab,var(--cp-accent) 22%,var(--background)) 0%,var(--background) 560px);";
    case "image":
      return backdropUrl
        ? `background:linear-gradient(color-mix(in oklab,var(--background) 78%,transparent),var(--background) 85%),url("${backdropUrl}") center top/cover no-repeat fixed,var(--background);`
        : "background:var(--background);";
    default:
      return "background:var(--background);";
  }
}

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const soft = (pct) => `color-mix(in oklab,var(--foreground) ${pct}%,transparent)`;
const tint = (pct) => `color-mix(in oklab,var(--cp-accent) ${pct}%,transparent)`;
const FADE_MASK = "mask-image:radial-gradient(ellipse 80% 70% at 50% 40%,#000 35%,transparent 80%);-webkit-mask-image:radial-gradient(ellipse 80% 70% at 50% 40%,#000 35%,transparent 80%);";

/** Decorative layers (EffectLayer), image treatments (MediaImage) and section backgrounds. */
const EFFECT_RULES = [
  `.cp-fx-grain{background-image:${GRAIN};opacity:.16;mix-blend-mode:overlay;}`,
  `.cp-fx-grid{background-image:linear-gradient(to right,${soft(9)} 1px,transparent 1px),linear-gradient(to bottom,${soft(9)} 1px,transparent 1px);background-size:36px 36px;${FADE_MASK}}`,
  `.cp-fx-dots{background-image:radial-gradient(${soft(18)} 1px,transparent 1.6px);background-size:18px 18px;${FADE_MASK}}`,
  `.cp-fx-glow{background:radial-gradient(70% 60% at 50% 0%,${tint(34)},transparent 70%);}`,
  `.cp-fx-aurora{overflow:hidden;}`,
  `.cp-fx-aurora::before,.cp-fx-aurora::after{content:"";position:absolute;width:60%;aspect-ratio:1;border-radius:50%;filter:blur(70px);opacity:.55;animation:cp-aurora 16s ease-in-out infinite alternate;}`,
  `.cp-fx-aurora::before{left:-10%;top:-30%;background:${tint(70)};}`,
  `.cp-fx-aurora::after{right:-10%;bottom:-40%;background:color-mix(in oklab,var(--cp-accent) 45%,#7c3aed);animation-delay:-8s;}`,
  "@keyframes cp-aurora{0%{transform:translate(0,0) scale(1)}50%{transform:translate(18%,12%) scale(1.15)}100%{transform:translate(-8%,20%) scale(.95)}}",
  ".cp-fx-vignette{background:radial-gradient(ellipse at center,transparent 45%,rgb(0 0 0 / .55) 100%);}",
  "@property --cp-beam{syntax:'<angle>';inherits:false;initial-value:0deg;}",
  `.cp-fx-beam{border-radius:inherit;padding:1.5px;background:conic-gradient(from var(--cp-beam),transparent 0 72%,${tint(90)} 86%,transparent 100%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);animation:cp-beam 5s linear infinite;}`,
  "@keyframes cp-beam{to{--cp-beam:360deg}}",

  ".cp-media-kenburns{animation:cp-kenburns 26s ease-in-out infinite alternate;transform-origin:60% 40%;}",
  "@keyframes cp-kenburns{from{transform:scale(1)}to{transform:scale(1.14) translate(-2%,-1%)}}",
  ".cp-media-parallax{scale:1.25;}",
  "@supports (animation-timeline:view()){.cp-media-parallax{animation:cp-parallax linear both;animation-timeline:view();}}",
  "@keyframes cp-parallax{from{transform:translateY(-10%)}to{transform:translateY(10%)}}",
  ".cp-media-blur{filter:blur(14px);scale:1.1;}",
  ".cp-media-mono,.cp-media-duotone{filter:grayscale(1) contrast(1.08);}",
  ".cp-duotone{background:var(--cp-accent);mix-blend-mode:color;opacity:.85;}",

  ".cp-bg-surface{background:var(--surface-subtle);}",
  ".cp-bg-accent{background:color-mix(in oklab,var(--cp-accent) 14%,var(--background));}",
  ".cp-bg-gradient{background:linear-gradient(135deg,color-mix(in oklab,var(--cp-accent) 34%,var(--background)),color-mix(in oklab,var(--cp-accent) 8%,var(--background)) 55%,var(--surface-subtle));}",
  ".cp-bg-image{background:var(--surface-card);}",
  ".cp-bleed{margin-inline:calc(50% - 50vw);width:100vw;}",
  // A framed section whose renderer drew nothing (no data for this viewer) takes no space.
  ".cp-frame:not(:has(.cp-frame-body > *)){display:none;}",
];

/** Entrances: sections reveal on scroll, the header staggers in, countdown digits tick. */
const MOTION_RULES = [
  "@media (scripting:enabled) and (prefers-reduced-motion:no-preference){",
  "[data-cp-anim]{transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1),filter .8s cubic-bezier(.2,.7,.2,1);}",
  "[data-cp-anim]:not([data-inview]){opacity:0;}",
  "[data-cp-anim=rise]:not([data-inview]){transform:translateY(32px);}",
  "[data-cp-anim=zoom]:not([data-inview]){transform:scale(.94);}",
  "[data-cp-anim=slide]:not([data-inview]){transform:translateX(-40px);}",
  "[data-cp-anim=blur]:not([data-inview]){filter:blur(14px);transform:scale(1.02);}",
  "}",
  ".cp-enter>*{animation:cp-enter .7s cubic-bezier(.2,.7,.2,1) both;}",
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => `.cp-enter>*:nth-child(${n}){animation-delay:${(n - 1) * 70}ms;}`),
  "@keyframes cp-enter{from{opacity:0;transform:translateY(18px);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}",
  ".cp-tick{display:inline-block;animation:cp-tick .45s cubic-bezier(.2,.7,.2,1);}",
  "@keyframes cp-tick{from{opacity:0;transform:translateY(-45%)}to{opacity:1;transform:none}}",
  "@media (prefers-reduced-motion:reduce){.cp-enter>*,.cp-tick,.cp-media-kenburns,.cp-media-parallax,.cp-fx-aurora::before,.cp-fx-aurora::after,.cp-fx-beam{animation:none!important;}}",
];

const HOVER_RULES = {
  none: "",
  lift: ".cp-hover{transition:transform .25s ease,box-shadow .25s ease;}.cp-hover:hover{transform:translateY(-4px);box-shadow:0 18px 36px -18px rgb(0 0 0 / .55);}",
  glow: `.cp-hover{transition:box-shadow .3s ease,transform .3s ease;}.cp-hover:hover{box-shadow:0 0 0 1px ${tint(55)},0 14px 44px -12px ${tint(50)};}`,
  zoom: ".cp-hover{transition:transform .3s cubic-bezier(.2,.7,.2,1);}.cp-hover:hover{transform:scale(1.025);}",
};

const BUTTON_RULES = {
  solid: "",
  gradient:
    ".cp-accent{background:linear-gradient(135deg,color-mix(in oklab,var(--cp-accent),#fff 22%),var(--cp-accent) 55%,color-mix(in oklab,var(--cp-accent),#000 14%));}",
  glow: `.cp-accent{box-shadow:0 8px 28px -8px ${tint(70)},inset 0 1px 0 rgb(255 255 255 / .18);}`,
  // Buttons and links only — badges also wear .cp-accent and are often absolutely positioned.
  shine:
    ":is(button,a).cp-accent{position:relative;overflow:hidden;isolation:isolate;}:is(button,a).cp-accent::after{content:\"\";position:absolute;inset:0;z-index:-1;background:linear-gradient(110deg,transparent 30%,rgb(255 255 255 / .35) 50%,transparent 70%);transform:translateX(-120%);transition:transform .7s ease;}:is(button,a).cp-accent:hover::after{transform:translateX(120%);}",
};

/** <PageTheme theme={page.theme} backdropUrl={…} /> — render once per public page. */
export function PageTheme({ theme, backdropUrl }) {
  const href = fontHref(theme);
  const css = [
    `:root:root:root{${declarations(themeTokens(theme))}}`,
    "body{background:var(--background);color:var(--foreground);}",
    `.cp-root{font-family:var(--cp-font-body);min-height:100dvh;overflow-x:clip;${backdropRule(theme, backdropUrl)}}`,
    ".cp-heading{font-family:var(--cp-font-heading);letter-spacing:-0.015em;}",
    `.cp-card{border-radius:var(--cp-radius);${CARD_RULES[theme.card] || CARD_RULES.flat}}`,
    ".cp-radius{border-radius:var(--cp-radius);}",
    ".cp-radius-sm{border-radius:calc(var(--cp-radius) * .6);}",
    ".cp-container{width:100%;max-width:var(--cp-width);margin-inline:auto;padding-inline:1rem;}",
    "@media (min-width:640px){.cp-container{padding-inline:1.5rem;}}",
    ".cp-accent{background:var(--cp-accent);color:var(--cp-accent-text);}",
    ".cp-accent:hover{filter:brightness(1.06);}",
    ".cp-accent-text{color:var(--cp-accent);}",
    ".cp-accent-soft{background:color-mix(in oklab,var(--cp-accent) 14%,transparent);color:var(--cp-accent);}",
    ".cp-ring{box-shadow:0 0 0 2px var(--cp-accent);}",
    ...EFFECT_RULES,
    ...MOTION_RULES,
    HOVER_RULES[theme.cardHover] || "",
    BUTTON_RULES[theme.buttonStyle] || "",
  ].join("\n");

  return (
    <>
      {href ? <link rel="stylesheet" href={href} precedence="default" /> : null}
      <style>{css}</style>
    </>
  );
}

export default PageTheme;
