# Technical Plan: Multi-App Platform - RBAC, Event Bus, and Observability

## Document Information
- **Version**: 1.0
- **Date**: 2024-01-XX
- **Owner**: SWE Agent
- **Status**: In Review
- **Related Stories**: US-001, US-003, US-005

## Executive Summary

This technical plan outlines the implementation approach for three critical platform capabilities:
1. **Role-Based Access Control (RBAC)** with multi-tenant isolation
2. **Event-Driven Architecture** using an event bus with outbox/inbox pattern
3. **Observability & Audit Logging** with PII protection

The plan provides detailed technical specifications, implementation tasks, dependencies, and risk mitigation strategies for delivering these features in MVP-1.

---

## Table of Contents
1. [Assumptions](#assumptions)
2. [RBAC Section](#rbac-section)
3. [Event Bus Section](#event-bus-section)
4. [Observability Section](#observability-section)
5. [Data Models](#data-models)
6. [API Touchpoints](#api-touchpoints)
7. [Implementation Tasks (TK-001 to TK-013)](#implementation-tasks)
8. [Risks](#risks)
9. [Open Questions](#open-questions)
10. [Implementation Notes](#implementation-notes)

---

## Assumptions

### Technical Assumptions
- PostgreSQL 14+ is the primary database with native Row-Level Security (RLS) support
- Redis 6.2+ is available for event streaming (Redis Streams feature)
- JWT-based authentication is already implemented or will be implemented in parallel
- Node.js/TypeScript runtime environment for backend services
- Horizontal scaling via load balancer is available for stateless services

### Business Assumptions
- Maximum 100 tenants in MVP-1 phase (growth to 1000+ in subsequent phases)
- Peak load: 1000 requests/sec per tenant during business hours
- Audit log retention: 90 days for standard logs, 365 days for compliance-sensitive operations
- Data residency requirements: single region for MVP-1 (multi-region in future)

### Team Assumptions
- SWE team has PostgreSQL and Redis operational knowledge
- DevOps has monitoring/alerting infrastructure (Prometheus, Grafana, or equivalent)
- QA team can write integration tests for async event flows
- Security review will be conducted before production deployment

---

## RBAC Section

### TK-001: Tenant Role Taxonomy

#### Role Definitions

| Role | Scope | Description |
|------|-------|-------------|
| **super-admin** | Platform | Full platform administration; can manage all tenants, view system-wide metrics, configure platform settings |
| **tenant-admin** | Tenant | Full tenant administration; can manage tenant users, roles, and tenant-specific resources |
| **tenant-member** | Tenant | Standard user with read/write access to tenant resources; cannot manage users or roles |
| **viewer** | Tenant | Read-only access to tenant resources; cannot create, update, or delete resources |

#### Permissions Matrix

| Permission | super-admin | tenant-admin | tenant-member | viewer |
|------------|-------------|--------------|---------------|--------|
| **Tenant Management** |
| Create tenant | ✓ | ✗ | ✗ | ✗ |
| Delete tenant | ✓ | ✗ | ✗ | ✗ |
| View all tenants | ✓ | ✗ | ✗ | ✗ |
| Update tenant settings | ✓ | ✓ (own) | ✗ | ✗ |
| **User Management** |
| Invite users | ✓ | ✓ (own tenant) | ✗ | ✗ |
| Remove users | ✓ | ✓ (own tenant) | ✗ | ✗ |
| Assign roles | ✓ | ✓ (own tenant) | ✗ | ✗ |
| View users | ✓ | ✓ (own tenant) | ✓ (own tenant) | ✓ (own tenant) |
| **Resource Operations** |
| Create resources | ✓ | ✓ | ✓ | ✗ |
| Read resources | ✓ | ✓ | ✓ | ✓ |
| Update resources | ✓ | ✓ | ✓ | ✗ |
| Delete resources | ✓ | ✓ | ✓ | ✗ |
| **Audit & Observability** |
| View audit logs | ✓ | ✓ (own tenant) | ✗ | ✗ |
| Export audit logs | ✓ | ✓ (own tenant) | ✗ | ✗ |
| View platform metrics | ✓ | ✗ | ✗ | ✗ |

#### Role Hierarchy
```
super-admin (platform-level)
    └─ tenant-admin (tenant-level)
           └─ tenant-member (tenant-level)
                  └─ viewer (tenant-level)
```

---

### TK-002: Tenant Isolation Strategy

#### Decision: Row-Level Security (RLS)

After evaluating multiple approaches, we have selected **Row-Level Security (RLS)** as our tenant isolation strategy.

#### Decision Rationale

**Chosen Approach: RLS**
- PostgreSQL native feature (since v9.5, mature in v14+)
- Transparent to application logic after initial setup
- Lower operational overhead (single database, single schema)
- Simpler backup/restore operations
- Cost-effective for initial scale (100-1000 tenants)
- Strong security boundary enforced at database level

**Alternative Considered: Schema-per-Tenant**
- Pros: Complete logical separation, easier tenant data export
- Cons: Schema migration complexity scales linearly with tenant count, connection pool exhaustion, higher ops burden

#### RLS Implementation Architecture

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- RLS Policy Example: Users can only access their tenant's data
CREATE POLICY tenant_isolation_policy ON users
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Super-admin bypass policy
CREATE POLICY super_admin_bypass ON users
    USING (current_setting('app.user_role') = 'super-admin');
```

#### Migration Cost Assessment

| Aspect | RLS | Schema-per-Tenant | Winner |
|--------|-----|-------------------|--------|
| **Initial Setup** | 2-3 days (policies + middleware) | 5-7 days (schema management service) | RLS |
| **Migration Scripts** | One-time per table | Per-tenant for each schema | RLS |
| **Ongoing Maintenance** | Single schema evolution | N × tenant schema evolution | RLS |
| **Testing Complexity** | Moderate (policy testing) | High (multi-schema coordination) | RLS |
| **Backup/Restore** | Simple (single DB dump) | Complex (per-schema logic) | RLS |
| **Tenant Onboarding** | Instant (INSERT into tenants) | 30-60 sec (CREATE SCHEMA) | RLS |
| **Scaling Limit** | 10,000+ tenants | 500-1000 tenants (connection pool) | RLS |
| **Ops Overhead** | Low | High | RLS |

**Total Estimated Migration Cost:**
- RLS: 2-3 developer-days + 1 day testing
- Schema-per-tenant: 7-10 developer-days + 3 days testing

#### Security Considerations
- Session variables (`current_setting`) must be set via trusted middleware only
- Connection pooling must preserve tenant context or reset between requests
- RLS policies must be tested with adversarial scenarios (JWT tampering, session hijacking)
- Regular security audits of RLS policies and application middleware

---

### TK-003: Permission Middleware Specification

#### Middleware Interface

```typescript
/**
 * Authorization middleware for Express.js applications
 * Validates JWT, extracts tenant/role, sets RLS session variables
 */
interface AuthMiddleware {
  /**
   * Authenticates request and sets req.user context
   */
  authenticate(): ExpressMiddleware;
  
  /**
   * Authorizes request based on required permissions
   * @param permissions - Required permissions (OR logic)
   */
  authorize(permissions: Permission[]): ExpressMiddleware;
  
  /**
   * Sets PostgreSQL session variables for RLS
   */
  setTenantContext(tenantId: string, role: Role): Promise<void>;
}
```

#### JWT Claim Shape

```typescript
interface JWTClaims {
  // Standard claims
  sub: string;              // User ID (UUID)
  iss: string;              // Issuer (auth service URL)
  iat: number;              // Issued at (Unix timestamp)
  exp: number;              // Expiration (Unix timestamp)
  
  // Custom claims
  tenant_id: string;        // Tenant UUID
  role: Role;               // One of: super-admin, tenant-admin, tenant-member, viewer
  permissions: string[];    // Explicit permissions (optional, for fine-grained control)
  email: string;            // User email (for audit logging)
}
```

#### Authorization Flow

```
┌─────────┐      ┌────────────┐      ┌──────────────┐      ┌──────────┐
│ Client  │─────▶│   API      │─────▶│  Auth        │─────▶│ Database │
│ Request │      │  Gateway   │      │  Middleware  │      │ (RLS)    │
└─────────┘      └────────────┘      └──────────────┘      └──────────┘
    │                  │                     │                    │
    │  1. JWT Token    │                     │                    │
    ├─────────────────▶│                     │                    │
    │                  │  2. Verify JWT      │                    │
    │                  ├────────────────────▶│                    │
    │                  │                     │  3. Extract Claims │
    │                  │                     │                    │
    │                  │  4. Set Session Var │                    │
    │                  │     (tenant_id,     │────────────────────▶
    │                  │      role)          │  SET app.current_  │
    │                  │                     │      tenant_id     │
    │                  │                     │                    │
    │                  │  5. Execute Query   │                    │
    │                  │                     ├───────────────────▶│
    │                  │                     │  RLS policies      │
    │                  │                     │  applied           │
    │                  │                     │◀───────────────────│
    │                  │  6. Response        │                    │
    │                  │◀────────────────────│                    │
    │  7. JSON Response│                     │                    │
    │◀─────────────────│                     │                    │
```

#### Error Codes

| Code | HTTP Status | Description | Client Action |
|------|-------------|-------------|---------------|
| `AUTH_001` | 401 | Missing or invalid JWT token | Re-authenticate |
| `AUTH_002` | 401 | Expired JWT token | Refresh token |
| `AUTH_003` | 403 | Insufficient permissions | Contact admin |
| `AUTH_004` | 403 | Tenant access denied | Verify tenant membership |
| `AUTH_005` | 400 | Malformed tenant_id in JWT | Report to support |
| `AUTH_006` | 500 | Failed to set RLS context | Retry request |

#### Middleware Implementation Example

```typescript
// Example: Express middleware implementation
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req.headers.authorization);
    const claims = await verifyJWT(token);
    
    // Attach user context to request
    req.user = {
      id: claims.sub,
      tenantId: claims.tenant_id,
      role: claims.role,
      email: claims.email,
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'AUTH_001', message: 'Invalid token' });
  }
};

export const authorize = (requiredPermissions: Permission[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { role } = req.user;
    
    if (!hasPermission(role, requiredPermissions)) {
      return res.status(403).json({ error: 'AUTH_003', message: 'Insufficient permissions' });
    }
    
    // Set RLS session variables
    await setRLSContext(req.user.tenantId, req.user.role);
    
    next();
  };
};
```

---

## Event Bus Section

### TK-004: Event Bus Technology ADR

**Reference**: [ADR: Event Bus Technology Selection](./adr-event-bus.md)

#### Summary of Decision

**Technology Selected**: **Redis Streams**

**Key Rationale**:
- Lightweight, low-latency message streaming
- Native consumer groups for competing consumers (load balancing)
- Built-in message replay capability (critical for debugging and reprocessing)
- Persistent message history with configurable retention
- Lower operational overhead compared to Kafka (no ZooKeeper, simpler deployment)
- Sufficient throughput for MVP-1 scale (100K+ messages/sec per stream)

**Alternatives Considered**:
- Apache Kafka: Overkill for initial scale, higher ops complexity
- RabbitMQ: Less robust replay/history features
- AWS SQS: Vendor lock-in, higher latency, limited replay

**Trade-offs**:
- ✅ Pros: Simplicity, speed, existing Redis infrastructure reuse
- ❌ Cons: Smaller ecosystem vs Kafka, less mature tooling for monitoring

For full details, see [adr-event-bus.md](./adr-event-bus.md).

---

### TK-005: Outbox/Inbox Pattern with Dead-Letter Strategy

#### Outbox Pattern Design

**Purpose**: Ensure atomic writes to database and event publishing (transactional outbox pattern).

##### Outbox Table Schema

```sql
CREATE TABLE outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(100) NOT NULL,       -- e.g., 'user', 'project', 'order'
    aggregate_id UUID NOT NULL,                 -- ID of the entity
    event_type VARCHAR(100) NOT NULL,           -- e.g., 'user.created', 'project.updated'
    payload JSONB NOT NULL,                     -- Event payload
    tenant_id UUID NOT NULL,                    -- For multi-tenancy filtering
    created_at TIMESTAMP DEFAULT NOW(),
    published_at TIMESTAMP NULL,                -- NULL = not yet published
    published_to_stream VARCHAR(100) NULL,      -- Redis stream name
    retry_count INTEGER DEFAULT 0,
    last_error TEXT NULL,
    status VARCHAR(20) DEFAULT 'pending',       -- pending, published, failed
    INDEX idx_outbox_pending (status, created_at) WHERE status = 'pending'
);
```

##### Outbox Publisher Service

```typescript
/**
 * Background worker that polls outbox table and publishes to Redis Streams
 */
class OutboxPublisher {
  async processOutboxEvents(): Promise<void> {
    const pendingEvents = await db.query(`
      SELECT * FROM outbox_events
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 100
      FOR UPDATE SKIP LOCKED
    `);
    
    for (const event of pendingEvents) {
      try {
        // Publish to Redis Stream
        await redis.xadd(
          `events:${event.aggregate_type}`,
          '*',
          'event_type', event.event_type,
          'payload', JSON.stringify(event.payload),
          'tenant_id', event.tenant_id
        );
        
        // Mark as published
        await db.query(`
          UPDATE outbox_events
          SET status = 'published', published_at = NOW(), published_to_stream = $1
          WHERE id = $2
        `, [`events:${event.aggregate_type}`, event.id]);
        
      } catch (error) {
        // Handle failure (see Dead-Letter Strategy below)
        await this.handlePublishFailure(event, error);
      }
    }
  }
}
```

#### Inbox Pattern Design

**Purpose**: Idempotent event consumption (prevent duplicate processing).

##### Inbox Table Schema

```sql
CREATE TABLE inbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) NOT NULL UNIQUE,      -- Redis Stream message ID or unique event ID
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    tenant_id UUID NOT NULL,
    received_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP NULL,
    status VARCHAR(20) DEFAULT 'pending',       -- pending, processed, failed
    retry_count INTEGER DEFAULT 0,
    last_error TEXT NULL,
    CONSTRAINT uq_event_id UNIQUE (event_id)    -- Idempotency key
);
```

##### Inbox Consumer Service

```typescript
/**
 * Consumer service with idempotency guarantee
 */
class InboxConsumer {
  async consumeEvent(eventId: string, eventType: string, payload: any): Promise<void> {
    // Idempotency check: insert into inbox (will fail if duplicate)
    try {
      await db.query(`
        INSERT INTO inbox_events (event_id, event_type, payload, tenant_id)
        VALUES ($1, $2, $3, $4)
      `, [eventId, eventType, payload, payload.tenant_id]);
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        console.log(`Event ${eventId} already processed, skipping.`);
        return; // Idempotent skip
      }
      throw error;
    }
    
    // Process event
    try {
      await this.processEvent(eventType, payload);
      
      // Mark as processed
      await db.query(`
        UPDATE inbox_events
        SET status = 'processed', processed_at = NOW()
        WHERE event_id = $1
      `, [eventId]);
      
    } catch (error) {
      await this.handleProcessingFailure(eventId, error);
    }
  }
}
```

#### Dead-Letter Queue (DLQ) Strategy

##### DLQ Schema

```sql
CREATE TABLE dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(50) NOT NULL,                -- 'outbox' or 'inbox'
    original_event_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    tenant_id UUID NOT NULL,
    failure_reason TEXT NOT NULL,
    retry_count INTEGER NOT NULL,
    first_failed_at TIMESTAMP NOT NULL,
    last_failed_at TIMESTAMP DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP NULL,
    INDEX idx_dlq_unresolved (resolved, last_failed_at) WHERE NOT resolved
);
```

##### Retry Backoff Policy

```typescript
/**
 * Exponential backoff with jitter
 */
const calculateRetryDelay = (retryCount: number): number => {
  const baseDelay = 1000; // 1 second
  const maxDelay = 3600000; // 1 hour
  const exponentialDelay = baseDelay * Math.pow(2, retryCount);
  const jitter = Math.random() * 1000; // 0-1 second jitter
  return Math.min(exponentialDelay + jitter, maxDelay);
};

const MAX_RETRIES = 5;

async handlePublishFailure(event: OutboxEvent, error: Error): Promise<void> {
  const newRetryCount = event.retry_count + 1;
  
  if (newRetryCount >= MAX_RETRIES) {
    // Move to DLQ
    await db.query(`
      INSERT INTO dead_letter_queue (source, original_event_id, event_type, payload, tenant_id, failure_reason, retry_count, first_failed_at)
      VALUES ('outbox', $1, $2, $3, $4, $5, $6, $7)
    `, [event.id, event.event_type, event.payload, event.tenant_id, error.message, newRetryCount, event.created_at]);
    
    await db.query(`UPDATE outbox_events SET status = 'failed' WHERE id = $1`, [event.id]);
  } else {
    // Schedule retry
    await db.query(`
      UPDATE outbox_events
      SET retry_count = $1, last_error = $2
      WHERE id = $3
    `, [newRetryCount, error.message, event.id]);
  }
}
```

##### DLQ Monitoring & Alerting

- **Alert Rule 1**: DLQ size > 100 events → Page on-call engineer
- **Alert Rule 2**: Event in DLQ for > 4 hours → Create incident ticket
- **Dashboard Metrics**:
  - DLQ size (count of unresolved events)
  - DLQ growth rate (events/hour)
  - Top failure reasons (group by failure_reason)
  - Mean time to resolution (MTTR)

---

## Observability Section

### TK-006: Audit Log Schema + Immutability

#### Audit Log Table Schema

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event Metadata
    event_type VARCHAR(100) NOT NULL,           -- e.g., 'user.login', 'resource.deleted'
    event_category VARCHAR(50) NOT NULL,        -- e.g., 'authentication', 'authorization', 'data_access'
    timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
    
    -- Actor (Who)
    actor_id UUID NOT NULL,                     -- User ID performing the action
    actor_role VARCHAR(50) NOT NULL,            -- Role at time of action
    actor_email VARCHAR(255),                   -- For human readability (masked if PII)
    
    -- Target (What)
    resource_type VARCHAR(100),                 -- e.g., 'project', 'user', 'file'
    resource_id UUID,                           -- ID of affected resource
    
    -- Context (Where/How)
    tenant_id UUID NOT NULL,                    -- Tenant context
    ip_address VARCHAR(45),                     -- IPv4 or IPv6 (masked per PII rules)
    user_agent TEXT,                            -- Browser/client info (hashed per PII rules)
    request_id UUID NOT NULL,                   -- Trace correlation ID
    
    -- Change Details
    action VARCHAR(50) NOT NULL,                -- e.g., 'create', 'read', 'update', 'delete'
    old_values JSONB,                           -- Previous state (for updates)
    new_values JSONB,                           -- New state (for creates/updates)
    
    -- Compliance & Security
    severity VARCHAR(20) DEFAULT 'info',        -- info, warning, critical
    status VARCHAR(20) NOT NULL,                -- success, failure, denied
    error_code VARCHAR(50),                     -- If status = failure/denied
    
    -- Immutability Enforcement
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    
    -- Indexes for query performance
    INDEX idx_audit_tenant_time (tenant_id, timestamp DESC),
    INDEX idx_audit_actor (actor_id, timestamp DESC),
    INDEX idx_audit_resource (resource_type, resource_id, timestamp DESC),
    INDEX idx_audit_event_type (event_type, timestamp DESC)
);

-- Immutability: Disable UPDATE and DELETE
CREATE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- Alternative: Use trigger for enforcement
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs table is append-only, modifications are not allowed';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_update_audit_logs
BEFORE UPDATE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER no_delete_audit_logs
BEFORE DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
```

#### Append-Only Enforcement Strategy

1. **Database-Level Protection**:
   - PostgreSQL rules (as shown above) reject UPDATE/DELETE at query execution
   - Triggers provide custom error messages
   - Revoke UPDATE/DELETE privileges from application database user

2. **Application-Level Safeguards**:
   - ORM models for `audit_logs` only expose `create()` method, no `update()` or `delete()`
   - Code review checklist: flag any UPDATE/DELETE queries on audit_logs
   - Automated linting rule to detect forbidden operations

3. **Operational Controls**:
   - Separate database role for audit log ingestion (write-only)
   - Separate read-only role for audit log queries
   - DBA access logged and reviewed for any schema modifications

#### Retention Policy

| Log Type | Retention Period | Archive Strategy | Justification |
|----------|------------------|------------------|---------------|
| **Standard Audit Logs** | 90 days (hot) + 2 years (cold archive) | Move to S3/Glacier after 90 days | Business analytics, debugging |
| **Security Events** | 365 days (hot) + 7 years (cold archive) | Move to compliant archive storage | Compliance (SOC2, GDPR, HIPAA) |
| **Authentication Logs** | 180 days (hot) + 2 years (cold archive) | Export to SIEM system | Security monitoring |

**Implementation**:
```sql
-- Partition by month for efficient archival
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Archive job (runs monthly)
-- 1. Export old partition to S3
-- 2. Drop partition from hot storage
-- 3. Maintain archive index in separate metadata table
```

---

### TK-007: PII Fields Registry + Masking Rules

**Reference**: [ADR: PII Masking Approach](./adr-pii-masking.md)

#### Decision Summary

**Approach**: Field-level masking at application layer before logging/export.

**Rationale**:
- Consistent masking across all log sinks (files, streams, databases)
- Application-controlled (no reliance on database-specific features)
- Testable and auditable masking logic
- Flexibility to apply different rules per environment (production vs staging)

For full ADR, see [adr-pii-masking.md](./adr-pii-masking.md).

#### PII Fields Registry

| Field Name | Data Type | Context | Sensitivity Level | Masking Required |
|------------|-----------|---------|-------------------|------------------|
| `email` | String | User contact, audit logs | Medium | Yes |
| `phone` | String | User contact | Medium | Yes |
| `full_name` | String | User profile, audit logs | Medium | Yes |
| `ip_address` | String | Request logs, audit logs | Low-Medium | Yes |
| `user_agent` | String | Request logs | Low | Yes |
| `address` | Object | User profile, shipping | High | Yes |
| `ssn` | String | User verification (future) | Critical | Yes (not in MVP-1) |
| `credit_card` | String | Payment (future) | Critical | Yes (not in MVP-1) |

#### Masking Rules

```typescript
/**
 * PII Masking Rules per field type
 */
const maskingRules = {
  email: (email: string): string => {
    // Show first 2 chars + ***@domain.com
    // Example: "john.doe@example.com" → "jo***@example.com"
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `***@${domain}`;
    return `${local.substring(0, 2)}***@${domain}`;
  },
  
  phone: (phone: string): string => {
    // Show last 4 digits only
    // Example: "+1-555-123-4567" → "***-***-***-4567"
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 4) return '****';
    return `***-***-***-${digits.slice(-4)}`;
  },
  
  full_name: (name: string): string => {
    // Show initials only
    // Example: "John Michael Doe" → "J.M.D."
    const parts = name.trim().split(/\s+/);
    return parts.map(p => p[0].toUpperCase() + '.').join('');
  },
  
  ip_address: (ip: string): string => {
    // Zero out last octet for IPv4, last 80 bits for IPv6
    // Example: "192.168.1.42" → "192.168.1.0"
    if (ip.includes(':')) {
      // IPv6: mask last 80 bits
      return ip.split(':').slice(0, 3).join(':') + ':0:0:0:0:0';
    } else {
      // IPv4: mask last octet
      return ip.split('.').slice(0, 3).join('.') + '.0';
    }
  },
  
  user_agent: (ua: string): string => {
    // Hash the entire user agent string
    // Example: "Mozilla/5.0..." → "sha256:a3f2c8d..."
    return `sha256:${crypto.createHash('sha256').update(ua).digest('hex').substring(0, 16)}`;
  },
  
  address: (address: AddressObject): Partial<AddressObject> => {
    // Show only city + country
    // Example: { street: "123 Main St", city: "Seattle", state: "WA", zip: "98101", country: "USA" }
    //       → { city: "Seattle", country: "USA" }
    return {
      city: address.city,
      country: address.country,
    };
  },
};
```

#### Masking Middleware

```typescript
/**
 * Apply PII masking before logging
 */
function maskPII(data: any, environment: string = 'production'): any {
  // Skip masking in local dev
  if (environment === 'development') return data;
  
  const masked = { ...data };
  
  if (masked.email) masked.email = maskingRules.email(masked.email);
  if (masked.phone) masked.phone = maskingRules.phone(masked.phone);
  if (masked.full_name) masked.full_name = maskingRules.full_name(masked.full_name);
  if (masked.ip_address) masked.ip_address = maskingRules.ip_address(masked.ip_address);
  if (masked.user_agent) masked.user_agent = maskingRules.user_agent(masked.user_agent);
  if (masked.address) masked.address = maskingRules.address(masked.address);
  
  return masked;
}

// Usage in logging
logger.info('User login', maskPII({
  user_id: '123',
  email: 'user@example.com',
  ip_address: '192.168.1.42',
}));
// Output: { user_id: '123', email: 'us***@example.com', ip_address: '192.168.1.0' }
```

#### Testing Strategy

```typescript
describe('PII Masking Rules', () => {
  it('should mask email correctly', () => {
    expect(maskingRules.email('john.doe@example.com')).toBe('jo***@example.com');
    expect(maskingRules.email('a@test.com')).toBe('***@test.com');
  });
  
  it('should mask phone correctly', () => {
    expect(maskingRules.phone('+1-555-123-4567')).toBe('***-***-***-4567');
  });
  
  it('should mask full name correctly', () => {
    expect(maskingRules.full_name('John Michael Doe')).toBe('J.M.D.');
  });
  
  it('should mask IP address correctly', () => {
    expect(maskingRules.ip_address('192.168.1.42')).toBe('192.168.1.0');
  });
  
  // Additional tests for edge cases
});
```

---

## Data Models

### Core Entities

#### Tenant Entity

```typescript
interface Tenant {
  id: string;                   // UUID
  name: string;                 // Tenant display name
  slug: string;                 // URL-friendly identifier (unique)
  status: 'active' | 'suspended' | 'deleted';
  plan_tier: 'free' | 'pro' | 'enterprise';
  created_at: Date;
  updated_at: Date;
  settings: TenantSettings;     // JSONB config
}

interface TenantSettings {
  max_users: number;
  max_projects: number;
  features_enabled: string[];   // Feature flags
  retention_days: number;
}
```

#### User Entity

```typescript
interface User {
  id: string;                   // UUID
  tenant_id: string;            // Foreign key to tenants
  email: string;
  full_name: string;
  role: 'super-admin' | 'tenant-admin' | 'tenant-member' | 'viewer';
  status: 'active' | 'invited' | 'suspended';
  created_at: Date;
  last_login_at: Date | null;
}
```

#### Resource Entity (Generic)

```typescript
interface Resource {
  id: string;                   // UUID
  tenant_id: string;            // Foreign key for RLS
  resource_type: string;        // e.g., 'project', 'document', 'file'
  name: string;
  owner_id: string;             // User ID
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, any>; // Flexible JSONB field
}
```

### Event Models

#### Domain Event Schema

```typescript
interface DomainEvent {
  event_id: string;             // UUID
  event_type: string;           // e.g., 'user.created', 'project.updated'
  aggregate_type: string;       // e.g., 'user', 'project'
  aggregate_id: string;         // Entity ID
  tenant_id: string;
  payload: Record<string, any>;
  metadata: EventMetadata;
  timestamp: Date;
}

interface EventMetadata {
  correlation_id: string;       // Request trace ID
  causation_id: string;         // Parent event ID (for event chains)
  actor_id: string;             // User who triggered the event
  version: number;              // Event schema version
}
```

---

## API Touchpoints

### Authentication Endpoints

```
POST /api/v1/auth/login
  Request: { email, password }
  Response: { access_token, refresh_token, user: { id, tenant_id, role } }

POST /api/v1/auth/refresh
  Request: { refresh_token }
  Response: { access_token }

POST /api/v1/auth/logout
  Headers: Authorization: Bearer <token>
  Response: 204 No Content
```

### Tenant Management (super-admin only)

```
GET /api/v1/tenants
  Response: { tenants: Tenant[], pagination: {...} }

POST /api/v1/tenants
  Request: { name, slug, plan_tier }
  Response: { tenant: Tenant }

GET /api/v1/tenants/:tenantId
  Response: { tenant: Tenant }

PATCH /api/v1/tenants/:tenantId
  Request: { name?, status?, settings? }
  Response: { tenant: Tenant }
```

### User Management (tenant-admin + super-admin)

```
GET /api/v1/tenants/:tenantId/users
  Response: { users: User[], pagination: {...} }

POST /api/v1/tenants/:tenantId/users
  Request: { email, full_name, role }
  Response: { user: User, invite_link: string }

PATCH /api/v1/tenants/:tenantId/users/:userId
  Request: { role?, status? }
  Response: { user: User }

DELETE /api/v1/tenants/:tenantId/users/:userId
  Response: 204 No Content
```

### Audit Logs (tenant-admin + super-admin)

```
GET /api/v1/audit-logs
  Query Params: tenant_id?, actor_id?, resource_type?, event_type?, start_date?, end_date?, page?, limit?
  Response: { logs: AuditLog[], pagination: {...} }

GET /api/v1/audit-logs/export
  Query Params: (same as above) + format=csv|json
  Response: File download (CSV or JSON)
```

### Resource Operations (tenant-scoped, RLS-protected)

```
GET /api/v1/resources
  Headers: Authorization: Bearer <token> (tenant_id extracted from JWT)
  Response: { resources: Resource[] } (filtered by RLS)

POST /api/v1/resources
  Request: { resource_type, name, metadata }
  Response: { resource: Resource }

GET /api/v1/resources/:resourceId
  Response: { resource: Resource }

PATCH /api/v1/resources/:resourceId
  Request: { name?, metadata? }
  Response: { resource: Resource }

DELETE /api/v1/resources/:resourceId
  Response: 204 No Content
```

---

## Implementation Tasks

### Task Breakdown Table (TK-001 to TK-013)

| Task ID | Story | Task Description | Owner Agent | Dependencies | Definition of Done |
|---------|-------|------------------|-------------|--------------|-------------------|
| **TK-001** | US-001 | Define tenant role taxonomy: Document 4 roles (super-admin, tenant-admin, tenant-member, viewer) with complete permissions matrix | swe | None | ✅ Role matrix documented in tech-plan.md<br>✅ Permissions matrix reviewed and approved by PM/security<br>✅ Reference doc committed |
| **TK-002** | US-001 | Implement RLS isolation strategy: Create PostgreSQL RLS policies for tenant isolation, migration scripts, set-session-variable logic | swe | TK-001 | ✅ RLS policies created for all tenant-scoped tables<br>✅ Migration scripts tested on staging DB<br>✅ Session variable setting tested<br>✅ Adversarial testing passed (cannot access other tenant data) |
| **TK-003** | US-001 | Build permission middleware: Implement JWT authentication + authorization middleware with role-based access control | swe | TK-001, TK-002 | ✅ Middleware code complete (authenticate + authorize functions)<br>✅ JWT parsing and validation working<br>✅ RLS context setting integrated<br>✅ Unit tests pass (100% coverage on auth logic)<br>✅ Integration tests pass (API routes protected correctly) |
| **TK-004** | US-003 | Event bus technology ADR: Research and document decision for event bus technology (Redis Streams vs alternatives) | swe | None | ✅ ADR document created (adr-event-bus.md)<br>✅ Alternatives evaluated (Kafka, RabbitMQ, SQS)<br>✅ Decision rationale documented<br>✅ ADR reviewed and approved by architect |
| **TK-005** | US-003 | Outbox/inbox pattern implementation: Implement transactional outbox, inbox with idempotency, Redis Streams integration | swe | TK-004 | ✅ Outbox and inbox tables created<br>✅ Outbox publisher service implemented and running<br>✅ Inbox consumer service implemented<br>✅ Idempotency guaranteed (tested with duplicate messages)<br>✅ Integration tests pass (end-to-end event flow)<br>✅ Performance test: 1000 events/sec sustained |
| **TK-006** | US-005 | Audit log schema + immutability: Design and implement append-only audit log table with PostgreSQL rules/triggers | swe | None | ✅ Audit log table schema created<br>✅ Immutability enforced (rules + triggers tested)<br>✅ Indexes created for query performance<br>✅ Migration script merged to main<br>✅ Insert-only access verified (UPDATE/DELETE rejected) |
| **TK-007** | US-005 | PII fields registry + masking: Document PII fields and implement field-level masking logic for logs | swe | TK-006 | ✅ PII fields registry documented (8+ fields)<br>✅ Masking rules implemented (6 field types)<br>✅ ADR merged (adr-pii-masking.md)<br>✅ Unit tests pass (masking correctness verified)<br>✅ Masking middleware integrated into logger |
| **TK-008** | US-003 | Dead-letter queue monitoring: Configure alerting and dashboards for DLQ events (Prometheus/Grafana or equivalent) | devops | TK-005 | ✅ DLQ metrics exposed (count, growth rate, top errors)<br>✅ Alert rule 1: DLQ size > 100 (page on-call)<br>✅ Alert rule 2: Event age > 4 hours (create ticket)<br>✅ Dashboard created (DLQ size, error reasons, MTTR)<br>✅ Alert routing tested (test alert received) |
| **TK-009** | US-005 | Observability pipeline setup: Set up centralized logging, metrics collection, tracing for audit logs and events | devops | TK-006, TK-007 | ✅ Log aggregation configured (ship to central sink)<br>✅ Metrics pipeline live (Prometheus scraping)<br>✅ Tracing enabled (correlation IDs in logs)<br>✅ Dashboards created (audit log volume, latency, error rates)<br>✅ Retention policy enforced (90-day hot + archive) |
| **TK-010** | US-001 | RBAC QA test cases: Write and execute test cases for RBAC functionality mapped to US-001 acceptance criteria | qa | TK-003 | ✅ Test cases documented (mapped to US-001 AC)<br>✅ Positive tests: All 4 roles can access permitted resources<br>✅ Negative tests: All 4 roles denied on forbidden actions<br>✅ Tenant isolation verified (cannot access other tenant data)<br>✅ All tests passing in staging environment |
| **TK-011** | US-003 | Event bus QA test cases: Write and execute test cases for event bus (outbox/inbox, idempotency, DLQ) | qa | TK-005 | ✅ Test cases documented (mapped to US-003 AC)<br>✅ Happy path: Event published and consumed successfully<br>✅ Idempotency: Duplicate events not reprocessed<br>✅ DLQ: Failed events land in DLQ after max retries<br>✅ Performance: 1000 events/sec throughput verified<br>✅ All tests passing |
| **TK-012** | US-005 | Audit/observability QA test cases: Write and execute test cases for audit logs, PII masking, immutability | qa | TK-007 | ✅ Test cases documented (mapped to US-005 AC)<br>✅ Audit logs written for all critical actions<br>✅ PII masking verified (check logs for unmasked PII)<br>✅ Immutability verified (UPDATE/DELETE attempts fail)<br>✅ Query performance acceptable (<500ms for typical queries)<br>✅ All tests passing |
| **TK-013** | US-001 | Release checklist for RBAC: Create release checklist covering deployment steps, rollback plan, monitoring | devops | TK-010 | ✅ Release checklist document created<br>✅ Pre-deployment checks listed (DB migration, env vars, secrets)<br>✅ Deployment steps documented (blue/green or canary)<br>✅ Rollback procedure documented<br>✅ Post-deployment validation steps listed<br>✅ Monitoring/alerting verification included<br>✅ Checklist reviewed and approved by SRE |

---

## Risks

### Technical Risks

| Risk ID | Risk | Impact | Probability | Mitigation |
|---------|------|--------|-------------|------------|
| **R-001** | RLS performance degradation at scale (>1000 tenants) | High | Medium | ⚠️ Mitigation: Run performance tests with synthetic data at 10x scale; monitor query execution plans; establish query latency SLOs; prepare migration path to schema-per-tenant if RLS becomes bottleneck |
| **R-002** | Redis Streams message loss during Redis outage | High | Low | ⚠️ Mitigation: Enable Redis persistence (AOF + RDB); use Redis cluster for HA; outbox pattern ensures events are not lost (republish after Redis recovery) |
| **R-003** | JWT token compromise leading to unauthorized access | Critical | Low | ⚠️ Mitigation: Short-lived access tokens (15 min); refresh token rotation; secure token storage; rate limiting on auth endpoints; anomaly detection for suspicious access patterns |
| **R-004** | PII leakage through improperly masked logs | High | Medium | ⚠️ Mitigation: Automated tests for masking rules; code review checklist; log scanning tool to detect unmasked PII patterns; regular security audits |
| **R-005** | Event processing lag causing stale data | Medium | Medium | ⚠️ Mitigation: Monitor lag metrics (event age in queue); autoscale consumer workers; establish event processing SLO (p95 < 5 seconds); dead-letter queue for failed events |
| **R-006** | Database connection pool exhaustion | Medium | Medium | ⚠️ Mitigation: Connection pooling with PgBouncer; monitor active connections; set max connection limits per service; optimize long-running queries |
| **R-007** | Audit log storage costs exceed budget | Medium | High | ⚠️ Mitigation: Partition tables by month; archive old data to S3/Glacier; implement retention policy enforcement; compress archived data |

### Operational Risks

| Risk ID | Risk | Impact | Probability | Mitigation |
|---------|------|--------|-------------|------------|
| **O-001** | Team lacks Redis Streams operational experience | Low | High | ⚠️ Mitigation: Training session on Redis Streams; runbook for common operations (scaling, monitoring); external consultant review of architecture |
| **O-002** | Insufficient monitoring leading to undetected failures | High | Medium | ⚠️ Mitigation: Comprehensive alerting on DLQ, audit log ingestion rate, RLS query performance; weekly review of dashboards; on-call rotation training |
| **O-003** | Migration downtime exceeds maintenance window | Medium | Medium | ⚠️ Mitigation: Test migrations on staging with production-scale data; online migration strategy for large tables; rollback plan prepared |

---

## Open Questions

### Q1: Row-Level Security vs Schema-per-Tenant ✅ DECIDED

**Status**: **DECIDED → Row-Level Security (RLS)**

**Decision**: Use PostgreSQL Row-Level Security (RLS) for tenant isolation.

**Rationale**:
- Lower initial implementation cost (2-3 dev-days vs 7-10 dev-days)
- Simpler operational model (single schema vs N tenant schemas)
- Better scaling characteristics (10K+ tenants vs 500-1000 limit)
- PostgreSQL RLS is mature and battle-tested in production
- Migration path available if RLS becomes bottleneck (can migrate to schema-per-tenant later)

**Migration Cost Assessment**: See [TK-002 section](#tk-002-tenant-isolation-strategy) for detailed comparison table.

**Follow-up Actions**:
- [x] Document RLS policies for all tenant-scoped tables
- [x] Create performance testing plan for RLS at scale
- [ ] Set up monitoring for RLS query performance (p95 latency SLO)

---

### Q5: Phased vs Simultaneous Blue/Green Rollout 🚩 FLAG FOR DEVOPS

**Status**: **FLAGGED FOR DEVOPS AGENT**

**Context**: 
For MVP-1 deployment, should we roll out RBAC, event bus, and observability features simultaneously (big-bang deployment) or in phases (incremental rollout)?

**Recommendation** (from SWE perspective):

**Option A: Phased Rollout (Recommended)**
- Phase 1: Deploy RBAC + audit logs (TK-001, TK-002, TK-003, TK-006, TK-007) — Week 1
- Phase 2: Deploy event bus (TK-004, TK-005) — Week 2
- Phase 3: Deploy observability pipeline (TK-009) — Week 3
- Use feature flags to enable/disable features per tenant

**Pros**:
- Lower blast radius if issues arise
- Easier rollback (smaller change sets)
- Incremental validation and monitoring
- Team can focus on one feature area at a time

**Cons**:
- Longer total deployment timeline
- Feature flag overhead
- Potential for inconsistent state between phases

**Option B: Simultaneous Deployment**
- Deploy all features in single blue/green cutover
- Full integration testing before cutover
- All-or-nothing rollback

**Pros**:
- Faster time-to-market (single deployment event)
- No feature flag complexity
- Consistent state (all features live together)

**Cons**:
- Higher risk (larger change set)
- More complex rollback
- Requires extensive pre-deployment testing

**DevOps Action Required**:
- [ ] Review recommendation and make final deployment strategy decision
- [ ] Document deployment plan in release checklist (TK-013)
- [ ] Coordinate with QA for phased vs full integration testing
- [ ] Set up feature flags if phased approach selected

---

## Implementation Notes

### Mapping to User Stories

#### US-001: Multi-Tenant RBAC System

**Implementation Tasks**:
- TK-001: Role taxonomy definition
- TK-002: RLS isolation implementation
- TK-003: Permission middleware
- TK-010: QA test cases for RBAC
- TK-013: Release checklist

**Technical Approach**:
1. Define 4-tier role model (super-admin → tenant-admin → tenant-member → viewer)
2. Implement PostgreSQL RLS policies for automatic tenant filtering
3. Build JWT-based authentication middleware that sets RLS session variables
4. Create authorization middleware that enforces role-based permissions
5. Comprehensive testing: unit tests (middleware), integration tests (API routes), adversarial tests (cross-tenant access attempts)

**Key Deliverables**:
- Permissions matrix documentation
- Database migration scripts for RLS policies
- Reusable middleware components (`authenticate()`, `authorize()`, `setTenantContext()`)
- Test suite with 95%+ coverage on auth logic

---

#### US-003: Event-Driven Architecture with Outbox/Inbox

**Implementation Tasks**:
- TK-004: Event bus technology ADR
- TK-005: Outbox/inbox pattern implementation
- TK-008: DLQ monitoring setup
- TK-011: QA test cases for event bus

**Technical Approach**:
1. Research and document event bus technology decision (ADR) → **Decision: Redis Streams**
2. Implement transactional outbox pattern:
   - Write domain events to `outbox_events` table in same transaction as business logic
   - Background worker polls outbox and publishes to Redis Streams
3. Implement idempotent inbox pattern:
   - Consumer writes to `inbox_events` table (unique constraint on event_id)
   - Process event only if insert succeeds (idempotency guarantee)
4. Dead-letter queue for failed events after max retries (5 attempts with exponential backoff)
5. Monitoring and alerting on DLQ size and event lag

**Key Deliverables**:
- ADR document for event bus technology selection
- Outbox publisher service (background worker)
- Inbox consumer service with idempotency
- DLQ management and monitoring dashboards

---

#### US-005: Comprehensive Observability & Audit Logging

**Implementation Tasks**:
- TK-006: Audit log schema + immutability
- TK-007: PII fields registry + masking
- TK-009: Observability pipeline setup
- TK-012: QA test cases for audit/observability

**Technical Approach**:
1. Design append-only audit log table with comprehensive event metadata
2. Enforce immutability via PostgreSQL rules and triggers (no UPDATE/DELETE)
3. Document PII fields and implement field-level masking rules (6 field types)
4. Create masking middleware for all log outputs
5. Set up centralized logging pipeline with retention policies
6. Configure metrics and alerting for audit log ingestion rate and storage

**Key Deliverables**:
- Audit log database schema with immutability enforcement
- PII masking ADR and implementation
- Masking middleware integrated into logger
- Observability pipeline (logs, metrics, traces)
- Retention policy automation (partition + archive)

---

### Development Workflow

```
┌─────────────┐
│ TK-001      │  Define role taxonomy
│ (2 days)    │
└──────┬──────┘
       │
       ├──────────────────────┐
       │                      │
┌──────▼──────┐        ┌──────▼──────┐
│ TK-002      │        │ TK-004      │  Event bus ADR
│ (3 days)    │        │ (1 day)     │
│ RLS impl    │        └──────┬──────┘
└──────┬──────┘               │
       │                ┌─────▼──────┐
┌──────▼──────┐        │ TK-005      │
│ TK-003      │        │ (5 days)    │
│ (4 days)    │        │ Outbox/inbox│
│ Middleware  │        └──────┬──────┘
└──────┬──────┘               │
       │                      ├────────────────┐
       │                      │                │
┌──────▼──────┐        ┌──────▼──────┐ ┌──────▼──────┐
│ TK-010      │        │ TK-008      │ │ TK-011      │
│ (3 days)    │        │ (2 days)    │ │ (3 days)    │
│ RBAC QA     │        │ DLQ monitor │ │ Event QA    │
└──────┬──────┘        └─────────────┘ └─────────────┘
       │
┌──────▼──────┐
│ TK-013      │
│ (1 day)     │
│ Release     │
└─────────────┘

Parallel track for Observability:

┌─────────────┐
│ TK-006      │  Audit log schema
│ (2 days)    │
└──────┬──────┘
       │
┌──────▼──────┐
│ TK-007      │  PII masking
│ (3 days)    │
└──────┬──────┘
       │
       ├────────────────┐
       │                │
┌──────▼──────┐  ┌──────▼──────┐
│ TK-009      │  │ TK-012      │
│ (4 days)    │  │ (3 days)    │
│ Obs pipeline│  │ Obs QA      │
└─────────────┘  └─────────────┘
```

**Total Estimated Duration**: 
- **RBAC track**: 2 + 3 + 4 + 3 + 1 = 13 days
- **Event Bus track**: 1 + 5 + 2 + 3 = 11 days (parallel with RBAC after TK-001)
- **Observability track**: 2 + 3 + 4 + 3 = 12 days (fully parallel)
- **Critical path**: RBAC track (13 days)
- **Calendar time with parallelization**: ~15 days (accounting for cross-team coordination)

---

### Testing Strategy

#### Unit Tests
- Auth middleware: JWT parsing, role validation, error handling
- PII masking: All 6 field types, edge cases
- Event serialization/deserialization
- RLS policy logic (via test database)

**Target Coverage**: 95%+ for business logic, 100% for security-critical code (auth, masking)

#### Integration Tests
- End-to-end API request flow (authentication → authorization → RLS filtering → response)
- Event flow: Write to outbox → Publish to Redis → Consume from inbox → Process
- Cross-tenant isolation: Verify tenant A cannot access tenant B's data
- Audit logging: Verify logs written for all critical operations

**Test Environment**: Staging database with multi-tenant synthetic data (10 tenants, 100 users, 1000 resources)

#### Performance Tests
- RLS query performance: p95 latency < 100ms for typical queries
- Event throughput: 1000 events/sec sustained for 5 minutes
- Concurrent user load: 100 simultaneous users across 10 tenants
- Database connection pool: No exhaustion under peak load

**Load Testing Tool**: k6 or Locust

#### Security Tests
- Adversarial testing: JWT tampering, cross-tenant access attempts, SQL injection
- PII leakage scanning: Automated scan of logs for unmasked PII patterns
- Penetration testing: Third-party security review (pre-production)

---

### Monitoring & Observability

#### Key Metrics

**RBAC Metrics**:
- `auth_requests_total{status="success|failure"}` (counter)
- `auth_latency_seconds` (histogram)
- `rbac_denials_total{role, permission}` (counter)
- `rls_query_duration_seconds` (histogram)

**Event Bus Metrics**:
- `outbox_events_published_total` (counter)
- `outbox_events_failed_total` (counter)
- `inbox_events_processed_total` (counter)
- `inbox_events_duplicate_total` (counter)
- `dlq_events_total` (gauge)
- `event_processing_lag_seconds` (gauge)

**Audit Log Metrics**:
- `audit_logs_written_total{event_type}` (counter)
- `audit_logs_write_latency_seconds` (histogram)
- `audit_logs_storage_bytes` (gauge)
- `pii_masking_operations_total{field_type}` (counter)

#### Alerts

**Critical Alerts (Page on-call)**:
- Auth service down (0 successful auth requests in 5 minutes)
- RLS query latency p95 > 500ms (performance degradation)
- DLQ size > 100 events (event processing failure)
- Audit log write failure rate > 1% (data loss risk)

**Warning Alerts (Slack notification)**:
- Event processing lag > 30 seconds
- RLS query latency p95 > 200ms
- DLQ size > 10 events
- Audit log storage > 80% of quota

---

## Appendix

### Glossary

- **RLS**: Row-Level Security (PostgreSQL feature for row-level access control)
- **JWT**: JSON Web Token (stateless authentication token)
- **DLQ**: Dead-Letter Queue (queue for failed messages)
- **PII**: Personally Identifiable Information (sensitive user data)
- **ADR**: Architecture Decision Record (document for significant decisions)
- **Outbox Pattern**: Transactional pattern for reliable event publishing
- **Inbox Pattern**: Idempotent pattern for reliable event consumption

### References

- [PostgreSQL Row-Level Security Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Redis Streams Documentation](https://redis.io/docs/data-types/streams/)
- [Transactional Outbox Pattern](https://microservices.io/patterns/data/transactional-outbox.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [ADR Template](https://github.com/joelparkerhenderson/architecture-decision-record)

---

**Document Status**: Ready for Review  
**Next Steps**: 
1. Architect review and approval
2. PM review of task breakdown and estimates
3. Security review of RBAC and PII masking approach
4. DevOps input on deployment strategy (Q5)
5. Begin implementation with TK-001 and TK-004 (parallel tracks)
