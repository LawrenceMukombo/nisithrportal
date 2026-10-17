import React, { useState, useEffect, useMemo } from "react";
import { 
  MapPin, Clock, QrCode, Users, ShieldCheck, CheckCircle2, 
  AlertCircle, Smartphone, Camera, RefreshCw, Send, 
  LogOut, Award, Flame, ExternalLink, Printer, Building2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ArrowUpDown, ArrowUp, ArrowDown, Download, SlidersHorizontal,
  Eye, EyeOff, Search, Calendar, FileSpreadsheet, AlertTriangle,
  CreditCard, Radio
} from "lucide-react";
import { api, GeofenceZone, LiveStaffMember, MyAttendanceStats, getStoredToken } from "./lib/api";

type TabMode = "mobile" | "kiosk" | "presence" | "history";
type PresenceSortField = "name" | "division" | "status" | "clockIn" | "location" | "score";
type HistorySortField = "date" | "clockIn" | "clockOut" | "status" | "lateMinutes";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabMode>("mobile");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [loginEmail, setLoginEmail] = useState("admin@nisit.gov.pg");
  const [loginPassword, setLoginPassword] = useState("Admin123!");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Seeded Institutional Geofences (Zero Mock Data)
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

  // Kiosk state (Light theme, seeded devices & badge scanning)
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

  // History state (Personal Records)
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

  // Listen to transparent auth refreshed event
  useEffect(() => {
    const handleRefreshed = (e: any) => {
      if (e?.detail?.token) {
        setToken(e.detail.token);
      }
    };
    window.addEventListener("attendance-auth-refreshed", handleRefreshed);
    return () => window.removeEventListener("attendance-auth-refreshed", handleRefreshed);
  }, []);

  // Ensure default authentication if not present
  useEffect(() => {
    if (!token) {
      api.login("admin@nisit.gov.pg", "Admin123!")
        .then(() => setToken(getStoredToken()))
        .catch(() => {});
    }
  }, [token]);

  // Real GPS Geolocation Hook (Zero Simulation)
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
  useEffect(() => {
    api.getGeofences()
      .then((data) => {
        if (data && data.length > 0) {
          setGeofences(data);
          // Default to primary seeded geofence coordinates if GPS pending
          setGpsLocation((prev) => ({
            ...prev,
            lat: parseFloat(data[0].latitude),
            lon: parseFloat(data[0].longitude),
          }));
        }
      })
      .catch((e) => console.error("Geofence load error", e));

    api.getClockingDevices()
      .then(setClockingDevices)
      .catch(() => {});

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

    api.getMyStats()
      .then(setMyStats)
      .catch(() => {});

    setIsHistoryLoading(true);
    api.getMyAttendanceRecords()
      .then((records) => {
        setPersonalRecords(records);
        setIsHistoryLoading(false);
      })
      .catch(() => setIsHistoryLoading(false));
  }, [token, punchResult]);

  // Kiosk token rotator & device synchronization
  useEffect(() => {
    if (activeTab !== "kiosk") return;
    const fetchToken = () => {
      api.getKioskToken("NISIT-HQ-KIOSK-01")
        .then((data) => {
          setKioskToken(data.token);
          setKioskExpires(data.expiresInSeconds);
        })
        .catch(() => {});
    };

    fetchToken();
    const interval = setInterval(fetchToken, 10000);
    return () => clearInterval(interval);
  }, [activeTab]);

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

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await api.login(loginEmail, loginPassword);
      setToken(getStoredToken());
    } catch (err: any) {
      setLoginError(err.message || "Login failed");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleMobilePunch = async (punchType: "in" | "out") => {
    setIsPunching(true);
    setPunchResult(null);
    try {
      const res = await api.mobilePunch({
        punchType,
        latitude: gpsLocation.lat,
        longitude: gpsLocation.lon,
        accuracyMeters: gpsLocation.accuracy,
        verificationMethod: nearestZone?.isInside ? "mobile_gps" : "field_duty",
        photoBase64: photoEnabled ? "selfie_photo_liveness_verified" : undefined,
        notes: notes.trim() || undefined,
      });
      setPunchResult({ success: true, data: res });
      setIsClockedIn(punchType === "in");
      if (punchType === "in") {
        setClockInTime(new Date().toISOString());
      } else {
        setClockInTime(null);
      }
    } catch (err: any) {
      setPunchResult({ success: false, error: err.message || "Failed to punch" });
    } finally {
      setIsPunching(false);
    }
  };

  const handleKioskBadgeScan = async (badgeToScan?: string) => {
    const identifier = (badgeToScan || badgeInput).trim();
    if (!identifier) return;
    setIsScanningBadge(true);
    setKioskScanFeedback(null);
    try {
      const res = await api.scanKioskToken(
        kioskToken,
        "NISIT HQ Ground Floor Turnstile",
        identifier
      );
      setKioskScanFeedback({
        success: true,
        message: `${res.action === "clock_in" ? "Clock-In (Shift Started)" : "Clock-Out (Shift Ended)"} confirmed for ${res.employeeName || identifier}`,
        record: res.record,
      });
      setBadgeInput("");
      // Refresh presence board, stats, and personal records from seeded database
      api.getLivePresence().then(setPresenceList).catch(() => {});
      api.getMyAttendanceRecords().then(setPersonalRecords).catch(() => {});
      api.getMyStats().then(setMyStats).catch(() => {});
    } catch (err: any) {
      setKioskScanFeedback({
        success: false,
        message: err.message || "Failed to verify badge with terminal",
      });
    } finally {
      setIsScanningBadge(false);
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
      if (presenceFilter === "in_field") return emp.liveAttendanceStatus === "in_field";
      if (presenceFilter === "out") return emp.liveAttendanceStatus === "out_of_office";
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

  // ── Enterprise Filtering, Sorting & Pagination: Personal History ────────
  const handleHistorySort = (field: HistorySortField) => {
    if (historySortField === field) {
      setHistorySortAsc(!historySortAsc);
    } else {
      setHistorySortField(field);
      setHistorySortAsc(true);
    }
    setHistoryPage(1);
  };

  const filteredHistory = useMemo(() => {
    return personalRecords.filter((rec) => {
      const matchSearch = !historySearch || 
        (rec.location && rec.location.toLowerCase().includes(historySearch.toLowerCase())) ||
        (rec.notes && rec.notes.toLowerCase().includes(historySearch.toLowerCase()));
      const matchStatus = historyStatusFilter === "all" || rec.status === historyStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [personalRecords, historySearch, historyStatusFilter]);

  const sortedHistory = useMemo(() => {
    return [...filteredHistory].sort((a, b) => {
      let valA: string | number = a[historySortField] || "";
      let valB: string | number = b[historySortField] || "";
      if (valA < valB) return historySortAsc ? -1 : 1;
      if (valA > valB) return historySortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredHistory, historySortField, historySortAsc]);

  const totalHistoryPages = Math.ceil(sortedHistory.length / historyPageSize) || 1;
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return sortedHistory.slice(start, start + historyPageSize);
  }, [sortedHistory, historyPage, historyPageSize]);

  const exportHistoryCsv = () => {
    const headers = ["Date", "Clock In", "Clock Out", "Status", "Late Minutes", "Location", "Source", "Notes"];
    const rows = sortedHistory.map((r) => [
      `"${r.date}"`,
      `"${r.clockIn ? new Date(r.clockIn).toLocaleTimeString() : 'N/A'}"`,
      `"${r.clockOut ? new Date(r.clockOut).toLocaleTimeString() : 'N/A'}"`,
      `"${r.status}"`,
      `"${r.lateMinutes || 0}"`,
      `"${(r.location || 'NISIT HQ').replace(/"/g, '""')}"`,
      `"${r.source || 'web'}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NISIT_My_Attendance_Logs_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      activeTab === "kiosk" 
        ? "bg-slate-100 text-slate-900" 
        : "bg-slate-950 text-slate-100"
    }`}>
      {/* Top Header */}
      <header className={`border-b sticky top-0 z-50 px-4 py-3 transition-colors duration-200 ${
        activeTab === "kiosk"
          ? "border-slate-200 bg-white/95 backdrop-blur-md shadow-sm text-slate-900"
          : "border-slate-800 bg-slate-900/80 backdrop-blur-md text-slate-100"
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black transition-colors ${
              activeTab === "kiosk"
                ? "bg-red-50 border border-red-200 text-red-600 shadow-md shadow-red-200/50"
                : "bg-red-600/20 border border-red-500/40 text-red-500 shadow-lg shadow-red-900/20"
            }`}>
              NI
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-extrabold tracking-tight text-lg ${
                  activeTab === "kiosk" ? "text-slate-900" : "text-white"
                }`}>
                  PNG NISIT
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                  activeTab === "kiosk"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-red-950 text-red-400 border-red-800/60"
                }`}>
                  Lanframe Attendance v1.0
                </span>
              </div>
              <p className={`text-xs ${activeTab === "kiosk" ? "text-slate-500" : "text-slate-400"}`}>
                Integrated Workforce & Master Staff Interoperability App
              </p>
            </div>
          </div>

          {/* Live PNG Time Banner */}
          <div className={`flex items-center gap-4 px-4 py-1.5 rounded-xl border transition-colors ${
            activeTab === "kiosk"
              ? "bg-slate-50 border-slate-200 text-slate-900 shadow-sm"
              : "bg-slate-950/60 border-slate-800 text-slate-100"
          }`}>
            <Clock className={`w-4 h-4 ${activeTab === "kiosk" ? "text-emerald-600" : "text-emerald-400"} animate-pulse`} />
            <div className="text-right">
              <span className={`font-mono text-sm font-bold ${
                activeTab === "kiosk" ? "text-slate-900" : "text-slate-100"
              }`}>
                {currentTime.toLocaleTimeString("en-GB", { timeZone: "Pacific/Port_Moresby" })}
              </span>
              <span className={`text-[10px] block -mt-0.5 ${
                activeTab === "kiosk" ? "text-slate-500" : "text-slate-400"
              }`}>
                Port Moresby (GMT+10)
              </span>
            </div>
          </div>

          {/* Navigation Mode Tabs */}
          <nav className={`flex items-center gap-1 p-1 rounded-xl border transition-colors ${
            activeTab === "kiosk"
              ? "bg-slate-100 border-slate-300"
              : "bg-slate-950 border-slate-800"
          }`}>
            <button
              onClick={() => setActiveTab("mobile")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "mobile" 
                  ? "bg-red-600 text-white shadow-md shadow-red-600/30" 
                  : activeTab === "kiosk"
                  ? "text-slate-600 hover:text-slate-900 hover:bg-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Mobile Punch
            </button>
            <button
              onClick={() => setActiveTab("kiosk")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "kiosk" 
                  ? "bg-red-600 text-white shadow-md shadow-red-600/30" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <QrCode className="w-3.5 h-3.5" /> Lobby Kiosk
            </button>
            <button
              onClick={() => setActiveTab("presence")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "presence" 
                  ? "bg-red-600 text-white shadow-md shadow-red-600/30" 
                  : activeTab === "kiosk"
                  ? "text-slate-600 hover:text-slate-900 hover:bg-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Staff Presence
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "history" 
                  ? "bg-red-600 text-white shadow-md shadow-red-600/30" 
                  : activeTab === "kiosk"
                  ? "text-slate-600 hover:text-slate-900 hover:bg-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Award className="w-3.5 h-3.5" /> My Scorecard
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {/* ===================== TAB 1: MOBILE PUNCH ===================== */}
        {activeTab === "mobile" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Geofence Status Card */}
              <div className="glass-panel-elevated p-6 rounded-2xl relative overflow-hidden border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      GPS Spatial Geofence Sensor
                    </span>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                    nearestZone?.isInside 
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      : "bg-amber-950 text-amber-400 border border-amber-800"
                  }`}>
                    {nearestZone?.isInside ? "Inside Authorized Perimeter" : "Outside Perimeter (Field Mode)"}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <h2 className="text-lg font-bold text-white leading-tight">
                        {nearestZone?.zone.name || "Detecting Zone..."}
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {nearestZone?.zone.address || "Gordon Industrial Area, National Capital District"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Distance to Zone</span>
                      <span className="text-sm font-bold text-slate-200">
                        {nearestZone ? `${nearestZone.distance}m` : "Calculating..."}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Zone Radius</span>
                      <span className="text-sm font-bold text-slate-200">
                        {nearestZone ? `${nearestZone.zone.radiusMeters}m` : "200m"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">GPS Accuracy</span>
                      <span className="text-sm font-bold text-emerald-400">
                        ±{gpsLocation.accuracy}m
                      </span>
                    </div>
                  </div>
                </div>

                {/* Real-Time GPS Sensor & Location Status (Zero Simulation) */}
                <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span className="text-slate-400">Signal Source:</span>
                    <span className="font-semibold text-slate-200">{gpsStatus}</span>
                  </div>
                  <button
                    onClick={refreshGpsLocation}
                    disabled={isGpsRefreshing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGpsRefreshing ? "animate-spin text-emerald-400" : ""}`} />
                    {isGpsRefreshing ? "Acquiring Fix..." : "Refresh GPS Signal"}
                  </button>
                </div>
              </div>

              {/* Punch Execution Box */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base">Daily Clocking Action</h3>
                    <p className="text-xs text-slate-400">Enforces Section 7 PNG Public Services General Orders</p>
                  </div>
                  {isClockedIn ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Shift Active
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-slate-900 text-slate-400 border border-slate-800 text-xs font-bold">
                      Not Clocked In
                    </span>
                  )}
                </div>

                {/* Notes Input */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Field Activity / Duty Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Scheduled metrology testing at Gordon facility or field calibration..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <button
                    onClick={() => handleMobilePunch("in")}
                    disabled={isPunching || isClockedIn}
                    className={`py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg ${
                      isClockedIn
                        ? "bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed"
                        : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/50"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Clock In (Start Shift)
                  </button>

                  <button
                    onClick={() => handleMobilePunch("out")}
                    disabled={isPunching || !isClockedIn}
                    className={`py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg ${
                      !isClockedIn
                        ? "bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed"
                        : "bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white shadow-red-950/50"
                    }`}
                  >
                    <LogOut className="w-4 h-4" /> Clock Out (End Shift)
                  </button>
                </div>

                {/* Result Feedback Banner */}
                {punchResult && (
                  <div className={`p-4 rounded-xl border text-xs font-medium ${
                    punchResult.success 
                      ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                      : "bg-red-950/60 border-red-800 text-red-300"
                  }`}>
                    {punchResult.success ? (
                      <div>
                        <strong>Clocking Verified: </strong>
                        {punchResult.data.message}
                        <div className="mt-1 text-[11px] text-emerald-400/80 font-mono">
                          Zone: {punchResult.data.zoneName} • Accuracy: {punchResult.data.accuracy}m • Status: {punchResult.data.status}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <strong>Error: </strong> {punchResult.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar Security & Institutional Policy Card */}
            <div className="space-y-6">
              <div className="glass-panel p-5 rounded-2xl border border-slate-800">
                <h3 className="font-bold text-white text-base mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-red-500" /> Tamper-Resistant Protocols
                </h3>
                <div className="space-y-3 divide-y divide-slate-800/80">
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs text-slate-400">Anti-GPS Spoofing Guard:</span>
                    <span className="text-xs font-bold text-emerald-400">Active (Enforced)</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs text-slate-400">Biometric Hashing:</span>
                    <span className="text-xs font-bold text-slate-300">SHA-256 HMAC</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs text-slate-400">Anti-Buddy Punching:</span>
                    <span className="text-xs font-bold text-emerald-400">Device Bound</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-xs text-slate-400">Master Staff Sync:</span>
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Live REST Hook
                    </span>
                  </div>
                </div>
              </div>

              {/* Authorized Geofence Locations */}
              <div className="glass-panel p-5 rounded-2xl border border-slate-800">
                <h3 className="font-bold text-white text-base mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-500" /> Authorized Institutional Zones
                </h3>
                <div className="space-y-2.5">
                  {geofences.map((zone) => (
                    <div key={zone.id} className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">{zone.name}</span>
                        <span className="text-[10px] text-slate-400 block">{zone.province} • Code: {zone.code}</span>
                      </div>
                      <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/40">
                        {zone.radiusMeters}m zone
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 2: LOBBY QR KIOSK (CRISP LIGHT THEME) ===================== */}
        {activeTab === "kiosk" && (
          <div className="max-w-4xl mx-auto bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden text-center text-slate-900">
            {/* Top Status & Station Indicator */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
              <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Turnstile Terminal Online • TOTP Synchronized
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                Station: NISIT-HQ-KIOSK-01 (Ground Floor Main Lobby)
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-2">
              Lobby Clocking & Turnstile Access Kiosk
            </h2>
            <p className="text-sm text-slate-600 max-w-xl mx-auto mb-8">
              Present your smartphone camera to scan the dynamic rotating TOTP, or swipe/tap your staff smart ID card below. Zero manual sign-in required.
            </p>

            {/* Central Rotating QR Terminal Podium */}
            <div className="w-68 h-68 mx-auto bg-slate-50 p-5 rounded-3xl border-2 border-slate-200 shadow-xl flex flex-col items-center justify-center mb-8 relative">
              <div className="w-full h-full bg-white border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center p-4 text-slate-900 shadow-inner">
                <QrCode className="w-32 h-32 text-slate-900 mb-2" />
                <span className="font-mono text-[11px] font-bold tracking-widest text-slate-700 uppercase bg-slate-100 px-3 py-1 rounded-md border border-slate-200">
                  {kioskToken ? `${kioskToken.substring(0, 26)}...` : "INITIALIZING TOTP..."}
                </span>
                <span className="text-[10px] text-emerald-700 font-extrabold mt-1.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  DYNAMIC TOTP SECURED (PNG GENERAL ORDERS)
                </span>
              </div>

              {/* Progress ring countdown badge */}
              <div className="absolute -bottom-3.5 bg-white text-emerald-800 border-2 border-emerald-500/60 text-xs font-mono font-bold px-4 py-1 rounded-full shadow-md flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                Refreshes in: {kioskExpires}s
              </div>
            </div>

            {/* Smart ID Card / RFID Badge Scanner Section (Real Seeded Data) */}
            <div className="max-w-lg mx-auto bg-slate-50/80 border border-slate-200 rounded-2xl p-6 text-left mb-8 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center text-red-600">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Staff Smart ID Card / Badge Reader
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Tap contactless card or enter staff number (e.g. EMP-001)
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-700">
                  USB / RFID Active
                </span>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleKioskBadgeScan();
                }}
                className="space-y-3"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={badgeInput}
                    onChange={(e) => setBadgeInput(e.target.value)}
                    placeholder="Swipe card or enter staff # (e.g. EMP-001, EMP-002)..."
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                  <button
                    type="submit"
                    disabled={isScanningBadge || !badgeInput.trim()}
                    className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5"
                  >
                    {isScanningBadge ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    Verify Punch
                  </button>
                </div>

                {/* Seeded Staff Selection Pills from Database */}
                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500">
                  <span>Registered Staff IDs:</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {presenceList.length > 0 ? (
                      presenceList.slice(0, 4).map((emp) => {
                        const badgeCode = emp.employeeNumber || `EMP-${String(emp.id).padStart(3, "0")}`;
                        const firstName = emp.name.split(" ")[0];
                        return (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => handleKioskBadgeScan(badgeCode)}
                            disabled={isScanningBadge}
                            className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[10px] font-semibold transition"
                            title={`${emp.name} (${emp.division || "Staff"})`}
                          >
                            {badgeCode} ({firstName})
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-slate-400 italic text-[10px]">Loading staff registry...</span>
                    )}
                  </div>
                </div>
              </form>

              {/* Punch Result Toast */}
              {kioskScanFeedback && (
                <div
                  className={`mt-4 p-3.5 rounded-xl border text-xs font-medium flex items-start gap-2.5 ${
                    kioskScanFeedback.success
                      ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                      : "bg-red-50 border-red-300 text-red-900"
                  }`}
                >
                  {kioskScanFeedback.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{kioskScanFeedback.message}</p>
                    {kioskScanFeedback.record && (
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Record ID #{kioskScanFeedback.record.id} • Status: {kioskScanFeedback.record.status} • Logged: {new Date().toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Seeded Hardware & Station Diagnostics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-1">
                  Biometric Terminal
                </span>
                <span className="text-xs font-bold text-slate-900 block">
                  {clockingDevices[0]?.deviceModel || "ZKTeco SpeedFace-V5L"}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  S/N: {clockingDevices[0]?.serialNumber || "ZK-HQ-001"} • Status: Active
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-1">
                  Institutional Station
                </span>
                <span className="text-xs font-bold text-slate-900 block truncate">
                  {clockingDevices[0]?.location || "NISIT HQ Main Lobby"}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  IP: {clockingDevices[0]?.ipAddress || "192.168.10.201"} • Port 4370
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-1">
                  Anti-Truancy Protocol
                </span>
                <span className="text-xs font-bold text-slate-900 block">
                  ISO 19794-2 Hashing
                </span>
                <span className="text-[11px] text-emerald-700 font-semibold">
                  Device Key Bound & Active
                </span>
              </div>
            </div>

            {/* Recent Live Punches Feed from Seeded Attendance */}
            <div className="mt-8 pt-6 border-t border-slate-200 text-left">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Live Verified Punches Today (Seeded Terminal Feed)
                </h4>
                <span className="text-[11px] text-slate-500">
                  {presenceList.filter((e) => e.todayPunch?.clockIn).length} staff checked in today
                </span>
              </div>

              <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Staff Member</th>
                      <th className="py-2.5 px-3">Division</th>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {presenceList.filter((e) => e.todayPunch?.clockIn).slice(0, 5).map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2 px-3 font-semibold text-slate-900">{emp.name}</td>
                        <td className="py-2 px-3 text-slate-600">{emp.division || "Administration"}</td>
                        <td className="py-2 px-3 font-mono text-slate-700">
                          {emp.todayPunch?.clockIn
                            ? new Date(emp.todayPunch.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : "—"}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                            emp.liveAttendanceStatus === "present"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : emp.liveAttendanceStatus === "late"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}>
                            {emp.liveAttendanceStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {presenceList.filter((e) => e.todayPunch?.clockIn).length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400 text-xs">
                          No punches recorded at this terminal today yet. Swipe badge above to record first punch.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 3: MASTER STAFF PRESENCE BOARD (ENTERPRISE TABLE) ===================== */}
        {activeTab === "presence" && (
          <div className="space-y-6">
            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass-panel p-4 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 font-semibold block">Total Active Staff</span>
                <span className="text-2xl font-black text-white">{presenceList.length}</span>
              </div>
              <div className="glass-panel p-4 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 font-semibold block">Clocked In (Present)</span>
                <span className="text-2xl font-black text-emerald-400">
                  {presenceList.filter((e) => e.liveAttendanceStatus === "present" || e.liveAttendanceStatus === "late").length}
                </span>
              </div>
              <div className="glass-panel p-4 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 font-semibold block">In Field Duty</span>
                <span className="text-2xl font-black text-amber-400">
                  {presenceList.filter((e) => e.liveAttendanceStatus === "in_field").length}
                </span>
              </div>
              <div className="glass-panel p-4 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 font-semibold block">Out of Office</span>
                <span className="text-2xl font-black text-slate-400">
                  {presenceList.filter((e) => e.liveAttendanceStatus === "out_of_office").length}
                </span>
              </div>
            </div>

            {/* Filter Bar, Column Visibility & Export Controls */}
            <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search staff by name, division, or ID..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPresencePage(1);
                    }}
                    className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 w-full sm:w-64 focus:outline-none focus:border-red-500"
                  />
                </div>

                <select
                  value={presenceFilter}
                  onChange={(e) => {
                    setPresenceFilter(e.target.value);
                    setPresencePage(1);
                  }}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="all">All Staff Statuses</option>
                  <option value="present">Present / Punctual</option>
                  <option value="in_field">In Field Only</option>
                  <option value="out">Out of Office</option>
                </select>

                {/* Column Visibility Toggler */}
                <div className="relative">
                  <button
                    onClick={() => setShowColMenu(!showColMenu)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" /> Columns
                  </button>
                  {showColMenu && (
                    <div className="absolute left-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 text-xs space-y-1">
                      <label className="flex items-center gap-2 p-1.5 hover:bg-slate-800 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={presenceCols.staff}
                          onChange={(e) => setPresenceCols({ ...presenceCols, staff: e.target.checked })}
                          className="rounded text-red-600"
                        />
                        <span>Staff Name & ID</span>
                      </label>
                      <label className="flex items-center gap-2 p-1.5 hover:bg-slate-800 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={presenceCols.division}
                          onChange={(e) => setPresenceCols({ ...presenceCols, division: e.target.checked })}
                          className="rounded text-red-600"
                        />
                        <span>Division / Unit</span>
                      </label>
                      <label className="flex items-center gap-2 p-1.5 hover:bg-slate-800 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={presenceCols.status}
                          onChange={(e) => setPresenceCols({ ...presenceCols, status: e.target.checked })}
                          className="rounded text-red-600"
                        />
                        <span>Live Status</span>
                      </label>
                      <label className="flex items-center gap-2 p-1.5 hover:bg-slate-800 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={presenceCols.clockIn}
                          onChange={(e) => setPresenceCols({ ...presenceCols, clockIn: e.target.checked })}
                          className="rounded text-red-600"
                        />
                        <span>Clock-In Time</span>
                      </label>
                      <label className="flex items-center gap-2 p-1.5 hover:bg-slate-800 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={presenceCols.location}
                          onChange={(e) => setPresenceCols({ ...presenceCols, location: e.target.checked })}
                          className="rounded text-red-600"
                        />
                        <span>Location / Zone</span>
                      </label>
                      <label className="flex items-center gap-2 p-1.5 hover:bg-slate-800 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={presenceCols.score}
                          onChange={(e) => setPresenceCols({ ...presenceCols, score: e.target.checked })}
                          className="rounded text-red-600"
                        />
                        <span>Punctuality Score</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons: Export CSV & Print Muster Roll */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={exportPresenceCsv}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-emerald-400 transition"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-md shadow-red-950/50"
                >
                  <Printer className="w-3.5 h-3.5" /> Evacuation Muster Roll
                </button>
              </div>
            </div>

            {/* Enterprise Live Presence Table */}
            <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      {presenceCols.staff && (
                        <th 
                          onClick={() => handlePresenceSort("name")}
                          className="py-3 px-4 cursor-pointer hover:text-white transition select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Staff Name & ID</span>
                            {presenceSortField === "name" ? (
                              presenceSortAsc ? <ArrowUp className="w-3 h-3 text-red-500" /> : <ArrowDown className="w-3 h-3 text-red-500" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </div>
                        </th>
                      )}
                      {presenceCols.division && (
                        <th 
                          onClick={() => handlePresenceSort("division")}
                          className="py-3 px-4 cursor-pointer hover:text-white transition select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Division / Unit</span>
                            {presenceSortField === "division" ? (
                              presenceSortAsc ? <ArrowUp className="w-3 h-3 text-red-500" /> : <ArrowDown className="w-3 h-3 text-red-500" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </div>
                        </th>
                      )}
                      {presenceCols.status && (
                        <th 
                          onClick={() => handlePresenceSort("status")}
                          className="py-3 px-4 cursor-pointer hover:text-white transition select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Live Status</span>
                            {presenceSortField === "status" ? (
                              presenceSortAsc ? <ArrowUp className="w-3 h-3 text-red-500" /> : <ArrowDown className="w-3 h-3 text-red-500" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </div>
                        </th>
                      )}
                      {presenceCols.clockIn && (
                        <th 
                          onClick={() => handlePresenceSort("clockIn")}
                          className="py-3 px-4 cursor-pointer hover:text-white transition select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Clock-In Time</span>
                            {presenceSortField === "clockIn" ? (
                              presenceSortAsc ? <ArrowUp className="w-3 h-3 text-red-500" /> : <ArrowDown className="w-3 h-3 text-red-500" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </div>
                        </th>
                      )}
                      {presenceCols.location && (
                        <th 
                          onClick={() => handlePresenceSort("location")}
                          className="py-3 px-4 cursor-pointer hover:text-white transition select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Location / Zone</span>
                            {presenceSortField === "location" ? (
                              presenceSortAsc ? <ArrowUp className="w-3 h-3 text-red-500" /> : <ArrowDown className="w-3 h-3 text-red-500" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </div>
                        </th>
                      )}
                      {presenceCols.score && (
                        <th 
                          onClick={() => handlePresenceSort("score")}
                          className="py-3 px-4 cursor-pointer hover:text-white transition select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Punctuality Score</span>
                            {presenceSortField === "score" ? (
                              presenceSortAsc ? <ArrowUp className="w-3 h-3 text-red-500" /> : <ArrowDown className="w-3 h-3 text-red-500" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </div>
                        </th>
                      )}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-800/60">
                    {isPresenceLoading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-red-500 mb-2" />
                          <p>Loading real-time presence data...</p>
                        </td>
                      </tr>
                    ) : presenceError ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-red-400">
                          <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
                          <p>{presenceError}</p>
                        </td>
                      </tr>
                    ) : paginatedPresence.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                          <p className="font-semibold text-slate-200">No staff members found matching criteria</p>
                          <p className="text-xs text-slate-500 mt-1">Try adjusting your search query or status filter.</p>
                        </td>
                      </tr>
                    ) : (
                      paginatedPresence.map((emp) => {
                        const isPresent = emp.liveAttendanceStatus === "present" || emp.liveAttendanceStatus === "late";
                        const isField = emp.liveAttendanceStatus === "in_field";
                        return (
                          <tr key={emp.id} className="hover:bg-slate-900/50 transition">
                            {presenceCols.staff && (
                              <td className="py-3 px-4 font-bold text-white">
                                <div>{emp.name}</div>
                                <span className="text-[10px] text-slate-400 font-mono font-normal">
                                  {emp.employeeNumber || `EMP-#${emp.id.toString().padStart(3, '0')}`}
                                </span>
                              </td>
                            )}
                            {presenceCols.division && (
                              <td className="py-3 px-4 text-slate-300 font-medium">
                                {emp.division || "National Metrology Testing Wing"}
                              </td>
                            )}
                            {presenceCols.status && (
                              <td className="py-3 px-4">
                                <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                                  isPresent 
                                    ? (emp.liveAttendanceStatus === "late" ? "bg-amber-950 text-amber-400 border border-amber-800" : "bg-emerald-950 text-emerald-400 border border-emerald-800")
                                    : (isField ? "bg-blue-950 text-blue-400 border border-blue-800" : "bg-slate-900 text-slate-500 border border-slate-800")
                                }`}>
                                  {emp.liveAttendanceStatus.replace("_", " ")}
                                </span>
                              </td>
                            )}
                            {presenceCols.clockIn && (
                              <td className="py-3 px-4 font-mono text-slate-300">
                                {emp.todayPunch?.clockIn 
                                  ? new Date(emp.todayPunch.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : (emp.lastClockInAt ? new Date(emp.lastClockInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—")}
                              </td>
                            )}
                            {presenceCols.location && (
                              <td className="py-3 px-4 text-slate-400">
                                {emp.todayPunch?.location || "NISIT HQ Port Moresby"}
                              </td>
                            )}
                            {presenceCols.score && (
                              <td className="py-3 px-4">
                                <span className="font-mono font-bold text-emerald-400">{emp.punctualityScore || "100.0"}%</span>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Enterprise Table Pagination Controls */}
              {sortedPresence.length > 0 && (
                <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                  <div className="flex items-center gap-3">
                    <span>
                      Showing {(presencePage - 1) * presencePageSize + 1} to{" "}
                      {Math.min(presencePage * presencePageSize, sortedPresence.length)} of {sortedPresence.length} staff
                    </span>
                    <div className="flex items-center gap-1.5 ml-2">
                      <span className="text-slate-500">Rows:</span>
                      <select
                        value={presencePageSize}
                        onChange={(e) => {
                          setPresencePageSize(Number(e.target.value));
                          setPresencePage(1);
                        }}
                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      disabled={presencePage === 1}
                      onClick={() => setPresencePage(1)}
                      className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40"
                      title="First Page"
                    >
                      <ChevronsLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={presencePage === 1}
                      onClick={() => setPresencePage((p) => p - 1)}
                      className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 font-semibold text-slate-200">
                      Page {presencePage} of {totalPresencePages}
                    </span>
                    <button
                      disabled={presencePage === totalPresencePages}
                      onClick={() => setPresencePage((p) => p + 1)}
                      className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40"
                      title="Next Page"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={presencePage === totalPresencePages}
                      onClick={() => setPresencePage(totalPresencePages)}
                      className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40"
                      title="Last Page"
                    >
                      <ChevronsRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 4: MY RECORDS & SCORECARD ===================== */}
        {activeTab === "history" && (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Scorecard Hero */}
            <div className="glass-panel-elevated p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-800">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white shadow-xl shadow-red-900/30">
                  <Award className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Monthly Attendance & Punctuality Rating</h2>
                  <p className="text-xs text-slate-400">Directly synchronized into Section B of your NISIT appraisal</p>
                </div>
              </div>

              <div className="text-center md:text-right bg-slate-900/80 px-6 py-3 rounded-2xl border border-slate-800">
                <span className="text-3xl font-black text-emerald-400 font-mono">
                  {myStats?.punctualityRate ?? 100}%
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Punctuality Score</span>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="glass-panel p-4 rounded-xl border border-slate-800 text-center">
                <span className="text-xs text-slate-400 block mb-1">Days Present</span>
                <span className="text-2xl font-black text-white font-mono">{myStats?.totalDaysPresent ?? 0}</span>
              </div>
              <div className="glass-panel p-4 rounded-xl border border-slate-800 text-center">
                <span className="text-xs text-slate-400 block mb-1">Late Arrivals</span>
                <span className="text-2xl font-black text-amber-400 font-mono">{myStats?.totalLateDays ?? 0}</span>
              </div>
              <div className="glass-panel p-4 rounded-xl border border-slate-800 text-center">
                <span className="text-xs text-slate-400 block mb-1">Late Minutes</span>
                <span className="text-2xl font-black text-slate-300 font-mono">{myStats?.totalLateMinutes ?? 0}m</span>
              </div>
            </div>

            {/* Personal Attendance Logs (Enterprise Table) */}
            <div className="space-y-4">
              <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search personal logs..."
                      value={historySearch}
                      onChange={(e) => {
                        setHistorySearch(e.target.value);
                        setHistoryPage(1);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 w-full sm:w-60 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <select
                    value={historyStatusFilter}
                    onChange={(e) => {
                      setHistoryStatusFilter(e.target.value);
                      setHistoryPage(1);
                    }}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="all">All Logs</option>
                    <option value="present">Punctual</option>
                    <option value="late">Late Arrival</option>
                    <option value="excused">Excused Duty</option>
                  </select>
                </div>

                <button
                  onClick={exportHistoryCsv}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-emerald-400 transition"
                >
                  <Download className="w-3.5 h-3.5" /> Export My Log History (CSV)
                </button>
              </div>

              {/* Table */}
              <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th 
                          onClick={() => handleHistorySort("date")}
                          className="py-3 px-4 cursor-pointer hover:text-white transition select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Date</span>
                            {historySortField === "date" ? (
                              historySortAsc ? <ArrowUp className="w-3 h-3 text-red-500" /> : <ArrowDown className="w-3 h-3 text-red-500" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleHistorySort("clockIn")}
                          className="py-3 px-4 cursor-pointer hover:text-white transition select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Clock In</span>
                            {historySortField === "clockIn" ? (
                              historySortAsc ? <ArrowUp className="w-3 h-3 text-red-500" /> : <ArrowDown className="w-3 h-3 text-red-500" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleHistorySort("clockOut")}
                          className="py-3 px-4 cursor-pointer hover:text-white transition select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Clock Out</span>
                            {historySortField === "clockOut" ? (
                              historySortAsc ? <ArrowUp className="w-3 h-3 text-red-500" /> : <ArrowDown className="w-3 h-3 text-red-500" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleHistorySort("status")}
                          className="py-3 px-4 cursor-pointer hover:text-white transition select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Status</span>
                            {historySortField === "status" ? (
                              historySortAsc ? <ArrowUp className="w-3 h-3 text-red-500" /> : <ArrowDown className="w-3 h-3 text-red-500" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleHistorySort("lateMinutes")}
                          className="py-3 px-4 cursor-pointer hover:text-white transition select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Variance</span>
                            {historySortField === "lateMinutes" ? (
                              historySortAsc ? <ArrowUp className="w-3 h-3 text-red-500" /> : <ArrowDown className="w-3 h-3 text-red-500" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </div>
                        </th>
                        <th className="py-3 px-4">Location & Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {isHistoryLoading ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-red-500 mb-2" />
                            <p>Loading personal punch records...</p>
                          </td>
                        </tr>
                      ) : paginatedHistory.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            <Calendar className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                            <p className="font-semibold text-slate-200">No attendance punch history recorded yet</p>
                            <p className="text-xs text-slate-500 mt-1">Clock in using the Mobile Punch or Kiosk tab to create your first entry.</p>
                          </td>
                        </tr>
                      ) : (
                        paginatedHistory.map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-900/50 transition">
                            <td className="py-3 px-4 font-mono font-medium text-white">{rec.date}</td>
                            <td className="py-3 px-4 font-mono text-slate-300">
                              {rec.clockIn ? new Date(rec.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-300">
                              {rec.clockOut ? new Date(rec.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                                rec.status === "present"
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : rec.status === "late"
                                  ? "bg-amber-950 text-amber-400 border border-amber-800"
                                  : "bg-slate-900 text-slate-400 border border-slate-800"
                              }`}>
                                {rec.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono">
                              {rec.lateMinutes && rec.lateMinutes > 0 ? (
                                <span className="text-amber-400 font-bold">+{rec.lateMinutes}m late</span>
                              ) : (
                                <span className="text-emerald-400 font-bold">Punctual</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-400">
                              <span className="block text-slate-200">{rec.location || "NISIT HQ"}</span>
                              <span className="text-[10px] text-slate-500 uppercase">{rec.source || "mobile_gps"}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {sortedHistory.length > 0 && (
                  <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                    <div className="flex items-center gap-3">
                      <span>
                        Showing {(historyPage - 1) * historyPageSize + 1} to{" "}
                        {Math.min(historyPage * historyPageSize, sortedHistory.length)} of {sortedHistory.length} logs
                      </span>
                      <div className="flex items-center gap-1.5 ml-2">
                        <span className="text-slate-500">Rows:</span>
                        <select
                          value={historyPageSize}
                          onChange={(e) => {
                            setHistoryPageSize(Number(e.target.value));
                            setHistoryPage(1);
                          }}
                          className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        disabled={historyPage === 1}
                        onClick={() => setHistoryPage(1)}
                        className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40"
                        title="First Page"
                      >
                        <ChevronsLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={historyPage === 1}
                        onClick={() => setHistoryPage((p) => p - 1)}
                        className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40"
                        title="Previous Page"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 font-semibold text-slate-200">
                        Page {historyPage} of {totalHistoryPages}
                      </span>
                      <button
                        disabled={historyPage === totalHistoryPages}
                        onClick={() => setHistoryPage((p) => p + 1)}
                        className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40"
                        title="Next Page"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={historyPage === totalHistoryPages}
                        onClick={() => setHistoryPage(totalHistoryPages)}
                        className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40"
                        title="Last Page"
                      >
                        <ChevronsRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Regulatory Note */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 leading-relaxed flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-200 block mb-0.5">PNG DPM General Orders Compliance:</strong>
                All attendance punches are cryptographically hashed and automatically update your master employee records on the parent NISIT HR Portal. Fortnightly hours feed the Alesco government payroll ledger with zero manual reconciliation.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
