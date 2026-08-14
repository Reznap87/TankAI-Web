import { requireApiIdentity } from "@/lib/auth";
import { jsonResponse } from "@/lib/api-response";
import { advanceSuiteExecution, createSuiteExecution, listSuiteExecution, resolveTankBenchRelease, SuiteRunnerError } from "@/lib/tankbench-suite-runner";

function errorResponse(error:unknown):Response{ if(error instanceof SuiteRunnerError)return jsonResponse({error:error.message,code:error.code},{status:error.status}); console.error("TankBench runner API error",error); return jsonResponse({error:"Suite Runner konnte die Anfrage nicht verarbeiten."},{status:500}); }
function record(value:unknown):Record<string,unknown>{ if(!value||typeof value!=="object"||Array.isArray(value))throw new SuiteRunnerError("JSON-Objekt erwartet.",400,"INVALID_RUNNER_REQUEST"); return value as Record<string,unknown>; }
function text(value:unknown,label:string,max=500):string{ const v=typeof value==="string"?value.trim():""; if(!v||v.length>max)throw new SuiteRunnerError(`${label} ist ungültig.`,400,"INVALID_RUNNER_REQUEST"); return v; }
function integer(value:unknown,label:string,min=1,max=1_000_000):number{ if(!Number.isInteger(value)||Number(value)<min||Number(value)>max)throw new SuiteRunnerError(`${label} ist ungültig.`,400,"INVALID_RUNNER_REQUEST"); return Number(value); }

export async function GET(request:Request):Promise<Response>{ try{ const identity=await requireApiIdentity(request); const url=new URL(request.url); const executionId=text(url.searchParams.get("executionId"),"executionId",100); return jsonResponse(await listSuiteExecution({userId:identity.userId,executionId})); }catch(error){return errorResponse(error);} }
export async function POST(request:Request):Promise<Response>{ try{ const identity=await requireApiIdentity(request); const body=record(await request.json()); const action=text(body.action,"action",80);
  if(action==="create") return jsonResponse(await createSuiteExecution({userId:identity.userId,runId:text(body.runId,"runId",100),baselineCapabilityLeaseId:text(body.baselineCapabilityLeaseId,"baselineCapabilityLeaseId",100),candidateCapabilityLeaseId:text(body.candidateCapabilityLeaseId,"candidateCapabilityLeaseId",100)}),{status:201});
  if(action==="advance") return jsonResponse(await advanceSuiteExecution({userId:identity.userId,executionId:text(body.executionId,"executionId",100),expectedVersion:integer(body.expectedVersion,"expectedVersion"),maxTransitions:body.maxTransitions===undefined?undefined:integer(body.maxTransitions,"maxTransitions",1,8)}));
  if(action==="route") return jsonResponse(await resolveTankBenchRelease({userId:identity.userId,projectId:text(body.projectId,"projectId",100),routingKey:text(body.routingKey,"routingKey",500)}));
  throw new SuiteRunnerError("Unbekannte Aktion.",400,"INVALID_RUNNER_ACTION");
 }catch(error){return errorResponse(error);} }
