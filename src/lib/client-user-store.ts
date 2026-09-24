// =====================================================================
// Client User Store — 把 sessionStorage 里的登录态变成「可订阅的外部数据源」
//
// 为什么需要它（B.2.3.2 之后的技术债清理）：
// 登录态原先存在组件 state 里，并在 mount effect 中同步读 sessionStorage 后
// setState —— 这触发 `react-hooks/set-state-in-effect`（级联渲染告警）。
//
// 直接改成 useState 惰性初始化也不对：服务端渲染时 sessionStorage 不存在，
// 首帧必然是「未登录」，客户端若在首帧就读出用户，会造成 hydration 不一致。
//
// `useSyncExternalStore` 正是为这种场景设计的：
//   · 水合阶段用 getServerSnapshot（= null），与 SSR 输出一致，不会 mismatch；
//   · 水合完成后 React 自动比对 getSnapshot，有差异再重渲染；
//   · 订阅写入后无需任何 effect 内 setState。
//
// 存储内容的解析被单独抽成纯函数 parseStoredUser()，方便单测。
// =====================================================================

export interface StoredUser {
  name: string;
  email: string;
  avatar: string;
}

/** sessionStorage 里的键名（保持与历史数据兼容，不要改） */
export const STORED_USER_KEY = 'cd_user';

/**
 * 解析 `cd_user` 的原始值。纯函数：不读 storage、不抛异常。
 *
 * 容错策略：**宁可当作未登录，也不要造出一个半截用户**。
 * name / email 缺任何一个都返回 null —— 后续逻辑（配额轮询、鉴权）都依赖 email，
 * 给出一个没有 email 的用户会让「已登录」状态变得不可用。
 */
export function parseStoredUser(raw: string | null | undefined): StoredUser | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const { name, email } = parsed as { name?: unknown; email?: unknown };
    if (typeof name !== 'string' || name.trim() === '') return null;
    if (typeof email !== 'string' || email.trim() === '') return null;
    return {
      name,
      email,
      // 头像用姓名首字母（与原有实现一致；emoji 等宽字符可能取到半个字符，
      // 属既有行为，不在本次清理范围内）
      avatar: name.charAt(0).toUpperCase(),
    };
  } catch {
    return null;
  }
}

/** 取 sessionStorage，SSR / 隐私模式不可用时返回 null。 */
function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

// getSnapshot 必须返回**引用稳定**的值：按原始字符串缓存，
// 否则每次调用都造新对象会让 React 判定「一直在变」，导致无限重渲染。
let cachedRaw: string | null = null;
let cachedUser: StoredUser | null = null;
let cachePrimed = false;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeStoredUser(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getStoredUserSnapshot(): StoredUser | null {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(STORED_USER_KEY);
  if (cachePrimed && raw === cachedRaw) return cachedUser;
  cachedRaw = raw;
  cachedUser = parseStoredUser(raw);
  cachePrimed = true;
  return cachedUser;
}

/**
 * 水合阶段使用：服务端没有 sessionStorage，一律视为未登录。
 * 这样 SSR 输出与首帧客户端输出一致，不会产生 hydration mismatch。
 */
export function getStoredUserServerSnapshot(): StoredUser | null {
  return null;
}

/**
 * 写入（登录 / 更新资料）或清除（登出 / 会话失效）登录态，并通知订阅者。
 *
 * 只接受 name + email：avatar 一律由 name 推导，避免调用方各自算出一份不一致的值。
 */
export function writeStoredUser(user: { name: string; email: string } | null): void {
  const storage = getStorage();
  if (storage) {
    if (user) {
      storage.setItem(STORED_USER_KEY, JSON.stringify({ name: user.name, email: user.email }));
    } else {
      storage.removeItem(STORED_USER_KEY);
    }
  }
  // 立即更新缓存，保证紧随其后的 getSnapshot 拿到新值
  cachePrimed = true;
  cachedRaw = null;
  cachedUser = null;
  if (storage) {
    cachedRaw = storage.getItem(STORED_USER_KEY);
    cachedUser = parseStoredUser(cachedRaw);
  }
  emit();
}
