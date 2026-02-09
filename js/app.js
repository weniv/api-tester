import { Config, Environments, Accounts, Collections, History, Variables } from "./storage.js";
import { API } from "./api.js";
import { UI } from "./ui.js";

// ==================== App Module ====================
const App = {
  state: {
    currentCollection: null,
    currentTest: null,
    results: {},
    isRunning: false,
  },

  // 초기화
  async init() {
    console.log("API Tester initializing...");

    UI.init();
    this.loadState();
    this.render();
    this.bindEvents();

    console.log("API Tester ready!");
  },

  // 상태 로드
  loadState() {
    const config = Config.get();

    // 환경 변수 로드
    const envs = Environments.getAll();
    const currentEnv = Environments.get(config.currentEnv);
    if (currentEnv) {
      for (const [key, value] of Object.entries(currentEnv.variables)) {
        Variables.set(key, value);
      }
    }

    // 계정 정보 로드
    const accounts = Accounts.getAll();
    [1, 2].forEach((id) => {
      const account = accounts[id];
      const emailEl = document.getElementById(`email${id}`);
      const passEl = document.getElementById(`password${id}`);
      if (emailEl && account.email) emailEl.value = account.email;
      if (passEl && account.password) passEl.value = account.password;
      UI.updateAccountStatus(id, account);
    });

    // Base URL 설정
    const baseUrlInput = document.getElementById("baseUrl");
    if (baseUrlInput) {
      baseUrlInput.value = Variables.get("BASE_URL") || "http://localhost:8000";
    }
  },

  // 렌더링
  render() {
    const collections = Collections.getAll();
    UI.renderApiList(collections, this.state.results);
    this.updateStats();

    const envs = Environments.getAll();
    const config = Config.get();
    UI.renderEnvSelect(envs, config.currentEnv);
  },

  // 통계 업데이트
  updateStats() {
    const results = Object.values(this.state.results);
    UI.updateStats({
      pass: results.filter((r) => r.testPassed).length,
      fail: results.filter((r) => !r.testPassed && !r.skip).length,
      skip: results.filter((r) => r.skip).length,
      pending: this.getTotalTests() - results.length,
    });
  },

  getTotalTests() {
    const collections = Collections.getAll();
    return collections.reduce((sum, col) => sum + (col.tests?.length || 0), 0);
  },

  // 이벤트 바인딩
  bindEvents() {
    // Base URL 저장
    const baseUrlInput = document.getElementById("baseUrl");
    if (baseUrlInput) {
      baseUrlInput.addEventListener("input", (e) => {
        Environments.setVariable("BASE_URL", e.target.value);
      });
    }

    // 환경 변경
    const envSelect = document.getElementById("envSelect");
    if (envSelect) {
      envSelect.addEventListener("change", (e) => {
        Config.set({ currentEnv: e.target.value });
        this.loadState();
        UI.showToast("환경이 변경되었습니다");
      });
    }
  },

  // ==================== Test 관련 ====================
  selectTest(collectionId, testId) {
    const collection = Collections.get(collectionId);
    const test = collection?.tests?.find((t) => t.id === testId);

    if (test) {
      this.state.currentCollection = collectionId;
      this.state.currentTest = testId;
      UI.setFormData(test);

      // 활성 상태 업데이트
      document.querySelectorAll(".api-item").forEach((el) => el.classList.remove("active"));
      document.querySelector(`[data-test-id="${testId}"]`)?.classList.add("active");
    }
  },

  async runCurrentTest() {
    const formData = UI.getFormData();

    if (!formData.endpoint) {
      UI.showToast("Endpoint를 입력해주세요", "error");
      return;
    }

    this.state.isRunning = true;
    this.setRunButtonState(true);

    try {
      const result = await API.runTest(formData);
      result.testName = formData.name || `${formData.method} ${formData.endpoint}`;

      this.state.results[this.state.currentTest || "single"] = result;
      UI.renderResult(result);
      this.updateStats();

      // 히스토리 저장
      History.add({
        endpoint: formData.endpoint,
        method: formData.method,
        result,
      });

      UI.showToast(result.testPassed ? "테스트 성공" : "테스트 실패", result.testPassed ? "success" : "error");
    } catch (error) {
      UI.showToast(`오류: ${error.message}`, "error");
    }

    this.state.isRunning = false;
    this.setRunButtonState(false);
  },

  async runAllTests() {
    const collections = Collections.getAll();
    if (collections.length === 0) {
      UI.showToast("테스트할 컬렉션이 없습니다", "error");
      return;
    }

    this.state.isRunning = true;
    this.state.results = {};
    this.setRunButtonState(true);
    UI.clearResults();
    UI.showProgress();

    let totalTests = this.getTotalTests();
    let completedTests = 0;

    for (const collection of collections) {
      const result = await API.runCollection(collection, {
        onProgress: ({ current, total }) => {
          completedTests++;
          UI.setProgress((completedTests / totalTests) * 100);
        },
        onTestComplete: (testResult, index) => {
          this.state.results[testResult.testId] = testResult;
          UI.renderResult(testResult);
          this.updateStats();
        },
      });
    }

    // 요약 표시
    const allResults = Object.values(this.state.results);
    UI.renderSummary({
      total: allResults.length,
      passed: allResults.filter((r) => r.testPassed).length,
      failed: allResults.filter((r) => !r.testPassed).length,
      duration: allResults.reduce((sum, r) => sum + r.duration, 0),
    });

    UI.hideProgress();
    this.state.isRunning = false;
    this.setRunButtonState(false);
    UI.showToast("전체 테스트 완료");
  },

  setRunButtonState(running) {
    const btn = document.getElementById("runBtn");
    const runAllBtn = document.getElementById("runAllBtn");

    if (btn) {
      btn.disabled = running;
      btn.innerHTML = running ? '<span class="spinner"></span> 실행 중...' : "▶ 테스트 실행";
    }

    if (runAllBtn) {
      runAllBtn.disabled = running;
      runAllBtn.innerHTML = running ? '<span class="spinner"></span> 실행 중...' : "▶ 전체 실행";
    }
  },

  // ==================== Collection 관련 ====================
  createCollection() {
    const name = UI.prompt("컬렉션 이름을 입력하세요:");
    if (!name) return;

    const collection = Collections.add({
      name,
      tests: [],
    });

    this.render();
    UI.showToast("컬렉션이 생성되었습니다");
  },

  deleteCollection(collectionId) {
    if (!UI.confirm("이 컬렉션을 삭제하시겠습니까?")) return;

    Collections.delete(collectionId);
    this.render();
    UI.showToast("컬렉션이 삭제되었습니다");
  },

  saveTestToCollection() {
    const formData = UI.getFormData();

    if (!formData.endpoint) {
      UI.showToast("Endpoint를 입력해주세요", "error");
      return;
    }

    const collections = Collections.getAll();
    if (collections.length === 0) {
      // 기본 컬렉션 생성
      Collections.add({
        name: "My Collection",
        tests: [],
      });
    }

    const collectionId = this.state.currentCollection || Collections.getAll()[0]?.id;

    if (this.state.currentTest) {
      // 기존 테스트 업데이트
      Collections.updateTest(collectionId, this.state.currentTest, formData);
      UI.showToast("테스트가 업데이트되었습니다");
    } else {
      // 새 테스트 추가
      formData.name = formData.name || `${formData.method} ${formData.endpoint}`;
      Collections.addTest(collectionId, formData);
      UI.showToast("테스트가 저장되었습니다");
    }

    this.render();
  },

  deleteTest(collectionId, testId) {
    if (!UI.confirm("이 테스트를 삭제하시겠습니까?")) return;

    Collections.deleteTest(collectionId, testId);
    this.render();
    UI.showToast("테스트가 삭제되었습니다");
  },

  // ==================== Import/Export ====================
  exportCollection(collectionId) {
    const json = Collections.export(collectionId);
    if (!json) {
      UI.showToast("컬렉션을 찾을 수 없습니다", "error");
      return;
    }

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `collection-${collectionId}.json`;
    a.click();
    URL.revokeObjectURL(url);

    UI.showToast("컬렉션이 내보내기되었습니다");
  },

  importCollection() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const collection = Collections.import(text);
        if (collection) {
          this.render();
          UI.showToast("컬렉션을 가져왔습니다");
        } else {
          UI.showToast("잘못된 파일 형식입니다", "error");
        }
      } catch (error) {
        UI.showToast(`가져오기 실패: ${error.message}`, "error");
      }
    };

    input.click();
  },

  // ==================== Account 관련 ====================
  async loginAccount(accountId) {
    const email = document.getElementById(`email${accountId}`)?.value;
    const password = document.getElementById(`password${accountId}`)?.value;

    if (!email || !password) {
      UI.showToast("이메일과 비밀번호를 입력해주세요", "error");
      return;
    }

    const baseUrl = Variables.get("BASE_URL");
    const result = await API.request({
      method: "POST",
      url: `${baseUrl}/accounts/login/`,
      body: { email, password },
    });

    if (result.success && result.responseBody) {
      const accountData = {
        email,
        password,
        token: result.responseBody.access_token || result.responseBody.access,
        refresh: result.responseBody.refresh_token || result.responseBody.refresh,
        pk: result.responseBody.user?.pk || result.responseBody.user?.id || result.responseBody.pk,
      };

      Accounts.set(accountId, accountData);
      UI.updateAccountStatus(accountId, accountData);
      UI.showToast(`계정${accountId} 로그인 성공`);
    } else {
      UI.showToast(`로그인 실패: ${result.error || result.responseBody?.detail || "알 수 없는 오류"}`, "error");
    }
  },

  clearAccount(accountId) {
    Accounts.clear(accountId);
    document.getElementById(`email${accountId}`).value = "";
    document.getElementById(`password${accountId}`).value = "";
    UI.updateAccountStatus(accountId, null);
    UI.showToast(`계정${accountId} 정보가 초기화되었습니다`);
  },

  // ==================== Environment 관련 ====================
  openEnvModal() {
    UI.openModal("envModal");
    this.renderEnvList();
  },

  renderEnvList() {
    const container = document.getElementById("envList");
    if (!container) return;

    const envs = Environments.getAll();
    container.innerHTML = Object.entries(envs)
      .map(
        ([id, env]) => `
      <div class="env-item">
        <div class="env-name">${UI.escapeHtml(env.name)}</div>
        <div class="env-variables">
          ${Object.entries(env.variables)
            .map(([key, value]) => `<div><code>${key}</code>: ${UI.escapeHtml(value)}</div>`)
            .join("")}
        </div>
        ${id !== "default" ? `<button class="btn btn-danger btn-sm" onclick="App.deleteEnv('${id}')">삭제</button>` : ""}
      </div>
    `
      )
      .join("");
  },

  addEnv() {
    const name = UI.prompt("환경 이름:");
    if (!name) return;

    const id = `env_${Date.now()}`;
    Environments.set(id, {
      name,
      variables: {
        BASE_URL: "http://localhost:8000",
      },
    });

    this.renderEnvList();
    this.render();
    UI.showToast("환경이 추가되었습니다");
  },

  deleteEnv(envId) {
    if (!UI.confirm("이 환경을 삭제하시겠습니까?")) return;

    Environments.delete(envId);
    this.renderEnvList();
    this.render();
    UI.showToast("환경이 삭제되었습니다");
  },

  // ==================== 초기화 ====================
  clearAll() {
    if (!UI.confirm("모든 데이터를 초기화하시겠습니까?")) return;

    this.state.results = {};
    UI.clearResults();
    this.updateStats();
    UI.showToast("초기화되었습니다");
  },

  clearHistory() {
    if (!UI.confirm("모든 히스토리를 삭제하시겠습니까?")) return;

    History.clear();
    UI.showToast("히스토리가 삭제되었습니다");
  },
};

// 전역 접근 가능하도록
window.App = App;

// DOM 로드 후 초기화
document.addEventListener("DOMContentLoaded", () => App.init());

export { App };
