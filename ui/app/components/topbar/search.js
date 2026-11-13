import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

const INPUT_ID = 'topbar-search-input';
const MAX_RESULTS = 8;

// Pages the search can jump to. `nav` and `param` are the arguments for
// permissions.hasNavPermission, the same check the sidebar links use.
const PAGES = [
  { label: 'Secrets engines', icon: 'key-values', route: 'vault.cluster.secrets' },
  { label: 'Enable new secrets engine', icon: 'plus', route: 'vault.cluster.settings.mount-secret-backend' },
  {
    label: 'Authentication methods',
    icon: 'user-check',
    route: 'vault.cluster.access.methods',
    nav: 'access',
    param: 'methods',
  },
  {
    label: 'Multi-factor authentication',
    icon: 'shield-check',
    route: 'vault.cluster.access.mfa.methods',
    nav: 'access',
    param: 'mfa',
  },
  { label: 'OIDC provider', icon: 'token', route: 'vault.cluster.access.oidc', nav: 'access', param: 'oidc' },
  {
    label: 'Namespaces',
    icon: 'org',
    route: 'vault.cluster.access.namespaces',
    nav: 'access',
    param: 'namespaces',
  },
  {
    label: 'Groups',
    icon: 'users',
    route: 'vault.cluster.access.identity',
    model: 'groups',
    nav: 'access',
    param: 'groups',
  },
  {
    label: 'Entities',
    icon: 'identity-user',
    route: 'vault.cluster.access.identity',
    model: 'entities',
    nav: 'access',
    param: 'entities',
  },
  {
    label: 'ACL policies',
    icon: 'file-text',
    route: 'vault.cluster.policies',
    model: 'acl',
    nav: 'policies',
    param: 'acl',
  },
  { label: 'Leases', icon: 'clock', route: 'vault.cluster.access.leases', nav: 'access', param: 'leases' },
  {
    label: 'Wrap data',
    icon: 'tools',
    route: 'vault.cluster.tools.tool',
    model: 'wrap',
    nav: 'tools',
    param: 'wrap',
  },
  {
    label: 'Lookup token',
    icon: 'tools',
    route: 'vault.cluster.tools.tool',
    model: 'lookup',
    nav: 'tools',
    param: 'lookup',
  },
  {
    label: 'Unwrap data',
    icon: 'tools',
    route: 'vault.cluster.tools.tool',
    model: 'unwrap',
    nav: 'tools',
    param: 'unwrap',
  },
  {
    label: 'Rewrap token',
    icon: 'tools',
    route: 'vault.cluster.tools.tool',
    model: 'rewrap',
    nav: 'tools',
    param: 'rewrap',
  },
  {
    label: 'Random bytes',
    icon: 'tools',
    route: 'vault.cluster.tools.tool',
    model: 'random',
    nav: 'tools',
    param: 'random',
  },
  {
    label: 'Hash data',
    icon: 'tools',
    route: 'vault.cluster.tools.tool',
    model: 'hash',
    nav: 'tools',
    param: 'hash',
  },
];

/**
 * @module Topbar::Search
 * A "jump to" search in the top bar. It matches the typed text against the main pages
 * and the mounted secrets engines, and goes to the selected result.
 *
 * @example
 * <Topbar::Search />
 */
export default class TopbarSearchComponent extends Component {
  @service router;
  @service store;
  @service permissions;

  @tracked query = '';
  @tracked isOpen = false;
  @tracked activeIndex = 0;
  @tracked engines = [];

  inputId = INPUT_ID;

  constructor() {
    super(...arguments);
    window.addEventListener('keydown', this.onGlobalKeydown);
  }

  willDestroy() {
    super.willDestroy(...arguments);
    window.removeEventListener('keydown', this.onGlobalKeydown);
  }

  get shortcutLabel() {
    return /mac/i.test(window.navigator.platform) ? '⌘K' : 'Ctrl K';
  }

  get pages() {
    return PAGES.filter((page) => !page.nav || this.permissions.hasNavPermission(page.nav, page.param));
  }

  get engineResults() {
    return this.engines
      .filter((engine) => engine.shouldIncludeInList && engine.isSupportedBackend)
      .map((engine) => ({
        label: engine.path,
        detail: engine.engineType,
        icon: engine.icon || 'key-values',
        route: engine.backendLink,
        model: engine.id,
      }));
  }

  get results() {
    const text = this.query.trim().toLowerCase();
    const all = [...this.engineResults, ...this.pages];
    const matches = text ? all.filter((result) => result.label.toLowerCase().includes(text)) : this.pages;
    return matches.slice(0, MAX_RESULTS);
  }

  async loadEngines() {
    try {
      this.engines = (await this.store.query('secret-engine', {})).slice();
    } catch {
      // the token cannot list mounts: the search still offers the pages
      this.engines = [];
    }
  }

  @action
  onGlobalKeydown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      document.getElementById(INPUT_ID)?.focus();
    }
  }

  @action
  open() {
    if (!this.isOpen) {
      this.isOpen = true;
      this.activeIndex = 0;
      this.loadEngines();
    }
  }

  @action
  close() {
    this.isOpen = false;
    this.query = '';
    this.activeIndex = 0;
  }

  @action
  onInput(event) {
    this.query = event.target.value;
    this.activeIndex = 0;
    this.isOpen = true;
  }

  // a click on a result moves focus to that result (tabindex="-1"), which is inside this element
  @action
  onFocusOut(event) {
    // When the results close, the browser removes the focused result and fires focusout
    // during render. The search is already closed then, so there is nothing to do.
    if (this.isOpen && !event.currentTarget.contains(event.relatedTarget)) {
      this.close();
    }
  }

  @action
  onKeydown(event) {
    const count = this.results.length;
    if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      this.activeIndex = (this.activeIndex + 1) % count;
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      this.activeIndex = (this.activeIndex - 1 + count) % count;
    } else if (event.key === 'Enter' && count) {
      event.preventDefault();
      this.go(this.results[this.activeIndex]);
    } else if (event.key === 'Escape') {
      this.close();
      event.target.blur();
    }
  }

  @action
  go(result) {
    // take focus off the clicked result before the results are removed
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.close();
    if (result.model) {
      this.router.transitionTo(result.route, result.model);
    } else {
      this.router.transitionTo(result.route);
    }
  }
}
