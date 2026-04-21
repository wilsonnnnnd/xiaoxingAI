# 前端开发指南（中文）

本文档面向在本项目里新增/修改前端页面与组件的开发者，目标是把现有前端工程约定（布局、导航、通用组件 API、表单、Modal、Toast、i18n）整理成可直接复制的模板，并附上关键源码入口。

说明：本文档位于 `doc/` 目录，文中的“源码入口链接”均指向仓库内的 `frontend/src` 相对路径。

UI 设计语言与规范请查看：[ui-design.md](./ui-design.md)（浅色极简 / Soft Glass Minimalism）。

## 快速索引（源码入口）

- 路由与全局 Toast：[App.tsx](../frontend/src/App.tsx)
- 登录态与页面壳（Sidebar + Outlet）：[Layout.tsx](../frontend/src/components/Layout.tsx)
- 登录页（不走 Layout 的独立页面示例）：[LoginPage.tsx](../frontend/src/features/auth/components/LoginPage.tsx)
- 侧边栏与导航渲染：[Sidebar.tsx](../frontend/src/components/layout/Sidebar.tsx)、[NavItem.tsx](../frontend/src/components/layout/NavItem.tsx)、[navigation.ts](../frontend/src/config/navigation.ts)
- 通用组件（Card/Button/InputField/Select/Switch/Modal）：[components/common](../frontend/src/components/common)
- 表单封装（react-hook-form）：[components/common/form](../frontend/src/components/common/form)
- HTTP 客户端与全局错误 toast：[client.ts](../frontend/src/api/client.ts)
- i18n（Zustand + 字典）：[i18n](../frontend/src/i18n)
- Reply Format 页面（分栏编辑布局示例）：[ReplyFormatPage.tsx](../frontend/src/features/replyFormat/components/ReplyFormatPage.tsx)

## 1. Layout 与路由（页面骨架）

### 1.1 路由结构

路由集中在 [App.tsx](../frontend/src/App.tsx)：

- `/login`：登录页（不走 Layout）
- 其余路由挂在 `path="/" element={<Layout />}` 下，由 [Layout.tsx](../frontend/src/components/Layout.tsx) 统一提供侧边栏与主内容区
  - 例如：`/settings`、`/settings/reply-format`（Reply Format）、`/skill/gmail` 等

### 1.2 登录态与公共页面

[Layout.tsx](../frontend/src/components/Layout.tsx) 的规则：

- token 存在：正常渲染 Sidebar + `<Outlet />`
- token 不存在：
  - 访问 `/`、`/home`、`/help` 视为公共页面，允许进入
  - 其它页面会被重定向到 `/login`
- 公共页面也仍然走 Layout：Sidebar 会出现，但导航会被过滤为仅显示 `/home` 与 `/help`，并在底部展示 “Login” 入口

这意味着：新增页面如果需要登录才能访问，直接挂到 Layout 体系下即可；如果希望“未登录也可访问”，需要把该路由加入 `isPublic` 判断（或调整规则）。

### 1.3 移动端导航（顶部栏 + 抽屉 Sidebar）

小屏（`md` 以下）采用“顶部栏 + 抽屉侧边栏”的布局：

- 顶部栏固定在内容区顶部，提供菜单按钮打开 Sidebar 抽屉
- Sidebar 抽屉覆盖在内容之上，带遮罩；点击遮罩或点击导航项后关闭
- 桌面端（`md` 及以上）保持固定 Sidebar，不影响内容区宽度

参考实现：

- [Layout.tsx](../frontend/src/components/Layout.tsx)
- [Sidebar.tsx](../frontend/src/components/layout/Sidebar.tsx)（支持 `onNavigate` 在移动端点击导航后关闭抽屉）

## 2. 导航（Sidebar / NAV_CONFIG / NavItem）

### 2.1 导航配置

导航项来自 [navigation.ts](../frontend/src/config/navigation.ts) 的 `NAV_ITEMS`：

- `to`：路由路径
- `key`：i18n key（例如 `nav.home`）
- `adminOnly`：是否仅管理员可见
- `end`：是否使用 react-router 的精确匹配（用于“设置”这类父路由）

### 2.2 Sidebar 的过滤逻辑（很重要）

[Sidebar.tsx](../frontend/src/components/layout/Sidebar.tsx) 会做两层过滤：

- 角色过滤：`adminOnly` 且非管理员时隐藏
- 登录态过滤：未登录仅展示 `/home` 与 `/help`

此外 `nav.skill` 是特殊项：在 Sidebar 内部做了下拉菜单渲染（当前包含 `/skill/gmail`）。

### 2.3 NavItem 的样式约定

[NavItem.tsx](../frontend/src/components/layout/NavItem.tsx) 使用 `NavLink` 的 `isActive`：

- active：强调态（用于标记当前页面）
- inactive：默认态（支持 hover/focus 反馈）

当你新增导航项，默认按该组件的样式一致性来做，不建议在页面里单独实现“侧边栏导航按钮”。

## 3. 页面布局模式（容器 / Header / Card 区）

项目中常见的页面容器有两类（可按内容密度选用）：

- 简洁页面（如 Help）：`p-4 sm:p-6 max-w-4xl mx-auto w-full`，配合 `Card` 做一列或网格布局（示例：[Help.tsx](../frontend/src/pages/Help.tsx)）
- 配置/复杂页面（如 Settings）：`flex flex-col h-full p-4 sm:p-5 gap-6 min-w-0 max-w-5xl mx-auto w-full`，通常包含 Header + 多个 Card + 表单底部操作区（示例：[SettingsPage.tsx](../frontend/src/features/settings/components/SettingsPage.tsx)）

Header 约定：

- 标题：`text-2xl font-semibold`
- 副标题：`text-sm mt-1`

页面的视觉风格、配色、组件材质语言等设计规范请参考：[ui-design.md](./ui-design.md)。

### 3.2 移动端响应式约定（所有页面）

原则：移动端优先保证“可读、可点、可滚动”，再在更大屏幕增加信息密度。

推荐约定：

- 页面外层容器统一用 `p-4 sm:p-5` 或 `p-4 sm:p-6`，避免手机端左右边距过大
- grid 默认单列，在 `sm` 或 `lg` 再加列（例如 `grid-cols-1 sm:grid-cols-3`）
- 顶部操作区按钮避免挤压：优先 `flex-wrap` 或小屏改成上下排列（`flex-col sm:flex-row`）
- 长标签/Tab 在小屏优先横向滚动：`flex-nowrap overflow-x-auto sm:flex-wrap`
- 输入控件避免固定窄宽：优先 `w-full sm:w-24` 这类断点写法

常见模板：

**模板：小屏横向滚动 Tab**

```tsx
<div className="flex flex-nowrap gap-1 overflow-x-auto sm:flex-wrap">
  {tabs.map((x) => (
    <button key={x.id} type="button" className="shrink-0 whitespace-nowrap px-4 py-2 text-xs rounded-t-lg">
      {x.label}
    </button>
  ))}
</div>
```

**模板：统计卡片在手机端降列**

```tsx
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
  <StatItem label="Sent" value="—" />
  <StatItem label="Fetched" value="—" />
  <StatItem label="Errors" value="—" />
</div>
```

**模板：小屏上下布局的 Header 操作区**

```tsx
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
  <div>
    <h1 className="text-2xl font-semibold tracking-tight">Title</h1>
    <p className="text-sm mt-1">Subtitle</p>
  </div>
  <div className="flex items-center gap-2">
    <Button>Action</Button>
  </div>
</div>
```

## 4. 通用组件（components/common）

### 4.1 Card

[Card.tsx](../frontend/src/components/common/Card.tsx)：

- 用于承载页面分区内容（有 Header/Body/Footer 的结构约定）
- 以组件 props 为准（title/subtitle/rightSlot/footer/interactive）

### 4.2 Button

[Button.tsx](../frontend/src/components/common/Button.tsx)：

- `variant`: `primary | secondary | ghost`
- `size`: `sm | md | lg`
- `loading`: 自动禁用并显示 loading 状态

### 4.3 InputField / Select / Switch

- [InputField.tsx](../frontend/src/components/common/InputField.tsx)：支持 `multi` 文本域、`error` 错误文案、`required` 星号
- [Select.tsx](../frontend/src/components/common/Select.tsx)：支持 `options`、`placeholder`，带 `error/required`
- [Switch.tsx](../frontend/src/components/common/Switch.tsx)：受控 `checked` + `onChange(checked)`

### 4.4 Badge（状态提示）

[Badge.tsx](../frontend/src/components/common/Badge.tsx) 提供 `success/error/warning/info/neutral` 五种语义状态，适合用于“局部状态强调/标签化信息”（例如列表项状态、调试信息等；示例：[GmailPage.tsx](../frontend/src/features/gmail/components/GmailPage.tsx)）。

## 5. 表单（react-hook-form + zod）与封装组件

项目表单主要使用：

- `react-hook-form`：表单状态与校验触发
- `zod` + `@hookform/resolvers/zod`：schema 校验与错误信息
- 封装组件：[FormInput](../frontend/src/components/common/form/FormInput.tsx)、[FormSelect](../frontend/src/components/common/form/FormSelect.tsx)、[FormSwitch](../frontend/src/components/common/form/FormSwitch.tsx)

封装策略：

- `FormInput/FormSelect/FormSwitch` 用 `useController` 取出 `field` 与 `error?.message`，并把错误透传给 `InputField/Select/Switch`
- 因此 zod 的错误信息会直接呈现在控件下方，保持一致的错误展示

表单底部操作区（sticky bar）示例在 [SettingsPage.tsx](../frontend/src/features/settings/components/SettingsPage.tsx)：

- `sticky bottom-0` 固定在滚动容器底部
- `backdrop-blur-md` 可用于做半透明浮层（具体视觉规范见 ui-design.md）

离开确认：

- [useConfirmDiscard.ts](../frontend/src/hooks/useConfirmDiscard.ts) 监听 `beforeunload`，在 `isDirty` 时提示（仅刷新/关闭标签页，不拦截路由跳转）

## 6. Modal

[Modal.tsx](../frontend/src/components/common/Modal.tsx)：

- `isOpen` 控制显示
- `onClose` 关闭回调
- `title` 标题
- `footer` 可选：用于放置操作按钮
- `size`: `sm | md | lg | xl`
- 打开时会把 `document.body.style.overflow = 'hidden'`，防止页面滚动穿透

## 7. Toast 与全局错误处理

### 7.1 Toaster 挂载位置

在 [App.tsx](../frontend/src/App.tsx) 顶部挂载了：

```tsx
<Toaster position="top-right" />
```

因此页面/组件里可以直接使用 `react-hot-toast`：

```ts
import toast from 'react-hot-toast'
toast.success('Saved')
toast.error('Failed')
```

### 7.2 Axios 拦截器（错误 toast + 鉴权失效跳转）

[client.ts](../frontend/src/api/client.ts) 的响应拦截器会：

- 统一 `toast.error(...)`（优先使用后端 `detail/message`，否则用 i18n 映射 key）
- 对 `401/403` 清理 token，并跳转 `/login`

因此在页面里通常采用：

- `try { await apiCall() } catch { /* handled globally */ }`
- 成功提示用 `toast.success(...)`；失败提示通常不需要重复 toast（避免重复弹窗）

## 8. i18n（Zustand 持久化 + 字典文件）

i18n 入口：

- store：[store.ts](../frontend/src/i18n/store.ts)（Zustand + persist 到 `localStorage['ui_lang']`）
- hook：[useI18n.ts](../frontend/src/i18n/useI18n.ts)
- 字典：[en.ts](../frontend/src/i18n/en.ts)、[zh.ts](../frontend/src/i18n/zh.ts)
- Provider（后端 UI_LANG 初始同步）：[index.tsx](../frontend/src/i18n/index.tsx)

使用方式：

```ts
import { useI18n } from '../i18n/useI18n'

const { t, lang, setLang } = useI18n()
const title = t('header.title.settings')
```

非 React 代码（例如 axios 拦截器）使用：

```ts
import { useI18nStore } from '../i18n/store'
const t = useI18nStore.getState().t
```

key 约定建议（与现有保持一致）：

- `nav.*`：导航
- `header.title.*` / `header.subtitle.*`：页面标题区
- `btn.*`：按钮
- `label.*`：表单标签
- `error.*`：通用错误文案（与全局错误处理对齐）

新增文案落点：同时补齐 `en.ts` 与 `zh.ts`，避免 fallback 到 key。

## 9. 可复制模板（直接改名即可用）

### 模板 A：新增页面 + 路由 + 导航项 + i18n

1）新增页面组件（示例 `ReportsPage`）：

```tsx
import React from 'react'
import { useI18n } from '../../i18n/useI18n'
import { Card } from '../../components/common/Card'

export const ReportsPage: React.FC = () => {
  const { t } = useI18n()

  return (
    <div className="flex flex-col h-full p-4 sm:p-5 gap-6 min-w-0 max-w-5xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">{t('header.title.reports')}</h1>
        <p className="text-sm text-[#64748b] mt-1">{t('header.subtitle.reports')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card title={t('reports.card.overview')}>
          <div className="text-sm text-[#cbd5e1] leading-6">
            {t('reports.empty')}
          </div>
        </Card>
      </div>
    </div>
  )
}
```

2）在 [App.tsx](../frontend/src/App.tsx) 注册路由：

```tsx
import { ReportsPage } from './features/reports'

<Route path="reports" element={<ReportsPage />} />
```

3）在 [navigation.ts](../frontend/src/constants/navigation.ts) 增加导航项：

```ts
{ to: '/reports', key: 'nav.reports', adminOnly: false }
```

4）在字典里补齐 i18n：

- [en.ts](../frontend/src/i18n/en.ts)
- [zh.ts](../frontend/src/i18n/zh.ts)

```ts
"nav.reports": "Reports",
"header.title.reports": "Reports",
"header.subtitle.reports": "View and export data",
"reports.card.overview": "Overview",
"reports.empty": "No data yet",
```

```ts
"nav.reports": "报表",
"header.title.reports": "报表",
"header.subtitle.reports": "查看与导出数据",
"reports.card.overview": "概览",
"reports.empty": "暂无数据",
```

### 模板 B：典型 Card 网格布局（列表 + 工具按钮）

```tsx
import React from 'react'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Badge } from '../../components/common/Badge'
import { useI18n } from '../../i18n/useI18n'

export const ExampleCards: React.FC = () => {
  const { t } = useI18n()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card title={t('card.left')} badge={t('badge.beta')}>
        <div className="flex items-center justify-between gap-3">
          <Badge variant="info">{t('status.ready')}</Badge>
          <Button className="px-3 py-1 text-xs">{t('btn.reload')}</Button>
        </div>
      </Card>

      <Card title={t('card.middle')}>
        <div className="text-sm text-[#cbd5e1] leading-6">
          {t('content.hint')}
        </div>
      </Card>

      <Card title={t('card.right')} full>
        <div className="text-sm text-[#cbd5e1]">
          {t('content.full_width')}
        </div>
      </Card>
    </div>
  )
}
```

### 模板 C：典型表单（zod 校验 + FormInput/FormSelect/FormSwitch + 按钮区）

```tsx
import React from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { FormInput } from '../../components/common/form/FormInput'
import { FormSelect } from '../../components/common/form/FormSelect'
import { FormSwitch } from '../../components/common/form/FormSwitch'
import { useI18n } from '../../i18n/useI18n'
import { useConfirmDiscard } from '../../hooks/useConfirmDiscard'

const schema = z.object({
  name: z.string().min(1, '必填'),
  mode: z.enum(['a', 'b']),
  enabled: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export const ExampleForm: React.FC = () => {
  const { t } = useI18n()

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', mode: 'a', enabled: true },
  })

  useConfirmDiscard(isDirty, t('common.discard_confirm'))

  async function onSubmit(data: FormValues) {
    try {
      await Promise.resolve(data)
      toast.success(t('result.saved'))
      reset(data)
    } catch {
    }
  }

  return (
    <Card title={t('example.form.title')}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormInput name="name" control={control} label={t('label.name')} placeholder={t('placeholder.name')} />
          <FormSelect
            name="mode"
            control={control}
            label={t('label.mode')}
            options={[
              { label: t('opt.mode.a'), value: 'a' },
              { label: t('opt.mode.b'), value: 'b' },
            ]}
          />
          <FormSwitch name="enabled" control={control} label={t('label.enabled')} />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty} className="px-8">
            {t('btn.save')}
          </Button>
          <Button type="button" className="bg-[#334155] hover:bg-[#475569]" disabled={!isDirty || isSubmitting} onClick={() => reset()}>
            {t('btn.reload')}
          </Button>
        </div>
      </form>
    </Card>
  )
}
```

### 模板 D：Modal（确认弹窗）

```tsx
import React, { useState } from 'react'
import { Modal } from '../../components/common/Modal'
import { Button } from '../../components/common/Button'
import { useI18n } from '../../i18n/useI18n'

export const ExampleModal: React.FC = () => {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t('btn.open')}</Button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t('modal.title')}
        footer={
          <>
            <Button className="bg-[#334155] hover:bg-[#475569]" onClick={() => setOpen(false)}>
              {t('btn.cancel')}
            </Button>
            <Button onClick={() => setOpen(false)}>{t('btn.confirm')}</Button>
          </>
        }
      >
        <div className="text-sm text-[#cbd5e1] leading-6">
          {t('modal.body')}
        </div>
      </Modal>
    </>
  )
}
```

## 10. 约定小结（实操优先级）

- 新增页面优先按现有页面骨架组织：Header → Card 分区 → 表单/列表 → toast 反馈 → i18n 补齐
- 请求错误优先交给全局拦截器处理：组件里只做成功 toast 与必要的本地状态回滚
- 导航项统一从 `NAV_CONFIG` 驱动，避免在 Sidebar 外部手写侧边栏按钮
