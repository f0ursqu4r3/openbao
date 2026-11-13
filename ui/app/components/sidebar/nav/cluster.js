import Component from '@glimmer/component';
import { inject as service } from '@ember/service';

export default class SidebarNavClusterComponent extends Component {
  @service currentCluster;
  @service version;
  @service auth;
  @service namespace;
  @service router;

  get cluster() {
    return this.currentCluster.cluster;
  }

  // The Tools link carries a model (the first permitted tool), so a route-name match
  // in @current-when does not mark it active on the other tool pages.
  get isToolsRoute() {
    return (this.router.currentRouteName || '').startsWith('vault.cluster.tools');
  }
}
