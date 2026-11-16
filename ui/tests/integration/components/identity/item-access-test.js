/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import sinon from 'sinon';

const GROUPS = {
  g1: { id: 'g1', name: 'team', policies: ['infra-admin', 'app-read'] },
  g2: { id: 'g2', name: 'org', policies: ['default'] },
};

module('Integration | Component | identity/item-access', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    this.owner.setupRouter();
    const ajax = sinon.stub().callsFake((url) => {
      const group = GROUPS[url.split('/').pop()];
      return group ? Promise.resolve({ data: group }) : Promise.reject({ httpStatus: 403 });
    });
    sinon
      .stub(this.owner.lookup('service:store'), 'adapterFor')
      .returns({ ajax, buildURL: (modelName, id) => `/v1/${modelName}/id/${id}` });
    this.model = {
      name: 'alice',
      policies: ['app-read'],
      directGroupIds: ['g1'],
      inheritedGroupIds: ['g2'],
      aliases: [{ id: 'a1', name: 'alice-login', mountType: 'userpass', mountPath: 'auth/userpass/' }],
    };
  });

  test('it shows the effective policies with their sources', async function (assert) {
    await render(hbs`<Identity::ItemAccess @model={{this.model}} />`);
    await waitFor('[data-test-access-policy]');

    assert.dom('[data-test-access-policy]').exists({ count: 3 }, 'each policy shows one time');
    assert
      .dom('[data-test-access-policy="app-read"] [data-test-access-source]')
      .exists({ count: 2 }, 'a policy from two sources shows both');
    assert.dom('[data-test-access-policy="app-read"]').includesText('Direct').includesText('team');
    assert.dom('[data-test-access-policy="default"]').includesText('org (inherited)');
    assert.dom('[data-test-access-unreadable]').doesNotExist();
  });

  test('it shows the groups and the logins', async function (assert) {
    await render(hbs`<Identity::ItemAccess @model={{this.model}} />`);
    await waitFor('[data-test-access-group]');

    assert
      .dom('[data-test-access-group="team"]')
      .includesText('Direct')
      .includesText('infra-admin, app-read');
    assert.dom('[data-test-access-group="org"]').includesText('Inherited');
    assert.dom('[data-test-access-alias="alice-login"]').includesText('userpass');
  });

  test('it shows empty states and a note for a group that cannot be read', async function (assert) {
    this.model = {
      name: 'bob',
      policies: [],
      directGroupIds: ['missing'],
      inheritedGroupIds: [],
      aliases: [],
    };
    await render(hbs`<Identity::ItemAccess @model={{this.model}} />`);
    await waitFor('[data-test-access-no-policies]');

    assert.dom('[data-test-access-no-groups]').exists();
    assert.dom('[data-test-access-no-aliases]').exists();
    assert.dom('[data-test-access-unreadable]').includesText('1 group could not be read');
  });
});
