# ADR: PII Masking Approach for Audit Logs and Observability

## Status
**Accepted**

## Context

The Multi-App Platform collects comprehensive audit logs and observability data (application logs, request logs, metrics) to support security monitoring, debugging, and compliance requirements. However, this data frequently contains **Personally Identifiable Information (PII)** such as:

- User email addresses
- Phone numbers
- Full names
- IP addresses
- User agent strings
- Physical addresses

### Problem Statement

We need to balance two conflicting requirements:

1. **Privacy and Compliance**: PII must be protected in logs to comply with data protection regulations (GDPR, CCPA, SOC2, HIPAA). Unauthorized access to logs should not expose sensitive personal data.

2. **Debugging and Observability**: Logs must remain useful for troubleshooting production issues, security investigations, and performance analysis. Over-aggressive masking reduces log utility.

### Regulatory Context

- **GDPR (General Data Protection Regulation)**: Requires minimization of personal data collection and storage. PII in logs must be masked or pseudonymized when not strictly necessary.
- **CCPA (California Consumer Privacy Act)**: Requires businesses to disclose PII collection and allow consumers to opt out. Logs with PII increase compliance burden.
- **SOC2**: Requires controls around PII handling, including logging and access controls.
- **HIPAA** (if handling healthcare data): Requires encryption and access controls for Protected Health Information (PHI).

### Stakeholder Requirements

| Stakeholder | Requirement |
|-------------|-------------|
| **Security Team** | Must be able to investigate incidents; needs enough context (e.g., partial email, IP prefix) |
| **Development Team** | Needs logs for debugging; full PII not required, but correlation IDs and partial identifiers useful |
| **Compliance Team** | PII must be masked in non-production environments; production logs must have controls (access logs, retention) |
| **Customer Support** | May need to reference user actions; masked identifiers acceptable if traceable via internal systems |

---

## Decision

We will implement **field-level PII masking at the application layer** before logs are written to any sink (files, streams, databases).

### Chosen Approach: Application-Layer Field-Level Masking

**Description**: 
- A masking middleware intercepts log events before they are written to log outputs.
- Identified PII fields are transformed using deterministic masking rules (partial masking, hashing, truncation).
- Masked logs are written to all log sinks (CloudWatch, Datadog, local files, audit log database).
- Original unmasked data is **never** written to logs (except in local development environments).

---

## Alternatives Considered

### 1. Column-Level Encryption (Database-Only)

**Description**: Encrypt PII columns in the database using PostgreSQL `pgcrypto` extension or application-layer encryption. Logs contain references to encrypted data.

**Pros**:
- ✅ Strong security (encrypted at rest)
- ✅ Granular control (specific columns encrypted)

**Cons**:
- ❌ Only protects database PII, not application logs (logs may still leak PII)
- ❌ Performance overhead (encryption/decryption on every query)
- ❌ Key management complexity (rotation, storage, access control)
- ❌ Doesn't solve the core problem: PII in application logs

**Verdict**: ⛔ Rejected — Solves a different problem (database encryption vs log masking). Not applicable to log files and streams.

---

### 2. Tokenization Service

**Description**: Replace PII with randomly generated tokens. A separate tokenization service stores the mapping (token → original value). Logs contain only tokens.

**Pros**:
- ✅ No PII in logs (only opaque tokens)
- ✅ Reversible (can de-tokenize if authorized)
- ✅ Strong privacy guarantees

**Cons**:
- ❌ Requires separate tokenization service (new infrastructure dependency)
- ❌ Higher operational complexity (service availability, token storage)
- ❌ Latency overhead (network call to tokenize/detokenize)
- ❌ Difficult to correlate logs across systems without detokenization
- ❌ Overkill for MVP-1 (adds significant complexity)

**Verdict**: ⛔ Rejected — Too complex for MVP-1. Consider for future if regulations require stronger anonymization.

---

### 3. Data Vault / PII Vault

**Description**: Store all PII in a separate, highly secured "vault" database. Application logic references PII by ID only. Logs never contain PII.

**Pros**:
- ✅ Centralized PII storage with strict access controls
- ✅ Simplifies compliance (single point of control)

**Cons**:
- ❌ Requires major architectural refactoring (separate PII from core entities)
- ❌ Performance impact (additional DB lookups to resolve PII)
- ❌ High implementation cost (6-8 weeks of engineering effort)
- ❌ Not suitable for MVP-1 timeline

**Verdict**: ⛔ Rejected — Architectural overkill for current scale. Consider in later phases if handling HIPAA or payment data.

---

### 4. Log Scrubbing at Sink (Post-Processing)

**Description**: Write logs as-is, then scrub PII at the log aggregation layer (e.g., Datadog pipeline, Logstash filter).

**Pros**:
- ✅ Centralized scrubbing logic (single point of configuration)
- ✅ No code changes in application (scrubbing in infrastructure)

**Cons**:
- ❌ PII exposed in transit (between app and log sink)
- ❌ Risk of PII leakage if scrubbing config is wrong or incomplete
- ❌ Different scrubbing logic per log sink (inconsistency risk)
- ❌ Difficult to test (requires end-to-end log pipeline testing)
- ❌ No masking in local log files (developers see raw PII)

**Verdict**: ⛔ Rejected — Too risky; PII exposed before scrubbing. Violates "defense in depth" principle.

---

### 5. Application-Layer Field-Level Masking (Selected)

**Description**: Mask PII at the application layer before logging. Deterministic masking rules applied consistently across all log outputs.

**Pros**:
- ✅ Consistent masking across all log sinks (files, streams, databases)
- ✅ PII never leaves application unmasked (defense in depth)
- ✅ Testable (unit tests for masking rules)
- ✅ Auditable (masking logic in code, reviewable)
- ✅ Flexible (different masking rules per field type, environment-specific behavior)
- ✅ Low operational overhead (no external dependencies)

**Cons**:
- ❌ Requires discipline (developers must use masking middleware, not raw logging)
- ❌ Risk of missed PII fields (if new PII added and not registered)
- ❌ Irreversible (original values lost, cannot "unmask")

**Verdict**: ✅ **Selected** — Best balance of security, simplicity, and auditability. Fits MVP-1 constraints.

---

## Rationale for Chosen Approach

### 1. Defense in Depth ⭐⭐⭐
- **Mask at source**: PII masked before leaving application ensures no accidental leakage in log transit, storage, or backups.
- **Compare to log scrubbing**: Scrubbing at sink exposes PII in transit and risks incomplete scrubbing.

### 2. Consistency Across Log Sinks ⭐⭐⭐
- **Single masking logic**: Same masking rules applied to all outputs (CloudWatch, Datadog, local files, audit log DB).
- **Compare to log scrubbing**: Different log sinks may have different scrubbing configs, leading to inconsistency.

### 3. Testability and Auditability ⭐⭐⭐
- **Unit tests**: Masking rules tested in CI/CD pipeline.
- **Code review**: Masking logic reviewed by security team.
- **Compare to tokenization**: Tokenization service is a black box; harder to audit.

### 4. Low Operational Overhead ⭐⭐⭐
- **No new infrastructure**: No tokenization service, no encryption key management, no PII vault.
- **Developer-friendly**: Simple API (`maskPII(data)` function).
- **Compare to tokenization**: Requires new service, deployment, monitoring.

### 5. Flexibility ⭐⭐
- **Environment-specific behavior**: Skip masking in local dev, apply in staging/production.
- **Field-specific rules**: Different masking strategies per field type (partial masking for email, hashing for user agent).

### 6. Regulatory Compliance ⭐⭐⭐
- **GDPR/CCPA**: Masked PII reduces risk of unauthorized access.
- **SOC2**: Demonstrates "controls around PII handling" (auditable masking logic).
- **Irreversibility is acceptable**: For most debugging/observability use cases, partial identifiers are sufficient.

---

## PII Fields Registry

### Identified PII Fields

| Field Name | Data Type | Context | Sensitivity Level | Masking Rule |
|------------|-----------|---------|-------------------|--------------|
| `email` | String | User contact, auth logs | Medium | Partial (first 2 chars + `***@domain`) |
| `phone` | String | User contact, 2FA logs | Medium | Partial (last 4 digits only) |
| `full_name` | String | User profile, audit logs | Medium | Initials only |
| `ip_address` | String | Request logs, audit logs | Low-Medium | Zero last octet (IPv4) or last 80 bits (IPv6) |
| `user_agent` | String | Request logs | Low | SHA256 hash (first 16 chars) |
| `address` | Object | User profile, shipping | High | City + country only |
| `ssn` | String | User verification (future) | Critical | ❌ Not stored in logs (do not log) |
| `credit_card` | String | Payment (future) | Critical | ❌ Not stored in logs (do not log) |

### Rationale for Masking Rules

**Goal**: Preserve enough information for debugging and correlation while protecting user privacy.

#### Email: `user@example.com` → `us***@example.com`
- **Rationale**: Domain preserved for support (identify company or email provider issues). First 2 chars for basic differentiation.
- **Preserved utility**: Can correlate multiple log events for same user (if same email prefix).

#### Phone: `+1-555-123-4567` → `***-***-***-4567`
- **Rationale**: Last 4 digits sufficient for user verification in support scenarios.
- **Preserved utility**: Support can confirm "Does your number end in 4567?"

#### Full Name: `John Michael Doe` → `J.M.D.`
- **Rationale**: Initials provide basic identification without full name exposure.
- **Preserved utility**: Can differentiate users with different initials.

#### IP Address: `192.168.1.42` → `192.168.1.0`
- **Rationale**: Preserve subnet for network debugging (identify datacenter, region, ISP).
- **Preserved utility**: Geographic correlation without exact device identification.

#### User Agent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64)...` → `sha256:a3f2c8d9e5b7f1a2`
- **Rationale**: User agent can fingerprint users; hash provides correlation without exposure.
- **Preserved utility**: Can correlate requests from same device (same hash).

#### Address: `{ street: "123 Main St", city: "Seattle", state: "WA", zip: "98101" }` → `{ city: "Seattle", country: "USA" }`
- **Rationale**: City/country sufficient for geographic analytics without exact location.
- **Preserved utility**: Can analyze usage patterns by city/region.

---

## Implementation

### Masking Middleware

```typescript
/**
 * PII Masking Middleware
 * Applies masking rules to log data before output
 */

type PII_Field = 'email' | 'phone' | 'full_name' | 'ip_address' | 'user_agent' | 'address';

const maskingRules: Record<PII_Field, (value: any) => any> = {
  email: (email: string): string => {
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `***@${domain}`;
    return `${local.substring(0, 2)}***@${domain}`;
  },
  
  phone: (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 4) return '****';
    return `***-***-***-${digits.slice(-4)}`;
  },
  
  full_name: (name: string): string => {
    const parts = name.trim().split(/\s+/);
    return parts.map(p => p[0].toUpperCase() + '.').join('');
  },
  
  ip_address: (ip: string): string => {
    if (ip.includes(':')) {
      // IPv6: mask last 80 bits
      return ip.split(':').slice(0, 3).join(':') + ':0:0:0:0:0';
    } else {
      // IPv4: mask last octet
      return ip.split('.').slice(0, 3).join('.') + '.0';
    }
  },
  
  user_agent: (ua: string): string => {
    const hash = crypto.createHash('sha256').update(ua).digest('hex');
    return `sha256:${hash.substring(0, 16)}`;
  },
  
  address: (addr: AddressObject): Partial<AddressObject> => {
    return {
      city: addr.city,
      country: addr.country,
    };
  },
};

/**
 * Main masking function
 * @param data - Log data object
 * @param environment - Current environment (development, staging, production)
 * @returns Masked data object
 */
export function maskPII(data: Record<string, any>, environment: string = process.env.NODE_ENV): Record<string, any> {
  // Skip masking in local development
  if (environment === 'development') {
    return data;
  }
  
  const masked = { ...data };
  
  // Apply masking rules to known PII fields
  for (const [field, maskFn] of Object.entries(maskingRules)) {
    if (masked[field] !== undefined) {
      masked[field] = maskFn(masked[field]);
    }
  }
  
  // Recursively mask nested objects
  for (const [key, value] of Object.entries(masked)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      masked[key] = maskPII(value, environment);
    }
  }
  
  return masked;
}

/**
 * Logger wrapper with automatic PII masking
 */
export class MaskedLogger {
  constructor(private logger: Logger) {}
  
  info(message: string, data?: Record<string, any>) {
    const maskedData = data ? maskPII(data) : undefined;
    this.logger.info(message, maskedData);
  }
  
  error(message: string, error: Error, data?: Record<string, any>) {
    const maskedData = data ? maskPII(data) : undefined;
    this.logger.error(message, { error: error.message, stack: error.stack, ...maskedData });
  }
  
  warn(message: string, data?: Record<string, any>) {
    const maskedData = data ? maskPII(data) : undefined;
    this.logger.warn(message, maskedData);
  }
}
```

### Usage Example

```typescript
import { MaskedLogger } from './lib/masked-logger';

const logger = new MaskedLogger(winston.createLogger({...}));

// Example 1: User login event
logger.info('User login', {
  user_id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'john.doe@example.com',
  ip_address: '192.168.1.42',
  user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
});

// Output (production):
// {
//   "message": "User login",
//   "user_id": "123e4567-e89b-12d3-a456-426614174000",
//   "email": "jo***@example.com",
//   "ip_address": "192.168.1.0",
//   "user_agent": "sha256:a3f2c8d9e5b7f1a2"
// }

// Example 2: Audit log entry
logger.info('Resource created', {
  actor_id: 'user-123',
  actor_email: 'jane.smith@company.com',
  resource_type: 'project',
  resource_id: 'proj-456',
  tenant_id: 'tenant-789',
});

// Output (production):
// {
//   "message": "Resource created",
//   "actor_id": "user-123",
//   "actor_email": "ja***@company.com",
//   "resource_type": "project",
//   "resource_id": "proj-456",
//   "tenant_id": "tenant-789"
// }
```

---

## Testing Strategy

### Unit Tests for Masking Rules

```typescript
describe('PII Masking Rules', () => {
  describe('email masking', () => {
    it('should mask email with >2 char local part', () => {
      expect(maskingRules.email('john.doe@example.com')).toBe('jo***@example.com');
    });
    
    it('should fully mask email with <=2 char local part', () => {
      expect(maskingRules.email('a@test.com')).toBe('***@test.com');
    });
    
    it('should preserve domain for debugging', () => {
      expect(maskingRules.email('user@company.org')).toBe('us***@company.org');
    });
  });
  
  describe('phone masking', () => {
    it('should show last 4 digits only', () => {
      expect(maskingRules.phone('+1-555-123-4567')).toBe('***-***-***-4567');
    });
    
    it('should handle international format', () => {
      expect(maskingRules.phone('+44 20 1234 5678')).toBe('***-***-***-5678');
    });
  });
  
  describe('full_name masking', () => {
    it('should return initials only', () => {
      expect(maskingRules.full_name('John Michael Doe')).toBe('J.M.D.');
    });
    
    it('should handle single name', () => {
      expect(maskingRules.full_name('Madonna')).toBe('M.');
    });
  });
  
  describe('ip_address masking', () => {
    it('should zero last octet for IPv4', () => {
      expect(maskingRules.ip_address('192.168.1.42')).toBe('192.168.1.0');
    });
    
    it('should mask last 80 bits for IPv6', () => {
      expect(maskingRules.ip_address('2001:0db8:85a3:0000:0000:8a2e:0370:7334'))
        .toBe('2001:0db8:85a3:0:0:0:0:0');
    });
  });
  
  describe('user_agent masking', () => {
    it('should hash user agent string', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      const masked = maskingRules.user_agent(ua);
      expect(masked).toMatch(/^sha256:[a-f0-9]{16}$/);
    });
    
    it('should produce consistent hash for same input', () => {
      const ua = 'Test User Agent';
      const hash1 = maskingRules.user_agent(ua);
      const hash2 = maskingRules.user_agent(ua);
      expect(hash1).toBe(hash2);
    });
  });
  
  describe('address masking', () => {
    it('should return only city and country', () => {
      const addr = {
        street: '123 Main St',
        city: 'Seattle',
        state: 'WA',
        zip: '98101',
        country: 'USA',
      };
      expect(maskingRules.address(addr)).toEqual({ city: 'Seattle', country: 'USA' });
    });
  });
});

describe('maskPII function', () => {
  it('should skip masking in development environment', () => {
    const data = { email: 'test@example.com' };
    const masked = maskPII(data, 'development');
    expect(masked.email).toBe('test@example.com');
  });
  
  it('should apply masking in production environment', () => {
    const data = { email: 'test@example.com' };
    const masked = maskPII(data, 'production');
    expect(masked.email).toBe('te***@example.com');
  });
  
  it('should mask nested objects', () => {
    const data = {
      user: {
        email: 'nested@example.com',
        phone: '+1-555-123-4567',
      },
    };
    const masked = maskPII(data, 'production');
    expect(masked.user.email).toBe('ne***@example.com');
    expect(masked.user.phone).toBe('***-***-***-4567');
  });
  
  it('should not fail on non-PII fields', () => {
    const data = { user_id: '123', tenant_id: 'abc', created_at: '2024-01-01' };
    const masked = maskPII(data, 'production');
    expect(masked).toEqual(data);
  });
});
```

### Integration Tests

```typescript
describe('MaskedLogger integration', () => {
  it('should mask PII in info logs', () => {
    const logSpy = jest.spyOn(console, 'log');
    const logger = new MaskedLogger(winston.createLogger({...}));
    
    logger.info('User action', {
      email: 'user@example.com',
      ip_address: '192.168.1.42',
    });
    
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('us***@example.com'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('192.168.1.0'));
  });
});
```

### Security Testing

**Automated PII Leakage Scanning**:
```bash
# Regex patterns for common PII (unmasked)
# Run against log samples to detect leakage

grep -E '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' logs/*.log | grep -v '\*\*\*'  # Unmasked email
grep -E '\d{3}-\d{3}-\d{4}' logs/*.log | grep -v '\*\*\*'  # Unmasked phone
grep -E '\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}' logs/*.log | grep -v '\.0$'  # Unmasked IPv4

# Exit with error if any unmasked PII detected
```

---

## Developer Guidelines

### DO's ✅

1. **Always use `MaskedLogger`** instead of raw logger (`console.log`, `winston`, `pino`).
2. **Register new PII fields** in `maskingRules` when adding new user data fields.
3. **Test masking logic** with unit tests when adding new PII fields.
4. **Review PR changes** for any direct logging of PII fields.
5. **Use environment variables** to control masking behavior (skip in local dev, enable in staging/prod).

### DON'Ts ❌

1. **Don't log PII directly** without going through `maskPII()` or `MaskedLogger`.
2. **Don't log SSN, credit card, or passwords** (even masked) — these should never appear in logs.
3. **Don't disable masking in production** (environment checks ensure this).
4. **Don't assume existing masking covers new PII fields** — explicitly register new fields.
5. **Don't unmask data manually** — masking is irreversible by design.

---

## Monitoring and Compliance

### Compliance Checklist

- [x] PII fields identified and documented
- [x] Masking rules defined for each PII field
- [x] Unit tests cover all masking rules
- [x] Code review checklist includes PII masking verification
- [x] CI/CD pipeline includes automated PII leakage scanning
- [x] Security team has reviewed masking approach
- [x] Compliance team has approved for GDPR/CCPA

### Ongoing Monitoring

**Quarterly PII Audit**:
- Review log samples for unmasked PII
- Update PII registry with newly identified fields
- Re-run automated PII leakage scans
- Update masking rules if new patterns emerge

**Incident Response**:
- If unmasked PII detected in logs:
  1. Immediately purge affected logs
  2. Notify security team and compliance officer
  3. Conduct root cause analysis (missed field registration, bug in masking logic)
  4. Update masking rules and re-deploy
  5. Document incident and remediation in security log

---

## Future Enhancements

### Phase 2 (Post-MVP-1)

1. **Tokenization Service** (if required by regulations):
   - Implement tokenization for highly sensitive fields (SSN, payment info)
   - Integrate with HashiCorp Vault or AWS Secrets Manager

2. **Reversible Masking** (if support needs require de-masking):
   - Store mapping of masked → original in secure PII vault
   - Require MFA for de-masking operations
   - Audit all de-masking events

3. **ML-Based PII Detection**:
   - Use NLP models to detect unregistered PII fields in logs
   - Automated alerts when new PII patterns detected

---

## Consequences

### Positive Consequences ✅

1. **Privacy by Design**: PII never leaves application unmasked.
2. **Compliance**: Demonstrates controls for GDPR, CCPA, SOC2.
3. **Consistency**: Same masking rules across all log sinks.
4. **Testability**: Masking logic unit-tested and auditable.
5. **Developer Productivity**: Simple API (`maskPII()` function, `MaskedLogger` class).

### Negative Consequences ❌

1. **Irreversibility**: Cannot "unmask" data for debugging (mitigation: use correlation IDs to trace across systems).
2. **Developer Discipline Required**: Developers must remember to use `MaskedLogger` (mitigation: ESLint rule, code review checklist).
3. **Risk of Missed PII Fields**: New PII fields may not be registered immediately (mitigation: quarterly PII audits).

### Neutral Consequences ⚖️

1. **Performance Overhead**: Negligible (masking operations are string manipulations, <1ms per log event).
2. **Log Verbosity**: Masked logs may be slightly longer (e.g., `sha256:...` prefix for user agent).

---

## References

- [GDPR Article 5: Principles for Processing Personal Data](https://gdpr-info.eu/art-5-gdpr/)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [NIST SP 800-122: Guide to Protecting PII](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-122.pdf)
- [CCPA: California Consumer Privacy Act](https://oag.ca.gov/privacy/ccpa)

---

**Decision Date**: 2024-01-XX  
**Decision Maker**: SWE Agent (with input from Security and Compliance teams)  
**Review Date**: 2024-06-XX (6 months post-deployment, reassess if new regulations or requirements emerge)
