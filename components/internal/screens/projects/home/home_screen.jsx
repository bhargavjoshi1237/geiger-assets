"use client";

import React from "react";
import { useProject } from "@/context/project-context";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  FolderOpen,
  Image,
  Film,
  FileText,
  Music,
  Boxes,
  HardDrive,
  UploadCloud,
  ArrowUpRight,
  Users,
  Clock,
  TrendingUp,
  Layers,
  Activity,
  ArrowRight,
  Star,
  Globe,
  Workflow,
  FileUp,
  FolderPlus,
  Share2,
  Search,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Package,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const statCards = [
  {
    title: "Total Assets",
    icon: Package,
    value: "2,847",
    change: "+12 this week",
    trend: "up",
  },
  {
    title: "Storage Used",
    icon: HardDrive,
    value: "4.2 GB",
    change: "of 10 GB",
    trend: "neutral",
  },
  {
    title: "Team Members",
    icon: Users,
    value: "7",
    change: "2 online now",
    trend: "neutral",
  },
  {
    title: "Collections",
    icon: Layers,
    value: "5",
    change: "+1 this week",
    trend: "up",
  },
];

const storageBreakdown = [
  { type: "Images", icon: Image, size: "2.1 GB", percent: 50, color: "#3b82f6" },
  { type: "Videos", icon: Film, size: "1.4 GB", percent: 33.3, color: "#8b5cf6" },
  { type: "Documents", icon: FileText, size: "0.5 GB", percent: 11.9, color: "#10b981" },
  { type: "Audio", icon: Music, size: "0.1 GB", percent: 2.4, color: "#f59e0b" },
  { type: "Other", icon: Boxes, size: "0.1 GB", percent: 2.4, color: "#474747" },
];

const recentAssets = [
  { name: "hero-banner-v3.png", type: "PNG", size: "4.2 MB", date: new Date(Date.now() - 1000 * 60 * 15), user: "AJ", icon: Image },
  { name: "product-demo-final.mp4", type: "MP4", size: "128 MB", date: new Date(Date.now() - 1000 * 60 * 60 * 3), user: "MK", icon: Film },
  { name: "brand-guidelines.pdf", type: "PDF", size: "8.7 MB", date: new Date(Date.now() - 1000 * 60 * 60 * 24), user: "SR", icon: FileText },
  { name: "ambient-loop.wav", type: "WAV", size: "24 MB", date: new Date(Date.now() - 1000 * 60 * 60 * 48), user: "AJ", icon: Music },
  { name: "icon-set-v2.svg", type: "SVG", size: "156 KB", date: new Date(Date.now() - 1000 * 60 * 60 * 72), user: "DP", icon: Image },
];

const recentActivity = [
  {
    action: "uploaded 3 assets to Brand Assets",
    user: "Alex Johnson",
    initials: "AJ",
    time: new Date(Date.now() - 1000 * 60 * 30),
    icon: FileUp,
  },
  {
    action: "created collection Summer Campaign 2026",
    user: "Maria Kim",
    initials: "MK",
    time: new Date(Date.now() - 1000 * 60 * 60 * 2),
    icon: FolderPlus,
  },
  {
    action: "shared Product Mockups with Design team",
    user: "Sam Reid",
    initials: "SR",
    time: new Date(Date.now() - 1000 * 60 * 60 * 5),
    icon: Share2,
  },
  {
    action: "approved hero-banner-v3.png for review",
    user: "Dev Patel",
    initials: "DP",
    time: new Date(Date.now() - 1000 * 60 * 60 * 8),
    icon: CheckCircle2,
  },
  {
    action: "archived 12 expired campaign assets",
    user: "Alex Johnson",
    initials: "AJ",
    time: new Date(Date.now() - 1000 * 60 * 60 * 24),
    icon: AlertCircle,
  },
];

const quickActions = [
  { icon: UploadCloud, label: "Upload Files", description: "Add new assets to the project" },
  { icon: Search, label: "Advanced Search", description: "Find assets by metadata, tags, or color" },
  { icon: FolderPlus, label: "New Collection", description: "Group related assets together" },
  { icon: Share2, label: "Share Assets", description: "Send to external collaborators" },
  { icon: Globe, label: "Brand Portal", description: "Configure the public-facing portal" },
  { icon: Workflow, label: "Workflows", description: "Set up automated review processes" },
];

function StatCard({ title, icon: Icon, value, change, trend }) {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#474747] transition-all duration-300 group cursor-default">
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-lg bg-[#2a2a2a] flex items-center justify-center group-hover:bg-[#333333] transition-colors">
          <Icon className="w-4 h-4 text-[#737373] group-hover:text-[#a3a3a3] transition-colors" />
        </div>
        {trend === "up" && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
            <TrendingUp className="w-3 h-3" />
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-semibold text-white tracking-tight">{value}</div>
        <div className="text-xs text-[#525252] mt-0.5">{change}</div>
      </div>
      <div className="text-xs font-medium text-[#737373]">{title}</div>
    </div>
  );
}

function StorageBar({ type, icon: Icon, size, percent, color }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-[#e5e5e5] font-medium">{type}</span>
          <span className="text-xs font-mono text-[#737373]">{size}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[#2a2a2a] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${percent}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}

function RecentAssetRow({ name, type, size, date, user, icon: Icon }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#202020] transition-colors cursor-pointer group">
      <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] flex items-center justify-center shrink-0 group-hover:bg-[#333333] transition-colors">
        <Icon className="w-3.5 h-3.5 text-[#737373] group-hover:text-[#a3a3a3] transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#e5e5e5] font-medium truncate">{name}</p>
        <p className="text-xs text-[#525252]">
          {type} · {size}
        </p>
      </div>
      <Avatar className="w-6 h-6 shrink-0">
        <AvatarFallback className="text-[10px] bg-[#2a2a2a] text-[#a3a3a3] border-0">
          {user}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs text-[#525252] shrink-0 tabular-nums">
        {formatDistanceToNow(date, { addSuffix: false })}
      </span>
      <ArrowUpRight className="w-3.5 h-3.5 text-[#525252] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  );
}

function ActivityRow({ action, user, initials, time, icon: Icon }) {
  return (
    <div className="flex items-start gap-3 py-3 group">
      <Avatar className="w-7 h-7 shrink-0 mt-0.5">
        <AvatarFallback className="text-[10px] bg-[#2a2a2a] text-[#a3a3a3] border-0">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#e5e5e5] leading-relaxed">
          <span className="font-medium text-white">{user}</span>{" "}
          <span className="text-[#a3a3a3]">{action}</span>
        </p>
        <p className="text-xs text-[#525252] mt-1">
          {formatDistanceToNow(time, { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

function QuickActionCard({ icon: Icon, label, description }) {
  return (
    <button className="flex items-center gap-3 p-3.5 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#474747] transition-all duration-300 text-left w-full group cursor-pointer">
      <div className="w-9 h-9 rounded-lg bg-[#2a2a2a] flex items-center justify-center shrink-0 group-hover:bg-[#333333] transition-colors">
        <Icon className="w-4 h-4 text-[#a3a3a3] group-hover:text-white transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#e5e5e5]">{label}</p>
        <p className="text-xs text-[#525252] mt-0.5">{description}</p>
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-[#525252] opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5 shrink-0" />
    </button>
  );
}

export function HomeScreen({ id }) {
  const { project, loading } = useProject();
  const projectName = project?.name && !loading ? project.name : null;

  return (
    <div className="flex flex-col gap-8 w-full pb-12">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="h-7 w-48 rounded-md bg-[#2a2a2a] animate-pulse" />
            ) : (
              <h1 className="text-xl font-semibold text-white tracking-tight">
                {projectName ? `${projectName} Overview` : "Project Overview"}
              </h1>
            )}
            <Badge variant="secondary" className="text-[10px] font-medium bg-[#2a2a2a] text-[#737373] border border-[#333333] hover:bg-[#2a2a2a]">
              Active
            </Badge>
          </div>
          <p className="text-sm text-[#525252]">
            Monitor your project assets, activity, and team performance
          </p>
        </div>
        <Button className="bg-white text-black hover:bg-[#e5e5e5] text-sm h-9 gap-2 rounded-lg">
          <UploadCloud className="w-4 h-4" />
          Upload
        </Button>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <section className="rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#737373]" />
                <h2 className="text-sm font-medium text-white">Recent Assets</h2>
              </div>
              <Button variant="ghost" size="sm" className="text-[#525252] hover:text-white text-xs h-7 rounded-md">
                View all
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            <div className="divide-y divide-[#2a2a2a]/60">
              {recentAssets.map((asset) => (
                <RecentAssetRow key={asset.name} {...asset} />
              ))}
            </div>
          </section>

          <section className="rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#737373]" />
                <h2 className="text-sm font-medium text-white">Activity</h2>
              </div>
              <Button variant="ghost" size="sm" className="text-[#525252] hover:text-white text-xs h-7 rounded-md">
                View log
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            <div className="px-5 divide-y divide-[#2a2a2a]/60">
              {recentActivity.map((item, idx) => (
                <ActivityRow key={idx} {...item} />
              ))}
            </div>
          </section>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6">
          <section className="rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] p-5">
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="w-4 h-4 text-[#737373]" />
              <h2 className="text-sm font-medium text-white">Storage</h2>
            </div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-2xl font-semibold text-white tracking-tight">4.2 GB</span>
              <span className="text-sm text-[#525252]">of 10 GB</span>
            </div>
            <Progress value={42} className="h-2 bg-[#2a2a2a] mb-5 [&>div]:bg-white" />
            <div className="space-y-0">
              {storageBreakdown.map((item) => (
                <StorageBar key={item.type} {...item} />
              ))}
            </div>
          </section>

          <section className="rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-[#737373]" />
              <h2 className="text-sm font-medium text-white">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <QuickActionCard key={action.label} {...action} />
              ))}
            </div>
          </section>

          <section className="rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-[#737373]" />
              <h2 className="text-sm font-medium text-white">Team</h2>
            </div>
            <div className="space-y-2">
              {[
                { initials: "AJ", name: "Alex Johnson", role: "Admin", online: true },
                { initials: "MK", name: "Maria Kim", role: "Editor", online: true },
                { initials: "SR", name: "Sam Reid", role: "Viewer", online: false },
                { initials: "DP", name: "Dev Patel", role: "Editor", online: false },
              ].map((member) => (
                <div key={member.initials} className="flex items-center gap-3 py-1.5">
                  <div className="relative">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs bg-[#2a2a2a] text-[#a3a3a3] border-0">
                        {member.initials}
                      </AvatarFallback>
                    </Avatar>
                    {member.online && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#1a1a1a]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#e5e5e5] font-medium truncate">{member.name}</p>
                    <p className="text-xs text-[#525252]">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
              <Button variant="ghost" size="sm" className="w-full text-[#525252] hover:text-white text-xs h-8 rounded-md justify-center">
                Manage team
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
