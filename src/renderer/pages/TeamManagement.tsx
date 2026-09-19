import { useEffect, useState, useCallback } from 'react';
import {
  Users, CheckCircle2, Clock, Loader2, AlertCircle, Plus,
  ExternalLink, UserCheck, XCircle, FolderOpen, RefreshCw,
  ShieldCheck, Shield, User, ChevronDown, Trash2, AlertTriangle,
} from 'lucide-react';
import { TeamMember, UserRole } from '@shared/types';
import { AddEmployeeModal } from '../components/AddEmployeeModal';
import { useAuthStore } from '../store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Button, Badge } from '../components/ui/primitives';
import { clsx } from 'clsx';

// ── Role helpers ──────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Owner', ADMIN: 'Admin', MANAGER: 'Manager', EMPLOYEE: 'Employee',
};
const ROLE_COLOR: Record<string, string> = {
  OWNER:    'bg-rose-500/10 text-rose-600 border-rose-500/30',
  ADMIN:    'bg-purple-500/10 text-purple-600 border-purple-500/30',
  MANAGER:  'bg-primary/10 text-primary border-primary/30',
  EMPLOYEE: 'bg-muted text-muted-foreground border-border',
};
const ROLE_ICON: Record<string, React.ReactNode> = {
  OWNER:    <ShieldCheck size={12} />,
  ADMIN:    <ShieldCheck size={12} />,
  MANAGER:  <Shield size={12} />,
  EMPLOYEE: <User size={12} />,
};

// What each caller may assign / remove
const CAN_ASSIGN: Record<string, string[]> = {
  OWNER:   ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  ADMIN:   ['MANAGER', 'EMPLOYEE'],
  MANAGER: [],
};
const CAN_REMOVE: Record<string, string[]> = {
  OWNER:   ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  ADMIN:   ['MANAGER', 'EMPLOYEE'],
  MANAGER: ['EMPLOYEE'],
};

// ── Confirm-remove dialog ─────────────────────────────────────────────────────
function ConfirmRemoveDialog({
  member, onConfirm, onCancel, loading,
}: {
  member: TeamMember;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Remove member?</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              <span className="font-semibold text-foreground">{member.name}</span> will be deactivated and can no longer log in.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button
            className="flex-1 bg-destructive hover:bg-destructive/90 text-white border-transparent"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <Trash2 size={16} className="mr-1.5" />}
            Remove
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function TeamManagement() {
  const { organization, user } = useAuthStore();
  const callerRole = (user?.role ?? 'MANAGER') as UserRole;

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [requests, setRequests] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);

  // Role-change popover open for which userId
  const [roleMenuOpen, setRoleMenuOpen] = useState<string | null>(null);
  const [roleChanging, setRoleChanging] = useState<string | null>(null);

  // Remove-confirm dialog
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

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

  const handleRoleChange = async (member: TeamMember, newRole: string) => {
    if (newRole === member.role) { setRoleMenuOpen(null); return; }
    setRoleChanging(member.id);
    setRoleMenuOpen(null);
    const res = await window.worktrack.manager.setRole(member.id, newRole);
    setRoleChanging(null);
    if (res.success) {
      loadTeam();
    } else {
      setError(res.error ?? 'Failed to change role.');
    }
  };

  const handleRemoveConfirm = async () => {
    if (!removeTarget) return;
    setRemoveLoading(true);
    const res = await window.worktrack.manager.removeMember(removeTarget.id);
    setRemoveLoading(false);
    setRemoveTarget(null);
    if (res.success) {
      loadTeam();
    } else {
      setError(res.error ?? 'Failed to remove member.');
    }
  };

  const openDrive = async (url?: string) => {
    await window.worktrack.drive.openFolder(url ?? organization?.driveFolderUrl ?? 'https://drive.google.com');
  };

  const canAssign = CAN_ASSIGN[callerRole] ?? [];
  const canRemove = CAN_REMOVE[callerRole] ?? [];

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-background" onClick={() => setRoleMenuOpen(null)}>
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Team Management</h1>
            <p className="text-sm font-medium text-muted-foreground mt-1">Manage your team members, roles, and approve join requests.</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={loadTeam} disabled={loading} className="rounded-full shadow-sm">
              <RefreshCw size={18} className={loading ? 'animate-spin text-muted-foreground' : ''} />
            </Button>
            <Button className="rounded-full shadow-premium" onClick={() => setShowAddEmployee(true)}>
              <Plus size={18} className="mr-1.5" />
              Add Member
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="flex items-center gap-3 text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-xl p-4 shadow-sm"
            >
              <AlertCircle size={18} className="flex-shrink-0" />
              <span className="font-medium">{error}</span>
              <button className="ml-auto text-destructive/60 hover:text-destructive" onClick={() => setError(null)}>
                <XCircle size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Join Requests */}
        <AnimatePresence>
          {requests.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
              <Card className="border-amber-500/30 overflow-hidden shadow-lg shadow-amber-500/5">
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-7 py-5 flex items-center gap-3">
                  <Clock size={18} className="text-amber-500" />
                  <span className="font-display font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500">
                    Pending Requests ({requests.length})
                  </span>
                </div>
                <div className="divide-y divide-border/60">
                  {requests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between px-7 py-5 bg-card/40 hover:bg-card transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-sm font-bold text-white shadow-inner">
                          {req.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-base font-semibold text-foreground">{req.name}</p>
                          <p className="text-sm font-medium text-muted-foreground">{req.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" id={`btn-reject-${req.id}`}
                          onClick={() => handleReject(req.id)} disabled={actionPending === req.id}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30">
                          <XCircle size={16} className="mr-1.5" /> Reject
                        </Button>
                        <Button variant="secondary" size="sm" id={`btn-approve-${req.id}`}
                          onClick={() => handleApprove(req.id)} disabled={actionPending === req.id}
                          className="bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm border-transparent">
                          {actionPending === req.id
                            ? <Loader2 size={16} className="animate-spin mr-1.5" />
                            : <UserCheck size={16} className="mr-1.5" />}
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Members */}
        <Card className="overflow-hidden">
          <div className="border-b border-border px-7 py-5 flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Users size={16} />
              </div>
              <span className="font-display font-bold uppercase tracking-wider text-foreground">
                Active Members ({members.length})
              </span>
            </div>
            <Button variant="outline" size="sm" id="btn-open-drive-root" onClick={() => openDrive()}
              className="bg-background shadow-sm hover:shadow">
              <FolderOpen size={16} className="mr-1.5 text-muted-foreground" />
              <span className="text-muted-foreground">Org Drive</span>
            </Button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
              <Loader2 size={32} className="animate-spin text-primary" />
              <span className="text-sm font-medium">Loading team directory...</span>
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4 shadow-inner border border-border/50">
                <Users size={24} className="text-muted-foreground" />
              </div>
              <p className="text-lg font-semibold text-foreground mb-1">No active members yet</p>
              <p className="text-sm font-medium text-muted-foreground">Team members will appear here once approved.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {members.map((member) => {
                const isSelf = member.id === user?.id;
                const isOwner = member.role === 'OWNER';
                const canChangeThisRole = !isSelf && !isOwner && canAssign.length > 0
                  && !(callerRole === 'ADMIN' && member.role === 'ADMIN');
                const canRemoveThis = !isSelf && !isOwner && canRemove.includes(member.role as string);

                return (
                  <div key={member.id} className="flex flex-wrap items-center justify-between gap-4 px-7 py-5 bg-card hover:bg-muted/20 transition-colors">
                    {/* Avatar + name */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/20 flex items-center justify-center text-lg font-bold text-primary shadow-sm shrink-0">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-foreground truncate">
                          {member.name} {isSelf && <span className="text-xs text-muted-foreground font-normal">(you)</span>}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">

                      {/* Role badge / change dropdown — uses fixed positioning to escape overflow clipping */}
                      <div className="relative">
                        <button
                          disabled={!canChangeThisRole || roleChanging === member.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setRoleMenuOpen(roleMenuOpen === member.id ? null : member.id);
                          }}
                          className={clsx(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider transition-all select-none',
                            ROLE_COLOR[member.role] ?? ROLE_COLOR.EMPLOYEE,
                            canChangeThisRole && !roleChanging
                              ? 'hover:shadow-md cursor-pointer hover:scale-105'
                              : 'cursor-default'
                          )}
                        >
                          {roleChanging === member.id
                            ? <Loader2 size={11} className="animate-spin" />
                            : ROLE_ICON[member.role]}
                          {ROLE_LABEL[member.role] ?? member.role}
                          {canChangeThisRole && !roleChanging && <ChevronDown size={11} className="ml-0.5 opacity-60" />}
                        </button>

                        {/* Dropdown — fixed z-[9999] so it escapes any overflow/clip context */}
                        <AnimatePresence>
                          {roleMenuOpen === member.id && (
                            <motion.div
                              initial={{ opacity: 0, y: 6, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 4, scale: 0.95 }}
                              transition={{ duration: 0.15, ease: 'easeOut' }}
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full mt-2 z-[9999] bg-card border border-border/80 rounded-2xl shadow-2xl shadow-black/10 min-w-[180px] py-2 overflow-hidden backdrop-blur-sm"
                              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.05)' }}
                            >
                              <p className="px-4 pt-1 pb-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50 mb-1">
                                Change Role
                              </p>
                              {canAssign.map((r) => (
                                <button
                                  key={r}
                                  onClick={() => handleRoleChange(member, r)}
                                  className={clsx(
                                    'w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-all',
                                    member.role === r
                                      ? 'text-primary font-semibold bg-primary/8'
                                      : 'text-foreground hover:bg-muted/60 hover:pl-5'
                                  )}
                                >
                                  <span className={clsx(
                                    'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                                    ROLE_COLOR[r]
                                  )}>{ROLE_ICON[r]}</span>
                                  <span className="flex-1">{ROLE_LABEL[r]}</span>
                                  {member.role === r && <CheckCircle2 size={14} className="text-primary" />}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Active badge */}
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active
                      </span>

                      {/* Drive button */}
                      <Button variant="ghost" size="sm" id={`btn-open-drive-${member.id}`}
                        onClick={() => openDrive(member.driveFolderUrl)}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted border border-border/50 rounded-lg h-8 px-3 text-xs font-medium">
                        <ExternalLink size={13} className="mr-1.5" /> Drive
                      </Button>

                      {/* Remove button — always visible when allowed */}
                      {canRemoveThis && (
                        <button
                          id={`btn-remove-${member.id}`}
                          onClick={() => setRemoveTarget(member)}
                          className="flex items-center gap-1.5 px-3 py-1.5 h-8 rounded-lg text-xs font-semibold text-destructive bg-destructive/8 border border-destructive/20 hover:bg-destructive hover:text-white hover:border-destructive transition-all"
                          title={`Remove ${member.name}`}
                        >
                          <Trash2 size={13} /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

      </div>

      {/* Modals */}
      {showAddEmployee && (
        <AddEmployeeModal
          callerRole={callerRole}
          onClose={() => setShowAddEmployee(false)}
          onSuccess={() => { setShowAddEmployee(false); loadTeam(); }}
        />
      )}

      {removeTarget && (
        <ConfirmRemoveDialog
          member={removeTarget}
          loading={removeLoading}
          onConfirm={handleRemoveConfirm}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
}
