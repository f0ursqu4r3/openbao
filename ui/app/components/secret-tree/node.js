import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

/**
 * @module SecretTree::Node
 * One folder in the secret folder tree. A folder is open when it is the current folder or an
 * ancestor of the current folder, until the user opens or closes it with the toggle button.
 *
 * @param {string} backend - mount path of the secrets engine
 * @param {string} modelType - 'secret-v2' or 'secret', selects the adapter that lists the folder
 * @param {string} path - folder path inside the engine, with a trailing slash; '' for the engine root
 * @param {string} name - text shown for the folder
 * @param {string} currentPath - folder path the list page shows now
 * @param {boolean} [isRoot] - true for the engine root
 */
export default class SecretTreeNodeComponent extends Component {
  // null until the user uses the toggle button
  @tracked userOpen = null;

  get isCurrent() {
    return this.args.currentPath === this.args.path;
  }

  get containsCurrent() {
    return this.args.currentPath.startsWith(this.args.path);
  }

  get isOpen() {
    return this.userOpen === null ? this.containsCurrent : this.userOpen;
  }

  @action
  toggle() {
    this.userOpen = !this.isOpen;
  }
}
