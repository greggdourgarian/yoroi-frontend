// @flow
import type { Node } from 'react';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { computed } from 'mobx';
import type { InjectedOrGenerated } from '../../types/injectedPropsType';
import TestnetWarningBanner from '../../components/topbar/banners/TestnetWarningBanner';
import ByronDeprecationBanner from './ByronDeprecationBanner';
import NotProductionBanner from '../../components/topbar/banners/NotProductionBanner';
import ServerErrorBanner from '../../components/topbar/banners/ServerErrorBanner';
import IncorrectTimeBanner from '../../components/topbar/banners/IncorrectTimeBanner';
import environment from '../../environment';
import { ServerStatusErrors } from '../../types/serverStatusErrorType';
import type { ServerStatusErrorType } from '../../types/serverStatusErrorType';
import { PublicDeriver } from '../../api/ada/lib/storage/models/PublicDeriver/index';
import { isTestnet, isCardanoHaskell } from '../../api/ada/lib/storage/database/prepackaged/networks';
import { Bip44Wallet } from '../../api/ada/lib/storage/models/Bip44Wallet/wrapper';

export type GeneratedData = typeof BannerContainer.prototype.generated;

@observer
export default class BannerContainer extends Component<InjectedOrGenerated<GeneratedData>> {

  render(): Node {
    const serverStatus = this.generated.stores.serverConnectionStore.checkAdaServerStatus;

    const { selected } = this.generated.stores.wallets;
    const isWalletTestnet = selected == null
      ? false
      : isTestnet(selected.getParent().getNetworkInfo());

    const deprecationBanner = (
      selected != null &&
      isCardanoHaskell(selected.getParent().getNetworkInfo()) &&
      selected.getParent() instanceof Bip44Wallet
    )
      ? <ByronDeprecationBanner
        onUpgrade={undefined}
      />
      : undefined;
    return (
      <>
        {/* if running in offline mode, don't render an error */}
        {this.generated.stores.serverConnectionStore.serverTime != null && (
          <IncorrectTimeBanner
            serverTime={this.generated.stores.serverConnectionStore.serverTime}
          />
        )}
        {serverStatus !== ServerStatusErrors.Healthy && (
          <ServerErrorBanner errorType={serverStatus} />
        )}
        <TestnetWarningBanner isTestnet={isWalletTestnet} />
        {!environment.isProduction() && <NotProductionBanner />}
        {deprecationBanner}
      </>
    );
  }

  @computed get generated(): {|
    stores: {|
      serverConnectionStore: {|
        checkAdaServerStatus: ServerStatusErrorType,
        serverTime: void | Date,
      |},
      wallets: {| selected: null | PublicDeriver<> |},
    |},
    actions: {||},
    |} {
    if (this.props.generated !== undefined) {
      return this.props.generated;
    }
    if (this.props.stores == null || this.props.actions == null) {
      throw new Error(`${nameof(BannerContainer)} no way to generated props`);
    }
    const { stores, } = this.props;
    return Object.freeze({
      stores: {
        serverConnectionStore: {
          checkAdaServerStatus: stores.serverConnectionStore.checkAdaServerStatus,
          serverTime: stores.serverConnectionStore.serverTime,
        },
        wallets: {
          selected: stores.wallets.selected,
        },
      },
      actions: Object.freeze({}),
    });
  }
}
