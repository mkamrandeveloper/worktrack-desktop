import { getApiService } from '../services/ApiService';
import { API_ENDPOINTS } from '../../shared/constants/events';
import { TeamMember, Task } from '../../shared/types';
import { createLogger } from '../logger/Logger';

const log = createLogger('ManagerService');

export class ManagerService {
  async getTeam(): Promise<{ members: TeamMember[]; requests: TeamMember[] }> {
    const api = getApiService();
    return api.get<{ members: TeamMember[]; requests: TeamMember[] }>(API_ENDPOINTS.MANAGER.GET_TEAM);
  }

  async approveRequest(userId: string): Promise<void> {
    const api = getApiService();
    await api.post(API_ENDPOINTS.MANAGER.APPROVE_REQUEST(userId));
    log.info(`Approved request for user ${userId}`);
  }

  async rejectRequest(userId: string): Promise<void> {
    const api = getApiService();
    await api.post(API_ENDPOINTS.MANAGER.REJECT_REQUEST(userId));
    log.info(`Rejected request for user ${userId}`);
  }

  async getTasks(): Promise<Task[]> {
    const api = getApiService();
    return api.get<Task[]>(API_ENDPOINTS.MANAGER.GET_TASKS);
  }

  async getEmployeeTasks(userId: string): Promise<Task[]> {
    const api = getApiService();
    return api.get<Task[]>(API_ENDPOINTS.MANAGER.GET_EMPLOYEE_TASKS(userId));
  }

  async addEmployee(payload: { name: string; email: string; password: string }): Promise<{
    employee: { id: string; name: string; email: string };
    credentials: { email: string; password: string };
  }> {
    const api = getApiService();
    return api.post(API_ENDPOINTS.MANAGER.ADD_EMPLOYEE, payload);
  }

  async updateOrgSettings(settings: Record<string, unknown>): Promise<void> {
    const api = getApiService();
    await api.post(API_ENDPOINTS.MANAGER.UPDATE_ORG_SETTINGS, settings);
    log.info('Updated org settings');
  }
}
