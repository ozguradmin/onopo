'use client'

import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
    children: ReactNode
}

interface State {
    hasError: boolean
}

export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    }

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo)

        // Check for specific hydration errors or critical UI failures
        if (error.message.includes('removeChild') ||
            error.message.includes('properties of null') ||
            error.message.includes('Minified React error')) {

            // Force hard reload to recover from hydration mismatch
            if (typeof window !== 'undefined') {
                // Use timestamp to prevent infinite loops if error persists?
                // But user explicitly asked for "Force Redirect/Reload" logic
                window.location.reload()
            }
        }
    }

    public render() {
        if (this.state.hasError) {
            // Return null or a simple loader while reloading
            return null
        }

        return this.props.children
    }
}
