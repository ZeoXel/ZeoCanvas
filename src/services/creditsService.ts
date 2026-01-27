/**
 * 积分系统服务
 * 负责积分余额、消耗统计、交易记录等数据的获取和管理
 */

import { getUserInfo, getApiKey } from './userApiService';
import type {
  CreditBalance,
  CreditUsageStats,
  CreditTransaction,
  CreditInfo,
} from '@/types/credits';

/**
 * 获取USERAPI基础URL
 */
const getUserApiBaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_USERAPI_URL || 'http://localhost:3001';
};

/**
 * 从USERAPI获取积分余额
 */
export const getCreditBalance = async (): Promise<CreditBalance> => {
  const baseUrl = getUserApiBaseUrl();
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      total: 0,
      used: 0,
      remaining: 0,
      locked: 0,
    };
  }

  try {
    const response = await fetch(`${baseUrl}/api/credits/balance`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch credit balance:', response.status);
      // 失败时回退到从用户信息获取
      return getCreditBalanceFromUserInfo();
    }

    const data = await response.json();
    return {
      total: data.total ?? 0,
      used: data.used ?? 0,
      remaining: data.remaining ?? 0,
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

  if (!userInfo || !userInfo.keys) {
    return {
      total: 0,
      used: 0,
      remaining: 0,
      locked: 0,
    };
  }

  const balance = userInfo.keys.reduce(
    (acc, key) => {
      const total = key.quotaLimit || 0;
      const used = key.quotaUsed || 0;
      const remaining = Math.max(0, total - used);

      return {
        total: acc.total + total,
        used: acc.used + used,
        remaining: acc.remaining + remaining,
        locked: acc.locked,
      };
    },
    { total: 0, used: 0, remaining: 0, locked: 0 }
  );

  return balance;
};

/**
 * 获取积分使用统计
 * 从真实交易记录计算统计数据
 */
export const getCreditUsageStats = async (): Promise<CreditUsageStats> => {
  // 获取最近30天的所有消费记录（只取消费类型）
  const transactions = await getRecentTransactions(500, 'consumption');

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(todayStart);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // 初始化统计数据
  let todayConsumption = 0;
  let todayTransactions = 0;
  let last7DaysConsumption = 0;
  let last7DaysTransactions = 0;
  let last30DaysConsumption = 0;
  let last30DaysTransactions = 0;

  // 每日数据Map（最近7天）
  const dailyMap = new Map<string, { consumption: number; transactions: number }>();
  for (let i = 0; i < 7; i++) {
    const date = new Date(todayStart);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    dailyMap.set(dateStr, { consumption: 0, transactions: 0 });
  }

  // 按厂商/模型分类Map
  const providerMap = new Map<string, { consumption: number; transactions: number }>();

  // 遍历交易记录计算统计
  for (const tx of transactions) {
    const txDate = new Date(tx.createdAt);
    const amount = Math.abs(tx.amount); // 消费记录的amount是正数

    // 30天内
    if (txDate >= thirtyDaysAgo) {
      last30DaysConsumption += amount;
      last30DaysTransactions += 1;

      // 按厂商/模型分类（优先使用 model，回退到 service）
      const provider = tx.model || tx.service || 'unknown';
      const existing = providerMap.get(provider) || { consumption: 0, transactions: 0 };
      providerMap.set(provider, {
        consumption: existing.consumption + amount,
        transactions: existing.transactions + 1,
      });

      // 7天内
      if (txDate >= sevenDaysAgo) {
        last7DaysConsumption += amount;
        last7DaysTransactions += 1;

        // 每日数据
        const dateStr = txDate.toISOString().split('T')[0];
        const dayData = dailyMap.get(dateStr);
        if (dayData) {
          dailyMap.set(dateStr, {
            consumption: dayData.consumption + amount,
            transactions: dayData.transactions + 1,
          });
        }
      }

      // 今日
      if (txDate >= todayStart) {
        todayConsumption += amount;
        todayTransactions += 1;
      }
    }
  }

  // 转换每日数据为数组（按日期排序）
  const daily = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => ({
      date,
      consumption: data.consumption,
      transactions: data.transactions,
    }));

  // 转换厂商/模型分类数据
  const byProvider = Array.from(providerMap.entries())
    .map(([provider, data]) => ({
      provider,
      consumption: data.consumption,
      transactions: data.transactions,
      percentage: last30DaysConsumption > 0
        ? Math.round((data.consumption / last30DaysConsumption) * 100)
        : 0,
    }))
    .sort((a, b) => b.consumption - a.consumption);

  return {
    today: {
      consumption: todayConsumption,
      transactions: todayTransactions,
    },
    last7Days: {
      consumption: last7DaysConsumption,
      transactions: last7DaysTransactions,
      daily,
    },
    last30Days: {
      consumption: last30DaysConsumption,
      transactions: last30DaysTransactions,
      byProvider,
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
  const baseUrl = getUserApiBaseUrl();
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn('No API key available');
    return [];
  }

  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (type) {
      params.append('type', type);
    }

    const response = await fetch(`${baseUrl}/api/credits/transactions?${params}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch transactions:', response.status);
      return [];
    }

    const data = await response.json();

    // 转换 API 响应格式为前端类型
    return (data.transactions || []).map((t: {
      id: string;
      type: string;
      amount: number;
      balanceAfter: number;
      service?: string;
      provider?: string;
      model?: string;
      description?: string;
      metadata?: Record<string, unknown>;
      createdAt: string;
    }) => ({
      id: t.id,
      userId: 'current_user',
      amount: t.amount,
      balance: t.balanceAfter,
      type: t.type as CreditTransaction['type'],
      service: t.service || 'unknown',
      model: t.model,
      metadata: t.metadata,
      createdAt: t.createdAt,
    }));
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
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
  const baseUrl = getUserApiBaseUrl();
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('No API key available');
  }

  try {
    // TODO: 实现真实的API调用
    // const response = await fetch(`${baseUrl}/api/credits/recharge`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${apiKey}`,
    //   },
    //   body: JSON.stringify({ packageId }),
    // });
    //
    // if (!response.ok) {
    //   throw new Error('Failed to recharge credits');
    // }
    //
    // return true;

    console.log('Recharge credits with package:', packageId);
    return true;
  } catch (error) {
    console.error('Error recharging credits:', error);
    throw error;
  }
};
