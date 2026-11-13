/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { click, currentURL } from '@ember/test-helpers';
import { setupMirage } from 'ember-cli-mirage/test-support';
import authPage from 'vault/tests/pages/auth';
import modifyPassthroughResponse from 'vault/mirage/helpers/modify-passthrough-response';

const link = (label) => `[data-test-sidebar-nav-link="${label}"]`;
const panel = (label) => `[data-test-sidebar-nav-panel="${label}"]`;

module('Acceptance | sidebar navigation', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(function () {
    // set storage_type to raft to test link
    this.server.get('/sys/seal-status', (schema, req) => {
      return modifyPassthroughResponse(req, { storage_type: 'raft' });
    });
    this.server.get('/sys/storage/raft/configuration', () => this.server.create('configuration', 'withRaft'));

    return authPage.login();
  });

  test('it should show all links in one panel', async function (assert) {
    assert.dom(panel('Cluster')).exists('Cluster nav panel renders');
    assert.dom(link('Back to main navigation')).doesNotExist('There is no sub-panel back link');
    assert.dom('[data-test-sidebar-nav-panel]').exists({ count: 1 }, 'Only one nav panel renders');
  });

  test('it should link to correct routes', async function (assert) {
    const links = [
      { label: 'Multi-factor authentication', route: '/vault/access/mfa' },
      { label: 'OIDC provider', route: '/vault/access/oidc' },
      { label: 'Groups', route: '/vault/access/identity/groups' },
      { label: 'Entities', route: '/vault/access/identity/entities' },
      { label: 'Leases', route: '/vault/access/leases/list' },
      { label: 'Authentication methods', route: '/vault/access' },
      { label: 'ACL Policies', route: '/vault/policies/acl' },
      { label: 'Tools', route: '/vault/tools/wrap' },
      { label: 'Raft Storage', route: '/vault/storage/raft' },
      { label: 'Seal OpenBao', route: '/vault/settings/seal' },
      { label: 'Secrets engines', route: '/vault/secrets' },
    ];
    assert.expect(links.length);

    for (const l of links) {
      await click(link(l.label));
      assert.ok(currentURL().includes(l.route), `${l.label} route renders`);
    }
  });

  test('it should keep the full nav when mounting and configuring auth methods', async function (assert) {
    await click(link('Authentication methods'));
    await click('[data-test-auth-enable]');
    assert.dom(link('Secrets engines')).exists('Full nav renders on the enable auth method page');
    await click(link('Authentication methods'));
    await click('[data-test-auth-backend-link="token"]');
    await click('[data-test-configure-link]');
    assert.dom(link('Secrets engines')).exists('Full nav renders on the configure auth method page');
  });
});
