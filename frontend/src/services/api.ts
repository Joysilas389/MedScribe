/**
 * API Service — Centralized HTTP client with JWT auth interceptors.
 *
 * Handles:
 * - All API communication with the backend
 * - Automatic token refresh on 401
 * - Token storage and retrieval
 * - Request/response interceptors
 */

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type {
  AuthTokens, LoginRequest, RegisterRequest, User,
  Encounter, EncounterCreateRequest, EncounterListResponse,
  ClinicalNote, NoteEditRequest, TranscriptSegment,
  SpecialtyTemplate, NoteVersion,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

class ApiService {
  private client: AxiosInstance;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE}/api/v1`,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    // Request interceptor — attach access token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.getAccessToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor — handle 401 with token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const newToken = await this.refreshAccessToken();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.client(originalRequest);
          } catch {
            this.clearTokens();
            window.location.href = '/login';
            return Promise.reject(error);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // --- Token Management ---

  getAccessToken(): string | null {
    return sessionStorage.getItem('medscribe_access_token');
  }

  getRefreshToken(): string | null {
    return sessionStorage.getItem('medscribe_refresh_token');
  }

  setTokens(tokens: AuthTokens): void {
    sessionStorage.setItem('medscribe_access_token', tokens.access_token);
    sessionStorage.setItem('medscribe_refresh_token', tokens.refresh_token);
  }

  clearTokens(): void {
    sessionStorage.removeItem('medscribe_access_token');
    sessionStorage.removeItem('medscribe_refresh_token');
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  private async refreshAccessToken(): Promise<string> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) throw new Error('No refresh token');
      const { data } = await axios.post(`${API_BASE}/api/v1/auth/refresh`, {
        refresh_token: refreshToken,
      });
      this.setTokens(data);
      return data.access_token;
    })();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  // --- Auth ---

  async login(credentials: LoginRequest): Promise<AuthTokens> {
    const { data } = await this.client.post<AuthTokens>('/auth/login', credentials);
    this.setTokens(data);
    return data;
  }

  async register(details: RegisterRequest): Promise<AuthTokens> {
    const { data } = await this.client.post<AuthTokens>('/auth/register', details);
    this.setTokens(data);
    return data;
  }

  async getProfile(): Promise<User> {
    const { data } = await this.client.get<User>('/auth/profile');
    return data;
  }

  async updateProfile(updates: Partial<User>): Promise<User> {
    const { data } = await this.client.patch<User>('/auth/profile', updates);
    return data;
  }

  logout(): void {
    this.clearTokens();
  }

  // --- Encounters ---

  async createEncounter(request: EncounterCreateRequest): Promise<Encounter> {
    const { data } = await this.client.post<Encounter>('/encounters', request);
    return data;
  }

  async listEncounters(page = 1, pageSize = 20, statusFilter?: string): Promise<EncounterListResponse> {
    const params: Record<string, unknown> = { page, page_size: pageSize };
    if (statusFilter) params.status_filter = statusFilter;
    const { data } = await this.client.get<EncounterListResponse>('/encounters', { params });
    return data;
  }

  async getEncounter(id: string): Promise<Encounter> {
    const { data } = await this.client.get<Encounter>(`/encounters/${id}`);
    return data;
  }

  async pauseRecording(id: string): Promise<void> {
    await this.client.post(`/encounters/${id}/pause`);
  }

  async resumeRecording(id: string): Promise<void> {
    await this.client.post(`/encounters/${id}/resume`);
  }

  async stopRecording(id: string): Promise<void> {
    await this.client.post(`/encounters/${id}/stop`);
  }

  // --- Consent ---

  async recordConsent(encounterId: string, consented: boolean, consentedBy = ''): Promise<void> {
    await this.client.post(`/encounters/${encounterId}/consent`, {
      consent_type: 'recording',
      consented,
      consented_by: consentedBy,
    });
  }

  // --- Transcript ---

  async getTranscript(encounterId: string): Promise<{ segments: TranscriptSegment[] }> {
    const { data } = await this.client.get(`/encounters/${encounterId}/transcript`);
    return data;
  }

  // --- Note ---

  async generateNote(encounterId: string): Promise<ClinicalNote> {
    const { data } = await this.client.post<ClinicalNote>(`/encounters/${encounterId}/generate-note`);
    return data;
  }

  async getNote(encounterId: string): Promise<ClinicalNote> {
    const { data } = await this.client.get<ClinicalNote>(`/encounters/${encounterId}/note`);
    return data;
  }

  async editNote(encounterId: string, edit: NoteEditRequest): Promise<ClinicalNote> {
    const { data } = await this.client.patch<ClinicalNote>(`/encounters/${encounterId}/note`, edit);
    return data;
  }

  async signOffNote(encounterId: string): Promise<void> {
    await this.client.post(`/encounters/${encounterId}/sign-off`, { confirmation: true });
  }

  async getNoteVersions(encounterId: string): Promise<{ versions: NoteVersion[]; current_version: number }> {
    const { data } = await this.client.get(`/encounters/${encounterId}/note/versions`);
    return data;
  }

  // --- PDF Export ---

  async exportPdf(encounterId: string): Promise<Blob> {
    const { data } = await this.client.get(`/encounters/${encounterId}/export/pdf`, {
      responseType: 'blob',
    });
    return data;
  }

  // --- Templates ---

  async listTemplates(): Promise<SpecialtyTemplate[]> {
    const { data } = await this.client.get('/templates');
    return data.templates;
  }

  async getTemplate(id: string): Promise<SpecialtyTemplate> {
    const { data } = await this.client.get<SpecialtyTemplate>(`/templates/${id}`);
    return data;
  }

  // --- WebSocket URL ---

  getWsUrl(encounterId: string): string {
    const wsBase = import.meta.env.VITE_WS_URL || window.location.origin.replace('http', 'ws');
    const token = this.getAccessToken();
    return `${wsBase}/api/v1/ws/audio/${encounterId}?token=${token}`;
  }
}

export const api = new ApiService();
export default api;
