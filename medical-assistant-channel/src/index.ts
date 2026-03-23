import { MedicalClientServer } from './client/index.js';
import { MedicalChannelConfigSchema, type MedicalChannelConfig } from './types/index.js';

/**
 * 医学助手通道插件
 */
export class MedicalAssistantChannel {
  private server: MedicalClientServer | null = null;
  private config: MedicalChannelConfig;

  constructor(config: Record<string, any>) {
    // 验证并解析配置
    this.config = MedicalChannelConfigSchema.parse(config);
  }

  /**
   * 启动插件
   */
  async start(): Promise<void> {
    console.log('[MedicalChannel] 正在启动...');
    console.log(`[MedicalChannel] 配置:`, {
      port: this.config.port,
      host: this.config.host,
      platformUrl: this.config.platformUrl,
    });

    this.server = new MedicalClientServer(this.config, this.config.jwtSecret);
    await this.server.start();

    console.log('[MedicalChannel] 插件已启动');
  }

  /**
   * 停止插件
   */
  async stop(): Promise<void> {
    console.log('[MedicalChannel] 正在停止...');
    
    if (this.server) {
      await this.server.stop();
      this.server = null;
    }
    
    console.log('[MedicalChannel] 插件已停止');
  }

  /**
   * 获取状态
   */
  getStatus(): {
    running: boolean;
    stats?: {
      totalConnections: number;
      connectionsByPlatform: Record<string, number>;
    };
  } {
    if (!this.server) {
      return { running: false };
    }

    return {
      running: true,
      stats: this.server.getStats(),
    };
  }
}

// 插件入口
export default {
  id: 'medical-assistant',
  name: '宁唐医学助手',
  description: '宁唐医学助手 - 专业的医学问答消息通道插件',
  
  // 插件配置 Schema
  configSchema: MedicalChannelConfigSchema,
  
  // 创建插件实例
  create: (config: Record<string, any>) => new MedicalAssistantChannel(config),
};

// 运行时入口（用于直接运行）
if (import.meta.url === `file://${process.argv[1]}`) {
  const config: MedicalChannelConfig = {
    enabled: true,
    port: parseInt(process.env.MEDICAL_PORT || '8090', 10),
    host: process.env.MEDICAL_HOST || '0.0.0.0',
    platformUrl: process.env.MEDICAL_PLATFORM_URL,
    appId: process.env.MEDICAL_APP_ID,
    appSecret: process.env.MEDICAL_APP_SECRET,
    jwtSecret: process.env.MEDICAL_JWT_SECRET || 'medical-assistant-secret-key-change-in-production',
  };

  const plugin = new MedicalAssistantChannel(config);

  // 优雅关闭
  process.on('SIGINT', async () => {
    console.log('\n[MedicalChannel] 收到关闭信号...');
    await plugin.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[MedicalChannel] 收到终止信号...');
    await plugin.stop();
    process.exit(0);
  });

  // 启动
  plugin.start().catch((error) => {
    console.error('[MedicalChannel] 启动失败:', error);
    process.exit(1);
  });
}
