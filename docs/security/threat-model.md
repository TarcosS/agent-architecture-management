# Threat Model - Agent Architecture Management Platform

**Version:** 1.0  
**Last Updated:** 2024-02-21  
**Owner:** Security Agent  
**Status:** Active

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Assets & Trust Boundaries](#assets--trust-boundaries)
4. [Data Boundary Diagram](#data-boundary-diagram)
5. [STRIDE Analysis](#stride-analysis)
6. [Secrets Inventory](#secrets-inventory)
7. [Vault & Secrets Management Strategy](#vault--secrets-management-strategy)
8. [Threat Summary](#threat-summary)
9. [Mitigations & Security Checklist](#mitigations--security-checklist)
10. [Open Questions & Decisions](#open-questions--decisions)

---

## Executive Summary

This document provides a comprehensive STRIDE-based threat model for the Agent Architecture Management Platform, a multi-tenant SaaS application with role-based access control (RBAC), audit logging, and event-driven architecture.

**Key Security Objectives:**
- **Confidentiality:** Protect tenant data, PII, and secrets
- **Integrity:** Ensure audit logs are tamper-proof and tenant isolation is enforced
- **Availability:** Prevent denial of service and ensure system resilience
- **Accountability:** Maintain comprehensive audit trails for compliance (GDPR, SOC2)

**Critical Threats Identified:** 8 threats with severity Critical (2), High (3), Medium (2), Low (1)

---

## System Overview

The platform consists of:
- **Web Application** (`apps/web`): React/TypeScript frontend
- **Authentication Service:** OAuth2/OIDC token exchange, session management
- **Authorization Middleware:** Permission enforcement (RBAC - US-001, US-002)
- **Audit Log Pipeline:** Centralized logging with GDPR considerations (R-004)
- **Event Bus:** Inter-service communication for async operations
- **PII Registry Service:** Tracks and manages PII data (US-006)
- **Multi-Tenant Database:** Tenant-isolated data storage
- **Secrets Manager/Vault:** Centralized secrets storage

**Security-Relevant User Stories:**
- **US-001:** RBAC implementation
- **US-002:** Permission enforcement middleware
- **US-006:** PII registry and data classification

**Security Risks:**
- **R-004:** Audit log retention vs GDPR right to erasure
- **R-006:** HIGH severity threats requiring architectural mitigation

---

## Assets & Trust Boundaries

### Critical Assets to Protect

| Asset | Classification | Impact if Compromised |
|-------|---------------|----------------------|
| **Tenant Data** | Confidential | Critical - data breach, regulatory fines |
| **PII (Personally Identifiable Information)** | Sensitive | Critical - GDPR violations, reputation damage |
| **Authentication Tokens** | Secret | Critical - account takeover, lateral movement |
| **Database Credentials** | Secret | Critical - full data access |
| **API Keys (3rd party)** | Secret | High - service compromise, cost overruns |
| **Signing Keys (JWT/SAML)** | Secret | Critical - authentication bypass |
| **Audit Logs** | Confidential | High - compliance failure, forensic loss |
| **User Session Data** | Confidential | High - session hijacking |
| **Configuration Secrets** | Secret | Medium - misconfiguration exploitation |
| **Tenant Tokens/API Keys** | Secret | Critical - tenant impersonation |

### Trust Boundaries

1. **Internet ↔ Edge Gateway**
   - External users/attackers → TLS termination
   - DDoS protection, WAF

2. **Edge Gateway ↔ Web Application**
   - Public internet → Authenticated zone
   - Session validation, CSRF protection

3. **Web Application ↔ Backend Services**
   - Authenticated zone → Authorization zone
   - JWT validation, RBAC enforcement

4. **Backend Services ↔ Event Bus**
   - Internal services → Message queue
   - Message signing, schema validation

5. **Services ↔ Database**
   - Application layer → Data layer
   - Connection pooling, encrypted connections

6. **Services ↔ Secrets Manager**
   - Application layer → Secrets vault
   - Mutual TLS, access policies

7. **Tenant A Data ↔ Tenant B Data**
   - Critical logical boundary
   - Row-level security, tenant_id filtering

---

## Data Boundary Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          INTERNET (Untrusted)                        │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTPS/TLS
                    ┌────────────▼────────────┐
                    │   WAF / Load Balancer   │
                    │  (DDoS Protection)      │
                    └────────────┬────────────┘
                                 │
┌────────────────────────────────┼────────────────────────────────────┐
│  DMZ / EDGE ZONE               │                                     │
│                   ┌────────────▼────────────┐                        │
│                   │   API Gateway / Proxy   │                        │
│                   │  (Rate Limiting, AuthN) │                        │
│                   └────────────┬────────────┘                        │
└────────────────────────────────┼────────────────────────────────────┘
                                 │ JWT Token
┌────────────────────────────────┼────────────────────────────────────┐
│  APPLICATION ZONE              │                                     │
│                   ┌────────────▼────────────┐                        │
│                   │   Web App (apps/web)    │                        │
│                   │   React/TypeScript      │                        │
│                   └────────────┬────────────┘                        │
│                                │                                     │
│         ┌──────────────────────┼──────────────────────┐              │
│         │                      │                      │              │
│  ┌──────▼──────┐      ┌───────▼────────┐    ┌───────▼────────┐     │
│  │   AuthN     │      │  Permission    │    │   PII Registry │     │
│  │   Service   │      │  Middleware    │    │   (US-006)     │     │
│  │ (US-001)    │      │  (US-002)      │    └───────┬────────┘     │
│  └──────┬──────┘      └───────┬────────┘            │              │
│         │                     │                     │              │
│         └──────────┬──────────┴─────────────────────┘              │
│                    │                                                │
│         ┌──────────▼─────────────┐                                  │
│         │     Event Bus          │                                  │
│         │  (Message Signing)     │                                  │
│         └──────────┬─────────────┘                                  │
│                    │                                                │
└────────────────────┼────────────────────────────────────────────────┘
                     │
┌────────────────────┼────────────────────────────────────────────────┐
│  SERVICE MESH      │                                                 │
│  (Mutual TLS)      │                                                 │
│         ┌──────────▼─────────────┐                                  │
│         │   Audit Log Pipeline   │                                  │
│         │   (Tamper-proof)       │                                  │
│         └──────────┬─────────────┘                                  │
└────────────────────┼────────────────────────────────────────────────┘
                     │
┌────────────────────┼────────────────────────────────────────────────┐
│  DATA LAYER        │                                                 │
│                    │                                                 │
│  ┌─────────────────▼──────────────────────────────────┐             │
│  │          Multi-Tenant Database                     │             │
│  │  ┌──────────────────┐  ┌──────────────────┐       │             │
│  │  │  Tenant A Data   │  │  Tenant B Data   │       │             │
│  │  │  (Isolated)      │  │  (Isolated)      │ ...   │             │
│  │  └──────────────────┘  └──────────────────┘       │             │
│  │  Row-Level Security (RLS) enforced by tenant_id   │             │
│  └────────────────────────────────────────────────────┘             │
│                                                                      │
│  ┌────────────────────────────────────────────────────┐             │
│  │        Secrets Manager / Vault                     │             │
│  │  - DB Credentials      - JWT Signing Keys          │             │
│  │  - API Keys            - Tenant Tokens             │             │
│  │  - Encryption Keys     - Service Certificates      │             │
│  └────────────────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────────────┘

Legend:
  ═══  Trust Boundary (Strong isolation)
  ───  Service Communication
  ▼    Data Flow Direction
```

**Key Trust Zones:**
1. **Internet → DMZ:** Public access, untrusted
2. **DMZ → Application:** Authenticated users only
3. **Application → Service Mesh:** Authorized services with mutual TLS
4. **Service Mesh → Data Layer:** Encrypted connections, credential-based auth
5. **Tenant Isolation:** Logical boundary enforced by application + database RLS

---

## STRIDE Analysis

### Component 1: Login / Token Exchange (Authentication Service)

#### T-001: Spoofing - Credential Stuffing Attack
- **Category:** Spoofing
- **Severity:** **HIGH**
- **Description:** Attacker uses leaked credentials from other breaches to gain unauthorized access
- **Attack Vector:** Automated login attempts with username/password pairs from breach databases
- **Impacted Assets:** User accounts, tenant data
- **Mitigation:**
  - Implement rate limiting on login endpoints (max 5 attempts per IP per 15 minutes)
  - Deploy CAPTCHA after 3 failed attempts
  - Integrate with Have I Been Pwned API to block known compromised passwords
  - Implement multi-factor authentication (MFA) for all users
  - Monitor for unusual login patterns (geo-location, device fingerprinting)
- **Related Tasks:** TK-003 (SWE tech plan), TK-008 (DevOps release checklist)

#### T-002: Tampering - JWT Token Manipulation
- **Category:** Tampering
- **Severity:** **CRITICAL**
- **Description:** Attacker modifies JWT claims (e.g., role, tenant_id) to escalate privileges
- **Attack Vector:** Weak signing algorithm (HS256 with shared secret) or exposed signing keys
- **Impacted Assets:** Authorization system, all tenant data
- **Mitigation:**
  - Use asymmetric signing (RS256 or ES256) with private keys stored in secrets vault
  - Implement short token expiration (15 minutes for access tokens, 7 days for refresh)
  - Validate token signature, expiration, issuer, and audience on every request
  - Rotate signing keys quarterly (see secrets rotation policy)
  - Never embed secrets in JWT payload - use opaque claims
- **Related Risks:** R-006 (high threats requiring architectural mitigation)

#### T-003: Information Disclosure - Token Leakage via Logs
- **Category:** Information Disclosure
- **Severity:** **MEDIUM**
- **Description:** Sensitive tokens logged in application logs, accessible to unauthorized personnel
- **Attack Vector:** Tokens in HTTP headers logged by middleware, visible in log aggregation systems
- **Impacted Assets:** User sessions, authentication tokens
- **Mitigation:**
  - Redact `Authorization` headers in all logging middleware
  - Implement structured logging with automatic PII/secret redaction
  - Restrict access to production logs (need-to-know basis, audit log access)
  - Use separate log streams for security events vs application logs
  - Encrypt logs at rest and in transit
- **Related User Stories:** US-006 (PII registry)

---

### Component 2: Permission Enforcement Middleware (US-002)

#### T-004: Elevation of Privilege - RBAC Bypass via Direct Database Access
- **Category:** Elevation of Privilege
- **Severity:** **CRITICAL**
- **Description:** Attacker bypasses application-layer RBAC by directly accessing database
- **Attack Vector:** Compromised service account or SQL injection leading to direct queries
- **Impacted Assets:** All tenant data, PII
- **Mitigation:**
  - Implement Row-Level Security (RLS) at database level for tenant isolation
  - Use database roles with minimal privileges (principle of least privilege)
  - Service accounts can only execute stored procedures, no direct table access
  - Enable database audit logging for all data access
  - Network segmentation: database accessible only from application subnet
  - Deploy database firewall with SQL injection protection
- **Related User Stories:** US-001 (RBAC), US-002 (permission middleware)
- **Related Risks:** R-006

#### T-005: Tampering - Race Condition in Permission Check
- **Category:** Tampering
- **Severity:** **MEDIUM**
- **Description:** Time-of-check-time-of-use (TOCTOU) vulnerability in permission validation
- **Attack Vector:** User permissions changed between check and operation execution
- **Impacted Assets:** Access control, data integrity
- **Mitigation:**
  - Implement atomic permission check + operation execution (single transaction)
  - Use database-level constraints as second line of defense
  - Cache permissions for short duration only (max 5 minutes) with invalidation
  - Log all permission denials for monitoring
  - Implement optimistic locking for sensitive operations
- **Related User Stories:** US-002

---

### Component 3: Audit Log Pipeline

#### T-006: Repudiation - Audit Log Tampering
- **Category:** Repudiation
- **Severity:** **HIGH**
- **Description:** Attacker modifies or deletes audit logs to hide malicious activity
- **Attack Vector:** Compromised admin account or direct access to log storage
- **Impacted Assets:** Audit logs, compliance (GDPR, SOC2)
- **Mitigation:**
  - Implement write-only append-only log storage (no delete/update permissions)
  - Use log signing with hash chains (each log entry contains hash of previous entry)
  - Forward logs to immutable storage (e.g., S3 with object lock, Glacier)
  - Separate log processing credentials from application credentials
  - Implement log integrity verification (scheduled hash chain validation)
  - Alert on any log stream interruptions or gaps
- **Related Risks:** R-004 (audit log vs GDPR erasure)

#### T-007: Information Disclosure - PII in Audit Logs (GDPR Conflict)
- **Category:** Information Disclosure
- **Severity:** **HIGH**
- **Description:** PII stored in audit logs conflicts with GDPR right to erasure
- **Attack Vector:** GDPR data subject access request (DSAR) requires PII deletion, but logs must be retained
- **Impacted Assets:** Audit logs, PII, compliance
- **Mitigation:**
  - **Pseudonymization:** Replace PII with reversible tokens in logs
  - Maintain separate encrypted mapping table (token → PII) with strict access controls
  - On erasure request, delete mapping entry (logs remain but PII is irrecoverable)
  - Document legal basis for log retention (legitimate interest for security)
  - Implement automated PII detection and redaction in log pipeline
  - Store only user_id/tenant_id in logs, never names/emails/phone numbers
- **Related Risks:** R-004
- **Related User Stories:** US-006 (PII registry)

---

### Component 4: Event Bus

#### T-008: Spoofing - Malicious Event Injection
- **Category:** Spoofing
- **Severity:** **HIGH**
- **Description:** Attacker injects forged events into message queue, triggering unauthorized operations
- **Attack Vector:** Compromised service credentials or direct queue access
- **Impacted Assets:** Event bus, downstream services, data integrity
- **Mitigation:**
  - Implement message signing (HMAC-SHA256) with per-service signing keys
  - Validate message signatures before processing
  - Use message queue access control lists (ACLs) - services can only publish to authorized topics
  - Deploy message schema validation (reject malformed messages)
  - Enable TLS for all message queue connections
  - Implement idempotency tokens to prevent replay attacks
  - Monitor for anomalous message patterns (volume, source, schema violations)
- **Related Tasks:** TK-007 (SWE tech plan)

#### T-009: Denial of Service - Event Storm / Queue Flooding
- **Category:** Denial of Service
- **Severity:** **LOW**
- **Description:** Attacker floods event bus with high-volume messages, degrading system performance
- **Attack Vector:** Compromised service or application-level vulnerability
- **Impacted Assets:** System availability, event processing
- **Mitigation:**
  - Implement per-service rate limiting on message publishing
  - Use separate queues for critical vs non-critical events (priority queuing)
  - Configure dead-letter queues (DLQ) for failed messages
  - Set message TTL (time-to-live) to prevent infinite queue growth
  - Implement circuit breakers in message consumers
  - Monitor queue depth and alert on anomalies
  - Auto-scaling for message processors
- **Related Tasks:** TK-009 (DevOps release checklist)

---

### Component 5: Secrets Access (Vault Integration)

#### T-010: Information Disclosure - Secrets Exposed in Environment Variables
- **Category:** Information Disclosure
- **Severity:** **MEDIUM**
- **Description:** Secrets passed as environment variables exposed via process listing, container introspection
- **Attack Vector:** Container escape, server-side request forgery (SSRF), debug endpoints
- **Impacted Assets:** All secrets (DB credentials, API keys, signing keys)
- **Mitigation:**
  - **Never use environment variables for secrets in production**
  - Fetch secrets from vault at runtime using short-lived access tokens
  - Inject secrets into memory only (never persist to disk)
  - Use Kubernetes secrets with encryption at rest (KMS integration)
  - Implement secret zero (bootstrap secret) with minimal scope
  - Rotate all secrets if environment is compromised
  - Disable debug endpoints and process introspection in production
- **Related Tasks:** TK-008, TK-009

---

## Secrets Inventory

This section documents **types** of secrets used in the platform. **No actual secret values are stored in this document or repository.**

### Secret Types & Ownership

| Secret Type | Purpose | Rotation Frequency | Owner Service | Storage Location |
|------------|---------|-------------------|---------------|------------------|
| **Database Master Password** | Root DB access | 90 days | Database Admin | Vault (manual rotation) |
| **Database Service Credentials** | App → DB connection | 30 days | Each service | Vault (auto-rotation) |
| **JWT Signing Private Key** | Token signature | 90 days | AuthN Service | Vault (versioned keys) |
| **JWT Verification Public Key** | Token validation | N/A (derived) | All services | Distributed via JWKS endpoint |
| **API Keys (3rd Party)** | External integrations | Per vendor policy | Integration Service | Vault |
| **OAuth Client Secrets** | OAuth flows | 180 days | AuthN Service | Vault |
| **Encryption Keys (AES-256)** | Data at rest encryption | 365 days | Encryption Service | Vault + HSM |
| **Message Queue Credentials** | Event bus access | 30 days | Each service | Vault |
| **Tenant API Tokens** | Tenant-to-platform auth | User-managed | Tenant Service | DB (hashed) + Vault (active) |
| **Service-to-Service Tokens** | Internal API calls | 24 hours | Each service | Vault (dynamic secrets) |
| **Audit Log Signing Key** | Log integrity | 180 days | Audit Service | Vault (append-only) |
| **TLS Certificates** | Transport encryption | Per cert expiry | Load balancer | Cert Manager + Vault |
| **Webhook Signing Secrets** | Outbound webhook auth | 90 days | Webhook Service | Vault |
| **Session Encryption Keys** | Session cookies | 30 days | Web App | Vault (rolling keys) |

### Secrets NOT in Scope (Excluded)
- Developer workstation SSH keys (managed by IT)
- CI/CD pipeline secrets (managed separately in GitHub Secrets)
- Cloud provider root credentials (break-glass only, not application-accessible)

---

## Vault & Secrets Management Strategy

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Services                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Service  │  │ Service  │  │ Service  │  │ Service  │    │
│  │    A     │  │    B     │  │    C     │  │    D     │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
│       └─────────────┴─────────────┴─────────────┘           │
│                     │ Mutual TLS + Auth Token                │
└─────────────────────┼─────────────────────────────────────┘
                      │
┌─────────────────────▼─────────────────────────────────────┐
│             HashiCorp Vault / AWS Secrets Manager          │
│  ┌───────────────────────────────────────────────────┐    │
│  │  Secrets Engine: Key-Value (Versioned)            │    │
│  │  - DB credentials, API keys, signing keys         │    │
│  └───────────────────────────────────────────────────┘    │
│  ┌───────────────────────────────────────────────────┐    │
│  │  Dynamic Secrets Engine: Database                 │    │
│  │  - Auto-generated short-lived DB credentials      │    │
│  └───────────────────────────────────────────────────┘    │
│  ┌───────────────────────────────────────────────────┐    │
│  │  Transit Engine: Encryption as a Service          │    │
│  │  - Encrypt/decrypt operations, no keys leave vault│    │
│  └───────────────────────────────────────────────────┘    │
│  ┌───────────────────────────────────────────────────┐    │
│  │  PKI Engine: Certificate Management               │    │
│  │  - Auto-issue/renew service certificates          │    │
│  └───────────────────────────────────────────────────┘    │
│  ┌───────────────────────────────────────────────────┐    │
│  │  Audit Log Backend: Write-Only Logging            │    │
│  │  - All vault access logged immutably              │    │
│  └───────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────┘
```

### Implementation Approach

#### Phase 1: Foundation (Sprint 1)
- **TK-003:** Deploy HashiCorp Vault (or AWS Secrets Manager based on cloud provider)
- Enable audit logging to immutable storage
- Configure AppRole authentication for services
- Set up initial secrets: DB credentials, JWT signing keys

#### Phase 2: Migration (Sprint 2)
- **TK-008:** Migrate all secrets from environment variables to vault
- Implement secret fetching at application startup
- Configure auto-rotation for database credentials (30-day cycle)
- Deploy secret zero bootstrap mechanism (minimize hardcoded bootstrap creds)

#### Phase 3: Advanced Features (Sprint 3)
- Enable dynamic secrets for database access (short-lived credentials)
- Deploy Transit engine for encryption operations
- Implement automatic certificate rotation (PKI engine)
- Set up secret leasing and renewal workflows

### Access Control Model

```
Service → Vault Authentication → Policy Assignment → Secret Access

Example Policy (Service A):
path "secret/data/service-a/*" {
  capabilities = ["read"]
}
path "database/creds/service-a" {
  capabilities = ["read"]
}
path "transit/encrypt/service-a" {
  capabilities = ["update"]
}
```

### Vault High Availability
- Multi-node cluster (minimum 3 nodes)
- Auto-unseal using cloud KMS (AWS KMS, Azure Key Vault, GCP Cloud KMS)
- Automated backups to encrypted S3/blob storage
- Disaster recovery plan: Recovery Time Objective (RTO) < 1 hour

---

## Threat Summary

| ID | Component | Threat | Category | Severity | Mitigation Status |
|----|-----------|--------|----------|----------|-------------------|
| T-001 | AuthN Service | Credential Stuffing | Spoofing | **HIGH** | Planned (TK-003, TK-008) |
| T-002 | Token Exchange | JWT Manipulation | Tampering | **CRITICAL** | Planned (R-006) |
| T-003 | AuthN Service | Token Leakage in Logs | Info Disclosure | **MEDIUM** | Planned (US-006) |
| T-004 | Permission Middleware | RBAC Bypass via DB | Elevation of Privilege | **CRITICAL** | Planned (US-001, US-002, R-006) |
| T-005 | Permission Middleware | Permission TOCTOU | Tampering | **MEDIUM** | Planned (US-002) |
| T-006 | Audit Pipeline | Log Tampering | Repudiation | **HIGH** | Planned (R-004) |
| T-007 | Audit Pipeline | PII in Logs (GDPR) | Info Disclosure | **HIGH** | Planned (R-004, US-006) |
| T-008 | Event Bus | Malicious Event Injection | Spoofing | **HIGH** | Planned (TK-007) |
| T-009 | Event Bus | Event Storm DoS | Denial of Service | **LOW** | Planned (TK-009) |
| T-010 | Secrets Access | Secrets in Env Vars | Info Disclosure | **MEDIUM** | Planned (TK-008, TK-009) |

**Severity Distribution:**
- **Critical:** 2 threats (T-002, T-004) - Require immediate architectural mitigation
- **High:** 4 threats (T-001, T-006, T-007, T-008) - Must address before production
- **Medium:** 3 threats (T-003, T-005, T-010) - Address in hardening phase
- **Low:** 1 threat (T-009) - Monitor and mitigate as needed

---

## Mitigations & Security Checklist

### Pre-Production Security Checklist (Gate D)

#### Authentication & Authorization
- [ ] Multi-factor authentication (MFA) enabled for all users
- [ ] Rate limiting on login endpoints (5 attempts / 15 min)
- [ ] JWT tokens use asymmetric signing (RS256/ES256)
- [ ] Token expiration: 15 min (access), 7 days (refresh)
- [ ] RBAC policies implemented and tested (US-001, US-002)
- [ ] Row-Level Security (RLS) enabled in database
- [ ] Service accounts use least-privilege principles

#### Secrets Management
- [ ] All secrets migrated to vault (zero secrets in env vars or code)
- [ ] Auto-rotation enabled for DB credentials (30-day cycle)
- [ ] JWT signing keys rotated (90-day schedule)
- [ ] Vault audit logging enabled to immutable storage
- [ ] Secret zero bootstrap process documented and tested
- [ ] Dynamic secrets enabled for database access

#### Audit & Logging
- [ ] Audit log pipeline deployed with write-only permissions
- [ ] Log signing/hashing implemented (tamper detection)
- [ ] PII pseudonymization in logs (GDPR compliance - R-004)
- [ ] Authorization header redaction in all logs (T-003)
- [ ] Log integrity verification scheduled (daily)
- [ ] Separate log streams for security events vs app logs

#### Network & Infrastructure
- [ ] WAF deployed with OWASP Top 10 rules
- [ ] TLS 1.3 enforced for all external connections
- [ ] Mutual TLS (mTLS) enabled for service-to-service communication
- [ ] Database accessible only from application subnet
- [ ] Network segmentation between trust zones
- [ ] DDoS protection configured at edge

#### Event Bus & Messaging
- [ ] Message signing enabled (HMAC-SHA256)
- [ ] Message queue ACLs configured (least privilege)
- [ ] Schema validation for all messages
- [ ] Dead-letter queues (DLQ) configured
- [ ] Rate limiting per service (prevent event storm)
- [ ] Idempotency tokens implemented

#### Data Protection
- [ ] Encryption at rest for database (AES-256)
- [ ] Encryption at rest for backups
- [ ] Encryption in transit (TLS) for all connections
- [ ] PII registry deployed and integrated (US-006)
- [ ] Tenant isolation tested (cannot access other tenant data)
- [ ] GDPR erasure procedure documented and tested

#### Monitoring & Incident Response
- [ ] Security alerting configured (failed logins, RBAC denials, log gaps)
- [ ] Anomaly detection for login patterns (geo, device)
- [ ] Incident response plan documented
- [ ] Break-glass procedure for vault access
- [ ] Security contact list maintained
- [ ] Penetration testing completed (before GA)

#### Compliance & Documentation
- [ ] Threat model reviewed and approved (this document)
- [ ] Data flow diagram documented
- [ ] Privacy policy updated (GDPR, CCPA)
- [ ] Security training completed by team
- [ ] Vendor security assessments completed
- [ ] SOC2 Type II audit preparation (if applicable)

---

## Open Questions & Decisions

### Q4: Are there existing secrets that need rotation? (ANSWERED)

**Status:** ANSWERED - YES, rotation required

**Context:** This is a new platform, but if any secrets exist from initial setup or prototype phases, they must be rotated before production deployment.

**Decision:**
1. **Immediate Actions (Pre-Production):**
   - Audit all repositories, CI/CD pipelines, and cloud console for hardcoded secrets
   - Identify any secrets created during development (DB passwords, API keys, test tokens)
   - **Rotate ALL identified secrets** before production deployment (zero trust approach)
   - Use automated secret scanning tools (TruffleHog, git-secrets, GitHub Secret Scanning)

2. **Secrets Requiring Rotation:**
   - **Database passwords:** If dev/staging databases use production-like credentials → rotate
   - **JWT signing keys:** Any keys used in testing → regenerate for production
   - **API keys:** Any 3rd party keys used in development → request new production keys
   - **Service accounts:** Cloud provider service accounts → create new with scoped permissions
   - **TLS certificates:** Self-signed dev certs → obtain proper certificates for production

3. **Rotation Schedule (Post-Production):**
   - See "Secrets Inventory" table above for rotation frequencies
   - Automated rotation via vault preferred over manual rotation
   - Emergency rotation procedure: T-002 (JWT keys), T-010 (compromised secrets)

4. **Verification:**
   - Run secret scanning on entire repository before launch
   - Audit vault access logs for any unexpected secret retrievals
   - Test all integrations with new production secrets in staging environment first

**Owner:** DevOps Agent (TK-008, TK-009)  
**Deadline:** Before production deployment (Gate D)

---

### Additional Open Questions

#### Q-SEC-1: Which cloud provider's secrets manager to use?
**Status:** OPEN  
**Options:**
- HashiCorp Vault (cloud-agnostic, most features)
- AWS Secrets Manager (if AWS-only)
- Azure Key Vault (if Azure-only)
- Google Secret Manager (if GCP-only)

**Recommendation:** HashiCorp Vault for flexibility, or native cloud provider solution if fully committed to single cloud  
**Owner:** Architect + DevOps  

#### Q-SEC-2: Penetration testing vendor selection?
**Status:** OPEN  
**Timeline:** Schedule before GA launch  
**Scope:** Full application security assessment, infrastructure review  
**Owner:** Security + Process  

#### Q-SEC-3: Bug bounty program?
**Status:** OPEN  
**Consideration:** Should we launch public/private bug bounty post-GA?  
**Owner:** Security + PM  

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-02-21 | Security Agent | Initial threat model created with STRIDE analysis, secrets inventory, vault strategy |

---

## References

- **User Stories:** US-001 (RBAC), US-002 (Permission Middleware), US-006 (PII Registry)
- **Risks:** R-004 (Audit vs GDPR), R-006 (High Threats)
- **Tasks:** TK-003 (Tech Plan), TK-007 (Event Bus), TK-008 (Secrets), TK-009 (Release Checklist)
- **Standards:** OWASP Top 10, STRIDE Threat Modeling, NIST Cybersecurity Framework
- **Compliance:** GDPR, SOC2 Type II, ISO 27001 (aspirational)

---

**Document Classification:** Internal - Security Sensitive  
**Distribution:** Engineering Leadership, Security Team, Compliance  
**Review Cycle:** Quarterly or after major architecture changes
