import {utf8ToBytes} from '@noble/hashes/utils.js'

export const IMPORTED_KEY_CIPHER_INFO = utf8ToBytes('dash-desktop-wallet/masternode-imported-key/v1')
export const IMPORTED_KEY_CIPHER_KEY_LENGTH = 32
export const IMPORTED_KEY_CIPHER_IV_LENGTH = 12
export const IMPORTED_KEY_CIPHER_TAG_LENGTH = 16