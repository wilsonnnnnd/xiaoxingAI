@echo off
chcp 65001 >nul
title 启动模型 - llama.cpp API（winget 版 llama-server / CUDA-Vulkan）

setlocal

:: ===== 主脑 =====
set "MODEL1_PATH=E:\AI\models\Qwen2.5-14b-instruct-q4_k_m\Qwen_Qwen2.5-14B-Instruct-GGUF_qwen2.5-14b-instruct-q4_k_m-00001-of-00003.gguf"
set "PORT1=8001"
set "LOG1=E:\AI\models\llama_server_1.log"


:: 用 winget 安装的 llama-server（版本 8140）
set "SERVER_EXE=llama-server"
set "HOST=127.0.0.2"
set "CTX=3072"
set "THREADS=16"
set "NGL=30"

:: 检查
where %SERVER_EXE% >nul 2>&1
if errorlevel 1 (
  echo ❌ 未找到 llama-server（请确认 winget 安装成功，且在 PATH）
  pause & exit /b
)

if not exist "%MODEL1_PATH%" (
  echo ❌ 模型1缺失：%MODEL1_PATH%
  pause & exit /b
)

if exist "%LOG1%" del /f /q "%LOG1%" >nul 2>&1

echo [INFO] llama-server: %SERVER_EXE%
echo [INFO] model1: %MODEL1_PATH%
echo [INFO] url1:   http://%HOST%:%PORT1%
echo [INFO] log1:   %LOG1%
echo [INFO] args:   -c %CTX% -t %THREADS% -ngl %NGL%

:: 用 /k 防止窗口瞬间关闭，便于看到报错；稳定后可改 /c
start "" cmd /k ^
""%SERVER_EXE%" --host %HOST% --port %PORT1% -m "%MODEL1_PATH%" -c %CTX% -t %THREADS% -ngl %NGL% --parallel 1 1>>"%LOG1%" 2>>&1"


echo.
echo ✅ 已启动 1 个模型（若打不开请看各自日志末尾）
echo [TAIL] 模型1日志
powershell -NoProfile -Command "Get-Content -Path '%LOG1%' -Tail 20"
echo.
pause