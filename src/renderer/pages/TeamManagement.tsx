import { useEffect, useState, useCallback } from 'react';
import {
  Users, CheckCircle2, Clock, Loader2, AlertCircle, Plus,
  ExternalLink, UserCheck, XCircle, FolderOpen
} from 'lucide-react';
import { TeamMember } from '@shared/types';
import { AssignTaskModal } from '../components/AssignTaskModal';
import { AddEmployeeModal } from '../components/AddEmployeeModal';

export function TeamManagement() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [requests, setRequests] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState<TeamMember | null>(null);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await window.worktrack.manager.getTeam();
    setLoading(false);
    if (result.success && result.data) {
      setMembers(result.data.members);
      setRequests(result.data.requests);
    } else {
      setError(result.error ?? 'Failed to load team.');
    }
  }, []);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const handleApprove = async (userId: string) => {
    setActionPending(userId);
    await window.worktrack.manager.approveRequest(userId);
    setActionPending(null);
    loadTeam();
  };

  const handleReject = async (userId: string) => {
    setActionPending(userId);
    await window.worktrack.manager.rejectRequest(userId);
    setActionPending(null);
    loadTeam();
  };

  const openDrive = async (url?: string) => {
    if (url) {
      await window.worktrack.drive.openFolder(url);
    } else {
      // Open root drive
      await window.worktrack.system.openExternal('https://drive.google.com');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Team Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your team members and approve join requests.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadTeam} className="text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition">
            Refresh
          </button>
          <button onClick={() => setShowAddEmployee(true)} className="flex items-center gap-1.5 text-xs text-primary-foreground bg-primary rounded-lg px-3 py-1.5 hover:bg-primary/90 transition shadow-sm">
            <Plus className="w-3.5 h-3.5" />
            Add Member
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Join Requests */}
      {requests.length > 0 && (
        <div className="bg-card border border-amber-500/30 rounded-2xl overflow-hidden">
          <div className="bg-amber-500/5 border-b border-amber-500/20 px-5 py-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-400">Pending Requests ({requests.length})</span>
          </div>
          <div className="divide-y divide-border">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/20 flex items-center justify-center text-sm font-bold text-amber-400">
                    {req.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{req.name}</p>
                    <p className="text-xs text-muted-foreground">{req.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    id={`btn-approve-${req.id}`}
                    onClick={() => handleApprove(req.id)}
                    disabled={actionPending === req.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium rounded-lg hover:bg-green-500/20 transition disabled:opacity-50"
                  >
                    {actionPending === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                    Approve
                  </button>
                  <button
                    id={`btn-reject-${req.id}`}
                    onClick={() => handleReject(req.id)}
                    disabled={actionPending === req.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium rounded-lg hover:bg-destructive/20 transition disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Members */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="border-b border-border px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Active Members ({members.length})</span>
          </div>
          <button
            id="btn-open-drive-root"
            onClick={() => openDrive()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Open Google Drive
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading team...</span>
          </div>
        )}

        {!loading && members.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No active members yet</p>
            <p className="text-xs text-muted-foreground">Team members will appear here once approved.</p>
          </div>
        )}

        {!loading && members.length > 0 && (
          <div className="divide-y divide-border">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-violet-500/20 flex items-center justify-center text-sm font-bold text-primary">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-0.5">
                    <CheckCircle2 className="w-3 h-3" />
                    Active
                  </span>
                  <button
                    id={`btn-assign-task-${member.id}`}
                    onClick={() => setShowAssign(member)}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/20 transition"
                  >
                    <Plus className="w-3 h-3" />
                    Assign Task
                  </button>
                  <button
                    id={`btn-open-drive-${member.id}`}
                    onClick={() => openDrive(member.driveFolderUrl)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted hover:text-foreground transition"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Drive
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAssign && (
        <AssignTaskModal
          member={showAssign}
          onClose={() => setShowAssign(null)}
          onSuccess={() => { setShowAssign(null); }}
        />
      )}

      {showAddEmployee && (
        <AddEmployeeModal
          onClose={() => setShowAddEmployee(false)}
          onSuccess={() => {
            setShowAddEmployee(false);
            loadTeam();
          }}
        />
      )}
    </div>
  );
}
