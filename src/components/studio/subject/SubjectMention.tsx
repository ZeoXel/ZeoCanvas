"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import type { Subject } from '@/types';
import { getPrimaryImage } from '@/services/subjectService';

interface SubjectMentionProps {
  subjects: Subject[];
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (newValue: string) => void;
}

/**
 * 主体 @ 提及组件
 * 在 textarea 中输入 @ 时弹出主体选择框
 * 支持方向键导航和回车选择
 */
export const SubjectMention: React.FC<SubjectMentionProps> = ({
  subjects,
  textareaRef,
  value,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [mentionStart, setMentionStart] = useState(-1);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 过滤匹配的主体
  const filteredSubjects = subjects.filter(s =>
    s.name.toLowerCase().includes(query.toLowerCase())
  );

  // 用于追踪上一次的 query，避免不必要的 selectedIndex 重置
  const lastQueryRef = useRef('');

  // 监听 textarea 输入
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleInput = () => {
      // 使用 textarea 的实际值和光标位置（确保同步）
      const currentValue = textarea.value;
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = currentValue.slice(0, cursorPos);

      // 从光标位置向前查找未完成的 @ 提及
      // 「未完成」定义：@ 后面没有空格（正在输入中）
      let searchPos = textBeforeCursor.length;
      let foundValidAt = false;
      let atIndex = -1;
      let queryText = '';

      // 从后向前查找，找到第一个有效的（未完成的）@ 触发点
      while (searchPos > 0) {
        const lastAtInRange = textBeforeCursor.lastIndexOf('@', searchPos - 1);
        if (lastAtInRange === -1) break;

        // 检查 @ 前面是否是空白或字符串开头
        const charBefore = lastAtInRange > 0 ? textBeforeCursor[lastAtInRange - 1] : ' ';
        const isValidTrigger = /[\s\n]/.test(charBefore) || lastAtInRange === 0;

        if (isValidTrigger) {
          // 获取 @ 后面到光标位置的文本
          const textAfterAt = textBeforeCursor.slice(lastAtInRange + 1);

          // 如果 @ 后面没有空格，这是一个「未完成」的提及
          if (!/\s/.test(textAfterAt)) {
            foundValidAt = true;
            atIndex = lastAtInRange;
            queryText = textAfterAt;
            break;
          }
        }

        // 继续向前查找
        searchPos = lastAtInRange;
      }

      if (foundValidAt) {
        // 只有当 query 变化时才重置 selectedIndex
        if (queryText !== lastQueryRef.current) {
          setSelectedIndex(0);
          lastQueryRef.current = queryText;
        }
        setQuery(queryText);
        setMentionStart(atIndex);

        // 计算弹窗位置
        const pos = getCaretPosition(textarea, atIndex);
        setPosition(pos);
        setIsOpen(true);
        return;
      }

      setIsOpen(false);
      lastQueryRef.current = '';
    };

    // 失去焦点时关闭弹窗
    const handleBlur = () => {
      // 使用 setTimeout 延迟关闭，以便点击弹窗中的选项时不会立即关闭
      setTimeout(() => {
        if (document.activeElement !== textarea) {
          setIsOpen(false);
          lastQueryRef.current = '';
        }
      }, 150);
    };

    // 直接监听 textarea 的 input 事件
    const handleEvent = () => {
      // 使用 setTimeout 确保 DOM 更新完成
      setTimeout(handleInput, 0);
    };

    textarea.addEventListener('input', handleEvent);
    textarea.addEventListener('click', handleEvent);
    textarea.addEventListener('blur', handleBlur);

    // 初始检查
    handleInput();

    return () => {
      textarea.removeEventListener('input', handleEvent);
      textarea.removeEventListener('click', handleEvent);
      textarea.removeEventListener('blur', handleBlur);
    };
  }, [textareaRef, subjects]); // 移除 value 依赖，改为监听 DOM 事件

  // 插入提及 - 必须在键盘导航 useEffect 之前声明
  const insertMention = useCallback((subject: Subject) => {
    if (mentionStart === -1) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const currentValue = textarea.value;
    const cursorPos = textarea.selectionStart;
    const beforeMention = currentValue.slice(0, mentionStart);
    const afterCursor = currentValue.slice(cursorPos);

    // 插入 @名称 + 空格
    const newValue = `${beforeMention}@${subject.name} ${afterCursor}`;
    onChange(newValue);

    // 设置光标位置到插入内容之后
    const newCursorPos = mentionStart + subject.name.length + 2; // @ + name + space
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });

    // 重置所有状态，确保下次 @ 可以正常触发
    setIsOpen(false);
    setQuery('');
    setMentionStart(-1);
    lastQueryRef.current = '';
  }, [mentionStart, onChange, textareaRef]);

  // 键盘导航 - 使用 ref 来避免闭包陷阱
  const filteredSubjectsRef = useRef(filteredSubjects);
  const selectedIndexRef = useRef(selectedIndex);
  filteredSubjectsRef.current = filteredSubjects;
  selectedIndexRef.current = selectedIndex;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentFiltered = filteredSubjectsRef.current;
      const currentIndex = selectedIndexRef.current;

      if (currentFiltered.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex(prev =>
            prev < currentFiltered.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex(prev =>
            prev > 0 ? prev - 1 : currentFiltered.length - 1
          );
          break;
        case 'Enter':
          if (currentFiltered[currentIndex]) {
            e.preventDefault();
            e.stopPropagation();
            insertMention(currentFiltered[currentIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(false);
          break;
      }
    };

    // 使用 capture 阶段确保优先处理
    textarea.addEventListener('keydown', handleKeyDown, true);
    return () => textarea.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, textareaRef, insertMention]);

  // 点击选择
  const handleSelect = (subject: Subject) => {
    insertMention(subject);
  };

  // 计算光标位置（返回视口坐标）
  const getCaretPosition = (textarea: HTMLTextAreaElement, index: number) => {
    const textareaRect = textarea.getBoundingClientRect();
    const style = window.getComputedStyle(textarea);
    const lineHeight = parseInt(style.lineHeight) || 20;

    // 创建临时元素计算光标在文本中的相对位置
    const div = document.createElement('div');
    div.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      width: ${textarea.clientWidth}px;
      font: ${style.font};
      padding: ${style.padding};
      line-height: ${style.lineHeight};
    `;
    div.textContent = textarea.value.slice(0, index);

    const span = document.createElement('span');
    span.textContent = '@';
    div.appendChild(span);

    document.body.appendChild(div);
    const spanRect = span.getBoundingClientRect();
    const divRect = div.getBoundingClientRect();
    document.body.removeChild(div);

    // 计算相对于 textarea 的偏移
    const relativeTop = spanRect.top - divRect.top;
    const relativeLeft = spanRect.left - divRect.left;

    // 返回视口坐标
    return {
      top: textareaRect.top + relativeTop + lineHeight + 4 - textarea.scrollTop,
      left: textareaRect.left + relativeLeft,
    };
  };

  // 检查是否在客户端
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isOpen || filteredSubjects.length === 0 || !isMounted) return null;

  // 使用 portal 渲染到 body，避免被父容器的 stacking context 限制
  const popover = (
    <div
      ref={popoverRef}
      className="fixed z-[9999] bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden min-w-[180px] max-w-[240px] animate-in fade-in zoom-in-95 duration-150"
      style={{
        top: position.top,
        left: position.left,
      }}
      onMouseDown={(e) => e.preventDefault()} // 防止失去焦点
    >
      <div className="py-1 max-h-[200px] overflow-y-auto custom-scrollbar">
        {filteredSubjects.map((subject, index) => (
          <div
            key={subject.id}
            className={`
              flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors
              ${index === selectedIndex
                ? 'bg-violet-50 dark:bg-violet-900/30'
                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }
            `}
            onClick={() => handleSelect(subject)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            {/* 缩略图 */}
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0">
              <img
                src={getPrimaryImage(subject) || subject.thumbnail}
                alt={subject.name}
                className="w-full h-full object-cover"
              />
            </div>
            {/* 名称 */}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                {subject.name}
              </div>
              {subject.description && (
                <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                  {subject.description}
                </div>
              )}
            </div>
            {/* 选中指示 */}
            {index === selectedIndex && (
              <div className="text-[9px] text-slate-400 dark:text-slate-500 shrink-0">
                ↵
              </div>
            )}
          </div>
        ))}
      </div>
      {/* 提示 */}
      <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700">
        <div className="text-[9px] text-slate-400 dark:text-slate-500 flex items-center gap-2">
          <span>↑↓ 选择</span>
          <span>↵ 确认</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  );

  // 使用 Portal 渲染到 body，完全脱离父组件的 stacking context
  return ReactDOM.createPortal(popover, document.body);
};

export default SubjectMention;
