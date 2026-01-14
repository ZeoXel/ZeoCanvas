# Task Plan: StudioTab.tsx 架构重构

## Goal
将 3522 行的单体组件重构为可维护的模块化架构，解决状态爆炸、性能瓶颈和维护困难问题。

## Phases
- [x] Phase 1: 深度分析现有架构
- [x] Phase 2: 设计重构方案
- [x] Phase 3: 状态合并实施
- [x] Phase 4: Hook 提取实施
- [x] Phase 5: 组件拆分实施
- [x] Phase 6: 性能优化实施
- [x] Phase 7: 验证和测试

## Key Questions
1. ✅ 状态如何分类和合并？→ 见 notes.md 状态分析部分
2. ✅ handleGlobalMouseMove 如何拆分？→ 采用模式分发策略
3. ✅ DOM 操作策略如何保留？→ 保留 nodeRefsMap/groupRefsMap 模式
4. ✅ 如何渐进式重构不破坏现有功能？→ 分阶段实施，每阶段验证

## Decisions Made
- **状态管理**: 采用自定义 Hook + useState，不引入 Zustand（渐进式）
- **交互状态**: 采用 InteractionMode 状态机模式
- **性能优化**: 保留现有 DOM 直接操作策略
- **事件监听器**: 采用 useRef 包装实现稳定化
- **组件拆分**: ContextMenu 延后处理（业务逻辑耦合高）

## Errors Encountered
- GroupData 类型不存在 → 改用 Group 类型
- ConnectionStart 不在 @/types 导出 → 改从 @/hooks/canvas 导入

## Status
**Phase 7 COMPLETED** - 所有阶段完成

---

## 最终成果

### 文件结构
```
src/hooks/canvas/
├── index.ts           # 统一导出
├── useViewport.ts     # 视口控制 (scale, pan, 坐标转换)
├── useInteraction.ts  # 交互状态机 (InteractionMode 类型)
├── useCanvasData.ts   # 画布数据 (nodes, connections, groups)
└── useHistory.ts      # 历史记录 (undo/redo)

src/components/studio/canvas/
├── SelectionRect.tsx      # ✅ 框选矩形
├── ConnectionsLayer.tsx   # ✅ 连接线 SVG 层
├── GroupsLayer.tsx        # ✅ 分组渲染层
├── utils.ts               # ✅ 共享工具函数
└── CanvasContextMenu.tsx  # ⏳ 延后 (业务逻辑耦合)
```

### 重构指标
| 指标 | 重构前 | 重构后 | 变化 |
|------|--------|--------|------|
| StudioTab.tsx 行数 | 3522 | ~3100 | -12% |
| useState | 45 | 31 | -31% |
| useRef | 22 | 16 | -27% |
| 事件监听器重挂载 | 频繁 | 仅1次 | ✅ |
| 代码组织 | 单体 | 模块化 | ✅ |

### 已完成任务
1. ✅ useViewport Hook - 视口控制
2. ✅ useInteraction Hook - 交互状态机
3. ✅ useCanvasData Hook - 画布数据
4. ✅ useCanvasHistory Hook - 撤销/重做
5. ✅ SelectionRect 组件拆分
6. ✅ ConnectionsLayer 组件拆分
7. ✅ GroupsLayer 组件拆分
8. ✅ 事件监听器优化 (useRef 包装)
9. ✅ 所有构建验证通过

### 延后任务
- ⏳ ContextMenu 拆分 (业务逻辑耦合高，风险大)
- ⏳ draggingNodeId/resizingNodeId 迁移到 mode (影响范围大)

### 使用示例
```typescript
import { useViewport, useInteraction, useCanvasData, useCanvasHistory } from '@/hooks/canvas';
import { SelectionRect } from './canvas/SelectionRect';
import { ConnectionsLayer } from './canvas/ConnectionsLayer';
import { GroupsLayer } from './canvas/GroupsLayer';

// Viewport
const { scale, pan, setScale, setPan, screenToCanvas, handleWheel } = useViewport();

// Interaction
const { mode, selection, startNodeDrag, finishInteraction, selectNodes } = useInteraction();

// Canvas Data
const { nodes, connections, groups, addNode, updateNode, deleteNodes } = useCanvasData();

// History
const { saveSnapshot, undo, redo, canUndo, canRedo } = useCanvasHistory();
```

---

## Git 提交记录
- `cbe93b0`: refactor: 迁移 panning 状态到 useInteraction mode
- `bb5f56b`: refactor: 迁移 canvasData 状态到 useCanvasData Hook
- `77debee`: refactor: 迁移 history 状态到 useCanvasHistory Hook
- `f3f1969`: docs: 更新 task_plan.md - Phase 4 完成
- (待提交): Phase 5-7 完成
