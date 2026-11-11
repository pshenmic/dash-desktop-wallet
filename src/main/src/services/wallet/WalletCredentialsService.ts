import {PrivateKey} from 'dash-core-sdk'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {AddressDAO} from '../../database/AddressDAO'
import {PlatformAddressDAO} from '../../database/PlatformAddressDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {AddressKeyInfo} from '../../types/Address'
import {Network} from '../../types/Network'
import {COIN_TYPE, DERIVATION_PATH, PLATFORM_ACCOUNT} from '../../constants/addresses'
import {decryptMnemonic, encryptMnemonic} from '../../utils'
import {coreAccountPath} from '../../utils/addressDiscovery'
import {derivePath256} from '../../utils/dashPayKeys'
import {requireWallet} from '../../utils/requireWallet'
import {withUnlockedWallet} from '../../utils/walletSeed'
import {Logger} from '../../utils/logger'

// The mnemonic and the password never leave this class. Nothing here reaches a
// chain: it is the local wallet record, its encryption, and the derivation used
// to prove a seed belongs to it.
const log = new Logger('credentials')

export class WalletCredentialsService {
  private walletDAO: WalletDAO
  private addressDAO: AddressDAO
  private platformAddressDAO: PlatformAddressDAO
  private pbkdf2Iterations: number
  // Derivation only — a DashPlatformSDK would build a gRPC pool and fetch the
  // evonode list to do local maths.
  private keyPair = new KeyPairController()

  constructor(walletDAO: WalletDAO, addressDAO: AddressDAO, platformAddressDAO: PlatformAddressDAO, pbkdf2Iterations: number) {
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.platformAddressDAO = platformAddressDAO
    this.pbkdf2Iterations = pbkdf2Iterations
  }

  async exportAddressKey(walletId: string, address: string, password: string): Promise<AddressKeyInfo> {
    const owned = await this.ownedAddress(walletId, row => row.address === address)
    if (owned == null) {
      throw new Error(`${address} is not an address of this wallet`)
    }
    return this.exportKey(walletId, owned.derivationPath, password, owned.address)
  }

  async exportPathKey(walletId: string, path: string, password: string): Promise<AddressKeyInfo> {
    if (!DERIVATION_PATH.test(path)) {
      throw new Error(`Invalid derivation path: ${path}`)
    }
    const owned = await this.ownedAddress(walletId, row => row.derivationPath === path)
    return this.exportKey(walletId, path, password, owned?.address)
  }

  // Core, DashPay receiving and platform rows; shielded has no per-index path.
  private async ownedAddress(walletId: string, match: (row: {address: string, derivationPath: string}) => boolean) {
    const {receiving, change, dashPay = []} = await this.addressDAO.getAddressesByWalletId(walletId)
    const platform = await this.platformAddressDAO.getAddresses(walletId)
    return [...receiving, ...change, ...dashPay, ...platform].find(match)
  }

  // A path no row holds reports the key's L1 P2PKH address.
  private async exportKey(walletId: string, path: string, password: string, address?: string): Promise<AddressKeyInfo> {
    return withUnlockedWallet(this.walletDAO, walletId, password, async ({wallet, seed}) => {
      const derived = derivePath256(this.keyPair.seedToHdKey(seed, wallet.network), path)
      if (derived.privateKey == null || derived.publicKey == null) {
        throw new Error(`Failed to derive a key at ${path}`)
      }
      const key = PrivateKey.fromBytes(derived.privateKey, wallet.network, true)
      return {
        address: address ?? key.getAddress(),
        path,
        publicKey: derived.publicKey,
        privateKey: derived.privateKey,
        wif: key.toWIF(),
      }
    })
  }

  async exportMnemonic(walletId: string, password: string): Promise<string> {
    const wallet = await requireWallet(this.walletDAO, walletId)

    const isValid = await this.verifyWalletPassword(walletId, password)
    if (!isValid) {
      throw new Error('Invalid password')
    }

    return decryptMnemonic(wallet.encryptedMnemonic, password)
  }

  async verifyWalletPassword(walletId: string, password: string): Promise<boolean> {
    const wallet = await requireWallet(this.walletDAO, walletId)

    let decryptedMnemonic: string

    try {
      decryptedMnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
    } catch {
      return false
    }

    const isValid = await this.mnemonicMatchesWallet(walletId, wallet.network, decryptedMnemonic)

    // Backfill for wallets created before the xpubs were persisted. This is the
    // only routine path that holds the seed, so it is where they can be filled.
    if (isValid && (wallet.platformXpub == null || wallet.coreXpub == null)) {
      const seed = this.keyPair.mnemonicToSeed(decryptedMnemonic)
      const hdKey = this.keyPair.seedToHdKey(seed, wallet.network)

      if (wallet.platformXpub == null) {
        const platformXpub = await this.keyPair.derivePlatformAccountXpub(seed, wallet.network, PLATFORM_ACCOUNT)
        await this.walletDAO.setPlatformXpub(walletId, platformXpub)
      }

      if (wallet.coreXpub == null) {
        const accountNode = await this.keyPair.derivePath(hdKey, coreAccountPath(COIN_TYPE[wallet.network], 0))
        await this.walletDAO.setCoreXpub(walletId, accountNode.publicExtendedKey)
      }
    }

    return isValid
  }

  async verifyWalletMnemonic(walletId: string, mnemonic: string): Promise<boolean> {
    const wallet = await requireWallet(this.walletDAO, walletId)

    return this.mnemonicMatchesWallet(walletId, wallet.network, mnemonic)
  }

  async resetWalletPassword(walletId: string, mnemonic: string, newPassword: string): Promise<boolean> {
    const matches = await this.verifyWalletMnemonic(walletId, mnemonic)
    if (!matches) {
      return false
    }

    const encryptedMnemonic = encryptMnemonic(mnemonic.trim(), newPassword, this.pbkdf2Iterations)
    await this.walletDAO.updateEncryptedMnemonic(walletId, encryptedMnemonic)

    return true
  }

  private async mnemonicMatchesWallet(walletId: string, network: Network, mnemonic: string): Promise<boolean> {
    const groupedAddresses = await this.addressDAO.getAddressesByWalletId(walletId)
    const [referenceWalletAddress] = [...groupedAddresses.change, ...groupedAddresses.receiving]

    if (referenceWalletAddress == null) {
      return false
    }

    try {
      const seed = this.keyPair.mnemonicToSeed(mnemonic.trim())
      const hdKey = this.keyPair.seedToHdKey(seed, network)
      const coinType = COIN_TYPE[network]

      const key = await this.keyPair.derivePath(hdKey, `m/44'/${coinType}'/0'/1/${referenceWalletAddress.index}`)
      if (!key.publicKey) {
        return false
      }

      return this.keyPair.p2pkhAddress(key.publicKey, network) === referenceWalletAddress.address
    } catch (err) {
      // The caller reports this as a wrong password, which is what a derivation
      // failure would silently masquerade as.
      log.warn(`${walletId}: mnemonic check failed to derive:`, err)
      return false
    }
  }
}
