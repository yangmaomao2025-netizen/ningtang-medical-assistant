/**
 * 用户服务
 * User Service
 */

import crypto from 'crypto';

export interface User {
  id: string;
  username: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: 'admin' | 'doctor' | 'user';
  status: 'active' | 'disabled';
  authType: 'local' | 'oauth' | 'saml' | 'ldap';
  authProvider?: string;
  externalId?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 模拟用户存储（生产环境用 MongoDB）
const users = new Map<string, User>();

// 默认管理员
users.set('admin_001', {
  id: 'admin_001',
  username: 'admin',
  email: 'admin@example.com',
  role: 'admin',
  status: 'active',
  authType: 'local',
  createdAt: new Date(),
  updatedAt: new Date(),
});

/**
 * 获取所有用户
 */
export function getUsers(params: {
  page?: number;
  limit?: number;
  keyword?: string;
  role?: string;
}): { items: User[]; total: number } {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const keyword = params.keyword?.toLowerCase();

  let result = Array.from(users.values());

  // 过滤
  if (keyword) {
    result = result.filter(
      u =>
        u.username.toLowerCase().includes(keyword) ||
        u.email.toLowerCase().includes(keyword)
    );
  }
  if (params.role) {
    result = result.filter(u => u.role === params.role);
  }

  const total = result.length;

  // 分页
  const start = (page - 1) * limit;
  result = result.slice(start, start + limit);

  return { items: result, total };
}

/**
 * 获取用户详情
 */
export function getUserById(id: string): User | undefined {
  return users.get(id);
}

/**
 * 创建用户
 */
export function createUser(data: {
  username: string;
  email: string;
  password: string;
  role?: 'admin' | 'doctor' | 'user';
}): User {
  const id = `user_${crypto.randomUUID().substring(0, 8)}`;
  const user: User = {
    id,
    username: data.username,
    email: data.email,
    role: data.role || 'user',
    status: 'active',
    authType: 'local',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  users.set(id, user);
  return user;
}

/**
 * 更新用户
 */
export function updateUser(
  id: string,
  data: Partial<Pick<User, 'username' | 'email' | 'phone' | 'avatar' | 'role'>>
): User | undefined {
  const user = users.get(id);
  if (!user) return undefined;

  Object.assign(user, data, { updatedAt: new Date() });
  return user;
}

/**
 * 禁用/启用用户
 */
export function setUserStatus(id: string, status: 'active' | 'disabled'): boolean {
  const user = users.get(id);
  if (!user) return false;
  user.status = status;
  user.updatedAt = new Date();
  return true;
}

/**
 * 删除用户
 */
export function deleteUser(id: string): boolean {
  return users.delete(id);
}

/**
 * 搜索用户
 */
export function searchUsers(keyword: string): User[] {
  const k = keyword.toLowerCase();
  return Array.from(users.values()).filter(
    u =>
      u.username.toLowerCase().includes(k) ||
      u.email.toLowerCase().includes(k) ||
      (u.phone && u.phone.includes(k))
  );
}

export default {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  setUserStatus,
  deleteUser,
  searchUsers,
};
