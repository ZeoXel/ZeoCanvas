"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, Eraser, Copy, CornerDownLeft, Sparkles, Paperclip, FileText, Download } from 'lucide-react';
import Button from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Input';
import { LoadingBubble, Spinner } from '@/components/ui/Loading';
import { capeService } from '@/services/capeService';

// 文件信息类型
interface FileInfo {
    file_id: string;
    original_name: string;
    content_type?: string;
    size_bytes?: number;
}

// 消息类型
interface Message {
    role: 'user' | 'model';
    text: string;
    files?: FileInfo[];
}

// 组件属性
interface ChatWindowProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ isOpen, onClose }) => {
    // 状态
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', text: '你好！我是 Cape AI 助手，可以帮你处理文档、分析数据、生成内容。\n\n支持的能力：\n- Excel/Word/PPT/PDF 处理\n- 数据分析与可视化\n- 内容创作与优化' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('思考中');
    const [uploadedFiles, setUploadedFiles] = useState<FileInfo[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    // Refs
    const chatEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 自动滚动到底部
    useEffect(() => {
        if (isOpen) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading, isOpen]);

    // 发送消息
    const handleSend = useCallback(async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        const fileIds = uploadedFiles.map(f => f.file_id);

        // 添加用户消息
        setMessages(prev => [...prev, {
            role: 'user',
            text: userMessage,
            files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined
        }]);

        setInput('');
        setUploadedFiles([]);
        setIsLoading(true);
        setLoadingText('思考中');

        try {
            const stream = await capeService.chat(userMessage, { fileIds });

            let assistantText = '';
            let receivedFiles: FileInfo[] = [];

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await capeService.parseSSE(stream, {
                session: (_data: any) => {
                    // 会话已在 capeService 内部处理
                },
                cape_start: (data: any) => {
                    setLoadingText(`执行 ${data.cape_name || '能力'}...`);
                },
                cape_match: (data: any) => {
                    setLoadingText(`匹配到 ${data.cape_id || '能力'}`);
                },
                content: (data: any) => {
                    assistantText += data.text || '';
                    // 实时更新消息
                    setMessages(prev => {
                        const updated = [...prev];
                        const lastIdx = updated.length - 1;
                        if (lastIdx >= 0 && updated[lastIdx].role === 'model' && !updated[lastIdx].files) {
                            updated[lastIdx] = { ...updated[lastIdx], text: assistantText };
                        } else {
                            updated.push({ role: 'model', text: assistantText });
                        }
                        return updated;
                    });
                },
                cape_end: (data: any) => {
                    // 收集输出文件
                    if (data.output_files?.length) {
                        receivedFiles.push(...data.output_files);
                    }
                    setLoadingText('生成回复中');
                },
                done: () => {
                    // 如果有文件，更新最后一条消息
                    if (receivedFiles.length > 0) {
                        setMessages(prev => {
                            const updated = [...prev];
                            const lastIdx = updated.length - 1;
                            if (lastIdx >= 0 && updated[lastIdx].role === 'model') {
                                updated[lastIdx] = {
                                    ...updated[lastIdx],
                                    files: receivedFiles
                                };
                            }
                            return updated;
                        });
                    }
                    setIsLoading(false);
                },
                error: (data: any) => {
                    setMessages(prev => [...prev, {
                        role: 'model',
                        text: `错误: ${data.message || '未知错误'}`
                    }]);
                    setIsLoading(false);
                }
            });
        } catch (error: any) {
            console.error('[ChatWindow] Error:', error);
            setMessages(prev => [...prev, {
                role: 'model',
                text: `连接错误: ${error.message}`
            }]);
            setIsLoading(false);
        }
    }, [input, isLoading, uploadedFiles]);

    // 文件上传
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files?.length) return;

        setIsUploading(true);
        try {
            const result = await capeService.uploadFiles(Array.from(files));
            if (result.files?.length) {
                setUploadedFiles(prev => [...prev, ...result.files]);
            }
        } catch (error: any) {
            console.error('[ChatWindow] Upload error:', error);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // 移除已上传文件
    const removeFile = (fileId: string) => {
        setUploadedFiles(prev => prev.filter(f => f.file_id !== fileId));
    };

    // 清空对话
    const handleClear = () => {
        setMessages([{
            role: 'model',
            text: '对话已清空。有什么可以帮你的？'
        }]);
        capeService.resetSession();
    };

    // 复制文本
    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    // 渲染格式化消息
    const renderFormattedMessage = (text: string) => {
        const lines = text.split('\n');
        const elements: React.ReactNode[] = [];

        lines.forEach((line, index) => {
            const key = `line-${index}`;
            const trimmed = line.trim();

            if (!trimmed) {
                elements.push(<div key={key} className="h-2" />);
                return;
            }

            // H1
            if (line.startsWith('# ')) {
                elements.push(
                    <h1 key={key} className="text-base font-bold text-slate-800 mt-4 mb-2 border-b border-slate-200 pb-1">
                        {line.replace(/^#\s/, '')}
                    </h1>
                );
                return;
            }

            // H2
            if (line.startsWith('## ')) {
                elements.push(
                    <h2 key={key} className="text-sm font-bold text-slate-700 mt-3 mb-1.5 flex items-center gap-2">
                        <span className="w-1 h-3.5 bg-blue-500 rounded-full" />
                        {line.replace(/^##\s/, '')}
                    </h2>
                );
                return;
            }

            // List Items
            if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                const content = trimmed.replace(/^[\*\-]\s/, '');
                elements.push(
                    <div key={key} className="flex gap-2 ml-1 mb-1 items-start">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-[6px] shrink-0" />
                        <span className="text-[13px] leading-relaxed text-slate-600">{content}</span>
                    </div>
                );
                return;
            }

            // Normal text
            elements.push(
                <p key={key} className="text-[13px] leading-relaxed text-slate-600 mb-1">
                    {line}
                </p>
            );
        });

        return <div className="space-y-0.5">{elements}</div>;
    };

    // 渲染文件附件
    const renderFiles = (files: FileInfo[], isDownload: boolean = false) => (
        <div className="flex flex-wrap gap-1.5 mt-2">
            {files.map(file => (
                isDownload ? (
                    <a
                        key={file.file_id}
                        href={capeService.getFileUrl(file.file_id)}
                        download={file.original_name}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-xs text-blue-600 transition-colors"
                    >
                        <Download size={12} />
                        <span className="max-w-[120px] truncate">{file.original_name}</span>
                    </a>
                ) : (
                    <div
                        key={file.file_id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg text-xs text-slate-600"
                    >
                        <FileText size={12} />
                        <span className="max-w-[100px] truncate">{file.original_name}</span>
                    </div>
                )
            ))}
        </div>
    );

    // 动画类
    const SPRING_ANIMATION = "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]";

    return (
        <div
            className={`fixed right-6 top-1/2 -translate-y-1/2 h-[85vh] w-[420px] bg-white/95 backdrop-blur-3xl rounded-[24px] border border-slate-200 shadow-2xl z-40 flex flex-col overflow-hidden ${SPRING_ANIMATION} ${isOpen ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-10 scale-95 pointer-events-none'}`}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" shape="circle" onClick={onClose} icon={<X size={14} />} />
                    <Button variant="danger" size="sm" shape="circle" onClick={handleClear} icon={<Eraser size={14} />} title="清空对话" />
                </div>
                <div className="flex items-center gap-2.5">
                    <div className="flex flex-col items-end">
                        <span className="text-xs font-bold text-slate-700">Cape AI</span>
                        <span className="text-[10px] text-slate-400">文档处理 & 内容创作</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500/20 to-cyan-500/20 flex items-center justify-center border border-slate-200">
                        <Sparkles size={14} className="text-blue-500" />
                    </div>
                </div>
            </div>

            {/* Chat Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/30">
                {messages.map((m, i) => (
                    <div key={i} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex flex-col max-w-[90%] gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                            {/* Role Label */}
                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider px-1">
                                {m.role === 'user' ? 'You' : 'Cape AI'}
                            </span>

                            {/* Message Bubble */}
                            <div className="group relative">
                                <div className={`px-4 py-3 rounded-2xl shadow-sm border select-text ${
                                    m.role === 'user'
                                        ? 'bg-white border-slate-200 rounded-tr-sm'
                                        : 'bg-white border-slate-100 rounded-tl-sm'
                                }`}>
                                    {m.role === 'model' ? renderFormattedMessage(m.text) : (
                                        <p className="text-[13px] leading-relaxed text-slate-700">{m.text}</p>
                                    )}
                                    {/* 用户上传的文件 */}
                                    {m.role === 'user' && m.files && renderFiles(m.files, false)}
                                    {/* AI 输出的文件 (可下载) */}
                                    {m.role === 'model' && m.files && renderFiles(m.files, true)}
                                </div>

                                {/* Copy Button */}
                                <button
                                    onClick={() => handleCopy(m.text, i)}
                                    className={`absolute top-2 ${m.role === 'user' ? '-left-7' : '-right-7'} p-1 rounded-full bg-white border border-slate-200 text-slate-400 opacity-0 group-hover:opacity-100 transition-all hover:text-slate-600 hover:scale-110`}
                                >
                                    {copiedIndex === i ? <span className="text-[9px] text-green-500">✓</span> : <Copy size={10} />}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Loading State */}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="flex flex-col gap-1 items-start">
                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider px-1">Cape AI</span>
                            <LoadingBubble text={loadingText} />
                        </div>
                    </div>
                )}

                <div ref={chatEndRef} />
            </div>

            {/* 已上传文件预览 */}
            {uploadedFiles.length > 0 && (
                <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 flex flex-wrap gap-1.5">
                    {uploadedFiles.map(file => (
                        <div key={file.file_id} className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded text-xs text-blue-600">
                            <FileText size={10} />
                            <span className="max-w-[80px] truncate">{file.original_name}</span>
                            <button onClick={() => removeFile(file.file_id)} className="hover:text-red-500">
                                <X size={10} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                <div className="flex items-end gap-2">
                    {/* 文件上传按钮 */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt"
                        onChange={handleFileUpload}
                    />
                    <Button
                        variant="ghost"
                        size="sm"
                        shape="circle"
                        disabled={isUploading}
                        loading={isUploading}
                        onClick={() => fileInputRef.current?.click()}
                        icon={<Paperclip size={16} />}
                        title="上传文件"
                    />

                    {/* 输入框 */}
                    <div className="flex-1 relative">
                        <TextArea
                            variant="glass"
                            value={input}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
                            onKeyDown={(e: React.KeyboardEvent) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="输入消息，Shift+Enter 换行..."
                            minRows={1}
                            maxRows={4}
                            disabled={isLoading}
                        />
                    </div>

                    {/* 发送按钮 */}
                    <Button
                        variant="primary"
                        size="sm"
                        shape="circle"
                        disabled={!input.trim() || isLoading}
                        loading={isLoading}
                        onClick={handleSend}
                        icon={<CornerDownLeft size={16} />}
                    />
                </div>
            </div>
        </div>
    );
};

export default ChatWindow;
