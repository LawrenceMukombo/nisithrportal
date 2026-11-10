import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  MapPin, Clock, QrCode, Users, ShieldCheck, CheckCircle2, 
  AlertCircle, Smartphone, Camera, RefreshCw, Send, 
  LogOut, Award, Flame, ExternalLink, Printer, Building2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ArrowUpDown, ArrowUp, ArrowDown, Download, SlidersHorizontal,
  Eye, EyeOff, Search, Calendar, FileSpreadsheet, AlertTriangle,
  CreditCard, Radio, Fingerprint, ScanFace, KeyRound, Shield,
  UserCheck, BadgeCheck, Lock, X, Sun, Moon, Sparkles, Check,
  User, CheckCircle, ArrowRight, Maximize2, Minimize2, Volume2,
  VolumeX, Activity, Zap, CheckCheck, Landmark, Copy
} from "lucide-react";
import { api, GeofenceZone, LiveStaffMember, MyAttendanceStats, getStoredToken, clearStoredToken } from "./lib/api";

type TabMode = "station" | "presence" | "enroll" | "kiosk" | "mobile" | "history";
type PromptDirection = "auto" | "in" | "out";
type RegisteredMethod = "face" | "fingerprint" | "iris" | "card" | "pin" | "qr";
type KioskTheme = "png" | "emerald" | "light" | "dark";
type PresenceSortField = "name" | "division" | "status" | "clockIn" | "location" | "score";
type HistorySortField = "date" | "clockIn" | "clockOut" | "status" | "lateMinutes";


// Web Audio API Synthesizer for pleasant public turnstile chime feedback
function playKioskChime(type: "success" | "alert" | "click", soundEnabled: boolean = true) {
  if (!soundEnabled) return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === "success") {
      // Pleasant two-tone turnstile chime (F#5 -> A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(740, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.12);
      gain2.gain.setValueAtTime(0.2, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.55);
    } else if (type === "alert") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(260, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  } catch {
    // Audio context may require user interaction
  }
}

export default function App() {
  // Navigation, Theme & Tablet Kiosk State
  const [activeTab, setActiveTab] = useState<TabMode>("station");
  const [theme, setTheme] = useState<KioskTheme>("png"); // Default to prestigious NISIT / PNG National Colors Theme (Red, Black & Gold)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Authentication & Admin State
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [showApkModal, setShowApkModal] = useState<boolean>(false);
  const [copiedApkUrl, setCopiedApkUrl] = useState<boolean>(false);
  const [loginEmail, setLoginEmail] = useState("admin@nisit.gov.pg");
  const [loginPassword, setLoginPassword] = useState("admin123");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Grand Staff Attendance Station State
  const [selectedPrompt, setSelectedPrompt] = useState<PromptDirection>("auto");
  const [registeredMethod, setRegisteredMethod] = useState<RegisteredMethod>("card");
  const [stationInput, setStationInput] = useState<string>("");
  const [stationPinInput, setStationPinInput] = useState<string>("");
  const [isVerifyingStaff, setIsVerifyingStaff] = useState<boolean>(false);
  const [verifiedStaffProfile, setVerifiedStaffProfile] = useState<any | null>(null);
  const [confirmedPunch, setConfirmedPunch] = useState<any | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(4);

  // Tablet In-Kiosk Staff Credential & Biometric Enrollment State
  const [enrollStaffList, setEnrollStaffList] = useState<any[]>([]);
  const [selectedEnrollEmpId, setSelectedEnrollEmpId] = useState<number | "">("");
  const [enrollRfid, setEnrollRfid] = useState("");
  const [enrollPin, setEnrollPin] = useState("");
  const [enrollFace, setEnrollFace] = useState(true);
  const [enrollFingerprint, setEnrollFingerprint] = useState(true);
  const [enrollIris, setEnrollIris] = useState(false);
  const [isSavingEnroll, setIsSavingEnroll] = useState(false);
  const [enrollFeedback, setEnrollFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [enrollSearch, setEnrollSearch] = useState("");

  // Physical Front Camera Integration
  const [useCamera, setUseCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cardInputRef = useRef<HTMLInputElement | null>(null);

  // Seeded Institutional Geofences
  const SEEDED_PRIMARY_GEOFENCES: GeofenceZone[] = [
    {
      id: 1,
      name: "NISIT HQ Gordon, Port Moresby",
      code: "GEO-HQ-POM",
      latitude: "-9.431284",
      longitude: "147.185293",
      radiusMeters: 200,
      address: "Corner of Spring Garden Rd & Godwit Rd, Gordon, Port Moresby",
      province: "National Capital District",
      isActive: "true",
    },
    {
      id: 2,
      name: "NISIT Regional Office - Lae",
      code: "GEO-REG-LAE",
      latitude: "-6.728045",
      longitude: "146.996145",
      radiusMeters: 250,
      address: "Main Wharf / Port Area, Lae",
      province: "Morobe Province",
      isActive: "true",
    },
    {
      id: 3,
      name: "NISIT Metrology & Testing Lab - Baruni",
      code: "GEO-LAB-BAR",
      latitude: "-9.405122",
      longitude: "147.132891",
      radiusMeters: 150,
      address: "Baruni Industrial Corridor, Port Moresby",
      province: "National Capital District",
      isActive: "true",
    },
  ];

  // Mobile punch state
  const [geofences, setGeofences] = useState<GeofenceZone[]>(SEEDED_PRIMARY_GEOFENCES);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lon: number; accuracy: number }>({
    lat: -9.431284,
    lon: 147.185293,
    accuracy: 8,
  });
  const [gpsStatus, setGpsStatus] = useState<string>("NISIT HQ Gordon, Port Moresby (Primary Zone)");
  const [isGpsRefreshing, setIsGpsRefreshing] = useState(false);
  const [notes, setNotes] = useState("");
  const [photoEnabled, setPhotoEnabled] = useState(true);
  const [isPunching, setIsPunching] = useState(false);
  const [punchResult, setPunchResult] = useState<any>(null);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<string | null>(null);

  // Kiosk state
  const [kioskToken, setKioskToken] = useState<string>("");
  const [kioskExpires, setKioskExpires] = useState<number>(15);
  const [badgeInput, setBadgeInput] = useState<string>("");
  const [isScanningBadge, setIsScanningBadge] = useState<boolean>(false);
  const [kioskScanFeedback, setKioskScanFeedback] = useState<{ success: boolean; message: string; record?: any } | null>(null);
  const [clockingDevices, setClockingDevices] = useState<any[]>([]);

  // Presence state (Enterprise Table)
  const [presenceList, setPresenceList] = useState<LiveStaffMember[]>([]);
  const [isPresenceLoading, setIsPresenceLoading] = useState(true);
  const [presenceError, setPresenceError] = useState<string | null>(null);
  const [presenceFilter, setPresenceFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [presenceSortField, setPresenceSortField] = useState<PresenceSortField>("name");
  const [presenceSortAsc, setPresenceSortAsc] = useState<boolean>(true);
  const [presencePage, setPresencePage] = useState<number>(1);
  const [presencePageSize, setPresencePageSize] = useState<number>(10);
  const [showColMenu, setShowColMenu] = useState<boolean>(false);
  const [presenceCols, setPresenceCols] = useState({
    staff: true,
    division: true,
    status: true,
    clockIn: true,
    location: true,
    score: true,
  });

  // History state
  const [myStats, setMyStats] = useState<MyAttendanceStats | null>(null);
  const [personalRecords, setPersonalRecords] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [historySortField, setHistorySortField] = useState<HistorySortField>("date");
  const [historySortAsc, setHistorySortAsc] = useState<boolean>(false);
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyPageSize, setHistoryPageSize] = useState<number>(10);

  // Live clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen to session expiry event
  useEffect(() => {
    const handleExpired = () => setToken(null);
    window.addEventListener("attendance-auth-expired", handleExpired);
    return () => window.removeEventListener("attendance-auth-expired", handleExpired);
  }, []);

  // Auto-focus card input when Card method is active for fast badge swipes
  useEffect(() => {
    if (activeTab === "station" && registeredMethod === "card" && !confirmedPunch) {
      cardInputRef.current?.focus();
    }
  }, [activeTab, registeredMethod, confirmedPunch]);

  // Front camera stream lifecycle
  useEffect(() => {
    if (!useCamera) return;
    let stream: MediaStream | null = null;
    setCameraError(null);

    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch((err) => {
        console.warn("Front camera access failed:", err);
        setCameraError("Front camera unavailable or blocked. Running simulated optical sensor.");
        setUseCamera(false);
      });

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [useCamera]);

  // Fullscreen toggle helper
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Auto-reset timer for confirmed punch on Grand Station
  useEffect(() => {
    if (!confirmedPunch) return;
    if (countdown <= 0) {
      resetStationState();
      return;
    }
    const timer = setTimeout(() => {
      setCountdown((c) => c - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [confirmedPunch, countdown]);

  // Real GPS Geolocation Hook
  const refreshGpsLocation = () => {
    setIsGpsRefreshing(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsLocation({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy || 5),
          });
          setGpsStatus("Real-Time Device GPS Acquired");
          setIsGpsRefreshing(false);
        },
        (err) => {
          console.warn("GPS acquire note:", err.message);
          setGpsStatus("Default Station GPS Signal (Seeded HQ)");
          setIsGpsRefreshing(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setIsGpsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshGpsLocation();
  }, []);

  // Load geofences, devices, presence, and personal stats
  const refreshData = () => {
    api.getGeofences()
      .then((data) => {
        if (data && data.length > 0) {
          setGeofences(data);
          setGpsLocation((prev) => ({
            ...prev,
            lat: parseFloat(data[0].latitude),
            lon: parseFloat(data[0].longitude),
          }));
        }
      })
      .catch(() => {});

    api.getClockingDevices().then(setClockingDevices).catch(() => {});

    setIsPresenceLoading(true);
    setPresenceError(null);
    api.getLivePresence()
      .then((data) => {
        setPresenceList(data);
        setIsPresenceLoading(false);
        const adminEmp = data.find((e) => e.name.includes("Admin") || e.name.includes("NISIT"));
        if (adminEmp?.todayPunch?.clockIn) {
          setIsClockedIn(!adminEmp.todayPunch.clockOut);
          setClockInTime(adminEmp.todayPunch.clockIn);
        }
      })
      .catch((e) => {
        setIsPresenceLoading(false);
        setPresenceError(e.message || "Failed to load presence board");
      });

    if (token) {
      api.getMyStats().then(setMyStats).catch(() => {});
      setIsHistoryLoading(true);
      api.getMyAttendanceRecords()
        .then((records) => {
          setPersonalRecords(records);
          setIsHistoryLoading(false);
        })
        .catch(() => setIsHistoryLoading(false));
    }
  };

  useEffect(() => {
    refreshData();
  }, [token, punchResult]);

  // Distance calculator helper
  const nearestZone = useMemo(() => {
    if (!geofences.length) return null;
    let minD = Infinity;
    let best = geofences[0];
    for (const g of geofences) {
      const d = Math.round(
        Math.hypot(
          (parseFloat(g.latitude) - gpsLocation.lat) * 111000,
          (parseFloat(g.longitude) - gpsLocation.lon) * 111000
        )
      );
      if (d < minD) {
        minD = d;
        best = g;
      }
    }
    return { zone: best, distance: minD, isInside: minD <= best.radiusMeters };
  }, [geofences, gpsLocation]);

  // Intelligent Time-of-Day Greeting & Shift Phase Intelligence
  const timeIntelligence = useMemo(() => {
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Pacific/Port_Moresby",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });
      const parts = formatter.formatToParts(currentTime);
      const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "8", 10);
      const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
      const totalMins = hour * 60 + minute;

      // Time-aware greeting
      let greeting = "Welcome to NISIT";
      if (hour >= 5 && hour < 12) greeting = "Good Morning, NISIT Officers";
      else if (hour >= 12 && hour < 16) greeting = "Good Afternoon, NISIT Officers";
      else if (hour >= 16 && hour < 22) greeting = "Good Evening, NISIT Officers";
      else greeting = "Night Duty Station Active";

      // 06:00 to 07:45 (Early Punctual Entry)
      if (totalMins >= 360 && totalMins < 465) {
        const minsLeft = 465 - totalMins;
        return {
          greeting,
          phase: "Punctual Morning Arrival",
          description: `Early Shift Entry • ${minsLeft}m until standard shift start (07:45)`,
          badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
          iconColor: "text-emerald-400",
          suggestedAction: "in" as const,
          actionPrompt: "Ready to Sign In",
          isMorning: true,
        };
      }
      // 07:45 to 12:00 (Morning Shift Active)
      if (totalMins >= 465 && totalMins < 720) {
        const isLate = totalMins > 480;
        return {
          greeting,
          phase: isLate ? "Morning Shift Active (Late Entry)" : "Standard Morning Shift",
          description: isLate ? "Arrival logged after 08:00 AM • Late variance recorded" : "Official working shift underway",
          badgeColor: isLate ? "bg-amber-500/20 text-amber-400 border-amber-500/40" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
          iconColor: isLate ? "text-amber-400" : "text-emerald-400",
          suggestedAction: "in" as const,
          actionPrompt: "Ready to Sign In",
          isMorning: true,
        };
      }
      // 12:00 to 16:06 (Core Working Hours)
      if (totalMins >= 720 && totalMins < 966) {
        return {
          greeting,
          phase: "Core Working Hours",
          description: "Midday Institutional Operations • Ready for Duty Punch",
          badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/40",
          iconColor: "text-blue-400",
          suggestedAction: "auto" as const,
          actionPrompt: "Ready to Punch",
          isMorning: false,
        };
      }
      // 16:06+ (Shift Concluded & Overtime)
      const overtimeMins = totalMins - 966;
      return {
        greeting,
        phase: "Shift Concluded • Departure Active",
        description: `Official shift ended at 16:06 PGT • ${overtimeMins > 0 ? `+${overtimeMins}m Overtime Active` : "Evening Sign-Out"}`,
        badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/40",
        iconColor: "text-purple-400",
        suggestedAction: "out" as const,
        actionPrompt: "Ready to Sign Out",
        isMorning: false,
      };
    } catch {
      return {
        greeting: "Welcome to NISIT",
        phase: "Active Station",
        description: "Official Working Hours",
        badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
        iconColor: "text-emerald-400",
        suggestedAction: "auto" as const,
        actionPrompt: "Ready to Sign In/Out",
        isMorning: true,
      };
    }
  }, [currentTime]);

  // Grand Staff Verification & Punch Execution
  const executeStaffVerificationAndPunch = async (identifier: string, methodOverride?: RegisteredMethod) => {
    const cleanId = identifier.trim();
    if (!cleanId) return;

    playKioskChime("click", soundEnabled);
    setIsVerifyingStaff(true);
    setVerificationError(null);
    setConfirmedPunch(null);
    setVerifiedStaffProfile(null);
    const method = methodOverride || registeredMethod;

    try {
      // 1. Verify staff credentials & pull profile
      const verifyRes = await api.verifyStaff(cleanId);
      if (!verifyRes.found || !verifyRes.staff) {
        throw new Error(verifyRes.error || `No registered NISIT personnel found matching "${cleanId}".`);
      }
      setVerifiedStaffProfile(verifyRes.staff);

      // 2. Intelligent determination of punch direction
      let targetAction: "clock_in" | "clock_out" = "clock_in";
      if (selectedPrompt === "auto") {
        targetAction = verifyRes.nextAction || (verifyRes.isClockedIn ? "clock_out" : "clock_in");
      } else {
        targetAction = selectedPrompt === "in" ? "clock_in" : "clock_out";
      }

      // 3. Register verified log in database
      const punchRes = await api.recordStaffPunch({
        identifier: cleanId,
        method: `biometric_${method}`,
        action: targetAction,
        kioskLocation: "NISIT HQ Main Turnstiles #01",
        notes: `Verified at station terminal via ${method.toUpperCase()}`,
      });

      setConfirmedPunch(punchRes);
      setCountdown(4);
      playKioskChime("success", soundEnabled);

      // Refresh live presence
      api.getLivePresence().then(setPresenceList).catch(() => {});
    } catch (err: any) {
      setVerificationError(err.message || "Failed to verify staff credentials");
      playKioskChime("alert", soundEnabled);
    } finally {
      setIsVerifyingStaff(false);
    }
  };

  const resetStationState = () => {
    setConfirmedPunch(null);
    setVerifiedStaffProfile(null);
    setStationInput("");
    setStationPinInput("");
    setVerificationError(null);
    // Auto-focus back on card reader for next officer
    if (registeredMethod === "card") {
      cardInputRef.current?.focus();
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await api.login(loginEmail, loginPassword);
      setToken(getStoredToken());
      setShowAdminModal(false);
      refreshData();
    } catch (err: any) {
      setLoginError(err.message || "Administrative login failed. Please verify credentials.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminSignOut = () => {
    clearStoredToken();
    setToken(null);
    setActiveTab("station");
  };

  // ── Tablet In-Kiosk Biometric & Credential Enrollment Handler ──────────
  const handleSelectStaffForEnroll = (empId: number) => {
    setSelectedEnrollEmpId(empId);
    setEnrollFeedback(null);
    const emp = enrollStaffList.find((e) => e.id === empId);
    if (emp) {
      setEnrollRfid(emp.rfidCardNumber || `RFID-${10000 + emp.id}`);
      setEnrollPin(emp.attendancePin ? "" : String(1000 + (emp.id % 900)));
      setEnrollFace(Boolean(emp.biometricsEnrolled?.face ?? true));
      setEnrollFingerprint(Boolean(emp.biometricsEnrolled?.fingerprint ?? true));
      setEnrollIris(Boolean(emp.biometricsEnrolled?.iris ?? false));
    }
  };

  const handleSaveStaffEnrollment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedEnrollEmpId) return;
    setIsSavingEnroll(true);
    setEnrollFeedback(null);
    try {
      const res = await api.enrollStaff({
        employeeId: Number(selectedEnrollEmpId),
        rfidCardNumber: enrollRfid.trim() || undefined,
        attendancePin: enrollPin.trim() || undefined,
        biometricsEnrolled: {
          face: enrollFace,
          fingerprint: enrollFingerprint,
          iris: enrollIris,
        },
      });
      setEnrollFeedback({
        success: true,
        message: res.message || "Officer credentials and biometric templates successfully enrolled to HR Cloud!",
      });
      playKioskChime("success", soundEnabled);
      // Refresh staff list
      api.getEmployees().then(setEnrollStaffList).catch(() => {});
    } catch (err: any) {
      setEnrollFeedback({
        success: false,
        message: err.message || "Failed to enroll credentials.",
      });
      playKioskChime("alert", soundEnabled);
    } finally {
      setIsSavingEnroll(false);
    }
  };

  // ── Enterprise Filtering, Sorting & Pagination: Presence Board ──────────
  const handlePresenceSort = (field: PresenceSortField) => {
    if (presenceSortField === field) {
      setPresenceSortAsc(!presenceSortAsc);
    } else {
      setPresenceSortField(field);
      setPresenceSortAsc(true);
    }
    setPresencePage(1);
  };

  const filteredPresence = useMemo(() => {
    return presenceList.filter((emp) => {
      const matchSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (emp.employeeNumber && emp.employeeNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (emp.division && emp.division.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchSearch) return false;
      if (presenceFilter === "all") return true;
      if (presenceFilter === "present") return emp.liveAttendanceStatus === "present" || emp.liveAttendanceStatus === "late";
      if (presenceFilter === "not_reported") return emp.liveAttendanceStatus === "not_reported" || !emp.todayPunch?.clockIn;
      if (presenceFilter === "in_field") return emp.liveAttendanceStatus === "in_field";
      if (presenceFilter === "departed") return emp.liveAttendanceStatus === "departed" || Boolean(emp.todayPunch?.clockOut);
      return true;
    });
  }, [presenceList, presenceFilter, searchQuery]);

  const sortedPresence = useMemo(() => {
    return [...filteredPresence].sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";
      if (presenceSortField === "name") {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (presenceSortField === "division") {
        valA = (a.division || "").toLowerCase();
        valB = (b.division || "").toLowerCase();
      } else if (presenceSortField === "status") {
        valA = a.liveAttendanceStatus;
        valB = b.liveAttendanceStatus;
      } else if (presenceSortField === "clockIn") {
        valA = a.todayPunch?.clockIn || a.lastClockInAt || "";
        valB = b.todayPunch?.clockIn || b.lastClockInAt || "";
      } else if (presenceSortField === "location") {
        valA = (a.todayPunch?.location || "NISIT HQ").toLowerCase();
        valB = (b.todayPunch?.location || "NISIT HQ").toLowerCase();
      } else if (presenceSortField === "score") {
        valA = parseFloat(a.punctualityScore || "100.0");
        valB = parseFloat(b.punctualityScore || "100.0");
      }
      if (valA < valB) return presenceSortAsc ? -1 : 1;
      if (valA > valB) return presenceSortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredPresence, presenceSortField, presenceSortAsc]);

  const totalPresencePages = Math.ceil(sortedPresence.length / presencePageSize) || 1;
  const paginatedPresence = useMemo(() => {
    const start = (presencePage - 1) * presencePageSize;
    return sortedPresence.slice(start, start + presencePageSize);
  }, [sortedPresence, presencePage, presencePageSize]);

  const exportPresenceCsv = () => {
    const headers = ["Employee Name", "Employee ID", "Division", "Status", "Clock In", "Location", "Punctuality Score"];
    const rows = sortedPresence.map((e) => [
      `"${e.name.replace(/"/g, '""')}"`,
      `"${e.employeeNumber || `EMP-#${e.id}`}"`,
      `"${(e.division || '').replace(/"/g, '""')}"`,
      `"${e.liveAttendanceStatus}"`,
      `"${e.todayPunch?.clockIn ? new Date(e.todayPunch.clockIn).toLocaleTimeString() : 'N/A'}"`,
      `"${(e.todayPunch?.location || 'NISIT HQ').replace(/"/g, '""')}"`,
      `"${e.punctualityScore || '100.0'}%"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NISIT_Live_Staff_Presence_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Time formatting in Pacific/Port_Moresby
  const pngTimeParts = useMemo(() => {
    try {
      const timeStr = currentTime.toLocaleTimeString("en-GB", { 
        timeZone: "Pacific/Port_Moresby", 
        hour: "2-digit", 
        minute: "2-digit", 
        second: "2-digit" 
      });
      const [hh, mm, ss] = timeStr.split(":");
      const dateStr = currentTime.toLocaleDateString("en-GB", {
        timeZone: "Pacific/Port_Moresby",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      return { hh: hh || "08", mm: mm || "00", ss: ss || "00", dateStr };
    } catch {
      return { hh: "08", mm: "00", ss: "00", dateStr: "Papua New Guinea Standard Time" };
    }
  }, [currentTime]);

  // Dynamic Theme Palette Resolver
  const themeClasses = useMemo(() => {
    if (theme === "png") {
      return {
        wrapper: "bg-[#0b0305] text-amber-50",
        header: "border-red-900/60 bg-[#160509]/95 backdrop-blur-md text-amber-100 shadow-xl",
        card: "bg-gradient-to-b from-[#1c070c]/95 to-[#120306]/95 border-red-800/60 shadow-2xl text-amber-50",
        subCard: "bg-[#0f0306]/90 border-red-900/60 text-amber-100",
        input: "bg-[#090204] border-red-800/80 text-amber-50 placeholder-red-900/80 focus:border-amber-400",
        border: "border-red-900/50",
        textMuted: "text-amber-200/60",
        textBold: "text-amber-50",
        glow: "shadow-red-950/80",
      };
    }
    if (theme === "light") {
      return {
        wrapper: "bg-slate-100 text-slate-900",
        header: "border-slate-300 bg-white/95 backdrop-blur-md shadow-sm text-slate-900",
        card: "bg-white border-slate-300 shadow-md text-slate-900",
        subCard: "bg-slate-50 border-slate-200 text-slate-800",
        input: "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-red-600",
        border: "border-slate-200",
        textMuted: "text-slate-500",
        textBold: "text-slate-900",
        glow: "shadow-red-200/50",
      };
    }
    if (theme === "emerald") {
      return {
        wrapper: "bg-[#021d16] text-emerald-50",
        header: "border-emerald-800/60 bg-[#04281f]/90 backdrop-blur-md text-emerald-100 shadow-lg",
        card: "bg-[#062c22]/90 border-emerald-700/60 shadow-2xl text-emerald-50",
        subCard: "bg-[#031d16]/80 border-emerald-800/80 text-emerald-100",
        input: "bg-[#021812] border-emerald-700/80 text-emerald-50 placeholder-emerald-600 focus:border-emerald-400",
        border: "border-emerald-800/60",
        textMuted: "text-emerald-300/70",
        textBold: "text-emerald-100",
        glow: "shadow-emerald-900/60",
      };
    }
    // Default Dark OLED
    return {
      wrapper: "bg-slate-950 text-slate-100",
      header: "border-slate-800 bg-slate-900/90 backdrop-blur-md text-slate-100 shadow-lg",
      card: "bg-slate-900/90 border-slate-800 shadow-2xl text-slate-100",
      subCard: "bg-slate-950/80 border-slate-800/80 text-slate-300",
      input: "bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-red-500",
      border: "border-slate-800",
      textMuted: "text-slate-400",
      textBold: "text-white",
      glow: "shadow-red-900/30",
    };
  }, [theme]);

  // Active officers clocked in right now (Muster count)
  const musterCount = useMemo(() => {
    return presenceList.filter((e) => e.liveAttendanceStatus === "present" || e.liveAttendanceStatus === "late").length;
  }, [presenceList]);

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 select-none ${themeClasses.wrapper}`}>
      {/* ========================================================================= */}
      {/* 1. INTELLIGENT TABLET HEADER & HARDWARE CONTROL BAR                       */}
      {/* ========================================================================= */}
      <header className={`border-b sticky top-0 z-40 px-3 sm:px-6 py-2.5 transition-colors duration-200 ${themeClasses.header}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Brand & Subtitle */}
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 transition-transform ${
              theme === "emerald"
                ? "bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 shadow-md shadow-emerald-950/40"
                : theme === "light"
                ? "bg-red-50 border border-red-200 text-red-600 shadow-sm"
                : "bg-red-600/20 border border-red-500/40 text-red-500 shadow-md"
            }`}>
              NI
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-base sm:text-lg">
                  PNG NISIT
                </span>
                <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold border ${
                  theme === "emerald"
                    ? "bg-emerald-950 text-emerald-300 border-emerald-700/60"
                    : theme === "light"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-red-950 text-red-400 border-red-800"
                }`}>
                  Smart Station v2.0
                </span>
              </div>
              <p className={`text-[11px] hidden sm:block ${themeClasses.textMuted}`}>
                National Institute of Standards and Industrial Technology • Turnstile Terminal
              </p>
            </div>
          </div>

          {/* Central Tablet Status Banner: Cloud Connection & Muster Count */}
          <div className="flex items-center gap-2">
            <div className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-xl border text-xs font-medium ${themeClasses.subCard}`}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold text-emerald-400">HR Cloud Synced</span>
              <span className={themeClasses.textMuted}>•</span>
              <span>Muster Count: <strong>{musterCount}</strong> On Duty</span>
            </div>
          </div>

          {/* Right Tablet Controls: Themes, Audio, Fullscreen & Admin */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Theme Selector (4 Adaptive Themes: PNG National / Emerald / Lobby / Dark) */}
            <div className={`flex items-center p-0.5 rounded-xl border ${themeClasses.subCard}`}>
              <button
                type="button"
                onClick={() => setTheme("png")}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  theme === "png"
                    ? "bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-sm ring-1 ring-amber-400/50"
                    : "opacity-60 hover:opacity-100"
                }`}
                title="NISIT / PNG National Theme (Red, Black & Gold)"
              >
                <Flame className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">NISIT/PNG</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("emerald")}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  theme === "emerald" ? "bg-emerald-600 text-white shadow-sm" : "opacity-60 hover:opacity-100"
                }`}
                title="NISIT Institutional Emerald"
              >
                <Landmark className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Emerald</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  theme === "light" ? "bg-slate-200 text-slate-900 shadow-sm" : "opacity-60 hover:opacity-100"
                }`}
                title="Sunlit Lobby (Light Mode)"
              >
                <Sun className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Light</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  theme === "dark" ? "bg-slate-700 text-white shadow-sm" : "opacity-60 hover:opacity-100"
                }`}
                title="Executive Night (OLED Dark Mode)"
              >
                <Moon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dark</span>
              </button>
            </div>

            {/* Audio Feedback Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) playKioskChime("click", true);
              }}
              className={`p-2 rounded-xl border transition ${
                soundEnabled 
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" 
                  : "bg-slate-900 border-slate-700 text-slate-500"
              }`}
              title={soundEnabled ? "Audio Chimes Enabled" : "Audio Chimes Muted"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Fullscreen Kiosk Mode Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className={`p-2 rounded-xl border transition ${themeClasses.subCard} hover:border-slate-500`}
              title="Toggle Fullscreen Tablet Kiosk Mode"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Android Tablet APK Deployment Console */}
            <button
              type="button"
              onClick={() => setShowApkModal(true)}
              className="px-2.5 py-1.5 rounded-xl border border-amber-600/60 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 hover:text-amber-200 text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Download & Deploy Native Android APK for Turnstiles & Tablets (v1.0)"
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xl:inline">Tablet .APK</span>
              <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">v1.0</span>
            </button>

            {/* ICT & HR Admin Access */}
            {token ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("station")}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
                    activeTab === "station" ? "bg-emerald-600 text-white shadow-md" : "border text-slate-300 hover:border-slate-400"
                  }`}
                  title="Main Turnstile Clocking Station"
                >
                  Turnstile Station
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("presence")}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
                    activeTab === "presence" ? "bg-emerald-600 text-white shadow-md" : "border text-slate-300 hover:border-slate-400"
                  }`}
                  title="Live Master Presence Board"
                >
                  Presence Board
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("enroll");
                    api.getEmployees().then(setEnrollStaffList).catch(() => {});
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1 ${
                    activeTab === "enroll" ? "bg-emerald-600 text-white shadow-md" : "border text-slate-300 hover:border-slate-400"
                  }`}
                  title="Enroll Staff Biometrics & RFID Credentials"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Enroll Biometrics</span>
                  <span className="md:hidden">Enroll</span>
                </button>
                <button
                  type="button"
                  onClick={handleAdminSignOut}
                  className="p-1.5 rounded-xl border border-red-800 text-red-400 hover:bg-red-950/40 transition"
                  title="Sign Out Admin"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAdminModal(true)}
                className={`p-2 rounded-xl border transition flex items-center gap-1.5 ${themeClasses.subCard} hover:border-red-500`}
                title="Restricted ICT & HR Administration Portal"
              >
                <Shield className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold hidden sm:inline">Admin</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. ADMIN AUTHENTICATION MODAL                                             */}
      {/* ========================================================================= */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100 relative overflow-hidden">
            <button
              onClick={() => setShowAdminModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">ICT & HR Administration</h3>
                <p className="text-xs text-slate-400">Restricted Management Console</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 mb-4 leading-relaxed">
              <strong className="text-slate-100 block mb-0.5">Notice for Staff:</strong>
              Daily sign-in and sign-out does not require email or password. Please use the main turnstile clocking station behind this modal.
            </div>

            {loginError && (
              <div className="p-3 mb-3 bg-red-950/60 border border-red-800 text-red-400 rounded-xl text-xs">
                {loginError}
              </div>
            )}

            <form onSubmit={handleManualLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Administrator Email
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@nisit.gov.pg"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Security Passcode
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter administrator password..."
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-950/50 transition flex items-center justify-center gap-2"
                >
                  {isLoggingIn ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Authenticating...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" /> Sign In to Administrative Console
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="text-xs text-slate-400 hover:text-slate-200 transition"
                >
                  Return to Staff Clocking Station
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2B. ANDROID TABLET APK DEPLOYMENT & INSTALLATION MODAL                     */}
      {/* ========================================================================= */}
      {showApkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#120306] border border-red-800/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-amber-50 relative overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-red-900/60 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-black text-base tracking-wide text-amber-200">NISIT Smart Station Android APK</h3>
                  <p className="text-xs text-amber-400/80 font-medium">Turnstile Tablet & Handheld Terminal Package v1.0</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApkModal(false)}
                className="p-1.5 rounded-xl border border-red-900/60 text-slate-400 hover:text-white hover:bg-red-950/40 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Highlight Banner */}
              <div className="p-3.5 rounded-2xl bg-[#1c070c] border border-amber-500/30 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                <div className="text-xs leading-relaxed text-amber-100">
                  <span className="font-bold text-amber-300">Signed Standalone Binary Ready:</span> Contains native WebRTC Face ID camera reticle, NFC smart card reader, and continuous sync to the NISIT HR Master Database.
                </div>
              </div>

              {/* Direct Download Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const downloadUrl = "/api/clocking/kiosk/apk";
                    window.location.assign(downloadUrl);
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-sm tracking-wide shadow-lg shadow-red-900/40 flex items-center justify-center gap-2.5 transition active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Production Tablet APK (v1.0 • 4.7 MB)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.location.assign("/api/clocking/kiosk/apk?debug=true");
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-red-900/60 bg-[#160509] hover:bg-[#20070d] text-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Download Developer / Debug APK (v1.0 • 5.7 MB)</span>
                </button>
              </div>

              {/* Direct Link & Copy */}
              <div className="p-3 rounded-xl bg-[#090204] border border-red-950 flex items-center justify-between gap-2">
                <div className="truncate text-[11px] font-mono text-amber-400/90 select-all">
                  {typeof window !== "undefined" ? `${window.location.origin}/api/clocking/kiosk/apk` : "http://72.60.233.213:8080/api/clocking/kiosk/apk"}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const url = typeof window !== "undefined" ? `${window.location.origin}/api/clocking/kiosk/apk` : "http://72.60.233.213:8080/api/clocking/kiosk/apk";
                    navigator.clipboard?.writeText(url);
                    setCopiedApkUrl(true);
                    setTimeout(() => setCopiedApkUrl(false), 2000);
                  }}
                  className="px-2 py-1 rounded-lg bg-red-900/60 hover:bg-red-800 text-[11px] text-amber-200 font-semibold shrink-0 transition flex items-center gap-1"
                >
                  {copiedApkUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedApkUrl ? "Copied" : "Copy"}</span>
                </button>
              </div>

              {/* Tablet Installation Instructions */}
              <div className="p-3.5 rounded-2xl bg-[#090204] border border-red-900/40 space-y-2 text-xs">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-amber-400" /> Tablet Installation Guide:
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-slate-300 text-[11px]">
                  <li>Open the download link on your Android tablet or transfer via USB.</li>
                  <li>In Android <span className="text-amber-200 font-medium">Settings &gt; Security</span>, enable <span className="text-amber-200 font-medium">Install unknown apps</span> for Files/Chrome.</li>
                  <li>Tap <span className="text-amber-200 font-medium">nisit-attendance-station-v1.0.apk</span> and select <span className="text-amber-200 font-medium">Install</span>.</li>
                  <li>Launch app: locks the screen awake, initializes the camera and NFC sensors, and syncs punches to the cloud.</li>
                </ol>
                <div className="pt-1 border-t border-red-950 text-[10px] text-slate-400">
                  <span className="text-amber-400 font-bold">PC / Windows Notice:</span> <code className="text-amber-300">.apk</code> files are Android installer packages. On Windows PCs/laptops, run this station directly in the browser or click the Chrome Install icon in the address bar to install as a desktop PWA.
                </div>
              </div>
            </div>

            <div className="text-center pt-4">
              <button
                type="button"
                onClick={() => setShowApkModal(false)}
                className="text-xs text-slate-400 hover:text-slate-200 transition"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MAIN TABLET VIEWPORT                                                   */}
      {/* ========================================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 flex flex-col justify-between">
        {activeTab === "station" && (
          <div className="space-y-4 sm:space-y-6 flex-1 flex flex-col justify-between">
            {/* ── TOP SECTION: GREETING & HUGE CLOCK PODIUM ──────────────────────── */}
            <div className={`p-5 sm:p-7 rounded-3xl text-center relative overflow-hidden border transition-all ${themeClasses.card}`}>
              {/* Subtle Ambient Radial Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-48 bg-emerald-500/10 blur-3xl pointer-events-none rounded-full"></div>

              {/* Time Intelligence & Greeting Banner */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-inner ${themeClasses.subCard}`}>
                  <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>{timeIntelligence.greeting}</span>
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${timeIntelligence.badgeColor}`}>
                  <Activity className="w-3 h-3 animate-ping" />
                  <span>{timeIntelligence.phase}</span>
                </span>
              </div>

              {/* Massive Digital Clock for 10" & 7" Tablet Visibility from 2-3 meters */}
              <div className="flex items-baseline justify-center select-none font-mono my-0 sm:my-1">
                <span className={`text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tight drop-shadow-md ${themeClasses.textBold}`}>
                  {pngTimeParts.hh}:{pngTimeParts.mm}
                </span>
                <span className="text-3xl sm:text-4xl md:text-5xl font-black text-red-500 ml-1.5 sm:ml-2">
                  :{pngTimeParts.ss}
                </span>
              </div>

              {/* Full Institutional Date */}
              <p className={`text-xs sm:text-sm font-bold uppercase tracking-widest mt-1 ${themeClasses.textMuted}`}>
                {pngTimeParts.dateStr} • Port Moresby (PGT / GMT+10)
              </p>

              {/* Live Guidance Underneath Clock */}
              <p className={`text-xs font-medium mt-1 ${themeClasses.textMuted}`}>
                {timeIntelligence.description}
              </p>
            </div>

            {/* ── UNIFIED SMART DIRECTION & ACTION BAR (CLEAN, SIMPLE, POWERFUL) ── */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border ${themeClasses.card} shadow-lg transition-all`}>
              <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                {/* Dynamic Status Beacon */}
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md transition-all ${
                    selectedPrompt === "in"
                      ? "bg-emerald-500 text-white shadow-emerald-500/30 ring-2 ring-emerald-400/40"
                      : selectedPrompt === "out"
                      ? "bg-amber-500 text-white shadow-amber-500/30 ring-2 ring-amber-400/40"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-emerald-950/40"
                  }`}>
                    {selectedPrompt === "in" && <Sun className="w-5 h-5" />}
                    {selectedPrompt === "out" && <Moon className="w-5 h-5" />}
                    {selectedPrompt === "auto" && <Sparkles className="w-5 h-5 animate-pulse text-emerald-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs sm:text-sm font-black uppercase tracking-wider ${themeClasses.textBold}`}>
                        {selectedPrompt === "in" && "Ready to Sign In (Clock In)"}
                        {selectedPrompt === "out" && "Ready to Sign Out (Clock Out)"}
                        {selectedPrompt === "auto" && "Smart Auto-Direction Active"}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        selectedPrompt === "auto"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : selectedPrompt === "in"
                          ? "bg-emerald-500 text-white"
                          : "bg-amber-500 text-white"
                      }`}>
                        {selectedPrompt === "auto" ? "Intelligent" : "Manual Override"}
                      </span>
                    </div>
                    <p className={`text-[11px] sm:text-xs ${themeClasses.textMuted} mt-0.5 truncate sm:whitespace-normal`}>
                      {selectedPrompt === "auto" && "Tap card, face, or fingerprint — signs In if arriving, or signs Out if already clocked in."}
                      {selectedPrompt === "in" && "Official check-in logged to Section 7 General Orders attendance registry."}
                      {selectedPrompt === "out" && "Concludes daily duty, calculates actual hours worked, and records shift departure."}
                    </p>
                  </div>
                </div>

                {/* 3-Way Mode Segmented Selector */}
                <div className={`flex items-center p-1 rounded-xl border ${themeClasses.subCard} shrink-0 w-full md:w-auto`}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPrompt("auto");
                      playKioskChime("click", soundEnabled);
                    }}
                    className={`flex-1 md:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      selectedPrompt === "auto"
                        ? "bg-emerald-500 text-white shadow-sm"
                        : `${themeClasses.textMuted} hover:text-white`
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPrompt("in");
                      playKioskChime("click", soundEnabled);
                    }}
                    className={`flex-1 md:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      selectedPrompt === "in"
                        ? "bg-emerald-500 text-white shadow-sm"
                        : `${themeClasses.textMuted} hover:text-white`
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPrompt("out");
                      playKioskChime("click", soundEnabled);
                    }}
                    className={`flex-1 md:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      selectedPrompt === "out"
                        ? "bg-amber-500 text-white shadow-sm"
                        : `${themeClasses.textMuted} hover:text-white`
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── VERIFICATION SUCCESS CONFIRMATION MODAL CARD ───────────────────── */}
            {confirmedPunch && (
              <div className="p-6 sm:p-8 rounded-3xl border-2 border-emerald-500 bg-emerald-950/90 text-white shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden text-center space-y-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/40">
                  <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-400 animate-in zoom-in" />
                </div>

                <div>
                  <span className="px-3 py-1 rounded-full bg-emerald-900 border border-emerald-600 text-emerald-200 text-xs font-extrabold uppercase tracking-wider">
                    Identity Verified & Attendance Confirmed
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black mt-2">
                    {confirmedPunch.action === "clock_in" ? "Morning Sign-In Registered!" : "Shift Sign-Out Registered!"}
                  </h2>
                  <p className="text-xs text-emerald-200 mt-1 max-w-md mx-auto">
                    {confirmedPunch.message}
                  </p>
                </div>

                {/* Officer Profile Card */}
                <div className="bg-slate-950/80 border border-emerald-700/60 rounded-2xl p-4 sm:p-5 text-left flex flex-col sm:flex-row items-center gap-4 max-w-xl mx-auto shadow-inner">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-black text-xl flex items-center justify-center shrink-0 shadow-lg">
                    {confirmedPunch.staff?.name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("") || "NI"}
                  </div>
                  <div className="flex-1 text-center sm:text-left min-w-0">
                    <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                      <h4 className="text-base sm:text-lg font-extrabold text-white truncate">{confirmedPunch.staff?.name}</h4>
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-bold uppercase">
                        Active Officer
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium truncate">
                      {confirmedPunch.staff?.positionTitle || "NISIT Technical Officer"}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                      Badge: {confirmedPunch.staff?.employeeNumber || `EMP-${confirmedPunch.staff?.id}`} • {confirmedPunch.staff?.departmentName || "NISIT HQ"}
                    </p>
                  </div>
                  <div className="text-center sm:text-right font-mono bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-800 shrink-0">
                    <span className="text-[9px] text-slate-400 block uppercase">Time Logged</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {confirmedPunch.timeString || new Date().toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Countdown & Reset Button */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 max-w-xl mx-auto">
                  <div className="text-xs text-emerald-200 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>Station resetting for next officer in <strong>{countdown}s</strong>...</span>
                  </div>
                  <button
                    type="button"
                    onClick={resetStationState}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition"
                  >
                    Next Officer in Line
                  </button>
                </div>
              </div>
            )}

            {/* Verification Loading State */}
            {isVerifyingStaff && (
              <div className={`p-8 rounded-3xl border text-center space-y-4 ${themeClasses.card}`}>
                <RefreshCw className="w-10 h-10 animate-spin mx-auto text-emerald-400" />
                <h3 className={`text-lg font-bold ${themeClasses.textBold}`}>Validating Staff Profile...</h3>
                <p className={`text-xs max-w-md mx-auto ${themeClasses.textMuted}`}>
                  Querying Central NISIT Master Personnel Database. Validating active status, turnstile clearance, and today's shift log.
                </p>
              </div>
            )}

            {/* Verification Error Toast */}
            {verificationError && !isVerifyingStaff && (
              <div className="p-4 rounded-2xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-start gap-3 shadow-lg">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-bold text-red-300">Staff Verification Failed</h4>
                  <p className="mt-0.5 text-red-200/90">{verificationError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setVerificationError(null)}
                  className="px-3 py-1 rounded-lg bg-red-900/60 hover:bg-red-900 text-white text-xs font-semibold"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* ── REGISTERED BIOMETRIC & SCANNING METHODS ────────────────────────── */}
            {!confirmedPunch && !isVerifyingStaff && (
              <div className={`p-5 sm:p-7 rounded-3xl border transition-all space-y-5 ${themeClasses.card}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className={`text-base sm:text-lg font-extrabold flex items-center gap-2 ${themeClasses.textBold}`}>
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      Select Registered Punch Method
                    </h3>
                    <p className={`text-xs ${themeClasses.textMuted}`}>
                      Tap your Smart ID Card, present your face or biometric fingerprint, or enter your official PIN.
                    </p>
                  </div>
                  <span className={`text-[11px] font-mono px-3 py-1 rounded-lg border font-bold self-start ${themeClasses.subCard} text-emerald-400`}>
                    Tablet Optical Engine: Ready
                  </span>
                </div>

                {/* 6 Method Selector Segmented Buttons (Touch-Optimized for Tablets) */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRegisteredMethod("card");
                      playKioskChime("click", soundEnabled);
                    }}
                    className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 min-h-[68px] ${
                      registeredMethod === "card"
                        ? "bg-red-600/20 border-red-500 shadow-md ring-2 ring-red-500/20 font-bold"
                        : `${themeClasses.subCard} hover:border-slate-500`
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-red-400" />
                    <span className="text-xs">Smart Card</span>
                    <span className="text-[9px] opacity-60">RFID / NFC Tap</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRegisteredMethod("face");
                      playKioskChime("click", soundEnabled);
                    }}
                    className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 min-h-[68px] ${
                      registeredMethod === "face"
                        ? "bg-blue-600/20 border-blue-500 shadow-md ring-2 ring-blue-500/20 font-bold"
                        : `${themeClasses.subCard} hover:border-slate-500`
                    }`}
                  >
                    <ScanFace className="w-5 h-5 text-blue-400" />
                    <span className="text-xs">Face ID</span>
                    <span className="text-[9px] opacity-60">3D Biometric</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRegisteredMethod("fingerprint");
                      playKioskChime("click", soundEnabled);
                    }}
                    className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 min-h-[68px] ${
                      registeredMethod === "fingerprint"
                        ? "bg-emerald-600/20 border-emerald-500 shadow-md ring-2 ring-emerald-500/20 font-bold"
                        : `${themeClasses.subCard} hover:border-slate-500`
                    }`}
                  >
                    <Fingerprint className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs">Fingerprint</span>
                    <span className="text-[9px] opacity-60">Optical Sensor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRegisteredMethod("iris");
                      playKioskChime("click", soundEnabled);
                    }}
                    className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 min-h-[68px] ${
                      registeredMethod === "iris"
                        ? "bg-purple-600/20 border-purple-500 shadow-md ring-2 ring-purple-500/20 font-bold"
                        : `${themeClasses.subCard} hover:border-slate-500`
                    }`}
                  >
                    <Eye className="w-5 h-5 text-purple-400" />
                    <span className="text-xs">IRIS Scan</span>
                    <span className="text-[9px] opacity-60">Infrared Eye</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRegisteredMethod("pin");
                      playKioskChime("click", soundEnabled);
                    }}
                    className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 min-h-[68px] ${
                      registeredMethod === "pin"
                        ? "bg-amber-600/20 border-amber-500 shadow-md ring-2 ring-amber-500/20 font-bold"
                        : `${themeClasses.subCard} hover:border-slate-500`
                    }`}
                  >
                    <KeyRound className="w-5 h-5 text-amber-400" />
                    <span className="text-xs">Security PIN</span>
                    <span className="text-[9px] opacity-60">Touch Pad</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRegisteredMethod("qr");
                      playKioskChime("click", soundEnabled);
                    }}
                    className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 min-h-[68px] ${
                      registeredMethod === "qr"
                        ? "bg-teal-600/20 border-teal-500 shadow-md ring-2 ring-teal-500/20 font-bold"
                        : `${themeClasses.subCard} hover:border-slate-500`
                    }`}
                  >
                    <QrCode className="w-5 h-5 text-teal-400" />
                    <span className="text-xs">QR Pass</span>
                    <span className="text-[9px] opacity-60">Turnstile TOTP</span>
                  </button>
                </div>

                {/* METHOD VIEW A: SMART CARD / RFID TAP */}
                {registeredMethod === "card" && (
                  <div className={`p-5 rounded-2xl border ${themeClasses.subCard}`}>
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <div className="w-36 h-28 rounded-2xl bg-gradient-to-tr from-slate-950 to-slate-800 border-2 border-red-500/60 flex flex-col items-center justify-center p-3 shadow-xl shrink-0 text-center relative group">
                        <CreditCard className="w-10 h-10 text-red-400 mb-1 animate-pulse" />
                        <span className="text-[10px] font-mono text-slate-300 font-bold">TAP CARD / BADGE</span>
                        <div className="absolute inset-0 rounded-2xl border border-red-400/30 animate-radar pointer-events-none"></div>
                      </div>

                      <div className="flex-1 w-full space-y-3">
                        <div>
                          <label className={`text-xs font-bold block mb-1 ${themeClasses.textBold}`}>
                            RFID Contactless Card & Barcode Reader
                          </label>
                          <p className={`text-xs ${themeClasses.textMuted}`}>
                            Tap your smart card against the external USB/Bluetooth reader, or type employee badge ID below:
                          </p>
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            executeStaffVerificationAndPunch(stationInput, "card");
                          }}
                          className="flex gap-2"
                        >
                          <input
                            ref={cardInputRef}
                            type="text"
                            value={stationInput}
                            onChange={(e) => setStationInput(e.target.value)}
                            placeholder="e.g. NISIT-EMP-10001, NISIT-EMP-10005..."
                            className={`flex-1 rounded-xl px-4 py-3 text-xs font-mono border focus:outline-none ${themeClasses.input}`}
                          />
                          <button
                            type="submit"
                            disabled={!stationInput.trim()}
                            className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 shrink-0"
                          >
                            <UserCheck className="w-4 h-4" /> Verify
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                )}

                {/* METHOD VIEW B: BIOMETRIC FACIAL RECOGNITION (WITH REAL CAMERA STREAM OPTION) */}
                {registeredMethod === "face" && (
                  <div className={`p-5 rounded-2xl border ${themeClasses.subCard}`}>
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      {/* Video / Camera Viewport HUD */}
                      <div className="w-64 h-56 bg-black border-2 border-blue-500/70 rounded-2xl relative overflow-hidden flex flex-col items-center justify-center shadow-2xl shrink-0">
                        {useCamera ? (
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover mirror"
                          />
                        ) : (
                          <div className="w-28 h-36 border-2 border-dashed border-blue-400/80 rounded-full flex items-center justify-center relative">
                            <ScanFace className="w-16 h-16 text-blue-400/80" />
                          </div>
                        )}

                        {/* Animated Laser Scanning Line */}
                        <div className="absolute inset-x-0 h-0.5 bg-blue-400 shadow-[0_0_12px_#60a5fa] animate-scan-laser pointer-events-none"></div>

                        {/* HUD corner brackets */}
                        <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-blue-400"></div>
                        <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-blue-400"></div>
                        <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-blue-400"></div>
                        <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-blue-400"></div>

                        <span className="absolute bottom-2 text-[10px] font-mono font-bold text-blue-300 uppercase tracking-wider bg-black/60 px-2 py-0.5 rounded">
                          {useCamera ? "Live Front Camera Active" : "3D Mesh Simulator"}
                        </span>
                      </div>

                      <div className="flex-1 w-full space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className={`text-sm font-bold ${themeClasses.textBold}`}>
                              3D Facial Geometry & Liveness Engine
                            </h4>
                            <p className={`text-xs ${themeClasses.textMuted}`}>
                              ISO/IEC 19794-5 compliant facial feature alignment.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setUseCamera(!useCamera)}
                            className="text-xs px-2.5 py-1 rounded-lg border border-blue-500/40 text-blue-400 hover:bg-blue-950/40 transition font-semibold"
                          >
                            {useCamera ? "Use Simulator" : "Enable Tablet Camera"}
                          </button>
                        </div>

                        {cameraError && (
                          <p className="text-[11px] text-amber-400">{cameraError}</p>
                        )}

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            executeStaffVerificationAndPunch(stationInput || "NISIT-EMP-10001", "face");
                          }}
                          className="flex gap-2"
                        >
                          <input
                            type="text"
                            value={stationInput}
                            onChange={(e) => setStationInput(e.target.value)}
                            placeholder="Enter officer badge ID or scan face..."
                            className={`flex-1 rounded-xl px-4 py-3 text-xs font-mono border focus:outline-none ${themeClasses.input}`}
                          />
                          <button
                            type="submit"
                            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 shrink-0"
                          >
                            <Camera className="w-4 h-4" /> Capture Face
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                )}

                {/* METHOD VIEW C: BIOMETRIC FINGERPRINT SCANNER */}
                {registeredMethod === "fingerprint" && (
                  <div className={`p-5 rounded-2xl border ${themeClasses.subCard}`}>
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <div className="w-40 h-40 rounded-full bg-slate-950 border-4 border-emerald-500/70 flex flex-col items-center justify-center p-4 shadow-2xl shrink-0 relative overflow-hidden group">
                        <Fingerprint className="w-20 h-20 text-emerald-400 group-hover:scale-105 transition-transform" />
                        <span className="text-[10px] font-mono text-emerald-400 mt-1 uppercase font-bold">500 DPI Optical</span>
                        <div className="absolute inset-x-0 h-1 bg-emerald-400/90 shadow-[0_0_12px_#34d399] animate-scan-laser pointer-events-none"></div>
                      </div>

                      <div className="flex-1 w-full space-y-3">
                        <div>
                          <h4 className={`text-sm font-bold ${themeClasses.textBold}`}>
                            Optical Fingerprint Sensor Pad
                          </h4>
                          <p className={`text-xs ${themeClasses.textMuted}`}>
                            Place registered thumb or index finger firmly against the sensor. Hardware calibrated to ANSI-NIST biometric standards.
                          </p>
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            executeStaffVerificationAndPunch(stationInput || "NISIT-EMP-10001", "fingerprint");
                          }}
                          className="flex gap-2"
                        >
                          <input
                            type="text"
                            value={stationInput}
                            onChange={(e) => setStationInput(e.target.value)}
                            placeholder="Enter officer badge ID or scan finger..."
                            className={`flex-1 rounded-xl px-4 py-3 text-xs font-mono border focus:outline-none ${themeClasses.input}`}
                          />
                          <button
                            type="submit"
                            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 shrink-0"
                          >
                            <Fingerprint className="w-4 h-4" /> Scan Finger
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                )}

                {/* METHOD VIEW D: BIOMETRIC IRIS RECOGNITION */}
                {registeredMethod === "iris" && (
                  <div className={`p-5 rounded-2xl border ${themeClasses.subCard}`}>
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <div className="w-64 h-36 bg-slate-950 border-2 border-purple-500/70 rounded-2xl flex items-center justify-around p-3 shadow-2xl shrink-0 relative overflow-hidden">
                        <div className="w-20 h-20 rounded-full border-2 border-dashed border-purple-400 flex items-center justify-center">
                          <Eye className="w-8 h-8 text-purple-400" />
                        </div>
                        <div className="w-20 h-20 rounded-full border-2 border-dashed border-purple-400 flex items-center justify-center">
                          <Eye className="w-8 h-8 text-purple-400" />
                        </div>
                        <div className="absolute bottom-2 text-[10px] font-mono text-purple-400 font-bold uppercase bg-black/60 px-2 py-0.5 rounded">
                          Twin Infrared Sensors Active
                        </div>
                      </div>

                      <div className="flex-1 w-full space-y-3">
                        <div>
                          <h4 className={`text-sm font-bold ${themeClasses.textBold}`}>
                            Twin Infrared IRIS & Retinal Scanner
                          </h4>
                          <p className={`text-xs ${themeClasses.textMuted}`}>
                            Position eyes 20–30cm from the twin infrared cameras. Eye alignment matches encrypted mathematical iris hashes.
                          </p>
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            executeStaffVerificationAndPunch(stationInput || "NISIT-EMP-10001", "iris");
                          }}
                          className="flex gap-2"
                        >
                          <input
                            type="text"
                            value={stationInput}
                            onChange={(e) => setStationInput(e.target.value)}
                            placeholder="Enter officer badge ID or scan finger..."
                            className={`flex-1 rounded-xl px-4 py-3 text-xs font-mono border focus:outline-none ${themeClasses.input}`}
                          />
                          <button
                            type="submit"
                            className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 shrink-0"
                          >
                            <Eye className="w-4 h-4" /> Scan Iris
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                )}

                {/* METHOD VIEW E: TOUCH PINPAD FOR 7" & 10" TABLETS */}
                {registeredMethod === "pin" && (
                  <div className={`p-5 rounded-2xl border ${themeClasses.subCard}`}>
                    <div className="max-w-xs sm:max-w-sm mx-auto space-y-3">
                      <div>
                        <label className={`text-xs font-bold block mb-1 ${themeClasses.textBold}`}>
                          Officer Badge ID
                        </label>
                        <input
                          type="text"
                          value={stationInput}
                          onChange={(e) => setStationInput(e.target.value)}
                          placeholder="e.g. NISIT-EMP-10001"
                          className={`w-full rounded-xl px-4 py-2.5 text-xs font-mono border focus:outline-none ${themeClasses.input}`}
                        />
                      </div>

                      <div>
                        <label className={`text-xs font-bold block mb-1 ${themeClasses.textBold}`}>
                          Security Passcode PIN
                        </label>
                        <div className={`w-full py-3 px-4 rounded-xl border text-center font-mono text-xl tracking-widest ${themeClasses.subCard}`}>
                          {stationPinInput ? "● ".repeat(stationPinInput.length) : "••••"}
                        </div>
                      </div>

                      {/* Tablet Touch Digital 10-Keypad */}
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                          <button
                            key={digit}
                            type="button"
                            onClick={() => {
                              playKioskChime("click", soundEnabled);
                              setStationPinInput((prev) => (prev.length < 6 ? prev + digit : prev));
                            }}
                            className={`py-3.5 rounded-xl border text-base font-bold shadow-sm transition active:scale-95 ${themeClasses.subCard} hover:border-slate-500`}
                          >
                            {digit}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            playKioskChime("click", soundEnabled);
                            setStationPinInput("");
                          }}
                          className={`py-3.5 rounded-xl border text-xs font-bold transition text-red-400 active:scale-95 ${themeClasses.subCard}`}
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playKioskChime("click", soundEnabled);
                            setStationPinInput((prev) => (prev.length < 6 ? prev + "0" : prev));
                          }}
                          className={`py-3.5 rounded-xl border text-base font-bold shadow-sm transition active:scale-95 ${themeClasses.subCard} hover:border-slate-500`}
                        >
                          0
                        </button>
                        <button
                          type="button"
                          onClick={() => executeStaffVerificationAndPunch(stationPinInput.trim() || stationInput.trim(), "pin")}
                          disabled={!stationInput.trim() && !stationPinInput.trim()}
                          className="py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1 active:scale-95"
                        >
                          <Check className="w-4 h-4" /> Enter
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* METHOD VIEW F: TURNSTILE QR SCANNER */}
                {registeredMethod === "qr" && (
                  <div className={`p-5 rounded-2xl border ${themeClasses.subCard}`}>
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <div className="w-48 h-48 bg-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-2xl shrink-0 text-slate-900 relative">
                        <QrCode className="w-28 h-28 text-slate-900" />
                        <span className="font-mono text-[9px] font-bold text-slate-700 uppercase mt-1">
                          Optical QR Laser
                        </span>
                        <div className="absolute inset-x-0 h-0.5 bg-red-600 shadow-[0_0_8px_#ef4444] animate-scan-laser pointer-events-none"></div>
                      </div>

                      <div className="flex-1 w-full space-y-3">
                        <div>
                          <h4 className={`text-sm font-bold ${themeClasses.textBold}`}>
                            Dynamic Turnstile QR Pass Scanner
                          </h4>
                          <p className={`text-xs ${themeClasses.textMuted}`}>
                            Present your rotating TOTP turnstile barcode from the NISIT Mobile App to the optical lens.
                          </p>
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            executeStaffVerificationAndPunch(stationInput || "NISIT-EMP-10001", "qr");
                          }}
                          className="flex gap-2"
                        >
                          <input
                            type="text"
                            value={stationInput}
                            onChange={(e) => setStationInput(e.target.value)}
                            placeholder="Enter officer badge ID or scan finger..."
                            className={`flex-1 rounded-xl px-4 py-3 text-xs font-mono border focus:outline-none ${themeClasses.input}`}
                          />
                          <button
                            type="submit"
                            className="px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 shrink-0"
                          >
                            <QrCode className="w-4 h-4" /> Scan Pass
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ADMIN TAB: MASTER STAFF PRESENCE BOARD                                    */}
        {/* ========================================================================= */}
        {activeTab === "presence" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`p-4 rounded-xl border ${themeClasses.card}`}>
                <span className={`text-xs font-semibold block ${themeClasses.textMuted}`}>Total Active Staff</span>
                <span className={`text-2xl font-black ${themeClasses.textBold}`}>{presenceList.length}</span>
              </div>
              <div className={`p-4 rounded-xl border ${themeClasses.card}`}>
                <span className={`text-xs font-semibold block ${themeClasses.textMuted}`}>Clocked In (Present in HQ)</span>
                <span className="text-2xl font-black text-emerald-400">
                  {presenceList.filter((e) => e.liveAttendanceStatus === "present" || e.liveAttendanceStatus === "late").length}
                </span>
              </div>
              <div className={`p-4 rounded-xl border ${themeClasses.card}`}>
                <span className={`text-xs font-semibold block ${themeClasses.textMuted}`}>In Field Duty</span>
                <span className="text-2xl font-black text-blue-400">
                  {presenceList.filter((e) => e.liveAttendanceStatus === "in_field").length}
                </span>
              </div>
              <div className={`p-4 rounded-xl border ${themeClasses.card}`}>
                <span className={`text-xs font-semibold block ${themeClasses.textMuted}`}>Not Yet Reported (Pending/Absent)</span>
                <span className="text-2xl font-black text-rose-400">
                  {presenceList.filter((e) => e.liveAttendanceStatus === "not_reported" || !e.todayPunch?.clockIn).length}
                </span>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-3 ${themeClasses.card}`}>
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                  <input
                    type="text"
                    placeholder="Search staff by name, division, or ID..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPresencePage(1);
                    }}
                    className={`rounded-xl pl-9 pr-3 py-2 text-xs w-full sm:w-64 border focus:outline-none ${themeClasses.input}`}
                  />
                </div>

                <select
                  value={presenceFilter}
                  onChange={(e) => {
                    setPresenceFilter(e.target.value);
                    setPresencePage(1);
                  }}
                  className={`rounded-xl px-3 py-2 text-xs border focus:outline-none ${themeClasses.subCard}`}
                >
                  <option value="all">All Staff Statuses</option>
                  <option value="present">Present (In HQ)</option>
                  <option value="not_reported">Not Reported (Pending/Absent)</option>
                  <option value="in_field">In Field Duty</option>
                  <option value="departed">Shift Concluded / Departed</option>
                </select>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={exportPresenceCsv}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-md"
                >
                  <Printer className="w-3.5 h-3.5" /> Muster Roll
                </button>
              </div>
            </div>

            <div className={`rounded-2xl border overflow-hidden ${themeClasses.card}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className={`border-b text-[10px] uppercase tracking-wider font-semibold ${themeClasses.subCard} ${themeClasses.textMuted}`}>
                    <tr>
                      <th className="py-3 px-4">Staff Name & ID</th>
                      <th className="py-3 px-4">Division / Unit</th>
                      <th className="py-3 px-4">Live Status</th>
                      <th className="py-3 px-4">Clock-In Time</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Score</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${themeClasses.border}`}>
                    {paginatedPresence.map((emp) => (
                      <tr key={emp.id} className="hover:bg-black/10 transition">
                        <td className="py-3 px-4 font-bold">
                          <div className={themeClasses.textBold}>{emp.name}</div>
                          <span className={`text-[10px] font-mono font-normal ${themeClasses.textMuted}`}>
                            {emp.employeeNumber || `EMP-#${emp.id}`}
                          </span>
                        </td>
                        <td className={`py-3 px-4 font-medium ${themeClasses.textMuted}`}>
                          {emp.division || "National Metrology Testing Wing"}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                            emp.liveAttendanceStatus === "present"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : emp.liveAttendanceStatus === "late"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                              : emp.liveAttendanceStatus === "in_field"
                              ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                              : emp.liveAttendanceStatus === "departed" || emp.todayPunch?.clockOut
                              ? "bg-slate-700/40 text-slate-300 border border-slate-600/50"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                          }`}>
                            {emp.liveAttendanceStatus === "not_reported" || !emp.todayPunch?.clockIn
                              ? "Not Reported"
                              : emp.liveAttendanceStatus === "departed"
                              ? "Shift Concluded"
                              : emp.liveAttendanceStatus === "in_field"
                              ? "Field Duty"
                              : emp.liveAttendanceStatus === "late"
                              ? "Late Entry"
                              : "Present"}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {emp.todayPunch?.clockIn
                            ? new Date(emp.todayPunch.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : "—"}
                        </td>
                        <td className={`py-3 px-4 ${themeClasses.textMuted}`}>
                          {emp.todayPunch?.location || "NISIT HQ"}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          {emp.punctualityScore ? (
                            <span className={Number(emp.punctualityScore) >= 90 ? "text-emerald-400" : Number(emp.punctualityScore) >= 75 ? "text-amber-400" : "text-rose-400"}>
                              {emp.punctualityScore}%
                            </span>
                          ) : (
                            <span className="opacity-40 font-normal text-[11px] text-muted-foreground">
                              — (No baseline)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ADMIN TAB: IN-KIOSK STAFF BIOMETRIC & CREDENTIAL ENROLLMENT               */}
        {/* ========================================================================= */}
        {activeTab === "enroll" && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className={`p-5 sm:p-6 rounded-3xl border ${themeClasses.card} shadow-xl space-y-3`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className={`text-base sm:text-lg font-extrabold ${themeClasses.textBold}`}>
                      Staff Credential & Biometric Enrollment Station
                    </h3>
                    <p className={`text-xs ${themeClasses.textMuted}`}>
                      Hardware terminal tool for ICT Administration & HR to enroll RFID badges, attendance PINs, and biometrics.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("station")}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${themeClasses.subCard} hover:border-slate-500`}
                >
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Back to Clock Station
                </button>
              </div>

              {enrollFeedback && (
                <div className={`p-4 rounded-2xl text-xs flex items-start gap-3 shadow-md animate-in fade-in duration-200 ${
                  enrollFeedback.success
                    ? "bg-emerald-950/80 border border-emerald-700 text-emerald-200"
                    : "bg-red-950/80 border border-red-700 text-red-200"
                }`}>
                  {enrollFeedback.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h5 className="font-bold">{enrollFeedback.success ? "Enrollment Successful" : "Enrollment Error"}</h5>
                    <p className="mt-0.5 opacity-90">{enrollFeedback.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnrollFeedback(null)}
                    className="text-xs opacity-60 hover:opacity-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
                {/* Left Column: Select Officer */}
                <div className="md:col-span-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className={`text-xs font-bold uppercase tracking-wider ${themeClasses.textBold}`}>
                      1. Select NISIT Officer
                    </label>
                    <span className={`text-[10px] font-mono ${themeClasses.textMuted}`}>
                      {enrollStaffList.length} Active Staff
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                    <input
                      type="text"
                      placeholder="Search by officer name..."
                      value={enrollSearch}
                      onChange={(e) => setEnrollSearch(e.target.value)}
                      className={`w-full rounded-xl pl-9 pr-3 py-2 text-xs border focus:outline-none ${themeClasses.input}`}
                    />
                  </div>

                  <div className={`max-h-72 overflow-y-auto rounded-2xl border divide-y ${themeClasses.subCard} ${themeClasses.border}`}>
                    {enrollStaffList
                      .filter((s) => s.name.toLowerCase().includes(enrollSearch.toLowerCase()))
                      .map((staff) => {
                        const isSelected = selectedEnrollEmpId === staff.id;
                        return (
                          <button
                            key={staff.id}
                            type="button"
                            onClick={() => handleSelectStaffForEnroll(staff.id)}
                            className={`w-full text-left p-3 transition flex items-center justify-between gap-2 ${
                              isSelected
                                ? "bg-emerald-600/20 border-l-4 border-l-emerald-500 font-bold"
                                : "hover:bg-black/10"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className={`text-xs truncate ${themeClasses.textBold}`}>{staff.name}</div>
                              <div className={`text-[10px] font-mono truncate ${themeClasses.textMuted}`}>
                                {staff.employeeNumber || `EMP-${staff.id}`} • {staff.departmentName || "NISIT HQ"}
                              </div>
                            </div>
                            {isSelected && <BadgeCheck className="w-4 h-4 text-emerald-400 shrink-0" />}
                          </button>
                        );
                      })}
                    {enrollStaffList.length === 0 && (
                      <div className={`p-4 text-center text-xs ${themeClasses.textMuted}`}>
                        Loading master personnel register...
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Credentials & Biometrics */}
                <div className="md:col-span-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className={`text-xs font-bold uppercase tracking-wider ${themeClasses.textBold}`}>
                      2. Configure Credentials & Biometric Profiles
                    </label>
                  </div>

                  {selectedEnrollEmpId ? (
                    <form onSubmit={handleSaveStaffEnrollment} className="space-y-4">
                      {/* Selected Officer Snapshot */}
                      {(() => {
                        const activeOfficer = enrollStaffList.find((e) => e.id === selectedEnrollEmpId);
                        if (!activeOfficer) return null;
                        return (
                          <div className={`p-3.5 rounded-2xl border flex items-center gap-3 ${themeClasses.subCard}`}>
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-black text-base flex items-center justify-center shrink-0 shadow-md">
                              {activeOfficer.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className={`text-sm font-bold truncate ${themeClasses.textBold}`}>{activeOfficer.name}</h4>
                              <p className={`text-xs truncate ${themeClasses.textMuted}`}>{activeOfficer.positionTitle || "Technical Specialist"}</p>
                              <p className={`text-[10px] font-mono ${themeClasses.textMuted}`}>Master Badge: {activeOfficer.employeeNumber || `EMP-${activeOfficer.id}`}</p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Smart Card / RFID Field */}
                      <div className="space-y-1.5">
                        <label className={`text-xs font-semibold flex items-center gap-1.5 ${themeClasses.textBold}`}>
                          <CreditCard className="w-3.5 h-3.5 text-red-400" />
                          Smart Card / RFID Badge Serial UID
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={enrollRfid}
                            onChange={(e) => setEnrollRfid(e.target.value)}
                            placeholder="e.g. RFID-10001 (or tap card on tablet reader)"
                            className={`flex-1 rounded-xl px-3.5 py-2.5 text-xs font-mono border focus:outline-none ${themeClasses.input}`}
                          />
                          <button
                            type="button"
                            onClick={() => setEnrollRfid(`RFID-${10000 + Number(selectedEnrollEmpId)}`)}
                            className={`px-3 py-2 rounded-xl border text-xs font-bold transition ${themeClasses.subCard} hover:border-slate-500`}
                          >
                            Default
                          </button>
                        </div>
                      </div>

                      {/* Attendance Security PIN */}
                      <div className="space-y-1.5">
                        <label className={`text-xs font-semibold flex items-center gap-1.5 ${themeClasses.textBold}`}>
                          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                          Attendance Passcode PIN (4 Digits)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            maxLength={6}
                            value={enrollPin}
                            onChange={(e) => setEnrollPin(e.target.value)}
                            placeholder="Set or reset 4-digit PIN..."
                            className={`flex-1 rounded-xl px-3.5 py-2.5 text-xs font-mono border focus:outline-none ${themeClasses.input}`}
                          />
                          <button
                            type="button"
                            onClick={() => setEnrollPin(String(1000 + (Number(selectedEnrollEmpId) % 900)))}
                            className={`px-3 py-2 rounded-xl border text-xs font-bold transition ${themeClasses.subCard} hover:border-slate-500`}
                          >
                            Generate
                          </button>
                        </div>
                      </div>

                      {/* Biometric Permissions Grid */}
                      <div className="space-y-2 pt-1">
                        <label className={`text-xs font-semibold block ${themeClasses.textBold}`}>
                          Enrolled Biometric Recognition Modalities
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {/* Face ID Toggle */}
                          <div
                            onClick={() => setEnrollFace(!enrollFace)}
                            className={`p-3 rounded-xl border cursor-pointer transition select-none flex flex-col justify-between ${
                              enrollFace
                                ? "bg-blue-600/20 border-blue-500 shadow-sm"
                                : `${themeClasses.subCard} opacity-60`
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <ScanFace className="w-4 h-4 text-blue-400" />
                              <span className={`text-[10px] font-bold ${enrollFace ? "text-blue-400" : "text-slate-500"}`}>
                                {enrollFace ? "ENABLED" : "DISABLED"}
                              </span>
                            </div>
                            <div className="mt-2">
                              <div className="text-xs font-bold text-white">Face ID</div>
                              <div className="text-[9px] text-slate-400">Front Cam Reticle</div>
                            </div>
                          </div>

                          {/* Fingerprint Toggle */}
                          <div
                            onClick={() => setEnrollFingerprint(!enrollFingerprint)}
                            className={`p-3 rounded-xl border cursor-pointer transition select-none flex flex-col justify-between ${
                              enrollFingerprint
                                ? "bg-emerald-600/20 border-emerald-500 shadow-sm"
                                : `${themeClasses.subCard} opacity-60`
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <Fingerprint className="w-4 h-4 text-emerald-400" />
                              <span className={`text-[10px] font-bold ${enrollFingerprint ? "text-emerald-400" : "text-slate-500"}`}>
                                {enrollFingerprint ? "ENABLED" : "DISABLED"}
                              </span>
                            </div>
                            <div className="mt-2">
                              <div className="text-xs font-bold text-white">Fingerprint</div>
                              <div className="text-[9px] text-slate-400">Optical Minutiae</div>
                            </div>
                          </div>

                          {/* IRIS Scanner Toggle */}
                          <div
                            onClick={() => setEnrollIris(!enrollIris)}
                            className={`p-3 rounded-xl border cursor-pointer transition select-none flex flex-col justify-between ${
                              enrollIris
                                ? "bg-purple-600/20 border-purple-500 shadow-sm"
                                : `${themeClasses.subCard} opacity-60`
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <Eye className="w-4 h-4 text-purple-400" />
                              <span className={`text-[10px] font-bold ${enrollIris ? "text-purple-400" : "text-slate-500"}`}>
                                {enrollIris ? "ENABLED" : "DISABLED"}
                              </span>
                            </div>
                            <div className="mt-2">
                              <div className="text-xs font-bold text-white">IRIS Scanner</div>
                              <div className="text-[9px] text-slate-400">Infrared Reticle</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const emp = enrollStaffList.find((e) => e.id === selectedEnrollEmpId);
                            if (emp) {
                              setActiveTab("station");
                              executeStaffVerificationAndPunch(emp.rfidCardNumber || emp.employeeNumber, "card");
                            }
                          }}
                          className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${themeClasses.subCard} hover:border-slate-500`}
                        >
                          <Activity className="w-3.5 h-3.5 text-emerald-400" /> Test Punch on Station
                        </button>

                        <button
                          type="submit"
                          disabled={isSavingEnroll}
                          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition flex items-center gap-2"
                        >
                          {isSavingEnroll ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Enrolling to HR Cloud...
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" /> Save & Enroll to HR Cloud
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className={`p-8 rounded-2xl border text-center space-y-2 ${themeClasses.subCard}`}>
                      <Users className="w-8 h-8 mx-auto opacity-40 text-emerald-400" />
                      <h4 className={`text-sm font-bold ${themeClasses.textBold}`}>No Officer Selected</h4>
                      <p className={`text-xs max-w-xs mx-auto ${themeClasses.textMuted}`}>
                        Select an officer from the list on the left to review or configure their turnstile cards, PINs, and biometric credentials.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
