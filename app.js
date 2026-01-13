// ==================== 스토리지 ====================
const STORAGE_KEYS = {
    CONFIG: "apiTester_config",
    HISTORY: "apiTester_historyV2", // 새 구조
};

// 히스토리 구조: { baseUrl: { testName: [{ timestamp, result }] } }
let testHistory = {};

function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        showSaveIndicator();
    } catch (e) {
        console.error("저장 실패:", e);
    }
}

function loadFromStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error("불러오기 실패:", e);
        return null;
    }
}

function showSaveIndicator() {
    const indicator = document.getElementById("saveIndicator");
    indicator.classList.add("show");
    setTimeout(() => indicator.classList.remove("show"), 1500);
}

// ==================== 설정 ====================
function saveConfig() {
    const config = {
        baseUrl: document.getElementById("baseUrl").value,
        authToken: document.getElementById("authToken").value,
    };
    saveToStorage(STORAGE_KEYS.CONFIG, config);
}

function loadConfig() {
    const config = loadFromStorage(STORAGE_KEYS.CONFIG);
    if (config) {
        document.getElementById("baseUrl").value = config.baseUrl || "http://localhost:8000";
        document.getElementById("authToken").value = config.authToken || "";
    }
}

document.getElementById("baseUrl").addEventListener("input", saveConfig);
document.getElementById("authToken").addEventListener("input", saveConfig);

// ==================== 히스토리 ====================
function loadHistory() {
    const saved = loadFromStorage(STORAGE_KEYS.HISTORY);
    if (saved && typeof saved === "object") {
        testHistory = saved;
    }
}

function saveHistory() {
    saveToStorage(STORAGE_KEYS.HISTORY, testHistory);
}

function addToHistory(baseUrl, testName, result) {
    if (!testHistory[baseUrl]) {
        testHistory[baseUrl] = {};
    }
    if (!testHistory[baseUrl][testName]) {
        testHistory[baseUrl][testName] = [];
    }

    testHistory[baseUrl][testName].unshift({
        timestamp: new Date().toISOString(),
        result: result,
    });

    // 테스트 이름당 최대 20개
    if (testHistory[baseUrl][testName].length > 20) {
        testHistory[baseUrl][testName] = testHistory[baseUrl][testName].slice(0, 20);
    }

    saveHistory();
    renderHistory();
}

function clearHistory() {
    if (confirm("모든 히스토리를 삭제할까요?")) {
        testHistory = {};
        saveHistory();
        renderHistory();
    }
}

// ==================== 테스트 이름 추천 ====================
function getTestNameSuggestions() {
    const baseUrl = document.getElementById("baseUrl").value.trim().replace(/\/$/, "");
    const endpoint = document.getElementById("testEndpoint").value.trim();
    const fullKey = baseUrl + endpoint;

    const suggestions = new Set();

    // 현재 baseUrl의 모든 테스트 이름
    if (testHistory[baseUrl]) {
        Object.keys(testHistory[baseUrl]).forEach((name) => {
            // endpoint가 일치하는 것 우선
            const entries = testHistory[baseUrl][name];
            if (entries.length > 0 && entries[0].result.endpoint === endpoint) {
                suggestions.add(name);
            }
        });
    }

    return Array.from(suggestions);
}

function onEndpointInput() {
    const suggestions = getTestNameSuggestions();
    if (suggestions.length > 0) {
        document.getElementById("testName").value = suggestions[0];
    }
    updateNameSuggestions();
}

function showNameSuggestions() {
    updateNameSuggestions();
    document.getElementById("nameSuggestions").classList.add("show");
}

function updateNameSuggestions() {
    const suggestions = getTestNameSuggestions();
    const container = document.getElementById("nameSuggestions");

    if (suggestions.length === 0) {
        container.classList.remove("show");
        return;
    }

    container.innerHTML = suggestions.map((name) => `<div class="suggestion-item" onclick="selectNameSuggestion('${escapeHtml(name)}')">${escapeHtml(name)}</div>`).join("");
}

function filterNameSuggestions() {
    const input = document.getElementById("testName").value.toLowerCase();
    const items = document.querySelectorAll("#nameSuggestions .suggestion-item");
    items.forEach((item) => {
        item.style.display = item.textContent.toLowerCase().includes(input) ? "block" : "none";
    });
}

function selectNameSuggestion(name) {
    document.getElementById("testName").value = name;
    document.getElementById("nameSuggestions").classList.remove("show");
}

// 클릭 외부시 닫기
document.addEventListener("click", (e) => {
    if (!e.target.closest(".suggestion")) {
        document.getElementById("nameSuggestions").classList.remove("show");
    }
});

// ==================== 테스트 실행 ====================
async function runTest() {
    const baseUrl = document.getElementById("baseUrl").value.trim().replace(/\/$/, "");
    const authToken = document.getElementById("authToken").value.trim();
    const method = document.getElementById("testMethod").value;
    const endpoint = document.getElementById("testEndpoint").value.trim();
    const expectedStatus = parseInt(document.getElementById("testExpectedStatus").value) || 200;
    const testName = document.getElementById("testName").value.trim() || `${method} ${endpoint}`;
    const headersText = document.getElementById("testHeaders").value.trim();
    const bodyText = document.getElementById("testBody").value.trim();
    const expectedResponseText = document.getElementById("testExpectedResponse").value.trim();

    if (!baseUrl || !endpoint) {
        alert("Base URL과 Endpoint를 입력해주세요.");
        return;
    }

    let customHeaders = null;
    let body = null;
    let expectedResponse = null;

    try {
        if (headersText) customHeaders = JSON.parse(headersText);
        if (bodyText) body = JSON.parse(bodyText);
        if (expectedResponseText) expectedResponse = JSON.parse(expectedResponseText);
    } catch (e) {
        alert("JSON 형식이 올바르지 않습니다.");
        return;
    }

    const runBtn = document.getElementById("runBtn");
    runBtn.disabled = true;
    runBtn.textContent = "테스트 실행 중...";

    const result = await executeTest(baseUrl, authToken, {
        name: testName,
        method,
        endpoint,
        expectedStatus,
        customHeaders,
        body,
        expectedResponse,
    });

    displayResult(result);
    addToHistory(baseUrl, testName, result);

    runBtn.disabled = false;
    runBtn.textContent = "🚀 테스트 실행";
}

async function executeTest(baseUrl, authToken, testCase) {
    const url = `${baseUrl}${testCase.endpoint}`;
    const headers = { "Content-Type": "application/json" };

    // 커스텀 헤더 병합
    if (testCase.customHeaders) {
        Object.assign(headers, testCase.customHeaders);
    }

    if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
    }

    const result = {
        testName: testCase.name,
        method: testCase.method,
        endpoint: testCase.endpoint,
        fullUrl: url,
        success: false,
        statusCode: null,
        expectedStatus: testCase.expectedStatus,
        customHeaders: testCase.customHeaders,
        requestHeaders: { ...headers },
        requestBody: testCase.body,
        responseBody: null,
        responseHeaders: {},
        errorMessage: "",
        duration: 0,
    };

    const startTime = performance.now();

    try {
        const fetchOptions = { method: testCase.method, headers };

        if (testCase.body && !["GET", "HEAD"].includes(testCase.method)) {
            fetchOptions.body = JSON.stringify(testCase.body);
        }

        const response = await fetch(url, fetchOptions);
        result.statusCode = response.status;
        result.duration = Math.round(performance.now() - startTime);

        response.headers.forEach((value, key) => {
            result.responseHeaders[key] = value;
        });

        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
            result.responseBody = await response.json();
        } else {
            result.responseBody = await response.text();
        }

        const statusMatch = response.status === testCase.expectedStatus;

        let contentMatch = true;
        if (testCase.expectedResponse && typeof result.responseBody === "object") {
            for (const [key, expectedValue] of Object.entries(testCase.expectedResponse)) {
                if (!(key in result.responseBody)) {
                    contentMatch = false;
                    result.errorMessage = `응답에 '${key}' 필드가 없습니다`;
                    break;
                }
                if (expectedValue !== null && result.responseBody[key] !== expectedValue) {
                    contentMatch = false;
                    result.errorMessage = `'${key}' 값 불일치: 예상=${expectedValue}, 실제=${result.responseBody[key]}`;
                    break;
                }
            }
        }

        if (!statusMatch) {
            result.errorMessage = `상태 코드 불일치: 예상=${testCase.expectedStatus}, 실제=${response.status}`;
        }

        result.success = statusMatch && contentMatch;
    } catch (error) {
        result.duration = Math.round(performance.now() - startTime);
        result.errorMessage = `요청 실패: ${error.message}`;
    }

    return result;
}

// ==================== 결과 표시 ====================
function displayResult(result) {
    const container = document.getElementById("resultContainer");
    container.innerHTML = `
        <div class="result-card ${result.success ? "success" : "failed"}">
          <div class="result-header">
            <span class="result-title">${result.success ? "✅" : "❌"} ${escapeHtml(result.testName)}</span>
            <span class="result-badge ${result.success ? "success" : "failed"}">
              ${result.success ? "성공" : "실패"}
            </span>
          </div>
          <div class="result-meta">
            <span style="color: ${getMethodColor(result.method)}">${result.method}</span>
            <span>${escapeHtml(result.endpoint)}</span>
            <span>상태: ${result.statusCode || "N/A"} (예상: ${result.expectedStatus})</span>
            <span>${result.duration}ms</span>
          </div>
          ${result.errorMessage ? `<div class="result-error">⚠️ ${escapeHtml(result.errorMessage)}</div>` : ""}
          <div class="detail-grid">
            <div class="detail-box">
              <div class="detail-box-title">📤 Request Headers</div>
              <div class="detail-box-content">${formatJson(result.requestHeaders) || "(없음)"}</div>
            </div>
            <div class="detail-box">
              <div class="detail-box-title">📥 Response Headers</div>
              <div class="detail-box-content">${formatJson(result.responseHeaders) || "(없음)"}</div>
            </div>
          </div>
          <div class="detail-grid" style="margin-top: 12px;">
            <div class="detail-box">
              <div class="detail-box-title">📤 Request Body</div>
              <div class="detail-box-content">${formatJson(result.requestBody) || "(없음)"}</div>
            </div>
            <div class="detail-box">
              <div class="detail-box-title">📥 Response Body</div>
              <div class="detail-box-content">${formatJson(result.responseBody) || "(없음)"}</div>
            </div>
          </div>
        </div>
      `;
}

// ==================== 히스토리 렌더링 ====================
function renderHistory() {
    const container = document.getElementById("historyContainer");
    const urls = Object.keys(testHistory);

    if (urls.length === 0) {
        container.innerHTML = '<div class="empty-state">저장된 테스트 히스토리가 없습니다.</div>';
        return;
    }

    container.innerHTML = urls
        .map((baseUrl) => {
            const testNames = Object.keys(testHistory[baseUrl]);
            const totalCount = testNames.reduce((sum, name) => sum + testHistory[baseUrl][name].length, 0);

            return `
          <div class="history-group">
            <div class="history-group-header" onclick="toggleGroup(this)">
              <span class="url">${escapeHtml(baseUrl)}</span>
              <span class="meta">
                <span>${testNames.length}개 테스트</span>
                <span class="toggle-icon">▼</span>
              </span>
            </div>
            <div class="history-group-content">
              ${testNames
                  .map((testName) => {
                      const entries = testHistory[baseUrl][testName];
                      const latestSuccess = entries[0]?.result.success;
                      return `
                  <div class="test-name-group">
                    <div class="test-name-header" onclick="toggleTestName(this)" style="border-color: ${latestSuccess ? "#2ed573" : "#ff4757"}">
                      <span class="name">${latestSuccess ? "✅" : "❌"} ${escapeHtml(testName)}</span>
                      <span class="count">${entries.length}회 실행</span>
                    </div>
                    <div class="test-name-content">
                      ${entries
                          .map(
                              (entry, idx) => `
                        <div class="history-entry ${entry.result.success ? "success" : "failed"}">
                          <div class="history-entry-header">
                            <span class="history-entry-time">${formatDateTime(entry.timestamp)}</span>
                            <span class="history-entry-status ${entry.result.success ? "success" : "failed"}">
                              ${entry.result.statusCode || "N/A"} | ${entry.result.duration}ms
                            </span>
                          </div>
                          <div class="history-entry-meta">
                            <span style="color: ${getMethodColor(entry.result.method)}">${entry.result.method}</span>
                            ${escapeHtml(entry.result.endpoint)}
                          </div>
                          <div class="history-entry-actions">
                            <button class="btn-secondary btn-small" onclick="toggleEntryDetail(this, event)">상세 ▼</button>
                            <button class="btn-secondary btn-small" onclick="loadToForm('${escapeHtml(baseUrl)}', '${escapeHtml(testName)}', ${idx})">폼에 불러오기</button>
                          </div>
                          <div class="history-detail-toggle">
                            <div class="detail-grid">
                              <div class="detail-box">
                                <div class="detail-box-title">📤 Request Headers</div>
                                <div class="detail-box-content">${formatJson(entry.result.requestHeaders) || "(없음)"}</div>
                              </div>
                              <div class="detail-box">
                                <div class="detail-box-title">📥 Response Headers</div>
                                <div class="detail-box-content">${formatJson(entry.result.responseHeaders) || "(없음)"}</div>
                              </div>
                            </div>
                            <div class="detail-grid" style="margin-top: 8px;">
                              <div class="detail-box">
                                <div class="detail-box-title">📤 Request Body</div>
                                <div class="detail-box-content">${formatJson(entry.result.requestBody) || "(없음)"}</div>
                              </div>
                              <div class="detail-box">
                                <div class="detail-box-title">📥 Response Body</div>
                                <div class="detail-box-content">${formatJson(entry.result.responseBody) || "(없음)"}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      `
                          )
                          .join("")}
                      <div style="margin-top: 10px; text-align: right;">
                        <button class="btn-danger btn-small" onclick="deleteTestName('${escapeHtml(baseUrl)}', '${escapeHtml(testName)}')">이 테스트 삭제</button>
                      </div>
                    </div>
                  </div>
                `;
                  })
                  .join("")}
              <div style="margin-top: 15px; text-align: right;">
                <button class="btn-danger btn-small" onclick="deleteBaseUrl('${escapeHtml(baseUrl)}')">이 URL 전체 삭제</button>
              </div>
            </div>
          </div>
        `;
        })
        .join("");
}

function toggleGroup(header) {
    const content = header.nextElementSibling;
    const icon = header.querySelector(".toggle-icon");
    content.classList.toggle("open");
    icon.classList.toggle("open");
}

function toggleTestName(header) {
    const content = header.nextElementSibling;
    content.classList.toggle("open");
}

function toggleEntryDetail(btn, event) {
    event.stopPropagation();
    const detail = btn.closest(".history-entry").querySelector(".history-detail-toggle");
    const isOpen = detail.classList.toggle("open");
    btn.textContent = isOpen ? "상세 ▲" : "상세 ▼";
}

function loadToForm(baseUrl, testName, entryIndex) {
    const entry = testHistory[baseUrl][testName][entryIndex];
    const result = entry.result;

    document.getElementById("baseUrl").value = baseUrl;
    document.getElementById("testName").value = testName;
    document.getElementById("testMethod").value = result.method;
    document.getElementById("testEndpoint").value = result.endpoint;
    document.getElementById("testExpectedStatus").value = result.expectedStatus;
    document.getElementById("testHeaders").value = result.customHeaders ? JSON.stringify(result.customHeaders, null, 2) : "";
    document.getElementById("testBody").value = result.requestBody ? JSON.stringify(result.requestBody, null, 2) : "";

    saveConfig();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteTestName(baseUrl, testName) {
    if (confirm(`"${testName}" 테스트의 모든 기록을 삭제할까요?`)) {
        delete testHistory[baseUrl][testName];
        if (Object.keys(testHistory[baseUrl]).length === 0) {
            delete testHistory[baseUrl];
        }
        saveHistory();
        renderHistory();
    }
}

function deleteBaseUrl(baseUrl) {
    if (confirm(`"${baseUrl}"의 모든 기록을 삭제할까요?`)) {
        delete testHistory[baseUrl];
        saveHistory();
        renderHistory();
    }
}

// ==================== 유틸 ====================
function getMethodColor(method) {
    const colors = {
        GET: "#2ed573",
        POST: "#ffa502",
        PUT: "#3742fa",
        PATCH: "#a55eea",
        DELETE: "#ff4757",
    };
    return colors[method] || "#fff";
}

function formatDateTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatJson(obj) {
    if (obj === null || obj === undefined) return null;
    if (typeof obj === "string") return escapeHtml(obj);
    try {
        return escapeHtml(JSON.stringify(obj, null, 2));
    } catch (e) {
        return escapeHtml(String(obj));
    }
}

function escapeHtml(text) {
    if (typeof text !== "string") return text;
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ==================== 초기화 ====================
function init() {
    loadConfig();
    loadHistory();
    renderHistory();
}

init();
