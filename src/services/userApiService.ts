/**
 * USERAPI 网关服务
 * 处理用户同步和 API Key 管理
 */

// USERAPI 响应类型
export interface UserApiUser {
    id: string;
    provider: string;
    name: string;
    username?: string; // 用户名，可自定义
    email: string | null;
    phone: string | null;
    avatar: string | null;
    role: string;
    status: string;
}

export interface UserApiKey {
    id: string;
    keyPrefix: string;
    fullKey?: string; // 仅新用户首次返回
    name: string;
    status: string;
    createdAt: string;
}

export interface UserSyncResponse {
    success: boolean;
    isNewUser: boolean;
    user: UserApiUser;
    apiKey: UserApiKey | null;
    message: string;
}

export interface UserMeResponse {
    user: UserApiUser & { createdAt: string };
    keys?: Array<{
        id: string;
        keyPrefix: string;
        name: string;
        status: string;
        quotaType: string;
        quotaLimit: number | null;
        quotaUsed: number;
        lastUsedAt: string | null;
        createdAt: string;
    }>;
    usage?: {
        last30Days: {
            totalRequests: number;
            totalCost: number;
        };
    };
}

// 存储 Key
const USERAPI_KEY = 'userapi_key';
const USERAPI_USER = 'userapi_user';

/**
 * 获取 USERAPI 基础 URL
 */
const getUserApiBaseUrl = (): string => {
    return process.env.NEXT_PUBLIC_USERAPI_URL || 'http://localhost:3001';
};

/**
 * 保存 API Key 到本地存储
 */
export const saveApiKey = (key: string) => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(USERAPI_KEY, key);
    }
};

/**
 * 获取存储的 API Key
 */
export const getApiKey = (): string | null => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem(USERAPI_KEY);
    }
    return null;
};

/**
 * 清除 API Key
 */
export const clearApiKey = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(USERAPI_KEY);
        localStorage.removeItem(USERAPI_USER);
    }
};

/**
 * 保存 USERAPI 用户信息
 */
export const saveUserApiUser = (user: UserApiUser) => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(USERAPI_USER, JSON.stringify(user));
    }
};

/**
 * 获取存储的 USERAPI 用户信息
 */
export const getUserApiUser = (): UserApiUser | null => {
    if (typeof window !== 'undefined') {
        const userStr = localStorage.getItem(USERAPI_USER);
        if (userStr) {
            try {
                return JSON.parse(userStr);
            } catch {
                return null;
            }
        }
    }
    return null;
};

/**
 * 同步用户到 USERAPI
 * 在第三方登录成功后调用
 */
export const syncUserToUserApi = async (params: {
    provider: 'authing' | 'tencent' | 'wechat';
    provider_id: string;
    provider_token?: string;
    name?: string;
    phone?: string;
    email?: string;
    avatar?: string;
}): Promise<UserSyncResponse> => {
    const baseUrl = getUserApiBaseUrl();

    const response = await fetch(`${baseUrl}/api/user/sync`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || 'Failed to sync user');
    }

    const data: UserSyncResponse = await response.json();

    // 保存用户信息
    if (data.user) {
        saveUserApiUser(data.user);
    }

    // 如果是新用户，保存完整的 API Key
    if (data.isNewUser && data.apiKey?.fullKey) {
        saveApiKey(data.apiKey.fullKey);
        console.log('[USERAPI] 新用户创建成功，API Key 已保存');
    }

    return data;
};

/**
 * 获取当前用户信息
 * 通过 API Key 或 provider 认证
 */
export const getUserInfo = async (options?: {
    provider?: string;
    provider_id?: string;
}): Promise<UserMeResponse | null> => {
    const baseUrl = getUserApiBaseUrl();
    const apiKey = getApiKey();

    // 优先使用 API Key 认证
    if (apiKey) {
        const response = await fetch(`${baseUrl}/api/user/me`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (response.ok) {
            return response.json();
        }

        // API Key 无效，清除并尝试其他方式
        if (response.status === 401) {
            clearApiKey();
        }
    }

    // 使用 provider 查询
    if (options?.provider && options?.provider_id) {
        const params = new URLSearchParams({
            provider: options.provider,
            provider_id: options.provider_id,
        });

        const response = await fetch(`${baseUrl}/api/user/me?${params}`);

        if (response.ok) {
            return response.json();
        }
    }

    return null;
};

/**
 * 检查是否已有有效的 API Key
 */
export const hasValidApiKey = (): boolean => {
    return !!getApiKey();
};

/**
 * 创建带有 API Key 认证的 fetch 请求
 * 用于通过 USERAPI 网关调用 API
 */
export const fetchWithApiKey = async (
    endpoint: string,
    options: RequestInit = {}
): Promise<Response> => {
    const baseUrl = getUserApiBaseUrl();
    const apiKey = getApiKey();

    if (!apiKey) {
        throw new Error('No API key available. Please login first.');
    }

    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${apiKey}`);

    return fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers,
    });
};
