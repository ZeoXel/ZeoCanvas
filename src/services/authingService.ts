import { AuthenticationClient } from 'authing-js-sdk';
import { syncUserToUserApi, clearApiKey } from './userApiService';

// Authing 配置
const appId = process.env.NEXT_PUBLIC_AUTHING_APP_ID || '';
const appHost = process.env.NEXT_PUBLIC_AUTHING_APP_HOST || '';

// 创建认证客户端实例
let authClient: AuthenticationClient | null = null;

const getAuthClient = (): AuthenticationClient => {
    if (!authClient) {
        if (!appId || !appHost) {
            throw new Error('Authing 配置缺失: 请设置 NEXT_PUBLIC_AUTHING_APP_ID 和 NEXT_PUBLIC_AUTHING_APP_HOST');
        }
        authClient = new AuthenticationClient({
            appId,
            appHost,
        });
    }
    return authClient;
};

// 用户信息类型
export interface AuthUser {
    id: string;
    email?: string;
    phone?: string;
    username?: string;
    nickname?: string;
    name?: string;
    photo?: string;
    token?: string;
}

// Token 存储 key
const TOKEN_KEY = 'authing_token';
const USER_KEY = 'authing_user';

// 存储 Token
export const saveToken = (token: string) => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, token);
    }
};

// 获取 Token
export const getToken = (): string | null => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem(TOKEN_KEY);
    }
    return null;
};

// 清除 Token
export const clearToken = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }
};

// 存储用户信息
export const saveUser = (user: AuthUser) => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
};

// 获取存储的用户信息
export const getSavedUser = (): AuthUser | null => {
    if (typeof window !== 'undefined') {
        const userStr = localStorage.getItem(USER_KEY);
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

// 邮箱密码登录
export const loginByEmail = async (email: string, password: string): Promise<AuthUser> => {
    const client = getAuthClient();
    const user = await client.loginByEmail(email, password);

    if (user.token) {
        saveToken(user.token);
        client.setToken(user.token);
    }

    const authUser: AuthUser = {
        id: user.id || '',
        email: user.email || undefined,
        phone: user.phone || undefined,
        username: user.username || undefined,
        nickname: user.nickname || undefined,
        name: user.name || undefined,
        photo: user.photo || undefined,
        token: user.token || undefined,
    };

    saveUser(authUser);

    // 同步用户到 USERAPI 网关
    try {
        await syncUserToUserApi({
            provider: 'authing',
            provider_id: authUser.id,
            provider_token: authUser.token,
            name: authUser.nickname || authUser.name || authUser.username,
            email: authUser.email,
            phone: authUser.phone,
            avatar: authUser.photo,
        });
        console.log('[Auth] 用户已同步到 USERAPI');
    } catch (error) {
        console.error('[Auth] USERAPI 同步失败:', error);
        // 不阻塞登录流程，继续返回用户信息
    }

    return authUser;
};

// 发送手机验证码
export const sendPhoneCode = async (phone: string): Promise<boolean> => {
    const client = getAuthClient();
    await client.sendSmsCode(phone);
    return true;
};

// 手机验证码登录
export const loginByPhoneCode = async (phone: string, code: string): Promise<AuthUser> => {
    const client = getAuthClient();
    const user = await client.loginByPhoneCode(phone, code);

    if (user.token) {
        saveToken(user.token);
        client.setToken(user.token);
    }

    const authUser: AuthUser = {
        id: user.id || '',
        email: user.email || undefined,
        phone: user.phone || undefined,
        username: user.username || undefined,
        nickname: user.nickname || undefined,
        name: user.name || undefined,
        photo: user.photo || undefined,
        token: user.token || undefined,
    };

    saveUser(authUser);

    // 同步用户到 USERAPI 网关
    try {
        await syncUserToUserApi({
            provider: 'authing',
            provider_id: authUser.id,
            provider_token: authUser.token,
            name: authUser.nickname || authUser.name || authUser.username,
            email: authUser.email,
            phone: authUser.phone,
            avatar: authUser.photo,
        });
        console.log('[Auth] 用户已同步到 USERAPI');
    } catch (error) {
        console.error('[Auth] USERAPI 同步失败:', error);
        // 不阻塞登录流程，继续返回用户信息
    }

    return authUser;
};

// 获取当前用户信息
export const getCurrentUser = async (): Promise<AuthUser | null> => {
    const token = getToken();
    if (!token) {
        return null;
    }

    try {
        const client = getAuthClient();
        client.setToken(token);
        const user = await client.getCurrentUser();

        if (!user || !user.id) {
            clearToken();
            return null;
        }

        const authUser: AuthUser = {
            id: user.id,
            email: user.email || undefined,
            phone: user.phone || undefined,
            username: user.username || undefined,
            nickname: user.nickname || undefined,
            name: user.name || undefined,
            photo: user.photo || undefined,
            token: token,
        };

        saveUser(authUser);
        return authUser;
    } catch {
        clearToken();
        return null;
    }
};

// 登出
export const logout = async (): Promise<void> => {
    try {
        const client = getAuthClient();
        await client.logout();
    } catch {
        // 忽略登出错误
    } finally {
        clearToken();
        clearApiKey(); // 同时清除 USERAPI Key
    }
};

// 检查是否已登录（快速检查，不验证 token）
export const isLoggedIn = (): boolean => {
    return !!getToken();
};
