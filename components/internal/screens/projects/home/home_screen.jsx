"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FolderOpen,
  Image,
  Upload,
  Clock,
  HardDrive,
  FileText,
  ArrowUpRight,
} from "lucide-react";
import { useProject } from "@/context/project-context";

function StatCard({ title, value, icon: Icon, subtitle }) {
  return (
    <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-[#e7e7e7] hover:border-[#474747] transition-all duration-300">
      <CardHeader className="pb-2 space-y-1">
        <div className="flex items-center gap-2 text-[#a3a3a3]">
          <div className="w-5 h-5 rounded bg-[#2a2a2a] flex items-center justify-center">
            <Icon className="w-3 h-3 text-[#737373]" />
          </div>
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-[#525252]">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function RecentAssetItem({ name, type, size, date }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#202020] transition-colors group cursor-pointer">
      <div className="w-9 h-9 rounded-lg bg-[#2a2a2a] flex items-center justify-center shrink-0">
        <Image className="w-4 h-4 text-[#737373]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#e7e7e7] truncate">{name}</p>
        <p className="text-xs text-[#525252]">
          {type} · {size}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#525252]">{date}</span>
        <ArrowUpRight className="w-4 h-4 text-[#525252] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, description }) {
  return (
    <button className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#474747] transition-all duration-300 text-left w-full group">
      <div className="w-9 h-9 rounded-lg bg-[#2a2a2a] flex items-center justify-center shrink-0 group-hover:bg-[#333333] transition-colors">
        <Icon className="w-4 h-4 text-[#a3a3a3] group-hover:text-white transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#e7e7e7]">{label}</p>
        <p className="text-xs text-[#525252]">{description}</p>
      </div>
    </button>
  );
}

export function HomeScreen({ id }) {
  const { project } = useProject();

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e7e7e7]">
            {project?.name || "Project"} Assets
          </h1>
          <p className="text-sm text-[#525252] mt-1">
            Manage and organize your project assets
          </p>
        </div>
        <Button className="bg-white text-black hover:bg-[#e7e7e7] text-sm h-9 gap-2">
          <Upload className="w-4 h-4" />
          Upload
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Assets"
          value="0"
          icon={FolderOpen}
          subtitle="Across all folders"
        />
        <StatCard
          title="Storage Used"
          value="0 MB"
          icon={HardDrive}
          subtitle="of 5 GB available"
        />
        <StatCard
          title="Recent Uploads"
          value="0"
          icon={Clock}
          subtitle="Last 7 days"
        />
        <StatCard
          title="File Types"
          value="0"
          icon={FileText}
          subtitle="Unique formats"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Assets */}
        <div className="lg:col-span-2">
          <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-[#e7e7e7]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-[#a3a3a3]">
                  Recent Assets
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#525252] hover:text-white text-xs h-7"
                >
                  View all
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#2a2a2a] flex items-center justify-center mb-3">
                  <Image className="w-6 h-6 text-[#525252]" />
                </div>
                <p className="text-sm text-[#525252]">No assets yet</p>
                <p className="text-xs text-[#333333] mt-1">
                  Upload your first asset to get started
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-[#e7e7e7]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-[#a3a3a3]">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <QuickAction
                icon={Upload}
                label="Upload Files"
                description="Add new assets to the project"
              />
              <QuickAction
                icon={FolderOpen}
                label="New Folder"
                description="Organize your assets"
              />
              <QuickAction
                icon={FileText}
                label="Export Manifest"
                description="Download asset inventory"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
