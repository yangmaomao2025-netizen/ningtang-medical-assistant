/**
 * 机器人服务
 * Bot Service
 */

import crypto from 'crypto';

export interface Bot {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  status: 'active' | 'inactive';
  apiKeyPrefix: string; // 显示用的前缀
  apiKeyHash: string; // 存储的哈希
  modelConfig: {
    defaultModel: string;
    fallbackModels: string[];
  };
  channels: string[];
  permissionConfig: {
    requireAuth: boolean;
    allowedRoles: string[];
  };
  stats: {
    totalConversations: number;
    totalMessages: number;
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// 模拟机器人存储
const bots = new Map<string, Bot>();

// 默认机器人
bots.set('bot_001', {
  id: 'bot_001',
  name: '宁唐医学助手',
  description: '专业的医学问答机器人',
  avatar: '',
  status: 'active',
  apiKeyPrefix: 'nta_xxxx',
  apiKeyHash: '',
  modelConfig: {
    defaultModel: 'kimi-k2.5',
    fallbackModels: ['qwen3.5-plus'],
  },
  channels: ['web', 'macos', 'android'],
  permissionConfig: {
    requireAuth: false,
    allowedRoles: ['user', 'doctor'],
  },
  stats: {
    totalConversations: 0,
    totalMessages: 0,
  },
  createdBy: 'admin_001',
  createdAt: new Date(),
  updatedAt: new Date(),
});

/**
 * 生成 API Key
 */
function generateApiKey(): { prefix: string; hash: string } {
  const key = `nta_${crypto.randomBytes(24).toString('hex')}`;
  const prefix = key.substring(0, 12) + '...';
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return { prefix, hash, fullKey: key };
}

/**
 * 获取所有机器人
 */
export function getBots(params: { page?: number; limit?: number; status?: string }): {
  items: Bot[];
  total: number;
} {
  const page = params.page || 1;
  const limit = params.limit || 20;

  let result = Array.from(bots.values());

  if (params.status) {
    result = result.filter(b => b.status === params.status);
  }

  const total = result.length;
  const start = (page - 1) * limit;
  result = result.slice(start, start + limit);

  // 不返回 hash
  return {
    items: result.map(b => ({ ...b, apiKeyHash: undefined })),
    total,
  };
}

/**
 * 获取机器人详情
 */
export function getBotById(id: string): Bot | undefined {
  const bot = bots.get(id);
  if (!bot) return undefined;
  return { ...bot, apiKeyHash: undefined };
}

/**
 * 创建机器人
 */
export function createBot(data: {
  name: string;
  description: string;
  avatar?: string;
  modelConfig?: Bot['modelConfig'];
  channels?: string[];
  createdBy: string;
}): { bot: Bot; apiKey: string } {
  const { prefix, hash, fullKey } = generateApiKey();

  const bot: Bot = {
    id: `bot_${crypto.randomUUID().substring(0, 8)}`,
    name: data.name,
    description: data.description,
    avatar: data.avatar,
    status: 'active',
    apiKeyPrefix: prefix,
    apiKeyHash: hash,
    modelConfig: data.modelConfig || {
      defaultModel: 'kimi-k2.5',
      fallbackModels: [],
    },
    channels: data.channels || ['web'],
    permissionConfig: {
      requireAuth: true,
      allowedRoles: ['user'],
    },
    stats: {
      totalConversations: 0,
      totalMessages: 0,
    },
    createdBy: data.createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  bots.set(bot.id, bot);
  return { bot: { ...bot, apiKeyHash: undefined }, apiKey: fullKey };
}

/**
 * 更新机器人
 */
export function updateBot(
  id: string,
  data: Partial<Pick<Bot, 'name' | 'description' | 'avatar' | 'status' | 'modelConfig' | 'channels'>>
): Bot | undefined {
  const bot = bots.get(id);
  if (!bot) return undefined;

  Object.assign(bot, data, { updatedAt: new Date() });
  return { ...bot, apiKeyHash: undefined };
}

/**
 * 删除机器人
 */
export function deleteBot(id: string): boolean {
  return bots.delete(id);
}

/**
 * 重置 API Key
 */
export function regenerateApiKey(id: string): { apiKey: string } | undefined {
  const bot = bots.get(id);
  if (!bot) return undefined;

  const { prefix, hash, fullKey } = generateApiKey();
  bot.apiKeyPrefix = prefix;
  bot.apiKeyHash = hash;
  bot.updatedAt = new Date();

  return { apiKey: fullKey };
}

/**
 * 验证 API Key
 */
export function verifyApiKey(id: string, apiKey: string): boolean {
  const bot = bots.get(id);
  if (!bot || bot.status !== 'active') return false;

  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
  return bot.apiKeyHash === hash;
}

export default {
  getBots,
  getBotById,
  createBot,
  updateBot,
  deleteBot,
  regenerateApiKey,
  verifyApiKey,
};
