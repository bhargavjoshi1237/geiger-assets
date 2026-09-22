import ProjectWorkspaceLayout from "./workspace_layout";

export const dynamic = "force-static";

export default function ProjectSegmentLayout({ children }) {
  return <ProjectWorkspaceLayout>{children}</ProjectWorkspaceLayout>;
}
