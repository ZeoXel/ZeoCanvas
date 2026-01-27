"use client";

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getApiKey,
  getUserApiUser,
  syncUserToUserApi,
  getUserInfo
} from '@/services/userApiService';

/**
 * USERAPI 调试面板
 * 用于诊断用户数据连接问题
 */
export const UserApiDebug: React.FC = () => {
  const { user: authUser } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [syncing, setSyncing] = useState(false);

  const checkStatus = () => {
    const apiKey = getApiKey();
    const userApiUser = getUserApiUser();

    setDebugInfo({
      hasAuthUser: !!authUser,
      authUserId: authUser?.id,
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey ? `${apiKey.substring(0, 10)}...` : null,
      hasUserApiUser: !!userApiUser,
      userApiUserId: userApiUser?.id,
      timestamp: new Date().toLocaleTimeString(),
    });
  };

  useEffect(() => {
    checkStatus();
  }, [authUser]);

  const handleManualSync = async () => {
    if (!authUser) {
      alert('请先登录');
      return;
    }

    setSyncing(true);
    try {
      const result = await syncUserToUserApi({
        provider: 'authing',
        provider_id: authUser.id,
        name: authUser.nickname || authUser.name || authUser.username,
        email: authUser.email,
        phone: authUser.phone,
        avatar: authUser.photo,
      });

      alert(`同步成功！\n新用户: ${result.isNewUser}\nAPI Key: ${result.apiKey?.keyPrefix || '已存在'}`);
      checkStatus();
    } catch (error) {
      alert(`同步失败: ${error instanceof Error ? error.message : '未知错误'}`);
      console.error('同步失败:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleTestFetch = async () => {
    try {
      const options = authUser ? {
        provider: 'authing',
        provider_id: authUser.id,
      } : undefined;

      const data = await getUserInfo(options);
      console.log('获取用户信息成功:', data);
      alert('获取成功！查看控制台了解详情');
    } catch (error) {
      console.error('获取失败:', error);
      alert(`获取失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">🔍 USERAPI 调试面板</h3>
        <button
          onClick={checkStatus}
          className="p-1 hover:bg-slate-800 rounded"
          title="刷新状态"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="space-y-2 mb-4">
        <StatusItem
          label="Authing 用户"
          status={debugInfo.hasAuthUser}
          detail={debugInfo.authUserId}
        />
        <StatusItem
          label="API Key"
          status={debugInfo.hasApiKey}
          detail={debugInfo.apiKeyPrefix}
        />
        <StatusItem
          label="USERAPI 用户"
          status={debugInfo.hasUserApiUser}
          detail={debugInfo.userApiUserId}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleManualSync}
          disabled={syncing || !authUser}
          className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 rounded text-xs font-medium transition-colors"
        >
          {syncing ? '同步中...' : '手动同步到 USERAPI'}
        </button>
        <button
          onClick={handleTestFetch}
          className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-xs font-medium transition-colors"
        >
          测试获取数据
        </button>
      </div>

      <div className="mt-3 text-[10px] text-slate-400">
        最后更新: {debugInfo.timestamp}
      </div>
    </div>
  );
};

const StatusItem: React.FC<{
  label: string;
  status: boolean;
  detail?: string | null;
}> = ({ label, status, detail }) => (
  <div className="flex items-center gap-2">
    {status ? (
      <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
    ) : (
      <XCircle size={14} className="text-red-400 flex-shrink-0" />
    )}
    <span className="flex-1">{label}:</span>
    <span className="text-slate-400 truncate max-w-[150px]">
      {detail || (status ? '✓' : '✗')}
    </span>
  </div>
);

export default UserApiDebug;
