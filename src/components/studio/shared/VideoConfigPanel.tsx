"use client";

/**
 * 视频生成厂商扩展配置面板
 *
 * 根据不同厂商提供专属的参数配置选项：
 * - Vidu Q2: 运动幅度(图生/首尾帧)、背景音乐、音视频直出(图生)
 * - Seedance: 有声视频、固定镜头、返回尾帧、水印、服务等级、种子
 * - Veo: 增强提示词
 *
 * 注：Q2 系列不支持 style 参数
 */

import React from 'react';
import { Zap, Music2, Mic2, RotateCcw, Sparkles, Volume2 } from 'lucide-react';

// 运动幅度选项 (Q2 Pro/Turbo/Pro-Fast 支持，Q2 基础款不生效)
export const MOVEMENT_AMPLITUDE_OPTIONS = [
    { value: 'auto', label: '自动', desc: '系统自动判断' },
    { value: 'small', label: '小', desc: '微小运动' },
    { value: 'medium', label: '中', desc: '适中运动' },
    { value: 'large', label: '大', desc: '大幅运动' },
] as const;

export type MovementAmplitude = typeof MOVEMENT_AMPLITUDE_OPTIONS[number]['value'];

export interface ViduConfig {
    movement_amplitude?: MovementAmplitude;  // 图生/首尾帧支持
    bgm?: boolean;                           // 首尾帧/文生支持
    audio?: boolean;                         // 图生视频-音视频直出
    voice_id?: string;                       // 音色 (audio=true 时)
}

export interface SeedanceConfig {
    return_last_frame?: boolean;    // 返回尾帧 (用于连续视频生成)
    generate_audio?: boolean;       // 生成有声视频 (仅 1.5 pro)
    camera_fixed?: boolean;         // 固定摄像头
    watermark?: boolean;            // 水印
    service_tier?: 'default' | 'flex';  // 服务等级 (flex 价格50%但延迟高)
    seed?: number;                  // 随机种子
}

export interface VeoConfig {
    enhance_prompt?: boolean;
}

// Vidu 生成模式
export type ViduGenerationMode = 'text2video' | 'img2video' | 'start-end';

export interface VideoConfigPanelProps {
    /** 厂商 ID */
    providerId: string;
    /** 当前配置 */
    config: ViduConfig | SeedanceConfig | VeoConfig;
    /** 配置更新回调 */
    onConfigChange: (config: any) => void;
    /** Vidu 生成模式 (文生/图生/首尾帧) */
    viduMode?: ViduGenerationMode;
}

/**
 * 选项按钮组
 */
const OptionButtonGroup: React.FC<{
    label: string;
    icon?: React.ReactNode;
    options: readonly { value: string; label: string; desc?: string }[];
    value: string;
    onChange: (value: string) => void;
}> = ({ label, icon, options, value, onChange }) => (
    <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 w-14 shrink-0">
            {icon}
            <span>{label}</span>
        </div>
        <div className="flex flex-wrap gap-1">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    className={`px-2 py-1 text-[9px] rounded-lg border transition-all ${
                        value === opt.value
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400'
                            : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-blue-200 dark:hover:border-blue-500'
                    }`}
                    onClick={() => onChange(opt.value)}
                    title={opt.desc}
                >
                    {opt.label}
                </button>
            ))}
        </div>
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
                checked ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
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
 * Vidu 配置面板
 *
 * 根据生成模式显示不同配置：
 * - 文生视频: bgm (movement_amplitude Q2不生效)
 * - 图生视频: movement_amplitude, audio
 * - 首尾帧: movement_amplitude, bgm
 */
const ViduConfigPanel: React.FC<{
    config: ViduConfig;
    onConfigChange: (config: ViduConfig) => void;
    mode?: ViduGenerationMode;
}> = ({ config, onConfigChange, mode = 'text2video' }) => {
    // 文生视频: Q2 不支持 movement_amplitude
    const showMovement = mode === 'img2video' || mode === 'start-end';
    // bgm: 文生视频和首尾帧支持
    const showBgm = mode === 'text2video' || mode === 'start-end';
    // audio: 仅图生视频支持
    const showAudio = mode === 'img2video';

    return (
        <div className="space-y-2">
            {/* 运动幅度 - 图生/首尾帧 */}
            {showMovement && (
                <OptionButtonGroup
                    label="运动"
                    icon={<Zap size={10} />}
                    options={MOVEMENT_AMPLITUDE_OPTIONS}
                    value={config.movement_amplitude || 'auto'}
                    onChange={(value) => onConfigChange({ ...config, movement_amplitude: value as MovementAmplitude })}
                />
            )}

            {/* 开关选项 */}
            <div className="flex flex-wrap gap-4">
                {/* bgm - 文生/首尾帧 */}
                {showBgm && (
                    <ToggleOption
                        label="背景音乐"
                        icon={<Music2 size={10} />}
                        checked={config.bgm || false}
                        onChange={(checked) => onConfigChange({ ...config, bgm: checked })}
                    />
                )}
                {/* audio - 仅图生视频 */}
                {showAudio && (
                    <ToggleOption
                        label="音视频直出"
                        icon={<Mic2 size={10} />}
                        checked={config.audio || false}
                        onChange={(checked) => onConfigChange({ ...config, audio: checked })}
                        description="含台词与音效"
                    />
                )}
            </div>
        </div>
    );
};

// Seedance 服务等级选项
const SERVICE_TIER_OPTIONS = [
    { value: 'default', label: '在线', desc: '实时推理' },
    { value: 'flex', label: '离线', desc: '价格50%，延迟高' },
] as const;

/**
 * Seedance 配置面板
 */
const SeedanceConfigPanel: React.FC<{
    config: SeedanceConfig;
    onConfigChange: (config: SeedanceConfig) => void;
}> = ({ config, onConfigChange }) => {
    return (
        <div className="space-y-2">
            {/* 服务等级 */}
            <OptionButtonGroup
                label="模式"
                icon={<Zap size={10} />}
                options={SERVICE_TIER_OPTIONS}
                value={config.service_tier || 'default'}
                onChange={(value) => onConfigChange({ ...config, service_tier: value as 'default' | 'flex' })}
            />

            {/* 开关选项 */}
            <div className="flex flex-wrap gap-4">
                <ToggleOption
                    label="有声视频"
                    icon={<Volume2 size={10} />}
                    checked={config.generate_audio !== false}
                    onChange={(checked) => onConfigChange({ ...config, generate_audio: checked })}
                    description="1.5 pro"
                />
                <ToggleOption
                    label="固定镜头"
                    icon={<RotateCcw size={10} />}
                    checked={config.camera_fixed || false}
                    onChange={(checked) => onConfigChange({ ...config, camera_fixed: checked })}
                />
            </div>

            <div className="flex flex-wrap gap-4">
                <ToggleOption
                    label="返回尾帧"
                    icon={<RotateCcw size={10} />}
                    checked={config.return_last_frame || false}
                    onChange={(checked) => onConfigChange({ ...config, return_last_frame: checked })}
                    description="连续视频"
                />
                <ToggleOption
                    label="水印"
                    icon={<Sparkles size={10} />}
                    checked={config.watermark || false}
                    onChange={(checked) => onConfigChange({ ...config, watermark: checked })}
                />
            </div>

            {/* 随机种子 */}
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 w-14 shrink-0">
                    <span>种子</span>
                </div>
                <input
                    type="number"
                    placeholder="-1 随机"
                    value={config.seed ?? ''}
                    onChange={(e) => onConfigChange({ ...config, seed: e.target.value ? parseInt(e.target.value) : undefined })}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="flex-1 max-w-[100px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-[10px] text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-300 dark:focus:border-blue-500 transition-colors"
                />
            </div>
        </div>
    );
};

/**
 * Veo 配置面板
 */
const VeoConfigPanel: React.FC<{
    config: VeoConfig;
    onConfigChange: (config: VeoConfig) => void;
}> = ({ config, onConfigChange }) => {
    return (
        <div className="space-y-2">
            <ToggleOption
                label="增强提示词"
                icon={<Sparkles size={10} />}
                checked={config.enhance_prompt || false}
                onChange={(checked) => onConfigChange({ ...config, enhance_prompt: checked })}
                description="AI 优化提示词"
            />
        </div>
    );
};

/**
 * 视频配置面板主组件
 * 根据 providerId 渲染对应厂商的配置选项
 */
export const VideoConfigPanel: React.FC<VideoConfigPanelProps> = ({
    providerId,
    config,
    onConfigChange,
    viduMode,
}) => {
    switch (providerId) {
        case 'vidu':
            return (
                <ViduConfigPanel
                    config={config as ViduConfig}
                    onConfigChange={onConfigChange}
                    mode={viduMode}
                />
            );
        case 'seedance':
            return (
                <SeedanceConfigPanel
                    config={config as SeedanceConfig}
                    onConfigChange={onConfigChange}
                />
            );
        case 'veo':
            return (
                <VeoConfigPanel
                    config={config as VeoConfig}
                    onConfigChange={onConfigChange}
                />
            );
        default:
            return null;
    }
};

export default VideoConfigPanel;
