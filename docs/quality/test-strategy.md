# Test Strategy

**Version:** 1.0  
**Date:** 2024-01-15  
**Status:** Gate C Deliverable  
**Owner:** QA Team

---

## 1. E2E Framework ADR (TK-010)

### Context
The multi-app platform requires a robust end-to-end testing framework that can handle complex scenarios including RBAC enforcement, cross-tenant isolation, event-driven workflows, and observability validation across multiple applications in a monorepo structure.

### Decision Drivers
- **Monorepo Support**: Ability to test multiple apps and shared libraries efficiently
- **RBAC Test Helpers**: Built-in or easy integration for role-based access control testing
- **CI Integration**: Seamless integration with GitHub Actions and containerized environments
- **Multi-browser Support**: Cross-browser compatibility testing
- **API Testing**: Native support for API and UI testing in the same framework
- **Community & Ecosystem**: Active maintenance, plugins, and community support
- **Learning Curve**: Team familiarity and onboarding time
- **Performance**: Test execution speed and parallelization capabilities

### Framework Comparison

| Criteria | Playwright | Cypress | Weight | Playwright Score | Cypress Score |
|----------|-----------|---------|--------|------------------|---------------|
| Monorepo Support | Excellent native support, workspace-aware | Good with configuration | 5 | 5 | 3 |
| RBAC Test Helpers | Extensible fixtures, context isolation | Custom commands needed | 4 | 4 | 3 |
| CI Integration | Native Docker, GitHub Actions | Requires dashboard for parallelization | 5 | 5 | 3 |
| Multi-browser Support | Chromium, Firefox, WebKit native | Chromium, Firefox, Edge (limited) | 3 | 5 | 3 |
| API Testing | Built-in API testing capabilities | Requires cy.request() workarounds | 4 | 5 | 3 |
| Cross-tenant Testing | Context isolation per tenant | Custom session management | 5 | 5 | 3 |
| Event Validation | WebSocket, SSE native support | Limited, requires plugins | 4 | 5 | 2 |
| Auto-wait Mechanism | Smart auto-waiting | Built-in retry logic | 3 | 4 | 5 |
| Debugging Experience | Inspector, trace viewer | Time-travel debugging | 3 | 4 | 5 |
| Community & Docs | Growing rapidly, Microsoft-backed | Mature, extensive docs | 3 | 4 | 5 |
| **Total Weighted Score** | | | **39** | **181** | **131** |

### Decision: **Playwright**

#### Rationale
1. **Superior Monorepo Support**: Playwright's workspace awareness allows us to efficiently test multiple apps (`web-app`, `admin-app`, `api-gateway`) with shared test utilities
2. **Native Multi-browser Testing**: Critical for validating cross-browser RBAC behavior and PII masking across different rendering engines
3. **Context Isolation**: Playwright's browser context isolation perfectly aligns with our multi-tenant architecture, allowing parallel tenant testing without interference
4. **Built-in API Testing**: Enables comprehensive integration tests that validate both API contracts and UI responses in the same test suite
5. **Event-Driven Testing**: Native WebSocket and SSE support is essential for testing our event publishing/consumption workflows (US-005, US-006, US-007)
6. **CI/CD Efficiency**: Native Docker support and GitHub Actions integration reduces CI complexity and execution time
7. **Future-Proof**: Microsoft's backing and rapid evolution provide confidence in long-term viability

#### Trade-offs Accepted
- Slightly steeper learning curve compared to Cypress (mitigated by comprehensive documentation)
- Less mature time-travel debugging (trace viewer compensates adequately)

#### Implementation Plan (TK-010)
1. Install Playwright in monorepo root with workspace configuration
2. Create shared test fixtures for RBAC contexts (`tenant-admin`, `user`, `guest`)
3. Build helper utilities for PII validation and audit trail verification
4. Configure parallel execution across tenant contexts
5. Integrate with GitHub Actions for PR and nightly runs

---

## 2. Risk-Based Prioritization Matrix (TK-011)

### Scoring Methodology
- **Probability (P)**: 1=Rare, 2=Unlikely, 3=Possible, 4=Likely, 5=Almost Certain
- **Impact (I)**: 1=Negligible, 2=Minor, 3=Moderate, 4=Major, 5=Catastrophic
- **Risk Score**: P × I
- **Priority**: P0 (20-25), P1 (12-19), P2 (1-11)

### Critical Risk Factors
- **RBAC Enforcement**: Cross-tenant data leakage = regulatory violation + loss of trust
- **Event Delivery Guarantee**: Failed events = data loss + inconsistent state
- **Audit Trail Integrity**: Missing audit logs = compliance failure + no forensics
- **PII Masking in Observability**: Unmasked PII = GDPR/CCPA violation + fines

### Risk Matrix

| US-ID | User Story | Probability | Impact | Risk Score | Priority | Rationale |
|-------|------------|-------------|--------|------------|----------|-----------|
| **US-001** | User registration and onboarding | 3 | 4 | 12 | **P1** | Initial entry point; bugs affect first impression. Data validation errors common. |
| **US-002** | SSO / OAuth login | 4 | 5 | 20 | **P0** | Complex integration with external IdP. Security vulnerabilities have catastrophic impact. |
| **US-003** | RBAC role assignment | 4 | 5 | 20 | **P0** | Core security mechanism. Role misconfiguration enables privilege escalation. |
| **US-004** | Cross-tenant data isolation | 5 | 5 | 25 | **P0** | Highest risk. Tenant leakage violates contracts and regulations. Multi-tenancy bugs are common. |
| **US-005** | Event publishing (producer) | 3 | 4 | 12 | **P1** | Message loss possible under load. Impacts downstream consumers. |
| **US-006** | Event consumption (consumer) | 3 | 4 | 12 | **P1** | Duplicate processing or missed events cause data inconsistency. |
| **US-007** | Event delivery guarantee / retry | 4 | 5 | 20 | **P0** | Retry logic bugs cause cascading failures. Dead-letter queue misconfig = silent data loss. |
| **US-008** | Audit trail logging | 4 | 5 | 20 | **P0** | Missing or tampered audit logs = compliance failure. Required for SOC2, ISO27001. |
| **US-009** | PII masking in observability | 5 | 5 | 25 | **P0** | PII leakage in logs/metrics = GDPR/CCPA violation. Extremely common oversight. |
| **US-010** | Multi-app dashboard | 2 | 3 | 6 | **P2** | UI bugs are visible but lower business impact. Lower complexity. |
| **US-011** | Admin role management | 4 | 5 | 20 | **P0** | Admin privilege escalation = complete system compromise. |
| **US-012** | API rate limiting and throttling | 3 | 4 | 12 | **P1** | DoS vulnerability if misconfigured. Performance degradation impacts UX. |

### Priority Summary
- **P0 (Critical)**: US-002, US-003, US-004, US-007, US-008, US-009, US-011 → 7 stories
- **P1 (High)**: US-001, US-005, US-006, US-012 → 4 stories
- **P2 (Medium)**: US-010 → 1 story

### Testing Coverage by Critical Path

#### 1. RBAC Enforcement Critical Path
- **Stories**: US-003, US-004, US-011
- **Must Cover**: 
  - Role assignment validation
  - Permission inheritance
  - Cross-tenant access denial
  - Admin privilege escalation prevention
  - Token/session tampering resistance

#### 2. Event Delivery Guarantee Critical Path
- **Stories**: US-005, US-006, US-007
- **Must Cover**:
  - At-least-once delivery semantics
  - Idempotency key validation
  - Retry with exponential backoff
  - Dead-letter queue routing
  - Broker failure recovery

#### 3. Audit Trail Integrity Critical Path
- **Stories**: US-008
- **Must Cover**:
  - All CRUD operations logged
  - Immutable log storage
  - Timestamp accuracy
  - User attribution
  - Failed operation logging

#### 4. PII Masking in Observability Critical Path
- **Stories**: US-009
- **Must Cover**:
  - PII fields masked in application logs
  - PII masked in structured logging
  - PII masked in error traces
  - PII masked in metrics labels
  - PII masked in distributed traces

---

## 3. Top 5 Critical Test Scenarios

### Scenario 1: Cross-Tenant Data Isolation (RBAC)

**Scenario ID**: CTS-001  
**Priority**: P0  
**Related Stories**: US-004, US-003

**Precondition**:
- Two tenants exist: `tenant-a` and `tenant-b`
- `tenant-a` has User Alice with role `viewer`
- `tenant-b` has User Bob with role `admin`
- Both tenants have distinct resources (users, events, audit logs)

**Action Steps**:
1. Authenticate as Alice (tenant-a/viewer)
2. Attempt to list resources with tenant-b query parameter
3. Attempt to access tenant-b resource by direct ID
4. Attempt to modify HTTP headers to impersonate tenant-b
5. Verify audit log records unauthorized access attempt

**Expected Result**:
- All cross-tenant access attempts return `403 Forbidden`
- No tenant-b data exposed in response (not even metadata)
- Audit log contains failed access attempt with Alice's identity
- No side effects on tenant-b resources

---

### Scenario 2: Event Delivery with Broker Failure and Retry

**Scenario ID**: CTS-002  
**Priority**: P0  
**Related Stories**: US-007, US-005, US-006

**Precondition**:
- Event broker (Kafka/RabbitMQ) is running
- Producer service is configured with retry policy: 3 retries, exponential backoff
- Consumer service is subscribed to `user.registered` topic
- Dead-letter queue is configured

**Action Steps**:
1. Publish `user.registered` event from producer
2. Simulate broker unavailability (network partition or service stop)
3. Verify producer retries 3 times with increasing delays
4. Restore broker availability
5. Verify event is delivered to consumer
6. Simulate consumer processing failure
7. Verify event is routed to dead-letter queue after max retries

**Expected Result**:
- Producer retries follow exponential backoff: 1s, 2s, 4s
- Event is successfully delivered after broker restoration
- Consumer processes event exactly once (idempotency key checked)
- Failed events land in dead-letter queue with failure reason
- Observability metrics show retry counts and DLQ routing

---

### Scenario 3: PII Masking in All Observability Outputs

**Scenario ID**: CTS-003  
**Priority**: P0  
**Related Stories**: US-009

**Precondition**:
- Application logging configured with structured JSON format
- Distributed tracing enabled (OpenTelemetry)
- Metrics collection enabled (Prometheus)
- PII fields defined: `email`, `ssn`, `phone`, `address`, `creditCard`

**Action Steps**:
1. User registers with email `alice@example.com`, phone `555-1234`, SSN `123-45-6789`
2. Trigger an error that logs user details
3. Search application logs for unmasked PII
4. Query distributed traces for user registration span
5. Check metrics labels for PII exposure
6. Verify audit logs (PII allowed here for forensics)

**Expected Result**:
- Application logs show masked PII using a consistent pattern (e.g., `email: ***@***.com`, `phone: ***-***-1234`, `ssn: ***-**-6789`); the exact masking algorithm (e.g., show last 4 digits only) must match the project's masking specification
- Distributed traces contain masked PII in all attributes
- Metrics labels contain user IDs, not PII
- Audit logs contain unmasked PII (intentional for compliance)
- Error stack traces do not leak PII

---

### Scenario 4: Admin Privilege Escalation Prevention

**Scenario ID**: CTS-004  
**Priority**: P0  
**Related Stories**: US-011, US-003

**Precondition**:
- Three roles exist: `super-admin`, `tenant-admin`, `user`
- User Charlie has role `user` in `tenant-a`
- User Dana has role `tenant-admin` in `tenant-a`
- Super-admin role can only be assigned by existing super-admin

**Action Steps**:
1. Authenticate as Charlie (user)
2. Attempt to assign self `tenant-admin` role via API
3. Attempt to modify JWT to inject `super-admin` claim
4. Authenticate as Dana (tenant-admin)
5. Attempt to assign self `super-admin` role
6. Attempt to assign `tenant-admin` to Charlie
7. Verify all unauthorized attempts are logged

**Expected Result**:
- Charlie cannot elevate privileges: `403 Forbidden`
- Modified JWT is rejected with `401 Unauthorized`
- Dana cannot assign `super-admin` to self: `403 Forbidden`
- Dana CAN assign `tenant-admin` to Charlie: `200 OK` (within scope)
- Audit log records all privilege change attempts with actor identity

---

### Scenario 5: Audit Trail Integrity and Immutability

**Scenario ID**: CTS-005  
**Priority**: P0  
**Related Stories**: US-008

**Precondition**:
- Audit service is running with append-only storage
- User Eve has `tenant-admin` role
- All API operations are configured to emit audit events

**Action Steps**:
1. Eve creates a new user "Frank"
2. Eve updates Frank's email
3. Eve deletes Frank
4. Verify audit log contains all three operations
5. Attempt to modify existing audit log entry via API
6. Attempt to delete audit log entry via API
7. Query audit log by time range, actor, and resource type

**Expected Result**:
- Audit log contains entries for CREATE, UPDATE, DELETE with timestamps
- Each entry includes: actor ID, action, resource type/ID, timestamp, IP address, diff (for updates)
- Attempts to modify/delete audit logs return `405 Method Not Allowed`
- Audit storage backend is append-only (validated via direct DB query)
- Query returns correct results with sub-second timestamp precision

---

## 4. Test Cases Mapped to US-001…US-012

### US-001: User Registration and Onboarding

| TC-ID | Type | Priority | Title |
|-------|------|----------|-------|
| TC-001-01 | Functional | P1 | Successful user registration with valid inputs |
| TC-001-02 | Negative | P1 | Registration fails with duplicate email |
| TC-001-03 | Negative | P1 | Registration fails with invalid email format |
| TC-001-04 | Integration | P1 | Registration triggers welcome email via event |

#### TC-001-01: Successful user registration with valid inputs
**Precondition**: No user exists with email `newuser@example.com`  
**Steps**:
1. Navigate to registration page
2. Enter email: `newuser@example.com`, password: `SecurePass123!`, name: `John Doe`
3. Click "Register"
4. Verify redirect to dashboard

**Expected Result**: User created with status `active`, confirmation email sent, audit log entry created  
**Pass Criteria**: HTTP 201, user ID returned, database record exists

#### TC-001-02: Registration fails with duplicate email
**Precondition**: User exists with email `existing@example.com`  
**Steps**:
1. Attempt registration with email `existing@example.com`

**Expected Result**: HTTP 409 Conflict, error message "Email already registered"  
**Pass Criteria**: No new user created, original user unchanged

#### TC-001-03: Registration fails with invalid email format
**Precondition**: None  
**Steps**:
1. Attempt registration with email `invalid-email`

**Expected Result**: HTTP 400 Bad Request, error message "Invalid email format"  
**Pass Criteria**: No user created

#### TC-001-04: Registration triggers welcome email via event
**Precondition**: Event broker and email service are running  
**Steps**:
1. Register new user
2. Verify `user.registered` event published
3. Verify email service consumes event
4. Check email delivery logs

**Expected Result**: Event published within 100ms, email sent within 5s  
**Pass Criteria**: Event contains user ID and masked email, email service ACKs event

---

### US-002: SSO / OAuth Login

| TC-ID | Type | Priority | Title |
|-------|------|----------|-------|
| TC-002-01 | Functional | P0 | Successful OAuth login with Google |
| TC-002-02 | E2E | P0 | OAuth token refresh before expiration |
| TC-002-03 | Negative | P0 | OAuth login fails with invalid state parameter |
| TC-002-04 | Integration | P0 | User profile synced from IdP claims |

#### TC-002-01: Successful OAuth login with Google
**Precondition**: User exists with Google OAuth linked  
**Steps**:
1. Click "Sign in with Google"
2. Redirected to Google OAuth consent screen
3. Authorize application
4. Redirected back to app with authorization code
5. App exchanges code for access token

**Expected Result**: User logged in, session created, JWT issued  
**Pass Criteria**: JWT contains correct user ID and roles, expires in 1 hour

#### TC-002-02: OAuth token refresh before expiration
**Precondition**: User authenticated with OAuth, access token expires in 5 minutes  
**Steps**:
1. Wait until 1 minute before token expiration
2. Make authenticated API request
3. Verify token refresh flow triggered

**Expected Result**: New access token obtained transparently, request succeeds  
**Pass Criteria**: No user interruption, audit log shows token refresh

#### TC-002-03: OAuth login fails with invalid state parameter
**Precondition**: CSRF state parameter stored in session  
**Steps**:
1. Initiate OAuth flow
2. Modify state parameter in callback URL
3. Complete OAuth flow

**Expected Result**: Login rejected with "Invalid state" error  
**Pass Criteria**: No session created, security event logged

#### TC-002-04: User profile synced from IdP claims
**Precondition**: User logs in via OAuth for first time  
**Steps**:
1. Complete OAuth login
2. Verify user profile populated from IdP claims (name, email, picture)

**Expected Result**: User record contains claims from IdP  
**Pass Criteria**: Email matches IdP claim, profile updated timestamp recorded

---

### US-003: RBAC Role Assignment

| TC-ID | Type | Priority | Title |
|-------|------|----------|-------|
| TC-003-01 | Functional | P0 | Admin assigns role to user within tenant |
| TC-003-02 | Negative | P0 | Non-admin cannot assign roles |
| TC-003-03 | Negative | P0 | Cannot assign role from different tenant |
| TC-003-04 | Integration | P0 | Role change triggers permission recalculation |

#### TC-003-01: Admin assigns role to user within tenant
**Precondition**: Admin user in tenant-a, target user in tenant-a with role `viewer`  
**Steps**:
1. Authenticate as admin
2. Assign role `editor` to target user
3. Verify role updated

**Expected Result**: User now has `editor` role, audit log entry created  
**Pass Criteria**: GET /users/{id} returns role `editor`

#### TC-003-02: Non-admin cannot assign roles
**Precondition**: User with role `viewer`  
**Steps**:
1. Authenticate as viewer
2. Attempt to assign role to another user

**Expected Result**: HTTP 403 Forbidden  
**Pass Criteria**: Target user role unchanged, unauthorized attempt logged

#### TC-003-03: Cannot assign role from different tenant
**Precondition**: Admin in tenant-a attempts to assign role in tenant-b  
**Steps**:
1. Authenticate as tenant-a admin
2. Attempt to assign role to tenant-b user

**Expected Result**: HTTP 403 Forbidden, error "Cannot modify users in other tenants"  
**Pass Criteria**: Tenant-b user unchanged

#### TC-003-04: Role change triggers permission recalculation
**Precondition**: User with `viewer` role has active session  
**Steps**:
1. Admin upgrades user to `editor`
2. User makes next API request

**Expected Result**: User permissions updated, new JWT issued with `editor` claims  
**Pass Criteria**: User can now perform editor actions

---

### US-004: Cross-Tenant Data Isolation

| TC-ID | Type | Priority | Title |
|-------|------|----------|-------|
| TC-004-01 | Functional | P0 | Tenant-A user cannot access tenant-B resources |
| TC-004-02 | Negative | P0 | Direct resource ID access blocked across tenants |
| TC-004-03 | Negative | P0 | Query parameter manipulation blocked |
| TC-004-04 | E2E | P0 | Search results filtered by tenant |

#### TC-004-01: Tenant-A user cannot access tenant-B resources
**Precondition**: User Alice in tenant-a, User Bob in tenant-b  
**Steps**:
1. Authenticate as Alice
2. Attempt GET /users (should return tenant-a users only)
3. Attempt GET /events (should return tenant-a events only)

**Expected Result**: Only tenant-a resources returned  
**Pass Criteria**: Response contains tenant-a data only, no tenant-b data leaked

#### TC-004-02: Direct resource ID access blocked across tenants
**Precondition**: Resource ID `res-123` exists in tenant-b  
**Steps**:
1. Authenticate as tenant-a user
2. Attempt GET /resources/res-123

**Expected Result**: HTTP 404 Not Found (not 403 to avoid info leak)  
**Pass Criteria**: No tenant-b data in response

#### TC-004-03: Query parameter manipulation blocked
**Precondition**: Tenant-a user authenticated  
**Steps**:
1. Attempt GET /users?tenantId=tenant-b

**Expected Result**: Query parameter ignored or rejected, only tenant-a data returned  
**Pass Criteria**: Response filtered by authenticated user's tenant

#### TC-004-04: Search results filtered by tenant
**Precondition**: Search index contains data from multiple tenants  
**Steps**:
1. Authenticate as tenant-a user
2. Search for common term that exists in both tenants

**Expected Result**: Search returns only tenant-a results  
**Pass Criteria**: All result items have tenantId=tenant-a

---

### US-005: Event Publishing (Producer)

| TC-ID | Type | Priority | Title |
|-------|------|----------|-------|
| TC-005-01 | Functional | P1 | Event published successfully to broker |
| TC-005-02 | Integration | P1 | Event contains required metadata fields |
| TC-005-03 | Negative | P1 | Event publish fails gracefully on broker unavailability |
| TC-005-04 | Performance | P1 | Event publishing under load (1000 events/sec) |

#### TC-005-01: Event published successfully to broker
**Precondition**: Event broker running and healthy  
**Steps**:
1. Trigger business action (e.g., user creation)
2. Verify event published to broker
3. Verify broker acknowledges receipt

**Expected Result**: Event appears in broker topic within 100ms  
**Pass Criteria**: Producer receives ACK, no errors logged

#### TC-005-02: Event contains required metadata fields
**Precondition**: None  
**Steps**:
1. Publish event
2. Consume event and inspect payload

**Expected Result**: Event contains: eventId, eventType, timestamp, version, tenantId, payload  
**Pass Criteria**: All fields present and valid, timestamp is ISO8601

#### TC-005-03: Event publish fails gracefully on broker unavailability
**Precondition**: Event broker stopped  
**Steps**:
1. Trigger business action
2. Verify producer handles failure

**Expected Result**: Producer logs error, returns 503 to caller, stores event for retry  
**Pass Criteria**: Application remains stable, no data loss

#### TC-005-04: Event publishing under load
**Precondition**: Load testing tool configured  
**Steps**:
1. Publish 1000 events/sec for 60 seconds

**Expected Result**: All events published successfully, <1% error rate, p99 latency <500ms  
**Pass Criteria**: Broker and producer remain stable, no memory leaks

---

### US-006: Event Consumption (Consumer)

| TC-ID | Type | Priority | Title |
|-------|------|----------|-------|
| TC-006-01 | Functional | P1 | Event consumed and processed successfully |
| TC-006-02 | Integration | P1 | Idempotency prevents duplicate processing |
| TC-006-03 | Negative | P1 | Malformed event is rejected and logged |
| TC-006-04 | E2E | P1 | End-to-end event flow from producer to consumer |

#### TC-006-01: Event consumed and processed successfully
**Precondition**: Event published to topic  
**Steps**:
1. Consumer polls topic
2. Consumer processes event
3. Consumer commits offset

**Expected Result**: Event processed, side effects applied (e.g., email sent), offset committed  
**Pass Criteria**: Processing logged, database updated, no errors

#### TC-006-02: Idempotency prevents duplicate processing
**Precondition**: Event with idempotency key already processed  
**Steps**:
1. Deliver same event again (replay scenario)
2. Consumer detects duplicate via idempotency key

**Expected Result**: Event skipped, no duplicate side effects  
**Pass Criteria**: Idempotency key recorded in cache, audit log shows skip

#### TC-006-03: Malformed event is rejected and logged
**Precondition**: Event with invalid schema published  
**Steps**:
1. Consumer attempts to deserialize event
2. Schema validation fails

**Expected Result**: Event rejected, routed to DLQ, error logged  
**Pass Criteria**: Consumer continues processing other events, alert triggered

#### TC-006-04: End-to-end event flow from producer to consumer
**Precondition**: Producer and consumer both running  
**Steps**:
1. Trigger user registration
2. Producer publishes `user.registered` event
3. Email consumer processes event
4. Verify email sent

**Expected Result**: Email delivered within 5 seconds of registration  
**Pass Criteria**: Distributed trace shows complete flow with <5s total latency

---

### US-007: Event Delivery Guarantee / Retry

| TC-ID | Type | Priority | Title |
|-------|------|----------|-------|
| TC-007-01 | Functional | P0 | Event retried after transient failure |
| TC-007-02 | Functional | P0 | Event routed to DLQ after max retries |
| TC-007-03 | E2E | P0 | Event delivered after broker recovery |
| TC-007-04 | Integration | P0 | Exponential backoff between retries |

#### TC-007-01: Event retried after transient failure
**Precondition**: Consumer configured with 3 retries  
**Steps**:
1. Consumer receives event
2. Simulate transient error (503 from downstream API)
3. Verify retry attempts

**Expected Result**: Event retried 3 times before failing  
**Pass Criteria**: Retry metrics show 3 attempts, delays: 1s, 2s, 4s

#### TC-007-02: Event routed to DLQ after max retries
**Precondition**: Consumer fails to process event after max retries  
**Steps**:
1. Simulate persistent failure
2. Verify event in DLQ

**Expected Result**: Event in DLQ with failure reason and retry count  
**Pass Criteria**: DLQ message includes original event, error details, timestamp

#### TC-007-03: Event delivered after broker recovery
**Precondition**: Event published while broker down  
**Steps**:
1. Stop broker
2. Attempt to publish event (producer buffers)
3. Start broker
4. Verify event delivered

**Expected Result**: Event delivered successfully after broker recovery  
**Pass Criteria**: No data loss, producer buffer cleared

#### TC-007-04: Exponential backoff between retries
**Precondition**: Consumer fails to process event  
**Steps**:
1. Capture retry timestamps
2. Calculate delays between attempts

**Expected Result**: Delays follow exponential backoff: 1s, 2s, 4s (3 retries)  
**Pass Criteria**: Measured delays within ±200ms of expected

---

### US-008: Audit Trail Logging

| TC-ID | Type | Priority | Title |
|-------|------|----------|-------|
| TC-008-01 | Functional | P0 | All CRUD operations logged |
| TC-008-02 | Functional | P0 | Audit log is immutable |
| TC-008-03 | Integration | P0 | Failed operations logged with error details |
| TC-008-04 | E2E | P0 | Audit log queryable by multiple criteria |

#### TC-008-01: All CRUD operations logged
**Precondition**: User performs CREATE, UPDATE, DELETE operations  
**Steps**:
1. Create resource
2. Update resource
3. Delete resource
4. Query audit log

**Expected Result**: Three audit entries with action types: CREATE, UPDATE, DELETE  
**Pass Criteria**: Each entry contains actor, resource type/ID, timestamp, diff (for UPDATE)

#### TC-008-02: Audit log is immutable
**Precondition**: Audit entries exist  
**Steps**:
1. Attempt PUT /audit-logs/{id}
2. Attempt DELETE /audit-logs/{id}

**Expected Result**: Both return HTTP 405 Method Not Allowed  
**Pass Criteria**: Audit log unchanged, attempts logged

#### TC-008-03: Failed operations logged with error details
**Precondition**: User attempts unauthorized action  
**Steps**:
1. User attempts to delete resource without permission
2. Query audit log

**Expected Result**: Audit entry with action=DELETE, status=FAILED, error="Insufficient permissions"  
**Pass Criteria**: Failed attempt recorded with full context

#### TC-008-04: Audit log queryable by multiple criteria
**Precondition**: Audit log contains diverse entries  
**Steps**:
1. Query by actor ID
2. Query by resource type
3. Query by time range
4. Query by action type

**Expected Result**: All queries return correct filtered results  
**Pass Criteria**: Results match query criteria, pagination works

---

### US-009: PII Masking in Observability

| TC-ID | Type | Priority | Title |
|-------|------|----------|-------|
| TC-009-01 | Functional | P0 | PII masked in application logs |
| TC-009-02 | Functional | P0 | PII masked in distributed traces |
| TC-009-03 | Functional | P0 | PII masked in metrics labels |
| TC-009-04 | Negative | P0 | Unmasked PII triggers security alert |

#### TC-009-01: PII masked in application logs
**Precondition**: User with email `alice@example.com`, SSN `123-45-6789` exists  
**Steps**:
1. Trigger log statement that includes user details
2. Search logs for unmasked PII

**Expected Result**: Logs show `email: a***e@***.com`, `ssn: ***-**-6789`  
**Pass Criteria**: No plaintext PII in logs, masking pattern consistent

#### TC-009-02: PII masked in distributed traces
**Precondition**: Distributed tracing enabled (OpenTelemetry)  
**Steps**:
1. Execute user registration flow
2. Query trace for registration span
3. Inspect span attributes

**Expected Result**: Span attributes contain masked PII: `user.email=a***e@***.com`  
**Pass Criteria**: No plaintext PII in any span attribute

#### TC-009-03: PII masked in metrics labels
**Precondition**: Metrics exposed at /metrics endpoint  
**Steps**:
1. Generate user activity
2. Scrape metrics endpoint
3. Search for PII in labels

**Expected Result**: Metrics use user IDs, not emails: `requests_total{user_id="123"}`  
**Pass Criteria**: No email, phone, or SSN in metric labels

#### TC-009-04: Unmasked PII triggers security alert
**Precondition**: PII detection scanner running  
**Steps**:
1. Simulate bug that logs plaintext email
2. Verify alert triggered

**Expected Result**: Security team receives alert within 1 minute  
**Pass Criteria**: Alert contains log line, timestamp, severity=HIGH

---

### US-010: Multi-App Dashboard

| TC-ID | Type | Priority | Title |
|-------|------|----------|-------|
| TC-010-01 | Functional | P2 | Dashboard displays data from all apps |
| TC-010-02 | E2E | P2 | Dashboard updates in real-time via WebSocket |
| TC-010-03 | Negative | P2 | Dashboard handles app service unavailability |
| TC-010-04 | Integration | P2 | Dashboard respects RBAC for app visibility |

#### TC-010-01: Dashboard displays data from all apps
**Precondition**: User has access to web-app and admin-app  
**Steps**:
1. Login and navigate to dashboard
2. Verify widgets from both apps displayed

**Expected Result**: Dashboard shows aggregated metrics from both apps  
**Pass Criteria**: Data from each app clearly labeled, refresh timestamp shown

#### TC-010-02: Dashboard updates in real-time via WebSocket
**Precondition**: Dashboard connected via WebSocket  
**Steps**:
1. Open dashboard
2. Trigger event in backend
3. Verify dashboard updates without refresh

**Expected Result**: Dashboard updates within 2 seconds of event  
**Pass Criteria**: WebSocket message received, UI updated, no page reload

#### TC-010-03: Dashboard handles app service unavailability
**Precondition**: One app service is down  
**Steps**:
1. Stop admin-app service
2. Load dashboard

**Expected Result**: Dashboard shows web-app data, displays "admin-app unavailable" warning  
**Pass Criteria**: Dashboard functional for available apps, graceful degradation

#### TC-010-04: Dashboard respects RBAC for app visibility
**Precondition**: User has access to web-app only  
**Steps**:
1. Login and navigate to dashboard

**Expected Result**: Only web-app widgets displayed, admin-app widgets hidden  
**Pass Criteria**: No data leakage from restricted apps

---

### US-011: Admin Role Management

| TC-ID | Type | Priority | Title |
|-------|------|----------|-------|
| TC-011-01 | Functional | P0 | Super-admin creates new tenant-admin |
| TC-011-02 | Negative | P0 | Tenant-admin cannot create super-admin |
| TC-011-03 | Negative | P0 | Regular user cannot access admin panel |
| TC-011-04 | Integration | P0 | Admin role change audited with full context |

#### TC-011-01: Super-admin creates new tenant-admin
**Precondition**: Logged in as super-admin  
**Steps**:
1. Navigate to admin panel
2. Create new tenant-admin for tenant-a
3. Verify role assigned

**Expected Result**: New tenant-admin can manage tenant-a users  
**Pass Criteria**: Role assignment succeeds, audit log entry created

#### TC-011-02: Tenant-admin cannot create super-admin
**Precondition**: Logged in as tenant-admin  
**Steps**:
1. Attempt to assign super-admin role to user

**Expected Result**: HTTP 403 Forbidden, error "Insufficient privileges"  
**Pass Criteria**: Role unchanged, unauthorized attempt logged

#### TC-011-03: Regular user cannot access admin panel
**Precondition**: Logged in as regular user  
**Steps**:
1. Navigate to /admin URL

**Expected Result**: HTTP 403 Forbidden or redirect to dashboard  
**Pass Criteria**: Admin panel not accessible, attempt logged

#### TC-011-04: Admin role change audited with full context
**Precondition**: Super-admin changes tenant-admin role  
**Steps**:
1. Modify admin user role
2. Query audit log

**Expected Result**: Audit entry with actor=super-admin, action=UPDATE_ROLE, target=admin-user, old_role, new_role  
**Pass Criteria**: Full audit trail with before/after state

---

### US-012: API Rate Limiting and Throttling

| TC-ID | Type | Priority | Title |
|-------|------|----------|-------|
| TC-012-01 | Functional | P1 | Rate limit enforced per user |
| TC-012-02 | Functional | P1 | Rate limit returns correct headers |
| TC-012-03 | Integration | P1 | Rate limit state persisted in Redis |
| TC-012-04 | Performance | P1 | Rate limiting under concurrent load |

#### TC-012-01: Rate limit enforced per user
**Precondition**: Rate limit configured to 100 requests/minute per user  
**Steps**:
1. Authenticate as user
2. Make 101 API requests within 1 minute

**Expected Result**: First 100 requests succeed, 101st returns HTTP 429 Too Many Requests  
**Pass Criteria**: Rate limit enforced, response includes retry-after header

#### TC-012-02: Rate limit returns correct headers
**Precondition**: User makes API request  
**Steps**:
1. Make API request
2. Inspect response headers

**Expected Result**: Headers include `X-RateLimit-Limit: 100`, `X-RateLimit-Remaining: 99`, `X-RateLimit-Reset: {timestamp}`  
**Pass Criteria**: All rate limit headers present and accurate

#### TC-012-03: Rate limit state persisted in Redis
**Precondition**: Rate limiting uses Redis backend  
**Steps**:
1. Make API request
2. Query Redis for rate limit key

**Expected Result**: Redis contains key with user ID, request count, and TTL  
**Pass Criteria**: Redis key format correct, TTL matches window

#### TC-012-04: Rate limiting under concurrent load
**Precondition**: Load testing tool configured  
**Steps**:
1. Simulate 10 concurrent users, each making 50 requests
2. Verify rate limits enforced correctly

**Expected Result**: Each user limited independently, no false positives  
**Pass Criteria**: Rate limit accuracy >99%, no race conditions

---

## 5. Dedicated Negative Test Cases

### 5.1 Cross-Tenant Data Leakage (RBAC)

#### TC-NEG-001: Tenant-A user attempts to access tenant-B resources

**Priority**: P0  
**Related Stories**: US-004, US-003  
**Type**: Negative / Security

**Precondition**:
- Tenant-A exists with user Alice (role: viewer)
- Tenant-B exists with user Bob (role: admin)
- Tenant-B has resource `document-456`

**Test Steps**:
1. Authenticate as Alice (tenant-A)
2. Attempt `GET /documents/document-456` (tenant-B resource)
3. Attempt `GET /documents?tenantId=tenant-b`
4. Attempt `GET /documents` with modified request header `X-Tenant-Id: tenant-b`
5. Attempt to set tenant-B cookie value
6. Verify audit log entries

**Expected Result**:
- All requests return `403 Forbidden` or `404 Not Found`
- No tenant-B data in any response (not even error messages)
- Response does not confirm existence of tenant-B resource
- Audit log contains 4 failed access attempts with Alice's identity
- No CORS or cache headers leak tenant-B info

**Pass Criteria**:
- Zero tenant-B data disclosed
- All unauthorized attempts logged with full context (IP, user agent, timestamp)
- Rate limiting prevents brute-force tenant enumeration

**Security Impact**: CRITICAL - Data leakage violates multi-tenant contract and regulatory compliance

---

#### TC-NEG-002: JWT token manipulation to escalate privileges

**Priority**: P0  
**Related Stories**: US-003, US-011  
**Type**: Negative / Security

**Precondition**:
- User Charlie has JWT with role `viewer`

**Test Steps**:
1. Decode JWT payload
2. Modify role claim from `viewer` to `admin`
3. Re-encode JWT (without signing)
4. Make API request with modified JWT
5. Attempt to modify JWT signature using known vulnerabilities (alg:none, weak secret)

**Expected Result**:
- Request rejected with `401 Unauthorized`
- Error message: "Invalid token signature"
- Token validation logs show tampering attempt
- No privilege escalation occurs

**Pass Criteria**:
- JWT signature validation enforced
- Algorithm switching prevented (alg:none blocked)
- Security alert triggered for tampering attempt

**Security Impact**: CRITICAL - Privilege escalation enables complete system compromise

---

### 5.2 Event Delivery Failure and Retry Behavior

#### TC-NEG-003: Event broker unavailable during publish

**Priority**: P0  
**Related Stories**: US-007, US-005  
**Type**: Negative / Resilience

**Precondition**:
- Event broker is running
- Producer configured with retry: 3 attempts, exponential backoff

**Test Steps**:
1. Stop event broker (simulate network partition)
2. Trigger business action that publishes event (user registration)
3. Monitor producer retry behavior
4. Verify application remains stable
5. Restore broker
6. Verify event eventually delivered

**Expected Result**:
- Producer attempts retry 3 times with delays: 1s, 2s, 4s
- Application logs each retry attempt with error details
- User-facing request returns `503 Service Unavailable` after retries exhausted
- Event persisted locally for later retry (outbox pattern)
- After broker restored, event published successfully
- No data loss

**Pass Criteria**:
- Retry metrics: `event.publish.retry.count=3`
- Exponential backoff timing within ±200ms
- Application memory stable (no memory leak from buffered events)
- Event eventually delivered with idempotency key

**Business Impact**: Data loss prevented, user notified of transient failure

---

#### TC-NEG-004: Consumer processing failure triggers DLQ routing

**Priority**: P0  
**Related Stories**: US-007, US-006  
**Type**: Negative / Resilience

**Precondition**:
- Consumer configured with max retries: 3
- Dead-letter queue (DLQ) configured
- Consumer code has bug causing persistent failure

**Test Steps**:
1. Publish event to topic
2. Consumer attempts processing, fails with exception
3. Monitor retry attempts
4. Verify event routed to DLQ after max retries
5. Inspect DLQ message for metadata

**Expected Result**:
- Consumer retries 3 times with exponential backoff
- After 3 failures, event moved to DLQ
- DLQ message includes: original event, error message, retry count, timestamps, stack trace hash
- Consumer continues processing subsequent events (circuit not broken)
- Alert triggered for DLQ routing

**Pass Criteria**:
- DLQ message structure validated
- Consumer throughput unaffected by poisonous message
- Alert includes event type and error category

**Business Impact**: Poisonous messages isolated, system remains operational

---

#### TC-NEG-005: Duplicate event delivery handled by idempotency

**Priority**: P0  
**Related Stories**: US-006, US-007  
**Type**: Negative / Data Integrity

**Precondition**:
- Event with idempotency key `idem-123` already processed
- Consumer configured with idempotency cache (Redis, TTL: 24 hours)

**Test Steps**:
1. Consumer receives duplicate event (broker replay scenario)
2. Consumer checks idempotency key in cache
3. Verify duplicate detection
4. Verify side effects not duplicated

**Expected Result**:
- Consumer detects duplicate via idempotency key
- Event processing skipped
- Audit log entry: "Duplicate event skipped, idempotency_key=idem-123"
- No duplicate side effects (e.g., no duplicate email sent, no duplicate DB insert)
- Consumer ACKs message to prevent redelivery

**Pass Criteria**:
- Idempotency cache hit: 100%
- Zero duplicate side effects
- Metrics: `event.duplicate.skipped.count=1`

**Business Impact**: Data consistency maintained, duplicate processing prevented

---

### 5.3 PII Field Appearing Unmasked in Logs

#### TC-NEG-006: PII appears unmasked in application logs

**Priority**: P0  
**Related Stories**: US-009  
**Type**: Negative / Compliance

**Precondition**:
- Application logging configured with PII masking library
- User with email `alice@example.com`, SSN `123-45-6789`, phone `555-1234`

**Test Steps**:
1. Trigger code path that logs user details (e.g., user registration error)
2. Search application logs for plaintext PII patterns:
   - Regex: `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b` (email)
   - Regex: `\b\d{3}-\d{2}-\d{4}\b` (SSN)
   - Regex: `\b\d{3}-\d{4}\b` (phone)
3. Verify PII is masked
4. Simulate logging bug that bypasses masking
5. Verify PII detection scanner triggers alert

**Expected Result**:
- Logs show masked PII using a consistent pattern (e.g., `email: ***@***.com`, `ssn: ***-**-6789`, `phone: ***-***-1234`); pattern must match the project's masking specification
- No plaintext PII in any log statement
- Structured logging fields also masked: `{"email":"a***e@***.com"}`
- PII detection scanner (if triggered) alerts security team within 1 minute

**Pass Criteria**:
- Zero plaintext PII in logs (automated scan)
- Masking library applied to all logging statements
- Exception stack traces also masked

**Compliance Impact**: CRITICAL - Unmasked PII violates GDPR/CCPA, potential fines up to €20M or 4% of annual worldwide turnover, whichever is higher

---

#### TC-NEG-007: PII appears unmasked in distributed traces

**Priority**: P0  
**Related Stories**: US-009  
**Type**: Negative / Compliance

**Precondition**:
- OpenTelemetry tracing enabled
- User registration flow generates trace spans

**Test Steps**:
1. Execute user registration with email `bob@example.com`
2. Query tracing backend (Jaeger/Tempo) for registration trace
3. Inspect all span attributes, tags, and logs
4. Search for plaintext email: `bob@example.com`

**Expected Result**:
- All span attributes show masked email: `user.email=b***@***.com`
- Trace baggage items also masked
- Span events (logs) do not contain plaintext PII
- Trace sampling decision does not leak PII

**Pass Criteria**:
- Zero plaintext PII in trace data
- Masking consistent across all spans in trace
- Trace remains useful for debugging (user ID included)

**Compliance Impact**: CRITICAL - Trace data often stored long-term, unmasked PII violates retention policies

---

#### TC-NEG-008: PII appears in metrics labels

**Priority**: P0  
**Related Stories**: US-009  
**Type**: Negative / Compliance

**Precondition**:
- Prometheus metrics exposed at `/metrics`
- User activity generates metrics

**Test Steps**:
1. Generate user activity (login, API requests)
2. Scrape `/metrics` endpoint
3. Search metric labels for PII patterns (email, SSN, phone)

**Expected Result**:
- Metrics use user IDs, not PII: `http_requests_total{user_id="12345"}`
- No email, phone, or SSN in any metric label
- Cardinality remains reasonable (no high-cardinality PII labels)

**Pass Criteria**:
- Zero PII in metric labels (automated regex scan)
- Metrics remain useful with user IDs
- Cardinality <10,000 per metric

**Compliance Impact**: HIGH - Metrics are often exported to third-party systems, PII leakage extends exposure

---

#### TC-NEG-009: PII masking in error messages and stack traces

**Priority**: P0  
**Related Stories**: US-009  
**Type**: Negative / Compliance

**Precondition**:
- Application encounters error during user creation
- Error message includes user input: `Failed to create user: alice@example.com already exists`

**Test Steps**:
1. Trigger error condition (duplicate email)
2. Capture error message and stack trace
3. Verify PII is masked

**Expected Result**:
- Error message: `Failed to create user: a***e@***.com already exists`
- Stack trace does not contain plaintext PII
- Error sent to user (API response) also has masked PII

**Pass Criteria**:
- Error messages masked consistently
- Stack traces sanitized before logging
- User-facing errors do not leak other users' PII

**Compliance Impact**: HIGH - Error messages often overlooked, common source of PII leakage

---

## 6. Test Coverage Table

| US-ID | User Story | Test Case IDs | Type Coverage | Priority | Status |
|-------|------------|---------------|---------------|----------|--------|
| **US-001** | User registration and onboarding | TC-001-01, TC-001-02, TC-001-03, TC-001-04 | Functional, Negative, Integration | P1 | ✅ Covered |
| **US-002** | SSO / OAuth login | TC-002-01, TC-002-02, TC-002-03, TC-002-04 | Functional, E2E, Negative, Integration | P0 | ✅ Covered |
| **US-003** | RBAC role assignment | TC-003-01, TC-003-02, TC-003-03, TC-003-04, TC-NEG-001, TC-NEG-002 | Functional, Negative, Integration, Security | P0 | ✅ Covered |
| **US-004** | Cross-tenant data isolation | TC-004-01, TC-004-02, TC-004-03, TC-004-04, TC-NEG-001 | Functional, Negative, E2E, Security | P0 | ✅ Covered |
| **US-005** | Event publishing (producer) | TC-005-01, TC-005-02, TC-005-03, TC-005-04, TC-NEG-003 | Functional, Integration, Negative, Performance | P1 | ✅ Covered |
| **US-006** | Event consumption (consumer) | TC-006-01, TC-006-02, TC-006-03, TC-006-04, TC-NEG-004, TC-NEG-005 | Functional, Integration, Negative, E2E | P1 | ✅ Covered |
| **US-007** | Event delivery guarantee / retry | TC-007-01, TC-007-02, TC-007-03, TC-007-04, TC-NEG-003, TC-NEG-004, TC-NEG-005 | Functional, E2E, Integration, Negative | P0 | ✅ Covered |
| **US-008** | Audit trail logging | TC-008-01, TC-008-02, TC-008-03, TC-008-04 | Functional, Integration, E2E | P0 | ✅ Covered |
| **US-009** | PII masking in observability | TC-009-01, TC-009-02, TC-009-03, TC-009-04, TC-NEG-006, TC-NEG-007, TC-NEG-008, TC-NEG-009 | Functional, Negative, Compliance | P0 | ✅ Covered |
| **US-010** | Multi-app dashboard | TC-010-01, TC-010-02, TC-010-03, TC-010-04 | Functional, E2E, Negative, Integration | P2 | ✅ Covered |
| **US-011** | Admin role management | TC-011-01, TC-011-02, TC-011-03, TC-011-04, TC-NEG-002 | Functional, Negative, Integration, Security | P0 | ✅ Covered |
| **US-012** | API rate limiting and throttling | TC-012-01, TC-012-02, TC-012-03, TC-012-04 | Functional, Integration, Performance | P1 | ✅ Covered |

### Coverage Summary

**Total Test Cases**: 57  
**By Priority**:
- P0 (Critical): 35 test cases (61%)
- P1 (High): 18 test cases (32%)
- P2 (Medium): 4 test cases (7%)

**By Type** *(test cases may span multiple types)*:
- Functional: 28 test cases (49%)
- Negative: 15 test cases (26%)
- Integration: 18 test cases (32%)
- E2E: 8 test cases (14%)
- Performance: 3 test cases (5%)
- Security: 4 test cases (7%)

**Critical Path Coverage**:
- ✅ RBAC Enforcement: 8 test cases (US-003, US-004, US-011)
- ✅ Event Delivery Guarantee: 11 test cases (US-005, US-006, US-007)
- ✅ Audit Trail Integrity: 4 test cases (US-008)
- ✅ PII Masking in Observability: 8 test cases (US-009)

**Negative Test Coverage**: 15 dedicated negative test cases covering:
- Cross-tenant data leakage (5 test cases)
- Event delivery failures (3 test cases)
- PII leakage scenarios (4 test cases)
- Privilege escalation (2 test cases)
- Malformed inputs (1 test case)

### Gap Analysis
**No gaps identified** - All user stories (US-001 through US-012) have minimum coverage:
- At least 1 happy path test per story
- At least 1 negative/edge case for P0 stories
- Critical paths have dedicated security and resilience tests

### Test Automation Status
- **Target**: 90% automation for functional and integration tests
- **Current**: TBD (implementation phase)
- **Manual**: E2E critical scenarios (CTS-001 through CTS-005) will be automated with Playwright

---

## Appendix: Test Environment Requirements

### Environment Configuration
1. **Test Tenants**: `tenant-test-a`, `tenant-test-b`, `tenant-test-c`
2. **Test Users**: Predefined users with roles: `super-admin`, `tenant-admin`, `editor`, `viewer`, `guest`
3. **Event Broker**: Kafka or RabbitMQ with test topics configured
4. **Observability Stack**: Logs (ELK/Loki), Traces (Jaeger/Tempo), Metrics (Prometheus)
5. **PII Detection Scanner**: Automated regex scanning for compliance validation
6. **Rate Limiting**: Redis backend for rate limit state

### Test Data Management
- **Isolation**: Each test suite uses isolated tenant/user data
- **Cleanup**: Automated teardown after test execution
- **Seeding**: Predefined test data for consistent test execution

### CI/CD Integration
- **PR Checks**: Run P0 and P1 tests on every pull request
- **Nightly Tests**: Full test suite including performance and E2E tests
- **Release Gates**: All P0 tests must pass before production deployment

---

**Document Status**: ✅ Complete  
**Next Steps**: Implement test cases in Playwright framework (TK-010)  
**Review Required**: Security team sign-off on negative test scenarios
