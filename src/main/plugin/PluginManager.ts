import { Plugin, PluginManifest, PluginCapability } from '../../shared/types';
import { createLogger } from '../logger/Logger';

const log = createLogger('PluginManager');

/**
 * Future-proof plugin registry.
 * Plugins register themselves via the PluginManager.
 * The core app queries capabilities instead of hardcoding service implementations.
 *
 * Example future plugins:
 *   - WebcamSnapshotPlugin (capability: 'webcam_snapshot')
 *   - AppTrackerPlugin    (capability: 'app_tracker')
 *   - WebsiteTrackerPlugin (capability: 'website_tracker')
 *   - AiAnalysisPlugin   (capability: 'ai_analysis')
 */
export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();

  async register(plugin: Plugin): Promise<void> {
    const { id } = plugin.manifest;
    if (this.plugins.has(id)) {
      log.warn(`Plugin already registered: ${id}`);
      return;
    }

    try {
      await plugin.initialize();
      this.plugins.set(id, plugin);
      log.info(`Plugin registered: ${plugin.manifest.name} v${plugin.manifest.version}`);
    } catch (err) {
      log.error(`Failed to initialize plugin: ${id}`, { error: (err as Error).message });
      throw err;
    }
  }

  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    try {
      await plugin.dispose();
      this.plugins.delete(pluginId);
      log.info(`Plugin unregistered: ${pluginId}`);
    } catch (err) {
      log.error(`Failed to dispose plugin: ${pluginId}`, { error: (err as Error).message });
    }
  }

  /** Returns all plugins that expose a given capability */
  getByCapability(capability: PluginCapability): Plugin[] {
    return Array.from(this.plugins.values()).filter((p) =>
      p.manifest.capabilities.includes(capability)
    );
  }

  getPlugin(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }

  getAllManifests(): PluginManifest[] {
    return Array.from(this.plugins.values()).map((p) => p.manifest);
  }

  async disposeAll(): Promise<void> {
    for (const [id] of this.plugins) {
      await this.unregister(id);
    }
    log.info('All plugins disposed');
  }
}
