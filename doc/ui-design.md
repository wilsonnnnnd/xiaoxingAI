# UI 设计规范（浅色极简 / Soft Glass Minimalism）

本文档描述本项目当前的 UI 设计语言与落地方式，面向需要实现页面与组件的开发者。它与 [frontend-guide.md](./frontend-guide.md) 的关系是：

- frontend-guide.md：偏“工程与约定”（路由、Layout、导航、表单、i18n、错误处理等）
- ui-design.md：偏“设计系统与视觉语言”（颜色、层级、组件形态、交互与可复制模板）

参考实现：

- 通用组件：[`frontend/src/components/common`](../frontend/src/components/common)

---

## 1. 设计理念

本项目采用“浅色极简 + 轻玻璃材质”的设计方向（Soft Glass Minimalism）：

- 可读性优先：主文本对比足够，正文灰度不要过浅
- 结构克制：用细边界 + 轻阴影建立层次，避免厚重描边与高饱和大面积色块
- 交互轻量：hover/active 只做微变化，不做强烈缩放与跳动
- 组件一致：Card / Surface / Input / Select / Button / Modal 共享同一套“材质语法”

---

## 2. 颜色与层级（推荐值）

### 2.1 文本层级

- 标题/主内容：`text-slate-950` / `text-slate-900`
- 正文/说明：`text-slate-600`
- 次级/Label：`text-slate-500`
- 弱提示/元信息：`text-slate-400`

原则：浅色主题下，正文不低于 `slate-600`，避免灰到看不清。

### 2.2 边界与阴影

- 结构线：`ring-1 ring-black/[0.03]`（或 `border border-white/70`）
- 阴影：`shadow-[0_8px_24px_rgba(15,23,42,0.04)]` 这一类极轻阴影
- 高光：顶部 hairline + 柔光渐变层（在 Card/Input/Select/Button/Modal 中统一）

### 2.3 强调色

- Focus：`focus-visible:ring-2 focus-visible:ring-sky-400/30`
- 错误：`border-red-300/70` + `focus:ring-red-400/20`

---

## 3. 组件设计语言（通用组件）

### 3.1 Surface：页面分区容器

[Surface.tsx](../frontend/src/components/common/Surface.tsx)

适用：表单区、列表区、较大的内容块（比 Card 更“分区”）。

特征：

- 大圆角（更像“面板”而非卡片）
- `bg-white/78 + backdrop-blur-xl`
- 顶部细高光线 + 柔和 haze 点缀

### 3.2 Card：标准信息块

[Card.tsx](../frontend/src/components/common/Card.tsx)

适用：信息展示、KPI/说明文案、配置卡片。

特征：

- glass base：`bg-white/70 + border-white/70 + ring-1`
- 轻阴影与顶部高光渐变
- header / rightSlot / footer 结构统一

### 3.3 KpiCard：关键指标卡

[KpiCard.tsx](../frontend/src/components/common/KpiCard.tsx)

适用：首页/仪表盘类 KPI 展示。

特征：

- KPI 数值使用 `tabular-nums`
- 右上角 tone badge（sky/emerald/violet）表达状态，不用夸张渐变

### 3.4 Button：三层级交互

[Button.tsx](../frontend/src/components/common/Button.tsx)

- primary：主行动（强调但不刺眼）
- secondary：次行动（与 Card 一致的材质）
- ghost：最轻层级（用于工具按钮/轻操作）

原则：

- hover 以亮度/阴影/轻位移为主，避免大幅 scale
- focus ring 统一 sky 系

### 3.5 InputField / Select / Switch：表单控件一致性

- [InputField.tsx](../frontend/src/components/common/InputField.tsx)
- [Select.tsx](../frontend/src/components/common/Select.tsx)
- [Switch.tsx](../frontend/src/components/common/Switch.tsx)

原则：

- Label 统一使用 `text-[11px] uppercase tracking`（系统感）
- 控件面板与 Card 使用同一“玻璃材质语法”
- error 样式一致

### 3.6 Badge：柔和语义色

[Badge.tsx](../frontend/src/components/common/Badge.tsx)

原则：浅色语义底 + 轻边界 + 轻高光，保证在浅色背景上依然清晰。

### 3.7 Modal：雾面层级 + 径向背景

[Modal.tsx](../frontend/src/components/common/Modal.tsx)

原则：

- Backdrop 为浅色雾面 + 径向渐变，而非黑色遮罩
- 头部/底部使用轻分割线，保持质感统一

---

## 4. 页面模板（可复制）

推荐页面组合方式：

1) Hero（Surface 风格的大区块：标题 + CTA + 状态 Badge）
2) KPI 行（KpiCard x 3）
3) 信息卡（Card：说明/系统状态/近期事件）
4) 业务分区（Surface：Form + List）
5) Modal（确认/详情）

---

## UI Demo Patterns (Archived)

说明：项目早期曾存在一个 “UI Demo” 示例页用于快速展示浅色玻璃材质的组件组合方式。该页面已被移除以减少维护成本；其可复用的设计模式在此处归档，供新增页面时参考。

### 1) 页面背景与容器

- 背景：采用浅色径向渐变叠加，辅以极轻网格纹理，制造“空气感”但不抢内容对比度
- 容器：推荐 `max-w-7xl` 的居中布局，外层垂直间距保持稳定（例如 `gap-6`）
- 区块：页面由多个 section 组成，区块间距优先用 gap/mt 建立节奏，而不是粗分割线

### 2) Hero（顶部主区块）

- 形态：大圆角面板（比 Card 更大、更像 Surface），顶部使用一条 hairline 高光线
- 内容结构：eyebrow（小写标题）→ 主标题 → 说明文案 → 右侧轻量操作区（Badge + Primary CTA）
- 适用：仪表盘首页、单页功能入口、设置页顶部说明

### 3) KPI 行（轻量指标）

- 形态：3 列栅格（移动端 1 列），统一用 KpiCard 承载
- 文案：label + value + note，数值使用 tabular 形式以减少跳动
- 适用：Inbox/Worker/系统状态等“概览 + 轻操作”场景

### 4) 信息 Card（标准信息块）

- 结构：subtitle + title + body（可选 rightSlot / footer）
- 内容密度：默认一段短说明即可；列表类内容用 `space-y-2` 保持可读
- 适用：说明卡、状态卡、近期事件、小型配置摘要

### 5) 表单 + 列表的双分区（Surface）

- 用法：把“可编辑配置”与“活动列表/日志”分成两个 Surface，并用响应式栅格排列（例如 1 列 → 2 列）
- 表单区：InputField / Select / Switch 组合时，Label 使用统一的 uppercase micro label（增强系统感）
- 列表区：条目采用轻边框 + 轻 hover 抬升（微位移 + 轻阴影），强调“可点击但不打扰”

### 6) 微交互（克制）

- hover：主要通过亮度、边界、轻阴影变化表达可交互，不做强烈 scale
- transition：优先短时长（~200–300ms）且只对必要属性做过渡
- toast：轻量成功反馈（Saved/Reset/Done）即可，不需要长文案

### 7) 复用组件清单（建议优先使用）

- 容器：Surface / Card / KpiCard
- 表单：InputField / Select / Switch
- 反馈与强调：Badge / Button / Modal / Toast（react-hot-toast）

## 5. 常见反模式（不要这样）

- 浅色主题正文使用过浅灰（导致可读性差）
- 在浅色页面里使用高饱和大面积色块做背景
- hover 用明显 scale/跳动造成布局抖动
- 单个页面单独定义一套“卡片/输入/按钮”样式，导致风格割裂

