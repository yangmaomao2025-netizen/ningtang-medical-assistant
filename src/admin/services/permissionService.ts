/**
 * 用户-机器人权限服务
 * Permission Service
 */

import crypto from 'crypto';

export interface BotPermission {
  id: string;
  userId: string;
  botId: string;
  level: 'admin' | 'operator' | 'readonly';
  expiresAt?: Date;
  grantedBy: string;
  grantedAt: Date;
}

// 模拟权限存储
const permissions = new Map<string, BotPermission>();

/**
 * 获取用户的机器人权限列表
 */
export function getUserPermissions(userId: string): BotPermission[] {
  return Array.from(permissions.values()).filter(p => p.userId === userId);
}

/**
 * 获取机器人的用户权限列表
 */
export function getBotPermissions(botId: string): BotPermission[] {
  return Array.from(permissions.values()).filter(p => p.botId === botId);
}

/**
 * 授权
 */
export function grantPermission(data: {
  userId: string;
  botId: string;
  level: 'admin' | 'operator' | 'readonly';
  grantedBy: string;
  expiresAt?: Date;
}): BotPermission {
  // 检查是否已存在
  const existing = Array.from(permissions.values()).find(
    p => p.userId === data.userId && p.botId === data.botId
  );

  if (existing) {
    // 更新
    existing.level = data.level;
    existing.grantedBy = data.grantedBy;
    existing.grantedAt = new Date();
    existing.expiresAt = data.expiresAt;
    return existing;
  }

  const permission: BotPermission = {
    id: `perm_${crypto.randomUUID().substring(0, 8)}`,
    userId: data.userId,
    botId: data.botId,
    level: data.level,
    expiresAt: data.expiresAt,
    grantedBy: data.grantedBy,
    grantedAt: new Date(),
  };

  permissions.set(permission.id, permission);
  return permission;
}

/**
 * 取消授权
 */
export function revokePermission(permissionId: string): boolean {
  return permissions.delete(permissionId);
}

/**
 * 批量授权
 */
export function batchGrantPermissions(data: {
  userIds: string[];
  botId: string;
  level: 'admin' | 'operator' | 'readonly';
  grantedBy: string;
}): BotPermission[] {
  return data.userIds.map(userId =>
    grantPermission({
      userId,
      botId: data.botId,
      level: data.level,
      grantedBy: data.grantedBy,
    })
  );
}

/**
 * 检查用户是否有机器人权限
 */
export function checkPermission(
  userId: string,
  botId: string,
  requiredLevel: 'admin' | 'operator' | 'readonly' = 'readonly'
): boolean {
  const userPerms = getUserPermissions(userId);
  const botPerm = userPerms.find(p => p.botId === botId);

  if (!botPerm) return false;
  if (botPerm.expiresAt && new Date() > botPerm.expiresAt) return false;

  // 权限级别：admin > operator > readonly
  const levels = ['readonly', 'operator', 'admin'];
  const userLevel = levels.indexOf(botPerm.level);
  const required = levels.indexOf(requiredLevel);

  return userLevel >= required;
}

/**
 * 获取所有权限
 */
export function getPermissions(params: {
  page?: number;
  limit?: number;
  userId?: string;
  botId?: string;
}): { items: BotPermission[]; total: number } {
  const page = params.page || 1;
  const limit = params.limit || 20;

  let result = Array.from(permissions.values());

  if (params.userId) {
    result = result.filter(p => p.userId === params.userId);
  }
  if (params.botId) {
    result = result.filter(p => p.botId === params.botId);
  }

  const total = result.length;
  const start = (page - 1) * limit;
  result = result.slice(start, start + limit);

  return { items: result, total };
}

export default {
  getUserPermissions,
  getBotPermissions,
  grantPermission,
  revokePermission,
  batchGrantPermissions,
  checkPermission,
  getPermissions,
};
