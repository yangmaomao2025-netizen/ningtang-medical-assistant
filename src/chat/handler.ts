/**
 * 消息处理器
 * Chat Handler
 */

import { medicalChat, evaluateConfidence, type ChatMessage } from './medical.js';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  confidence?: 'high' | 'medium' | 'low';
  model?: string;
  metadata?: Record<string, unknown>;
}

interface Conversation {
  id: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

// 会话存储（简化版，生产环境用 Redis/MongoDB）
const conversations = new Map<string, Conversation>();

/**
 * 聊天结果
 */
export interface ChatResult {
  conversationId: string;
  messageId: string;
  content: string;
  confidence: 'high' | 'medium' | 'low';
  model: string;
  latency: number;
}

/**
 * 消息处理器类
 */
export class ChatHandler {
  /**
   * 处理用户消息
   */
  async handleMessage(
    content: string,
    conversationId?: string,
    model?: string
  ): Promise<ChatResult> {
    // 获取或创建会话
    let convId = conversationId;
    if (!convId || !conversations.has(convId)) {
      convId = `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      conversations.set(convId, {
        id: convId,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const conversation = conversations.get(convId)!;

    // 获取历史消息
    const history: ChatMessage[] = conversation.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // 添加用户消息
    const userMessageId = `msg_${Date.now()}`;
    conversation.messages.push({
      id: userMessageId,
      role: 'user',
      content,
      timestamp: new Date(),
    });

    // 调用医学问答服务
    const result = await medicalChat(content, history, { model });

    // 添加 AI 回复
    const assistantMessageId = `msg_${Date.now() + 1}`;
    conversation.messages.push({
      id: assistantMessageId,
      role: 'assistant',
      content: result.data?.content || '',
      timestamp: new Date(),
      confidence: result.data?.confidence,
      model: result.data?.model,
    });

    conversation.updatedAt = new Date();

    return {
      conversationId: convId,
      messageId: assistantMessageId,
      content: result.data?.content || '',
      confidence: result.data?.confidence || 'medium',
      model: result.data?.model || model || 'unknown',
      latency: result.data?.latency || 0,
    };
  }

  /**
   * 流式处理消息
   */
  async handleMessageStream(
    content: string,
    conversationId: string | undefined,
    model: string | undefined,
    onChunk: (chunk: string) => void,
    onComplete: (result: ChatResult) => void
  ): Promise<void> {
    const result = await this.handleMessage(content, conversationId, model);

    if (result.content) {
      // 模拟流式输出
      const content = result.content;
      for (let i = 0; i < content.length; i += 5) {
        onChunk(content.substring(i, Math.min(i + 5, content.length)));
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    onComplete(result);
  }

  /**
   * 获取会话消息
   */
  getConversation(convId: string): Message[] {
    const conversation = conversations.get(convId);
    return conversation?.messages || [];
  }

  /**
   * 删除会话
   */
  deleteConversation(convId: string): boolean {
    return conversations.delete(convId);
  }
}

export default ChatHandler;
