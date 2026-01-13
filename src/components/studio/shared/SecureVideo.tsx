"use client";

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

// Helper: Check if URL needs proxy (Volcengine, Vidu S3, etc.)
export const isVolcengineUrl = (url: string): boolean => {
    if (!url || !url.startsWith('http')) return false;
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        return hostname.includes('tos-cn-beijing.volces.com') ||
               hostname.includes('volccdn.com') ||
               hostname.includes('bytecdn.cn') ||
               hostname.includes('volces.com') ||
               hostname.includes('prod-ss-vidu') ||  // Vidu S3 storage
               hostname.includes('amazonaws.com.cn'); // AWS China S3
    } catch {
        return false;
    }
};

// Helper: Get proxied URL for Volcengine
export const getProxiedUrl = (url: string): string => {
    if (isVolcengineUrl(url)) {
        return `/api/studio/proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
};

// 全局视频 blob URL 缓存 - SecureVideo 加载后存入，ImageCropper 可直接使用
export const globalVideoBlobCache = new Map<string, string>();

export interface SecureVideoProps {
    src?: string;
    className?: string;
    autoPlay?: boolean;
    muted?: boolean;
    loop?: boolean;
    controls?: boolean;
    onMouseEnter?: React.MouseEventHandler<HTMLVideoElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLVideoElement>;
    onClick?: React.MouseEventHandler<HTMLVideoElement>;
    onContextMenu?: React.MouseEventHandler<HTMLVideoElement>;
    videoRef?: React.Ref<HTMLVideoElement> | React.RefObject<HTMLVideoElement | HTMLImageElement | HTMLAudioElement | null>;
    style?: React.CSSProperties;
}

/**
 * SecureVideo - Fetches video as blob to bypass auth/cors issues with <video src>
 * Volcengine URLs are routed through proxy API to avoid CORS
 */
export const SecureVideo: React.FC<SecureVideoProps> = ({
    src,
    className,
    autoPlay,
    muted,
    loop,
    onMouseEnter,
    onMouseLeave,
    onClick,
    onContextMenu,
    controls,
    videoRef,
    style
}) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!src) return;
        if (src.startsWith('data:') || src.startsWith('blob:')) {
            setBlobUrl(src);
            return;
        }

        // 检查全局缓存 - 避免重复加载
        const cached = globalVideoBlobCache.get(src);
        if (cached) {
            setBlobUrl(cached);
            return;
        }

        let active = true;
        // Use proxy for Volcengine URLs to bypass CORS
        const fetchUrl = getProxiedUrl(src);

        // Fetch the video content
        fetch(fetchUrl)
            .then(response => {
                if (!response.ok) throw new Error("Video fetch failed");
                return response.blob();
            })
            .then(blob => {
                if (active) {
                    // FORCE MIME TYPE TO VIDEO/MP4 to fix black screen issues with generic binary blobs
                    const mp4Blob = new Blob([blob], { type: 'video/mp4' });
                    const url = URL.createObjectURL(mp4Blob);
                    // 存入全局缓存
                    globalVideoBlobCache.set(src, url);
                    setBlobUrl(url);
                }
            })
            .catch(err => {
                console.error("SecureVideo load error:", err);
                if (active) setError(true);
            });

        return () => {
            active = false;
            // 不再 revoke，因为已存入全局缓存供其他组件使用
        };
    }, [src]);

    if (error) {
        return <div className={`flex items-center justify-center bg-rose-50 text-xs text-rose-500 ${className}`}>Load Error</div>;
    }

    if (!blobUrl) {
        return <div className={`flex items-center justify-center bg-slate-100 ${className}`}><Loader2 className="animate-spin text-slate-400" /></div>;
    }

    return (
        <video
            ref={videoRef as React.Ref<HTMLVideoElement>}
            src={blobUrl}
            className={className}
            autoPlay={autoPlay}
            muted={muted}
            loop={loop}
            controls={controls}
            playsInline
            preload="auto"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={onClick}
            onContextMenu={onContextMenu}
            style={{ backgroundColor: '#f8fafc', ...style }}
        />
    );
};

// Helper for safe video playback
export const safePlay = (e: React.SyntheticEvent<HTMLVideoElement> | HTMLVideoElement) => {
    const vid = (e as any).currentTarget || e;
    if (!vid) return;
    const p = vid.play();
    if (p !== undefined) {
        p.catch((error: any) => {
            // Ignore AbortError which happens when pausing immediately after playing
            if (error.name !== 'AbortError') {
                console.debug("Video play prevented:", error);
            }
        });
    }
};

export const safePause = (e: React.SyntheticEvent<HTMLVideoElement> | HTMLVideoElement) => {
    const vid = (e as any).currentTarget || e;
    if (vid) {
        vid.pause();
        vid.currentTime = 0; // Optional: reset to start
    }
};

export default SecureVideo;
