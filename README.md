# FleetFlow

Multi-tenant car rental and fleet management platform built with Spring Boot, PostgreSQL and React.

**Status:** Phase 2 complete

## Tech Stack

- Backend: Java 21, Spring Boot 3.x, Maven, Spring Security, JWT, Spring Data JPA, PostgreSQL, Flyway
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Infrastructure: Docker, Docker Compose

## Project Milestones

- [ ] Phase 1 – Planning and setup
- [ ] Phase 2 – Spring Boot and database
- [ ] Phase 3 – Auth and tenants
- [ ] Phase 4 – Vehicles and customers
- [ ] Phase 5 – Bookings
- [ ] Phase 6 – Contracts and pricing
- [ ] Phase 7 – Billing and payments
- [ ] Phase 8 – Maintenance
- [ ] Phase 9 – Dashboard and reports
- [ ] Phase 10 – React frontend
- [ ] Phase 11 – Testing and hardening
- [ ] Phase 12 – Docker, docs, polish

## Git Workflow

- Keep `main` working.
- Use `feature/<name>`, `fix/<name>`, and `docs/<name>` branches.
- Starting in Phase 2, open a Pull Request for each branch instead of committing directly to `main`.
- Commit format: `type: short present-tense description`.
- Allowed types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.
- Never commit secrets.
- Never edit an applied Flyway migration; create a new migration instead.

