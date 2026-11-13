import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { waitForPromise } from '@ember/test-waiters';

/**
 * @module SecretTree::Children
 * Lists the folders inside one folder of a KV engine. It loads the listing one time, when the
 * parent node opens.
 *
 * @param {string} backend - mount path of the secrets engine
 * @param {string} modelType - 'secret-v2' or 'secret', selects the adapter that lists the folder
 * @param {string} path - folder path to list, with a trailing slash; '' for the engine root
 * @param {string} currentPath - folder path the list page shows now
 * @param {boolean} [isRoot] - true for the engine root
 */
export default class SecretTreeChildrenComponent extends Component {
  @service store;

  @tracked folders = [];
  @tracked isLoading = true;

  constructor() {
    super(...arguments);
    this.load();
  }

  async load() {
    const { backend, modelType, path } = this.args;
    let keys = [];
    try {
      const adapter = this.store.adapterFor(modelType);
      // waitForPromise makes tests wait for the listing before they continue or tear down
      const response = await waitForPromise(adapter.query(this.store, null, { backend, id: path }));
      keys = response?.data?.keys || [];
    } catch {
      // 404 is an empty folder and 403 is a folder the token cannot list: both show no folders
      keys = [];
    }
    if (this.isDestroying || this.isDestroyed) return;
    this.folders = keys
      .filter((key) => key.endsWith('/'))
      .map((key) => ({ name: key, path: `${path}${key}` }));
    this.isLoading = false;
  }
}
