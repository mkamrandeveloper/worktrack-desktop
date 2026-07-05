import { Play, Pause, Square, Coffee, RotateCcw } from 'lucide-react';
import { useTimer } from '../hooks/useTimer';
import { formatDuration } from '../utils/formatTime';
import { Button, Card } from './ui/primitives';
import { clsx } from 'clsx';

interface TimerDisplayProps {
  className?: string;
}

export function TimerDisplay({ className }: TimerDisplayProps) {
  const timerStore = useTimer();
  const { status, elapsedSeconds, breakSeconds, taskId, isLoading } = timerStore;

  const isIdle = status === 'idle' || status === 'stopped';
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isOnBreak = status === 'on_break';

  const handleStartPause = () => {
    if (isIdle && taskId) {
      timerStore.startTimer(taskId);
    } else if (isRunning) {
      timerStore.pauseTimer();
    } else if (isPaused) {
      timerStore.resumeTimer();
    }
  };

  const handleStop = () => {
    if (!isIdle) {
      timerStore.stopTimer();
    }
  };

  const handleBreak = () => {
    if (isRunning) {
      timerStore.startBreak();
    } else if (isOnBreak) {
      timerStore.endBreak();
    }
  };

  // Pulse animation when running
  const timeClass = clsx(
    'text-5xl font-mono font-bold tracking-tight transition-colors duration-300',
    {
      'text-primary': isRunning,
      'text-muted-foreground': isIdle || isPaused,
      'text-orange-400': isOnBreak,
    }
  );

  return (
    <Card className={clsx('p-8 flex flex-col items-center justify-center gap-6 relative overflow-hidden', className, isRunning && 'glowing')}>
      {/* Background animated gradient when running */}
      {isRunning && (
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-accent/5 animate-pulse-ring pointer-events-none" />
      )}

      <div className="text-center z-10">
        <h2 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-widest">
          {isOnBreak ? 'On Break' : isRunning ? 'Working' : isPaused ? 'Paused' : 'Ready'}
        </h2>
        <div className={timeClass}>
          {formatDuration(isOnBreak ? breakSeconds : elapsedSeconds)}
        </div>
      </div>

      <div className="flex items-center gap-4 z-10">
        <Button
          variant={isRunning ? 'secondary' : 'primary'}
          size="lg"
          className={clsx('w-16 h-16 rounded-full p-0', isRunning && 'animate-pulse')}
          onClick={handleStartPause}
          disabled={!taskId || isLoading || isOnBreak}
          title={isRunning ? 'Pause Timer' : 'Start Timer'}
        >
          {isRunning ? (
            <Pause className="w-6 h-6" fill="currentColor" />
          ) : (
            <Play className="w-6 h-6 ml-1" fill="currentColor" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="lg"
          className={clsx('w-14 h-14 rounded-full p-0', isOnBreak && 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 hover:text-orange-300')}
          onClick={handleBreak}
          disabled={!isRunning && !isOnBreak}
          title={isOnBreak ? 'End Break' : 'Take a Break'}
        >
          {isOnBreak ? (
            <RotateCcw className="w-5 h-5" />
          ) : (
            <Coffee className="w-5 h-5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="lg"
          className="w-14 h-14 rounded-full p-0 hover:bg-destructive/20 hover:text-destructive"
          onClick={handleStop}
          disabled={isIdle}
          title="Stop Timer"
        >
          <Square className="w-5 h-5" fill="currentColor" />
        </Button>
      </div>
    </Card>
  );
}
