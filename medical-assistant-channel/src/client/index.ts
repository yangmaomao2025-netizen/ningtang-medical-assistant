import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import type { 
  ClientConnection, 
  ClientMessage, 
  ServerMessage,
  WebSocketFrame,
  MedicalChannelConfig 
} from '../types/index.js';
import { verifyToken } from '../auth/index.js';
import { MessageHandler } from '../handler/index.js';

/**
 * 医学助手 WebSocket 客户端服务器
 */
export class MedicalClientServer {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, ClientConnection> = new Map();
  private handler: MessageHandler;

  constructor(
    private config: MedicalChannelConfig,
    jwtSecret: string
  ) {
    this.handler = new MessageHandler({
      jwtSecret,
      platformUrl: config.platformUrl,
      appId: config.appId,
      appSecret: config.appSecret,
    });
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({
          host: this.config.host,
          port: this.config.port,
        });

        this.wss.on('listening', () => {
          console.log(`[MedicalChannel] 服务器已启动: ${this.config.host}:${this.config.port}`);
          resolve();
        });

        this.wss.on('connection', (socket, request) => {
          this.handleConnection(socket, request);
        });

        this.wss.on('error', (error) => {
          console.error('[MedicalChannel] 服务器错误:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // 关闭所有连接
      for (const connection of this.connections.values()) {
        connection.socket.close();
      }
      this.connections.clear();

      // 关闭服务器
      if (this.wss) {
        this.wss.close(() => {
          console.log('[MedicalChannel] 服务器已停止');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 处理新连接
   */
  private async handleConnection(socket: WebSocket, request: any): Promise<void> {
    const connectionId = randomUUID();
    console.log(`[MedicalChannel] 新连接: ${connectionId}`);

    // 等待认证消息
    let authenticated = false;
    let connection: ClientConnection | null = null;

    const handleMessage = async (data: Buffer) => {
      try {
        const rawMessage = data.toString();
        const frame = JSON.parse(rawMessage);

        // 处理 WebSocket 帧
        if (frame.type === 'req' && frame.method === 'connect') {
          // 处理连接认证
          const authResult = this.handleConnect(frame, socket, connectionId);
          
          if (authResult.success && authResult.connection) {
            authenticated = true;
            connection = authResult.connection;
            this.connections.set(connectionId, connection);
            
            // 发送认证成功响应
            this.sendResponse(socket, frame.id, { 
              ok: true, 
              payload: { 
                connectionId,
                status: 'connected' 
              } 
            });

            console.log(`[MedicalChannel] 连接已认证: ${connectionId}, userId: ${connection.userId}`);
          } else {
            // 发送认证失败
            this.sendResponse(socket, frame.id, { 
              ok: false, 
              error: authResult.error 
            });
            socket.close();
          }
        } else if (!authenticated) {
          // 未认证的连接拒绝处理
          this.sendFrame(socket, {
            type: 'event',
            event: 'error',
            payload: { code: 'UNAUTHORIZED', message: '请先进行认证' }
          });
          socket.close();
        } else if (frame.type === 'req') {
          // 处理请求消息
          const response = await this.handler.handleMessage(
            connection!,
            JSON.stringify(frame.params?.message || frame.params)
          );
          
          if (response) {
            this.sendFrame(socket, {
              type: 'event',
              event: 'message',
              payload: response
            });
          }
        } else if (frame.type === 'ping') {
          // 处理心跳
          this.sendFrame(socket, { type: 'pong' });
        }
      } catch (error) {
        console.error(`[MedicalChannel] 消息处理错误: ${connectionId}`, error);
        
        if (!authenticated) {
          socket.close();
        }
      }
    };

    const handleClose = () => {
      console.log(`[MedicalChannel] 连接关闭: ${connectionId}`);
      if (connectionId) {
        this.connections.delete(connectionId);
        this.handler.removeConnection(connectionId);
      }
      socket.removeListener('message', handleMessage);
      socket.removeListener('close', handleClose);
    };

    socket.on('message', handleMessage);
    socket.on('close', handleClose);
    socket.on('error', (error) => {
      console.error(`[MedicalChannel] WebSocket 错误: ${connectionId}`, error);
    });

    // 设置超时
    setTimeout(() => {
      if (!authenticated) {
        console.log(`[MedicalChannel] 连接超时: ${connectionId}`);
        socket.close();
      }
    }, 30000); // 30秒超时
  }

  /**
   * 处理连接认证
   */
  private handleConnect(
    frame: WebSocketFrame,
    socket: WebSocket,
    connectionId: string
  ): { 
    success: boolean; 
    connection?: ClientConnection; 
    error?: { code: string; message: string } 
  } {
    try {
      const { token, platform, deviceId, botId } = frame.params || {};

      if (!token) {
        return {
          success: false,
          error: { code: 'INVALID_TOKEN', message: '缺少认证 token' }
        };
      }

      // 验证 Token
      const authResult = verifyToken(token, this.config.jwtSecret);
      
      if (!authResult.valid || !authResult.payload) {
        return {
          success: false,
          error: { code: authResult.error?.code || 'INVALID_TOKEN', message: authResult.error?.message || '认证失败' }
        };
      }

      // 创建连接对象
      const connection: ClientConnection = {
        id: connectionId,
        userId: authResult.payload.userId,
        botId: botId || authResult.payload.botId || '',
        sessionId: authResult.payload.sessionId || '',
        socket,
        platform: platform || 'web',
        deviceId: deviceId || '',
        connectedAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      return { success: true, connection };
    } catch (error) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '认证处理失败' }
      };
    }
  }

  /**
   * 发送响应帧
   */
  private sendResponse(
    socket: WebSocket, 
    id: string | undefined, 
    data: { ok: boolean; payload?: any; error?: any }
  ): void {
    if (!id) return;
    
    this.sendFrame(socket, {
      type: 'res',
      id,
      ok: data.ok,
      payload: data.payload,
      error: data.error,
    });
  }

  /**
   * 发送帧
   */
  private sendFrame(socket: WebSocket, frame: Partial<WebSocketFrame>): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(frame));
    }
  }

  /**
   * 获取连接统计
   */
  getStats(): {
    totalConnections: number;
    connectionsByPlatform: Record<string, number>;
  } {
    const connectionsByPlatform: Record<string, number> = {
      web: 0,
      macos: 0,
      android: 0,
    };

    for (const conn of this.connections.values()) {
      connectionsByPlatform[conn.platform] = (connectionsByPlatform[conn.platform] || 0) + 1;
    }

    return {
      totalConnections: this.connections.size,
      connectionsByPlatform,
    };
  }
}
