import { prisma } from "@/lib/prisma";

// Temporarily stubbed out until Sequence model is added to schema
export async function listActiveSequences() {
  // return prisma.sequence.findMany({
  //   where: { isActive: true },
  //   orderBy: { position: "asc" },
  //   include: { steps: { orderBy: { orderIdx: "asc" } } },
  // });
  return [];
}

export async function startSequenceRun(args: { sequenceId: string; userId: string }) {
  // Temporarily stubbed out until Sequence model is added to schema
  throw new Error("Sequence feature is not yet implemented");
  // const seq = await prisma.sequence.findUnique({
  //   where: { id: args.sequenceId },
  //   include: { steps: { orderBy: { orderIdx: "asc" } } }
  // });
  // if (!seq || !seq.isActive) throw new Error("Sequence unavailable");

  // return prisma.$transaction(async (tx) => {
  //   const run = await tx.sequenceRun.create({
  //     data: { sequenceId: seq.id, userId: args.userId, status: "IN_PROGRESS", payload: {} }
  //   });
  //   await tx.sequenceRunStep.createMany({
  //     data: seq.steps.map(s => ({ runId: run.id, stepId: s.id, state: "PENDING" }))
  //   });
  //   return run;
  // });
}

export async function getRun(runId: string) {
  // Temporarily stubbed out until Sequence model is added to schema
  return null;
  // return prisma.sequenceRun.findUnique({
  //   where: { id: runId },
  //   include: {
  //     sequence: { include: { steps: { orderBy: { orderIdx: "asc" } } } },
  //     steps: true,
  //   }
  // });
}

export async function activateStep(runStepId: string) {
  // Temporarily stubbed out until Sequence model is added to schema
  throw new Error("Sequence feature is not yet implemented");
  // return prisma.sequenceRunStep.update({
  //   where: { id: runStepId },
  //   data: { state: "ACTIVE", startedAt: new Date() }
  // });
}

export async function completeStep(runStepId: string, result?: any) {
  // Temporarily stubbed out until Sequence model is added to schema
  throw new Error("Sequence feature is not yet implemented");
  // return prisma.sequenceRunStep.update({
  //   where: { id: runStepId },
  //   data: { state: "DONE", result, completedAt: new Date() }
  // });
}

export async function updateRunPayload(runId: string, patch: Record<string, any>) {
  // Temporarily stubbed out until Sequence model is added to schema
  throw new Error("Sequence feature is not yet implemented");
  // const run = await prisma.sequenceRun.findUnique({ where: { id: runId } });
  // if (!run) throw new Error("Run not found");
  // const nextPayload = { ...(run.payload as any), ...patch };
  // return prisma.sequenceRun.update({ where: { id: runId }, data: { payload: nextPayload } });
}

export async function completeRun(runId: string) {
  // Temporarily stubbed out until Sequence model is added to schema
  throw new Error("Sequence feature is not yet implemented");
  // return prisma.sequenceRun.update({ where: { id: runId }, data: { status: "COMPLETED" }});
}

export function getNextPendingStep(run: Awaited<ReturnType<typeof getRun>>) {
  // Temporarily stubbed out until Sequence model is added to schema
  return null;
  // const order = run?.sequence.steps ?? [];
  // const map = new Map(run?.steps.map(s => [s.stepId, s]));
  // for (const s of order) {
  //   const rs = map.get(s.id);
  //   if (!rs || rs.state !== "DONE") return { step: s, runStep: rs };
  // }
  // return null;
}
