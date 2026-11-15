import {AddressDAO} from '../database/AddressDAO'
import {MasternodeDAO} from '../database/MasternodeDAO'
import {TransactionDAO} from '../database/TransactionDAO'
import {WalletDAO} from '../database/WalletDAO'
import {ApplicationService} from '../services/app/ApplicationService'
import {CorePrevOutService} from '../services/core/CorePrevOutService'
import {WalletSyncService} from '../services/core/WalletSyncService'
import {CoreSpendSource} from '../types/CoinSelection'
import {TransferInputSelection} from '../types/CoreTransaction'
import {GroupedAddresses} from '../types/GroupedAddresses'
import {Network} from '../types/Network'
import {UTXO} from '../types/UTXO'
import {coreFeeDuffsFor} from '../utils/coreFeeRate'
import {withoutCollaterals} from '../utils/masternodes'
import {selectTransferInputs} from '../utils/transferInputs'
import {DashscanWalletProvider} from './DashscanWalletProvider'
import {P2PWalletProvider} from './P2PWalletProvider'
import {WalletProvider} from './WalletProvider'

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

  // The selection a send runs, over the same coins at the same rate, so a
  // preview or an asset lock cannot pick a set the send would not. It is also
  // where an amount the wallet cannot fund refuses.
  async coreSelection(
    walletId: string,
    network: Network,
    amountDuffs: bigint,
    outputsCount: number,
    payloadBytes = 0,
    source?: CoreSpendSource,
    changeTo?: string,
  ): Promise<{selection: TransferInputSelection; utxos: UTXO[]; grouped: GroupedAddresses}> {
    const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
    const provider = this.forWallet(walletId, network)
    await provider.ensureReady()
    const utxos = await this.spendableUtxos(walletId, network, source)

    const selection = selectTransferInputs(
      grouped,
      utxos,
      amountDuffs,
      inputsCount => coreFeeDuffsFor(this.applicationService.preferences.general.coreFeeMultiplier, inputsCount, outputsCount, true, payloadBytes),
      source,
      changeTo,
    )
    return {selection, utxos, grouped}
  }
}
