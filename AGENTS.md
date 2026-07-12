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

The active production domains for this project are
`libabite-order.thatcanadian.dev` for customer ordering and
`libabite-work.thatcanadian.dev` for staff operations.

The apex domain `thatcanadian.dev` is intentionally reserved for a separate
site. Do not attach this project to it. The former staff hostname
`app.thatcanadian.dev` is also no longer assigned to this project.

`libabite.nl` is the old/currently used external system that the team wants to
improve on and eventually stop using. Do not assume `libabite.nl` is the domain
where new development should be deployed or verified unless the user explicitly
says so.
