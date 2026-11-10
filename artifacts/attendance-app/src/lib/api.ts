export interface GeofenceZone {
  id: number;
  name: string;
  code: string;
  latitude: string;
  longitude: string;
  radiusMeters: number;
  address?: string;
  province: string;
  isActive: string;
}

export interface MobilePunchPayload {
  punchType: "in" | "out";
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  verificationMethod?: string;
  photoBase64?: string;
  notes?: string;
}

export interface LiveStaffMember {
  id: number;
  name: string;
  employeeNumber: string | null;
  departmentId: number | null;
  division: string | null;
  liveAttendanceStatus: "present" | "in_field" | "late" | "on_leave" | "out_of_office" | "not_reported" | "departed";
  lastClockInAt: string | null;
  lastClockOutAt: string | null;
  punctualityScore: string | null;
  todayPunch?: {
    clockIn: string | null;
    clockOut: string | null;
    status: string;
    lateMinutes: number;
    location: string;
    source: string;
  } | null;
}

export interface MyAttendanceStats {
  employeeId: number;
  month: string;
  totalDaysPresent: number;
  totalLateDays: number;
  totalLateMinutes: number;
  punctualityRate: number;
}

const TOKEN_KEY = "nisit_auth_token";
const HR_PORTAL_TOKEN_KEY = "hr_portal_token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(HR_PORTAL_TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(HR_PORTAL_TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(HR_PORTAL_TOKEN_KEY);
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  let token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && !url.includes("/api/auth/login")) {
    clearStoredToken();
    window.dispatchEvent(new CustomEvent("attendance-auth-expired"));
    throw new Error("Session expired. Please sign in with your staff account.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}: Request failed`);
  }

  return data as T;
}

export const api = {
  async login(email: string, password: string):Promise<{ token: string; user: any }> {
    const data = await request<{ token: string; user: any }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(data.token);
    return data;
  },

  async getGeofences(): Promise<GeofenceZone[]> {
    return request<GeofenceZone[]>("/api/attendance/geofences");
  },

  async mobilePunch(payload: MobilePunchPayload): Promise<any> {
    return request("/api/attendance/mobile-punch", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getKioskToken(kioskId: string = "NISIT-HQ-KIOSK-01"): Promise<{ kioskId: string; token: string; expiresInSeconds: number }> {
    return request(`/api/clocking/kiosk/token?kiosk_id=${encodeURIComponent(kioskId)}`);
  },

  async scanKioskToken(token: string, kioskLocation?: string, employeeIdentifier?: string): Promise<any> {
    return request("/api/clocking/kiosk/scan", {
      method: "POST",
      body: JSON.stringify({ token, kioskLocation, employeeIdentifier }),
    });
  },

  async getClockingDevices(): Promise<any[]> {
    return request<any[]>("/api/clocking/devices").catch(() => []);
  },

  async getLivePresence(): Promise<LiveStaffMember[]> {
    return request<LiveStaffMember[]>("/api/attendance/live-presence");
  },

  async getMyStats(): Promise<MyAttendanceStats> {
    return request<MyAttendanceStats>("/api/attendance/my-stats");
  },

  async getMyAttendanceRecords(): Promise<any[]> {
    return request<any[]>("/api/attendance");
  },

  async verifyStaff(identifier: string): Promise<any> {
    return request("/api/clocking/staff-verify", {
      method: "POST",
      body: JSON.stringify({ identifier }),
    });
  },

  async recordStaffPunch(payload: {
    identifier: string;
    method?: string;
    action?: string;
    kioskLocation?: string;
    notes?: string;
    pin?: string;
  }): Promise<any> {
    return request("/api/clocking/staff-punch", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async enrollStaff(payload: {
    employeeId: number;
    rfidCardNumber?: string;
    attendancePin?: string;
    biometricsEnrolled?: {
      face?: boolean;
      fingerprint?: boolean;
      iris?: boolean;
    };
  }): Promise<any> {
    return request("/api/clocking/staff-enroll", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getEmployees(): Promise<any[]> {
    return request<any[]>("/api/employees").catch(() => []);
  },
};
