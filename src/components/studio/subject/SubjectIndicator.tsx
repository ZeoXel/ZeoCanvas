"use client";

import React, { useMemo, useState } from 'react';
import type { Subject } from '@/types';
import { getPrimaryImage } from '@/services/subjectService';

interface SubjectIndicatorProps {
  text: string;
  subjects: Subject[];
  /** 当前选择的模型 - 用于判断主体支持数量 */
  model?: string;
}

/**
 * 主体指示器组件
 * 显示在输入框下方，展示已识别的主体引用，支持悬浮预览
 */
export const SubjectIndicator: React.FC<SubjectIndicatorProps> = ({
  text,
  subjects,
  model,
}) => {
  // 判断是否为 Vidu 模型（原生支持多主体）
  const isViduModel = model?.startsWith('vidu') || false;
  const [hoveredSubject, setHoveredSubject] = useState<Subject | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // 解析已识别的主体
  const detectedSubjects = useMemo(() => {
    if (!text || !subjects || subjects.length === 0) return [];

    const detected: Subject[] = [];
    const seen = new Set<string>();

    // 按名称长度降序排序
    const sortedSubjects = [...subjects].sort((a, b) => b.name.length - a.name.length);

    for (const subject of sortedSubjects) {
      const escapedName = subject.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`@${escapedName}(?![a-zA-Z0-9_])`, 'g');

      if (pattern.test(text) && !seen.has(subject.id)) {
        seen.add(subject.id);
        detected.push(subject);
      }
    }

    return detected;
  }, [text, subjects]);

  const handleMouseEnter = (e: React.MouseEvent, subject: Subject) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
    setHoveredSubject(subject);
  };

  const handleMouseLeave = () => {
    setHoveredSubject(null);
  };

  if (detectedSubjects.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-1">
      <span className="text-[9px] text-slate-400 dark:text-slate-500">引用:</span>
      {detectedSubjects.map((subject, index) => {
        // 非 Vidu 模型只支持第一个主体，其余显示为灰色（表示不支持）
        const isSupported = isViduModel || index === 0;
        const bgClass = isSupported
          ? 'bg-violet-100 dark:bg-violet-900/40 border-violet-200 dark:border-violet-700/50 hover:bg-violet-200 dark:hover:bg-violet-800/50'
          : 'bg-slate-200 dark:bg-slate-700/40 border-slate-300 dark:border-slate-600/50 hover:bg-slate-300 dark:hover:bg-slate-600/50';
        const textClass = isSupported
          ? 'text-violet-700 dark:text-violet-300'
          : 'text-slate-500 dark:text-slate-400';

        return (
          <div
            key={subject.id}
            className="relative"
            onMouseEnter={(e) => handleMouseEnter(e, subject)}
            onMouseLeave={handleMouseLeave}
            title={!isSupported ? '当前模型仅支持一个主体引用' : undefined}
          >
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border cursor-help transition-colors ${bgClass}`}>
              {/* 小缩略图 */}
              <div className="w-4 h-4 rounded overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0">
                <img
                  src={subject.thumbnail || getPrimaryImage(subject) || ''}
                  alt=""
                  className={`w-full h-full object-cover ${!isSupported ? 'opacity-50' : ''}`}
                />
              </div>
              <span className={`text-[10px] font-medium ${textClass}`}>
                @{subject.name}
              </span>
              {!isSupported && (
                <span className="text-[8px] text-slate-400 dark:text-slate-500">(不支持)</span>
              )}
            </div>
          </div>
        );
      })}

      {/* 悬浮预览 Tooltip */}
      {hoveredSubject && (
        <div
          className="fixed z-[9999] pointer-events-none animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y - 8,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 min-w-[100px]">
            {/* 缩略图 */}
            <div
              className="w-20 h-20 rounded-lg overflow-hidden mb-1.5 bg-slate-100 dark:bg-slate-700"
              style={{
                backgroundImage: `url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImNoZWNrIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxyZWN0IHdpZHRoPSI1IiBoZWlnaHQ9IjUiIGZpbGw9IiNlNWU3ZWIiLz48cmVjdCB4PSI1IiB5PSI1IiB3aWR0aD0iNSIgaGVpZ2h0PSI1IiBmaWxsPSIjZTVlN2ViIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCBmaWxsPSJ1cmwoI2NoZWNrKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')`
              }}
            >
              <img
                src={getPrimaryImage(hoveredSubject) || hoveredSubject.thumbnail}
                alt={hoveredSubject.name}
                className="w-full h-full object-contain"
              />
            </div>
            {/* 名称 */}
            <div className="text-center">
              <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">
                {hoveredSubject.name}
              </div>
              {hoveredSubject.images.length > 1 && (
                <div className="text-[8px] text-slate-400 dark:text-slate-500">
                  {hoveredSubject.images.length} 张图片
                </div>
              )}
            </div>
            {/* 小三角 */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white dark:bg-slate-800 border-r border-b border-slate-200 dark:border-slate-700 rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectIndicator;
