/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import { module, test } from 'qunit';
import { effectivePolicies } from 'vault/utils/identity-access';

module('Unit | Utility | identity-access', function () {
  test('effectivePolicies merges direct and group policies and keeps each source', function (assert) {
    const result = effectivePolicies(
      ['app-read'],
      [
        { id: 'g1', name: 'team', policies: ['infra-admin', 'app-read'], inherited: false },
        { id: 'g2', name: 'org', policies: ['default'], inherited: true },
      ]
    );

    assert.deepEqual(
      result.map((policy) => policy.name),
      ['app-read', 'default', 'infra-admin'],
      'each policy shows one time, sorted by name'
    );
    assert.deepEqual(
      result[0].sources,
      [{ label: 'Direct' }, { label: 'team', groupId: 'g1', inherited: false }],
      'a policy with two sources keeps both'
    );
    assert.deepEqual(
      result[1].sources,
      [{ label: 'org', groupId: 'g2', inherited: true }],
      'an inherited group is marked'
    );
  });

  test('effectivePolicies handles missing values', function (assert) {
    assert.deepEqual(effectivePolicies(null, [{ id: 'g1', name: 'team', policies: null }]), []);
    assert.deepEqual(effectivePolicies(), []);
  });
});
