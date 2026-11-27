# FleetFlow API Design

**Status:** Phase 1 API contract proposal  
**Base path:** `/api/v1`  
**Format:** JSON over HTTPS  
**Audience:** Frontend and backend developers

This document describes the planned REST API. It is a design contract, not proof that the endpoints have been implemented or tested. Names and workflows should be reviewed alongside `architecture.md`, `database-erd.md`, and `permissions-matrix.md` before implementation.

## 1. Consistency decisions

- The five main organization roles are `SUPER_ADMIN`, `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, `STAFF`, and `VIEWER`.
- The marketplace uses two specialized roles: `CAR_OWNER` and `CAB_DRIVER`. They are separate primary roles with `car_owners` and `driver_profiles` records, not aliases for staff roles. They do not automatically receive organization-administration permissions.
- The current ERD assumes one primary role per user through `users.role_id`. A user who needs both staff and marketplace roles will require a later ERD change to a many-to-many `user_roles` model.
- Role names in the existing ERD's seed examples (`PLATFORM_ADMIN`, `ORG_ADMIN`, `FLEET_OPERATOR`) are older names. For this API proposal, use the seven names above consistently; update the ERD seed examples before implementation. `SUPER_ADMIN` is the platform-level role.
- Normal organization data is isolated by `organization_id`. The backend derives organization scope from the authenticated user; clients must not choose another tenant by sending an arbitrary `organization_id`.
- Public marketplace search may show approved listing fields across organizations. Offer records remain private to the driver, the owner of the listed car, and explicitly authorized participants.
- An accepted rental offer may create one booking. The API must prevent the same accepted offer from creating multiple bookings.
- All money fields use decimal values and an explicit currency. Examples use Indian rupees (`INR`, shown as ₹ in descriptions); do not use floating-point types for money in the database.

## 2. API conventions

### 2.1 Base URL and content

- Local development base URL: `http://localhost:8080/api/v1` (HTTPS is required outside local development).
- Request and response bodies use `application/json`, except file upload endpoints which use `multipart/form-data`.
- Send `Accept: application/json`.
- Send `Content-Type: application/json` for JSON request bodies.
- Use UTF-8.
- Use UUIDs as resource IDs in paths.
- Use ISO 8601 timestamps with a timezone, preferably UTC, for example `2026-11-27T10:30:00Z`.
- Use `YYYY-MM-DD` for date-only fields.
- API responses should not expose password hashes, refresh-token secrets, provider credentials, internal stack traces, or private details from another organization.

### 2.2 Authentication

Protected endpoints require:

`Authorization: Bearer <access_token>`

Access tokens should be short-lived. Refresh tokens should be longer-lived, stored securely by the client, rotated on refresh, and revocable on logout. Never put tokens in URLs or logs.

Public registration must not allow a caller to assign themselves `SUPER_ADMIN`, `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, `STAFF`, or `VIEWER`. Organization staff accounts should be created by an authorized organization administrator or invitation workflow. Public self-registration may create only an allowed marketplace account type (`CAR_OWNER` or `CAB_DRIVER`) according to product policy.

### 2.3 Pagination

Collection endpoints should support page-based pagination:

| Parameter | Default | Rule |
|---|---:|---|
| `page` | `0` | Zero-based page index; must be `0` or greater |
| `size` | `20` | Must be between `1` and `100` |
| `sort` | Endpoint default | `field,direction`, for example `createdAt,desc`; only documented fields are allowed |

Example:

`GET /api/v1/bookings?page=0&size=20&sort=startAt,asc`

Paginated response shape:

```json
{
  "content": [],
  "page": 0,
  "size": 20,
  "totalElements": 0,
  "totalPages": 0,
  "hasNext": false
}
```

For endpoints that return a small fixed summary, pagination is not required. For very large audit/event feeds, cursor pagination may be added later without changing ordinary collection endpoints.

### 2.4 Sorting and filtering

- Each list endpoint documents the filters it supports. Unknown or malformed filters should return `400 Bad Request` rather than being silently ignored.
- Common filters may include `status`, `createdFrom`, `createdTo`, `organizationId` (only for authorized platform-level operations), and resource-specific IDs.
- Tenant endpoints must still apply server-side organization scope even if a filter is provided.
- Sort only by an allowlist of fields; never concatenate user-provided sort text directly into SQL.
- Use exact status values defined by the domain model. Do not treat arbitrary status text as valid.

### 2.5 Standard success responses

| Status | Meaning | Typical use |
|---|---|---|
| `200 OK` | Request succeeded | Read, update, login, refresh, state transition |
| `201 Created` | Resource created | Registration, vehicle, booking, offer, payment/refund request |
| `202 Accepted` | Work accepted for later processing | Payment/refund provider operation when asynchronous |
| `204 No Content` | Succeeded with no body | Logout, delete where appropriate |
| `206 Partial Content` | Partial file/media response | Only if a future media-streaming endpoint needs byte ranges |

For create responses, return the created resource and its ID. For updates, return the updated resource unless the endpoint is explicitly a `204` action.

### 2.6 Standard error response

Use one consistent error shape for API errors:

```json
{
  "timestamp": "2026-11-27T10:30:00Z",
  "status": 400,
  "code": "VALIDATION_FAILED",
  "message": "One or more fields are invalid.",
  "path": "/api/v1/vehicles",
  "fieldErrors": [
    {
      "field": "dailyRate",
      "code": "MUST_BE_POSITIVE",
      "message": "Daily rate must be greater than zero."
    }
  ],
  "traceId": "8f10c8b4a35d4a8e"
}
```

Rules:
- `code` is a stable machine-readable value; clients should not depend on the exact human-readable `message`.
- `fieldErrors` may be omitted when there are no field-level errors.
- `traceId` helps support teams find a server log entry; it must not reveal sensitive data.
- Never return exception stack traces or SQL details to clients.
- Use `application/problem+json` only if the project explicitly chooses RFC 9457 later; until then, use the JSON shape above consistently.

### 2.7 Standard HTTP status codes

| Status | Error code example | When to use |
|---|---|---|
| `400 Bad Request` | `VALIDATION_FAILED`, `INVALID_FILTER`, `INVALID_STATE_TRANSITION` | Malformed input or invalid field/state |
| `401 Unauthorized` | `AUTHENTICATION_REQUIRED`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS` | Missing or invalid authentication |
| `403 Forbidden` | `INSUFFICIENT_PERMISSION` | Authenticated user lacks the required role/action |
| `404 Not Found` | `RESOURCE_NOT_FOUND` | Resource does not exist or is not visible to the caller |
| `409 Conflict` | `BOOKING_OVERLAP`, `OFFER_ALREADY_DECIDED`, `DUPLICATE_RESOURCE`, `IDEMPOTENCY_CONFLICT` | Conflict with current resource state or unique rule |
| `410 Gone` | `REFRESH_TOKEN_REVOKED` | A refresh token or resource is permanently no longer usable, if the API distinguishes this from 401 |
| `413 Payload Too Large` | `FILE_TOO_LARGE` | Upload exceeds configured limit |
| `415 Unsupported Media Type` | `UNSUPPORTED_MEDIA_TYPE` | Wrong request content type |
| `422 Unprocessable Content` | `BUSINESS_RULE_FAILED` | Optional choice for syntactically valid input that violates a domain rule; use consistently if adopted |
| `429 Too Many Requests` | `RATE_LIMITED` | Rate limit reached, especially login/refresh |
| `500 Internal Server Error` | `INTERNAL_ERROR` | Unexpected server failure |
| `503 Service Unavailable` | `DEPENDENCY_UNAVAILABLE` | A required dependency is temporarily unavailable |

Use `404` rather than confirming that a private resource exists in another tenant. Use `409` for concurrent booking/offer conflicts.

## 3. Role abbreviations used in endpoint tables

| Abbreviation | Role |
|---|---|
| `PUBLIC` | No login required; rate limits and input validation still apply |
| `SUPER_ADMIN` | Platform-level administration; no automatic unrestricted access to tenant business data |
| `ORGANIZATION_ADMIN` | Manages users and settings in their own organization |
| `FLEET_MANAGER` | Manages permitted fleet operations in their own organization |
| `STAFF` | Performs assigned operational tasks in their own organization; sensitive actions are restricted |
| `VIEWER` | Read-only access to permitted organization data |
| `CAR_OWNER` | Manages their own owner profile, listings, and offers for their own vehicles |
| `CAB_DRIVER` | Searches published listings and manages their own offers |

Role checks are necessary but not sufficient. Every operation must also check ownership, organization scope, resource state, and any applicable relationship/management agreement. A `SUPER_ADMIN` may manage platform configuration and organizations, but must not automatically read private tenant records without a separate audited support permission.

## 4. Authentication endpoints

| Method | Path | Required role | Description |
|---|---|---|---|
| `POST` | `/auth/register` | `PUBLIC` | Register an allowed marketplace account type; never accept a privileged role from an untrusted client |
| `POST` | `/auth/login` | `PUBLIC` | Verify credentials and return access token plus refresh token |
| `POST` | `/auth/refresh` | `PUBLIC` with valid refresh token | Rotate refresh token and return a new access token |
| `POST` | `/auth/logout` | Authenticated user | Revoke the current refresh-token session; normally returns `204` |
| `GET` | `/auth/me` | Any authenticated user | Return the current user's safe profile, primary role, and organization context |

Optional later endpoints: `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/verify-email`, and `GET /auth/sessions`. Add these only when their workflows are designed.

## 5. Vehicles

| Method | Path | Required role | Description |
|---|---|---|---|
| `GET` | `/vehicles` | `SUPER_ADMIN`, `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, `STAFF`, `VIEWER` | List vehicles visible in the caller's authorized scope; support status, make, model, and registration filters |
| `POST` | `/vehicles` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER` | Create a vehicle for the caller's organization or an explicitly permitted owner profile |
| `GET` | `/vehicles/{vehicleId}` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, `STAFF`, `VIEWER`; owning `CAR_OWNER` where applicable | Get vehicle details after scope/ownership check |
| `PATCH` | `/vehicles/{vehicleId}` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`; owning `CAR_OWNER` for permitted owner fields | Update editable vehicle fields |
| `DELETE` | `/vehicles/{vehicleId}` | `ORGANIZATION_ADMIN` | Archive/remove a vehicle only when no active booking, contract, payment obligation, or required history prevents deletion |
| `PATCH` | `/vehicles/{vehicleId}/status` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER` | Change permitted operational status; validate current state |
| `GET` | `/vehicles/{vehicleId}/availability` | Authenticated user; published public listing availability may be public | Check availability for a date/time range without exposing private bookings |

Prefer archive/status transitions over hard deletion for vehicles with business history.

## 6. Customers

| Method | Path | Required role | Description |
|---|---|---|---|
| `GET` | `/customers` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, `STAFF`, `VIEWER` | List customers in the caller's organization; `VIEWER` is read-only |
| `POST` | `/customers` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, `STAFF` | Create a customer record in the caller's organization |
| `GET` | `/customers/{customerId}` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, `STAFF`, `VIEWER` | Read a customer in the caller's organization |
| `PATCH` | `/customers/{customerId}` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, `STAFF` | Update permitted customer fields |
| `DELETE` | `/customers/{customerId}` | `ORGANIZATION_ADMIN` | Deactivate/anonymize where lawful; do not break booking, contract, or payment history |

Customer records are tenant-scoped. Do not allow a caller to attach a customer from another organization to a booking.

## 7. Bookings

| Method | Path | Required role | Description |
|---|---|---|---|
| `GET` | `/bookings` | `SUPER_ADMIN` for authorized support scope; `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, `STAFF`, `VIEWER` within own organization | List bookings visible to the caller; apply filters and pagination |
| `POST` | `/bookings` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, `STAFF`; controlled marketplace flow after accepted offer | Create a booking after validating vehicle, customer/driver, dates, availability, and tenant relationships |
| `GET` | `/bookings/{bookingId}` | Authorized organization roles for own organization; involved party for their own booking where self-service is enabled | Read a booking |
| `PATCH` | `/bookings/{bookingId}` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, `STAFF` for permitted fields | Update permitted booking details before state restrictions apply |
| `POST` | `/bookings/{bookingId}/confirm` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER` | Confirm a pending booking after availability and business checks |
| `POST` | `/bookings/{bookingId}/cancel` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, `STAFF`; involved party only where policy allows | Cancel a booking and calculate any policy-based charges/refund eligibility |
| `POST` | `/bookings/{bookingId}/start` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, authorized `STAFF` | Mark handover/start after required checks |
| `POST` | `/bookings/{bookingId}/complete` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, authorized `STAFF` | Mark return/completion and capture return details |
| `GET` | `/bookings/{bookingId}/history` | Same scope as booking read | Read audit/status history visible to caller |

The booking service must prevent overlapping active bookings for the same vehicle, including concurrent requests. If the booking comes from an accepted rental offer, store the `rental_offer_id` and enforce uniqueness so one offer cannot create multiple bookings.

## 8. Contracts

| Method | Path | Required role | Description |
|---|---|---|---|
| `GET` | `/contracts` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, `STAFF`, `VIEWER` within own organization; billing read access as assigned | List contracts in authorized scope |
| `POST` | `/contracts` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER` | Create a contract for a valid booking; enforce one contract per booking if that ERD constraint remains |
| `GET` | `/contracts/{contractId}` | Authorized organization roles and involved parties where self-service is enabled | Read contract details |
| `PATCH` | `/contracts/{contractId}` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER` before signing/locking | Update editable draft terms |
| `POST` | `/contracts/{contractId}/send` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER` | Send a draft contract for review/signature |
| `POST` | `/contracts/{contractId}/accept` | The authorized contract party, or organization role explicitly permitted by the workflow | Record acceptance/signature; verify the actor is a party or delegated signer |
| `POST` | `/contracts/{contractId}/cancel` | `ORGANIZATION_ADMIN`; `FLEET_MANAGER` only if policy permits | Cancel only under an allowed state transition and preserve history |
| `GET` | `/contracts/{contractId}/document` | Authorized contract party/organization role | Download the generated contract document if document generation is implemented |

Do not treat `VIEWER` as a signer. Keep contract changes and signatures auditable.

## 9. Billing, payments, and refunds

| Method | Path | Required role | Description |
|---|---|---|---|
| `GET` | `/billing/summary` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER` (summary only), authorized `STAFF`, `VIEWER` (read-only permitted figures) | Get organization-scoped billing totals |
| `GET` | `/payments` | `ORGANIZATION_ADMIN`, authorized `STAFF`, `VIEWER` read-only | List payments in the caller's organization; mask sensitive provider details |
| `POST` | `/payments` | `ORGANIZATION_ADMIN`, authorized billing `STAFF` | Record a payment or initiate provider payment for a valid booking |
| `GET` | `/payments/{paymentId}` | Same authorized payment scope | Read payment details |
| `POST` | `/payments/{paymentId}/confirm` | Server/provider callback or authorized finance workflow | Confirm payment only from a verified provider result or controlled manual confirmation |
| `GET` | `/payments/{paymentId}/refunds` | `ORGANIZATION_ADMIN`, authorized billing `STAFF`, `VIEWER` read-only | List refunds for a payment |
| `POST` | `/payments/{paymentId}/refunds` | `ORGANIZATION_ADMIN`, authorized billing `STAFF` | Request a full or partial refund; validate remaining refundable amount |
| `GET` | `/refunds/{refundId}` | `ORGANIZATION_ADMIN`, authorized billing `STAFF`, `VIEWER` read-only | Read refund status |
| `POST` | `/refunds/{refundId}/approve` | `ORGANIZATION_ADMIN` or specifically authorized finance approver | Approve a requested refund if approval workflow is enabled |
| `POST` | `/refunds/{refundId}/process` | Authorized finance workflow or provider worker | Submit approved refund for processing |
| `POST` | `/refunds/{refundId}/cancel` | `ORGANIZATION_ADMIN`, authorized billing `STAFF` while still cancellable | Cancel an eligible pending refund; preserve the audit trail |

The ERD currently includes payment/refund records but not a separate invoice entity. Do not add `/invoices` endpoints until an invoice table and its lifecycle are added to the ERD. Use idempotency keys for payment creation and provider retries. The cumulative successful refund amount must never exceed the captured/refundable payment amount.

## 10. Maintenance

| Method | Path | Required role | Description |
|---|---|---|---|
| `GET` | `/maintenance` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, authorized `STAFF`, `VIEWER` read-only | List maintenance records in the caller's organization |
| `POST` | `/maintenance` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, authorized maintenance `STAFF` | Create a maintenance record for a vehicle in scope |
| `GET` | `/maintenance/{recordId}` | Same authorized maintenance scope | Read a maintenance record |
| `PATCH` | `/maintenance/{recordId}` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, authorized maintenance `STAFF` | Update notes, schedule, costs, or other permitted fields |
| `POST` | `/maintenance/{recordId}/start` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, authorized maintenance `STAFF` | Mark maintenance as started |
| `POST` | `/maintenance/{recordId}/complete` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, authorized maintenance `STAFF` | Complete work and record completion/odometer details |
| `POST` | `/maintenance/{recordId}/cancel` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER` | Cancel an eligible maintenance task |
| `GET` | `/vehicles/{vehicleId}/maintenance-history` | Authorized roles for that vehicle's organization; owning `CAR_OWNER` for their own vehicle where permitted | Read maintenance history without exposing another tenant's internal notes |

A vehicle under active maintenance should normally be unavailable for new bookings until it is marked ready.

## 11. Dashboard and reports

| Method | Path | Required role | Description |
|---|---|---|---|
| `GET` | `/dashboard/summary` | `SUPER_ADMIN` for platform summary; `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, `STAFF`, `VIEWER` for their permitted organization summary | Return role-appropriate summary cards |
| `GET` | `/reports/vehicles` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, `VIEWER` | Vehicle status/utilization report for the authorized organization |
| `GET` | `/reports/bookings` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, `VIEWER` | Booking counts and trends |
| `GET` | `/reports/revenue` | `ORGANIZATION_ADMIN`, specifically authorized billing `STAFF`, `VIEWER` if financial read access is granted | Revenue and outstanding-payment report |
| `GET` | `/reports/maintenance` | `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, authorized maintenance `STAFF`, `VIEWER` | Maintenance costs and upcoming service report |
| `GET` | `/reports/exports/{reportType}` | `ORGANIZATION_ADMIN`, authorized report users | Export a supported report; validate report type and apply the same tenant scope |

Report responses must state the reporting period and relevant status rules. Do not expose tenant financial totals to another organization. `SUPER_ADMIN` platform metrics should be aggregated by default; tenant-level drill-down requires a separate audited permission.

## 12. Users and roles

| Method | Path | Required role | Description |
|---|---|---|---|
| `GET` | `/users` | `ORGANIZATION_ADMIN`; `SUPER_ADMIN` for platform user administration metadata | List users within the authorized scope |
| `POST` | `/users/invitations` | `ORGANIZATION_ADMIN` | Invite a staff user to their organization with an allowed role |
| `POST` | `/users` | `SUPER_ADMIN` for platform accounts; `ORGANIZATION_ADMIN` for allowed organization users | Create an account only within the caller's allowed scope; prevent privilege escalation |
| `GET` | `/users/{userId}` | `ORGANIZATION_ADMIN` within own organization; `SUPER_ADMIN` for permitted platform metadata; self for `/auth/me` | Read a user profile |
| `PATCH` | `/users/{userId}` | `ORGANIZATION_ADMIN` within own organization; user may update explicitly allowed self-profile fields | Update permitted profile fields |
| `PATCH` | `/users/{userId}/role` | `SUPER_ADMIN` for platform roles; `ORGANIZATION_ADMIN` for allowed roles in own organization | Change role with strict allowlist and audit record |
| `PATCH` | `/users/{userId}/status` | `ORGANIZATION_ADMIN` within own organization; `SUPER_ADMIN` for platform account status | Activate/deactivate an account, not the current last active organization administrator |
| `GET` | `/roles` | `SUPER_ADMIN`, `ORGANIZATION_ADMIN` | List role names and safe descriptions |
| `GET` | `/organizations` | `SUPER_ADMIN` | List organizations and platform metadata |
| `POST` | `/organizations` | `SUPER_ADMIN` | Create an organization |
| `GET` | `/organizations/{organizationId}` | `SUPER_ADMIN`; `ORGANIZATION_ADMIN` only for their own organization | Read organization details |
| `PATCH` | `/organizations/{organizationId}` | `SUPER_ADMIN`; `ORGANIZATION_ADMIN` only for allowed settings on their own organization | Update allowed organization settings |

Never accept a privileged role or organization assignment just because it appears in a request body. Validate both the actor's role and the allowed target role. Role changes must be audited.

## 13. Owner listings and rental offers

These endpoints implement the marketplace flow: a car owner can publish a listing and negotiate either with an eligible garage/fleet operator workflow or directly with a cab driver. The API must not assume every listing is available for every type of participant. Marketplace visibility is public only for approved listing fields; offers are private.

### 13.1 Listings

| Method | Path | Required role | Description |
|---|---|---|---|
| `GET` | `/marketplace/listings` | `PUBLIC` | Search published/available listings using safe public fields such as city, vehicle type, and price range |
| `POST` | `/marketplace/listings` | `CAR_OWNER` | Create a listing for a vehicle owned by the authenticated owner |
| `GET` | `/marketplace/listings/{listingId}` | `PUBLIC` for published public fields; owner/authorized participant for private fields | Read a listing within its visibility rules |
| `PATCH` | `/marketplace/listings/{listingId}` | Owning `CAR_OWNER`; explicitly delegated manager if a valid management agreement exists | Update permitted listing fields |
| `POST` | `/marketplace/listings/{listingId}/publish` | Owning `CAR_OWNER` | Publish after required fields and vehicle eligibility checks |
| `POST` | `/marketplace/listings/{listingId}/pause` | Owning `CAR_OWNER`; explicitly delegated manager if allowed | Pause a listing so it no longer accepts new offers |
| `POST` | `/marketplace/listings/{listingId}/close` | Owning `CAR_OWNER`; explicitly delegated manager if allowed | Close a listing and preserve offer history |
| `GET` | `/marketplace/my-listings` | `CAR_OWNER` | List the authenticated owner's listings |

### 13.2 Rental offers

| Method | Path | Required role | Description |
|---|---|---|---|
| `POST` | `/marketplace/listings/{listingId}/offers` | `CAB_DRIVER` | Send an offer on a published, eligible listing |
| `GET` | `/marketplace/offers/inbox` | `CAR_OWNER` | View offers for the owner's own listings only |
| `GET` | `/marketplace/my-offers` | `CAB_DRIVER` | View offers created by the authenticated driver only |
| `GET` | `/marketplace/offers/{offerId}` | Creating `CAB_DRIVER`, owning `CAR_OWNER`, or explicitly authorized participant | Read an offer only if the caller is a party to it |
| `POST` | `/marketplace/offers/{offerId}/counter` | The other party to the current offer; normally `CAR_OWNER` when countering a driver offer, or `CAB_DRIVER` when countering an owner offer | Create a new counter-offer linked to the previous offer |
| `POST` | `/marketplace/offers/{offerId}/accept` | `CAR_OWNER` who owns the listed vehicle | Accept the current offer; create or enable one booking in a transaction after all checks |
| `POST` | `/marketplace/offers/{offerId}/reject` | `CAR_OWNER` who owns the listed vehicle | Reject the current offer |
| `POST` | `/marketplace/offers/{offerId}/withdraw` | `CAB_DRIVER` who created the offer, only while it remains withdrawable | Withdraw the driver's own pending offer |
| `GET` | `/marketplace/offers/{offerId}/history` | Creating driver, owning car owner, or explicitly authorized participant | Read the negotiation chain and status history |

Offer API rules:
- A driver can see only offers they created and listings/offer details made visible to them.
- An owner can see and act on offers only for vehicles/listings they own, unless a valid, explicit management agreement delegates that permission.
- Only the car owner may accept or reject an offer on their car by default. A manager must not accept/reject on the owner's behalf unless the product implements and validates an explicit delegation.
- The counter endpoint creates a new `rental_offers` row with `parent_offer_id` pointing to the offer it counters. Do not overwrite the earlier price or erase history.
- The server checks that the offer is still pending/current and that the listing is published and eligible. Two simultaneous accept/reject requests must not both succeed.
- Accepting an offer must be transactional and idempotent. At most one booking may be created from a given accepted offer.
- A public listing response must not reveal owner phone/email, driver information, private notes, or another tenant's internal identifiers unless a separate consented workflow permits it.
- The ERD has `rental_offers` and `vehicle_listings`; if the product later needs explicit garage/operator delegation, add a `management_agreements` entity and matching API before allowing delegated actions.

## 14. Five example request and response pairs

These examples show the intended API contract. IDs and tokens are illustrative. They are not evidence that the endpoints are implemented.

### Example 1 — Register a car owner

`POST /api/v1/auth/register`

Request:

```json
{
  "name": "Amit Maity",
  "email": "amit.owner@example.com",
  "password": "Use-a-strong-password-here",
  "accountType": "CAR_OWNER",
  "phone": "+919876543210"
}
```

Response — `201 Created`:

```json
{
  "id": "d2c67f87-49a5-44b1-a3c4-0e3c0fd9f801",
  "name": "Amit Maity",
  "email": "amit.owner@example.com",
  "role": "CAR_OWNER",
  "organizationId": "5a2e8c1d-b1b8-4a34-b1a9-ff53db01c0c4",
  "status": "PENDING_VERIFICATION",
  "createdAt": "2026-11-27T10:30:00Z"
}
```

The public registration endpoint must not accept `SUPER_ADMIN` or organization staff roles. Verification status and any required organization/profile setup must follow the chosen onboarding policy.

### Example 2 — Log in

`POST /api/v1/auth/login`

Request:

```json
{
  "email": "amit.owner@example.com",
  "password": "Use-a-strong-password-here"
}
```

Response — `200 OK`:

```json
{
  "accessToken": "<short-lived-access-token>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "refreshToken": "<rotating-refresh-token>",
  "user": {
    "id": "d2c67f87-49a5-44b1-a3c4-0e3c0fd9f801",
    "name": "Amit Maity",
    "role": "CAR_OWNER",
    "organizationId": "5a2e8c1d-b1b8-4a34-b1a9-ff53db01c0c4"
  }
}
```

Use generic login errors so the response does not reveal whether an email is registered. Never log passwords or tokens.

### Example 3 — Create a vehicle

`POST /api/v1/vehicles`

Required role: `ORGANIZATION_ADMIN` or `FLEET_MANAGER` for a fleet vehicle. A `CAR_OWNER` uses the owner-specific listing workflow and must be linked to their own vehicle/profile.

Request:

```json
{
  "registrationNumber": "WB02AB1234",
  "make": "Maruti Suzuki",
  "model": "Dzire",
  "manufactureYear": 2024,
  "vehicleType": "SEDAN",
  "seatingCapacity": 5,
  "dailyRate": 2500.00,
  "currency": "INR"
}
```

Response — `201 Created`:

```json
{
  "id": "a32e83a8-1dd7-4f52-8fb7-c2cc4a0d6803",
  "organizationId": "5a2e8c1d-b1b8-4a34-b1a9-ff53db01c0c4",
  "registrationNumber": "WB02AB1234",
  "make": "Maruti Suzuki",
  "model": "Dzire",
  "manufactureYear": 2024,
  "vehicleType": "SEDAN",
  "seatingCapacity": 5,
  "dailyRate": 2500.00,
  "currency": "INR",
  "status": "AVAILABLE",
  "createdAt": "2026-11-27T10:35:00Z"
}
```

The server sets `organizationId` from the authenticated context. The example amount is ₹2,500.00 per day.

### Example 4 — Create a booking

`POST /api/v1/bookings`

Required role: `ORGANIZATION_ADMIN`, `FLEET_MANAGER`, or authorized `STAFF`; a marketplace booking may be created through acceptance of a rental offer.

Request:

```json
{
  "vehicleId": "a32e83a8-1dd7-4f52-8fb7-c2cc4a0d6803",
  "customerId": "f49dc6b3-ff40-46a8-8e15-53f728f0e5d1",
  "startAt": "2026-12-01T09:00:00+05:30",
  "endAt": "2026-12-03T09:00:00+05:30",
  "dailyRate": 2500.00,
  "currency": "INR",
  "notes": "Airport pickup requested"
}
```

Response — `201 Created`:

```json
{
  "id": "3a0f0a87-2a6d-4f85-8a8c-8e7a4c75b180",
  "organizationId": "5a2e8c1d-b1b8-4a34-b1a9-ff53db01c0c4",
  "vehicleId": "a32e83a8-1dd7-4f52-8fb7-c2cc4a0d6803",
  "customerId": "f49dc6b3-ff40-46a8-8e15-53f728f0e5d1",
  "startAt": "2026-12-01T09:00:00+05:30",
  "endAt": "2026-12-03T09:00:00+05:30",
  "dailyRate": 2500.00,
  "estimatedTotal": 5000.00,
  "currency": "INR",
  "status": "PENDING",
  "createdAt": "2026-11-27T10:40:00Z"
}
```

The example is two days at ₹2,500 per day, for an estimated ₹5,000 before any taxes, deposit, fees, or discounts. The server must re-check availability and calculate totals; it must not trust a client-calculated total.

### Example 5 — Send a rental offer

`POST /api/v1/marketplace/listings/9fbb6d57-3a0e-4a8a-a93d-8d15bd1a4e18/offers`

Required role: `CAB_DRIVER`.

Request:

```json
{
  "offeredDailyPrice": 1800.00,
  "currency": "INR",
  "startDate": "2026-12-05",
  "endDate": "2026-12-20",
  "message": "I can take the car for the full period."
}
```

Response — `201 Created`:

```json
{
  "id": "c2a9a5a0-47f7-456b-8d21-8915f3c3d9a4",
  "vehicleListingId": "9fbb6d57-3a0e-4a8a-a93d-8d15bd1a4e18",
  "driverProfileId": "bc12c2cc-642f-4421-9f61-6e33d6fd9f88",
  "parentOfferId": null,
  "offeredDailyPrice": 1800.00,
  "currency": "INR",
  "startDate": "2026-12-05",
  "endDate": "2026-12-20",
  "status": "PENDING",
  "createdAt": "2026-11-27T10:45:00Z"
}
```

The offered daily price is ₹1,800.00. The server identifies the driver from the access token; the caller cannot submit an arbitrary `driverProfileId`.

## 15. Validation rules

### 15.1 General validation

- Required fields must be present and non-null.
- Reject unknown enum/status values.
- Trim text fields and apply documented length limits.
- Validate UUID path/body values and date/time formats.
- Do not allow `organizationId`, `createdBy`, `role`, `ownerId`, or `driverProfileId` to override the authenticated identity unless the endpoint explicitly authorizes that assignment.
- Use allowlists for sortable fields, filters, upload types, and state transitions.
- Validate that all referenced records exist and are visible/usable in the current user's scope.
- Prefer soft deletion/deactivation for records with financial or legal history.

### 15.2 Resource-specific validation

| Area | Rules |
|---|---|
| Registration/login | Email format; unique login email; strong password policy; rate limit login and registration; generic invalid-credentials response |
| Vehicles | Registration number required and unique within the intended organization; manufacture year within a reasonable range; seating capacity positive; daily rate greater than zero; currency supported |
| Customers | Validate name/contact formats; avoid duplicate records according to documented tenant policy; restrict access to personal data |
| Bookings | `startAt` must be before `endAt`; dates must satisfy booking policy; vehicle must be eligible and available; customer and vehicle must be in valid scope; prevent overlapping confirmed/in-progress bookings |
| Contracts | Contract must reference a valid booking; only allowed draft fields can change after send/sign; signer must be a permitted party or delegated signer |
| Payments | Amount greater than zero; currency supported; idempotency key required for retriable payment creation; verify provider callbacks/signatures |
| Refunds | Must reference an existing payment; amount greater than zero; cumulative successful refunds must not exceed refundable captured amount; only allowed statuses can be approved/processed/cancelled |
| Maintenance | Vehicle must be in scope; scheduled dates valid; cost cannot be negative; completion requires applicable completion fields; maintenance status must follow allowed transitions |
| Users/roles | Caller can assign only roles they are allowed to grant; cannot create a privileged user through public registration; cannot deactivate the last active organization administrator without a replacement |
| Listings | Owner must own or be explicitly authorized to manage the vehicle; required listing fields must be complete before publish; only approved fields are public |
| Rental offers | Listing must be published and eligible; price positive; date range valid; only parties to the offer may read it; only the owner may accept/reject by default; counter-offers link to their parent; accepted offer can create at most one booking |

### 15.3 Common error cases

| Error code | HTTP | Example |
|---|---:|---|
| `VALIDATION_FAILED` | 400 | Missing required field or invalid date |
| `INVALID_FILTER` | 400 | Unsupported filter or sort field |
| `INVALID_STATE_TRANSITION` | 400 | Trying to complete a cancelled booking |
| `AUTHENTICATION_REQUIRED` | 401 | No access token on a protected endpoint |
| `TOKEN_EXPIRED` | 401 | Expired access token |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password; do not reveal which value failed |
| `INSUFFICIENT_PERMISSION` | 403 | Staff member attempts to change user roles |
| `RESOURCE_NOT_FOUND` | 404 | ID does not exist or is outside the caller's visible scope |
| `BOOKING_OVERLAP` | 409 | Another booking has reserved the vehicle |
| `DUPLICATE_RESOURCE` | 409 | Registration number already exists in the organization |
| `OFFER_ALREADY_DECIDED` | 409 | Offer was accepted/rejected/withdrawn by another request |
| `IDEMPOTENCY_CONFLICT` | 409 | Same idempotency key reused with different payment details |
| `REFUND_AMOUNT_EXCEEDS_BALANCE` | 409 | Requested refund is higher than the remaining refundable amount |
| `FILE_TOO_LARGE` | 413 | Upload exceeds configured limit |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Unsupported upload/body content type |
| `RATE_LIMITED` | 429 | Too many login or offer requests |
| `INTERNAL_ERROR` | 500 | Unexpected server failure; response must not expose internals |
| `DEPENDENCY_UNAVAILABLE` | 503 | Payment provider or required dependency unavailable |

## 16. Swagger / OpenAPI notes

Use OpenAPI 3.1 if supported by the chosen Springdoc version; otherwise use the OpenAPI version supported by the selected dependency and document that choice. Swagger UI and the OpenAPI JSON/YAML endpoints should be enabled for local development. Production access should follow the project's security policy.

Suggested tag groups:

1. `Authentication`
2. `Organizations`
3. `Users & Roles`
4. `Vehicles`
5. `Customers`
6. `Bookings`
7. `Contracts`
8. `Billing & Payments`
9. `Refunds`
10. `Maintenance`
11. `Dashboard & Reports`
12. `Marketplace Listings`
13. `Rental Offers`

OpenAPI documentation should:
- Define a bearer JWT security scheme for protected endpoints.
- Mark public endpoints explicitly and avoid applying security to them by mistake.
- Describe required roles and resource ownership/tenant checks in each operation.
- Include common error response schemas and examples for `400`, `401`, `403`, `404`, `409`, `429`, and `500`.
- Document pagination, sorting, filtering, date/time formats, money fields, and status enums.
- Include request/response schemas rather than untyped maps where possible.
- Mark sensitive fields as write-only or omit them from responses.
- Document idempotency headers for payment operations and any retry behavior.
- Keep examples illustrative; never claim an endpoint is tested merely because it appears in Swagger.
- Keep internal platform/support endpoints separate from public marketplace endpoints in tags and access policy.

## 17. Spring Security mapping notes (no code)

- Map application roles to authorities: `ROLE_SUPER_ADMIN`, `ROLE_ORGANIZATION_ADMIN`, `ROLE_FLEET_MANAGER`, `ROLE_STAFF`, `ROLE_VIEWER`, `ROLE_CAR_OWNER`, and `ROLE_CAB_DRIVER`.
- Use role/authority checks for broad permission and a service-layer ownership/organization check for each resource.
- Do not rely on frontend hiding or URL obscurity for authorization.
- Validate tenant ownership for every related resource, including vehicle, customer, booking, contract, payment, refund, and maintenance record.
- Public marketplace listing search is a controlled exception to normal tenant filtering; private offers and owner/driver profiles are not public.
- Add audit events for role changes, booking cancellation, contract acceptance, payments, refunds, offer acceptance/rejection, and delegated management actions.
- Do not grant `SUPER_ADMIN` automatic unrestricted access to tenant business data.
- This document defines the planned contract only. No Java code, controller implementation, integration, or test result is claimed.

## 18. Implementation checklist

- [ ] Align the role seed values in `database-erd.md` with the seven planned role names.
- [ ] Keep `permissions-matrix.md` and endpoint role requirements in sync when permissions change.
- [ ] Confirm whether customer self-service accounts are in the first release; if so, define a separate `CUSTOMER` role and update the ERD and permissions matrix before exposing customer-specific endpoints.
- [ ] Decide how owner/driver accounts receive their `organization_id`, since the current ERD requires it even for marketplace users.
- [ ] Add a `management_agreements` table and API only if garage/operator delegation will be supported.
- [ ] Confirm booking status transitions, contract signing rules, refund approval policy, and payment-provider integration before implementation.
- [ ] Add OpenAPI schemas and examples alongside each implemented endpoint.
- [ ] Add automated tests later for tenant isolation, role permissions, booking overlap, refund limits, offer negotiation, and token rotation. Do not mark these complete until they have actually run.
