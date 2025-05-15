# 🧭 Federation & DAG Sync Platform Roadmap

This roadmap outlines the incremental steps to build a local-first, federated record sharing platform with server-owned truth and DAG-based dependency tracking.

---

## ✅ Phase 1: Core Share System

- [x] Define schema for:
  - [x] `users`
  - [x] `servers`
  - [x] `shares`
  - [x] `share_subscribers`
  - [x] `invites`
- [ ] Implement API to create a new share
- [x] Implement invite generation (with access token + encoded metadata)
- [x] Implement invite redemption flow → create `share_subscriber`
- [ ] Start tracking sync checkpoints per subscriber (`last_synced_at` or similar)

✅ **Milestone:** You can create shares, invite other servers, and authorize them to pull.

---

## 🟡 Phase 2: Share DAG Tracking

- [x] Add `share_records` table to track included records per share
- [ ] (Optional) Add `share_edges` table to track graph links
- [x] Implement DAG walker using schema relationships
- [x] On share creation, walk DAG and populate `share_records`
- [ ] On new record creation, check if it links into a shared DAG and expand DAG
- [ ] Add `included_at` timestamps to enable pruning logic later

✅ **Milestone:** You can resolve and persist the full DAG for a share.

---

## 🟠 Phase 3: Change Tracking (Sync Log)

- [x] Add `share_updates` table
- [ ] Hook into record create/update/delete events
- [ ] When a record in `share_records` changes, enqueue a `share_update`
- [ ] Track delivery using `share_update_subscribers`

✅ **Milestone:** You have a working sync log and update queue per peer.

---

## 🟣 Phase 4: Sync API (Pull-Based)

- [ ] Implement `GET /sync/:share_id?since=...` endpoint
- [ ] Return `schema_version`, relevant `share_updates`, and record data
- [ ] Authenticate using `access_token`
- [ ] Mark updates as delivered (`share_update_subscribers`)
- [ ] Handle 409 Conflict for schema version mismatch

✅ **Milestone:** Subscribers can pull updates for a share incrementally.

---

## 🔵 Phase 5: Schema Sync + Validation

- [ ] Store and version your schema explicitly (`schema_version`)
- [ ] Include `schema_version` in each sync response
- [ ] Clients cache schema snapshots locally
- [ ] Reject sync updates on version mismatch
- [ ] Provide endpoint to fetch latest schema

✅ **Milestone:** Schema changes are versioned, validated, and safely propagated.

---

## 🔴 Phase 6: DAG Maintenance + Pruning

- [ ] On record creation, walk links upward to detect inclusion in a shared DAG
- [ ] On relationship removal, check for orphaned DAG nodes
- [ ] Use `share_edges` (if implemented) to support downstream pruning
- [ ] Update `share_records` and `share_updates` accordingly

✅ **Milestone:** DAGs stay current and pruned in response to relationship changes.

---

## ⚪ Phase 7: Peer Monitoring + Debugging Tools

- [ ] CLI or admin UI to:
  - [ ] List active shares and subscribers
  - [ ] View `share_records` for a given share
  - [ ] Show pending updates per peer
  - [ ] Diff and debug schema rejections
- [ ] Build visualization for DAGs (e.g. in Graphviz or D3)

✅ **Milestone:** Federation state is observable and debuggable.

---

## 🔘 Optional Future Phases

- [ ] Push-based sync (WebSocket or HTTP callbacks)
- [ ] Multi-writer conflict handling (e.g. LWW or CRDT)
- [ ] Encrypted DAGs and end-to-end share security
- [ ] Peer discovery and trust negotiation
- [ ] Client-side DAG simulator for offline expansion

---
