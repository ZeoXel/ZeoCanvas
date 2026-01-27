/**
 * 积分系统类型定义
 */

// 积分消耗记录
export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number; // 消耗的积分数（正数为消耗，负数为充值）
  balance: number; // 交易后的余额
  type: 'consumption' | 'recharge' | 'refund' | 'reward';
  service: string; // 服务类型：video, image, audio, chat等
  model?: string; // 使用的模型
  metadata?: {
    taskId?: string;
    prompt?: string;
    duration?: number;
    resolution?: string;
    [key: string]: any;
  };
  createdAt: string;
}

// 积分余额信息
export interface CreditBalance {
  total: number; // 总积分
  used: number; // 已使用
  remaining: number; // 剩余
  locked?: number; // 锁定中的积分（未完成的任务）
}

// 积分使用统计
export interface CreditUsageStats {
  today: {
    consumption: number; // 今日消耗
    transactions: number; // 今日交易数
  };
  last7Days: {
    consumption: number;
    transactions: number;
    daily: Array<{
      date: string; // YYYY-MM-DD
      consumption: number;
      transactions: number;
    }>;
  };
  last30Days: {
    consumption: number;
    transactions: number;
    byProvider: Array<{
      provider: string; // 厂商/模型名称：vidu, seedream, nano-banana 等
      consumption: number;
      transactions: number;
      percentage: number;
    }>;
  };
}

// 积分充值套餐
export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number; // 单位：元
  bonus?: number; // 赠送积分
  popular?: boolean;
  description?: string;
}

// 完整的积分信息响应
export interface CreditInfo {
  balance: CreditBalance;
  usage: CreditUsageStats;
  recentTransactions?: CreditTransaction[];
  packages?: CreditPackage[];
}
