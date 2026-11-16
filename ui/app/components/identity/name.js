/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { waitForPromise } from '@ember/test-waiters';
import { fetchIdentityRecord } from 'vault/utils/identity-access';

/**
 * @module Identity::Name
 * Shows the name of an entity or group for an ID. It shows the ID until the name loads, and
 * keeps the ID when the token cannot read the record.
 *
 * @param {string} type - 'entity' or 'group'
 * @param {string} id - ID of the entity or group
 */
export default class IdentityNameComponent extends Component {
  @service store;

  @tracked name = null;

  constructor() {
    super(...arguments);
    this.load();
  }

  async load() {
    const record = await waitForPromise(fetchIdentityRecord(this.store, this.args.type, this.args.id));
    if (this.isDestroying || this.isDestroyed) return;
    this.name = record?.name || null;
  }
}
