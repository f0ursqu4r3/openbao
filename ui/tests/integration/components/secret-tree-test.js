import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import sinon from 'sinon';

const link = (path) => `[data-test-secret-tree-link="${path}"]`;
const toggle = (path) => `[data-test-secret-tree-toggle="${path}"]`;

const LISTINGS = {
  '': ['apps/', 'shared/', 'top-secret'],
  'apps/': ['production/', 'staging/'],
  'apps/production/': ['DATABASE_URL'],
};

module('Integration | Component | secret-tree', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    this.owner.setupRouter();
    this.query = sinon.stub().callsFake((store, type, { id }) => {
      return LISTINGS[id]
        ? Promise.resolve({ data: { keys: LISTINGS[id] } })
        : Promise.reject({ httpStatus: 404 });
    });
    sinon.stub(this.owner.lookup('service:store'), 'adapterFor').returns({ query: this.query });
  });

  test('it lists the folders at the engine root and hides secrets', async function (assert) {
    await render(hbs`<SecretTree @backend="secret" @modelType="secret-v2" @currentPath="" />`);
    await waitFor(link('apps/'));

    assert.dom(link('')).hasText('secret/', 'the root shows the engine path');
    assert.dom(link('apps/')).hasText('apps/', 'a folder renders');
    assert.dom(link('shared/')).exists('the second folder renders');
    assert
      .dom('[data-test-secret-tree-link]')
      .exists({ count: 3 }, 'the secret at the root is not in the tree');
    assert.dom(link('apps/production/')).doesNotExist('a closed folder does not show its folders');
    assert.true(
      this.query.calledWithMatch(sinon.match.any, null, { backend: 'secret', id: '' }),
      'it lists the root'
    );
  });

  test('it opens the ancestors of the current folder and marks the current folder', async function (assert) {
    await render(
      hbs`<SecretTree @backend="secret" @modelType="secret-v2" @currentPath="apps/production/" />`
    );
    await waitFor(link('apps/production/'));

    assert.dom(link('apps/staging/')).exists('the sibling of the current folder renders');
    assert.dom(link('apps/production/')).hasAttribute('aria-current', 'page', 'the current folder is marked');
    assert.dom(toggle('apps/')).hasAttribute('aria-expanded', 'true', 'the ancestor is open');
    assert.dom(toggle('shared/')).hasAttribute('aria-expanded', 'false', 'other folders are closed');
  });

  test('it opens and closes a folder with the toggle button', async function (assert) {
    await render(hbs`<SecretTree @backend="secret" @modelType="secret-v2" @currentPath="" />`);
    await waitFor(link('apps/'));

    await click(toggle('apps/'));
    await waitFor(link('apps/production/'));
    assert.dom(toggle('apps/')).hasAttribute('aria-expanded', 'true', 'the folder is open');

    await click(toggle('apps/'));
    assert.dom(link('apps/production/')).doesNotExist('the folder is closed');
  });

  test('it shows a message when the engine has no folders', async function (assert) {
    this.query.callsFake(() => Promise.reject({ httpStatus: 403 }));
    await render(hbs`<SecretTree @backend="secret" @modelType="secret-v2" @currentPath="" />`);
    await waitFor('[data-test-secret-tree-empty]');

    assert.dom('[data-test-secret-tree-empty]').hasText('No folders', 'the empty message renders');
    assert.dom('[data-test-secret-tree-link]').exists({ count: 1 }, 'only the root renders');
  });
});
