export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && (process.env.SCHEDULER_ENABLED || "1") === "1") {
    const { startScheduler } = await import("./server/jobs");
    startScheduler(parseInt(process.env.SCHEDULER_INTERVAL_SEC || "60", 10));
  }
}
