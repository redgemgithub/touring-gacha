export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    getState() {
      return state;
    },
    setState(partial) {
      state = { ...state, ...partial };
      listeners.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
