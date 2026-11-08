import {
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
import {OutPoint} from 'dash-core-sdk/src/types/OutPoint.js'
import {bytesToHex} from '@noble/hashes/utils.js'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {Network} from '../../types/Network'
import {ADDRESS_DECODED_LENGTH, ADDRESS_PREFIX} from '../../constants/addresses'
import {DUST_THRESHOLD_DUFFS, MASTERNODE_TYPE_CODE, PROREG_TX_VERSION, SEQUENCE_FINAL} from '../../constants/chain'
import {
  BuildAssetLockParams,
  BuildSignedAssetLockParams,
  BuildSignedProRegTxParams,
  BuildSignedTransferParams,
  BuildTransferParams,
  RecipientType,
  TransferInput,
} from '../../types/CoreTransaction'
import {MasternodeRegistration, ProviderKeyIds} from '../../types/Masternode'
import {buildAssetLockOutputs} from '../../utils/assetLockTx'
import {derivePath256} from '../../utils/dashPayKeys'
import {proRegInputsHash, proRegSignString, serviceAddressParts, signMessage} from '../../utils/proRegTx'


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

  private async privateKeys(inputs: TransferInput[], seed: Uint8Array, network: Network): Promise<PrivateKey[]> {
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
    const service = registration.serviceAddress == null ? null : serviceAddressParts(registration.serviceAddress)
    return new ProRegTX(
      PROREG_TX_VERSION,
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

  // The collateral signs the payload, which commits to the inputs, so the
  // payload is finished before the inputs are signed over it.
  async buildSignedProRegTx(params: BuildSignedProRegTxParams): Promise<SDKTransaction> {
    const {payload, collateral, inputs, changeAddress, inputTotal, feeDuffs, seed, network} = params
    const transaction = new SDKTransaction(undefined, undefined, undefined, 3, TransactionType.TRANSACTION_PROVIDER_REGISTER, payload)
    this.addInputs(transaction, inputs)
    this.addChange(transaction, inputTotal - feeDuffs, changeAddress)

    payload.inputsHash = proRegInputsHash(inputs)
    const [collateralKey, ...inputKeys] = await this.privateKeys([collateral, ...inputs], seed, network)
    payload.payloadSig = bytesToHex(signMessage(proRegSignString(payload, network), collateralKey.bytes()))
    transaction.sign(inputKeys)

    return transaction
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
