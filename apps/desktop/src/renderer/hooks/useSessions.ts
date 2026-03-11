import { useEffect, useState } from 'react';

import type { ArtifactKind, SessionBundle, SessionSummary } from '@journeyforge/shared';

export const useSessions = () => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedBundle, setSelectedBundle] = useState<SessionBundle | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const refreshSessions = async () => {
    const nextSessions = await window.journeyforge.sessions.list();
    setSessions(nextSessions);
    return nextSessions;
  };

  useEffect(() => {
    void refreshSessions();
  }, []);

  return {
    sessions,
    selectedBundle,
    selectedSessionId,
    exportMessage,
    async selectSession(sessionId: string) {
      const bundle = await window.journeyforge.sessions.get({ sessionId });
      setSelectedBundle(bundle);
      setSelectedSessionId(sessionId);
      return bundle;
    },
    async upsertBundle(bundle: SessionBundle) {
      setSelectedBundle(bundle);
      setSelectedSessionId(bundle.session.id);
      await refreshSessions();
    },
    async exportArtifacts(sessionId: string, artifactKinds: ArtifactKind[]) {
      const { exportedPaths } = await window.journeyforge.exports.write({ sessionId, artifactKinds });
      setExportMessage(exportedPaths.length > 0 ? `${exportedPaths.length}개 파일을 저장했습니다.` : '저장할 파일이 없습니다.');
      return exportedPaths;
    },
    async exportBundle(sessionId: string) {
      const { bundlePath } = await window.journeyforge.exports.write({ sessionId, mode: 'bundle' });
      setExportMessage(bundlePath ? `번들을 ${bundlePath}에 저장했습니다.` : '번들을 저장하지 못했습니다.');
      return bundlePath;
    },
    dismissExportMessage() {
      setExportMessage(null);
    },
  };
};
