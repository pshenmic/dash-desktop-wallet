import {
  bls,
  Input,
  Output,
  PrivateKey,
  Script,
  Transaction as SDKTransaction,
  TransactionType,
  utils as sdkUtils,
} from 'dash-core-sdk'
import {Base58Check} from 'dash-core-sdk/src/base58check.js'
import {ProRegTX} from 'dash-core-sdk/src/types/ExtraPayload/ProRegTX.js'
import {ProUpRegTx} from 'dash-core-sdk/src/types/ExtraPayload/ProUpRegTx.js'
import {ProUpRevTx} from 'dash-core-sdk/src/types/ExtraPayload/ProUpRevTx.js'
import {ProUpServTx} from 'dash-core-sdk/src/types/ExtraPayload/ProUpServTx.js'
import {AddrV2Network, EXT_NET_INFO_VERSION, ExtNetInfo, NetInfoEntryType, NetInfoPurpose} from 'dash-core-sdk/src/types/ExtNetInfo.js'
import {PROTX_VERSION_EXT_ADDR} from 'dash-core-sdk/src/constants.js'
import {OutPoint} from 'dash-core-sdk/src/types/OutPoint.js'
import {bytesToHex} from '@noble/hashes/utils.js'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {Network} from '../../types/Network'
import {ADDRESS_DECODED_LENGTH, ADDRESS_PREFIX} from '../../constants/addresses'
import {
  DUST_THRESHOLD_DUFFS,
  MASTERNODE_TYPE_CODE,
  PROTX_VERSION,
  REVOCATION_REASON_CODE,
  SEQUENCE_FINAL,
} from '../../constants/chain'
import {
  BuildAssetLockParams,
  BuildSignedAssetLockParams,
  BuildSignedProviderTxParams,
  BuildSignedTransferParams,
  BuildTransferParams,
  ProviderPayload,
  ProviderTxSigner,
  RecipientType,
  TransferInput,
} from '../../types/CoreTransaction'
import {MasternodeRegistration, MasternodeServiceUpdate, MasternodeType, ProviderKeyIds, RevocationReason} from '../../types/Masternode'
import {buildAssetLockOutputs} from '../../utils/assetLockTx'
import {derivePath256} from '../../utils/dashPayKeys'
import {serviceAddressParts} from '../../utils/providerTx'


export class CoreTransactionService {
  // Derivation only — a DashPlatformSDK would build a gRPC pool and fetch the
  // evonode list to do local maths.
  private keyPair = new KeyPairController()

  classifyAddress(address: string, network: Network): RecipientType {
    let decoded: Uint8Array
    try {
      decoded = Base58Check.decode(address)
    } catch {
      throw new Error(`Invalid address: ${address}`)
    }
    if (decoded.length !== ADDRESS_DECODED_LENGTH) {
      throw new Error(`Invalid address: ${address}`)
    }
    const prefixes = ADDRESS_PREFIX[network]
    const version = decoded[0]
    if (version === prefixes.p2pkh) return 'p2pkh'
    if (version === prefixes.p2sh) return 'p2sh'
    throw new Error(`${address} is not a valid ${network} address`)
  }

  // Change is paid to a P2PKH output by construction, so a P2SH address named
  // as change would lock the change to a pubkey-hash script no one can spend.
  requireChangeAddress(address: string, network: Network): void {
    if (this.classifyAddress(address, network) !== 'p2pkh') {
      throw new Error('Change address must be a P2PKH address')
    }
  }

  // An input carries the script of the output it spends, which is what sighash
  // reads; signing replaces each one with the signature script. So an unsigned
  // transaction is these bytes with that substitution still to come.
  private addInputs(transaction: SDKTransaction, inputs: TransferInput[]): void {
    for (const input of inputs) {
      transaction.addInput(new Input(input.txId, input.vOut, input.script, SEQUENCE_FINAL))
    }
  }

  private async privateKeys(inputs: Array<Pick<TransferInput, 'derivationPath' | 'address'>>, seed: Uint8Array, network: Network): Promise<PrivateKey[]> {
    const hdKey = this.keyPair.seedToHdKey(seed, network)

    const privateKeys: PrivateKey[] = []
    for (const input of inputs) {
      const derived = derivePath256(hdKey, input.derivationPath)
      if (!derived.privateKey) {
        throw new Error(`Failed to derive private key for ${input.address}`)
      }
      privateKeys.push(PrivateKey.fromBytes(derived.privateKey as Uint8Array, network, true))
    }
    return privateKeys
  }

  buildAssetLock(params: BuildAssetLockParams): SDKTransaction {
    const {inputs, amountDuffs, creditAddress, changeAddress, inputTotal, feeDuffs} = params

    const {burnOutput, extraPayload} = buildAssetLockOutputs(amountDuffs, creditAddress)
    const transaction = new SDKTransaction(undefined, undefined, undefined, 3, TransactionType.TRANSACTION_ASSET_LOCK, extraPayload)

    this.addInputs(transaction, inputs)
    transaction.addOutput(burnOutput)
    this.addChange(transaction, inputTotal - amountDuffs - feeDuffs, changeAddress)

    return transaction
  }

  async buildSignedAssetLock(params: BuildSignedAssetLockParams): Promise<SDKTransaction> {
    const transaction = this.buildAssetLock(params)
    transaction.sign(await this.privateKeys(params.inputs, params.seed, params.network))

    return transaction
  }

  // Unsigned and with no inputs hash yet: the shape the fee is quoted from.
  proRegPayload(registration: MasternodeRegistration, keys: ProviderKeyIds, network: Network): ProRegTX {
    const service = registration.serviceAddress == null ? null : serviceAddressParts(registration.serviceAddress, network)
    return new ProRegTX(
      PROTX_VERSION,
      MASTERNODE_TYPE_CODE[registration.type],
      0,
      new OutPoint(registration.collateral.txid, registration.collateral.vout),
      service?.ip,
      service?.port,
      keys.ownerKeyId,
      keys.operatorPublicKey,
      keys.votingKeyId,
      registration.operatorReward,
      this.payoutScript(registration.payoutAddress, network),
      '00'.repeat(32),
      registration.platformNodeId?.toLowerCase(),
      registration.platformP2PPort ?? undefined,
      registration.platformHttpPort ?? undefined,
      '',
    )
  }

  proUpRegPayload(proTxHash: string, operatorPublicKey: string, votingAddress: string, payoutAddress: string, network: Network): ProUpRegTx {
    return new ProUpRegTx(
      PROTX_VERSION,
      proTxHash,
      0,
      operatorPublicKey,
      bytesToHex(sdkUtils.addressToPublicKeyHash(votingAddress)),
      this.payoutScript(payoutAddress, network),
      '00'.repeat(32),
      '',
    )
  }

  // v24 refuses an Evo's update below v3, and anything at v3 before it is active.
  // From v3 the service and the platform endpoints travel in netInfo.
  proUpServPayload(type: MasternodeType, proTxHash: string, update: MasternodeServiceUpdate, v24Active: boolean, network: Network): ProUpServTx {
    const {ip, port} = serviceAddressParts(update.serviceAddress, network)
    const extended = type === 'Evo' && v24Active
    const version = extended ? PROTX_VERSION_EXT_ADDR : PROTX_VERSION
    const endpoints: Array<[NetInfoPurpose, number | null]> = [
      [NetInfoPurpose.CORE_P2P, port],
      [NetInfoPurpose.PLATFORM_P2P, update.platformP2PPort],
      [NetInfoPurpose.PLATFORM_HTTPS, update.platformHttpPort],
    ]
    const netInfo = new ExtNetInfo(EXT_NET_INFO_VERSION, new Map(endpoints.flatMap(([purpose, entryPort]) => entryPort == null ? []
      : [[purpose, [{type: NetInfoEntryType.Service, network: AddrV2Network.IPv4, address: ip, port: entryPort}]]])))
    return new ProUpServTx(
      version,
      MASTERNODE_TYPE_CODE[type],
      proTxHash,
      ip,
      port,
      update.operatorPayoutAddress == null ? new Script() : this.payoutScript(update.operatorPayoutAddress, network),
      '00'.repeat(32),
      update.platformNodeId?.toLowerCase(),
      extended ? undefined : update.platformP2PPort ?? undefined,
      extended ? undefined : update.platformHttpPort ?? undefined,
      '',
      extended ? netInfo : undefined,
    )
  }

  proUpRevPayload(proTxHash: string, reason: RevocationReason): ProUpRevTx {
    return new ProUpRevTx(PROTX_VERSION, proTxHash, REVOCATION_REASON_CODE[reason], '00'.repeat(32), '')
  }

  // The payload commits to the inputs and the inputs' signatures to the payload,
  // so it is finished in between.
  async buildSignedProviderTx(params: BuildSignedProviderTxParams): Promise<SDKTransaction> {
    const {payload, signer, inputs, changeAddress, inputTotal, feeDuffs, seed, network} = params
    const type = payload instanceof ProRegTX ? TransactionType.TRANSACTION_PROVIDER_REGISTER
      : payload instanceof ProUpRegTx ? TransactionType.TRANSACTION_PROVIDER_UPDATE_REGISTRAR
      : payload instanceof ProUpServTx ? TransactionType.TRANSACTION_PROVIDER_UPDATE_SERVICE
      : TransactionType.TRANSACTION_PROVIDER_UPDATE_REVOKE
    const transaction = new SDKTransaction(undefined, undefined, undefined, 3, type, payload)
    this.addInputs(transaction, inputs)
    this.addChange(transaction, inputTotal - feeDuffs, changeAddress)

    payload.inputsHash = transaction.providerInputsHash()
    await this.signPayload(payload, signer, seed, network)
    transaction.sign(await this.privateKeys(inputs, seed, network))

    return transaction
  }

  // A ProRegTx's collateral signs Core's sign string as a message; every other
  // signer signs the payload hash itself, the operator with BLS.
  private async signPayload(payload: ProviderPayload, signer: ProviderTxSigner, seed: Uint8Array, network: Network): Promise<void> {
    if (signer.kind === 'operator') {
      const secretKey = bls.deriveOperatorSecretKey(seed, network, signer.index)
      if (payload instanceof ProUpServTx) payload.signWithOperatorKey(secretKey)
      if (payload instanceof ProUpRevTx) payload.signWithOperatorKey(secretKey)
      return
    }
    const [key] = await this.privateKeys([signer], seed, network)
    if (payload instanceof ProRegTX) payload.signWithCollateralKey(key, network)
    if (payload instanceof ProUpRegTx) payload.signWithOwnerKey(key)
  }

  private payoutScript(address: string, network: Network): Script {
    return this.classifyAddress(address, network) === 'p2sh' ? this.p2shScript(address) : Output.createP2PKH(0n, address).script
  }

  private addChange(transaction: SDKTransaction, change: bigint, changeAddress: string): void {
    if (change < 0n) {
      throw new Error('Selected inputs do not cover the amount and network fee')
    }
    if (change >= DUST_THRESHOLD_DUFFS) {
      transaction.addOutput(Output.createP2PKH(change, changeAddress))
    }
  }

  buildTransfer(params: BuildTransferParams): SDKTransaction {
    const {inputs, outputs, changeAddress, inputTotal, feeDuffs} = params

    const transaction = new SDKTransaction()
    this.addInputs(transaction, inputs)

    let outputTotal = 0n
    for (const output of outputs) {
      const recipientOutput = new Output(output.amountDuffs)
      if (output.recipientType === 'p2sh') {
        recipientOutput.script = this.p2shScript(output.address)
      } else {
        recipientOutput.generateP2PKH(output.address)
      }
      transaction.addOutput(recipientOutput)
      outputTotal += output.amountDuffs
    }

    this.addChange(transaction, inputTotal - outputTotal - feeDuffs, changeAddress)

    return transaction
  }

  async buildSignedTransfer(params: BuildSignedTransferParams): Promise<SDKTransaction> {
    const transaction = this.buildTransfer(params)
    transaction.sign(await this.privateKeys(params.inputs, params.seed, params.network))

    return transaction
  }

  private p2shScript(address: string): Script {
    const script = new Script()
    script.pushOpCode('OP_HASH160')
    script.pushOpCode('OP_PUSHBYTES_20', sdkUtils.addressToPublicKeyHash(address))
    script.pushOpCode('OP_EQUAL')
    return script
  }
}
