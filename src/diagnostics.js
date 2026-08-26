// A running account of how the role listener is behaving, kept on the device
// so it outlives the reload that usually follows somebody noticing a problem.
// Counters only -- no role, no task list, nothing worth reading over a
// shoulder. Read it back on /debug.
const KEY = 'fake-tasker:role-listener';

const BLANK = {
  snapshots: 0,
  errors: 0,
  rebuilds: 0,
  lastSnapshotAt: null,
  lastError: null,
  lastErrorAt: null,
  lastRebuildAt: null
};

function read() {
  try {
    return { ...BLANK, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch (error) {
    return { ...BLANK };
  }
}

function write(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (error) {
    /* diagnostics are never worth breaking a round over */
  }
}

const stamp = () => new Date().toISOString();

export function noteRoleSnapshot() {
  const d = read();
  write({ ...d, snapshots: d.snapshots + 1, lastSnapshotAt: stamp() });
}

export function noteRoleError(error) {
  const d = read();
  write({ ...d, errors: d.errors + 1, lastError: error?.code || String(error), lastErrorAt: stamp() });
}

export function noteRoleRebuild() {
  const d = read();
  write({ ...d, rebuilds: d.rebuilds + 1, lastRebuildAt: stamp() });
}

export function roleDiagnostics() {
  return read();
}

export function resetRoleDiagnostics() {
  write({ ...BLANK });
}
