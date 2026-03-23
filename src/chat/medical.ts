/**
 * 医学问答服务
 * Medical Chat Service
 */

import crypto from 'crypto';

// LLM 配置
const LLM_CONFIG = {
  baseURL: 'https://coding.dashscope.aliyuncs.com/apps/anthropic/v1',
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: process.env.ANTHROPIC_MODEL || 'kimi-k2.5',
};

// 请求历史记录
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  model?: string;
  conversationId?: string;
  temperature?: number;
  maxTokens?: number;
}

interface ChatResponse {
  success: boolean;
  data?: {
    messageId: string;
    content: string;
    confidence: 'high' | 'medium' | 'low';
    model: string;
    latency: number;
  };
  error?: string;
}

/**
 * 调用 LLM 生成回答
 */
async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResponse> {
  const startTime = Date.now();
  const model = options.model || LLM_CONFIG.model;

  try {
    const response = await fetch(`${LLM_CONFIG.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_CONFIG.apiKey}`,
        'x-api-key': LLM_CONFIG.apiKey,
      },
      body: JSON.stringify({
        model: model,
        max_tokens: options.maxTokens || 2048,
        temperature: options.temperature || 0.7,
        messages: messages.map(m => ({
          role: m.role,
          content: m.role === 'user' ? m.content : undefined,
          // assistant 消息只需要 role
        })).filter(m => m.content !== undefined || m.role === 'assistant'),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || 'API Error' };
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    return {
      success: true,
      data: {
        messageId: `msg_${crypto.randomUUID()}`,
        content: content,
        confidence: evaluateConfidence(content),
        model: model,
        latency: Date.now() - startTime,
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * 评估回答置信度
 */
function evaluateConfidence(content: string): 'high' | 'medium' | 'low' {
  // 简化版置信度评估
  const uncertainWords = ['可能', '也许', '不确定', '一般来说', '通常情况下'];
  const certainWords = ['确定', '肯定', '明确', '一定是', '绝对是'];

  let score = 0.5; // 基础分数

  // 扣分项
  uncertainWords.forEach(word => {
    if (content.includes(word)) score -= 0.15;
  });

  // 加分项
  certainWords.forEach(word => {
    if (content.includes(word)) score += 0.15;
  });

  // 回答长度适中给高分
  if (content.length > 50 && content.length < 1000) score += 0.1;

  // 超出范围
  if (score > 0.7) return 'high';
  if (score > 0.4) return 'medium';
  return 'low';
}

/**
 * 医学问答
 */
export async function medicalChat(
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
  options: ChatOptions = {}
): Promise<ChatResponse> {
  // 构建消息列表
  const messages: ChatMessage[] = [
    // 系统提示词
    {
      role: 'user',
      content: '你是专业的医学助手。请用专业、严谨的态度回答用户的医学问题。如果涉及诊断和治疗建议，请明确告知仅供参考，需咨询专业医生。',
    },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  return chat(messages, options);
}

/**
 * 流式医学问答（简化版，返回 mock）
 */
export async function medicalChatStream(
  userMessage: string,
  onChunk: (chunk: string) => void,
  onComplete: (response: ChatResponse) => void
): Promise<void> {
  const result = await medicalChat(userMessage);

  if (result.success && result.data) {
    // 模拟流式输出
    const content = result.data.content;
    for (let i = 0; i < content.length; i += 10) {
      onChunk(content.substring(i, i + 10));
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }

  onComplete(result);
}

export default { medicalChat, medicalChatStream };
