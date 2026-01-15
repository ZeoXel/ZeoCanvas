"use client";

import React, { useState, useCallback } from 'react';
import { X, Check } from 'lucide-react';
import type { SubjectImage } from '@/types';
import { generateSubjectImageId } from '@/services/subjectService';

interface SubjectExtractorProps {
  sourceImage: string;
  onExtracted: (result: SubjectImage) => void;
  onCancel: () => void;
}

// 角度选项
const ANGLE_OPTIONS = [
  { value: 'front', label: '正面' },
  { value: 'side', label: '侧面' },
  { value: 'back', label: '背面' },
  { value: '3/4', label: '3/4视角' },
  { value: 'custom', label: '自定义' },
];

export const SubjectExtractor: React.FC<SubjectExtractorProps> = ({
  sourceImage,
  onExtracted,
  onCancel,
}) => {
  const [selectedAngle, setSelectedAngle] = useState<string>('front');
  const [customAngle, setCustomAngle] = useState<string>('');

  // 确认添加 - 直接使用原图作为主体
  const handleConfirm = useCallback(() => {
    const angle = selectedAngle === 'custom' ? customAngle : selectedAngle;
    onExtracted({
      id: generateSubjectImageId(),
      base64: sourceImage,
      originalBase64: sourceImage,
      angle: angle || 'front',
      createdAt: Date.now(),
    });
  }, [selectedAngle, customAngle, sourceImage, onExtracted]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">添加主体</h3>
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-4">
          {/* 图片预览 */}
          <div className="mb-4">
            <div className="aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
              <img
                src={sourceImage}
                alt="主体图片"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* 角度选择 */}
          <div className="mb-4">
            <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">角度标记</div>
            <div className="flex flex-wrap gap-2">
              {ANGLE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => setSelectedAngle(option.value)}
                  className={`
                    px-3 py-1.5 text-xs rounded-lg transition-all
                    ${selectedAngle === option.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {selectedAngle === 'custom' && (
              <input
                type="text"
                placeholder="输入自定义角度名称..."
                value={customAngle}
                onChange={(e) => setCustomAngle(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className="mt-2 w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500"
                autoFocus
              />
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <Check size={14} />
            确认添加
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubjectExtractor;
