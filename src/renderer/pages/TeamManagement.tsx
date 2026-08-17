import { useEffect, useState, useCallback } from 'react';
import {
  Users, CheckCircle2, Clock, Loader2, AlertCircle, Plus,
  ExternalLink, UserCheck, XCircle, FolderOpen, RefreshCw
} from 'lucide-react';
import { TeamMember } from '@shared/types';
import { AddEmployeeModal } from '../components/AddEmployeeModal';
import { useAuthStore } from '../store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Button, Badge } from '../components/ui/primitives';

export function TeamManagement() {
  const { organization } = useAuthStore();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [requests, setRequests] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    await window.worktrack.drive.openFolder(url ?? organization?.driveFolderUrl ?? 'https://drive.google.com');
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-background">
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Team Management</h1>
            <p className="text-sm font-medium text-muted-foreground mt-1">Manage your team members and approve join requests.</p>
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
                  <span className="font-display font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500">Pending Requests ({requests.length})</span>
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
                        <Button
                          variant="outline"
                          size="sm"
                          id={`btn-reject-${req.id}`}
                          onClick={() => handleReject(req.id)}
                          disabled={actionPending === req.id}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                        >
                          <XCircle size={16} className="mr-1.5" />
                          Reject
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          id={`btn-approve-${req.id}`}
                          onClick={() => handleApprove(req.id)}
                          disabled={actionPending === req.id}
                          className="bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm border-transparent"
                        >
                          {actionPending === req.id ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <UserCheck size={16} className="mr-1.5" />}
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
              <span className="font-display font-bold uppercase tracking-wider text-foreground">Active Members ({members.length})</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              id="btn-open-drive-root"
              onClick={() => openDrive()}
              className="bg-background shadow-sm hover:shadow"
            >
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
              {members.map((member) => (
                <div key={member.id} className="group flex items-center justify-between px-7 py-5 bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20 flex items-center justify-center text-lg font-bold text-primary shadow-sm">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">{member.name}</p>
                      <p className="text-sm font-medium text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="success" className="font-display text-[10px] uppercase tracking-wider py-1 px-3">
                      <CheckCircle2 size={12} className="mr-1.5" />
                      Active
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      id={`btn-open-drive-${member.id}`}
                      onClick={() => openDrive(member.driveFolderUrl)}
                      className="text-muted-foreground hover:text-foreground hover:bg-background border border-transparent hover:border-border hover:shadow-sm transition-all"
                    >
                      <ExternalLink size={14} className="mr-1.5" />
                      Drive
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>

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
