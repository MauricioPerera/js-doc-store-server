var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// .wrangler/tmp/bundle-EHSH7V/checked-fetch.js
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
var urls;
var init_checked_fetch = __esm({
  ".wrangler/tmp/bundle-EHSH7V/checked-fetch.js"() {
    urls = /* @__PURE__ */ new Set();
    __name(checkURL, "checkURL");
    globalThis.fetch = new Proxy(globalThis.fetch, {
      apply(target, thisArg, argArray) {
        const [request, init] = argArray;
        checkURL(request, init);
        return Reflect.apply(target, thisArg, argArray);
      }
    });
  }
});

// wrangler-modules-watch:wrangler:modules-watch
var init_wrangler_modules_watch = __esm({
  "wrangler-modules-watch:wrangler:modules-watch"() {
    init_checked_fetch();
    init_modules_watch_stub();
  }
});

// C:/Users/Rckflr/AppData/Roaming/nvm/v24.11.1/node_modules/wrangler/templates/modules-watch-stub.js
var init_modules_watch_stub = __esm({
  "C:/Users/Rckflr/AppData/Roaming/nvm/v24.11.1/node_modules/wrangler/templates/modules-watch-stub.js"() {
    init_wrangler_modules_watch();
  }
});

// ../js-doc-store/js-doc-store.js
var require_js_doc_store = __commonJS({
  "../js-doc-store/js-doc-store.js"(exports, module) {
    init_checked_fetch();
    init_modules_watch_stub();
    var _idCounter = 0;
    function generateId() {
      const ts = Date.now().toString(36);
      const rnd = Math.random().toString(36).slice(2, 8);
      const seq = (++_idCounter).toString(36);
      return `${ts}-${rnd}-${seq}`;
    }
    __name(generateId, "generateId");
    function matchFilter2(doc, filter) {
      if (!filter || typeof filter !== "object") return true;
      if (!doc) doc = {};
      for (const key of Object.keys(filter)) {
        if (key === "$and") {
          if (!Array.isArray(filter.$and)) return false;
          for (const sub of filter.$and) {
            if (!matchFilter2(doc, sub)) return false;
          }
          continue;
        }
        if (key === "$or") {
          if (!Array.isArray(filter.$or)) return false;
          let any = false;
          for (const sub of filter.$or) {
            if (matchFilter2(doc, sub)) {
              any = true;
              break;
            }
          }
          if (!any) return false;
          continue;
        }
        if (key === "$not") {
          if (matchFilter2(doc, filter.$not)) return false;
          continue;
        }
        const val = _getNestedValue(doc, key);
        const cond = filter[key];
        if (cond === null || cond === void 0 || typeof cond !== "object" || cond instanceof RegExp) {
          if (cond instanceof RegExp) {
            if (!cond.test(String(val ?? ""))) return false;
          } else if (val !== cond) return false;
          continue;
        }
        for (const op of Object.keys(cond)) {
          const target = cond[op];
          switch (op) {
            case "$eq":
              if (val !== target) return false;
              break;
            case "$ne":
              if (val === target) return false;
              break;
            case "$gt":
              if (!(val > target)) return false;
              break;
            case "$gte":
              if (!(val >= target)) return false;
              break;
            case "$lt":
              if (!(val < target)) return false;
              break;
            case "$lte":
              if (!(val <= target)) return false;
              break;
            case "$in":
              if (!Array.isArray(target) || !target.includes(val)) return false;
              break;
            case "$nin":
              if (Array.isArray(target) && target.includes(val)) return false;
              break;
            case "$exists":
              if (val !== void 0 !== target) return false;
              break;
            case "$regex": {
              const re = typeof target === "string" ? new RegExp(target) : target;
              if (!re.test(String(val ?? ""))) return false;
              break;
            }
            case "$contains": {
              if (!Array.isArray(val) || !val.includes(target)) return false;
              break;
            }
            case "$size": {
              if (!Array.isArray(val) || val.length !== target) return false;
              break;
            }
            case "$not": {
              if (typeof target === "object" && target !== null) {
                const subFilter = { [key]: target };
                if (matchFilter2(doc, subFilter)) return false;
              }
              break;
            }
            default:
              break;
          }
        }
      }
      return true;
    }
    __name(matchFilter2, "matchFilter");
    function _getNestedValue(obj, path) {
      if (!path.includes(".")) return obj[path];
      const parts = path.split(".");
      let current = obj;
      for (const p of parts) {
        if (current == null) return void 0;
        current = current[p];
      }
      return current;
    }
    __name(_getNestedValue, "_getNestedValue");
    function _setNestedValue(obj, path, value) {
      if (!path.includes(".")) {
        obj[path] = value;
        return;
      }
      const parts = path.split(".");
      let current = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        if (current[parts[i]] == null) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
    }
    __name(_setNestedValue, "_setNestedValue");
    function _deleteNestedValue(obj, path) {
      if (!path.includes(".")) {
        delete obj[path];
        return;
      }
      const parts = path.split(".");
      let current = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        if (current[parts[i]] == null) return;
        current = current[parts[i]];
      }
      delete current[parts[parts.length - 1]];
    }
    __name(_deleteNestedValue, "_deleteNestedValue");
    function applyUpdate(doc, update) {
      const result = JSON.parse(JSON.stringify(doc));
      for (const op of Object.keys(update)) {
        const fields = update[op];
        switch (op) {
          case "$set":
            for (const [k, v] of Object.entries(fields)) _setNestedValue(result, k, v);
            break;
          case "$unset":
            for (const k of Object.keys(fields)) _deleteNestedValue(result, k);
            break;
          case "$inc":
            for (const [k, v] of Object.entries(fields)) {
              const cur = _getNestedValue(result, k) || 0;
              _setNestedValue(result, k, cur + v);
            }
            break;
          case "$push":
            for (const [k, v] of Object.entries(fields)) {
              const arr = _getNestedValue(result, k);
              if (Array.isArray(arr)) arr.push(v);
              else _setNestedValue(result, k, [v]);
            }
            break;
          case "$pull":
            for (const [k, v] of Object.entries(fields)) {
              const arr = _getNestedValue(result, k);
              if (Array.isArray(arr)) {
                const idx = arr.indexOf(v);
                if (idx >= 0) arr.splice(idx, 1);
              }
            }
            break;
          case "$rename":
            for (const [oldKey, newKey] of Object.entries(fields)) {
              const val = _getNestedValue(result, oldKey);
              if (val !== void 0) {
                _setNestedValue(result, newKey, val);
                _deleteNestedValue(result, oldKey);
              }
            }
            break;
          default:
            if (!op.startsWith("$")) {
              const id = result._id;
              Object.assign(result, update);
              result._id = id;
              return result;
            }
        }
      }
      return result;
    }
    __name(applyUpdate, "applyUpdate");
    var _fs2 = null;
    var _path2 = null;
    function _getFs2() {
      if (!_fs2) {
        try {
          _fs2 = __require("fs");
          _path2 = __require("path");
        } catch {
          throw new Error("DocStore: entorno sin fs \u2014 usa un StorageAdapter personalizado");
        }
      }
      return { fs: _fs2, path: _path2 };
    }
    __name(_getFs2, "_getFs");
    var FileStorageAdapter2 = class {
      static {
        __name(this, "FileStorageAdapter");
      }
      constructor(dir) {
        const { fs, path } = _getFs2();
        this.dir = dir;
        this.fs = fs;
        this.path = path;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      }
      readJson(filename) {
        const file = this.path.join(this.dir, filename);
        if (!this.fs.existsSync(file)) return null;
        return JSON.parse(this.fs.readFileSync(file, "utf8"));
      }
      writeJson(filename, data) {
        const file = this.path.join(this.dir, filename);
        this.fs.writeFileSync(file, JSON.stringify(data));
      }
      delete(filename) {
        const file = this.path.join(this.dir, filename);
        if (this.fs.existsSync(file)) this.fs.unlinkSync(file);
      }
    };
    var MemoryStorageAdapter = class {
      static {
        __name(this, "MemoryStorageAdapter");
      }
      constructor() {
        this._data = /* @__PURE__ */ new Map();
      }
      readJson(k) {
        return this._data.get(k) ?? null;
      }
      writeJson(k, v) {
        this._data.set(k, v);
      }
      delete(k) {
        this._data.delete(k);
      }
    };
    var CloudflareKVAdapter2 = class {
      static {
        __name(this, "CloudflareKVAdapter");
      }
      constructor(kv, prefix = "") {
        this.kv = kv;
        this.prefix = prefix;
        this._cache = /* @__PURE__ */ new Map();
      }
      _key(f) {
        return this.prefix + f;
      }
      async preload(filenames) {
        const promises = filenames.map(async (f) => {
          const val = await this.kv.get(this._key(f), "json");
          if (val) this._cache.set(f, val);
        });
        await Promise.all(promises);
      }
      readJson(f) {
        return this._cache.get(f) ?? null;
      }
      writeJson(f, v) {
        this._cache.set(f, v);
      }
      delete(f) {
        this._cache.delete(f);
      }
      async persist() {
        const promises = [];
        for (const [f, v] of this._cache) {
          promises.push(this.kv.put(this._key(f), JSON.stringify(v)));
        }
        await Promise.all(promises);
      }
      async deleteFromKV(f) {
        this._cache.delete(f);
        await this.kv.delete(this._key(f));
      }
      /**
       * List all keys in KV under this adapter's prefix.
       * Handles KV pagination (cursor) for namespaces with >1000 keys.
       * @returns {Promise<string[]>} Filenames without the prefix
       */
      async listKeys() {
        const result = [];
        let cursor = void 0;
        do {
          const listOpts = { prefix: this.prefix };
          if (cursor) listOpts.cursor = cursor;
          const list = await this.kv.list(listOpts);
          for (const key of list.keys) {
            result.push(key.name.slice(this.prefix.length));
          }
          cursor = list.list_complete === false ? list.cursor : void 0;
        } while (cursor);
        return result;
      }
      /**
       * Preload all files available under this prefix.
       * Convenience wrapper: equivalent to `preload(await listKeys())`.
       * @returns {Promise<void>}
       */
      async preloadAll() {
        const keys = await this.listKeys();
        if (keys.length > 0) await this.preload(keys);
      }
    };
    var HashIndex = class {
      static {
        __name(this, "HashIndex");
      }
      constructor(field, opts = {}) {
        this.field = field;
        this.unique = !!opts.unique;
        this._map = /* @__PURE__ */ new Map();
      }
      add(doc) {
        const val = _getNestedValue(doc, this.field);
        if (val === void 0) return;
        const key = String(val);
        if (this.unique && this._map.has(key)) {
          const existing = this._map.get(key);
          if (existing.size > 0 && !existing.has(doc._id)) {
            throw new Error(`Unique constraint violated: ${this.field} = "${val}"`);
          }
        }
        if (!this._map.has(key)) this._map.set(key, /* @__PURE__ */ new Set());
        this._map.get(key).add(doc._id);
      }
      remove(doc) {
        const val = _getNestedValue(doc, this.field);
        if (val === void 0) return;
        const key = String(val);
        const set = this._map.get(key);
        if (set) {
          set.delete(doc._id);
          if (set.size === 0) this._map.delete(key);
        }
      }
      lookup(value) {
        const set = this._map.get(String(value));
        return set ? Array.from(set) : [];
      }
      has(value) {
        const set = this._map.get(String(value));
        return set ? set.size > 0 : false;
      }
      clear() {
        this._map.clear();
      }
      rebuild(docs) {
        this._map.clear();
        for (const doc of docs) this.add(doc);
      }
      exportState() {
        const obj = {};
        for (const [k, v] of this._map) obj[k] = Array.from(v);
        return { field: this.field, unique: this.unique, data: obj };
      }
      importState(state) {
        this._map.clear();
        for (const [k, ids] of Object.entries(state.data)) {
          this._map.set(k, new Set(ids));
        }
      }
    };
    var SortedIndex = class {
      static {
        __name(this, "SortedIndex");
      }
      constructor(field) {
        this.field = field;
        this._entries = [];
      }
      add(doc) {
        const val = _getNestedValue(doc, this.field);
        if (val === void 0) return;
        const entry = { value: val, _id: doc._id };
        let lo = 0, hi = this._entries.length;
        while (lo < hi) {
          const mid = lo + hi >> 1;
          if (this._entries[mid].value < val) lo = mid + 1;
          else hi = mid;
        }
        this._entries.splice(lo, 0, entry);
      }
      remove(doc) {
        const val = _getNestedValue(doc, this.field);
        if (val === void 0) return;
        for (let i = 0; i < this._entries.length; i++) {
          if (this._entries[i]._id === doc._id && this._entries[i].value === val) {
            this._entries.splice(i, 1);
            return;
          }
        }
      }
      /** Range query: retorna _ids donde value esta en [min, max]. */
      range(min, max, opts = {}) {
        const excludeMin = !!opts.excludeMin;
        const excludeMax = !!opts.excludeMax;
        let lo = 0, hi = this._entries.length;
        while (lo < hi) {
          const mid = lo + hi >> 1;
          if (excludeMin ? this._entries[mid].value <= min : this._entries[mid].value < min) lo = mid + 1;
          else hi = mid;
        }
        const ids = [];
        for (let i = lo; i < this._entries.length; i++) {
          const v = this._entries[i].value;
          if (excludeMax ? v >= max : v > max) break;
          ids.push(this._entries[i]._id);
        }
        return ids;
      }
      /** Retorna todos los _ids ordenados. asc=true ascendente. */
      all(asc = true) {
        if (asc) return this._entries.map((e) => e._id);
        return this._entries.slice().reverse().map((e) => e._id);
      }
      clear() {
        this._entries = [];
      }
      rebuild(docs) {
        this._entries = [];
        for (const doc of docs) this.add(doc);
      }
      exportState() {
        return { field: this.field, entries: this._entries };
      }
      importState(state) {
        this._entries = state.entries || [];
      }
    };
    var _clone = typeof structuredClone === "function" ? (obj) => structuredClone(obj) : (obj) => JSON.parse(JSON.stringify(obj));
    var Cursor = class {
      static {
        __name(this, "Cursor");
      }
      constructor(collection, filter) {
        this._col = collection;
        this._filter = filter;
        this._sort = null;
        this._skip = 0;
        this._limit = 0;
        this._proj = null;
      }
      sort(spec) {
        this._sort = spec;
        return this;
      }
      skip(n) {
        this._skip = n;
        return this;
      }
      limit(n) {
        this._limit = n;
        return this;
      }
      project(spec) {
        this._proj = spec;
        return this;
      }
      toArray() {
        let docs;
        if (this._sort && !this._proj) {
          const sortFields = Object.entries(this._sort);
          if (sortFields.length === 1) {
            const [sortField, sortDir] = sortFields[0];
            const index = this._col._indexes.get(sortField);
            if (index instanceof SortedIndex) {
              const orderedIds = index.all(sortDir > 0);
              docs = [];
              for (const id of orderedIds) {
                const doc = this._col._docs.get(id);
                if (doc && matchFilter2(doc, this._filter)) docs.push(doc);
              }
              if (this._skip > 0) docs = docs.slice(this._skip);
              if (this._limit > 0) docs = docs.slice(0, this._limit);
              return docs.map(_clone);
            }
          }
        }
        docs = this._col._findRaw(this._filter);
        if (this._sort) {
          const fields = Object.entries(this._sort);
          docs.sort((a, b) => {
            for (const [field, dir] of fields) {
              const va = _getNestedValue(a, field);
              const vb = _getNestedValue(b, field);
              if (va < vb) return -dir;
              if (va > vb) return dir;
            }
            return 0;
          });
        }
        if (this._skip > 0) docs = docs.slice(this._skip);
        if (this._limit > 0) docs = docs.slice(0, this._limit);
        if (this._proj) {
          const includeMode = Object.values(this._proj).some((v) => v === 1);
          return docs.map((doc) => {
            if (includeMode) {
              const result = { _id: doc._id };
              for (const [k, v] of Object.entries(this._proj)) {
                if (v === 1) {
                  const val = _getNestedValue(doc, k);
                  result[k] = typeof val === "object" && val !== null ? _clone(val) : val;
                }
              }
              return result;
            } else {
              const cloned = _clone(doc);
              for (const [k, v] of Object.entries(this._proj)) {
                if (v === 0) delete cloned[k];
              }
              return cloned;
            }
          });
        }
        return docs.map(_clone);
      }
      first() {
        const doc = this._col._findOneRaw(this._filter);
        return doc ? _clone(doc) : null;
      }
      count() {
        return this._col._countMatching(this._filter);
      }
      forEach(fn) {
        this.toArray().forEach(fn);
      }
      map(fn) {
        return this.toArray().map(fn);
      }
    };
    var AggregationPipeline = class {
      static {
        __name(this, "AggregationPipeline");
      }
      constructor(collection) {
        this._col = collection;
        this._stages = [];
      }
      match(filter) {
        this._stages.push({ type: "match", filter });
        return this;
      }
      group(field, accumulators) {
        this._stages.push({ type: "group", field, accumulators });
        return this;
      }
      sort(spec) {
        this._stages.push({ type: "sort", spec });
        return this;
      }
      limit(n) {
        this._stages.push({ type: "limit", n });
        return this;
      }
      skip(n) {
        this._stages.push({ type: "skip", n });
        return this;
      }
      project(spec) {
        this._stages.push({ type: "project", spec });
        return this;
      }
      unwind(field) {
        this._stages.push({ type: "unwind", field });
        return this;
      }
      /**
       * Lookup: join con otra coleccion (equivalente a SQL LEFT JOIN / MongoDB $lookup).
       *
       * @param {object} opts
       * @param {string} opts.from         Nombre de la coleccion a unir
       * @param {string} opts.localField   Campo en los docs actuales
       * @param {string} opts.foreignField Campo en la coleccion foreign
       * @param {string} opts.as           Nombre del campo donde poner los resultados
       * @param {object} [opts.filter]     Filtro adicional sobre los docs foreign
       * @param {boolean} [opts.single]    Si true, pone un objeto en vez de array (como INNER JOIN first match)
       *
       * Ejemplo:
       *   orders.aggregate()
       *     .lookup({ from: 'users', localField: 'userId', foreignField: '_id', as: 'user', single: true })
       *     .toArray();
       *   // Cada order tendra order.user = { _id, name, email, ... }
       */
      lookup(opts) {
        this._stages.push({ type: "lookup", ...opts });
        return this;
      }
      toArray() {
        let docs = this._col._findDocs({});
        for (const stage of this._stages) {
          switch (stage.type) {
            case "match":
              docs = docs.filter((d) => matchFilter2(d, stage.filter));
              break;
            case "group": {
              const groups = /* @__PURE__ */ new Map();
              for (const doc of docs) {
                const key = stage.field ? String(_getNestedValue(doc, stage.field) ?? "_null") : "_all";
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(doc);
              }
              docs = [];
              for (const [key, groupDocs] of groups) {
                const result = { _id: key };
                for (const [accName, accDef] of Object.entries(stage.accumulators)) {
                  if (accDef.$count) {
                    result[accName] = groupDocs.length;
                  } else if (accDef.$sum) {
                    result[accName] = groupDocs.reduce((s, d) => s + (Number(_getNestedValue(d, accDef.$sum)) || 0), 0);
                  } else if (accDef.$avg) {
                    const vals = groupDocs.map((d) => Number(_getNestedValue(d, accDef.$avg)) || 0);
                    result[accName] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                  } else if (accDef.$min) {
                    result[accName] = Math.min(...groupDocs.map((d) => Number(_getNestedValue(d, accDef.$min)) || Infinity));
                  } else if (accDef.$max) {
                    result[accName] = Math.max(...groupDocs.map((d) => Number(_getNestedValue(d, accDef.$max)) || -Infinity));
                  } else if (accDef.$push) {
                    result[accName] = groupDocs.map((d) => _getNestedValue(d, accDef.$push));
                  } else if (accDef.$first) {
                    result[accName] = _getNestedValue(groupDocs[0], accDef.$first);
                  } else if (accDef.$last) {
                    result[accName] = _getNestedValue(groupDocs[groupDocs.length - 1], accDef.$last);
                  }
                }
                docs.push(result);
              }
              break;
            }
            case "sort": {
              const fields = Object.entries(stage.spec);
              docs.sort((a, b) => {
                for (const [field, dir] of fields) {
                  const va = _getNestedValue(a, field);
                  const vb = _getNestedValue(b, field);
                  if (va < vb) return -dir;
                  if (va > vb) return dir;
                }
                return 0;
              });
              break;
            }
            case "limit":
              docs = docs.slice(0, stage.n);
              break;
            case "skip":
              docs = docs.slice(stage.n);
              break;
            case "project": {
              const includeMode = Object.values(stage.spec).some((v) => v === 1);
              docs = docs.map((doc) => {
                const result = { _id: doc._id };
                if (includeMode) {
                  for (const [k, v] of Object.entries(stage.spec)) {
                    if (v === 1) result[k] = _getNestedValue(doc, k);
                  }
                } else {
                  Object.assign(result, JSON.parse(JSON.stringify(doc)));
                  for (const [k, v] of Object.entries(stage.spec)) {
                    if (v === 0) delete result[k];
                  }
                }
                return result;
              });
              break;
            }
            case "unwind": {
              const newDocs = [];
              for (const doc of docs) {
                const arr = _getNestedValue(doc, stage.field);
                if (Array.isArray(arr)) {
                  for (const item of arr) {
                    const copy = JSON.parse(JSON.stringify(doc));
                    _setNestedValue(copy, stage.field, item);
                    newDocs.push(copy);
                  }
                } else {
                  newDocs.push(doc);
                }
              }
              docs = newDocs;
              break;
            }
            case "lookup": {
              const store = this._col._store;
              if (!store) throw new Error("lookup requires DocStore reference (use db.collection())");
              const foreignCol = store.collection(stage.from);
              foreignCol._ensureLoaded();
              const foreignIdx = /* @__PURE__ */ new Map();
              for (const fDoc of foreignCol._docs.values()) {
                const fVal = _getNestedValue(fDoc, stage.foreignField);
                if (fVal === void 0) continue;
                const key = String(fVal);
                if (!foreignIdx.has(key)) foreignIdx.set(key, []);
                foreignIdx.get(key).push(fDoc);
              }
              for (const doc of docs) {
                const localVal = _getNestedValue(doc, stage.localField);
                if (localVal === void 0) {
                  doc[stage.as] = stage.single ? null : [];
                  continue;
                }
                let matches = foreignIdx.get(String(localVal)) || [];
                if (stage.filter) {
                  matches = matches.filter((m) => matchFilter2(m, stage.filter));
                }
                const copied = matches.map((m) => JSON.parse(JSON.stringify(m)));
                doc[stage.as] = stage.single ? copied[0] || null : copied;
              }
              break;
            }
          }
        }
        return docs;
      }
    };
    var Collection = class {
      static {
        __name(this, "Collection");
      }
      constructor(name, adapter, store = null) {
        this.name = name;
        this._adapter = adapter;
        this._store = store;
        this._docs = null;
        this._indexes = /* @__PURE__ */ new Map();
        this._indexDefs = [];
        this._dirty = false;
        this._dirtyIds = /* @__PURE__ */ new Set();
        this._loaded = false;
      }
      _dataFile() {
        return `${this.name}.docs.json`;
      }
      _metaFile() {
        return `${this.name}.meta.json`;
      }
      _indexFile(field, type) {
        return `${this.name}.${field}.${type === "sorted" ? "sidx" : "idx"}.json`;
      }
      _ensureLoaded() {
        if (this._loaded) return;
        this._loaded = true;
        const data = this._adapter.readJson(this._dataFile());
        this._docs = /* @__PURE__ */ new Map();
        if (Array.isArray(data)) {
          for (const doc of data) {
            if (doc && doc._id) this._docs.set(doc._id, doc);
          }
        }
        const meta = this._adapter.readJson(this._metaFile());
        if (meta && Array.isArray(meta.indexes)) {
          this._indexDefs = meta.indexes;
          for (const def of meta.indexes) {
            this._createIndexInternal(def.field, def.type || "hash", !!def.unique, false);
          }
        }
      }
      // ── Index management ─────────────────────────────────────
      createIndex(field, opts = {}) {
        this._ensureLoaded();
        const type = opts.type || "hash";
        const unique = !!opts.unique;
        if (this._indexes.has(field)) {
          throw new Error(`Index already exists on field: ${field}`);
        }
        this._createIndexInternal(field, type, unique, true);
        this._indexDefs.push({ field, type, unique });
        this._dirty = true;
      }
      _createIndexInternal(field, type, unique, rebuild) {
        let index;
        if (type === "sorted") {
          index = new SortedIndex(field);
        } else {
          index = new HashIndex(field, { unique });
        }
        const state = this._adapter.readJson(this._indexFile(field, type));
        if (state && !rebuild) {
          index.importState(state);
        } else if (this._docs && this._docs.size > 0) {
          index.rebuild(Array.from(this._docs.values()));
        }
        this._indexes.set(field, index);
      }
      dropIndex(field) {
        this._ensureLoaded();
        const index = this._indexes.get(field);
        if (!index) return;
        this._indexes.delete(field);
        this._indexDefs = this._indexDefs.filter((d) => d.field !== field);
        const type = index instanceof SortedIndex ? "sorted" : "hash";
        this._adapter.delete(this._indexFile(field, type));
        this._dirty = true;
      }
      getIndexes() {
        this._ensureLoaded();
        return this._indexDefs.slice();
      }
      // ── CRUD ─────────────────────────────────────────────────
      insert(doc) {
        this._ensureLoaded();
        const newDoc = _clone(doc);
        if (!newDoc._id) newDoc._id = generateId();
        if (this._docs.has(newDoc._id)) {
          throw new Error(`Duplicate _id: ${newDoc._id}`);
        }
        for (const [, index] of this._indexes) {
          if (index instanceof HashIndex && index.unique) {
            const val = _getNestedValue(newDoc, index.field);
            if (val !== void 0 && index.has(val)) {
              throw new Error(`Unique constraint violated: ${index.field} = "${val}"`);
            }
          }
        }
        this._docs.set(newDoc._id, newDoc);
        for (const [, index] of this._indexes) index.add(newDoc);
        this._dirty = true;
        this._dirtyIds.add(newDoc._id);
        return _clone(newDoc);
      }
      insertMany(docs) {
        const results = [];
        for (const doc of docs) results.push(this.insert(doc));
        return results;
      }
      findById(id) {
        this._ensureLoaded();
        const doc = this._docs.get(id);
        return doc ? _clone(doc) : null;
      }
      findOne(filter) {
        this._ensureLoaded();
        const doc = this._findOneRaw(filter);
        return doc ? _clone(doc) : null;
      }
      find(filter = {}) {
        this._ensureLoaded();
        return new Cursor(this, filter);
      }
      /** Internal: retorna primer doc raw (sin clone) que matchea. */
      _findOneRaw(filter) {
        const indexResult = this._tryIndexLookup(filter);
        if (indexResult !== null) {
          for (const id of indexResult) {
            const doc = this._docs.get(id);
            if (doc && matchFilter2(doc, filter)) return doc;
          }
          return null;
        }
        for (const doc of this._docs.values()) {
          if (matchFilter2(doc, filter)) return doc;
        }
        return null;
      }
      /** Internal: retorna docs raw (sin clone) que matchean. Usado por Cursor. */
      _findRaw(filter) {
        this._ensureLoaded();
        const indexResult = this._tryIndexLookup(filter);
        if (indexResult !== null) {
          const docs2 = [];
          for (const id of indexResult) {
            const doc = this._docs.get(id);
            if (doc && matchFilter2(doc, filter)) docs2.push(doc);
          }
          return docs2;
        }
        const docs = [];
        for (const doc of this._docs.values()) {
          if (matchFilter2(doc, filter)) docs.push(doc);
        }
        return docs;
      }
      /** Internal: cuenta docs sin allocar array. */
      _countMatching(filter) {
        this._ensureLoaded();
        if (!filter || Object.keys(filter).length === 0) return this._docs.size;
        const indexResult = this._tryIndexLookup(filter);
        if (indexResult !== null) {
          let count2 = 0;
          for (const id of indexResult) {
            const doc = this._docs.get(id);
            if (doc && matchFilter2(doc, filter)) count2++;
          }
          return count2;
        }
        let count = 0;
        for (const doc of this._docs.values()) {
          if (matchFilter2(doc, filter)) count++;
        }
        return count;
      }
      /** Backward compat: cloned version of _findRaw. */
      _findDocs(filter) {
        return this._findRaw(filter).map(_clone);
      }
      /** Intenta usar un indice para acelerar el filtro. Retorna null si no puede. */
      _tryIndexLookup(filter) {
        if (!filter || typeof filter !== "object") return null;
        for (const [field, cond] of Object.entries(filter)) {
          if (field.startsWith("$")) continue;
          const index = this._indexes.get(field);
          if (!index) continue;
          if (index instanceof HashIndex) {
            if (cond === null || typeof cond !== "object") {
              return index.lookup(cond);
            }
            if (cond.$eq !== void 0) return index.lookup(cond.$eq);
            if (cond.$in && Array.isArray(cond.$in)) {
              const ids = [];
              for (const v of cond.$in) ids.push(...index.lookup(v));
              return ids;
            }
          }
          if (index instanceof SortedIndex) {
            let min = -Infinity, max = Infinity;
            let excludeMin = false, excludeMax = false;
            if (typeof cond === "object" && cond !== null) {
              if (cond.$gte !== void 0) {
                min = cond.$gte;
                excludeMin = false;
              }
              if (cond.$gt !== void 0) {
                min = cond.$gt;
                excludeMin = true;
              }
              if (cond.$lte !== void 0) {
                max = cond.$lte;
                excludeMax = false;
              }
              if (cond.$lt !== void 0) {
                max = cond.$lt;
                excludeMax = true;
              }
              if (min !== -Infinity || max !== Infinity) {
                return index.range(min, max, { excludeMin, excludeMax });
              }
            }
            if (cond === null || typeof cond !== "object") {
              return index.range(cond, cond);
            }
            if (cond.$eq !== void 0) return index.range(cond.$eq, cond.$eq);
          }
        }
        return null;
      }
      update(filter, update) {
        this._ensureLoaded();
        const doc = this._findOneRaw(filter);
        if (!doc) return 0;
        return this._updateDoc(doc._id, update);
      }
      updateMany(filter, update) {
        this._ensureLoaded();
        const docs = this._findRaw(filter);
        let count = 0;
        for (const doc of docs) {
          count += this._updateDoc(doc._id, update);
        }
        return count;
      }
      _updateDoc(id, update) {
        const oldDoc = this._docs.get(id);
        if (!oldDoc) return 0;
        const newDoc = applyUpdate(oldDoc, update);
        newDoc._id = id;
        for (const [, index] of this._indexes) index.remove(oldDoc);
        for (const [, index] of this._indexes) {
          if (index instanceof HashIndex && index.unique) {
            const val = _getNestedValue(newDoc, index.field);
            if (val !== void 0 && index.has(val)) {
              for (const [, idx] of this._indexes) idx.add(oldDoc);
              throw new Error(`Unique constraint violated: ${index.field} = "${val}"`);
            }
          }
        }
        this._docs.set(id, newDoc);
        for (const [, index] of this._indexes) index.add(newDoc);
        this._dirty = true;
        this._dirtyIds.add(id);
        return 1;
      }
      remove(filter) {
        this._ensureLoaded();
        const doc = this._findOneRaw(filter);
        if (!doc) return 0;
        return this._removeDoc(doc._id);
      }
      removeMany(filter) {
        this._ensureLoaded();
        const docs = this._findRaw(filter);
        let count = 0;
        for (const doc of docs) count += this._removeDoc(doc._id);
        return count;
      }
      removeById(id) {
        this._ensureLoaded();
        return this._removeDoc(id);
      }
      _removeDoc(id) {
        const doc = this._docs.get(id);
        if (!doc) return 0;
        for (const [, index] of this._indexes) index.remove(doc);
        this._docs.delete(id);
        this._dirty = true;
        this._dirtyIds.add(id);
        return 1;
      }
      count(filter) {
        this._ensureLoaded();
        return this._countMatching(filter || {});
      }
      // ── Aggregation ──────────────────────────────────────────
      aggregate() {
        this._ensureLoaded();
        return new AggregationPipeline(this);
      }
      // ── Persistence ──────────────────────────────────────────
      flush() {
        if (!this._dirty || !this._loaded) return;
        const docs = Array.from(this._docs.values());
        this._adapter.writeJson(this._dataFile(), docs);
        this._adapter.writeJson(this._metaFile(), { indexes: this._indexDefs });
        if (this._dirtyIds.size > 0) {
          for (const [field, index] of this._indexes) {
            const type = index instanceof SortedIndex ? "sorted" : "hash";
            this._adapter.writeJson(this._indexFile(field, type), index.exportState());
          }
        }
        this._dirty = false;
        this._dirtyIds.clear();
      }
      clear() {
        this._ensureLoaded();
        this._docs.clear();
        for (const [, index] of this._indexes) index.clear();
        this._dirty = true;
        this._dirtyIds.clear();
      }
      /** Exporta todos los documentos como array. */
      export() {
        this._ensureLoaded();
        return Array.from(this._docs.values()).map(_clone);
      }
      /** Importa documentos (merge). */
      import(docs) {
        let count = 0;
        for (const doc of docs) {
          try {
            this.insert(doc);
            count++;
          } catch {
          }
        }
        return count;
      }
    };
    var DocStore2 = class {
      static {
        __name(this, "DocStore");
      }
      constructor(dirOrAdapter) {
        this._adapter = typeof dirOrAdapter === "string" ? new FileStorageAdapter2(dirOrAdapter) : dirOrAdapter;
        this._collections = /* @__PURE__ */ new Map();
      }
      collection(name) {
        if (!this._collections.has(name)) {
          this._collections.set(name, new Collection(name, this._adapter, this));
        }
        return this._collections.get(name);
      }
      drop(name) {
        const col = this._collections.get(name);
        if (col) {
          col._ensureLoaded();
          this._adapter.delete(col._dataFile());
          this._adapter.delete(col._metaFile());
          for (const [field, index] of col._indexes) {
            const type = index instanceof SortedIndex ? "sorted" : "hash";
            this._adapter.delete(col._indexFile(field, type));
          }
        }
        this._collections.delete(name);
      }
      collections() {
        return Array.from(this._collections.keys());
      }
      flush() {
        for (const [, col] of this._collections) col.flush();
      }
    };
    var _EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var _URL_RE = /^https?:\/\/.+/;
    var _PHONE_RE = /^[\d\s\+\-\(\)\.]+$/;
    var COLUMN_VALIDATORS = {
      text: /* @__PURE__ */ __name((v) => typeof v === "string", "text"),
      number: /* @__PURE__ */ __name((v) => typeof v === "number" && !isNaN(v), "number"),
      checkbox: /* @__PURE__ */ __name((v) => typeof v === "boolean", "checkbox"),
      date: /* @__PURE__ */ __name((v) => typeof v === "string" || typeof v === "number" || v instanceof Date, "date"),
      email: /* @__PURE__ */ __name((v) => typeof v === "string" && _EMAIL_RE.test(v), "email"),
      url: /* @__PURE__ */ __name((v) => typeof v === "string" && _URL_RE.test(v), "url"),
      phone: /* @__PURE__ */ __name((v) => typeof v === "string" && _PHONE_RE.test(v), "phone"),
      select: /* @__PURE__ */ __name((v, col) => col.options ? col.options.includes(v) : typeof v === "string", "select"),
      multiselect: /* @__PURE__ */ __name((v, col) => Array.isArray(v) && (!col.options || v.every((x) => col.options.includes(x))), "multiselect"),
      relation: /* @__PURE__ */ __name((v) => typeof v === "string", "relation"),
      // _id de otro doc
      json: /* @__PURE__ */ __name((_v) => true, "json"),
      // cualquier cosa
      attachment: /* @__PURE__ */ __name((v) => typeof v === "string" || typeof v === "object" && v !== null, "attachment"),
      // URL o metadata
      formula: /* @__PURE__ */ __name((_v) => true, "formula"),
      // computed, no se valida en insert
      autonumber: /* @__PURE__ */ __name((_v) => true, "autonumber")
      // auto-generated
    };
    var Table2 = class {
      static {
        __name(this, "Table");
      }
      /**
       * @param {DocStore} db
       * @param {string} name
       * @param {object} schema
       * @param {Array<{name, type, required?, unique?, options?, default?, collection?}>} schema.columns
       */
      constructor(db, name, schema = {}) {
        this.db = db;
        this.name = name;
        this.columns = schema.columns || [];
        this._col = db.collection(name);
        this._views = /* @__PURE__ */ new Map();
        this._autoNum = 0;
        this._colMap = /* @__PURE__ */ new Map();
        for (const col of this.columns) {
          this._colMap.set(col.name, col);
        }
        const existingIndexes = new Set(this._col.getIndexes().map((i) => i.field));
        for (const col of this.columns) {
          if (col.unique && !existingIndexes.has(col.name)) {
            this._col.createIndex(col.name, { unique: true });
          }
        }
        this._loadViews();
        this._loadAutoNum();
      }
      // ── Validation ──────────────────────────────────────────
      _validate(doc, isUpdate = false) {
        const errors = [];
        for (const col of this.columns) {
          const val = doc[col.name];
          if (col.required && !isUpdate && (val === void 0 || val === null || val === "")) {
            errors.push(`${col.name} is required`);
            continue;
          }
          if (val === void 0 || val === null) continue;
          if (col.type === "autonumber" || col.type === "formula") continue;
          const validator = COLUMN_VALIDATORS[col.type];
          if (validator && !validator(val, col)) {
            errors.push(`${col.name}: invalid ${col.type} value`);
          }
        }
        if (errors.length > 0) {
          throw new Error(`Validation failed: ${errors.join("; ")}`);
        }
      }
      _applyDefaults(doc) {
        const result = { ...doc };
        for (const col of this.columns) {
          if (result[col.name] !== void 0) continue;
          if (col.type === "autonumber") {
            this._autoNum++;
            result[col.name] = this._autoNum;
            continue;
          }
          if (col.default !== void 0) {
            result[col.name] = typeof col.default === "function" ? col.default() : col.default;
          }
        }
        return result;
      }
      // ── CRUD (validated) ────────────────────────────────────
      insert(doc) {
        const withDefaults = this._applyDefaults(doc);
        this._validate(withDefaults);
        return this._col.insert(withDefaults);
      }
      insertMany(docs) {
        return docs.map((d) => this.insert(d));
      }
      update(filter, update) {
        if (update.$set) {
          this._validate(update.$set, true);
        }
        return this._col.update(filter, update);
      }
      updateMany(filter, update) {
        if (update.$set) {
          this._validate(update.$set, true);
        }
        return this._col.updateMany(filter, update);
      }
      // Delegate read ops directly
      find(filter) {
        return this._col.find(filter);
      }
      findOne(filter) {
        return this._col.findOne(filter);
      }
      findById(id) {
        return this._col.findById(id);
      }
      remove(filter) {
        return this._col.remove(filter);
      }
      removeMany(f) {
        return this._col.removeMany(f);
      }
      count(filter) {
        return this._col.count(filter);
      }
      aggregate() {
        return this._col.aggregate();
      }
      export() {
        return this._col.export();
      }
      // ── Views (saved queries) ──────────────────────────────
      /**
       * Crea una vista con nombre (query guardada).
       * @param {string} viewName
       * @param {object} opts
       * @param {object} opts.filter    Filtro
       * @param {object} [opts.sort]    Sort spec
       * @param {number} [opts.limit]   Limit
       * @param {object} [opts.project] Projection
       */
      createView(viewName, opts) {
        this._views.set(viewName, opts);
        this._saveViews();
      }
      dropView(viewName) {
        this._views.delete(viewName);
        this._saveViews();
      }
      listViews() {
        return Array.from(this._views.keys());
      }
      getView(viewName) {
        return this._views.get(viewName) || null;
      }
      /**
       * Ejecuta una vista.
       * @returns {Array} Resultados
       */
      view(viewName) {
        const v = this._views.get(viewName);
        if (!v) throw new Error(`View not found: ${viewName}`);
        let cursor = this._col.find(v.filter || {});
        if (v.sort) cursor = cursor.sort(v.sort);
        if (v.skip) cursor = cursor.skip(v.skip);
        if (v.limit) cursor = cursor.limit(v.limit);
        if (v.project) cursor = cursor.project(v.project);
        return cursor.toArray();
      }
      // ── Schema info ────────────────────────────────────────
      getSchema() {
        return {
          name: this.name,
          columns: this.columns.map((c) => ({ ...c }))
        };
      }
      addColumn(colDef) {
        if (this._colMap.has(colDef.name)) throw new Error(`Column exists: ${colDef.name}`);
        this.columns.push(colDef);
        this._colMap.set(colDef.name, colDef);
        if (colDef.unique) {
          try {
            this._col.createIndex(colDef.name, { unique: true });
          } catch {
          }
        }
        this._saveMeta();
      }
      removeColumn(name) {
        this.columns = this.columns.filter((c) => c.name !== name);
        this._colMap.delete(name);
        try {
          this._col.dropIndex(name);
        } catch {
        }
        this._saveMeta();
      }
      renameColumn(oldName, newName) {
        const col = this._colMap.get(oldName);
        if (!col) throw new Error(`Column not found: ${oldName}`);
        col.name = newName;
        this._colMap.delete(oldName);
        this._colMap.set(newName, col);
        this._col.updateMany({}, { $rename: { [oldName]: newName } });
        this._saveMeta();
      }
      // ── Relation helpers ───────────────────────────────────
      /**
       * Expande relaciones: reemplaza IDs con docs de la coleccion relacionada.
       */
      expandRelations(doc) {
        if (!doc) return doc;
        const result = { ...doc };
        for (const col of this.columns) {
          if (col.type === "relation" && col.collection && result[col.name]) {
            const relCol = this.db.collection(col.collection);
            result[col.name] = relCol.findById(result[col.name]);
          }
        }
        return result;
      }
      // ── Persistence helpers ─────────────────────────────────
      _saveMeta() {
        this.db._adapter.writeJson(`${this.name}.schema.json`, {
          columns: this.columns,
          autoNum: this._autoNum
        });
      }
      _loadAutoNum() {
        const meta = this.db._adapter.readJson(`${this.name}.schema.json`);
        if (meta && meta.autoNum) this._autoNum = meta.autoNum;
      }
      _saveViews() {
        const views = {};
        for (const [name, opts] of this._views) views[name] = opts;
        this.db._adapter.writeJson(`${this.name}.views.json`, views);
      }
      _loadViews() {
        const views = this.db._adapter.readJson(`${this.name}.views.json`);
        if (views) {
          for (const [name, opts] of Object.entries(views)) {
            this._views.set(name, opts);
          }
        }
      }
      flush() {
        this._col.flush();
        this._saveMeta();
        this._saveViews();
      }
    };
    var TEMPLATES = {
      crm: {
        columns: [
          { name: "Name", type: "text", required: true },
          { name: "Email", type: "email", unique: true },
          { name: "Phone", type: "phone" },
          { name: "Company", type: "text" },
          { name: "Status", type: "select", options: ["Lead", "Qualified", "Active", "Churned"], default: "Lead" },
          { name: "Revenue", type: "number", default: 0 },
          { name: "Notes", type: "text" },
          { name: "Tags", type: "multiselect", options: ["VIP", "Enterprise", "SMB", "Partner"] },
          { name: "CreatedAt", type: "date", default: /* @__PURE__ */ __name(() => (/* @__PURE__ */ new Date()).toISOString(), "default") }
        ]
      },
      tasks: {
        columns: [
          { name: "Title", type: "text", required: true },
          { name: "Description", type: "text" },
          { name: "Status", type: "select", options: ["Todo", "In Progress", "Done", "Blocked"], default: "Todo" },
          { name: "Priority", type: "select", options: ["Low", "Medium", "High", "Urgent"], default: "Medium" },
          { name: "Assignee", type: "text" },
          { name: "DueDate", type: "date" },
          { name: "Tags", type: "multiselect", options: ["Bug", "Feature", "Docs", "Infra"] },
          { name: "Number", type: "autonumber" },
          { name: "CreatedAt", type: "date", default: /* @__PURE__ */ __name(() => (/* @__PURE__ */ new Date()).toISOString(), "default") }
        ]
      },
      inventory: {
        columns: [
          { name: "SKU", type: "text", required: true, unique: true },
          { name: "Name", type: "text", required: true },
          { name: "Category", type: "select", options: ["Electronics", "Clothing", "Food", "Tools", "Other"] },
          { name: "Price", type: "number", required: true },
          { name: "Stock", type: "number", default: 0 },
          { name: "Active", type: "checkbox", default: true },
          { name: "ImageURL", type: "url" },
          { name: "Number", type: "autonumber" }
        ]
      },
      content: {
        columns: [
          { name: "Title", type: "text", required: true },
          { name: "Body", type: "text" },
          { name: "Author", type: "text" },
          { name: "Status", type: "select", options: ["Draft", "Review", "Published", "Archived"], default: "Draft" },
          { name: "Category", type: "select", options: ["Blog", "Tutorial", "News", "Docs"] },
          { name: "Tags", type: "multiselect" },
          { name: "PublishedAt", type: "date" },
          { name: "URL", type: "url" },
          { name: "Number", type: "autonumber" },
          { name: "CreatedAt", type: "date", default: /* @__PURE__ */ __name(() => (/* @__PURE__ */ new Date()).toISOString(), "default") }
        ]
      }
    };
    function createFromTemplate(db, name, template) {
      const schema = TEMPLATES[template];
      if (!schema) throw new Error(`Unknown template: ${template}. Available: ${Object.keys(TEMPLATES).join(", ")}`);
      return new Table2(db, name, schema);
    }
    __name(createFromTemplate, "createFromTemplate");
    var EncryptedAdapter = class _EncryptedAdapter {
      static {
        __name(this, "EncryptedAdapter");
      }
      /**
       * @param {object} inner   Adapter interno (FileStorage, Memory, KV, etc.)
       * @param {CryptoKey} key  AES-256-GCM key derivada del password
       */
      constructor(inner, key) {
        this.inner = inner;
        this._key = key;
      }
      /**
       * Crea un EncryptedAdapter derivando una key AES-256 del password.
       * @param {object} inner    Adapter interno
       * @param {string} password Password para derivar la key
       * @param {string} [salt]   Salt (default: 'js-doc-store-v1')
       * @returns {Promise<EncryptedAdapter>}
       */
      static async create(inner, password, salt = "js-doc-store-v1") {
        const crypto = _EncryptedAdapter._getCrypto();
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
          "raw",
          enc.encode(password),
          "PBKDF2",
          false,
          ["deriveKey"]
        );
        const key = await crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: enc.encode(salt), iterations: 1e5, hash: "SHA-256" },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        );
        return new _EncryptedAdapter(inner, key);
      }
      static _getCrypto() {
        if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
          return globalThis.crypto;
        }
        try {
          const { webcrypto } = __require("crypto");
          return webcrypto;
        } catch {
          throw new Error("EncryptedAdapter: Web Crypto API not available");
        }
      }
      async _encrypt(data) {
        const crypto = _EncryptedAdapter._getCrypto();
        const enc = new TextEncoder();
        const plaintext = enc.encode(JSON.stringify(data));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          this._key,
          plaintext
        );
        const result = new Uint8Array(12 + ciphertext.byteLength);
        result.set(iv);
        result.set(new Uint8Array(ciphertext), 12);
        return _uint8ToBase64(result);
      }
      async _decrypt(encoded) {
        const crypto = _EncryptedAdapter._getCrypto();
        const combined = _base64ToUint8(encoded);
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);
        const plaintext = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          this._key,
          ciphertext
        );
        const dec = new TextDecoder();
        return JSON.parse(dec.decode(plaintext));
      }
      // ── Sync interface (con cache para operaciones sync) ─────
      /**
       * Precarga y desencripta archivos a un cache interno.
       * Llamar antes de operaciones sync.
       * @param {string[]} filenames
       */
      async preload(filenames) {
        if (!this._cache) this._cache = /* @__PURE__ */ new Map();
        for (const f of filenames) {
          const encrypted = this.inner.readJson(f);
          if (encrypted && encrypted.__enc) {
            try {
              const decrypted = await this._decrypt(encrypted.__enc);
              this._cache.set(f, decrypted);
            } catch (err) {
              this._cache.set(f, { __decryptFailed: true, file: f, error: err?.message ?? String(err) });
            }
          }
        }
      }
      readJson(filename) {
        if (this._cache && this._cache.has(filename)) {
          const cached = this._cache.get(filename);
          if (cached && cached.__decryptFailed) {
            throw new Error(`Decryption failed for ${cached.file}: wrong key or corrupted data`);
          }
          return cached;
        }
        const encrypted = this.inner.readJson(filename);
        if (!encrypted) return null;
        if (!encrypted.__enc) return encrypted;
        throw new Error(`Encrypted data found in ${filename} but no decryption cache available (call preload first or check encryption key)`);
      }
      writeJson(filename, data) {
        if (!this._pending) this._pending = /* @__PURE__ */ new Map();
        this._pending.set(filename, data);
        if (!this._cache) this._cache = /* @__PURE__ */ new Map();
        this._cache.set(filename, data);
      }
      delete(filename) {
        if (this._cache) this._cache.delete(filename);
        if (this._pending) this._pending.delete(filename);
        this.inner.delete(filename);
      }
      /**
       * Encripta y persiste todos los datos pendientes.
       * Llamar despues de db.flush().
       */
      async persist() {
        if (!this._pending) return;
        for (const [filename, data] of this._pending) {
          const encrypted = await this._encrypt(data);
          this.inner.writeJson(filename, { __enc: encrypted });
        }
        this._pending.clear();
      }
      /**
       * Delegate listKeys() to the inner adapter if it supports it.
       * @returns {Promise<string[]>}
       */
      async listKeys() {
        if (typeof this.inner.listKeys === "function") {
          return this.inner.listKeys();
        }
        throw new Error("Inner adapter does not support listKeys()");
      }
      /**
       * Preload and decrypt all files from the inner adapter.
       * Delegates listKeys() then calls preload().
       * @returns {Promise<void>}
       */
      async preloadAll() {
        const keys = await this.listKeys();
        if (keys.length > 0) await this.preload(keys);
      }
    };
    function _uint8ToBase64(uint8) {
      if (typeof Buffer !== "undefined") return Buffer.from(uint8).toString("base64");
      let binary = "";
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      return btoa(binary);
    }
    __name(_uint8ToBase64, "_uint8ToBase64");
    function _base64ToUint8(base64) {
      if (typeof Buffer !== "undefined") {
        const buf = Buffer.from(base64, "base64");
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      }
      const binary = atob(base64);
      const uint8 = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) uint8[i] = binary.charCodeAt(i);
      return uint8;
    }
    __name(_base64ToUint8, "_base64ToUint8");
    var FieldCrypto = class _FieldCrypto {
      static {
        __name(this, "FieldCrypto");
      }
      constructor(key) {
        this._key = key;
      }
      static async create(password, salt = "js-doc-field-v1") {
        const crypto = EncryptedAdapter._getCrypto();
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
          "raw",
          enc.encode(password),
          "PBKDF2",
          false,
          ["deriveKey"]
        );
        const key = await crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: enc.encode(salt), iterations: 1e5, hash: "SHA-256" },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        );
        return new _FieldCrypto(key);
      }
      async encrypt(value) {
        const crypto = EncryptedAdapter._getCrypto();
        const enc = new TextEncoder();
        const plaintext = enc.encode(typeof value === "string" ? value : JSON.stringify(value));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, this._key, plaintext);
        const result = new Uint8Array(12 + ciphertext.byteLength);
        result.set(iv);
        result.set(new Uint8Array(ciphertext), 12);
        return "$enc$" + _uint8ToBase64(result);
      }
      async decrypt(encoded) {
        if (typeof encoded !== "string" || !encoded.startsWith("$enc$")) return encoded;
        const crypto = EncryptedAdapter._getCrypto();
        const combined = _base64ToUint8(encoded.slice(5));
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);
        const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, this._key, ciphertext);
        const text = new TextDecoder().decode(plaintext);
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }
      isEncrypted(value) {
        return typeof value === "string" && value.startsWith("$enc$");
      }
    };
    var Auth2 = class _Auth {
      static {
        __name(this, "Auth");
      }
      /**
       * @param {DocStore} db
       * @param {object} opts
       * @param {string} opts.secret              JWT signing secret
       * @param {string} [opts.usersCollection]   Default: '_users'
       * @param {string} [opts.sessionsCollection] Default: '_sessions'
       * @param {number} [opts.tokenExpiry]       JWT expiry in seconds (default: 86400 = 24h)
       * @param {number} [opts.hashIterations]    PBKDF2 iterations (default: 100000)
       * @param {string[]} [opts.defaultRoles]    Roles for new users (default: ['user'])
       * @param {boolean} [opts.validateEmail]    Validate email format on register (default: true)
       * @param {object}  [opts.passwordPolicy]   Password validation rules
       * @param {number}  [opts.passwordPolicy.minLength]        Min length (default: 6)
       * @param {number}  [opts.passwordPolicy.maxLength]        Max length (default: undefined)
       * @param {boolean} [opts.passwordPolicy.requireUppercase] Require uppercase letter (default: false)
       * @param {boolean} [opts.passwordPolicy.requireLowercase] Require lowercase letter (default: false)
       * @param {boolean} [opts.passwordPolicy.requireDigit]     Require digit (default: false)
       * @param {boolean} [opts.passwordPolicy.requireSymbol]    Require symbol (default: false)
       * @param {Function} [opts.passwordPolicy.customValidator] Custom validator: (pw) => string|null
       */
      constructor(db, opts = {}) {
        this.db = db;
        this.secret = opts.secret;
        this.usersCol = opts.usersCollection || "_users";
        this.sessionsCol = opts.sessionsCollection || "_sessions";
        this.tokenExpiry = opts.tokenExpiry || 86400;
        this.hashIterations = opts.hashIterations || 1e5;
        this.defaultRoles = opts.defaultRoles || ["user"];
        this.validateEmail = opts.validateEmail !== false;
        this.passwordPolicy = Object.assign({ minLength: 6 }, opts.passwordPolicy || {});
        if (!this.secret) throw new Error("Auth: secret is required");
        this._users = null;
        this._sessions = null;
      }
      /**
       * Validates a password against the configured policy.
       * @param {string} password
       * @returns {string|null} Error message, or null if valid
       */
      _validatePassword(password) {
        const p = this.passwordPolicy;
        if (password.length < p.minLength) {
          return `Password must be at least ${p.minLength} characters`;
        }
        if (p.maxLength && password.length > p.maxLength) {
          return `Password must be at most ${p.maxLength} characters`;
        }
        if (p.requireUppercase && !/[A-Z]/.test(password)) {
          return "Password must contain at least one uppercase letter";
        }
        if (p.requireLowercase && !/[a-z]/.test(password)) {
          return "Password must contain at least one lowercase letter";
        }
        if (p.requireDigit && !/[0-9]/.test(password)) {
          return "Password must contain at least one digit";
        }
        if (p.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
          return "Password must contain at least one symbol";
        }
        if (typeof p.customValidator === "function") {
          const err = p.customValidator(password);
          if (err) return err;
        }
        return null;
      }
      /** Inicializa colecciones e indices. Llamar una vez al inicio. */
      async init() {
        this._users = this.db.collection(this.usersCol);
        this._sessions = this.db.collection(this.sessionsCol);
        try {
          this._users.createIndex("email", { unique: true });
        } catch {
        }
        try {
          this._sessions.createIndex("token");
        } catch {
        }
        try {
          this._sessions.createIndex("userId");
        } catch {
        }
      }
      // ── Password hashing (PBKDF2-SHA256) ─────────────────────
      async _hashPassword(password) {
        const crypto = _Auth._getCrypto();
        const enc = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const keyMaterial = await crypto.subtle.importKey(
          "raw",
          enc.encode(password),
          "PBKDF2",
          false,
          ["deriveBits"]
        );
        const hash = await crypto.subtle.deriveBits(
          { name: "PBKDF2", salt, iterations: this.hashIterations, hash: "SHA-256" },
          keyMaterial,
          256
        );
        const saltB64 = _uint8ToBase64(salt);
        const hashB64 = _uint8ToBase64(new Uint8Array(hash));
        return `pbkdf2:${this.hashIterations}:${saltB64}:${hashB64}`;
      }
      async _verifyPassword(password, stored) {
        const parts = stored.split(":");
        if (parts[0] !== "pbkdf2") return false;
        const iterations = parseInt(parts[1], 10);
        const salt = _base64ToUint8(parts[2]);
        const expectedHash = parts[3];
        const crypto = _Auth._getCrypto();
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
          "raw",
          enc.encode(password),
          "PBKDF2",
          false,
          ["deriveBits"]
        );
        const hash = await crypto.subtle.deriveBits(
          { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
          keyMaterial,
          256
        );
        return _uint8ToBase64(new Uint8Array(hash)) === expectedHash;
      }
      // ── JWT (HMAC-SHA256) ────────────────────────────────────
      async _signJWT(payload) {
        const crypto = _Auth._getCrypto();
        const enc = new TextEncoder();
        const header = _b64url({ alg: "HS256", typ: "JWT" });
        const body = _b64url(payload);
        const message = `${header}.${body}`;
        const key = await crypto.subtle.importKey(
          "raw",
          enc.encode(this.secret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );
        const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
        const sigB64 = _uint8ToBase64url(new Uint8Array(sig));
        return `${message}.${sigB64}`;
      }
      async _verifyJWT(token) {
        const crypto = _Auth._getCrypto();
        const enc = new TextEncoder();
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const message = `${parts[0]}.${parts[1]}`;
        const key = await crypto.subtle.importKey(
          "raw",
          enc.encode(this.secret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["verify"]
        );
        const sig = _base64urlToUint8(parts[2]);
        const valid = await crypto.subtle.verify("HMAC", key, sig, enc.encode(message));
        if (!valid) return null;
        const payload = JSON.parse(_fromB64url(parts[1]));
        if (payload.exp && Date.now() / 1e3 > payload.exp) return null;
        return payload;
      }
      // ── Public API ───────────────────────────────────────────
      /**
       * Registra un usuario nuevo.
       * @param {string} email
       * @param {string} password
       * @param {object} [profile]  Campos adicionales (name, etc.)
       * @returns {Promise<object>}  El usuario creado (sin passwordHash)
       */
      async register(email, password, profile = {}) {
        if (!email || !password) throw new Error("Email and password required");
        const normalizedEmail = email.toLowerCase().trim();
        if (this.validateEmail && !_EMAIL_RE.test(normalizedEmail)) {
          throw new Error("Invalid email format");
        }
        const pwErr = this._validatePassword(password);
        if (pwErr) throw new Error(pwErr);
        const passwordHash = await this._hashPassword(password);
        const user = this._users.insert({
          email: normalizedEmail,
          passwordHash,
          roles: this.defaultRoles.slice(),
          active: true,
          createdAt: Date.now(),
          ...profile
        });
        const { passwordHash: _, ...safe } = user;
        return safe;
      }
      /**
       * Login: verifica credenciales y retorna JWT.
       * @returns {Promise<{ token: string, user: object }>}
       */
      async login(email, password) {
        const user = this._users.findOne({ email: email.toLowerCase().trim() });
        if (!user) throw new Error("Invalid credentials");
        if (!user.active) throw new Error("Account disabled");
        const valid = await this._verifyPassword(password, user.passwordHash);
        if (!valid) throw new Error("Invalid credentials");
        const payload = {
          sub: user._id,
          email: user.email,
          roles: user.roles,
          iat: Math.floor(Date.now() / 1e3),
          exp: Math.floor(Date.now() / 1e3) + this.tokenExpiry
        };
        const token = await this._signJWT(payload);
        this._sessions.insert({
          userId: user._id,
          token,
          createdAt: Date.now(),
          expiresAt: Date.now() + this.tokenExpiry * 1e3
        });
        this._users.update({ _id: user._id }, { $set: { lastLogin: Date.now() } });
        const { passwordHash: _, ...safe } = user;
        return { token, user: safe };
      }
      /**
       * Verifica un JWT y retorna el payload.
       * @returns {Promise<object|null>}  Payload o null si invalido/expirado
       */
      async verify(token) {
        const payload = await this._verifyJWT(token);
        if (!payload) return null;
        const session = this._sessions.findOne({ token });
        if (!session) return null;
        return payload;
      }
      /**
       * Logout: invalida una sesion.
       */
      logout(token) {
        return this._sessions.remove({ token });
      }
      /**
       * Invalida todas las sesiones de un usuario.
       */
      logoutAll(userId) {
        return this._sessions.removeMany({ userId });
      }
      /**
       * Cambia el password de un usuario.
       */
      async changePassword(userId, oldPassword, newPassword) {
        const user = this._users.findById(userId);
        if (!user) throw new Error("User not found");
        const valid = await this._verifyPassword(oldPassword, user.passwordHash);
        if (!valid) throw new Error("Invalid current password");
        const pwErr = this._validatePassword(newPassword);
        if (pwErr) throw new Error(pwErr);
        const hash = await this._hashPassword(newPassword);
        this._users.update({ _id: userId }, { $set: { passwordHash: hash } });
        this._sessions.removeMany({ userId });
        return true;
      }
      /**
       * Reset de password (admin/recovery — sin verificar password viejo).
       */
      async resetPassword(userId, newPassword) {
        const pwErr = this._validatePassword(newPassword);
        if (pwErr) throw new Error(pwErr);
        const hash = await this._hashPassword(newPassword);
        this._users.update({ _id: userId }, { $set: { passwordHash: hash } });
        this._sessions.removeMany({ userId });
        return true;
      }
      // ── Roles / RBAC ────────────────────────────────────────
      assignRole(userId, role) {
        const user = this._users.findById(userId);
        if (!user) throw new Error("User not found");
        if (user.roles.includes(role)) return;
        this._users.update({ _id: userId }, { $push: { roles: role } });
      }
      removeRole(userId, role) {
        const user = this._users.findById(userId);
        if (!user) throw new Error("User not found");
        this._users.update({ _id: userId }, { $pull: { roles: role } });
      }
      hasRole(userId, role) {
        const user = this._users.findById(userId);
        return user ? user.roles.includes(role) : false;
      }
      /**
       * Middleware-style: verifica token Y rol.
       * @returns {Promise<object|null>}  Payload si autorizado, null si no
       */
      async authorize(token, requiredRole) {
        const payload = await this.verify(token);
        if (!payload) return null;
        if (requiredRole && !payload.roles.includes(requiredRole)) return null;
        return payload;
      }
      // ── User management ──────────────────────────────────────
      getUser(userId) {
        const user = this._users.findById(userId);
        if (!user) return null;
        const { passwordHash: _, ...safe } = user;
        return safe;
      }
      getUserByEmail(email) {
        const user = this._users.findOne({ email: email.toLowerCase().trim() });
        if (!user) return null;
        const { passwordHash: _, ...safe } = user;
        return safe;
      }
      listUsers(filter = {}, opts = {}) {
        let cursor = this._users.find(filter);
        if (opts.sort) cursor = cursor.sort(opts.sort);
        if (opts.skip) cursor = cursor.skip(opts.skip);
        if (opts.limit) cursor = cursor.limit(opts.limit);
        return cursor.toArray().map((u) => {
          const { passwordHash: _, ...safe } = u;
          return safe;
        });
      }
      disableUser(userId) {
        this._users.update({ _id: userId }, { $set: { active: false } });
        this._sessions.removeMany({ userId });
      }
      enableUser(userId) {
        this._users.update({ _id: userId }, { $set: { active: true } });
      }
      deleteUser(userId) {
        this._users.removeById(userId);
        this._sessions.removeMany({ userId });
      }
      /**
       * Limpia sesiones expiradas.
       */
      cleanExpiredSessions() {
        return this._sessions.removeMany({
          expiresAt: { $lt: Date.now() }
        });
      }
      static _getCrypto() {
        if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
          return globalThis.crypto;
        }
        try {
          const { webcrypto } = __require("crypto");
          return webcrypto;
        } catch {
          throw new Error("Auth: Web Crypto API not available");
        }
      }
    };
    function _b64url(obj) {
      const json = JSON.stringify(obj);
      const b64 = _uint8ToBase64(new TextEncoder().encode(json));
      return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    __name(_b64url, "_b64url");
    function _fromB64url(str) {
      const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
      const padded = b64 + "=".repeat((4 - b64.length % 4) % 4);
      const bytes = _base64ToUint8(padded);
      return new TextDecoder().decode(bytes);
    }
    __name(_fromB64url, "_fromB64url");
    function _uint8ToBase64url(uint8) {
      return _uint8ToBase64(uint8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    __name(_uint8ToBase64url, "_uint8ToBase64url");
    function _base64urlToUint8(str) {
      const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
      const padded = b64 + "=".repeat((4 - b64.length % 4) % 4);
      return _base64ToUint8(padded);
    }
    __name(_base64urlToUint8, "_base64urlToUint8");
    module.exports = {
      DocStore: DocStore2,
      Collection,
      Cursor,
      AggregationPipeline,
      HashIndex,
      SortedIndex,
      Table: Table2,
      TEMPLATES,
      createFromTemplate,
      FileStorageAdapter: FileStorageAdapter2,
      MemoryStorageAdapter,
      CloudflareKVAdapter: CloudflareKVAdapter2,
      EncryptedAdapter,
      FieldCrypto,
      Auth: Auth2,
      // Utils
      matchFilter: matchFilter2,
      applyUpdate,
      generateId
    };
  }
});

// .wrangler/tmp/bundle-EHSH7V/middleware-loader.entry.ts
init_checked_fetch();
init_modules_watch_stub();

// .wrangler/tmp/bundle-EHSH7V/middleware-insertion-facade.js
init_checked_fetch();
init_modules_watch_stub();

// cloudflare-worker.js
init_checked_fetch();
init_modules_watch_stub();
var import_js_doc_store = __toESM(require_js_doc_store());

// js-vector-store.js
init_checked_fetch();
init_modules_watch_stub();
var TopKHeap = class {
  static {
    __name(this, "TopKHeap");
  }
  constructor(k) {
    this.k = k;
    this.data = [];
  }
  push(item) {
    if (this.data.length < this.k) {
      this.data.push(item);
      this._bubbleUp(this.data.length - 1);
    } else if (item.score > this.data[0].score) {
      this.data[0] = item;
      this._sinkDown(0);
    }
  }
  sorted() {
    const out = this.data.slice();
    out.sort((a, b) => b.score - a.score);
    return out;
  }
  _bubbleUp(i) {
    while (i > 0) {
      const parent = i - 1 >> 1;
      if (this.data[i].score < this.data[parent].score) {
        const tmp = this.data[i];
        this.data[i] = this.data[parent];
        this.data[parent] = tmp;
        i = parent;
      } else break;
    }
  }
  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.data[l].score < this.data[smallest].score) smallest = l;
      if (r < n && this.data[r].score < this.data[smallest].score) smallest = r;
      if (smallest !== i) {
        const tmp = this.data[i];
        this.data[i] = this.data[smallest];
        this.data[smallest] = tmp;
        i = smallest;
      } else break;
    }
  }
};
var POPCOUNT = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let n = i, c = 0;
  while (n) {
    c++;
    n &= n - 1;
  }
  POPCOUNT[i] = c;
}
function normalize(v) {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return Array.from(v);
  const out = new Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}
__name(normalize, "normalize");
function cosineSim(a, b, dims) {
  const n = dims ?? Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < n; i++) {
    const ai = a[i], bi = b[i];
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  const denom = Math.sqrt(na * nb);
  return denom === 0 ? 0 : dot / denom;
}
__name(cosineSim, "cosineSim");
function euclideanDist(a, b, dims) {
  const n = dims ?? Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}
__name(euclideanDist, "euclideanDist");
function dotProduct(a, b, dims) {
  const n = dims ?? Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}
__name(dotProduct, "dotProduct");
function manhattanDist(a, b, dims) {
  const n = dims ?? Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum;
}
__name(manhattanDist, "manhattanDist");
function computeScore(a, b, dims, metric) {
  switch (metric) {
    case "cosine":
      return cosineSim(a, b, dims);
    case "dotProduct":
      return dotProduct(a, b, dims);
    case "euclidean":
      return 1 / (1 + euclideanDist(a, b, dims));
    case "manhattan":
      return 1 / (1 + manhattanDist(a, b, dims));
    default:
      return cosineSim(a, b, dims);
  }
}
__name(computeScore, "computeScore");
function matchFilter(metadata, filter) {
  if (!filter || typeof filter !== "object") return true;
  if (!metadata) metadata = {};
  for (const key of Object.keys(filter)) {
    if (key === "$and") {
      if (!Array.isArray(filter.$and)) return false;
      for (const sub of filter.$and) {
        if (!matchFilter(metadata, sub)) return false;
      }
      continue;
    }
    if (key === "$or") {
      if (!Array.isArray(filter.$or)) return false;
      let any = false;
      for (const sub of filter.$or) {
        if (matchFilter(metadata, sub)) {
          any = true;
          break;
        }
      }
      if (!any) return false;
      continue;
    }
    if (key === "$not") {
      if (matchFilter(metadata, filter.$not)) return false;
      continue;
    }
    const val = metadata[key];
    const cond = filter[key];
    if (cond === null || typeof cond !== "object") {
      if (val !== cond) return false;
      continue;
    }
    for (const op of Object.keys(cond)) {
      const target = cond[op];
      switch (op) {
        case "$eq":
          if (val !== target) return false;
          break;
        case "$ne":
          if (val === target) return false;
          break;
        case "$gt":
          if (!(val > target)) return false;
          break;
        case "$gte":
          if (!(val >= target)) return false;
          break;
        case "$lt":
          if (!(val < target)) return false;
          break;
        case "$lte":
          if (!(val <= target)) return false;
          break;
        case "$in":
          if (!Array.isArray(target) || !target.includes(val)) return false;
          break;
        case "$nin":
          if (Array.isArray(target) && target.includes(val)) return false;
          break;
        case "$exists":
          if (val !== void 0 !== target) return false;
          break;
        case "$regex": {
          const re = typeof target === "string" ? new RegExp(target) : target;
          if (!re.test(String(val ?? ""))) return false;
          break;
        }
        default:
          break;
      }
    }
  }
  return true;
}
__name(matchFilter, "matchFilter");
function _normalizedSearchAcross(store, collections, query, limit, metric) {
  if (collections.length <= 1) {
    const col = collections[0];
    return store.search(col, query, limit, 0, metric);
  }
  const perCol = [];
  for (const col of collections) {
    const results = store.search(col, query, limit, 0, metric);
    if (results.length > 0) perCol.push(results);
  }
  const heap = new TopKHeap(limit);
  for (const results of perCol) {
    let min = Infinity, max = -Infinity;
    for (const r of results) {
      if (r.score < min) min = r.score;
      if (r.score > max) max = r.score;
    }
    const range = max - min;
    for (const r of results) {
      const normalized = range > 0 ? (r.score - min) / range : 1;
      heap.push({ ...r, score: normalized });
    }
  }
  return heap.sorted();
}
__name(_normalizedSearchAcross, "_normalizedSearchAcross");
var _fs = null;
var _path = null;
var _fsAvailable = false;
try {
  if (typeof process !== "undefined" && process.versions?.node) {
    _fs = __require("fs");
    _path = __require("path");
    _fsAvailable = true;
  }
} catch {
  _fsAvailable = false;
}
function _getFs() {
  if (!_fsAvailable) {
    throw new Error("VectorStore: FileStorageAdapter not available \u2014 use CloudflareKVAdapter or MemoryStorageAdapter instead");
  }
  return { fs: _fs, path: _path };
}
__name(_getFs, "_getFs");
var FileStorageAdapter = class {
  static {
    __name(this, "FileStorageAdapter");
  }
  constructor(dir) {
    const { fs, path } = _getFs();
    this.dir = dir;
    this.fs = fs;
    this.path = path;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  readBin(filename) {
    const file = this.path.join(this.dir, filename);
    if (!this.fs.existsSync(file)) return null;
    const buf = this.fs.readFileSync(file);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  writeBin(filename, buffer) {
    const file = this.path.join(this.dir, filename);
    this.fs.writeFileSync(file, Buffer.from(buffer));
  }
  readJson(filename) {
    const file = this.path.join(this.dir, filename);
    if (!this.fs.existsSync(file)) return null;
    return JSON.parse(this.fs.readFileSync(file, "utf8"));
  }
  writeJson(filename, data) {
    const file = this.path.join(this.dir, filename);
    this.fs.writeFileSync(file, JSON.stringify(data));
  }
  delete(filename) {
    const file = this.path.join(this.dir, filename);
    if (this.fs.existsSync(file)) this.fs.unlinkSync(file);
  }
};
var VectorStore = class {
  static {
    __name(this, "VectorStore");
  }
  /**
   * @param {string|object} dirOrAdapter
   * @param {number} dim
   * @param {number} maxCollections
   * @param {object} [opts]
   * @param {string} [opts.model]            Modelo de embeddings (se guarda en el manifest)
   * @param {string} [opts.collectionPrefix] Prefix prepended to all collection filenames.
   *   Useful for multi-tenant scenarios (e.g. 'tenant_alpha/'). Default: '' (no prefix).
   *   When set, `listCollections()` and `dropAll()` only see collections under this prefix.
   */
  constructor(dirOrAdapter, dim = 768, maxCollections = 50, opts = {}) {
    this.dim = dim;
    this.maxCollections = maxCollections;
    this.defaultModel = opts.model || null;
    this.collectionPrefix = opts.collectionPrefix || "";
    this._adapter = typeof dirOrAdapter === "string" ? new FileStorageAdapter(dirOrAdapter) : dirOrAdapter;
    this._collections = /* @__PURE__ */ new Map();
    this._stride = dim * 4;
  }
  _binFile(col) {
    return `${this.collectionPrefix}${col}.bin`;
  }
  _jsonFile(col) {
    return `${this.collectionPrefix}${col}.json`;
  }
  /**
   * Lists collections that exist in storage under this store's prefix.
   * Requires the adapter to implement `listKeys()` (CloudflareKVAdapter has it;
   * FileStorageAdapter falls back to `_collections` map of loaded collections).
   *
   * @returns {Promise<string[]>} Collection names (without prefix or .bin/.json suffix).
   */
  async listCollections() {
    if (typeof this._adapter.listKeys === "function") {
      const keys = await this._adapter.listKeys();
      const prefix = this.collectionPrefix;
      const names = /* @__PURE__ */ new Set();
      for (const k of keys) {
        if (prefix && !k.startsWith(prefix)) continue;
        const stripped = prefix ? k.slice(prefix.length) : k;
        const m = /^(.+?)\.(json|bin)$/.exec(stripped);
        if (m) names.add(m[1]);
      }
      return [...names].sort();
    }
    return [...this._collections.keys()].sort();
  }
  /**
   * Deletes all collections under this store's prefix.
   * Useful for tenant cleanup. Removes both .bin and .json files.
   * @returns {Promise<string[]>} Names of dropped collections.
   */
  async dropAll() {
    const cols = await this.listCollections();
    for (const col of cols) this.drop(col);
    return cols;
  }
  _load(col) {
    if (this._collections.has(col)) return this._collections.get(col);
    const manifest = this._adapter.readJson(this._jsonFile(col));
    const ids = manifest ? manifest.ids : [];
    const meta = manifest ? manifest.meta : [];
    const model = manifest?.model || this.defaultModel || null;
    const idMap = /* @__PURE__ */ new Map();
    for (let i = 0; i < ids.length; i++) idMap.set(ids[i], i);
    const bin = this._adapter.readBin(this._binFile(col));
    const entry = { ids, meta, idMap, bin, model, pending: [], dirty: false };
    this._collections.set(col, entry);
    return entry;
  }
  /** Retorna el modelo de embeddings de una coleccion, o null. */
  getModel(col) {
    return this._load(col).model;
  }
  /** Setea el modelo de embeddings para una coleccion. */
  setModel(col, model) {
    const e = this._load(col);
    e.model = model;
    e.dirty = true;
  }
  _readVec(col, idx) {
    const entry = this._collections.get(col) || this._load(col);
    const committed = entry.idMap.size - entry.pending.length;
    if (idx < committed) {
      if (!entry.bin) return null;
      return new Float32Array(entry.bin, idx * this._stride, this.dim);
    }
    return entry.pending[idx - committed].vector;
  }
  _rebuildBin(entry) {
    const committed = entry.ids.length - entry.pending.length;
    const totalVecs = entry.ids.length;
    const buf = new ArrayBuffer(totalVecs * this._stride);
    const f32 = new Float32Array(buf);
    if (entry.bin && committed > 0) {
      f32.set(new Float32Array(entry.bin, 0, committed * this.dim));
    }
    for (let p = 0; p < entry.pending.length; p++) {
      const vec = entry.pending[p].vector;
      const offset = (committed + p) * this.dim;
      for (let d = 0; d < this.dim; d++) f32[offset + d] = vec[d] ?? 0;
    }
    return buf;
  }
  set(col, id, vector, metadata = {}) {
    const entry = this._load(col);
    const existing = entry.idMap.get(id);
    if (existing !== void 0) {
      const committed = entry.ids.length - entry.pending.length;
      if (existing < committed) {
        if (entry.bin) {
          const f32 = new Float32Array(entry.bin, existing * this._stride, this.dim);
          for (let d = 0; d < this.dim; d++) f32[d] = vector[d] ?? 0;
        }
      } else {
        entry.pending[existing - committed].vector = vector;
      }
      entry.meta[existing] = metadata;
    } else {
      const idx = entry.ids.length;
      entry.ids.push(id);
      entry.meta.push(metadata);
      entry.idMap.set(id, idx);
      entry.pending.push({ id, vector, metadata });
    }
    entry.dirty = true;
  }
  remove(col, id) {
    const entry = this._load(col);
    const idx = entry.idMap.get(id);
    if (idx === void 0) return false;
    if (entry.pending.length > 0) this._flushCol(col, entry);
    const totalVecs = entry.ids.length;
    const newBuf = new ArrayBuffer((totalVecs - 1) * this._stride);
    const dst = new Float32Array(newBuf);
    let writeIdx = 0;
    for (let i = 0; i < totalVecs; i++) {
      if (i === idx) continue;
      dst.set(new Float32Array(entry.bin, i * this._stride, this.dim), writeIdx * this.dim);
      writeIdx++;
    }
    entry.ids.splice(idx, 1);
    entry.meta.splice(idx, 1);
    entry.idMap.clear();
    for (let i = 0; i < entry.ids.length; i++) entry.idMap.set(entry.ids[i], i);
    entry.bin = newBuf;
    this._adapter.writeBin(this._binFile(col), newBuf);
    entry.dirty = true;
    return true;
  }
  drop(col) {
    this._adapter.delete(this._binFile(col));
    this._adapter.delete(this._jsonFile(col));
    this._collections.delete(col);
  }
  _flushCol(col, entry) {
    if (entry.pending.length > 0) {
      entry.bin = this._rebuildBin(entry);
      entry.pending = [];
    }
    if (entry.bin) this._adapter.writeBin(this._binFile(col), entry.bin);
    const manifest = { ids: entry.ids, meta: entry.meta, dim: this.dim };
    if (entry.model) manifest.model = entry.model;
    this._adapter.writeJson(this._jsonFile(col), manifest);
    entry.dirty = false;
  }
  flush() {
    for (const [col, entry] of this._collections) {
      if (entry.dirty) this._flushCol(col, entry);
    }
  }
  get(col, id) {
    const entry = this._load(col);
    const idx = entry.idMap.get(id);
    if (idx === void 0) return null;
    return { id, vector: Array.from(this._readVec(col, idx)), metadata: entry.meta[idx] };
  }
  has(col, id) {
    return this._load(col).idMap.has(id);
  }
  count(col) {
    return this._load(col).ids.length;
  }
  ids(col) {
    return this._load(col).ids.slice();
  }
  collections() {
    return Array.from(this._collections.keys());
  }
  stats() {
    const result = {};
    for (const col of this._collections.keys()) {
      result[col] = { count: this.count(col), dim: this.dim };
    }
    return result;
  }
  import(col, records) {
    for (const r of records) this.set(col, r.id, r.vector, r.metadata ?? {});
    return records.length;
  }
  export(col) {
    const entry = this._load(col);
    return entry.ids.map((id, i) => ({
      id,
      vector: Array.from(this._readVec(col, i)),
      metadata: entry.meta[i]
    }));
  }
  search(col, query, limit = 5, dimSlice = 0, metric = "cosine", filter = null) {
    const entry = this._load(col);
    const dims = dimSlice > 0 ? dimSlice : this.dim;
    const n = entry.ids.length;
    const heap = new TopKHeap(limit);
    for (let i = 0; i < n; i++) {
      if (filter && !matchFilter(entry.meta[i], filter)) continue;
      const vec = this._readVec(col, i);
      const score = computeScore(query, vec, dims, metric);
      heap.push({ id: entry.ids[i], score, metadata: entry.meta[i] });
    }
    return heap.sorted();
  }
  matryoshkaSearch(col, query, limit = 5, stages = [128, 384, 768], metric = "cosine") {
    const entry = this._load(col);
    if (entry.ids.length === 0) return [];
    const factor = 4;
    let candidates = entry.ids.map((id, i) => ({ id, idx: i, metadata: entry.meta[i] }));
    for (let s = 0; s < stages.length; s++) {
      const dims = Math.min(stages[s], this.dim);
      const keepN = s < stages.length - 1 ? Math.max(limit * factor * (stages.length - s), limit) : limit;
      const heap = new TopKHeap(keepN);
      for (const c of candidates) {
        const vec = this._readVec(col, c.idx);
        const score = computeScore(query, vec, dims, metric);
        heap.push({ ...c, score });
      }
      candidates = heap.sorted();
    }
    return candidates.slice(0, limit).map(({ id, score, metadata }) => ({ id, score, metadata }));
  }
  searchAcross(collections, query, limit = 5, metric = "cosine") {
    return _normalizedSearchAcross(this, collections, query, limit, metric);
  }
  static normalize = normalize;
  static cosineSim = cosineSim;
  static euclideanDist = euclideanDist;
  static dotProduct = dotProduct;
  static manhattanDist = manhattanDist;
  static computeScore = computeScore;
};
var QuantizedStore = class {
  static {
    __name(this, "QuantizedStore");
  }
  constructor(dirOrAdapter, dim = 768, opts = {}) {
    this.dim = dim;
    this.defaultModel = opts.model || null;
    this._adapter = typeof dirOrAdapter === "string" ? new FileStorageAdapter(dirOrAdapter) : dirOrAdapter;
    this._collections = /* @__PURE__ */ new Map();
  }
  _binFile(col) {
    return `${col}.q8.bin`;
  }
  _jsonFile(col) {
    return `${col}.q8.json`;
  }
  get _stride() {
    return 8 + this.dim;
  }
  _load(col) {
    if (this._collections.has(col)) return this._collections.get(col);
    const manifest = this._adapter.readJson(this._jsonFile(col));
    const ids = manifest ? manifest.ids : [];
    const meta = manifest ? manifest.meta : [];
    const model = manifest?.model || this.defaultModel || null;
    const idMap = /* @__PURE__ */ new Map();
    for (let i = 0; i < ids.length; i++) idMap.set(ids[i], i);
    const bin = this._adapter.readBin(this._binFile(col));
    const entry = { ids, meta, idMap, bin, model, pending: [], dirty: false };
    this._collections.set(col, entry);
    return entry;
  }
  getModel(col) {
    return this._load(col).model;
  }
  setModel(col, model) {
    const e = this._load(col);
    e.model = model;
    e.dirty = true;
  }
  _quantize(vector) {
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < vector.length; i++) {
      const x = vector[i];
      if (x < min) min = x;
      if (x > max) max = x;
    }
    const range = max - min || 1;
    const int8 = new Int8Array(this.dim);
    for (let i = 0; i < this.dim; i++) {
      int8[i] = Math.round((vector[i] - min) / range * 255) - 128;
    }
    return { int8, min, max };
  }
  _dequantize(int8, min, max) {
    const range = max - min || 1;
    const result = new Float64Array(int8.length);
    for (let i = 0; i < int8.length; i++) {
      result[i] = (int8[i] + 128) / 255 * range + min;
    }
    return result;
  }
  _readVec(col, idx) {
    const entry = this._collections.get(col) || this._load(col);
    const committed = entry.ids.length - entry.pending.length;
    if (idx < committed) {
      if (!entry.bin) return null;
      const offset = idx * this._stride;
      const view2 = new DataView(entry.bin);
      const min2 = view2.getFloat32(offset, true);
      const max2 = view2.getFloat32(offset + 4, true);
      const int82 = new Int8Array(entry.bin, offset + 8, this.dim);
      return this._dequantize(int82, min2, max2);
    }
    const p = entry.pending[idx - committed];
    const view = new DataView(p.packed);
    const min = view.getFloat32(0, true);
    const max = view.getFloat32(4, true);
    const int8 = new Int8Array(p.packed, 8, this.dim);
    return this._dequantize(int8, min, max);
  }
  _packVec(vector) {
    const { int8, min, max } = this._quantize(vector);
    const buf = new ArrayBuffer(this._stride);
    const view = new DataView(buf);
    view.setFloat32(0, min, true);
    view.setFloat32(4, max, true);
    new Int8Array(buf, 8).set(int8);
    return buf;
  }
  set(col, id, vector, metadata = {}) {
    const entry = this._load(col);
    const existing = entry.idMap.get(id);
    const packed = this._packVec(vector);
    if (existing !== void 0) {
      const committed = entry.ids.length - entry.pending.length;
      if (existing < committed) {
        if (entry.bin) new Uint8Array(entry.bin).set(new Uint8Array(packed), existing * this._stride);
      } else {
        entry.pending[existing - committed].packed = packed;
      }
      entry.meta[existing] = metadata;
    } else {
      const idx = entry.ids.length;
      entry.ids.push(id);
      entry.meta.push(metadata);
      entry.idMap.set(id, idx);
      entry.pending.push({ id, packed, metadata });
    }
    entry.dirty = true;
  }
  remove(col, id) {
    const entry = this._load(col);
    const idx = entry.idMap.get(id);
    if (idx === void 0) return false;
    if (entry.pending.length > 0) this._flushCol(col, entry);
    const totalVecs = entry.ids.length;
    const stride = this._stride;
    const newBuf = new ArrayBuffer((totalVecs - 1) * stride);
    const dst = new Uint8Array(newBuf);
    const src = new Uint8Array(entry.bin);
    let writeIdx = 0;
    for (let i = 0; i < totalVecs; i++) {
      if (i === idx) continue;
      dst.set(src.subarray(i * stride, (i + 1) * stride), writeIdx * stride);
      writeIdx++;
    }
    entry.ids.splice(idx, 1);
    entry.meta.splice(idx, 1);
    entry.idMap.clear();
    for (let i = 0; i < entry.ids.length; i++) entry.idMap.set(entry.ids[i], i);
    entry.bin = newBuf;
    this._adapter.writeBin(this._binFile(col), newBuf);
    entry.dirty = true;
    return true;
  }
  drop(col) {
    this._adapter.delete(this._binFile(col));
    this._adapter.delete(this._jsonFile(col));
    this._collections.delete(col);
  }
  _flushCol(col, entry) {
    if (entry.pending.length > 0) {
      const committed = entry.ids.length - entry.pending.length;
      const total = entry.ids.length;
      const stride = this._stride;
      const newBuf = new ArrayBuffer(total * stride);
      const dst = new Uint8Array(newBuf);
      if (entry.bin && committed > 0) dst.set(new Uint8Array(entry.bin, 0, committed * stride));
      for (let p = 0; p < entry.pending.length; p++) {
        dst.set(new Uint8Array(entry.pending[p].packed), (committed + p) * stride);
      }
      entry.bin = newBuf;
      entry.pending = [];
    }
    if (entry.bin) this._adapter.writeBin(this._binFile(col), entry.bin);
    const manifest = { ids: entry.ids, meta: entry.meta, dim: this.dim };
    if (entry.model) manifest.model = entry.model;
    this._adapter.writeJson(this._jsonFile(col), manifest);
    entry.dirty = false;
  }
  flush() {
    for (const [col, entry] of this._collections) {
      if (entry.dirty) this._flushCol(col, entry);
    }
  }
  get(col, id) {
    const entry = this._load(col);
    const idx = entry.idMap.get(id);
    if (idx === void 0) return null;
    return { id, vector: Array.from(this._readVec(col, idx)), metadata: entry.meta[idx] };
  }
  has(col, id) {
    return this._load(col).idMap.has(id);
  }
  count(col) {
    return this._load(col).ids.length;
  }
  ids(col) {
    return this._load(col).ids.slice();
  }
  search(col, query, limit = 5, dimSlice = 0, metric = "cosine", filter = null) {
    const entry = this._load(col);
    if (entry.pending.length > 0) this._flushCol(col, entry);
    const dims = dimSlice > 0 ? dimSlice : this.dim;
    const n = entry.ids.length;
    const heap = new TopKHeap(limit);
    for (let i = 0; i < n; i++) {
      if (filter && !matchFilter(entry.meta[i], filter)) continue;
      const vec = this._readVec(col, i);
      const score = computeScore(query, vec, dims, metric);
      heap.push({ id: entry.ids[i], score, metadata: entry.meta[i] });
    }
    return heap.sorted();
  }
  matryoshkaSearch(col, query, limit = 5, stages = [128, 256, 384], metric = "cosine") {
    const entry = this._load(col);
    if (entry.ids.length === 0) return [];
    if (entry.pending.length > 0) this._flushCol(col, entry);
    const factor = 4;
    let candidates = entry.ids.map((id, i) => ({ id, idx: i, metadata: entry.meta[i] }));
    for (let s = 0; s < stages.length; s++) {
      const dims = Math.min(stages[s], this.dim);
      const keepN = s < stages.length - 1 ? Math.max(limit * factor * (stages.length - s), limit) : limit;
      const heap = new TopKHeap(keepN);
      for (const c of candidates) {
        const vec = this._readVec(col, c.idx);
        const score = computeScore(query, vec, dims, metric);
        heap.push({ ...c, score });
      }
      candidates = heap.sorted();
    }
    return candidates.slice(0, limit).map(({ id, score, metadata }) => ({ id, score, metadata }));
  }
  searchAcross(collections, query, limit = 5, metric = "cosine") {
    return _normalizedSearchAcross(this, collections, query, limit, metric);
  }
  import(col, records) {
    for (const r of records) this.set(col, r.id, r.vector, r.metadata ?? {});
    return records.length;
  }
  export(col) {
    const entry = this._load(col);
    return entry.ids.map((id, i) => ({
      id,
      vector: Array.from(this._readVec(col, i)),
      metadata: entry.meta[i]
    }));
  }
};
var BinaryQuantizedStore = class _BinaryQuantizedStore {
  static {
    __name(this, "BinaryQuantizedStore");
  }
  constructor(dirOrAdapter, dim = 768, opts = {}) {
    this.dim = dim;
    this.defaultModel = opts.model || null;
    this._bpv = Math.ceil(dim / 8);
    this._adapter = typeof dirOrAdapter === "string" ? new FileStorageAdapter(dirOrAdapter) : dirOrAdapter;
    this._collections = /* @__PURE__ */ new Map();
  }
  _binFile(col) {
    return `${col}.b1.bin`;
  }
  _jsonFile(col) {
    return `${col}.b1.json`;
  }
  _load(col) {
    if (this._collections.has(col)) return this._collections.get(col);
    const manifest = this._adapter.readJson(this._jsonFile(col));
    const ids = manifest ? manifest.ids : [];
    const meta = manifest ? manifest.meta : [];
    const model = manifest?.model || this.defaultModel || null;
    const idMap = /* @__PURE__ */ new Map();
    for (let i = 0; i < ids.length; i++) idMap.set(ids[i], i);
    const bin = this._adapter.readBin(this._binFile(col));
    const entry = { ids, meta, idMap, bin, model, pending: [], dirty: false };
    this._collections.set(col, entry);
    return entry;
  }
  getModel(col) {
    return this._load(col).model;
  }
  setModel(col, model) {
    const e = this._load(col);
    e.model = model;
    e.dirty = true;
  }
  /**
   * Cuantiza float[] a binario (1-bit por dimensión).
   * Normaliza primero, luego sign-bit MSB-first.
   * @returns {Uint8Array}
   */
  static quantize(vector, dim) {
    const norm = normalize(vector);
    const bytes = new Uint8Array(Math.ceil(dim / 8));
    const d = Math.min(norm.length, dim);
    for (let i = 0; i < d; i++) {
      if (norm[i] >= 0) {
        bytes[i >> 3] |= 1 << 7 - (i & 7);
      }
    }
    return bytes;
  }
  /**
   * Dequantiza binario a float[]: bit 1 → +1.0, bit 0 → -1.0
   */
  static dequantize(buf, offset, dim) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const floats = new Array(dim);
    for (let i = 0; i < dim; i++) {
      const bit = u8[offset + (i >> 3)] >> 7 - (i & 7) & 1;
      floats[i] = bit ? 1 : -1;
    }
    return floats;
  }
  /**
   * Coseno aproximado via Hamming: 1.0 - 2.0 * hamming / dims
   */
  static binaryCosineSim(a, aOff, b, bOff, dims) {
    const bytesToCmp = Math.ceil(dims / 8);
    let hamming = 0;
    for (let i = 0; i < bytesToCmp; i++) {
      hamming += POPCOUNT[a[aOff + i] ^ b[bOff + i]];
    }
    const remainder = dims & 7;
    if (remainder > 0) {
      const last = bytesToCmp - 1;
      const xor = a[aOff + last] ^ b[bOff + last];
      const mask = 255 << 8 - remainder & 255;
      hamming = hamming - POPCOUNT[xor] + POPCOUNT[xor & mask];
    }
    return 1 - 2 * hamming / dims;
  }
  /** Lee el binario de un vector desde buffer cacheado o pending. */
  _readBin(col, idx) {
    const entry = this._collections.get(col) || this._load(col);
    const committed = entry.ids.length - entry.pending.length;
    if (idx < committed) {
      if (!entry.bin) return null;
      return new Uint8Array(entry.bin, idx * this._bpv, this._bpv);
    }
    return entry.pending[idx - committed].packed;
  }
  /** Lee el vector dequantizado (+1/-1). */
  _readVec(col, idx) {
    const entry = this._collections.get(col) || this._load(col);
    const committed = entry.ids.length - entry.pending.length;
    if (idx < committed) {
      if (!entry.bin) return null;
      return _BinaryQuantizedStore.dequantize(entry.bin, idx * this._bpv, this.dim);
    }
    const packed = entry.pending[idx - committed].packed;
    return _BinaryQuantizedStore.dequantize(packed, 0, this.dim);
  }
  set(col, id, vector, metadata = {}) {
    const entry = this._load(col);
    const existing = entry.idMap.get(id);
    const packed = _BinaryQuantizedStore.quantize(vector, this.dim);
    if (existing !== void 0) {
      const committed = entry.ids.length - entry.pending.length;
      if (existing < committed) {
        if (entry.bin) {
          new Uint8Array(entry.bin).set(packed, existing * this._bpv);
        }
      } else {
        entry.pending[existing - committed].packed = packed;
      }
      entry.meta[existing] = metadata;
    } else {
      const idx = entry.ids.length;
      entry.ids.push(id);
      entry.meta.push(metadata);
      entry.idMap.set(id, idx);
      entry.pending.push({ id, packed, metadata });
    }
    entry.dirty = true;
  }
  /** Swap-with-last delete (como PHP). */
  remove(col, id) {
    const entry = this._load(col);
    const idx = entry.idMap.get(id);
    if (idx === void 0) return false;
    if (entry.pending.length > 0) this._flushCol(col, entry);
    const lastIdx = entry.ids.length - 1;
    const bpv = this._bpv;
    const u8 = new Uint8Array(entry.bin);
    if (idx !== lastIdx) {
      const lastId = entry.ids[lastIdx];
      u8.copyWithin(idx * bpv, lastIdx * bpv, (lastIdx + 1) * bpv);
      entry.ids[idx] = lastId;
      entry.meta[idx] = entry.meta[lastIdx];
      entry.idMap.set(lastId, idx);
    }
    entry.ids.pop();
    entry.meta.pop();
    entry.idMap.delete(id);
    entry.bin = entry.bin.slice(0, entry.ids.length * bpv);
    this._adapter.writeBin(this._binFile(col), entry.bin);
    entry.dirty = true;
    return true;
  }
  drop(col) {
    this._adapter.delete(this._binFile(col));
    this._adapter.delete(this._jsonFile(col));
    this._collections.delete(col);
  }
  _flushCol(col, entry) {
    if (entry.pending.length > 0) {
      const committed = entry.ids.length - entry.pending.length;
      const total = entry.ids.length;
      const bpv = this._bpv;
      const newBuf = new ArrayBuffer(total * bpv);
      const dst = new Uint8Array(newBuf);
      if (entry.bin && committed > 0) {
        dst.set(new Uint8Array(entry.bin, 0, committed * bpv));
      }
      for (let p = 0; p < entry.pending.length; p++) {
        dst.set(entry.pending[p].packed, (committed + p) * bpv);
      }
      entry.bin = newBuf;
      entry.pending = [];
    }
    if (entry.bin) this._adapter.writeBin(this._binFile(col), entry.bin);
    const manifest = { ids: entry.ids, meta: entry.meta, dim: this.dim };
    if (entry.model) manifest.model = entry.model;
    this._adapter.writeJson(this._jsonFile(col), manifest);
    entry.dirty = false;
  }
  flush() {
    for (const [col, entry] of this._collections) {
      if (entry.dirty) this._flushCol(col, entry);
    }
  }
  get(col, id) {
    const entry = this._load(col);
    const idx = entry.idMap.get(id);
    if (idx === void 0) return null;
    return { id, vector: this._readVec(col, idx), metadata: entry.meta[idx] };
  }
  has(col, id) {
    return this._load(col).idMap.has(id);
  }
  count(col) {
    return this._load(col).ids.length;
  }
  ids(col) {
    return this._load(col).ids.slice();
  }
  bytesPerVector() {
    return this._bpv;
  }
  /**
   * Search: cosine usa Hamming directo (ultra-rapido), otros dequantizan.
   */
  search(col, query, limit = 5, dimSlice = 0, metric = "cosine", filter = null) {
    const entry = this._load(col);
    if (entry.pending.length > 0) this._flushCol(col, entry);
    const dims = dimSlice > 0 ? Math.min(dimSlice, this.dim) : this.dim;
    const n = entry.ids.length;
    const heap = new TopKHeap(limit);
    if (metric === "cosine" && entry.bin) {
      const qBin = _BinaryQuantizedStore.quantize(query, this.dim);
      const u8 = new Uint8Array(entry.bin);
      const bpv = this._bpv;
      for (let i = 0; i < n; i++) {
        if (filter && !matchFilter(entry.meta[i], filter)) continue;
        const score = _BinaryQuantizedStore.binaryCosineSim(qBin, 0, u8, i * bpv, dims);
        heap.push({ id: entry.ids[i], score, metadata: entry.meta[i] });
      }
    } else {
      const qNorm = normalize(query);
      for (let i = 0; i < n; i++) {
        if (filter && !matchFilter(entry.meta[i], filter)) continue;
        const vec = this._readVec(col, i);
        const score = computeScore(qNorm, vec, dims, metric);
        heap.push({ id: entry.ids[i], score, metadata: entry.meta[i] });
      }
    }
    return heap.sorted();
  }
  matryoshkaSearch(col, query, limit = 5, stages = [128, 384, 768], metric = "cosine") {
    const entry = this._load(col);
    if (entry.ids.length === 0) return [];
    if (entry.pending.length > 0) this._flushCol(col, entry);
    const factor = 4;
    const useBinary = metric === "cosine" && entry.bin;
    const qBin = useBinary ? _BinaryQuantizedStore.quantize(query, this.dim) : null;
    const qNorm = useBinary ? null : normalize(query);
    const u8 = useBinary ? new Uint8Array(entry.bin) : null;
    const bpv = this._bpv;
    let candidates = entry.ids.map((id, i) => ({ id, idx: i, metadata: entry.meta[i] }));
    for (let s = 0; s < stages.length; s++) {
      const dims = Math.min(stages[s], this.dim);
      const keepN = s < stages.length - 1 ? Math.max(limit * factor * (stages.length - s), limit) : limit;
      const heap = new TopKHeap(keepN);
      for (const c of candidates) {
        let score;
        if (useBinary) {
          score = _BinaryQuantizedStore.binaryCosineSim(qBin, 0, u8, c.idx * bpv, dims);
        } else {
          const vec = this._readVec(col, c.idx);
          score = computeScore(qNorm, vec, dims, metric);
        }
        heap.push({ ...c, score });
      }
      candidates = heap.sorted();
    }
    return candidates.slice(0, limit).map(({ id, score, metadata }) => ({ id, score, metadata }));
  }
  searchAcross(collections, query, limit = 5, metric = "cosine") {
    return _normalizedSearchAcross(this, collections, query, limit, metric);
  }
  import(col, records) {
    for (const r of records) this.set(col, r.id, r.vector, r.metadata ?? {});
    return records.length;
  }
  export(col) {
    const entry = this._load(col);
    return entry.ids.map((id, i) => ({
      id,
      vector: this._readVec(col, i),
      metadata: entry.meta[i]
    }));
  }
};
var PolarQuantizedStore = class {
  static {
    __name(this, "PolarQuantizedStore");
  }
  /**
   * @param {string|object} dirOrAdapter
   * @param {number} dim  Debe ser par
   * @param {object} [opts]
   * @param {number} [opts.bits=3]     Bits por angulo (2-8)
   * @param {number} [opts.seed=42]    Seed para la rotacion determinista
   * @param {string} [opts.model]      Modelo de embeddings
   */
  constructor(dirOrAdapter, dim = 768, opts = {}) {
    if (dim % 2 !== 0) throw new Error("PolarQuantizedStore: dim must be even");
    this.dim = dim;
    this.bits = opts.bits || 3;
    this.seed = opts.seed ?? 42;
    this.defaultModel = opts.model || null;
    this.silent = !!opts.silent;
    this._levels = 1 << this.bits;
    this._pairs = dim / 2;
    this._bitsPerVec = this._pairs * this.bits;
    this._bytesPerVec = Math.ceil(this._bitsPerVec / 8);
    this._adapter = typeof dirOrAdapter === "string" ? new FileStorageAdapter(dirOrAdapter) : dirOrAdapter;
    this._collections = /* @__PURE__ */ new Map();
    this._warnedMatryoshka = false;
    this._cosTable = new Float64Array(this._levels);
    this._sinTable = new Float64Array(this._levels);
    for (let i = 0; i < this._levels; i++) {
      const theta = -Math.PI + (i + 0.5) * (2 * Math.PI / this._levels);
      this._cosTable[i] = Math.cos(theta);
      this._sinTable[i] = Math.sin(theta);
    }
    this._rotation = this._generateRotation(dim, this.seed);
  }
  _binFile(col) {
    return `${col}.p3.bin`;
  }
  _jsonFile(col) {
    return `${col}.p3.json`;
  }
  /** PRNG determinista (xorshift32) */
  _xorshift(state) {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return state >>> 0;
  }
  /** Genera una rotacion pseudo-aleatoria determinista.
   *  Usa vectores aleatorios + Gram-Schmidt simplificado en pares.
   *  No es una rotacion ortogonal completa (O(n^2)), pero distribuye energia
   *  suficientemente para mejorar cuantizacion uniforme. */
  _generateRotation(dim, seed) {
    const signs = new Float64Array(dim);
    let state = seed || 42;
    for (let i = 0; i < dim; i++) {
      state = this._xorshift(state);
      signs[i] = state & 1 ? 1 : -1;
    }
    const perm = new Uint32Array(dim);
    for (let i = 0; i < dim; i++) perm[i] = i;
    state = seed * 7 + 13;
    for (let i = dim - 1; i > 0; i--) {
      state = this._xorshift(state);
      const j = state % (i + 1);
      const tmp = perm[i];
      perm[i] = perm[j];
      perm[j] = tmp;
    }
    return { signs, perm };
  }
  /** Aplica rotacion: sign-flip + permute */
  _rotate(vec) {
    const { signs, perm } = this._rotation;
    const out = new Float64Array(this.dim);
    for (let i = 0; i < this.dim; i++) {
      out[i] = vec[perm[i]] * signs[perm[i]];
    }
    return out;
  }
  /** Cuantiza un vector a angulos de 3 bits */
  _quantize(vector) {
    const norm = normalize(vector);
    const rotated = this._rotate(norm);
    const indices = new Uint8Array(this._pairs);
    for (let p = 0; p < this._pairs; p++) {
      const a = rotated[p * 2];
      const b = rotated[p * 2 + 1];
      const theta = Math.atan2(b, a);
      let level = Math.floor((theta + Math.PI) / (2 * Math.PI) * this._levels);
      if (level >= this._levels) level = this._levels - 1;
      indices[p] = level;
    }
    return this._packBits(indices);
  }
  /** Empaqueta array de indices (0..levels-1) a bytes */
  _packBits(indices) {
    const buf = new Uint8Array(this._bytesPerVec);
    let bitPos = 0;
    for (let p = 0; p < this._pairs; p++) {
      const val = indices[p];
      for (let b = this.bits - 1; b >= 0; b--) {
        if (val & 1 << b) {
          buf[bitPos >> 3] |= 1 << 7 - (bitPos & 7);
        }
        bitPos++;
      }
    }
    return buf;
  }
  /** Desempaqueta bytes a array de indices */
  _unpackBits(packed, offset) {
    const indices = new Uint8Array(this._pairs);
    let bitPos = 0;
    for (let p = 0; p < this._pairs; p++) {
      let val = 0;
      for (let b = this.bits - 1; b >= 0; b--) {
        const byteIdx = offset + (bitPos >> 3);
        const bitIdx = 7 - (bitPos & 7);
        if (packed[byteIdx] & 1 << bitIdx) val |= 1 << b;
        bitPos++;
      }
      indices[p] = val;
    }
    return indices;
  }
  /** Reconstruye vector unitario desde angulos cuantizados (en espacio rotado) */
  _dequantize(packed, offset) {
    const indices = this._unpackBits(packed, offset);
    const rotated = new Float64Array(this.dim);
    for (let p = 0; p < this._pairs; p++) {
      rotated[p * 2] = this._cosTable[indices[p]];
      rotated[p * 2 + 1] = this._sinTable[indices[p]];
    }
    const { signs, perm } = this._rotation;
    const out = new Float64Array(this.dim);
    for (let i = 0; i < this.dim; i++) {
      out[perm[i]] = rotated[i] * signs[perm[i]];
    }
    return out;
  }
  /** Coseno aproximado directo entre query (float) y stored (packed bits) */
  _cosinePolar(query, packed, offset) {
    const indices = this._unpackBits(packed, offset);
    const queryRot = this._rotate(query);
    let dot = 0, nq = 0;
    for (let p = 0; p < this._pairs; p++) {
      const qa = queryRot[p * 2];
      const qb = queryRot[p * 2 + 1];
      dot += qa * this._cosTable[indices[p]] + qb * this._sinTable[indices[p]];
      nq += qa * qa + qb * qb;
    }
    const denomQ = Math.sqrt(nq);
    return denomQ === 0 ? 0 : dot / denomQ;
  }
  // ── Collection management (same pattern as other stores) ─────
  _load(col) {
    if (this._collections.has(col)) return this._collections.get(col);
    const manifest = this._adapter.readJson(this._jsonFile(col));
    const ids = manifest ? manifest.ids : [];
    const meta = manifest ? manifest.meta : [];
    const model = manifest?.model || this.defaultModel || null;
    const idMap = /* @__PURE__ */ new Map();
    for (let i = 0; i < ids.length; i++) idMap.set(ids[i], i);
    const bin = this._adapter.readBin(this._binFile(col));
    const entry = { ids, meta, idMap, bin, model, pending: [], dirty: false };
    this._collections.set(col, entry);
    return entry;
  }
  getModel(col) {
    return this._load(col).model;
  }
  setModel(col, model) {
    const e = this._load(col);
    e.model = model;
    e.dirty = true;
  }
  set(col, id, vector, metadata = {}) {
    const entry = this._load(col);
    const existing = entry.idMap.get(id);
    const packed = this._quantize(vector);
    if (existing !== void 0) {
      const committed = entry.ids.length - entry.pending.length;
      if (existing < committed && entry.bin) {
        new Uint8Array(entry.bin).set(packed, existing * this._bytesPerVec);
      } else if (existing >= committed) {
        entry.pending[existing - committed].packed = packed;
      }
      entry.meta[existing] = metadata;
    } else {
      const idx = entry.ids.length;
      entry.ids.push(id);
      entry.meta.push(metadata);
      entry.idMap.set(id, idx);
      entry.pending.push({ id, packed, metadata });
    }
    entry.dirty = true;
  }
  remove(col, id) {
    const entry = this._load(col);
    const idx = entry.idMap.get(id);
    if (idx === void 0) return false;
    if (entry.pending.length > 0) this._flushCol(col, entry);
    const lastIdx = entry.ids.length - 1;
    const bpv = this._bytesPerVec;
    const u8 = new Uint8Array(entry.bin);
    if (idx !== lastIdx) {
      const lastId = entry.ids[lastIdx];
      u8.copyWithin(idx * bpv, lastIdx * bpv, (lastIdx + 1) * bpv);
      entry.ids[idx] = lastId;
      entry.meta[idx] = entry.meta[lastIdx];
      entry.idMap.set(lastId, idx);
    }
    entry.ids.pop();
    entry.meta.pop();
    entry.idMap.delete(id);
    entry.bin = entry.bin.slice(0, entry.ids.length * bpv);
    this._adapter.writeBin(this._binFile(col), entry.bin);
    entry.dirty = true;
    return true;
  }
  drop(col) {
    this._adapter.delete(this._binFile(col));
    this._adapter.delete(this._jsonFile(col));
    this._collections.delete(col);
  }
  _flushCol(col, entry) {
    if (entry.pending.length > 0) {
      const committed = entry.ids.length - entry.pending.length;
      const total = entry.ids.length;
      const bpv = this._bytesPerVec;
      const newBuf = new ArrayBuffer(total * bpv);
      const dst = new Uint8Array(newBuf);
      if (entry.bin && committed > 0) dst.set(new Uint8Array(entry.bin, 0, committed * bpv));
      for (let p = 0; p < entry.pending.length; p++) {
        dst.set(entry.pending[p].packed, (committed + p) * bpv);
      }
      entry.bin = newBuf;
      entry.pending = [];
    }
    if (entry.bin) this._adapter.writeBin(this._binFile(col), entry.bin);
    const manifest = { ids: entry.ids, meta: entry.meta, dim: this.dim, bits: this.bits, seed: this.seed };
    if (entry.model) manifest.model = entry.model;
    this._adapter.writeJson(this._jsonFile(col), manifest);
    entry.dirty = false;
  }
  flush() {
    for (const [col, entry] of this._collections) {
      if (entry.dirty) this._flushCol(col, entry);
    }
  }
  get(col, id) {
    const entry = this._load(col);
    const idx = entry.idMap.get(id);
    if (idx === void 0) return null;
    return { id, vector: Array.from(this._readVec(col, idx)), metadata: entry.meta[idx] };
  }
  _readVec(col, idx) {
    const entry = this._collections.get(col) || this._load(col);
    const committed = entry.ids.length - entry.pending.length;
    if (idx < committed) {
      if (!entry.bin) return null;
      return this._dequantize(new Uint8Array(entry.bin), idx * this._bytesPerVec);
    }
    return this._dequantize(entry.pending[idx - committed].packed, 0);
  }
  has(col, id) {
    return this._load(col).idMap.has(id);
  }
  count(col) {
    return this._load(col).ids.length;
  }
  ids(col) {
    return this._load(col).ids.slice();
  }
  bytesPerVector() {
    return this._bytesPerVec;
  }
  search(col, query, limit = 5, dimSlice = 0, metric = "cosine", filter = null) {
    const entry = this._load(col);
    if (entry.pending.length > 0) this._flushCol(col, entry);
    const n = entry.ids.length;
    const heap = new TopKHeap(limit);
    if (metric === "cosine" && entry.bin) {
      const qNorm = normalize(query);
      const u8 = new Uint8Array(entry.bin);
      const bpv = this._bytesPerVec;
      for (let i = 0; i < n; i++) {
        if (filter && !matchFilter(entry.meta[i], filter)) continue;
        const score = this._cosinePolar(qNorm, u8, i * bpv);
        heap.push({ id: entry.ids[i], score, metadata: entry.meta[i] });
      }
    } else {
      const qNorm = normalize(query);
      for (let i = 0; i < n; i++) {
        if (filter && !matchFilter(entry.meta[i], filter)) continue;
        const vec = this._readVec(col, i);
        const score = computeScore(qNorm, vec, this.dim, metric);
        heap.push({ id: entry.ids[i], score, metadata: entry.meta[i] });
      }
    }
    return heap.sorted();
  }
  /**
   * Matryoshka multi-stage search.
   *
   * IMPORTANT: PolarQuantizedStore packs vectors as quantized angles in a
   * rotated frame, which means the prefix-of-dimensions trick that makes
   * matryoshka cheap on Float32 doesn't apply directly. This implementation
   * dequantizes to Float32 internally on each stage — the cascade still
   * filters candidates progressively but you do NOT get the speedup that
   * matryoshka delivers on `VectorStore` (Float32) or `QuantizedStore` (Int8).
   *
   * For maximum throughput on large polar-quantized indexes, prefer:
   *   1. `search()` (single-stage flat) over the polar store, OR
   *   2. A coarse-then-fine pattern: BinaryQuantizedStore for stage 1
   *      (pre-filter via Hamming distance), PolarQuantizedStore for refine.
   *
   * Pass `{ silent: true }` to the constructor to suppress this warning.
   */
  matryoshkaSearch(col, query, limit = 5, stages = [128, 384, 768], metric = "cosine") {
    const entry = this._load(col);
    if (entry.ids.length === 0) return [];
    if (entry.pending.length > 0) this._flushCol(col, entry);
    if (!this._warnedMatryoshka && !this.silent && typeof console !== "undefined" && console.warn) {
      this._warnedMatryoshka = true;
      console.warn(
        "[PolarQuantizedStore] matryoshkaSearch dequantizes to Float32 per stage \u2014 no speedup over flat search. See JSDoc for alternatives. Suppress: new PolarQuantizedStore(..., { silent: true })."
      );
    }
    const factor = 4;
    let candidates = entry.ids.map((id, i) => ({ id, idx: i, metadata: entry.meta[i] }));
    for (let s = 0; s < stages.length; s++) {
      const dims = Math.min(stages[s], this.dim);
      const keepN = s < stages.length - 1 ? Math.max(limit * factor * (stages.length - s), limit) : limit;
      const heap = new TopKHeap(keepN);
      for (const c of candidates) {
        const vec = this._readVec(col, c.idx);
        const score = cosineSim(query, vec, dims);
        heap.push({ ...c, score });
      }
      candidates = heap.sorted();
    }
    return candidates.slice(0, limit).map(({ id, score, metadata }) => ({ id, score, metadata }));
  }
  searchAcross(collections, query, limit = 5, metric = "cosine") {
    return _normalizedSearchAcross(this, collections, query, limit, metric);
  }
  import(col, records) {
    for (const r of records) this.set(col, r.id, r.vector, r.metadata ?? {});
    return records.length;
  }
  export(col) {
    const entry = this._load(col);
    return entry.ids.map((id, i) => ({
      id,
      vector: Array.from(this._readVec(col, i)),
      metadata: entry.meta[i]
    }));
  }
};
var SimpleTokenizer = class _SimpleTokenizer {
  static {
    __name(this, "SimpleTokenizer");
  }
  constructor(stopWords = null, minLength = 2) {
    this.minLength = minLength;
    const words = stopWords || _SimpleTokenizer.DEFAULT_STOP_WORDS;
    this.stopWords = new Set(words);
  }
  tokenize(text) {
    return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= this.minLength && !this.stopWords.has(t));
  }
};
SimpleTokenizer.DEFAULT_STOP_WORDS = [
  "a",
  "about",
  "above",
  "after",
  "again",
  "against",
  "all",
  "am",
  "an",
  "and",
  "any",
  "are",
  "aren't",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "by",
  "can't",
  "cannot",
  "could",
  "couldn't",
  "did",
  "didn't",
  "do",
  "does",
  "doesn't",
  "doing",
  "don't",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "get",
  "got",
  "had",
  "hadn't",
  "has",
  "hasn't",
  "have",
  "haven't",
  "having",
  "he",
  "her",
  "here",
  "hers",
  "herself",
  "him",
  "himself",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "isn't",
  "it",
  "its",
  "itself",
  "let's",
  "me",
  "more",
  "most",
  "mustn't",
  "my",
  "myself",
  "no",
  "nor",
  "not",
  "of",
  "off",
  "on",
  "once",
  "only",
  "or",
  "other",
  "ought",
  "our",
  "ours",
  "ourselves",
  "out",
  "over",
  "own",
  "same",
  "shan't",
  "she",
  "should",
  "shouldn't",
  "so",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "theirs",
  "them",
  "themselves",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "was",
  "wasn't",
  "we",
  "were",
  "weren't",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "will",
  "with",
  "won't",
  "would",
  "wouldn't",
  "you",
  "your",
  "yours",
  "yourself",
  "yourselves",
  // Spanish
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "de",
  "del",
  "al",
  "en",
  "con",
  "por",
  "para",
  "es",
  "son",
  "fue",
  "ser",
  "como",
  "pero",
  "su",
  "sus",
  "se",
  "le",
  "les",
  "lo",
  "que",
  "y",
  "o",
  "no",
  "si",
  "mi",
  "tu",
  "nos",
  "mas",
  "este",
  "esta",
  "estos",
  "estas",
  "ese",
  "esa",
  "esos",
  "esas"
];
var BM25Index = class {
  static {
    __name(this, "BM25Index");
  }
  /**
   * @param {object} [opts]
   * @param {number} [opts.k1=1.5]  Term frequency saturation
   * @param {number} [opts.b=0.75]  Length normalization (0-1)
   * @param {SimpleTokenizer|object} [opts.tokenizer]  Debe tener .tokenize(text)
   */
  constructor(opts = {}) {
    this.k1 = opts.k1 ?? 1.5;
    this.b = opts.b ?? 0.75;
    this.tokenizer = opts.tokenizer || new SimpleTokenizer();
    this._data = /* @__PURE__ */ new Map();
  }
  _getCol(col) {
    if (!this._data.has(col)) {
      this._data.set(col, {
        invertedIndex: /* @__PURE__ */ new Map(),
        docLengths: /* @__PURE__ */ new Map(),
        totalTokens: 0,
        docCount: 0
      });
    }
    return this._data.get(col);
  }
  /**
   * Agrega un documento al indice BM25.
   */
  addDocument(col, id, text) {
    const d = this._getCol(col);
    if (d.docLengths.has(id)) this.removeDocument(col, id);
    const tokens = this.tokenizer.tokenize(text);
    d.docLengths.set(id, tokens.length);
    d.totalTokens += tokens.length;
    d.docCount++;
    const tf = /* @__PURE__ */ new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    for (const [term, freq] of tf) {
      if (!d.invertedIndex.has(term)) d.invertedIndex.set(term, /* @__PURE__ */ new Map());
      d.invertedIndex.get(term).set(id, freq);
    }
  }
  removeDocument(col, id) {
    const d = this._data.get(col);
    if (!d || !d.docLengths.has(id)) return;
    const dl = d.docLengths.get(id);
    d.totalTokens -= dl;
    d.docCount--;
    d.docLengths.delete(id);
    for (const [term, postings] of d.invertedIndex) {
      postings.delete(id);
      if (postings.size === 0) d.invertedIndex.delete(term);
    }
  }
  count(col) {
    return this._data.has(col) ? this._data.get(col).docCount : 0;
  }
  vocabularySize(col) {
    return this._data.has(col) ? this._data.get(col).invertedIndex.size : 0;
  }
  /**
   * Calcula BM25 scores para todos los docs contra un query.
   * @returns {Map<string, number>} docId → score
   */
  scoreAll(col, query) {
    const d = this._data.get(col);
    if (!d || d.docCount === 0) return /* @__PURE__ */ new Map();
    const queryTokens = this.tokenizer.tokenize(query);
    const N = d.docCount;
    const avgDl = d.totalTokens / N;
    const scores = /* @__PURE__ */ new Map();
    for (const term of queryTokens) {
      const postings = d.invertedIndex.get(term);
      if (!postings) continue;
      const df = postings.size;
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
      for (const [docId, tf] of postings) {
        const dl = d.docLengths.get(docId);
        const tfNorm = tf * (this.k1 + 1) / (tf + this.k1 * (1 - this.b + this.b * dl / avgDl));
        const score = idf * tfNorm;
        scores.set(docId, (scores.get(docId) || 0) + score);
      }
    }
    return scores;
  }
  /**
   * Busca los top-K documentos por BM25.
   * @returns {{ id: string, score: number }[]}
   */
  search(col, query, limit = 10) {
    const scores = this.scoreAll(col, query);
    const heap = new TopKHeap(limit);
    for (const [id, score] of scores) {
      heap.push({ id, score });
    }
    return heap.sorted();
  }
  /** Exporta el estado para persistencia. */
  exportState(col) {
    const d = this._data.get(col);
    if (!d) return null;
    return {
      totalTokens: d.totalTokens,
      docCount: d.docCount,
      docLengths: Object.fromEntries(d.docLengths),
      invertedIndex: Object.fromEntries(
        Array.from(d.invertedIndex).map(
          ([term, postings]) => [term, Object.fromEntries(postings)]
        )
      )
    };
  }
  /** Importa estado desde persistencia. */
  importState(col, state) {
    const d = this._getCol(col);
    d.totalTokens = state.totalTokens;
    d.docCount = state.docCount;
    d.docLengths = new Map(Object.entries(state.docLengths).map(([k, v]) => [k, v]));
    d.invertedIndex = new Map(
      Object.entries(state.invertedIndex).map(
        ([term, postings]) => [term, new Map(Object.entries(postings).map(([k, v]) => [k, v]))]
      )
    );
  }
  /** Guarda a un adapter (compatible con el patron de los stores). */
  save(adapter, col) {
    const state = this.exportState(col);
    if (state) adapter.writeJson(`${col}.bm25.json`, state);
  }
  /** Carga desde un adapter. */
  load(adapter, col) {
    const state = adapter.readJson(`${col}.bm25.json`);
    if (state) this.importState(col, state);
  }
};
var HybridSearch = class {
  static {
    __name(this, "HybridSearch");
  }
  /**
   * @param {VectorStore|QuantizedStore|BinaryQuantizedStore} store
   * @param {BM25Index} bm25
   * @param {'rrf'|'weighted'} mode
   */
  constructor(store, bm25, mode = "rrf") {
    this.store = store;
    this.bm25 = bm25;
    this.mode = mode;
  }
  /**
   * Búsqueda híbrida: combina vector similarity + BM25 text relevance.
   *
   * @param {string} col         Colección
   * @param {number[]} vector    Query vector (embedding)
   * @param {string} text        Query text (para BM25)
   * @param {number} [limit=5]
   * @param {object} [opts]
   * @param {number} [opts.vectorWeight=0.5]  Peso para vector (modo weighted)
   * @param {number} [opts.textWeight=0.5]    Peso para BM25 (modo weighted)
   * @param {number} [opts.rrfK=60]           K para RRF
   * @param {number} [opts.fetchK]            Candidatos del vector search (default: max(limit*3,50))
   * @param {string} [opts.metric='cosine']
   */
  search(col, vector, text, limit = 5, opts = {}) {
    const vectorWeight = opts.vectorWeight ?? 0.5;
    const textWeight = opts.textWeight ?? 0.5;
    const rrfK = opts.rrfK ?? 60;
    const fetchK = opts.fetchK ?? Math.max(limit * 3, 50);
    const metric = opts.metric ?? "cosine";
    const vecResults = this.store.search(col, vector, fetchK, 0, metric);
    const bm25Scores = this.bm25.scoreAll(col, text);
    if (this.mode === "rrf") {
      return this._fuseRRF(vecResults, bm25Scores, limit, rrfK);
    } else {
      return this._fuseWeighted(vecResults, bm25Scores, limit, vectorWeight, textWeight);
    }
  }
  /**
   * Reciprocal Rank Fusion.
   * score(d) = sum(1 / (k + rank_i)) para cada sistema donde d aparece
   */
  _fuseRRF(vecResults, bm25Scores, limit, rrfK) {
    const fused = /* @__PURE__ */ new Map();
    for (let r = 0; r < vecResults.length; r++) {
      const v = vecResults[r];
      const rrfScore = 1 / (rrfK + r + 1);
      const entry = fused.get(v.id) || { score: 0, metadata: v.metadata };
      entry.score += rrfScore;
      fused.set(v.id, entry);
    }
    const bm25Sorted = Array.from(bm25Scores.entries()).sort((a, b) => b[1] - a[1]);
    for (let r = 0; r < bm25Sorted.length; r++) {
      const [id, _score] = bm25Sorted[r];
      const rrfScore = 1 / (rrfK + r + 1);
      const entry = fused.get(id) || { score: 0, metadata: {} };
      entry.score += rrfScore;
      fused.set(id, entry);
    }
    const heap = new TopKHeap(limit);
    for (const [id, entry] of fused) {
      heap.push({ id, score: Math.round(entry.score * 1e6) / 1e6, metadata: entry.metadata });
    }
    return heap.sorted();
  }
  /**
   * Weighted fusion con min-max normalization.
   */
  _fuseWeighted(vecResults, bm25Scores, limit, vectorWeight, textWeight) {
    let vecMin = Infinity, vecMax = -Infinity;
    for (const r of vecResults) {
      if (r.score < vecMin) vecMin = r.score;
      if (r.score > vecMax) vecMax = r.score;
    }
    const vecRange = vecMax - vecMin;
    let bm25Min = Infinity, bm25Max = -Infinity;
    for (const [, s] of bm25Scores) {
      if (s < bm25Min) bm25Min = s;
      if (s > bm25Max) bm25Max = s;
    }
    const bm25Range = bm25Max - bm25Min;
    const fused = /* @__PURE__ */ new Map();
    for (const r of vecResults) {
      const normVec = vecRange > 0 ? (r.score - vecMin) / vecRange : 1;
      const normBm25 = bm25Scores.has(r.id) ? bm25Range > 0 ? (bm25Scores.get(r.id) - bm25Min) / bm25Range : 1 : 0;
      fused.set(r.id, {
        score: vectorWeight * normVec + textWeight * normBm25,
        metadata: r.metadata
      });
    }
    for (const [id, bm25Score] of bm25Scores) {
      if (!fused.has(id)) {
        const normBm25 = bm25Range > 0 ? (bm25Score - bm25Min) / bm25Range : 1;
        fused.set(id, { score: textWeight * normBm25, metadata: {} });
      }
    }
    const heap = new TopKHeap(limit);
    for (const [id, entry] of fused) {
      heap.push({ id, score: Math.round(entry.score * 1e6) / 1e6, metadata: entry.metadata });
    }
    return heap.sorted();
  }
  /**
   * Búsqueda híbrida en múltiples colecciones.
   */
  searchAcross(collections, vector, text, limit = 5, opts = {}) {
    const heap = new TopKHeap(limit);
    for (const col of collections) {
      const results = this.search(col, vector, text, limit, opts);
      for (const r of results) {
        heap.push({ ...r, collection: col });
      }
    }
    return heap.sorted();
  }
};

// cloudflare-worker.js
var JWT_SECRET = "pi-sovereign-jwt-secret-2026";
var VECTOR_CONFIG = {
  dimensions: 768,
  storeType: "binary",
  // 'float32' | 'int8' | 'binary' | 'polar'
  maxCollections: 50
};
var cloudflare_worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const docAdapter = new import_js_doc_store.CloudflareKVAdapter(env.DOC_STORE_KV, "jsdoc/");
    const vectorAdapter = new import_js_doc_store.CloudflareKVAdapter(env.DOC_STORE_KV, "vec/");
    await docAdapter.preloadAll();
    await vectorAdapter.preloadAll();
    const db = new import_js_doc_store.DocStore(docAdapter);
    let vectorStore;
    switch (VECTOR_CONFIG.storeType) {
      case "int8":
        vectorStore = new QuantizedStore(vectorAdapter, VECTOR_CONFIG.dimensions);
        break;
      case "binary":
        vectorStore = new BinaryQuantizedStore(vectorAdapter, VECTOR_CONFIG.dimensions);
        break;
      case "polar":
        vectorStore = new PolarQuantizedStore(vectorAdapter, VECTOR_CONFIG.dimensions);
        break;
      default:
        vectorStore = new VectorStore(vectorAdapter, VECTOR_CONFIG.dimensions);
    }
    const bm25Store = new BM25Index();
    const auth = new import_js_doc_store.Auth(db, { secret: JWT_SECRET });
    await auth.init();
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    async function verifyAuth(request2) {
      const authHeader = request2.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return { error: "No token", status: 401 };
      }
      const token = authHeader.slice(7);
      const payload = await auth.verify(token);
      if (!payload) {
        return { error: "Invalid token", status: 401 };
      }
      return { user: payload };
    }
    __name(verifyAuth, "verifyAuth");
    const json = /* @__PURE__ */ __name(async () => {
      try {
        return await request.json();
      } catch {
        return {};
      }
    }, "json");
    if (path === "/public/tables" && request.method === "GET") {
      const keys = await docAdapter.listKeys();
      const tables = [...new Set(keys.filter((k) => k.endsWith(".docs.json")).map((k) => k.replace(".docs.json", "")))];
      return new Response(JSON.stringify({ success: true, tables }), { headers: corsHeaders });
    }
    if (path.startsWith("/public/query/") && request.method === "GET") {
      const tableName = path.split("/").pop();
      const table = new import_js_doc_store.Table(db, tableName, { columns: [] });
      const results = table.find({}).toArray();
      return new Response(JSON.stringify({ success: true, data: results }), { headers: corsHeaders });
    }
    if (path === "/auth/register" && request.method === "POST") {
      const body = await json();
      try {
        const user = await auth.register(body.email, body.password, { name: body.name });
        await db.flush();
        await docAdapter.persist();
        return new Response(JSON.stringify({ success: true, user }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }
    if (path === "/auth/login" && request.method === "POST") {
      const body = await json();
      try {
        const result = await auth.login(body.email, body.password);
        return new Response(JSON.stringify({ success: true, token: result.token, user: result.user }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 401, headers: corsHeaders });
      }
    }
    if (path === "/admin/create-table" && request.method === "POST") {
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }
      const body = await json();
      try {
        const table = new import_js_doc_store.Table(db, body.tableName, { columns: body.columns });
        await db.flush();
        await docAdapter.persist();
        return new Response(JSON.stringify({ success: true, message: `Table ${body.tableName} created` }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }
    if (path === "/admin/insert" && request.method === "POST") {
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }
      const body = await json();
      const table = new import_js_doc_store.Table(db, body.tableName, { columns: [] });
      const doc = table.insert(body.data);
      await db.flush();
      await docAdapter.persist();
      return new Response(JSON.stringify({ success: true, id: doc._id }), { headers: corsHeaders });
    }
    if (path === "/admin/query" && request.method === "POST") {
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }
      const body = await json();
      const table = new import_js_doc_store.Table(db, body.tableName, { columns: [] });
      let query = table.find(body.filter || {});
      if (body.sort) query = query.sort(body.sort);
      if (body.limit) query = query.limit(body.limit);
      const results = query.toArray();
      return new Response(JSON.stringify({ success: true, data: results }), { headers: corsHeaders });
    }
    if (path === "/admin/update" && request.method === "POST") {
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }
      const body = await json();
      const table = new import_js_doc_store.Table(db, body.tableName, { columns: [] });
      const count = table.update(body.filter, body.update);
      await db.flush();
      await docAdapter.persist();
      return new Response(JSON.stringify({ success: true, updated: count }), { headers: corsHeaders });
    }
    if (path === "/admin/remove" && request.method === "POST") {
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }
      const body = await json();
      const table = new import_js_doc_store.Table(db, body.tableName, { columns: [] });
      const count = table.remove(body.filter);
      await db.flush();
      await docAdapter.persist();
      return new Response(JSON.stringify({ success: true, removed: count }), { headers: corsHeaders });
    }
    if (path === "/admin/aggregate" && request.method === "POST") {
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }
      const body = await json();
      const table = new import_js_doc_store.Table(db, body.tableName, { columns: [] });
      let agg = table.aggregate();
      for (const step of body.pipeline || []) {
        if (step.stage === "match") agg = agg.match(step.params);
        else if (step.stage === "lookup") agg = agg.lookup(step.params);
        else if (step.stage === "group") agg = agg.group(step.params.field, step.params.accumulators);
        else if (step.stage === "sort") agg = agg.sort(step.params);
        else if (step.stage === "limit") agg = agg.limit(step.params);
      }
      const results = agg.toArray();
      return new Response(JSON.stringify({ success: true, data: results }), { headers: corsHeaders });
    }
    if (path === "/admin/vector/index" && request.method === "POST") {
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }
      const body = await json();
      try {
        const { collection = "default", id, vector, text, metadata = {} } = body;
        if (!id || !vector) {
          return new Response(JSON.stringify({ success: false, message: "id and vector are required" }), { status: 400, headers: corsHeaders });
        }
        vectorStore.set(collection, id, vector, metadata);
        vectorStore.flush();
        if (text) {
          bm25Store.addDocument(collection, id, text);
        }
        await vectorAdapter.persist();
        return new Response(JSON.stringify({
          success: true,
          message: `Vector indexed in collection ${collection}`,
          id
        }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }
    if (path === "/admin/vector/search" && request.method === "POST") {
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }
      const body = await json();
      try {
        const {
          collection = "default",
          vector,
          limit = 10,
          metric = "cosine",
          dimSlice = 0,
          matryoshka = null
        } = body;
        if (!vector) {
          return new Response(JSON.stringify({ success: false, message: "vector is required" }), { status: 400, headers: corsHeaders });
        }
        let results;
        if (matryoshka && Array.isArray(matryoshka) && matryoshka.length > 0) {
          results = vectorStore.matryoshkaSearch(collection, vector, limit, matryoshka, metric);
        } else {
          results = vectorStore.search(collection, vector, limit, dimSlice, metric);
        }
        return new Response(JSON.stringify({ success: true, data: results }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }
    if (path === "/admin/vector/search-hybrid" && request.method === "POST") {
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }
      const body = await json();
      try {
        const {
          collection = "default",
          vector,
          text,
          limit = 10,
          metric = "cosine",
          mode = "rrf",
          vectorWeight = 0.6,
          textWeight = 0.4,
          rrfK = 60
        } = body;
        if (!vector || !text) {
          return new Response(JSON.stringify({ success: false, message: "vector and text are required" }), { status: 400, headers: corsHeaders });
        }
        const hybrid = new HybridSearch(vectorStore, bm25Store, mode);
        const results = hybrid.search(collection, vector, text, limit, {
          vectorWeight,
          textWeight,
          rrfK
        });
        return new Response(JSON.stringify({ success: true, data: results }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }
    if (path === "/admin/vector/search-cross" && request.method === "POST") {
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }
      const body = await json();
      try {
        const { collections, vector, limit = 10, metric = "cosine" } = body;
        if (!collections || !Array.isArray(collections) || collections.length === 0) {
          return new Response(JSON.stringify({ success: false, message: "collections array is required" }), { status: 400, headers: corsHeaders });
        }
        if (!vector) {
          return new Response(JSON.stringify({ success: false, message: "vector is required" }), { status: 400, headers: corsHeaders });
        }
        const results = vectorStore.searchAcross(collections, vector, limit, metric);
        return new Response(JSON.stringify({ success: true, data: results }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }
    if (path.match(/^\/admin\/vector\/[^\/]+\/[^\/]+$/) && request.method === "DELETE") {
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }
      try {
        const parts = path.split("/");
        const collection = parts[3];
        const id = parts[4];
        const removed = vectorStore.remove(collection, id);
        vectorStore.flush();
        await vectorAdapter.persist();
        return new Response(JSON.stringify({ success: true, removed }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }
    if (path === "/admin/vector/stats" && request.method === "GET") {
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }
      try {
        const stats = vectorStore.stats();
        const collections = vectorStore.collections();
        return new Response(JSON.stringify({
          success: true,
          config: VECTOR_CONFIG,
          collections,
          stats
        }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }
    if (path === "/admin/vector/collections" && request.method === "GET") {
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }
      try {
        const collections = vectorStore.collections();
        const result = collections.map((col) => ({
          name: col,
          count: vectorStore.count(col)
        }));
        return new Response(JSON.stringify({ success: true, collections: result }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }
    if (path === "/admin/vector/drop" && request.method === "POST") {
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }
      const body = await json();
      try {
        const { collection } = body;
        if (!collection) {
          return new Response(JSON.stringify({ success: false, message: "collection is required" }), { status: 400, headers: corsHeaders });
        }
        vectorStore.drop(collection);
        await vectorAdapter.persist();
        return new Response(JSON.stringify({ success: true, message: `Collection ${collection} dropped` }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }
    if (path === "/admin/vector/batch" && request.method === "POST") {
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }
      const body = await json();
      try {
        const { collection = "default", vectors } = body;
        if (!vectors || !Array.isArray(vectors)) {
          return new Response(JSON.stringify({ success: false, message: "vectors array is required" }), { status: 400, headers: corsHeaders });
        }
        let indexed = 0;
        for (const item of vectors) {
          if (item.id && item.vector) {
            vectorStore.set(collection, item.id, item.vector, item.metadata || {});
            indexed++;
          }
        }
        vectorStore.flush();
        await vectorAdapter.persist();
        return new Response(JSON.stringify({ success: true, indexed }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }
    return new Response(JSON.stringify({ success: false, message: "Not found" }), { status: 404, headers: corsHeaders });
  }
};

// C:/Users/Rckflr/AppData/Roaming/nvm/v24.11.1/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_checked_fetch();
init_modules_watch_stub();
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/Rckflr/AppData/Roaming/nvm/v24.11.1/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
init_checked_fetch();
init_modules_watch_stub();
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-EHSH7V/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = cloudflare_worker_default;

// C:/Users/Rckflr/AppData/Roaming/nvm/v24.11.1/node_modules/wrangler/templates/middleware/common.ts
init_checked_fetch();
init_modules_watch_stub();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-EHSH7V/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=cloudflare-worker.js.map
