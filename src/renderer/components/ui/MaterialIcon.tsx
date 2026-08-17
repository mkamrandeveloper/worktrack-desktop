import React from 'react';
import * as LucideIcons from 'lucide-react';
import { clsx } from 'clsx';

interface MaterialIconProps {
  name: string;
  size?: number;
  className?: string;
  fill?: boolean | number;
}

// A temporary mapping from old Material names to Lucide icons
const iconMap: Record<string, keyof typeof LucideIcons> = {
  search: 'Search',
  notifications: 'Bell',
  schedule: 'Clock',
  trending_up: 'TrendingUp',
  task_alt: 'CheckCircle2',
  bolt: 'Zap',
  pause_circle: 'PauseCircle',
  error: 'AlertCircle',
  timer: 'Timer',
  play_arrow: 'Play',
  pause: 'Pause',
  play_circle: 'PlayCircle',
  coffee: 'Coffee',
  stop_circle: 'StopCircle',
  more_horiz: 'MoreHorizontal',
  insights: 'LineChart',
  calendar_today: 'Calendar',
  add: 'Plus',
  web: 'Globe',
  broken_image: 'ImageOff',
  image: 'Image',
  person: 'User',
  work_outline: 'Briefcase',
  chevron_left: 'ChevronLeft',
  domain: 'Building',
  edit: 'Edit',
  add_task: 'PlusCircle',
  radio_button_unchecked: 'Circle',
  check_circle: 'CheckCircle2',
  groups: 'Users',
  settings: 'Settings',
  logout: 'LogOut',
  dashboard: 'LayoutDashboard',
  inventory: 'Box',
  people: 'Users',
  receipt_long: 'FileText',
  bar_chart: 'BarChart',
  photo_camera: 'Camera',
  delete: 'Trash2',
  close: 'X',
  check: 'Check',
  warning: 'AlertTriangle',
  info: 'Info',
  arrow_forward: 'ArrowRight',
  arrow_back: 'ArrowLeft',
  download: 'Download',
  upload: 'Upload',
  more_vert: 'MoreVertical',
  menu: 'Menu',
};

export function MaterialIcon({ name, size = 20, className, fill }: MaterialIconProps) {
  const IconName = iconMap[name] || 'HelpCircle';
  const IconComponent = LucideIcons[IconName] as React.FC<any>;

  if (!IconComponent) {
    return <LucideIcons.HelpCircle size={size} className={className} />;
  }

  return (
    <IconComponent
      size={size}
      className={clsx(className, fill ? 'fill-current' : '')}
      strokeWidth={fill ? 0 : 2}
    />
  );
}
