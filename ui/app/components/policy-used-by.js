/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { waitForPromise } from '@ember/test-waiters';
import { USED_BY_LIMIT, fetchIdentityRecords, listIdentityIds } from 'vault/utils/identity-access';

/**
 * @module PolicyUsedBy
 * Lists the entities and groups that have a policy attached. It reads each entity and group,
 * because the list endpoints do not return policies. It reads at most USED_BY_LIMIT of each type.
 *
 * @param {string} policyName - name of the ACL policy
 */
export default class PolicyUsedByComponent extends Component {
  @service store;

  @tracked users = [];
  @tracked isLoading = true;
  @tracked isDenied = false;
  @tracked isTruncated = false;

  limit = USED_BY_LIMIT;

  constructor() {
    super(...arguments);
    this.load();
  }

  async load() {
    const [entities, groups] = await waitForPromise(
      Promise.all([this.loadType('entity'), this.loadType('group')])
    );
    if (this.isDestroying || this.isDestroyed) return;
    this.users = [...groups, ...entities];
    this.isLoading = false;
  }

  async loadType(type) {
    const { ids, denied } = await listIdentityIds(this.store, type);
    if (denied) this.isDenied = true;
    if (ids.length > USED_BY_LIMIT) this.isTruncated = true;
    const records = await fetchIdentityRecords(this.store, type, ids.slice(0, USED_BY_LIMIT));
    return records
      .filter((record) => (record.policies || []).includes(this.args.policyName))
      .map((record) => ({
        id: record.id,
        name: record.name,
        type,
        routeType: type === 'entity' ? 'entities' : 'groups',
        section: type === 'entity' ? 'access' : 'details',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
