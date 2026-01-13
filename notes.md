# Notes: StudioTab.tsx 架构分析

## 一、现状分析

### 1.1 文件统计

| 类型 | 数量 | 示例 |
|------|------|------|
| **useState** | 45 | nodes, connections, groups, scale, pan, selectedNodeIds... |
| **useRef** | 22 | nodesRef, scaleRef, panRef, dragNodeRef, nodeRefsMap... |
| **useCallback** | 25 | handleGlobalMouseMove, handleNodeUpdate, addNode... |
| **useEffect** | 15 | 持久化、主题、键盘快捷键、滚轮事件... |

### 1.2 useState 详细分类

#### 全局应用状态 (5个)
```typescript
workflows: Workflow[]              // 工作流历史
assetHistory: any[]                // 资源历史记录
isChatOpen: boolean                // AI 助手面板开关
selectedWorkflowId: string | null  // 当前工作流
theme: 'light' | 'dark'            // 主题设置
```

#### 画布管理状态 (3个)
```typescript
canvases: Canvas[]                 // 多画布列表
currentCanvasId: string | null     // 当前画布 ID
isSettingsOpen: boolean            // 设置面板开关
```

#### 核心画布数据状态 (4个) ⭐ 高频更新
```typescript
nodes: AppNode[]                   // 节点数据
connections: Connection[]          // 连接线数据
groups: Group[]                    // 分组数据
clipboard: AppNode | null          // 复制粘贴缓冲区
```

#### 历史记录状态 (2个)
```typescript
history: any[]                     // 撤销堆栈
historyIndex: number               // 当前历史位置
```

#### 视口控制状态 (5个) ⭐ 高频更新
```typescript
scale: number                      // 缩放比例 (影响范围广)
pan: { x, y }                      // 平移偏移 (影响范围广)
isDraggingCanvas: boolean          // 画布拖拽中
lastMousePos: { x, y }             // 上一帧鼠标位置
mousePos: { x, y }                 // 当前鼠标位置
```

#### 交互/选择状态 (10个)
```typescript
selectedNodeIds: string[]                // 多选节点
selectedGroupIds: string[]               // 多选分组
draggingNodeId: string | null            // 正在拖拽的节点
draggingNodeParentGroupId: string | null // 节点所属分组
draggingGroup: any                       // 正在拖拽的分组
resizingGroupId: string | null           // 正在调整的分组
activeGroupNodeIds: string[]             // 分组内活跃节点
connectionStart: {...} | null            // 连接线开始点
selectionRect: any                       // 框选矩形
isSpacePressed: boolean                  // 空格键按下状态
```

#### 节点调整大小状态 (3个)
```typescript
resizingNodeId: string | null            // 正在调整的节点
initialSize: { width, height } | null    // 初始尺寸
resizeStartPos: { x, y } | null          // 调整开始位置
```

#### 上下文菜单状态 (2个)
```typescript
contextMenu: ContextMenuState | null     // 菜单位置和内容
contextMenuTarget: any                   // 菜单目标对象
```

#### 媒体覆盖层状态 (5个)
```typescript
expandedMedia: any                       // 展开的媒体预览
editingImage: {...} | null               // 图像编辑状态
croppingNodeId: string | null            // 正在裁剪的节点
imageToCrop: string | null               // 待裁剪的图像
videoToCrop: string | null               // 待裁剪的视频
```

#### 拖拽预览状态 (2个)
```typescript
gridDragDropPreview: {...} | null        // 组图拖拽预览
copyDragPreview: { nodes: [] } | null    // 复制拖拽预览
```

### 1.3 useRef 详细分析

#### 数据同步 Refs (6个) - 关键依赖机制
```typescript
nodesRef = useRef(nodes);
connectionsRef = useRef(connections);
groupsRef = useRef(groups);
historyRef = useRef(history);
historyIndexRef = useRef(historyIndex);
connectionStartRef = useRef(connectionStart);

// 同步方式 (349行)：
useEffect(() => {
  nodesRef.current = nodes;
  connectionsRef.current = connections;
  // ... 其他同步
}, [nodes, connections, groups, history, historyIndex, connectionStart]);
```

#### UI DOM 引用 (4个) - 直接操作优化
```typescript
canvasContainerRef = useRef<HTMLDivElement>(null);
nodeRefsMap = useRef<Map<string, HTMLDivElement>>();   // 节点 DOM Map
groupRefsMap = useRef<Map<string, HTMLDivElement>>();  // 分组 DOM Map
connectionPathsRef = useRef<Map<string, SVGPathElement>>(); // 连接线 SVG Map
```

#### 交互上下文 Refs (5个) - 拖拽/调整数据缓存
```typescript
dragNodeRef = useRef<{
  id, startX, startY, mouseStartX, mouseStartY,
  nodeWidth, nodeHeight,
  otherSelectedNodes[], selectedGroups[],
  currentX, currentY, currentDx, currentDy,
  isCopyDrag
}>();

resizeContextRef = useRef<{
  nodeId, initialWidth, initialHeight, startX, startY
}>();

dragGroupRef = useRef<{
  id, startX, startY, mouseStartX, mouseStartY, childNodes[]
}>();

resizeGroupRef = useRef<{
  id, initialWidth, initialHeight, startX, startY,
  currentWidth, currentHeight
}>();
```

#### 性能优化 Refs (4个)
```typescript
rafRef = useRef<number | null>(null);     // RAF 节流
scaleRef = useRef(scale);                  // 缩放快速访问
panRef = useRef(pan);                      // 平移快速访问
dragPositionsRef = useRef<Map<...>>();    // 拖拽中节点实时位置
```

---

## 二、性能瓶颈分析

### 2.1 handleGlobalMouseMove (1053-1259行, 206行)

**依赖项 (13个)**:
```typescript
[selectionRect, isDraggingCanvas, draggingNodeId, resizingNodeId,
 resizingGroupId, initialSize, resizeStartPos, scale, lastMousePos,
 updateConnectionPaths, getNodeBounds, getPortCenter, ...]
```

**复杂度分析**:
```
行为 1: 框选更新 O(1)
行为 2: 分组拖拽 O(n) - n为分组内节点数
行为 3: 画布拖拽 O(1)
行为 4: 节点拖拽 + 吸附 O(n²) ⚠️ 最坏情况
行为 5: 节点调整尺寸 O(n)
行为 6: 分组调整尺寸 O(1)
```

**吸附检测代码 (1114-1131行)**:
```typescript
nodesRef.current.forEach(other => {
  if (draggingIds.has(other.id)) return;
  // 5 次边界检查
  if (Math.abs(myL - otherBounds.x) < SNAP) ...
  if (Math.abs(myL - otherBounds.r) < SNAP) ...
  // ...
});
```

### 2.2 事件监听器问题

```typescript
// effect #11 (1475行) - 频繁添加/移除监听
useEffect(() => {
  window.addEventListener('mousemove', handleGlobalMouseMove);
  window.addEventListener('mouseup', handleGlobalMouseUp);
  return () => {
    window.removeEventListener(...);
  };
}, [handleGlobalMouseMove, handleGlobalMouseUp]);
// ⚠️ 13 个依赖项 → 频繁重挂载
```

### 2.3 渲染触发路径

```
高频道→ mousePos (framerate limited by RAF)
          ↓
高频道→ nodes/connections (直接 DOM 操作避免重新渲染)
          ↓
中频道→ scale/pan (视口变化)
          ↓
低频道→ selectedNodeIds/selectedGroupIds (选择变化)
          ↓
极低频→ canvases/currentCanvasId (切换画布)
```

### 2.4 现有优化策略 (需保留)

**节点拖拽 - DOM 直接操作**:
```typescript
const mainEl = nodeRefsMap.current.get(draggingNodeId);
if (mainEl) {
  mainEl.style.transform = `translate(${proposedX}px, ${proposedY}px)`;
}
dragPositionsRef.current.set(draggingNodeId, { x: proposedX, y: proposedY });
// 不调用 setNodes，避免重渲染
```

**连接线 - SVG 直接操作**:
```typescript
const pathEl = connectionPathsRef.current.get(`${conn.from}-${conn.to}`);
pathEl.setAttribute('d', generateBezierPath(...));
```

---

## 三、Node.tsx 分析

### 3.1 文件概况
- 1971 行
- 自定义 memo 比较器 (68-86 行)

### 3.2 Props 接口
```typescript
interface NodeProps {
  node: AppNode;
  onUpdate: (id, data, size?, title?) => void;
  onAction: (id, prompt?) => void;
  onDelete: (id) => void;
  onExpand?: (data) => void;
  onEdit?: (nodeId, src, originalImage?, canvasData?) => void;
  onCrop?: (id, src, type?) => void;
  onPortMouseDown/Up: 连接器交互
  onNodeMouseDown: 拖拽
  onNodeContextMenu: 右键菜单
  onResizeMouseDown: 缩放
  onDragResultToCanvas?: 宫格拖拽
  isDragging?, isSelected?, zoom?...
}
```

### 3.3 自定义 memo 实现
```typescript
const arePropsEqual = (prev: NodeProps, next: NodeProps) => {
  // 优先检查动态状态
  if (prev.isDragging !== next.isDragging ||
      prev.isResizing !== next.isResizing ||
      prev.isSelected !== next.isSelected ||
      prev.zoom !== next.zoom) {
    return false;
  }

  // 检查节点数据变化
  if (prev.node !== next.node) return false;

  // 浅比较输入资产列表
  // ...
  return true;
};

export const Node = memo(NodeComponent, arePropsEqual);
```

---

## 四、Shared 模块现状

### 4.1 目录结构
```
/components/studio/shared/
├── index.ts           # 导出入口
├── types.ts          # 类型定义
├── constants.ts      # 常量配置
├── SecureVideo.tsx   # 视频组件 (167行)
├── AudioVisualizer.tsx    # 音频可视化 (25行)
└── InputThumbnails.tsx    # 输入资源缩略图 (129行)
```

### 4.2 types.ts 关键类型
```typescript
interface InputAsset {
  id: string;
  type: 'image' | 'video';
  src: string;
}

interface NodeProps { ... }      // 完整节点 Props
interface NodeContentProps { ... } // 内容渲染 Props
interface NodeConfig { ... }     // UI 配置
```

### 4.3 constants.ts 关键常量
```typescript
IMAGE_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9']
VIDEO_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9']
GLASS_PANEL = "bg-[#ffffff]/95 dark:bg-slate-900/95..."
DEFAULT_NODE_WIDTH = 420
DEFAULT_FIXED_HEIGHT = 360
```

---

## 五、状态合并方案

### 5.1 视口状态 (5→1)

**合并前**:
```typescript
const [scale, setScale] = useState(1);
const [pan, setPan] = useState({ x: 0, y: 0 });
const scaleRef = useRef(scale);
const panRef = useRef(pan);
const [lastMousePos, setLastMousePos] = useState({x:0, y:0});
```

**合并后**:
```typescript
interface ViewportState {
  scale: number;
  pan: { x: number; y: number };
}

function useViewport(initial = { scale: 1, pan: { x: 0, y: 0 } }) {
  const [viewport, setViewport] = useState<ViewportState>(initial);
  const viewportRef = useRef(viewport);

  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  const setScale = useCallback((scale: number) => {
    setViewport(v => ({ ...v, scale: Math.max(0.1, Math.min(2, scale)) }));
  }, []);

  const setPan = useCallback((pan) => {
    setViewport(v => ({ ...v, pan: typeof pan === 'function' ? pan(v.pan) : pan }));
  }, []);

  const screenToCanvas = useCallback((screenX, screenY, containerRect?) => {
    const { scale, pan } = viewportRef.current;
    const offsetX = containerRect ? screenX - containerRect.left : screenX;
    const offsetY = containerRect ? screenY - containerRect.top : screenY;
    return {
      x: (offsetX - pan.x) / scale,
      y: (offsetY - pan.y) / scale
    };
  }, []);

  return { viewport, viewportRef, setScale, setPan, screenToCanvas };
}
```

### 5.2 交互状态 (10→2)

**合并后**:
```typescript
type InteractionMode =
  | { type: 'idle' }
  | { type: 'selecting'; rect: SelectionRect }
  | { type: 'panning'; lastPos: { x: number; y: number } }
  | { type: 'dragging-node'; nodeId: string; context: DragNodeContext }
  | { type: 'dragging-group'; groupId: string; context: DragGroupContext }
  | { type: 'resizing-node'; nodeId: string; context: ResizeContext }
  | { type: 'resizing-group'; groupId: string; context: ResizeContext }
  | { type: 'connecting'; start: ConnectionStart };

interface SelectionState {
  nodeIds: string[];
  groupIds: string[];
}

function useInteraction() {
  const [mode, setMode] = useState<InteractionMode>({ type: 'idle' });
  const [selection, setSelection] = useState<SelectionState>({ nodeIds: [], groupIds: [] });
  const modeRef = useRef(mode);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  const startNodeDrag = useCallback((nodeId, context) => {
    setMode({ type: 'dragging-node', nodeId, context });
  }, []);

  const startCanvasPan = useCallback((lastPos) => {
    setMode({ type: 'panning', lastPos });
  }, []);

  const finishInteraction = useCallback(() => {
    setMode({ type: 'idle' });
  }, []);

  const selectNodes = useCallback((ids, additive = false) => {
    setSelection(s => ({
      ...s,
      nodeIds: additive ? [...new Set([...s.nodeIds, ...ids])] : ids
    }));
  }, []);

  return { mode, modeRef, selection, startNodeDrag, startCanvasPan, finishInteraction, selectNodes };
}
```

### 5.3 画布数据状态 (6→1)

**合并后**:
```typescript
interface CanvasDataState {
  nodes: AppNode[];
  connections: Connection[];
  groups: Group[];
}

function useCanvasData(initial: CanvasDataState) {
  const [data, setData] = useState<CanvasDataState>(initial);
  const dataRef = useRef(data);

  useEffect(() => { dataRef.current = data; }, [data]);

  const addNode = useCallback((node: AppNode) => {
    setData(d => ({ ...d, nodes: [...d.nodes, node] }));
  }, []);

  const updateNode = useCallback((id: string, updates: Partial<AppNode>) => {
    setData(d => ({
      ...d,
      nodes: d.nodes.map(n => n.id === id ? { ...n, ...updates } : n)
    }));
  }, []);

  const deleteNodes = useCallback((ids: string[]) => {
    setData(d => ({
      ...d,
      nodes: d.nodes.filter(n => !ids.includes(n.id)),
      connections: d.connections.filter(c => !ids.includes(c.from) && !ids.includes(c.to))
    }));
  }, []);

  const addConnection = useCallback((conn: Connection) => {
    setData(d => {
      const exists = d.connections.some(c => c.from === conn.from && c.to === conn.to);
      if (exists) return d;
      return { ...d, connections: [...d.connections, conn] };
    });
  }, []);

  return { data, dataRef, addNode, updateNode, deleteNodes, addConnection };
}
```

### 5.4 媒体覆盖层状态 (5→1)

**合并后**:
```typescript
type MediaOverlay =
  | { type: 'expand'; data: ExpandData }
  | { type: 'edit'; nodeId: string; src: string; originalImage?: string; canvasData?: string }
  | { type: 'crop'; nodeId: string; src: string; mediaType: 'image' | 'video' }
  | null;

const [mediaOverlay, setMediaOverlay] = useState<MediaOverlay>(null);
```

---

## 六、Hook 提取方案

### 6.1 目录结构
```
src/hooks/canvas/
├── useViewport.ts          # 视口控制
├── useCanvasData.ts        # 画布数据
├── useInteraction.ts       # 交互状态机
├── useMouseHandlers.ts     # 鼠标事件 (核心性能)
├── useSnapDetection.ts     # 吸附检测
├── useHistory.ts           # 撤销/重做
├── useCanvasPersistence.ts # 本地存储
└── index.ts                # 统一导出
```

### 6.2 useMouseHandlers (核心优化)

**目标**: 将 206 行拆分为模式分发器

```typescript
interface MouseHandlerDeps {
  viewport: ViewportState;
  interaction: InteractionMode;
  canvasData: CanvasDataState;
  domRefs: {
    nodeRefs: Map<string, HTMLDivElement>;
    groupRefs: Map<string, HTMLDivElement>;
    connectionPaths: Map<string, SVGPathElement>;
  };
}

function useMouseHandlers(deps: MouseHandlerDeps) {
  const { viewport, interaction, canvasData, domRefs } = deps;
  const dragPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // 各模式独立处理器
  const handlePanning = useCallback((e, lastPos) => { ... }, []);
  const handleNodeDrag = useCallback((e, context) => { ... }, []);
  const handleGroupDrag = useCallback((e, context) => { ... }, []);
  const handleNodeResize = useCallback((e, context) => { ... }, []);
  const handleConnecting = useCallback((e, start) => { ... }, []);
  const handleSelecting = useCallback((e, rect) => { ... }, []);

  // 主处理器 - 根据模式分发
  const handleMouseMove = useCallback((e: MouseEvent) => {
    switch (interaction.type) {
      case 'panning':
        return handlePanning(e, interaction.lastPos);
      case 'dragging-node':
        return handleNodeDrag(e, interaction.context);
      case 'dragging-group':
        return handleGroupDrag(e, interaction.context);
      case 'resizing-node':
        return handleNodeResize(e, interaction.context);
      case 'connecting':
        return handleConnecting(e, interaction.start);
      case 'selecting':
        return handleSelecting(e, interaction.rect);
    }
  }, [interaction]); // 依赖项从 13 个减少到 1 个

  return { handleMouseMove, dragPositionsRef };
}
```

### 6.3 useSnapDetection (空间分区优化)

```typescript
interface SpatialIndex {
  grid: Map<string, string[]>; // gridKey -> nodeIds
  cellSize: number;
}

function useSnapDetection(nodes: AppNode[]) {
  // 构建空间索引 (仅在 nodes 变化时)
  const spatialIndex = useMemo<SpatialIndex>(() => {
    const grid = new Map<string, string[]>();
    const cellSize = 200;

    nodes.forEach(node => {
      const bounds = getNodeBounds(node);
      const startCol = Math.floor(bounds.x / cellSize);
      const endCol = Math.floor((bounds.x + bounds.width) / cellSize);
      const startRow = Math.floor(bounds.y / cellSize);
      const endRow = Math.floor((bounds.y + bounds.height) / cellSize);

      for (let col = startCol; col <= endCol; col++) {
        for (let row = startRow; row <= endRow; row++) {
          const key = `${col}:${row}`;
          const list = grid.get(key) || [];
          list.push(node.id);
          grid.set(key, list);
        }
      }
    });

    return { grid, cellSize };
  }, [nodes]);

  // 快速查找附近节点 O(1)
  const getNearbyNodes = useCallback((x, y, radius) => {
    const { grid, cellSize } = spatialIndex;
    const nearby = new Set<string>();

    const startCol = Math.floor((x - radius) / cellSize);
    const endCol = Math.floor((x + radius) / cellSize);
    const startRow = Math.floor((y - radius) / cellSize);
    const endRow = Math.floor((y + radius) / cellSize);

    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        const list = grid.get(`${col}:${row}`) || [];
        list.forEach(id => nearby.add(id));
      }
    }

    return [...nearby].map(id => nodes.find(n => n.id === id)).filter(Boolean);
  }, [spatialIndex, nodes]);

  return { detectSnap, getNearbyNodes };
}
```

---

## 七、组件拆分方案

### 7.1 目录结构
```
src/components/studio/
├── StudioTab.tsx              # 主容器 (500行)
├── Canvas/
│   ├── CanvasContainer.tsx    # 画布容器
│   ├── CanvasGrid.tsx         # 背景网格
│   ├── SelectionRect.tsx      # 框选矩形
│   └── DragPreviews.tsx       # 拖拽预览
├── Connections/
│   ├── ConnectionsLayer.tsx   # 连接线 SVG 层
│   ├── ConnectionPath.tsx     # 单条连接线
│   └── ConnectionPreview.tsx  # 连接预览线
├── Groups/
│   ├── GroupsLayer.tsx        # 分组渲染层
│   └── GroupBox.tsx           # 单个分组框
├── ContextMenu/
│   └── ContextMenuManager.tsx # 右键菜单管理
└── Overlays/
    ├── ExpandedView.tsx       # 媒体放大预览
    └── EmptyState.tsx         # 空状态/欢迎页
```

### 7.2 重构后 StudioTab 骨架
```typescript
export default function StudioTab() {
  // === Hooks ===
  const { viewport, viewportRef, setScale, setPan, screenToCanvas } = useViewport();
  const { data, dataRef, addNode, updateNode, deleteNodes } = useCanvasData();
  const { mode, modeRef, selection, startNodeDrag, finishInteraction } = useInteraction();
  const { detectSnap } = useSnapDetection(data.nodes);
  const { handleMouseMove, handleMouseUp } = useMouseHandlers({ viewport, mode, data, domRefs });

  // === Refs ===
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const groupRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const connectionPathsRef = useRef<Map<string, SVGPathElement>>(new Map());

  // === Local State (UI-only) ===
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [mediaOverlay, setMediaOverlay] = useState<MediaOverlay>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // === Render ===
  return (
    <div className="w-screen h-screen overflow-hidden">
      <CanvasContainer viewport={viewport.viewport} containerRef={containerRef}>
        <GroupsLayer groups={data.groups} groupRefsMap={groupRefsMap} />
        <ConnectionsLayer connections={data.connections} connectionPathsRef={connectionPathsRef} />
        {data.nodes.map(node => (
          <Node key={node.id} node={node} isSelected={selection.nodeIds.includes(node.id)} />
        ))}
        {mode.type === 'selecting' && <SelectionRect rect={mode.rect} />}
      </CanvasContainer>

      {contextMenu && <ContextMenuManager {...contextMenuProps} />}
      {mediaOverlay && <MediaOverlays overlay={mediaOverlay} />}
      <SidebarDock {...sidebarProps} />
    </div>
  );
}
```

---

## 八、性能优化方案

### 8.1 事件监听器优化

**问题**: handleGlobalMouseMove 有 13 个依赖项

**解决方案**: 使用 ref 存储最新处理器
```typescript
const handlerRef = useRef(handleGlobalMouseMove);
useEffect(() => { handlerRef.current = handleGlobalMouseMove; });

useEffect(() => {
  const handler = (e) => handlerRef.current(e);
  window.addEventListener('mousemove', handler);
  return () => window.removeEventListener('mousemove', handler);
}, []); // 只挂载一次
```

### 8.2 存储防抖

```typescript
// 当前 (451行) - 每次变化都保存
useEffect(() => {
  saveToStorage('assets', assetHistory);
  saveToStorage('workflows', workflows);
  // ...
}, [assetHistory, workflows, canvases, currentCanvasId]);

// 优化后 - 防抖保存
const debouncedSave = useMemo(
  () => debounce((data) => {
    saveToStorage('assets', data.assetHistory);
    // ...
  }, 1000),
  []
);

useEffect(() => {
  debouncedSave({ assetHistory, workflows, canvases, currentCanvasId });
}, [assetHistory, workflows, canvases, currentCanvasId]);
```

---

## 九、实施优先级

| 优先级 | 任务 | 影响 | 工作量 | 风险 |
|--------|------|------|--------|------|
| P0 | useViewport Hook | 状态 -5 | 2h | 低 |
| P1 | useInteraction Hook | 状态 -10 | 4h | 中 |
| P2 | useMouseHandlers 拆分 | 依赖 13→1 | 6h | 高 |
| P3 | useCanvasData Hook | 状态 -6 | 3h | 低 |
| P4 | useSnapDetection | O(n)→O(1) | 4h | 中 |
| P5 | 组件拆分 | 可维护性 | 6h | 低 |

---

## 十、验证清单

### 功能回归
- [ ] 画布缩放 (Ctrl+滚轮)
- [ ] 画布平移 (空格+拖拽, 中键拖拽)
- [ ] 节点拖拽 (单选、多选)
- [ ] 节点吸附对齐
- [ ] Cmd+拖拽复制节点
- [ ] 节点调整大小
- [ ] 分组拖拽和调整大小
- [ ] 连接线创建和删除
- [ ] 框选多节点
- [ ] 右键菜单功能
- [ ] 键盘快捷键 (Cmd+Z, Cmd+C, Cmd+V, Delete)
- [ ] 所有节点类型生成
- [ ] 本地存储持久化
- [ ] 画布切换

### 性能指标
- 100 节点拖拽帧率 ≥ 55fps
- 状态更新不触发全组件重渲染
- 事件监听器不频繁重挂载

---

## 关键文件路径

| 文件 | 行数 | 作用 |
|------|------|------|
| `src/components/studio/StudioTab.tsx` | 3522 | 主要重构目标 |
| `src/components/studio/Node.tsx` | 1971 | 参考 memo 实现 |
| `src/components/studio/shared/types.ts` | 79 | 类型定义复用 |
| `src/components/studio/shared/constants.ts` | 119 | 共享常量 |
| `src/types/index.ts` | - | AppNode, Connection, Group |
