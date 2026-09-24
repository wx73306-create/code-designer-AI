import { describe, expect, it } from 'vitest';

import { parseStoredUser } from './client-user-store';

describe('parseStoredUser — sessionStorage 里的登录态解析', () => {
  it('正常值 → 用户对象，avatar 取姓名首字母大写', () => {
    const user = parseStoredUser(JSON.stringify({ name: 'admin', email: 'a@b.com' }));
    expect(user).toEqual({ name: 'admin', email: 'a@b.com', avatar: 'A' });
  });

  it('空值一律视为未登录（null / 空串 / undefined）', () => {
    expect(parseStoredUser(null)).toBeNull();
    expect(parseStoredUser('')).toBeNull();
    expect(parseStoredUser(undefined)).toBeNull();
  });

  it('坏 JSON 不抛异常，视为未登录', () => {
    expect(parseStoredUser('{not json')).toBeNull();
    expect(parseStoredUser('"a string"')).toBeNull();
    expect(parseStoredUser('123')).toBeNull();
  });

  it('缺 email 或 name 一律返回 null —— 不产出半截用户', () => {
    // email 是配额轮询 / 鉴权的依赖，缺了就没有「已登录」可言
    expect(parseStoredUser(JSON.stringify({ name: 'x' }))).toBeNull();
    expect(parseStoredUser(JSON.stringify({ email: 'a@b.com' }))).toBeNull();
    expect(parseStoredUser(JSON.stringify({ name: '', email: 'a@b.com' }))).toBeNull();
    expect(parseStoredUser(JSON.stringify({ name: 'x', email: '' }))).toBeNull();
    expect(parseStoredUser(JSON.stringify({ name: '   ', email: 'a@b.com' }))).toBeNull();
  });

  it('字段类型不对也返回 null（不是字符串就当没有）', () => {
    expect(parseStoredUser(JSON.stringify({ name: 1, email: 'a@b.com' }))).toBeNull();
    expect(parseStoredUser(JSON.stringify({ name: 'x', email: { v: 1 } }))).toBeNull();
    expect(parseStoredUser(JSON.stringify(['x', 'a@b.com']))).toBeNull();
  });

  it('多余字段被忽略，不污染返回值', () => {
    const user = parseStoredUser(
      JSON.stringify({ name: 'x', email: 'a@b.com', avatar: 'ZZZ', role: 'ADMIN', id: 7 }),
    );
    expect(user).toEqual({ name: 'x', email: 'a@b.com', avatar: 'X' });
  });
});
