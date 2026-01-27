

import * as React from 'react'
import {
  connectWallet,
  getFreighterNetworkPassphrase,
  getWalletPublicKey,
  isFreighterInstalled,
  signWithFreighter,
  SOROBAN_NETWORK_PASSPHRASE,
  SOROBAN_RPC_URL,
} from '../config/walletConfig'

// WalletProvider owns Freighter connection state; contract code should consume it via this context.
type WalletContextValue = {
  publicKey: string | null
  isConnected: boolean
  isConnecting: boolean
  hasFreighter: boolean
  error: string | null
  networkPassphrase: string
  rpcUrl: string
  walletNetworkPassphrase: string | null
  isOnAllowedNetwork: boolean
  connect: () => Promise<void>
  disconnect: () => void
  refresh: () => Promise<void>
  signTransaction: (txXdr: string) => Promise<string>
}

const WalletContext = React.createContext<WalletContextValue | undefined>(undefined)

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return ''
}

function getUserFacingError(error: unknown): string | null {
  const message = getErrorMessage(error)
  if (!message) {
    return 'Wallet error'
  }
  const lower = message.toLowerCase()
  if (lower.includes('not connected')) {
    return null
  }
  if (lower.includes('not installed')) {
    return 'Freighter not installed'
  }
  if (lower.includes('rejected') || lower.includes('declined') || lower.includes('denied')) {
    return 'Connection rejected'
  }
  return message
}

function isNotConnectedError(error: unknown): boolean {
  return getErrorMessage(error).toLowerCase().includes('not connected')
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [publicKey, setPublicKey] = React.useState<string | null>(null)
  const [isConnecting, setIsConnecting] = React.useState(false)
  const [hasFreighter, setHasFreighter] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [walletNetworkPassphrase, setWalletNetworkPassphrase] = React.useState<string | null>(null)
  const freighterCheckAttempts = React.useRef(0)

  const isOnAllowedNetwork = React.useMemo(() => {
    if (!walletNetworkPassphrase) {
      return true
    }
    return walletNetworkPassphrase === SOROBAN_NETWORK_PASSPHRASE
  }, [walletNetworkPassphrase])

  const updateNetworkStatus = React.useCallback(async () => {
    const passphrase = await getFreighterNetworkPassphrase()
    setWalletNetworkPassphrase(passphrase)
  }, [])

  const refresh = React.useCallback(async () => {
    const installed = await isFreighterInstalled()
    setHasFreighter(installed)

    if (!installed) {
      setPublicKey(null)
      setWalletNetworkPassphrase(null)
      setError(null)
      return
    }

    try {
      const key = await getWalletPublicKey()
      setPublicKey(key)
      setError(null)
      await updateNetworkStatus()
    } catch (err) {
      if (isNotConnectedError(err)) {
        setPublicKey(null)
        setWalletNetworkPassphrase(null)
        setError(null)
        return
      }
      setPublicKey(null)
      setWalletNetworkPassphrase(null)
      setError(getUserFacingError(err))
    }
  }, [updateNetworkStatus])

  const connect = React.useCallback(async () => {
    if (isConnecting) {
      return
    }

    const installed = await isFreighterInstalled()
    setHasFreighter(installed)

    if (!installed) {
      setError('Freighter not installed')
      return
    }

    if (publicKey) {
      await updateNetworkStatus()
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      const key = await connectWallet()
      setPublicKey(key)
      await updateNetworkStatus()
    } catch (err) {
      const userError = getUserFacingError(err)
      if (userError) {
        setError(userError)
      }
      setPublicKey(null)
      setWalletNetworkPassphrase(null)
    } finally {
      setIsConnecting(false)
    }
  }, [isConnecting, publicKey, updateNetworkStatus])

  const disconnect = React.useCallback(() => {
    setPublicKey(null)
    setWalletNetworkPassphrase(null)
    setError(null)
  }, [])

  const signTransaction = React.useCallback(
    async (txXdr: string) => {
      if (!publicKey) {
        throw new Error('Wallet not connected')
      }
      if (!isOnAllowedNetwork) {
        throw new Error('Wrong network')
      }
      return signWithFreighter(txXdr)
    },
    [publicKey, isOnAllowedNetwork],
  )

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  React.useEffect(() => {
    if (hasFreighter) {
      freighterCheckAttempts.current = 0
      return
    }
    if (freighterCheckAttempts.current >= 3) {
      return
    }
    const timeoutId = window.setTimeout(() => {
      freighterCheckAttempts.current += 1
      void refresh()
    }, 1000)
    return () => window.clearTimeout(timeoutId)
  }, [hasFreighter, refresh])

  const value = React.useMemo<WalletContextValue>(
    () => ({
      publicKey,
      isConnected: !!publicKey,
      isConnecting,
      hasFreighter,
      error,
      networkPassphrase: SOROBAN_NETWORK_PASSPHRASE,
      rpcUrl: SOROBAN_RPC_URL,
      walletNetworkPassphrase,
      isOnAllowedNetwork,
      connect,
      disconnect,
      refresh,
      signTransaction,
    }),
    [
      publicKey,
      isConnecting,
      hasFreighter,
      error,
      walletNetworkPassphrase,
      isOnAllowedNetwork,
      connect,
      disconnect,
      refresh,
      signTransaction,
    ],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletContextValue {
  const context = React.useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider')
  }
  return context
}
