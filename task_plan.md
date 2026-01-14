# Task Plan: StudioTab.tsx 架构重构

## Goal
优化 StudioTab.tsx 的状态管理，保持性能流畅。

## Phases
- [x] Phase 1-4: Hook 提取与状态迁移 ✅ 完成
- [x] Phase 5: 代码清理 ← 当前

## 已完成成果

### 重构指标
| 指标 | 重构前 | 重构后 | 变化 |
|------|--------|--------|------|
| useState | 45 | 31 | -31% |
| useRef | 22 | 14 | -36% |

### Hooks 架构
```
src/hooks/canvas/
├── useViewport.ts      # 视口控制
├── useInteraction.ts   # 交互状态机
├── useCanvasData.ts    # 画布数据
├── useHistory.ts       # 撤销/重做
└── index.ts
```

## 经验教训
- ❌ 组件拆分（GroupsLayer/ConnectionsLayer）导致性能下降
- ❌ 原因：props 传递触发重渲染，memo 因回调函数失效
- ✅ Hook 提取是安全的优化方式

## 后续可选优化
1. 移除文件顶部的工具函数到 utils（仅代码组织，不影响性能）
2. 如需进一步优化，考虑 React Compiler 或 useMemo 策略
