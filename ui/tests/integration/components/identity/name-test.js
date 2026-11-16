/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import sinon from 'sinon';

module('Integration | Component | identity/name', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    this.ajax = sinon.stub().callsFake((url) => {
      return url.endsWith('/e1')
        ? Promise.resolve({ data: { id: 'e1', name: 'alice' } })
        : Promise.reject({ httpStatus: 403 });
    });
    sinon.stub(this.owner.lookup('service:store'), 'adapterFor').returns({
      ajax: this.ajax,
      buildURL: (modelName, id) => `/v1/${modelName}/id/${id}`,
    });
  });

  test('it shows the name of the record', async function (assert) {
    await render(hbs`<Identity::Name @type="entity" @id="e1" />`);

    assert.dom('[data-test-identity-name="e1"]').hasText('alice');
    assert.true(this.ajax.calledWith('/v1/identity/entity/id/e1', 'GET'), 'it reads the entity');
  });

  test('it keeps the ID when the record cannot be read', async function (assert) {
    await render(hbs`<Identity::Name @type="group" @id="g9" />`);

    assert.dom('[data-test-identity-name="g9"]').hasText('g9');
  });
});
