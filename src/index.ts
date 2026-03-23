/**
 * 宁唐医学助手 - OpenClaw 插件入口
 * Medical Assistant Plugin for OpenClaw
 */

import type { Plugin, OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { ChatHandler } from "./chat/handler.js";
import { AdminRoutes } from "./admin/routes/index.js";
import { registerModels } from "./models/index.js";

// 插件配置类型
export interface MedicalAssistantConfig {
  metadata?: {
    name?: string;
    version?: string;
    author?: string;
    description?: string;
  };
  models?: {
    minimax?: { enabled?: boolean; apiKey?: string; endpoint?: string; model?: string };
    kimi?: { enabled?: boolean; apiKey?: string; endpoint?: string; model?: string };
    glm?: { enabled?: boolean; apiKey?: string; endpoint?: string; model?: string };
  };
  defaultModel?: "kimi" | "minimax" | "glm";
  medical?: {
    disclaimer?: string;
    confidence?: { high?: number; medium?: number };
    urgentKeywords?: string[];
  };
  sso?: {
    enabled?: boolean;
    providers?: {
      oauth?: { enabled?: boolean; providers?: unknown[] };
      saml?: { enabled?: boolean; providers?: unknown[] };
      ldap?: { enabled?: boolean; servers?: unknown[] };
    };
  };
  database?: {
    type?: string;
    uri?: string;
    encryption?: { enabled?: boolean; key?: string };
  };
  redis?: {
    enabled?: boolean;
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  };
  admin?: {
    enabled?: boolean;
    basePath?: string;
    sessionTimeout?: number;
  };
  api?: {
    basePath?: string;
    rateLimit?: { enabled?: boolean; requestsPerMinute?: number };
    cors?: { enabled?: boolean; origins?: string[] };
  };
  logging?: {
    level?: "debug" | "info" | "warn" | "error";
    auditLogEnabled?: boolean;
  };
}

// 插件运行时上下文
export interface PluginContext {
  config: MedicalAssistantConfig;
  api: OpenClawPluginApi;
  logger: {
    debug: (msg: string) => void;
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string, err?: Error) => void;
  };
}

// 全局插件上下文（在 register 时初始化）
let pluginContext: PluginContext | null = null;

export function getPluginContext(): PluginContext | null {
  return pluginContext;
}

/**
 * 医学助手插件主入口
 */
const medicalAssistantPlugin: Plugin = {
  id: "medical-assistant",
  name: "宁唐医学助手",
  description: "OpenClaw 医学问答插件，支持多端客户端和统一后台管理",
  version: "0.1.0",

  async register(api: OpenClawPluginApi): Promise<void> {
    // 获取插件配置
    const config = (api.config.getPluginConfig("medical-assistant") || {}) as MedicalAssistantConfig;

    // 初始化日志
    const logger = {
      debug: (msg: string) => api.runtime.logging.debug?.(`[MedicalAssistant] ${msg}`),
      info: (msg: string) => api.runtime.logging.info?.(`[MedicalAssistant] ${msg}`),
      warn: (msg: string) => api.runtime.logging.warn?.(`[MedicalAssistant] ${msg}`),
      error: (msg: string, err?: Error) =>
        api.runtime.logging.error?.(`[MedicalAssistant] ${msg}`, err),
    };

    logger.info("Initializing Medical Assistant Plugin v0.1.0");

    // 初始化插件上下文
    pluginContext = { config, api, logger };

    try {
      // 1. 注册数据模型
      logger.info("Registering data models...");
      await registerModels(pluginContext);

      // 2. 初始化消息处理模块
      logger.info("Initializing chat handler...");
      const chatHandler = new ChatHandler(pluginContext);
      await chatHandler.initialize();

      // 3. 注册管理后台 API 路由
      logger.info("Registering admin routes...");
      const adminRoutes = new AdminRoutes(pluginContext);
      await adminRoutes.register();

      // 4. 注册 RPC 方法
      logger.info("Registering RPC methods...");
      registerRpcMethods(api, pluginContext);

      // 5. 注册 HTTP 路由
      logger.info("Registering HTTP routes...");
      registerHttpRoutes(api, pluginContext);

      logger.info("Medical Assistant Plugin initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize plugin", error as Error);
      throw error;
    }
  },

  async unregister(): Promise<void> {
    if (pluginContext) {
      pluginContext.logger.info("Unregistering Medical Assistant Plugin");
      pluginContext = null;
    }
  },
};

/**
 * 注册 RPC 方法
 */
function registerRpcMethods(api: OpenClawPluginApi, ctx: PluginContext): void {
  // 医学问答 RPC
  api.registerRpcMethod({
    name: "medical.chat.ask",
    handler: async (params: { message: string; conversationId?: string; model?: string }) => {
      ctx.logger.info(`Medical chat ask: ${params.message.substring(0, 50)}...`);
      // TODO: 实现医学问答逻辑
      return {
        success: true,
        data: {
          messageId: `msg_${Date.now()}`,
          content: "这是一个示例回复。实际功能需要在后续迭代中实现。",
          confidence: "medium",
          disclaimer: ctx.config.medical?.disclaimer,
        },
      };
    },
  });

  // 获取对话列表
  api.registerRpcMethod({
    name: "medical.conversations.list",
    handler: async (params: { userId?: string; botId?: string; page?: number; limit?: number }) => {
      ctx.logger.debug("Listing conversations");
      return {
        success: true,
        data: {
          items: [],
          total: 0,
          page: params.page || 1,
          limit: params.limit || 20,
        },
      };
    },
  });

  // 获取机器人列表
  api.registerRpcMethod({
    name: "medical.bots.list",
    handler: async () => {
      ctx.logger.debug("Listing bots");
      return {
        success: true,
        data: [],
      };
    },
  });

  // 获取用户列表
  api.registerRpcMethod({
    name: "medical.users.list",
    handler: async () => {
      ctx.logger.debug("Listing users");
      return {
        success: true,
        data: [],
      };
    },
  });

  // 获取统计概览
  api.registerRpcMethod({
    name: "medical.stats.overview",
    handler: async () => {
      ctx.logger.debug("Getting stats overview");
      return {
        success: true,
        data: {
          today: { conversations: 0, messages: 0, activeUsers: 0 },
          total: { conversations: 0, messages: 0, users: 0, bots: 0 },
          modelUsage: [],
          avgLatency: 0,
          topBots: [],
        },
      };
    },
  });
}

/**
 * 注册 HTTP 路由
 */
function registerHttpRoutes(api: OpenClawPluginApi, ctx: PluginContext): void {
  const apiBasePath = ctx.config.api?.basePath || "/api/v1";

  // 健康检查
  api.registerHttpRoute({
    path: `${apiBasePath}/health`,
    auth: "plugin",
    match: "exact",
    handler: async (_req, res) => {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "ok",
          plugin: "medical-assistant",
          version: "0.1.0",
          timestamp: new Date().toISOString(),
        })
      );
      return true;
    },
  });

  // 插件信息
  api.registerHttpRoute({
    path: `${apiBasePath}/info`,
    auth: "plugin",
    match: "exact",
    handler: async (_req, res) => {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          name: ctx.config.metadata?.name || "宁唐医学助手",
          version: ctx.config.metadata?.version || "0.1.0",
          description: ctx.config.metadata?.description || "OpenClaw 医学问答插件",
          features: {
            chat: true,
            admin: ctx.config.admin?.enabled ?? true,
            sso: ctx.config.sso?.enabled ?? false,
          },
          models: {
            default: ctx.config.defaultModel || "kimi",
            available: Object.entries(ctx.config.models || {})
              .filter(([, cfg]) => cfg?.enabled)
              .map(([name]) => name),
          },
        })
      );
      return true;
    },
  });

  ctx.logger.info(`HTTP routes registered at ${apiBasePath}`);
}

export default medicalAssistantPlugin;
