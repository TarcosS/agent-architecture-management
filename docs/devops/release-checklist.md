# Release Checklist

## Overview

This document defines the release readiness criteria, deployment topology, procedures, and rollback strategies for the multi-app platform. It must be reviewed and validated before closing **Gate D (Release Readiness)**.

---

## Table of Contents

1. [Environments](#environments)
2. [Blue/Green Deployment Topology](#bluegreen-deployment-topology)
3. [Environment Prerequisites](#environment-prerequisites)
4. [Pre-Release CI/CD Checks](#pre-release-cicd-checks)
5. [Database Migration Runbook](#database-migration-runbook)
6. [Traffic Cutover Procedure](#traffic-cutover-procedure)
7. [Health Check Gates](#health-check-gates)
8. [Rollback Decision Tree](#rollback-decision-tree)
9. [Phased vs Simultaneous Rollout (Q5 Recommendation)](#phased-vs-simultaneous-rollout)
10. [Security & Secrets Rotation](#security--secrets-rotation)
11. [Infrastructure Gaps (Risk R-005)](#infrastructure-gaps-risk-r-005)
12. [Monitoring & Logging](#monitoring--logging)
13. [Release Verification Steps](#release-verification-steps)

---

## Environments

The platform supports three primary environments:

| Environment | Purpose | Deployment Frequency | Approval Required |
|-------------|---------|---------------------|-------------------|
| **Development** | Active development, feature testing | Multiple per day | No |
| **Staging** | Pre-production validation, integration testing | Multiple per week | Tech Lead |
| **Production** | Live customer-facing system | Scheduled releases | Product Owner + Tech Lead |

### Environment Parity

- All environments must maintain configuration parity via **Infrastructure-as-Code (IaC)**
- Secrets and environment variables must be stored in a **Secrets Manager** (e.g., AWS Secrets Manager, Azure Key Vault, HashiCorp Vault)
- Environment-specific configurations must be parameterized, not hardcoded

---

## Blue/Green Deployment Topology (TK-008)

### Architecture Overview

The blue/green deployment strategy maintains **two identical production environments** (Blue and Green) to enable zero-downtime deployments with instant rollback capability.

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    │   (L7/ALB/NLB)  │
                    └────────┬────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
         ┌──────▼──────┐          ┌──────▼──────┐
         │  Blue Env   │          │  Green Env  │
         │  (Active)   │          │  (Standby)  │
         └──────┬──────┘          └──────┬──────┘
                │                         │
    ┌───────────┼─────────────┐  ┌───────┼──────────────┐
    │           │             │  │       │              │
┌───▼───┐  ┌───▼───┐  ┌─────▼──▼───┐ ┌─▼────┐  ┌─────▼────┐
│  Web  │  │  API  │  │  Workers   │ │ Web  │  │   API    │
│Service│  │Service│  │  (Async)   │ │Service│  │ Service  │
└───┬───┘  └───┬───┘  └─────┬──────┘ └──┬───┘  └────┬─────┘
    │          │             │            │           │
    └──────────┴─────────────┴────────────┴───────────┘
                         │
                    ┌────▼─────┐
                    │ Database │
                    │ (Shared) │
                    └──────────┘
```

### Component Details

#### Web Service

- **Purpose**: Serves frontend assets, handles HTTP requests
- **Scaling**: Horizontal auto-scaling based on CPU/memory
- **Health Check**: `GET /health` returns 200 OK
- **Blue/Green**: Full instance duplication; load balancer routes traffic based on target group

#### API Service

- **Purpose**: RESTful/GraphQL API endpoints
- **Scaling**: Horizontal auto-scaling based on request rate
- **Health Check**: `GET /api/health` with dependency checks (database, cache)
- **Blue/Green**: Full instance duplication; load balancer routes traffic based on target group

#### Worker Services (Async)

- **Purpose**: Background job processing (queues, scheduled tasks)
- **Scaling**: Based on queue depth and processing latency
- **Health Check**: Queue connectivity + job processing verification
- **Blue/Green**: Workers can run in both environments during transition; use feature flags or queue-based activation
- **Note**: Workers may require phased deployment if they process shared queues

#### Database

- **Topology**: Single shared database cluster (not duplicated)
- **Migration Strategy**: Forward-compatible migrations applied before blue/green switch
- **Consideration**: Database schema changes must be backward-compatible with both blue and green environments during cutover

---

## Environment Prerequisites

Before any production deployment, ensure the following prerequisites are satisfied:

### ✅ Load Balancer Configuration

- [ ] Load balancer (ALB/NLB/L7) is configured with two target groups: `blue` and `green`
- [ ] Health check endpoints are configured for each target group
- [ ] SSL/TLS certificates are valid and auto-renewing
- [ ] Traffic routing rules are defined (weighted or instant flip)
- [ ] DNS/CNAME records point to the load balancer
- [ ] Request timeout and connection draining settings are configured

### ✅ Environment Duplication

- [ ] Infrastructure-as-Code (IaC) scripts (Terraform/CloudFormation/Pulumi) are version-controlled
- [ ] Both blue and green environments are provisioned identically
- [ ] Compute, memory, storage, and network configurations match
- [ ] Auto-scaling policies are defined for both environments
- [ ] Container images or deployment artifacts are available for both environments

### ✅ Secrets Manager Setup

- [ ] Secrets Manager (AWS Secrets Manager, Azure Key Vault, Vault) is configured
- [ ] API keys, database credentials, third-party tokens are stored securely
- [ ] Secrets are accessible via IAM roles/policies, not hardcoded
- [ ] Secrets rotation policies are enabled (see [Security & Secrets Rotation](#security--secrets-rotation))
- [ ] Both blue and green environments reference the same secrets (or versioned secrets)

### ✅ Networking & Security

- [ ] Security groups/firewall rules allow traffic between services
- [ ] Private subnets are configured for backend services
- [ ] Public subnets are configured for load balancers
- [ ] VPN/bastion access is available for troubleshooting
- [ ] DDoS protection and rate limiting are enabled

### ✅ Monitoring & Logging

- [ ] Centralized logging (ELK, Splunk, CloudWatch Logs) is configured
- [ ] Application Performance Monitoring (APM) is integrated (Datadog, New Relic, Application Insights)
- [ ] Infrastructure metrics are collected (CPU, memory, disk, network)
- [ ] Alerting rules are defined for critical failures
- [ ] Dashboards for blue and green environments are available

---

## Pre-Release CI/CD Checks

All checks must pass before deployment to staging or production:

### ✅ Automated Checks

| Check | Tool/Command | Criteria |
|-------|--------------|----------|
| **Linting** | `npm run lint` / `eslint` / `pylint` | Zero errors, warnings acceptable |
| **Unit Tests** | `npm test` / `pytest` / `jest` | 100% pass rate, minimum 80% coverage |
| **Integration Tests** | `npm run test:integration` | 100% pass rate |
| **Build** | `npm run build` / `docker build` | Successful build with no errors |
| **Security Scan** | `npm audit` / `snyk` / `trivy` | No critical/high vulnerabilities |
| **License Check** | `license-checker` | All dependencies comply with policy |
| **Static Analysis** | `sonarqube` / `eslint` | No critical code smells |
| **Container Scan** | `trivy` / `clair` | No critical vulnerabilities in images |

### ✅ Manual Checks

- [ ] Changelog is updated with release notes
- [ ] Database migration scripts are reviewed and tested
- [ ] Rollback plan is documented and validated
- [ ] Stakeholders are notified of release schedule
- [ ] Maintenance window is communicated (if applicable)
- [ ] On-call engineer is identified and available
- [ ] Smoke test plan is prepared

---

## Database Migration Runbook (TK-009)

### Migration File Naming Convention

Use the following naming convention for all migration files:

```
<timestamp>_<description>.sql
```

**Examples:**
- `20250101120000_add_user_email_index.sql`
- `20250115093000_create_orders_table.sql`
- `20250120140000_alter_products_add_sku.sql`

### Migration Strategy: Forward + Rollback SQL

Each migration must include:

1. **Forward SQL** (`up.sql`): Applies the schema change
2. **Rollback SQL** (`down.sql`): Reverts the schema change

**Example:**

**File: `20250101120000_add_user_email_index.up.sql`**
```sql
CREATE INDEX idx_users_email ON users(email);
```

**File: `20250101120000_add_user_email_index.down.sql`**
```sql
DROP INDEX IF EXISTS idx_users_email;
```

### Pre-Migration Checklist

Before executing any migration in production:

- [ ] **Backup Database**: Full backup completed and verified
- [ ] **Test Migration**: Successfully applied and rolled back in staging
- [ ] **Lock Strategy Defined**: Determine if table locks are required and acceptable
- [ ] **Rollback SQL Verified**: Rollback script tested and confirmed functional
- [ ] **Downtime Window**: Confirm if migration requires downtime; communicate to users
- [ ] **Monitoring Enabled**: Database performance metrics are actively monitored
- [ ] **Review Schema Changes**: DBA or senior engineer has reviewed the SQL
- [ ] **Connection Pool Settings**: Ensure connection pools can handle brief disruptions

### Migration Execution Steps

1. **Take Database Snapshot/Backup**
   ```bash
   # Example for PostgreSQL
   pg_dump -U postgres -h db.example.com -F c -b -v -f backup_$(date +%Y%m%d_%H%M%S).dump mydb
   ```

2. **Apply Forward Migration**
   ```bash
   psql -U postgres -h db.example.com -d mydb -f 20250101120000_add_user_email_index.up.sql
   ```

3. **Verify Migration**
   ```bash
   # Check schema
   psql -U postgres -h db.example.com -d mydb -c "\d users"
   # Check index exists
   psql -U postgres -h db.example.com -d mydb -c "\di idx_users_email"
   ```

4. **Monitor Database Performance**
   - Check query latency
   - Monitor active connections
   - Verify application logs for database errors

### Post-Migration Verification

- [ ] Migration applied successfully (check schema version table)
- [ ] Application can read/write data correctly
- [ ] No database errors in application logs
- [ ] Database performance metrics are within acceptable range
- [ ] Rollback SQL tested in non-production environment (if not done pre-migration)

### Rollback Procedure

If migration causes issues:

1. **Stop Traffic** (if necessary): Switch load balancer to blue environment
2. **Apply Rollback SQL**:
   ```bash
   psql -U postgres -h db.example.com -d mydb -f 20250101120000_add_user_email_index.down.sql
   ```
3. **Verify Rollback**:
   ```bash
   psql -U postgres -h db.example.com -d mydb -c "\di idx_users_email"
   ```
4. **Resume Traffic**: Switch load balancer back if stopped
5. **Post-Mortem**: Document what went wrong and update migration scripts

---

## Traffic Cutover Procedure

### Overview

Traffic cutover is the process of shifting user traffic from the **blue (old)** environment to the **green (new)** environment. This can be done gradually (canary/weighted) or instantly (flip).

### Cutover Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| **Instant Flip** | 100% traffic switched immediately | Low-risk releases, feature flags enabled |
| **Weighted Routing** | Gradual shift (e.g., 10% → 50% → 100%) | High-risk releases, A/B testing |
| **Canary Release** | Small subset of users (e.g., 1%) first | Major architectural changes |

### Step-by-Step Cutover (Weighted Routing)

#### Phase 1: Pre-Cutover

1. **Deploy to Green Environment**
   - Deploy new version to green environment
   - Verify deployment succeeded (check container status, logs)

2. **Run Smoke Tests**
   - Execute automated smoke tests against green environment
   - Test critical user flows (login, checkout, API calls)
   - Verify integrations (payment gateway, email service)

3. **Validate Health Checks**
   - Ensure all health check endpoints return 200 OK
   - Verify database connectivity
   - Check external service dependencies

4. **Run Integration Tests**
   - Execute full integration test suite against green environment
   - Verify end-to-end workflows

#### Phase 2: Initial Cutover (10% Traffic)

5. **Shift 10% Traffic to Green**
   - Update load balancer target group weights:
     - Blue: 90%
     - Green: 10%
   - Wait 5-10 minutes

6. **Monitor Metrics**
   - Error rate (should remain < 0.5%)
   - Response latency (p50, p95, p99)
   - Request throughput
   - Database query performance
   - Memory and CPU utilization

7. **Check Logs**
   - Review application logs for errors
   - Check for unexpected exceptions
   - Verify no critical alerts triggered

8. **Decision Point**
   - ✅ **Proceed**: Metrics are healthy → Continue to Phase 3
   - ❌ **Rollback**: Errors detected → Execute rollback procedure

#### Phase 3: Incremental Cutover (50% Traffic)

9. **Shift 50% Traffic to Green**
   - Update load balancer target group weights:
     - Blue: 50%
     - Green: 50%
   - Wait 10-15 minutes

10. **Monitor Metrics** (repeat step 6)

11. **Check Logs** (repeat step 7)

12. **Decision Point**
    - ✅ **Proceed**: Metrics are healthy → Continue to Phase 4
    - ❌ **Rollback**: Errors detected → Execute rollback procedure

#### Phase 4: Full Cutover (100% Traffic)

13. **Shift 100% Traffic to Green**
    - Update load balancer target group weights:
      - Blue: 0%
      - Green: 100%
    - Wait 15-20 minutes

14. **Monitor Metrics** (repeat step 6)

15. **Check Logs** (repeat step 7)

16. **Decision Point**
    - ✅ **Success**: Metrics are healthy → Proceed to Phase 5
    - ❌ **Rollback**: Errors detected → Execute rollback procedure

#### Phase 5: Post-Cutover

17. **Decommission Blue Environment** (optional, after 24-48 hours)
    - Keep blue environment running for quick rollback
    - After stable period, scale down or terminate blue instances
    - Document lessons learned

---

## Health Check Gates

Health checks must pass at each phase of the cutover. If any health check fails, **halt the cutover** and investigate.

### Health Check Endpoints

| Service | Endpoint | Expected Response | Checks |
|---------|----------|-------------------|--------|
| **Web** | `GET /health` | `200 OK` | Application status |
| **API** | `GET /api/health` | `200 OK` with JSON | Database, cache, queue connectivity |
| **Workers** | Internal metric | `healthy` status | Queue processing, job completion rate |

### API Health Check Example Response

```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T12:34:56Z",
  "checks": {
    "database": "ok",
    "cache": "ok",
    "queue": "ok"
  }
}
```

### Health Check Criteria

| Gate | Criteria | Threshold |
|------|----------|-----------|
| **Error Rate** | HTTP 5xx errors | < 0.5% of requests |
| **Latency (p50)** | Median response time | < 200ms |
| **Latency (p95)** | 95th percentile response time | < 500ms |
| **Latency (p99)** | 99th percentile response time | < 1000ms |
| **Database Connections** | Active connections | < 80% of pool size |
| **Memory Usage** | Container memory | < 85% of limit |
| **CPU Usage** | Container CPU | < 75% sustained |
| **Queue Depth** | Pending jobs | < 1000 jobs |

---

## Rollback Decision Tree

### When to Roll Back

Roll back if **any** of the following conditions are met:

#### Automatic Rollback Triggers

- [ ] Error rate > 1% for 5 consecutive minutes
- [ ] p99 latency > 5000ms for 5 consecutive minutes
- [ ] Critical security vulnerability discovered
- [ ] Data corruption detected
- [ ] Database deadlocks or connection pool exhaustion
- [ ] Third-party service integration failure (payment, auth)

#### Manual Rollback Triggers

- [ ] Customer-reported critical bugs (e.g., unable to checkout)
- [ ] Silent data loss or incorrect calculations detected
- [ ] Unexpected behavior that violates business logic
- [ ] Compliance or regulatory violation detected

### Rollback Approval

| Scenario | Approver | Notification |
|----------|----------|--------------|
| **Automated Trigger** | On-call engineer | Immediate rollback, notify team after |
| **Critical Bug** | On-call engineer + Tech Lead | Rollback immediately, document reason |
| **Business Logic Issue** | Tech Lead + Product Owner | Assess severity, decide on rollback |
| **Security Vulnerability** | Security Lead + CTO | Immediate rollback, incident response |

### Rollback Procedure

1. **Switch Traffic Back to Blue**
   - Update load balancer target group weights:
     - Blue: 100%
     - Green: 0%
   - Takes effect immediately (no deployment required)

2. **Verify Blue Environment is Healthy**
   - Check health endpoints
   - Monitor error rates and latency
   - Verify application logs

3. **Rollback Database (if applicable)**
   - If database migration was applied, execute rollback SQL
   - See [Database Migration Runbook](#database-migration-runbook)

4. **Notify Stakeholders**
   - Send rollback notification to team and stakeholders
   - Update status page if customer-facing

5. **Verify Rollback Success**
   - Monitor metrics for 15-30 minutes
   - Confirm error rate and latency are back to baseline
   - Check customer reports (support tickets, social media)

6. **Post-Mortem**
   - Schedule post-mortem meeting within 24 hours
   - Document root cause, timeline, and corrective actions
   - Update deployment procedures to prevent recurrence

---

## Phased vs Simultaneous Rollout (Q5 Recommendation)

### Overview

When deploying multiple services (web, API, workers), you can choose between:

1. **Phased Rollout**: Deploy services sequentially (e.g., Web → API → Workers)
2. **Simultaneous Rollout**: Deploy all services at once

### Recommendation: **Phased Rollout**

**Rationale:**
- **Lower Risk**: Issues can be isolated to a single service
- **Easier Debugging**: Smaller scope of changes reduces complexity
- **Faster Rollback**: Only need to roll back the failing service
- **Better Observability**: Monitor each service's impact independently

### Phased Rollout Order

**Recommended Order:**
1. **Workers** (lowest risk, no user-facing impact)
2. **API** (medium risk, impacts all clients)
3. **Web** (highest visibility, impacts user experience)

**Alternative Order (if API changes are backward-compatible):**
1. **Web** (deploy new UI with feature flags disabled)
2. **API** (deploy new endpoints, enable feature flags)
3. **Workers** (deploy background processing updates)

### Trade-Offs Comparison

| Aspect | Phased Rollout | Simultaneous Rollout |
|--------|----------------|----------------------|
| **Risk** | Lower (isolated failures) | Higher (cascading failures) |
| **Rollback Complexity** | Lower (single service) | Higher (multiple services) |
| **Deployment Time** | Longer (3-6 hours) | Shorter (1-2 hours) |
| **Monitoring Effort** | Lower (focused scope) | Higher (multiple services) |
| **Coordination** | Requires service compatibility | Requires tight version coupling |
| **Downtime** | None (zero-downtime each phase) | None (if successful) |
| **Debugging** | Easier (clear failure point) | Harder (multiple change sets) |

### When to Use Simultaneous Rollout

Use simultaneous rollout only when:
- Services are tightly coupled and cannot function independently
- Deployment window is limited (e.g., regulatory deadline)
- Changes are low-risk (e.g., minor bug fixes, no API changes)
- Extensive testing in staging has validated the release

### Implementation Notes

For phased rollout:
- Ensure **backward compatibility** between service versions
- Use **feature flags** to enable new features after all services are deployed
- Maintain **API versioning** to support old and new clients
- Monitor **cross-service communication** for breaking changes

---

## Security & Secrets Rotation

### Overview

Secrets rotation is critical to maintaining security posture. All secrets must be rotated on a regular schedule and after any suspected compromise.

### Secrets Rotation Schedule

| Secret Type | Rotation Frequency | Automation |
|-------------|-------------------|------------|
| **Database Passwords** | 90 days | Automated via Secrets Manager |
| **API Keys (3rd Party)** | 180 days | Manual (vendor-dependent) |
| **JWT Signing Keys** | 30 days | Automated |
| **SSH Keys** | 365 days | Manual |
| **TLS Certificates** | 90 days (auto-renew) | Automated (Let's Encrypt, ACM) |
| **Service Account Tokens** | 90 days | Automated |

### Secrets Rotation Procedure

1. **Generate New Secret**
   - Use strong random generation (e.g., `openssl rand -base64 32`)
   - Store in Secrets Manager with versioning enabled

2. **Update Application Configuration**
   - Deploy application update to read new secret version
   - Support dual-secret mode during transition (old + new)

3. **Verify Functionality**
   - Test application with new secret in staging
   - Monitor logs for authentication failures

4. **Deprecate Old Secret**
   - After 7 days, remove support for old secret
   - Delete old secret version from Secrets Manager

5. **Document Rotation**
   - Log rotation event in audit trail
   - Update secrets inventory

### Security Checklist (Gate D)

Refer to the **Security Threat Model** (SEC deliverable) for comprehensive security requirements. The release checklist must confirm:

- [ ] All secrets are stored in Secrets Manager (no hardcoded secrets)
- [ ] Secrets rotation is automated or scheduled
- [ ] TLS/SSL certificates are valid and auto-renewing
- [ ] Security vulnerability scans have passed (no critical/high issues)
- [ ] Access controls are configured (least privilege principle)
- [ ] Audit logging is enabled for all environments
- [ ] Security threat model has been reviewed and risks accepted/mitigated
- [ ] Incident response plan is documented and team is trained

---

## Infrastructure Gaps (Risk R-005)

### Overview

**Risk R-005** identifies infrastructure gaps that could block deployment or cause production incidents. These gaps must be resolved **before Gate D can close**.

### Known Infrastructure Gaps

Document any infrastructure gaps identified during planning or previous releases:

#### Example Gaps (to be updated per project)

| Gap ID | Description | Impact | Owner | Status | Deadline |
|--------|-------------|--------|-------|--------|----------|
| INFRA-001 | Load balancer not configured for blue/green | Cannot deploy without downtime | DevOps | Open | 2025-02-01 |
| INFRA-002 | Secrets Manager not set up | Hardcoded secrets in code | Security | Open | 2025-01-25 |
| INFRA-003 | Database backup automation missing | Risk of data loss | DBA | Open | 2025-01-30 |
| INFRA-004 | Monitoring dashboards not created | Blind deployment | DevOps | Open | 2025-02-05 |
| INFRA-005 | Auto-scaling policies not defined | Performance degradation under load | DevOps | Open | 2025-02-10 |

### Gate D Prerequisite

**Gate D cannot close until all critical (P0) infrastructure gaps are resolved.**

- **P0 (Critical)**: Blocks deployment, causes downtime or data loss
- **P1 (High)**: Degrades performance or observability
- **P2 (Medium)**: Nice-to-have, can be deferred to next release

### Infrastructure Readiness Checklist

Before closing Gate D:

- [ ] All P0 infrastructure gaps are resolved
- [ ] Load balancer is configured for blue/green deployment
- [ ] Secrets Manager is set up and secrets are migrated
- [ ] Database backups are automated and tested
- [ ] Monitoring and alerting are functional
- [ ] Auto-scaling policies are defined and tested
- [ ] Disaster recovery plan is documented
- [ ] Infrastructure-as-Code (IaC) is version-controlled and tested
- [ ] Network security (firewalls, VPN) is configured
- [ ] Cost monitoring and budgets are set up

---

## Monitoring & Logging

### Logging Requirements

All services must emit structured logs to a centralized logging system:

- **Format**: JSON (structured logging)
- **Levels**: DEBUG, INFO, WARN, ERROR, FATAL
- **Fields**: `timestamp`, `level`, `service`, `trace_id`, `message`, `metadata`

**Example Log Entry:**
```json
{
  "timestamp": "2025-01-15T12:34:56.789Z",
  "level": "ERROR",
  "service": "api-service",
  "trace_id": "abc123",
  "message": "Database connection failed",
  "metadata": {
    "error": "connection timeout",
    "retry_count": 3
  }
}
```

### Metrics to Monitor

| Metric Category | Specific Metrics | Tool |
|----------------|------------------|------|
| **Application** | Request rate, error rate, latency (p50, p95, p99) | Datadog, New Relic |
| **Infrastructure** | CPU, memory, disk, network I/O | CloudWatch, Prometheus |
| **Database** | Query latency, connection pool, deadlocks | Database-native tools |
| **Queue** | Queue depth, processing rate, dead letter queue | Queue-native tools |
| **Business** | Sign-ups, orders, revenue (custom metrics) | Custom dashboards |

### Alerting Rules

Define alerting rules for critical thresholds:

| Alert | Condition | Severity | Notification |
|-------|-----------|----------|--------------|
| High Error Rate | Error rate > 1% for 5 min | Critical | PagerDuty, Slack |
| High Latency | p99 > 5000ms for 5 min | High | Slack |
| Database Down | Database unreachable | Critical | PagerDuty, Slack |
| Disk Full | Disk usage > 90% | High | Slack |
| Memory Leak | Memory increasing steadily | Medium | Slack |

### Dashboards

Create dashboards for each environment:

- **Deployment Dashboard**: Deployment status, version, rollback events
- **Service Health Dashboard**: Health checks, error rates, latency
- **Infrastructure Dashboard**: CPU, memory, network, disk
- **Business Metrics Dashboard**: User activity, transactions, revenue

---

## Release Verification Steps

After deployment is complete, verify the release was successful:

### ✅ Automated Verification

- [ ] All health checks are passing (web, API, workers)
- [ ] Smoke tests passed in production
- [ ] Error rate is below baseline (< 0.5%)
- [ ] Latency is within acceptable range (p99 < 1000ms)
- [ ] No critical alerts triggered

### ✅ Manual Verification

- [ ] Critical user flows tested manually (login, checkout, search)
- [ ] Admin panel is accessible and functional
- [ ] Third-party integrations are working (payment, email, analytics)
- [ ] Database queries are performing well (no slow queries)
- [ ] Customer-facing status page is updated (if applicable)

### ✅ Stakeholder Notification

- [ ] Release notes sent to team and stakeholders
- [ ] Support team notified of changes and known issues
- [ ] Customer communication sent (if user-facing changes)
- [ ] Marketing/sales informed (if new features)

### ✅ Documentation

- [ ] Release documented in changelog
- [ ] Runbook updated with any new procedures
- [ ] Post-deployment report completed (metrics, issues, lessons learned)
- [ ] Infrastructure changes documented in IaC repository

---

## Rollback Verification

If a rollback was performed, verify it was successful:

- [ ] Traffic is fully routed to blue environment (0% to green)
- [ ] Health checks are passing in blue environment
- [ ] Error rate has returned to baseline
- [ ] Latency has returned to baseline
- [ ] Database rollback completed (if applicable)
- [ ] No data loss or corruption detected
- [ ] Customer-facing functionality is restored
- [ ] Post-mortem scheduled within 24 hours

---

## Appendix: Release Checklist Summary

Use this quick checklist for each release:

### Pre-Release
- [ ] All CI/CD checks passed (lint, test, build, security)
- [ ] Database migration tested in staging
- [ ] Rollback plan documented
- [ ] Stakeholders notified
- [ ] On-call engineer assigned
- [ ] Infrastructure gaps resolved (Risk R-005)
- [ ] Security threat model reviewed (SEC deliverable)

### Deployment
- [ ] Deploy to green environment
- [ ] Run smoke tests
- [ ] Validate health checks
- [ ] Shift 10% traffic → monitor
- [ ] Shift 50% traffic → monitor
- [ ] Shift 100% traffic → monitor

### Post-Release
- [ ] All health checks passing
- [ ] Error rate and latency within baseline
- [ ] Manual verification complete
- [ ] Stakeholders notified
- [ ] Documentation updated
- [ ] Post-deployment report completed

### Rollback (if needed)
- [ ] Switch traffic back to blue
- [ ] Rollback database (if applicable)
- [ ] Verify blue environment health
- [ ] Notify stakeholders
- [ ] Schedule post-mortem

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-15 | DevOps Team | Initial release checklist |

**Next Review Date**: 2025-04-15 (quarterly review)

---

**Gate D Readiness**: This checklist must be reviewed and all prerequisites satisfied before closing Gate D (Release Readiness).
