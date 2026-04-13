export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureInitialized } = await import("@/lib/startup");
    ensureInitialized();
  }
}
