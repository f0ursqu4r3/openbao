/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { waitForPromise } from '@ember/test-waiters';
import { effectivePolicies, fetchIdentityRecords } from 'vault/utils/identity-access';

/**
 * @module Identity::ItemAccess
 * Shows all the access an entity has through the identity system on one page: the policies that
 * apply and where each one comes from, the groups, and the logins (aliases).
 *
 * @param {object} model - identity/entity model
 */
export default class IdentityItemAccessComponent extends Component {
  @service store;

  @tracked groups = [];
  @tracked isLoading = true;

  constructor() {
    super(...arguments);
    this.load();
  }

  get model() {
    return this.args.model;
  }

  get policies() {
    return effectivePolicies(this.model.policies, this.groups);
  }

  // groups in the entity that the token cannot read
  get unreadableGroupCount() {
    const total = (this.model.directGroupIds || []).length + (this.model.inheritedGroupIds || []).length;
    return this.isLoading ? 0 : total - this.groups.length;
  }

  async load() {
    const direct = this.model.directGroupIds || [];
    const inherited = this.model.inheritedGroupIds || [];
    const [directGroups, inheritedGroups] = await waitForPromise(
      Promise.all([
        fetchIdentityRecords(this.store, 'group', direct),
        fetchIdentityRecords(this.store, 'group', inherited),
      ])
    );
    if (this.isDestroying || this.isDestroyed) return;
    this.groups = [
      ...directGroups.map((group) => ({ ...group, inherited: false })),
      ...inheritedGroups.map((group) => ({ ...group, inherited: true })),
    ];
    this.isLoading = false;
  }
}
