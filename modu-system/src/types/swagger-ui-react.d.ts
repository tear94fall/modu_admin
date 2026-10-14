// swagger-ui-react 는 타입을 싣지 않는다. 이 콘솔이 넘기는 속성만 적는다.
declare module 'swagger-ui-react' {
  import type { ComponentType } from 'react'

  export interface SwaggerUIProps {
    spec?: object | string
    url?: string
    docExpansion?: 'list' | 'full' | 'none'
    filter?: boolean | string
    deepLinking?: boolean
    tryItOutEnabled?: boolean
    displayRequestDuration?: boolean
    persistAuthorization?: boolean
    supportedSubmitMethods?: string[]
    defaultModelsExpandDepth?: number
    requestInterceptor?: (req: { url: string; headers: Record<string, string> }) => unknown
  }

  const SwaggerUI: ComponentType<SwaggerUIProps>
  export default SwaggerUI
}
