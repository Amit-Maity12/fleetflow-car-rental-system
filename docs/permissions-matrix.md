
# FleetFlow Permissions Matrix

This document defines the planned roles and their permissions in FleetFlow. The backend will enforce permissions and organization-level data isolation.

## Roles

| Role | Responsibility |
|---|---|
| PLATFORM_ADMIN | Manages platform-level operations and organizations. |
| ORG_ADMIN | Manages users and settings within an organization. |
| FLEET_MANAGER | Manages vehicles, customers, and bookings. |
| MAINTENANCE_STAFF | Manages vehicle maintenance records. |
| BILLING_STAFF | Manages contracts, invoices, and payments. |
| CUSTOMER | Accesses their own profile, bookings, contracts, and invoices. |

## Permission Matrix

| Feature | PLATFORM_ADMIN | ORG_ADMIN | FLEET_MANAGER | MAINTENANCE_STAFF | BILLING_STAFF | CUSTOMER |
|---|---|---|---|---|---|---|
| Manage organizations | Platform scope | No | No | No | No | No |
| Manage organization users | No | Yes | No | No | No | No |
| View vehicles | Platform operations only | Yes | Yes | Yes | Yes | Available vehicles |
| Manage vehicles | No | Yes | Yes | No | No | No |
| Manage customers | No | Yes | Yes | No | No | Own profile |
| Manage bookings | No | Yes | Yes | No | No | Own bookings |
| Manage contracts | No | Yes | Read only | No | Yes | Own contracts |
| Manage maintenance | No | Yes | Read only | Yes | No | No |
| Manage invoices and payments | No | Yes | No | No | Yes | Own records |
| View reports | Platform scope | Organization scope | Fleet scope | Maintenance scope | Billing scope | No |
| View audit logs | Platform scope | Organization scope | No | No | No | No |

## Security Rules

- Every organization-owned record must belong to a tenant organization.
- Users must not access another organization's records by changing an ID in a request.
- Customers may access only their own records.
- The backend must enforce authorization on every protected operation.
- Frontend visibility is not a substitute for backend authorization.
- Sensitive operations should generate audit records.
- Platform administration must not automatically grant unrestricted access to tenant business data.

## Review Notes

These permissions are a proposed baseline for Phase 1. They must be reviewed against actual workflows and refined before implementation.
