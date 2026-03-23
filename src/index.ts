/**
 * 宁唐医学助手 - OpenClaw 插件
 * Medical Assistant Plugin for OpenClaw
 */

import type { OpenClawPlugin } from 'openclaw/plugin-sdk/core';
import { medicalChat, evaluateDisclaimer } from './chat/medical.js';
import { ChatHandler } from './chat/handler.js';

// 紧急症状关键词
const URGENT_KEYWORDS = [
  '胸痛', '呼吸困难', '大出血', '休克', '昏迷', '窒息',
  '中毒', '过敏性休克', '心梗', '心肌梗死', '中风',
  '脑卒中', '心脏骤停', '癫痫持续', '呕血', '便血',
];

// 免责声明
const DEFAULT_DISCLAIMER = '以上内容仅供参考，如有疑问请咨询专业医生。';

// 初始化聊天处理器
const chatHandler = new ChatHandler();

/**
 * 插件配置 Schema
 */
const pluginConfigSchema = {
  type: 'object',
  properties: {
    apiKey: { type: 'string' },
    model: { type: 'string', default: 'kimi-k2.5' },
    baseUrl: { type: 'string' },
    disclaimer: { type: 'string' },
    urgentKeywords: { type: 'array', items: { type: 'string' } },
  },
};

/**
 * 插件元数据
 */
const plugin = {
  id: 'medical-assistant',
  name: '宁唐医学助手',
  description: '专业的医学问答助手插件',
  version: '1.0.0',
  configSchema: pluginConfigSchema,
};

/**
 * 注册插件
 */
export default function register(api: OpenClawPlugin): void {
  // 注册 HTTP 路由
  api.registerHttpRoute({
    path: '/medical/chat',
    auth: 'gateway',
    match: 'prefix',
    handler: async (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const pathname = url.pathname;

      // 处理 /medical/chat/ask
      if (pathname === '/medical/chat/ask' || pathname.endsWith('/medical/chat/ask')) {
        return handleChatAsk(req, res, api);
      }

      // 处理 /medical/chat/stream
      if (pathname === '/medical/chat/stream' || pathname.endsWith('/medical/chat/stream')) {
        return handleChatStream(req, res, api);
      }

      // 处理 /medical/health
      if (pathname === '/medical/health') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'ok', service: 'medical-assistant' }));
        return true;
      }

      return false;
    },
  });

  // 注册系统提示词钩子 - 医学助手专用提示
  api.on('before_prompt_build', (event, ctx) => {
    // 检查是否是医学相关对话
    const lastMessage = ctx.messages?.[ctx.messages.length - 1];
    if (lastMessage?.content) {
      const content = lastMessage.content.toLowerCase();
      // 简单的医学关键词检测
      const medicalKeywords = ['医学', '医生', '医院', '疾病', '症状', '治疗', '药品', '药物', '诊断', '检查'];
      const isMedical = medicalKeywords.some(kw => content.includes(kw));
      
      if (isMedical) {
        return {
          prependSystemContext: `你是一位专业的医学助手。请用专业、严谨的态度回答用户的医学问题。
重要提醒：
1. 如果涉及诊断和治疗建议，请明确告知仅供参考，需咨询专业医生。
2. 如果用户描述的症状可能涉及紧急情况（如胸痛、呼吸困难、大出血等），请立即提醒用户就医。
3. 回答应基于医学知识，给出置信度评估。`,
        };
      }
    }
    return {};
  });

  console.log('[Medical Assistant] 插件已加载');
}

/**
 * 处理聊天请求
 */
async function handleChatAsk(req: any, res: any, api: OpenClawPlugin): Promise<boolean> {
  try {
    // 解析请求体
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString());

    const { message, conversationId, model } = body;

    if (!message) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'message is required' }));
      return true;
    }

    // 调用医学问答
    const result = await chatHandler.handleMessage(
      message,
      conversationId,
      model
    );

    // 评估紧急情况
    const disclaimerResult = evaluateDisclaimer(result.content);
    const urgent = disclaimerResult.detected.length > 0;

    // 构建响应
    const response = {
      success: true,
      data: {
        conversationId: result.conversationId,
        messageId: result.messageId,
        content: result.content,
        confidence: result.confidence,
        disclaimer: disclaimerResult.disclaimer,
        urgent,
        urgentMessage: urgent ? `⚠️ 您的描述可能涉及紧急症状 [${disclaimerResult.detected.join(', ')}]，请立即就医！` : undefined,
        model: result.model,
        latency: result.latency,
      },
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(response));
    return true;
  } catch (error) {
    console.error('[Medical Assistant] Chat error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: (error as Error).message }));
    return true;
  }
}

/**
 * 处理流式聊天请求
 */
async function handleChatStream(req: any, res: any, api: OpenClawPlugin): Promise<boolean> {
  try {
    // 解析请求体
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString());

    const { message, conversationId, model } = body;

    if (!message) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'message is required' }));
      return true;
    }

    // 设置 SSE 头
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 调用医学问答（流式）
    const result = await chatHandler.handleMessageStream(
      message,
      conversationId,
      model,
      (chunk) => {
        res.write(`event: message\ndata: ${JSON.stringify({ content: chunk })}\n\n`);
      },
      (finalResult) => {
        // 发送完成事件
        const disclaimerResult = evaluateDisclaimer(finalResult.content);
        res.write(`event: done\ndata: ${JSON.stringify({
          conversationId: finalResult.conversationId,
          messageId: finalResult.messageId,
          confidence: finalResult.confidence,
          disclaimer: disclaimerResult.disclaimer,
          urgent: disclaimerResult.detected.length > 0,
        })}\n\n`);
        res.end();
      }
    );

    return true;
  } catch (error) {
    console.error('[Medical Assistant] Stream error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: (error as Error).message }));
    return true;
  }
}

export { plugin };
