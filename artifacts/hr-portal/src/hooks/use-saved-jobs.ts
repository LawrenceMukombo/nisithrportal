import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/api-config";

export const SAVED_JOB_IDS_KEY = ["saved-job-ids"];
export const SAVED_JOBS_KEY = ["saved-jobs"];

async function apiFetch(path: string, options?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Request failed");
  }
  return res.json();
}

export function useSavedJobIds(enabled: boolean) {
  return useQuery<number[]>({
    queryKey: SAVED_JOB_IDS_KEY,
    queryFn: () => apiFetch("/api/saved-jobs/ids"),
    enabled,
    staleTime: 30_000,
  });
}

export type SavedJobRow = {
  savedJobId: number;
  createdAt: string;
  job: {
    id: number;
    title: string;
    province?: string | null;
    employmentType?: string | null;
    closingDate?: string | null;
    departmentId?: number | null;
    status?: string | null;
  };
};

export function useSavedJobs(enabled: boolean) {
  return useQuery<SavedJobRow[]>({
    queryKey: SAVED_JOBS_KEY,
    queryFn: () => apiFetch("/api/saved-jobs"),
    enabled,
    staleTime: 30_000,
  });
}

export function useSaveJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: number) =>
      apiFetch(`/api/saved-jobs/${jobId}`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SAVED_JOB_IDS_KEY });
      queryClient.invalidateQueries({ queryKey: SAVED_JOBS_KEY });
    },
  });
}

export function useUnsaveJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: number) =>
      apiFetch(`/api/saved-jobs/${jobId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SAVED_JOB_IDS_KEY });
      queryClient.invalidateQueries({ queryKey: SAVED_JOBS_KEY });
    },
  });
}
