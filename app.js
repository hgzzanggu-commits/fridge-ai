const imageInput = document.getElementById("imageInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const result = document.getElementById("result");

analyzeBtn.addEventListener("click", () => {
  if (!imageInput.files.length) {
    result.textContent = "먼저 냉장고 사진을 선택해주세요.";
    return;
  }

  result.textContent = "사진을 선택했습니다. AI 분석 기능은 다음 단계에서 연결합니다.";
});
