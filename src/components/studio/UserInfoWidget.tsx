"use client";

import React, { useState, useEffect, useRef } from 'react';
import { User, Settings, CreditCard, LogOut } from 'lucide-react';
import { getCreditBalance } from '@/services/creditsService';
import type { CreditBalance } from '@/types/credits';
import { useAuth } from '@/contexts/AuthContext';
import { onCreditsUpdated } from '@/services/creditsEvents';

// 十字星图标组件 - 积分符号
const CreditIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M12 1L13.5 9.5L22 12L13.5 14.5L12 23L10.5 14.5L2 12L10.5 9.5L12 1Z" />
  </svg>
);

interface UserInfoWidgetProps {
  onOpenModal: (tab: 'account' | 'credits') => void;
}

export const UserInfoWidget: React.FC<UserInfoWidgetProps> = ({
  onOpenModal,
}) => {
  const { user: authUser, logout } = useAuth();
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 获取积分余额
  const fetchCreditBalance = async () => {
    try {
      const balance = await getCreditBalance();
      setCreditBalance(balance);
    } catch (err) {
      console.error('获取积分信息失败:', err);
    }
  };

  useEffect(() => {
    // 初始加载
    fetchCreditBalance();

    // 监听积分更新事件
    const unsubscribe = onCreditsUpdated((detail) => {
      console.log('[UserInfoWidget] Credits updated:', detail);
      // 直接更新余额，而不是重新请求
      setCreditBalance((prev) => ({
        total: prev?.total ?? 0,
        used: (prev?.used ?? 0) + detail.credits,
        remaining: detail.balance,
        locked: prev?.locked ?? 0,
      }));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 100);
  };

  const handleLogout = async () => {
    if (confirm('确定要退出登录吗?')) {
      await logout();
    }
  };

  const totalCredits = creditBalance?.remaining || 0;

  return (
    <div
      ref={widgetRef}
      className="relative group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 入口按钮 - 与右下角缩放控制保持一致高度 */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-2xl border border-slate-300 dark:border-slate-600 rounded-2xl shadow-2xl">
        {/* 头像 */}
        <div className="relative p-1">
          {authUser?.photo ? (
            <img
              src={authUser.photo}
              alt={authUser.name}
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
              <User size={14} strokeWidth={2} className="text-slate-600 dark:text-slate-400" />
            </div>
          )}
          {/* 在线指示器 */}
          <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-slate-800" />
        </div>

        {/* 分隔线 - 与右下角一致 */}
        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600" />

        {/* 积分显示 - 十字图标 + 数值 */}
        <div className="flex items-center gap-1 px-1">
          <CreditIcon size={12} className="text-slate-500 dark:text-slate-400" />
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 tabular-nums">
            {totalCredits.toLocaleString()}
          </span>
        </div>
      </div>

      {/* 悬浮菜单 - 与画布双击弹框样式统一 */}
      {isHovered && (
        <div className="absolute bottom-full left-0 mb-2 w-48 bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-200 origin-bottom-left z-[100]">
          {/* 用户信息 */}
          <div className="px-2.5 py-2 mb-1 rounded-xl bg-slate-100/60 dark:bg-slate-800/60">
            <div className="flex items-center gap-2.5">
              {authUser?.photo ? (
                <img
                  src={authUser.photo}
                  alt={authUser.name}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-slate-700"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center ring-2 ring-white dark:ring-slate-700">
                  <User size={16} className="text-slate-600 dark:text-slate-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {authUser?.name}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                  <CreditIcon size={10} className="text-slate-400 dark:text-slate-500" />
                  <span className="font-medium">{totalCredits.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 菜单选项 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsHovered(false);
              onOpenModal('account');
            }}
            className="w-full px-3 py-2 flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Settings size={12} className="text-blue-600 dark:text-blue-400" />
            <span>账户管理</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsHovered(false);
              onOpenModal('credits');
            }}
            className="w-full px-3 py-2 flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <CreditCard size={12} className="text-amber-600 dark:text-amber-400" />
            <span>积分明细</span>
          </button>

          {/* 退出登录 */}
          <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-700/50">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsHovered(false);
                handleLogout();
              }}
              className="w-full px-3 py-2 flex items-center gap-2.5 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut size={12} />
              <span>退出登录</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserInfoWidget;
