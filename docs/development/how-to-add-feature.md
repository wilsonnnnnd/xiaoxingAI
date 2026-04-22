# How To Add Feature

## Goal

This project favors incremental, domain-aware feature work.

## Recommended Process

1. Identify whether the feature is:
   - public-site facing
   - user-facing product functionality
   - admin-only functionality
   - backend infrastructure or workflow support
2. Decide the backend ownership:
   - route
   - domain
   - workflow
   - repository
3. Add or extend frontend feature modules under `frontend/src/features/`
4. Update i18n catalogs if UI strings are added
5. Update documentation under `docs/`

## Placement Guidelines

- new endpoints belong in the relevant route module
- reusable runtime logic belongs in a domain
- multi-step orchestration belongs in a workflow
- SQL belongs in repositories
- page-specific frontend code belongs in its feature folder

## Documentation Requirement

Every meaningful feature addition should update:

- relevant feature documentation
- affected API documentation
- deployment or environment variable docs if runtime configuration changed
