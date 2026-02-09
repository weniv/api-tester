// ==================== Storage Module ====================
const STORAGE_KEYS = {
  CONFIG: "apiTester_config",
  COLLECTIONS: "apiTester_collections",
  ENVIRONMENTS: "apiTester_environments",
  ACCOUNTS: "apiTester_accounts",
  HISTORY: "apiTester_history",
  VARIABLES: "apiTester_variables",
};

const Storage = {
  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error("Storage save failed:", e);
      return false;
    }
  },

  load(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error("Storage load failed:", e);
      return defaultValue;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error("Storage remove failed:", e);
      return false;
    }
  },

  clear() {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
  },
};

// ==================== Config ====================
const Config = {
  defaults: {
    currentEnv: "default",
    sidebarOpen: true,
    activeCollection: null,
  },

  get() {
    return Storage.load(STORAGE_KEYS.CONFIG, this.defaults);
  },

  set(config) {
    const current = this.get();
    return Storage.save(STORAGE_KEYS.CONFIG, { ...current, ...config });
  },

  reset() {
    return Storage.save(STORAGE_KEYS.CONFIG, this.defaults);
  },
};

// ==================== Environments ====================
const Environments = {
  defaults: {
    default: {
      name: "Default",
      variables: {
        BASE_URL: "http://localhost:8000",
        API_KEY: "",
      },
    },
  },

  getAll() {
    return Storage.load(STORAGE_KEYS.ENVIRONMENTS, this.defaults);
  },

  get(envId) {
    const envs = this.getAll();
    return envs[envId] || null;
  },

  set(envId, data) {
    const envs = this.getAll();
    envs[envId] = data;
    return Storage.save(STORAGE_KEYS.ENVIRONMENTS, envs);
  },

  delete(envId) {
    if (envId === "default") return false;
    const envs = this.getAll();
    delete envs[envId];
    return Storage.save(STORAGE_KEYS.ENVIRONMENTS, envs);
  },

  getVariable(key) {
    const config = Config.get();
    const env = this.get(config.currentEnv);
    return env?.variables?.[key] || "";
  },

  setVariable(key, value) {
    const config = Config.get();
    const env = this.get(config.currentEnv);
    if (env) {
      env.variables[key] = value;
      return this.set(config.currentEnv, env);
    }
    return false;
  },
};

// ==================== Accounts ====================
const Accounts = {
  defaults: {
    1: { email: "", password: "", token: "", refresh: "", pk: null, nickname: "", name: "" },
    2: { email: "", password: "", token: "", refresh: "", pk: null, nickname: "", name: "" },
  },

  getAll() {
    return Storage.load(STORAGE_KEYS.ACCOUNTS, this.defaults);
  },

  get(accountId) {
    const accounts = this.getAll();
    return accounts[accountId] || null;
  },

  set(accountId, data) {
    const accounts = this.getAll();
    accounts[accountId] = { ...accounts[accountId], ...data };
    return Storage.save(STORAGE_KEYS.ACCOUNTS, accounts);
  },

  clear(accountId) {
    return this.set(accountId, this.defaults[accountId]);
  },

  clearAll() {
    return Storage.save(STORAGE_KEYS.ACCOUNTS, this.defaults);
  },
};

// ==================== Collections ====================
const Collections = {
  getAll() {
    return Storage.load(STORAGE_KEYS.COLLECTIONS, []);
  },

  get(collectionId) {
    const collections = this.getAll();
    return collections.find((c) => c.id === collectionId) || null;
  },

  add(collection) {
    const collections = this.getAll();
    collection.id = collection.id || `col_${Date.now()}`;
    collection.createdAt = new Date().toISOString();
    collections.push(collection);
    Storage.save(STORAGE_KEYS.COLLECTIONS, collections);
    return collection;
  },

  update(collectionId, data) {
    const collections = this.getAll();
    const index = collections.findIndex((c) => c.id === collectionId);
    if (index !== -1) {
      collections[index] = { ...collections[index], ...data, updatedAt: new Date().toISOString() };
      return Storage.save(STORAGE_KEYS.COLLECTIONS, collections);
    }
    return false;
  },

  delete(collectionId) {
    const collections = this.getAll();
    const filtered = collections.filter((c) => c.id !== collectionId);
    return Storage.save(STORAGE_KEYS.COLLECTIONS, filtered);
  },

  addTest(collectionId, test) {
    const collection = this.get(collectionId);
    if (collection) {
      test.id = test.id || `test_${Date.now()}`;
      collection.tests = collection.tests || [];
      collection.tests.push(test);
      return this.update(collectionId, collection);
    }
    return false;
  },

  updateTest(collectionId, testId, data) {
    const collection = this.get(collectionId);
    if (collection && collection.tests) {
      const testIndex = collection.tests.findIndex((t) => t.id === testId);
      if (testIndex !== -1) {
        collection.tests[testIndex] = { ...collection.tests[testIndex], ...data };
        return this.update(collectionId, collection);
      }
    }
    return false;
  },

  deleteTest(collectionId, testId) {
    const collection = this.get(collectionId);
    if (collection && collection.tests) {
      collection.tests = collection.tests.filter((t) => t.id !== testId);
      return this.update(collectionId, collection);
    }
    return false;
  },

  export(collectionId) {
    const collection = this.get(collectionId);
    if (collection) {
      return JSON.stringify(collection, null, 2);
    }
    return null;
  },

  import(jsonString) {
    try {
      const collection = JSON.parse(jsonString);
      collection.id = `col_${Date.now()}`;
      collection.importedAt = new Date().toISOString();
      return this.add(collection);
    } catch (e) {
      console.error("Collection import failed:", e);
      return null;
    }
  },
};

// ==================== History ====================
const History = {
  maxEntries: 100,

  getAll() {
    return Storage.load(STORAGE_KEYS.HISTORY, []);
  },

  add(entry) {
    const history = this.getAll();
    entry.id = `hist_${Date.now()}`;
    entry.timestamp = new Date().toISOString();
    history.unshift(entry);

    if (history.length > this.maxEntries) {
      history.length = this.maxEntries;
    }

    Storage.save(STORAGE_KEYS.HISTORY, history);
    return entry;
  },

  clear() {
    return Storage.save(STORAGE_KEYS.HISTORY, []);
  },

  getByEndpoint(endpoint) {
    const history = this.getAll();
    return history.filter((h) => h.endpoint === endpoint);
  },
};

// ==================== Variables (Runtime) ====================
const Variables = {
  runtime: {},

  set(key, value) {
    this.runtime[key] = value;
  },

  get(key) {
    // 먼저 런타임 변수 확인
    if (key in this.runtime) {
      return this.runtime[key];
    }
    // 환경 변수 확인
    return Environments.getVariable(key);
  },

  clear() {
    this.runtime = {};
  },

  // 문자열 내 변수 치환 {{VAR_NAME}}
  interpolate(str) {
    if (typeof str !== "string") return str;
    return str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      const value = this.get(varName);
      return value !== undefined ? value : match;
    });
  },

  // 객체 내 모든 문자열 변수 치환
  interpolateObject(obj) {
    if (typeof obj === "string") {
      return this.interpolate(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.interpolateObject(item));
    }
    if (obj && typeof obj === "object") {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.interpolateObject(value);
      }
      return result;
    }
    return obj;
  },
};

export { STORAGE_KEYS, Storage, Config, Environments, Accounts, Collections, History, Variables };
