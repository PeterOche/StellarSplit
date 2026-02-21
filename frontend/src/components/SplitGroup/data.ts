import type { Group, Member } from "@src/types/split-group";

export const MEMBER_COLORS = [
  "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6",
  "#ec4899", "#ef4444", "#06b6d4", "#84cc16",
];

export const GROUP_EMOJIS = [
  "🏠", "✈️", "🎉", "🍕", "🎮", "🏋️", "📚", "🎵",
  "🌴", "⚽", "🎨", "🚗", "🐾", "🌿", "💼", "🎭",
];

export const GROUP_COLORS = [
  "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6",
  "#ec4899", "#ef4444", "#06b6d4", "#f97316",
];

export const SUGGESTED_MEMBERS: Member[] = [
  { id: "s1", name: "Alex Rivera", email: "alex@example.com", initials: "AR", color: "#f59e0b", role: "member" },
  { id: "s2", name: "Jordan Kim", email: "jordan@example.com", initials: "JK", color: "#10b981", role: "member" },
  { id: "s3", name: "Sam Chen", email: "sam@example.com", initials: "SC", color: "#3b82f6", role: "member" },
  { id: "s4", name: "Maya Patel", email: "maya@example.com", initials: "MP", color: "#8b5cf6", role: "member" },
  { id: "s5", name: "Chris Taylor", email: "chris@example.com", initials: "CT", color: "#ec4899", role: "member" },
  { id: "s6", name: "Drew Johnson", email: "drew@example.com", initials: "DJ", color: "#06b6d4", role: "member" },
  { id: "s7", name: "Riley Morgan", email: "riley@example.com", initials: "RM", color: "#84cc16", role: "member" },
  { id: "s8", name: "Casey Walsh", email: "casey@example.com", initials: "CW", color: "#f97316", role: "member" },
];

export const MOCK_GROUPS: Group[] = [
  {
    id: "g1",
    name: "Barcelona Trip",
    description: "Summer 2024 — flights, hotels & tapas",
    emoji: "✈️",
    accentColor: "#3b82f6",
    members: [
      { id: "me", name: "You", email: "you@example.com", initials: "YO", color: "#f59e0b", role: "owner" },
      { id: "s1", name: "Alex Rivera", email: "alex@example.com", initials: "AR", color: "#f59e0b", role: "admin" },
      { id: "s2", name: "Jordan Kim", email: "jordan@example.com", initials: "JK", color: "#10b981", role: "member" },
      { id: "s3", name: "Sam Chen", email: "sam@example.com", initials: "SC", color: "#3b82f6", role: "member" },
    ],
    totalSpent: 3240,
    currency: "USD",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
    lastActivityAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: "g2",
    name: "Flat 4B",
    description: "Monthly bills & groceries",
    emoji: "🏠",
    accentColor: "#10b981",
    members: [
      { id: "me", name: "You", email: "you@example.com", initials: "YO", color: "#f59e0b", role: "owner" },
      { id: "s4", name: "Maya Patel", email: "maya@example.com", initials: "MP", color: "#8b5cf6", role: "member" },
      { id: "s5", name: "Chris Taylor", email: "chris@example.com", initials: "CT", color: "#ec4899", role: "member" },
    ],
    totalSpent: 8750,
    currency: "USD",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120),
    lastActivityAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
  {
    id: "g3",
    name: "Friday Dinner Club",
    description: "Weekly restaurant adventures",
    emoji: "🍕",
    accentColor: "#f97316",
    members: [
      { id: "me", name: "You", email: "you@example.com", initials: "YO", color: "#f59e0b", role: "owner" },
      { id: "s6", name: "Drew Johnson", email: "drew@example.com", initials: "DJ", color: "#06b6d4", role: "admin" },
      { id: "s7", name: "Riley Morgan", email: "riley@example.com", initials: "RM", color: "#84cc16", role: "member" },
      { id: "s8", name: "Casey Walsh", email: "casey@example.com", initials: "CW", color: "#f97316", role: "member" },
      { id: "s2", name: "Jordan Kim", email: "jordan@example.com", initials: "JK", color: "#10b981", role: "member" },
    ],
    totalSpent: 1890,
    currency: "USD",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
    lastActivityAt: new Date(Date.now() - 1000 * 60 * 30),
  },
];
