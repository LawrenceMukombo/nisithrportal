import { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, X, UserX, Mail, FileText, AlertTriangle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, getGetNotificationsQueryKey } from "@workspace/api-client-react";
import type { Notification } from "@workspace/api-client-react";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface NotificationTypeConfig {
  icon: LucideIcon;
  iconClass: string;
  wrapperClass: string;
}

const TYPE_CONFIG: Record<string, NotificationTypeConfig> = {
  new_application: {
    icon: Mail,
    iconClass: "text-blue-500",
    wrapperClass: "bg-blue-100 dark:bg-blue-900/40",
  },
  application_withdrawn: {
    icon: UserX,
    iconClass: "text-slate-500",
    wrapperClass: "bg-slate-100 dark:bg-slate-800/60",
  },
  application_status: {
    icon: FileText,
    iconClass: "text-violet-500",
    wrapperClass: "bg-violet-100 dark:bg-violet-900/40",
  },
  contract_expiry: {
    icon: AlertTriangle,
    iconClass: "text-amber-500",
    wrapperClass: "bg-amber-100 dark:bg-amber-900/40",
  },
  integration_alert: {
    icon: AlertTriangle,
    iconClass: "text-red-600",
    wrapperClass: "bg-red-100 dark:bg-red-900/40",
  },
};

const DEFAULT_CONFIG: NotificationTypeConfig = {
  icon: Bell,
  iconClass: "text-muted-foreground",
  wrapperClass: "bg-muted",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all recent notifications (read + unread) so the dropdown shows history.
  // Unread count is computed client-side; unread items are visually highlighted.
  const { data: notifications = [], refetch } = useGetNotifications(
    { all: true },
    { query: { queryKey: getGetNotificationsQueryKey({ all: true }), refetchInterval: 30000 } }
  );

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = notifications.filter((n: Notification) => !n.read).length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleMarkRead = async (id: number) => {
    await markRead.mutateAsync({ id });
    void refetch();
  };

  const handleMarkAllRead = async () => {
    await markAllRead.mutateAsync();
    void refetch();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        data-testid="button-notification-bell"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1 leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 max-h-[480px] flex flex-col rounded-lg border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <h3 className="font-semibold text-sm text-foreground">
              Notifications {unreadCount > 0 && <span className="text-muted-foreground font-normal">({unreadCount} unread)</span>}
            </h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  data-testid="button-mark-all-read"
                  onClick={handleMarkAllRead}
                  disabled={markAllRead.isPending}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 px-2 py-1 rounded hover:bg-accent transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((notif: Notification) => (
                  <li
                    key={notif.id}
                    data-testid={`notification-item-${notif.id}`}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors",
                      !notif.read && "bg-primary/5",
                      notif.type === "application_withdrawn" && "border-l-2 border-orange-400 bg-orange-50/60 dark:bg-orange-950/20",
                      notif.type === "integration_alert" && "border-l-2 border-red-500 bg-red-50/60 dark:bg-red-950/20"
                    )}
                  >
                    {(() => {
                      const cfg = TYPE_CONFIG[notif.type] ?? DEFAULT_CONFIG;
                      const Icon = cfg.icon;
                      return (
                        <span className={cn("shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-full", cfg.wrapperClass)} aria-hidden>
                          <Icon className={cn("h-3.5 w-3.5", cfg.iconClass)} />
                        </span>
                      );
                    })()}
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs leading-relaxed text-foreground", !notif.read && "font-medium")}>
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {timeAgo(notif.createdAt)}
                      </p>
                    </div>
                    {!notif.read && (
                      <button
                        onClick={() => handleMarkRead(notif.id)}
                        disabled={markRead.isPending}
                        className="shrink-0 p-1 rounded text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
                        title="Mark as read"
                        data-testid={`button-mark-read-${notif.id}`}
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
