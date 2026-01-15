"use client";

/**
 * 可折叠配置面板组件
 *
 * 提取自 AudioNodePanel 的配置展开/折叠功能
 * 用于各厂商的扩展参数配置
 */

import React, { useState, ReactNode } from 'react';
import { Settings2, ChevronDown, ChevronUp } from 'lucide-react';

interface ConfigExpandSectionProps {
    /** 子内容 */
    children: ReactNode;
    /** 默认是否折叠 */
    defaultCollapsed?: boolean;
    /** 折叠状态改变回调 */
    onCollapsedChange?: (collapsed: boolean) => void;
    /** 自定义按钮样式 */
    buttonClassName?: string;
    /** 自定义内容容器样式 */
    contentClassName?: string;
    /** 最大高度 (用于动画) */
    maxHeight?: string;
    /** 是否显示图标 */
    showIcon?: boolean;
    /** 自定义图标 */
    icon?: ReactNode;
    /** 按钮标题 (可选) */
    title?: string;
}

/**
 * 配置展开/折叠按钮组件
 */
export const ConfigExpandButton: React.FC<{
    isCollapsed: boolean;
    onClick: () => void;
    className?: string;
    showIcon?: boolean;
    icon?: ReactNode;
    title?: string;
}> = ({
    isCollapsed,
    onClick,
    className = '',
    showIcon = true,
    icon,
    title
}) => {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${className}`}
            title={title || (isCollapsed ? '展开配置' : '收起配置')}
        >
            {showIcon && (icon || <Settings2 size={12} />)}
            {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
    );
};

/**
 * 可折叠内容容器
 */
export const CollapsibleContent: React.FC<{
    isCollapsed: boolean;
    children: ReactNode;
    className?: string;
    maxHeight?: string;
}> = ({
    isCollapsed,
    children,
    className = '',
    maxHeight = '500px'
}) => {
    return (
        <div
            className={`overflow-hidden transition-all duration-300 ${
                isCollapsed
                    ? 'max-h-0 opacity-0'
                    : `opacity-100`
            } ${className}`}
            style={{ maxHeight: isCollapsed ? 0 : maxHeight }}
        >
            {children}
        </div>
    );
};

/**
 * 完整的可折叠配置区域 - 返回渲染所需的所有元素
 * 用法: const { button, content, isCollapsed } = useConfigExpandSection({ children: <YourContent /> });
 */
export function useConfigExpandSection({
    children,
    defaultCollapsed = false,
    onCollapsedChange,
    buttonClassName,
    contentClassName,
    maxHeight = '500px',
    showIcon = true,
    icon,
    title
}: ConfigExpandSectionProps) {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

    const handleToggle = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        onCollapsedChange?.(newState);
    };

    return {
        button: (
            <ConfigExpandButton
                isCollapsed={isCollapsed}
                onClick={handleToggle}
                className={buttonClassName}
                showIcon={showIcon}
                icon={icon}
                title={title}
            />
        ),
        content: (
            <CollapsibleContent
                isCollapsed={isCollapsed}
                className={contentClassName}
                maxHeight={maxHeight}
            >
                {children}
            </CollapsibleContent>
        ),
        isCollapsed,
        setIsCollapsed
    };
}

/**
 * Hook: 使用配置展开状态
 */
export function useConfigExpand(defaultCollapsed = false) {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

    const toggle = () => setIsCollapsed(prev => !prev);

    return {
        isCollapsed,
        setIsCollapsed,
        toggle,
        buttonProps: {
            isCollapsed,
            onClick: toggle
        },
        contentProps: {
            isCollapsed
        }
    };
}

export default useConfigExpandSection;
