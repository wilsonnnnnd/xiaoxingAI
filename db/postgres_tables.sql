-- SQL: create api_calls and logs tables for xiaoxingDb (Postgres)

CREATE TABLE IF NOT EXISTS api_calls (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_input TEXT,
  prompt TEXT,
  response TEXT,
  response_tokens INTEGER,
  model VARCHAR(128),
  duration_ms INTEGER,
  status VARCHAR(64),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_api_calls_created_at ON api_calls(created_at);

CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  level VARCHAR(20),
  message TEXT,
  context JSONB
);

CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);


-- audio usage: records when audio is synthesized/played
CREATE TABLE IF NOT EXISTS audio_usage (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  text TEXT,
  duration_ms INTEGER,
  voice VARCHAR(128),
  style VARCHAR(128),
  rate VARCHAR(32),
  volume VARCHAR(32),
  length_bytes INTEGER,
  file_path TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_audio_usage_created_at ON audio_usage(created_at);

-- audio_tone: records tone classification associated with an audio_usage row
CREATE TABLE IF NOT EXISTS audio_tone (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  audio_id INTEGER NOT NULL,
  tone VARCHAR(128),
  score REAL,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_audio_tone_audio_id ON audio_tone(audio_id);

