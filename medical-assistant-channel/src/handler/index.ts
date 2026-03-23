import { randomUUID } from 'crypto';
import type { 
  ClientMessage, 
  ServerMessage, 
  AIResponse,
  ClientConnection,
  ErrorCode 
} from '../types/index.js';
import { generateAIResponse } from './medical.js';

export interface MessageHandlerOptions {
  jwtSecret: string;
  platformUrl?: string;
  appId?: string;
  appSecret?: string;
}

/**
 * 消息处理器
 */
export class MessageHandler {
  private connections: Map<string, ClientConnection> = new Map();
  private sessions: Map<string, { userId: string; botId: string; messages: any[] }> = new Map();

  constructor(private options: MessageHandlerOptions) {}

  /**
   * 处理客户端消息
   */
  async handleMessage(
    connection: ClientConnection,
    rawMessage: string
  ): Promise<ServerMessage | null> {
    let clientMessage: ClientMessage;

    try {
      clientMessage = JSON.parse(rawMessage);
    } catch {
      return this.createErrorMessage(
        connection,
        'INVALID_MESSAGE',
        '无效的消息格式'
      );
    }

    // 验证消息类型
    if (!clientMessage.type || !clientMessage.content) {
      return this.createErrorMessage(
        connection,
        'INVALID_MESSAGE',
        '缺少必要的消息字段'
      );
    }

    // 处理不同类型的消息
    switch (clientMessage.type) {
      case 'text':
        return this.handleTextMessage(connection, clientMessage);
      case 'image':
      case 'file':
      case 'audio':
        return this.handleMediaMessage(connection, clientMessage);
      default:
        return this.createErrorMessage(
          connection,
          'INVALID_MESSAGE',
          `不支持的消息类型: ${clientMessage.type}`
        );
    }
  }

  /**
   * 处理文本消息
   */
  private async handleTextMessage(
    connection: ClientConnection,
    message: ClientMessage
  ): Promise<ServerMessage> {
    const messageId = message.messageId || randomUUID();
    const sessionId = message.sessionId || this.getOrCreateSessionId(connection);

    // 发送加载中状态
    this.sendLoadingMessage(connection, messageId, sessionId);

    // 调用医学问答 AI
    const aiResponse = await generateAIResponse(message.content, {
      userId: connection.userId,
      botId: connection.botId,
      sessionId,
    });

    // 构建 AI 响应消息
    return this.createTextMessage(
      connection,
      aiResponse.content,
      messageId,
      sessionId,
      aiResponse
    );
  }

  /**
   * 处理媒体消息
   */
  private async handleMediaMessage(
    connection: ClientConnection,
    message: ClientMessage
  ): Promise<ServerMessage> {
    const messageId = message.messageId || randomUUID();
    const sessionId = message.sessionId || this.getOrCreateSessionId(connection);

    // 媒体消息暂不支持，返回提示
    return this.createTextMessage(
      connection,
      '抱歉，当前版本暂不支持图片、文件、语音消息，请稍后再试。',
      messageId,
      sessionId
    );
  }

  /**
   * 获取或创建会话 ID
   */
  private getOrCreateSessionId(connection: ClientConnection): string {
    const key = `${connection.userId}:${connection.botId}`;
    let session = this.sessions.get(key);
    
    if (!session) {
      session = {
        userId: connection.userId,
        botId: connection.botId,
        messages: [],
      };
      this.sessions.set(key, session);
    }

    return `${connection.userId}:${connection.botId}:${Date.now()}`;
  }

  /**
   * 创建文本消息
   */
  private createTextMessage(
    connection: ClientConnection,
    content: string,
    messageId: string,
    sessionId?: string,
    aiResponse?: AIResponse
  ): ServerMessage {
    const response: ServerMessage = {
      type: 'text',
      content,
      messageId: randomUUID(),
      sessionId,
      botId: connection.botId,
      timestamp: Date.now(),
      metadata: {},
    };

    // 添加 AI 响应元数据
    if (aiResponse) {
      response.metadata = {
        confidence: aiResponse.confidence,
        disclaimer: aiResponse.disclaimer,
        urgent: aiResponse.urgent,
        urgentMessage: aiResponse.urgentMessage,
        suggestions: aiResponse.suggestions,
      };
    }

    return response;
  }

  /**
   * 创建错误消息
   */
  private createErrorMessage(
    connection: ClientConnection,
    code: ErrorCode | string,
    message: string,
    messageId?: string
  ): ServerMessage {
    return {
      type: 'error',
      content: message,
      messageId: messageId || randomUUID(),
      botId: connection.botId,
      timestamp: Date.now(),
      metadata: { code },
    };
  }

  /**
   * 发送加载中消息
   */
  private sendLoadingMessage(
    connection: ClientConnection,
    messageId: string,
    sessionId?: string
  ): void {
    const loadingMessage: ServerMessage = {
      type: 'loading',
      content: '请稍候...',
      messageId: `loading-${messageId}`,
      sessionId,
      botId: connection.botId,
      timestamp: Date.now(),
    };

    if (connection.socket.readyState === 1) { // OPEN
      connection.socket.send(JSON.stringify(loadingMessage));
    }
  }

  /**
   * 注册连接
   */
  registerConnection(connection: ClientConnection): void {
    this.connections.set(connection.id, connection);
  }

  /**
   * 移除连接
   */
  removeConnection(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  /**
   * 获取连接
   */
  getConnection(connectionId: string): ClientConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * 获取所有连接
   */
  getAllConnections(): ClientConnection[] {
    return Array.from(this.connections.values());
  }
}
