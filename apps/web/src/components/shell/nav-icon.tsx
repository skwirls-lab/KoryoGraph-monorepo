import {
  Award, BarChart3, BookOpen, Bus, Calendar, CheckSquare, ClipboardList, CreditCard, Home, Inbox, LayoutDashboard, Megaphone,
  MessageCircle, PartyPopper, Rocket, Settings, ShoppingBag, Sparkles, TrendingUp, Users, Wallet, type LucideIcon,
} from "lucide-react";
import type { IconKey } from "@/lib/nav";

const MAP: Record<IconKey, LucideIcon> = {
  dashboard: LayoutDashboard, rocket: Rocket, users: Users, calendar: Calendar, award: Award, book: BookOpen,
  "credit-card": CreditCard, "shopping-bag": ShoppingBag, megaphone: Megaphone, party: PartyPopper, inbox: Inbox,
  chart: BarChart3, settings: Settings, "check-square": CheckSquare, home: Home, message: MessageCircle,
  "trending-up": TrendingUp, wallet: Wallet, sparkles: Sparkles, clipboard: ClipboardList, bus: Bus,
};

export function NavIcon({ icon, className }: { icon: IconKey; className?: string }) {
  const Icon = MAP[icon];
  return <Icon aria-hidden className={className} />;
}
