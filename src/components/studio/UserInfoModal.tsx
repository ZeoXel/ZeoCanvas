"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, User, CreditCard, Mail, Phone, Key, RefreshCw, TrendingUp, Activity, Copy, Check, Edit2 } from 'lucide-react';
import { getUserInfo, getApiKey, type UserMeResponse } from '@/services/userApiService';
import { getCreditInfo } from '@/services/creditsService';
import type { CreditInfo } from '@/types/credits';
import { TrendChart } from './charts/TrendChart';
import { DonutChart } from './charts/DonutChart';

interface UserInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'account' | 'credits';
}

type TabType = 'account' | 'credits';

export const UserInfoModal: React.FC<UserInfoModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'account'
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [userData, setUserData] = useState<UserMeResponse | null>(null);
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editedUsername, setEditedUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  // 同步defaultTab变化
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  // 打开时加载数据
  useEffect(() => {
    if (isOpen) {
      fetchUserData();
      fetchCreditInfo();
    }
  }, [isOpen]);

  // 编辑用户名时聚焦输入框
  useEffect(() => {
    if (isEditingUsername && usernameInputRef.current) {
      usernameInputRef.current.focus();
      usernameInputRef.current.select();
    }
  }, [isEditingUsername]);

  // 阻止滚轮事件传播到画布
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
    };

    const modalElement = modalRef.current;
    if (isOpen && modalElement) {
      modalElement.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        modalElement.removeEventListener('wheel', handleWheel);
      };
    }
  }, [isOpen]);

  const fetchUserData = async () => {
    setLoadingUser(true);
    try {
      const data = await getUserInfo();
      if (data) {
        setUserData(data);
        setEditedUsername(data.user.username || data.user.name);
      }
    } catch (err) {
      console.error('获取用户信息失败:', err);
    } finally {
      setLoadingUser(false);
    }
  };

  const fetchCreditInfo = async () => {
    setLoadingCredits(true);
    try {
      const data = await getCreditInfo();
      if (data) {
        setCreditInfo(data);
      }
    } catch (err) {
      console.error('获取积分信息失败:', err);
    } finally {
      setLoadingCredits(false);
    }
  };

  const handleRefresh = () => {
    if (activeTab === 'account') {
      fetchUserData();
    } else {
      fetchCreditInfo();
    }
  };

  const copyToClipboard = async (text: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyId);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const handleSaveUsername = async () => {
    if (!editedUsername.trim() || !userData) return;

    const apiKey = getApiKey();
    if (!apiKey) {
      alert('未登录，请刷新页面后重试');
      return;
    }

    setSavingUsername(true);
    try {
      // 直接调用 USERAPI 网关更新用户名
      const baseUrl = process.env.NEXT_PUBLIC_USERAPI_URL || 'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/user/update-username`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ username: editedUsername.trim() }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '更新失败' }));
        throw new Error(error.error || '更新用户名失败');
      }

      // 更新本地数据
      setUserData({
        ...userData,
        user: { ...userData.user, username: editedUsername.trim() }
      });
      setIsEditingUsername(false);
    } catch (err) {
      console.error('保存用户名失败:', err);
      alert(err instanceof Error ? err.message : '保存用户名失败，请重试');
    } finally {
      setSavingUsername(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingUsername(false);
    setEditedUsername(userData?.user.username || userData?.user.name || '');
  };

  if (!isOpen) return null;

  // 厂商/模型颜色映射
  const providerColors: Record<string, { text: string; fill: string }> = {
    // 视频类
    'vidu': { text: 'text-purple-600 dark:text-purple-400', fill: '#a855f7' },
    'viduq1-pro': { text: 'text-purple-600 dark:text-purple-400', fill: '#a855f7' },
    'viduq2-pro': { text: 'text-purple-500 dark:text-purple-300', fill: '#c084fc' },
    'seedance-1-lite': { text: 'text-fuchsia-600 dark:text-fuchsia-400', fill: '#d946ef' },
    // 图像类
    'nano-banana': { text: 'text-yellow-600 dark:text-yellow-400', fill: '#eab308' },
    'seedream-3.0': { text: 'text-emerald-600 dark:text-emerald-400', fill: '#10b981' },
    'seedream': { text: 'text-emerald-600 dark:text-emerald-400', fill: '#10b981' },
    'flux-pro': { text: 'text-blue-600 dark:text-blue-400', fill: '#3b82f6' },
    // 音频类
    'suno': { text: 'text-red-600 dark:text-red-400', fill: '#ef4444' },
    'chirp-v4': { text: 'text-red-600 dark:text-red-400', fill: '#ef4444' },
    'speech-2.6-hd': { text: 'text-orange-600 dark:text-orange-400', fill: '#f97316' },
    'minimax': { text: 'text-orange-600 dark:text-orange-400', fill: '#f97316' },
    // 默认
    'default': { text: 'text-slate-600 dark:text-slate-400', fill: '#64748b' },
  };

  const getProviderColor = (provider: string) => {
    // 尝试精确匹配
    if (providerColors[provider]) return providerColors[provider];
    // 尝试前缀匹配
    for (const key of Object.keys(providerColors)) {
      if (provider.toLowerCase().includes(key.toLowerCase())) {
        return providerColors[key];
      }
    }
    // 基于索引生成不同颜色
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    const index = Math.abs(provider.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % colors.length;
    return { text: 'text-slate-600 dark:text-slate-400', fill: colors[index] };
  };

  const getProviderName = (provider: string) => {
    const names: Record<string, string> = {
      'vidu': 'Vidu',
      'viduq1-pro': 'Vidu Q1 Pro',
      'viduq2-pro': 'Vidu Q2 Pro',
      'seedance-1-lite': 'Seedance Lite',
      'nano-banana': 'Nano Banana',
      'seedream-3.0': 'Seedream 3.0',
      'seedream': 'Seedream',
      'flux-pro': 'Flux Pro',
      'suno': 'Suno',
      'chirp-v4': 'Suno Chirp V4',
      'speech-2.6-hd': 'MiniMax TTS',
      'minimax': 'MiniMax',
    };
    return names[provider] || provider;
  };

  // 服务类型名称（用于交易记录显示）
  const getServiceName = (service: string) => {
    switch (service) {
      case 'video': return '视频生成';
      case 'image': return '图片生成';
      case 'audio': return '音频生成';
      case 'chat': return 'AI对话';
      default: return service;
    }
  };

  // 准备趋势图数据（7天）
  const trendData = creditInfo?.usage.last7Days.daily?.map(d => ({
    date: d.date,
    value: d.consumption
  })) || [];

  // 准备环形图数据（按厂商/模型分类）
  const donutData = creditInfo?.usage.last30Days.byProvider?.map(item => ({
    label: getProviderName(item.provider),
    value: item.consumption,
    color: getProviderColor(item.provider).fill
  })) || [];

  return (
    <div
      className="fixed inset-0 z-[100] bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="w-[1152px] h-[648px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 - 带Tab切换 */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={onClose}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              <X size={20} />
            </button>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100">
              用户中心
            </span>
            <button
              onClick={handleRefresh}
              disabled={loadingUser || loadingCredits}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                size={18}
                className={(loadingUser || loadingCredits) ? 'animate-spin' : ''}
              />
            </button>
          </div>

          {/* Tab切换 */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('account')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'account'
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <User size={16} />
              <span>账户管理</span>
            </button>
            <button
              onClick={() => setActiveTab('credits')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'credits'
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <CreditCard size={16} />
              <span>积分明细</span>
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 p-6 overflow-hidden">
          {activeTab === 'account' ? (
            /* 账户管理内容 */
            <div className="grid grid-cols-3 gap-6 h-full">
              {/* 左侧：用户信息 */}
              <div className="col-span-1 space-y-6">
                <div className="flex flex-col items-center text-center">
                  {userData?.user.avatar ? (
                    <img
                      src={userData.user.avatar}
                      alt={userData.user.username || userData.user.name}
                      className="w-24 h-24 rounded-full object-cover border-4 border-slate-200 dark:border-slate-700 mb-4"
                    />
                  ) : (
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center border-4 border-slate-200 dark:border-slate-700 mb-4 ${
                      loadingUser ? 'bg-slate-200 dark:bg-slate-700 animate-pulse' : 'bg-slate-200 dark:bg-slate-700'
                    }`}>
                      {!loadingUser && <User className="w-12 h-12 text-slate-600 dark:text-slate-400" />}
                    </div>
                  )}

                  {loadingUser && !userData ? (
                    <>
                      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-2 animate-pulse" />
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20 animate-pulse" />
                    </>
                  ) : (
                    <>
                      {/* 用户名 - 内联编辑 */}
                      <div className="flex items-center gap-2 mb-2">
                        {isEditingUsername ? (
                          <>
                            <input
                              ref={usernameInputRef}
                              type="text"
                              value={editedUsername}
                              onChange={(e) => setEditedUsername(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveUsername();
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              onBlur={handleCancelEdit}
                              disabled={savingUsername}
                              className="text-xl font-bold text-center bg-white dark:bg-slate-800 border-b-2 border-blue-500 dark:border-blue-400 text-slate-900 dark:text-slate-100 focus:outline-none px-2 py-0.5 min-w-[120px]"
                            />
                          </>
                        ) : (
                          <>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                              {userData?.user.username || userData?.user.name || '未设置'}
                            </h3>
                            <button
                              onClick={() => setIsEditingUsername(true)}
                              className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              title="编辑用户名"
                            >
                              <Edit2 size={14} />
                            </button>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                          userData?.user.status === 'active'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        }`}>
                          {userData?.user.status === 'active' ? '正常' : '禁用'}
                        </span>
                        {userData?.user.role === 'admin' && (
                          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                            管理员
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* 联系信息 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <Mail size={18} className="text-slate-500 dark:text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">邮箱</div>
                      {loadingUser && !userData ? (
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full animate-pulse" />
                      ) : (
                        <div className="text-sm text-slate-900 dark:text-slate-100 truncate">
                          {userData?.user.email || '未设置'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <Phone size={18} className="text-slate-500 dark:text-slate-400" />
                    <div className="flex-1">
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">手机号</div>
                      {loadingUser && !userData ? (
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full animate-pulse" />
                      ) : (
                        <div className="text-sm text-slate-900 dark:text-slate-100">
                          {userData?.user.phone || '未设置'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 使用统计 - 使用真实交易数据 */}
                <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-3">
                    最近30天
                  </div>
                  {loadingCredits && !creditInfo?.usage ? (
                    <div className="grid grid-cols-2 gap-3">
                      {[1, 2].map((i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16 mb-2" />
                          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-20" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">总请求数</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                          {creditInfo?.usage.last30Days.transactions.toLocaleString() || 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">总消费</div>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {creditInfo?.usage.last30Days.consumption.toFixed(0) || 0}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧：API Keys (极简) + 最近交易 */}
              <div className="col-span-2 flex flex-col gap-4 h-full overflow-hidden">
                {/* API Keys - 极简化，宽度与下方对齐 */}
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Key size={14} className="text-slate-500 dark:text-slate-400" />
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        API Keys
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {userData?.keys?.length || 0} 个密钥
                    </span>
                  </div>

                  {loadingUser && !userData?.keys ? (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg animate-pulse">
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                    </div>
                  ) : userData?.keys && userData.keys.length > 0 ? (
                    <div className="space-y-2">
                      {userData.keys.slice(0, 2).map((key) => (
                        <button
                          key={key.id}
                          onClick={() => copyToClipboard(`${key.keyPrefix}...`, key.id)}
                          className="group w-full p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all text-left flex items-center justify-between"
                        >
                          <div className="flex-1 min-w-0 mr-3">
                            <div className="text-xs font-medium text-slate-900 dark:text-slate-100 mb-1">
                              {key.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                              {`${key.keyPrefix}...`}
                            </div>
                          </div>
                          {copiedKey === key.id ? (
                            <Check size={14} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                          ) : (
                            <Copy size={14} className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center text-xs text-slate-500 dark:text-slate-400">
                      暂无API Key
                    </div>
                  )}
                </div>

                {/* 最近交易 - 上下排布，自定义滚动条 */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      最近交易
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {creditInfo?.recentTransactions?.length || 0} 条记录
                    </span>
                  </div>

                  {creditInfo?.recentTransactions && creditInfo.recentTransactions.length > 0 ? (
                    <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
                      {creditInfo.recentTransactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                        >
                          <div className="flex-1 min-w-0 mr-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                {getServiceName(tx.service)}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {new Date(tx.createdAt).toLocaleString('zh-CN', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {tx.model}
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <span className="text-base font-bold text-red-600 dark:text-red-400">
                              -{tx.amount}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                      暂无交易记录
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* 积分明细内容 - 优化布局铺满 */
            <div className="h-full flex flex-col gap-5">
              {/* 积分概览 - 水平排列 */}
              <div className="grid grid-cols-3 gap-4">
                {loadingCredits && !creditInfo ? (
                  <>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg animate-pulse">
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-12 mb-2" />
                        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-20" />
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">总积分</div>
                      <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                        {creditInfo?.balance.total.toLocaleString() || 0}
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">已使用</div>
                      <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                        {creditInfo?.balance.used.toLocaleString() || 0}
                      </div>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">剩余</div>
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {creditInfo?.balance.remaining.toLocaleString() || 0}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 主要内容区 */}
              <div className="flex-1 grid grid-cols-3 gap-5 min-h-0">
                {/* 左侧：趋势图 + 快速统计 */}
                <div className="col-span-2 flex flex-col gap-5">
                  {/* 7天消耗趋势图 */}
                  <div className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-lg p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp size={16} className="text-slate-500 dark:text-slate-400" />
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        7天消耗趋势
                      </span>
                    </div>
                    {loadingCredits && !creditInfo ? (
                      <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
                    ) : trendData.length > 0 ? (
                      <div className="flex-1">
                        <TrendChart data={trendData} height={180} color="#3b82f6" />
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                        暂无数据
                      </div>
                    )}
                  </div>

                  {/* 快速统计 */}
                  <div className="grid grid-cols-3 gap-4">
                    {loadingCredits && !creditInfo ? (
                      <>
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg animate-pulse">
                            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16 mb-2" />
                            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-12" />
                          </div>
                        ))}
                      </>
                    ) : (
                      <>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">今日</div>
                          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                            {creditInfo?.usage.today.consumption.toFixed(0) || 0}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {creditInfo?.usage.today.transactions || 0} 次
                          </div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">7天</div>
                          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                            {creditInfo?.usage.last7Days.consumption.toFixed(0) || 0}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {creditInfo?.usage.last7Days.transactions || 0} 次
                          </div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">30天</div>
                          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                            {creditInfo?.usage.last30Days.consumption.toFixed(0) || 0}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {creditInfo?.usage.last30Days.transactions || 0} 次
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 右侧：厂商占比环形图 */}
                <div className="col-span-1 bg-slate-50 dark:bg-slate-800 rounded-lg p-4 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity size={16} className="text-slate-500 dark:text-slate-400" />
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      厂商占比
                    </span>
                  </div>
                  {loadingCredits && !creditInfo ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="w-48 h-48 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
                    </div>
                  ) : donutData.length > 0 ? (
                    <div className="flex-1 flex flex-col justify-center">
                      <DonutChart data={donutData} size={200} thickness={36} />
                      <div className="mt-4 space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                        {creditInfo?.usage.last30Days.byProvider.map((item) => (
                          <div key={item.provider} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: getProviderColor(item.provider).fill }}
                              />
                              <span className="text-slate-600 dark:text-slate-300 truncate">
                                {getProviderName(item.provider)}
                              </span>
                            </div>
                            <span className="font-bold text-slate-900 dark:text-slate-100 flex-shrink-0 ml-2">
                              {item.percentage}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                      暂无数据
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 自定义滚动条样式 */}
      <style jsx global>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
        }

        .custom-scrollbar:hover {
          scrollbar-color: rgba(148, 163, 184, 0.3) transparent;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: transparent;
          border-radius: 3px;
        }

        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: rgba(148, 163, 184, 0.3);
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(148, 163, 184, 0.5);
        }
      `}</style>
    </div>
  );
};

export default UserInfoModal;
