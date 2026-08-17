import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project } from '@shared/types';
import { useAuthStore } from '../store/authStore';
import { Badge, Button } from '../components/ui/primitives';
import { CreateProjectWizard } from '../components/CreateProjectWizard';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Plus, Search, ListFilter, Briefcase, Calendar, CheckCircle2, Users, LayoutDashboard, Clock } from 'lucide-react';

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

  const filteredProjects = projects.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-background animate-fade-in relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      
      <header className="flex-none px-8 py-8 relative z-10 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between max-w-7xl mx-auto gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
              <LayoutDashboard size={24} className="text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Projects</h1>
              <p className="text-sm font-medium text-muted-foreground mt-1">
                Manage client projects, internal initiatives, and track overall progress.
              </p>
            </div>
          </div>
          {isManagerOrAbove() && (
            <Button onClick={() => setShowWizard(true)} className="h-12 px-6 rounded-xl shadow-[0_4px_14px_0_rgba(var(--primary),0.39)] hover:shadow-[0_6px_20px_rgba(var(--primary),0.23)] text-base">
              <Plus size={20} className="mr-2" />
              New Project
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 relative z-10 custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Controls */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md group">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-11 pr-4 h-12 bg-card border border-border/80 rounded-xl text-base font-medium text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm hover:border-border"
              />
            </div>
            <Button variant="outline" className="h-12 px-5 rounded-xl border-border/80 shadow-sm text-foreground hover:bg-muted/50 font-semibold text-sm">
              <ListFilter size={18} className="mr-2 text-muted-foreground" /> Filter
            </Button>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-64 rounded-2xl bg-card border border-border/50 animate-pulse shadow-sm" />
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border/60 rounded-3xl bg-muted/10">
              <div className="w-20 h-20 rounded-full bg-card flex items-center justify-center mb-6 shadow-sm border border-border/50">
                <Briefcase size={32} className="text-muted-foreground/60" />
              </div>
              <h3 className="text-2xl font-display font-bold text-foreground mb-2">No projects found</h3>
              <p className="text-base font-medium text-muted-foreground max-w-md mb-8">
                {search ? "We couldn't find any projects matching your search." : "Get started by creating a new project to organize your team's work."}
              </p>
              {isManagerOrAbove() && !search && (
                <Button onClick={() => setShowWizard(true)} className="h-12 px-8 rounded-xl shadow-premium text-base">
                  <Plus size={20} className="mr-2" /> Create Project
                </Button>
              )}
            </motion.div>
          ) : (
            <motion.div 
              initial="hidden" 
              animate="show" 
              variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
            >
              <AnimatePresence>
                {filteredProjects.map(project => (
                  <ProjectCard key={project.id} project={project} onOpen={() => navigate(`/projects/${project.id}`)} />
                ))}
              </AnimatePresence>
            </motion.div>
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

const ProjectCard = ({ project, onOpen }: { project: Project; onOpen: () => void }) => {
  const progressPercent = project.taskCount! > 0 ? Math.round((project.actualHours / (project.estimatedHours || 1)) * 100) : 0;
  
  const statusColor = 
    project.status === 'ACTIVE' ? 'success' :
    project.status === 'COMPLETED' ? 'secondary' :
    project.status === 'ON_HOLD' ? 'warning' : 'default';

  return (
    <motion.div 
      variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      onClick={onOpen} 
      className="group bg-card rounded-2xl p-7 border border-border/60 hover:border-primary/40 hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="flex items-start justify-between mb-5">
        <Badge variant={statusColor} className="uppercase font-bold tracking-widest text-[10px] px-2.5 py-1">
          {project.status.replace('_', ' ')}
        </Badge>
        {project.priority && (
          <Badge variant="outline" className="uppercase font-bold tracking-widest text-[10px] px-2.5 py-1 text-muted-foreground border-border/50">
            {project.priority}
          </Badge>
        )}
      </div>

      <h3 className="font-display font-bold text-xl text-foreground line-clamp-1 mb-2 group-hover:text-primary transition-colors" title={project.name}>{project.name}</h3>
      <p className="text-sm font-medium text-muted-foreground line-clamp-2 mb-8 flex-1 leading-relaxed">
        {project.description || 'No description provided.'}
      </p>

      <div className="space-y-5">
        {/* Progress */}
        <div className="bg-muted/30 p-3.5 rounded-xl border border-border/50">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">Progress</span>
            <span className={clsx("text-sm font-bold font-mono", progressPercent > 100 ? 'text-destructive' : 'text-primary')}>
              {progressPercent}%
            </span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner border border-border/40">
            <div
              className={clsx('h-full rounded-full transition-all duration-1000 shadow-sm', progressPercent > 100 ? 'bg-destructive' : 'bg-primary')}
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs font-medium text-muted-foreground">{project.actualHours}h logged</span>
            <span className="text-xs font-medium text-muted-foreground">{project.estimatedHours || 0}h est.</span>
          </div>
        </div>

        {/* Footer Stats */}
        <div className="flex items-center justify-between pt-1 text-sm font-medium text-muted-foreground">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5" title="Tasks">
              <CheckCircle2 size={16} className="text-emerald-500/70" />
              <span className="font-semibold text-foreground">{project.taskCount || 0}</span>
            </div>
            <div className="flex items-center gap-1.5" title="Team Members">
              <Users size={16} className="text-blue-500/70" />
              <span className="font-semibold text-foreground">{project.memberCount || 0}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md" title="Deadline">
            <Calendar size={14} className="text-muted-foreground" />
            <span className="font-mono text-xs">{project.deadline ? new Date(project.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '--/--'}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
