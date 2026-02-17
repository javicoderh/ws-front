import type { PropsWithChildren } from 'react'
import { ApiClientProvider } from './ApiClientContext'
import { AuthProvider } from './AuthContext'
import { TokensProvider } from './TokensContext'
import { HelperProvider } from './HelperContext'
import { WorkshopsProvider } from './WorkshopsContext'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ApiClientProvider>
      <AuthProvider>
        <TokensProvider>
          <HelperProvider>
            <WorkshopsProvider>{children}</WorkshopsProvider>
          </HelperProvider>
        </TokensProvider>
      </AuthProvider>
    </ApiClientProvider>
  )
}
