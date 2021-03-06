// @flow

import {
  BigNumber
} from 'bignumber.js';
import { RustModule } from '../lib/cardanoCrypto/rustLoader';

import type {
  Address, Value, Addressing,
} from '../lib/storage/models/PublicDeriver/interfaces';

import type { RemoteUnspentOutput } from '../lib/state-fetch/types';

export const transactionTypes = Object.freeze({
  EXPEND: 'expend',
  INCOME: 'income',
  EXCHANGE: 'exchange',
  SELF: 'self',
  MULTI: 'multi',
});
export type TransactionDirectionType = $Values<typeof transactionTypes>;

export type AddressKeyMap = { [addr: string]: RustModule.WalletV2.PrivateKey, ... };

export type UserAnnotation = {|
  +type: TransactionDirectionType,
  +amount: BigNumber,
  +fee: BigNumber,
|};

export type AddressedUtxo = {|
  ...RemoteUnspentOutput,
  ...Addressing,
|};

export type BaseSignRequest<T> = {|
  senderUtxos: Array<AddressedUtxo>,
  unsignedTx: T,
  changeAddr: Array<{| ...Address, ...Value, ...Addressing |}>,
  certificate: void | RustModule.WalletV3.Certificate,
|};

export type V3UnsignedTxUtxoResponse = {|
  senderUtxos: Array<RemoteUnspentOutput>,
  IOs: RustModule.WalletV3.InputOutput,
  changeAddr: Array<{| ...Address, ...Value, ...Addressing |}>,
|};
export type V3UnsignedTxAddressedUtxoResponse = {|
  senderUtxos: Array<AddressedUtxo>,
  IOs: RustModule.WalletV3.InputOutput,
  changeAddr: Array<{| ...Address, ...Value, ...Addressing |}>,
  certificate: void | RustModule.WalletV3.Certificate,
|};
export type V4UnsignedTxUtxoResponse = {|
  senderUtxos: Array<RemoteUnspentOutput>,
  txBuilder: RustModule.WalletV4.TransactionBuilder,
  changeAddr: Array<{| ...Address, ...Value, ...Addressing |}>,
|};
export type V4UnsignedTxAddressedUtxoResponse = {|
  senderUtxos: Array<AddressedUtxo>,
  txBuilder: RustModule.WalletV4.TransactionBuilder,
  changeAddr: Array<{| ...Address, ...Value, ...Addressing |}>,
  certificates: $ReadOnlyArray<RustModule.WalletV4.Certificate>,
|};
