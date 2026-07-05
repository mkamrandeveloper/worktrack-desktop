import { getApiService } from './ApiService';
import { Task } from '../../shared/types';
import { API_ENDPOINTS } from '../../shared/constants/events';
import { createLogger } from '../logger/Logger';
import Store from 'electron-store';

const log = createLogger('TaskService');

interface TaskStore {
  tasks: Task[];
  lastFetched: number | null;
}

/**
 * Fetches, caches, and manages the employee's assigned tasks.
 * Falls back to cached tasks when offline.
 */
export class TaskService {
  private store: Store<TaskStore>;

  constructor(encryptionKey: string) {
    this.store = new Store<TaskStore>({
      name: 'task-cache',
      encryptionKey,
      clearInvalidConfig: true,
      defaults: { tasks: [], lastFetched: null },
    });
  }

  async fetchTasks(): Promise<Task[]> {
    try {
      const api = getApiService();
      const tasks = await api.get<Task[]>(API_ENDPOINTS.TASKS.LIST);
      this.store.set('tasks', tasks);
      this.store.set('lastFetched', Date.now());
      log.info(`Fetched ${tasks.length} tasks from backend`);
      return tasks;
    } catch (err) {
      log.warn('Task fetch failed — returning cached tasks', {
        error: (err as Error).message,
      });
      return this.getCachedTasks();
    }
  }

  getCachedTasks(): Task[] {
    return this.store.get('tasks');
  }

  upsertTask(task: Task): void {
    const tasks = this.store.get('tasks');
    const index = tasks.findIndex((t) => t.id === task.id);
    if (index >= 0) {
      tasks[index] = task;
    } else {
      tasks.push(task);
    }
    this.store.set('tasks', tasks);
    log.debug(`Task upserted: ${task.id}`);
  }

  async startSession(taskId: string): Promise<{ sessionId: string }> {
    const api = getApiService();
    const result = await api.post<{ sessionId: string }>(
      API_ENDPOINTS.TASKS.START_SESSION(taskId)
    );
    log.info(`Session started for task ${taskId}: ${result.sessionId}`);
    return result;
  }

  async stopSession(sessionId: string): Promise<void> {
    const api = getApiService();
    await api.post(API_ENDPOINTS.TASKS.STOP_SESSION(sessionId));
    log.info(`Session stopped: ${sessionId}`);
  }

  async pauseSession(sessionId: string): Promise<void> {
    const api = getApiService();
    await api.post(API_ENDPOINTS.TASKS.PAUSE_SESSION(sessionId));
  }

  async resumeSession(sessionId: string): Promise<void> {
    const api = getApiService();
    await api.post(API_ENDPOINTS.TASKS.RESUME_SESSION(sessionId));
  }

  async startBreak(sessionId: string): Promise<void> {
    const api = getApiService();
    await api.post(API_ENDPOINTS.TASKS.BREAK_START(sessionId));
    log.info(`Break started for session: ${sessionId}`);
  }

  async endBreak(sessionId: string): Promise<void> {
    const api = getApiService();
    await api.post(API_ENDPOINTS.TASKS.BREAK_END(sessionId));
    log.info(`Break ended for session: ${sessionId}`);
  }

  clear(): void {
    this.store.set('tasks', []);
    this.store.set('lastFetched', null);
  }
}
