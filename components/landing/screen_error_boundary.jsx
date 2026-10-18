"use client";

import React from "react";
import { TriangleAlert } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EmptyState, ScreenHeader } from "@/components/internal/shared/screen_kit";

// The playground runs the real workspace screens on the public landing page, so
// one screen tripping over unexpected data must not take the page down with it.
// Give it a `key` (the tab title) so switching tabs resets it. Mirrors
// geiger-events' playground boundary.
export class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("[playground] screen failed to render", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    const title = this.props.title || "This screen";
    return (
      <MainScreenWrapper>
        <ScreenHeader
          title={title}
          description="This screen needs a signed-in workspace to render fully."
        />
        <EmptyState
          icon={TriangleAlert}
          title={`${title} couldn't load in the playground`}
          description="Pick another screen from the sidebar, or open the workspace to see this one with your own data."
          className="rounded-2xl border border-dashed border-border"
        />
      </MainScreenWrapper>
    );
  }
}

export default ScreenErrorBoundary;
