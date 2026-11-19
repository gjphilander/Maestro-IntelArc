// Run with: node tests/ui/chat_dictation.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'ui/node_modules/typescript'));
const source = ts.transpileModule(fs.readFileSync(path.join(root, 'ui/src/components/shared/ChatDictation.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function harness({ supported = true, secure = true, prefixed = false, startFails = false } = {}) {
  let cursor = 0;
  const hooks = [], pending = [], cleanups = [], sessions = [], texts = [], activity = [];
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in hooks)) hooks[i] = initial;
      return [hooks[i], value => { hooks[i] = value; }];
    },
    useRef(initial) {
      const i = cursor++;
      return hooks[i] ||= { current: initial };
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!hooks[i] || deps.some((dep, index) => dep !== hooks[i][index])) {
        hooks[i] = deps;
        pending.push(() => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); });
      }
    },
  };
  class Recognition {
    constructor() { sessions.push(this); }
    start() { if (startFails) throw new Error('blocked'); }
    stop() { this.stopped = true; }
    abort() { this.aborted = true; }
    result(...results) { this.onresult?.({ results }); }
  }
  const window = { isSecureContext: secure };
  if (supported) window[prefixed ? 'webkitSpeechRecognition' : 'SpeechRecognition'] = Recognition;
  const jsx = (type, props) => ({ type, props });
  const mod = { exports: {} };
  vm.runInNewContext(source, {
    module: mod, exports: mod.exports, window, navigator: { language: 'en-ZA' },
    require: name => name === 'react' ? react : name === 'lucide-react' ? { Mic: 'mic', Square: 'square' } : { jsx, jsxs: jsx },
  });
  let tree;
  const props = { disabled: false, onText: text => texts.push(text), onActiveChange: value => activity.push(value) };
  const nodes = (node = tree) => !node || typeof node !== 'object' ? [] : [node, ...[].concat(node.props?.children || []).flatMap(nodes)];
  const render = () => { cursor = 0; tree = mod.exports.ChatDictation(props); pending.splice(0).forEach(fn => fn()); };
  render();
  return { render, sessions, texts, activity, nodes, click: () => nodes().find(n => n.type === 'button').props.onClick(), unmount: () => cleanups.forEach(fn => fn()) };
}
const final = text => ({ isFinal: true, 0: { transcript: text } });
const interim = text => ({ isFinal: false, 0: { transcript: text } });

for (const prefixed of [false, true]) {
  const h = harness({ prefixed });
  h.click(); h.render();
  const session = h.sessions[0];
  assert.equal(session.lang, 'en-ZA');
  assert.equal(session.continuous, true);
  assert.equal(h.activity.at(-1), true);
  session.result(interim('Hello wor')); h.render();
  assert.deepEqual(h.texts, []);
  assert.ok(h.nodes().some(n => n.props?.children === 'Hello wor'));
  session.result(final('Hello world'), interim('Another'));
  session.result(final('Hello world'), final('Another sentence'));
  assert.deepEqual(h.texts, ['Hello world', 'Another sentence'], 'Repeated final results are never duplicated');
  h.click(); h.render();
  assert.equal(session.stopped, true);
  assert.equal(h.activity.at(-1), true, 'Sending stays blocked until final recognition ends');
  session.result(final('Hello world'), final('Another sentence'), final('Last words'));
  session.onend(); h.render();
  assert.equal(h.activity.at(-1), false);
  assert.equal(h.texts.at(-1), 'Last words');
  assert.equal(h.nodes().find(n => n.type === 'button').props['aria-pressed'], false);
  h.click(); h.render();
  const next = h.sessions[1], lateResult = next.onresult;
  h.unmount();
  assert.equal(next.aborted, true);
  lateResult({ results: [final('must not enter another chat')] });
  assert.equal(h.texts.length, 3);
}
for (const options of [{ supported: false }, { secure: false }, { startFails: true }]) {
  const h = harness(options); h.click(); h.render();
  assert.ok(h.nodes().some(n => n.props?.role === 'alert'));
  assert.notEqual(h.activity.at(-1), true);
}
for (const error of ['not-allowed', 'network', 'audio-capture', 'no-speech']) {
  const h = harness(); h.click();
  h.sessions[0].onerror({ error }); h.render();
  assert.ok(h.nodes().some(n => n.props?.role === 'alert'));
  assert.equal(h.activity.at(-1), false);
  assert.equal(h.sessions[0].aborted, true);
}
console.log('Chat dictation: final/interim results, deduplication, stop, cleanup, browser fallback and errors passed.');
