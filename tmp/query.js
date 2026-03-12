const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://faxkvmcencvtlmihccct.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZheGt2bWNlbmN2dGxtaWhjY2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTg1MjQ5MiwiZXhwIjoyMDgxNDI4NDkyfQ.8nrOjO_zbarzLTBzkHEVNxOjhKsEInKjBCbzI49nK30'
);

async function run() {
  const types = ["requirement", "risk", "clarification", "outline", "deadline", "submission", "admin"];
  console.log("Testing types against job_work_items...");
  for (const t of types) {
    const { error } = await s.from("job_work_items").insert({
      job_id: "00000000-0000-0000-0000-000000000000",
      type: t,
      ref_key: "test_" + t,
      title: "test",
      status: "todo"
    });
    
    // 23503 is foreign_key_violation (it means the type check passed but the job_id doesn't exist, which is expected and GOOD!)
    // 23514 is check_violation (it means the type check failed, which is BAD)
    if (error && error.code === '23503') {
      console.log(`Type '${t}' is ALLOWED`);
    } else if (error && error.code === '23514') {
      console.log(`Type '${t}' is REJECTED by check constraint`);
    } else {
      console.log(`Type '${t}' has unexpected result:`, error);
    }
  }
}
run();
