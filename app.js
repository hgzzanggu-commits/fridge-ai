const SUPABASE_URL = "https://bqbpmljzwgsewoqtjloi.supabase.co/rest/v1/";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QSkTjtcatMQnpx-QfsK6hg_gmx7vkm8";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const imageInput = document.getElementById("imageInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const result = document.getElementById("result");

analyzeBtn.addEventListener("click", () => {
  if (!imageInput.files.length) {
    result.textContent = "먼저 냉장고 사진을 선택해주세요.";
    return;
  }

  result.textContent = "사진을 선택했습니다.";
});
