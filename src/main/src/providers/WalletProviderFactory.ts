import {AddressDAO} from '../database/AddressDAO'
import {MasternodeDAO} from '../database/MasternodeDAO'
import {TransactionDAO} from '../database/TransactionDAO'
import {WalletDAO} from '../database/WalletDAO'
import {ApplicationService} from '../services/app/ApplicationService'
import {CorePrevOutService} from '../services/core/CorePrevOutService'
import {WalletSyncService} from '../services/core/WalletSyncService'
import {CoreSpendSource} from '../types/CoinSelection'
import {Network} from '../types/Network'
import {UTXO} from '../types/UTXO'
import {withoutCollaterals} from '../utils/masternodes'
import {DashscanWalletProvider} from './DashscanWalletProvider'
import {P2PWalletProvider} from './P2PWalletProvider'
import {WalletProvider} from './WalletProvider'

// Abstract factory
// needed for move out getProvider() from WalletService
export class WalletProviderFactory {
  private walletDAO: WalletDAO
  private addressDAO: AddressDAO
  private transactionDAO: TransactionDAO
  private applicationService: ApplicationService
  private walletSyncService: WalletSyncService
  private prevOutService: CorePrevOutService
  private masternodeDAO: MasternodeDAO

  constructor(
    walletDAO: WalletDAO,
    addressDAO: AddressDAO,
    transactionDAO: TransactionDAO,
    applicationService: ApplicationService,
    walletSyncService: WalletSyncService,
    prevOutService: CorePrevOutService,
    masternodeDAO: MasternodeDAO,
  ) {
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.transactionDAO = transactionDAO
    this.applicationService = applicationService
    this.walletSyncService = walletSyncService
    this.prevOutService = prevOutService
    this.masternodeDAO = masternodeDAO
  }

  forWallet(walletId: string, network: Network): WalletProvider {
    if (this.applicationService.preferences.general.connectionType === 'p2p') {
      return new P2PWalletProvider(this.transactionDAO, walletId, this.walletSyncService, this.addressDAO, this.prevOutService, network)
    }
    return new DashscanWalletProvider(
      network,
      walletId,
      this.addressDAO,
      this.walletDAO,
      this.transactionDAO,
    )
  }

  // The coins a send, fee quote or asset lock selects from, in either mode.
  async spendableUtxos(walletId: string, network: Network, source?: CoreSpendSource): Promise<UTXO[]> {
    const [utxos, collaterals] = await Promise.all([
      this.forWallet(walletId, network).getWalletUtxos(),
      this.masternodeDAO.getCollaterals(walletId),
    ])
    return withoutCollaterals(utxos, collaterals, source)
  }
}
