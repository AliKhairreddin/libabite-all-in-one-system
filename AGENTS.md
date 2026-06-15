# Agent Notes

## User Preference

When the user requests new features, additions, redesigns, or other changes, do
not assume old behavior, layout, structure, or implementation details must be
preserved. Treat the request as permission to rethink or replace existing pieces
when that better serves the new direction.

Preserve existing behavior only when the user explicitly asks for it, when a
security, data-integrity, or compatibility requirement clearly depends on it, or
when changing it would obviously undermine the requested outcome.

After completing code changes for this project, default to pushing the code and
deploying both Convex and Cloudflare without waiting for a separate follow-up
message. Skip this only when the user explicitly says not to push or deploy, or
when verification fails and deploying would be unsafe.

## Domain Context

The active development/current system domain for this project is
`thatcanadian.dev`.

`libabite.nl` is the old/currently used external system that the team wants to
improve on and eventually stop using. Do not assume `libabite.nl` is the domain
where new development should be deployed or verified unless the user explicitly
says so.
