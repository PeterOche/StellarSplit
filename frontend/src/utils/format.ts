import i18n from '../i18n/config';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat(i18n.language, {
        style: 'currency',
        currency: currency,
    }).format(amount);
};

export const formatDate = (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium',
    }).format(d);
};

export const formatNumber = (num: number) => {
    return new Intl.NumberFormat(i18n.language).format(num);
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}