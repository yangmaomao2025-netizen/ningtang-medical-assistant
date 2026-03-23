import type { AIResponse } from '../types/index.js';

// 阿里云百炼 API 配置
const API_BASE_URL = 'https://coding.dashscope.aliyuncs.com/apps/anthropic/v1';
const API_KEY = 'sk-sp-6b8528e7ea014f5190e5dbe3d73388b8';
const MODEL = 'kimi-k2.5';

/**
 * 医学免责声明
 */
const MEDICAL_DISCLAIMER = `⚠️ 免责声明：本 AI 助手仅提供一般性健康信息，不能替代专业医生的诊断和治疗建议。请务必咨询医疗专业人士获取准确的医疗建议。`;

/**
 * 紧急症状关键词
 */
const URGENT_KEYWORDS = [
  '胸痛', '胸闷', '呼吸困难', '大出血', '休克', 
  '意识丧失', '中风', '心脏病发作', '严重过敏',
  '自杀', '自残', '中毒'
];

/**
 * 生成医学 AI 响应
 */
export async function generateAIResponse(
  userMessage: string,
  context: {
    userId: string;
    botId: string;
    sessionId: string;
  }
): Promise<AIResponse> {
  try {
    // 调用阿里云百炼 API
    const response = await fetch(`${API_BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `你是宁唐医学助手，一个专业的医学问答助手。
              
核心原则：
1. 始终以用户健康安全为首要考虑
2. 提供准确、专业的医学信息
3. 遇到紧急症状立即提示就医
4. 明确说明 AI 不能替代医生诊断

回答风格：
- 专业但易懂
- 包含具体的健康建议
- 适当使用列表和结构化表达
- 在适当时候建议就医检查

每次回答必须包含：
1. 主要回答内容
2. 可能的进一步建议
3. 免责声明（已在上下文中提供）

当用户提到紧急症状时（胸痛、呼吸困难、大量出血等），必须：
- 立即建议立即就医或拨打急救电话
- 不要试图进行远程诊断
- 强调这是紧急情况`
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API Error:', response.status, errorText);
      throw new Error(`AI API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '抱歉，我现在无法回答这个问题，请稍后再试。';

    // 分析消息是否涉及紧急症状
    const urgentResult = analyzeUrgentSymptoms(userMessage);
    
    // 评估回答的置信度
    const confidence = evaluateConfidence(userMessage, content);

    // 生成追问建议
    const suggestions = generateSuggestions(userMessage, content);

    // 构建完整响应
    let fullContent = content;
    
    // 添加紧急提示
    if (urgentResult.isUrgent) {
      fullContent = `🚨 **紧急提示**\n\n${urgentResult.message}\n\n---\n\n${content}`;
    }

    // 添加建议追问
    if (suggestions.length > 0) {
      fullContent += `\n\n**您可能还想了解：**\n${suggestions.map(s => `- ${s}`).join('\n')}`;
    }

    return {
      content: fullContent,
      confidence,
      disclaimer: MEDICAL_DISCLAIMER,
      urgent: urgentResult.isUrgent,
      urgentMessage: urgentResult.isUrgent ? urgentResult.message : undefined,
      suggestions,
    };
  } catch (error) {
    console.error('generateAIResponse error:', error);
    
    return {
      content: '抱歉，我现在无法回答这个问题，请稍后再试。如果情况紧急，请立即就医或拨打急救电话。',
      confidence: 'low',
      disclaimer: MEDICAL_DISCLAIMER,
      urgent: false,
      suggestions: [
        '请稍后再试',
        '如果情况紧急，请立即就医'
      ],
    };
  }
}

/**
 * 分析是否涉及紧急症状
 */
function analyzeUrgentSymptoms(message: string): {
  isUrgent: boolean;
  message?: string;
  matchedKeywords?: string[];
} {
  const matchedKeywords: string[] = [];
  
  for (const keyword of URGENT_KEYWORDS) {
    if (message.includes(keyword)) {
      matchedKeywords.push(keyword);
    }
  }

  if (matchedKeywords.length > 0) {
    return {
      isUrgent: true,
      message: `检测到可能涉及紧急症状（${matchedKeywords.join('、')}），建议您立即就医或拨打当地急救电话获取专业医疗帮助。不要延迟！`,
      matchedKeywords,
    };
  }

  return { isUrgent: false };
}

/**
 * 评估回答置信度
 */
function evaluateConfidence(userMessage: string, aiContent: string): 'high' | 'medium' | 'low' {
  // 检查是否有明确的医学问题
  const hasMedicalTerms = /症状|治疗|药物|疾病|诊断|检查|手术|病因/.test(userMessage);
  
  // 检查回答是否包含足够的具体信息
  const hasSpecificInfo = /\d+|具体|建议|注意|可能/.test(aiContent);
  
  // 检查是否有不确定表述
  const hasUncertainty = /不确定|可能|也许|建议就医/.test(aiContent);

  if (hasMedicalTerms && hasSpecificInfo && !hasUncertainty) {
    return 'high';
  }
  
  if (hasMedicalTerms || hasSpecificInfo) {
    return 'medium';
  }
  
  return 'low';
}

/**
 * 生成追问建议
 */
function generateSuggestions(userMessage: string, aiContent: string): string[] {
  const suggestions: string[] = [];
  
  // 基于用户问题类型生成建议
  if (userMessage.includes('症状')) {
    suggestions.push('这个症状可能是什么原因引起的？');
    suggestions.push('出现这种情况需要做什么检查？');
  }
  
  if (userMessage.includes('药') || userMessage.includes('药物')) {
    suggestions.push('服用这种药有什么注意事项？');
    suggestions.push('这种药有什么副作用？');
  }
  
  if (userMessage.includes('治疗')) {
    suggestions.push('除了药物治疗，还有什么治疗方法？');
    suggestions.push('日常生活中如何预防？');
  }

  // 如果没有生成任何建议，提供通用建议
  if (suggestions.length === 0) {
    suggestions.push('这个情况需要注意什么？');
    suggestions.push('什么时候应该去看医生？');
  }

  // 只返回最多3个建议
  return suggestions.slice(0, 3);
}
