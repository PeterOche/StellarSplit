import React, { useState, useMemo } from "react";
import {
  Plus,
  Search,
  Users,
  TrendingUp,
  Clock,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Badge } from "@components/ui/badge";
import { cn, formatCurrency } from "@utils/format";
import { type Group } from "@src/types/split-group";
import { GroupCard } from "@components/SplitGroup/GroupCard";
import { CreateGroupModal } from "@components/SplitGroup/CreateGroupModal";
import { MOCK_GROUPS } from "@components/SplitGroup/data";


type SortKey = "recent" | "name" | "spent";


function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-20 w-20 rounded-3xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center mb-5 text-4xl">
        👥
      </div>
      <h3 className="text-lg font-bold text-zinc-200 mb-2">No groups yet</h3>
      <p className="text-sm text-zinc-500 max-w-xs mb-6">
        Create a group to start splitting expenses with friends, family, or
        housemates.
      </p>
      <Button
        onClick={onCreate}
        className="bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold gap-2"
      >
        <Plus className="h-4 w-4" />
        Create your first group
      </Button>
    </div>
  );
}


function StatPill({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-zinc-800/40 border border-zinc-700/40">
      <div
        className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: (accent ?? "#f59e0b") + "18" }}
      >
        <span style={{ color: accent ?? "#f59e0b" }}>{icon}</span>
      </div>
      <div>
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm font-bold text-zinc-100">{value}</p>
      </div>
    </div>
  );
}


export default function SplitGroup() {
  const [groups, setGroups] = useState<Group[]>(MOCK_GROUPS);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  // Derived
  const recentGroups = useMemo(
    () =>
      [...groups]
        .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime())
        .slice(0, 3),
    [groups]
  );

  const filteredGroups = useMemo(() => {
    let list = [...groups];
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.description?.toLowerCase().includes(q) ||
          g.members.some((m) => m.name.toLowerCase().includes(q))
      );
    }
    if (sort === "recent")
      list.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "spent") list.sort((a, b) => b.totalSpent - a.totalSpent);
    return list;
  }, [groups, query, sort]);

  const totalSpent = useMemo(
    () => groups.reduce((sum, g) => sum + g.totalSpent, 0),
    [groups]
  );
  const totalMembers = useMemo(
    () => new Set(groups.flatMap((g) => g.members.map((m) => m.id))).size,
    [groups]
  );

  // Handlers
  const handleCreated = (g: Group) => setGroups((prev) => [g, ...prev]);
  const handleUpdate = (g: Group) =>
    setGroups((prev) => prev.map((x) => (x.id === g.id ? g : x)));
  const handleDelete = (id: string) =>
    setGroups((prev) => prev.filter((g) => g.id !== id));
  const handleCreateSplit = (g: Group) => {
    // Hook into your split flow — passes the group with its members
    console.log("Creating split for group:", g.name, g.members);
    alert(`Create split for "${g.name}" — connect your split creation flow here.`);
  };

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "recent", label: "Recent" },
    { key: "name", label: "A–Z" },
    { key: "spent", label: "Spent" },
  ];

  return (
    <div className="min-h-screen p-6" >
  

      {/* Subtle background texture */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(ellipse at 20% 0%, rgba(245, 158, 11, 0.04) 0%, transparent 60%),
                            radial-gradient(ellipse at 80% 100%, rgba(59, 130, 246, 0.04) 0%, transparent 60%)`,
        }}
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">💳</span>
              <h1 className="text-2xl font-extrabold text-theme tracking-tight">
                Groups
              </h1>
              {groups.length > 0 && (
                <Badge
                  variant="outline"
                  className="ml-1 text-xs border-zinc-700 text-zinc-400 bg-zinc-800/60"
                >
                  {groups.length}
                </Badge>
              )}
            </div>
            <p className="text-sm text-zinc-500">
              Manage shared expenses with your people
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold gap-1.5 shadow-lg shadow-amber-500/20 transition-all hover:shadow-amber-500/30"
          >
            <Plus className="h-4 w-4" />
            New Group
          </Button>
        </div>

        {/* Summary stats */}
        {groups.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            <StatPill
              icon={<Users className="h-4 w-4" />}
              label="Total groups"
              value={`${groups.length}`}
              accent="#f59e0b"
            />
            <StatPill
              icon={<TrendingUp className="h-4 w-4" />}
              label="Total spent"
              value={formatCurrency(totalSpent)}
              accent="#10b981"
            />
            <StatPill
              icon={<Users className="h-4 w-4" />}
              label="Unique members"
              value={`${totalMembers}`}
              accent="#3b82f6"
            />
          </div>
        )}

        {/* Recent groups */}
        {recentGroups.length > 0 && !query && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                Recently Active
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {recentGroups.map((g) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  isRecent
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onCreateSplit={handleCreateSplit}
                />
              ))}
            </div>
          </section>
        )}

        {/* Search + Sort */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search groups, members…"
              className="pl-9 pr-9 bg-zinc-800/60 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-500/30 focus-visible:border-amber-500/50 h-10"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 bg-zinc-800/60 border border-zinc-700 rounded-lg p-1">
            <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-500 ml-1.5 mr-0.5" />
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.key}
                onClick={() => setSort(o.key)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  sort === o.key
                    ? "bg-amber-500 text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* All groups grid */}
        {filteredGroups.length === 0 && query ? (
          <div className="text-center py-16 text-zinc-500">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No groups match &ldquo;{query}&rdquo;</p>
            <button
              onClick={() => setQuery("")}
              className="text-amber-500 text-sm mt-1 hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : filteredGroups.length === 0 ? (
          <EmptyState onCreate={() => setCreateOpen(true)} />
        ) : (
          <div>
            {!query && (
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  All Groups
                </h2>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGroups.map((g) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onCreateSplit={handleCreateSplit}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      <CreateGroupModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}