const SUPABASE_URL = "https://bqbpmljzwgsewoqtjloi.supabase.co/rest/v1/";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QSkTjtcatMQnpx-QfsK6hg_gmx7vkm8";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const imageInput = document.getElementById("imageInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const result = document.getElementById("result");

analyzeBtn.addEventListener("click", async () => {
  const file = imageInput.files[0];

  if (!file) {
    result.textContent = "먼저 냉장고 사진을 선택해주세요.";
    return;
  }

  result.textContent = "사진 업로드 중...";

  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}.${fileExt}`;

  const { error } = await supabaseClient.storage
    .from("fridge-images")
    .upload(fileName, file);

  if (error) {
    console.error(error);
    result.textContent = `업로드 실패: ${error.message}`;
    return;
  }

  const { data } = supabaseClient.storage
    .from("fridge-images")
    .getPublicUrl(fileName);

  result.innerHTML = `
    <p>✅ 사진 업로드 성공!</p>
    <img src="${data.publicUrl}" alt="냉장고 사진" style="max-width: 100%; border-radius: 12px;">
  `;
});
