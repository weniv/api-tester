import { Variables, Accounts } from "./storage.js";

// ==================== API Module ====================
const API = {
  // 기본 fetch 래퍼
  async request(options) {
    const {
      method = "GET",
      url,
      headers = {},
      body = null,
      timeout = 30000,
      accountId = null,
    } = options;

    // URL 변수 치환
    const interpolatedUrl = Variables.interpolate(url);

    // 헤더 구성
    const requestHeaders = { ...headers };

    // Content-Type 기본값
    if (body && !requestHeaders["Content-Type"]) {
      requestHeaders["Content-Type"] = "application/json";
    }

    // 계정 토큰 자동 주입
    if (accountId) {
      const account = Accounts.get(accountId);
      if (account?.token) {
        requestHeaders["Authorization"] = `Bearer ${account.token}`;
      }
    }

    // 헤더 변수 치환
    for (const [key, value] of Object.entries(requestHeaders)) {
      requestHeaders[key] = Variables.interpolate(value);
    }

    // Body 변수 치환
    let requestBody = null;
    if (body && !["GET", "HEAD"].includes(method)) {
      const interpolatedBody = Variables.interpolateObject(body);
      requestBody = JSON.stringify(interpolatedBody);
    }

    const result = {
      url: interpolatedUrl,
      method,
      requestHeaders,
      requestBody: body,
      responseHeaders: {},
      responseBody: null,
      status: null,
      statusText: "",
      duration: 0,
      success: false,
      error: null,
    };

    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(interpolatedUrl, {
        method,
        headers: requestHeaders,
        body: requestBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      result.duration = Math.round(performance.now() - startTime);
      result.status = response.status;
      result.statusText = response.statusText;

      // 응답 헤더 수집
      response.headers.forEach((value, key) => {
        result.responseHeaders[key] = value;
      });

      // 응답 본문 파싱
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        result.responseBody = await response.json();
      } else {
        result.responseBody = await response.text();
      }

      result.success = response.ok;
    } catch (error) {
      clearTimeout(timeoutId);
      result.duration = Math.round(performance.now() - startTime);

      if (error.name === "AbortError") {
        result.error = `Timeout after ${timeout}ms`;
      } else {
        result.error = error.message;
      }
    }

    return result;
  },

  // 테스트 실행
  async runTest(test, options = {}) {
    const { accountId = null, extractVariables = true } = options;

    const baseUrl = Variables.get("BASE_URL") || "";
    const url = test.endpoint.startsWith("http") ? test.endpoint : `${baseUrl}${test.endpoint}`;

    const result = await this.request({
      method: test.method,
      url,
      headers: test.headers || {},
      body: test.body || null,
      accountId: test.accountId || accountId,
    });

    // 변수 추출
    if (extractVariables && test.extract && result.responseBody) {
      this.extractVariables(test.extract, result.responseBody);
    }

    // 검증
    result.assertions = this.runAssertions(test.assertions || [], result);
    result.testPassed =
      result.assertions.length === 0 || result.assertions.every((a) => a.passed);

    // 기본 상태 코드 검증
    if (test.expectedStatus) {
      const statusMatch = result.status === test.expectedStatus;
      if (!statusMatch) {
        result.testPassed = false;
        result.assertions.push({
          type: "status",
          expected: test.expectedStatus,
          actual: result.status,
          passed: false,
          message: `Expected status ${test.expectedStatus}, got ${result.status}`,
        });
      }
    }

    return result;
  },

  // 변수 추출 (JSONPath 간단 구현)
  extractVariables(extractRules, data) {
    for (const [varName, path] of Object.entries(extractRules)) {
      const value = this.getValueByPath(data, path);
      if (value !== undefined) {
        Variables.set(varName, value);
      }
    }
  },

  // 간단한 JSONPath 구현
  getValueByPath(obj, path) {
    // $.user.id 형식 지원
    const parts = path.replace(/^\$\.?/, "").split(".");
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;

      // 배열 인덱스 지원: items[0]
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        current = current[arrayMatch[1]];
        if (Array.isArray(current)) {
          current = current[parseInt(arrayMatch[2])];
        }
      } else {
        current = current[part];
      }
    }

    return current;
  },

  // Assertion 실행
  runAssertions(assertions, result) {
    return assertions.map((assertion) => {
      const assertResult = { ...assertion, passed: false, actual: null, message: "" };

      try {
        switch (assertion.type) {
          case "status":
            assertResult.actual = result.status;
            assertResult.passed = result.status === assertion.expected;
            assertResult.message = assertResult.passed
              ? "Status code matched"
              : `Expected ${assertion.expected}, got ${result.status}`;
            break;

          case "json_path":
            assertResult.actual = this.getValueByPath(result.responseBody, assertion.path);
            assertResult.passed = this.compareValues(
              assertResult.actual,
              assertion.operator || "eq",
              assertion.value
            );
            assertResult.message = assertResult.passed
              ? "JSON path assertion passed"
              : `Expected ${assertion.path} ${assertion.operator || "eq"} ${assertion.value}, got ${assertResult.actual}`;
            break;

          case "contains":
            const containsValue = this.getValueByPath(result.responseBody, assertion.path);
            assertResult.actual = containsValue;
            assertResult.passed =
              typeof containsValue === "string" && containsValue.includes(assertion.value);
            assertResult.message = assertResult.passed
              ? "Contains assertion passed"
              : `Expected "${assertion.path}" to contain "${assertion.value}"`;
            break;

          case "response_time":
            assertResult.actual = result.duration;
            assertResult.passed = result.duration <= assertion.max_ms;
            assertResult.message = assertResult.passed
              ? "Response time within limit"
              : `Response time ${result.duration}ms exceeded ${assertion.max_ms}ms`;
            break;

          case "exists":
            const existsValue = this.getValueByPath(result.responseBody, assertion.path);
            assertResult.actual = existsValue !== undefined;
            assertResult.passed = existsValue !== undefined;
            assertResult.message = assertResult.passed
              ? "Field exists"
              : `Field "${assertion.path}" does not exist`;
            break;

          default:
            assertResult.message = `Unknown assertion type: ${assertion.type}`;
        }
      } catch (error) {
        assertResult.message = `Assertion error: ${error.message}`;
      }

      return assertResult;
    });
  },

  // 값 비교
  compareValues(actual, operator, expected) {
    switch (operator) {
      case "eq":
        return actual === expected;
      case "ne":
        return actual !== expected;
      case "gt":
        return actual > expected;
      case "gte":
        return actual >= expected;
      case "lt":
        return actual < expected;
      case "lte":
        return actual <= expected;
      case "contains":
        return typeof actual === "string" && actual.includes(expected);
      case "startsWith":
        return typeof actual === "string" && actual.startsWith(expected);
      case "endsWith":
        return typeof actual === "string" && actual.endsWith(expected);
      case "regex":
        return new RegExp(expected).test(actual);
      default:
        return actual === expected;
    }
  },

  // 컬렉션 전체 실행
  async runCollection(collection, options = {}) {
    const { onProgress, onTestComplete, stopOnFailure = false } = options;
    const results = [];
    const tests = collection.tests || [];

    Variables.clear();

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];

      if (onProgress) {
        onProgress({ current: i + 1, total: tests.length, test });
      }

      const result = await this.runTest(test);
      result.testName = test.name;
      result.testId = test.id;
      results.push(result);

      if (onTestComplete) {
        onTestComplete(result, i);
      }

      if (stopOnFailure && !result.testPassed) {
        break;
      }

      // 요청 간 딜레이
      if (i < tests.length - 1) {
        await this.delay(200);
      }
    }

    return {
      collection: collection.name,
      results,
      summary: {
        total: results.length,
        passed: results.filter((r) => r.testPassed).length,
        failed: results.filter((r) => !r.testPassed).length,
        duration: results.reduce((sum, r) => sum + r.duration, 0),
      },
    };
  },

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  // 코드 스니펫 생성
  generateSnippet(test, format = "curl") {
    const baseUrl = Variables.get("BASE_URL") || "";
    const url = test.endpoint.startsWith("http") ? test.endpoint : `${baseUrl}${test.endpoint}`;

    switch (format) {
      case "curl":
        return this.generateCurl(test, url);
      case "fetch":
        return this.generateFetch(test, url);
      case "python":
        return this.generatePython(test, url);
      default:
        return "";
    }
  },

  generateCurl(test, url) {
    let cmd = `curl -X ${test.method} '${url}'`;

    if (test.headers) {
      for (const [key, value] of Object.entries(test.headers)) {
        cmd += ` \\\n  -H '${key}: ${value}'`;
      }
    }

    if (test.body && !["GET", "HEAD"].includes(test.method)) {
      cmd += ` \\\n  -H 'Content-Type: application/json'`;
      cmd += ` \\\n  -d '${JSON.stringify(test.body)}'`;
    }

    return cmd;
  },

  generateFetch(test, url) {
    const options = {
      method: test.method,
      headers: { ...test.headers },
    };

    if (test.body && !["GET", "HEAD"].includes(test.method)) {
      options.headers["Content-Type"] = "application/json";
      options.body = "JSON.stringify(body)";
    }

    let code = `const response = await fetch('${url}', {\n`;
    code += `  method: '${test.method}',\n`;
    code += `  headers: ${JSON.stringify(options.headers, null, 4).replace(/\n/g, "\n  ")},\n`;

    if (test.body) {
      code += `  body: JSON.stringify(${JSON.stringify(test.body, null, 4).replace(/\n/g, "\n  ")})\n`;
    }

    code += `});\n\nconst data = await response.json();`;
    return code;
  },

  generatePython(test, url) {
    let code = `import requests\n\n`;
    code += `url = '${url}'\n`;

    if (test.headers && Object.keys(test.headers).length > 0) {
      code += `headers = ${JSON.stringify(test.headers, null, 4)}\n`;
    }

    if (test.body) {
      code += `data = ${JSON.stringify(test.body, null, 4)}\n`;
    }

    code += `\nresponse = requests.${test.method.toLowerCase()}(url`;

    if (test.headers && Object.keys(test.headers).length > 0) {
      code += `, headers=headers`;
    }

    if (test.body) {
      code += `, json=data`;
    }

    code += `)\nprint(response.json())`;
    return code;
  },
};

export { API };
