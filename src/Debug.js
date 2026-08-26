import React, { useState } from 'react';
import { doc, getDocFromServer } from 'firebase/firestore';
import { currentUid, db } from './firebase';
import { loadSession, lastExit } from './session';
import { roleDiagnostics, resetRoleDiagnostics } from './diagnostics';

// Unlinked on purpose. Everything here is already yours -- your account, your
// seat, your own device's records -- and the seat it reads is the one your
// session names, never one you can type in. An unclaimed seat is readable by
// anybody signed in, so a box to type a name in would hand out roles.
function Debug() {
  const [probe, setProbe] = useState(null);
  const [copied, setCopied] = useState(false);

  const session = loadSession();
  const uid = currentUid();

  const testRoleDocument = async () => {
    setProbe('reading…');
    if (!session?.gameCode || !session?.playerName) {
      setProbe('no game on this device, so there is no seat to read');
      return;
    }
    try {
      const snapshot = await getDocFromServer(
        doc(db, 'games', session.gameCode, 'players', session.playerName)
      );
      if (!snapshot.exists()) {
        setProbe('READ OK, but no seat document exists for this name');
        return;
      }
      const data = snapshot.data();
      setProbe([
        'READ OK',
        `seat uid: ${data.uid || '(none)'}`,
        `matches this device: ${data.uid === uid ? 'yes' : 'NO — this is the problem'}`,
        `tasks: ${(data.tasks || []).length}`,
        `completed on server: ${(data.completedTasks || []).length}`
      ].join('\n'));
    } catch (error) {
      setProbe(`READ FAILED: ${error?.code || String(error)}`);
    }
  };

  const report = [
    `player: ${session?.playerName || '(none)'}`,
    `game: ${session?.gameCode || '(none)'}`,
    `uid: ${uid || '(signed out)'}`,
    '',
    `role listener: ${JSON.stringify(roleDiagnostics(), null, 2)}`,
    '',
    `last exit: ${JSON.stringify(lastExit(), null, 2)}`,
    '',
    `role document test: ${probe || '(not run)'}`
  ].join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
    } catch (error) {
      setCopied(false);
    }
  };

  return (
    <div className="debug-screen">
      <h2>Diagnostics</h2>
      <div className="debug-actions">
        <button onClick={testRoleDocument}>Test my role document</button>
        <button onClick={copy}>{copied ? 'Copied' : 'Copy report'}</button>
        <button onClick={() => { resetRoleDiagnostics(); setProbe(null); setCopied(false); }}>
          Reset counters
        </button>
      </div>
      <pre className="debug-report">{report}</pre>
    </div>
  );
}

export default Debug;
