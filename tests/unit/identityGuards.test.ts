import {describe, it, expect, vi, beforeAll, afterAll} from 'vitest'
import {Knex} from 'knex'
import {nextLocalIdentityIndex} from '../../src/main/src/utils/identityKeys'
import {requireIdentity} from '../../src/main/src/utils/requireIdentity'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {Identity} from '../../src/main/src/types/Identity'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

describe('nextLocalIdentityIndex', () => {
  it('starts at 0 with no identities', () => {
    expect(nextLocalIdentityIndex([])).toBe(0)
  })

  it('takes one past the highest stored index', () => {
    const identities = [{identityIndex: 2}, {identityIndex: 5}] as Identity[]
    expect(nextLocalIdentityIndex(identities)).toBe(6)
  })
})

describe('requireIdentity', () => {
  const identity: Identity = {walletId: 'w', identityIndex: 0, identifier: 'id', derivationPath: 'p', assetLockTxid: null}

  it('returns the identity the DAO holds', async () => {
    const dao = {getByIdentifier: vi.fn().mockResolvedValue(identity)} as unknown as IdentityDAO
    expect(await requireIdentity(dao, 'w', 'id')).toBe(identity)
  })

  it('throws when the wallet does not hold it', async () => {
    const dao = {getByIdentifier: vi.fn().mockResolvedValue(null)} as unknown as IdentityDAO
    await expect(requireIdentity(dao, 'w', 'id')).rejects.toThrow('Identity not found in this wallet')
  })
})

describe('IdentityDAO.insertIdentityIfAbsent', () => {
  let knex: Knex
  let dao: IdentityDAO

  beforeAll(async () => {
    knex = getKnex()
    await migrateKnex(knex)
    await knex('wallet').insert({wallet_id: 'w1', network: 'testnet', label: null, encrypted_mnemonic: 'x', selected: false})
    dao = new IdentityDAO(knex)
  })

  afterAll(async () => {
    await knex.destroy()
  })

  it('inserts when absent and keeps the first row when present', async () => {
    const identity: Identity = {walletId: 'w1', identityIndex: 0, identifier: 'idABC', derivationPath: "m/9'/5'/17'/0'", assetLockTxid: null}

    await dao.insertIdentityIfAbsent(identity, 'tx1')
    await dao.insertIdentityIfAbsent({...identity, identityIndex: 9}, 'tx2')

    const stored = await dao.getByIdentifier('w1', 'idABC')
    expect(stored?.identityIndex).toBe(0)
    expect(stored?.assetLockTxid).toBe('tx1')
  })
})