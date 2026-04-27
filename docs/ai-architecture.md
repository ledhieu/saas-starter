# AI Architecture Options: MCP vs. Built-In AI

> **Workstream D — Research Document**  
> Competitive pricing intelligence for nail salons. Owner wants AI-powered analytics over competitor data, own menu items, and search history.

---

## 1. Executive Summary

- **Three viable paths exist:** a standalone MCP server (external AI clients), built-in AI via API routes (native UI), or a hybrid combining both. For this app's stage and user profile, a **hybrid approach** is recommended.
- **Built-in AI should ship first** because it delivers the lowest-friction UX, avoids forcing salon owners to install external AI clients, and keeps latency low for high-frequency insights.
- **An MCP endpoint can be added later** as a power-user feature without duplicating context-building logic, because prompt templates and data summarization utilities can be shared between both paths.

---

## 2. Option 1: MCP (Model Context Protocol)

### How It Works
An external AI agent (Claude Desktop, Cursor, Windsurf, etc.) connects to the app via an MCP server. The MCP server exposes tools/resources that let the agent read competitor summaries, the user's menu, and search history directly from the database or API. The model runs inside the user's local AI client; our infrastructure only serves data.

### Pros
| Advantage | Detail |
|-----------|--------|
| **Model agnostic** | Users can bring any MCP-compatible client (Claude, GPT, local LLMs). |
| **No app bloat** | No LLM SDK, streaming UI, or prompt-engineering code in the Next.js bundle. |
| **Standardized protocol** | MCP is gaining traction; one integration potentially works with many clients. |
| **Easy model swaps** | If a user prefers GPT-5 over Claude 4, they just change their client config. |

### Cons
| Risk | Detail |
|------|--------|
| **Extra infrastructure** | Requires hosting and maintaining an MCP server (SSE or stdio transport). |
| **Network latency** | Every tool call is a round-trip from the user's desktop to our server. |
| **Security surface area** | External clients authenticate; we must validate every tool invocation and guard against malicious or accidental data exfiltration. |
| **User friction** | Salon owners must install an AI client, configure the MCP server URL/keys, and understand how to prompt effectively. |

### Implementation Sketch
```text
┌─────────────────┐      HTTP/SSE       ┌─────────────────────────────┐
│  Claude Desktop │  ◄──────────────►  │  MCP Server (Node.js)       │
│  or Cursor      │                     │  • @modelcontextprotocol/sdk │
│                 │                     │  • Exposes tools:            │
│                 │                     │    - getCompetitorSummary()  │
│                 │                     │    - getUserMenu()           │
│                 │                     │    - getSearchHistory()      │
└─────────────────┘                     └──────────────┬──────────────┘
                                                       │
                                              ┌────────▼────────┐
                                              │   PostgreSQL    │
                                              │   (Drizzle ORM) │
                                              └─────────────────┘
```

Two concrete patterns:
1. **Standalone Node.js MCP server** deployed alongside the Next.js app (e.g., on a separate port or service). Uses the official `@modelcontextprotocol/sdk`.
2. **Next.js API route as MCP bridge** — an Edge-compatible route that speaks the MCP protocol over Server-Sent Events (SSE). Simpler deployment (one process) but less portable.

### Cost Estimate
| Item | Estimate |
|------|----------|
| Hosting | $5–20/mo (small VPS or Fly.io/Render for the MCP server) |
| Token usage | Minimal — the MCP server itself does not call LLMs; it only serves data. The user's AI client bears the token cost. |
| Bandwidth | Low (JSON payloads, not images or embeddings). |

---

## 3. Option 2: Built-in AI

### How It Works
The Next.js app calls OpenAI, Anthropic, or another hosted LLM directly from an API route. The route queries the database, builds a rich prompt from competitor averages, percentile rankings, and the user's menu, then calls the LLM with a structured-output schema. The result is returned as JSON and rendered natively in the UI.

### Pros
| Advantage | Detail |
|-----------|--------|
| **Low latency** | No external client hop; DB and LLM calls happen in the same request lifecycle. |
| **Full UX control** | We design the chat/insight UI, handle loading states, errors, and streaming exactly as we want. |
| **Native UI integration** | Insights can be embedded directly into dashboards (charts, badges, cards) rather than appearing as chat text. |
| **Zero external setup** | Salon owners open the app and click "Analyze my prices." No Claude Desktop, no config files. |

### Cons
| Risk | Detail |
|------|--------|
| **Vendor lock-in** | Switching from OpenAI to Anthropic means rewriting SDK calls, prompt formats, and error handling. |
| **Token costs scale** | Every insight query costs tokens. High usage = unpredictable bill. |
| **App complexity** | Adds LLM SDKs, prompt templates, retry logic, rate-limit handling, and structured-output parsing to the codebase. |
| **Rate limits** | Must gracefully handle `429` errors from OpenAI/Anthropic, especially during spikes. |

### Implementation Sketch
```text
┌──────────────┐      POST /api/ai/analyze       ┌─────────────────────────────┐
│  Next.js UI  │  ───────────────────────────►  │  app/api/ai/analyze/route.ts│
│  (Dashboard) │                                 │                             │
│              │  ◄──────────────────────────   │  1. Query DB (Drizzle)      │
│              │      JSON (structured result)   │  2. Build context prompt    │
└──────────────┘                                 │  3. Call OpenAI / Anthropic │
                                                 │     (structured outputs)    │
                                                 │  4. Return JSON             │
                                                 └──────────────┬──────────────┘
                                                                │
                                                       ┌────────▼────────┐
                                                       │   PostgreSQL    │
                                                       └─────────────────┘
```

A typical route:
1. Authenticate the user (Clerk/NextAuth).
2. Fetch summarized data:
   - Competitor price averages & percentiles for the searched area.
   - The user's own menu items.
   - Recent search history (last N lookups).
3. Assemble a prompt using shared templates.
4. Call the LLM with a strict `zod` or JSON-schema response format.
5. Parse, validate, and return the structured insight.

### Cost Estimate
| Item | Estimate |
|------|----------|
| GPT-4o-mini | ~$0.15–0.30 per 1K insight requests (cheap for structured JSON). |
| GPT-4o / Claude 3.5 Sonnet | ~$2–5 per 1K requests (if using larger models for complex reasoning). |
| Caching | Aggressive prompt caching (see §5) can cut costs by 30–60%. |

---

## 4. Option 3: Hybrid (Recommended)

### Philosophy
Ship **built-in AI first** for the 80% use case (common, high-frequency queries), then expose an **MCP endpoint** for the 20% of power users who want open-ended analysis in their own AI client.

### Built-in AI — High-Frequency Insights
These queries are predictable, map well to UI components, and should be native:

| Insight | Data Needed | UI Output |
|---------|-------------|-----------|
| **Price comparison** | Competitor averages + user's menu | Bar chart + "You are in the Xth percentile" badge |
| **Percentile ranking** | Aggregated price distribution per service | Rank list with color-coded tiers |
| **Biggest threat** | Competitors sorted by overlap in services + price undercutting | Threat-score card |
| **Suggested pricing** | Market median + std dev per service type | Table with "suggested" column |

### MCP Endpoint — Power-User Queries
Open-ended questions that do not fit a fixed UI:
- "If I raise my gel manicure price by $5, how many competitors would I leapfrog?"
- "Which neighborhood has the highest average review count but lowest average price?"
- "Write a marketing blurb that highlights where I'm cheaper than the top 3 competitors."

### Shared Infrastructure
Both paths should reuse the same code to avoid drift:

```text
lib/ai/
├── context-builder.ts      # Summarize DB rows into prompt context
├── prompts/
│   ├── price-comparison.ts
│   ├── threat-analysis.ts
│   └── open-ended.ts
├── schemas/
│   └── insights.ts         # Zod schemas for structured outputs
└── mcp-server.ts           # (Future) MCP server importing context-builder
```

---

## 5. Data Context Strategy

The biggest cost and quality lever is **how much data we send to the LLM** and in what form.

### Summarize, Don't Dump
Raw competitor rows are token-heavy and noisy. Pre-aggregate:

| Raw Data | Summarized Form | Token Savings |
|----------|-----------------|---------------|
| 50 competitor rows (name, address, 10 services each) | Averages & percentiles per service category | ~80–90% |
| Full search history | "Last 3 searches: Vancouver Downtown, Yaletown, Kitsilano" | ~95% |
| User menu (20 items) | Grouped by category with price ranges | ~50% |

Example summarized context block:
```text
MARKET SNAPSHOT (Vancouver Downtown, searched 2026-04-20)
- Gel Manicure: 42 competitors, avg $48, median $46, p25 $38, p75 $55
- Acrylic Full Set: 38 competitors, avg $62, median $60, p25 $50, p75 $70
- Your prices: Gel Manicure $45 (33rd percentile), Acrylic Full Set $58 (42nd percentile)
```

### Structured Outputs for Reliability
Always use the LLM provider's **function calling** or **structured output** mode:
- OpenAI: `response_format: { type: "json_schema", schema: ... }`
- Anthropic: `tools` with a single forced tool use

This guarantees valid JSON and eliminates brittle regex parsing.

### Caching & Embeddings
| Technique | When to Use |
|-----------|-------------|
| **Prompt-level caching** (OpenAI prompt cache, Anthropic cache control) | When the market snapshot is identical across requests (same search area, same day). |
| **Pre-computed summaries** | Store aggregated stats in a `market_snapshots` table updated nightly or on-demand. |
| **Embeddings** (optional future) | If we later add semantic search over competitor menus, pre-compute and store embeddings in pgvector. Not needed for Phase 1. |

---

## 6. Security & Privacy

### Prompt Injection Prevention
The LLM must never treat user-provided data (competitor names, addresses, menu items) as instructions.

| Defense | Implementation |
|---------|----------------|
| **Separate system vs. user prompts** | Put all untrusted data in the `user` message; lock instructions in the `system` message. |
| **Input validation** | Sanitize menu item names (max length, no control characters) before inclusion. |
| **Structured output only** | Force JSON mode so the model cannot return free-form text that might contain injected commands. |
| **No tool use from user context** | If using function calling, never let the model decide to call a DB-write tool based on user content. |

### Data Scoping (Multi-Tenancy)
- Every AI route must enforce `WHERE userId = ?` (or `teamId`) on **all** DB queries that build context.
- Never let a user request insights for a competitor set they did not search themselves.
- Validate search ownership: a user can only analyze data from `search_lookups` rows belonging to their account.

### PII Handling
| Field | Risk | Mitigation |
|-------|------|------------|
| Competitor salon names | Indirect PII | Include in prompts only if necessary for the insight; otherwise use anonymized IDs. |
| Competitor addresses | Location PII | Strip to neighborhood/city level before sending to LLM. |
| User's own menu prices | Business-sensitive | Okay to include (it's their own data), but never leak to other users. |

### Additional Measures
- **Rate limiting:** Cap AI requests per user (e.g., 20/hour) to prevent abuse and runaway token costs.
- **Audit logging:** Log every AI request (prompt hash, tokens used, response time) without logging full PII.
- **No LLM access to write APIs:** The AI routes should be read-only. If MCP is implemented, expose only `read` tools.

---

## 7. Next Steps

### Phase 1 — Built-in AI (Weeks 1–3)
1. **Design 2–3 core insights** with mock data and desired JSON schema.
2. **Build `lib/ai/context-builder.ts`** to summarize competitor + user data efficiently.
3. **Implement `app/api/ai/analyze/route.ts`** using OpenAI or Anthropic with structured outputs.
4. **Add UI components** for rendering insights (percentile badges, comparison charts, threat cards).
5. **Add rate limits and audit logging.**

### Phase 2 — Polish & Cost Optimization (Weeks 4–5)
1. **Add prompt caching** (OpenAI prompt cache or Anthropic cache control).
2. **Pre-compute market snapshots** in a DB table to avoid re-aggregating on every request.
3. **A/B test model sizes** (GPT-4o-mini vs. Claude 3.5 Haiku) for cost/quality trade-offs.

### Phase 3 — MCP Endpoint (Future, Post-MVP)
1. Extract `context-builder.ts` and prompt templates into a shared package.
2. Spin up a standalone MCP server (Node.js + `@modelcontextprotocol/sdk`).
3. Expose read-only tools: `getMarketSnapshot`, `getUserMenu`, `getSearchHistory`.
4. Document setup for power users (Claude Desktop config, Cursor MCP settings).

### Decision Gate
> **Do not start MCP work until**:
> - Built-in AI has at least 3 insights shipped and stable.
> - At least one power user explicitly asks for open-ended querying in their own AI client.
> - We have bandwidth to maintain the extra infrastructure and security surface.

---

## Appendix: Quick Comparison Table

| Criterion | Built-In AI | MCP | Hybrid |
|-----------|-------------|-----|--------|
| **Latency** | Low | Higher (extra hop) | Low for built-in |
| **User friction** | None | High (install + config) | Low for most users |
| **Model flexibility** | Locked to provider | Any MCP client | Best of both |
| **Infrastructure cost** | LLM tokens only | Hosting + minimal tokens | Tokens + future hosting |
| **Security control** | High | Medium (external client) | High for built-in |
| **Best for** | Common insights | Power users, open-ended Q&A | Everyone |
| **Recommended first?** | ✅ Yes | ❌ No | ✅ Yes (built-in first) |
