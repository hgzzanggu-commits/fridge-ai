const SUPABASE_URL = "https://bqbpmljzwgsewoqtjloi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QSkTjtcatMQnpx-QfsK6hg_gmx7vkm8";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const imageInput = document.getElementById("imageInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const result = document.getElementById("result");

const recipeBtn = document.getElementById("recipeBtn");
const recipeResult = document.getElementById("recipeResult");

// 페이지가 열리면 저장된 식재료 불러오기
loadIngredients();


// ========================================
// 냉장고 사진 분석
// ========================================

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

    // 2. 업로드한 사진의 공개 URL 가져오기
    const { data: publicUrlData } = supabaseClient.storage
      .from("fridge-images")
      .getPublicUrl(fileName);

    const imageUrl = publicUrlData.publicUrl;

    // 3. 사진을 Base64로 변환
    const base64 = await fileToBase64(file);

    // 4. Gemini 분석 요청
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

    // 6. 저장된 식재료 목록 다시 불러오기
    await loadIngredients();

  } catch (error) {
    console.error(error);
    result.textContent = error.message;

  } finally {
    analyzeBtn.disabled = false;
  }
});


// ========================================
// DB에서 식재료 목록 불러오기
// ========================================

async function loadIngredients() {
  const { data, error } = await supabaseClient
    .from("ingredients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    result.textContent =
      `재료 목록 불러오기 실패: ${error.message}`;
    return;
  }

  if (!data || data.length === 0) {
    result.innerHTML =
      "<p>아직 등록된 식재료가 없습니다.</p>";
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
            ? `
              <img
                src="${item.image_url}"
                alt="${item.name}"
                style="
                  width: 100%;
                  max-width: 300px;
                  border-radius: 10px;
                "
              >
            `
            : ""
        }

        <h3>🥬 ${item.name}</h3>

        <p>
          신선도:
          ${getFreshnessEmoji(item.freshness)}
          ${item.freshness}
        </p>

        <p>
          상태:
          ${item.condition}
        </p>

        <button
          onclick="deleteIngredient(${item.id})"
          style="
            margin-top: 10px;
            padding: 8px 14px;
            background: #ff5c5c;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
          "
        >
          🗑️ 삭제
        </button>

      </div>
    `).join("")}
  `;
}


// ========================================
// 식재료 삭제
// ========================================

async function deleteIngredient(id) {
  const confirmed = confirm(
    "정말 이 식재료를 삭제할까요?"
  );

  if (!confirmed) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("ingredients")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(
        `삭제 실패: ${error.message}`
      );
    }

    // 삭제 후 목록 다시 불러오기
    await loadIngredients();

    alert("✅ 식재료가 삭제되었습니다.");

  } catch (error) {
    console.error(error);

    alert(error.message);
  }
}


// ========================================
// 신선도 아이콘
// ========================================

function getFreshnessEmoji(freshness) {
  if (freshness === "높음") {
    return "🟢";
  }

  if (freshness === "보통") {
    return "🟡";
  }

  if (freshness === "낮음") {
    return "🔴";
  }

  return "⚪";
}


// ========================================
// 요리 추천
// ========================================

recipeBtn.addEventListener("click", async () => {
  try {
    recipeBtn.disabled = true;

    recipeResult.innerHTML =
      "<p>🤖 냉장고 재료를 확인하고 요리를 추천하는 중...</p>";

    // 1. 현재 DB에 저장된 재료 가져오기
    const { data: ingredients, error: dbError } =
      await supabaseClient
        .from("ingredients")
        .select("name, freshness, condition")
        .order("created_at", { ascending: false });

    if (dbError) {
      throw new Error(
        `재료를 불러오지 못했습니다: ${dbError.message}`
      );
    }

    if (!ingredients || ingredients.length === 0) {
      recipeResult.innerHTML =
        "<p>먼저 냉장고 사진을 분석해주세요.</p>";
      return;
    }

    // 2. 중복된 재료 이름 제거
    const uniqueIngredients = [];

    for (const item of ingredients) {
      const exists = uniqueIngredients.some(
        (ingredient) =>
          ingredient.name === item.name
      );

      if (!exists) {
        uniqueIngredients.push(item);
      }
    }

    // 3. 요리 추천 Edge Function 호출
    const { data, error: functionError } =
      await supabaseClient.functions.invoke(
        "recommend-recipes",
        {
          body: {
            ingredients: uniqueIngredients
          }
        }
      );

    if (functionError) {
      throw new Error(
        `요리 추천 실패: ${functionError.message}`
      );
    }

    if (!data || !data.recipes) {
      throw new Error(
        "요리 추천 결과를 받지 못했습니다."
      );
    }

    // 4. 추천 결과 화면 표시
    recipeResult.innerHTML = `
      <h3>🍳 추천 요리</h3>

      ${data.recipes.map((recipe) => `
        <div class="recipe-card" style="
          margin-top: 15px;
          padding: 18px;
          background: #fff;
          border-radius: 12px;
          border: 1px solid #ddd;
        ">

          <h3>🍽️ ${recipe.name}</h3>

          <p>
            ${recipe.description}
          </p>

          <p>
            <strong>난이도:</strong>
            ${recipe.difficulty}
          </p>

          <p>
            <strong>현재 냉장고 재료:</strong>
            ${
              recipe.availableIngredients &&
              recipe.availableIngredients.length > 0
                ? recipe.availableIngredients.join(", ")
                : "없음"
            }
          </p>

          <p>
            <strong>추가로 필요한 재료:</strong>
            ${
              recipe.missingIngredients &&
              recipe.missingIngredients.length > 0
                ? recipe.missingIngredients.join(", ")
                : "없음"
            }
          </p>

          <p>
            <strong>👨‍🍳 조리 순서</strong>
          </p>

          <ol>
            ${
              recipe.steps &&
              recipe.steps.length > 0
                ? recipe.steps
                    .map(
                      (step) =>
                        `<li>${step}</li>`
                    )
                    .join("")
                : "<li>조리 순서 정보가 없습니다.</li>"
            }
          </ol>

        </div>
      `).join("")}
    `;

  } catch (error) {
    console.error(error);

    recipeResult.innerHTML = `
      <p>❌ ${error.message}</p>
    `;

  } finally {
    recipeBtn.disabled = false;
  }
});


// ========================================
// 파일을 Base64로 변환
// ========================================

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      // data:image/jpeg;base64,XXXX
      // 여기서 실제 Base64 부분만 추출
      const base64 = result.split(",")[1];

      resolve(base64);
    };

    reader.onerror = () => {
      reject(
        new Error("이미지를 읽을 수 없습니다.")
      );
    };

    reader.readAsDataURL(file);
  });
}
