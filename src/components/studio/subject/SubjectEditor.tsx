"use client";

import React, { useState, useCallback, useRef } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { Subject, SubjectImage } from '@/types';
import { generateSubjectId, generateThumbnail } from '@/services/subjectService';
import { SubjectExtractor } from './SubjectExtractor';

interface SubjectEditorProps {
  subject?: Subject | null;  // 编辑模式传入，新建模式为 null
  initialImage?: string;     // 初始图片（从画布创建主体时传入）
  onSave: (subject: Subject) => void;
  onCancel: () => void;
}

export const SubjectEditor: React.FC<SubjectEditorProps> = ({
  subject,
  initialImage,
  onSave,
  onCancel,
}) => {
  const isEditing = !!subject;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 表单状态
  const [name, setName] = useState(subject?.name || '');
  const [description, setDescription] = useState(subject?.description || '');
  const [images, setImages] = useState<SubjectImage[]>(subject?.images || []);

  // UI 状态
  const [extractorSource, setExtractorSource] = useState<string | null>(initialImage || null);
  const [isUploading, setIsUploading] = useState(false);

  // 处理文件上传
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        // 打开提取器
        setExtractorSource(base64);
        setIsUploading(false);
      };
      reader.onerror = () => {
        console.error('文件读取失败');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('文件处理失败:', err);
      setIsUploading(false);
    }

    // 清空 input 以允许重复选择同一文件
    e.target.value = '';
  }, []);

  // 处理提取完成
  const handleExtracted = useCallback(async (result: SubjectImage) => {
    // 限制最多 3 张图片（Vidu 限制）
    if (images.length >= 3) {
      alert('最多支持 3 张主体图片');
      setExtractorSource(null);
      return;
    }

    setImages(prev => [...prev, result]);
    setExtractorSource(null);
  }, [images.length]);

  // 删除图片
  const handleRemoveImage = useCallback((imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  }, []);

  // 保存主体
  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      alert('请输入主体名称');
      return;
    }

    if (images.length === 0) {
      alert('请至少添加一张主体图片');
      return;
    }

    // 生成缩略图
    let thumbnail = subject?.thumbnail || '';
    try {
      thumbnail = await generateThumbnail(images[0].base64, 200);
    } catch (err) {
      console.error('生成缩略图失败:', err);
      thumbnail = images[0].base64;  // 回退使用原图
    }

    const now = Date.now();
    const newSubject: Subject = {
      id: subject?.id || generateSubjectId(),
      name: name.trim(),
      description: description.trim() || undefined,
      thumbnail,
      images,
      createdAt: subject?.createdAt || now,
      updatedAt: now,
    };

    onSave(newSubject);
  }, [name, description, images, subject, onSave]);

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {isEditing ? '编辑主体' : '添加主体'}
            </h3>
            <button
              onClick={onCancel}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={16} className="text-slate-500" />
            </button>
          </div>

          {/* 内容区 */}
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {/* 名称 */}
            <div>
              <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                名称 *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="如：机器人角色、红色跑车..."
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500 transition-colors"
                autoFocus={!extractorSource}
              />
            </div>

            {/* 主体图片 */}
            <div>
              <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                主体图片 * <span className="text-slate-400">（最多3张，支持多角度）</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {images.map((img, index) => (
                  <div
                    key={img.id}
                    className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group"
                    style={{
                      backgroundImage: `url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImNoZWNrIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxyZWN0IHdpZHRoPSI1IiBoZWlnaHQ9IjUiIGZpbGw9IiNlNWU3ZWIiLz48cmVjdCB4PSI1IiB5PSI1IiB3aWR0aD0iNSIgaGVpZ2h0PSI1IiBmaWxsPSIjZTVlN2ViIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCBmaWxsPSJ1cmwoI2NoZWNrKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')`
                    }}
                  >
                    <img
                      src={img.base64}
                      alt={`角度 ${index + 1}`}
                      className="w-full h-full object-contain"
                    />
                    {img.angle && (
                      <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 bg-black/60 text-[8px] text-white rounded">
                        {img.angle}
                      </div>
                    )}
                    <button
                      onClick={() => handleRemoveImage(img.id)}
                      className="absolute top-0.5 right-0.5 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}

                {images.length < 3 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-blue-500"
                  >
                    {isUploading ? (
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Plus size={16} />
                        <span className="text-[9px]">添加</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* 描述 */}
            <div>
              <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                描述 <span className="text-slate-400">（可选）</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="简单描述这个主体的特征..."
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || images.length === 0}
              className="px-4 py-2 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditing ? '保存修改' : '创建主体'}
            </button>
          </div>
        </div>
      </div>

      {/* 主体提取器 */}
      {extractorSource && (
        <SubjectExtractor
          sourceImage={extractorSource}
          onExtracted={handleExtracted}
          onCancel={() => setExtractorSource(null)}
        />
      )}
    </>
  );
};

export default SubjectEditor;
