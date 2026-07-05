import { clsx } from 'clsx';

interface MaterialIconProps {
  name: string;
  className?: string;
  size?: number;
  fill?: boolean;
}

/** Google Material Symbols Outlined icon, used by the Stitch-designed screens. */
export function MaterialIcon({ name, className, size = 20, fill = false }: MaterialIconProps) {
  return (
    <span
      className={clsx('material-symbols-outlined', fill && 'icon-fill', className)}
      style={{ fontSize: size, width: size, height: size }}
    >
      {name}
    </span>
  );
}
