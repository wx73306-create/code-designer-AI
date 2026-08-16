// =====================================================================
// 服务端管理员会话（修复 P0-1：管理 API 无服务端授权）
// =====================================================================
// 用 HMAC 签名的 httpOnly Cookie 取代不安全的客户端 sessionStorage 认证。
// 凭据来自环境变量（生产必须配置 ADMIN_SESSION_SECRET 并更换默认账号密码）。
// =====================================================================

import crypto from 'crypto';
import { NextRequest } from 'next/server';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '050125@Code Designer AI.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '050125why';
// 生产环境必须通过环境变量覆盖此默认值
const ADMIN_SECRET = process.env.ADMIN_SESSION_SECRET || 'dev-insecure-admin-secret-change-me';

export const ADMIN_COOKIE = 'admin_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

interface SessionPayload {
  role: 'admin';
  exp: number; // 过期时间戳（ms）
}

function b64url(input: string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(data: string): string {
  return crypto.createHmac('sha256', ADMIN_SECRET).update(data).digest('base64url');
}

/** 校验管理员登录凭据 */
export function verifyAdminCredentials(email: string, password: string): boolean {
  // 定时安全比较，避免时序攻击
  const emailOk = crypto.timingSafeEqual(
    Buffer.from(email.padEnd(ADMIN_EMAIL.length, '\0')),
    Buffer.from(ADMIN_EMAIL.padEnd(email.length, '\0')),
  ) && email === ADMIN_EMAIL;
  const passOk = crypto.timingSafeEqual(
    Buffer.from(password.padEnd(ADMIN_PASSWORD.length, '\0')),
    Buffer.from(ADMIN_PASSWORD.padEnd(password.length, '\0')),
  ) && password === ADMIN_PASSWORD;
  return emailOk && passOk;
}

/** 生成签名的会话 Cookie 值 */
export function createAdminSessionToken(): string {
  const payload: SessionPayload = { role: 'admin', exp: Date.now() + SESSION_TTL_MS };
  const data = b64url(JSON.stringify(payload));
  return `${data}.${sign(data)}`;
}

/** 校验会话 Cookie 值：签名有效且未过期 */
export function verifyAdminSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [data, signature] = token.split('.');
  if (!data || !signature) return false;
  // 校验签名
  const expected = sign(data);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }
  // 校验过期时间
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as SessionPayload;
    return payload.role === 'admin' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

/** 从请求中读取并校验管理员会话 */
export function isAdminAuthenticatedServer(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
}

/** Cookie 选项（httpOnly，禁止 JS 读取） */
export const adminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: Math.floor(SESSION_TTL_MS / 1000),
};

// =====================================================================
// 普通用户服务端会话（统一身份：用服务端签名 Cookie 取代客户端 sessionStorage）
// =====================================================================

export const USER_COOKIE = 'user_session';

interface UserSessionPayload {
  role: 'user';
  email: string;
  exp: number;
}

/** 生成普通用户会话 Cookie 值 */
export function createUserSessionToken(email: string): string {
  const payload: UserSessionPayload = { role: 'user', email, exp: Date.now() + SESSION_TTL_MS };
  const data = b64url(JSON.stringify(payload));
  return `${data}.${sign(data)}`;
}

/** 校验用户会话 Cookie：签名有效且未过期则返回 email，否则 null */
export function verifyUserSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const [data, signature] = token.split('.');
  if (!data || !signature) return null;
  const expected = sign(data);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as UserSessionPayload;
    if (payload.role === 'user' && payload.exp > Date.now() && payload.email) {
      return payload.email;
    }
    return null;
  } catch {
    return null;
  }
}

/** 从请求中读取当前登录用户邮箱（未登录返回 null） */
export function getUserSessionEmail(req: NextRequest): string | null {
  return verifyUserSessionToken(req.cookies.get(USER_COOKIE)?.value);
}

/** 用户 Cookie 选项（httpOnly） */
export const userCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: Math.floor(SESSION_TTL_MS / 1000),
};

// =====================================================================
// 统一认证检查（P1-5）
// =====================================================================

export interface AuthResult {
  authenticated: boolean;
  email: string | null;
  isAdmin: boolean;
}

/**
 * 统一认证：接受 user_session 或 admin_session。
 * - user_session → { authenticated: true, email, isAdmin: false }
 * - admin_session → { authenticated: true, email: 'admin', isAdmin: true }
 * - 都没有 → { authenticated: false, email: null, isAdmin: false }
 */
export function getRequestAuth(req: NextRequest): AuthResult {
  const email = getUserSessionEmail(req);
  if (email) {
    return { authenticated: true, email, isAdmin: false };
  }
  if (isAdminAuthenticatedServer(req)) {
    return { authenticated: true, email: 'admin', isAdmin: true };
  }
  return { authenticated: false, email: null, isAdmin: false };
}
