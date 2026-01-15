"use client";

/**
 * 音频节点底部面板组件
 *
 * 根据节点类型显示对应配置：
 * - AUDIO_GENERATOR (Suno): 标题、风格、歌词、版本等
 * - VOICE_GENERATOR (MiniMax): 音色、语速、情感、音效
 */

import React, { useState } from 'react';
import { Music, Mic2, ChevronDown, Wand2, Loader2, Type } from 'lucide-react';
import { AppNode, NodeType } from '@/types';
import { SUNO_VERSION_PRESETS } from '@/services/sunoService';
import { ConfigExpandButton, CollapsibleContent } from './shared/ConfigExpandSection';
import { AudioConfigPanel } from './shared';

interface AudioNodePanelProps {
    node: AppNode;
    isOpen: boolean;
    isWorking: boolean;
    localPrompt: string;
    setLocalPrompt: (value: string) => void;
    inputHeight: number;
    inverseScale: number;
    onUpdate: (id: string, data: Partial<AppNode['data']>) => void;
    onAction: () => void;
    onInputFocus: () => void;
    onInputBlur: () => void;
    onInputResizeStart: (e: React.MouseEvent) => void;
    onCmdEnter: (e: React.KeyboardEvent) => void;
}

const GLASS_PANEL = "bg-[#ffffff]/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-300 dark:border-slate-700 shadow-2xl";

export const AudioNodePanel: React.FC<AudioNodePanelProps> = ({
    node,
    isOpen,
    isWorking,
    localPrompt,
    setLocalPrompt,
    inputHeight,
    inverseScale,
    onUpdate,
    onAction,
    onInputFocus,
    onInputBlur,
    onInputResizeStart,
    onCmdEnter,
}) => {
    const [isConfigExpanded, setIsConfigExpanded] = useState(true);

    // 根据节点类型判断模式
    const isMusic = node.type === NodeType.AUDIO_GENERATOR;
    const musicConfig = node.data.musicConfig || {};
    const voiceConfig = node.data.voiceConfig || {};

    // 获取当前版本（Suno）
    const getCurrentVersion = () => {
        return SUNO_VERSION_PRESETS.find(v => v.value === musicConfig.mv) || SUNO_VERSION_PRESETS[3];
    };

    // 获取当前模型显示名称
    const getCurrentModelLabel = () => {
        if (isMusic) {
            const version = getCurrentVersion();
            return version.label;
        } else {
            const model = node.data.model || 'speech-2.6-hd';
            if (model === 'speech-2.6-turbo') return 'Turbo';
            return 'HD';
        }
    };

    // 获取当前配置
    const getCurrentConfig = () => {
        return isMusic ? musicConfig : voiceConfig;
    };

    // 更新配置
    const handleConfigChange = (config: any) => {
        if (isMusic) {
            onUpdate(node.id, { musicConfig: config });
        } else {
            onUpdate(node.id, { voiceConfig: config });
        }
    };

    return (
        <div
            className={`absolute top-full left-1/2 w-[98%] z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
            style={{
                paddingTop: `${8 * inverseScale}px`,
                transform: `translateX(-50%) scale(${inverseScale})`,
                transformOrigin: 'top center'
            }}
        >
            <div className={`w-full rounded-[20px] p-1 flex flex-col gap-1 ${GLASS_PANEL} relative z-[100]`} onMouseDown={e => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
                <div className="relative group/input bg-white dark:bg-slate-800 rounded-[16px] flex flex-col overflow-hidden">
                    {/* 音乐模式：标题输入 */}
                    {isMusic && (
                        <div className="px-3 pt-2 pb-1">
                            <div className="flex items-center gap-1.5">
                                <Type size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
                                <input
                                    type="text"
                                    value={musicConfig.title || ''}
                                    onChange={(e) => onUpdate(node.id, { musicConfig: { ...musicConfig, title: e.target.value } })}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    placeholder="歌曲标题（可选）"
                                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-red-300 dark:focus:border-red-500 transition-colors"
                                />
                            </div>
                        </div>
                    )}

                    {/* 文本输入区 */}
                    <textarea
                        className="w-full bg-transparent text-[11px] text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 p-2.5 focus:outline-none resize-none custom-scrollbar font-medium leading-relaxed"
                        style={{ height: `${Math.min(inputHeight, 120)}px` }}
                        placeholder={isMusic
                            ? (musicConfig.instrumental
                                ? "描述音乐氛围、节奏、情感..."
                                : "输入歌词，可用 [Verse] [Chorus] 等标签，或描述音乐风格...")
                            : "输入要转换为语音的文本内容..."
                        }
                        value={localPrompt}
                        onChange={(e) => setLocalPrompt(e.target.value)}
                        onBlur={onInputBlur}
                        onKeyDown={onCmdEnter}
                        onFocus={onInputFocus}
                        onMouseDown={e => e.stopPropagation()}
                        readOnly={isWorking}
                    />
                    <div className="absolute bottom-0 left-0 w-full h-3 cursor-row-resize flex items-center justify-center opacity-0 group-hover/input:opacity-100 transition-opacity" onMouseDown={onInputResizeStart}>
                        <div className="w-8 h-1 rounded-full bg-slate-100 dark:bg-slate-700 group-hover/input:bg-slate-200 dark:group-hover/input:bg-slate-600" />
                    </div>
                </div>

                {/* 扩展配置面板 */}
                <div className="px-3 pb-1">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500">
                            {isMusic ? 'Suno 配置' : 'MiniMax 配置'}
                        </span>
                        <ConfigExpandButton
                            isCollapsed={!isConfigExpanded}
                            onClick={() => setIsConfigExpanded(!isConfigExpanded)}
                        />
                    </div>
                    <CollapsibleContent isCollapsed={!isConfigExpanded} maxHeight="200px">
                        <AudioConfigPanel
                            providerId={isMusic ? 'suno' : 'minimax'}
                            config={getCurrentConfig()}
                            onConfigChange={handleConfigChange}
                        />
                    </CollapsibleContent>
                </div>

                {/* 底部操作栏 */}
                <div className="flex items-center justify-between px-2 pb-1 pt-1 relative z-20">
                    <div className="flex items-center gap-2">
                        {/* 厂商 Logo + 模型/版本显示 */}
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            {isMusic ? <Music size={10} /> : <Mic2 size={10} />}
                            <span>{isMusic ? 'Suno' : 'MiniMax'}</span>
                            <span className="text-red-500">{getCurrentModelLabel()}</span>
                        </div>

                        {/* 音乐模式：显示配置标签 */}
                        {isMusic && musicConfig.tags && (
                            <div className="px-2 py-1 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded text-[9px] text-red-600 dark:text-red-400 truncate max-w-[100px]">
                                {musicConfig.tags}
                            </div>
                        )}
                        {isMusic && musicConfig.instrumental && (
                            <div className="px-2 py-1 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded text-[9px] text-purple-600 dark:text-purple-400">
                                纯音乐
                            </div>
                        )}

                        {/* 语音模式下的模型切换 */}
                        {!isMusic && (
                            <div className="relative group/model">
                                <div className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors text-[10px] text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400">
                                    <span>切换模型</span>
                                    <ChevronDown size={10} />
                                </div>
                                <div className="absolute bottom-full left-0 pb-2 w-36 opacity-0 translate-y-2 pointer-events-none group-hover/model:opacity-100 group-hover/model:translate-y-0 group-hover/model:pointer-events-auto transition-all duration-200 z-[200]">
                                    <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl shadow-xl overflow-hidden">
                                        <div onClick={() => onUpdate(node.id, { model: 'speech-2.6-hd' })} className={`px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 ${node.data.model === 'speech-2.6-hd' || !node.data.model ? 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30' : 'text-slate-600 dark:text-slate-300'}`}>MiniMax HD</div>
                                        <div onClick={() => onUpdate(node.id, { model: 'speech-2.6-turbo' })} className={`px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 ${node.data.model === 'speech-2.6-turbo' ? 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30' : 'text-slate-600 dark:text-slate-300'}`}>MiniMax Turbo</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 生成按钮 */}
                    <button
                        onClick={onAction}
                        disabled={isWorking}
                        className={`relative flex items-center gap-2 px-4 py-1.5 rounded-[12px] font-bold text-[10px] tracking-wide transition-all duration-300 ${
                            isWorking
                                ? 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-red-500 to-rose-500 text-white hover:shadow-lg hover:shadow-red-500/20 hover:scale-105 active:scale-95'
                        }`}
                    >
                        {isWorking ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />}
                        <span>{isWorking ? '生成中...' : '生成'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
