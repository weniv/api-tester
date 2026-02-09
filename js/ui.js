// ==================== UI Module ====================
const UI = {
  // DOM 요소 캐시
  elements: {},

  // 초기화
  init() {
    this.cacheElements();
    this.bindEvents();
  },

  // 요소 캐싱
  cacheElements() {
    this.elements = {
      // Sidebar
      apiList: document.getElementById("apiList"),
      statsPass: document.getElementById("statsPass"),
      statsFail: document.getElementById("statsFail"),
      statsSkip: document.getElementById("statsSkip"),
      statsPending: document.getElementById("statsPending"),

      // Toolbar
      envSelect: document.getElementById("envSelect"),
      baseUrlInput: document.getElementById("baseUrl"),

      // Account inputs
      email1: document.getElementById("email1"),
      password1: document.getElementById("password1"),
      tokenStatus1: document.getElementById("tokenStatus1"),
      email2: document.getElementById("email2"),
      password2: document.getElementById("password2"),
      tokenStatus2: document.getElementById("tokenStatus2"),

      // Test form
      testName: document.getElementById("testName"),
      testMethod: document.getElementById("testMethod"),
      testEndpoint: document.getElementById("testEndpoint"),
      testHeaders: document.getElementById("testHeaders"),
      testBody: document.getElementById("testBody"),
      expectedStatus: document.getElementById("expectedStatus"),
      extractRules: document.getElementById("extractRules"),

      // Panels
      resultPanel: document.getElementById("resultPanel"),
      progressBar: document.getElementById("progressBar"),
      progressFill: document.getElementById("progressFill"),

      // Modals
      envModal: document.getElementById("envModal"),
      collectionModal: document.getElementById("collectionModal"),

      // Toast
      toast: document.getElementById("toast"),
    };
  },

  // 이벤트 바인딩
  bindEvents() {
    // 모달 닫기
    document.querySelectorAll(".modal-close").forEach((btn) => {
      btn.addEventListener("click", () => this.closeAllModals());
    });

    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) this.closeAllModals();
      });
    });

    // ESC로 모달 닫기
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeAllModals();
    });
  },

  // ==================== Toast ====================
  showToast(message, type = "success", duration = 2000) {
    const toast = this.elements.toast;
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
      toast.classList.remove("show");
    }, duration);
  },

  // ==================== Modal ====================
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("active");
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("active");
    }
  },

  closeAllModals() {
    document.querySelectorAll(".modal-overlay").forEach((modal) => {
      modal.classList.remove("active");
    });
  },

  // ==================== Stats ====================
  updateStats(stats) {
    if (this.elements.statsPass) this.elements.statsPass.textContent = stats.pass || 0;
    if (this.elements.statsFail) this.elements.statsFail.textContent = stats.fail || 0;
    if (this.elements.statsSkip) this.elements.statsSkip.textContent = stats.skip || 0;
    if (this.elements.statsPending) this.elements.statsPending.textContent = stats.pending || 0;
  },

  // ==================== Progress Bar ====================
  showProgress() {
    if (this.elements.progressBar) {
      this.elements.progressBar.classList.add("active");
    }
  },

  hideProgress() {
    if (this.elements.progressBar) {
      this.elements.progressBar.classList.remove("active");
    }
  },

  setProgress(percent) {
    if (this.elements.progressFill) {
      this.elements.progressFill.style.width = `${percent}%`;
    }
  },

  // ==================== API List ====================
  renderApiList(collections, results = {}) {
    const container = this.elements.apiList;
    if (!container) return;

    if (!collections || collections.length === 0) {
      container.innerHTML = '<div class="empty-state">컬렉션이 없습니다</div>';
      return;
    }

    container.innerHTML = collections
      .map(
        (collection) => `
      <div class="api-group" data-collection-id="${collection.id}">
        <div class="api-group-title" onclick="UI.toggleGroup(this)">
          <span>${this.escapeHtml(collection.name)} (${collection.tests?.length || 0})</span>
          <span class="chevron">▼</span>
        </div>
        <div class="api-group-items">
          ${
            collection.tests
              ?.map(
                (test) => `
            <div class="api-item ${results[test.id]?.active ? "active" : ""}"
                 data-test-id="${test.id}"
                 onclick="App.selectTest('${collection.id}', '${test.id}')">
              <span class="method-badge method-${test.method}">${test.method}</span>
              <span class="name">${this.escapeHtml(test.name)}</span>
              <span class="status-dot ${this.getStatusClass(results[test.id])}"></span>
            </div>
          `
              )
              .join("") || ""
          }
        </div>
      </div>
    `
      )
      .join("");
  },

  toggleGroup(titleElement) {
    titleElement.classList.toggle("collapsed");
  },

  getStatusClass(result) {
    if (!result) return "pending";
    if (result.skip) return "pending";
    return result.testPassed ? "pass" : "fail";
  },

  // ==================== Result Rendering ====================
  renderResult(result) {
    const container = this.elements.resultPanel;
    if (!container) return;

    const statusClass = this.getStatusBadgeClass(result.status);
    const statusText = result.error ? "ERR" : result.status || "-";

    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <div class="result-header" onclick="UI.toggleResultBody(this)">
        <span class="method-badge method-${result.method}">${result.method}</span>
        <span class="name">${this.escapeHtml(result.testName || "")}</span>
        <span class="path">${this.escapeHtml(result.url || "")}</span>
        <span class="status-badge ${statusClass}">${statusText}</span>
        <span class="time">${result.duration}ms</span>
      </div>
      <div class="result-body">
        <div class="result-section">
          <div class="result-section-title">URL</div>
          <pre>${this.escapeHtml(result.url || "")}</pre>
        </div>
        ${
          result.requestBody
            ? `
          <div class="result-section">
            <div class="result-section-title">Request Body</div>
            <pre>${this.formatJson(result.requestBody)}</pre>
          </div>
        `
            : ""
        }
        <div class="result-section">
          <div class="result-section-title">Response ${result.status ? `(${result.status})` : ""}</div>
          <pre>${result.error ? this.escapeHtml(result.error) : this.formatJson(result.responseBody)}</pre>
        </div>
        ${
          result.assertions?.length
            ? `
          <div class="result-section">
            <div class="result-section-title">Assertions</div>
            ${result.assertions.map((a) => this.renderAssertion(a)).join("")}
          </div>
        `
            : ""
        }
      </div>
    `;

    container.insertBefore(card, container.firstChild);
  },

  renderAssertion(assertion) {
    const icon = assertion.passed ? "✓" : "✗";
    const colorClass = assertion.passed ? "pass" : "fail";
    return `
      <div class="assertion ${colorClass}">
        <span class="assertion-icon">${icon}</span>
        <span class="assertion-message">${this.escapeHtml(assertion.message)}</span>
      </div>
    `;
  },

  toggleResultBody(header) {
    const body = header.nextElementSibling;
    body.classList.toggle("open");
  },

  getStatusBadgeClass(status) {
    if (!status) return "status-err";
    if (status >= 200 && status < 300) return "status-2xx";
    if (status >= 400 && status < 500) return "status-4xx";
    if (status >= 500) return "status-5xx";
    return "status-err";
  },

  clearResults() {
    if (this.elements.resultPanel) {
      this.elements.resultPanel.innerHTML = "";
    }
  },

  // ==================== Summary ====================
  renderSummary(summary) {
    const container = this.elements.resultPanel;
    if (!container) return;

    const summaryCard = document.createElement("div");
    summaryCard.className = "summary-card";
    summaryCard.innerHTML = `
      <div class="summary-stat">
        <div class="num">${summary.total}</div>
        <div class="label">전체</div>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-stat">
        <div class="num green">${summary.passed}</div>
        <div class="label">성공</div>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-stat">
        <div class="num red">${summary.failed}</div>
        <div class="label">실패</div>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-stat">
        <div class="num">${summary.duration}ms</div>
        <div class="label">소요시간</div>
      </div>
    `;

    container.insertBefore(summaryCard, container.firstChild);
  },

  // ==================== Account Status ====================
  updateAccountStatus(accountId, account) {
    const statusEl = document.getElementById(`tokenStatus${accountId}`);
    if (!statusEl) return;

    if (account?.token) {
      statusEl.className = "token-status ok";
      statusEl.textContent = `● pk:${account.pk || "?"}`;
    } else if (account?.email) {
      statusEl.className = "token-status no";
      statusEl.textContent = "● 토큰없음";
    } else {
      statusEl.className = "token-status no";
      statusEl.textContent = "● 미설정";
    }
  },

  // ==================== Form ====================
  getFormData() {
    return {
      name: this.elements.testName?.value || "",
      method: this.elements.testMethod?.value || "GET",
      endpoint: this.elements.testEndpoint?.value || "",
      headers: this.parseJson(this.elements.testHeaders?.value),
      body: this.parseJson(this.elements.testBody?.value),
      expectedStatus: parseInt(this.elements.expectedStatus?.value) || 200,
      extract: this.parseJson(this.elements.extractRules?.value),
    };
  },

  setFormData(data) {
    if (this.elements.testName) this.elements.testName.value = data.name || "";
    if (this.elements.testMethod) this.elements.testMethod.value = data.method || "GET";
    if (this.elements.testEndpoint) this.elements.testEndpoint.value = data.endpoint || "";
    if (this.elements.testHeaders)
      this.elements.testHeaders.value = data.headers ? JSON.stringify(data.headers, null, 2) : "";
    if (this.elements.testBody)
      this.elements.testBody.value = data.body ? JSON.stringify(data.body, null, 2) : "";
    if (this.elements.expectedStatus)
      this.elements.expectedStatus.value = data.expectedStatus || 200;
    if (this.elements.extractRules)
      this.elements.extractRules.value = data.extract ? JSON.stringify(data.extract, null, 2) : "";
  },

  clearForm() {
    this.setFormData({});
  },

  // ==================== Environment ====================
  renderEnvSelect(environments, currentEnv) {
    const select = this.elements.envSelect;
    if (!select) return;

    select.innerHTML = Object.entries(environments)
      .map(
        ([id, env]) => `
      <option value="${id}" ${id === currentEnv ? "selected" : ""}>
        ${this.escapeHtml(env.name)}
      </option>
    `
      )
      .join("");
  },

  // ==================== Utilities ====================
  escapeHtml(text) {
    if (typeof text !== "string") return text;
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  formatJson(obj) {
    if (obj === null || obj === undefined) return "(empty)";
    if (typeof obj === "string") return this.escapeHtml(obj);
    try {
      return this.escapeHtml(JSON.stringify(obj, null, 2));
    } catch {
      return this.escapeHtml(String(obj));
    }
  },

  parseJson(str) {
    if (!str || !str.trim()) return null;
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  },

  // Confirm dialog
  confirm(message) {
    return window.confirm(message);
  },

  // Prompt dialog
  prompt(message, defaultValue = "") {
    return window.prompt(message, defaultValue);
  },
};

// 전역 접근 가능하도록
window.UI = UI;

export { UI };
