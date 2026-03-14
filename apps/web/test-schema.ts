import { getSupabaseAdmin } from "./lib/supabaseAdmin";
async function run() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('users').select('*').limit(1);
  console.log(data);
}
run();
