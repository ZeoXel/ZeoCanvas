"use client";

/**
 * 音频生成厂商扩展配置面板
 *
 * 根据不同厂商提供专属的参数配置选项：
 * - Suno: 音乐风格、排除风格、纯音乐、版本选择
 * - MiniMax: 音色、情感、语速、音效
 */

import React from 'react';
import { Tag, Sparkles, Gauge, Music } from 'lucide-react';
import { VOICE_PRESETS, EMOTION_PRESETS, SOUND_EFFECT_PRESETS } from '@/services/minimaxService';
import { SUNO_VERSION_PRESETS, MUSIC_STYLE_PRESETS } from '@/services/sunoService';
import type { MusicGenerationConfig, VoiceSynthesisConfig } from '@/types';

export interface AudioConfigPanelProps {
    /** 厂商 ID: 'suno' | 'minimax' */
    providerId: 'suno' | 'minimax';
    /** 当前配置 */
    config: MusicGenerationConfig | VoiceSynthesisConfig;
    /** 配置更新回调 */
    onConfigChange: (config: any) => void;
}

/**
 * 选项按钮组
 */
const OptionButtonGroup: React.FC<{
    options: readonly { value: string; label: string; desc?: string }[];
    value: string;
    onChange: (value: string) => void;
}> = ({ options, value, onChange }) => (
    <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
            <button
                key={opt.value}
                className={`px-2 py-1 text-[9px] rounded-lg border transition-all ${
                    value === opt.value
                        ? 'bg-pink-50 dark:bg-pink-900/30 border-pink-300 dark:border-pink-600 text-pink-600 dark:text-pink-400'
                        : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-pink-200 dark:hover:border-pink-500'
                }`}
                onClick={() => onChange(opt.value)}
                title={opt.desc}
            >
                {opt.label}
            </button>
        ))}
    </div>
);

/**
 * 开关选项
 */
const ToggleOption: React.FC<{
    label: string;
    icon?: React.ReactNode;
    checked: boolean;
    onChange: (checked: boolean) => void;
    description?: string;
}> = ({ label, icon, checked, onChange, description }) => (
    <label className="flex items-center gap-2 cursor-pointer group">
        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
            {icon}
            <span>{label}</span>
        </div>
        <div className="relative">
            <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            <div className={`w-8 h-4 rounded-full transition-colors ${
                checked ? 'bg-pink-500' : 'bg-slate-300 dark:bg-slate-600'
            }`}>
                <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform shadow-sm ${
                    checked ? 'translate-x-4' : 'translate-x-0'
                }`} />
            </div>
        </div>
        {description && (
            <span className="text-[9px] text-slate-400 dark:text-slate-500">{description}</span>
        )}
    </label>
);

/**
 * Suno 音乐配置面板
 */
const SunoConfigPanel: React.FC<{
    config: MusicGenerationConfig;
    onConfigChange: (config: MusicGenerationConfig) => void;
}> = ({ config, onConfigChange }) => {
    // 添加风格标签
    const addStyleTag = (style: string) => {
        const currentTags = (config.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean);
        if (!currentTags.some((t: string) => style.includes(t) || t.includes(style))) {
            const newTags = currentTags.length > 0 ? `${config.tags}, ${style}` : style;
            onConfigChange({ ...config, tags: newTags });
        }
    };

    return (
        <div className="space-y-2">
            {/* 风格标签 */}
            <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                    <Tag size={10} className="text-slate-400 dark:text-slate-500 shrink-0" />
                    <input
                        type="text"
                        value={config.tags || ''}
                        onChange={(e) => onConfigChange({ ...config, tags: e.target.value })}
                        onMouseDown={(e) => e.stopPropagation()}
                        placeholder="音乐风格: pop, rock, electronic..."
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-[10px] text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-pink-300 dark:focus:border-pink-500 transition-colors"
                    />
                </div>
                <div className="flex flex-wrap gap-1 pl-4">
                    {MUSIC_STYLE_PRESETS.slice(0, 8).map(style => (
                        <button
                            key={style.value}
                            onClick={() => addStyleTag(style.value)}
                            className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-pink-300 dark:hover:border-pink-500 hover:text-pink-500 dark:hover:text-pink-400 transition-all"
                        >
                            {style.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 排除风格 */}
            <div className="flex items-center gap-1.5">
                <Sparkles size={10} className="text-slate-400 dark:text-slate-500 shrink-0" />
                <input
                    type="text"
                    value={config.negativeTags || ''}
                    onChange={(e) => onConfigChange({ ...config, negativeTags: e.target.value })}
                    onMouseDown={(e) => e.stopPropagation()}
                    placeholder="排除风格: sad, slow..."
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-[10px] text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-pink-300 dark:focus:border-pink-500 transition-colors"
                />
            </div>

            {/* 纯音乐 + 版本 */}
            <div className="flex items-center gap-4">
                <ToggleOption
                    label="纯音乐"
                    icon={<Music size={10} />}
                    checked={config.instrumental || false}
                    onChange={(checked) => onConfigChange({ ...config, instrumental: checked })}
                    description="无人声"
                />
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">版本</span>
                    <OptionButtonGroup
                        options={SUNO_VERSION_PRESETS.slice(0, 3).map(v => ({ value: v.value, label: v.label, desc: v.desc }))}
                        value={config.mv || 'chirp-v4'}
                        onChange={(value) => onConfigChange({ ...config, mv: value })}
                    />
                </div>
            </div>
        </div>
    );
};

/**
 * MiniMax 语音配置面板
 */
const MiniMaxConfigPanel: React.FC<{
    config: VoiceSynthesisConfig;
    onConfigChange: (config: VoiceSynthesisConfig) => void;
}> = ({ config, onConfigChange }) => {
    return (
        <div className="space-y-2">
            {/* 音色选择 */}
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 w-8 shrink-0">音色</span>
                <div className="flex flex-wrap gap-1 flex-1">
                    {VOICE_PRESETS.slice(0, 6).map((voice) => (
                        <button
                            key={voice.id}
                            className={`px-1.5 py-0.5 text-[9px] rounded border transition-all ${
                                config.voiceId === voice.id
                                    ? 'bg-pink-50 dark:bg-pink-900/30 border-pink-300 dark:border-pink-600 text-pink-600 dark:text-pink-400'
                                    : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-pink-200 dark:hover:border-pink-500'
                            }`}
                            onClick={() => onConfigChange({ ...config, voiceId: voice.id })}
                            title={voice.desc}
                        >
                            {voice.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 情感选择 */}
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 w-8 shrink-0">情感</span>
                <div className="flex flex-wrap gap-1 flex-1">
                    {EMOTION_PRESETS.map((emotion) => (
                        <button
                            key={emotion.value}
                            className={`px-1.5 py-0.5 text-[9px] rounded border transition-all ${
                                config.emotion === emotion.value
                                    ? 'bg-pink-50 dark:bg-pink-900/30 border-pink-300 dark:border-pink-600 text-pink-600 dark:text-pink-400'
                                    : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-pink-200 dark:hover:border-pink-500'
                            }`}
                            onClick={() => onConfigChange({ ...config, emotion: emotion.value as any })}
                            title={emotion.desc}
                        >
                            {emotion.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 语速 + 音效 */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 flex-1">
                    <Gauge size={10} className="text-slate-400 dark:text-slate-500" />
                    <span className="text-[9px] text-slate-500 dark:text-slate-400">语速</span>
                    <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={config.speed || 1}
                        onChange={(e) => onConfigChange({ ...config, speed: parseFloat(e.target.value) })}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="flex-1 h-1 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-pink-500"
                    />
                    <span className="text-[9px] text-slate-600 dark:text-slate-400 w-6">{config.speed || 1}x</span>
                </div>
            </div>

            {/* 音效选择 */}
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 w-8 shrink-0">音效</span>
                <div className="flex flex-wrap gap-1 flex-1">
                    {SOUND_EFFECT_PRESETS.map((effect) => (
                        <button
                            key={effect.value}
                            className={`px-1.5 py-0.5 text-[9px] rounded border transition-all ${
                                (config.voiceModify?.soundEffect || '') === effect.value
                                    ? 'bg-pink-50 dark:bg-pink-900/30 border-pink-300 dark:border-pink-600 text-pink-600 dark:text-pink-400'
                                    : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-pink-200 dark:hover:border-pink-500'
                            }`}
                            onClick={() => onConfigChange({
                                ...config,
                                voiceModify: { ...config.voiceModify, soundEffect: effect.value as any }
                            })}
                            title={effect.desc}
                        >
                            {effect.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

/**
 * 音频配置面板主组件
 * 根据 providerId 渲染对应厂商的配置选项
 */
export const AudioConfigPanel: React.FC<AudioConfigPanelProps> = ({
    providerId,
    config,
    onConfigChange,
}) => {
    switch (providerId) {
        case 'suno':
            return (
                <SunoConfigPanel
                    config={config as MusicGenerationConfig}
                    onConfigChange={onConfigChange}
                />
            );
        case 'minimax':
            return (
                <MiniMaxConfigPanel
                    config={config as VoiceSynthesisConfig}
                    onConfigChange={onConfigChange}
                />
            );
        default:
            return null;
    }
};

export default AudioConfigPanel;
