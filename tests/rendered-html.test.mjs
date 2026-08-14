import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("renders the TankAI product instead of the starter", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("product", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Eine KI\./);
  assert.match(html, /Ein Team dahinter\./);
  assert.doesNotMatch(html, /Starter Project/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("renders durable goal controls in the authenticated workspace", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("goal-ui", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/app", {
      headers: {
        accept: "text/html",
        "oai-authenticated-user-email": "owner@example.test",
        "oai-authenticated-user-full-name": "TankAI%20Owner",
        "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Langlebiges Ziel anlegen/);
  assert.match(html, /ZIELE/);
  assert.match(html, /PROJEKTE/);
  assert.match(html, /aria-label="Projektbereiche"/);
  assert.match(html, /AUSFÜHRUNGSFREIGABE/);
  assert.match(html, /TankAI Owner/);
});

test("renders authenticated data control with explicit export and deletion boundaries", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("data-ui", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/data", {
      headers: {
        accept: "text/html",
        "oai-authenticated-user-email": "owner@example.test",
        "oai-authenticated-user-full-name": "TankAI%20Owner",
        "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Daten besitzen\. Export prüfen\. Löschung beweisen\./);
  assert.match(html, /2 SCHRITTE \+ 24 H/);
  assert.match(html, /Ehrliche Beweisgrenze/);
  assert.match(html, /KEINE NUTZERKENNUNG GESPEICHERT/);
  assert.match(html, /TankAI Owner/);
});

test("reports an honest unconfigured model state", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("status", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/status"),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      DB: {},
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.product, "TankAI Web");
  assert.equal(body.release, "0.43.0");
  assert.equal(body.promptVersion, "2.1.0");
  assert.equal(body.modelAccess, "not-configured");
  assert.deepEqual(body.providers, []);
  assert.equal(body.modelMesh.providerCount, 0);
  assert.equal(body.modelMesh.independentReviewReady, false);
  assert.equal(body.reliabilityOperations.admissionControl, true);
  assert.equal(body.reliabilityOperations.defaultRateLimitPerMinute, 60);
  assert.equal(body.reliabilityOperations.defaultMaximumConcurrency, 4);
  assert.equal(body.reliabilityOperations.persistentInflightLeases, true);
  assert.equal(body.reliabilityOperations.deduplicatedAlerts, true);
  assert.equal(body.reliabilityOperations.deadLetterReplayRequiresFreshToolLease, true);
  assert.equal(body.reliabilityOperations.toolInputPlaintextExported, false);
  assert.equal(body.dataControl.registeredUserDatasets, 55);
  assert.equal(body.dataControl.transactionalExportSnapshot, true);
  assert.equal(body.dataControl.ephemeralCredentialsExported, false);
  assert.equal(body.dataControl.deletionConfirmationRequired, true);
  assert.equal(body.dataControl.deletionGraceHours, 24);
  assert.equal(body.dataControl.accountFrozenDuringDeletion, true);
  assert.equal(body.dataControl.deletionReceiptStoresUserIdentifier, false);
  assert.equal(body.dataControl.postDeletionDatabaseVerification, true);
  assert.equal(body.dataControl.externalInfrastructureCoveredByReceipt, false);
  assert.equal(body.modelMesh.candidates.length, 5);
  assert.equal(body.tankBenchContract, "1.0.0");
  assert.equal(body.improvement.automaticPromptMutation, false);
  assert.equal(body.goals.durable, true);
  assert.equal(body.goals.resumableState, true);
  assert.equal(body.goals.automaticExecutionResume, false);
  assert.equal(body.projectSpaces.durable, true);
  assert.equal(body.projectSpaces.versionedTextDocuments, true);
  assert.equal(body.projectSpaces.csvColumnProfiles, true);
  assert.equal(body.projectSpaces.csvNullAndTypeStatistics, true);
  assert.equal(body.projectSpaces.csvMaximumQueryFilters, 5);
  assert.equal(body.projectSpaces.csvMaximumQuerySorts, 2);
  assert.equal(body.projectSpaces.csvMaximumQueryColumns, 8);
  assert.equal(body.projectSpaces.csvMaximumQueryRows, 10);
  assert.equal(body.projectSpaces.csvMaximumQueryAggregations, 8);
  assert.deepEqual(body.projectSpaces.csvAggregationOperations, [
    "sum",
    "minimum",
    "maximum",
    "average",
  ]);
  assert.equal(body.projectSpaces.csvAggregationNumericOnly, true);
  assert.equal(body.projectSpaces.csvAggregationEmptyCells, "excluded");
  assert.equal(body.projectSpaces.csvQueryReceipts, true);
  assert.equal(body.projectSpaces.csvQueryFactsVerified, false);
  assert.equal(body.projectSpaces.immutableDocumentHistory, true);
  assert.equal(body.projectSpaces.binaryObjectStorage, "not-configured");
  assert.equal(body.memory.durable, true);
  assert.deepEqual(body.memory.types, ["episodic", "semantic", "procedural"]);
  assert.equal(body.memory.embeddingModel, "tank-hash-v1");
  assert.equal(body.memory.embeddingDimensions, 192);
  assert.equal(body.memory.feedbackPromotion, true);
  assert.equal(body.memory.promptInjectionBoundary, "untrusted-recalled-memory");
  assert.equal(body.capabilityLeases.durable, true);
  assert.equal(body.capabilityLeases.requiredForModelRuns, true);
  assert.equal(body.capabilityLeases.immutableEvents, true);
  assert.equal(body.capabilityLeases.maximumUses, 20);
  assert.equal(body.toolJobs.durable, true);
  assert.equal(body.toolJobs.explicitLeaseRequired, true);
  assert.deepEqual(body.toolJobs.tools, [
    "text.sha256",
    "text.analyze",
    "json.validate",
    "memory.retention",
    "web.fetch",
    "project.document.inspect",
    "code.patch.inspect",
  ]);
  assert.equal(body.toolJobs.externalNetwork, "restricted-https-fetch");
  assert.equal(body.toolJobs.networkPolicy.maximumRedirects, 3);
  assert.equal(body.toolJobs.documentInspection, "tenant-and-project-scoped");
  assert.equal(body.toolJobs.patchInspection, "static-only");
  assert.equal(body.toolJobs.codeExecution, false);
  assert.equal(body.toolJobs.idempotentCreation, true);
  assert.equal(body.toolJobs.staleClaimRecoveryMinutes, 5);
  assert.equal(body.toolJobs.progressStreaming.transport, "authenticated-sse");
  assert.equal(body.toolJobs.progressStreaming.inputAndOutputIncluded, false);
  assert.equal(body.toolJobs.progressStreaming.factsVerified, false);
  assert.equal(body.commander.durableRuns, true);
  assert.equal(body.commander.coupledToReAct, true);
  assert.equal(body.commander.serverResolvedToolLeases, true);
  assert.equal(body.commander.unleasedActionsExecuted, false);
  assert.equal(body.commander.mandatoryCriticBeforeFinal, true);
  assert.equal(body.commander.rawModelResponsesStored, false);
  assert.equal(body.tankBench.durableSuites, true);
  assert.equal(body.tankBench.frozenCaseHashes, true);
  assert.equal(body.tankBench.commanderEvidenceOnly, true);
  assert.deepEqual(body.tankBench.canaryTrafficStages, [5, 25, 50, 100]);
  assert.equal(body.tankBench.automaticRollback, true);
});

test("publishes the executable TankBench contract without a fake comparison", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("benchmark", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/benchmark"),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.contractVersion, "1.0.0");
  assert.equal(body.minimumCases, 50);
  assert.equal(body.dimensions.length, 8);
  assert.equal(body.currentPublicComparison, null);
  assert.match(body.claim, /keine Überlegenheit/i);
});

test("rejects anonymous model execution before database or provider use", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("auth", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/team", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Hallo" }),
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.match(body.error, /melde dich/i);
});

test("rejects anonymous access to durable goals", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("goal-auth", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/goals"),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /melde dich/i);
});

test("rejects anonymous access to project spaces", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("project-auth", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/projects"),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /melde dich/i);
});

test("rejects anonymous access to tool progress streaming", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("stream-auth", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request(
      "http://localhost/api/tool-jobs/stream?jobId=123e4567-e89b-12d3-a456-426614174000",
    ),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
  assert.equal(response.status, 401);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.doesNotMatch(response.headers.get("content-type") ?? "", /text\/event-stream/);
  assert.match((await response.json()).error, /melde dich/i);
});

test("rejects anonymous access to capability leases", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("lease-auth", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/capability-leases"),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /melde dich/i);
});


test("rejects anonymous access to long-term memory", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("memory-auth", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/memory"),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /melde dich/i);
});

class MockStatement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql.replace(/\s+/g, " ").trim();
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async first() {
    if (this.sql.startsWith("INSERT INTO usage_buckets")) {
      return { requests: 1, model_calls: this.args[2] };
    }
    if (this.sql.startsWith("SELECT COUNT(*) AS lease_count")) {
      const [userId, timestamp] = this.args;
      return {
        lease_count: [...this.database.capabilityLeases.values()].filter(
          (lease) =>
            lease.userId === userId &&
            lease.status === "active" &&
            lease.remainingUses > 0 &&
            lease.expiresAt > timestamp,
        ).length,
      };
    }
    if (this.sql.startsWith("SELECT id FROM conversations")) {
      const [id, userId] = this.args;
      const conversation = this.database.conversations.get(id);
      return conversation?.userId === userId ? { id } : null;
    }
    if (this.sql.startsWith("SELECT id FROM runs")) {
      const [id, userId] = this.args;
      const run = this.database.runs.get(id);
      return run?.userId === userId && run.status === "completed"
        ? { id }
        : null;
    }
    if (
      this.sql.startsWith("SELECT id, title, objective") &&
      this.sql.includes("FROM goals WHERE id = ? AND user_id = ?")
    ) {
      const [id, userId] = this.args;
      const goal = this.database.goals.get(id);
      return goal?.userId === userId ? this.database.goalRow(goal) : null;
    }
    if (
      this.sql.startsWith("SELECT projects.id, projects.name") &&
      this.sql.includes(
        "WHERE projects.id = ? AND projects.user_id = ?",
      )
    ) {
      const [id, userId] = this.args;
      const project = this.database.projects.get(id);
      return project?.userId === userId
        ? this.database.projectRow(project)
        : null;
    }
    if (
      this.sql.startsWith("SELECT id, project_id, name, kind, content") &&
      this.sql.includes(
        "FROM project_documents WHERE id = ? AND user_id = ?",
      )
    ) {
      const [id, userId] = this.args;
      const document = this.database.projectDocuments.get(id);
      return document?.userId === userId
        ? this.database.projectDocumentRow(document)
        : null;
    }
    if (
      this.sql.startsWith("SELECT id FROM project_documents") &&
      this.sql.includes("lower(name) = lower(?)")
    ) {
      const [projectId, userId, name, exceptDocumentId] = this.args;
      const document = [...this.database.projectDocuments.values()].find(
        (item) =>
          item.projectId === projectId &&
          item.userId === userId &&
          item.name.toLocaleLowerCase("en-US") ===
            String(name).toLocaleLowerCase("en-US") &&
          (!exceptDocumentId || item.id !== exceptDocumentId),
      );
      return document ? { id: document.id } : null;
    }
    if (
      this.sql.startsWith(
        "SELECT id, document_id, project_id, version, name, kind",
      ) &&
      this.sql.includes("FROM project_document_versions") &&
      this.sql.includes("AND version = ?")
    ) {
      const [documentId, projectId, userId, versionNumber] = this.args;
      const version = this.database.projectDocumentVersions.find(
        (item) =>
          item.documentId === documentId &&
          item.projectId === projectId &&
          item.userId === userId &&
          item.version === versionNumber,
      );
      return version
        ? {
            id: version.id,
            document_id: version.documentId,
            project_id: version.projectId,
            version: version.version,
            name: version.name,
            kind: version.kind,
            content: version.content,
            content_sha256: version.contentSha256,
            size_bytes: version.sizeBytes,
            change_note: version.changeNote,
            created_at: version.createdAt,
          }
        : null;
    }
    if (
      this.sql.startsWith(
        "SELECT capability_leases.id, capability_leases.capability",
      ) &&
      this.sql.includes(
        "WHERE capability_leases.id = ? AND capability_leases.user_id = ?",
      )
    ) {
      const [id, userId] = this.args;
      const lease = this.database.capabilityLeases.get(id);
      return lease?.userId === userId
        ? this.database.capabilityLeaseRow(lease)
        : null;
    }
    if (this.sql.startsWith("SELECT COUNT(*) AS total")) {
      const [userId] = this.args;
      const rows = this.database.feedback.filter(
        (item) => item.userId === userId,
      );
      return {
        total: rows.length,
        positive: rows.filter((item) => item.rating === 1).length,
        negative: rows.filter((item) => item.rating === -1).length,
        corrections: rows.filter((item) => Boolean(item.correction)).length,
        last_signal_at: rows.at(-1)?.createdAt ?? null,
      };
    }
    if (
      this.sql.startsWith(
        "SELECT COALESCE(SUM(CASE WHEN status = 'queued'",
      )
    ) {
      const [userId] = this.args;
      const rows = this.database.learningCases.filter(
        (item) => item.userId === userId,
      );
      return {
        queued: rows.filter((item) => item.status === "queued").length,
        included: rows.filter((item) => item.status === "included").length,
        dismissed: rows.filter((item) => item.status === "dismissed").length,
      };
    }
    return null;
  }

  async all() {
    if (this.sql.startsWith("SELECT role, content FROM messages")) {
      const [conversationId, userId] = this.args;
      return {
        results: this.database.messages
          .filter(
            (message) =>
              message.conversationId === conversationId &&
              message.userId === userId,
          )
          .map(({ role, content }) => ({ role, content }))
          .reverse(),
      };
    }
    if (
      this.sql.startsWith("SELECT id, title, objective") &&
      this.sql.includes("FROM goals WHERE user_id = ?")
    ) {
      const [userId] = this.args;
      return {
        results: [...this.database.goals.values()]
          .filter((goal) => goal.userId === userId)
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
          .map((goal) => this.database.goalRow(goal)),
      };
    }
    if (
      this.sql.startsWith("SELECT id, goal_id, run_id") &&
      this.sql.includes("FROM goal_events")
    ) {
      const [goalId, userId] = this.args;
      return {
        results: this.database.goalEvents
          .filter(
            (event) =>
              event.goalId === goalId && event.userId === userId,
          )
          .slice()
          .reverse()
          .map((event) => ({
            id: event.id,
            goal_id: event.goalId,
            run_id: event.runId,
            event_type: event.type,
            from_status: event.fromStatus,
            to_status: event.toStatus,
            progress_percent: event.progressPercent,
            current_step: event.currentStep,
            next_action: event.nextAction,
            note: event.note,
            goal_version: event.goalVersion,
            created_at: event.createdAt,
          })),
      };
    }
    if (
      this.sql.startsWith("SELECT projects.id, projects.name") &&
      this.sql.includes("WHERE projects.user_id = ?")
    ) {
      const [userId] = this.args;
      return {
        results: [...this.database.projects.values()]
          .filter((project) => project.userId === userId)
          .sort((left, right) =>
            right.updatedAt.localeCompare(left.updatedAt),
          )
          .map((project) => this.database.projectRow(project)),
      };
    }
    if (
      this.sql.startsWith("SELECT id, project_id, name, kind, content") &&
      this.sql.includes("FROM project_documents WHERE project_id = ?")
    ) {
      const [projectId, userId] = this.args;
      return {
        results: [...this.database.projectDocuments.values()]
          .filter(
            (document) =>
              document.projectId === projectId &&
              document.userId === userId,
          )
          .sort((left, right) =>
            right.updatedAt.localeCompare(left.updatedAt),
          )
          .map((document) =>
            this.database.projectDocumentRow(document),
          ),
      };
    }
    if (
      this.sql.startsWith("SELECT id, project_id, document_id, run_id") &&
      this.sql.includes("FROM project_events")
    ) {
      const [projectId, userId] = this.args;
      return {
        results: this.database.projectEvents
          .filter(
            (event) =>
              event.projectId === projectId && event.userId === userId,
          )
          .slice()
          .reverse()
          .map((event) => ({
            id: event.id,
            project_id: event.projectId,
            document_id: event.documentId,
            run_id: event.runId,
            event_type: event.type,
            project_version: event.projectVersion,
            document_version: event.documentVersion,
            note: event.note,
            created_at: event.createdAt,
          })),
      };
    }
    if (
      this.sql.startsWith(
        "SELECT id, document_id, project_id, version, name, kind",
      ) &&
      this.sql.includes("FROM project_document_versions")
    ) {
      const [documentId, projectId, userId] = this.args;
      return {
        results: this.database.projectDocumentVersions
          .filter(
            (version) =>
              version.documentId === documentId &&
              version.projectId === projectId &&
              version.userId === userId,
          )
          .slice()
          .sort((left, right) => right.version - left.version)
          .map((version) => ({
            id: version.id,
            document_id: version.documentId,
            project_id: version.projectId,
            version: version.version,
            name: version.name,
            kind: version.kind,
            content: version.content,
            content_sha256: version.contentSha256,
            size_bytes: version.sizeBytes,
            change_note: version.changeNote,
            created_at: version.createdAt,
          })),
      };
    }
    if (
      this.sql.startsWith(
        "SELECT capability_leases.id, capability_leases.capability",
      ) &&
      this.sql.includes("WHERE capability_leases.user_id = ?")
    ) {
      const [userId] = this.args;
      return {
        results: [...this.database.capabilityLeases.values()]
          .filter((lease) => lease.userId === userId)
          .sort((left, right) =>
            right.createdAt.localeCompare(left.createdAt),
          )
          .map((lease) => this.database.capabilityLeaseRow(lease)),
      };
    }
    if (
      this.sql.startsWith("SELECT id, lease_id, run_id, event_type") &&
      this.sql.includes("FROM capability_lease_events")
    ) {
      const [userId] = this.args;
      return {
        results: this.database.capabilityLeaseEvents
          .filter((event) => event.userId === userId)
          .slice()
          .reverse()
          .map((event) => ({
            id: event.id,
            lease_id: event.leaseId,
            run_id: event.runId,
            event_type: event.type,
            lease_version: event.leaseVersion,
            remaining_uses: event.remainingUses,
            created_at: event.createdAt,
          })),
      };
    }
    return { results: [] };
  }

  async run() {
    let changes = 0;
    if (this.sql.startsWith("INSERT INTO conversations")) {
      const [id, userId, title, createdAt, updatedAt] = this.args;
      this.database.conversations.set(id, {
        id,
        userId,
        title,
        createdAt,
        updatedAt,
      });
      changes = 1;
    } else if (this.sql.startsWith("INSERT INTO messages")) {
      const [id, conversationId, userId, role, content, runId, createdAt] =
        this.args;
      this.database.messages.push({
        id,
        conversationId,
        userId,
        role,
        content,
        runId,
        createdAt,
      });
      changes = 1;
    } else if (this.sql.startsWith("INSERT INTO capability_leases")) {
      const [
        id,
        userId,
        mode,
        scope,
        projectId,
        maxUses,
        remainingUses,
        expiresAt,
        lastEventId,
        createdAt,
        updatedAt,
        guardUserId,
        guardTimestamp,
      ] = this.args;
      const activeCount = [...this.database.capabilityLeases.values()].filter(
        (lease) =>
          lease.userId === guardUserId &&
          lease.status === "active" &&
          lease.remainingUses > 0 &&
          lease.expiresAt > guardTimestamp,
      ).length;
      if (activeCount < 20) {
        this.database.capabilityLeases.set(id, {
          id,
          userId,
          capability: "model.run",
          mode,
          scope,
          projectId,
          status: "active",
          maxUses,
          remainingUses,
          version: 1,
          expiresAt,
          lastEventId,
          createdAt,
          updatedAt,
          lastUsedAt: null,
          revokedAt: null,
        });
        changes = 1;
      }
    } else if (
      this.sql.startsWith("UPDATE capability_leases SET remaining_uses")
    ) {
      const [
        lastEventId,
        lastUsedAt,
        updatedAt,
        id,
        userId,
        mode,
        timestamp,
        projectId,
      ] = this.args;
      const lease = this.database.capabilityLeases.get(id);
      const scopeMatches =
        lease?.scope === "account" ||
        (lease?.scope === "project" &&
          Boolean(projectId) &&
          lease.projectId === projectId);
      if (
        lease?.userId === userId &&
        lease.capability === "model.run" &&
        lease.mode === mode &&
        lease.status === "active" &&
        lease.remainingUses > 0 &&
        lease.expiresAt > timestamp &&
        scopeMatches
      ) {
        lease.remainingUses -= 1;
        lease.status =
          lease.remainingUses === 0 ? "depleted" : "active";
        lease.version += 1;
        lease.lastEventId = lastEventId;
        lease.lastUsedAt = lastUsedAt;
        lease.updatedAt = updatedAt;
        changes = 1;
      }
    } else if (
      this.sql.startsWith(
        "UPDATE capability_leases SET status = 'revoked'",
      )
    ) {
      const [
        lastEventId,
        updatedAt,
        revokedAt,
        id,
        userId,
        expectedVersion,
        timestamp,
      ] = this.args;
      const lease = this.database.capabilityLeases.get(id);
      if (
        lease?.userId === userId &&
        lease.version === expectedVersion &&
        lease.status === "active" &&
        lease.remainingUses > 0 &&
        lease.expiresAt > timestamp
      ) {
        lease.status = "revoked";
        lease.version += 1;
        lease.lastEventId = lastEventId;
        lease.updatedAt = updatedAt;
        lease.revokedAt = revokedAt;
        changes = 1;
      }
    } else if (
      this.sql.startsWith("INSERT INTO capability_lease_events") &&
      this.sql.includes("'created'")
    ) {
      const [id, createdAt, leaseId, userId, lastEventId] = this.args;
      const lease = this.database.capabilityLeases.get(leaseId);
      if (
        lease?.userId === userId &&
        lease.lastEventId === lastEventId
      ) {
        this.database.capabilityLeaseEvents.push({
          id,
          leaseId,
          runId: null,
          userId,
          type: "created",
          leaseVersion: 1,
          remainingUses: lease.remainingUses,
          createdAt,
        });
        changes = 1;
      }
    } else if (
      this.sql.startsWith("INSERT INTO capability_lease_events") &&
      this.sql.includes("'consumed'")
    ) {
      const [id, createdAt, leaseId, userId, lastEventId, runId] =
        this.args;
      const lease = this.database.capabilityLeases.get(leaseId);
      const run = this.database.runs.get(runId);
      if (
        lease?.userId === userId &&
        lease.lastEventId === lastEventId &&
        run?.userId === userId &&
        run.capabilityLeaseId === leaseId
      ) {
        this.database.capabilityLeaseEvents.push({
          id,
          leaseId,
          runId,
          userId,
          type: "consumed",
          leaseVersion: lease.version,
          remainingUses: lease.remainingUses,
          createdAt,
        });
        changes = 1;
      }
    } else if (
      this.sql.startsWith("INSERT INTO capability_lease_events") &&
      this.sql.includes("'revoked'")
    ) {
      const [id, createdAt, leaseId, userId, lastEventId] = this.args;
      const lease = this.database.capabilityLeases.get(leaseId);
      if (
        lease?.userId === userId &&
        lease.lastEventId === lastEventId &&
        lease.status === "revoked"
      ) {
        this.database.capabilityLeaseEvents.push({
          id,
          leaseId,
          runId: null,
          userId,
          type: "revoked",
          leaseVersion: lease.version,
          remainingUses: lease.remainingUses,
          createdAt,
        });
        changes = 1;
      }
    } else if (this.sql.startsWith("INSERT INTO runs")) {
      const [
        id,
        conversationId,
        goalId,
        projectId,
        userId,
        mode,
        promptVersion,
        createdAt,
        capabilityLeaseId,
        leaseUserId,
        lastEventId,
      ] = this.args;
      const lease = this.database.capabilityLeases.get(capabilityLeaseId);
      if (
        lease?.userId === leaseUserId &&
        lease.userId === userId &&
        lease.lastEventId === lastEventId
      ) {
        this.database.runs.set(id, {
          id,
          conversationId,
          goalId,
          projectId,
          capabilityLeaseId,
          userId,
          mode,
          promptVersion,
          createdAt,
          status: "running",
        });
        changes = 1;
      }
    } else if (this.sql.startsWith("INSERT INTO projects")) {
      const [id, userId, name, description, createdAt, updatedAt] = this.args;
      this.database.projects.set(id, {
        id,
        userId,
        name,
        description,
        status: "active",
        version: 1,
        contentRevision: 0,
        createdAt,
        updatedAt,
      });
      changes = 1;
    } else if (
      this.sql.startsWith(
        "UPDATE projects SET name = ?, description = ?, status = ?",
      )
    ) {
      const [
        name,
        description,
        status,
        version,
        updatedAt,
        id,
        userId,
        expectedVersion,
      ] = this.args;
      const project = this.database.projects.get(id);
      if (
        project?.userId === userId &&
        project.version === expectedVersion
      ) {
        Object.assign(project, {
          name,
          description,
          status,
          version,
          updatedAt,
        });
        changes = 1;
      }
    } else if (
      this.sql.startsWith(
        "UPDATE projects SET content_revision = content_revision + 1",
      )
    ) {
      const [updatedAt, projectId, userId, documentId, , expectedVersion] =
        this.args;
      const project = this.database.projects.get(projectId);
      const document = documentId
        ? this.database.projectDocuments.get(documentId)
        : undefined;
      const allowed =
        project?.userId === userId &&
        project.status === "active" &&
        (!documentId ||
          (document?.userId === userId &&
            document.version === expectedVersion));
      if (allowed) {
        project.contentRevision += 1;
        project.updatedAt = updatedAt;
        changes = 1;
      }
    } else if (this.sql.startsWith("INSERT INTO project_documents")) {
      const [
        id,
        projectId,
        userId,
        name,
        kind,
        content,
        contentSha256,
        sizeBytes,
        createdAt,
        updatedAt,
      ] = this.args;
      this.database.projectDocuments.set(id, {
        id,
        projectId,
        userId,
        name,
        kind,
        content,
        contentSha256,
        sizeBytes,
        version: 1,
        createdAt,
        updatedAt,
      });
      changes = 1;
    } else if (
      this.sql.startsWith("UPDATE project_documents SET name = ?")
    ) {
      const [
        name,
        kind,
        content,
        contentSha256,
        sizeBytes,
        version,
        updatedAt,
        id,
        userId,
        expectedVersion,
      ] = this.args;
      const document = this.database.projectDocuments.get(id);
      if (
        document?.userId === userId &&
        document.version === expectedVersion
      ) {
        Object.assign(document, {
          name,
          kind,
          content,
          contentSha256,
          sizeBytes,
          version,
          updatedAt,
        });
        changes = 1;
      }
    } else if (
      this.sql.startsWith("INSERT INTO project_document_versions") &&
      this.sql.includes("VALUES")
    ) {
      const [
        id,
        documentId,
        projectId,
        userId,
        name,
        kind,
        content,
        contentSha256,
        sizeBytes,
        changeNote,
        createdAt,
      ] = this.args;
      this.database.projectDocumentVersions.push({
        id,
        documentId,
        projectId,
        userId,
        version: 1,
        name,
        kind,
        content,
        contentSha256,
        sizeBytes,
        changeNote,
        createdAt,
      });
      changes = 1;
    } else if (
      this.sql.startsWith("INSERT INTO project_document_versions") &&
      this.sql.includes("SELECT ?, id, project_id")
    ) {
      const [
        id,
        name,
        kind,
        content,
        contentSha256,
        sizeBytes,
        changeNote,
        createdAt,
        documentId,
        userId,
        expectedVersion,
      ] = this.args;
      const document = this.database.projectDocuments.get(documentId);
      if (
        document?.userId === userId &&
        document.version === expectedVersion
      ) {
        this.database.projectDocumentVersions.push({
          id,
          documentId,
          projectId: document.projectId,
          userId,
          version: expectedVersion + 1,
          name,
          kind,
          content,
          contentSha256,
          sizeBytes,
          changeNote,
          createdAt,
        });
        changes = 1;
      }
    } else if (
      this.sql.startsWith("INSERT INTO project_events") &&
      this.sql.includes("'project_created'")
    ) {
      const [id, projectId, userId, note, createdAt] = this.args;
      this.database.projectEvents.push({
        id,
        projectId,
        documentId: null,
        runId: null,
        userId,
        type: "project_created",
        projectVersion: 1,
        documentVersion: null,
        note,
        createdAt,
      });
      changes = 1;
    } else if (
      this.sql.startsWith("INSERT INTO project_events") &&
      this.sql.includes("SELECT ?, id, NULL, NULL, user_id, ?")
    ) {
      const [
        id,
        type,
        note,
        createdAt,
        projectId,
        userId,
        expectedVersion,
      ] = this.args;
      const project = this.database.projects.get(projectId);
      if (
        project?.userId === userId &&
        project.version === expectedVersion
      ) {
        this.database.projectEvents.push({
          id,
          projectId,
          documentId: null,
          runId: null,
          userId,
          type,
          projectVersion: expectedVersion + 1,
          documentVersion: null,
          note,
          createdAt,
        });
        changes = 1;
      }
    } else if (
      this.sql.startsWith("INSERT INTO project_events") &&
      this.sql.includes("'document_created'")
    ) {
      const [
        id,
        projectId,
        documentId,
        userId,
        projectVersion,
        note,
        createdAt,
      ] = this.args;
      this.database.projectEvents.push({
        id,
        projectId,
        documentId,
        runId: null,
        userId,
        type: "document_created",
        projectVersion,
        documentVersion: 1,
        note,
        createdAt,
      });
      changes = 1;
    } else if (
      this.sql.startsWith("INSERT INTO project_events") &&
      this.sql.includes("'document_updated'")
    ) {
      const [
        id,
        note,
        createdAt,
        documentId,
        userId,
        expectedVersion,
      ] = this.args;
      const document = this.database.projectDocuments.get(documentId);
      const project = document
        ? this.database.projects.get(document.projectId)
        : undefined;
      if (
        document?.userId === userId &&
        document.version === expectedVersion &&
        project?.status === "active"
      ) {
        this.database.projectEvents.push({
          id,
          projectId: document.projectId,
          documentId,
          runId: null,
          userId,
          type: "document_updated",
          projectVersion: project.version,
          documentVersion: expectedVersion + 1,
          note,
          createdAt,
        });
        changes = 1;
      }
    } else if (
      this.sql.startsWith("INSERT INTO project_events") &&
      this.sql.includes("'run_started'")
    ) {
      const [id, runId, note, createdAt, projectId, userId] = this.args;
      const project = this.database.projects.get(projectId);
      if (project?.userId === userId && project.status === "active") {
        this.database.projectEvents.push({
          id,
          projectId,
          documentId: null,
          runId,
          userId,
          type: "run_started",
          projectVersion: project.version,
          documentVersion: null,
          note,
          createdAt,
        });
        changes = 1;
      }
    } else if (
      this.sql.startsWith("INSERT INTO project_events") &&
      (this.sql.includes("'run_completed'") ||
        this.sql.includes("'run_failed'"))
    ) {
      const [id, note, createdAt, runId, userId] = this.args;
      const run = this.database.runs.get(runId);
      const project = run?.projectId
        ? this.database.projects.get(run.projectId)
        : undefined;
      if (run?.userId === userId && project?.userId === userId) {
        this.database.projectEvents.push({
          id,
          projectId: project.id,
          documentId: null,
          runId,
          userId,
          type: this.sql.includes("'run_completed'")
            ? "run_completed"
            : "run_failed",
          projectVersion: project.version,
          documentVersion: null,
          note,
          createdAt,
        });
        changes = 1;
      }
    } else if (
      this.sql.startsWith("UPDATE runs SET status = 'completed'")
    ) {
      const [traceJson, modelCalls, elapsedMs, completedAt, id, userId] =
        this.args;
      const run = this.database.runs.get(id);
      if (run?.userId === userId) {
        Object.assign(run, {
          traceJson,
          modelCalls,
          elapsedMs,
          completedAt,
          status: "completed",
        });
        changes = 1;
      }
    } else if (this.sql.startsWith("INSERT INTO goals")) {
      const [
        id,
        userId,
        title,
        objective,
        definitionOfDone,
        createdAt,
        updatedAt,
      ] = this.args;
      this.database.goals.set(id, {
        id,
        userId,
        title,
        objective,
        definitionOfDone,
        status: "draft",
        progressPercent: 0,
        currentStep: null,
        nextAction: null,
        version: 1,
        createdAt,
        updatedAt,
        completedAt: null,
      });
      changes = 1;
    } else if (
      this.sql.startsWith("UPDATE goals SET status = ?")
    ) {
      const [
        status,
        progressPercent,
        currentStep,
        nextAction,
        version,
        updatedAt,
        completedAt,
        id,
        userId,
        expectedVersion,
      ] = this.args;
      const goal = this.database.goals.get(id);
      if (goal?.userId === userId && goal.version === expectedVersion) {
        Object.assign(goal, {
          status,
          progressPercent,
          currentStep,
          nextAction,
          version,
          updatedAt,
          completedAt,
        });
        changes = 1;
      }
    } else if (
      this.sql.startsWith("INSERT INTO goal_events") &&
      this.sql.includes("'created'")
    ) {
      const [id, goalId, userId, note, createdAt] = this.args;
      this.database.goalEvents.push({
        id,
        goalId,
        runId: null,
        userId,
        type: "created",
        fromStatus: null,
        toStatus: "draft",
        progressPercent: 0,
        currentStep: null,
        nextAction: null,
        note,
        goalVersion: 1,
        createdAt,
      });
      changes = 1;
    } else if (
      this.sql.startsWith("INSERT INTO goal_events") &&
      this.sql.includes("SELECT ?, id, NULL, user_id, ?")
    ) {
      const [
        id,
        type,
        fromStatus,
        toStatus,
        progressPercent,
        currentStep,
        nextAction,
        note,
        createdAt,
        goalId,
        userId,
        expectedVersion,
      ] = this.args;
      const goal = this.database.goals.get(goalId);
      if (goal?.userId === userId && goal.version === expectedVersion) {
        this.database.goalEvents.push({
          id,
          goalId,
          runId: null,
          userId,
          type,
          fromStatus,
          toStatus,
          progressPercent,
          currentStep,
          nextAction,
          note,
          goalVersion: expectedVersion + 1,
          createdAt,
        });
        changes = 1;
      }
    } else if (
      this.sql.startsWith("INSERT INTO goal_events") &&
      this.sql.includes("'run_started'")
    ) {
      const [id, runId, note, createdAt, goalId, userId] = this.args;
      const goal = this.database.goals.get(goalId);
      if (goal?.userId === userId) {
        this.database.goalEvents.push({
          id,
          goalId,
          runId,
          userId,
          type: "run_started",
          fromStatus: goal.status,
          toStatus: goal.status,
          progressPercent: goal.progressPercent,
          currentStep: goal.currentStep,
          nextAction: goal.nextAction,
          note,
          goalVersion: goal.version,
          createdAt,
        });
        changes = 1;
      }
    } else if (
      this.sql.startsWith("INSERT INTO goal_events") &&
      (this.sql.includes("'run_completed'") ||
        this.sql.includes("'run_failed'"))
    ) {
      const [id, note, createdAt, runId, userId] = this.args;
      const run = this.database.runs.get(runId);
      const goal = run?.goalId
        ? this.database.goals.get(run.goalId)
        : undefined;
      if (run?.userId === userId && goal?.userId === userId) {
        this.database.goalEvents.push({
          id,
          goalId: goal.id,
          runId,
          userId,
          type: this.sql.includes("'run_completed'")
            ? "run_completed"
            : "run_failed",
          fromStatus: goal.status,
          toStatus: goal.status,
          progressPercent: goal.progressPercent,
          currentStep: goal.currentStep,
          nextAction: goal.nextAction,
          note,
          goalVersion: goal.version,
          createdAt,
        });
        changes = 1;
      }
    } else if (this.sql.startsWith("INSERT INTO feedback")) {
      const [id, runId, userId, rating, correction, createdAt] = this.args;
      this.database.feedback.push({
        id,
        runId,
        userId,
        rating,
        correction,
        createdAt,
      });
      changes = 1;
    } else if (this.sql.startsWith("INSERT INTO learning_cases")) {
      const [id, feedbackId, runId, userId, createdAt, updatedAt] = this.args;
      this.database.learningCases.push({
        id,
        feedbackId,
        runId,
        userId,
        source: "corrected-negative-feedback",
        status: "queued",
        createdAt,
        updatedAt,
      });
      changes = 1;
    }
    return { success: true, meta: { changes } };
  }
}

class MockD1 {
  constructor() {
    this.conversations = new Map();
    this.messages = [];
    this.runs = new Map();
    this.feedback = [];
    this.learningCases = [];
    this.goals = new Map();
    this.goalEvents = [];
    this.projects = new Map();
    this.projectDocuments = new Map();
    this.projectDocumentVersions = [];
    this.projectEvents = [];
    this.capabilityLeases = new Map();
    this.capabilityLeaseEvents = [];
  }

  goalRow(goal) {
    return {
      id: goal.id,
      title: goal.title,
      objective: goal.objective,
      definition_of_done: goal.definitionOfDone,
      status: goal.status,
      progress_percent: goal.progressPercent,
      current_step: goal.currentStep,
      next_action: goal.nextAction,
      version: goal.version,
      created_at: goal.createdAt,
      updated_at: goal.updatedAt,
      completed_at: goal.completedAt,
    };
  }

  projectRow(project) {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      version: project.version,
      content_revision: project.contentRevision,
      document_count: [...this.projectDocuments.values()].filter(
        (document) =>
          document.projectId === project.id &&
          document.userId === project.userId,
      ).length,
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    };
  }

  projectDocumentRow(document) {
    return {
      id: document.id,
      project_id: document.projectId,
      name: document.name,
      kind: document.kind,
      content: document.content,
      content_sha256: document.contentSha256,
      size_bytes: document.sizeBytes,
      version: document.version,
      created_at: document.createdAt,
      updated_at: document.updatedAt,
    };
  }

  capabilityLeaseRow(lease) {
    const project = lease.projectId
      ? this.projects.get(lease.projectId)
      : null;
    return {
      id: lease.id,
      capability: lease.capability,
      mode: lease.mode,
      scope_kind: lease.scope,
      project_id: lease.projectId,
      project_name: project?.name ?? null,
      status: lease.status,
      max_uses: lease.maxUses,
      remaining_uses: lease.remainingUses,
      version: lease.version,
      expires_at: lease.expiresAt,
      created_at: lease.createdAt,
      updated_at: lease.updatedAt,
      last_used_at: lease.lastUsedAt,
      revoked_at: lease.revokedAt,
    };
  }

  prepare(sql) {
    return new MockStatement(this, sql);
  }

  async batch(statements) {
    return Promise.all(statements.map((statement) => statement.run()));
  }
}

test("persists, resumes, versions, and isolates long-lived goals", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("goals", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const database = new MockD1();
  const environment = {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
    DB: database,
    TANKAI_ID_SALT: "test-salt-with-sufficient-entropy",
  };
  const context = {
    waitUntil() {},
    passThroughOnException() {},
  };
  const ownerHeaders = {
    "content-type": "application/json",
    "oai-authenticated-user-email": "owner@example.test",
  };

  const createResponse = await worker.fetch(
    new Request("http://localhost/api/goals", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({
        title: "TankAI R2 ausbauen",
        objective:
          "Eine mehrstufige Aufgabe über Sitzungen sicher fortsetzen.",
        definitionOfDone:
          "Letzter bestätigter Schritt, nächste Aktion und Receipts bleiben dauerhaft erhalten.",
      }),
    }),
    environment,
    context,
  );
  const created = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(created.goal.status, "draft");
  assert.equal(created.goal.version, 1);
  assert.equal(created.goal.progressPercent, 0);
  assert.match(created.goal.id, /^[0-9a-f-]{36}$/i);

  const updateResponse = await worker.fetch(
    new Request("http://localhost/api/goals", {
      method: "PATCH",
      headers: ownerHeaders,
      body: JSON.stringify({
        goalId: created.goal.id,
        expectedVersion: 1,
        status: "planned",
        progressPercent: 20,
        currentStep: "Datenmodell bestätigt",
        nextAction: "API und Wiederaufnahme prüfen",
        note: "Erster bestätigter R2-Schritt.",
      }),
    }),
    environment,
    context,
  );
  const updated = await updateResponse.json();
  assert.equal(updateResponse.status, 200);
  assert.equal(updated.goal.status, "planned");
  assert.equal(updated.goal.version, 2);
  assert.equal(updated.goal.progressPercent, 20);
  assert.equal(updated.goal.currentStep, "Datenmodell bestätigt");
  assert.equal(updated.goal.nextAction, "API und Wiederaufnahme prüfen");

  const resumedResponse = await worker.fetch(
    new Request(
      `http://localhost/api/goals?goalId=${encodeURIComponent(created.goal.id)}`,
      {
        headers: {
          "oai-authenticated-user-email": "owner@example.test",
        },
      },
    ),
    environment,
    context,
  );
  const resumed = await resumedResponse.json();
  assert.equal(resumedResponse.status, 200);
  assert.equal(resumed.active.goal.version, 2);
  assert.equal(resumed.active.goal.currentStep, "Datenmodell bestätigt");
  assert.equal(resumed.active.events.length, 2);
  assert.deepEqual(
    resumed.active.events.map((event) => event.type),
    ["status_changed", "created"],
  );

  const otherUserResponse = await worker.fetch(
    new Request("http://localhost/api/goals", {
      headers: {
        "oai-authenticated-user-email": "other@example.test",
      },
    }),
    environment,
    context,
  );
  const otherUser = await otherUserResponse.json();
  assert.equal(otherUserResponse.status, 200);
  assert.deepEqual(otherUser.goals, []);

  const invalidTransitionResponse = await worker.fetch(
    new Request("http://localhost/api/goals", {
      method: "PATCH",
      headers: ownerHeaders,
      body: JSON.stringify({
        goalId: created.goal.id,
        expectedVersion: 2,
        status: "completed",
      }),
    }),
    environment,
    context,
  );
  assert.equal(invalidTransitionResponse.status, 409);
  assert.equal(
    (await invalidTransitionResponse.json()).code,
    "INVALID_GOAL_TRANSITION",
  );

  const staleWriteResponse = await worker.fetch(
    new Request("http://localhost/api/goals", {
      method: "PATCH",
      headers: ownerHeaders,
      body: JSON.stringify({
        goalId: created.goal.id,
        expectedVersion: 1,
        progressPercent: 30,
      }),
    }),
    environment,
    context,
  );
  assert.equal(staleWriteResponse.status, 409);
  assert.equal(
    (await staleWriteResponse.json()).code,
    "GOAL_VERSION_CONFLICT",
  );
  assert.equal(database.goalEvents.length, 2);

  let version = 2;
  for (const status of ["ready", "running", "verifying", "completed"]) {
    const transitionResponse = await worker.fetch(
      new Request("http://localhost/api/goals", {
        method: "PATCH",
        headers: ownerHeaders,
        body: JSON.stringify({
          goalId: created.goal.id,
          expectedVersion: version,
          status,
        }),
      }),
      environment,
      context,
    );
    assert.equal(transitionResponse.status, 200);
    version = (await transitionResponse.json()).goal.version;
  }
  assert.equal(version, 6);
  assert.equal(database.goals.get(created.goal.id)?.progressPercent, 100);

  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    return new Response(JSON.stringify({ output_text: "should not run" }));
  };
  try {
    const terminalRunResponse = await worker.fetch(
      new Request("http://localhost/api/team", {
        method: "POST",
        headers: ownerHeaders,
        body: JSON.stringify({
          message: "Führe das abgeschlossene Ziel weiter.",
          goalId: created.goal.id,
          mode: "fast",
        }),
      }),
      { ...environment, OPENAI_API_KEY: "test-provider-key" },
      context,
    );
    assert.equal(terminalRunResponse.status, 409);
    assert.equal(
      (await terminalRunResponse.json()).code,
      "GOAL_NOT_RUNNABLE",
    );
    assert.equal(providerCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("enforces same-origin project mutations and validates JSON and CSV files", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set(
    "project-boundary",
    `${process.pid}-${Date.now()}`,
  );
  const { default: worker } = await import(workerUrl.href);
  const database = new MockD1();
  const environment = {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
    DB: database,
    TANKAI_ID_SALT: "test-salt-with-sufficient-entropy",
  };
  const context = {
    waitUntil() {},
    passThroughOnException() {},
  };
  const crossOriginResponse = await worker.fetch(
    new Request("http://localhost/api/projects", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://attacker.example",
        "oai-authenticated-user-email": "owner@example.test",
      },
      body: JSON.stringify({ name: "Darf nicht entstehen" }),
    }),
    environment,
    context,
  );
  assert.equal(crossOriginResponse.status, 400);
  assert.deepEqual([...database.projects.values()], []);

  const projectResponse = await worker.fetch(
    new Request("http://localhost/api/projects", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "oai-authenticated-user-email": "owner@example.test",
      },
      body: JSON.stringify({ name: "JSON-Prüfung" }),
    }),
    environment,
    context,
  );
  const project = await projectResponse.json();
  assert.equal(projectResponse.status, 201);

  const invalidJsonResponse = await worker.fetch(
    new Request("http://localhost/api/project-documents", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "oai-authenticated-user-email": "owner@example.test",
      },
      body: JSON.stringify({
        projectId: project.project.id,
        name: "config.json",
        kind: "json",
        content: '{"unvollständig":',
      }),
    }),
    environment,
    context,
  );
  assert.equal(invalidJsonResponse.status, 400);
  assert.equal(
    (await invalidJsonResponse.json()).code,
    "INVALID_PROJECT_DOCUMENT_CONTENT",
  );
  assert.deepEqual([...database.projectDocuments.values()], []);

  const invalidCsvResponse = await worker.fetch(
    new Request("http://localhost/api/project-documents", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "oai-authenticated-user-email": "owner@example.test",
      },
      body: JSON.stringify({
        projectId: project.project.id,
        name: "gefährlich.csv",
        kind: "csv",
        content: "name,wert\nTank,=1+1",
      }),
    }),
    environment,
    context,
  );
  assert.equal(invalidCsvResponse.status, 400);
  assert.equal(
    (await invalidCsvResponse.json()).code,
    "INVALID_PROJECT_DOCUMENT_CONTENT",
  );
  assert.deepEqual([...database.projectDocuments.values()], []);

  const validCsvResponse = await worker.fetch(
    new Request("http://localhost/api/project-documents", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "oai-authenticated-user-email": "owner@example.test",
      },
      body: JSON.stringify({
        projectId: project.project.id,
        name: "werte.csv",
        kind: "csv",
        content: "name;wert\nTank;-42,5",
      }),
    }),
    environment,
    context,
  );
  assert.equal(validCsvResponse.status, 201);
  const validCsv = await validCsvResponse.json();
  assert.equal(validCsv.document.kind, "csv");
  assert.equal(validCsv.document.version, 1);
});

test("persists, versions, isolates, and archives real project files", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("projects", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const database = new MockD1();
  const environment = {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
    DB: database,
    TANKAI_ID_SALT: "test-salt-with-sufficient-entropy",
  };
  const context = {
    waitUntil() {},
    passThroughOnException() {},
  };
  const ownerHeaders = {
    "content-type": "application/json",
    "oai-authenticated-user-email": "owner@example.test",
  };

  const projectResponse = await worker.fetch(
    new Request("http://localhost/api/projects", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({
        name: "TankAI Projektkontext",
        description: "Verbindliche Architektur- und Prüfdaten.",
      }),
    }),
    environment,
    context,
  );
  const createdProject = await projectResponse.json();
  assert.equal(projectResponse.status, 201);
  assert.equal(createdProject.project.status, "active");
  assert.equal(createdProject.project.version, 1);
  assert.equal(createdProject.project.contentRevision, 0);

  const documentResponse = await worker.fetch(
    new Request("http://localhost/api/project-documents", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({
        projectId: createdProject.project.id,
        name: "architektur.md",
        kind: "markdown",
        content: "# Architektur\n\nPersistenz: D1.",
        changeNote: "Verbindliche Erstfassung.",
      }),
    }),
    environment,
    context,
  );
  const createdDocument = await documentResponse.json();
  assert.equal(documentResponse.status, 201);
  assert.equal(createdDocument.document.version, 1);
  assert.equal(createdDocument.document.contentSha256.length, 64);

  const updateResponse = await worker.fetch(
    new Request("http://localhost/api/project-documents", {
      method: "PATCH",
      headers: ownerHeaders,
      body: JSON.stringify({
        documentId: createdDocument.document.id,
        expectedVersion: 1,
        name: "architektur.md",
        kind: "markdown",
        content: "# Architektur\n\nPersistenz: D1. Binärdaten: R2-Gate.",
        changeNote: "Speichergrenze präzisiert.",
      }),
    }),
    environment,
    context,
  );
  const updatedDocument = await updateResponse.json();
  assert.equal(updateResponse.status, 200);
  assert.equal(updatedDocument.document.version, 2);
  assert.notEqual(
    updatedDocument.document.contentSha256,
    createdDocument.document.contentSha256,
  );

  const staleResponse = await worker.fetch(
    new Request("http://localhost/api/project-documents", {
      method: "PATCH",
      headers: ownerHeaders,
      body: JSON.stringify({
        documentId: createdDocument.document.id,
        expectedVersion: 1,
        content: "Veraltete Fassung",
      }),
    }),
    environment,
    context,
  );
  assert.equal(staleResponse.status, 409);
  assert.equal(
    (await staleResponse.json()).code,
    "PROJECT_DOCUMENT_VERSION_CONFLICT",
  );
  assert.equal(database.projectDocumentVersions.length, 2);

  const resumeResponse = await worker.fetch(
    new Request(
      `http://localhost/api/projects?projectId=${createdProject.project.id}&documentId=${createdDocument.document.id}&version=1`,
      { headers: { "oai-authenticated-user-email": "owner@example.test" } },
    ),
    environment,
    context,
  );
  const resumed = await resumeResponse.json();
  assert.equal(resumeResponse.status, 200);
  assert.equal(resumed.active.project.contentRevision, 2);
  assert.equal(resumed.active.document.current.version, 2);
  assert.equal(resumed.active.document.selectedVersion.version, 1);
  assert.equal(
    resumed.active.document.selectedVersion.content,
    "# Architektur\n\nPersistenz: D1.",
  );
  assert.deepEqual(
    resumed.active.document.versions.map((version) => version.version),
    [2, 1],
  );

  const otherUserResponse = await worker.fetch(
    new Request("http://localhost/api/projects", {
      headers: { "oai-authenticated-user-email": "other@example.test" },
    }),
    environment,
    context,
  );
  assert.equal(otherUserResponse.status, 200);
  assert.deepEqual((await otherUserResponse.json()).projects, []);

  const archiveResponse = await worker.fetch(
    new Request("http://localhost/api/projects", {
      method: "PATCH",
      headers: ownerHeaders,
      body: JSON.stringify({
        projectId: createdProject.project.id,
        expectedVersion: 1,
        status: "archived",
        note: "Projekt bewusst eingefroren.",
      }),
    }),
    environment,
    context,
  );
  assert.equal(archiveResponse.status, 200);
  assert.equal((await archiveResponse.json()).project.status, "archived");

  const blockedWriteResponse = await worker.fetch(
    new Request("http://localhost/api/project-documents", {
      method: "PATCH",
      headers: ownerHeaders,
      body: JSON.stringify({
        documentId: createdDocument.document.id,
        expectedVersion: 2,
        content: "Darf nicht gespeichert werden.",
      }),
    }),
    environment,
    context,
  );
  assert.equal(blockedWriteResponse.status, 409);
  assert.equal(
    (await blockedWriteResponse.json()).code,
    "PROJECT_ARCHIVED",
  );
  assert.equal(database.projectDocumentVersions.length, 2);

  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    return new Response(JSON.stringify({ output_text: "should not run" }));
  };
  try {
    const blockedRunResponse = await worker.fetch(
      new Request("http://localhost/api/team", {
        method: "POST",
        headers: ownerHeaders,
        body: JSON.stringify({
          message: "Nutze das archivierte Projekt.",
          projectId: createdProject.project.id,
          mode: "fast",
        }),
      }),
      { ...environment, OPENAI_API_KEY: "test-provider-key" },
      context,
    );
    assert.equal(blockedRunResponse.status, 409);
    assert.equal(
      (await blockedRunResponse.json()).code,
      "PROJECT_ARCHIVED",
    );
    assert.equal(providerCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("scopes, isolates, and revokes capability leases before provider use", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("leases", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const database = new MockD1();
  const environment = {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
    DB: database,
    TANKAI_ID_SALT: "test-salt-with-sufficient-entropy",
  };
  const context = {
    waitUntil() {},
    passThroughOnException() {},
  };
  const ownerHeaders = {
    "content-type": "application/json",
    "oai-authenticated-user-email": "owner@example.test",
  };
  const createProject = async (name) => {
    const response = await worker.fetch(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: ownerHeaders,
        body: JSON.stringify({ name }),
      }),
      environment,
      context,
    );
    assert.equal(response.status, 201);
    return (await response.json()).project;
  };
  const allowedProject = await createProject("Freigegebenes Projekt");
  const otherProject = await createProject("Nicht freigegebenes Projekt");

  const crossOriginLeaseResponse = await worker.fetch(
    new Request("http://localhost/api/capability-leases", {
      method: "POST",
      headers: {
        ...ownerHeaders,
        origin: "https://attacker.example",
      },
      body: JSON.stringify({
        capability: "model.run",
        mode: "fast",
        scope: "account",
        maxUses: 1,
        durationMinutes: 60,
      }),
    }),
    environment,
    context,
  );
  assert.equal(crossOriginLeaseResponse.status, 400);
  assert.equal(database.capabilityLeases.size, 0);

  const oversizedLeaseRequest = new Request(
    "http://localhost/api/capability-leases",
    {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({
        capability: "model.run",
        mode: "fast",
        scope: "account",
        maxUses: 1,
        durationMinutes: 60,
        padding: "x".repeat(8_100),
      }),
    },
  );
  assert.equal(oversizedLeaseRequest.headers.has("content-length"), false);
  const oversizedLeaseResponse = await worker.fetch(
    oversizedLeaseRequest,
    environment,
    context,
  );
  assert.equal(oversizedLeaseResponse.status, 400);
  assert.equal(
    (await oversizedLeaseResponse.json()).error,
    "Der Anfragekörper ist zu groß.",
  );
  assert.equal(database.capabilityLeases.size, 0);

  const leaseResponse = await worker.fetch(
    new Request("http://localhost/api/capability-leases", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({
        capability: "model.run",
        mode: "fast",
        scope: "project",
        projectId: allowedProject.id,
        maxUses: 2,
        durationMinutes: 60,
      }),
    }),
    environment,
    context,
  );
  const leaseBody = await leaseResponse.json();
  assert.equal(leaseResponse.status, 201);
  assert.equal(leaseBody.lease.scope, "project");
  assert.equal(leaseBody.lease.projectId, allowedProject.id);
  assert.equal(leaseBody.lease.remainingUses, 2);

  const otherUserLeases = await worker.fetch(
    new Request("http://localhost/api/capability-leases", {
      headers: {
        "oai-authenticated-user-email": "other@example.test",
      },
    }),
    environment,
    context,
  );
  assert.equal(otherUserLeases.status, 200);
  assert.deepEqual((await otherUserLeases.json()).leases, []);

  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    return new Response(JSON.stringify({ output_text: "must not run" }));
  };
  try {
    const wrongScopeResponse = await worker.fetch(
      new Request("http://localhost/api/team", {
        method: "POST",
        headers: ownerHeaders,
        body: JSON.stringify({
          message: "Darf diese Projektgrenze nicht überschreiten.",
          mode: "fast",
          projectId: otherProject.id,
          capabilityLeaseId: leaseBody.lease.id,
        }),
      }),
      { ...environment, OPENAI_API_KEY: "test-provider-key" },
      context,
    );
    assert.equal(wrongScopeResponse.status, 409);
    assert.equal(
      (await wrongScopeResponse.json()).code,
      "CAPABILITY_LEASE_UNAVAILABLE",
    );
    assert.equal(providerCalls, 0);
    assert.equal(
      database.capabilityLeases.get(leaseBody.lease.id)?.remainingUses,
      2,
    );
    assert.equal(database.conversations.size, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const revokeResponse = await worker.fetch(
    new Request("http://localhost/api/capability-leases", {
      method: "PATCH",
      headers: ownerHeaders,
      body: JSON.stringify({
        leaseId: leaseBody.lease.id,
        expectedVersion: 1,
      }),
    }),
    environment,
    context,
  );
  const revoked = await revokeResponse.json();
  assert.equal(revokeResponse.status, 200);
  assert.equal(revoked.lease.status, "revoked");
  assert.equal(revoked.lease.version, 2);
  assert.equal(
    database.capabilityLeaseEvents.some(
      (event) =>
        event.leaseId === leaseBody.lease.id && event.type === "revoked",
    ),
    true,
  );
});

test("runs the real planner-specialist-critic-synthesizer path with injected providers", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("team", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const database = new MockD1();
  const originalFetch = globalThis.fetch;
  const roles = [];
  const providerPayloads = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    const payload = JSON.parse(init.body);
    providerPayloads.push(JSON.stringify(payload));
    const instructions = String(payload.instructions);
    const role = instructions.match(/Teamrolle: ([a-z]+)/)?.[1] ?? "unknown";
    roles.push(role);
    const output =
      role === "planner"
        ? JSON.stringify({
            summary: "Technische Lösung mit Faktenprüfung",
            tasks: [
              {
                id: "build",
                role: "engineer",
                instruction: "Entwickle die belastbare Lösung.",
                successCriteria: ["funktioniert", "ist geprüft"],
              },
              {
                id: "check",
                role: "researcher",
                instruction: "Prüfe Fakten und Annahmen.",
                successCriteria: ["keine unbelegten Claims"],
              },
            ],
          })
        : role === "synthesizer"
          ? "Verifizierte Teamantwort."
          : `${role} hat den Auftrag geprüft.`;
    return new Response(JSON.stringify({ output_text: output }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const goalResponse = await worker.fetch(
      new Request("http://localhost/api/goals", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "owner@example.test",
        },
        body: JSON.stringify({
          title: "Wiederaufnehmbarer Technikauftrag",
          objective: "Die technische Lösung über mehrere Sitzungen fortführen.",
          definitionOfDone:
            "Der letzte bestätigte Schritt und die nächste sichere Aktion bleiben erhalten.",
        }),
      }),
      {
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
        DB: database,
        TANKAI_ID_SALT: "test-salt-with-sufficient-entropy",
      },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    );
    const goalBody = await goalResponse.json();
    assert.equal(goalResponse.status, 201);

    const projectResponse = await worker.fetch(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "owner@example.test",
        },
        body: JSON.stringify({
          name: "Verbindlicher Teamkontext",
          description: "Nur nutzereigene, versionierte Projektdaten.",
        }),
      }),
      {
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
        DB: database,
        TANKAI_ID_SALT: "test-salt-with-sufficient-entropy",
      },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    );
    const projectBody = await projectResponse.json();
    assert.equal(projectResponse.status, 201);

    const projectDocumentResponse = await worker.fetch(
      new Request("http://localhost/api/project-documents", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "owner@example.test",
        },
        body: JSON.stringify({
          projectId: projectBody.project.id,
          name: "auftrag.md",
          kind: "markdown",
          content:
            "Verbindlicher Architekturhinweis: Prüfe Migration 0003.",
        }),
      }),
      {
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
        DB: database,
        TANKAI_ID_SALT: "test-salt-with-sufficient-entropy",
      },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    );
    assert.equal(projectDocumentResponse.status, 201);

    const capabilityLeaseResponse = await worker.fetch(
      new Request("http://localhost/api/capability-leases", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "owner@example.test",
        },
        body: JSON.stringify({
          capability: "model.run",
          mode: "team",
          scope: "project",
          projectId: projectBody.project.id,
          maxUses: 1,
          durationMinutes: 60,
        }),
      }),
      {
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
        DB: database,
        TANKAI_ID_SALT: "test-salt-with-sufficient-entropy",
      },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    );
    const capabilityLeaseBody = await capabilityLeaseResponse.json();
    assert.equal(capabilityLeaseResponse.status, 201);
    assert.equal(capabilityLeaseBody.lease.status, "active");
    assert.equal(capabilityLeaseBody.lease.remainingUses, 1);

    const response = await worker.fetch(
      new Request("http://localhost/api/team", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "owner@example.test",
        },
        body: JSON.stringify({
          message: "Entwickle eine überprüfbare technische Lösung.",
          mode: "team",
          goalId: goalBody.goal.id,
          projectId: projectBody.project.id,
          capabilityLeaseId: capabilityLeaseBody.lease.id,
        }),
      }),
      {
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
        DB: database,
        TANKAI_ID_SALT: "test-salt-with-sufficient-entropy",
        OPENAI_API_KEY: "test-provider-key",
      },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.answer, "Verifizierte Teamantwort.");
    assert.equal(body.trace.modelCalls, 5);
    assert.equal(body.trace.promptVersion, "2.1.0");
    assert.equal(body.trace.receipt.state, "complete");
    assert.equal(body.trace.receipt.completedSteps, 5);
    assert.equal(body.trace.receipt.verification.executionObserved, true);
    assert.equal(body.trace.receipt.verification.factualClaimsVerified, false);
    assert.equal(body.trace.receipt.verification.benchmarkPassed, false);
    assert.equal(body.goal.id, goalBody.goal.id);
    assert.equal(body.project.id, projectBody.project.id);
    assert.equal(body.project.includedDocumentCount, 1);
    assert.deepEqual(body.project.omittedDocumentNames, []);
    assert.equal(body.authorization.capability, "model.run");
    assert.equal(body.authorization.consumed, true);
    assert.equal(
      providerPayloads.some((payload) =>
        payload.includes("Wiederaufnehmbarer Technikauftrag"),
      ),
      true,
    );
    assert.equal(
      providerPayloads.some(
        (payload) =>
          payload.includes("UNTRUSTED_PROJECT_CONTEXT_JSON") &&
          payload.includes(
            "Verbindlicher Architekturhinweis: Prüfe Migration 0003.",
          ),
      ),
      true,
    );
    assert.deepEqual(roles.sort(), [
      "critic",
      "engineer",
      "planner",
      "researcher",
      "synthesizer",
    ]);
    assert.equal(database.messages.length, 2);
    assert.equal(
      database.messages.some((message) =>
        message.content.includes("hat den Auftrag geprüft"),
      ),
      false,
    );
    assert.equal([...database.runs.values()][0]?.status, "completed");
    assert.equal([...database.runs.values()][0]?.goalId, goalBody.goal.id);
    assert.equal(
      [...database.runs.values()][0]?.projectId,
      projectBody.project.id,
    );
    assert.equal(
      database.goalEvents.some((event) => event.type === "run_started"),
      true,
    );
    assert.equal(
      database.projectEvents.some((event) => event.type === "run_started"),
      true,
    );
    assert.equal(
      database.projectEvents.some((event) => event.type === "run_completed"),
      true,
    );
    assert.equal(
      database.goalEvents.some((event) => event.type === "run_completed"),
      true,
    );
    assert.equal(
      database.capabilityLeases.get(capabilityLeaseBody.lease.id)?.status,
      "depleted",
    );
    assert.equal(
      database.capabilityLeaseEvents.some(
        (event) => event.type === "consumed" && event.runId === body.runId,
      ),
      true,
    );

    const replayResponse = await worker.fetch(
      new Request("http://localhost/api/team", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "owner@example.test",
        },
        body: JSON.stringify({
          message: "Versuche dieselbe Einmalfreigabe erneut.",
          mode: "team",
          projectId: projectBody.project.id,
          capabilityLeaseId: capabilityLeaseBody.lease.id,
        }),
      }),
      {
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
        DB: database,
        TANKAI_ID_SALT: "test-salt-with-sufficient-entropy",
        OPENAI_API_KEY: "test-provider-key",
      },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    );
    assert.equal(replayResponse.status, 409);
    assert.equal(
      (await replayResponse.json()).code,
      "CAPABILITY_LEASE_UNAVAILABLE",
    );
    assert.equal(roles.length, 5);

    const feedbackResponse = await worker.fetch(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "owner@example.test",
        },
        body: JSON.stringify({
          runId: body.runId,
          rating: -1,
          correction: "Die richtige Fassung muss die konkrete Quelle nennen.",
        }),
      }),
      {
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
        DB: database,
        TANKAI_ID_SALT: "test-salt-with-sufficient-entropy",
      },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    );
    const feedbackBody = await feedbackResponse.json();
    assert.equal(feedbackResponse.status, 201);
    assert.equal(feedbackBody.saved, true);
    assert.match(feedbackBody.learningCaseId, /^[0-9a-f-]{36}$/i);
    assert.equal(database.feedback.length, 1);
    assert.equal(database.learningCases.length, 1);

    const improvementResponse = await worker.fetch(
      new Request("http://localhost/api/improvement", {
        headers: {
          "oai-authenticated-user-email": "owner@example.test",
        },
      }),
      {
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
        DB: database,
        TANKAI_ID_SALT: "test-salt-with-sufficient-entropy",
      },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    );
    const improvementBody = await improvementResponse.json();
    assert.equal(improvementResponse.status, 200);
    assert.equal(improvementBody.signals.negative, 1);
    assert.equal(improvementBody.signals.corrections, 1);
    assert.equal(improvementBody.queue.queued, 1);
    assert.equal(improvementBody.policy.automaticPromptMutation, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("blocks and promotes candidates through the executable TankBench gate", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("promotion", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const fingerprint = "a".repeat(64);
  const baseline = {
    systemVersion: "baseline-1",
    datasetFingerprint: fingerprint,
    caseCount: 100,
    repeatedRuns: 2,
    criticalSafetyViolations: 0,
    taskSuccessRate: 0.8,
    failureRate: 0.08,
    p95LatencyMs: 1000,
    averageCostUsd: 0.02,
    scores: {
      goalCompletion: 0.8,
      factuality: 0.8,
      execution: 0.8,
      codeQuality: 0.8,
      recovery: 0.8,
      memory: 0.8,
      safety: 0.9,
      efficiency: 0.7,
    },
  };
  const candidate = {
    ...baseline,
    systemVersion: "candidate-2",
    taskSuccessRate: 0.86,
    failureRate: 0.05,
    p95LatencyMs: 1100,
    averageCostUsd: 0.022,
    scores: Object.fromEntries(
      Object.entries(baseline.scores).map(([key, value]) => [
        key,
        Math.min(1, value + 0.05),
      ]),
    ),
  };
  const environment = {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
    TANKAI_ID_SALT: "test-salt-with-sufficient-entropy",
  };
  const context = {
    waitUntil() {},
    passThroughOnException() {},
  };
  const request = (body) =>
    new Request("http://localhost/api/benchmark/promotion", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "oai-authenticated-user-email": "owner@example.test",
      },
      body: JSON.stringify(body),
    });

  const promotedResponse = await worker.fetch(
    request({ baseline, candidate }),
    environment,
    context,
  );
  const promoted = await promotedResponse.json();
  assert.equal(promotedResponse.status, 200);
  assert.equal(promoted.decision, "promote");
  assert.equal(promoted.gates.every((gate) => gate.passed), true);

  const unsafeResponse = await worker.fetch(
    request({
      baseline,
      candidate: { ...candidate, criticalSafetyViolations: 1 },
    }),
    environment,
    context,
  );
  const unsafe = await unsafeResponse.json();
  assert.equal(unsafeResponse.status, 200);
  assert.equal(unsafe.decision, "block");
  assert.equal(
    unsafe.gates.find((gate) => gate.id === "critical-safety")?.passed,
    false,
  );
});
