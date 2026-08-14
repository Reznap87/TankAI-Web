"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandMark, PlusIcon } from "@/app/ui";

type TeamMode = "fast" | "team" | "deep";

interface ProviderInfo {
  id: string;
  family: string;
  name: string;
  model: string;
}

interface ProviderCandidate {
  id: string;
  name: string;
  state: "ready" | "blocked";
  missing: string[];
}

interface StatusResponse {
  release: string;
  promptVersion: string;
  modelAccess: "active" | "not-configured";
  providers: ProviderInfo[];
  modelMesh: {
    providerCount: number;
    familyCount: number;
    teamReady: boolean;
    independentReviewReady: boolean;
    candidates: ProviderCandidate[];
  };
  memory: {
    durable: true;
    types: Array<"episodic" | "semantic" | "procedural">;
    embeddingModel: string;
    feedbackPromotion: true;
    retention: Array<"hot" | "warm" | "cold" | "deleted">;
  };
  capabilityLeases: {
    durable: true;
    requiredForModelRuns: true;
    immutableEvents: true;
    maximumDurationMinutes: number;
    maximumUses: number;
    scopes: Array<"account" | "project">;
  };
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  runId?: string | null;
  pending?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface AgentTrace {
  taskId: string;
  role: string;
  providerName: string;
  model: string;
  status: "completed" | "failed";
  latencyMs: number;
}

interface TeamTrace {
  promptVersion: string;
  modelCalls: number;
  providerFamilies: string[];
  degraded: boolean;
  elapsedMs: number;
  agents: AgentTrace[];
  reviewers: AgentTrace[];
  synthesizer?: AgentTrace;
  receipt: {
    version: string;
    state: "complete" | "degraded";
    attemptedSteps: number;
    completedSteps: number;
    failedSteps: number;
    completedCriticChecks: number;
    independentProviderReview: boolean;
    verification: {
      executionObserved: true;
      factualClaimsVerified: false;
      benchmarkPassed: false;
    };
    warnings: string[];
  };
}

interface TeamResponse {
  runId: string;
  conversationId: string;
  answer: string;
  trace: TeamTrace;
  memory: {
    embeddingModel: string;
    recalled: number;
    stored: {
      episodic: number;
      semantic: number;
      procedural: number;
    } | null;
    warnings: string[];
  };
  authorization: {
    capability: "model.run";
    leaseId: string;
    consumed: true;
  };
  goal?: {
    id: string;
    version: number;
    status: GoalStatus;
  };
  project?: {
    id: string;
    version: number;
    contentRevision: number;
    includedDocumentCount: number;
    omittedDocumentNames: string[];
  };
}

interface HistoryResponse {
  conversations: Conversation[];
  active: {
    conversation: Conversation;
    messages: Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      runId: string | null;
    }>;
  } | null;
}

interface ImprovementResponse {
  policy: {
    version: string;
    mode: "promotion-gated";
    automaticWeightMutation: false;
    automaticPromptMutation: false;
    minimumEvalCases: number;
  };
  signals: {
    total: number;
    positive: number;
    negative: number;
    corrections: number;
  };
  queue: {
    queued: number;
    included: number;
    dismissed: number;
  };
}

type GoalStatus =
  | "draft"
  | "planned"
  | "ready"
  | "running"
  | "waiting"
  | "verifying"
  | "completed"
  | "failed"
  | "cancelled";

interface GoalRecord {
  id: string;
  title: string;
  objective: string;
  definitionOfDone: string;
  status: GoalStatus;
  progressPercent: number;
  currentStep: string | null;
  nextAction: string | null;
  version: number;
  updatedAt: string;
}

interface GoalEvent {
  id: string;
  type: string;
  note: string | null;
  goalVersion: number;
  createdAt: string;
}

interface GoalsResponse {
  goals: GoalRecord[];
  active: {
    goal: GoalRecord;
    events: GoalEvent[];
  } | null;
}

interface GoalForm {
  title: string;
  objective: string;
  definitionOfDone: string;
}

interface GoalUpdateForm {
  status: GoalStatus;
  progressPercent: string;
  currentStep: string;
  nextAction: string;
  note: string;
}

type ProjectStatus = "active" | "archived";
type ProjectDocumentKind = "markdown" | "text" | "json" | "csv";

interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  version: number;
  contentRevision: number;
  documentCount: number;
  updatedAt: string;
}

interface ProjectDocumentSummary {
  id: string;
  projectId: string;
  name: string;
  kind: ProjectDocumentKind;
  contentSha256: string;
  sizeBytes: number;
  version: number;
  updatedAt: string;
}

interface ProjectDocumentRecord extends ProjectDocumentSummary {
  content: string;
}

interface ProjectDocumentVersion {
  id: string;
  version: number;
  contentSha256: string;
  sizeBytes: number;
  changeNote: string | null;
  createdAt: string;
}

interface ProjectEvent {
  id: string;
  type: string;
  documentId: string | null;
  projectVersion: number;
  documentVersion: number | null;
  note: string | null;
  createdAt: string;
}

interface ProjectsResponse {
  projects: ProjectRecord[];
  active: {
    project: ProjectRecord;
    documents: ProjectDocumentSummary[];
    events: ProjectEvent[];
    document: {
      current: ProjectDocumentRecord;
      versions: ProjectDocumentVersion[];
    } | null;
  } | null;
}

interface ProjectForm {
  name: string;
  description: string;
}

interface ProjectDocumentForm {
  id?: string;
  expectedVersion?: number;
  name: string;
  kind: ProjectDocumentKind;
  content: string;
  changeNote: string;
}

type CapabilityLeaseStatus =
  | "active"
  | "revoked"
  | "depleted"
  | "expired";

interface CapabilityLease {
  id: string;
  capability: "model.run";
  mode: TeamMode;
  scope: "account" | "project";
  projectId: string | null;
  projectName: string | null;
  status: CapabilityLeaseStatus;
  maxUses: number;
  remainingUses: number;
  version: number;
  expiresAt: string;
  lastUsedAt: string | null;
}

interface CapabilityLeasesResponse {
  leases: CapabilityLease[];
}

const goalLabels: Record<GoalStatus, string> = {
  draft: "Entwurf",
  planned: "Geplant",
  ready: "Bereit",
  running: "In Arbeit",
  waiting: "Wartet",
  verifying: "Wird geprüft",
  completed: "Abgeschlossen",
  failed: "Fehlgeschlagen",
  cancelled: "Abgebrochen",
};

const goalTransitions: Record<GoalStatus, GoalStatus[]> = {
  draft: ["planned", "cancelled"],
  planned: ["draft", "ready", "cancelled"],
  ready: ["planned", "running", "cancelled"],
  running: ["waiting", "verifying", "failed", "cancelled"],
  waiting: ["running", "failed", "cancelled"],
  verifying: ["running", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

const emptyGoalForm: GoalForm = {
  title: "",
  objective: "",
  definitionOfDone: "",
};

const emptyProjectForm: ProjectForm = {
  name: "",
  description: "",
};

const emptyProjectDocumentForm: ProjectDocumentForm = {
  name: "projekt-notizen.md",
  kind: "markdown",
  content: "",
  changeNote: "",
};

const modes: Array<{
  id: TeamMode;
  label: string;
  calls: string;
  description: string;
}> = [
  {
    id: "fast",
    label: "Schnell",
    calls: "1 Call",
    description: "Direkte Antwort mit dem stärksten passenden Modell.",
  },
  {
    id: "team",
    label: "Team",
    calls: "bis 5",
    description: "Planner, Spezialisten, Critic und Endredaktion.",
  },
  {
    id: "deep",
    label: "Tief",
    calls: "bis 7",
    description: "Mehr Spezialisten und zwei unabhängige Gegenprüfungen.",
  },
];

function initials(value: string): string {
  const parts = value.trim().split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return "TA";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatTime(milliseconds: number): string {
  return milliseconds >= 1_000
    ? `${(milliseconds / 1_000).toFixed(1)} s`
    : `${milliseconds} ms`;
}

function friendlyRole(role: string): string {
  return (
    {
      planner: "Planner",
      general: "General",
      researcher: "Research",
      engineer: "Engineering",
      creative: "Creative",
      music: "Music",
      critic: "Critic",
      synthesizer: "Synthesizer",
    }[role] ?? role
  );
}

function matchingCapabilityLease(
  leases: CapabilityLease[],
  mode: TeamMode,
  projectId?: string,
): CapabilityLease | undefined {
  const timestamp = Date.now();
  return leases.find(
    (lease) =>
      lease.capability === "model.run" &&
      lease.mode === mode &&
      lease.status === "active" &&
      lease.remainingUses > 0 &&
      Date.parse(lease.expiresAt) > timestamp &&
      (lease.scope === "account" ||
        (Boolean(projectId) && lease.projectId === projectId)),
  );
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error || "TankAI konnte die Anfrage nicht abschließen.");
  }
  return body;
}

export default function ChatClient({
  displayName,
  signOutPath,
}: {
  displayName: string;
  signOutPath: string;
}) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<TeamMode>("team");
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trace, setTrace] = useState<TeamTrace | null>(null);
  const [runMemory, setRunMemory] = useState<TeamResponse["memory"] | null>(null);
  const [feedbackRun, setFeedbackRun] = useState<string | null>(null);
  const [correction, setCorrection] = useState("");
  const [feedbackSaved, setFeedbackSaved] = useState<Set<string>>(new Set());
  const [improvement, setImprovement] =
    useState<ImprovementResponse | null>(null);
  const [goals, setGoals] = useState<GoalRecord[]>([]);
  const [activeGoal, setActiveGoal] = useState<GoalRecord | null>(null);
  const [goalEvents, setGoalEvents] = useState<GoalEvent[]>([]);
  const [goalLoading, setGoalLoading] = useState(false);
  const [goalEditor, setGoalEditor] = useState<"create" | "update" | null>(
    null,
  );
  const [goalForm, setGoalForm] = useState<GoalForm>(emptyGoalForm);
  const [goalUpdateForm, setGoalUpdateForm] =
    useState<GoalUpdateForm | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProject, setActiveProject] =
    useState<ProjectRecord | null>(null);
  const [projectDocuments, setProjectDocuments] = useState<
    ProjectDocumentSummary[]
  >([]);
  const [projectEvents, setProjectEvents] = useState<ProjectEvent[]>([]);
  const [activeProjectDocument, setActiveProjectDocument] =
    useState<ProjectDocumentRecord | null>(null);
  const [projectDocumentVersions, setProjectDocumentVersions] = useState<
    ProjectDocumentVersion[]
  >([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectEditor, setProjectEditor] = useState<
    "create" | "manage" | null
  >(null);
  const [projectForm, setProjectForm] =
    useState<ProjectForm>(emptyProjectForm);
  const [projectDocumentEditor, setProjectDocumentEditor] =
    useState<"create" | "update" | null>(null);
  const [projectDocumentForm, setProjectDocumentForm] =
    useState<ProjectDocumentForm>(emptyProjectDocumentForm);
  const [capabilityLeases, setCapabilityLeases] = useState<
    CapabilityLease[]
  >([]);
  const [leaseLoading, setLeaseLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async (selectedId?: string) => {
    const query = selectedId
      ? `?conversationId=${encodeURIComponent(selectedId)}`
      : "";
    const history = await responseJson<HistoryResponse>(
      await fetch(`/api/history${query}`, { cache: "no-store" }),
    );
    setConversations(history.conversations);
    setConversationId(history.active?.conversation.id);
    setMessages(
      history.active?.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        runId: message.runId,
      })) ?? [],
    );
  }, []);

  const loadImprovement = useCallback(async () => {
    const result = await responseJson<ImprovementResponse>(
      await fetch("/api/improvement", { cache: "no-store" }),
    );
    setImprovement(result);
  }, []);

  const loadGoals = useCallback(async (selectedId?: string) => {
    const query = selectedId
      ? `?goalId=${encodeURIComponent(selectedId)}`
      : "";
    const result = await responseJson<GoalsResponse>(
      await fetch(`/api/goals${query}`, { cache: "no-store" }),
    );
    setGoals(result.goals);
    setActiveGoal(result.active?.goal ?? null);
    setGoalEvents(result.active?.events ?? []);
  }, []);

  const loadProjects = useCallback(
    async (selectedId?: string, documentId?: string) => {
      const parameters = new URLSearchParams();
      if (selectedId) parameters.set("projectId", selectedId);
      if (documentId) parameters.set("documentId", documentId);
      const query = parameters.size ? `?${parameters.toString()}` : "";
      const result = await responseJson<ProjectsResponse>(
        await fetch(`/api/projects${query}`, { cache: "no-store" }),
      );
      setProjects(result.projects);
      setActiveProject(result.active?.project ?? null);
      setProjectDocuments(result.active?.documents ?? []);
      setProjectEvents(result.active?.events ?? []);
      setActiveProjectDocument(result.active?.document?.current ?? null);
      setProjectDocumentVersions(result.active?.document?.versions ?? []);
      return result;
    },
    [],
  );

  const loadCapabilityLeases = useCallback(async () => {
    const result = await responseJson<CapabilityLeasesResponse>(
      await fetch("/api/capability-leases", { cache: "no-store" }),
    );
    setCapabilityLeases(result.leases);
    return result;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const [runtimeStatus] = await Promise.all([
          responseJson<StatusResponse>(
            await fetch("/api/status", { cache: "no-store" }),
          ),
          loadHistory(),
          loadImprovement(),
          loadGoals(),
          loadProjects(),
          loadCapabilityLeases(),
        ]);
        if (!cancelled) setStatus(runtimeStatus);
      } catch (initialError) {
        if (!cancelled) {
          setError(
            initialError instanceof Error
              ? initialError.message
              : "TankAI konnte nicht geladen werden.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [
    loadCapabilityLeases,
    loadGoals,
    loadHistory,
    loadImprovement,
    loadProjects,
  ]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, working]);

  async function sendMessage() {
    const message = draft.trim();
    if (!message || working || status?.modelAccess !== "active") return;
    const capabilityLease = matchingCapabilityLease(
      capabilityLeases,
      mode,
      activeProject?.id,
    );
    if (!capabilityLease) {
      setError(
        "Erteile zuerst eine aktive Ausführungsfreigabe für diesen Modus und Projektbereich.",
      );
      return;
    }
    const optimisticId = `local-${Date.now()}`;
    setDraft("");
    setError(null);
    setTrace(null);
    setRunMemory(null);
    setWorking(true);
    setMessages((current) => [
      ...current,
      {
        id: optimisticId,
        role: "user",
        content: message,
        pending: true,
      },
    ]);
    try {
      const result = await responseJson<TeamResponse>(
        await fetch("/api/team", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message,
            mode,
            ...(conversationId ? { conversationId } : {}),
            ...(activeGoal ? { goalId: activeGoal.id } : {}),
            ...(activeProject ? { projectId: activeProject.id } : {}),
            capabilityLeaseId: capabilityLease.id,
          }),
        }),
      );
      setConversationId(result.conversationId);
      setTrace(result.trace);
      setRunMemory(result.memory);
      setMessages((current) => [
        ...current.map((item) =>
          item.id === optimisticId ? { ...item, pending: false } : item,
        ),
        {
          id: `answer-${result.runId}`,
          role: "assistant",
          content: result.answer,
          runId: result.runId,
        },
      ]);
      await Promise.all([
        loadHistory(result.conversationId),
        ...(activeGoal ? [loadGoals(activeGoal.id)] : []),
        ...(activeProject ? [loadProjects(activeProject.id)] : []),
      ]);
    } catch (requestError) {
      setMessages((current) =>
        current.map((item) =>
          item.id === optimisticId ? { ...item, pending: false } : item,
        ),
      );
      setError(
        requestError instanceof Error
          ? requestError.message
          : "TankAI konnte die Anfrage nicht abschließen.",
      );
    } finally {
      try {
        await loadCapabilityLeases();
      } catch {
        // Die Laufantwort bleibt maßgeblich; der Freigabestand wird beim nächsten Laden erneuert.
      }
      setWorking(false);
    }
  }

  async function sendFeedback(runId: string, rating: -1 | 1) {
    try {
      await responseJson<{ saved: true }>(
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            runId,
            rating,
            ...(rating === -1 && correction.trim()
              ? { correction: correction.trim() }
              : {}),
          }),
        }),
      );
      setFeedbackSaved((current) => new Set(current).add(runId));
      setFeedbackRun(null);
      setCorrection("");
      await loadImprovement();
    } catch (feedbackError) {
      setError(
        feedbackError instanceof Error
          ? feedbackError.message
          : "Das Feedback konnte nicht gespeichert werden.",
      );
    }
  }

  async function selectGoal(goalId: string) {
    if (activeGoal?.id === goalId) {
      setActiveGoal(null);
      setGoalEvents([]);
      return;
    }
    setGoalLoading(true);
    setError(null);
    try {
      await loadGoals(goalId);
    } catch (goalError) {
      setError(
        goalError instanceof Error
          ? goalError.message
          : "Das Ziel konnte nicht geladen werden.",
      );
    } finally {
      setGoalLoading(false);
    }
  }

  function openGoalCreate() {
    setGoalForm(emptyGoalForm);
    setGoalEditor("create");
  }

  function openGoalUpdate() {
    if (!activeGoal) return;
    setGoalUpdateForm({
      status: activeGoal.status,
      progressPercent: String(activeGoal.progressPercent),
      currentStep: activeGoal.currentStep ?? "",
      nextAction: activeGoal.nextAction ?? "",
      note: "",
    });
    setGoalEditor("update");
  }

  async function createNewGoal() {
    setGoalLoading(true);
    setError(null);
    try {
      const result = await responseJson<{ goal: GoalRecord; created: true }>(
        await fetch("/api/goals", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(goalForm),
        }),
      );
      setGoalEditor(null);
      setGoalForm(emptyGoalForm);
      await loadGoals(result.goal.id);
    } catch (goalError) {
      setError(
        goalError instanceof Error
          ? goalError.message
          : "Das Ziel konnte nicht angelegt werden.",
      );
    } finally {
      setGoalLoading(false);
    }
  }

  async function saveGoalProgress() {
    if (!activeGoal || !goalUpdateForm) return;
    setGoalLoading(true);
    setError(null);
    try {
      await responseJson<{ goal: GoalRecord; updated: true }>(
        await fetch("/api/goals", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            goalId: activeGoal.id,
            expectedVersion: activeGoal.version,
            status: goalUpdateForm.status,
            progressPercent: Number(goalUpdateForm.progressPercent),
            currentStep: goalUpdateForm.currentStep,
            nextAction: goalUpdateForm.nextAction,
            ...(goalUpdateForm.note.trim()
              ? { note: goalUpdateForm.note.trim() }
              : {}),
          }),
        }),
      );
      setGoalEditor(null);
      setGoalUpdateForm(null);
      await loadGoals(activeGoal.id);
    } catch (goalError) {
      setError(
        goalError instanceof Error
          ? goalError.message
          : "Der Zielstand konnte nicht gespeichert werden.",
      );
    } finally {
      setGoalLoading(false);
    }
  }

  async function selectProject(projectId: string) {
    if (activeProject?.id === projectId) {
      setActiveProject(null);
      setProjectDocuments([]);
      setProjectEvents([]);
      setActiveProjectDocument(null);
      setProjectDocumentVersions([]);
      return;
    }
    setProjectLoading(true);
    setError(null);
    try {
      await loadProjects(projectId);
    } catch (projectError) {
      setError(
        projectError instanceof Error
          ? projectError.message
          : "Der Projektbereich konnte nicht geladen werden.",
      );
    } finally {
      setProjectLoading(false);
    }
  }

  function openProjectCreate() {
    setProjectForm(emptyProjectForm);
    setProjectEditor("create");
  }

  function openProjectManage() {
    if (!activeProject) return;
    setProjectForm({
      name: activeProject.name,
      description: activeProject.description,
    });
    setProjectEditor("manage");
  }

  async function createNewProject() {
    setProjectLoading(true);
    setError(null);
    try {
      const result = await responseJson<{
        project: ProjectRecord;
        created: true;
      }>(
        await fetch("/api/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(projectForm),
        }),
      );
      setProjectEditor(null);
      setProjectForm(emptyProjectForm);
      await loadProjects(result.project.id);
    } catch (projectError) {
      setError(
        projectError instanceof Error
          ? projectError.message
          : "Der Projektbereich konnte nicht angelegt werden.",
      );
    } finally {
      setProjectLoading(false);
    }
  }

  async function saveProjectDetails() {
    if (!activeProject) return;
    setProjectLoading(true);
    setError(null);
    try {
      const result = await responseJson<{
        project: ProjectRecord;
        updated: true;
      }>(
        await fetch("/api/projects", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectId: activeProject.id,
            expectedVersion: activeProject.version,
            name: projectForm.name,
            description: projectForm.description,
            note: "Projektangaben aktualisiert.",
          }),
        }),
      );
      setProjectForm({
        name: result.project.name,
        description: result.project.description,
      });
      await loadProjects(result.project.id);
    } catch (projectError) {
      setError(
        projectError instanceof Error
          ? projectError.message
          : "Der Projektbereich konnte nicht aktualisiert werden.",
      );
    } finally {
      setProjectLoading(false);
    }
  }

  async function changeProjectStatus(status: ProjectStatus) {
    if (!activeProject) return;
    setProjectLoading(true);
    setError(null);
    try {
      const result = await responseJson<{
        project: ProjectRecord;
        updated: true;
      }>(
        await fetch("/api/projects", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectId: activeProject.id,
            expectedVersion: activeProject.version,
            status,
            note:
              status === "archived"
                ? "Projektbereich archiviert."
                : "Projektbereich wiederhergestellt.",
          }),
        }),
      );
      await loadProjects(result.project.id);
    } catch (projectError) {
      setError(
        projectError instanceof Error
          ? projectError.message
          : "Der Projektstatus konnte nicht geändert werden.",
      );
    } finally {
      setProjectLoading(false);
    }
  }

  function openProjectDocumentCreate() {
    if (!activeProject || activeProject.status === "archived") return;
    setProjectDocumentForm(emptyProjectDocumentForm);
    setProjectEditor(null);
    setProjectDocumentEditor("create");
  }

  async function openProjectDocument(documentId: string) {
    if (!activeProject) return;
    setProjectLoading(true);
    setError(null);
    try {
      const result = await loadProjects(activeProject.id, documentId);
      const document = result.active?.document?.current;
      if (!document) throw new Error("Die Projektdatei wurde nicht gefunden.");
      setProjectDocumentForm({
        id: document.id,
        expectedVersion: document.version,
        name: document.name,
        kind: document.kind,
        content: document.content,
        changeNote: "",
      });
      setProjectEditor(null);
      setProjectDocumentEditor("update");
    } catch (projectError) {
      setError(
        projectError instanceof Error
          ? projectError.message
          : "Die Projektdatei konnte nicht geladen werden.",
      );
    } finally {
      setProjectLoading(false);
    }
  }

  async function saveProjectDocument() {
    if (!activeProject) return;
    setProjectLoading(true);
    setError(null);
    try {
      if (projectDocumentEditor === "create") {
        const result = await responseJson<{
          document: ProjectDocumentRecord;
          created: true;
        }>(
          await fetch("/api/project-documents", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              projectId: activeProject.id,
              name: projectDocumentForm.name,
              kind: projectDocumentForm.kind,
              content: projectDocumentForm.content,
              ...(projectDocumentForm.changeNote.trim()
                ? { changeNote: projectDocumentForm.changeNote.trim() }
                : {}),
            }),
          }),
        );
        await loadProjects(activeProject.id, result.document.id);
      } else {
        const result = await responseJson<{
          document: ProjectDocumentRecord;
          updated: true;
        }>(
          await fetch("/api/project-documents", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              documentId: projectDocumentForm.id,
              expectedVersion: projectDocumentForm.expectedVersion,
              name: projectDocumentForm.name,
              kind: projectDocumentForm.kind,
              content: projectDocumentForm.content,
              ...(projectDocumentForm.changeNote.trim()
                ? { changeNote: projectDocumentForm.changeNote.trim() }
                : {}),
            }),
          }),
        );
        await loadProjects(activeProject.id, result.document.id);
      }
      setProjectDocumentEditor(null);
    } catch (projectError) {
      setError(
        projectError instanceof Error
          ? projectError.message
          : "Die Projektdatei konnte nicht gespeichert werden.",
      );
    } finally {
      setProjectLoading(false);
    }
  }

  async function grantModelRunCapability() {
    if (activeProject?.status === "archived") return;
    setLeaseLoading(true);
    setError(null);
    try {
      await responseJson<{ lease: CapabilityLease; created: true }>(
        await fetch("/api/capability-leases", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            capability: "model.run",
            mode,
            scope: activeProject ? "project" : "account",
            ...(activeProject ? { projectId: activeProject.id } : {}),
            maxUses: 1,
            durationMinutes: 60,
          }),
        }),
      );
      await loadCapabilityLeases();
    } catch (leaseError) {
      setError(
        leaseError instanceof Error
          ? leaseError.message
          : "Die Ausführungsfreigabe konnte nicht erteilt werden.",
      );
    } finally {
      setLeaseLoading(false);
    }
  }

  async function revokeModelRunCapability(lease: CapabilityLease) {
    setLeaseLoading(true);
    setError(null);
    try {
      await responseJson<{ lease: CapabilityLease; revoked: true }>(
        await fetch("/api/capability-leases", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leaseId: lease.id,
            expectedVersion: lease.version,
          }),
        }),
      );
      await loadCapabilityLeases();
    } catch (leaseError) {
      setError(
        leaseError instanceof Error
          ? leaseError.message
          : "Die Ausführungsfreigabe konnte nicht widerrufen werden.",
      );
    } finally {
      setLeaseLoading(false);
    }
  }

  function newConversation() {
    setConversationId(undefined);
    setMessages([]);
    setTrace(null);
    setError(null);
  }

  const providerReady = status?.modelAccess === "active";
  const independentMeshReady =
    providerReady && status?.modelMesh.independentReviewReady;
  const goalTerminal =
    activeGoal?.status === "completed" ||
    activeGoal?.status === "failed" ||
    activeGoal?.status === "cancelled";
  const projectArchived = activeProject?.status === "archived";
  const contextBlocked = goalTerminal || projectArchived;
  const activeCapabilityLease = matchingCapabilityLease(
    capabilityLeases,
    mode,
    activeProject?.id,
  );
  const capabilityBlocked = !activeCapabilityLease;

  return (
    <div className="workspace">
      <aside className="conversation-sidebar">
        <Link className="brand app-brand" href="/">
          <BrandMark />
          <span>TANK<span>AI</span></span>
        </Link>
        <button className="new-chat-button" type="button" onClick={newConversation}>
          <PlusIcon /> Neuer Auftrag
        </button>
        <div className="sidebar-section-heading">
          <span>PROJEKTE</span>
          <button type="button" onClick={openProjectCreate}>
            <PlusIcon /> Neu
          </button>
        </div>
        <div className="project-list" aria-label="Projektbereiche">
          {projects.map((project) => (
            <button
              key={project.id}
              className={project.id === activeProject?.id ? "active" : ""}
              type="button"
              aria-pressed={project.id === activeProject?.id}
              onClick={() => void selectProject(project.id)}
            >
              <span>{project.name}</span>
              <small>
                {project.status === "archived" ? "Archiv" : "Aktiv"} ·{" "}
                {project.documentCount}{" "}
                {project.documentCount === 1 ? "Datei" : "Dateien"}
              </small>
            </button>
          ))}
          {!loading && projects.length === 0 ? (
            <p className="empty-projects">Noch kein Projektbereich.</p>
          ) : null}
        </div>
        <div className="sidebar-section-heading">
          <span>ZIELE</span>
          <button type="button" onClick={openGoalCreate}>
            <PlusIcon /> Neu
          </button>
        </div>
        <div className="goal-list" aria-label="Langlebige Ziele">
          {goals.map((goal) => (
            <button
              key={goal.id}
              className={goal.id === activeGoal?.id ? "active" : ""}
              type="button"
              aria-pressed={goal.id === activeGoal?.id}
              onClick={() => void selectGoal(goal.id)}
            >
              <span>{goal.title}</span>
              <small>
                {goalLabels[goal.status]} · {goal.progressPercent} %
              </small>
              <i aria-hidden="true">
                <b style={{ width: `${goal.progressPercent}%` }} />
              </i>
            </button>
          ))}
          {!loading && goals.length === 0 ? (
            <p className="empty-goals">
              Noch kein langlebiges Ziel.
            </p>
          ) : null}
        </div>
        <div className="sidebar-label history-label">VERLAUF</div>
        <div className="conversation-list">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={conversation.id === conversationId ? "active" : ""}
              type="button"
              onClick={() => {
                setLoading(true);
                setError(null);
                void loadHistory(conversation.id)
                  .catch((historyError) =>
                    setError(
                      historyError instanceof Error
                        ? historyError.message
                        : "Verlauf konnte nicht geladen werden.",
                    ),
                  )
                  .finally(() => setLoading(false));
              }}
            >
              <span>{conversation.title}</span>
              <small>
                {new Date(conversation.updatedAt).toLocaleDateString("de-DE")}
              </small>
            </button>
          ))}
          {!loading && conversations.length === 0 ? (
            <p className="empty-history">Noch keine Unterhaltung.</p>
          ) : null}
        </div>
        <div className="sidebar-account">
          <span className="avatar">{initials(displayName)}</span>
          <div>
            <strong>{displayName}</strong>
            <a href={signOutPath}>Abmelden</a>
          </div>
        </div>
      </aside>

      <section className="chat-workspace">
        <header className="workspace-header">
          <div>
            <span className={`status-light ${providerReady ? "ready" : ""}`} />
            <strong>
              {independentMeshReady
                ? "MODEL MESH AKTIV"
                : providerReady
                  ? "MODELLKERN AKTIV · ZWEITE FAMILIE FEHLT"
                  : "SESSION ACTIVE · MODELLZUGANG FEHLT"}
            </strong>
          </div>
          <div className="release-meta">
            <span>WEB {status?.release ?? "0.43.0"}</span>
            <span>PROMPT {status?.promptVersion ?? "2.1.0"}</span>
          </div>
        </header>

        <div className="message-stage" aria-live="polite">
          {loading ? (
            <div className="loading-state">
              <BrandMark />
              <span>TankAI lädt den Projektzustand …</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="welcome-state">
              <p className="eyebrow">COMMANDER BEREIT</p>
              <h1>Was soll entstehen?</h1>
              <p>
                Gib TankAI das Ziel. Im Teammodus zerlegt der Commander den
                Auftrag, führt Spezialisten und lässt das Ergebnis gegenprüfen.
              </p>
              <div className="starter-grid">
                {[
                  "Prüfe meine Idee hart und entwickle sie bis zum umsetzbaren Konzept.",
                  "Analysiere dieses technische Problem und liefere eine getestete Lösung.",
                  "Plane ein größeres Projekt mit klarer Definition of Done.",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setDraft(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((message) => (
                <article
                  className={`message ${message.role}`}
                  key={message.id}
                >
                  <div className="message-author">
                    {message.role === "assistant" ? (
                      <BrandMark />
                    ) : (
                      <span className="avatar small">{initials(displayName)}</span>
                    )}
                    <strong>
                      {message.role === "assistant" ? "TANKAI" : "DU"}
                    </strong>
                    {message.pending ? <small>wird gesendet</small> : null}
                  </div>
                  <div className="message-content">{message.content}</div>
                  {message.role === "assistant" && message.runId ? (
                    <div className="message-feedback">
                      {feedbackSaved.has(message.runId) ? (
                        <span>Feedback gespeichert</span>
                      ) : (
                        <>
                          <span>Hilfreich?</span>
                          <button
                            type="button"
                            aria-label="Antwort war hilfreich"
                            onClick={() => void sendFeedback(message.runId!, 1)}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            aria-label="Antwort braucht Korrektur"
                            onClick={() => setFeedbackRun(message.runId!)}
                          >
                            −
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </article>
              ))}
              {working ? (
                <article className="message assistant working-message">
                  <div className="message-author">
                    <BrandMark />
                    <strong>TANKAI TEAM</strong>
                  </div>
                  <div className="team-pulse">
                    <i /><i /><i />
                    <span>plant, verteilt und prüft …</span>
                  </div>
                </article>
              ) : null}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {error ? (
          <div className="app-error" role="alert">
            <strong>NICHT ABGESCHLOSSEN</strong>
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)}>Schließen</button>
          </div>
        ) : null}

        {!providerReady && status ? (
          <div className="provider-gate">
            <strong>Der Webkern ist produktiv, aber noch kein Provider-Secret aktiviert.</strong>
            <span>
              Deshalb bleibt die Eingabe gesperrt: TankAI erzeugt ausdrücklich
              keine feste Demo- oder Scheinantwort.
            </span>
          </div>
        ) : null}

        <div className="composer-zone">
          {activeProject ? (
            <div
              className={`project-context-bar ${projectArchived ? "archived" : ""}`}
            >
              <div>
                <span>
                  PROJEKTKONTEXT ·{" "}
                  {projectArchived ? "ARCHIVIERT" : "AKTIV"} ·{" "}
                  REVISION {activeProject.contentRevision}
                </span>
                <strong>{activeProject.name}</strong>
                <small>
                  {activeProject.documentCount}{" "}
                  {activeProject.documentCount === 1 ? "Datei" : "Dateien"} ·
                  Inhalte werden als unvertrauenswürdige Daten eingebunden.
                </small>
              </div>
              <button type="button" onClick={openProjectManage}>
                Dateien
              </button>
              <button
                type="button"
                aria-label="Projektkontext abwählen"
                onClick={() => void selectProject(activeProject.id)}
              >
                ×
              </button>
            </div>
          ) : null}
          {activeGoal ? (
            <div className={`goal-context-bar ${goalTerminal ? "terminal" : ""}`}>
              <div>
                <span>
                  ZIELKONTEXT · {goalLabels[activeGoal.status]} ·{" "}
                  {activeGoal.progressPercent} %
                </span>
                <strong>{activeGoal.title}</strong>
                <small>
                  {activeGoal.nextAction
                    ? `Nächste sichere Aktion: ${activeGoal.nextAction}`
                    : goalTerminal
                      ? "Terminaler Zustand — für neue Läufe Ziel abwählen."
                      : "Nächste sichere Aktion noch nicht bestätigt."}
                </small>
              </div>
              <button type="button" onClick={openGoalUpdate}>
                Stand ändern
              </button>
              <button
                type="button"
                aria-label="Zielkontext abwählen"
                onClick={() => void selectGoal(activeGoal.id)}
              >
                ×
              </button>
            </div>
          ) : (
            <button
              className="goal-context-empty"
              type="button"
              onClick={openGoalCreate}
            >
              <PlusIcon />
              Langlebiges Ziel anlegen und über Sitzungen fortsetzen
            </button>
          )}
          <div className="mode-selector" role="radiogroup" aria-label="Teammodus">
            {modes.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={mode === item.id}
                className={mode === item.id ? "active" : ""}
                title={item.description}
                onClick={() => setMode(item.id)}
              >
                <span>{item.label}</span>
                <small>{item.calls}</small>
              </button>
            ))}
          </div>
          <div
            className={`capability-lease-gate ${
              activeCapabilityLease ? "ready" : ""
            }`}
            aria-live="polite"
          >
            <div>
              <span>
                AUSFÜHRUNGSFREIGABE ·{" "}
                {modes.find((item) => item.id === mode)?.label.toUpperCase()}
              </span>
              <strong>
                {activeCapabilityLease
                  ? "MODELLLAUF ZEITLICH UND EINMALIG FREIGEGEBEN"
                  : "VOR JEDEM MODELLLAUF IST EINE FREIGABE NÖTIG"}
              </strong>
              <small>
                {activeCapabilityLease
                  ? `${
                      activeCapabilityLease.scope === "project"
                        ? `Nur Projekt „${activeCapabilityLease.projectName ?? activeProject?.name ?? "Projekt"}“`
                        : "Kontoweit"
                    } · ${activeCapabilityLease.remainingUses} Nutzung · gültig bis ${new Date(
                      activeCapabilityLease.expiresAt,
                    ).toLocaleTimeString("de-DE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : activeProject
                    ? `Eine Stunde, eine Nutzung, nur Projekt „${activeProject.name}“.`
                    : "Eine Stunde, eine Nutzung, ohne Projektbindung."}
              </small>
            </div>
            {activeCapabilityLease ? (
              <button
                type="button"
                disabled={leaseLoading}
                onClick={() =>
                  void revokeModelRunCapability(activeCapabilityLease)
                }
              >
                Widerrufen
              </button>
            ) : (
              <button
                type="button"
                disabled={leaseLoading || projectArchived}
                onClick={() => void grantModelRunCapability()}
              >
                {leaseLoading ? "Speichert …" : "1 Lauf freigeben"}
              </button>
            )}
          </div>
          <div className="composer">
            <textarea
              aria-label="Nachricht an TankAI"
              value={draft}
              disabled={
                !providerReady ||
                working ||
                contextBlocked ||
                capabilityBlocked
              }
              maxLength={12_000}
              placeholder={
                providerReady
                  ? projectArchived
                    ? "Archiviertes Projekt wiederherstellen oder abwählen …"
                    : goalTerminal
                      ? "Terminales Ziel abwählen, um einen neuen Lauf zu starten …"
                    : capabilityBlocked
                      ? "Erst eine Ausführungsfreigabe für diesen Modus erteilen …"
                      : "Beschreibe das Ziel, nicht nur den nächsten Klick …"
                  : "Modellzugang wird serverseitig aktiviert …"
              }
              rows={1}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <button
              className="send-button"
              type="button"
              aria-label="Nachricht senden"
              disabled={
                !draft.trim() || !providerReady || working || contextBlocked
                || capabilityBlocked
              }
              onClick={() => void sendMessage()}
            >
              ↑
            </button>
          </div>
          <p className="composer-note">
            TankAI kann Fehler machen. Wichtige Ergebnisse bleiben prüfpflichtig.
          </p>
        </div>
      </section>

      <aside className="runtime-sidebar">
        <div className="runtime-heading">
          <span>RUN TRACE</span>
          {trace ? <small>{formatTime(trace.elapsedMs)}</small> : null}
        </div>
        {trace ? (
          <>
            <div className="trace-summary">
              <div><span>CALLS</span><strong>{trace.modelCalls}</strong></div>
              <div><span>FAMILIEN</span><strong>{trace.providerFamilies.length}</strong></div>
              <div>
                <span>STATUS</span>
                <strong className={trace.receipt.state === "degraded" ? "warn" : "ok"}>
                  {trace.receipt.state === "degraded" ? "DEGRADED" : "COMPLETE"}
                </strong>
              </div>
            </div>
            <div className="trace-list">
              {[...trace.agents, ...trace.reviewers]
                .filter((item, index, all) => {
                  const key = `${item.taskId}:${item.providerName}`;
                  return all.findIndex(
                    (candidate) =>
                      `${candidate.taskId}:${candidate.providerName}` === key,
                  ) === index;
                })
                .map((agent, index) => (
                  <div className="trace-item" key={`${agent.taskId}-${index}`}>
                    <span
                      className={`trace-dot ${agent.status === "completed" ? "done" : "failed"}`}
                    />
                    <div>
                      <strong>{friendlyRole(agent.role)}</strong>
                      <span>{agent.providerName}</span>
                      <small>{agent.model} · {formatTime(agent.latencyMs)}</small>
                    </div>
                  </div>
                ))}
              {trace.synthesizer ? (
                <div className="trace-item final">
                  <span className="trace-dot done" />
                  <div>
                    <strong>Finale Synthese</strong>
                    <span>{trace.synthesizer.providerName}</span>
                    <small>{trace.synthesizer.model}</small>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="receipt-panel">
              <span>EXECUTION RECEIPT · {trace.receipt.version}</span>
              <div>
                <strong>
                  {trace.receipt.completedSteps}/{trace.receipt.attemptedSteps}
                </strong>
                <small>Schritte abgeschlossen</small>
              </div>
              <div>
                <strong>{trace.receipt.completedCriticChecks}</strong>
                <small>Gegenprüfungen</small>
              </div>
              <p>
                Ablauf belegt. Faktenstatus: nicht automatisch verifiziert.
              </p>
            </div>
            {runMemory ? (
              <div className="receipt-panel memory-panel">
                <span>LONG-TERM MEMORY · {runMemory.embeddingModel}</span>
                <div>
                  <strong>{runMemory.recalled}</strong>
                  <small>relevante Erinnerungen geladen</small>
                </div>
                <div>
                  <strong>
                    {runMemory.stored
                      ? runMemory.stored.episodic +
                        runMemory.stored.semantic +
                        runMemory.stored.procedural
                      : 0}
                  </strong>
                  <small>neue Einträge gespeichert</small>
                </div>
                <p>
                  Kandidaten sind keine verifizierten Fakten. Nutzerfeedback bestätigt oder
                  bestreitet semantische und prozedurale Einträge.
                </p>
                {runMemory.warnings.map((warning) => (
                  <p className="warn" key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="runtime-empty">
            <div className="mini-orbit">
              <BrandMark />
            </div>
            <p>Nach einem Lauf erscheinen hier Rollen, Modelle, Status und Zeit — keine privaten Gedankengänge.</p>
          </div>
        )}
        <div className="provider-stack">
          <span>AKTIVE PROVIDER</span>
          {status?.providers.length ? (
            status.providers.map((provider) => (
              <div key={provider.id}>
                <i />
                <span>{provider.name}</span>
                <small>{provider.model}</small>
              </div>
            ))
          ) : status?.modelMesh.candidates.length ? (
            status.modelMesh.candidates.map((candidate) => (
              <div className="blocked" key={candidate.id}>
                <i />
                <span>{candidate.name}</span>
                <small>{candidate.missing.join(" · ")}</small>
              </div>
            ))
          ) : <p>Kein Modellzugang konfiguriert.</p>}
        </div>
        <div className="learning-status">
          <span>IMPROVEMENT CONTROL</span>
          <div>
            <strong>{improvement?.queue.queued ?? 0}</strong>
            <small>Lernfälle warten</small>
          </div>
          <div>
            <strong>{improvement?.signals.total ?? 0}</strong>
            <small>Lernsignale gesamt</small>
          </div>
          <p>
            Keine automatische Prompt- oder Gewichtsänderung. Erst Eval,
            Promotion Gate und Rollback.
          </p>
        </div>
        <Link className="runtime-link" href="/tankbench">TankBench Runtime</Link>
        <Link className="runtime-link" href="/benchmark">
          TankBench-Messstandard ↗
        </Link>
        <Link className="runtime-link" href="/data">
          Datenexport & Löschung ↗
        </Link>
      </aside>

      {feedbackRun ? (
        <div className="feedback-dialog" role="dialog" aria-modal="true" aria-label="Antwort korrigieren">
          <div>
            <span className="section-kicker">FEHLER SIGNALISIEREN</span>
            <h2>Was muss TankAI beim nächsten Eval besser machen?</h2>
            <textarea
              value={correction}
              maxLength={4_000}
              placeholder="Konkreter Fehler oder richtige Fassung …"
              onChange={(event) => setCorrection(event.target.value)}
            />
            <div>
              <button type="button" onClick={() => {
                setFeedbackRun(null);
                setCorrection("");
              }}>
                Abbrechen
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={!correction.trim()}
                onClick={() => void sendFeedback(feedbackRun, -1)}
              >
                Als Lernsignal speichern
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {projectEditor === "create" ? (
        <div
          className="feedback-dialog goal-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Projektbereich anlegen"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void createNewProject();
            }}
          >
            <span className="section-kicker">
              R2 · DAUERHAFTER PROJEKTSPEICHER
            </span>
            <h2>Ein echter Arbeitsbereich für Dateien und Kontext.</h2>
            <label>
              <span>Projektname</span>
              <input
                required
                maxLength={120}
                value={projectForm.name}
                onChange={(event) =>
                  setProjectForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Beschreibung</span>
              <textarea
                maxLength={2_000}
                value={projectForm.description}
                onChange={(event) =>
                  setProjectForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <p className="project-safety-note">
              Text-, Markdown-, JSON- und geprüfte CSV-Dateien werden versioniert in D1
              gespeichert. Dateiinhalte gelten im Modellkontext immer als
              unvertrauenswürdige Daten.
            </p>
            <div className="goal-dialog-actions">
              <button type="button" onClick={() => setProjectEditor(null)}>
                Abbrechen
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={projectLoading || !projectForm.name.trim()}
              >
                Projektbereich anlegen
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {projectEditor === "manage" && activeProject ? (
        <div
          className="feedback-dialog goal-dialog project-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Projektbereich verwalten"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveProjectDetails();
            }}
          >
            <span className="section-kicker">
              PROJEKTVERSION {activeProject.version} · KONTEXTREVISION{" "}
              {activeProject.contentRevision}
            </span>
            <h2>{activeProject.name}</h2>
            <div className="goal-form-grid">
              <label>
                <span>Projektname</span>
                <input
                  required
                  maxLength={120}
                  value={projectForm.name}
                  onChange={(event) =>
                    setProjectForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Status</span>
                <input
                  disabled
                  value={
                    activeProject.status === "active"
                      ? "Aktiv"
                      : "Archiviert"
                  }
                />
              </label>
            </div>
            <label>
              <span>Beschreibung</span>
              <textarea
                maxLength={2_000}
                value={projectForm.description}
                onChange={(event) =>
                  setProjectForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <div className="project-file-heading">
              <div>
                <span>DATEIEN</span>
                <small>
                  {projectDocuments.length} gespeichert · unveränderliche
                  Versionshistorie
                </small>
              </div>
              <button
                type="button"
                disabled={activeProject.status === "archived"}
                onClick={openProjectDocumentCreate}
              >
                <PlusIcon /> Datei anlegen
              </button>
            </div>
            <div className="project-file-list">
              {projectDocuments.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => void openProjectDocument(document.id)}
                >
                  <span>{document.name}</span>
                  <small>
                    {document.kind.toUpperCase()} · v{document.version} ·{" "}
                    {document.sizeBytes.toLocaleString("de-DE")} B
                  </small>
                </button>
              ))}
              {projectDocuments.length === 0 ? (
                <p>Noch keine Datei in diesem Projektbereich.</p>
              ) : null}
            </div>
            <div className="project-event-list">
              <span>LETZTE RECEIPTS</span>
              {projectEvents.slice(0, 6).map((event) => (
                <div key={event.id}>
                  <strong>{event.type.replaceAll("_", " ")}</strong>
                  <small>
                    {new Date(event.createdAt).toLocaleString("de-DE")} · P
                    {event.projectVersion}
                    {event.documentVersion
                      ? ` · D${event.documentVersion}`
                      : ""}
                  </small>
                  {event.note ? <p>{event.note}</p> : null}
                </div>
              ))}
            </div>
            <div className="goal-dialog-actions project-dialog-actions">
              <button
                type="button"
                onClick={() =>
                  void changeProjectStatus(
                    activeProject.status === "active"
                      ? "archived"
                      : "active",
                  )
                }
              >
                {activeProject.status === "active"
                  ? "Archivieren"
                  : "Wiederherstellen"}
              </button>
              <button type="button" onClick={() => setProjectEditor(null)}>
                Schließen
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={
                  projectLoading ||
                  !projectForm.name.trim() ||
                  (projectForm.name === activeProject.name &&
                    projectForm.description === activeProject.description)
                }
              >
                Angaben speichern
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {projectDocumentEditor && activeProject ? (
        <div
          className="feedback-dialog goal-dialog project-document-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Projektdatei bearbeiten"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveProjectDocument();
            }}
          >
            <span className="section-kicker">
              {projectDocumentEditor === "create"
                ? "NEUE PROJEKTDATEI"
                : `DATEIVERSION ${activeProjectDocument?.version ?? projectDocumentForm.expectedVersion}`}
            </span>
            <h2>
              {projectDocumentEditor === "create"
                ? "Datei versioniert speichern."
                : projectDocumentForm.name}
            </h2>
            <div className="goal-form-grid">
              <label>
                <span>Dateiname</span>
                <input
                  required
                  maxLength={140}
                  value={projectDocumentForm.name}
                  onChange={(event) =>
                    setProjectDocumentForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Dateityp</span>
                <select
                  value={projectDocumentForm.kind}
                  onChange={(event) =>
                    setProjectDocumentForm((current) => ({
                      ...current,
                      kind: event.target.value as ProjectDocumentKind,
                    }))
                  }
                >
                  <option value="markdown">Markdown</option>
                  <option value="text">Text</option>
                  <option value="json">JSON</option>
                  <option value="csv">CSV-Tabelle</option>
                </select>
              </label>
            </div>
            <label>
              <span>Inhalt · maximal 20.000 Zeichen / 24.000 Bytes</span>
              <textarea
                className="project-document-content"
                maxLength={20_000}
                value={projectDocumentForm.content}
                onChange={(event) =>
                  setProjectDocumentForm((current) => ({
                    ...current,
                    content: event.target.value,
                  }))
                }
              />
            </label>
            {projectDocumentForm.kind === "csv" ? (
              <p className="project-safety-note">
                CSV benötigt eine eindeutige Kopfzeile und mindestens eine Datenzeile.
                Komma und Semikolon werden unterstützt. Formeln, ausführbare Zellen,
                uneinheitliche Spalten und gefährliche Steuerzeichen werden abgewiesen.
              </p>
            ) : null}
            <label>
              <span>Änderungsnotiz</span>
              <input
                maxLength={500}
                value={projectDocumentForm.changeNote}
                placeholder="Was hat sich fachlich geändert?"
                onChange={(event) =>
                  setProjectDocumentForm((current) => ({
                    ...current,
                    changeNote: event.target.value,
                  }))
                }
              />
            </label>
            {projectDocumentEditor === "update" ? (
              <div className="document-version-list">
                <span>UNVERÄNDERLICHE VERSIONEN</span>
                {projectDocumentVersions.slice(0, 8).map((version) => (
                  <div key={version.id}>
                    <strong>v{version.version}</strong>
                    <small>
                      {new Date(version.createdAt).toLocaleString("de-DE")} ·{" "}
                      {version.sizeBytes.toLocaleString("de-DE")} B ·{" "}
                      {version.contentSha256.slice(0, 12)}
                    </small>
                    {version.changeNote ? <p>{version.changeNote}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="goal-dialog-actions">
              <button
                type="button"
                onClick={() => setProjectDocumentEditor(null)}
              >
                Abbrechen
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={projectLoading || !projectDocumentForm.name.trim()}
              >
                {projectDocumentEditor === "create"
                  ? "Datei dauerhaft anlegen"
                  : "Neue Version speichern"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {goalEditor === "create" ? (
        <div
          className="feedback-dialog goal-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Langlebiges Ziel anlegen"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void createNewGoal();
            }}
          >
            <span className="section-kicker">R2 · LANGFRISTIGER AUFTRAG</span>
            <h2>Ein Ziel anlegen, das TankAI nicht vergisst.</h2>
            <label>
              <span>Titel</span>
              <input
                required
                maxLength={120}
                value={goalForm.title}
                onChange={(event) =>
                  setGoalForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Ziel</span>
              <textarea
                required
                maxLength={4_000}
                value={goalForm.objective}
                onChange={(event) =>
                  setGoalForm((current) => ({
                    ...current,
                    objective: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Definition of Done</span>
              <textarea
                required
                maxLength={3_000}
                value={goalForm.definitionOfDone}
                onChange={(event) =>
                  setGoalForm((current) => ({
                    ...current,
                    definitionOfDone: event.target.value,
                  }))
                }
              />
            </label>
            <div className="goal-dialog-actions">
              <button type="button" onClick={() => setGoalEditor(null)}>
                Abbrechen
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={
                  goalLoading ||
                  !goalForm.title.trim() ||
                  !goalForm.objective.trim() ||
                  !goalForm.definitionOfDone.trim()
                }
              >
                Ziel dauerhaft anlegen
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {goalEditor === "update" && activeGoal && goalUpdateForm ? (
        <div
          className="feedback-dialog goal-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Zielstand aktualisieren"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveGoalProgress();
            }}
          >
            <span className="section-kicker">
              ZIELVERSION {activeGoal.version}
            </span>
            <h2>{activeGoal.title}</h2>
            <p className="goal-objective">{activeGoal.objective}</p>
            <div className="goal-form-grid">
              <label>
                <span>Status</span>
                <select
                  value={goalUpdateForm.status}
                  onChange={(event) =>
                    setGoalUpdateForm((current) =>
                      current
                        ? {
                            ...current,
                            status: event.target.value as GoalStatus,
                          }
                        : current,
                    )
                  }
                >
                  {[activeGoal.status, ...goalTransitions[activeGoal.status]].map(
                    (status) => (
                      <option key={status} value={status}>
                        {goalLabels[status]}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                <span>Fortschritt in Prozent</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  required
                  value={goalUpdateForm.progressPercent}
                  onChange={(event) =>
                    setGoalUpdateForm((current) =>
                      current
                        ? {
                            ...current,
                            progressPercent: event.target.value,
                          }
                        : current,
                    )
                  }
                />
              </label>
            </div>
            <label>
              <span>Letzter bestätigter Schritt</span>
              <textarea
                maxLength={1_000}
                value={goalUpdateForm.currentStep}
                onChange={(event) =>
                  setGoalUpdateForm((current) =>
                    current
                      ? { ...current, currentStep: event.target.value }
                      : current,
                  )
                }
              />
            </label>
            <label>
              <span>Nächste sichere Aktion</span>
              <textarea
                maxLength={1_000}
                value={goalUpdateForm.nextAction}
                disabled={goalTransitions[goalUpdateForm.status].length === 0}
                onChange={(event) =>
                  setGoalUpdateForm((current) =>
                    current
                      ? { ...current, nextAction: event.target.value }
                      : current,
                  )
                }
              />
            </label>
            <label>
              <span>Receipt-Notiz</span>
              <textarea
                maxLength={2_000}
                value={goalUpdateForm.note}
                onChange={(event) =>
                  setGoalUpdateForm((current) =>
                    current ? { ...current, note: event.target.value } : current,
                  )
                }
              />
            </label>
            {goalEvents.length ? (
              <div className="goal-events">
                <span>LETZTE EREIGNISSE</span>
                {goalEvents.slice(0, 4).map((event) => (
                  <div key={event.id}>
                    <strong>{event.type.replaceAll("_", " ")}</strong>
                    <small>
                      v{event.goalVersion} ·{" "}
                      {new Date(event.createdAt).toLocaleString("de-DE")}
                    </small>
                    {event.note ? <p>{event.note}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="goal-dialog-actions">
              <button type="button" onClick={() => setGoalEditor(null)}>
                Abbrechen
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={
                  goalLoading ||
                  !goalUpdateForm.progressPercent ||
                  Number(goalUpdateForm.progressPercent) < 0 ||
                  Number(goalUpdateForm.progressPercent) > 100
                }
              >
                Zielstand mit Receipt speichern
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
