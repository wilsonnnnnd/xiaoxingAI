# 🌟 小星 AI 聊天助手

一个基于 llama.cpp 和 LLaMA 模型的智能聊天机器人，拥有记忆功能、情绪识别、语音合成和对话总结等特性。小星是一位温柔知性的AI伙伴，能够陪伴用户进行自然的对话，记住用户的偏好，并提供个性化的回应。

## � 项目简介

**小星AI聊天助手** 是一个功能丰富的人工智能对话系统，专为提供个性化、情感化的聊天体验而设计。与传统的聊天机器人不同，小星具备以下核心特性：

### 🎯 设计理念
- **情感陪伴**：不仅仅是问答工具，更是贴心的AI伙伴
- **个性化体验**：通过记忆系统学习用户偏好，提供定制化回应
- **多模态交互**：支持文字聊天、语音合成、情绪分析等多种交互方式
- **数据持久化**：完整保存聊天历史，支持长期记忆和回忆

### 🔬 技术架构
- **AI 模型**：基于 Qwen1.5-7B-Chat 量化模型（GGUF格式）
- **推理引擎**：使用高性能的 llama.cpp 引擎
- **后端框架**：Python + PostgreSQL + AsyncIO
- **语音合成**：集成 Microsoft Edge TTS
- **部署方式**：支持本地部署，保护隐私安全

### 🌈 应用场景
- **个人助手**：日常聊天、情感支持、生活建议
- **学习伙伴**：知识问答、思维碰撞、创意启发
- **开发研究**：AI对话系统开发、多模态交互研究
- **情感陪伴**：缓解孤独感，提供温暖的数字陪伴

### 🚀 项目亮点
1. **零成本部署**：完全本地运行，无需云服务费用
2. **隐私保护**：所有数据本地存储，不上传云端
3. **高度可定制**：开源代码，支持个性化修改
4. **多启动方式**：提供命令行、API服务等多种使用方式
5. **智能记忆**：自动学习和记住用户习惯与偏好

### 📊 技术指标
- **模型大小**：约 4.8GB（量化后）
- **内存需求**：建议 8GB+ RAM
- **响应速度**：本地推理，1-3秒响应
- **支持语言**：中文为主，支持多语言对话
- **并发能力**：支持API模式下的多用户访问

##  目录

- [项目简介](#-项目简介)
- [功能特性](#-功能特性)
- [项目结构](#-项目结构)
- [环境要求](#-环境要求)
- [安装配置](#-安装配置)
- [启动模型](#-启动模型)
- [开始聊天](#-开始聊天)
- [数据存储](#-数据存储)
- [配置说明](#-配置说明)
## ✨ 功能特性

本项目功能以轻量、模块化为主，侧重本地化推理与多模态交互。核心功能包括：

- 智能对话：基于本地 llama.cpp 推理（仓库内 `llama.cpp/` 与 Python API），支持多轮上下文管理与定制系统提示。
- 语音合成与播放：使用 `edge-tts` 进行 TTS，合成与播放逻辑在 `function/audio/speech_utils.py`，播放队列与多种回退播放器并存。合成时会记录 `rate` 与 `volume`（若为 None 则回退到默认）。
- 语音日志与回放：所有合成与播放事件写入 `audio_usage`（通过 `function/log/audio_logger.py`），并支持后续更新与播放事件记录（`audio_tone`）。
- 情绪/音色分析：文本情绪分析与简易情绪到语音风格映射存在于 `function/nlp/tone_analyzer.py` 与 `function/audio/player.py`，可将情绪作为 `tone` 写入音色记录。 
- 数据存储：配置为 PostgreSQL（通过 `DATABASE_URL`），数据库连接与建表脚本位于 `db/`（`connection.py`、`create_tables.py`、`postgres_tables.sql`）。
- 日志与审计：API 调用、音频合成、播放事件等均写入日志/数据库，便于统计与故障排查（见 `function/log/`）。
- 开发与测试工具：包含集成测试脚本 `tools/integration_test.py` 与若干批处理脚本用于快速验证服务连通性。

说明：README 中的功能描述已尽量与仓库实现保持一致；若你希望将某项能力扩展为更完整的模块（例如 Web UI、移动端或多用户会话管理），我可以把对应的 TODO 和实现建议写进 README。 
- **定时任务**：支持每日自动总结和报告生成
- **趋势分析**：分析聊天频率、情绪变化等长期趋势

### 💾 数据管理系统
- **PostgreSQL 数据库**：可靠的关系型存储（通过 `DATABASE_URL` 配置）
- **数据备份**：建议使用 `pg_dump` / `pg_restore` 进行备份与恢复
- **隐私保护**：数据可集中部署或本地托管，默认不上传第三方云服务
- **数据清理**：提供数据清理和优化工具

### 🎭 个性化角色扮演
- **角色设定**：小星作为25岁天秤座AI研究员，具有独特人格
- **对话风格**：温柔知性，使用特有的语气词和表达方式
- **兴趣爱好**：涵盖天文、心理学、音乐、游戏等多个领域
- **情感陪伴**：提供温暖的数字陪伴体验

## 🗂️ 项目结构

```
xiaoxing/                               # 项目根目录
├── .bat/                               # 批处理启动脚本（实际文件按仓库内容为准）
│   ├── build_XX.bat
│   ├── run_XX.bat
│   ├── test.bat
│   └── 启动小星_API模式.bat
├── config/                             # 配置文件目录
│   ├── config.py
│   └── prompt.txt
├── db/                                 # 数据库相关文件
│   ├── connection.py
│   ├── create_tables.py
│   └── postgres_tables.sql
├── function/                           # 功能模块目录
│   ├── audio/
│   ├── log/
│   ├── memory/
│   ├── nlp/
│   └── ...
├── llama.cpp/                          # LLaMA 引擎与模型
├── memory/                             # 运行时数据和音频文件
│   ├── audio/
│   └── report/
├── tools/                              # 开发/测试工具脚本
├── cache/                              # 模型/临时缓存
├── main_chat.py                        # 主程序入口
├── keep_awake.py                       # 防休眠工具
├── requirements.txt                    # Python 依赖
├── README.md                           # 当前文档
└── server_log.txt                       # 运行日志示例
```

### 📂 目录功能说明

#### 🔧 配置层 (`config/`)
- **统一配置管理**：所有系统参数集中配置
- **人格设定**：AI角色的完整人格定义
- **路径管理**：统一管理文件和数据库路径

#### 🧩 功能层 (`function/`)
- **模块化设计**：每个功能独立成模块，便于维护
- **解耦架构**：模块间通过标准接口通信
- **可扩展性**：容易添加新功能模块

-#### 💾 数据层 (`db/`, `memory/`)
- **持久化存储**：PostgreSQL + 文件存储
- **结构化数据**：聊天记录、用户偏好、情绪数据
- **非结构化数据**：音频文件、报告文件

#### 🚀 应用层 (`main_chat.py`)
- **流程协调**：整合所有功能模块
- **用户交互**：处理用户输入和AI回应
- **异步处理**：支持并发操作

#### 🛠️ 工具层 (`.bat/`)
- **一键启动**：简化部署和使用流程
- **测试工具**：系统功能验证

## 💻 环境要求

### 系统要求
- **操作系统**：Windows 10/11（推荐）、Linux、macOS
- **内存**：建议 8GB 以上（最低 6GB）
- **存储空间**：至少 10GB 可用空间
  - 模型文件：~5GB
  - 程序代码：~100MB
  - 数据存储：~1GB（随使用增长）
  - 临时文件：~1GB
- **CPU**：支持 AVX2 指令集（现代 CPU 都支持）
- **GPU**：可选，支持 CUDA 的 NVIDIA 显卡可显著提升性能

### 硬件性能对照表
| 配置等级 | CPU | 内存 | GPU | 响应速度 | 推荐用途 |
|---------|-----|------|-----|---------|----------|
| 入门级 | 4核心+ | 6GB | 无 | 5-10秒 | 轻度聊天 |
| 推荐级 | 8核心+ | 8GB | 无 | 2-5秒 | 日常使用 |
| 高性能 | 8核心+ | 16GB | GTX 1060+ | 1-2秒 | 频繁使用 |
| 专业级 | 16核心+ | 32GB | RTX 3070+ | <1秒 | 开发研究 |

### 软件依赖

#### 必需软件
- **Python**：3.8 或更高版本（推荐 3.10+）
- **pip**：Python 包管理器（通常随Python安装）

#### Windows 编译环境（仅首次构建需要）
- **CMake**：3.20 或更高版本
- **Visual Studio Build Tools**：2019 或更高版本
  - 或者完整的 Visual Studio Community
  - 包含 C++ 构建工具和 Windows SDK

#### 可选软件
- **CUDA Toolkit**：11.8+ （用于 GPU 加速）
- **Git**：用于克隆代码仓库
- **VS Code**：推荐的代码编辑器

### Python 包依赖

#### 核心依赖包
```bash
# AI 推理引擎
llama-cpp-python>=0.2.0    # LLaMA 模型推理库

# 异步和网络
requests>=2.28.0           # HTTP 请求库
asyncio                    # 异步编程支持（Python内置）

# 数据库和存储
psycopg2-binary            # PostgreSQL client for Python
pydantic-core>=2.0.0       # 数据验证和序列化

# 语音和多媒体
edge-tts>=6.1.0            # Microsoft Edge 语音合成

# 系统工具
pyautogui>=0.9.0           # 防休眠功能（鼠标控制）
```

#### 可选依赖包
```bash
# GPU 加速版本（二选一）
llama-cpp-python[cuda]     # CUDA 版本（NVIDIA GPU）
llama-cpp-python[metal]    # Metal 版本（Apple Silicon）

# 数据分析和可视化
matplotlib>=3.5.0          # 图表生成
wordcloud>=1.9.0           # 词云生成
pandas>=1.4.0              # 数据处理

# 开发和测试
pytest>=7.0.0              # 单元测试
black>=22.0.0              # 代码格式化
```

### 安装验证

安装完成后，可以运行以下命令验证环境：

```bash
# 检查 Python 版本
python --version

# 检查 pip 版本
pip --version

# 检查主要依赖包
python -c "import llama_cpp; print('llama-cpp-python:', llama_cpp.__version__)"
python -c "import requests; print('requests:', requests.__version__)"
python -c "import edge_tts; print('edge-tts: OK')"

# 检查 CMake（仅构建时需要）
cmake --version

# 检查 CUDA（可选）
nvcc --version
```

### 性能优化建议

#### CPU 优化
- 关闭不必要的后台程序
- 确保系统有足够的虚拟内存
- 在任务管理器中设置高优先级

#### GPU 优化（可选）
- 安装最新的 NVIDIA 驱动程序
- 确保 CUDA 版本与 GPU 兼容
- 监控 GPU 内存使用情况

#### 内存优化
- 定期清理临时文件
- 调整模型上下文窗口大小
- 关闭其他内存密集型应用

## 🔧 安装配置

### 1. 克隆项目
```bash
git clone https://github.com/wilsonnnnnd/xiaoxingAI_Chat.git
cd xiaoxingAI_Chat
```

### 2. 安装 Python 依赖
```bash
pip install -r requirements.txt
```

### 3. 下载模型文件
将 LLaMA 模型文件（`qwen1_5-7b-chat-q5_k_m.gguf`）放置到：
```
E:\xiaoxing\llama.cpp\models\qwen1_5-7b-chat-q5_k_m.gguf
```

### 4. 编译 llama.cpp
运行批处理脚本：
```bash
.bat\构建小星.bat
```

### 5. 初始化数据库
```bash
python db/init_db.py
```

## 🚀 启动模型

小星提供了多种启动方式，每种方式都有对应的批处理脚本，根据你的需求选择：

### 方式一：Python API 模式（推荐）
**脚本**：`.bat\小星PyAPI.bat`

这种方式使用 llama-cpp-python 库提供 API 服务，支持 GPU 加速：
```bash
python -m llama_cpp.server ^
  --model E:\xiaoxing\llama.cpp\models\qwen1_5-7b-chat-q5_k_m.gguf ^
  --host 127.0.0.1 ^
  --port 8000 ^
  --n_ctx 4096 ^
  --n_gpu_layers 100 ^
  --n_threads 16 ^
  --chat_format chatml ^
  --cache true
```

**特点**：
- 🚀 **启动快速**：无需编译，直接使用Python库
- 🎮 **GPU 加速**：支持100层GPU加速，显著提升性能
- 💾 **智能缓存**：启用缓存机制，提高响应速度
- 🔧 **自动检测**：自动错误检测和详细提示
- 📦 **依赖简单**：只需安装Python包即可
- 🌐 **标准API**：提供OpenAI兼容的API接口

### 方式二：llama.cpp API 模式
**脚本**：`.bat\启动小星_API模式.bat`

使用原生 llama.cpp 编译的服务器程序：
```bash
llama-server.exe ^
  --host 127.0.0.1 ^
  --port 8000 ^
  --model "%MODEL_PATH%" ^
  --ctx-size 8192 ^
  --mlock ^
  --threads 4
```

**特点**：
- 🔧 **原生性能**：使用原生 C++ 实现，性能优异
- 🧠 **内存优化**：内存锁定（mlock），减少交换到硬盘
- ⚡ **稳定服务**：适合长期运行的生产环境
- 🛠️ **编译要求**：需要先编译llama.cpp源码
- 💻 **资源控制**：更精确的内存和CPU控制
- 🎯 **专业级**：适合对性能有极致要求的场景

### 🔄 两种模式详细对比

| 对比项目 | Python API 模式 | llama.cpp API 模式 |
|---------|----------------|-------------------|
| **启动方式** | `小星PyAPI.bat` | `启动小星_API模式.bat` |
| **依赖要求** | Python + llama-cpp-python | 编译好的 llama-server.exe |
| **GPU支持** | ✅ 100层GPU加速 | ❌ 仅CPU（需特殊编译） |
| **启动速度** | ⚡ 快速（无需编译） | 🐌 需要先编译 |
| **内存使用** | 4GB上下文 | 8GB上下文 |
| **线程数** | 16线程 | 4线程 |
| **缓存功能** | ✅ 智能缓存 | ❌ 无缓存 |
| **错误检测** | ✅ 详细检测 | ⚠️ 基础检测 |
| **API兼容** | OpenAI兼容 | llama.cpp原生 |
| **适用场景** | 开发测试、日常使用 | 生产环境、专业部署 |
| **资源占用** | 中等 | 较低 |
| **稳定性** | 良好 | 优秀 |

### 🎯 选择建议

#### 推荐使用 Python API 模式的情况：
- ✅ **首次使用**：无需复杂编译过程
- ✅ **有NVIDIA显卡**：可以利用GPU加速
- ✅ **开发测试**：快速启动和调试
- ✅ **日常聊天**：响应速度和用户体验更好
- ✅ **系统配置一般**：智能缓存提升性能

#### 推荐使用 llama.cpp API 模式的情况：
- ✅ **生产环境**：需要长期稳定运行
- ✅ **服务器部署**：对内存和CPU有精确控制需求
- ✅ **资源受限**：CPU性能有限，需要最优化
- ✅ **专业开发**：需要深度定制llama.cpp
- ✅ **无GPU环境**：纯CPU推理场景

### ⚙️ 启动参数对比详解

#### Python API 模式独有参数：
- `--n_gpu_layers 100`: GPU加速层数，100表示尽可能使用GPU
- `--chat_format chatml`: 聊天格式，优化对话体验
- `--cache true`: 启用KV缓存，提高连续对话性能
- `--n_threads 16`: 更多CPU线程，提高并行处理能力

#### llama.cpp API 模式独有参数：
- `--mlock`: 内存锁定，防止交换到虚拟内存
- `--ctx-size 8192`: 更大的上下文窗口
- `--threads 4`: 保守的线程设置，保证稳定性

### 🚦 启动状态判断

#### Python API 模式启动成功标志：
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

#### llama.cpp API 模式启动成功标志：
```
llama server listening at http://127.0.0.1:8000
✅ llama.cpp 模型服务已启动在 http://127.0.0.1:8000
```

### 方式三：直接命令行模式
**脚本**：`.bat\小星快速启动.bat`

直接启动命令行交互模式，无需 API：
```bash
llama-cli.exe ^
  -m "%MODEL_PATH%" ^
  -i -n 512 -c 8192 ^
  --system-prompt-file "%PROMPT_FILE%" ^
  --top_k 50 ^
  --top_p 0.9 ^
  --temp 0.7 ^
  --repeat_penalty 1.1 ^
  -p "小星～我来找你聊天啦～"
```

**特点**：
- 🎯 无需 API，直接对话
- 🔒 离线运行，不依赖网络
- 💬 适合简单的命令行交互

### 方式四：构建并启动
**脚本**：`.bat\构建小星.bat`

首先编译 llama.cpp，然后启动：
```bash
# 编译过程
cmake -S "%BASE_DIR%" -B "%BUILD_DIR%" -G "NMake Makefiles" -DLLAMA_CURL=OFF
cmake --build "%BUILD_DIR%"

# 启动聊天
llama-cli.exe [参数...]
```

**适用场景**：
- 🔨 首次安装或更新代码后
- 🐛 需要重新编译解决问题
- ⚙️ 自定义编译选项

### 启动步骤详解

#### 1. 选择启动方式
根据你的需求和环境选择最适合的启动方式：

**快速开始（推荐新手）**：
- 🆕 **首次使用**：方式一（Python API）- 无需编译，开箱即用
- 💻 **有NVIDIA显卡**：方式一（Python API）- 享受GPU加速
- 🔄 **日常使用**：方式一（Python API）- 响应快，体验好

**专业部署（推荐进阶）**：
- 🏢 **生产环境**：方式二（llama.cpp API）- 稳定可靠
- 🛠️ **深度定制**：方式四（构建启动）- 完全控制
- 💻 **纯CPU环境**：方式二（llama.cpp API）- 资源优化

**特殊场景**：
- 🎯 **简单测试**：方式三（命令行）- 直接对话
- 🔨 **开发调试**：方式四（构建启动）- 完整流程

#### 2. 运行启动脚本
双击对应的 .bat 文件，或在命令行中执行：
```bash
cd E:\xiaoxing
.bat\小星PyAPI.bat
```

#### 3. 启动成功标志
根据不同的启动方式，成功标志也不同：

**Python API 模式成功标志**：
```
[🚀] 正在启动小星模型服务...
INFO:     Started server process [xxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

**llama.cpp API 模式成功标志**：
```
llama server listening at http://127.0.0.1:8000
✅ llama.cpp 模型服务已启动在 http://127.0.0.1:8000
```

**命令行模式成功标志**：
```
> 小星～我来找你聊天啦～
小星：你好呀～我是小星，很高兴见到你！有什么想聊的吗？
```

**出现以上信息说明模型已成功启动**，可以开始使用小星进行聊天了！

### 启动参数详解

#### Python API 模式参数：
- `--model`: 模型文件路径
- `--host`: 服务器监听地址（127.0.0.1 仅本地访问）
- `--port`: 端口号（默认 8000）
- `--n_ctx`: 上下文窗口大小（4096 tokens）
- `--n_gpu_layers`: GPU 层数（100 表示尽可能多使用 GPU）
- `--n_threads`: CPU 线程数（16 线程）
- `--chat_format`: 聊天格式（chatml）
- `--cache`: 启用缓存提高性能

#### llama.cpp API 模式参数：
- `--host/--port`: 服务器地址和端口
- `--model`: 模型文件路径
- `--ctx-size`: 上下文大小（8192 tokens）
- `--mlock`: 内存锁定，防止交换到硬盘
- `--threads`: CPU 线程数

#### 命令行模式参数：
- `-m`: 模型文件路径
- `-i`: 交互模式
- `-n`: 最大生成 token 数（512）
- `-c`: 上下文大小（8192）
- `--system-prompt-file`: 系统提示词文件
- `--top_k`: Top-K 采样参数（50）
- `--top_p`: Top-P 采样参数（0.9）
- `--temp`: 温度参数（0.7，控制创造性）
- `--repeat_penalty`: 重复惩罚（1.1）
- `-p`: 初始提示词

### 故障排除

#### 启动失败常见原因：
1. **模型文件不存在**：确认 `qwen1_5-7b-chat-q5_k_m.gguf` 在正确位置
2. **端口被占用**：检查 8000 端口是否被其他程序使用
3. **编译失败**：确认安装了 CMake 和 Visual Studio Build Tools
4. **内存不足**：确保有足够的 RAM（建议 8GB+）
5. **Python 依赖缺失**：运行 `pip install llama-cpp-python`

#### 性能优化建议：
- **GPU 加速**：使用 Python API 模式并安装 CUDA 版本
- **内存优化**：适当调整 `n_ctx` 和 `ctx-size` 参数
- **CPU 优化**：根据 CPU 核心数调整 `n_threads` 参数

### 测试脚本 (`test.bat`)

项目还包含一个测试脚本，用于验证 API 是否正常工作：
```python
# test.bat 实际上是一个 Python 脚本
import requests

prompt = "你是谁？"
system_prompt = open("E:/xiaoxing/prompt.txt", encoding="utf-8").read()
full_prompt = system_prompt + "\n用户：" + prompt + "\n小星："

response = requests.post("http://127.0.0.1:8000/completion", json={
    "prompt": full_prompt,
    "n_predict": 128,
    "temperature": 0.7,
    "top_k": 50,
    "top_p": 0.9,
    "repeat_penalty": 1.1,
})

print(response.status_code)
print(response.json())
```

**使用方法**：
1. 先启动任意一种 API 模式
2. 运行测试脚本验证连接
3. 检查返回的状态码和响应内容

## 💬 开始聊天

### 1. 启动聊天程序
确保模型服务已启动，然后运行：
```bash
python main_chat.py
```

### 2. 聊天界面
启动后你会看到：
```
🌟 小星已启动，开始陪你聊天啦～

你：
```

### 3. 聊天示例
```
你：你好小星！
小星：你好呀～我是小星，很高兴见到你！有什么想聊的吗？

你：我今天心情不太好
小星：哎呀，怎么了呀？和我说说吧，我在听你说呢～💕

你：总结一下我们刚才聊了什么
小星（总结）：刚才你跟我打招呼，然后提到心情不太好，我在关心你的状况...
```

### 4. 特殊命令
- **退出聊天**：输入 `exit`、`quit` 或 `退出`
- **获取总结**：输入包含 `总结`、`概括`、`刚刚聊了什么` 的内容
- **情绪回应**：小星会自动识别你的情绪并给出相应回应

## 💾 数据存储

小星使用 PostgreSQL 作为主要关系型数据存储（通过 `DATABASE_URL` 配置）。主要表在 `db/postgres_tables.sql` 中定义，仓库包含 `db/create_tables.py` 用于在 Postgres 上创建表结构。

常见数据位置：
- **数据库**：由 `DATABASE_URL` 指定的 Postgres 实例管理（参考 `config/config.py`）
- **音频文件**：`E:\xiaoxing\memory\audio\`
- **报告文件**：`E:\xiaoxing\memory\report\`
- **日志文件**：自动按日期存储（例如 `server_log.txt`）

数据库备份建议使用 Postgres 原生工具，如 `pg_dump`：

```bash
# 导出整个数据库为 SQL 文件
pg_dump "$DATABASE_URL" > xiaoxing_backup_$(date +%F).sql
```

## ⚙️ 配置说明

### 主配置文件 (`config/config.py`)

#### API 配置
```python
URL = "http://127.0.0.1:8000"           # API 服务地址
API_URL = URL + "/v1/completions"       # 完整 API 端点
```

#### 聊天参数
```python
HISTORY_LIMIT = 5                       # 发送给模型的历史对话条数
MAX_HISTORY = 20                        # 内存中保存的最大历史条数
HISTORY_LIMIT_FOR_SUMMARY = 10          # 用于总结的历史条数
```

#### 语音设置
```python
DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"  # 默认语音
DEFAULT_STYLE = "friendly"              # 语音风格
DEFAULT_RATE = "0%"                     # 语速
DEFAULT_VOLUME = "0dB"                  # 音量
```

#### 路径配置
```python
DB_PATH = os.path.join(BASE_DIR, "db", "xiaoxing_memory.db")
PROMPT_PATH = os.path.join(CONFIG_DIR, "prompt.txt")
AUDIO_DIR = os.path.join(MEMORY_DIR, "audio")
```

### 角色设定文件 (`config/prompt.txt`)
包含小星的完整人格设定，定义了：
- 身份背景（25岁、天秤座、AI研究员）
- 性格特征（温柔知性、幽默感、陪伴感）
- 兴趣爱好（天文、心理学、音乐等）
- 对话风格（使用"～"、"嘻嘻"等语气词）

## 🔧 功能模块

### 1. 记忆系统 (`function/memory/`)
- **功能**：存储和检索用户偏好、重要信息
- **主要文件**：
  - `memory.py`: 核心记忆类
  - `memory_tools.py`: 记忆工具函数
  - `memory_parser.py`: 记忆解析器
  - `preference_db.py`: 偏好数据库操作

### 2. 情绪识别 (`function/emotion/`)
- **功能**：分析用户情绪，提供相应回应
- **主要文件**：
  - `emotion_utils.py`: 情绪识别工具
  - `emotion_dict_db.py`: 情绪词典管理

### 3. 语音系统 (`function/audio/`)
**功能**：语音合成和播放
**主要文件**：
  - `speech_utils.py`: 语音工具
  - `speech_logger.py`: 语音日志

### 4. 对话总结 (`function/summary/`)
- **功能**：自动生成对话摘要和报告
- **主要文件**：
  - `summary_manager.py`: 总结管理器
  - `summary_db.py`: 总结数据库
  - `scheduler_manager.py`: 定时任务管理

### 5. 日志系统 (`function/log/`)
- **功能**：记录所有聊天对话
- **主要文件**：
  - `chat_logger.py`: 聊天日志记录器

## ❓ 常见问题

### Q1: 模型启动失败怎么办？
**A1**: 检查以下几点：
1. 确认模型文件存在于正确路径
2. 检查端口 8000 是否被占用
3. 确认 llama.cpp 编译成功
4. 查看控制台错误信息

### Q2: 聊天没有回应怎么办？
**A2**: 可能原因：
1. 模型服务未启动或启动失败
2. API 地址配置错误
3. 网络连接问题
4. 模型响应超时

### Q3: 如何更换模型？
**A3**: 
1. 将新模型文件放入 `llama.cpp/models/` 目录
2. 修改批处理脚本中的模型路径
3. 重启模型服务

### Q4: 数据库损坏怎么办？
**A4**:
1. 停止所有程序
2. 删除现有数据库文件
3. 运行 `python db/init_db.py` 重新初始化
4. 注意：这会丢失所有历史数据

### Q5: 语音播放失败怎么办？
**A5**:
1. 检查网络连接（edge-tts 需要网络）
2. 确认系统音频设备正常
3. 检查音频文件是否生成

### Q6: 如何修改小星的性格？
**A6**: 编辑 `config/prompt.txt` 文件，修改其中的人格设定内容。

### Q7: 如何清理存储空间？
**A7**:
```bash
# 清理音频文件
del E:\xiaoxing\memory\audio\*.mp3

# 清理报告文件
del E:\xiaoxing\memory\report\*.*
```

## 🛠️ 开发指南

### 项目架构说明

#### 核心模块组织
```
xiaoxing/
├── main_chat.py           # 主程序入口，整合所有功能模块
├── config/               # 配置管理
│   ├── config.py         # 全局配置常量
│   └── prompt.txt        # AI角色人格设定
├── function/             # 功能模块（模块化设计）
│   ├── audio/            # 语音处理模块
│   ├── emotion/          # 情绪分析模块
│   ├── log/              # 日志记录模块
│   ├── memory/           # 记忆系统模块
│   └── summary/          # 对话总结模块
└── db/                   # 数据库相关
```

#### 数据流架构
1. **用户输入** → 情绪识别 → 记忆检索 → AI推理 → 记忆存储 → **输出回应**
2. **语音合成** ← 情绪配置 ← AI回应
3. **定时任务** → 对话总结 → 数据分析 → 报告生成

### 自定义开发

#### 1. 修改AI人格
编辑 `config/prompt.txt` 文件，可以完全自定义AI的：
- 身份背景和年龄设定
- 性格特征和对话风格
- 兴趣爱好和专业领域
- 语言习惯和表达方式

#### 2. 扩展功能模块
每个功能模块都是独立的，可以：
```python
# 添加新的情绪类型
# function/emotion/emotion_utils.py
def add_custom_emotion(keyword, emotion_type):
    # 自定义情绪识别逻辑
    pass

# 添加新的记忆类型
# function/memory/memory_tools.py
def add_memory_type(memory_type, handler):
    # 自定义记忆处理逻辑
    pass
```

#### 3. 更换AI模型
1. 下载其他GGUF格式模型（如Llama、ChatGLM等）
2. 修改配置文件中的模型路径
3. 调整模型参数（温度、Top-P等）

#### 4. 自定义数据库结构
修改 `db/schema_output.sql` 添加新表：
```sql
CREATE TABLE custom_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    custom_field TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### API集成

#### REST API 接口
当使用API模式启动时，可以通过HTTP接口集成：
```python
import requests

# 发送聊天请求
response = requests.post("http://127.0.0.1:8000/v1/completions", 
    json={
        "prompt": "你好，小星",
        "max_tokens": 256,
        "temperature": 0.7
    }
)
```

#### Python SDK 集成
```python
from function.memory.memory import Memory
from function.emotion.emotion_utils import EmotionTracker

# 直接使用内部API
memory = Memory()
emotion_tracker = EmotionTracker()

# 添加记忆
memory.add(chat_log_id=1, keyword="喜好", value="喜欢音乐")

# 分析情绪
emotion, keyword = emotion_tracker.detect_emotion("今天很开心")
```

### 性能优化建议

#### 1. 硬件优化
- **GPU加速**：安装CUDA版本的llama-cpp-python
- **内存优化**：调整模型上下文窗口大小
- **存储优化**：使用SSD硬盘提高数据库性能

#### 2. 软件优化
- **模型量化**：使用更小的量化模型（Q4_0, Q5_K_M等）
- **缓存策略**：启用模型缓存减少重复加载
- **并发控制**：限制同时处理的对话数量

#### 3. 数据库优化
```sql
-- 添加索引优化查询
CREATE INDEX idx_chat_user_time ON chat_log(role, created_at);
CREATE INDEX idx_memory_keyword ON memory(keyword);

-- 定期清理旧数据
DELETE FROM chat_log WHERE created_at < date('now', '-30 days');
```

### 部署建议

#### 1. 开发环境
- 使用Python虚拟环境隔离依赖
- 启用调试模式查看详细日志
- 使用代码热重载提高开发效率

#### 2. 生产环境
- 使用llama.cpp API模式提高稳定性
- 配置自动重启脚本
- 设置日志轮转和监控

#### 3. 容器化部署
```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "main_chat.py"]
```

## 🤝 贡献指南

### 如何参与贡献

#### 1. 代码贡献
1. Fork 本项目到你的GitHub账户
2. 创建功能分支：`git checkout -b feature/new-feature`
3. 提交代码：`git commit -m "Add new feature"`
4. 推送分支：`git push origin feature/new-feature`
5. 创建 Pull Request

#### 2. 问题反馈
- 使用GitHub Issues报告Bug
- 提供详细的错误信息和复现步骤
- 建议改进功能和新特性

#### 3. 文档改进
- 完善README和代码注释
- 添加使用示例和教程
- 翻译文档到其他语言

#### 4. 测试贡献
- 在不同环境下测试项目
- 报告兼容性问题
- 提供性能测试报告

### 开发规范

#### 代码风格
- 使用Python PEP 8编码规范
- 添加详细的函数和类注释
- 使用有意义的变量和函数名

#### 提交规范
```
feat: 添加新功能
fix: 修复Bug
docs: 更新文档
style: 代码格式调整
refactor: 代码重构
test: 添加测试
chore: 维护性工作
```

#### 测试要求
- 新功能必须包含单元测试
- 确保所有测试通过
- 测试覆盖率不低于80%

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

本项目基于 MIT 许可证开源。

## 📞 联系方式

- **GitHub**: [@wilsonnnnnd](https://github.com/wilsonnnnnd)
- **项目地址**: [xiaoxingAI_Chat](https://github.com/wilsonnnnnd/xiaoxingAI_Chat)
- **问题反馈**: [Issues](https://github.com/wilsonnnnnd/xiaoxingAI_Chat/issues)
- **功能建议**: [Discussions](https://github.com/wilsonnnnnd/xiaoxingAI_Chat/discussions)

## 🙏 致谢

### 开源项目
- **[llama.cpp](https://github.com/ggerganov/llama.cpp)**: 高性能的 LLaMA 推理引擎
- **[Qwen](https://github.com/QwenLM/Qwen)**: 阿里云通义千问大语言模型
- **[llama-cpp-python](https://github.com/abetlen/llama-cpp-python)**: Python绑定库
- **[edge-tts](https://github.com/rany2/edge-tts)**: Microsoft Edge 语音合成库

### 特别感谢
- 所有参与测试和反馈的用户
- 开源社区的贡献者们
- AI 技术的研究者和开发者

## 📈 项目统计

[![GitHub stars](https://img.shields.io/github/stars/wilsonnnnnd/xiaoxingAI_Chat?style=social)](https://github.com/wilsonnnnnd/xiaoxingAI_Chat/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/wilsonnnnnd/xiaoxingAI_Chat?style=social)](https://github.com/wilsonnnnnd/xiaoxingAI_Chat/network)
[![GitHub issues](https://img.shields.io/github/issues/wilsonnnnnd/xiaoxingAI_Chat)](https://github.com/wilsonnnnnd/xiaoxingAI_Chat/issues)
[![GitHub license](https://img.shields.io/github/license/wilsonnnnnd/xiaoxingAI_Chat)](https://github.com/wilsonnnnnd/xiaoxingAI_Chat/blob/main/LICENSE)

## 🚀 未来规划

### 近期计划 (v2.0)
- [ ] 支持多用户会话管理
- [ ] Web界面开发
- [ ] 移动端应用
- [ ] 更多语音角色选择

### 中期规划 (v3.0)
- [ ] 多模态支持（图像理解）
- [ ] 插件系统架构
- [ ] 云端同步功能
- [ ] 多语言国际化

### 长期规划 (v4.0+)
- [ ] 自主学习能力增强
- [ ] 专业领域知识扩展
- [ ] 虚拟形象集成
- [ ] AR/VR 交互支持

---

**最后提醒**：首次使用前请确保按照安装配置步骤完成所有设置，特别是模型文件的下载和数据库的初始化。小星需要一些时间来学习和适应你的聊天习惯，使用得越久，她会变得越聪明！🌟

**享受与小星的愉快聊天时光吧！** ✨