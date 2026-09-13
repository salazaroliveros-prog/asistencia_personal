/**
 * Firebase Functions Client SDK
 * Cliente para llamar a Cloud Functions de Firebase
 */

type FunctionsResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
};

type UserInfo = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
  customClaims: Record<string, unknown>;
  isAdmin: boolean;
  creationTime: string;
  lastSignInTime: string | null;
  providerData: Array<{
    providerId: string;
    uid: string;
    displayName: string | null;
    email: string | null;
  }>;
};

type UserListItem = {
  uid: string;
  email: string;
  emailVerified: boolean;
  customClaims: Record<string, unknown>;
  isAdmin: boolean;
  creationTime: string;
  lastSignInTime: string | null;
};

declare global {
  interface Window {
    firebase?: {
      functions(): {
        httpsCallable(name: string): (data: unknown) => Promise<{ data: unknown }>;
      };
    };
    FunctionsClient: FunctionsClientType;
  }
}

type FunctionsClientType = {
  initialize(): boolean;
  isReady(): boolean;
  setAdminClaim(uid: string, isAdmin: boolean): Promise<FunctionsResult<{ uid: string; admin: boolean }>>;
  getUserClaims(): Promise<FunctionsResult<{ uid: string; email: string | null; emailVerified: boolean; customClaims: Record<string, unknown>; isAdmin: boolean }>>;
  listUsers(): Promise<FunctionsResult<{ users: UserListItem[]; total: number }>>;
  getUserInfo(uid: string): Promise<FunctionsResult<UserInfo>>;
  createUser(email: string, password: string, displayName?: string, isAdmin?: boolean): Promise<FunctionsResult<{ uid: string; email: string; displayName: string | null; isAdmin: boolean }>>;
  deleteUser(uid: string): Promise<FunctionsResult<{ uid: string }>>;
  healthCheck(): Promise<FunctionsResult<{ status: string; timestamp: string }>>;
};

const FunctionsClient: FunctionsClientType = (() => {
  let functionsInstance: ReturnType<NonNullable<Window['firebase']>['functions']> | null = null;
  let initialized = false;

  function initialize(): boolean {
    if (!window.firebase) {
      console.warn('[Functions] Firebase SDK not available');
      return false;
    }

    try {
      const app = window.firebase.apps[0] || window.firebase.initializeApp(window.FIREBASE_CONFIG);
      functionsInstance = window.firebase.functions();
      initialized = true;
      console.log('[Functions] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[Functions] Initialization error:', error);
      return false;
    }
  }

  function isReady(): boolean {
    return initialized && functionsInstance !== null;
  }

  async function callFunction<T>(name: string, data: unknown): Promise<FunctionsResult<T>> {
    if (!isReady()) {
      const initSuccess = initialize();
      if (!initSuccess) {
        return { success: false, error: 'Functions not initialized' };
      }
    }

    try {
      const callable = functionsInstance!.httpsCallable(name);
      const result = await callable(data);
      return { success: true, data: result.data as T };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      console.error(`[Functions] Error calling ${name}:`, error);
      return { 
        success: false, 
        error: err.message || 'Unknown error',
        code: err.code
      };
    }
  }

  async function setAdminClaim(uid: string, isAdmin: boolean): Promise<FunctionsResult<{ uid: string; admin: boolean }>> {
    return callFunction<{ uid: string; admin: boolean }>('setAdminClaim', { uid, isAdmin });
  }

  async function getUserClaims(): Promise<FunctionsResult<{ uid: string; email: string | null; emailVerified: boolean; customClaims: Record<string, unknown>; isAdmin: boolean }>> {
    return callFunction('getUserClaims', {});
  }

  async function listUsers(): Promise<FunctionsResult<{ users: UserListItem[]; total: number }>> {
    return callFunction('listUsers', {});
  }

  async function getUserInfo(uid: string): Promise<FunctionsResult<UserInfo>> {
    return callFunction('getUserInfo', { uid });
  }

  async function createUser(email: string, password: string, displayName?: string, isAdmin?: boolean): Promise<FunctionsResult<{ uid: string; email: string; displayName: string | null; isAdmin: boolean }>> {
    return callFunction('createUser', { email, password, displayName, isAdmin });
  }

  async function deleteUser(uid: string): Promise<FunctionsResult<{ uid: string }>> {
    return callFunction('deleteUser', { uid });
  }

  async function healthCheck(): Promise<FunctionsResult<{ status: string; timestamp: string }>> {
    try {
      const response = await fetch('https://us-central1-sistema-de-control-aee89.cloudfunctions.net/healthCheck');
      const data = await response.json();
      return { success: true, data: data as { status: string; timestamp: string } };
    } catch (error) {
      console.error('[Functions] Health check error:', error);
      return { success: false, error: 'Health check failed' };
    }
  }

  return {
    initialize,
    isReady,
    setAdminClaim,
    getUserClaims,
    listUsers,
    getUserInfo,
    createUser,
    deleteUser,
    healthCheck
  };
})();

window.FunctionsClient = FunctionsClient;

export { FunctionsClient, type FunctionsResult, type UserInfo, type UserListItem };