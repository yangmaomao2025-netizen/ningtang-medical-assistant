/**
 * 医学问答服务
 * Medical Chat Service
 */

import crypto from 'crypto';

// LLM 配置
const LLM_CONFIG = {
  baseURL: process.env.ANTHROPIC_BASE_URL || 'https://coding.dashscope.aliyuncs.com/apps/anthropic/v1',
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: process.env.ANTHROPIC_MODEL || 'kimi-k2.5',
};

// 请求历史记录
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  conversationId?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
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
        })).filter(m => m.content !== undefined || m.role === 'assistant'),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'API Error' }));
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
export function evaluateConfidence(content: string): 'high' | 'medium' | 'low' {
  const uncertainWords = ['可能', '也许', '不确定', '一般来说', '通常情况下', '不确定的', '建议咨询'];
  const certainWords = ['确定', '肯定', '明确', '一定是', '绝对是', '根据', '研究表明'];

  let score = 0.5;

  uncertainWords.forEach(word => {
    if (content.includes(word)) score -= 0.15;
  });

  certainWords.forEach(word => {
    if (content.includes(word)) score += 0.15;
  });

  if (content.length > 50 && content.length < 1000) score += 0.1;
  if (score > 0.7) return 'high';
  if (score > 0.4) return 'medium';
  return 'low';
}

/**
 * 评估免责声明和紧急情况
 */
export function evaluateDisclaimer(content: string): {
  disclaimer: string;
  detected: string[];
} {
  const urgentKeywords = [
    '胸痛', '呼吸困难', '大出血', '休克', '昏迷', '窒息',
    '中毒', '过敏性休克', '心梗', '心肌梗死', '中风', '脑卒中',
    '心脏骤停', '癫痫持续', '呕血', '便血', '高烧', '超高热',
  ];

  const detected: string[] = [];
  urgentKeywords.forEach(keyword => {
    if (content.includes(keyword)) {
      detected.push(keyword);
    }
  });

  return {
    disclaimer: '以上内容仅供参考，如有疑问请咨询专业医生。',
    detected,
  };
}

/**
 * 医学问答
 */
export async function medicalChat(
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
  options: ChatOptions = {}
): Promise<ChatResponse> {
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `你是专业的医学助手。请用专业、严谨的态度回答用户的医学问题。
重要提醒：
1. 如果涉及诊断和治疗建议，请明确告知仅供参考，需咨询专业医生。
2. 如果用户描述的症状可能涉及紧急情况（如胸痛、呼吸困难等），请立即提醒用户就医。
3. 回答应基于医学知识，给出置信度评估。`,
    },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  return chat(messages, options);
}

export default { medicalChat, evaluateConfidence, evaluateDisclaimer };
