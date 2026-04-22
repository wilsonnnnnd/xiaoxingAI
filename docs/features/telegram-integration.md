# Telegram Integration

## What It Does

Telegram integration delivers notifications and supports interactive message flows related to the email and outgoing workflow system.

## Why It Exists

Telegram is the primary outbound notification surface for the product.

## Backend Architecture

- telegram domain logic under `app/domains/telegram/`
- telegram-related route helpers under `app/api/routes/telegram_tools.py`
- callback signing and webhook support in shared infrastructure

User bot management is exposed through user and bot APIs.

## Frontend Architecture

- bot management lives in user management and settings surfaces
- Gmail and dashboard views consume Telegram-related worker status information where relevant

## Data Flow

1. User binds a Telegram bot and chat
2. Email workflow produces a notification or action flow
3. Telegram domain sends the message
4. Optional callbacks and follow-up actions are handled through signed interaction paths

## Important Design Decisions

- bots are user-scoped
- webhook mode and polling mode are both supported
- callback signing exists to protect interactive actions
