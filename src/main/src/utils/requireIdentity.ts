import {IdentityDAO} from '../database/IdentityDAO'
import {Identity} from '../types/Identity'

export async function requireIdentity(identityDAO: IdentityDAO, walletId: string, identifier: string): Promise<Identity> {
  const identity = await identityDAO.getByIdentifier(walletId, identifier)
  if (identity == null) {
    throw new Error('Identity not found in this wallet')
  }
  return identity
}