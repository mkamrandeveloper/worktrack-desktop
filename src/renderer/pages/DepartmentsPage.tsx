import { useState, useEffect } from 'react';
import { Department } from '@shared/types';
import { useAuthStore } from '../store/authStore';
import { Plus, Building2, Search, MoreVertical, Users, Trash2 } from 'lucide-react';
import { CreateDepartmentModal } from '../components/CreateDepartmentModal';

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

  return (
    <div className="flex flex-col h-full bg-background/50">
      <header className="flex-none px-8 py-6 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Organize your organization into logical groups.
            </p>
          </div>
          {isManagerOrAbove() && (
            <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm">
              <Plus className="w-4 h-4" />
              New Department
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">

          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search departments..."
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 rounded-xl border border-border bg-card animate-pulse" />
              ))}
            </div>
          ) : departments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-xl bg-card/50">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No departments</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Group your employees by creating departments.
              </p>
              {isManagerOrAbove() && (
                <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm">
                  Create Department
                </button>
              )}
            </div>
          ) : (
            <>
              {filteredDepartments.length === 0 ? (
                <div className="text-center py-16 text-sm text-muted-foreground">
                  No departments match "{search}".
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredDepartments.map(dept => (
                    <DepartmentCard key={dept.id} department={dept} canManage={isManagerOrAbove()} onDeleted={handleDeleted} />
                  ))}
                </div>
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

  function handleDeleted(id: string) {
    setDepartments(prev => prev.filter(d => d.id !== id));
  }
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
    <div className="group relative bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/30 transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Building2 className="w-5 h-5" />
        </div>
        {canManage && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-6 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <h3 className="font-semibold text-lg mb-1">{department.name}</h3>
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[40px]">
        {department.description || 'No description provided.'}
      </p>

      <div className="pt-4 border-t border-border/50 flex items-center gap-2 text-sm text-muted-foreground font-medium">
        <Users className="w-4 h-4" />
        <span>{department.memberCount || 0} Members</span>
      </div>
    </div>
  );
}
