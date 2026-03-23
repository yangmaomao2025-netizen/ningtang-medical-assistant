import jwt from 'jsonwebtoken';
import { TokenPayloadSchema, type TokenPayload, ErrorCode } from '../types/index.js';

export interface AuthResult {
  valid: boolean;
  payload?: TokenPayload;
  error?: {
    code: ErrorCode;
    message: string;
  };
}

/**
 * 验证 JWT Token
 */
export function verifyToken(token: string, secret: string): AuthResult {
  try {
    const decoded = jwt.verify(token, secret);
    const payload = TokenPayloadSchema.parse(decoded);
    
    // 检查是否过期
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return {
        valid: false,
        error: {
          code: ErrorCode.TOKEN_EXPIRED,
          message: 'Token 已过期',
        },
      };
    }

    return { valid: true, payload };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return {
        valid: false,
        error: {
          code: ErrorCode.TOKEN_EXPIRED,
          message: 'Token 已过期',
        },
      };
    }
    
    if (err instanceof jwt.JsonWebTokenError) {
      return {
        valid: false,
        error: {
          code: ErrorCode.INVALID_TOKEN,
          message: '无效的 Token',
        },
      };
    }

    return {
      valid: false,
      error: {
        code: ErrorCode.INVALID_TOKEN,
        message: 'Token 验证失败',
      },
    };
  }
}

/**
 * 生成 JWT Token
 */
export function generateToken(
  payload: Omit<TokenPayload, 'exp' | 'iat'>,
  secret: string,
  expiresIn: string = '24h'
): string {
  const tokenPayload: TokenPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + parseExpiresIn(expiresIn),
  };

  return jwt.sign(tokenPayload, secret);
}

function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 86400; // 默认 24 小时

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 60 * 60 * 24;
    default: return 86400;
  }
}

/**
 * 从 Token 中提取 userId
 */
export function extractUserId(token: string, secret: string): string | null {
  const result = verifyToken(token, secret);
  return result.valid ? result.payload!.userId : null;
}
