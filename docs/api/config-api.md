# Config API

## Purpose

The config API exposes runtime configuration used by the settings experience, including the centralized pricing configuration.

## Main Endpoints

### General config

- `GET /api/config`
- `POST /api/config`

### Pricing config

- `GET /api/config/pricing`
- `POST /api/config/pricing`

## Pricing Behavior

- pricing config is centralized
- admin settings UI reads and writes through these endpoints
- fallback defaults are available when no custom pricing is configured

## Related Docs

- [Pricing system](../features/pricing-system.md)
