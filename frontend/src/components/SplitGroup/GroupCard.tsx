import { useState } from "react";
import {
  Settings,
  GitFork,
  Trash2,
  MoreHorizontal,
  TrendingUp,
  Clock,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu";
import { Button } from "@components/ui/button";
import { cn } from "@utils/format";
import { type Group } from "@src/types/split-group"
import { GroupEditor } from "./GroupEditor";
import { formatCurrency, formatRelativeTime } from "@utils/format"

interface GroupCardProps {
  group: Group;
  isRecent?: boolean;
  onUpdate: (group: Group) => void;
  onDelete: (id: string) => void;
  onCreateSplit: (group: Group) => void;
  className?: string;
}


function MemberStack({
  members,
  max = 4,
}: {
  members: Group["members"];
  max?: number;
}) {
  const visible = members.slice(0, max);
  const overflow = members.length - max;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visible.map((m) => (
          <div
            key={m.id}
            title={`${m.name} · ${m.role}`}
            className="h-7 w-7 rounded-full ring-2 ring-zinc-900 flex items-center justify-center text-[10px] font-bold flex-shrink-0"
            style={{ backgroundColor: m.color + "33", color: m.color }}
          >
            {m.initials}
          </div>
        ))}
        {overflow > 0 && (
          <div className="h-7 w-7 rounded-full ring-2 ring-zinc-900 bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-400">
            +{overflow}
          </div>
        )}
      </div>
      <span className="ml-2.5 text-xs text-zinc-500">
        {members.length} {members.length === 1 ? "member" : "members"}
      </span>
    </div>
  );
}

export function GroupCard({
  group,
  isRecent = false,
  onUpdate,
  onDelete,
  onCreateSplit,
  className,
}: GroupCardProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "relative group rounded-2xl border bg-zinc-900/80 backdrop-blur-sm overflow-hidden",
          "transition-all duration-300 cursor-pointer",
          "hover:shadow-2xl hover:-translate-y-0.5",
          isRecent
            ? "border-zinc-700/80 hover:border-zinc-600"
            : "border-zinc-800 hover:border-zinc-700",
          className
        )}
        style={{
          boxShadow: hovered
            ? `0 20px 60px ${group.accentColor}15, 0 4px 20px rgba(0,0,0,0.4)`
            : undefined,
        }}
      >
        {/* Accent top bar */}
        <div
          className="h-0.5 w-full"
          style={{
            background: `linear-gradient(90deg, ${group.accentColor}, transparent)`,
          }}
        />

        {/* Recent tag */}
        {isRecent && (
          <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-semibold text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full border border-zinc-700/50">
            <Clock className="h-2.5 w-2.5" />
            Recent
          </div>
        )}

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                style={{
                  backgroundColor: group.accentColor + "18",
                  border: `1px solid ${group.accentColor}30`,
                }}
              >
                {group.emoji}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-zinc-100 text-base leading-tight truncate">
                  {group.name}
                </h3>
                {group.description && (
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">
                    {group.description}
                  </p>
                )}
              </div>
            </div>

            {/* Actions menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="h-7 w-7 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44 bg-zinc-900 border-zinc-700"
              >
                <DropdownMenuItem
                  onClick={() => setEditorOpen(true)}
                  className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800 cursor-pointer text-xs gap-2"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Group settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onCreateSplit(group)}
                  className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800 cursor-pointer text-xs gap-2"
                >
                  <GitFork className="h-3.5 w-3.5" />
                  Create split
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem
                  onClick={() => onDelete(group.id)}
                  className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer text-xs gap-2"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Members */}
          <MemberStack members={group.members} />

          {/* Divider */}
          <div className="my-4 border-t border-zinc-800" />

          {/* Stats row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-0.5">
                Total spent
              </p>
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-lg font-bold"
                  style={{ color: group.accentColor }}
                >
                  {formatCurrency(group.totalSpent, group.currency)}
                </span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-0.5">
                Last activity
              </p>
              <div className="flex items-center gap-1 text-xs text-zinc-400 justify-end">
                <TrendingUp className="h-3 w-3" style={{ color: group.accentColor }} />
                {formatRelativeTime(group.lastActivityAt)}
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions bar (appears on hover) */}
        <div
          className={cn(
            "flex border-t border-zinc-800 transition-all duration-200 overflow-hidden",
            hovered ? "max-h-12 opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <button
            onClick={() => setEditorOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
          >
            <Settings className="h-3 w-3" />
            Settings
          </button>
          <div className="w-px bg-zinc-800" />
          <button
            onClick={() => onCreateSplit(group)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
          >
            <GitFork className="h-3 w-3" />
            New Split
          </button>
        </div>
      </div>

      <GroupEditor
        group={group}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSave={onUpdate}
        onDelete={onDelete}
        onCreateSplit={onCreateSplit}
      />
    </>
  );
}