const { app } = require('electron');
const path = require('path');
const fs = require('fs');

class Store {
  constructor(options = {}) {
    this._name = options.name || 'nexube-settings';
    this.defaults = options.defaults || {};
    this._cache = null;
  }

  _getFilePath() {
    return path.join(app.getPath('userData'), `${this._name}.json`);
  }

  _read() {
    if (this._cache) return this._cache;
    try {
      this._cache = { ...this.defaults, ...JSON.parse(fs.readFileSync(this._getFilePath(), 'utf8')) };
    } catch {
      this._cache = { ...this.defaults };
    }
    return this._cache;
  }

  _write() {
    const fp = this._getFilePath();
    const dir = path.dirname(fp);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(this._cache, null, 2));
  }

  _getNested(obj, keyPath) {
    return keyPath.split('.').reduce((acc, part) => {
      if (acc && typeof acc === 'object' && part in acc) return acc[part];
      return undefined;
    }, obj);
  }

  _setNested(obj, keyPath, value) {
    const parts = keyPath.split('.');
    const last = parts.pop();
    const target = parts.reduce((acc, part) => {
      if (!(part in acc)) acc[part] = {};
      return acc[part];
    }, obj);
    target[last] = value;
  }

  _deleteNested(obj, keyPath) {
    const parts = keyPath.split('.');
    const last = parts.pop();
    const target = parts.reduce((acc, part) => {
      if (acc && typeof acc === 'object' && part in acc) return acc[part];
      return undefined;
    }, obj);
    if (target) delete target[last];
  }

  get(key, defaultValue) {
    const data = this._read();
    const value = this._getNested(data, key);
    return value !== undefined ? value : defaultValue;
  }

  set(key, value) {
    const data = this._read();
    this._setNested(data, key, value);
    this._write();
  }

  delete(key) {
    const data = this._read();
    this._deleteNested(data, key);
    this._write();
  }

  clear() {
    this._cache = { ...this.defaults };
    this._write();
  }
}

module.exports = Store;
