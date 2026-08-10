import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://zpkfwsczrtadrhcounof.supabase.co",
  "sb_publishable_7Qmnpa_7IoTIGBjr2sWUSQ_U-9DFKpy",
);

async function test() {
  const { data, error } = await supabase.from("lots").select("*").limit(1);
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Data:", data);
  }
}

test();
