"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
    AuthUser,
    getCurrentUser,
    logout as authLogout,
    isLoggedIn,
    getSavedUser,
} from '@/services/authingService';
import {
    getApiKey,
    hasValidApiKey,
    getUserApiUser,
    UserApiUser,
    syncUserToUserApi,
} from '@/services/userApiService';

interface AuthContextType {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    refreshUser: () => Promise<void>;
    logout: () => Promise<void>;
    setUser: (user: AuthUser | null) => void;
    // USERAPI 相关
    apiKey: string | null;
    userApiUser: UserApiUser | null;
    hasApiKey: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [userApiUser, setUserApiUser] = useState<UserApiUser | null>(null);

    // 初始化：检查是否已登录
    useEffect(() => {
        const initAuth = async () => {
            // 开发模式：跳过认证，使用模拟用户
            if (process.env.NEXT_PUBLIC_SKIP_AUTH === 'true') {
                const devUser = {
                    id: 'dev-user',
                    email: 'dev@local.test',
                    username: 'Developer',
                    nickname: '开发者',
                    token: 'dev-token',
                };
                setUser(devUser);

                // 开发模式：如果没有 API Key，自动同步到 USERAPI
                const existingKey = getApiKey();
                if (!existingKey) {
                    try {
                        await syncUserToUserApi({
                            provider: 'authing',
                            provider_id: 'dev-user',
                            name: '开发者',
                            email: 'dev@local.test',
                        });
                        console.log('[Auth] 开发用户已同步到 USERAPI');
                    } catch (error) {
                        console.warn('[Auth] USERAPI 同步失败 (开发模式):', error);
                    }
                }

                // 加载存储的 API Key
                setApiKey(getApiKey());
                setUserApiUser(getUserApiUser());
                setIsLoading(false);
                return;
            }

            // 首先尝试从本地存储快速恢复
            const savedUser = getSavedUser();
            if (savedUser) {
                setUser(savedUser);
            }

            // 恢复 USERAPI 状态
            setApiKey(getApiKey());
            setUserApiUser(getUserApiUser());

            // 如果有 token，验证并获取最新用户信息
            if (isLoggedIn()) {
                try {
                    const currentUser = await getCurrentUser();
                    setUser(currentUser);
                } catch {
                    setUser(null);
                }
            } else {
                setUser(null);
            }

            setIsLoading(false);
        };

        initAuth();
    }, []);

    // 刷新用户信息
    const refreshUser = useCallback(async () => {
        if (isLoggedIn()) {
            try {
                const currentUser = await getCurrentUser();
                setUser(currentUser);
                // 同时刷新 USERAPI 状态
                setApiKey(getApiKey());
                setUserApiUser(getUserApiUser());
            } catch {
                setUser(null);
            }
        }
    }, []);

    // 登出
    const logout = useCallback(async () => {
        await authLogout();
        setUser(null);
        setApiKey(null);
        setUserApiUser(null);
    }, []);

    const value: AuthContextType = {
        user,
        isLoading,
        isAuthenticated: !!user,
        refreshUser,
        logout,
        setUser,
        // USERAPI 相关
        apiKey,
        userApiUser,
        hasApiKey: hasValidApiKey(),
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Hook: 使用 Auth 上下文
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
