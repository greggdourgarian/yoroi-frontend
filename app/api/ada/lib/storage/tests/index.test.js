// @flow

import {
  schema,
} from 'lovefield';
import stableStringify from 'json-stable-stringify';
import '../../test-config';
import { loadLovefieldDB } from '../database/index';
import {
  HARD_DERIVATION_START,
  CARDANO_COINTYPE,
  BIP44_PURPOSE,
  EXTERNAL,
  INTERNAL,
} from '../../../../../config/numbersConfig';

import {
  UnusedAddressesError,
} from '../../../../common';
import {
  WrongPassphraseError,
} from '../../cardanoCrypto/cryptoErrors';

import { RustModule } from '../../cardanoCrypto/rustLoader';

import {
  Bip44Wallet,
  PublicFromPrivateInstance,
  GetPrivateDeriverKeyInstance,
} from '../models/Bip44Wallet';
import {
  PublicDeriver,
  asAddFromPublic,
  asGetAllAddresses,
  asGetPublicKey,
  asDisplayCutoff,
  asHasChains,
  asGetSigningKey,
} from '../models/PublicDeriver/index';

import {
  getAllBip44Wallets,
  getPublicDeriversFor,
} from '../models/utils';

import {
  createStandardBip44Wallet,
} from '../bridge/walletHelper';

import { snapshot } from './snapshot';

import type { ConfigType } from '../../../../../../config/config-types';

declare var CONFIG: ConfigType;
const protocolMagic = CONFIG.network.protocolMagic;

const mnemonic = 'prevent company field green slot measure chief hero apple task eagle sunset endorse dress seed';

const privateDeriverPassword = 'greatest_password_ever';
const passwordHash = Buffer.from(privateDeriverPassword).toString('hex');

beforeAll(async () => {
  await RustModule.load();
});

test('Can add and fetch address in wallet', async (done) => {
  const settings = RustModule.Wallet.BlockchainSettings.from_json({
    protocol_magic: protocolMagic
  });
  const entropy = RustModule.Wallet.Entropy.from_english_mnemonics(mnemonic);
  const rootPk = RustModule.Wallet.Bip44RootPrivateKey.recover(entropy, '');

  const db = await loadLovefieldDB(schema.DataStoreType.MEMORY);

  const firstAccountIndex = 0 + HARD_DERIVATION_START;
  const firstAccountPk = rootPk.bip44_account(
    RustModule.Wallet.AccountIndex.new(firstAccountIndex)
  );
  const secondAccountPk = rootPk.bip44_account(
    RustModule.Wallet.AccountIndex.new(1 + HARD_DERIVATION_START)
  );
  const firstExternalAddressKey = firstAccountPk
    .bip44_chain(false)
    .address_key(RustModule.Wallet.AddressKeyIndex.new(0));
  const firstExternalAddressHash = firstExternalAddressKey
    .public()
    .bootstrap_era_address(settings)
    .to_base58();

  const state = await createStandardBip44Wallet({
    db,
    settings,
    rootPk,
    password: privateDeriverPassword,
    accountPublicKey: firstAccountPk.public(),
    accountIndex: HARD_DERIVATION_START + 0,
    walletName: 'My Test Wallet',
    accountName: '',
  });

  // test wallet functionality detection and usage
  let bipWallet;
  {
    const accountIndex = 1 + HARD_DERIVATION_START;
    bipWallet = await Bip44Wallet.createBip44Wallet(
      db,
      state.conceptualWalletRow.ConceptualWalletId,
      state.bip44WrapperRow,
      protocolMagic,
    );
    expect(bipWallet instanceof PublicFromPrivateInstance).toEqual(true);
    if (bipWallet instanceof PublicFromPrivateInstance) {
      await bipWallet.derivePublicDeriverFromPrivate(
        {
          publicDeriverInsert: ids => ({
            Bip44WrapperId: ids.wrapperId,
            KeyDerivationId: ids.derivationId,
            Name: 'Checking account',
            LastSyncInfoId: ids.lastSyncInfoId,
          }),
          pathToPublic: [
            {
              index: BIP44_PURPOSE,
              insert: {},
            },
            {
              index: CARDANO_COINTYPE,
              insert: {},
            },
            {
              index: accountIndex,
              insert: {},
            },
          ],
          decryptPrivateDeriverPassword: privateDeriverPassword,
          publicDeriverPublicKey: {
            password: null,
            lastUpdate: null,
          },
          publicDeriverPrivateKey: {
            password: null,
            lastUpdate: null,
          },
          initialDerivations: [
            {
              index: 0, // external chain,
              insert: { DisplayCutoff: 0 },
              children: [],
            },
            {
              index: 1, // internal chain,
              insert: { DisplayCutoff: null },
              children: [],
            }
          ]
        },
      );
    }

    expect(bipWallet instanceof GetPrivateDeriverKeyInstance).toEqual(true);
    if (bipWallet instanceof GetPrivateDeriverKeyInstance) {
      const key = await bipWallet.getPrivateDeriverKey();
      expect(key.keyDerivation.PrivateKeyId).toEqual(key.keyRow.KeyId);
      expect(key.keyRow.Hash).toEqual(rootPk.key().to_hex() + passwordHash);
      expect(key.keyRow.PasswordLastUpdate).toEqual(null);
      expect(key.keyRow.IsEncrypted).toEqual(true);

      const newDate = new Date();
      const newKey = await bipWallet.changePrivateDeriverPassword({
        oldPassword: privateDeriverPassword,
        newPassword: 'asdf',
        currentTime: newDate,
      });
      expect(newKey.Hash).toEqual(rootPk.key().to_hex() + '61736466');
      expect(newKey.PasswordLastUpdate).toEqual(newDate);
      expect(newKey.IsEncrypted).toEqual(true);

      // input previous password to make sure it no longer works
      try {
        await bipWallet.changePrivateDeriverPassword({
          oldPassword: privateDeriverPassword,
          newPassword: 'asdf',
          currentTime: newDate,
        });  
        done.fail(new Error('Above function should have thrown'));
      } catch (e) {
        expect(e).toBeInstanceOf(WrongPassphraseError);
      }

      // reset after test
      await bipWallet.changePrivateDeriverPassword({
        oldPassword: 'asdf',
        newPassword: privateDeriverPassword,
        currentTime: key.keyRow.PasswordLastUpdate,
      });
    }
  }

  // test Public Deriver functionality
  {
    const publicDeriver = await PublicDeriver.createPublicDeriver(
      state.publicDeriver[0].publicDeriverResult,
      bipWallet,
    );

    // test renaming conceptual wallet
    {
      await publicDeriver.rename({
        newName: 'rename test',
      });
      const info = await publicDeriver.getFullPublicDeriverInfo();
      expect(info.Name).toEqual('rename test');
      await publicDeriver.rename({
        newName: '',
      });
    }

    const asGetAllAddressesInstance = asGetAllAddresses(publicDeriver);
    expect(asGetAllAddressesInstance != null).toEqual(true);
    if (asGetAllAddressesInstance != null) {
      const addresses = await asGetAllAddressesInstance.getAllAddresses();
      expect(addresses.length).toEqual(40);
      expect(addresses[0].addr.Hash).toEqual(firstExternalAddressHash);
      expect(addresses[0].addressing.path).toEqual([
        BIP44_PURPOSE, CARDANO_COINTYPE, firstAccountIndex, 0, 0
      ]);
    }

    const asGetPublicKeyInstance = asGetPublicKey(publicDeriver);
    expect(asGetPublicKeyInstance != null).toEqual(true);
    if (asGetPublicKeyInstance != null) {
      const pubKey = await asGetPublicKeyInstance.getPublicKey();
      expect(pubKey.Hash).toEqual(firstAccountPk.public().key().to_hex());
    }

    const asHasChainsInstance = asHasChains(publicDeriver);
    expect(asHasChainsInstance != null).toEqual(true);
    if (asHasChainsInstance != null) {
      const externalAddresses = await asHasChainsInstance.getAddressesForChain({
        chainId: EXTERNAL,
      });
      expect(externalAddresses.length).toEqual(20);
      expect(externalAddresses[0].addr.Hash).toEqual(
        firstAccountPk
          .bip44_chain(false)
          .address_key(RustModule.Wallet.AddressKeyIndex.new(0))
          .public()
          .bootstrap_era_address(settings)
          .to_base58()
      );

      const internalAddresses = await asHasChainsInstance.getAddressesForChain({
        chainId: INTERNAL,
      });
      expect(internalAddresses.length).toEqual(20);
      expect(internalAddresses[0].addr.Hash).toEqual(
        firstAccountPk
          .bip44_chain(true)
          .address_key(RustModule.Wallet.AddressKeyIndex.new(0))
          .public()
          .bootstrap_era_address(settings)
          .to_base58()
      );
    }

    const asDisplayCutoffInstance = asDisplayCutoff(publicDeriver);
    expect(asDisplayCutoffInstance != null).toEqual(true);
    if (asDisplayCutoffInstance != null) {
      // test get
      expect(await asDisplayCutoffInstance.getCutoff()).toEqual(0);

      // test pop
      const popped = await asDisplayCutoffInstance.popAddress();
      const nextIndex = 1;
      expect(popped.index).toEqual(nextIndex);
      const expectedAddress = firstAccountPk
        .bip44_chain(false)
        .address_key(RustModule.Wallet.AddressKeyIndex.new(nextIndex))
        .public()
        .bootstrap_era_address(settings)
        .to_base58();
      expect(popped.addr.Hash).toEqual(expectedAddress);
      expect(await asDisplayCutoffInstance.getCutoff()).toEqual(1);

      // test set
      await asDisplayCutoffInstance.setCutoff({ newIndex: 19 });
      expect(await asDisplayCutoffInstance.getCutoff()).toEqual(19);

      // test pop after no addresses left
      try {
        await asDisplayCutoffInstance.popAddress();
        done.fail(new Error('Above function should have thrown'));
      } catch (e) {
        expect(e).toBeInstanceOf(UnusedAddressesError);
      }

      // reset state after test
      await asDisplayCutoffInstance.setCutoff({ newIndex: 0 });
    }

    const asGetSigningKeyInstance = asGetSigningKey(publicDeriver);
    expect(asGetSigningKeyInstance != null).toEqual(true);
    if (asGetSigningKeyInstance != null) {
      const signingKey = await asGetSigningKeyInstance.getSigningKey();
      expect(signingKey.level).toEqual(0);
      expect(signingKey.row.Hash).toEqual(rootPk.key().to_hex() + passwordHash);

      const normalized = await asGetSigningKeyInstance.normalizeKey({
        ...signingKey,
        password: privateDeriverPassword
      });
      expect(normalized.prvKeyHex).toEqual(firstAccountPk.key().to_hex());
      expect(normalized.pubKeyHex).toEqual(firstAccountPk.public().key().to_hex());

      const newDate = new Date();
      const newKey = await asGetSigningKeyInstance.changeSigningKeyPassword({
        oldPassword: privateDeriverPassword,
        newPassword: 'asdf',
        currentTime: newDate,
      });
      expect(newKey.Hash).toEqual(rootPk.key().to_hex() + '61736466');
      expect(newKey.PasswordLastUpdate).toEqual(newDate);
      expect(newKey.IsEncrypted).toEqual(true);

      // reset after test
      await asGetSigningKeyInstance.changeSigningKeyPassword({
        oldPassword: 'asdf',
        newPassword: privateDeriverPassword,
        currentTime: signingKey.row.PasswordLastUpdate,
      });
    }

    const asAddFromPublicInstance = asAddFromPublic(publicDeriver);
    expect(asAddFromPublicInstance != null).toEqual(true);
    if (asAddFromPublicInstance != null) {
      // TODO
    }
  }

  // test getAllBip44Wallets
  {
    const bip44Wallets = await getAllBip44Wallets(db);
    expect(JSON.stringify(bip44Wallets)).toEqual(JSON.stringify([
      {
        ConceptualWallet: {
          CoinType: 2147485463,
          Name: 'My Test Wallet',
          ConceptualWalletId: 1
        },
        Bip44Wrapper: {
          ConceptualWalletId: 1,
          IsBundled: false,
          SignerLevel: 0,
          PublicDeriverLevel: 3,
          Version: 2,
          Bip44WrapperId: 1
        }
      }
    ]));
  }

  // test getPublicDeriversFor
  {
    const pubDerivers = await getPublicDeriversFor(
      db,
      state.bip44WrapperRow.Bip44WrapperId,
    );
    expect(pubDerivers).toEqual([{
      Bip44WrapperId: 1,
      KeyDerivationId: 4,
      Name: '',
      LastSyncInfoId: 1,
      PublicDeriverId: 1
    }, {
      Bip44WrapperId: 1,
      KeyDerivationId: 47,
      Name: 'Checking account',
      LastSyncInfoId: 2,
      PublicDeriverId: 2
    }]);
  }

  // test renaming conceptual wallet
  {
    await bipWallet.rename({
      newName: 'rename test',
    });
    const info = await bipWallet.getFullConceptualWalletInfo();
    expect(info.Name).toEqual('rename test');
    await bipWallet.rename({
      newName: 'My Test Wallet',
    });
  }

  // console.log(stableStringify(await db.export()));
  compareObject(await db.export(), snapshot);
  done();
});

/**
 * We want to compare the test result with a snapshot of the database
 * However, the diff is too big to reasonably compare with your eyes
 * Therefore, we test each table separately
 */
function compareObject(obj1: { tables: any }, obj2: { tables: any }) {
  for (const prop of Object.keys(obj1)) {
    if (obj1[prop] !== undefined && obj2[prop] === undefined) {
      expect(stableStringify(obj1)).toEqual(stableStringify(obj2));
    }
  }
  for (const prop of Object.keys(obj2)) {
    if (obj2[prop] !== undefined && obj1[prop] === undefined) {
      expect(stableStringify(obj1)).toEqual(stableStringify(obj2));
    }
  }

  const obj2KeySet = new Set(Object.keys(obj2));
  const keysInBoth = Object.keys(obj1).filter(key => obj2KeySet.has(key));
  for (const key of keysInBoth) {
    if (key === 'tables') {
      compareObject(obj1[key], obj2[key]);
    } else {
      expect(stableStringify(obj1[key])).toEqual(stableStringify(obj2[key]));
    }
  }
}
