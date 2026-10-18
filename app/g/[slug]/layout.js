import { Newsreader } from "next/font/google";

// The gallery theme's "Serif" typography maps to Tailwind's font-serif, which
// reads --font-serif. Newsreader is a variable serif with optical sizes, so it
// holds up both as a hero title and at toolbar/caption sizes — and keeps public
// galleries from falling back to the OS default (Times/Georgia).
const serif = Newsreader({
  subsets: ["latin"],
  display: "swap",
});

export default function GalleryLayout({ children }) {
  return (
    <div className="contents" style={{ "--font-serif": `${serif.style.fontFamily}, Georgia, serif` }}>
      {children}
    </div>
  );
}
