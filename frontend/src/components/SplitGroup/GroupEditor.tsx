import React, { useState } from "react";
import {
  Settings,
  Users,
  AlertTriangle,
  Save,
  X,
  GitFork,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { Separator } from "@components/ui/separator";
import { cn } from "@utils/format";
import { type Group, type Member } from "@src/types/split-group";
import { MemberList } from "./MemberList";
import { GROUP_EMOJIS, GROUP_COLORS } from "./data";

type Tab = "settings" | "members" | "danger";

interface GroupEditorProps {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: Group) => void;
  onDelete: (id: string) => void;
  onCreateSplit: (group: Group) => void;
}


function TabNav({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "settings", label: "Settings", icon: <Settings className="h-3.5 w-3.5" /> },
    { id: "members", label: "Members", icon: <Users className="h-3.5 w-3.5" /> },
    { id: "danger", label: "Danger", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex border-b border-zinc-800">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-all relative border-b-2 -mb-px",
            active === tab.id
              ? tab.id === "danger"
                ? "text-red-400 border-red-500"
                : "text-amber-400 border-amber-500"
              : "text-zinc-500 border-transparent hover:text-zinc-300"
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function SettingsTab({
  name,
  description,
  emoji,
  accentColor,
  onNameChange,
  onDescriptionChange,
  onEmojiChange,
  onColorChange,
}: {
  name: string;
  description: string;
  emoji: string;
  accentColor: string;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onEmojiChange: (v: string) => void;
  onColorChange: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Preview badge */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/40">
        <div
          className="h-12 w-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ backgroundColor: accentColor + "22", border: `1px solid ${accentColor}44` }}
        >
          {emoji}
        </div>
        <div>
          <p className="font-semibold text-zinc-100">{name || "Group Name"}</p>
          <p className="text-xs text-zinc-500">
            {description || "No description"}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
          Name
        </Label>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="bg-zinc-800/60 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-500/30 focus-visible:border-amber-500/50 h-10"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
          Description
        </Label>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={2}
          className="bg-zinc-800/60 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-500/30 focus-visible:border-amber-500/50 resize-none text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
          Icon
        </Label>
        <div className="grid grid-cols-8 gap-1.5">
          {GROUP_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => onEmojiChange(e)}
              className={cn(
                "h-9 rounded-lg text-lg flex items-center justify-center transition-all",
                "hover:bg-zinc-700 hover:scale-110",
                emoji === e
                  ? "bg-zinc-700 ring-2 ring-amber-500/50 scale-110"
                  : "bg-zinc-800/40"
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
          Color
        </Label>
        <div className="flex gap-2 flex-wrap">
          {GROUP_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onColorChange(c)}
              className={cn(
                "h-7 w-7 rounded-full transition-all ring-2 ring-offset-2 ring-offset-zinc-900",
                accentColor === c
                  ? "scale-110 ring-white/50"
                  : "ring-transparent hover:scale-105"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}


function DangerTab({
  group,
  onCreateSplit,
  onDelete,
}: {
  group: Group;
  onCreateSplit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  return (
    <div className="space-y-4">
      {/* Create split */}
      <div className="rounded-xl border border-zinc-700/50 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <GitFork className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-200">Create Split</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Start a new expense from this group's members
            </p>
          </div>
        </div>
        <Button
          onClick={onCreateSplit}
          className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50 bg-transparent"
        >
          <GitFork className="h-3.5 w-3.5 mr-1.5" />
          Create Split from Group
        </Button>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Delete group */}
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
            <Trash2 className="h-4 w-4 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-400">Delete Group</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Permanently removes the group and all its expense history.
              Cannot be undone.
            </p>
          </div>
        </div>

        {!confirmDelete ? (
          <Button
            onClick={() => setConfirmDelete(true)}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 bg-transparent"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete this group
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-zinc-400">
              Type{" "}
              <code className="text-red-400 bg-red-500/10 px-1 rounded">
                {group.name}
              </code>{" "}
              to confirm:
            </p>
            <Input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={group.name}
              className="bg-zinc-900 border-red-500/30 text-zinc-100 focus-visible:ring-red-500/30 h-9 text-sm"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setConfirmDelete(false);
                  setDeleteInput("");
                }}
                className="text-zinc-500 hover:text-zinc-300 flex-1"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
              <Button
                onClick={onDelete}
                disabled={deleteInput !== group.name}
                className="bg-red-600 hover:bg-red-500 text-white flex-1 disabled:opacity-30"
              >
                Permanently Delete
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


export function GroupEditor({
  group,
  open,
  onOpenChange,
  onSave,
  onDelete,
  onCreateSplit,
}: GroupEditorProps) {
  const [tab, setTab] = useState<Tab>("settings");
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [emoji, setEmoji] = useState(group.emoji);
  const [accentColor, setAccentColor] = useState(group.accentColor);
  const [members, setMembers] = useState<Member[]>(group.members);

  const isDirty =
    name !== group.name ||
    description !== (group.description ?? "") ||
    emoji !== group.emoji ||
    accentColor !== group.accentColor ||
    JSON.stringify(members) !== JSON.stringify(group.members);

  const handleSave = () => {
    onSave({ ...group, name, description: description || undefined, emoji, accentColor, members });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 p-0 max-w-md overflow-hidden shadow-2xl shadow-black/60">
        <div
          className="h-1 w-full"
          style={{
            background: `linear-gradient(90deg, ${accentColor}, ${accentColor}44)`,
          }}
        />

        <div className="px-6 pt-5">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-xl flex items-center justify-center text-lg"
                  style={{ backgroundColor: accentColor + "22" }}
                >
                  {emoji}
                </div>
                <DialogTitle className="text-base font-bold text-zinc-100 tracking-tight">
                  {group.name}
                </DialogTitle>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </DialogHeader>
          <div className="mt-4">
            <TabNav active={tab} onChange={setTab} />
          </div>
        </div>

        <div className="px-6 py-5 min-h-[300px] max-h-[60vh] overflow-y-auto">
          {tab === "settings" && (
            <SettingsTab
              name={name}
              description={description}
              emoji={emoji}
              accentColor={accentColor}
              onNameChange={setName}
              onDescriptionChange={setDescription}
              onEmojiChange={setEmoji}
              onColorChange={setAccentColor}
            />
          )}
          {tab === "members" && (
            <MemberList members={members} onChange={setMembers} />
          )}
          {tab === "danger" && (
            <DangerTab
              group={group}
              onCreateSplit={() => {
                onCreateSplit(group);
                onOpenChange(false);
              }}
              onDelete={() => {
                onDelete(group.id);
                onOpenChange(false);
              }}
            />
          )}
        </div>

        {tab !== "danger" && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/60">
            <span className="text-xs text-zinc-600">
              {isDirty ? "Unsaved changes" : "No changes"}
            </span>
            <Button
              onClick={handleSave}
              disabled={!isDirty || !name.trim()}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold gap-2 disabled:opacity-30 transition-all"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}