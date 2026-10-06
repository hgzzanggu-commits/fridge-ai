const SUPABASE_URL = "https://bqbpmljzwgsewoqtjloi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QSkTjtcatMQnpx-QfsK6hg_gmx7vkm8";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const imageInput = document.getElementById("imageInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const result = document.getElementById("result");

// 페이지가 열리면 저장된 식재료 불러오기
loadIngredients();

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

    // 2. 사진 URL 가져오기
    const { data: publicUrlData } = supabaseClient.storage
      .from("fridge-images")
      .getPublicUrl(fileName);

    const imageUrl = publicUrlData.publicUrl;

    // 3. Base64 변환
    const base64 = await fileToBase64(file);

    // 4. Gemini 분석
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

    // 5. 분석 결과 DB 저장
    result.textContent = "💾 분석 결과를 저장하는 중...";

    for (const item of data.ingredients) {
      const { error: dbError } = await supabaseClient
        .from("ingredients")
        .insert({
          name: item.name,
          freshness: item.freshness,
          condition: item.condition,
          image_url: imageUrl
        });

      if (dbError) {
        throw new Error(`DB 저장 실패: ${dbError.message}`);
      }
    }

    // 6. 저장된 전체 식재료 다시 불러오기
    await loadIngredients();

  } catch (error) {
    console.error(error);
    result.textContent = error.message;
  } finally {
    analyzeBtn.disabled = false;
  }
});

// DB에서 식재료 목록 가져오기
async function loadIngredients() {
  const { data, error } = await supabaseClient
    .from("ingredients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    result.textContent = `재료 목록 불러오기 실패: ${error.message}`;
    return;
  }

  if (!data || data.length === 0) {
    result.innerHTML = "<p>아직 등록된 식재료가 없습니다.</p>";
    return;
  }

  result.innerHTML = `
    <h3>🥬 내 냉장고 재료</h3>

    ${data.map((item) => `
      <div class="ingredient" style="
        margin-bottom: 15px;
        padding: 15px;
        background: #f8f8f8;
        border-radius: 12px;
      ">
        ${
          item.image_url
            ? `<img src="${item.image_url}"
                 alt="${item.name}"
                 style="width: 100%; max-width: 300px; border-radius: 10px;">`
            : ""
        }

        <h3>🥬 ${item.name}</h3>
        <p>신선도: ${getFreshnessEmoji(item.freshness)} ${item.freshness}</p>
        <p>상태: ${item.condition}</p>
      </div>
    `).join("")}
  `;
}

// 신선도에 따른 아이콘
function getFreshnessEmoji(freshness) {
  if (freshness === "높음") return "🟢";
  if (freshness === "보통") return "🟡";
  if (freshness === "낮음") return "🔴";
  return "⚪";
}

// 파일을 Base64로 변환
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };

    reader.onerror = () => {
      reject(new Error("이미지를 읽을 수 없습니다."));
    };

    reader.readAsDataURL(file);
  });
}
