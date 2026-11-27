# FleetFlow Permissions Matrix

## 1. Purpose and policy

This document defines the planned authorization rules for FleetFlow. It is designed to align with `docs/architecture.md` and `docs/database-erd.md`.

FleetFlow is multi-tenant. A role tells the backend which kinds of actions a user may attempt; organization membership and record ownership determine which records that action can affect. The backend must enforce both checks on every protected request.

### Permission symbols

| Symbol | Meaning |
|---|---|
| **Yes** | Allowed within the role's organization and resource scope |
| **Own** | Only records owned by, created by, or assigned to that user |
| **Limited** | Only the fields/actions explicitly listed in the notes |
| **No** | Not allowed |
| **Platform** | Platform-level administration only; does not imply access to private tenant business records |

“Delete” should usually mean archive, deactivate, or cancel with an audit trail. Financial, contract, booking, and offer history must not be hard-deleted through ordinary screens.

## 2. Roles and owner/driver user types

### Core organization roles

| Role | Description |
|---|---|
| `SUPER_ADMIN` | Operates the FleetFlow platform: organization lifecycle, platform configuration, and support tooling. This role does not automatically grant access to private tenant business data. |
| `ORGANIZATION_ADMIN` | Administers users, roles, settings, and business records for their own organization. Cannot administer other organizations. |
| `FLEET_MANAGER` | Runs day-to-day fleet operations: vehicles, customer records, bookings, contracts needed for operations, maintenance coordination, and operational reports. No platform-wide or unrestricted financial administration. |
| `STAFF` | Performs specific tasks assigned by the organization, such as updating vehicle information, handling booking operations, or recording maintenance. Does not manage users or perform privileged financial actions by default. |
| `VIEWER` | Read-only access to permitted organization records and reports. Cannot create, update, delete, approve, or execute transactions. Sensitive personal and financial fields remain restricted. |

### How `CAR_OWNER` and `CAB_DRIVER` fit

**Decision: treat `CAR_OWNER` and `CAB_DRIVER` as specialized marketplace roles, each backed by a separate profile table. They are not additional organization-staff roles and do not inherit fleet-manager or organization-admin permissions.**

This matches the ERD:

- `users` is the login identity and has a `role_id`.
- `car_owners` stores the owner-specific profile and links to `users` through `user_id`.
- `driver_profiles` stores the cab-driver profile and links to `users` through `user_id`.
- `vehicles.car_owner_id` identifies the owner. A vehicle's managing organization and its legal owner are not necessarily the same.
- `vehicle_listings` controls what is published to the marketplace.
- `rental_offers` stores each offer/counter-offer as a separate record.

The initial ERD uses one `users.role_id`, so an account has one primary role in this version. A marketplace account uses `CAR_OWNER` or `CAB_DRIVER` as its primary role and must have the matching profile. If the product later requires one account to be both an organization employee and a car owner/driver, change the ERD to a many-to-many `user_roles` model rather than squeezing multiple roles into one column.

| Specialized role | Description and boundary |
|---|---|
| `CAR_OWNER` | Manages their own owner profile, vehicles they own, their own listings, offers received for those listings, and agreements involving their vehicles. Cannot see unrelated owners' private data. |
| `CAB_DRIVER` | Searches published listing fields, manages their own driver profile and offers, and sees only their own negotiation history and agreements. Cannot read another driver's offers or private owner/tenant records. |

A garage/fleet operator is represented by an organization using `FLEET_MANAGER`, `ORGANIZATION_ADMIN`, or a permitted `STAFF` account. A management agreement must grant access to a particular owner's vehicle; merely being in an organization does not transfer ownership.

## 3. Module permission tables

These are baseline permissions. All “Yes” entries remain limited by organization scope, assigned responsibilities, record ownership, status transitions, and field-level restrictions. `CAR_OWNER` and `CAB_DRIVER` are shown in marketplace modules and may only access their own permitted resources.

### 3.1 Vehicles

| Role | Create | Read | Update | Delete | Special actions |
|---|---|---|---|---|---|
| `SUPER_ADMIN` | No | Platform metadata only | No | No | May suspend an organization through platform controls; no default vehicle access |
| `ORGANIZATION_ADMIN` | Yes | Own organization | Yes | Limited | Archive/deactivate; transfer management only through authorized workflow |
| `FLEET_MANAGER` | Yes | Assigned organization/fleet | Yes | Limited | Mark available/unavailable; coordinate assignment and maintenance |
| `STAFF` | Limited | Assigned records | Limited | No | Update permitted operational fields only |
| `VIEWER` | No | Limited, read-only | No | No | View allowed fleet summary |
| `CAR_OWNER` | Yes, for own vehicle | Own vehicles | Own | Limited | Register ownership details; list a vehicle; cannot edit records for vehicles they do not own |
| `CAB_DRIVER` | No | Published listing fields only | No | No | Search/filter available listings; no private registration or owner data |

### 3.2 Customers

| Role | Create | Read | Update | Delete | Special actions |
|---|---|---|---|---|---|
| `SUPER_ADMIN` | No | Platform metadata only | No | No | No routine access to tenant customer PII |
| `ORGANIZATION_ADMIN` | Yes | Own organization | Yes | Limited | Deactivate/merge only under audited process |
| `FLEET_MANAGER` | Yes | Own organization | Yes | Limited | Maintain customer details needed for bookings |
| `STAFF` | Limited | Assigned customers | Limited | No | Use only fields required for assigned booking work |
| `VIEWER` | No | Limited/redacted | No | No | Aggregate or masked customer information only by default |
| `CAR_OWNER` | No | No by default | No | No | May see only the customer/driver details explicitly required for their own accepted rental, if policy permits |
| `CAB_DRIVER` | No | Own profile only; no customer directory | Own profile only | No | No access to other customers' personal information |

### 3.3 Bookings

| Role | Create | Read | Update | Delete | Special actions |
|---|---|---|---|---|---|
| `SUPER_ADMIN` | No | Platform metadata only | No | No | No default booking management |
| `ORGANIZATION_ADMIN` | Yes | Own organization | Yes | No | Approve exceptions; cancel under policy; audit all overrides |
| `FLEET_MANAGER` | Yes | Own organization/assigned fleet | Yes | No | Confirm, reschedule, check-in/out, cancel subject to policy |
| `STAFF` | Limited | Assigned bookings | Limited | No | Handle permitted booking updates; cancellation only if explicitly delegated |
| `VIEWER` | No | Read-only, limited fields | No | No | View aggregate booking status |
| `CAR_OWNER` | Limited | Own vehicle's permitted rental/booking details | Limited | No | Accept/reject relevant offer; view resulting booking; request cancellation but not bypass cancellation policy |
| `CAB_DRIVER` | Limited | Own bookings only | Limited | No | Request or confirm own rental according to flow; cancel own booking only under policy |

### 3.4 Contracts

| Role | Create | Read | Update | Delete | Special actions |
|---|---|---|---|---|---|
| `SUPER_ADMIN` | No | Platform metadata only | No | No | No default access to contract text or signatures |
| `ORGANIZATION_ADMIN` | Yes | Own organization | Limited | No | Approve authorized templates or amendments; terminate only under policy |
| `FLEET_MANAGER` | Limited | Own organization/assigned bookings | Limited | No | Prepare contract from accepted terms; cannot alter signed terms silently |
| `STAFF` | Limited | Assigned records, redacted as needed | No after activation | No | Upload permitted documents or request correction |
| `VIEWER` | No | Status/summary only | No | No | No access to signatures or unnecessary personal details |
| `CAR_OWNER` | Limited | Contracts involving own vehicles | Limited | No | Review/accept required owner terms; request amendment or termination |
| `CAB_DRIVER` | Limited | Own contracts only | Limited | No | Review and accept/sign own contract; request correction; cannot edit agreed terms |

### 3.5 Billing, payments, and refunds

| Role | Create | Read | Update | Delete | Special actions |
|---|---|---|---|---|---|
| `SUPER_ADMIN` | No | Platform payment health metadata only | No | No | Platform-level integration operations; no routine tenant payment/refund access |
| `ORGANIZATION_ADMIN` | Yes | Own organization | Limited | No | Approve refunds under configured limits; reconcile records; no rewriting provider results |
| `FLEET_MANAGER` | Limited | Booking payment status only | No | No | Request a refund/correction; cannot approve their own privileged refund unless policy explicitly permits |
| `STAFF` | Limited | Assigned status/receipts only | No | No | Record permitted cash/reference details; no refund approval |
| `VIEWER` | No | Aggregate/redacted reports | No | No | No payment credentials or detailed payout references |
| `CAR_OWNER` | No | Own rental settlement summaries and relevant payments | No | No | View owner earnings/settlement status; request a dispute; no access to customer payment credentials |
| `CAB_DRIVER` | Limited | Own rental charges/receipts only | No | No | Pay own charges and view own receipts; cannot issue refunds or see other drivers' payment data |

**Financial safeguards**

- Refund approval is restricted to `ORGANIZATION_ADMIN` or an explicitly authorized finance permission. The five core roles do not include a separate finance role, so a production permission policy should define whether a named admin or delegated billing staff can approve.
- A user must not approve their own privileged refund if separation of duties is required by the organization.
- Only verified payment-provider results can mark a payment or refund successful.
- A refund cannot exceed the captured, refundable amount. Refunds and payments are records, not editable balances.
- `CAR_OWNER` sees only their own settlement and relevant rental totals, not the renter's full payment method or unrelated transactions.

### 3.6 Maintenance

| Role | Create | Read | Update | Delete | Special actions |
|---|---|---|---|---|---|
| `SUPER_ADMIN` | No | Platform metadata only | No | No | No routine maintenance record access |
| `ORGANIZATION_ADMIN` | Yes | Own organization | Yes | Limited | Reopen/close records with audit reason |
| `FLEET_MANAGER` | Yes | Own organization/assigned fleet | Yes | Limited | Schedule service; mark vehicle unavailable; release after completion |
| `STAFF` | Limited | Assigned vehicles/records | Limited | No | Add service notes and completion details if assigned |
| `VIEWER` | No | Read-only summary | No | No | View due/overdue maintenance reports |
| `CAR_OWNER` | Limited | Own vehicles' permitted records | Limited | No | Review service plan/costs for owned vehicles |
| `CAB_DRIVER` | No | Only vehicle availability or safety notices relevant to own booking | No | No | Report a vehicle issue; cannot change maintenance status |

### 3.7 Dashboard and reports

| Role | Create | Read | Update | Delete | Special actions |
|---|---|---|---|---|---|
| `SUPER_ADMIN` | No | Platform-level operational metrics | No | No | Monitor platform health and organization status; tenant reports require explicit support authorization |
| `ORGANIZATION_ADMIN` | No | Own organization | No | No | Export authorized organization reports |
| `FLEET_MANAGER` | No | Fleet and booking metrics in assigned scope | No | No | Export permitted operational reports |
| `STAFF` | No | Assigned task summaries | No | No | No broad data export by default |
| `VIEWER` | No | Read-only approved reports | No | No | Export only if explicitly granted |
| `CAR_OWNER` | No | Own vehicle/listing/offer/settlement summaries | No | No | View own rental performance and offer history |
| `CAB_DRIVER` | No | Own offers, bookings, and charges summary | No | No | View own activity; no cross-driver analytics |

### 3.8 User management

| Role | Create | Read | Update | Delete | Special actions |
|---|---|---|---|---|---|
| `SUPER_ADMIN` | Yes, platform accounts | Platform user metadata | Yes, platform account state | Limited | Create/suspend organizations and platform admins; no silent impersonation |
| `ORGANIZATION_ADMIN` | Yes, within own organization | Own organization users | Yes, within own organization | Limited | Assign only approved organization roles; deactivate user; cannot grant `SUPER_ADMIN` |
| `FLEET_MANAGER` | No | Limited user/driver contact details needed for operations | No | No | Request access change from admin |
| `STAFF` | No | Limited assigned-party details | No | No | No role changes |
| `VIEWER` | No | No by default | No | No | No user administration |
| `CAR_OWNER` | No | Own profile; permitted driver details for own offers | Own profile only | No | Manage own contact/profile and verification requests |
| `CAB_DRIVER` | No | Own profile; public owner/listing details only | Own profile only | No | Manage own profile and verification requests |

### 3.9 Owner listings

| Role | Create | Read | Update | Delete | Special actions |
|---|---|---|---|---|---|
| `SUPER_ADMIN` | No | Listing moderation metadata only | No | No | Suspend/remove listing only through audited moderation workflow |
| `ORGANIZATION_ADMIN` | Yes, for organization-managed vehicles | Own organization listings | Yes | Limited | Approve/pause/archive organization listings |
| `FLEET_MANAGER` | Yes, if assigned management authority | Assigned fleet listings | Yes | Limited | Publish/pause listings only when authorized by owner or management agreement |
| `STAFF` | Limited/draft only | Assigned listings | Limited | No | Prepare listing for review; cannot claim ownership or bypass approval |
| `VIEWER` | No | Published fields or limited internal view as authorized | No | No | No listing changes |
| `CAR_OWNER` | Yes, for owned vehicles | Own listings | Own | Limited | Publish/pause/archive own listing; confirm owner authority; choose operator path or direct-driver path |
| `CAB_DRIVER` | No | Published public fields only | No | No | Search and view available listing information; no access to private owner details |

### 3.10 Rental offers and negotiation

| Role | Create | Read | Update | Delete | Special actions |
|---|---|---|---|---|---|
| `SUPER_ADMIN` | No | Moderation metadata only | No | No | Investigate abuse only through logged, authorized support workflow |
| `ORGANIZATION_ADMIN` | No by default | Offers involving own organization's managed listings | Limited | No | Resolve an operational dispute only if explicitly authorized; cannot impersonate a participant |
| `FLEET_MANAGER` | Limited, only for listings they are authorized to manage | Offers on assigned listings | Limited | No | Respond on behalf of an owner only if the management agreement and product policy explicitly allow it |
| `STAFF` | No by default | Assigned offer status only | No | No | Escalate disputes; no acceptance or rejection by default |
| `VIEWER` | No | No by default; approved aggregate only | No | No | No negotiation actions |
| `CAR_OWNER` | No for driver-originated offer | Own listing's offers | Limited to own response actions | No | **Only the owner of the listed car (or an explicitly authorized operator, if policy allows) can accept, reject, or counter an offer.** Cannot respond to offers for another owner's car. |
| `CAB_DRIVER` | Yes, for published eligible listings | **Own offers only**, plus public listing data | Limited to own pending offer through a new counter-offer record | No | Create offer; counter; accept/reject an owner's counter; withdraw or let own offer expire. Cannot accept/reject another driver's offer. |

**Negotiation rules**

1. An offer is visible to its driver and the owner/authorized recipient for that listing. Authorized operator access must be explicitly granted.
2. A driver can see only offers they created, plus the response chain attached to those offers. They cannot enumerate offers from other drivers.
3. Only the car owner can accept or reject an offer on their vehicle, unless a valid management agreement explicitly delegates that action to an operator.
4. Every counter-offer is a new `rental_offers` row linked to the previous row through `parent_offer_id`; do not overwrite historical prices.
5. Only pending offers can be responded to. Accepted, rejected, withdrawn, and expired offers are terminal.
6. Acceptance must be atomic. Only one accepted offer may result in a booking for a conflicting rental period.
7. The accepted price is copied into the booking/contract as an agreed-price snapshot.
8. A listing being public does not make its offer history, driver identity documents, private owner information, or contracts public.

## 4. Organization isolation rules

### Who can see which organization's data?

| User type / role | Permitted data scope |
|---|---|
| `SUPER_ADMIN` | Platform configuration, organization lifecycle, and operational metadata. No automatic access to tenant customer, contract, payment, or offer details. Temporary support access, if needed, must be explicitly authorized and audited. |
| `ORGANIZATION_ADMIN` | All permitted business records for their own `organization_id`; cannot read or change another organization's private records. |
| `FLEET_MANAGER` | Records in their own organization and only the fleet/vehicles assigned to them where assignments are supported. |
| `STAFF` | Records in their own organization that are needed for their assigned duties. |
| `VIEWER` | Read-only records/reports allowed for their own organization, with sensitive fields masked or omitted by default. |
| `CAR_OWNER` | Their own owner profile, owned vehicles, listings, received offers, and related agreements/settlement summaries. No unrelated owner's records. |
| `CAB_DRIVER` | Their own driver profile, offers, bookings, contracts, and charges. Published listing fields are visible for discovery; private owner/driver data is not. |

### Required enforcement

- Resolve the tenant from the authenticated account and trusted server-side membership. Do not accept a client-supplied `organization_id` as proof of access.
- Every tenant-scoped read, update, delete/archive, export, and action must validate the tenant and record relationship.
- Verify related IDs together. A user must not attach another organization's customer, vehicle, booking, payment, or contract to a record they control.
- For marketplace access, use explicit resource-based checks: published listing visibility is allowed; private listing administration and offer actions require ownership or delegated authority.
- For the ERD's `users.role_id` single-role design, a `CAR_OWNER` or `CAB_DRIVER` account is still associated with an organization and has a corresponding `car_owners` or `driver_profiles` row. Do not grant tenant-wide staff access based only on that profile.
- Use database foreign keys and constraints as a second layer of protection. Consider composite tenant-aware foreign keys and PostgreSQL row-level security after reviewing the final schema.
- Record sensitive actions—role changes, listing publication, offer acceptance/rejection, booking cancellation, contract activation/termination, refund decisions, and support access—in an audit trail.
- The frontend may hide buttons for convenience, but the backend must independently reject unauthorized requests.

## 5. Spring Security mapping (planned; no code yet)

### Role names

Use these exact authority names consistently in the database seed data, JWT authorization mapping, endpoint rules, and documentation:

- `ROLE_SUPER_ADMIN`
- `ROLE_ORGANIZATION_ADMIN`
- `ROLE_FLEET_MANAGER`
- `ROLE_STAFF`
- `ROLE_VIEWER`
- `ROLE_CAR_OWNER`
- `ROLE_CAB_DRIVER`

The stored role key can be `SUPER_ADMIN`, `ORGANIZATION_ADMIN`, and so on; Spring Security commonly exposes them as authorities prefixed with `ROLE_`. Choose one convention and apply it consistently. The ERD's `roles.name` should store the unprefixed stable key unless the implementation explicitly decides otherwise.

### Enforcement layers

| Layer | Planned responsibility |
|---|---|
| Authentication | Validate JWT, expiry, signature, and expected issuer/audience; load the active user |
| Role authorization | Check whether the role may attempt the requested action |
| Organization authorization | Resolve allowed organization scope from trusted server-side identity/membership |
| Resource authorization | Verify ownership, assignment, booking relationship, offer participant, or management agreement |
| Field-level response rules | Return only fields appropriate to the role and resource relationship |
| Service/business rules | Validate status transitions, cancellation policy, refund limits, offer acceptance, and booking overlap |
| Database constraints | Enforce foreign keys, unique keys, checks, and any selected tenant-aware constraints |
| Audit | Record sensitive actions with actor, organization, target, timestamp, and reason where relevant |

Use endpoint-level authorization for broad access rules and service-level authorization for record-specific decisions. A role check alone is not enough for actions such as accepting an offer, cancelling a booking, or approving a refund.

### Sensitive action policy

| Action | Baseline authorization |
|---|---|
| Create/suspend organization | `SUPER_ADMIN` only |
| Add/change organization users and roles | `ORGANIZATION_ADMIN` within their organization; cannot grant `SUPER_ADMIN` |
| Publish listing | `CAR_OWNER` for own vehicle, or an authorized fleet operator when a management agreement delegates it |
| Accept/reject/counter offer | Owner of the listed vehicle; delegated operator only if explicit policy and agreement allow it |
| View an offer | Offer's driver and authorized owner/recipient; driver sees only their own chain |
| Cancel booking | Authorized organization staff for operational bookings, or the booking participant for their own booking under cancellation policy |
| Activate/terminate contract | Authorized parties and organization roles according to contract state and policy |
| Approve refund | Explicitly delegated organization authority; enforce limits and separation of duties |
| Read tenant records | Always require organization/resource scope, including for `SUPER_ADMIN` support access |

## 6. Review and implementation checklist

- [ ] Seed the five core roles and the two specialized marketplace roles.
- [ ] Ensure `CAR_OWNER` accounts have a `car_owners` profile and `CAB_DRIVER` accounts have a `driver_profiles` profile.
- [ ] Decide whether one user may hold multiple roles. The current ERD assumes one primary role per user; use a `user_roles` join table if multiple roles are required.
- [ ] Define the exact staff permission assignments; `STAFF` must not receive finance or user-admin permissions by default.
- [ ] Define whether a management agreement can delegate listing publication and offer acceptance.
- [ ] Add server-side checks for tenant isolation and marketplace ownership.
- [ ] Add tests for cross-tenant access, driver offer privacy, owner-only offer decisions, delegated operator actions, booking cancellation, and refund limits.
- [ ] Update this matrix and the ERD together if the role model or permission boundaries change.

This is a planned permissions specification. It does not claim that Spring Security rules or tests have already been implemented.
