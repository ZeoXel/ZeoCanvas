"use client";


import React, { useState, useEffect } from 'react';
import { X, Save, Key, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [polloKey, setPolloKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('pollo_api_key');
    if (stored) setPolloKey(stored);
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('pollo_api_key', polloKey.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    setTimeout(onClose, 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="w-[480px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
            <X size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg">
              <Key size={16} className="text-slate-900 dark:text-slate-100" />
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">设置 (Settings)</span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Pollo.ai API Key (Wan 2.5)</label>
              <a href="https://pollo.ai/dashboard/api-keys" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-blue-500 dark:text-blue-400 hover:text-blue-400 dark:hover:text-blue-300 transition-colors">
                <span>获取 Key</span>
                <ExternalLink size={10} />
              </a>
            </div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-slate-500 dark:text-slate-400 font-mono text-xs">key-</span>
              </div>
              <input
                type="password"
                autoComplete="off"
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:border-blue-500/50 dark:focus:border-blue-400/50 transition-colors font-mono"
                placeholder="粘贴您的 Pollo API Key..."
                value={polloKey}
                onChange={(e) => setPolloKey(e.target.value)}
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              用于激活 <strong className="text-slate-700 dark:text-slate-200">Wan 2.1 / Wan 2.5</strong> 视频生成模型。密钥仅保存在您的浏览器本地存储中，不会上传至 studio 服务器。
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-end">
          <button
            onClick={handleSave}
            className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${isSaved ? 'bg-green-500 text-white' : 'bg-blue-500 text-white hover:bg-blue-400'}`}
          >
            {isSaved ? '已保存' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
};
