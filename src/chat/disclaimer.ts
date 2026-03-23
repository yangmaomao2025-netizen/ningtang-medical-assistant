/**
 * 免责声明与紧急症状检测
 * Disclaimer and Urgent Symptom Detection
 */

// 紧急症状关键词
const URGENT_KEYWORDS = [
  '胸痛',
  '呼吸困难',
  '大出血',
  '休克',
  '昏迷',
  '窒息',
  '中毒',
  '过敏性休克',
  '心梗',
  '心肌梗死',
  '中风',
  '脑卒中',
  '心脏骤停',
  '癫痫持续',
  '呕血',
  '便血',
  '高烧',
  '超高热',
  '昏迷不醒',
  '呼吸停止',
  '大动脉出血',
  '剧烈头痛',
  '意识丧失',
];

// 免责声明文本
const DEFAULT_DISCLAIMER =
  '以上内容仅供参考，如有疑问请咨询专业医生。本系统不替代专业医疗诊断和治疗建议。';

/**
 * 评估免责声明和紧急情况
 */
export function evaluateDisclaimer(content: string): {
  text: string;
  urgent: boolean;
  urgentKeywords: string[];
} {
  // 检测紧急症状
  const detectedUrgentKeywords: string[] = [];
  URGENT_KEYWORDS.forEach(keyword => {
    if (content.includes(keyword)) {
      detectedUrgentKeywords.push(keyword);
    }
  });

  return {
    text: DEFAULT_DISCLAIMER,
    urgent: detectedUrgentKeywords.length > 0,
    urgentKeywords: detectedUrgentKeywords,
  };
}

/**
 * 检测是否包含紧急症状
 */
export function detectUrgentSymptoms(content: string): string[] {
  const detected: string[] = [];
  URGENT_KEYWORDS.forEach(keyword => {
    if (content.includes(keyword)) {
      detected.push(keyword);
    }
  });
  return detected;
}

/**
 * 获取紧急提示消息
 */
export function getUrgentWarningMessage(keywords: string[]): string {
  if (keywords.length === 0) {
    return '';
  }
  return `⚠️ 警告：您的描述中提到了 [${keywords.join(', ')}]，可能涉及紧急情况！\n\n请立即就医或拨打急救电话！`;
}

export default {
  evaluateDisclaimer,
  detectUrgentSymptoms,
  getUrgentWarningMessage,
  URGENT_KEYWORDS,
  DEFAULT_DISCLAIMER,
};
