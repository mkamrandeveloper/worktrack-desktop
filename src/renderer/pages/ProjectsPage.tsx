import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project } from '@shared/types';
import { useAuthStore } from '../store/authStore';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { StatusBadge } from '../components/ui/StatusBadge';
import { CreateProjectWizard } from '../components/CreateProjectWizard';

export function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [search, setSearch] = useState('');
  const { isManagerOrAbove } = useAuthStore();

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const res = await window.worktrack.projects.list();
      if (res.success && res.data) {
        setProjects(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full mesh-bg">
      <header className="flex-none px-8 py-6 border-b border-border bg-card/70 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage client projects, internal initiatives, and track overall progress.
            </p>
          </div>
          {isManagerOrAbove() && (
            <button onClick={() => setShowWizard(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-colors shadow-sm">
              <MaterialIcon name="add" size={18} />
              New Project
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Controls */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <MaterialIcon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-10 pr-4 py-2 bg-card/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-shadow shadow-sm"
              />
            </div>
            <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl text-sm font-medium hover:bg-card/50 transition-colors text-muted-foreground">
              <MaterialIcon name="filter_list" size={18} /> Filter
            </button>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 rounded-xl glass-panel animate-pulse" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-xl glass-panel">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <MaterialIcon name="work_outline" size={32} className="text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No projects found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Get started by creating a new project to organize your team's work.
              </p>
              {isManagerOrAbove() && (
                <button onClick={() => setShowWizard(true)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-colors shadow-sm">
                  Create Project
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {projects
                .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
                .map(project => (
                  <ProjectCard key={project.id} project={project} onOpen={() => navigate(`/projects/${project.id}`)} />
                ))}
            </div>
          )}
        </div>
      </div>

      {showWizard && (
        <CreateProjectWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => { setShowWizard(false); loadProjects(); }}
        />
      )}
    </div>
  );
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const progressPercent = project.taskCount! > 0 ? Math.round((project.actualHours / (project.estimatedHours || 1)) * 100) : 0;

  return (
    <div onClick={onOpen} className="group glass-panel rounded-xl p-5 hover:shadow-md hover:border-secondary/30 transition-all duration-200 flex flex-col cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <StatusBadge
          variant={
            project.status === 'ACTIVE' ? 'active' :
            project.status === 'COMPLETED' ? 'success' :
            project.status === 'ON_HOLD' ? 'warning' : 'default'
          }
          label={project.status.replace('_', ' ')}
          dot
          size="sm"
        />
      </div>

      <h3 className="font-semibold text-lg line-clamp-1 mb-1" title={project.name}>{project.name}</h3>
      <p className="text-sm text-muted-foreground line-clamp-2 mb-6 flex-1">
        {project.description || 'No description provided.'}
      </p>

      <div className="space-y-4">
        {/* Progress */}
        <div>
          <div className="flex justify-between text-xs font-medium mb-1.5">
            <span className="text-muted-foreground">Progress</span>
            <span className={progressPercent > 100 ? 'text-destructive' : 'text-secondary'}>
              {progressPercent}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressPercent > 100 ? 'bg-destructive' : 'bg-secondary'}`}
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Footer Stats */}
        <div className="flex items-center justify-between pt-4 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5" title="Tasks">
              <MaterialIcon name="check_circle" size={16} />
              <span>{project.taskCount || 0}</span>
            </div>
            <div className="flex items-center gap-1.5" title="Team Members">
              <MaterialIcon name="groups" size={16} />
              <span>{project.memberCount || 0}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5" title="Deadline">
            <MaterialIcon name="schedule" size={16} />
            <span>{project.deadline ? new Date(project.deadline).toLocaleDateString() : 'No deadline'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
