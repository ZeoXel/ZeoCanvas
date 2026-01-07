/**
 * Cape 服务客户端
 * 统一封装所有 Cape API 调用
 */

class CapeService {
    constructor(baseUrl = '/api/cape') {
        this.baseUrl = baseUrl;
        this.sessionId = null;
        this._capesCache = null;
        this._packsCache = null;
        this._cacheTime = 0;
        this._cacheTTL = 60000; // 1分钟缓存
    }

    /**
     * 发送聊天消息 (SSE 流式)
     */
    async chat(message, options = {}) {
        const response = await fetch(`${this.baseUrl}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                sessionId: options.sessionId || this.sessionId,
                model: options.model || 'claude-sonnet-4-20250514',
                fileIds: options.fileIds || [],
            }),
        });

        if (!response.ok) {
            throw new Error(`Chat failed: ${response.status}`);
        }

        return response.body;
    }

    /**
     * 解析 SSE 流
     */
    async parseSSE(stream, handlers = {}) {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('event: ')) continue;
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const eventType = data.type || data.event || 'unknown';

                            if (eventType === 'session' && data.session_id) {
                                this.sessionId = data.session_id;
                            }

                            if (handlers[eventType]) {
                                handlers[eventType](data);
                            }
                            if (handlers.onAny) {
                                handlers.onAny(eventType, data);
                            }
                        } catch (e) {
                            // ignore
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * 获取能力列表
     */
    async getCapes(forceRefresh = false) {
        if (!forceRefresh && this._capesCache && Date.now() - this._cacheTime < this._cacheTTL) {
            return this._capesCache;
        }

        const res = await fetch(`${this.baseUrl}/capes`);
        if (!res.ok) throw new Error(`Failed to get capes: ${res.status}`);

        const data = await res.json();
        this._capesCache = data;
        this._cacheTime = Date.now();
        return data;
    }

    /**
     * 获取 Packs 列表
     */
    async getPacks(forceRefresh = false) {
        if (!forceRefresh && this._packsCache && Date.now() - this._cacheTime < this._cacheTTL) {
            return this._packsCache;
        }

        const res = await fetch(`${this.baseUrl}/packs`);
        if (!res.ok) throw new Error(`Failed to get packs: ${res.status}`);

        const data = await res.json();
        this._packsCache = data;
        return data;
    }

    /**
     * 获取 Pack 详情 (含 capes)
     */
    async getPackDetail(packName) {
        const res = await fetch(`${this.baseUrl}/packs/${packName}`);
        if (!res.ok) throw new Error(`Failed to get pack: ${res.status}`);
        return res.json();
    }

    /**
     * 匹配能力
     */
    async matchCapes(query) {
        const res = await fetch(`${this.baseUrl}/capes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        });
        if (!res.ok) throw new Error(`Failed to match capes: ${res.status}`);
        return res.json();
    }

    /**
     * 上传文件
     */
    async uploadFiles(files, sessionId) {
        const formData = new FormData();
        for (const file of files) {
            formData.append('files', file);
        }
        if (sessionId || this.sessionId) {
            formData.append('session_id', sessionId || this.sessionId);
        }

        const res = await fetch(`${this.baseUrl}/files/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        return res.json();
    }

    /**
     * 获取文件下载 URL
     */
    getFileUrl(fileId) {
        return `${this.baseUrl}/files/${fileId}`;
    }

    /**
     * 删除文件
     */
    async deleteFile(fileId) {
        const res = await fetch(`${this.baseUrl}/files/${fileId}`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
        return res.json();
    }

    /**
     * 健康检查
     */
    async health() {
        const res = await fetch(`${this.baseUrl}/health`);
        return res.json();
    }

    /**
     * 重置会话
     */
    resetSession() {
        this.sessionId = null;
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this._capesCache = null;
        this._packsCache = null;
        this._cacheTime = 0;
    }
}

export const capeService = new CapeService();
export default capeService;
