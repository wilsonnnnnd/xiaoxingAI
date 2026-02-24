import os

# 获取项目根路径
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_DIR = os.path.join(BASE_DIR, "config")
MEMORY_DIR = os.path.join(BASE_DIR, "memory")
AUDIO_DIR = os.path.join(MEMORY_DIR, "audio")
REPORT_DIR = os.path.join(MEMORY_DIR, "report")

# Database connection URL (PostgreSQL). Can be overridden by the environment variable.
# Example: postgresql://admin:admin123@localhost:5432/xiaoXing_Db
DATABASE_URL = os.environ.get(
	"DATABASE_URL",
	"postgresql://admin:admin123@localhost:5432/xiaoXing_Db"
)

# json configuration files
PROMPT_PATH = os.path.join(CONFIG_DIR, "prompt.txt")
# storage and logs

CHART_OUTPUT_DIR = os.path.join(REPORT_DIR, "charts")
MARKDOWN_DIR = os.path.join("data", "markdown")

# API
URL="http://127.0.0.1:8000"
API_URL = URL + "/v1/completions"


# token limits
MAX_SUMMARY_TOKENS = 300
MAX_HISTORY_ROUNDS = 5

# chat configuration
HISTORY_LIMIT = 5
MAX_HISTORY = 20
HISTORY_LIMIT_FOR_SUMMARY = 10
MAX_AUDIO_FILES = 100

# audio settings
MIN_AUDIO_FILE_SIZE = 1024  # bytes

# TTS config
DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"
DEFAULT_STYLE = "friendly"
DEFAULT_RATE = "0%"
DEFAULT_VOLUME = "0dB"

# word cloud settings
WORD_CLOUD_WIDTH = 800
WORD_CLOUD_HEIGHT = 400
WORD_CLOUD_COLOR = "white"
WORD_FONT_PATH = "simhei.ttf" # 中文字体路径

# emotion tracking
FUZZY_THRESHOLD = 0.75  # 模糊匹配相似度阈值


# 每日调度时间（24小时制）
SUMMARY_SCHEDULE_TIME = "23:00"
SPEECH_REPORT_SCHEDULE_TIME = "23:30"