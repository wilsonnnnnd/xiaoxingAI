# 小星项目开发与扩展指南 (Development & Extension Guide)

本文档旨在指导开发者如何在“小星”项目中添加新功能，并明确各功能模块的存放位置。

---

## 1. 整体架构概览

项目采用 **前后端分离** 架构：
- **后端 (Backend)**: 基于 Python FastAPI，采用领域驱动设计 (DDD) 的简化版，分为 API 层、服务层、仓库层和模型层。
- **前端 (Frontend)**: 基于 React + TypeScript + Vite，采用 **Feature-based (基于功能模块)** 的组织结构。

---

## 2. 后端扩展流程 (Backend)

当你需要添加一个新的后台功能（例如：支持新的邮件服务或 AI 技能）时，请遵循以下路径：

### 2.1 定义数据模型与 Schema
- **数据库模型**: 在 `app/db/base.py` 中定义 SQLAlchemy 模型。
- **Pydantic Schemas**: 在 `app/schemas/` 目录下创建对应的 `.py` 文件，定义请求和响应的数据格式。

### 2.2 实现数据库访问 (Repository)
- 在 `app/db/repositories/` 下创建新的 Repository 类，封装所有与数据库相关的增删改查逻辑。

### 2.3 编写业务逻辑 (Service/Skill)
- **通用服务**: 在 `app/services/` 下编写业务逻辑。
- **特定技能**: 如果是复杂的异步任务或特定域功能（如 Gmail 轮询），在 `app/skills/` 下创建独立的文件夹。

### 2.4 暴露 API 接口 (Route)
- 在 `app/api/routes/` 下创建新的路由文件。
- 在 `app/api/routes/__init__.py` 中注册该路由。
- **注意**: 确保在路由中使用依赖注入来获取 Service 或 Repository 实例。

### 2.5 核心配置 (Optional)
- 如果新功能需要环境变量或全局配置，在 `app/config.py` 中添加字段。

---

## 3. 前端扩展流程 (Frontend)

项目前端采用模块化结构，所有新业务功能应存放在 `src/features/` 目录下。

### 3.1 创建 Feature 模块
在 `frontend/src/features/` 下为新功能创建一个文件夹（如 `my-feature/`），其内部结构应包含：
- `api/index.ts`: 定义该模块专用的 API 调用函数。
- `components/`: 存放该模块特有的 UI 组件或页面。
- `hooks/`: (可选) 存放该模块特有的 React Hooks。
- `types.ts`: (可选) 存放该模块特有的 TypeScript 定义。
- `index.ts`: **公共入口**。必须通过此文件导出外部需要使用的组件或函数。

### 3.2 注册路由与导航
- **注册路由**: 在 `frontend/src/App.tsx` 中导入新模块的页面组件并添加 `<Route>`。
- **添加导航**: 在 `frontend/src/constants/navigation.ts` 中配置侧边栏菜单项。

### 3.3 国际化 (i18n)
- 在 `frontend/src/i18n/zh.ts` 和 `en.ts` 中添加新功能所需的文本。

### 3.4 API 定义规范
- 所有的 API 调用应引用 `src/api/client.ts` 中的 `api` 实例。
- 错误处理：由于已实现全局拦截器，**禁止**在页面组件中手动维护 `errMsg` 状态，拦截器会自动通过 Toast 弹出错误。

---

## 4. UI 规范与注意事项

### 4.1 通用组件优先
- **禁止**在 Feature 页面中编写复杂的原生 HTML 或内联样式。
- 必须优先使用 `src/components/common/` 下的封装组件：
  - 按钮: `Button`
  - 输入框: `InputField`
  - 下拉选择: `Select`
  - 状态切换: `Switch`
  - 卡片: `Card`
  - 弹窗: `Modal`

### 4.2 表单处理
- 对于包含 3 个字段以上的表单，**必须**使用 `react-hook-form` + `zod` 进行管理。
- 使用 `src/components/common/form/` 下的受控组件（如 `FormInput`）以获得自动错误提示。

---

## 5. 快速检查清单 (Checklist)

1. [ ] 后端：Schema 定义好了吗？
2. [ ] 后端：Repository 逻辑是否与 API 解耦？
3. [ ] 前端：是否创建了独立的 `features/xxx` 文件夹？
4. [ ] 前端：是否通过 `index.ts` 暴露接口？
5. [ ] 前端：i18n 文本是否在 `zh.ts` 和 `en.ts` 中同步更新？
6. [ ] 前端：是否使用了 `src/components/common/` 里的标准 UI 组件？
7. [ ] 前端：如果有复杂表单，是否使用了 `react-hook-form`？
