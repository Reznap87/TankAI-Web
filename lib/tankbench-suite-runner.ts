import { currentRuntimeBindings } from "@/lib/request-context";
import { advanceCommanderRun, createCommanderRun, listCommanderRuns } from "@/lib/commander-runtime";
import { attachCommanderResult, evaluateTankBenchRun, listTankBench } from "@/lib/tankbench-runtime";

export type SuiteExecutionStatus = "queued" | "running" | "waiting" | "completed" | "failed" | "cancelled";
export type SuiteItemStatus = "queued" | "commander_created" | "running" | "waiting" | "completed" | "failed";

interface ExecutionRow {
  id: string; run_id: string; project_id: string; baseline_capability_lease_id: string;
  candidate_capability_lease_id: string; status: SuiteExecutionStatus; cursor_ordinal: number;
  completed_items: number; total_items: number; version: number; created_at: string; updated_at: string; completed_at: string | null;
}
interface ItemRow {
  id: string; execution_id: string; case_id: string; variant: "baseline" | "candidate"; ordinal: number;
  status: SuiteItemStatus; commander_run_id: string | null; error_code: string | null; version: number;
  created_at: string; updated_at: string; completed_at: string | null;
}

export interface SuiteExecutionRecord {
  id: string; runId: string; projectId: string; status: SuiteExecutionStatus; cursorOrdinal: number;
  completedItems: number; totalItems: number; version: number; createdAt: string; updatedAt: string; completedAt: string | null;
}
export interface SuiteExecutionItemRecord {
  id: string; caseId: string; variant: "baseline" | "candidate"; ordinal: number; status: SuiteItemStatus;
  commanderRunId: string | null; errorCode: string | null; version: number; updatedAt: string; completedAt: string | null;
}

export class SuiteRunnerError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); this.name = code; }
}
function db(): D1Database { const value = currentRuntimeBindings().DB; if (!value) throw new Error("TankAI D1 ist nicht gebunden."); return value; }
function now(): string { return new Date().toISOString(); }
function mapExecution(row: ExecutionRow): SuiteExecutionRecord { return { id: row.id, runId: row.run_id, projectId: row.project_id, status: row.status, cursorOrdinal: Number(row.cursor_ordinal), completedItems: Number(row.completed_items), totalItems: Number(row.total_items), version: Number(row.version), createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at }; }
function mapItem(row: ItemRow): SuiteExecutionItemRecord { return { id: row.id, caseId: row.case_id, variant: row.variant, ordinal: Number(row.ordinal), status: row.status, commanderRunId: row.commander_run_id, errorCode: row.error_code, version: Number(row.version), updatedAt: row.updated_at, completedAt: row.completed_at }; }
async function executionRow(id: string, userId: string): Promise<ExecutionRow> { const row = await db().prepare("SELECT * FROM tankbench_suite_executions WHERE id=? AND user_id=?").bind(id,userId).first<ExecutionRow>(); if (!row) throw new SuiteRunnerError("Suite-Ausführung nicht gefunden.",404,"SUITE_EXECUTION_NOT_FOUND"); return row; }

export async function createSuiteExecution(input: { userId: string; runId: string; baselineCapabilityLeaseId: string; candidateCapabilityLeaseId: string; }): Promise<SuiteExecutionRecord> {
  const selection = await listTankBench({ userId: input.userId, runId: input.runId });
  if (!selection.selectedRun || selection.selectedRun.run.status !== "collecting") throw new SuiteRunnerError("Der TankBench-Lauf ist nicht offen.",409,"TANKBENCH_RUN_NOT_COLLECTING");
  const suite = selection.suites.find((entry) => entry.id === selection.selectedRun!.run.suiteId);
  if (!suite) throw new SuiteRunnerError("Die eingefrorene Suite fehlt.",404,"TANKBENCH_SUITE_NOT_FOUND");
  const id = crypto.randomUUID(); const stamp = now(); const total = suite.cases.length * 2;
  const statements: D1PreparedStatement[] = [db().prepare(`INSERT INTO tankbench_suite_executions
    (id,run_id,user_id,project_id,baseline_capability_lease_id,candidate_capability_lease_id,status,total_items,created_at,updated_at)
    VALUES (?,?,?,?,?,?,'queued',?,?,?)`).bind(id,input.runId,input.userId,selection.selectedRun.run.projectId,input.baselineCapabilityLeaseId,input.candidateCapabilityLeaseId,total,stamp,stamp)];
  let ordinal = 0;
  for (const testCase of suite.cases) for (const variant of ["baseline","candidate"] as const) {
    statements.push(db().prepare(`INSERT INTO tankbench_suite_execution_items
      (id,execution_id,case_id,variant,ordinal,status,created_at,updated_at) VALUES (?,?,?,?,?,'queued',?,?)`)
      .bind(crypto.randomUUID(),id,testCase.id,variant,ordinal++,stamp,stamp));
  }
  try { await db().batch(statements); } catch (error) { throw new SuiteRunnerError(error instanceof Error ? error.message : "Suite-Ausführung konnte nicht erstellt werden.",409,"SUITE_EXECUTION_CREATE_CONFLICT"); }
  return mapExecution(await executionRow(id,input.userId));
}

async function markItem(input: { item: ItemRow; userId: string; status: SuiteItemStatus; commanderRunId?: string | null; errorCode?: string | null; terminal?: boolean; }): Promise<void> {
  const stamp=now(); const result=await db().prepare(`UPDATE tankbench_suite_execution_items SET status=?,commander_run_id=COALESCE(?,commander_run_id),error_code=?,version=version+1,updated_at=?,completed_at=? WHERE id=? AND version=?`).bind(input.status,input.commanderRunId??null,input.errorCode??null,stamp,input.terminal?stamp:null,input.item.id,input.item.version).run();
  if (Number(result.meta.changes??0)!==1) throw new SuiteRunnerError("Das Suite-Element wurde parallel verändert.",409,"SUITE_ITEM_VERSION_CONFLICT");
}

export async function advanceSuiteExecution(input: { userId: string; executionId: string; expectedVersion: number; maxTransitions?: number; }): Promise<{ execution: SuiteExecutionRecord; items: SuiteExecutionItemRecord[] }> {
  let execution=await executionRow(input.executionId,input.userId);
  if (execution.version!==input.expectedVersion) throw new SuiteRunnerError("Die Suite-Ausführung wurde parallel verändert.",409,"SUITE_EXECUTION_VERSION_CONFLICT");
  const max=Math.max(1,Math.min(8,input.maxTransitions??2));
  for(let step=0;step<max;step++){
    execution=await executionRow(execution.id,input.userId); if (["completed","failed","cancelled"].includes(execution.status)) break;
    const item=await db().prepare(`SELECT * FROM tankbench_suite_execution_items WHERE execution_id=? AND status NOT IN ('completed','failed') ORDER BY ordinal LIMIT 1`).bind(execution.id).first<ItemRow>();
    if(!item){
      const bench=await listTankBench({userId:input.userId,runId:execution.run_id});
      if(bench.selectedRun?.run.status==='collecting') await evaluateTankBenchRun({userId:input.userId,runId:execution.run_id,expectedVersion:bench.selectedRun.run.version});
      const stamp=now(); await db().prepare(`UPDATE tankbench_suite_executions SET status='completed',completed_items=total_items,cursor_ordinal=total_items,version=version+1,updated_at=?,completed_at=? WHERE id=? AND version=?`).bind(stamp,stamp,execution.id,execution.version).run(); break;
    }
    const bench=await listTankBench({userId:input.userId,runId:execution.run_id}); const suite=bench.suites.find(s=>s.id===bench.selectedRun?.run.suiteId); const testCase=suite?.cases.find(c=>c.id===item.case_id);
    if(!testCase) throw new SuiteRunnerError("Benchmarkfall fehlt.",404,"TANKBENCH_CASE_NOT_FOUND");
    if(item.status==='queued'){
      const lease=item.variant==='baseline'?execution.baseline_capability_lease_id:execution.candidate_capability_lease_id;
      const commander=await createCommanderRun({userId:input.userId,capabilityLeaseId:lease,projectId:execution.project_id,objective:testCase.prompt,definitionOfDone:testCase.definitionOfDone,maxCycles:8,maxModelCalls:6,maxReviewCalls:2,maxToolActions:4});
      await markItem({item,userId:input.userId,status:'commander_created',commanderRunId:commander.id});
    } else if(item.commander_run_id){
      const selection=await listCommanderRuns({userId:input.userId,runId:item.commander_run_id}); const commander=selection.selected?.run;
      if(!commander) throw new SuiteRunnerError("Commander-Lauf fehlt.",404,"COMMANDER_RUN_NOT_FOUND");
      if(!["completed","failed","cancelled","budget_exhausted","model_unavailable"].includes(commander.status)){
        await advanceCommanderRun({userId:input.userId,runId:commander.id,expectedVersion:commander.version,maxTransitions:2});
      }
      const refreshed=(await listCommanderRuns({userId:input.userId,runId:commander.id})).selected!.run;
      if(["completed","failed","cancelled","budget_exhausted","model_unavailable"].includes(refreshed.status)){
        const currentBench=await listTankBench({userId:input.userId,runId:execution.run_id});
        const attached=await attachCommanderResult({userId:input.userId,runId:execution.run_id,caseId:item.case_id,commanderRunId:refreshed.id,variant:item.variant,expectedVersion:currentBench.selectedRun!.run.version});
        await markItem({item:{...item,version:item.version} as ItemRow,userId:input.userId,status:'completed',terminal:true});
        const stamp=now(); await db().prepare(`UPDATE tankbench_suite_executions SET status='running',completed_items=completed_items+1,cursor_ordinal=?,version=version+1,updated_at=? WHERE id=? AND version=?`).bind(item.ordinal+1,stamp,execution.id,execution.version).run();
        void attached;
      } else {
        await markItem({item,userId:input.userId,status:refreshed.status==='waiting_tool'?'waiting':'running'});
        const stamp=now(); await db().prepare(`UPDATE tankbench_suite_executions SET status='waiting',version=version+1,updated_at=? WHERE id=? AND version=?`).bind(stamp,execution.id,execution.version).run();
        break;
      }
    }
  }
  return listSuiteExecution({userId:input.userId,executionId:input.executionId});
}

export async function listSuiteExecution(input:{userId:string;executionId:string}):Promise<{execution:SuiteExecutionRecord;items:SuiteExecutionItemRecord[]}>{ const execution=await executionRow(input.executionId,input.userId); const rows=await db().prepare("SELECT * FROM tankbench_suite_execution_items WHERE execution_id=? ORDER BY ordinal").bind(execution.id).all<ItemRow>(); return {execution:mapExecution(execution),items:rows.results.map(mapItem)}; }

async function sha256(text:string):Promise<string>{ const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text)); return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,"0")).join(""); }
export async function resolveTankBenchRelease(input:{userId:string;projectId:string;routingKey:string;canaryPercentOverride?:number}):Promise<{selectedReleaseId:string;selectedLabel:string;bucket:number;canaryPercent:number;source:"active"|"canary"}>{
  const key=input.routingKey.trim(); if(!key||key.length>500) throw new SuiteRunnerError("Der Routing-Schlüssel ist ungültig.",400,"INVALID_ROUTING_KEY");
  const hash=await sha256(`${input.projectId}:${key}`); const bucket=parseInt(hash.slice(0,8),16)%100;
  const active=await db().prepare("SELECT id,label FROM tankbench_releases WHERE user_id=? AND project_id=? AND status='active' ORDER BY promoted_at DESC LIMIT 1").bind(input.userId,input.projectId).first<{id:string;label:string}>();
  const canary=await db().prepare("SELECT id,label,traffic_percent FROM tankbench_releases WHERE user_id=? AND project_id=? AND status='canary' ORDER BY updated_at DESC LIMIT 1").bind(input.userId,input.projectId).first<{id:string;label:string;traffic_percent:number}>();
  if(!active&&!canary) throw new SuiteRunnerError("Für das Projekt ist kein aktives oder Canary-Release vorhanden.",404,"NO_ROUTABLE_RELEASE");
  const automaticPercent=Number(canary?.traffic_percent??0); const percent=input.canaryPercentOverride===undefined?automaticPercent:Math.max(0,Math.min(100,Math.trunc(input.canaryPercentOverride))); const useCanary=Boolean(canary)&&(!active||bucket<percent); const selected=useCanary?canary!:active!;
  await db().prepare(`INSERT INTO tankbench_route_events (id,user_id,project_id,routing_key_hash,selected_release_id,active_release_id,canary_release_id,bucket,canary_percent,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),input.userId,input.projectId,hash,selected.id,active?.id??null,canary?.id??null,bucket,percent,now()).run();
  return {selectedReleaseId:selected.id,selectedLabel:selected.label,bucket,canaryPercent:percent,source:useCanary?'canary':'active'};
}
