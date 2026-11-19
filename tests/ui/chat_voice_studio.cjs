// Run with: node tests/ui/chat_voice_studio.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'ui/node_modules/typescript'));
const source = ts.transpileModule(fs.readFileSync(path.join(root, 'ui/src/components/MainContent/OllamaChatPanel.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function harness(messages, streaming = false) {
  const states = [], calls = [];
  let cursor = 0, tree;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
    },
    useRef: value => ({ current: value }), useEffect: () => {}, useMemo: fn => fn(), useCallback: fn => fn,
  };
  const store = { setParam: (...args) => calls.push(['setParam', ...args]), setMediaFilter: value => calls.push(['setMediaFilter', value]) };
  const chat = { id: 'current', title: 'Current', model: 'local', messages, updatedAt: 1 };
  const other = { ...chat, id: 'other', messages: [{ id: 'other-reply', role: 'assistant', content: 'Wrong conversation', createdAt: 1 }] };
  const jsx = (type, props) => ({ type, props });
  const mod = { exports: {} };
  vm.runInNewContext(source, {
    module: mod, exports: mod.exports,
    localStorage: { getItem: () => JSON.stringify({ activeChatId: 'current', chats: [chat, other] }) },
    require: name => name === 'react' ? react : name === 'react/jsx-runtime' ? { jsx, jsxs: jsx }
      : name.includes('useStore') ? { useStore: fn => fn(store) }
      : name.includes('ChatDictation') ? { ChatDictation: 'dictation' } : {},
  });
  const nodes = (node = tree) => !node || typeof node !== 'object' ? [] : [node, ...[].concat(node.props?.children || []).flatMap(nodes)];
  const render = () => { cursor = 0; tree = mod.exports.OllamaChatPanel(); };
  render();
  // Set streaming through the actual state setter order established by the first render.
  if (streaming) { const index = states.findIndex((value, i) => value === false && states[i - 1] === false); states[index] = true; render(); }
  return { calls, render, nodes, speak: text => nodes().find(n => n.type === 'dictation').props.onText(text) };
}
const message = (role, content, id = content) => ({ id, role, content, createdAt: 1 });
for (const phrase of ['Use in Studio', ' use in studio. ', 'USE IN STUDIO!', 'Use   in   Studio']) {
  const h = harness([message('assistant', 'Older prompt'), message('user', 'Make it cinematic'), message('assistant', 'Latest cinematic prompt'), message('assistant', '')]);
  h.speak(phrase); h.render();
  assert.deepEqual(h.calls, [['setParam', 'prompt', 'Latest cinematic prompt'], ['setMediaFilter', 'all']]);
  assert.equal(h.nodes().find(n => n.type === 'textarea').props.value, '');
}
const ordinary = harness([]);
ordinary.speak('A scene I can use in Studio with dramatic lighting'); ordinary.render();
assert.equal(ordinary.nodes().find(n => n.type === 'textarea').props.value, 'A scene I can use in Studio with dramatic lighting');
assert.deepEqual(ordinary.calls, []);
const missing = harness([message('user', 'Hello')]);
missing.speak('Use in Studio'); missing.render();
assert.deepEqual(missing.calls, []);
assert.ok(missing.nodes().some(n => typeof n.props?.children?.[0] === 'string' && n.props.children[0].startsWith('Generate a prompt')));
const pending = harness([message('assistant', 'Incomplete prompt')], true);
pending.speak('Use in Studio'); pending.render();
assert.deepEqual(pending.calls, []);
assert.ok(pending.nodes().some(n => typeof n.props?.children?.[0] === 'string' && n.props.children[0].startsWith('Wait for')));
console.log('Voice Use in Studio: latest current-chat reply, command variants, ordinary dictation, empty chat and streaming guard passed.');
