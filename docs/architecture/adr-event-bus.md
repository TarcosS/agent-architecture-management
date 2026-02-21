# ADR: Event Bus Technology Selection

## Status
**Accepted**

## Context

The Multi-App Platform requires a reliable, scalable event bus to support event-driven architecture patterns, specifically:

1. **Asynchronous Communication**: Services need to publish domain events (e.g., `user.created`, `project.updated`) and other services should consume these events without tight coupling.

2. **Outbox/Inbox Pattern**: To ensure consistency between database writes and event publishing, we need a transactional outbox pattern. Events written to an outbox table must be reliably published to an event bus, and consumers must process events idempotently via an inbox pattern.

3. **Replay Capability**: For debugging, reprocessing, and recovery scenarios, we need the ability to replay historical events from a specific point in time.

4. **Scalability**: The event bus must handle our MVP-1 scale (100 tenants, ~10,000 events/day) while being capable of scaling to 10x growth (1000 tenants, ~100,000 events/day).

5. **Operational Simplicity**: Our team has limited experience with distributed systems. The event bus should have low operational overhead and a clear operational runbook.

6. **Dead-Letter Queue**: Failed events must be automatically routed to a dead-letter queue after exhausting retries, with monitoring and alerting.

### Current Architecture

- **Database**: PostgreSQL 14+ (already in use)
- **Cache Layer**: Redis 6.2+ (already in use for session management)
- **Application Framework**: Node.js/TypeScript
- **Deployment**: Docker containers on AWS ECS (or equivalent container orchestration)

### Requirements

| Requirement | Priority | Description |
|-------------|----------|-------------|
| **Reliability** | Must-have | At-least-once delivery guarantee; no message loss |
| **Throughput** | Must-have | Handle 1000 events/sec sustained (10x current peak) |
| **Latency** | Should-have | p95 end-to-end latency < 5 seconds |
| **Replay** | Must-have | Ability to replay events from timestamp or offset |
| **Consumer Groups** | Must-have | Multiple consumers processing same stream in parallel |
| **Ordering** | Nice-to-have | Per-aggregate ordering (not global ordering) |
| **Operational Complexity** | Must-have | Low ops overhead for current team size (2 SREs) |
| **Cost** | Should-have | Cost-effective for MVP-1 scale ($500-$1000/month budget) |

---

## Decision

We will use **Redis Streams** as our event bus technology for the Multi-App Platform.

### Technology Selection: Redis Streams

**Redis Streams** is a log-based data structure introduced in Redis 5.0, optimized for message streaming and event-driven architectures. It provides:

- Persistent, append-only message log
- Native consumer groups for parallel processing and load balancing
- Built-in message replay capability (critical for debugging and reprocessing)
- Configurable message retention (time-based or count-based)
- Sub-millisecond read/write latency

---

## Alternatives Considered

### 1. Apache Kafka

**Description**: Distributed event streaming platform designed for high-throughput, fault-tolerant message delivery.

**Pros**:
- ✅ Industry standard for event streaming (mature ecosystem)
- ✅ Extremely high throughput (millions of messages/sec)
- ✅ Strong durability guarantees (replication, persistent storage)
- ✅ Rich ecosystem (Kafka Connect, Schema Registry, ksqlDB)
- ✅ Excellent monitoring tools (Confluent Control Center, Kafka Manager)

**Cons**:
- ❌ High operational complexity (ZooKeeper dependency until KRaft adoption, multi-node cluster)
- ❌ Resource-intensive (minimum 3-node cluster for production, high memory/disk usage)
- ❌ Steeper learning curve for team
- ❌ Overkill for MVP-1 scale (designed for LinkedIn-scale workloads)
- ❌ Higher infrastructure cost (~$500-$1000/month for managed service like Confluent Cloud)

**Verdict**: ⛔ Rejected — Unnecessarily complex for our scale; operational overhead too high for 2-person SRE team.

---

### 2. RabbitMQ

**Description**: Message broker with robust routing, multiple messaging patterns (queue, pub/sub, RPC).

**Pros**:
- ✅ Mature and battle-tested (since 2007)
- ✅ Flexible routing (exchanges, bindings, routing keys)
- ✅ Good operational tooling (management UI, monitoring plugins)
- ✅ Lower operational complexity than Kafka
- ✅ Strong community and documentation

**Cons**:
- ❌ Limited message replay capability (messages deleted after acknowledgment by default)
- ❌ No native support for consumer groups (requires application-level coordination)
- ❌ Not optimized for high-throughput streaming (better for task queues)
- ❌ Durability mode has performance trade-offs (persistent messages slower)
- ❌ No built-in event sourcing features

**Verdict**: ⛔ Rejected — Lack of replay capability is a dealbreaker for our debugging and reprocessing needs.

---

### 3. AWS SQS (Simple Queue Service)

**Description**: Managed message queue service by AWS with automatic scaling and high availability.

**Pros**:
- ✅ Fully managed (zero operational overhead)
- ✅ Automatic scaling
- ✅ Integrated with AWS ecosystem (Lambda triggers, CloudWatch)
- ✅ Cost-effective at small scale (first 1M requests free per month)

**Cons**:
- ❌ No message replay (messages deleted after consumption or retention period)
- ❌ Higher latency (seconds, not sub-second)
- ❌ Limited to AWS (vendor lock-in)
- ❌ No consumer groups (each consumer gets separate queue)
- ❌ Not designed for event streaming (designed for task queues)
- ❌ No ordering guarantees in standard queues (FIFO queues have throughput limits)

**Verdict**: ⛔ Rejected — Vendor lock-in concerns; lack of replay and high latency make it unsuitable for event-driven architecture.

---

### 4. NATS JetStream

**Description**: Cloud-native messaging system with JetStream persistence layer for streaming.

**Pros**:
- ✅ Lightweight and high-performance
- ✅ Simple deployment (single binary)
- ✅ Built-in persistence and replay
- ✅ Good observability (Prometheus metrics)
- ✅ Modern design (cloud-native from the start)

**Cons**:
- ❌ Smaller ecosystem compared to Kafka/RabbitMQ
- ❌ Less mature (JetStream released in 2020)
- ❌ Fewer managed service options
- ❌ Team has no prior experience with NATS
- ❌ Limited third-party integrations

**Verdict**: ⛔ Rejected — Promising but immature; lack of team experience and smaller ecosystem make it higher risk.

---

### 5. Redis Streams (Selected)

**Description**: Log-based data structure in Redis for append-only message streaming.

**Pros**:
- ✅ Lightweight and easy to operate (leverages existing Redis infrastructure)
- ✅ Built-in consumer groups (competing consumers with load balancing)
- ✅ Message replay from any point (by ID or timestamp)
- ✅ Sub-millisecond latency (in-memory with optional persistence)
- ✅ Persistent message history (configurable retention)
- ✅ Team already has Redis operational experience (used for caching)
- ✅ Cost-effective (reuse existing Redis instance, ~$100-$300/month for managed Redis)
- ✅ Simple mental model (append-only log, similar to Kafka but simpler)

**Cons**:
- ❌ Smaller ecosystem compared to Kafka (fewer connectors, less tooling)
- ❌ Single-node bottleneck (unless using Redis Cluster, which adds complexity)
- ❌ Less mature monitoring tools compared to Kafka
- ❌ Memory-bound (messages stored in RAM, though persistence to disk available)

**Verdict**: ✅ **Selected** — Best fit for our requirements; balances reliability, performance, and operational simplicity.

---

## Rationale for Choosing Redis Streams

### 1. Operational Simplicity ⭐⭐⭐
- **Leverage existing infrastructure**: We already run Redis for session management. Adding Redis Streams requires minimal operational overhead (no new infrastructure components).
- **Familiar tooling**: Team has Redis operational knowledge (backups, failover, monitoring).
- **Simpler than Kafka**: No ZooKeeper, no multi-node cluster coordination, no partition rebalancing complexity.

### 2. Sufficient Performance for MVP-1 and Beyond ⭐⭐⭐
- **Throughput**: Redis Streams can handle 100,000+ messages/sec on modern hardware, far exceeding our MVP-1 needs (1,000 events/sec).
- **Latency**: Sub-millisecond read/write latency meets our p95 < 5 seconds end-to-end requirement.
- **Scalability**: Horizontal scaling via Redis Cluster if needed in future (not required for MVP-1).

### 3. Replay Capability ⭐⭐⭐
- **Critical for debugging**: When issues arise, we can replay events from a specific timestamp or message ID to reproduce bugs or reprocess data.
- **Event sourcing support**: Future event sourcing patterns (event store) can leverage replay.
- **RabbitMQ and SQS lack this feature**, making Redis Streams a clear winner for our use case.

### 4. Consumer Groups ⭐⭐⭐
- **Native support**: Redis Streams has first-class support for consumer groups, enabling multiple consumers to process the same stream in parallel.
- **Load balancing**: Messages automatically distributed across consumers in the same group.
- **Acknowledgment tracking**: Pending entries list (PEL) tracks unacknowledged messages for retry.

### 5. Cost-Effectiveness ⭐⭐
- **Reuse existing infrastructure**: No additional license or service cost (Redis already deployed).
- **Managed service**: AWS ElastiCache for Redis, Azure Cache for Redis, or Google Cloud Memorystore (~$100-$300/month for production-grade instance).
- **Compare to Kafka**: Managed Kafka (Confluent Cloud, AWS MSK) costs $500-$1000+/month for similar throughput.

### 6. Low Learning Curve ⭐⭐
- **Familiar Redis commands**: Developers already know Redis basics; learning Streams commands (`XADD`, `XREAD`, `XACK`) is straightforward.
- **Compare to Kafka**: Kafka requires understanding brokers, partitions, consumer offsets, rebalancing, etc. — steeper learning curve.

---

## Technical Architecture

### Redis Streams Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Redis Streams                           │
│                                                                 │
│  Stream: "events:user"                                          │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐     │
│  │ Message 1   │ Message 2   │ Message 3   │ Message N   │     │
│  │ ID: 1-0     │ ID: 2-0     │ ID: 3-0     │ ID: N-0     │     │
│  └─────────────┴─────────────┴─────────────┴─────────────┘     │
│                                                                 │
│  Consumer Group: "user-processor-group"                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Consumer 1  │  │ Consumer 2  │  │ Consumer 3  │            │
│  │ (pending: 0)│  │ (pending: 2)│  │ (pending: 1)│            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### Key Commands

```bash
# Publish event
XADD events:user * event_type "user.created" payload "{...}" tenant_id "abc-123"

# Create consumer group
XGROUP CREATE events:user user-processor-group 0

# Read messages (consumer group)
XREADGROUP GROUP user-processor-group consumer1 COUNT 10 STREAMS events:user >

# Acknowledge message
XACK events:user user-processor-group 1234567890123-0

# Replay from timestamp
XREAD COUNT 100 STREAMS events:user 1640000000000-0
```

### Integration with Outbox/Inbox Pattern

**Outbox Publisher** (writes to Redis Streams):
```typescript
// Background worker polls outbox table
const pendingEvents = await db.query("SELECT * FROM outbox_events WHERE status = 'pending' LIMIT 100");

for (const event of pendingEvents) {
  // Publish to Redis Stream
  const messageId = await redis.xadd(
    `events:${event.aggregate_type}`,
    '*', // Auto-generate ID
    'event_type', event.event_type,
    'payload', JSON.stringify(event.payload),
    'tenant_id', event.tenant_id
  );
  
  // Mark as published
  await db.query("UPDATE outbox_events SET status = 'published', published_at = NOW() WHERE id = $1", [event.id]);
}
```

**Inbox Consumer** (reads from Redis Streams):
```typescript
// Consumer group processing
while (true) {
  const messages = await redis.xreadgroup(
    'GROUP', 'my-consumer-group', 'consumer-1',
    'COUNT', 10,
    'BLOCK', 5000, // 5 second block
    'STREAMS', 'events:user', '>'
  );
  
  for (const [stream, entries] of messages) {
    for (const [messageId, fields] of entries) {
      const eventType = fields.find(f => f[0] === 'event_type')[1];
      const payload = JSON.parse(fields.find(f => f[0] === 'payload')[1]);
      
      // Idempotent processing via inbox pattern
      await processEventIdempotently(messageId, eventType, payload);
      
      // Acknowledge message
      await redis.xack(stream, 'my-consumer-group', messageId);
    }
  }
}
```

---

## Persistence and Durability

### Redis Persistence Options

1. **RDB (Redis Database Backup)**:
   - Point-in-time snapshots
   - Low performance impact
   - Risk of data loss (up to last snapshot interval)
   - Recommended: Snapshot every 5 minutes

2. **AOF (Append-Only File)**:
   - Log every write operation
   - Better durability (1-second fsync interval)
   - Slightly higher performance impact
   - Recommended: `appendfsync everysec`

3. **RDB + AOF (Hybrid)**:
   - Best of both worlds
   - RDB for fast restarts, AOF for durability
   - **Recommended configuration for production**

### Recommended Configuration

```conf
# redis.conf
save 300 10         # RDB: Save if 10 keys changed in 300 seconds
appendonly yes      # Enable AOF
appendfsync everysec # AOF sync every second
maxmemory 4gb       # Adjust based on expected message volume
maxmemory-policy allkeys-lru # Evict old messages when memory full
stream-node-max-bytes 4096    # Optimize for small messages
```

---

## Monitoring and Observability

### Key Metrics to Monitor

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `redis_stream_length` | Number of messages in stream | > 10,000 (backlog) |
| `redis_consumer_lag` | Difference between last message ID and last consumed ID | > 1000 messages |
| `redis_consumer_pending` | Number of unacknowledged messages per consumer | > 100 |
| `redis_memory_usage` | Memory used by Redis instance | > 80% |
| `redis_ops_per_sec` | Operations per second (XADD, XREAD, XACK) | Baseline for anomaly detection |
| `redis_replication_lag` | Replication lag (if using Redis replica) | > 5 seconds |

### Monitoring Setup

```yaml
# Prometheus scrape config
- job_name: 'redis-streams'
  static_configs:
    - targets: ['redis-exporter:9121']
  metrics_path: /metrics
  
# Grafana dashboard
# - Stream length over time
# - Consumer lag per consumer group
# - Messages published/consumed rate
# - Pending entries list (PEL) size
```

---

## High Availability and Disaster Recovery

### High Availability Strategy

**Option 1: Redis Sentinel (Recommended for MVP-1)**
- 1 master + 2 replicas + 3 Sentinel nodes
- Automatic failover (30-60 seconds downtime)
- Simple setup, well-documented

**Option 2: Redis Cluster (Future Consideration)**
- Multi-master setup with sharding
- Higher availability but more operational complexity
- Consider if scaling beyond single-node capacity

### Disaster Recovery

1. **Backup Strategy**:
   - Automated daily RDB snapshots to S3
   - AOF files backed up hourly
   - Retention: 7 days of backups

2. **Recovery Plan**:
   - Restore from RDB snapshot (fastest)
   - Replay AOF file if needed (for recent data)
   - Expected RTO (Recovery Time Objective): < 1 hour
   - Expected RPO (Recovery Point Objective): < 1 minute (AOF everysec)

---

## Migration Path (If Scaling Beyond Redis Streams)

If Redis Streams becomes a bottleneck (unlikely before 10,000+ tenants), migration path:

1. **Phase 1: Optimize Redis Streams**
   - Redis Cluster for horizontal scaling
   - Separate Redis instance per stream type

2. **Phase 2: Hybrid Approach**
   - Keep Redis Streams for low-latency, high-frequency events
   - Migrate high-volume, batch-processing events to Kafka

3. **Phase 3: Full Kafka Migration** (if needed)
   - Estimated effort: 4-6 weeks
   - Outbox/inbox pattern remains (change only the event bus transport)

---

## Consequences

### Positive Consequences ✅

1. **Faster Time-to-Market**: Leveraging existing Redis infrastructure means no new service to deploy or learn.
2. **Lower Operational Burden**: 2-person SRE team can confidently operate Redis; Kafka would require additional training and runbook development.
3. **Cost Savings**: Reusing Redis saves $300-$700/month compared to managed Kafka services.
4. **Developer Productivity**: Simple API (XADD, XREAD, XACK) reduces development time for event publishers/consumers.
5. **Debugging and Replay**: Built-in replay capability accelerates debugging and incident resolution.

### Negative Consequences ❌

1. **Smaller Ecosystem**: Fewer third-party integrations and connectors compared to Kafka (e.g., Kafka Connect, Debezium).
2. **Monitoring Tools**: Less mature monitoring/observability ecosystem (will rely on custom Grafana dashboards + Redis exporter).
3. **Single-Node Bottleneck**: Without Redis Cluster, limited to single-node throughput (~100K events/sec). Mitigation: Use Redis Cluster if scaling beyond MVP-1.
4. **Memory Constraints**: Messages stored in RAM (though AOF/RDB persistence to disk available). Mitigation: Set retention policy and archive old messages.

### Neutral Consequences ⚖️

1. **Learning Curve**: Team needs to learn Redis Streams commands and consumer group semantics, but simpler than Kafka.
2. **Vendor Flexibility**: Tightly coupled to Redis; migrating to another event bus (Kafka, RabbitMQ) would require code changes. Mitigation: Abstract event bus interface in application code.

---

## Compliance and Security

- **Encryption**: TLS enabled for Redis connections (in-transit encryption)
- **Access Control**: Redis ACLs to restrict access per consumer group
- **Audit Logging**: All events include `tenant_id` and `actor_id` for audit trail
- **Data Retention**: Configurable retention policy per stream (90 days default, 365 days for compliance-sensitive events)

---

## Timeline

- **Research and ADR**: 1 day (DONE)
- **Outbox Publisher Implementation**: 2 days
- **Inbox Consumer Implementation**: 3 days
- **Monitoring Setup**: 1 day
- **Integration Testing**: 2 days
- **Documentation and Runbooks**: 1 day

**Total**: ~10 days (2 weeks with buffer)

---

## References

- [Redis Streams Introduction](https://redis.io/docs/data-types/streams/)
- [Redis Streams Consumer Groups](https://redis.io/docs/data-types/streams-tutorial/)
- [Transactional Outbox Pattern](https://microservices.io/patterns/data/transactional-outbox.html)
- [Comparing Kafka and Redis Streams](https://redis.com/blog/redis-streams-vs-kafka/)

---

**Decision Date**: 2024-01-XX  
**Decision Maker**: SWE Agent (with input from Architect and SRE team)  
**Review Date**: 2024-06-XX (6 months post-deployment, reassess if scaling challenges arise)
