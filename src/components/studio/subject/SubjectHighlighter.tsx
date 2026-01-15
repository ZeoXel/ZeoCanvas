"use client";

import React, { useMemo, useState, useRef } from 'react';
import type { Subject } from '@/types';
import { getPrimaryImage } from '@/services/subjectService';

interface SubjectHighlighterProps {
  text: string;
  subjects: Subject[];
  className?: string;
  style?: React.CSSProperties;
  /** 当前选择的模型 - 用于判断主体支持数量 */
  model?: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  subject: Subject | null;
}

/**
 * 主体引用高亮组件
 * 在文本中高亮显示 @主体ID 引用，并支持悬浮预览
 *
 * 设计原则：
 * - 高亮层与 textarea 完全对齐（相同字体、padding、行高）
 * - @主体ID 显示为带背景色的标签，同时保持原始文本布局
 * - 悬浮时显示主体缩略图预览
 */
export const SubjectHighlighter: React.FC<SubjectHighlighterProps> = ({
  text,
  subjects,
  className = '',
  style,
  model,
}) => {
  // 判断是否为 Vidu 模型（原生支持多主体）
  const isViduModel = model?.startsWith('vidu') || false;
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    subject: null,
  });

  // 解析文本，找出 @主体名称 引用并分割
  const segments = useMemo(() => {
    if (!text || !subjects || subjects.length === 0) {
      return [{ type: 'text' as const, content: text || '' }];
    }

    const result: Array<
      | { type: 'text'; content: string }
      | { type: 'subject'; content: string; subject: Subject; subjectIndex: number }
    > = [];

    // 用于追踪主体出现顺序
    let subjectCounter = 0;

    // 按名称长度降序排序，优先匹配更长的名称
    const sortedSubjects = [...subjects].sort((a, b) => b.name.length - a.name.length);

    // 构建匹配所有主体名称的正则表达式
    const escapedNames = sortedSubjects.map(s =>
      s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );

    if (escapedNames.length === 0) {
      return [{ type: 'text' as const, content: text }];
    }

    // 匹配 @名称，名称后不能是英文字母数字下划线
    // 中文场景：@小灰在奔跑 可以匹配
    const pattern = new RegExp(
      `(@(?:${escapedNames.join('|')}))(?![a-zA-Z0-9_])`,
      'g'
    );

    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      // 添加匹配前的普通文本
      if (match.index > lastIndex) {
        result.push({
          type: 'text',
          content: text.slice(lastIndex, match.index),
        });
      }

      // 查找对应的主体（去掉 @ 后匹配名称）
      const name = match[1].slice(1);
      const subject = subjects.find(s => s.name === name);

      if (subject) {
        result.push({
          type: 'subject',
          content: match[1],
          subject,
          subjectIndex: subjectCounter++,
        });
      } else {
        // 未找到主体，作为普通文本处理
        result.push({
          type: 'text',
          content: match[1],
        });
      }

      lastIndex = match.index + match[1].length;
    }

    // 添加剩余文本
    if (lastIndex < text.length) {
      result.push({
        type: 'text',
        content: text.slice(lastIndex),
      });
    }

    return result;
  }, [text, subjects]);

  // 处理主体标签悬浮
  const handleSubjectMouseEnter = (
    e: React.MouseEvent<HTMLSpanElement>,
    subject: Subject
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (containerRect) {
      setTooltip({
        visible: true,
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top,
        subject,
      });
    }
  };

  const handleSubjectMouseLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  // 如果没有主体引用，不渲染高亮层
  const hasSubjectRefs = segments.some(s => s.type === 'subject');
  if (!hasSubjectRefs) return null;

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none select-none ${className}`}
      style={style}
      aria-hidden="true"
    >
      {/* 高亮文本层 - 保持与 textarea 相同的文本布局 */}
      <div className="whitespace-pre-wrap break-words">
        {segments.map((segment, index) => {
          if (segment.type === 'text') {
            // 普通文本用透明色渲染（保持布局但不可见）
            return (
              <span key={index} className="text-transparent">
                {segment.content}
              </span>
            );
          } else {
            // 主体引用：显示带背景的原始文本 + 悬浮交互
            // 非 Vidu 模型只支持第一个主体，其余显示为灰色（表示不支持）
            const isSupported = isViduModel || segment.subjectIndex === 0;
            const bgColorClass = isSupported
              ? 'bg-violet-200/80 dark:bg-violet-800/60'
              : 'bg-slate-300/80 dark:bg-slate-600/60';
            const textColorClass = isSupported
              ? 'text-violet-700 dark:text-violet-300'
              : 'text-slate-500 dark:text-slate-400';

            return (
              <span
                key={index}
                className="pointer-events-auto cursor-pointer relative"
                onMouseEnter={(e) => handleSubjectMouseEnter(e, segment.subject)}
                onMouseLeave={handleSubjectMouseLeave}
                title={!isSupported ? '当前模型仅支持一个主体引用' : undefined}
              >
                {/* 背景高亮层 */}
                <span className="relative">
                  <span className={`absolute inset-0 -mx-0.5 -my-0.5 px-0.5 py-0.5 rounded ${bgColorClass}`} />
                  <span className={`relative ${textColorClass}`}>
                    {segment.content}
                  </span>
                </span>
              </span>
            );
          }
        })}
      </div>

      {/* 悬浮预览 Tooltip */}
      {tooltip.visible && tooltip.subject && (
        <div
          className="absolute z-[200] pointer-events-none animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 min-w-[120px]">
            {/* 缩略图 */}
            <div
              className="w-24 h-24 rounded-lg overflow-hidden mb-2 bg-slate-100 dark:bg-slate-700"
              style={{
                backgroundImage: `url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImNoZWNrIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxyZWN0IHdpZHRoPSI1IiBoZWlnaHQ9IjUiIGZpbGw9IiNlNWU3ZWIiLz48cmVjdCB4PSI1IiB5PSI1IiB3aWR0aD0iNSIgaGVpZ2h0PSI1IiBmaWxsPSIjZTVlN2ViIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCBmaWxsPSJ1cmwoI2NoZWNrKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')`
              }}
            >
              <img
                src={getPrimaryImage(tooltip.subject) || tooltip.subject.thumbnail}
                alt={tooltip.subject.name}
                className="w-full h-full object-contain"
              />
            </div>
            {/* 名称 */}
            <div className="text-center">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                {tooltip.subject.name}
              </div>
              {tooltip.subject.images.length > 1 && (
                <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {tooltip.subject.images.length} 张图片
                </div>
              )}
            </div>
            {/* 小三角 */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-slate-800 border-r border-b border-slate-200 dark:border-slate-700 rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectHighlighter;
