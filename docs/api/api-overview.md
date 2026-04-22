# API Overview

## Purpose

The API serves both the React frontend and external developers who need to understand the current backend surface.

## Base Structure

Primary API prefix:

- `/api`

Main categories:

- authentication
- user and admin dashboards
- user, invite, and bot management
- Gmail and worker operations
- processed email and inbox data
- config and pricing management
- prompts and reply-format management

## Auth Model

- JWT bearer authentication
- current-user and admin dependencies enforced on protected routes

## Main Documentation Entry Points

- [Admin API](admin-api.md)
- [User API](user-api.md)
- [Dashboard API](dashboard-api.md)
- [Config API](config-api.md)
- [Gmail API](gmail-api.md)

## Notes

- some legacy-friendly endpoints still exist for compatibility
- this documentation focuses on the current maintained surface rather than every historical alias
