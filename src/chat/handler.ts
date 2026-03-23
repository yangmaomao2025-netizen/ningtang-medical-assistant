/**
 * 消息处理器
 * Chat Handler
 */

import { medicalChat, medicalChatStream } from './medical.js';
import { evaluateDisclaimer } from './disclaimer.js';

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
  userId: string;
  botId: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

// 会话存储（简化版，生产环境用 Redis/MongoDB）
const conversations = new Map<string, Conversation>();

/**
 * 消息处理器类
 */
export class ChatHandler {
  private userConversations = new Map<string, string>(); // userId -> conversationId

  /**
   * 处理用户消息
   */
  async handleMessage(
    userId: string,
    botId: string,
    content: string,
    options: { model?: string; conversationId?: string } = {}
  ): Promise<{
    success: boolean;
    data?: {
      conversationId: string;
      messageId: string;
      content: string;
      confidence: 'high' | 'medium' | 'low';
      disclaimer: string;
      urgent: boolean;
      urgentMessage?: string;
      model: string;
      latency: number;
    };
    error?: string;
  }> {
    try {
      // 获取或创建会话
      let conversationId = options.conversationId || this.userConversations.get(userId);

      if (!conversationId || !conversations.has(conversationId)) {
        conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        conversations.set(conversationId, {
          id: conversationId,
          userId,
          botId,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        this.userConversations.set(userId, conversationId);
      }

      const conversation = conversations.get(conversationId)!;

      // 获取历史消息（用于上下文）
      const history = conversation.messages.map(m => ({
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
      const result = await medicalChat(content, history, { model: options.model });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // 评估免责声明和紧急情况
      const disclaimer = evaluateDisclaimer(result.data!.content);
      const urgent = disclaimer.urgent;
      const urgentMessage = urgent
        ? '⚠️ 警告：您的描述可能涉及紧急症状，请立即就医或拨打急救电话！'
        : undefined;

      // 添加 AI 回复
      const assistantMessageId = `msg_${Date.now() + 1}`;
      conversation.messages.push({
        id: assistantMessageId,
        role: 'assistant',
        content: result.data!.content,
        timestamp: new Date(),
        confidence: result.data!.confidence,
        model: result.data!.model,
      });

      // 更新会话时间
      conversation.updatedAt = new Date();

      return {
        success: true,
        data: {
          conversationId,
          messageId: assistantMessageId,
          content: result.data!.content,
          confidence: result.data!.confidence,
          disclaimer: disclaimer.text,
          urgent,
          urgentMessage,
          model: result.data!.model,
          latency: result.data!.latency,
        },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 流式处理消息
   */
  async handleMessageStream(
    userId: string,
    botId: string,
    content: string,
    onChunk: (chunk: string) => void,
    onComplete: (result: ReturnType<typeof this.handleMessage>) => void,
    options: { model?: string; conversationId?: string } = {}
  ): Promise<void> {
    const result = await this.handleMessage(userId, botId, content, options);

    if (result.success && result.data) {
      // 模拟流式输出
      const content = result.data.content;
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
  getConversation(userId: string, conversationId: string): Message[] {
    const conversation = conversations.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      return [];
    }
    return conversation.messages;
  }

  /**
   * 获取用户的所有会话
   */
  getUserConversations(userId: string): Conversation[] {
    const result: Conversation[] = [];
    conversations.forEach(conv => {
      if (conv.userId === userId) {
        result.push(conv);
      }
    });
    return result;
  }

  /**
   * 删除会话
   */
  deleteConversation(userId: string, conversationId: string): boolean {
    const conversation = conversations.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      return false;
    }
    conversations.delete(conversationId);
    this.userConversations.delete(userId);
    return true;
  }
}

export default ChatHandler;
