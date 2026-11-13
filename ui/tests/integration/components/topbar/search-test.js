import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, fillIn, focus, click, triggerKeyEvent } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import sinon from 'sinon';

const INPUT = '[data-test-topbar-search-input]';
const RESULT = '[data-test-topbar-search-result]';
const result = (label) => `[data-test-topbar-search-result="${label}"]`;

module('Integration | Component | topbar/search', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    const permissions = this.owner.lookup('service:permissions');
    this.hasNavPermission = sinon.stub(permissions, 'hasNavPermission').returns(true);

    const store = this.owner.lookup('service:store');
    sinon.stub(store, 'query').resolves([
      {
        id: 'secret',
        path: 'secret/',
        engineType: 'kv',
        icon: 'key-values',
        backendLink: 'vault.cluster.secrets.backend.list-root',
        shouldIncludeInList: true,
        isSupportedBackend: true,
      },
    ]);

    this.transitionTo = sinon.stub(this.owner.lookup('service:router'), 'transitionTo');
  });

  test('it shows no results until the input has focus', async function (assert) {
    await render(hbs`<Topbar::Search />`);
    assert.dom(RESULT).doesNotExist('results are hidden');

    await focus(INPUT);
    assert.dom(RESULT).exists('pages are listed on focus');
    assert.dom(result('secret/')).doesNotExist('engines are listed only when the text matches');
  });

  test('it filters pages and secrets engines by the typed text', async function (assert) {
    await render(hbs`<Topbar::Search />`);
    await focus(INPUT);
    await fillIn(INPUT, 'sec');

    assert.dom(result('secret/')).hasText('secret/ kv', 'the matching engine renders with its type');
    assert.dom(result('Secrets engines')).exists('the matching page renders');
    assert.dom(result('Groups')).doesNotExist('pages that do not match are hidden');

    await fillIn(INPUT, 'no-such-thing');
    assert.dom(RESULT).doesNotExist('no result renders');
    assert.dom('#topbar-search-results').hasText('No matches', 'the empty message renders');
  });

  test('it hides pages the token cannot use', async function (assert) {
    this.hasNavPermission.returns(false);
    await render(hbs`<Topbar::Search />`);
    await focus(INPUT);
    await fillIn(INPUT, 'group');

    assert.dom(result('Groups')).doesNotExist('the Groups page is hidden');
  });

  test('it goes to the clicked result and closes', async function (assert) {
    await render(hbs`<Topbar::Search />`);
    await focus(INPUT);
    await fillIn(INPUT, 'group');
    await click(result('Groups'));

    assert.true(
      this.transitionTo.calledWith('vault.cluster.access.identity', 'groups'),
      'it transitions to the groups page'
    );
    assert.dom(RESULT).doesNotExist('results close');
    assert.dom(INPUT).hasValue('', 'the input is cleared');
  });

  test('it selects a result with the keyboard', async function (assert) {
    await render(hbs`<Topbar::Search />`);
    await focus(INPUT);
    await fillIn(INPUT, 'sec');
    await triggerKeyEvent(INPUT, 'keydown', 'ArrowDown');

    assert.dom(result('Secrets engines')).hasClass('is-active', 'the second result is active');

    await triggerKeyEvent(INPUT, 'keydown', 'Enter');
    assert.true(this.transitionTo.calledWith('vault.cluster.secrets'), 'it transitions to the active result');
  });
});
