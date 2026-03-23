import { z } from 'zod';

// ============== 配置文件 ==============
export const MedicalChannelConfigSchema = z.object({
  enabled: z.boolean().default(true),
  port: z.number().default(8090),
  host: z.string().default('0.0.0.0'),
  platformUrl: z.string().optional(),
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  jwtSecret: z.string().default('medical-assistant-secret-key'),
});

export type MedicalChannelConfig = z.infer<typeof MedicalChannelConfigSchema>;

// ============== 消息协议 ==============

// 客户端 → 插件消息
export const ClientMessageSchema = z.object({
  type: z.enum(['text', 'image', 'file', 'audio']),
  content: z.string(),
  sessionId: z.string().optional(),
  botId: z.string(),
  messageId: z.string().optional(),
  timestamp: z.number().default(() => Date.now()),
  metadata: z.record(z.any).optional(),
});

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// 插件 → 客户端消息
export const ServerMessageSchema = z.object({
  type: z.enum(['text', 'image', 'file', 'audio', 'ack', 'error', 'loading']),
  content: z.string(),
  messageId: z.string(),
  sessionId: z.string().optional(),
  botId: z.string(),
  timestamp: z.number(),
  metadata: z.record(z.any).optional(),
});

export type ServerMessage = z.infer<typeof ServerMessageSchema>;

// ============== WebSocket 帧 ==============

export const WebSocketFrameSchema = z.object({
  type: z.enum(['req', 'res', 'event']),
  id: z.string().optional(),
  method: z.string().optional(),
  params: z.record(z.any).optional(),
  ok: z.boolean().optional(),
  payload: z.any().optional(),
  error: z.any().optional(),
  event: z.string().optional(),
});

export type WebSocketFrame = z.infer<typeof WebSocketFrameSchema>;

// ============== 认证 ==============

export const TokenPayloadSchema = z.object({
  userId: z.string(),
  botId: z.string(),
  sessionId: z.string().optional(),
  exp: z.number(),
  iat: z.number(),
});

export type TokenPayload = z.infer<typeof TokenPayloadSchema>;

// ============== 连接状态 ==============

export interface ClientConnection {
  id: string;
  userId: string;
  botId: string;
  sessionId: string;
  socket: any;
  platform: 'web' | 'macos' | 'android';
  deviceId: string;
  connectedAt: number;
  lastActivityAt: number;
}

// ============== 会话 ==============

export interface ChatSession {
  id: string;
  userId: string;
  botId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  type: 'text' | 'image' | 'file' | 'audio';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

// ============== AI 响应 ==============

export interface AIResponse {
  content: string;
  confidence: 'high' | 'medium' | 'low';
  disclaimer: string;
  urgent: boolean;
  urgentMessage?: string;
  suggestions?: string[];
}

// ============== 错误码 ==============

export enum ErrorCode {
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  BOT_NOT_FOUND = 'BOT_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PLATFORM_ERROR = 'PLATFORM_ERROR',
  INVALID_MESSAGE = 'INVALID_MESSAGE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
