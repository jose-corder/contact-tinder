import { Component, type ReactNode } from 'react'
import { Button, Frame } from './index'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <Frame><div role="alert" className="my-auto py-12">
      <h1 className="font-serif t-title">Something went wrong loading this screen</h1>
      <p className="mt-3 t-body text-ink-2">Reload to try again.</p>
      <Button type="button" className="mt-6" onClick={() => window.location.reload()}>Reload</Button>
    </div></Frame>
  }
}
