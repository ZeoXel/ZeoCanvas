# Task Plan: StudioTab.tsx 架构重构

## Goal
将 3522 行的单体组件重构为可维护的模块化架构，解决状态爆炸、性能瓶颈和维护困难问题。

## Phases
- [x] Phase 1: 深度分析现有架构
- [x] Phase 2: 设计重构方案
- [ ] Phase 3: 状态合并实施
- [ ] Phase 4: Hook 提取实施
- [ ] Phase 5: 组件拆分实施
- [ ] Phase 6: 性能优化实施
- [ ] Phase 7: 验证和测试

## Key Questions
1. ✅ 状态如何分类和合并？→ 见 notes.md 状态分析部分
2. ✅ handleGlobalMouseMove 如何拆分？→ 采用模式分发策略
3. ✅ DOM 操作策略如何保留？→ 保留 nodeRefsMap/groupRefsMap 模式
4. ✅ 如何渐进式重构不破坏现有功能？→ 分阶段实施，每阶段验证

## Decisions Made
- **状态管理**: 采用自定义 Hook + useState，不引入 Zustand（渐进式）
- **交互状态**: 采用 InteractionMode 状态机模式
- **性能优化**: 保留现有 DOM 直接操作策略
- **吸附算法**: 采用空间分区索引优化

## Errors Encountered
- (暂无)

## Status
**Phase 3 COMPLETE** - 所有基础 Hooks 已创建并集成验证通过

## 已完成
- [x] useViewport Hook - 视口控制 (scale, pan, 坐标转换, 滚轮缩放)
- [x] useInteraction Hook - 交互状态机 (InteractionMode 类型)
- [x] useCanvasData Hook - 画布数据操作 (nodes, connections, groups)
- [x] useHistory Hook - 撤销/重做管理
- [x] StudioTab.tsx 集成验证 (hooks 已 import 并初始化)
- [x] 构建验证通过

## 文件结构
```
src/hooks/canvas/
├── index.ts           # 统一导出
├── useViewport.ts     # 视口控制 (scale, pan, 坐标转换)
├── useInteraction.ts  # 交互状态机 (InteractionMode 类型)
├── useCanvasData.ts   # 画布数据 (nodes, connections, groups)
└── useHistory.ts      # 历史记录 (undo/redo)
```

## 当前状态
StudioTab.tsx 中已添加 hooks 调用（第 174-178 行），
暂时使用 _ 前缀标记为未使用状态，为后续渐进式迁移做准备。

## 下一步（后续迁移）
渐进式替换现有状态：
1. 替换 viewport 相关状态 (scale, pan, scaleRef, panRef)
2. 替换 interaction 相关状态 (dragging*, resizing*, selection*)
3. 替换 canvasData 相关状态 (nodes, connections, groups)
4. 替换 history 相关状态

## 使用示例
```typescript
import { useViewport, useInteraction, useCanvasData, useCanvasHistory } from '@/hooks/canvas';

// Viewport
const { scale, pan, setScale, setPan, screenToCanvas, handleWheel } = useViewport();

// Interaction
const { mode, selection, startNodeDrag, finishInteraction, selectNodes } = useInteraction();

// Canvas Data
const { nodes, connections, groups, addNode, updateNode, deleteNodes } = useCanvasData();

// History
const { saveSnapshot, undo, redo, canUndo, canRedo } = useCanvasHistory();
```
