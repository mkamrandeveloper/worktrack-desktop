import { useState, useEffect } from 'react';
import { Department } from '@shared/types';
import { useAuthStore } from '../store/authStore';
import { Plus, Building2, Search, MoreVertical, Users, Trash2 } from 'lucide-react';
import { CreateDepartmentModal } from '../components/CreateDepartmentModal';
import { Button } from '../components/ui/primitives';
import { motion, AnimatePresence } from 'framer-motion';

export function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState('');
  const { isManagerOrAbove } = useAuthStore();

  useEffect(() => {
    loadDepartments();
  }, []);

  const filteredDepartments = departments.filter(d =>
    d.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  async function loadDepartments() {
    setLoading(true);
    try {
      const res = await window.worktrack.departments.list();
      if (res.success && res.data) {
        setDepartments(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleDeleted(id: string) {
    setDepartments(prev => prev.filter(d => d.id !== id));
  }

  return (
    <div className="flex flex-col h-full bg-background animate-fade-in relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      
      <header className="flex-none px-8 py-8 relative z-10 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between max-w-7xl mx-auto gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
              <Building2 size={24} className="text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Departments</h1>
              <p className="text-sm font-medium text-muted-foreground mt-1">
                Organize your organization into logical groups.
              </p>
            </div>
          </div>
          {isManagerOrAbove() && (
            <Button onClick={() => setShowCreateModal(true)} className="h-12 px-6 rounded-xl shadow-[0_4px_14px_0_rgba(var(--primary),0.39)] hover:shadow-[0_6px_20px_rgba(var(--primary),0.23)] text-base">
              <Plus size={20} className="mr-2" />
              New Department
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 relative z-10 custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-8">

          <div className="flex items-center gap-4 py-2">
            <div className="relative flex-1 max-w-md group">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search departments..."
                className="w-full pl-11 pr-4 h-12 bg-card border border-border/80 rounded-xl text-base font-medium text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm hover:border-border"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 rounded-2xl border border-border/50 bg-card animate-pulse shadow-sm" />
              ))}
            </div>
          ) : departments.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border/60 rounded-3xl bg-muted/10">
              <div className="w-20 h-20 rounded-full bg-card flex items-center justify-center mb-6 shadow-sm border border-border/50">
                <Building2 size={32} className="text-muted-foreground/60" />
              </div>
              <h3 className="text-2xl font-display font-bold text-foreground mb-2">No departments</h3>
              <p className="text-base font-medium text-muted-foreground max-w-md mb-8">
                Group your employees by creating departments.
              </p>
              {isManagerOrAbove() && (
                <Button onClick={() => setShowCreateModal(true)} className="h-12 px-8 rounded-xl shadow-premium text-base">
                  <Plus size={20} className="mr-2" /> Create Department
                </Button>
              )}
            </motion.div>
          ) : (
            <>
              {filteredDepartments.length === 0 ? (
                <div className="text-center py-16 text-base font-medium text-muted-foreground">
                  No departments match "{search}".
                </div>
              ) : (
                <motion.div 
                  initial="hidden" 
                  animate="show" 
                  variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                >
                  <AnimatePresence>
                    {filteredDepartments.map(dept => (
                      <DepartmentCard key={dept.id} department={dept} canManage={isManagerOrAbove()} onDeleted={handleDeleted} />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </>
          )}

        </div>
      </div>

      {showCreateModal && (
        <CreateDepartmentModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(dept) => {
            setDepartments(prev => [...prev, dept]);
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

function DepartmentCard({ department, canManage, onDeleted }: { department: Department; canManage: boolean; onDeleted: (id: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete "${department.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    const res = await window.worktrack.departments.delete(department.id);
    setDeleting(false);
    if (res.success) {
      onDeleted(department.id);
    } else {
      window.alert(res.error ?? 'Failed to delete department.');
      setMenuOpen(false);
    }
  }

  return (
    <motion.div 
      layout
      variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="group relative bg-card border border-border/60 rounded-2xl p-7 hover:shadow-xl hover:border-primary/40 transition-all duration-300 flex flex-col overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="flex items-start justify-between mb-5">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/20 border border-primary/20 text-primary flex items-center justify-center shadow-sm">
          <Building2 size={22} />
        </div>
        {canManage && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
            >
              <MoreVertical size={20} />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }} className="absolute right-0 top-10 z-20 bg-card border border-border/80 rounded-xl shadow-lg p-1.5 min-w-[160px]">
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-60"
                    >
                      <Trash2 size={16} />
                      {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <h3 className="font-display font-bold text-xl mb-2 group-hover:text-primary transition-colors">{department.name}</h3>
      <p className="text-sm font-medium text-muted-foreground mb-6 line-clamp-2 min-h-[40px] leading-relaxed">
        {department.description || 'No description provided.'}
      </p>

      <div className="mt-auto bg-muted/30 px-4 py-3 rounded-xl border border-border/50 flex items-center gap-3 text-sm font-bold text-muted-foreground">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Users size={16} />
        </div>
        <span className="text-foreground">{department.memberCount || 0}</span> <span className="text-xs uppercase tracking-wider">Members</span>
      </div>
    </motion.div>
  );
}
