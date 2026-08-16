import { Role } from "@prisma/client"

// Extend NextAuth types
declare module "next-auth" {
  interface User {
    id: string
    email: string
    name?: string | null
    role: Role
    image?: string | null
  }

  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: Role
      image?: string | null
    }
  }
}

// Auth API types
export interface RegisterRequest {
  email: string
  password: string
  name?: string
}

export interface RegisterResponse {
  success: boolean
  message?: string
  user?: {
    id: string
    email: string
  }
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  success: boolean
  message?: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  password: string
}

export interface AuthError {
  error: string
  message?: string
}

// Quota types
export interface QuotaInfo {
  allowed: boolean
  remaining: number
  limit: number
  resetAt: string // ISO date
}

// Project types
export interface ProjectSummary {
  id: string
  url: string
  name?: string | null
  status: string
  currentVersion: number
  createdAt: string
}

export interface ProjectDetail extends ProjectSummary {
  versions: VersionSummary[]
  tasks: TaskSummary[]
}

export interface VersionSummary {
  id: string
  version: number
  score?: number | null
  createdAt: string
}

export interface TaskSummary {
  id: string
  type: string
  status: string
  startedAt?: string | null
  completedAt?: string | null
}

// Admin types
export interface AdminDashboard {
  totalUsers: number
  totalProjects: number
  activeUsers: number
  todayGenerations: number
}

export interface UserListItem {
  id: string
  email: string
  name?: string | null
  role: Role
  createdAt: string
  projectCount: number
}

// Monitor types
export interface SystemMetrics {
  system: {
    cpu: number
    memory: number
    uptime: number
  }
  redis: {
    memory: string
    clients: string
  }
  database: {
    connections: number
    size: string
  }
  api: {
    avgLatency: number
    requestsLastHour: number
  }
}

// Analytics types
export interface AnalyticsData {
  dau: number
  mau: number
  retention: number
  dailyStats: DailyStat[]
  popularWebsites: { url: string; count: number }[]
}

export interface DailyStat {
  date: string
  totalUsers: number
  newUsers: number
  totalProjects: number
  newProjects: number
  totalGenerations: number
  avgLatency: number
  errorCount: number
}
