import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, Users, MessageSquare, Send, Paperclip, Smile,
  Check, CheckCheck, Phone, Video, MoreVertical, FileText, Image as ImageIcon,
  Mic, MicOff, X, ArrowLeft, Shield, Download, Trash2, Reply, Copy,
  CheckCircle2, Sparkles, User, RefreshCw
} from "lucide-react";
import { AppLayout } from "@/layouts/app-layout";
import { useAuth } from "@/contexts/use-auth";
import { getToken } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Participant {
  userId: number;
  name: string;
  email: string;
  role: string;
  lastReadAt?: string;
  lastActiveAt?: string;
}

interface Conversation {
  id: number;
  type: "direct" | "group";
  title: string;
  avatar?: string | null;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCount: number;
  muted: boolean;
  participants: Participant[];
  otherUser?: {
    id: number;
    name: string;
    email: string;
    lastActiveAt?: string;
  } | null;
}

interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  senderEmail: string;
  messageType: "text" | "image" | "document" | "voice" | "system";
  content: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  replyToId?: number | null;
  isMine: boolean;
  isRead: boolean;
  createdAt: string;
}

interface DirectoryUser {
  id: number;
  name: string;
  email: string;
  roleId: number;
  roleName?: string;
  lastActiveAt?: string;
}

function formatChatTime(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatMessageDateSeparator(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MessagesPage() {
  const [, params] = useRoute("/messages/:id?");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const selectedConversationId = params?.id ? parseInt(params.id, 10) : null;

  // Local states
  const [filterTab, setFilterTab] = useState<"all" | "direct" | "group" | "unread">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedGroupUsers, setSelectedGroupUsers] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const authHeader: Record<string, string> = useMemo(() => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  // 1. Fetch Conversations
  const { data: conversations = [], refetch: refetchConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/messages/conversations"],
    queryFn: async () => {
      const res = await fetch("/api/messages/conversations", { headers: authHeader });
      if (!res.ok) throw new Error("Failed to load conversations");
      return res.json();
    },
    refetchInterval: 6000,
  });

  // 2. Fetch Messages for Selected Conversation
  const { data: messages = [], refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: ["/api/messages/conversations", selectedConversationId, "messages"],
    queryFn: async () => {
      if (!selectedConversationId) return [];
      const res = await fetch(`/api/messages/conversations/${selectedConversationId}/messages`, { headers: authHeader });
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    enabled: !!selectedConversationId,
    refetchInterval: 4000,
  });

  // 3. Fetch Directory Users for New Chat
  const { data: directoryUsers = [] } = useQuery<DirectoryUser[]>({
    queryKey: ["/api/messages/users"],
    queryFn: async () => {
      const res = await fetch("/api/messages/users", { headers: authHeader });
      if (!res.ok) throw new Error("Failed to load directory");
      return res.json();
    },
    enabled: newChatModalOpen,
  });

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark conversation as read when selected
  useEffect(() => {
    if (selectedConversationId) {
      void fetch(`/api/messages/conversations/${selectedConversationId}/read`, {
        method: "PATCH",
        headers: authHeader,
      }).then(() => {
        void queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-total"] });
      });
    }
  }, [selectedConversationId, authHeader, queryClient]);

  // Voice recording timer simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Active Conversation Info
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedConversationId);
  }, [conversations, selectedConversationId]);

  // Filtered Conversations List
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const matchesSearch =
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.lastMessagePreview && c.lastMessagePreview.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterTab === "direct") return c.type === "direct";
      if (filterTab === "group") return c.type === "group";
      if (filterTab === "unread") return c.unreadCount > 0;
      return true;
    });
  }, [conversations, searchQuery, filterTab]);

  // Send Message Mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      content,
      messageType = "text",
      attachmentUrl,
      attachmentName,
      attachmentSize,
      replyToId,
    }: {
      content: string;
      messageType?: string;
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentSize?: number;
      replyToId?: number;
    }) => {
      if (!selectedConversationId) return;
      const res = await fetch(`/api/messages/conversations/${selectedConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          content,
          messageType,
          attachmentUrl,
          attachmentName,
          attachmentSize,
          replyToId,
        }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      setMessageInput("");
      setReplyingTo(null);
      void refetchMessages();
      void refetchConversations();
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConversationId) return;
    sendMessageMutation.mutate({
      content: messageInput.trim(),
      messageType: "text",
      replyToId: replyingTo ? replyingTo.id : undefined,
    });
  };

  // Start Direct Chat
  const handleStartDirectChat = async (targetUserId: number) => {
    try {
      const res = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ type: "direct", targetUserId }),
      });
      const data = await res.json();
      if (data.id) {
        setNewChatModalOpen(false);
        setLocation(`/messages/${data.id}`);
        void refetchConversations();
      }
    } catch {
      toast({ title: "Error starting chat", variant: "destructive" });
    }
  };

  // Create Group Chat
  const handleCreateGroup = async () => {
    if (!groupTitle.trim() || selectedGroupUsers.length === 0) {
      toast({ title: "Please provide a group title and select at least one colleague", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          type: "group",
          title: groupTitle.trim(),
          participantUserIds: selectedGroupUsers,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setNewChatModalOpen(false);
        setGroupTitle("");
        setSelectedGroupUsers([]);
        setLocation(`/messages/${data.id}`);
        void refetchConversations();
        toast({ title: "Group chat created" });
      }
    } catch {
      toast({ title: "Failed to create group", variant: "destructive" });
    }
  };

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversationId) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/messages/upload", {
        method: "POST",
        headers: authHeader,
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        const isImg = file.type.startsWith("image/");
        sendMessageMutation.mutate({
          content: isImg ? "Photo" : file.name,
          messageType: isImg ? "image" : "document",
          attachmentUrl: data.url,
          attachmentName: file.name,
          attachmentSize: file.size,
        });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Send Simulated Voice Note
  const handleSendVoiceNote = () => {
    if (!selectedConversationId) return;
    setIsRecording(false);
    sendMessageMutation.mutate({
      content: `Voice Message (${recordingSeconds}s)`,
      messageType: "voice",
      attachmentSize: recordingSeconds * 12000,
    });
  };

  // Group messages by Date
  const groupedMessages = useMemo(() => {
    const groups: { dateLabel: string; items: Message[] }[] = [];
    let currentDate = "";
    let currentGroup: Message[] = [];

    messages.forEach((m) => {
      const d = formatMessageDateSeparator(m.createdAt);
      if (d !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ dateLabel: currentDate, items: currentGroup });
        }
        currentDate = d;
        currentGroup = [m];
      } else {
        currentGroup.push(m);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ dateLabel: currentDate, items: currentGroup });
    }

    return groups;
  }, [messages]);

  return (
    <AppLayout>
      <div className="h-[calc(100vh-3.5rem)] flex flex-col md:flex-row bg-background overflow-hidden">
        {/* ═══════════════════════════════════════════════════════════════
            LEFT PANEL: CONVERSATIONS SIDEBAR (WhatsApp Web Style)
        ═══════════════════════════════════════════════════════════════ */}
        <div
          className={`w-full md:w-[380px] lg:w-[420px] border-r border-border flex flex-col bg-card shrink-0 ${
            selectedConversationId ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Header */}
          <div className="h-16 px-4 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-border">
                <AvatarFallback className="bg-emerald-600/10 text-emerald-700 font-bold text-sm">
                  {user?.name?.slice(0, 2).toUpperCase() || "ME"}
                </AvatarFallback>
              </Avatar>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-foreground">Secure Messenger</p>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span> Online
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                      onClick={() => setNewChatModalOpen(true)}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>New Chat / Group</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => void refetchConversations()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="p-3 space-y-2 border-b border-border/50 bg-background/50">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search or start a new chat"
                className="pl-9 h-9 bg-muted/60 border-none text-xs rounded-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {(["all", "unread", "direct", "group"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterTab(tab)}
                  className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                    filterTab === tab
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  }`}
                >
                  {tab === "all" ? "All Chats" : tab}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/30">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground space-y-2">
                <MessageSquare className="h-8 w-8 mx-auto opacity-40 text-emerald-600" />
                <p className="text-sm font-medium">No conversations found</p>
                <p className="text-xs">Click the "+" icon above to start communicating with NISIT staff.</p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === selectedConversationId;
                return (
                  <div
                    key={conv.id}
                    onClick={() => setLocation(`/messages/${conv.id}`)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-emerald-500/10 border-l-4 border-emerald-600"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-12 w-12 border border-border/60">
                        {conv.avatar ? (
                          <AvatarImage src={conv.avatar} />
                        ) : (
                          <AvatarFallback className="bg-emerald-600/10 text-emerald-700 font-semibold text-sm">
                            {conv.type === "group" ? (
                              <Users className="h-5 w-5" />
                            ) : (
                              conv.title.slice(0, 2).toUpperCase()
                            )}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      {conv.type === "direct" && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background"></span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm font-semibold text-foreground truncate">{conv.title}</p>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {formatChatTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <p className="truncate pr-2">
                          {conv.lastMessagePreview || "Start chatting..."}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            RIGHT PANEL: ACTIVE CHAT VIEW / WHATSAPP EXPERIENCE
        ═══════════════════════════════════════════════════════════════ */}
        {selectedConversationId && activeConversation ? (
          <div className="flex-1 flex flex-col h-full bg-[#efeae2] dark:bg-[#0b141a] relative overflow-hidden">
            {/* Top Chat Header */}
            <div className="h-16 px-4 border-b border-border bg-card flex items-center justify-between shrink-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8 -ml-2 text-muted-foreground"
                  onClick={() => setLocation("/messages")}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>

                <Avatar className="h-10 w-10 border border-border">
                  <AvatarFallback className="bg-emerald-600/10 text-emerald-700 font-bold text-sm">
                    {activeConversation.type === "group" ? (
                      <Users className="h-5 w-5" />
                    ) : (
                      activeConversation.title.slice(0, 2).toUpperCase()
                    )}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {activeConversation.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                    {activeConversation.type === "group" ? (
                      `${activeConversation.participants.length} participants`
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        Active in NISIT network
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 text-muted-foreground">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                        <Video className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Internal Video Call</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                        <Phone className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Voice Call</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="w-[1px] h-6 bg-border mx-1"></div>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Security Shield Banner */}
              <div className="max-w-md mx-auto my-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center text-[11px] text-amber-800 dark:text-amber-200 flex items-center justify-center gap-2">
                <Shield className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>Messages in this NISIT channel are encrypted and restricted to authorized personnel.</span>
              </div>

              {groupedMessages.map((group, groupIdx) => (
                <div key={groupIdx} className="space-y-3">
                  {/* Date Separator Pill */}
                  <div className="flex justify-center">
                    <span className="px-3 py-1 rounded-full bg-card/80 dark:bg-card/60 backdrop-blur-sm border border-border/50 text-[11px] font-medium text-muted-foreground shadow-sm">
                      {group.dateLabel}
                    </span>
                  </div>

                  {group.items.map((msg) => {
                    const isMe = msg.isMine;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col group ${isMe ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`relative max-w-[85%] md:max-w-[70%] lg:max-w-[60%] rounded-2xl px-3.5 py-2 shadow-sm text-sm transition-all ${
                            isMe
                              ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-foreground rounded-tr-none"
                              : "bg-card text-foreground rounded-tl-none border border-border/40"
                          }`}
                        >
                          {/* Sender name for group chats */}
                          {!isMe && activeConversation.type === "group" && (
                            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                              {msg.senderName}
                            </p>
                          )}

                          {/* Quoted Reply */}
                          {msg.replyToId && (
                            <div className="mb-2 p-2 rounded bg-black/5 dark:bg-white/10 border-l-4 border-emerald-600 text-xs">
                              <p className="font-semibold text-emerald-800 dark:text-emerald-300">Replying to message</p>
                              <p className="text-muted-foreground truncate">Previous message</p>
                            </div>
                          )}

                          {/* Message Body by Type */}
                          {msg.messageType === "image" && msg.attachmentUrl && (
                            <div className="mb-1.5 rounded-lg overflow-hidden border border-border/40">
                              <img
                                src={msg.attachmentUrl}
                                alt="Shared image"
                                className="max-h-64 w-full object-cover cursor-pointer hover:opacity-95"
                                onClick={() => window.open(msg.attachmentUrl!, "_blank")}
                              />
                            </div>
                          )}

                          {msg.messageType === "document" && msg.attachmentUrl && (
                            <div className="mb-1.5 flex items-center gap-3 p-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-border/50">
                              <FileText className="h-8 w-8 text-emerald-600 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate">{msg.attachmentName || "Document"}</p>
                                <p className="text-[10px] text-muted-foreground">{formatFileSize(msg.attachmentSize)}</p>
                              </div>
                              <a
                                href={msg.attachmentUrl}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                              >
                                <Download className="h-4 w-4 text-muted-foreground" />
                              </a>
                            </div>
                          )}

                          {msg.messageType === "voice" && (
                            <div className="flex items-center gap-3 py-1 min-w-[200px]">
                              <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                                <Mic className="h-4 w-4" />
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="h-1.5 w-full bg-muted-foreground/30 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-600 w-2/3"></div>
                                </div>
                                <p className="text-[10px] text-muted-foreground">Voice note • {msg.content}</p>
                              </div>
                            </div>
                          )}

                          {/* Text content */}
                          {msg.content && msg.messageType !== "voice" && (
                            <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                          )}

                          {/* Timestamp and Delivery Ticks */}
                          <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-muted-foreground">
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {isMe && (
                              <span>
                                {msg.isRead ? (
                                  <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
                                ) : (
                                  <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quick hover actions */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-muted-foreground px-2 pt-0.5 transition-opacity">
                          <button
                            onClick={() => setReplyingTo(msg)}
                            className="p-1 hover:text-foreground rounded"
                            title="Reply"
                          >
                            <Reply className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              void navigator.clipboard.writeText(msg.content);
                              toast({ title: "Copied to clipboard" });
                            }}
                            className="p-1 hover:text-foreground rounded"
                            title="Copy"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Replying Banner */}
            {replyingTo && (
              <div className="px-4 py-2 bg-card border-t border-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 border-l-4 border-emerald-600 pl-2">
                  <div>
                    <span className="font-semibold text-emerald-700">Replying to {replyingTo.senderName}:</span>
                    <p className="text-muted-foreground truncate max-w-sm">{replyingTo.content}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyingTo(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Bottom Input Area */}
            <div className="p-3 bg-card border-t border-border shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
              />

              {isRecording ? (
                <div className="flex items-center justify-between px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/30 animate-pulse">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                    <span className="h-3 w-3 rounded-full bg-red-500 inline-block animate-ping"></span>
                    Recording Voice Note: {recordingSeconds}s
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsRecording(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full" onClick={handleSendVoiceNote}>
                      Send Voice Note
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-muted-foreground hover:text-foreground shrink-0 rounded-full"
                          onClick={() => setMessageInput((prev) => `${prev} 👍`)}
                        >
                          <Smile className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Quick Emoji</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={uploading}
                          className="h-10 w-10 text-muted-foreground hover:text-foreground shrink-0 rounded-full"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Paperclip className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Attach Document or Image</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <div className="flex-1 relative">
                    <Input
                      placeholder="Type a message..."
                      className="bg-muted/50 border-none rounded-full h-10 px-4 text-sm"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                  </div>

                  {messageInput.trim() ? (
                    <Button
                      size="icon"
                      className="h-10 w-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-md"
                      onClick={handleSendMessage}
                      disabled={sendMessageMutation.isPending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-muted-foreground hover:text-foreground shrink-0 rounded-full"
                      onClick={() => setIsRecording(true)}
                    >
                      <Mic className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Empty / Welcome State (WhatsApp Web Style) */
          <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 bg-[#f0f2f5] dark:bg-[#111b21] text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-emerald-600/10 flex items-center justify-center border-2 border-emerald-600/20 shadow-sm">
              <MessageSquare className="h-10 w-10 text-emerald-600" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h2 className="text-xl font-bold text-foreground">PNG NISIT Secure Messenger</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Connect instantly with fellow officers, technical staff, and departmental groups across Papua New Guinea National Institute of Standards & Industrial Technology.
              </p>
            </div>
            <div className="pt-2">
              <Button
                onClick={() => setNewChatModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 rounded-full shadow-md"
              >
                <Plus className="h-4 w-4" /> Start New Conversation
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-6">
              <Shield className="h-3.5 w-3.5 text-emerald-600" /> End-to-end encrypted for internal NISIT personnel
            </p>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          NEW CHAT / GROUP MODAL
      ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={newChatModalOpen} onOpenChange={setNewChatModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-emerald-600" /> New Conversation
            </DialogTitle>
            <DialogDescription>
              Select a colleague for direct messaging or create a collaborative team group.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="direct" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-3">
              <TabsTrigger value="direct">Direct Message</TabsTrigger>
              <TabsTrigger value="group">New Group</TabsTrigger>
            </TabsList>

            {/* DIRECT CHAT TAB */}
            <TabsContent value="direct" className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search colleague by name or email..."
                  className="pl-9 h-9 text-xs"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                />
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-border/40 rounded-md border border-border">
                {directoryUsers
                  .filter(
                    (u) =>
                      u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                      u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                  )
                  .map((u) => (
                    <div
                      key={u.id}
                      onClick={() => handleStartDirectChat(u.id)}
                      className="flex items-center justify-between p-3 hover:bg-muted/60 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-emerald-600/10 text-emerald-700 font-bold text-xs">
                            {u.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {u.roleName || "Staff"}
                      </Badge>
                    </div>
                  ))}
              </div>
            </TabsContent>

            {/* GROUP CHAT TAB */}
            <TabsContent value="group" className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Group Title *</label>
                <Input
                  placeholder="e.g. Standards Review Committee"
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Select Members ({selectedGroupUsers.length} selected)
                </label>
                <div className="max-h-48 overflow-y-auto divide-y divide-border/40 rounded-md border border-border">
                  {directoryUsers.map((u) => {
                    const isSelected = selectedGroupUsers.includes(u.id);
                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          setSelectedGroupUsers((prev) =>
                            isSelected ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                          );
                        }}
                        className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors ${
                          isSelected ? "bg-emerald-500/10" : "hover:bg-muted/60"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-emerald-600/10 text-emerald-700 font-bold text-xs">
                              {u.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-left">
                            <p className="text-xs font-semibold">{u.name}</p>
                            <p className="text-[10px] text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleCreateGroup}
              >
                Create Group Chat
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
