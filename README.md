# 🌟 Xiaoxing — AI Chat Assistant

Xiaoxing is a local-first AI chat assistant built on top of llama.cpp and quantized LLMs. It provides multi-turn conversation, persistent memory, emotion analysis, text-to-speech, and conversation summarization. The project is designed for privacy-conscious local deployments and developer customization.

## Project Overview

Xiaoxing aims to be a friendly, customizable, and extendable chat companion. It focuses on:

- Emotional companionship and conversational context
- Personalization through persistent memory and user preferences
- Multi-modal interactions: text and TTS playback
- Local deployment to protect user privacy

## Key Features

- Multi-turn intelligent dialogue with context management
- Persistent memory and user preference storage (PostgreSQL)
- Emotion/tone analysis and mapping to TTS voice style
- Text-to-speech using Microsoft Edge TTS (`edge-tts`) with playback and fallback players
- Audio usage logging and replay features
- Multiple startup modes (Python API, native llama.cpp server, CLI)

## Architecture & Technologies

- Model: Qwen-1.5 / other quantized GGUF models (example in `llama.cpp/models/`)
- Engine: `llama.cpp` for efficient local inference
- Backend: Python, AsyncIO, PostgreSQL for persistence
- TTS: `edge-tts` integration for voice synthesis

## Typical Use Cases

- Personal assistant for daily conversation and reminders
- Learning partner for Q&A and brainstorming
- Research and development of local chat systems
- Emotional companionship and long-term memory tracking

## Highlights

- Local-only operation (no model or data upload by default)
- Easy to customize and extend — modular code structure under `function/`
- Multiple launch options for development, testing, and production

## Technical Summary

- Model size (example): ~4–8 GB (quantized)
- Recommended RAM: 8 GB or more
- Typical local response: 1–3 seconds (depends on CPU/GPU)
- Primary language: Chinese-first, multi-language supported

## Repository Layout

```
xiaoxing/                    # project root
├── config/                   # configuration and prompts
├── db/                       # database scripts and connection
├── function/                 # modular features: audio, log, nlp, memory
├── llama.cpp/                # inference engine and model artifacts
├── memory/                   # runtime data and generated audio
├── tools/                    # test and utility scripts
├── cache/                    # model caches
├── main_chat.py              # main application entry point
├── keep_awake.py             # helper to prevent system sleep
├── requirements.txt          # Python dependencies
├── README.md                 # this file
└── server_log.txt            # example runtime logs
```

## Requirements

- Python 3.8+ (3.10+ recommended)
- PostgreSQL (or change to another supported datastore)
- Optional: NVIDIA GPU + CUDA for accelerated inference

Recommended Python packages (see `requirements.txt`):

- `llama-cpp-python` (or local `llama.cpp` executable)
- `edge-tts` for TTS
- `psycopg2-binary` for PostgreSQL

## Quick Installation

1. Clone the repository:

```bash
git clone https://github.com/wilsonnnnnd/xiaoxingAI_Chat.git
cd xiaoxingAI_Chat
```

2. Install Python dependencies:

```bash
pip install -r requirements.txt
```

3. Place your quantized model file under `llama.cpp/models/` (example name `qwen1_5-7b-chat-q5_k_m.gguf`).

4. (Optional) Build `llama.cpp` if you plan to run the native server or CLI.

5. Initialize the database (if using PostgreSQL):

```bash
python db/init_db.py
```

## How to Start

Three common modes are provided:

1. Python API mode (recommended for convenience and GPU support)

```bash
python -m llama_cpp.server \
  --model PATH/TO/YOUR_MODEL.gguf \
  --host 127.0.0.1 \
  --port 8000 \
  --n_ctx 4096 \
  --n_gpu_layers 100 \
  --n_threads 16 \
  --chat_format chatml \
  --cache true
```

2. Native `llama.cpp` server mode (compiled executable)

```bash
llama-server.exe --host 127.0.0.1 --port 8000 --model "PATH/TO/MODEL" --ctx-size 8192 --mlock --threads 4
```

3. Command-line interactive mode (CLI)

```bash
llama-cli.exe -m "PATH/TO/MODEL" -i -n 512 -c 8192 --system-prompt-file "PROMPT_FILE" --top_k 50 --top_p 0.9 --temp 0.7
```

Choose the startup mode that fits your environment and use case. The Python API mode is quick for development and supports GPU acceleration via `llama-cpp-python`.

## Configuration

- Main configuration lives in the `config/` folder. Edit `config.py` and `prompt.txt` to customize system prompts, personality, and behavior.
- Database connection and other secrets are typically configured via environment variables (for example `DATABASE_URL`).

## Logs and Monitoring

- Application and audio events are logged under `function/log/` and persisted to the configured database tables. Use `server_log.txt` as a runtime example.

## Development & Testing

- `tools/integration_test.py` provides example integration checks.
- Use the provided `.bat` scripts in the repository root for quick local starting on Windows.

## Extending Xiaoxing

- Add new modules under `function/` (e.g., `function/nlp/`, `function/audio/`).
- Integrate a web UI or other frontends by adding a new service that calls the local API.

## Troubleshooting

- If the model fails to load, verify the model path and file format (GGUF for quantized models).
- For performance issues, verify CPU/GPU drivers and available RAM. Consider reducing context size or enabling caching.

## Contributing

Contributions are welcome. Open issues and pull requests for bug fixes, feature enhancements, or documentation improvements.

## License

This project follows the repository's top-level license. Check the `LICENSE` file in `llama.cpp/` and the repository root for details.

---

If you would like a more concise README, a translated version targeted for end users, or a version tailored for deployment guides, tell me which style you prefer and I will update this file accordingly.
