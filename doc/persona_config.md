# 聊天人设配置功能文档

本文档介绍 Xiaoxing AI 的「聊天人设」体系，包括管理员如何配置星座 / 属相 / 性别风格提示词，以及用户如何通过 AI 生成器生成专属聊天 System Prompt。

---

## 目录

1. [功能概述](#功能概述)
2. [数据库设计](#数据库设计)
3. [管理员：人设配置页面](#管理员人设配置页面)
4. [用户：聊天提示词生成器](#用户聊天提示词生成器)
5. [AI 生成流水线](#ai-生成流水线)
6. [API 接口](#api-接口)

---

## 功能概述

「聊天人设」功能分为两个层次：

| 层次 | 使用者 | 说明 |
|------|--------|------|
| **人设配置**（系统级） | 管理员 | 为星座、属相、性别分类配置风格提示词，存入 `system_prompts` 表，作为 AI 生成的参考语境 |
| **聊天提示词**（用户级） | 普通用户 | 输入关键词，可选择星座 / 属相 / 性别，AI 四步流水线生成专属 System Prompt，存入 `user_prompts` 表，可分配给 Bot |

---

## 数据库设计

### 表结构

系统分两张表存储 Prompt，彼此职责清晰：

```
system_prompts                    user_prompts
────────────────────────────      ──────────────────────────────
id          BIGSERIAL PK          id          BIGSERIAL PK
name        VARCHAR               user_id     BIGINT → user(id)
type        VARCHAR               name        VARCHAR
content     TEXT                  type        VARCHAR
is_default  BOOLEAN               content     TEXT
created_at  TIMESTAMP             is_default  BOOLEAN
updated_at  TIMESTAMP             created_at  TIMESTAMP
                                  updated_at  TIMESTAMP
```

- **`system_prompts`**：管理员专属，存放内置 AI 提示词模板（`chat`、`user_profile`、`email_analysis` 等）以及所有人设配置（`type = 'persona_config'`）。
- **`user_prompts`**：每行属于一个用户，存放用户生成/保存的聊天人设（`type = 'chat'`）以及用户对默认提示词的自定义覆盖。

`bot.chat_prompt_id` 外键指向 `user_prompts(id)`，代表该 Bot 当前使用的聊天人设。

### 人设配置的 name 格式

人设配置行的 `name` 字段采用 `{category}:{key}` 格式：

| category | key 示例 | 含义 |
|---|---|---|
| `zodiac` | `aries`、`taurus`、... | 十二星座 |
| `chinese_zodiac` | `rat`、`ox`、... | 十二属相 |
| `gender` | `male`、`female`、`other` | 性别 |

例：`name = 'zodiac:aries'` 表示白羊座的风格提示词。

### 数据迁移（旧版 `prompts` 单表）

若数据库中存在旧版 `prompts` 单表，应用启动时 `init_db()` 会自动执行一次性迁移：

1. `user_id IS NULL` 的行 → 复制至 `system_prompts`（保留原 ID）
2. `user_id IS NOT NULL` 的行 → 复制至 `user_prompts`（保留原 ID）
3. 修复两张新表的序列值
4. `bot.chat_prompt_id` 外键重新绑定到 `user_prompts`
5. 删除旧 `prompts` 表

迁移完全幂等：旧表不存在时立即返回，不会重复执行。

---

## 管理员：人设配置页面

位置：导航栏 **PersonaConfig**（仅管理员可见）

### 功能

- 按标签页切换「星座」「属相」「性别」三个分类
- 点击某个分类项（如「白羊座」），右侧编辑框中显示当前已配置的风格提示词
- 编辑后点击「保存」，写入 `system_prompts` 表（Upsert）
- 尚未配置的项可直接输入新内容后保存

### 风格提示词建议格式

提示词应以第三人称描述该类型用户的典型聊天风格，例如：

```
白羊座用户性格直率、热情，语言风格简短有力，喜欢直接表达观点，
充满行动力，不喜欢拐弯抹角，偶尔会冲动但很快平复。
```

这段文字会作为语境补充（加上标签 `[星座风格参考]`）注入到 AI 生成流水线的第一、第二步。

---

## 用户：聊天提示词生成器

位置：**Chat 页面** → 「聊天提示词生成器」卡片

### 操作流程

1. **选择属性**（可选）：从「星座」「属相」「性别」三个下拉框中选择，仅展示管理员已配置的选项
2. **输入关键词**：自由描述想要的聊天人格，例如「活泼可爱的女生，爱开玩笑，说话简短」
3. 点击 **✨ 生成提示词**，AI 执行四步流水线，约需 10–30 秒
4. 在结果框中可直接编辑生成内容
5. 填写名称后点击 **💾 保存提示词**，存入 `user_prompts` 表
6. 在「聊天提示词管理」卡片中，将保存的提示词分配给对应的 Bot

### 选项联动说明

选择了星座 / 属相 / 性别后，系统会在后端从 `system_prompts` 中读取对应的风格提示词，以如下格式追加到关键词末尾，再一同送给 AI：

```
<用户输入的关键词>

[星座风格参考]
<zodiac:aries 的配置内容>

[属相风格参考]
<chinese_zodiac:rat 的配置内容>
```

若某个选项尚无配置内容，则静默跳过，不影响生成。

---

## AI 生成流水线

生成使用四步流水线，全部在 `POST /chat/generate_persona_prompt` 中执行：

```
用户输入（关键词 + 风格补充）
        │
        ▼
Step 1  tonePersonaGenerator.txt
        LLM 分析语气风格 → tone JSON
        {tone, style, rhythm, language_features, ...}
        │
        ▼
Step 2  characterPortraitGeneration.txt
        LLM 生成角色画像 → portrait JSON
        {personality_traits, social_persona, emotional_pattern, ...}
        │
        ▼
Step 3  chatPrompt.txt
        LLM 生成自由叙述型 system prompt（参考用，不直接使用）
        │
        ▼
Step 4  specificChatStyle.txt（模板填充，无需 LLM）
        用 Step 1 & 2 的 JSON 字段填入结构化模板
        → 最终 System Prompt
```

Step 4 为纯字符串替换（不调用 LLM），确保输出格式固定、可预测。

### Token 消耗

三次 LLM 调用共消耗约 500–2000 Token，结果页面显示总消耗量。

---

## API 接口

### 管理员人设配置

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/admin/persona-config` | 获取所有人设配置，按分类分组返回 |
| `PUT` | `/admin/persona-config` | 保存单条配置（Upsert） |

`PUT` 请求体：
```json
{
  "category": "zodiac",
  "key": "aries",
  "content": "白羊座风格描述..."
}
```

### 聊天提示词生成

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/chat/generate_persona_prompt` | 执行四步 AI 流水线，返回生成的 System Prompt |

请求体：
```json
{
  "keywords": "活泼可爱的女生，爱开玩笑",
  "zodiac": "aries",
  "chinese_zodiac": "rat",
  "gender": "female"
}
```

响应：
```json
{
  "prompt": "...<生成的 System Prompt>...",
  "tokens": 1230
}
```

`zodiac`、`chinese_zodiac`、`gender` 均为可选字段，传 `null` 或不传则不注入风格补充。

### 用户提示词 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/db/prompts` | 列出当前用户的所有提示词 |
| `POST` | `/db/prompts` | 创建新提示词 |
| `PUT` | `/db/prompts/{id}` | 更新提示词 |
| `DELETE` | `/db/prompts/{id}` | 删除提示词 |

这些接口操作 `user_prompts` 表，仅返回当前登录用户自己的数据。
