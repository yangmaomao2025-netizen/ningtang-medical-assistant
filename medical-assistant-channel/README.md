# 宁唐医学助手 - OpenClaw 通道插件

## 功能特性

- 🌐 **WebSocket 消息通道** - 客户端通过 WebSocket 连接
- 🔐 **JWT Token 认证** - 安全的消息认证机制
- 🏥 **医学问答 AI** - 基于阿里云百炼 API 的医学问答
- 📊 **置信度标注** - AI 回复附带置信度指示
- ⚠️ **紧急提示** - 检测紧急症状时发出警告
- 📝 **免责声明** - 每条 AI 回复附带医学免责声明

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 直接运行

```bash
# 设置环境变量
export MEDICAL_PORT=8090
export MEDICAL_HOST=0.0.0.0
export MEDICAL_JWT_SECRET=your-secret-key
export MEDICAL_PLATFORM_URL=http://localhost:3000

# 运行
npx tsx src/index.ts
```

## 配置

### 插件配置 (openclaw.plugin.json)

```json
{
  "id": "medical-assistant",
  "configSchema": {
    "type": "object",
    "properties": {
      "enabled": { "type": "boolean", "default": true },
      "port": { "type": "integer", "default": 8090 },
      "host": { "type": "string", "default": "0.0.0.0" },
      "platformUrl": { "type": "string" },
      "appId": { "type": "string" },
      "appSecret": { "type": "string" },
      "jwtSecret": { "type": "string" }
    }
  }
}
```

## 客户端协议

### 连接认证

```json
// 发送
{
  "type": "req",
  "id": "req-001",
  "method": "connect",
  "params": {
    "token": "jwt-token",
    "platform": "web|macos|android",
    "deviceId": "device-uuid",
    "botId": "bot-id"
  }
}

// 接收
{
  "type": "res",
  "id": "req-001",
  "ok": true,
  "payload": {
    "connectionId": "conn-uuid",
    "status": "connected"
  }
}
```

### 发送消息

```json
// 发送
{
  "type": "req",
  "id": "req-002",
  "method": "send",
  "params": {
    "message": {
      "type": "text",
      "content": "你好，我头痛应该怎么办？",
      "botId": "bot-001",
      "sessionId": "session-001"
    }
  }
}

// 接收（加载中）
{
  "type": "event",
  "event": "message",
  "payload": {
    "type": "loading",
    "content": "请稍候...",
    "messageId": "loading-req-002"
  }
}

// 接收（AI 回复）
{
  "type": "event",
  "event": "message",
  "payload": {
    "type": "text",
    "content": "根据您描述的症状...",
    "messageId": "msg-uuid",
    "sessionId": "session-001",
    "botId": "bot-001",
    "timestamp": 1711234567890,
    "metadata": {
      "confidence": "high",
      "disclaimer": "⚠️ 免责声明...",
      "urgent": false,
      "suggestions": ["这个情况需要注意什么？"]
    }
  }
}
```

## 目录结构

```
medical-assistant-channel/
├── openclaw.plugin.json  # 插件清单
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts           # 插件入口
    ├── types/
    │   └── index.ts       # 类型定义
    ├── auth/
    │   └── index.ts       # JWT 认证
    ├── handler/
    │   ├── index.ts       # 消息处理器
    │   └── medical.ts     # 医学 AI 集成
    └── client/
        └── index.ts       # WebSocket 客户端服务器
```

## 安全说明

- 生产环境请务必修改 `jwtSecret`
- 使用 HTTPS 传输（通过代理）
- 定期更新 API Key

## License

MIT
