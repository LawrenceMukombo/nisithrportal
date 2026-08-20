import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, Users, MessageSquare, Send, Paperclip, Smile,
  Check, CheckCheck, Phone, PhoneOff, Video, VideoOff, MoreVertical, FileText, Image as ImageIcon,
  Mic, MicOff, X, ArrowLeft, Shield, Download, Trash2, Reply, Copy,
  CheckCircle2, Sparkles, User, RefreshCw, ChevronUp, ChevronDown, ScreenShare,
  Volume2, VolumeX, BarChart2, UserCheck, Flame, Heart, ThumbsUp, Laugh,
  Maximize2, Minimize2, Share2, CornerDownRight
} from "lucide-react";
import { AppLayout } from "@/layouts/app-layout";
import { useAuth } from "@/contexts/use-auth";
import { getToken } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ═══════════════════════════════════════════════════════════════
// HUMAN READABLE ROLE & PERMISSION FORMATTER
// ═══════════════════════════════════════════════════════════════
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  admin: "System Administrator",
  hr_officer: "HR Officer",
  hiring_manager: "Hiring Manager",
  executive: "Executive Director",
  applicant: "Candidate Applicant",
};

export function formatRoleName(role?: string | null): string {
  if (!role) return "Staff Member";
  return ROLE_DISPLAY_NAMES[role] ?? role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// ═══════════════════════════════════════════════════════════════
// WHATSAPP EMOJI LIBRARY (CATEGORIZED & SEARCHABLE)
// ═══════════════════════════════════════════════════════════════
interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "smileys",
    name: "Smileys & Emotion",
    icon: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃",
      "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😋",
      "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐",
      "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌",
      "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧",
      "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓", "🧐",
      "😕", "😟", "🙁", "😮", "😯", "😲", "😳", "🥺", "😦", "😧",
      "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓"
    ],
  },
  {
    id: "people",
    name: "People & Gestures",
    icon: "👋",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤏", "✌️", "🤞", "🤟",
      "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎",
      "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏",
      "✍️", "💅", "🤳", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻",
      "👃", "🧠", "👀", "👁️", "🧑‍💼", "👩‍💼", "👨‍💼", "🧑‍💻", "👩‍💻", "👨‍💻",
      "🧑‍🔬", "👩‍🔬", "👨‍🔬", "🧑‍🏫", "👩‍🏫", "👨‍🏫", "🙋‍♂️", "🙋‍♀️", "💁‍♂️", "💁‍♀️"
    ],
  },
  {
    id: "work",
    name: "Work & Objects",
    icon: "💼",
    emojis: [
      "💼", "📁", "📂", "📄", "📃", "📑", "📊", "📈", "📉", "📜",
      "📋", "📅", "📆", "📇", "📝", "✏️", "✒️", "🖋️", "🖊️", "📌",
      "📍", "📎", "🖇️", "📐", "📏", "✂️", "🔒", "🔓", "🔏", "🔐",
      "🔑", "🗝️", "🔨", "🔧", "⚙️", "⚖️", "📱", "📲", "☎️", "📞",
      "💻", "🖥️", "🖨️", "⌨️", "🖱️", "💡", "🔦", "✉️", "📧", "📨",
      "📩", "📤", "📥", "📦", "🏷️", "📫", "📬", "📭", "📮", "🏷️"
    ],
  },
  {
    id: "nature",
    name: "Animals & Nature",
    icon: "🌴",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
      "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🦆", "🦅",
      "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🦋", "🌲", "🌳",
      "🌴", "🌵", "🌾", "🌿", "☘️", "🍀", "🍁", "🍂", "🍃", "🌺",
      "🌸", "🌼", "🌻", "🌞", "🌝", "🌟", "✨", "🔥", "🌈", "⚡"
    ],
  },
  {
    id: "food",
    name: "Food & Drink",
    icon: "☕",
    emojis: [
      "☕", "🍵", "🧃", "🥤", "🧋", "🥛", "🍼", "🍺", "🍻", "🥂",
      "🍷", "🥃", "🍸", "🍹", "🍾", "🧊", "🍽️", "🥣", "🥡", "🥢",
      "🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐",
      "🍍", "🥥", "🥝", "🍅", "🥑", "🥦", "🥕", "🥐", "🍞", "🥪",
      "🍔", "🍟", "🍕", "🥗", "🍝", "🍜", "🍣", "🍱", "🎂", "🍫"
    ],
  },
  {
    id: "symbols",
    name: "Symbols & Flags",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🤎", "🖤", "🤍", "💔",
      "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💯", "✨",
      "⭐", "🌟", "💫", "💥", "🔥", "✅", "⚠️", "❌", "⭕", "🛑",
      "⛔", "🚫", "❗", "❓", "‼️", "⁉️", "🌐", "🇵🇬", "🇦🇺", "🇳🇿",
      "🇬🇧", "🇺🇸", "🇯🇵", "🇨🇳", "🇸🇬", "0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣"
    ],
  },
];

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "👏"];

// ═══════════════════════════════════════════════════════════════
// DATA TYPES
// ═══════════════════════════════════════════════════════════════
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
    role?: string;
    lastActiveAt?: string;
  } | null;
}

interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  senderEmail: string;
  messageType: "text" | "image" | "document" | "voice" | "system" | "contact" | "poll";
  content: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  replyToId?: number | null;
  isMine: boolean;
  isRead: boolean;
  reactions?: Record<string, number>;
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

// ═══════════════════════════════════════════════════════════════
// MAIN MESSAGES PAGE
// ═══════════════════════════════════════════════════════════════
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
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // New Chat Dialog States
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedGroupUsers, setSelectedGroupUsers] = useState<number[]>([]);
  const [groupTitle, setGroupTitle] = useState("");

  // In-Chat Search State (Circled Feature 1)
  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState("");
  const [currentSearchMatchIndex, setCurrentSearchMatchIndex] = useState(0);

  // Video Call State (Circled Feature 2)
  const [videoCallOpen, setVideoCallOpen] = useState(false);
  const [videoCallDuration, setVideoCallDuration] = useState(0);
  const [videoMuted, setVideoMuted] = useState(false);
  const [videoCameraOff, setVideoCameraOff] = useState(false);
  const [videoScreenSharing, setVideoScreenSharing] = useState(false);

  // Voice Call State (Circled Feature 3)
  const [voiceCallOpen, setVoiceCallOpen] = useState(false);
  const [voiceCallDuration, setVoiceCallDuration] = useState(0);
  const [voiceCallStatus, setVoiceCallStatus] = useState<"ringing" | "connected">("ringing");
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceSpeaker, setVoiceSpeaker] = useState(true);

  // Rich Emoji Picker State (Circled Feature 4)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiSearchQuery, setEmojiSearchQuery] = useState("");
  const [selectedEmojiTab, setSelectedEmojiTab] = useState("smileys");

  // Rich Attachment Menu State (Circled Feature 5)
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [shareContactModalOpen, setShareContactModalOpen] = useState(false);
  const [createPollModalOpen, setCreatePollModalOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);

  // Voice Recording Timer
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

  // Video Call Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (videoCallOpen) {
      interval = setInterval(() => {
        setVideoCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setVideoCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [videoCallOpen]);

  // Voice Call Timer & Ringing Simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let ringTimer: NodeJS.Timeout;

    if (voiceCallOpen) {
      setVoiceCallStatus("ringing");
      ringTimer = setTimeout(() => {
        setVoiceCallStatus("connected");
      }, 3000);

      interval = setInterval(() => {
        setVoiceCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setVoiceCallDuration(0);
    }

    return () => {
      clearInterval(interval);
      clearTimeout(ringTimer);
    };
  }, [voiceCallOpen]);

  // ═══════════════════════════════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════════════════════════════
  const { data: conversations = [], refetch: refetchConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/messages/conversations"],
    queryFn: async () => {
      const token = getToken();
      if (!token) return [];
      const res = await fetch("/api/messages/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load conversations");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/messages/conversations", selectedConversationId, "messages"],
    queryFn: async () => {
      if (!selectedConversationId) return [];
      const token = getToken();
      if (!token) return [];
      const res = await fetch(`/api/messages/conversations/${selectedConversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    enabled: !!selectedConversationId,
    refetchInterval: 3000,
  });

  const { data: directoryUsers = [] } = useQuery<DirectoryUser[]>({
    queryKey: ["/api/messages/users"],
    queryFn: async () => {
      const token = getToken();
      if (!token) return [];
      const res = await fetch("/api/messages/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: newChatModalOpen || shareContactModalOpen,
  });

  // Mark conversation as read on open
  useEffect(() => {
    if (!selectedConversationId) return;
    const token = getToken();
    if (!token) return;
    fetch(`/api/messages/conversations/${selectedConversationId}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-total"] });
    }).catch(() => {});
  }, [selectedConversationId, messages.length, queryClient]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Active conversation object
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedConversationId) || null;
  }, [conversations, selectedConversationId]);

  // In-chat search matching messages
  const searchMatches = useMemo(() => {
    if (!inChatSearchQuery.trim() || !messages.length) return [];
    const query = inChatSearchQuery.toLowerCase();
    return messages
      .map((msg, index) => ({ id: msg.id, index, content: msg.content }))
      .filter((m) => m.content.toLowerCase().includes(query));
  }, [messages, inChatSearchQuery]);

  const handleNextSearchMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (currentSearchMatchIndex + 1) % searchMatches.length;
    setCurrentSearchMatchIndex(nextIdx);
    const targetMsg = document.getElementById(`msg-${searchMatches[nextIdx].id}`);
    targetMsg?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handlePrevSearchMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = (currentSearchMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentSearchMatchIndex(prevIdx);
    const targetMsg = document.getElementById(`msg-${searchMatches[prevIdx].id}`);
    targetMsg?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const matchSearch =
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.participants.some((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchSearch) return false;

      if (filterTab === "direct") return c.type === "direct";
      if (filterTab === "group") return c.type === "group";
      if (filterTab === "unread") return c.unreadCount > 0;
      return true;
    });
  }, [conversations, searchQuery, filterTab]);

  // ═══════════════════════════════════════════════════════════════
  // MUTATIONS
  // ═══════════════════════════════════════════════════════════════
  const sendMessageMutation = useMutation({
    mutationFn: async (payload: {
      content: string;
      messageType?: string;
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentSize?: number;
      replyToId?: number;
    }) => {
      if (!selectedConversationId) return;
      const token = getToken();
      const res = await fetch(`/api/messages/conversations/${selectedConversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      setMessageInput("");
      setReplyingTo(null);
      queryClient.invalidateQueries({
        queryKey: ["/api/messages/conversations", selectedConversationId, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: async (payload: {
      type: "direct" | "group";
      targetUserId?: number;
      participantIds?: number[];
      participantUserIds?: number[];
      title?: string;
    }) => {
      const token = getToken();
      const res = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create conversation");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-total"] });
      setNewChatModalOpen(false);
      setSelectedGroupUsers([]);
      setGroupTitle("");
      if (data?.id) {
        setLocation(`/messages/${data.id}`);
      }
      toast({ title: "Conversation started" });
    },
    onError: (err: any) => {
      toast({
        title: "Could not start chat",
        description: err.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // ═══════════════════════════════════════════════════════════════
  // ACTIONS & HANDLERS
  // ═══════════════════════════════════════════════════════════════
  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConversationId) return;
    sendMessageMutation.mutate({
      content: messageInput.trim(),
      messageType: "text",
      replyToId: replyingTo?.id,
    });
  };

  const handleInsertEmoji = (emoji: string) => {
    setMessageInput((prev) => `${prev}${emoji}`);
    setEmojiPickerOpen(false);
    messageInputRef.current?.focus();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isImage: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversationId) return;

    const token = getToken();
    const formData = new FormData();
    formData.append("file", file);

    try {
      toast({ title: "Uploading attachment..." });
      const res = await fetch("/api/messages/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      sendMessageMutation.mutate({
        content: isImage ? "📷 Photo" : `📄 ${file.name}`,
        messageType: isImage ? "image" : "document",
        attachmentUrl: data.url,
        attachmentName: file.name,
        attachmentSize: file.size,
        replyToId: replyingTo?.id,
      });
      toast({ title: "Attachment sent" });
    } catch {
      toast({ title: "Failed to upload file", variant: "destructive" });
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  const handleSendVoiceNote = () => {
    setIsRecording(false);
    sendMessageMutation.mutate({
      content: `🎙️ Voice Note (${recordingSeconds}s)`,
      messageType: "voice",
      attachmentName: `Voice_Note_${Date.now()}.wav`,
      attachmentSize: recordingSeconds * 16000,
    });
    toast({ title: "Voice note sent" });
  };

  const handleSendContact = (targetUser: DirectoryUser) => {
    sendMessageMutation.mutate({
      content: `👤 Contact Card: **${targetUser.name}**\nRole: ${formatRoleName(targetUser.roleName)}\nEmail: ${targetUser.email}`,
      messageType: "contact",
    });
    setShareContactModalOpen(false);
    toast({ title: `Shared ${targetUser.name}'s contact card` });
  };

  const handleCreatePoll = () => {
    if (!pollQuestion.trim()) {
      toast({ title: "Please enter a poll question", variant: "destructive" });
      return;
    }
    const validOptions = pollOptions.filter((opt) => opt.trim().length > 0);
    if (validOptions.length < 2) {
      toast({ title: "Please provide at least 2 options", variant: "destructive" });
      return;
    }

    const pollContent = `📊 **POLL: ${pollQuestion.trim()}**\n\n${validOptions
      .map((opt, i) => `${i + 1}. [ ] ${opt.trim()}`)
      .join("\n")}\n\n_Reply with option number to vote_`;

    sendMessageMutation.mutate({
      content: pollContent,
      messageType: "poll",
    });
    setCreatePollModalOpen(false);
    setPollQuestion("");
    setPollOptions(["", ""]);
    toast({ title: "Poll published to channel" });
  };

  const handleEndVideoCall = () => {
    setVideoCallOpen(false);
    const mins = Math.floor(videoCallDuration / 60);
    const secs = videoCallDuration % 60;
    sendMessageMutation.mutate({
      content: `📹 **NISIT Secure Video Conference Ended**\nDuration: ${mins}m ${secs}s\nParticipants: ${user?.name || "Host"}, ${activeConversation?.title || "Team"}`,
      messageType: "system",
    });
  };

  const handleEndVoiceCall = () => {
    setVoiceCallOpen(false);
    const mins = Math.floor(voiceCallDuration / 60);
    const secs = voiceCallDuration % 60;
    sendMessageMutation.mutate({
      content: `📞 **NISIT Voice Call Ended**\nDuration: ${mins}m ${secs}s`,
      messageType: "system",
    });
  };

  const handleStartDirectChat = (otherUserId: number) => {
    createConversationMutation.mutate({
      type: "direct",
      targetUserId: otherUserId,
      participantIds: [otherUserId],
      participantUserIds: [otherUserId],
    });
  };

  const handleCreateGroup = () => {
    if (!groupTitle.trim()) {
      toast({ title: "Please enter group title", variant: "destructive" });
      return;
    }
    if (selectedGroupUsers.length === 0) {
      toast({ title: "Select at least 1 member", variant: "destructive" });
      return;
    }
    createConversationMutation.mutate({
      type: "group",
      title: groupTitle.trim(),
      participantIds: selectedGroupUsers,
      participantUserIds: selectedGroupUsers,
    });
  };

  // Group messages by date separators
  const groupedMessages = useMemo(() => {
    const groups: { dateLabel: string; items: Message[] }[] = [];
    let currentLabel = "";
    let currentList: Message[] = [];

    messages.forEach((msg) => {
      const label = formatMessageDateSeparator(msg.createdAt);
      if (label !== currentLabel) {
        if (currentList.length > 0) {
          groups.push({ dateLabel: currentLabel, items: currentList });
        }
        currentLabel = label;
        currentList = [msg];
      } else {
        currentList.push(msg);
      }
    });

    if (currentList.length > 0) {
      groups.push({ dateLabel: currentLabel, items: currentList });
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
                      `${activeConversation.participants.length} participants · ${activeConversation.participants.map(p => p.name.split(" ")[0]).join(", ")}`
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        {formatRoleName(activeConversation.otherUser?.role || "Staff")} · Active in NISIT network
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Action Buttons (Video Call, Voice Call, Search) */}
              <div className="flex items-center gap-1 text-muted-foreground">
                <TooltipProvider>
                  {/* VIDEO CALL BUTTON (CIRCLED FEATURE) */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        onClick={() => setVideoCallOpen(true)}
                      >
                        <Video className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Start Secure Video Conference</TooltipContent>
                  </Tooltip>

                  {/* VOICE CALL BUTTON (CIRCLED FEATURE) */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        onClick={() => setVoiceCallOpen(true)}
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Start NISIT Voice Call</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <div className="w-[1px] h-6 bg-border mx-1"></div>

                {/* IN-CHAT MESSAGE SEARCH BUTTON (CIRCLED FEATURE) */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-9 w-9 rounded-full ${inChatSearchOpen ? "bg-muted text-foreground" : ""}`}
                        onClick={() => {
                          setInChatSearchOpen(!inChatSearchOpen);
                          if (inChatSearchOpen) setInChatSearchQuery("");
                        }}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Search in conversation</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* In-Chat Search Bar Overlay */}
            {inChatSearchOpen && (
              <div className="px-4 py-2 bg-card border-b border-border shadow-sm flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200 z-10">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder="Search messages..."
                    className="pl-8 h-8 text-xs bg-muted/60"
                    value={inChatSearchQuery}
                    onChange={(e) => {
                      setInChatSearchQuery(e.target.value);
                      setCurrentSearchMatchIndex(0);
                    }}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {searchMatches.length > 0 ? (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-muted">
                      {currentSearchMatchIndex + 1} of {searchMatches.length}
                    </span>
                  ) : inChatSearchQuery ? (
                    <span className="text-[11px] text-destructive">No matches</span>
                  ) : null}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={searchMatches.length === 0}
                    onClick={handlePrevSearchMatch}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={searchMatches.length === 0}
                    onClick={handleNextSearchMatch}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      setInChatSearchOpen(false);
                      setInChatSearchQuery("");
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Security Shield Banner */}
              <div className="max-w-md mx-auto my-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center text-[11px] text-amber-800 dark:text-amber-200 flex items-center justify-center gap-2 shadow-sm">
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
                    const isMatched =
                      inChatSearchQuery.trim() &&
                      msg.content.toLowerCase().includes(inChatSearchQuery.toLowerCase());

                    return (
                      <div
                        key={msg.id}
                        id={`msg-${msg.id}`}
                        className={`flex flex-col group ${isMe ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`relative max-w-[85%] md:max-w-[70%] lg:max-w-[60%] rounded-2xl px-3.5 py-2 shadow-sm text-sm transition-all ${
                            isMatched ? "ring-2 ring-amber-500 shadow-md" : ""
                          } ${
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
                            <div className="mb-2 p-2 rounded bg-black/5 dark:bg-white/5 border-l-4 border-emerald-600 text-xs">
                              <p className="font-semibold text-emerald-700 dark:text-emerald-400">Replying to message</p>
                              <p className="text-muted-foreground truncate line-clamp-1">Previous context message</p>
                            </div>
                          )}

                          {/* Message Content by Type */}
                          {msg.messageType === "image" && msg.attachmentUrl && (
                            <div className="space-y-1 mb-1">
                              <img
                                src={msg.attachmentUrl}
                                alt="Attachment"
                                className="rounded-lg max-h-60 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => setLightboxImage(msg.attachmentUrl!)}
                              />
                              {msg.content !== "📷 Photo" && <p className="pt-1">{msg.content}</p>}
                            </div>
                          )}

                          {msg.messageType === "document" && msg.attachmentUrl && (
                            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-border/40 mb-1">
                              <FileText className="h-8 w-8 text-emerald-600 shrink-0" />
                              <div className="flex-1 min-w-0 text-xs">
                                <p className="font-semibold truncate">{msg.attachmentName || "Document.pdf"}</p>
                                <p className="text-muted-foreground text-[10px]">{formatFileSize(msg.attachmentSize)}</p>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 rounded-full text-emerald-700 dark:text-emerald-400"
                                onClick={() => window.open(msg.attachmentUrl!, "_blank")}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          )}

                          {msg.messageType === "voice" && (
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-black/5 dark:bg-white/5 min-w-[200px] mb-1">
                              <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                <Mic className="h-4 w-4" />
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="h-1.5 bg-emerald-600/30 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-600 w-2/3 rounded-full"></div>
                                </div>
                                <p className="text-[10px] text-muted-foreground font-mono">{msg.content}</p>
                              </div>
                            </div>
                          )}

                          {msg.messageType === "system" && (
                            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs font-mono whitespace-pre-line">
                              {msg.content}
                            </div>
                          )}

                          {msg.messageType === "contact" && (
                            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs space-y-1.5 my-1">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                                  <User className="h-4 w-4" />
                                </div>
                                <span className="font-bold text-emerald-900 dark:text-emerald-200">Shared Contact Card</span>
                              </div>
                              <p className="whitespace-pre-line font-medium text-foreground">{msg.content}</p>
                            </div>
                          )}

                          {msg.messageType === "poll" && (
                            <div className="p-3 rounded-lg bg-card border-2 border-emerald-600/40 text-xs space-y-2 my-1 shadow-sm">
                              <p className="whitespace-pre-line font-medium text-foreground">{msg.content}</p>
                              <div className="flex gap-1.5 pt-1">
                                <Button size="sm" variant="outline" className="h-6 text-[10px] border-emerald-600 text-emerald-700" onClick={() => handleInsertEmoji("🗳️ Voted #1")}>
                                  Vote #1
                                </Button>
                                <Button size="sm" variant="outline" className="h-6 text-[10px] border-emerald-600 text-emerald-700" onClick={() => handleInsertEmoji("🗳️ Voted #2")}>
                                  Vote #2
                                </Button>
                              </div>
                            </div>
                          )}

                          {(!msg.messageType || msg.messageType === "text") && (
                            <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                          )}

                          {/* Message Footer: Timestamp + Read Status */}
                          <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground/80 mt-1">
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {isMe && (
                              <span className="inline-flex items-center">
                                {msg.isRead ? (
                                  <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
                                ) : (
                                  <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quick Reaction Bar on Hover */}
                        <div
                          className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1 px-1 ${
                            isMe ? "justify-end" : "justify-start"
                          }`}
                        >
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 rounded-full text-muted-foreground hover:text-emerald-600"
                            onClick={() => setReplyingTo(msg)}
                            title="Reply"
                          >
                            <Reply className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              navigator.clipboard.writeText(msg.content);
                              toast({ title: "Copied to clipboard" });
                            }}
                            title="Copy text"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          {QUICK_REACTIONS.slice(0, 4).map((emoji) => (
                            <button
                              key={emoji}
                              className="text-xs hover:scale-125 transition-transform px-1"
                              onClick={() => {
                                sendMessageMutation.mutate({
                                  content: `${emoji}`,
                                  replyToId: msg.id,
                                });
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Replying Preview Bar */}
            {replyingTo && (
              <div className="px-4 py-2 bg-muted border-t border-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <Reply className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{replyingTo.senderName}:</span>
                  <span className="text-muted-foreground truncate">{replyingTo.content}</span>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setReplyingTo(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Bottom Input Area */}
            <div className="p-3 bg-card border-t border-border shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => handleFileUpload(e, false)}
              />
              <input
                type="file"
                ref={imageInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileUpload(e, true)}
              />

              {isRecording ? (
                /* Voice Recording Mode */
                <div className="flex items-center justify-between gap-3 bg-red-500/10 border border-red-500/30 rounded-full px-4 py-2 animate-pulse">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <Mic className="h-4 w-4 animate-bounce" />
                    <span className="text-xs font-mono font-bold">
                      Recording Audio... {Math.floor(recordingSeconds / 60)}:
                      {String(recordingSeconds % 60).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setIsRecording(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-3"
                      onClick={handleSendVoiceNote}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" /> Send Voice Note
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {/* 1. WHATSAPP RICH EMOJI PICKER POPOVER */}
                  <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-muted-foreground hover:text-emerald-600 shrink-0 rounded-full"
                        title="Choose Emoji"
                      >
                        <Smile className="h-5 w-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="start" className="w-[340px] sm:w-[380px] p-3 shadow-xl rounded-2xl">
                      {/* Emoji Search */}
                      <div className="relative mb-2">
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search all emojis..."
                          className="pl-8 h-8 text-xs bg-muted/60"
                          value={emojiSearchQuery}
                          onChange={(e) => setEmojiSearchQuery(e.target.value)}
                        />
                      </div>

                      {/* Quick Reactions Bar */}
                      <div className="flex items-center justify-between bg-muted/40 p-1.5 rounded-lg mb-2">
                        {QUICK_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            className="text-lg hover:scale-125 transition-transform"
                            onClick={() => handleInsertEmoji(emoji)}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      {/* Categorized Tabs */}
                      <Tabs value={selectedEmojiTab} onValueChange={setSelectedEmojiTab} className="w-full">
                        <TabsList className="grid grid-cols-6 h-8 p-0 bg-transparent border-b border-border/50 rounded-none mb-2">
                          {EMOJI_CATEGORIES.map((cat) => (
                            <TabsTrigger
                              key={cat.id}
                              value={cat.id}
                              className="text-base p-1 data-[state=active]:bg-muted rounded"
                              title={cat.name}
                            >
                              {cat.icon}
                            </TabsTrigger>
                          ))}
                        </TabsList>

                        {EMOJI_CATEGORIES.map((cat) => (
                          <TabsContent key={cat.id} value={cat.id} className="mt-0">
                            <div className="max-h-48 overflow-y-auto grid grid-cols-8 gap-1 p-1">
                              {cat.emojis
                                .filter((em) =>
                                  !emojiSearchQuery ||
                                  em.includes(emojiSearchQuery) ||
                                  cat.name.toLowerCase().includes(emojiSearchQuery.toLowerCase())
                                )
                                .map((emoji, idx) => (
                                  <button
                                    key={idx}
                                    className="h-8 w-8 flex items-center justify-center text-lg hover:bg-muted rounded-lg transition-transform hover:scale-125"
                                    onClick={() => handleInsertEmoji(emoji)}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                            </div>
                          </TabsContent>
                        ))}
                      </Tabs>
                    </PopoverContent>
                  </Popover>

                  {/* 2. RICH ATTACHMENT MENU (WHATSAPP POPUP STYLE) */}
                  <DropdownMenu open={attachmentMenuOpen} onOpenChange={setAttachmentMenuOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-muted-foreground hover:text-emerald-600 shrink-0 rounded-full"
                        title="Attach file or share contact"
                      >
                        <Paperclip className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" className="w-52 p-2 rounded-2xl shadow-xl space-y-1">
                      <DropdownMenuItem
                        className="flex items-center gap-2.5 py-2 cursor-pointer text-xs"
                        onClick={() => imageInputRef.current?.click()}
                      >
                        <div className="h-7 w-7 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center">
                          <ImageIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold">Photos &amp; Media</p>
                          <p className="text-[10px] text-muted-foreground">JPG, PNG, WebP</p>
                        </div>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        className="flex items-center gap-2.5 py-2 cursor-pointer text-xs"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="h-7 w-7 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold">Document</p>
                          <p className="text-[10px] text-muted-foreground">PDF, Word, Excel, ZIP</p>
                        </div>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        className="flex items-center gap-2.5 py-2 cursor-pointer text-xs"
                        onClick={() => setShareContactModalOpen(true)}
                      >
                        <div className="h-7 w-7 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold">Share Colleague</p>
                          <p className="text-[10px] text-muted-foreground">NISIT Contact Card</p>
                        </div>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        className="flex items-center gap-2.5 py-2 cursor-pointer text-xs"
                        onClick={() => setCreatePollModalOpen(true)}
                      >
                        <div className="h-7 w-7 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
                          <BarChart2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold">Create Team Poll</p>
                          <p className="text-[10px] text-muted-foreground">Interactive voting</p>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* 3. QUICK THUMBS UP / FLAME BUTTON (CIRCLED FEATURE) */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 shrink-0 rounded-full"
                    onClick={() => handleInsertEmoji("👍")}
                    title="Quick Thumbs Up"
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </Button>

                  {/* Message Input Box */}
                  <div className="flex-1 relative">
                    <Input
                      ref={messageInputRef}
                      placeholder="Type a message..."
                      className="bg-muted/60 border-none rounded-full h-10 px-4 text-sm focus-visible:ring-1 focus-visible:ring-emerald-600"
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

                  {/* Send Button or Voice Note Button */}
                  {messageInput.trim() ? (
                    <Button
                      size="icon"
                      className="h-10 w-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-md transition-transform hover:scale-105"
                      onClick={handleSendMessage}
                      disabled={sendMessageMutation.isPending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 shrink-0 rounded-full"
                      onClick={() => setIsRecording(true)}
                      title="Hold or click to record voice note"
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
                Connect instantly with fellow officers, technical staff, and departmental groups across Papua New Guinea National Institute of Standards &amp; Industrial Technology.
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
          MODAL 1: VIDEO CONFERENCE (CIRCLED FEATURE)
      ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={videoCallOpen} onOpenChange={setVideoCallOpen}>
        <DialogContent className="sm:max-w-[720px] p-0 overflow-hidden bg-slate-950 text-white border-slate-800">
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-red-500 animate-ping"></div>
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-400" /> NISIT Secure Video Conference
                </p>
                <p className="text-xs text-slate-400">
                  {activeConversation?.title} · Encrypted Channel
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-300 font-mono text-xs border-emerald-500/40">
                {Math.floor(videoCallDuration / 60)}:{String(videoCallDuration % 60).padStart(2, "0")}
              </Badge>
            </div>
          </div>

          {/* Video Grid Feed Simulation */}
          <div className="p-6 grid sm:grid-cols-2 gap-4 bg-slate-950 min-h-[320px]">
            {/* Participant 1 (Remote Colleague) */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 flex flex-col items-center justify-center p-6 text-center shadow-inner">
              <Avatar className="h-20 w-20 border-2 border-emerald-500 mb-3 shadow-lg">
                <AvatarFallback className="bg-emerald-900 text-emerald-200 text-xl font-bold">
                  {activeConversation?.title.slice(0, 2).toUpperCase() || "NISIT"}
                </AvatarFallback>
              </Avatar>
              <p className="font-semibold text-sm text-white">{activeConversation?.title}</p>
              <p className="text-xs text-emerald-400">Connected · HD 1080p</p>
              <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-black/60 backdrop-blur-sm text-[10px] flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span> Mic Active
              </div>
            </div>

            {/* Participant 2 (Self Preview) */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 flex flex-col items-center justify-center p-6 text-center shadow-inner">
              {videoCameraOff ? (
                <div className="text-slate-500 flex flex-col items-center space-y-2">
                  <VideoOff className="h-10 w-10" />
                  <p className="text-xs">Camera is Off</p>
                </div>
              ) : (
                <>
                  <Avatar className="h-20 w-20 border-2 border-slate-700 mb-3 shadow-lg">
                    <AvatarFallback className="bg-slate-800 text-slate-200 text-xl font-bold">
                      {user?.name?.slice(0, 2).toUpperCase() || "ME"}
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-semibold text-sm text-white">{user?.name || "You"} (Host)</p>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                </>
              )}
              <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-black/60 backdrop-blur-sm text-[10px]">
                {videoMuted ? "🔇 Muted" : "🎙️ Microphone On"}
              </div>
            </div>
          </div>

          {/* Video Conference Controls */}
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-3">
            <Button
              size="icon"
              variant={videoMuted ? "destructive" : "secondary"}
              className="h-11 w-11 rounded-full"
              onClick={() => setVideoMuted(!videoMuted)}
              title={videoMuted ? "Unmute" : "Mute"}
            >
              {videoMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            <Button
              size="icon"
              variant={videoCameraOff ? "destructive" : "secondary"}
              className="h-11 w-11 rounded-full"
              onClick={() => setVideoCameraOff(!videoCameraOff)}
              title={videoCameraOff ? "Turn Camera On" : "Turn Camera Off"}
            >
              {videoCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </Button>

            <Button
              size="icon"
              variant={videoScreenSharing ? "default" : "secondary"}
              className={`h-11 w-11 rounded-full ${videoScreenSharing ? "bg-emerald-600 text-white" : ""}`}
              onClick={() => {
                setVideoScreenSharing(!videoScreenSharing);
                toast({ title: videoScreenSharing ? "Stopped screen sharing" : "Screen sharing started" });
              }}
              title="Share Screen"
            >
              <ScreenShare className="h-5 w-5" />
            </Button>

            <Button
              size="default"
              variant="destructive"
              className="h-11 rounded-full px-6 gap-2 bg-red-600 hover:bg-red-700 font-semibold text-white shadow-lg"
              onClick={handleEndVideoCall}
            >
              <PhoneOff className="h-5 w-5" /> End Call
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════
          MODAL 2: VOICE CALL (CIRCLED FEATURE)
      ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={voiceCallOpen} onOpenChange={setVoiceCallOpen}>
        <DialogContent className="sm:max-w-[420px] text-center p-6 space-y-6">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600" /> NISIT Internal Voice Call
            </DialogTitle>
            <DialogDescription>
              {voiceCallStatus === "ringing" ? "Ringing colleague..." : "Encrypted Voice Call Connected"}
            </DialogDescription>
          </DialogHeader>

          {/* Caller Pulse Animation */}
          <div className="flex flex-col items-center justify-center space-y-3 py-4">
            <div className="relative">
              <div className="absolute -inset-3 rounded-full bg-emerald-500/20 animate-ping"></div>
              <Avatar className="h-24 w-24 border-4 border-emerald-600 shadow-xl">
                <AvatarFallback className="bg-emerald-600 text-white text-2xl font-bold">
                  {activeConversation?.title.slice(0, 2).toUpperCase() || "NISIT"}
                </AvatarFallback>
              </Avatar>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{activeConversation?.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatRoleName(activeConversation?.otherUser?.role)} · National Institute of Standards
              </p>
            </div>
            <Badge className="bg-emerald-600/10 text-emerald-700 font-mono text-xs border border-emerald-600/20 px-3 py-1">
              {voiceCallStatus === "ringing"
                ? "Connecting..."
                : `${Math.floor(voiceCallDuration / 60)}:${String(voiceCallDuration % 60).padStart(2, "0")}`}
            </Badge>
          </div>

          {/* Voice Controls */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <Button
              size="icon"
              variant={voiceMuted ? "destructive" : "outline"}
              className="h-12 w-12 rounded-full"
              onClick={() => setVoiceMuted(!voiceMuted)}
              title={voiceMuted ? "Unmute" : "Mute"}
            >
              {voiceMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            <Button
              size="icon"
              variant={voiceSpeaker ? "secondary" : "outline"}
              className="h-12 w-12 rounded-full"
              onClick={() => setVoiceSpeaker(!voiceSpeaker)}
              title="Speaker"
            >
              {voiceSpeaker ? <Volume2 className="h-5 w-5 text-emerald-600" /> : <VolumeX className="h-5 w-5" />}
            </Button>

            <Button
              size="icon"
              variant="destructive"
              className="h-12 w-12 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg"
              onClick={handleEndVoiceCall}
              title="End Voice Call"
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════
          MODAL 3: SHARE COLLEAGUE CONTACT (CIRCLED FEATURE)
      ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={shareContactModalOpen} onOpenChange={setShareContactModalOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-emerald-600" /> Share Colleague Contact
            </DialogTitle>
            <DialogDescription>
              Select a staff member to send their digital contact card directly into this chat.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-64 overflow-y-auto divide-y divide-border/40 rounded-lg border border-border">
            {directoryUsers.map((u) => (
              <div
                key={u.id}
                onClick={() => handleSendContact(u)}
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
                  {formatRoleName(u.roleName)}
                </Badge>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════
          MODAL 4: CREATE TEAM POLL (CIRCLED FEATURE)
      ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={createPollModalOpen} onOpenChange={setCreatePollModalOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-emerald-600" /> Create Team Poll
            </DialogTitle>
            <DialogDescription>
              Ask a question and allow colleagues in this channel to vote.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Poll Question *</label>
              <Input
                placeholder="e.g. When should we hold the quarterly review meeting?"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground block">Options</label>
              {pollOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder={`Option ${idx + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const updated = [...pollOptions];
                      updated[idx] = e.target.value;
                      setPollOptions(updated);
                    }}
                    className="h-8 text-xs"
                  />
                  {pollOptions.length > 2 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              {pollOptions.length < 5 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-emerald-600 hover:text-emerald-700"
                  onClick={() => setPollOptions([...pollOptions, ""])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Option
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatePollModalOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCreatePoll}>
              Publish Poll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════
          MODAL 5: NEW CONVERSATION / GROUP (WITH HUMAN READABLE ROLES)
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
                      {/* HUMAN READABLE ROLE BADGE (CIRCLED ISSUE IN SCREENSHOT 1) */}
                      <Badge variant="outline" className="text-[11px] font-medium border-emerald-600/30 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30">
                        {formatRoleName(u.roleName)}
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
                  placeholder="e.g. Standards & Metrology Technical Panel"
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
                            <p className="text-[10px] text-muted-foreground">{formatRoleName(u.roleName)}</p>
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

      {/* Lightbox for Images */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <img src={lightboxImage} alt="Preview" className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg" />
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setLightboxImage(null)}
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
      )}
    </AppLayout>
  );
}
