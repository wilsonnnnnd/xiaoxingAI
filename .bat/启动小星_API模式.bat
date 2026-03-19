@echo off
chcp 65001 >nul
title 启动小星 - llama.cpp API（winget 版 llama-server / CUDA-Vulkan）

setlocal

:: 模型第一片（确保 00002~00004 同目录）
set "MODEL_PATH=E:\AI\models\Qwen_Qwen3-Coder-Next-GGUF_Qwen3-Coder-Next-Q5_K_M_Qwen3-Coder-Next-Q5_K_M-00001-of-00004.gguf"

:: 用 winget 安装的 llama-server（版本 8140）
set "SERVER_EXE=llama-server"

set "HOST=127.0.0.1"
set "PORT=8000"
set "CTX=3072"
set "THREADS=16"
set "NGL=10"

set "LOG_FILE=E:\AI\models\llama_server_log.txt"

:: 检查
where %SERVER_EXE% >nul 2>&1
if errorlevel 1 (
  echo ❌ 未找到 llama-server（请确认 winget 安装成功，且在 PATH）
  pause & exit /b
)

if not exist "%MODEL_PATH%" (
  echo ❌ 模型缺失：%MODEL_PATH%
  echo    请确认 00001~00004 都在 E:\AI\models
  pause & exit /b
)

if exist "%LOG_FILE%" del /f /q "%LOG_FILE%" >nul 2>&1

echo [INFO] llama-server: %SERVER_EXE%
echo [INFO] model: %MODEL_PATH%
echo [INFO] url:  http://%HOST%:%PORT%
echo [INFO] args: -c %CTX% -t %THREADS% -ngl %NGL%
echo [INFO] log:  %LOG_FILE%

:: 用 /k 防止窗口瞬间关闭，便于看到报错；稳定后可改 /c
start "" cmd /k ^
""%SERVER_EXE%" --host %HOST% --port %PORT% -m "%MODEL_PATH%" -c %CTX% -t %THREADS% -ngl %NGL% --parallel 1 1>>"%LOG_FILE%" 2>>&1"

echo.
echo ✅ 已启动（若打不开请看日志末尾）
powershell -NoProfile -Command "Get-Content -Path '%LOG_FILE%' -Tail 60"
echo.
pause