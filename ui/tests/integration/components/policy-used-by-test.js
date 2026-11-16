/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import sinon from 'sinon';

const RECORDS = {
  'identity/entity': {
    e1: { id: 'e1', name: 'alice', policies: ['app-read'] },
    e2: { id: 'e2', name: 'bob', policies: ['other'] },
  },
  'identity/group': {
    g1: { id: 'g1', name: 'team', policies: ['app-read', 'other'] },
  },
};

module('Integration | Component | policy-used-by', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    this.owner.setupRouter();
    this.listError = null;
    const ajax = sinon.stub().callsFake((url) => {
      const [, modelName, id] = url.match(/\/v1\/(identity\/\w+)\/id\/?([^?]*)/);
      if (url.endsWith('?list=true')) {
        return this.listError
          ? Promise.reject(this.listError)
          : Promise.resolve({ data: { keys: Object.keys(RECORDS[modelName]) } });
      }
      return Promise.resolve({ data: RECORDS[modelName][id] });
    });
    sinon.stub(this.owner.lookup('service:store'), 'adapterFor').returns({
      ajax,
      buildURL: (modelName, id) => `/v1/${modelName}/id${id ? `/${id}` : ''}`,
    });
  });

  test('it lists the groups and entities that have the policy', async function (assert) {
    await render(hbs`<PolicyUsedBy @policyName="app-read" />`);
    await waitFor('[data-test-used-by-row]');

    assert.dom('[data-test-used-by-row]').exists({ count: 2 });
    assert.dom('[data-test-used-by-row="team"]').includesText('Group');
    assert.dom('[data-test-used-by-row="alice"]').includesText('Entity');
    assert.dom('[data-test-used-by-row="bob"]').doesNotExist('an entity without the policy is not listed');
    assert.dom('[data-test-used-by-truncated]').doesNotExist();
  });

  test('it shows an empty state when nothing uses the policy', async function (assert) {
    await render(hbs`<PolicyUsedBy @policyName="unused" />`);
    await waitFor('[data-test-used-by-empty]');
    assert.dom('[data-test-used-by-row]').doesNotExist();
  });

  test('it shows a message when the token cannot list identities', async function (assert) {
    this.listError = { httpStatus: 403 };
    await render(hbs`<PolicyUsedBy @policyName="app-read" />`);
    await waitFor('[data-test-used-by-denied]');
    assert.dom('[data-test-used-by-row]').doesNotExist();
  });
});
