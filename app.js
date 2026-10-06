const SUPABASE_URL = "https://bqbpmljzwgsewoqtjloi.supabase.co";
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

  try {
    analyzeBtn.disabled = true;
    result.textContent = "📸 사진 업로드 중...";

    // 1. Storage에 사진 업로드
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabaseClient.storage
      .from("fridge-images")
      .upload(fileName, file);

    if (uploadError) {
      throw new Error(`사진 업로드 실패: ${uploadError.message}`);
    }

    // 2. 사진을 Base64로 변환
    const base64 = await fileToBase64(file);

    // 3. Supabase Edge Function 호출
    result.textContent = "🤖 AI가 냉장고를 분석하는 중...";

    const { data, error: functionError } =
      await supabaseClient.functions.invoke("analyze-fridge", {
        body: {
          imageBase64: base64,
          mimeType: file.type
        }
      });

    if (functionError) {
      throw new Error(`AI 분석 실패: ${functionError.message}`);
    }

    if (!data || !data.ingredients) {
      throw new Error("AI 분석 결과를 받지 못했습니다.");
    }

    // 4. 분석 결과 화면에 표시
    result.innerHTML = `
      <h3>🔍 냉장고 분석 결과</h3>
      ${data.ingredients
        .map(
          (item) => `
            <div class="ingredient">
              <strong>🥬 ${item.name}</strong>
              <p>신선도: ${item.freshness}</p>
              <p>상태: ${item.condition}</p>
            </div>
          `
        )
        .join("")}
    `;
  } catch (error) {
    console.error(error);
    result.textContent = error.message;
  } finally {
    analyzeBtn.disabled = false;
  }
});

// 파일을 Base64 문자열로 변환
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      // data:image/jpeg;base64,XXXXXX 중에서
      // 실제 Base64 데이터만 가져오기
      const base64 = result.split(",")[1];

      resolve(base64);
    };

    reader.onerror = () => {
      reject(new Error("이미지를 읽을 수 없습니다."));
    };

    reader.readAsDataURL(file);
  });
}
