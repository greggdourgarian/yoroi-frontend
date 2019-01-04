import environment from '../../environment';

const networkForLocalStorage = String(environment.NETWORK);
const storageKeys = {
  USER_LOCALE: networkForLocalStorage + '-USER-LOCALE',
  TERMS_OF_USE_ACCEPTANCE: networkForLocalStorage + '-TERMS-OF-USE-ACCEPTANCE',
  THEME: networkForLocalStorage + '-THEME',
  DROPBOX_TOKEN: networkForLocalStorage + '-DROPBOX-TOKEN',
  MEMOS: networkForLocalStorage + '-MEMOS',
};

/**
 * This api layer provides access to the electron local storage
 * for user settings that are not synced with any coin backend.
 */

export default class LocalStorageApi {

  getUserLocale = (): Promise<string> => new Promise((resolve, reject) => {
    try {
      const locale = localStorage.getItem(storageKeys.USER_LOCALE);
      if (!locale) return resolve('');
      resolve(locale);
    } catch (error) {
      return reject(error);
    }
  });

  setUserLocale = (locale: string): Promise<void> => new Promise((resolve, reject) => {
    try {
      localStorage.setItem(storageKeys.USER_LOCALE, locale);
      resolve();
    } catch (error) {
      return reject(error);
    }
  });

  unsetUserLocale = (): Promise<void> => new Promise((resolve) => {
    try {
      localStorage.removeItem(storageKeys.USER_LOCALE);
      resolve();
    } catch (error) {} // eslint-disable-line
  });

  getTermsOfUseAcceptance = (): Promise<boolean> => new Promise((resolve, reject) => {
    try {
      const accepted = localStorage.getItem(storageKeys.TERMS_OF_USE_ACCEPTANCE);
      if (!accepted) return resolve(false);
      resolve(JSON.parse(accepted));
    } catch (error) {
      return reject(error);
    }
  });

  setTermsOfUseAcceptance = (): Promise<void> => new Promise((resolve, reject) => {
    try {
      localStorage.setItem(storageKeys.TERMS_OF_USE_ACCEPTANCE, true);
      resolve();
    } catch (error) {
      return reject(error);
    }
  });

  unsetTermsOfUseAcceptance = (): Promise<void> => new Promise((resolve) => {
    try {
      localStorage.removeItem(storageKeys.TERMS_OF_USE_ACCEPTANCE);
      resolve();
    } catch (error) {} // eslint-disable-line
  });

  getUserDropboxToken = (): Promise<void> => new Promise((resolve, reject) => {
    try {
      const token = localStorage.getItem(storageKeys.DROPBOX_TOKEN);
      resolve(token);
    } catch (error) {
      return reject(error);
    }
  });

  setUserDropboxToken = (token: string): Promise<void> => new Promise((resolve, reject) => {
    try {
      localStorage.setItem(storageKeys.DROPBOX_TOKEN, token);
      resolve();
    } catch (error) {
      return reject(error);
    }
  });

  unsetUserDropboxToken = (): Promise<void> => new Promise((resolve, reject) => {
    try {
      localStorage.removeItem(storageKeys.DROPBOX_TOKEN);
      resolve();
    } catch (error) {
      return reject(error);
    }
  });

  getMemosFromStorage = (): Promise<void> => new Promise((resolve, reject) => {
    try {
      const memos = localStorage.getItem(storageKeys.MEMOS);
      resolve(JSON.parse(memos));
    } catch (error) {
      return reject(error);
    }
  });

  saveMemoToStorage = (memo): Promise<void> => new Promise((resolve, reject) => {
    try {
      const memos = localStorage.getItem(storageKeys.MEMOS);
      console.log('what?', memos);
      if (memos) {
        localStorage.setItem(storageKeys.MEMOS, JSON.stringify(JSON.parse(memos).concat(memo)));
      } else {
        localStorage.setItem(storageKeys.MEMOS, JSON.stringify([memo]));
      }
      resolve();
    } catch (error) {
      return reject(error);
    }
  });

  unsetMemosInStorage = (): Promise<void> => new Promise((resolve, reject) => {
    try {
      localStorage.removeItem(storageKeys.MEMOS);
      resolve();
    } catch (error) {
      return reject(error);
    }
  });

  async reset() {
    await this.unsetUserLocale(); // TODO: remove after saving locale to API is restored
    await this.unsetTermsOfUseAcceptance();
    await this.unsetMemosInStorage();
  }

}
