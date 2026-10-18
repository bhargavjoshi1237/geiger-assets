"use client";

import React from "react";
import {
  ArrowUpRight,
  Clapperboard,
  CloudUpload,
  Code,
  Copy,
  Crop,
  Download,
  Folder,
  Layers,
  Link2,
  MoreHorizontal,
  Move,
  PenLine,
  Scan,
  Share2,
  Trash2,
  Zap,
} from "lucide-react";

import { Button } from "@geiger/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@geiger/ui/dropdown-menu";

// Delivery transforms offered as alternate downloads / URLs for images.
const DOWNLOAD_FORMATS = [
  { label: "As WebP", transform: "f_webp", ext: "webp" },
  { label: "As JPG", transform: "f_jpg", ext: "jpg" },
  { label: "As PNG", transform: "f_png", ext: "png" },
];

const URL_VARIANTS = [
  { label: "Original", transform: "" },
  { label: "Optimized", transform: "f_auto,q_auto", imageOnly: true },
  { label: "Thumbnail (512px)", transform: "w_512,h_512,c_fill,f_auto", imageOnly: true },
];

function Item({ icon: Icon, children, soon, ...props }) {
  return (
    <DropdownMenuItem className="cursor-pointer gap-2" disabled={soon} {...props}>
      <Icon className="h-4 w-4" />
      {children}
      {soon && <DropdownMenuShortcut>Soon</DropdownMenuShortcut>}
    </DropdownMenuItem>
  );
}

function Sub({ icon: Icon, label, children }) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="cursor-pointer gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-44">{children}</DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

// The Asset Library's per-row "more" menu. Same trigger as the suite
// ActionMenu, but with submenus (Download / Share / Copy URL), which
// ActionMenu's flat item list can't express. Handlers come from
// useAssetActions + the screen; `openFolder` and `manageShares` are optional
// and hide their rows when absent.
export function AssetActionMenu({ asset, actions }) {
  const isImage = asset.type === "image";
  const urlVariants = URL_VARIANTS.filter((v) => isImage || !v.imageOnly);
  const run = (fn, ...args) => () => fn?.(asset, ...args);

  return (
    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${asset.name}`}
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <Item icon={Move} onSelect={run(actions.open)}>
            Open
          </Item>
          {isImage && (
            <Item icon={Clapperboard} soon>
              Image to Video
            </Item>
          )}
          <Item icon={Scan} soon>
            Advanced Editing
          </Item>
          <Item icon={Crop} onSelect={run(actions.edit)}>
            Edit
          </Item>
          <Item icon={Zap} soon>
            Run Automation
          </Item>
          {actions.openFolder && (
            <Item icon={Folder} onSelect={run(actions.openFolder)}>
              Open Containing Folder
            </Item>
          )}

          <DropdownMenuSeparator />

          <Sub icon={Download} label="Download">
            <Item icon={Download} onSelect={run(actions.download)}>
              Original file
            </Item>
            {isImage && (
              <>
                <DropdownMenuSeparator />
                {DOWNLOAD_FORMATS.map((f) => (
                  <Item
                    key={f.ext}
                    icon={Download}
                    onSelect={run(actions.downloadAs, f.transform, f.ext)}
                  >
                    {f.label}
                  </Item>
                ))}
              </>
            )}
          </Sub>
          <Sub icon={Share2} label="Share">
            <Item icon={Link2} onSelect={run(actions.copyLink)}>
              Copy delivery link
            </Item>
            <Item icon={Share2} onSelect={run(actions.createShareLink)}>
              Create share link
            </Item>
            {actions.manageShares && (
              <>
                <DropdownMenuSeparator />
                <Item icon={ArrowUpRight} onSelect={() => actions.manageShares()}>
                  Manage shared links
                </Item>
              </>
            )}
          </Sub>
          <Sub icon={Code} label="Copy URL">
            {urlVariants.map((v) => (
              <Item key={v.label} icon={Link2} onSelect={run(actions.copyLink, v.transform)}>
                {v.label}
              </Item>
            ))}
          </Sub>

          <DropdownMenuSeparator />

          <Item icon={PenLine} onSelect={run(actions.rename)}>
            Rename
          </Item>
          <Item icon={CloudUpload} onSelect={run(actions.replace)}>
            Replace
          </Item>
          <Item icon={Copy} onSelect={run(actions.duplicate)}>
            Duplicate
          </Item>
          <Item icon={Layers} onSelect={run(actions.addToCollection)}>
            Add to Collection
          </Item>

          <DropdownMenuSeparator />

          <Item icon={Trash2} variant="destructive" onSelect={run(actions.remove)}>
            Delete
          </Item>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
