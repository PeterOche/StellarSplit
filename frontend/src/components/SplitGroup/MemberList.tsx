import React, { useState, useRef, useCallback } from "react";
import {
  Crown,
  Shield,
  User,
  GripVertical,
  X,
  Search,
  UserPlus,
  ChevronDown,
} from "lucide-react";
import { type Member, type MemberRole } from "../../types/split-group";
import { SUGGESTED_MEMBERS } from "./data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu";
import { Input } from "@components/ui/input";
import { Badge } from "@components/ui/badge";
import { cn } from "../../utils/format";


const ROLE_CONFIG: Record<
  MemberRole,
  { label: string; icon: React.ReactNode; color: string; description: string }
> = {
  owner: {
    label: "Owner",
    icon: <Crown className="h-3 w-3" />,
    color: "text-amber-400",
    description: "Full control",
  },
  admin: {
    label: "Admin",
    icon: <Shield className="h-3 w-3" />,
    color: "text-blue-400",
    description: "Can manage members & splits",
  },
  member: {
    label: "Member",
    icon: <User className="h-3 w-3" />,
    color: "text-zinc-400",
    description: "Can add & settle expenses",
  },
};


function MemberAvatar({
  member,
  size = "md",
}: {
  member: Member;
  size?: "sm" | "md";
}) {
  const sizes = { sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm" };
  if (member.avatar) {
    return (
      <img
        src={member.avatar}
        alt={member.name}
        className={cn(
          "rounded-full object-cover ring-2 ring-zinc-800",
          sizes[size]
        )}
      />
    );
  }
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold ring-2 ring-zinc-800 flex-shrink-0",
        sizes[size]
      )}
      style={{ backgroundColor: member.color + "33", color: member.color }}
    >
      {member.initials}
    </div>
  );
}


interface MemberRowProps {
  member: Member;
  index: number;
  isDragging: boolean;
  isDragOver: boolean;
  canEdit: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: (index: number) => void;
  onRoleChange: (id: string, role: MemberRole) => void;
  onRemove: (id: string) => void;
}

function MemberRow({
  member,
  index,
  isDragging,
  isDragOver,
  canEdit,
  onDragStart,
  onDragOver,
  onDrop,
  onRoleChange,
  onRemove,
}: MemberRowProps) {
  const role = ROLE_CONFIG[member.role];
  const isOwner = member.role === "owner";

  return (
    <div
      draggable={canEdit && !isOwner}
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(index);
      }}
      onDrop={() => onDrop(index)}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 select-none",
        "border border-transparent",
        isDragOver && "border-amber-500/40 bg-amber-500/5 scale-[1.01]",
        isDragging && "opacity-40 scale-[0.98]",
        !isDragOver && !isDragging && "hover:bg-zinc-800/50"
      )}
    >
      {/* Drag handle */}
      {canEdit && !isOwner && (
        <GripVertical className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 cursor-grab active:cursor-grabbing flex-shrink-0 transition-colors" />
      )}
      {isOwner && <div className="w-4 flex-shrink-0" />}

      <MemberAvatar member={member} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-100 truncate">
            {member.name}
          </span>
          {isOwner && (
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5 border-amber-500/30 text-amber-400 bg-amber-500/10"
            >
              You
            </Badge>
          )}
        </div>
        <p className="text-xs text-zinc-500 truncate">{member.email}</p>
      </div>

      {/* Role */}
      {canEdit && !isOwner ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                "border border-zinc-700/60 hover:border-zinc-600",
                "bg-zinc-800/60 hover:bg-zinc-700/60",
                role.color
              )}
            >
              {role.icon}
              {role.label}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 bg-zinc-900 border-zinc-700"
          >
            {(["admin", "member"] as MemberRole[]).map((r) => {
              const cfg = ROLE_CONFIG[r];
              return (
                <DropdownMenuItem
                  key={r}
                  onClick={() => onRoleChange(member.id, r)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 cursor-pointer",
                    member.role === r && "bg-zinc-800"
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center gap-1.5 font-medium text-xs",
                      cfg.color
                    )}
                  >
                    {cfg.icon} {cfg.label}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {cfg.description}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg",
            "border border-transparent bg-zinc-800/40",
            role.color
          )}
        >
          {role.icon}
          {role.label}
        </span>
      )}

      {/* Remove */}
      {canEdit && !isOwner && (
        <button
          onClick={() => onRemove(member.id)}
          className="opacity-0 group-hover:opacity-100 ml-1 rounded-lg p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
          title="Remove member"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

interface MemberListProps {
  members: Member[];
  onChange: (members: Member[]) => void;
  canEdit?: boolean;
}

export function MemberList({
  members,
  onChange,
  canEdit = true,
}: MemberListProps) {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const existingIds = new Set(members.map((m) => m.id));
  const suggestions = SUGGESTED_MEMBERS.filter(
    (s) =>
      !existingIds.has(s.id) &&
      (s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.email.toLowerCase().includes(query.toLowerCase()))
  );

  const handleAdd = useCallback(
    (member: Member) => {
      onChange([...members, { ...member, role: "member" }]);
      setQuery("");
      setShowSuggestions(false);
      inputRef.current?.focus();
    },
    [members, onChange]
  );

  const handleRemove = useCallback(
    (id: string) => onChange(members.filter((m) => m.id !== id)),
    [members, onChange]
  );

  const handleRoleChange = useCallback(
    (id: string, role: MemberRole) =>
      onChange(members.map((m) => (m.id === id ? { ...m, role } : m))),
    [members, onChange]
  );

  const handleDrop = useCallback(
    (targetIndex: number) => {
      if (dragIndex === null || dragIndex === targetIndex) return;
      const reordered = [...members];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      onChange(reordered);
      setDragIndex(null);
      setDragOverIndex(null);
    },
    [dragIndex, members, onChange]
  );

  return (
    <div className="space-y-3">
      {/* Member rows */}
      <div
        className="space-y-0.5"
        onDragEnd={() => {
          setDragIndex(null);
          setDragOverIndex(null);
        }}
      >
        {members.map((member, index) => (
          <MemberRow
            key={member.id}
            member={member}
            index={index}
            isDragging={dragIndex === index}
            isDragOver={dragOverIndex === index}
            canEdit={canEdit}
            onDragStart={setDragIndex}
            onDragOver={setDragOverIndex}
            onDrop={handleDrop}
            onRoleChange={handleRoleChange}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {/* Permission legend */}
      <div className="flex flex-wrap gap-3 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800">
        {(["owner", "admin", "member"] as MemberRole[]).map((r) => {
          const cfg = ROLE_CONFIG[r];
          return (
            <span
              key={r}
              className={cn(
                "flex items-center gap-1 text-[11px] font-medium",
                cfg.color
              )}
            >
              {cfg.icon} {cfg.label}
              <span className="text-zinc-600 font-normal">
                · {cfg.description}
              </span>
            </span>
          );
        })}
      </div>

      {/* Add member */}
      {canEdit && (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Add by name or email…"
              className="pl-9 bg-zinc-800/60 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-amber-500/30 focus-visible:border-amber-500/50 h-10 text-sm"
            />
          </div>

          {/* Autocomplete dropdown */}
          {showSuggestions && (query.length > 0 || true) && (
            <div className="absolute top-full mt-1.5 left-0 right-0 z-50 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/40 overflow-hidden">
              {suggestions.length === 0 && query.length > 0 ? (
                <div className="px-4 py-3 text-sm text-zinc-500 flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  No match — press Enter to invite &ldquo;{query}&rdquo;
                </div>
              ) : suggestions.length > 0 ? (
                <div className="py-1">
                  {suggestions.slice(0, 6).map((s) => (
                    <button
                      key={s.id}
                      onMouseDown={() => handleAdd(s)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 transition-colors text-left"
                    >
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                        style={{
                          backgroundColor: s.color + "33",
                          color: s.color,
                        }}
                      >
                        {s.initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200">
                          {s.name}
                        </p>
                        <p className="text-xs text-zinc-500">{s.email}</p>
                      </div>
                      <UserPlus className="h-4 w-4 text-zinc-600 ml-auto" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}