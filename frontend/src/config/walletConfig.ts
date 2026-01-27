import {
  getAddress,
  getNetwork,
  getNetworkDetails,
  isConnected as freighterIsConnected,
  requestAccess,
  signTransaction as freighterSignTransaction,
} from "@stellar/freighter-api"

// Wallet + network primitives only; UI and contract layers should consume via hooks/context.

export const SOROBAN_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"
export const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org"

const NETWORK_PASSPHRASES = {
  TESTNET: "Test SDF Network ; September 2015",
  PUBLIC: "Public Global Stellar Network ; September 2015",
  FUTURENET: "Test SDF Future Network ; October 2022",
} as const

const FREIGHTER_EXTERNAL_MSG_REQUEST = "FREIGHTER_EXTERNAL_MSG_REQUEST"
const FREIGHTER_EXTERNAL_MSG_RESPONSE = "FREIGHTER_EXTERNAL_MSG_RESPONSE"
const FREIGHTER_CONNECTION_STATUS = "REQUEST_CONNECTION_STATUS"
const FREIGHTER_PING_TIMEOUT_MS = 400
const FREIGHTER_PING_ATTEMPTS = 4

type FreighterWindow = Window & {
  freighter?: boolean
  freighterApi?: unknown
}

function hasFreighterHint(): boolean {
  if (typeof window === "undefined") {
    return false
  }

  const freighterWindow = window as FreighterWindow
  return typeof freighterWindow.freighter !== "undefined" || !!freighterWindow.freighterApi
}

// Detect the extension via a lightweight postMessage handshake.
async function pingFreighter(timeoutMs: number): Promise<boolean> {
  if (typeof window === "undefined") {
    return false
  }

  return new Promise((resolve) => {
    const messageId = Date.now() + Math.random()
    let timeoutId: number | undefined

    const cleanup = () => {
      window.removeEventListener("message", handleMessage)
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) {
        return
      }
      const data = event.data as { source?: string; messagedId?: number; messageId?: number }
      if (data?.source !== FREIGHTER_EXTERNAL_MSG_RESPONSE) {
        return
      }
      const responseId = data.messagedId ?? data.messageId
      if (responseId !== messageId) {
        return
      }
      cleanup()
      resolve(true)
    }

    window.addEventListener("message", handleMessage)
    window.postMessage(
      {
        source: FREIGHTER_EXTERNAL_MSG_REQUEST,
        messageId,
        type: FREIGHTER_CONNECTION_STATUS,
      },
      window.location.origin,
    )

    timeoutId = window.setTimeout(() => {
      cleanup()
      resolve(false)
    }, timeoutMs)
  })
}

function freighterErrorMessage(error: unknown, fallback: string): string {
  if (!error) {
    return fallback
  }
  if (typeof error === "string") {
    return error
  }
  if (typeof (error as { message?: string }).message === "string") {
    return (error as { message?: string }).message || fallback
  }
  return fallback
}

export async function isFreighterInstalled(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false
  }

  if (hasFreighterHint()) {
    return true
  }

  for (let attempt = 0; attempt < FREIGHTER_PING_ATTEMPTS; attempt += 1) {
    const timeout = FREIGHTER_PING_TIMEOUT_MS + attempt * 250
    if (await pingFreighter(timeout)) {
      return true
    }
  }

  return false
}

export async function getFreighterNetworkPassphrase(): Promise<string | null> {
  if (!(await isFreighterInstalled())) {
    return null
  }

  const details = await getNetworkDetails()
  if (!details.error && details.networkPassphrase) {
    return details.networkPassphrase
  }

  const network = await getNetwork()
  if (!network.error) {
    if (network.networkPassphrase) {
      return network.networkPassphrase
    }
    if (network.network) {
      const normalized = network.network.toUpperCase()
      return NETWORK_PASSPHRASES[normalized as keyof typeof NETWORK_PASSPHRASES] ?? network.network
    }
  }

  return null
}

export async function connectWallet(): Promise<string> {
  if (!(await isFreighterInstalled())) {
    throw new Error("Freighter not installed")
  }

  const response = await requestAccess()
  if (response.error) {
    throw new Error(freighterErrorMessage(response.error, "Freighter unavailable"))
  }
  if (!response.address) {
    throw new Error("Freighter not connected")
  }
  return response.address
}

export async function getWalletPublicKey(): Promise<string> {
  if (!(await isFreighterInstalled())) {
    throw new Error("Freighter not installed")
  }

  const connection = await freighterIsConnected()
  if (connection.error) {
    throw new Error(freighterErrorMessage(connection.error, "Freighter unavailable"))
  }
  if (!connection.isConnected) {
    throw new Error("Freighter not connected")
  }

  const response = await getAddress()
  if (response.error) {
    throw new Error(freighterErrorMessage(response.error, "Freighter unavailable"))
  }
  if (!response.address) {
    throw new Error("Freighter not connected")
  }
  return response.address
}

export async function signWithFreighter(txXdr: string): Promise<string> {
  if (!(await isFreighterInstalled())) {
    throw new Error("Freighter not installed")
  }

  const response = await freighterSignTransaction(txXdr, {
    networkPassphrase: SOROBAN_NETWORK_PASSPHRASE,
  })

  if (response.error) {
    throw new Error(freighterErrorMessage(response.error, "Freighter unavailable"))
  }
  if (!response.signedTxXdr) {
    throw new Error("Freighter unavailable")
  }
  return response.signedTxXdr
}
