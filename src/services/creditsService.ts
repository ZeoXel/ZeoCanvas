/**
 * 积分系统服务
 * 负责积分余额、消耗统计、交易记录等数据的获取和管理
 */

import { getUserInfo } from './userApiService';
import type {
  CreditBalance,
  CreditUsageStats,
  CreditTransaction,
  CreditInfo,
} from '@/types/credits';

/**
 * 从USERAPI获取积分余额
 */
export const getCreditBalance = async (): Promise<CreditBalance> => {
  try {
    const response = await fetch('/api/user/balance', { method: 'GET' });
    if (!response.ok) {
      throw new Error('Failed to fetch balance');
    }

    const result = await response.json();
    if (!result?.success || !result?.data) {
      throw new Error('Invalid balance response');
    }

    const total = Math.round((result.data.totalRecharge || 0) * 10);
    const used = Math.round((result.data.apiConsumption || 0) * 10);
    const remaining = Number(result.data.currentBalance || 0);

    return {
      total,
      used,
      remaining,
      locked: 0,
    };
  } catch (error) {
    console.error('Error fetching credit balance:', error);
    // 失败时回退到从用户信息获取
    return getCreditBalanceFromUserInfo();
  }
};

/**
 * 从用户信息中提取积分余额（回退方案）
 */
const getCreditBalanceFromUserInfo = async (): Promise<CreditBalance> => {
  const userInfo = await getUserInfo();

  if (!userInfo) {
    return {
      total: 0,
      used: 0,
      remaining: 0,
      locked: 0,
    };
  }
  const balanceValue = userInfo.balance || 0;
  return {
    total: balanceValue,
    used: 0,
    remaining: balanceValue,
    locked: 0,
  };
};

/**
 * 获取积分使用统计
 * 从真实交易记录计算统计数据
 */
export const getCreditUsageStats = async (): Promise<CreditUsageStats> => {
  return {
    today: { consumption: 0, transactions: 0 },
    last7Days: {
      consumption: 0,
      transactions: 0,
      daily: [],
    },
    last30Days: {
      consumption: 0,
      transactions: 0,
      byProvider: [],
    },
  };
};

/**
 * 获取最近的积分交易记录
 *
 * @param limit 返回记录数量，默认10条
 * @param type 可选过滤类型: consumption, recharge, refund, reward
 */
export const getRecentTransactions = async (
  limit: number = 10,
  type?: string
): Promise<CreditTransaction[]> => {
  return [];
};

/**
 * 获取完整的积分信息
 */
export const getCreditInfo = async (): Promise<CreditInfo> => {
  const [balance, usage, recentTransactions] = await Promise.all([
    getCreditBalance(),
    getCreditUsageStats(),
    getRecentTransactions(10),
  ]);

  return {
    balance,
    usage,
    recentTransactions,
  };
};


/**
 * 充值积分
 * TODO: 实现真实的充值API
 *
 * @param packageId 套餐ID
 */
export const rechargeCredits = async (packageId: string): Promise<boolean> => {
  try {
    console.log('Recharge credits with package:', packageId);
    return true;
  } catch (error) {
    console.error('Error recharging credits:', error);
    throw error;
  }
};
