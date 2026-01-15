# 多人协作系统架构方案

## 概述

为 Studio 画布添加类 Figma 的多人实时协作能力。

## 前置依赖

```
┌─────────────────────────────────────┐
│  1. 用户系统 (Supabase Auth)        │  ← 必须先完成
│     - 登录/注册                      │
│     - 用户身份识别                   │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  2. 画布权限管理                     │  ← 依赖用户系统
│     - 画布归属                       │
│     - 分享/邀请机制                  │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  3. 多人协作                         │  ← 依赖权限管理
│     - 实时同步                       │
│     - 光标/在线状态                  │
└─────────────────────────────────────┘
```

**建议实施顺序**：用户系统 → 云端存储 → 权限管理 → 多人协作

## 技术选型

| 层级 | 方案 | 说明 |
|------|------|------|
| 用户管理 | Supabase Auth | 用户数据、画布元信息 |
| 媒体存储 | 腾讯云 COS | 图片/视频素材 |
| CRDT 引擎 | Yjs | 实时同步 |
| WebSocket | PartyKit | 协作通信 |

## 架构图

```
客户端 A ◄────┐              ┌────► 客户端 B
     │        │              │        │
     ▼        │              │        ▼
┌─────────────┴──────────────┴─────────────┐
│           WebSocket Server               │
│          (PartyKit + Yjs)                │
└────────────────────┬─────────────────────┘
                     │
                     ▼
          ┌─────────────────────┐
          │   Supabase 持久化   │
          └─────────────────────┘
```

## 当前架构瓶颈

1. **渲染层**：纯 DOM 渲染，200+ 节点卡顿
2. **状态层**：分散 Hooks，难以接入 CRDT
3. **存储层**：图片 Base64 内嵌，同步体积过大
4. **组件层**：StudioTab 3800 行，职责过重

## 优化方案

### P0 必须 - 状态管理重构

引入 Zustand 统一状态管理：

```typescript
// src/stores/canvasStore.ts
interface CanvasState {
  nodes: Map<string, AppNode>
  connections: Map<string, Connection>
  groups: Map<string, Group>
  viewport: { scale: number; pan: { x: number; y: number } }

  // 操作方法
  updateNode: (id: string, updates: Partial<AppNode>) => void
  batchUpdate: (updates: CanvasUpdate[]) => void

  // 订阅接口（供 Yjs 使用）
  subscribe: (listener: (updates: CanvasUpdate[]) => void) => () => void
}
```

工作量：4 天

### P0 必须 - 媒体资源分离

图片上传到腾讯云 COS，只同步 URL：

```typescript
// 改造前
data: { image: "base64..." }  // 5-10MB

// 改造后
data: { imageUrl: "https://xxx.cos.ap-xxx.myqcloud.com/..." }  // 仅 URL
```

```typescript
// src/services/cosStorage.ts
import COS from 'cos-js-sdk-v5'

const cos = new COS({
  getAuthorization: async (options, callback) => {
    // 从后端获取临时密钥
    const res = await fetch('/api/cos/sts')
    const data = await res.json()
    callback(data)
  }
})

export async function uploadMedia(file: File, canvasId: string) {
  const key = `canvas/${canvasId}/${crypto.randomUUID()}-${file.name}`

  return new Promise((resolve, reject) => {
    cos.uploadFile({
      Bucket: 'your-bucket',
      Region: 'ap-shanghai',
      Key: key,
      Body: file,
      onProgress: (info) => console.log(info.percent)
    }, (err, data) => {
      if (err) reject(err)
      else resolve(`https://${data.Location}`)
    })
  })
}
```

工作量：3 天

### P1 重要 - 数据模型改造

数组改 Map，扁平化嵌套结构：

```typescript
// 改造前
nodes: AppNode[]

// 改造后
nodes: Map<string, AppNode>
nodeConfigs: Map<string, NodeConfig>  // 复杂配置独立
```

工作量：3 天

### P2 推荐 - 渲染层优化

- 视口裁剪：只渲染可见节点
- 节点 memo：精确依赖比较
- 连接线分层：静态/动态分离

工作量：5 天

### P2 推荐 - 组件拆分

```
src/components/studio/
├── StudioTab.tsx           # 主容器 (~300行)
├── canvas/                 # 画布组件
├── nodes/                  # 节点组件
├── connections/            # 连接线组件
├── interactions/           # 交互组件
├── collaboration/          # 协作模块
└── panels/                 # 面板组件
```

工作量：7 天

## 协作核心实现

### Yjs 集成

```typescript
// src/lib/collaboration/yjs-provider.ts
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-partykit/provider'

export function createCollaborationProvider(canvasId: string) {
  const ydoc = new Y.Doc()
  const yNodes = ydoc.getMap('nodes')
  const yConnections = ydoc.getMap('connections')

  const provider = new WebsocketProvider(
    'wss://your-project.partykit.dev',
    `canvas-${canvasId}`,
    ydoc
  )

  return { ydoc, yNodes, yConnections, provider }
}
```

### 光标同步

```typescript
// src/hooks/canvas/useCollaboration.ts
export function useCollaboration(provider: WebsocketProvider) {
  const [users, setUsers] = useState<Map<number, UserPresence>>(new Map())

  const updateCursor = useCallback((x: number, y: number) => {
    provider.awareness.setLocalStateField('cursor', { x, y })
  }, [provider])

  return { users, updateCursor }
}
```

## 性能预估

| 场景 | 同步延迟 | FPS | 体验 |
|------|----------|-----|------|
| 2-3人 + 50节点 | 50-80ms | 60 | ⭐⭐⭐⭐⭐ |
| 5-8人 + 100节点 | 80-120ms | 55 | ⭐⭐⭐⭐ |
| 10-15人 + 200节点 | 120-200ms | 45 | ⭐⭐⭐ |

## 推荐配置阈值

- 同时在线协作者：8-10 人
- 单画布节点数：150-200
- 单节点图片大小：2MB
- 画布总资源：50MB

## 实施路线

```
前置阶段：用户系统 ──────────────────────────
│
├─ Supabase Auth 集成
├─ 登录/注册/用户信息
└─ 画布归属绑定
     ↓
第一阶段 (7天)：状态管理 + 媒体分离 ─────────
│
├─ Zustand 状态重构
└─ 腾讯云 COS 媒体上传
     ↓
第二阶段 (7天)：Yjs + PartyKit + 数据模型 ───
│
├─ 实时同步基础
└─ 权限校验
     ↓
第三阶段 (5天)：光标同步 + 渲染优化 ─────────
│
├─ 协作者光标
└─ 在线状态
     ↓
第四阶段 (7天+)：组件拆分 + 深度优化 ────────
```

## 依赖清单

```bash
# 状态管理
bun add zustand immer

# 实时协作 (用户系统完成后)
bun add yjs y-partykit y-protocols

# 腾讯云 COS
bun add cos-js-sdk-v5

# Supabase (用户系统)
bun add @supabase/supabase-js
```

## 存储架构

```
┌─────────────────────────────────────────────────────────┐
│                     存储分层                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Supabase (用户数据 + 元信息)                           │
│  ├─ users          用户信息                             │
│  ├─ canvases       画布元信息 (标题、权限、Yjs状态)      │
│  └─ collaborators  协作者关系                           │
│                                                         │
│  腾讯云 COS (媒体素材)                                   │
│  └─ canvas/{canvasId}/{fileId}  图片/视频/音频          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 数据库表 (Supabase)

```sql
-- 画布表
CREATE TABLE canvases (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  yjs_state BYTEA,           -- 协作状态
  thumbnail_url TEXT,        -- 缩略图 (COS)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 协作者表
CREATE TABLE canvas_collaborators (
  canvas_id UUID REFERENCES canvases(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT CHECK (role IN ('owner', 'editor', 'viewer')),
  PRIMARY KEY (canvas_id, user_id)
);

-- 媒体引用表 (可选，用于清理孤立文件)
CREATE TABLE media_refs (
  id UUID PRIMARY KEY,
  canvas_id UUID REFERENCES canvases(id) ON DELETE CASCADE,
  cos_key TEXT NOT NULL,     -- COS 文件路径
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
