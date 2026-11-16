/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

// Helpers for the identity access views. They read identity records with plain requests, so
// partial records do not go into the store.

// the most records of one type that the "Used by" list reads
export const USED_BY_LIMIT = 200;
const CHUNK_SIZE = 20;

const urlFor = (adapter, type, id) => adapter.buildURL(`identity/${type}`, id);

// returns the record data, or null when the token cannot read the record or it does not exist
export async function fetchIdentityRecord(store, type, id) {
  const adapter = store.adapterFor(`identity/${type}`);
  try {
    const response = await adapter.ajax(urlFor(adapter, type, id), 'GET');
    return response?.data || null;
  } catch {
    return null;
  }
}

// returns { ids, denied }; a 404 is an empty list
export async function listIdentityIds(store, type) {
  const adapter = store.adapterFor(`identity/${type}`);
  try {
    const response = await adapter.ajax(`${urlFor(adapter, type)}?list=true`, 'GET');
    return { ids: response?.data?.keys || [], denied: false };
  } catch (error) {
    return { ids: [], denied: error?.httpStatus === 403 };
  }
}

// reads the records in small groups so that a large list does not send all requests at once
export async function fetchIdentityRecords(store, type, ids) {
  const records = [];
  for (let start = 0; start < ids.length; start += CHUNK_SIZE) {
    const chunk = ids.slice(start, start + CHUNK_SIZE);
    const results = await Promise.all(chunk.map((id) => fetchIdentityRecord(store, type, id)));
    records.push(...results.filter(Boolean));
  }
  return records;
}

/**
 * Builds the list of policies that apply to an entity through the identity system.
 * @param {string[]} directPolicies - policies set on the entity
 * @param {object[]} groups - [{ id, name, policies, inherited }]
 * @returns {object[]} [{ name, sources: [{ label, groupId, inherited }] }], sorted by name
 */
export function effectivePolicies(directPolicies = [], groups = []) {
  const byName = new Map();
  const add = (name, source) => {
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(source);
  };
  (directPolicies || []).forEach((name) => add(name, { label: 'Direct' }));
  groups.forEach((group) => {
    (group.policies || []).forEach((name) =>
      add(name, { label: group.name, groupId: group.id, inherited: group.inherited })
    );
  });
  return [...byName.keys()].sort().map((name) => ({ name, sources: byName.get(name) }));
}
